// Scheduled notifications (F5, §8).
//
// A per-minute cron evaluates enabled schedules and sends the day's short notification to all
// active devices. Dedupe is by calendar date (in the configured timezone) via last_run_at, so a
// schedule fires at most once per day unless triggered manually.

import cron from 'node-cron';
import db from '../db/database.js';
import { getSettings } from './settingsService.js';
import { getPregnancyStatus } from './pregnancyService.js';
import { getOrCreateTodayCard, generateCardForDate } from './cardService.js';
import { sendToAllActiveDevices } from './pushService.js';
import { getConfig, setConfig } from './configService.js';
import { nowPartsInTimezone, addDays } from '../utils/dateUtils.js';
import { logger } from '../utils/logger.js';

const LAST_PREGEN_KEY = 'last_pregen_date';

/** Local-date the daily pre-generation last completed on (null if never). */
export function getLastPregenDate() {
  return getConfig(LAST_PREGEN_KEY);
}

// How long after the scheduled minute a missed send is still delivered. Exact-minute matching
// silently drops the day's notification whenever the matching tick is late or never runs — a
// restart at that minute, or the same tick first awaiting the (slow) Gemini pre-generation.
// Bounded so a schedule created/enabled hours past its time doesn't fire absurdly late.
export const CATCHUP_WINDOW_MINUTES = 180;

function minutesOfDay(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Decide whether a schedule should fire right now. PURE and timezone-agnostic — all
 * time-sensitive values are passed in via `nowParts`, so this is fully unit-testable.
 *
 * Fires at-or-after the configured minute (within CATCHUP_WINDOW_MINUTES, same local day),
 * deduped to once per calendar day — so a tick delayed past the exact minute still sends.
 *
 * @param schedule row from notification_schedules (snake_case)
 * @param nowParts { date:'YYYY-MM-DD', time:'HH:mm', dayOfWeek:0-6, gestationalWeek,
 *                   gestationalDay, lastRunDate } — all timezone-local (date AND lastRunDate
 *                   must be in the same zone so dedupe compares like-for-like).
 */
export function shouldRunSchedule(schedule, nowParts) {
  if (!schedule.enabled) return false;

  // At-or-after the configured minute, within the catch-up window (never across midnight).
  const lateBy = minutesOfDay(nowParts.time) - minutesOfDay(schedule.time_of_day);
  if (lateBy < 0 || lateBy > CATCHUP_WINDOW_MINUTES) return false;

  // Day-of-week filter: CSV of 0-6 (0=Sunday). Empty/null = every day.
  if (schedule.days_of_week) {
    const allowed = schedule.days_of_week
      .split(',')
      .map((d) => Number(d.trim()))
      .filter((d) => Number.isInteger(d));
    if (allowed.length && !allowed.includes(nowParts.dayOfWeek)) return false;
  }

  // Only on the first day of a real gestational week (week >= 1, day 0), when requested.
  // Guards against the pre-conception window where gestationalDay is clamped to 0 every day.
  if (schedule.send_on_new_week && !(nowParts.gestationalDay === 0 && nowParts.gestationalWeek >= 1)) {
    return false;
  }

  // Dedupe: never run twice on the same calendar day (in the configured timezone).
  if (nowParts.lastRunDate && nowParts.lastRunDate === nowParts.date) return false;

  return true;
}

function getEnabledSchedules() {
  return db.prepare('SELECT * FROM notification_schedules WHERE enabled = 1').all();
}

function markScheduleRun(id, isoNow) {
  db.prepare('UPDATE notification_schedules SET last_run_at = ?, updated_at = ? WHERE id = ?').run(
    isoNow,
    isoNow,
    id,
  );
}

/** Evaluate all schedules once and send any that are due. Exposed for tests/manual triggers. */
export async function runDueSchedules(now = new Date()) {
  const settings = getSettings();
  if (!settings.notifications_enabled) return { skipped: 'notifications_disabled' };
  if (settings.baby_arrived) return { skipped: 'baby_arrived' }; // delivery-day mode: no more daily pings

  const parts = nowPartsInTimezone(settings.timezone, now);
  const status = getPregnancyStatus(settings, parts.date);
  const fired = [];

  for (const schedule of getEnabledSchedules()) {
    // Convert the stored UTC run timestamp to the configured-timezone calendar date so the
    // dedupe compares like-for-like with parts.date (which is also timezone-local).
    const lastRunDate = schedule.last_run_at
      ? nowPartsInTimezone(settings.timezone, new Date(schedule.last_run_at)).date
      : null;
    const nowParts = {
      ...parts,
      gestationalWeek: status.gestationalWeek,
      gestationalDay: status.gestationalDay,
      lastRunDate,
    };

    if (!shouldRunSchedule(schedule, nowParts)) continue;

    logger.info(`Scheduler firing schedule id=${schedule.id} "${schedule.name}" at ${parts.time}`);
    const card = getOrCreateTodayCard(); // text-only/fast; never blocks on image generation
    await sendToAllActiveDevices({
      title: settings.baby_nickname,
      body: card.short_notification,
      url: '/',
    });
    markScheduleRun(schedule.id, now.toISOString());
    fired.push(schedule.id);
  }

  if (fired.length) logger.debug(`Scheduler fired: ${fired.join(', ')}`);
  return { fired };
}

/**
 * Decide whether to pre-generate the next day's card now. PURE/testable.
 * Runs at-or-after the configured time, once per day (deduped via lastPregenDate), and only
 * when enabled. `parts.time` and `parts.date` are timezone-local; lastPregenDate is the local
 * date we last pre-generated on.
 */
export function shouldPregenerate(settings, parts, lastPregenDate) {
  if (settings.baby_arrived) return false; // delivery-day mode: nothing left to pre-generate
  if (!settings.auto_generate_enabled) return false;
  if (!settings.auto_generate_time) return false;
  if (parts.time < settings.auto_generate_time) return false; // not yet time today
  if (lastPregenDate === parts.date) return false; // already done today
  return true;
}

let pregenInFlight = false;
const pregenAttempts = new Map(); // local-date -> attempt count (in-memory; resets on restart)
const MAX_PREGEN_ATTEMPTS = 5;

/**
 * Once per day, AI-generate the NEXT day's card (text + image) in advance so it is ready well
 * before the morning. Independent of the notifications switch; skipped without a Gemini key.
 *
 * If the AI text falls back (Gemini hiccup), we do NOT mark the day done, so the next tick
 * retries — bounded to MAX_PREGEN_ATTEMPTS per day so a misconfigured key can't loop forever.
 * An in-flight guard prevents overlapping runs when image generation is slow.
 */
export async function pregenerateUpcomingCard(now = new Date()) {
  const settings = getSettings();
  if (!settings.gemini_api_key) return { skipped: 'no_gemini_key' };
  if (pregenInFlight) return { skipped: 'in_flight' };

  const parts = nowPartsInTimezone(settings.timezone, now);
  if (!shouldPregenerate(settings, parts, getConfig(LAST_PREGEN_KEY))) {
    return { skipped: 'not_due' };
  }

  pregenInFlight = true;
  try {
    const target = addDays(parts.date, 1);
    const attempts = (pregenAttempts.get(parts.date) || 0) + 1;
    pregenAttempts.set(parts.date, attempts);

    logger.info(`Pre-generating tomorrow's card (${target}), attempt ${attempts}…`);
    const card = await generateCardForDate(target, { withImage: true });

    // Mark the day done on AI success, or after exhausting retries (keep the fallback card).
    if (card.generation_status === 'ai' || attempts >= MAX_PREGEN_ATTEMPTS) {
      setConfig(LAST_PREGEN_KEY, parts.date);
      pregenAttempts.delete(parts.date);
      logger.info(`Pre-generation done for ${target} (status=${card.generation_status}).`);
      return { generated: target, status: card.generation_status };
    }

    logger.warn(
      `Pre-generation for ${target} fell back; will retry (attempt ${attempts}/${MAX_PREGEN_ATTEMPTS}).`,
    );
    return { retry: target, attempts };
  } finally {
    pregenInFlight = false;
  }
}

let task = null;

export function startScheduler() {
  if (task) return; // idempotent
  task = cron.schedule('* * * * *', async () => {
    // Notifications first: pre-generation (Gemini text + image) can take minutes, and a due
    // send must not wait behind it. Failures are independent; one must not block the other.
    await runDueSchedules().catch((err) => logger.error('Scheduler tick failed:', err));
    await pregenerateUpcomingCard().catch((err) => logger.error('Pre-generation failed:', err));
  });
  logger.info('Notification scheduler started (every minute).');
}

export function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
}

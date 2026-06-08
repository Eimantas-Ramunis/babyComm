// Scheduled notifications (F5, §8).
//
// A per-minute cron evaluates enabled schedules and sends the day's short notification to all
// active devices. Dedupe is by calendar date (in the configured timezone) via last_run_at, so a
// schedule fires at most once per day unless triggered manually.

import cron from 'node-cron';
import db from '../db/database.js';
import { getSettings } from './settingsService.js';
import { getPregnancyStatus } from './pregnancyService.js';
import { getOrCreateTodayCard } from './cardService.js';
import { sendToAllActiveDevices } from './pushService.js';
import { nowPartsInTimezone } from '../utils/dateUtils.js';
import { logger } from '../utils/logger.js';

/**
 * Decide whether a schedule should fire right now. PURE and timezone-agnostic — all
 * time-sensitive values are passed in via `nowParts`, so this is fully unit-testable.
 *
 * @param schedule row from notification_schedules (snake_case)
 * @param nowParts { date:'YYYY-MM-DD', time:'HH:mm', dayOfWeek:0-6, gestationalWeek,
 *                   gestationalDay, lastRunDate } — all timezone-local (date AND lastRunDate
 *                   must be in the same zone so dedupe compares like-for-like).
 */
export function shouldRunSchedule(schedule, nowParts) {
  if (!schedule.enabled) return false;

  // Must match the configured minute.
  if (schedule.time_of_day !== nowParts.time) return false;

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

let task = null;

export function startScheduler() {
  if (task) return; // idempotent
  task = cron.schedule('* * * * *', () => {
    runDueSchedules().catch((err) => logger.error('Scheduler tick failed:', err));
  });
  logger.info('Notification scheduler started (every minute).');
}

export function stopScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
}

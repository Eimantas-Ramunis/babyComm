// Daily card storage + retrieval (F2/F3).
//
// In Phase 1 every card is a "fallback" card: no AI text/image yet. The contract
// is that /api/today can NEVER fail just because AI is unavailable.

import db from '../db/database.js';
import { getSettings } from './settingsService.js';
import { getPregnancyStatus } from './pregnancyService.js';
import { todayInTimezone } from '../utils/dateUtils.js';

const FALLBACK_MESSAGE =
  'Hi mom. I am growing a little more today. Dad says I am already extremely impressive.';

function getCardByDate(date) {
  return db.prepare('SELECT * FROM daily_cards WHERE card_date = ?').get(date);
}

/** Build fallback card content for a date from pregnancy status. */
function buildFallbackContent(date, settings) {
  const status = getPregnancyStatus(settings, date);
  return {
    card_date: date,
    gestational_week: status.gestationalWeek,
    gestational_day: status.gestationalDay,
    size_label: status.sizeLabel,
    development_fact: status.developmentFact,
    title: `Week ${status.gestationalWeek}`,
    short_notification: `Hey mom, today I am about the size of a ${status.sizeLabel}. 💛`,
    homepage_message: FALLBACK_MESSAGE,
    mood: 'cozy',
    image_url: null,
    image_prompt: null,
    generation_status: 'fallback',
  };
}

/**
 * Create (or overwrite) a fallback card for the given date.
 * Used on first homepage load and by the admin "generate today" button.
 */
export function createFallbackCard(date, settings = getSettings()) {
  const content = buildFallbackContent(date, settings);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO daily_cards
       (card_date, gestational_week, gestational_day, size_label, development_fact,
        title, short_notification, homepage_message, mood, image_url, image_prompt,
        generation_status, created_at, updated_at)
     VALUES
       (@card_date, @gestational_week, @gestational_day, @size_label, @development_fact,
        @title, @short_notification, @homepage_message, @mood, @image_url, @image_prompt,
        @generation_status, @created_at, @updated_at)
     ON CONFLICT(card_date) DO UPDATE SET
       gestational_week = excluded.gestational_week,
       gestational_day = excluded.gestational_day,
       size_label = excluded.size_label,
       development_fact = excluded.development_fact,
       title = excluded.title,
       short_notification = excluded.short_notification,
       homepage_message = excluded.homepage_message,
       mood = excluded.mood,
       image_url = excluded.image_url,
       image_prompt = excluded.image_prompt,
       generation_status = excluded.generation_status,
       updated_at = excluded.updated_at`,
  ).run({ ...content, created_at: now, updated_at: now });

  return getCardByDate(date);
}

/** Return the card for `date`, creating a fallback if none exists. */
export function getOrCreateCardForDate(date, settings = getSettings()) {
  return getCardByDate(date) ?? createFallbackCard(date, settings);
}

/** Today's card (in the configured timezone), creating a fallback if needed. */
export function getTodayCard() {
  const settings = getSettings();
  const today = todayInTimezone(settings.timezone);
  return getOrCreateCardForDate(today, settings);
}

/** All saved cards, newest first. */
export function getHistory() {
  return db.prepare('SELECT * FROM daily_cards ORDER BY card_date DESC').all();
}

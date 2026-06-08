// Daily card storage + retrieval (F2/F3) + AI generation orchestration (F6/F7).
//
// Contract: /api/today can NEVER fail just because AI is unavailable. AI text/image are
// best-effort; on any failure we fall back to the canned message / placeholder image.

import fs from 'node:fs';
import db from '../db/database.js';
import { getSettings } from './settingsService.js';
import { getPregnancyStatus } from './pregnancyService.js';
import { generateMessage } from './aiTextService.js';
import { generateImage } from './aiImageService.js';
import { todayInTimezone } from '../utils/dateUtils.js';
import { cardsUploadDir, cardImageUrl } from '../utils/paths.js';

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
 * Upsert a card's content row. Shared by the fallback and AI-text paths.
 * `resetImage`: when true the conflict update also clears/replaces image_url/image_prompt
 * (fallback path); when false the existing image is preserved (AI text-only regeneration).
 */
function upsertCard(content, { resetImage }) {
  const now = new Date().toISOString();
  const imageUpdate = resetImage
    ? 'image_url = excluded.image_url, image_prompt = excluded.image_prompt,'
    : '';

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
       ${imageUpdate}
       generation_status = excluded.generation_status,
       updated_at = excluded.updated_at`,
  ).run({ ...content, created_at: now, updated_at: now });

  return getCardByDate(content.card_date);
}

/**
 * Create (or overwrite) a fallback card for the given date.
 * Used on first homepage load and by the admin "generate today" button (no AI).
 */
export function createFallbackCard(date, settings = getSettings()) {
  return upsertCard(buildFallbackContent(date, settings), { resetImage: true });
}

/** Return the card for `date`, creating a fallback if none exists. */
export function getOrCreateCardForDate(date, settings = getSettings()) {
  return getCardByDate(date) ?? createFallbackCard(date, settings);
}

/** Today's card (in the configured timezone), creating a fallback if needed. Fast path. */
export function getTodayCard() {
  const settings = getSettings();
  const today = todayInTimezone(settings.timezone);
  return getOrCreateCardForDate(today, settings);
}

// The scheduler/homepage use this name; it must stay text-only/fast (never trigger AI/image).
export const getOrCreateTodayCard = getTodayCard;

/** All saved cards, newest first. */
export function getHistory() {
  return db.prepare('SELECT * FROM daily_cards ORDER BY card_date DESC').all();
}

/** Recent homepage messages (newest first) to give the AI anti-repetition context. */
export function getRecentMessages(limit = 5) {
  return db
    .prepare('SELECT homepage_message FROM daily_cards ORDER BY card_date DESC LIMIT ?')
    .all(limit)
    .map((r) => r.homepage_message)
    .filter(Boolean);
}

// Assemble the AI text-generation context from settings + (already-computed) status.
function buildAiTextContext(settings, status) {
  return {
    apiKey: settings.gemini_api_key,
    model: settings.gemini_text_model,
    babyNickname: settings.baby_nickname,
    week: status.gestationalWeek,
    day: status.gestationalDay,
    sizeLabel: status.sizeLabel,
    developmentFact: status.developmentFact,
    personality: settings.personality,
    tone: settings.tone,
    recentMessages: getRecentMessages(5),
  };
}

// AI card content row (image columns left null; preserved on conflict via resetImage:false).
function buildAiCardContent(date, status, message) {
  return {
    card_date: date,
    gestational_week: status.gestationalWeek,
    gestational_day: status.gestationalDay,
    size_label: status.sizeLabel,
    development_fact: status.developmentFact,
    title: message.title,
    short_notification: message.shortNotification,
    homepage_message: message.homepageMessage,
    mood: message.mood,
    image_url: null,
    image_prompt: null,
    generation_status: 'ai',
  };
}

/**
 * Generate (or regenerate) the AI message for a date. Falls back to the canned card on any
 * failure or when no Gemini key is configured. Returns the saved card row. Preserves any
 * existing image (text-only).
 */
export async function generateMessageForDate(date, settings = getSettings()) {
  if (!settings.gemini_api_key) return createFallbackCard(date, settings);
  const status = getPregnancyStatus(settings, date);
  try {
    const message = await generateMessage(buildAiTextContext(settings, status));
    return upsertCard(buildAiCardContent(date, status, message), { resetImage: false });
  } catch (err) {
    console.error(`AI text generation failed for ${date}, using fallback:`, err.message);
    // Keep an existing card untouched on failure; only create a fallback if none exists.
    return getCardByDate(date) ?? createFallbackCard(date, settings);
  }
}

/**
 * Generate (or regenerate) the image for an EXISTING card's date. Returns null if no card
 * exists for the date (so the caller can 404 without burning a Gemini call). Best-effort:
 * image failures are swallowed and the card is returned unchanged.
 */
export async function generateImageForDate(date, settings = getSettings()) {
  const existing = getCardByDate(date);
  if (!existing) return null; // never generate an orphan image for a nonexistent card
  if (!settings.gemini_api_key) return existing;

  const status = getPregnancyStatus(settings, date);
  try {
    const { buffer } = await generateImage({
      apiKey: settings.gemini_api_key,
      model: settings.gemini_image_model,
      sizeLabel: status.sizeLabel,
      personality: settings.personality,
    });
    fs.mkdirSync(cardsUploadDir, { recursive: true });
    fs.writeFileSync(`${cardsUploadDir}/${date}.png`, buffer);

    const now = new Date().toISOString();
    db.prepare('UPDATE daily_cards SET image_url = ?, updated_at = ? WHERE card_date = ?').run(
      cardImageUrl(date),
      now,
      date,
    );
  } catch (err) {
    console.error(`AI image generation failed for ${date}:`, err.message);
  }
  return getCardByDate(date);
}

/**
 * Full generation for a date: AI text (with fallback), then optionally an image.
 * Used by the admin "Generate today's card" button. Image generation never blocks the
 * homepage or scheduler — those use the fast getTodayCard path instead.
 */
export async function generateCardForDate(date, { withImage = false } = {}) {
  const settings = getSettings();
  await generateMessageForDate(date, settings);
  if (withImage) await generateImageForDate(date, settings);
  return getCardByDate(date);
}

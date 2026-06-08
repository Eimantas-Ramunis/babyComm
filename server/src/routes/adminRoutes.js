// Admin endpoints. All require the x-admin-password header (adminAuth).

import { Router } from 'express';
import db from '../db/database.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import {
  generateCardForDate,
  generateMessageForDate,
  generateImageForDate,
} from '../services/cardService.js';
import {
  listDevices,
  removeDevice,
  setDeviceActive,
  sendToAllActiveDevices,
} from '../services/pushService.js';
import {
  getMemories,
  createMemory,
  updateMemory,
  deleteMemory,
} from '../services/memoryService.js';
import { todayInTimezone, isValidDateString } from '../utils/dateUtils.js';
import {
  serializeSettings,
  serializeCard,
  serializeMemory,
  serializeSchedule,
} from '../utils/serializers.js';

const router = Router();
router.use(adminAuth);

// Throttle the expensive AI generation endpoints (spec §15).
const generationLimiter = rateLimit({ windowMs: 60_000, max: 10 });

// ---- Settings ----

router.get('/settings', (req, res) => {
  res.json(serializeSettings(getSettings()));
});

router.put('/settings', (req, res) => {
  const { babyNickname, dueDate, pregnancyStartDate, timezone, personality, tone } = req.body ?? {};

  if (babyNickname !== undefined && (typeof babyNickname !== 'string' || babyNickname.trim() === '')) {
    return res.status(400).json({ error: 'babyNickname must be a non-empty string.' });
  }
  if (personality !== undefined && typeof personality !== 'string') {
    return res.status(400).json({ error: 'personality must be a string.' });
  }
  if (tone !== undefined && typeof tone !== 'string') {
    return res.status(400).json({ error: 'tone must be a string.' });
  }
  if (dueDate !== undefined && !isValidDateString(dueDate)) {
    return res.status(400).json({ error: 'dueDate must be a valid YYYY-MM-DD date.' });
  }
  if (pregnancyStartDate != null && !isValidDateString(pregnancyStartDate)) {
    return res.status(400).json({ error: 'pregnancyStartDate must be a valid YYYY-MM-DD date or null.' });
  }
  if (timezone !== undefined) {
    try {
      // Throws RangeError for an invalid IANA timezone.
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
    } catch {
      return res.status(400).json({ error: 'timezone must be a valid IANA timezone.' });
    }
  }
  const { geminiApiKey, geminiTextModel, geminiImageModel, notificationsEnabled } = req.body ?? {};
  for (const [field, val] of Object.entries({ geminiApiKey, geminiTextModel, geminiImageModel })) {
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return res.status(400).json({ error: `${field} must be a string or null.` });
    }
  }
  if (notificationsEnabled !== undefined && typeof notificationsEnabled !== 'boolean') {
    return res.status(400).json({ error: 'notificationsEnabled must be a boolean.' });
  }
  const { autoGenerateEnabled, autoGenerateTime } = req.body ?? {};
  if (autoGenerateEnabled !== undefined && typeof autoGenerateEnabled !== 'boolean') {
    return res.status(400).json({ error: 'autoGenerateEnabled must be a boolean.' });
  }
  if (autoGenerateTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(autoGenerateTime)) {
    return res.status(400).json({ error: 'autoGenerateTime must be HH:mm (24h).' });
  }

  res.json(serializeSettings(updateSettings(req.body ?? {})));
});

// ---- Cards ----

// POST /api/admin/cards/generate-today — AI text + image when a Gemini key is set; otherwise
// a fallback card. Image generation is awaited here (admin action), never on page load.
router.post('/cards/generate-today', generationLimiter, async (req, res, next) => {
  try {
    const settings = getSettings();
    const today = todayInTimezone(settings.timezone);
    const card = await generateCardForDate(today, { withImage: true });
    res.json({ ok: true, mode: card.generation_status, card: serializeCard(card) });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/cards/:date/regenerate-message — AI text only (preserves the image).
// Requires a Gemini key so it can't silently overwrite an AI card with the fallback.
router.post('/cards/:date/regenerate-message', generationLimiter, async (req, res, next) => {
  if (!isValidDateString(req.params.date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD.' });
  }
  if (!getSettings().gemini_api_key) {
    return res.status(400).json({ error: 'No Gemini API key configured.' });
  }
  try {
    const card = await generateMessageForDate(req.params.date);
    res.json({ ok: true, mode: card.generation_status, card: serializeCard(card) });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/cards/:date/regenerate-image — image only (card must already exist).
router.post('/cards/:date/regenerate-image', generationLimiter, async (req, res, next) => {
  if (!isValidDateString(req.params.date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD.' });
  }
  try {
    const settings = getSettings();
    if (!settings.gemini_api_key) {
      return res.status(400).json({ error: 'No Gemini API key configured.' });
    }
    const card = await generateImageForDate(req.params.date, settings);
    if (!card) return res.status(404).json({ error: 'Card not found for that date.' });
    res.json({ ok: true, card: serializeCard(card) });
  } catch (err) {
    next(err);
  }
});

// ---- Notifications ----

// POST /api/admin/notifications/test — send a test push to all active devices.
router.post('/notifications/test', async (req, res, next) => {
  try {
    const settings = getSettings();
    const summary = await sendToAllActiveDevices({
      title: settings.baby_nickname,
      body: 'Bandomasis pranešimas — labas, mama! 💛',
      url: '/',
    });
    res.json({ ok: true, ...summary });
  } catch (err) {
    next(err);
  }
});

// ---- Schedules ----

router.get('/schedules', (req, res) => {
  const rows = db.prepare('SELECT * FROM notification_schedules ORDER BY id').all();
  res.json(rows.map(serializeSchedule));
});

router.post('/schedules', (req, res) => {
  const { name, type, timeOfDay, daysOfWeek, sendOnNewWeek, enabled } = req.body ?? {};
  if (!name || !type || !timeOfDay) {
    return res.status(400).json({ error: 'name, type and timeOfDay are required.' });
  }
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO notification_schedules
         (name, enabled, type, time_of_day, days_of_week, send_on_new_week, created_at, updated_at)
       VALUES (@name, @enabled, @type, @time_of_day, @days_of_week, @send_on_new_week, @created_at, @updated_at)`,
    )
    .run({
      name,
      enabled: enabled === false ? 0 : 1,
      type,
      time_of_day: timeOfDay,
      days_of_week: daysOfWeek ?? null,
      send_on_new_week: sendOnNewWeek ? 1 : 0,
      created_at: now,
      updated_at: now,
    });
  const row = db.prepare('SELECT * FROM notification_schedules WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serializeSchedule(row));
});

router.put('/schedules/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid schedule id.' });
  const current = db.prepare('SELECT * FROM notification_schedules WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Schedule not found.' });

  const { name, type, timeOfDay, daysOfWeek, sendOnNewWeek, enabled } = req.body ?? {};
  db.prepare(
    `UPDATE notification_schedules SET
       name = @name, enabled = @enabled, type = @type, time_of_day = @time_of_day,
       days_of_week = @days_of_week, send_on_new_week = @send_on_new_week, updated_at = @updated_at
     WHERE id = @id`,
  ).run({
    id,
    name: name ?? current.name,
    enabled: enabled === undefined ? current.enabled : enabled ? 1 : 0,
    type: type ?? current.type,
    time_of_day: timeOfDay ?? current.time_of_day,
    days_of_week: daysOfWeek !== undefined ? daysOfWeek : current.days_of_week,
    send_on_new_week:
      sendOnNewWeek === undefined ? current.send_on_new_week : sendOnNewWeek ? 1 : 0,
    updated_at: new Date().toISOString(),
  });
  res.json(serializeSchedule(db.prepare('SELECT * FROM notification_schedules WHERE id = ?').get(id)));
});

router.delete('/schedules/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid schedule id.' });
  const info = db.prepare('DELETE FROM notification_schedules WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ error: 'Schedule not found.' });
  res.json({ ok: true });
});

// ---- Devices ----

router.get('/devices', (req, res) => {
  res.json(listDevices());
});

router.patch('/devices/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid device id.' });
  if (typeof req.body?.active !== 'boolean') {
    return res.status(400).json({ error: 'active (boolean) is required.' });
  }
  if (!setDeviceActive(id, req.body.active)) {
    return res.status(404).json({ error: 'Device not found.' });
  }
  res.json({ ok: true });
});

router.delete('/devices/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid device id.' });
  if (!removeDevice(id)) return res.status(404).json({ error: 'Device not found.' });
  res.json({ ok: true });
});

// ---- Memories ----

router.get('/memories', (req, res) => {
  res.json(getMemories().map(serializeMemory));
});

router.post('/memories', (req, res) => {
  const { memoryDate, title } = req.body ?? {};
  if (!isValidDateString(memoryDate)) {
    return res.status(400).json({ error: 'memoryDate must be a valid YYYY-MM-DD date.' });
  }
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title must be a non-empty string.' });
  }
  res.status(201).json(serializeMemory(createMemory(req.body)));
});

router.put('/memories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid memory id.' });

  if (req.body?.memoryDate !== undefined && !isValidDateString(req.body.memoryDate)) {
    return res.status(400).json({ error: 'memoryDate must be a valid YYYY-MM-DD date.' });
  }
  if (
    req.body?.title !== undefined &&
    (typeof req.body.title !== 'string' || req.body.title.trim() === '')
  ) {
    return res.status(400).json({ error: 'title must be a non-empty string.' });
  }
  const updated = updateMemory(id, req.body ?? {});
  if (!updated) return res.status(404).json({ error: 'Memory not found.' });
  res.json(serializeMemory(updated));
});

router.delete('/memories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid memory id.' });
  const ok = deleteMemory(id);
  if (!ok) return res.status(404).json({ error: 'Memory not found.' });
  res.json({ ok: true });
});

export default router;

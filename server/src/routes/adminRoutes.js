// Admin endpoints. All require the x-admin-password header (adminAuth).

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import db from '../db/database.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import {
  getCardByDate,
  generateCardForDate,
  generateMessageForDate,
  generateImageForDate,
} from '../services/cardService.js';
import { getLastPregenDate } from '../services/schedulerService.js';
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
  setMemoryImage,
  deleteMemory,
} from '../services/memoryService.js';
import {
  listPersonalities,
  addPersonality,
  deletePersonality,
  listTones,
  addTone,
  deleteTone,
} from '../services/lookupService.js';
import { todayInTimezone, addDays, isValidDateString } from '../utils/dateUtils.js';
import { memoriesUploadDir, memoryImageUrl } from '../utils/paths.js';
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

const EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

// In-memory upload for memory images: one image, <= 5 MB. Only the raster types we can map to a
// safe extension are allowed (no SVG, which can carry script).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (EXT_BY_MIME[file.mimetype]) cb(null, true);
    else cb(new Error('Only PNG, JPEG, WebP, or GIF images are allowed.'));
  },
});

// Persist a memory's uploaded image to disk and store its URL. Returns the updated memory.
function saveMemoryImage(id, file) {
  fs.mkdirSync(memoriesUploadDir, { recursive: true });
  const ext = EXT_BY_MIME[file.mimetype] || 'img';
  const filename = `memory-${id}.${ext}`;
  fs.writeFileSync(path.join(memoriesUploadDir, filename), file.buffer);
  return setMemoryImage(id, memoryImageUrl(filename));
}

function deleteImageFile(imageUrl) {
  if (!imageUrl) return;
  const filename = path.basename(imageUrl);
  fs.rmSync(path.join(memoriesUploadDir, filename), { force: true });
}

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
  const { randomizePersonality } = req.body ?? {};
  if (randomizePersonality !== undefined && typeof randomizePersonality !== 'boolean') {
    return res.status(400).json({ error: 'randomizePersonality must be a boolean.' });
  }
  // Delivery-day mode (F12).
  const { babyArrived, birthDate, birthTime, birthWeight, birthName } = req.body ?? {};
  if (babyArrived !== undefined && typeof babyArrived !== 'boolean') {
    return res.status(400).json({ error: 'babyArrived must be a boolean.' });
  }
  if (birthDate != null && birthDate !== '' && !isValidDateString(birthDate)) {
    return res.status(400).json({ error: 'birthDate must be a valid YYYY-MM-DD date or null.' });
  }
  if (birthTime != null && birthTime !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(birthTime)) {
    return res.status(400).json({ error: 'birthTime must be HH:mm (24h) or null.' });
  }
  for (const [field, val] of Object.entries({ birthWeight, birthName })) {
    if (val !== undefined && val !== null && typeof val !== 'string') {
      return res.status(400).json({ error: `${field} must be a string or null.` });
    }
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

// GET /api/admin/cards/tomorrow — preview tomorrow's pre-generated card WITHOUT creating one
// (card is null until pre-generation or a manual generate has run), plus pre-gen status so the
// admin can see whether tonight's run already happened.
router.get('/cards/tomorrow', (req, res) => {
  const settings = getSettings();
  const today = todayInTimezone(settings.timezone);
  const tomorrow = addDays(today, 1);
  const lastPregenDate = getLastPregenDate();
  res.json({
    date: tomorrow,
    card: serializeCard(getCardByDate(tomorrow)),
    pregen: {
      enabled: Boolean(settings.auto_generate_enabled),
      time: settings.auto_generate_time,
      lastPregenDate,
      // The nightly job generates *tomorrow's* card and stamps *today's* date when done.
      ranToday: lastPregenDate === today,
    },
  });
});

// POST /api/admin/cards/generate-tomorrow — generate tomorrow's card now (AI text + image with
// a Gemini key, fallback otherwise), without waiting for the nightly pre-generation.
router.post('/cards/generate-tomorrow', generationLimiter, async (req, res, next) => {
  try {
    const settings = getSettings();
    const tomorrow = addDays(todayInTimezone(settings.timezone), 1);
    const card = await generateCardForDate(tomorrow, { withImage: true });
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

// ---- Memories (multipart: optional `image` file + text fields) ----

// Run multer and convert its errors (oversize / non-image) into 400s instead of 500s.
function imageUpload(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    return next();
  });
}

function invalidMemoryAt(value) {
  return value !== undefined && value !== '' && Number.isNaN(Date.parse(value));
}

router.get('/memories', (req, res) => {
  res.json(getMemories().map(serializeMemory));
});

router.post('/memories', imageUpload, (req, res) => {
  const { title, body, memoryAt } = req.body ?? {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title (caption) must be a non-empty string.' });
  }
  if (invalidMemoryAt(memoryAt)) {
    return res.status(400).json({ error: 'memoryAt must be a valid date-time.' });
  }

  let memory = createMemory({ title: title.trim(), body, memoryAt: memoryAt || undefined });
  if (req.file) memory = saveMemoryImage(memory.id, req.file);
  res.status(201).json(serializeMemory(memory));
});

// Treat an empty memoryAt string as "unchanged" so a blank/legacy date-time input does not
// overwrite the stored timestamp with an invalid value.
function normalizedMemoryInput(body) {
  return { ...body, memoryAt: body.memoryAt || undefined };
}

router.put('/memories/:id', imageUpload, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid memory id.' });

  const { title, memoryAt } = req.body ?? {};
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'title (caption) must be a non-empty string.' });
  }
  if (invalidMemoryAt(memoryAt)) {
    return res.status(400).json({ error: 'memoryAt must be a valid date-time.' });
  }

  let updated = updateMemory(id, normalizedMemoryInput(req.body ?? {}));
  if (!updated) return res.status(404).json({ error: 'Memory not found.' });
  if (req.file) {
    const oldImageUrl = updated.image_url;
    // Write the new file FIRST so a write failure can't orphan a deleted original.
    updated = saveMemoryImage(id, req.file);
    if (oldImageUrl && oldImageUrl !== updated.image_url) deleteImageFile(oldImageUrl);
  }
  res.json(serializeMemory(updated));
});

router.delete('/memories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid memory id.' });
  const { deleted, imageUrl } = deleteMemory(id);
  if (!deleted) return res.status(404).json({ error: 'Memory not found.' });
  deleteImageFile(imageUrl);
  res.json({ ok: true });
});

// ---- Personalities ----

router.get('/personalities', (req, res) => res.json(listPersonalities()));

router.post('/personalities', (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'name must be a non-empty string.' });
  }
  res.status(201).json(addPersonality(name));
});

router.delete('/personalities/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid personality id.' });
  if (!deletePersonality(id)) return res.status(404).json({ error: 'Personality not found.' });
  res.json({ ok: true });
});

// ---- Tones ----

router.get('/tones', (req, res) => res.json(listTones()));

router.post('/tones', (req, res) => {
  const { label } = req.body ?? {};
  if (typeof label !== 'string' || label.trim() === '') {
    return res.status(400).json({ error: 'label must be a non-empty string.' });
  }
  res.status(201).json(addTone(label));
});

router.delete('/tones/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid tone id.' });
  if (!deleteTone(id)) return res.status(404).json({ error: 'Tone not found.' });
  res.json({ ok: true });
});

export default router;

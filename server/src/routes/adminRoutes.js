// Admin endpoints. All require the x-admin-password header (adminAuth).

import { Router } from 'express';
import db from '../db/database.js';
import { adminAuth } from '../middleware/adminAuth.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { createFallbackCard } from '../services/cardService.js';
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
  serializeDevice,
} from '../utils/serializers.js';

const router = Router();
router.use(adminAuth);

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

  res.json(serializeSettings(updateSettings(req.body ?? {})));
});

// ---- Cards ----

// POST /api/admin/cards/generate-today — Phase 1: create/regenerate the fallback card.
router.post('/cards/generate-today', (req, res) => {
  const settings = getSettings();
  const today = todayInTimezone(settings.timezone);
  const card = createFallbackCard(today, settings);
  res.json({ ok: true, mode: 'fallback', card: serializeCard(card) });
});

// ---- Schedules (basic; data may be empty in Phase 1) ----

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

// ---- Devices (read-only in Phase 1; populated in Phase 4) ----

router.get('/devices', (req, res) => {
  const rows = db.prepare('SELECT * FROM push_devices ORDER BY id DESC').all();
  res.json(rows.map(serializeDevice));
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

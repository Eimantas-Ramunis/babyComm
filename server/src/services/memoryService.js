// Memory capsule CRUD (F9). Each memory has a caption (title) + optional note (body), an
// optional image, and an editable date-time timestamp (memory_at). Gestational week/day are
// derived from the timestamp's date for context.

import db from '../db/database.js';
import { getSettings } from './settingsService.js';
import { getPregnancyStatus } from './pregnancyService.js';

// Derive gestational week/day + the date portion from an ISO/date-time string.
// Falls back to "now" if the input is missing/unparseable so a bad value can't corrupt the row.
function derive(memoryAt) {
  const usable = memoryAt && !Number.isNaN(Date.parse(memoryAt)) ? memoryAt : new Date().toISOString();
  const date = String(usable).slice(0, 10); // YYYY-MM-DD
  const status = getPregnancyStatus(getSettings(), date);
  return { date, at: usable, week: status.gestationalWeek, day: status.gestationalDay };
}

export function getMemories() {
  // Newest first; fall back to memory_date for legacy rows without memory_at.
  return db
    .prepare('SELECT * FROM memories ORDER BY COALESCE(memory_at, memory_date) DESC, id DESC')
    .all();
}

export function getMemory(id) {
  return db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
}

export function createMemory(input) {
  const now = new Date().toISOString();
  const { date, at, week, day } = derive(input.memoryAt || now);

  const info = db
    .prepare(
      `INSERT INTO memories
         (memory_date, memory_at, gestational_week, gestational_day, title, body, image_url, created_at, updated_at)
       VALUES (@memory_date, @memory_at, @gestational_week, @gestational_day, @title, @body, @image_url, @created_at, @updated_at)`,
    )
    .run({
      memory_date: date,
      memory_at: at,
      gestational_week: week,
      gestational_day: day,
      title: input.title,
      body: input.body ?? null,
      image_url: input.imageUrl ?? null,
      created_at: now,
      updated_at: now,
    });
  return getMemory(info.lastInsertRowid);
}

export function updateMemory(id, input) {
  const current = getMemory(id);
  if (!current) return null;

  const { date, at, week, day } = derive(input.memoryAt ?? current.memory_at ?? current.memory_date);

  db.prepare(
    `UPDATE memories SET
       memory_date = @memory_date,
       memory_at = @memory_at,
       gestational_week = @gestational_week,
       gestational_day = @gestational_day,
       title = @title,
       body = @body,
       updated_at = @updated_at
     WHERE id = @id`,
  ).run({
    id,
    memory_date: date,
    memory_at: at,
    gestational_week: week,
    gestational_day: day,
    title: input.title ?? current.title,
    body: input.body !== undefined ? input.body : current.body,
    updated_at: new Date().toISOString(),
  });
  return getMemory(id);
}

export function setMemoryImage(id, imageUrl) {
  db.prepare('UPDATE memories SET image_url = ?, updated_at = ? WHERE id = ?').run(
    imageUrl,
    new Date().toISOString(),
    id,
  );
  return getMemory(id);
}

/** Delete a memory; returns its image_url (so the caller can remove the file) or null. */
export function deleteMemory(id) {
  const existing = getMemory(id);
  if (!existing) return { deleted: false, imageUrl: null };
  db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  return { deleted: true, imageUrl: existing.image_url };
}

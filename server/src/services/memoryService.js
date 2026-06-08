// Memory capsule CRUD (F9).

import db from '../db/database.js';

export function getMemories() {
  return db.prepare('SELECT * FROM memories ORDER BY memory_date DESC, id DESC').all();
}

export function getMemory(id) {
  return db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
}

export function createMemory(input) {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO memories
         (memory_date, gestational_week, gestational_day, title, body, image_url, created_at, updated_at)
       VALUES (@memory_date, @gestational_week, @gestational_day, @title, @body, @image_url, @created_at, @updated_at)`,
    )
    .run({
      memory_date: input.memoryDate,
      gestational_week: input.gestationalWeek ?? null,
      gestational_day: input.gestationalDay ?? null,
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

  db.prepare(
    `UPDATE memories SET
       memory_date = @memory_date,
       gestational_week = @gestational_week,
       gestational_day = @gestational_day,
       title = @title,
       body = @body,
       image_url = @image_url,
       updated_at = @updated_at
     WHERE id = @id`,
  ).run({
    id,
    memory_date: input.memoryDate ?? current.memory_date,
    gestational_week:
      input.gestationalWeek !== undefined ? input.gestationalWeek : current.gestational_week,
    gestational_day:
      input.gestationalDay !== undefined ? input.gestationalDay : current.gestational_day,
    title: input.title ?? current.title,
    body: input.body !== undefined ? input.body : current.body,
    image_url: input.imageUrl !== undefined ? input.imageUrl : current.image_url,
    updated_at: new Date().toISOString(),
  });
  return getMemory(id);
}

export function deleteMemory(id) {
  const info = db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  return info.changes > 0;
}

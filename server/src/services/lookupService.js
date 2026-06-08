// Admin-managed lookup lists: personalities and tones. The card generator draws a random
// personality (when randomization is on) and 3 random tones from these per generation.

import db from '../db/database.js';

// ---- Personalities ----

export function listPersonalities() {
  return db.prepare('SELECT id, name FROM personalities ORDER BY name').all();
}

export function addPersonality(name) {
  const trimmed = String(name).trim();
  db.prepare(
    'INSERT INTO personalities (name, created_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING',
  ).run(trimmed, new Date().toISOString());
  return db.prepare('SELECT id, name FROM personalities WHERE name = ?').get(trimmed);
}

export function deletePersonality(id) {
  return db.prepare('DELETE FROM personalities WHERE id = ?').run(id).changes > 0;
}

// ---- Tones ----

export function listTones() {
  return db.prepare('SELECT id, label FROM tones ORDER BY label').all();
}

export function addTone(label) {
  const trimmed = String(label).trim();
  db.prepare(
    'INSERT INTO tones (label, created_at) VALUES (?, ?) ON CONFLICT(label) DO NOTHING',
  ).run(trimmed, new Date().toISOString());
  return db.prepare('SELECT id, label FROM tones WHERE label = ?').get(trimmed);
}

export function deleteTone(id) {
  return db.prepare('DELETE FROM tones WHERE id = ?').run(id).changes > 0;
}

// ---- Random selection (pure; operate on the provided arrays) ----

/** Pick one personality name at random, or null if the list is empty. */
export function randomPersonality(personalities) {
  if (!personalities.length) return null;
  return personalities[Math.floor(Math.random() * personalities.length)].name;
}

/** Pick up to `n` distinct tone labels at random. */
export function randomTones(tones, n = 3) {
  const pool = [...tones];
  const picked = [];
  while (pool.length && picked.length < n) {
    const i = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(i, 1)[0].label);
  }
  return picked;
}

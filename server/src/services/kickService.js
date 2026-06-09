// Kick counter (Phase 7): one aggregate count per local calendar day.

import db from '../db/database.js';

/** Increment the day's count (creating the row on first kick). Returns { date, count }. */
export function incrementKicks(date) {
  db.prepare(
    `INSERT INTO kicks (kick_date, count, updated_at) VALUES (?, 1, ?)
     ON CONFLICT(kick_date) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at`,
  ).run(date, new Date().toISOString());
  return getKicksForDate(date);
}

export function getKicksForDate(date) {
  const row = db.prepare('SELECT kick_date, count FROM kicks WHERE kick_date = ?').get(date);
  return { date, count: row?.count ?? 0 };
}

/** Most recent day with kicks (for the AI context), or null if none yet. */
export function getLatestKicks() {
  const row = db
    .prepare('SELECT kick_date, count FROM kicks WHERE count > 0 ORDER BY kick_date DESC LIMIT 1')
    .get();
  return row ? { date: row.kick_date, count: row.count } : null;
}

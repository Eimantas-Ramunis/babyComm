// Mom's replies to the daily message (Phase 7). Public-write (same trust model as push
// subscribe: the app itself is the family's private space), admin-delete for cleanup.

import db from '../db/database.js';

export function addReply(cardDate, body) {
  const info = db
    .prepare('INSERT INTO replies (card_date, body, created_at) VALUES (?, ?, ?)')
    .run(cardDate, body, new Date().toISOString());
  return db.prepare('SELECT * FROM replies WHERE id = ?').get(info.lastInsertRowid);
}

export function getRepliesForDate(date) {
  return db.prepare('SELECT * FROM replies WHERE card_date = ? ORDER BY id').all(date);
}

/** All replies grouped by card_date — one query for the history endpoint. */
export function getRepliesGroupedByDate() {
  const grouped = {};
  for (const row of db.prepare('SELECT * FROM replies ORDER BY id').all()) {
    (grouped[row.card_date] ??= []).push(row);
  }
  return grouped;
}

/** Newest reply bodies (for the AI context). */
export function getRecentReplies(limit = 5) {
  return db
    .prepare('SELECT body FROM replies ORDER BY id DESC LIMIT ?')
    .all(limit)
    .map((r) => r.body);
}

export function deleteReply(id) {
  return db.prepare('DELETE FROM replies WHERE id = ?').run(id).changes > 0;
}

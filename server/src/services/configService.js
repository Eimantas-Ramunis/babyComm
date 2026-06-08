// Server-managed key/value config (app_config table). Used for secrets/state the user
// does not edit directly — currently the auto-generated VAPID keypair.

import db from '../db/database.js';

export function getConfig(key) {
  const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setConfig(key, value) {
  db.prepare(
    `INSERT INTO app_config (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

// Schema creation + default seed. Idempotent: safe to run on every boot.

import db from './database.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  baby_nickname TEXT NOT NULL,
  due_date TEXT NOT NULL,
  pregnancy_start_date TEXT,
  timezone TEXT DEFAULT 'Europe/Vilnius',
  personality TEXT DEFAULT 'Sweet Bean',
  tone TEXT DEFAULT 'funny, warm, loving',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_date TEXT NOT NULL UNIQUE,
  gestational_week INTEGER NOT NULL,
  gestational_day INTEGER NOT NULL,
  size_label TEXT,
  development_fact TEXT,
  title TEXT,
  short_notification TEXT,
  homepage_message TEXT,
  mood TEXT,
  image_url TEXT,
  image_prompt TEXT,
  generation_status TEXT DEFAULT 'fallback',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  type TEXT NOT NULL,
  time_of_day TEXT NOT NULL,
  days_of_week TEXT,
  send_on_new_week INTEGER DEFAULT 0,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_name TEXT,
  subscription_json TEXT NOT NULL,
  user_agent TEXT,
  active INTEGER DEFAULT 1,
  last_success_at TEXT,
  last_failure_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_date TEXT NOT NULL,
  gestational_week INTEGER,
  gestational_day INTEGER,
  title TEXT NOT NULL,
  body TEXT,
  image_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

// Default due date for first boot: ~28 weeks out so the demo lands in 2nd trimester.
function defaultDueDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 187);
  return d.toISOString().slice(0, 10);
}

function seedSettings() {
  const existing = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (existing) return;

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings
       (id, baby_nickname, due_date, pregnancy_start_date, timezone, personality, tone, created_at, updated_at)
     VALUES (1, @baby_nickname, @due_date, @pregnancy_start_date, @timezone, @personality, @tone, @created_at, @updated_at)`,
  ).run({
    baby_nickname: 'Tiny Bean',
    due_date: defaultDueDate(),
    pregnancy_start_date: null,
    timezone: 'Europe/Vilnius',
    personality: 'Sweet Bean',
    tone: 'funny, warm, loving',
    created_at: now,
    updated_at: now,
  });
}

export function runMigrations() {
  db.exec(SCHEMA);
  seedSettings();
}

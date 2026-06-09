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

-- Server-managed key/value config (e.g. auto-generated VAPID keys). Not user-edited.
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Admin-managed personality presets (random picker draws from here).
CREATE TABLE IF NOT EXISTS personalities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- Admin-managed tone list (3 are chosen at random per card generation).
CREATE TABLE IF NOT EXISTS tones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- Phase 7: mom's replies to the daily message (a conversation, multiple per day).
CREATE TABLE IF NOT EXISTS replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_date TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_replies_card_date ON replies(card_date);

-- Phase 7: kick counter — one aggregate row per local calendar day.
CREATE TABLE IF NOT EXISTS kicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kick_date TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
`;

const PERSONALITY_SEED = [
  'Sweet Bean',
  'Tiny Viking',
  'Chaos Goblin',
  'Little CEO',
  'Future Supervillain',
  'Soft Poet',
  'Dad Joke Machine',
];

// Warm, funny, loving, safe tones (no scary/medical wording).
const TONE_SEED = [
  'warm', 'funny', 'loving', 'cheeky', 'playful', 'tender', 'silly', 'witty', 'gentle', 'cozy',
  'heartfelt', 'goofy', 'sweet', 'mischievous', 'proud', 'curious', 'optimistic', 'dreamy',
  'affectionate', 'whimsical', 'sincere', 'cuddly', 'upbeat', 'charming', 'hopeful', 'grateful',
  'adventurous', 'sleepy', 'theatrical', 'poetic', 'cheerful', 'soft', 'reassuring', 'excited',
  'giggly', 'content', 'snuggly', 'wholesome', 'joyful', 'mellow', 'comforting', 'encouraging',
  'lighthearted', 'devoted', 'radiant', 'smitten', 'bubbly', 'dramatic but never mean',
  'tender-hearted', 'sparkly',
];

/**
 * Add a column to a table only if it does not already exist.
 * Keeps migrations upgrade-safe for databases created by an earlier phase.
 */
function addColumnIfMissing(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function applyColumnUpgrades() {
  // Phase 2 settings: notifications master switch + Gemini config (key stored server-side only).
  addColumnIfMissing('settings', 'notifications_enabled', 'notifications_enabled INTEGER DEFAULT 1');
  addColumnIfMissing('settings', 'gemini_api_key', 'gemini_api_key TEXT');
  addColumnIfMissing('settings', 'gemini_text_model', 'gemini_text_model TEXT');
  addColumnIfMissing('settings', 'gemini_image_model', 'gemini_image_model TEXT');

  // Daily pre-generation of the next day's AI card.
  addColumnIfMissing('settings', 'auto_generate_enabled', 'auto_generate_enabled INTEGER DEFAULT 1');
  addColumnIfMissing('settings', 'auto_generate_time', "auto_generate_time TEXT DEFAULT '20:00'");

  // Phase 3: randomize personality per card; memory timestamp (date + time, editable).
  addColumnIfMissing('settings', 'randomize_personality', 'randomize_personality INTEGER DEFAULT 1');
  addColumnIfMissing('memories', 'memory_at', 'memory_at TEXT');

  // Phase 6: delivery-day mode (F12) — birth details set by the admin when baby arrives.
  addColumnIfMissing('settings', 'baby_arrived', 'baby_arrived INTEGER DEFAULT 0');
  addColumnIfMissing('settings', 'birth_date', 'birth_date TEXT');
  addColumnIfMissing('settings', 'birth_time', 'birth_time TEXT');
  addColumnIfMissing('settings', 'birth_weight', 'birth_weight TEXT');
  addColumnIfMissing('settings', 'birth_name', 'birth_name TEXT');

  // Phase 2 push: dedupe devices by subscription endpoint.
  addColumnIfMissing('push_devices', 'endpoint', 'endpoint TEXT');
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_push_devices_endpoint ON push_devices(endpoint)',
  );
}

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

function seedLookups() {
  const now = new Date().toISOString();

  if (db.prepare('SELECT COUNT(*) AS n FROM personalities').get().n === 0) {
    const insert = db.prepare('INSERT INTO personalities (name, created_at) VALUES (?, ?)');
    const tx = db.transaction(() => PERSONALITY_SEED.forEach((name) => insert.run(name, now)));
    tx();
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM tones').get().n === 0) {
    const insert = db.prepare('INSERT INTO tones (label, created_at) VALUES (?, ?)');
    const tx = db.transaction(() => TONE_SEED.forEach((label) => insert.run(label, now)));
    tx();
  }
}

export function runMigrations() {
  db.exec(SCHEMA);
  applyColumnUpgrades();
  seedSettings();
  seedLookups();
}

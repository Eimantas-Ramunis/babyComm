// SQLite connection (singleton). Uses better-sqlite3 (synchronous).

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const databasePath = process.env.DATABASE_PATH || './data/app.sqlite';

// Ensure the directory for the database file exists before opening it.
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;

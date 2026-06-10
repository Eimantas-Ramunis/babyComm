// Integration test for the scheduler's transient-failure retry: a send that fails entirely
// for transient reasons (e.g. a DNS blip — the exact production incident) must NOT mark the
// schedule as run, so the next minute's tick retries within the catch-up window.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Isolated temp DB. Must be set BEFORE importing anything that opens the database.
const tmpDb = path.join(os.tmpdir(), `bgp-test-schedretry-${process.pid}.sqlite`);
process.env.DATABASE_PATH = tmpDb;

const { runMigrations } = await import('../db/migrations.js');
const { default: db } = await import('../db/database.js');
const { runDueSchedules } = await import('../services/schedulerService.js');
const { registerDevice } = await import('../services/pushService.js');
const { nowPartsInTimezone } = await import('../utils/dateUtils.js');
const { getSettings } = await import('../services/settingsService.js');
const { default: webpush } = await import('web-push');

runMigrations();

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(tmpDb + suffix, { force: true });
  }
});

test('transient total send failure is retried on the next tick; success marks the run', async (t) => {
  const now = new Date('2026-06-10T06:30:00Z');
  const { time } = nowPartsInTimezone(getSettings().timezone, now);

  const iso = now.toISOString();
  db.prepare(
    `INSERT INTO notification_schedules
       (name, enabled, type, time_of_day, created_at, updated_at)
     VALUES ('Retry me', 1, 'daily', ?, ?, ?)`,
  ).run(time, iso, iso);
  const scheduleId = db.prepare('SELECT id FROM notification_schedules WHERE name = ?').get('Retry me').id;

  registerDevice({ subscription: { endpoint: 'https://push.example.com/retry' }, deviceName: 'P' });

  // Tick 1: DNS blip — every send rejects with a transient (no statusCode) error.
  t.mock.method(webpush, 'sendNotification', () => {
    const err = new Error('getaddrinfo EAI_AGAIN fcm.googleapis.com');
    return Promise.reject(err);
  });
  const first = await runDueSchedules(now);
  assert.deepEqual(first.fired, [], 'transient total failure must not count as fired');
  let row = db.prepare('SELECT last_run_at FROM notification_schedules WHERE id = ?').get(scheduleId);
  assert.equal(row.last_run_at, null, 'schedule must stay unmarked so the next tick retries');

  // Tick 2 (one minute later, DNS recovered): the retry delivers and marks the run.
  t.mock.method(webpush, 'sendNotification', () => Promise.resolve({ statusCode: 201 }));
  const second = await runDueSchedules(new Date(now.getTime() + 60_000));
  assert.deepEqual(second.fired, [scheduleId]);
  row = db.prepare('SELECT last_run_at FROM notification_schedules WHERE id = ?').get(scheduleId);
  assert.ok(row.last_run_at, 'successful retry marks the schedule as run');

  // Tick 3: deduped — already sent today.
  const third = await runDueSchedules(new Date(now.getTime() + 120_000));
  assert.deepEqual(third.fired, []);
});

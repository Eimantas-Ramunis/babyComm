import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Use an isolated temp DB. Must be set BEFORE importing anything that opens the database.
const tmpDb = path.join(os.tmpdir(), `bgp-test-push-${process.pid}.sqlite`);
process.env.DATABASE_PATH = tmpDb;

const { runMigrations } = await import('../db/migrations.js');
const { default: db } = await import('../db/database.js');
const pushService = await import('../services/pushService.js');
const { default: webpush } = await import('web-push');

runMigrations();

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(tmpDb + suffix, { force: true });
  }
});

test('classifyPushError marks 404/410 as gone, others transient', () => {
  assert.equal(pushService.classifyPushError(410), 'gone');
  assert.equal(pushService.classifyPushError(404), 'gone');
  assert.equal(pushService.classifyPushError(500), 'transient');
  assert.equal(pushService.classifyPushError(undefined), 'transient');
});

test('registerDevice upserts by endpoint (no duplicate rows)', () => {
  const endpoint = 'https://push.example.com/abc';
  const a = pushService.registerDevice({
    subscription: { endpoint, keys: { p256dh: 'x', auth: 'y' } },
    deviceName: 'Phone A',
  });
  const b = pushService.registerDevice({
    subscription: { endpoint, keys: { p256dh: 'x2', auth: 'y2' } },
    deviceName: 'Phone A renamed',
  });

  assert.equal(a.id, b.id, 'same endpoint should reuse the row');
  const count = db
    .prepare('SELECT COUNT(*) AS n FROM push_devices WHERE endpoint = ?')
    .get(endpoint).n;
  assert.equal(count, 1);
});

test('registerDevice rejects a subscription without an endpoint', () => {
  assert.throws(() => pushService.registerDevice({ subscription: {} }));
});

test('sendToDevice deactivates the device on a 410 Gone', async (t) => {
  const endpoint = 'https://push.example.com/gone';
  pushService.registerDevice({ subscription: { endpoint }, deviceName: 'Dead' });
  const device = db.prepare('SELECT * FROM push_devices WHERE endpoint = ?').get(endpoint);

  t.mock.method(webpush, 'sendNotification', () => {
    const err = new Error('gone');
    err.statusCode = 410;
    return Promise.reject(err);
  });

  const result = await pushService.sendToDevice(device, { title: 't', body: 'b' });
  assert.equal(result.ok, false);
  assert.equal(result.deactivated, true);

  const after = db.prepare('SELECT active FROM push_devices WHERE id = ?').get(device.id);
  assert.equal(after.active, 0);
});

test('sendToDevice records success on a 2xx send and sends with high urgency + TTL', async (t) => {
  const endpoint = 'https://push.example.com/ok';
  pushService.registerDevice({ subscription: { endpoint }, deviceName: 'Live' });
  const device = db.prepare('SELECT * FROM push_devices WHERE endpoint = ?').get(endpoint);

  const mocked = t.mock.method(webpush, 'sendNotification', () => Promise.resolve({ statusCode: 201 }));

  const result = await pushService.sendToDevice(device, { title: 't', body: 'b' });
  assert.equal(result.ok, true);
  const after = db.prepare('SELECT last_success_at, active FROM push_devices WHERE id = ?').get(device.id);
  assert.ok(after.last_success_at);
  assert.equal(after.active, 1);

  // 'high' urgency wakes a dozing phone (default 'normal' can be deferred for hours);
  // TTL keeps a stale daily note from arriving a day late.
  const options = mocked.mock.calls[0].arguments[2];
  assert.equal(options.urgency, 'high');
  assert.ok(Number.isInteger(options.TTL) && options.TTL > 0);
});

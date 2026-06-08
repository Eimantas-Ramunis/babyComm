import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Isolated temp DB + known admin password. Set BEFORE importing the app.
const tmpDb = path.join(os.tmpdir(), `bgp-test-api-${process.pid}.sqlite`);
process.env.DATABASE_PATH = tmpDb;
process.env.ADMIN_PASSWORD = 'test-secret';

const { createApp } = await import('../app.js');
const request = (await import('supertest')).default;

const app = createApp();

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(tmpDb + suffix, { force: true });
  }
});

test('GET /api/today returns a card and pregnancy status', async () => {
  const res = await request(app).get('/api/today');
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.gestationalWeek, 'number');
  assert.ok(res.body.homepageMessage);
});

test('GET /api/push/vapid-public-key returns a key', async () => {
  const res = await request(app).get('/api/push/vapid-public-key');
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.publicKey === 'string' && res.body.publicKey.length > 0);
});

test('admin endpoints require the password header', async () => {
  const noauth = await request(app).get('/api/admin/settings');
  assert.equal(noauth.status, 401);

  const ok = await request(app).get('/api/admin/settings').set('x-admin-password', 'test-secret');
  assert.equal(ok.status, 200);
  // The raw Gemini key must never be returned.
  assert.equal(ok.body.geminiApiKey, undefined);
  assert.equal(ok.body.geminiApiKeySet, false);
});

test('POST /api/push/register upserts a device by endpoint', async () => {
  const sub = { endpoint: 'https://push.example.com/integration', keys: { p256dh: 'a', auth: 'b' } };

  const first = await request(app).post('/api/push/register').send({ subscription: sub, deviceName: 'T' });
  assert.equal(first.status, 201);
  assert.equal(first.body.ok, true);

  const second = await request(app).post('/api/push/register').send({ subscription: sub });
  assert.equal(second.body.deviceId, first.body.deviceId, 'same endpoint reuses the device');

  const devices = await request(app)
    .get('/api/admin/devices')
    .set('x-admin-password', 'test-secret');
  assert.equal(devices.body.filter((d) => d.deviceName === 'T').length, 1);
});

test('POST /api/push/register rejects a body without a subscription', async () => {
  const res = await request(app).post('/api/push/register').send({});
  assert.equal(res.status, 400);
});

test('settings mask: setting a Gemini key reports set + last4, never the raw key', async () => {
  const put = await request(app)
    .put('/api/admin/settings')
    .set('x-admin-password', 'test-secret')
    .send({ geminiApiKey: 'super-secret-1234' });
  assert.equal(put.status, 200);
  assert.equal(put.body.geminiApiKeySet, true);
  assert.equal(put.body.geminiKeyLast4, '1234');
  assert.equal(put.body.geminiApiKey, undefined);
});

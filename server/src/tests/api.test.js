import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Isolated temp data dir (DB + uploads) + known admin password. Set BEFORE importing the app.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgp-api-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'app.sqlite');
process.env.ADMIN_PASSWORD = 'test-secret';

const { createApp } = await import('../app.js');
const request = (await import('supertest')).default;

const app = createApp();

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
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

test('GET /api/admin/cards/tomorrow previews without creating; generate-tomorrow creates', async () => {
  assert.equal((await request(app).get('/api/admin/cards/tomorrow')).status, 401);

  const before = await request(app)
    .get('/api/admin/cards/tomorrow')
    .set('x-admin-password', 'test-secret');
  assert.equal(before.status, 200);
  assert.match(before.body.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(before.body.card, null, 'preview must not create a card');
  assert.equal(typeof before.body.pregen.enabled, 'boolean');
  assert.equal(before.body.pregen.ranToday, false);

  // No Gemini key in tests -> a fallback card for tomorrow's date.
  const gen = await request(app)
    .post('/api/admin/cards/generate-tomorrow')
    .set('x-admin-password', 'test-secret');
  assert.equal(gen.status, 200);
  assert.equal(gen.body.mode, 'fallback');
  assert.equal(gen.body.card.date, before.body.date);

  const after = await request(app)
    .get('/api/admin/cards/tomorrow')
    .set('x-admin-password', 'test-secret');
  assert.equal(after.body.card.date, before.body.date);

  // The future-dated card must not leak into history before its day arrives.
  const history = await request(app).get('/api/history');
  assert.ok(!history.body.some((c) => c.date === before.body.date));
});

test('personalities + tones admin endpoints require auth and round-trip', async () => {
  assert.equal((await request(app).get('/api/admin/personalities')).status, 401);

  const list = await request(app).get('/api/admin/personalities').set('x-admin-password', 'test-secret');
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 7);

  const added = await request(app)
    .post('/api/admin/personalities')
    .set('x-admin-password', 'test-secret')
    .send({ name: 'Test Persona' });
  assert.equal(added.status, 201);
  assert.equal(added.body.name, 'Test Persona');

  const del = await request(app)
    .delete(`/api/admin/personalities/${added.body.id}`)
    .set('x-admin-password', 'test-secret');
  assert.equal(del.status, 200);
});

test('POST /api/admin/memories accepts a multipart image and stores it', async () => {
  const png = Buffer.from('89504e470d0a1a0a', 'hex'); // minimal PNG signature
  const res = await request(app)
    .post('/api/admin/memories')
    .set('x-admin-password', 'test-secret')
    .field('title', 'First scan')
    .field('memoryAt', '2026-06-05T14:30')
    .attach('image', png, { filename: 'scan.png', contentType: 'image/png' });

  assert.equal(res.status, 201);
  assert.equal(res.body.title, 'First scan');
  assert.ok(res.body.imageUrl?.startsWith('/uploads/memories/'));

  // The image is served back.
  const img = await request(app).get(res.body.imageUrl);
  assert.equal(img.status, 200);
});

test('POST /api/admin/memories rejects a non-image upload', async () => {
  const res = await request(app)
    .post('/api/admin/memories')
    .set('x-admin-password', 'test-secret')
    .field('title', 'Bad file')
    .attach('image', Buffer.from('hello'), { filename: 'note.txt', contentType: 'text/plain' });
  assert.equal(res.status, 400);
});

test('delivery-day mode: birth settings round-trip and /api/today reveal payload', async () => {
  // Invalid birth time is rejected.
  const badTime = await request(app)
    .put('/api/admin/settings')
    .set('x-admin-password', 'test-secret')
    .send({ birthTime: '25:99' });
  assert.equal(badTime.status, 400);

  // Flip into arrived mode with the full birth record.
  const put = await request(app)
    .put('/api/admin/settings')
    .set('x-admin-password', 'test-secret')
    .send({
      babyArrived: true,
      birthName: 'Jonas',
      birthDate: '2026-12-20',
      birthTime: '08:45',
      birthWeight: '3 540 g',
    });
  assert.equal(put.status, 200);
  assert.equal(put.body.babyArrived, true);
  assert.equal(put.body.birthName, 'Jonas');
  assert.equal(put.body.birthDate, '2026-12-20');
  assert.equal(put.body.birthTime, '08:45');
  assert.equal(put.body.birthWeight, '3 540 g');

  // Public /api/today switches to the reveal payload, with no daily card.
  const today = await request(app).get('/api/today');
  assert.equal(today.status, 200);
  assert.equal(today.body.babyArrived, true);
  assert.equal(today.body.birth.name, 'Jonas');
  assert.equal(today.body.birth.date, '2026-12-20');
  assert.equal(today.body.homepageMessage, undefined, 'no card in arrived mode');

  // Reset so later tests (and re-runs) see normal mode again.
  const reset = await request(app)
    .put('/api/admin/settings')
    .set('x-admin-password', 'test-secret')
    .send({ babyArrived: false });
  assert.equal(reset.status, 200);
  assert.equal(reset.body.babyArrived, false);

  const back = await request(app).get('/api/today');
  assert.equal(back.status, 200);
  assert.equal(back.body.babyArrived, false);
  assert.ok(back.body.homepageMessage, 'daily card is back after reset');
});

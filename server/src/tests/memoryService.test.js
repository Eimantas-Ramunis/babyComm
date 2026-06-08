import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmpDb = path.join(os.tmpdir(), `bgp-test-memory-${process.pid}.sqlite`);
process.env.DATABASE_PATH = tmpDb;

const { runMigrations } = await import('../db/migrations.js');
const mem = await import('../services/memoryService.js');

runMigrations();

after(() => {
  for (const s of ['', '-wal', '-shm']) fs.rmSync(tmpDb + s, { force: true });
});

test('createMemory stores memory_at and derives date + gestational fields', () => {
  const m = mem.createMemory({ title: 'First kick', body: 'wow', memoryAt: '2026-06-05T14:30' });
  assert.equal(m.memory_at, '2026-06-05T14:30');
  assert.equal(m.memory_date, '2026-06-05');
  assert.equal(typeof m.gestational_week, 'number');
  assert.equal(m.title, 'First kick');
});

test('createMemory defaults memory_at to now when omitted', () => {
  const m = mem.createMemory({ title: 'No date' });
  assert.ok(m.memory_at, 'memory_at set');
  assert.equal(m.memory_date, m.memory_at.slice(0, 10));
});

test('getMemories orders newest first by memory_at', () => {
  // Fresh ordering check using explicit timestamps.
  mem.createMemory({ title: 'Older', memoryAt: '2020-01-01T00:00' });
  mem.createMemory({ title: 'Newer', memoryAt: '2099-01-01T00:00' });
  const list = mem.getMemories();
  assert.equal(list[0].title, 'Newer');
});

test('updateMemory changes caption + timestamp and re-derives the date', () => {
  const m = mem.createMemory({ title: 'Edit me', memoryAt: '2026-06-01T10:00' });
  const updated = mem.updateMemory(m.id, { title: 'Edited', memoryAt: '2026-07-15T08:00' });
  assert.equal(updated.title, 'Edited');
  assert.equal(updated.memory_date, '2026-07-15');
});

test('updateMemory with an empty/invalid memoryAt does not corrupt the row', () => {
  const m = mem.createMemory({ title: 'Keep date', memoryAt: '2026-06-01T10:00' });
  const updated = mem.updateMemory(m.id, { title: 'Edited', memoryAt: '' });
  // Empty string must not become the stored timestamp or produce NaN gestational fields.
  assert.notEqual(updated.memory_at, '');
  assert.ok(!Number.isNaN(updated.gestational_week));
  assert.equal(updated.memory_date, updated.memory_at.slice(0, 10));
});

test('setMemoryImage + deleteMemory returns the stored image url', () => {
  const m = mem.createMemory({ title: 'With image' });
  mem.setMemoryImage(m.id, '/uploads/memories/memory-x.png');
  const res = mem.deleteMemory(m.id);
  assert.equal(res.deleted, true);
  assert.equal(res.imageUrl, '/uploads/memories/memory-x.png');
  assert.deepEqual(mem.deleteMemory(m.id), { deleted: false, imageUrl: null });
});

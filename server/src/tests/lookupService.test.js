import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmpDb = path.join(os.tmpdir(), `bgp-test-lookup-${process.pid}.sqlite`);
process.env.DATABASE_PATH = tmpDb;

const { runMigrations } = await import('../db/migrations.js');
const lookup = await import('../services/lookupService.js');

runMigrations();

after(() => {
  for (const s of ['', '-wal', '-shm']) fs.rmSync(tmpDb + s, { force: true });
});

test('personalities + tones are seeded', () => {
  assert.ok(lookup.listPersonalities().length >= 7);
  assert.ok(lookup.listTones().length >= 30, 'at least 30 tones seeded');
});

test('addPersonality dedupes by name', () => {
  const before = lookup.listPersonalities().length;
  lookup.addPersonality('Space Cadet');
  lookup.addPersonality('Space Cadet'); // duplicate ignored
  const after = lookup.listPersonalities().length;
  assert.equal(after, before + 1);
});

test('deletePersonality removes by id', () => {
  const added = lookup.addPersonality('Temporary');
  assert.equal(lookup.deletePersonality(added.id), true);
  assert.equal(lookup.deletePersonality(added.id), false); // already gone
});

test('addTone dedupes and deleteTone works', () => {
  const before = lookup.listTones().length;
  const t = lookup.addTone('zesty');
  lookup.addTone('zesty');
  assert.equal(lookup.listTones().length, before + 1);
  assert.equal(lookup.deleteTone(t.id), true);
});

test('randomTones returns min(n, list) distinct labels, all from the list', () => {
  const tones = lookup.listTones();
  const labels = new Set(tones.map((t) => t.label));
  const picked = lookup.randomTones(tones, 3);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3, 'distinct');
  picked.forEach((p) => assert.ok(labels.has(p)));

  // Fewer than n available -> returns all available, no duplicates.
  const small = [{ label: 'a' }, { label: 'b' }];
  const pickedSmall = lookup.randomTones(small, 3);
  assert.deepEqual([...pickedSmall].sort(), ['a', 'b']);
});

test('randomPersonality returns a member or null', () => {
  const list = lookup.listPersonalities();
  const picked = lookup.randomPersonality(list); // pick once, then check membership
  assert.ok(list.some((p) => p.name === picked));
  assert.equal(lookup.randomPersonality([]), null);
});

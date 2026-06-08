import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseAiJson, validateMessage } from '../services/aiTextService.js';

test('parseAiJson parses plain JSON', () => {
  const obj = parseAiJson('{"title":"Hi","x":1}');
  assert.equal(obj.title, 'Hi');
});

test('parseAiJson strips ```json fences', () => {
  const obj = parseAiJson('```json\n{"title":"Hi"}\n```');
  assert.equal(obj.title, 'Hi');
});

test('parseAiJson extracts the object from surrounding prose', () => {
  const obj = parseAiJson('Sure! Here you go:\n{"title":"Hi"}\nHope that helps.');
  assert.equal(obj.title, 'Hi');
});

test('parseAiJson throws on non-JSON', () => {
  assert.throws(() => parseAiJson('no json here'));
});

function validMessage(overrides = {}) {
  return {
    title: 'Week 13',
    shortNotification: 'Hi mom!',
    homepageMessage: 'Hello mom, I am growing.',
    mood: 'cozy',
    tags: ['funny', 'week-13'],
    ...overrides,
  };
}

test('validateMessage accepts a complete message and keeps tags', () => {
  const out = validateMessage(validMessage());
  assert.equal(out.title, 'Week 13');
  assert.deepEqual(out.tags, ['funny', 'week-13']);
});

test('validateMessage rejects missing/empty required fields', () => {
  assert.throws(() => validateMessage(validMessage({ title: '' })));
  assert.throws(() => validateMessage(validMessage({ homepageMessage: undefined })));
});

test('validateMessage truncates a too-long shortNotification to <= 120 chars', () => {
  const long = 'x'.repeat(200);
  const out = validateMessage(validMessage({ shortNotification: long }));
  assert.ok(out.shortNotification.length <= 120);
  assert.ok(out.shortNotification.endsWith('…'));
});

test('validateMessage tolerates a missing tags array', () => {
  const out = validateMessage(validMessage({ tags: undefined }));
  assert.deepEqual(out.tags, []);
});

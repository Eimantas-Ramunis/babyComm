import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseAiJson, validateMessage, buildPrompt, FUN_TWISTS } from '../services/aiTextService.js';

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

// ---- buildPrompt: funny twist ----

test('FUN_TWISTS offers several distinct twist styles', () => {
  assert.ok(FUN_TWISTS.length >= 5);
  assert.equal(new Set(FUN_TWISTS).size, FUN_TWISTS.length);
});

test('buildPrompt includes the picked twist and the weave-in rules', () => {
  const prompt = buildPrompt({
    babyNickname: 'Pupa',
    week: 12,
    day: 3,
    sizeLabel: 'laimo',
    developmentFact: 'Pradeda formuotis pirmieji refleksai.',
    personality: 'Tiny Viking',
    tone: 'warm, funny, cheeky',
    funTwist: FUN_TWISTS[2],
    recentMessages: [],
  });
  assert.ok(prompt.includes(`Funny twist for today: ${FUN_TWISTS[2]}`));
  assert.ok(prompt.includes('EXACTLY ONE'));
  assert.ok(prompt.includes('must be TRUE'));
  // The model writes its own fact; the table value is only a hint.
  assert.ok(prompt.includes('hint'));
});

test('buildPrompt falls back to the first twist when none is provided', () => {
  const prompt = buildPrompt({ week: 12, day: 0, recentMessages: [] });
  assert.ok(prompt.includes(`Funny twist for today: ${FUN_TWISTS[0]}`));
});

// ---- buildPrompt: gender ----

test('buildPrompt for a girl demands feminine Lithuanian self-references', () => {
  const prompt = buildPrompt({ week: 14, day: 0, babyGender: 'girl', recentMessages: [] });
  assert.ok(prompt.includes("Baby's sex: GIRL"));
  assert.ok(prompt.includes('FEMININE forms'));
  assert.ok(prompt.includes('pasiruošusi'));
});

test('buildPrompt for a boy uses masculine; unknown avoids gendered forms', () => {
  const boy = buildPrompt({ week: 14, day: 0, babyGender: 'boy', recentMessages: [] });
  assert.ok(boy.includes("Baby's sex: BOY"));
  assert.ok(boy.includes('MASCULINE forms'));

  const unknown = buildPrompt({ week: 14, day: 0, recentMessages: [] });
  assert.ok(unknown.includes('not known yet'));
  assert.ok(unknown.includes('avoid gendered'));
});

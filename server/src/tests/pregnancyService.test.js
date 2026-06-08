import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getPregnancyStatus,
  resolvePregnancyStart,
  trimesterForWeek,
  getSizeForWeek,
} from '../services/pregnancyService.js';

// Helper to build a minimal settings row.
function settings(overrides = {}) {
  return {
    baby_nickname: 'Tiny Bean',
    due_date: '2026-12-01',
    pregnancy_start_date: null,
    timezone: 'Europe/Vilnius',
    ...overrides,
  };
}

test('resolvePregnancyStart subtracts 280 days from due date when start not set', () => {
  // 2026-12-01 minus 280 days = 2026-02-24.
  assert.equal(resolvePregnancyStart(settings()), '2026-02-24');
});

test('resolvePregnancyStart uses explicit pregnancy_start_date when present', () => {
  assert.equal(
    resolvePregnancyStart(settings({ pregnancy_start_date: '2026-03-01' })),
    '2026-03-01',
  );
});

test('week/day computed from days pregnant', () => {
  // Start 2026-02-24; on 2026-05-31 that is 96 days = 13 weeks + 5 days.
  const status = getPregnancyStatus(settings(), '2026-05-31');
  assert.equal(status.totalDaysPregnant, 96);
  assert.equal(status.gestationalWeek, 13);
  assert.equal(status.gestationalDay, 5);
});

test('days remaining is difference to due date', () => {
  const status = getPregnancyStatus(settings(), '2026-11-01');
  assert.equal(status.daysRemaining, 30); // Nov 1 -> Dec 1
});

test('trimester boundaries: weeks 12/13 and 27/28', () => {
  assert.equal(trimesterForWeek(12), 1);
  assert.equal(trimesterForWeek(13), 2);
  assert.equal(trimesterForWeek(27), 2);
  assert.equal(trimesterForWeek(28), 3);
});

test('trimester reflected in status', () => {
  // 13 weeks in -> 2nd trimester.
  const status = getPregnancyStatus(settings(), '2026-05-31');
  assert.equal(status.trimester, 2);
});

test('size data falls back safely for out-of-range weeks', () => {
  const fallback = getSizeForWeek(40);
  assert.equal(typeof fallback.sizeLabel, 'string');
  assert.ok(fallback.sizeLabel.length > 0);
  assert.equal(getSizeForWeek(13).sizeLabel, 'lemon');
});

test('due-date-passed behavior', () => {
  const before = getPregnancyStatus(settings(), '2026-11-30');
  assert.equal(before.isDueDatePassed, false);

  const after = getPregnancyStatus(settings(), '2026-12-05');
  assert.equal(after.isDueDatePassed, true);
  assert.ok(after.daysRemaining < 0);
});

test('pre-conception dates clamp to zero, never negative', () => {
  const status = getPregnancyStatus(settings(), '2026-01-01');
  assert.equal(status.totalDaysPregnant, 0);
  assert.equal(status.gestationalWeek, 0);
  assert.equal(status.gestationalDay, 0);
  assert.equal(status.trimester, 1);
});

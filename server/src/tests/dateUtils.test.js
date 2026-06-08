import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  daysBetween,
  isValidDateString,
  todayInTimezone,
} from '../utils/dateUtils.js';

test('addDays shifts forward and backward, crossing month boundaries', () => {
  assert.equal(addDays('2026-02-24', 280), '2026-12-01');
  assert.equal(addDays('2026-12-01', -280), '2026-02-24');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('daysBetween counts whole days, sign-aware', () => {
  assert.equal(daysBetween('2026-02-24', '2026-05-31'), 96);
  assert.equal(daysBetween('2026-12-01', '2026-11-01'), -30);
  assert.equal(daysBetween('2026-06-08', '2026-06-08'), 0);
});

test('isValidDateString accepts real dates and rejects junk/overflow', () => {
  assert.equal(isValidDateString('2026-06-08'), true);
  assert.equal(isValidDateString('2026-13-01'), false);
  assert.equal(isValidDateString('2026-02-31'), false);
  assert.equal(isValidDateString('06/08/2026'), false);
  assert.equal(isValidDateString(''), false);
  assert.equal(isValidDateString(null), false);
});

test('todayInTimezone returns a YYYY-MM-DD string for a fixed instant', () => {
  // 2026-06-08T23:30:00Z is already 2026-06-09 in Vilnius (UTC+3 in summer).
  const instant = new Date('2026-06-08T23:30:00Z');
  assert.equal(todayInTimezone('Europe/Vilnius', instant), '2026-06-09');
  assert.equal(todayInTimezone('UTC', instant), '2026-06-08');
});

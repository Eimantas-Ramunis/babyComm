import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shouldRunSchedule, shouldPregenerate } from '../services/schedulerService.js';

// Base schedule: enabled daily at 09:00, every day.
function schedule(overrides = {}) {
  return {
    enabled: 1,
    time_of_day: '09:00',
    days_of_week: null,
    send_on_new_week: 0,
    ...overrides,
  };
}

// Base "now" parts: Wednesday 2026-06-10 09:00, week 13 day 3, not run today.
function nowParts(overrides = {}) {
  return {
    date: '2026-06-10',
    time: '09:00',
    dayOfWeek: 3,
    gestationalWeek: 13,
    gestationalDay: 3,
    lastRunDate: null,
    ...overrides,
  };
}

test('fires when time matches and not yet run today', () => {
  assert.equal(shouldRunSchedule(schedule(), nowParts()), true);
});

test('does not fire when the minute does not match', () => {
  assert.equal(shouldRunSchedule(schedule(), nowParts({ time: '09:01' })), false);
});

test('disabled schedule never fires', () => {
  assert.equal(shouldRunSchedule(schedule({ enabled: 0 }), nowParts()), false);
});

test('day-of-week filter excludes non-listed days', () => {
  // allow Mon/Fri only (1,5); today is Wed (3)
  assert.equal(shouldRunSchedule(schedule({ days_of_week: '1,5' }), nowParts()), false);
  // allow Wed (3)
  assert.equal(shouldRunSchedule(schedule({ days_of_week: '3' }), nowParts()), true);
});

test('dedupes when already run on the same calendar day', () => {
  assert.equal(
    shouldRunSchedule(schedule(), nowParts({ lastRunDate: '2026-06-10' })),
    false,
  );
  // ran yesterday -> may run again today
  assert.equal(
    shouldRunSchedule(schedule(), nowParts({ lastRunDate: '2026-06-09' })),
    true,
  );
});

test('send_on_new_week only fires on gestational day 0 of a real week', () => {
  assert.equal(
    shouldRunSchedule(schedule({ send_on_new_week: 1 }), nowParts({ gestationalDay: 3 })),
    false,
  );
  assert.equal(
    shouldRunSchedule(schedule({ send_on_new_week: 1 }), nowParts({ gestationalWeek: 14, gestationalDay: 0 })),
    true,
  );
});

test('send_on_new_week does NOT fire pre-conception (week 0, clamped day 0)', () => {
  assert.equal(
    shouldRunSchedule(
      schedule({ send_on_new_week: 1 }),
      nowParts({ gestationalWeek: 0, gestationalDay: 0 }),
    ),
    false,
  );
});

test('empty days_of_week means every day', () => {
  assert.equal(shouldRunSchedule(schedule({ days_of_week: '' }), nowParts()), true);
});

// ---- shouldPregenerate ----

function pregenSettings(overrides = {}) {
  return { auto_generate_enabled: 1, auto_generate_time: '20:00', ...overrides };
}

test('pregenerate fires at/after the configured time, once per day', () => {
  // before time -> no
  assert.equal(shouldPregenerate(pregenSettings(), nowParts({ time: '19:59' }), null), false);
  // at time -> yes
  assert.equal(shouldPregenerate(pregenSettings(), nowParts({ time: '20:00' }), null), true);
  // after time -> yes (catch-up if the exact minute was missed)
  assert.equal(shouldPregenerate(pregenSettings(), nowParts({ time: '22:30' }), null), true);
});

test('pregenerate dedupes once it has run today', () => {
  const parts = nowParts({ time: '20:00' });
  assert.equal(shouldPregenerate(pregenSettings(), parts, parts.date), false);
  assert.equal(shouldPregenerate(pregenSettings(), parts, '2026-06-09'), true); // ran yesterday
});

test('pregenerate respects the enabled flag', () => {
  assert.equal(
    shouldPregenerate(pregenSettings({ auto_generate_enabled: 0 }), nowParts({ time: '21:00' }), null),
    false,
  );
});

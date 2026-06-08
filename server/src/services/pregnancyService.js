// Pregnancy calculation engine (F1).
//
// Pure functions: callers inject `today` so results are deterministic and testable.
// No medical or scary wording anywhere in the size/fact data.

import { addDays, daysBetween } from '../utils/dateUtils.js';

const GESTATION_DAYS = 280; // standard 40-week estimate

// Size + development fact by gestational week (warm, non-clinical).
export const SIZE_BY_WEEK = {
  6: { sizeLabel: 'sweet pea', developmentFact: 'Tiny facial features are starting to form.' },
  7: { sizeLabel: 'blueberry', developmentFact: 'Tiny arm and leg buds are growing.' },
  8: { sizeLabel: 'raspberry', developmentFact: 'Little fingers and toes are beginning to form.' },
  9: { sizeLabel: 'grape', developmentFact: 'Tiny muscles are starting to develop.' },
  10: { sizeLabel: 'strawberry', developmentFact: 'Little joints are forming.' },
  11: { sizeLabel: 'fig', developmentFact: 'The baby is starting to look more recognizably baby-like.' },
  12: { sizeLabel: 'lime', developmentFact: 'Reflexes are beginning to develop.' },
  13: { sizeLabel: 'lemon', developmentFact: 'Tiny fingerprints may be forming.' },
  14: { sizeLabel: 'peach', developmentFact: 'The baby is growing more coordinated.' },
  15: { sizeLabel: 'apple', developmentFact: 'The baby may be practicing little movements.' },
  16: { sizeLabel: 'avocado', developmentFact: 'Tiny facial expressions may be developing.' },
};

const FALLBACK_SIZE = {
  sizeLabel: 'tiny seedling',
  developmentFact: 'The baby is growing a little more every day.',
};

/** Look up size/fact for a week, with a safe fallback for missing weeks. */
export function getSizeForWeek(week) {
  return SIZE_BY_WEEK[week] ?? FALLBACK_SIZE;
}

/** Trimester from gestational week: 1st 0–12, 2nd 13–27, 3rd 28+. */
export function trimesterForWeek(week) {
  if (week <= 12) return 1;
  if (week <= 27) return 2;
  return 3;
}

/**
 * Resolve the pregnancy start date from settings.
 * Uses pregnancy_start_date if set, otherwise dueDate - 280 days.
 */
export function resolvePregnancyStart(settings) {
  if (settings.pregnancy_start_date) return settings.pregnancy_start_date;
  return addDays(settings.due_date, -GESTATION_DAYS);
}

/**
 * Compute the full pregnancy status for a given calendar day.
 * @param {object} settings - row from the settings table (snake_case fields).
 * @param {string} today - "YYYY-MM-DD" calendar day to evaluate.
 */
export function getPregnancyStatus(settings, today) {
  const pregnancyStartDate = resolvePregnancyStart(settings);

  // Clamp negative (pre-conception dates) to 0 so we never report negative weeks.
  const totalDaysPregnant = Math.max(0, daysBetween(pregnancyStartDate, today));
  const gestationalWeek = Math.floor(totalDaysPregnant / 7);
  const gestationalDay = totalDaysPregnant % 7;

  const daysRemaining = daysBetween(today, settings.due_date);
  const isDueDatePassed = today > settings.due_date;

  const { sizeLabel, developmentFact } = getSizeForWeek(gestationalWeek);

  return {
    currentDate: today,
    pregnancyStartDate,
    gestationalWeek,
    gestationalDay,
    totalDaysPregnant,
    trimester: trimesterForWeek(gestationalWeek),
    daysRemaining,
    isDueDatePassed,
    sizeLabel,
    developmentFact,
  };
}

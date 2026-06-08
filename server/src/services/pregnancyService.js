// Pregnancy calculation engine (F1).
//
// Pure functions: callers inject `today` so results are deterministic and testable.
// No medical or scary wording anywhere in the size/fact data.

import { addDays, daysBetween } from '../utils/dateUtils.js';

const GESTATION_DAYS = 280; // standard 40-week estimate

// Size + development fact by gestational week, in Lithuanian (warm, non-clinical).
export const SIZE_BY_WEEK = {
  6: { sizeLabel: 'žirnelio', developmentFact: 'Pradeda ryškėti maži veiduko bruožai.' },
  7: { sizeLabel: 'mėlynės', developmentFact: 'Auga mažytės rankų ir kojų užuomazgos.' },
  8: { sizeLabel: 'avietės', developmentFact: 'Pradeda formuotis maži pirščiukai.' },
  9: { sizeLabel: 'vynuogės', developmentFact: 'Pradeda vystytis maži raumenėliai.' },
  10: { sizeLabel: 'braškės', developmentFact: 'Formuojasi maži sąnariukai.' },
  11: { sizeLabel: 'figos', developmentFact: 'Vis labiau panašėju į tikrą kūdikį.' },
  12: { sizeLabel: 'laimo', developmentFact: 'Pradeda formuotis pirmieji refleksai.' },
  13: { sizeLabel: 'citrinos', developmentFact: 'Gali ryškėti maži pirštų atspaudai.' },
  14: { sizeLabel: 'persiko', developmentFact: 'Tampu vis judresnis ir koordinuotas.' },
  15: { sizeLabel: 'obuolio', developmentFact: 'Galbūt mokausi mažų judesių.' },
  16: { sizeLabel: 'avokado', developmentFact: 'Gali ryškėti mažos veido išraiškos.' },
};

const FALLBACK_SIZE = {
  sizeLabel: 'mažo daigelio',
  developmentFact: 'Kiekvieną dieną po truputį augu.',
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

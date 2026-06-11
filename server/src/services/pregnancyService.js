// Pregnancy calculation engine (F1).
//
// Pure functions: callers inject `today` so results are deterministic and testable.
// No medical or scary wording anywhere in the size/fact data.

import { addDays, daysBetween } from '../utils/dateUtils.js';

const GESTATION_DAYS = 280; // standard 40-week estimate

// Size + development fact by gestational week, in Lithuanian (warm, non-clinical).
// Covers the full pregnancy (4–42); the fact doubles as the fallback-card line and as a
// hint for the AI message (which writes its own week-appropriate fact — see aiTextService).
export const SIZE_BY_WEEK = {
  4: { sizeLabel: 'aguonos grūdelio', developmentFact: 'Įsikūriau savo jaukiame namelyje.' },
  5: { sizeLabel: 'sezamo sėklytės', developmentFact: 'Pradeda plakti mano mažytė širdelė.' },
  6: { sizeLabel: 'žirnelio', developmentFact: 'Pradeda ryškėti maži veiduko bruožai.' },
  7: { sizeLabel: 'mėlynės', developmentFact: 'Auga mažytės rankų ir kojų užuomazgos.' },
  8: { sizeLabel: 'avietės', developmentFact: 'Pradeda formuotis maži pirščiukai.' },
  9: { sizeLabel: 'vynuogės', developmentFact: 'Pradeda vystytis maži raumenėliai.' },
  10: { sizeLabel: 'braškės', developmentFact: 'Formuojasi maži sąnariukai.' },
  11: { sizeLabel: 'figos', developmentFact: 'Vis labiau panašėju į tikrą kūdikį.' },
  12: { sizeLabel: 'laimo', developmentFact: 'Pradeda formuotis pirmieji refleksai.' },
  13: { sizeLabel: 'citrinos', developmentFact: 'Gali ryškėti maži pirštų atspaudai.' },
  14: { sizeLabel: 'persiko', developmentFact: 'Mano judesiai vis vikresni ir tikslesni.' },
  15: { sizeLabel: 'obuolio', developmentFact: 'Galbūt mokausi mažų judesių.' },
  16: { sizeLabel: 'avokado', developmentFact: 'Gali ryškėti mažos veido išraiškos.' },
  17: { sizeLabel: 'kriaušės', developmentFact: 'Mokausi čiulpti nykštį.' },
  18: { sizeLabel: 'saldžiosios paprikos', developmentFact: 'Pradedu girdėti garsus iš išorės.' },
  19: { sizeLabel: 'pomidoro', developmentFact: 'Mano oda dengiasi švelniu apsauginiu sluoksneliu.' },
  20: { sizeLabel: 'banano', developmentFact: 'Jau galiu spardytis — greitai pajusi!' },
  21: { sizeLabel: 'morkos', developmentFact: 'Mano spyriukai darosi vis stipresni.' },
  22: { sizeLabel: 'cukinijos', developmentFact: 'Pradedu skirti šviesą ir tamsą.' },
  23: { sizeLabel: 'greipfruto', developmentFact: 'Girdžiu tavo balsą ir jis man patinka.' },
  24: { sizeLabel: 'kukurūzo burbuolės', developmentFact: 'Mano veidelis jau beveik susiformavęs.' },
  25: { sizeLabel: 'brokolio', developmentFact: 'Mokausi reaguoti į tavo prisilietimus.' },
  26: { sizeLabel: 'salotų gūžės', developmentFact: 'Pradedu atmerkti akytes.' },
  27: { sizeLabel: 'žiedinio kopūsto', developmentFact: 'Sapnuoju pirmuosius sapnus.' },
  28: { sizeLabel: 'baklažano', developmentFact: 'Jau mirksiu ir kartais net žagsiu!' },
  29: { sizeLabel: 'mažo moliūgėlio', developmentFact: 'Stiprėja mano kauliukai ir raumenukai.' },
  30: { sizeLabel: 'kopūsto', developmentFact: 'Mano smegenėlės sparčiai auga.' },
  31: { sizeLabel: 'kokoso', developmentFact: 'Jau moku pasukti galvytę.' },
  32: { sizeLabel: 'meliono', developmentFact: 'Treniruojuosi kvėpuoti.' },
  33: { sizeLabel: 'ananaso', developmentFact: 'Pradedu skirti dieną ir naktį.' },
  34: { sizeLabel: 'papajos', developmentFact: 'Augu ir kaupiu jėgas mūsų susitikimui.' },
  35: { sizeLabel: 'poro', developmentFact: 'Mano rankytės jau tvirtai gniaužia.' },
  36: { sizeLabel: 'romaninių salotų', developmentFact: 'Ruošiuosi kelionei pas tave.' },
  37: { sizeLabel: 'mažo arbūziuko', developmentFact: 'Jau beveik metas mums susitikti!' },
  38: { sizeLabel: 'moliūgo', developmentFact: 'Kasdien vis labiau apvalėju.' },
  39: { sizeLabel: 'nedidelio arbūzo', developmentFact: 'Bet kurią dieną galiu pasibelsti!' },
  40: { sizeLabel: 'arbūzo', developmentFact: 'Laukiu mūsų susitikimo, mama.' },
  41: { sizeLabel: 'tikro kūdikio', developmentFact: 'Dar truputį pasimėgausiu jaukumu.' },
  42: { sizeLabel: 'tikro kūdikio', developmentFact: 'Jau tuoj tuoj — pažadu!' },
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

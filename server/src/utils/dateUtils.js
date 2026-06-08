// Date helpers for pregnancy math.
//
// All stored dates are date-only strings ("YYYY-MM-DD"). Day-level arithmetic on
// date-only values is timezone-independent, so we only need a timezone to answer
// "what calendar day is it right now". That avoids pulling in luxon/dayjs.

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True if the value is a valid "YYYY-MM-DD" calendar date. */
export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  // Reject overflow like 2026-02-31 (which JS would otherwise roll forward).
  return toDateString(date) === value;
}

/** Format a Date as a UTC "YYYY-MM-DD" string. */
function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

/** Current calendar day ("YYYY-MM-DD") in the given IANA timezone. */
export function todayInTimezone(timezone = 'Europe/Vilnius', now = new Date()) {
  // 'en-CA' yields ISO-style YYYY-MM-DD output.
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/** Whole days from `from` to `to` (positive if `to` is later). Both "YYYY-MM-DD". */
export function daysBetween(from, to) {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / MS_PER_DAY);
}

/** Return `dateStr` shifted by `n` days as a "YYYY-MM-DD" string. */
export function addDays(dateStr, n) {
  const base = Date.parse(`${dateStr}T00:00:00Z`);
  return toDateString(new Date(base + n * MS_PER_DAY));
}

/**
 * Current wall-clock parts in the given timezone, for the scheduler.
 * Returns { date:'YYYY-MM-DD', time:'HH:mm', dayOfWeek } where dayOfWeek is 0=Sunday..6=Saturday.
 */
export function nowPartsInTimezone(timezone = 'Europe/Vilnius', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  // 'en-CA' returns hour '24' at midnight; normalize to '00'.
  const hour = get('hour') === '24' ? '00' : get('hour');
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
    dayOfWeek: weekdayMap[get('weekday')],
  };
}

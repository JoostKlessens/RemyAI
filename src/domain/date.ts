/**
 * Pure date-math helpers for the decision engine.
 *
 * Everything here operates on the `YYYY-MM-DD` strings already present on
 * the domain types (`IsoDateString`) — never on `Date.now()` or the host
 * runtime's local timezone. That is a determinism requirement, not a
 * style preference: `decide()` must produce the same result for the same
 * request regardless of which machine (or which timezone that machine's
 * clock is set to) evaluates it.
 *
 * Deliberate simplification: weekday and day-difference math below is done
 * in UTC using only the calendar digits found in the string, not the
 * household's IANA timezone. A save made in the last minute before local
 * midnight in `Europe/Amsterdam` could in theory land on the "wrong" UTC
 * day. Doing this precisely would mean depending on the runtime's ICU/
 * timezone database inside a module that is supposed to have zero
 * environmental dependencies. Given the reason text is a soft, friendly
 * nudge ("Je bewaarde dit dinsdag") and not a legal or scheduling
 * guarantee, this trade-off favors a dependency-free, always-reproducible
 * engine over minute-level timezone precision. Flagged for product review.
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

interface CalendarDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
}

/**
 * Parses the leading `YYYY-MM-DD` portion of an IsoDateString or
 * IsoDateTimeString. Throws on malformed input rather than returning a
 * sentinel — a malformed date is a contract violation upstream, not a
 * legitimate "no candidate" outcome the caller should have to handle.
 */
export function parseCalendarDate(isoDate: string): CalendarDate {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) {
    throw new Error(`Expected a YYYY-MM-DD date, received: "${isoDate}"`);
  }
  const [, yearText, monthText, dayText] = match;
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
  };
}

function toUtcMillis(date: CalendarDate): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days from `fromIsoDate` to `toIsoDate` (positive when `to` is later). */
export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const fromMillis = toUtcMillis(parseCalendarDate(fromIsoDate));
  const toMillis = toUtcMillis(parseCalendarDate(toIsoDate));
  return Math.round((toMillis - fromMillis) / MILLIS_PER_DAY);
}

const DUTCH_WEEKDAYS: readonly string[] = [
  'zondag',
  'maandag',
  'dinsdag',
  'woensdag',
  'donderdag',
  'vrijdag',
  'zaterdag',
];

/** Dutch weekday name for a `YYYY-MM-DD...` date, computed in UTC. See module note above. */
export function dutchWeekdayName(isoDate: string): string {
  const calendarDate = parseCalendarDate(isoDate);
  const dayIndex = new Date(toUtcMillis(calendarDate)).getUTCDay();
  const weekdayName = DUTCH_WEEKDAYS[dayIndex];
  if (weekdayName === undefined) {
    // Unreachable: getUTCDay() is always 0-6 and DUTCH_WEEKDAYS has 7 entries.
    throw new Error(`Unexpected weekday index: ${dayIndex}`);
  }
  return weekdayName;
}

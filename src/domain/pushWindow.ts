/**
 * WHICH HOUSEHOLDS ARE DUE THEIR DECISION PUSH RIGHT NOW.
 *
 * THE PROBLEM THIS EXISTS TO SOLVE, AND WHY IT IS NOT A `timestamptz`
 * COMPARISON. `households.decision_push_time` is a `time` and
 * `households.timezone` is a separate IANA string, and 0001_init.sql:91-94
 * says in as many words why: "16:00" has to mean the household's LOCAL
 * 16:00 every day, unaffected by DST. A single `timestamptz` cannot
 * express that — it would drift by an hour twice a year, in opposite
 * directions, and the drift would look like the feature simply being late.
 *
 * So the scheduled function cannot run once a day at a fixed UTC instant.
 * It runs often (every 15 minutes is the assumed granularity) and asks
 * this question of every household on each pass.
 *
 * IT IS A WINDOW, NOT AN EQUALITY. A cron that fires "every 15 minutes"
 * does not fire at :00, :15, :30, :45 exactly — it drifts by seconds under
 * load and can be a minute or more late. Testing `localTime === pushTime`
 * would therefore silently skip a household on any run that arrived a
 * second past the minute, and that household would get no dinner
 * suggestion at all that day. A window is the only shape that survives an
 * imprecise scheduler.
 *
 * DOUBLE SENDS ARE NOT PREVENTED HERE, ON PURPOSE. If the window is as
 * long as the cron interval, a household falls inside it on exactly one
 * pass — but a retry, a manual invocation, or a cron that fires twice
 * would each see the same household as due. Making that safe is not this
 * function's job and must not be: the guard is that the caller creates
 * today's `decisions` row only if `getDecisionByDate` returns nothing, so
 * the ROW is the idempotency key. A second guard here would be a second
 * place for the rule to be wrong, and the weaker of the two — this one
 * knows the clock, the row knows what actually happened.
 *
 * PURE, so the DST arithmetic is provable in tests/pushWindow.test.ts.
 * `now` is a parameter and is never read from the clock in here, the same
 * contract cookTimer.ts holds and for the same reason: the interesting
 * cases are the two Sundays a year when Europe/Amsterdam changes offset,
 * and those are not reachable by a test that asks what time it is.
 */

/** Only what the question needs off a household row. */
export interface PushWindowHousehold {
  readonly id: string;
  /** IANA zone, e.g. 'Europe/Amsterdam'. */
  readonly timezone: string;
  /** Local wall-clock time as Postgres renders a `time`: 'HH:MM' or 'HH:MM:SS'. */
  readonly decisionPushTime: string;
}

/**
 * How long a household stays "due" after its push time passes. Matches the
 * assumed 15-minute cron granularity: any shorter and a late run misses
 * the household entirely, any longer and two consecutive runs both see it
 * — which is harmless (see the header on idempotency) but pointless.
 */
export const PUSH_WINDOW_MINUTES = 15;

const MINUTES_PER_DAY = 24 * 60;

/**
 * The household's local wall-clock time at `nowMs`, in minutes since local
 * midnight.
 *
 * `Intl.DateTimeFormat` rather than any offset arithmetic of our own: it
 * carries the IANA database, so it knows that Europe/Amsterdam is +01:00
 * in January and +02:00 in July without being told. Hand-rolling that
 * means shipping a copy of the world's DST rules and keeping it current,
 * which is why this function is three lines instead of three hundred.
 *
 * `hourCycle: 'h23'` and not `hour12: false`: the latter is specified to
 * produce hour 24 for midnight in some implementations, which would put
 * midnight a full day away from where it belongs.
 */
function localMinutesOfDay(nowMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * Parses 'HH:MM' or 'HH:MM:SS' into minutes since midnight. Seconds are
 * read and discarded rather than rejected: Postgres renders a `time`
 * column with them, and a function that threw on its own database's output
 * would fail for every household at once.
 */
function parsePushTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (match === null) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

/**
 * Is this household inside its push window at `nowMs`?
 *
 * Returns FALSE for an unparseable time or an unknown timezone rather than
 * throwing. One malformed row must not stop the run for every other
 * household — a scheduled job that dies on the first bad record is a job
 * that silently stops feeding everybody. The caller is expected to count
 * these; see `describePushWindowSkip`.
 */
export function isHouseholdDue(
  household: PushWindowHousehold,
  nowMs: number,
  windowMinutes: number = PUSH_WINDOW_MINUTES,
): boolean {
  const pushMinutes = parsePushTime(household.decisionPushTime);
  if (pushMinutes === null) {
    return false;
  }
  let localMinutes: number;
  try {
    localMinutes = localMinutesOfDay(nowMs, household.timezone);
  } catch {
    // An IANA zone Intl does not recognise. Same reasoning as above: skip
    // the row, do not take the run down with it.
    return false;
  }
  // Modular, so a window that starts at 23:55 still catches 00:05. Without
  // this the last minutes of the day are a hole that only appears for a
  // household that moved its push time late.
  const elapsed = (localMinutes - pushMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return elapsed < windowMinutes;
}

/** Why a household was skipped, for the run's log line. Null when it is simply not due yet. */
export function describePushWindowSkip(household: PushWindowHousehold): string | null {
  if (parsePushTime(household.decisionPushTime) === null) {
    return `decision_push_time is unparseable: ${JSON.stringify(household.decisionPushTime)}`;
  }
  try {
    localMinutesOfDay(Date.now(), household.timezone);
  } catch {
    return `timezone is not a known IANA zone: ${JSON.stringify(household.timezone)}`;
  }
  return null;
}

/** The households due right now. The one function the scheduled job calls. */
export function selectDueHouseholds<T extends PushWindowHousehold>(
  households: readonly T[],
  nowMs: number,
  windowMinutes: number = PUSH_WINDOW_MINUTES,
): readonly T[] {
  return households.filter((household) => isHouseholdDue(household, nowMs, windowMinutes));
}

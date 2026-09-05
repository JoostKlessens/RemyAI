import { describe, expect, test } from 'vitest';
import {
  PUSH_WINDOW_MINUTES,
  describePushWindowSkip,
  isHouseholdDue,
  selectDueHouseholds,
  type PushWindowHousehold,
} from '@/domain/pushWindow';

/**
 * The DST block is the reason this module exists. Everything else here is
 * arithmetic that would survive a rewrite; the two Sundays a year when
 * Europe/Amsterdam changes offset are what a `timestamptz` column got
 * wrong, and they are unreachable by any test that asks what time it is
 * now. That is why `now` is a parameter.
 */

function household(overrides: Partial<PushWindowHousehold> = {}): PushWindowHousehold {
  return { id: 'hh-1', timezone: 'Europe/Amsterdam', decisionPushTime: '16:00', ...overrides };
}

const at = (iso: string): number => new Date(iso).getTime();

describe('the window opens at the push time and stays open', () => {
  test('is due on the exact minute', () => {
    // 15:00 UTC in January is 16:00 in Amsterdam (CET, +01:00).
    expect(isHouseholdDue(household(), at('2026-01-15T15:00:00Z'))).toBe(true);
  });

  test('is still due one minute before the window closes', () => {
    expect(isHouseholdDue(household(), at('2026-01-15T15:14:00Z'))).toBe(true);
  });

  test('is no longer due once the window has passed', () => {
    expect(isHouseholdDue(household(), at('2026-01-15T15:15:00Z'))).toBe(false);
  });

  test('is not due before its time', () => {
    expect(isHouseholdDue(household(), at('2026-01-15T14:59:00Z'))).toBe(false);
  });

  test('a late run still catches the household, which is the whole point of a window', () => {
    // A cron that fires "every 15 minutes" drifts. An equality check would
    // silently skip this household for the day.
    expect(isHouseholdDue(household(), at('2026-01-15T15:00:47Z'))).toBe(true);
  });
});

describe('summer time — the case a timestamptz column gets wrong', () => {
  test('16:00 Amsterdam is 15:00 UTC in winter', () => {
    expect(isHouseholdDue(household(), at('2026-01-15T15:00:00Z'))).toBe(true);
  });

  test('16:00 Amsterdam is 14:00 UTC in summer', () => {
    // Same household, same wall-clock promise, an hour earlier in UTC.
    // A fixed daily UTC job would be an hour late for half the year.
    expect(isHouseholdDue(household(), at('2026-07-15T14:00:00Z'))).toBe(true);
  });

  test('the winter instant is NOT due in summer', () => {
    // 15:00 UTC in July is 17:00 in Amsterdam — an hour after the window
    // closed. This is the assertion that fails if anyone replaces the
    // Intl lookup with a hard-coded offset.
    expect(isHouseholdDue(household(), at('2026-07-15T15:00:00Z'))).toBe(false);
  });
});

describe('a window that crosses midnight', () => {
  test('catches a household whose local time has already rolled over', () => {
    // Push at 23:55, and it is 00:05 locally — ten minutes elapsed, not
    // 1430. Without modular arithmetic the end of the day is a hole.
    const late = household({ decisionPushTime: '23:55' });
    expect(isHouseholdDue(late, at('2026-01-15T23:05:00Z'))).toBe(true);
  });

  test('and still closes on time after the rollover', () => {
    const late = household({ decisionPushTime: '23:55' });
    expect(isHouseholdDue(late, at('2026-01-15T23:15:00Z'))).toBe(false);
  });
});

describe('a bad row is skipped, never thrown', () => {
  // A scheduled job that dies on the first malformed record is a job that
  // silently stops feeding every other household.
  test('an unparseable time is not due', () => {
    expect(isHouseholdDue(household({ decisionPushTime: 'kwart over vier' }), at('2026-01-15T15:00:00Z'))).toBe(false);
  });

  test('an out-of-range time is not due', () => {
    expect(isHouseholdDue(household({ decisionPushTime: '25:00' }), at('2026-01-15T15:00:00Z'))).toBe(false);
  });

  test('an unknown timezone is not due', () => {
    expect(isHouseholdDue(household({ timezone: 'Mars/Olympus_Mons' }), at('2026-01-15T15:00:00Z'))).toBe(false);
  });

  test('seconds from Postgres are read and discarded, not rejected', () => {
    // A `time` column renders as HH:MM:SS. Refusing that would fail for
    // every household at once.
    expect(isHouseholdDue(household({ decisionPushTime: '16:00:00' }), at('2026-01-15T15:00:00Z'))).toBe(true);
  });

  test('each bad row can say why it was skipped', () => {
    expect(describePushWindowSkip(household({ decisionPushTime: 'x' }))).toContain('unparseable');
    expect(describePushWindowSkip(household({ timezone: 'Nowhere/Nowhere' }))).toContain('IANA');
    expect(describePushWindowSkip(household())).toBeNull();
  });
});

describe('selecting across a mixed set of households', () => {
  test('picks only the zones whose local clock has reached the hour', () => {
    const households: readonly PushWindowHousehold[] = [
      { id: 'amsterdam', timezone: 'Europe/Amsterdam', decisionPushTime: '16:00' },
      { id: 'london', timezone: 'Europe/London', decisionPushTime: '16:00' },
      { id: 'new-york', timezone: 'America/New_York', decisionPushTime: '16:00' },
    ];
    // 15:00 UTC in January: Amsterdam 16:00, London 15:00, New York 10:00.
    const due = selectDueHouseholds(households, at('2026-01-15T15:00:00Z'));
    expect(due.map((entry) => entry.id)).toEqual(['amsterdam']);
  });

  test('returns nothing when nobody is due', () => {
    expect(selectDueHouseholds([household()], at('2026-01-15T09:00:00Z'))).toEqual([]);
  });

  test('the default window matches the assumed cron granularity', () => {
    // If the cron interval and this constant ever diverge, a household
    // either gets missed or gets seen twice — both are decisions, not
    // accidents, so the number is pinned here.
    expect(PUSH_WINDOW_MINUTES).toBe(15);
  });
});

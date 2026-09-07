/**
 * The two questions the owner asked of a household's own cook history on
 * 8 September 2026: what grade does this recipe carry once you have cooked it
 * more than once, and when may the app ask for a grade at all.
 */
import { describe, expect, test } from 'vitest';

import {
  RATING_DELAY_HOURS,
  averageCookRating,
  isRatingDue,
  selectPendingRating,
} from '@/domain/cookRating';
import type { CookEvent, CookEventId, HouseholdId, MealId } from '@/domain/types';

const HOUSEHOLD = 'h-1' as HouseholdId;
const NOW = Date.parse('2026-09-08T20:00:00.000Z');
const HOURS = 3_600_000;

function event(overrides: Partial<CookEvent> & { readonly id: string }): CookEvent {
  return {
    id: overrides.id as CookEventId,
    householdId: HOUSEHOLD,
    mealId: (overrides.mealId ?? 'm-1') as MealId,
    decisionId: null,
    cookedOn: overrides.cookedOn ?? '2026-09-08',
    wouldRepeat: null,
    rating: overrides.rating ?? null,
    createdAt: overrides.createdAt ?? new Date(NOW - 24 * HOURS).toISOString(),
  };
}

describe('averageCookRating', () => {
  test('one cook gives that cook\u2019s grade, so nothing changes for a recipe made once', () => {
    expect(averageCookRating([event({ id: 'c1', rating: 7.5 })], 'm-1' as MealId)).toBe(7.5);
  });

  test('cooking it again averages the grades \u2014 the owner\u2019s "vanaf dan het gemiddelde"', () => {
    const events = [event({ id: 'c1', rating: 8 }), event({ id: 'c2', rating: 6 })];
    expect(averageCookRating(events, 'm-1' as MealId)).toBe(7);
  });

  test('an ungraded cook is not a zero \u2014 it leaves the average alone instead of dragging it down', () => {
    const events = [event({ id: 'c1', rating: 8 }), event({ id: 'c2', rating: null })];
    expect(averageCookRating(events, 'm-1' as MealId)).toBe(8);
  });

  test('no grades at all is null, never NaN \u2014 the tile draws a hat, not an empty numeral', () => {
    expect(averageCookRating([event({ id: 'c1', rating: null })], 'm-1' as MealId)).toBeNull();
  });

  test('off-scale stored grades are dropped, not clamped \u2014 rating.ts\u2019s own stance', () => {
    const events = [event({ id: 'c1', rating: 8 }), event({ id: 'c2', rating: 99 })];
    expect(averageCookRating(events, 'm-1' as MealId)).toBe(8);
  });

  test('another meal\u2019s cooks never leak in', () => {
    const events = [event({ id: 'c1', rating: 8 }), event({ id: 'c2', mealId: 'm-2', rating: 2 })];
    expect(averageCookRating(events, 'm-1' as MealId)).toBe(8);
  });
});

describe('isRatingDue', () => {
  test('the delay is twelve hours, in one place', () => {
    expect(RATING_DELAY_HOURS).toBe(12);
  });

  test('right after cooking it is not due \u2014 "anders heb je het waarschijnlijk nog helemaal niet gegeten"', () => {
    expect(isRatingDue(event({ id: 'c1', createdAt: new Date(NOW).toISOString() }), NOW)).toBe(false);
  });

  test('eleven and a half hours later it is still not due', () => {
    const created = new Date(NOW - 11.5 * HOURS).toISOString();
    expect(isRatingDue(event({ id: 'c1', createdAt: created }), NOW)).toBe(false);
  });

  test('exactly twelve hours later it is due \u2014 the boundary is inclusive so a clock tick cannot skip it', () => {
    const created = new Date(NOW - 12 * HOURS).toISOString();
    expect(isRatingDue(event({ id: 'c1', createdAt: created }), NOW)).toBe(true);
  });

  test('an already graded cook is never due again', () => {
    const created = new Date(NOW - 48 * HOURS).toISOString();
    expect(isRatingDue(event({ id: 'c1', rating: 7, createdAt: created }), NOW)).toBe(false);
  });

  test('an unparseable timestamp is not due \u2014 it fails closed rather than asking about a cook it cannot date', () => {
    expect(isRatingDue(event({ id: 'c1', createdAt: 'niet-een-datum' }), NOW)).toBe(false);
  });
});

describe('selectPendingRating', () => {
  test('nothing to ask about is null', () => {
    expect(selectPendingRating([], NOW)).toBeNull();
  });

  test('picks the OLDEST due cook, so a backlog drains in the order it happened', () => {
    const events = [
      event({ id: 'recent', createdAt: new Date(NOW - 13 * HOURS).toISOString() }),
      event({ id: 'oldest', createdAt: new Date(NOW - 40 * HOURS).toISOString() }),
    ];
    expect(selectPendingRating(events, NOW)?.id).toBe('oldest');
  });

  test('skips the cook from an hour ago and finds the one from yesterday', () => {
    const events = [
      event({ id: 'tonight', createdAt: new Date(NOW - 1 * HOURS).toISOString() }),
      event({ id: 'yesterday', createdAt: new Date(NOW - 26 * HOURS).toISOString() }),
    ];
    expect(selectPendingRating(events, NOW)?.id).toBe('yesterday');
  });

  test('a fully graded history asks nothing', () => {
    const events = [event({ id: 'c1', rating: 8, createdAt: new Date(NOW - 40 * HOURS).toISOString() })];
    expect(selectPendingRating(events, NOW)).toBeNull();
  });
});

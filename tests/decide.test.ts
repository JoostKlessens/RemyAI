import { describe, expect, test } from 'vitest';
import { decide, isSwapExhausted, SWAP_EXHAUSTED_EVENT } from '@/domain/decide';
import type { DecisionResult } from '@/domain/types';
import {
  makeCookEvent,
  makeDecisionFilters,
  makeDecisionRequest,
  makeHousehold,
  makeMeal,
  makeMember,
  makeRestriction,
  makeSave,
} from './fixtures';

describe('decide — hard exclusions', () => {
  test('excludes meals containing an allergen tagged by any household member', () => {
    const members = [makeMember({ id: 'member-1' }), makeMember({ id: 'member-2' })];
    const restrictions = [
      makeRestriction({ memberId: 'member-2', type: 'allergen', excludesTag: 'peanuts' }),
    ];
    const candidateMeals = [
      makeMeal({ id: 'meal-safe', ingredientTags: ['chicken'] }),
      makeMeal({ id: 'meal-peanut', ingredientTags: ['peanuts'] }),
    ];
    const request = makeDecisionRequest({ members, restrictions, candidateMeals });

    const result = decide(request);

    expect(result.kind).toBe('suggestion');
    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-safe');
  });

  test('excludes meals containing a disliked ingredient tag', () => {
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'dislike', excludesTag: 'mushrooms' })];
    const candidateMeals = [
      makeMeal({ id: 'meal-liked', ingredientTags: ['chicken'] }),
      makeMeal({ id: 'meal-disliked', ingredientTags: ['mushrooms'] }),
    ];
    const request = makeDecisionRequest({ restrictions, candidateMeals });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-liked');
  });

  test('excludes meals exceeding the household weeknight time budget', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const candidateMeals = [
      makeMeal({ id: 'meal-quick', estimatedMinutes: 20, householdId: household.id }),
      makeMeal({ id: 'meal-slow', estimatedMinutes: 90, householdId: household.id }),
    ];
    const request = makeDecisionRequest({ household, candidateMeals });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-quick');
  });

  test('a swap never repeats a meal already offered today', () => {
    const candidateMeals = [
      makeMeal({ id: 'meal-1' }),
      makeMeal({ id: 'meal-2' }),
    ];
    const request = makeDecisionRequest({ candidateMeals, excludedMealIds: ['meal-1'] });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-2');
  });
});

describe('decide — alternativesRemaining (PD-001)', () => {
  test('the first offer allows 2 more swaps', () => {
    const request = makeDecisionRequest({ excludedMealIds: [] });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.alternativesRemaining).toBe(2);
  });

  test('after one swap, 1 remains', () => {
    const candidateMeals = [makeMeal({ id: 'meal-1' }), makeMeal({ id: 'meal-2' })];
    const request = makeDecisionRequest({ candidateMeals, excludedMealIds: ['meal-1'] });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.alternativesRemaining).toBe(1);
  });

  test('after two swaps, 0 remains', () => {
    const candidateMeals = [
      makeMeal({ id: 'meal-1' }),
      makeMeal({ id: 'meal-2' }),
      makeMeal({ id: 'meal-3' }),
    ];
    const request = makeDecisionRequest({ candidateMeals, excludedMealIds: ['meal-1', 'meal-2'] });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.alternativesRemaining).toBe(0);
  });
});

describe('decide — NoCandidateReason', () => {
  test('empty_rotation when there are no unarchived candidate meals at all', () => {
    const request = makeDecisionRequest({ candidateMeals: [] });

    const result = decide(request);

    expect(result).toEqual({ kind: 'no_candidate', reason: 'empty_rotation' });
  });

  test('empty_rotation when every candidate meal is archived (defensive)', () => {
    const candidateMeals = [makeMeal({ id: 'meal-1', archivedAt: '2026-01-01T00:00:00.000Z' })];
    const request = makeDecisionRequest({ candidateMeals });

    const result = decide(request);

    expect(result).toEqual({ kind: 'no_candidate', reason: 'empty_rotation' });
  });

  test('all_excluded when every candidate is removed by restrictions or time budget', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const candidateMeals = [makeMeal({ id: 'meal-slow', estimatedMinutes: 90, householdId: household.id })];
    const request = makeDecisionRequest({ household, candidateMeals });

    const result = decide(request);

    expect(result).toEqual({ kind: 'no_candidate', reason: 'all_excluded' });
  });

  test('swaps_exhausted when the only eligible meal has already been offered today', () => {
    const candidateMeals = [makeMeal({ id: 'meal-1' })];
    const request = makeDecisionRequest({ candidateMeals, excludedMealIds: ['meal-1'] });

    const result = decide(request);

    expect(result).toEqual({ kind: 'no_candidate', reason: 'swaps_exhausted' });
  });
});

describe('decide — scoring integration', () => {
  test('a this_week save wins over an equally-scored ordinary meal', () => {
    const candidateMeals = [
      makeMeal({ id: 'meal-saved', estimatedMinutes: 20 }),
      makeMeal({ id: 'meal-ordinary', estimatedMinutes: 20 }),
    ];
    const pendingThisWeekSaves = [makeSave({ mealId: 'meal-saved', savedAt: '2026-08-18T10:00:00.000Z' })];
    const request = makeDecisionRequest({ candidateMeals, pendingThisWeekSaves });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-saved');
    expect(result.kind === 'suggestion' && result.reasonCode).toBe('saved_this_week');
    expect(result.kind === 'suggestion' && result.reasonText).toBe('Je bewaarde dit dinsdag');
  });

  test('a wouldRepeat === false meal loses to an untried one', () => {
    const candidateMeals = [
      makeMeal({ id: 'meal-rejected', estimatedMinutes: 20 }),
      makeMeal({ id: 'meal-untried', estimatedMinutes: 20 }),
    ];
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-rejected', cookedOn: '2026-06-01', wouldRepeat: false }),
    ];
    const request = makeDecisionRequest({ candidateMeals, recentCookEvents });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-untried');
  });
});

describe('decide — determinism', () => {
  test('the same request produces an identical result every time', () => {
    const household = makeHousehold({ id: 'household-determinism', weeknightTimeBudgetMinutes: 30 });
    const members = [makeMember({ id: 'member-1', householdId: household.id })];
    const restrictions = [makeRestriction({ memberId: 'member-1', excludesTag: 'peanuts' })];
    const candidateMeals = [
      makeMeal({ id: 'meal-1', householdId: household.id, estimatedMinutes: 20, ingredientTags: ['chicken'] }),
      makeMeal({ id: 'meal-2', householdId: household.id, estimatedMinutes: 25, ingredientTags: ['beef'] }),
      makeMeal({ id: 'meal-3', householdId: household.id, estimatedMinutes: 15, ingredientTags: ['tofu'] }),
    ];
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-1', cookedOn: '2026-07-01', wouldRepeat: true }),
    ];
    const request = makeDecisionRequest({
      household,
      members,
      restrictions,
      candidateMeals,
      recentCookEvents,
      targetDate: '2026-08-22',
    });

    const firstResult = decide(request);
    const secondResult = decide(request);
    // Rebuild an independent (but deeply-equal) request object to confirm
    // determinism doesn't depend on object identity or any hidden state.
    const rebuiltRequest = makeDecisionRequest({
      household: makeHousehold({ id: 'household-determinism', weeknightTimeBudgetMinutes: 30 }),
      members: [makeMember({ id: 'member-1', householdId: household.id })],
      restrictions: [makeRestriction({ memberId: 'member-1', excludesTag: 'peanuts' })],
      candidateMeals: [
        makeMeal({ id: 'meal-1', householdId: household.id, estimatedMinutes: 20, ingredientTags: ['chicken'] }),
        makeMeal({ id: 'meal-2', householdId: household.id, estimatedMinutes: 25, ingredientTags: ['beef'] }),
        makeMeal({ id: 'meal-3', householdId: household.id, estimatedMinutes: 15, ingredientTags: ['tofu'] }),
      ],
      recentCookEvents: [makeCookEvent({ mealId: 'meal-1', cookedOn: '2026-07-01', wouldRepeat: true })],
      targetDate: '2026-08-22',
    });
    const thirdResult = decide(rebuiltRequest);

    expect(secondResult).toEqual(firstResult);
    expect(thirdResult).toEqual(firstResult);
  });
});

describe('decide — negative-score fallback path (Finding 2 regression)', () => {
  test('a meal with prior cook history never gets the variety reason when the whole pool scores <= 0', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const candidateMeals = [makeMeal({ id: 'meal-recent', householdId: household.id, estimatedMinutes: 20 })];
    // 3 days before targetDate: inside the recency penalty window, so this
    // single candidate's score is <= 0 — decide.ts's selectWinner widens
    // to the full scored pool in that case, and the winner must still be
    // truthfully labeled.
    const recentCookEvents = [makeCookEvent({ mealId: 'meal-recent', cookedOn: '2026-08-19' })];
    const request = makeDecisionRequest({
      household,
      candidateMeals,
      recentCookEvents,
      targetDate: '2026-08-22',
    });

    const result = decide(request);

    expect(result.kind).toBe('suggestion');
    expect(result.kind === 'suggestion' && result.reasonCode).toBe('fallback');
    expect(result.kind === 'suggestion' && result.reasonText).toBe('Een optie voor vanavond');
  });
});

describe('isSwapExhausted (PD-001 instrumentation, Finding 3)', () => {
  test('is true for a suggestion with zero alternatives remaining', () => {
    const result: DecisionResult = {
      kind: 'suggestion',
      mealId: 'meal-1',
      reasonCode: 'fallback',
      reasonText: 'Een optie voor vanavond',
      alternativesRemaining: 0,
    };

    expect(isSwapExhausted(result)).toBe(true);
  });

  test('is false for a suggestion with alternatives remaining', () => {
    const result: DecisionResult = {
      kind: 'suggestion',
      mealId: 'meal-1',
      reasonCode: 'fallback',
      reasonText: 'Een optie voor vanavond',
      alternativesRemaining: 1,
    };

    expect(isSwapExhausted(result)).toBe(false);
  });

  test('is false for a no_candidate result — nothing was actually offered to exhaust', () => {
    const result: DecisionResult = { kind: 'no_candidate', reason: 'swaps_exhausted' };

    expect(isSwapExhausted(result)).toBe(false);
  });

  test('decide() produces a result isSwapExhausted recognizes on the third offer', () => {
    const candidateMeals = [makeMeal({ id: 'meal-1' }), makeMeal({ id: 'meal-2' }), makeMeal({ id: 'meal-3' })];
    const request = makeDecisionRequest({ candidateMeals, excludedMealIds: ['meal-1', 'meal-2'] });

    const result = decide(request);

    expect(isSwapExhausted(result)).toBe(true);
  });

  test('decide() produces a result isSwapExhausted does NOT flag on the first offer', () => {
    const request = makeDecisionRequest({ excludedMealIds: [] });

    const result = decide(request);

    expect(isSwapExhausted(result)).toBe(false);
  });

  test('SWAP_EXHAUSTED_EVENT is the fixed event name PD-001 specifies', () => {
    expect(SWAP_EXHAUSTED_EVENT).toBe('swap_exhausted');
  });
});

describe('decide — Dutch reason text', () => {
  test('renders the correct weekday for a saved_this_week suggestion', () => {
    const candidateMeals = [makeMeal({ id: 'meal-1', estimatedMinutes: 20 })];
    const pendingThisWeekSaves = [makeSave({ mealId: 'meal-1', savedAt: '2026-08-19T09:00:00.000Z' })]; // Wednesday
    const request = makeDecisionRequest({ candidateMeals, pendingThisWeekSaves });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.reasonText).toBe('Je bewaarde dit woensdag');
  });
});

describe('decide — a "saved" meal is an ordinary rotation candidate (PD-004a)', () => {
  test('a meal with source "saved" is not specially excluded — it competes like any other candidate', () => {
    const candidateMeals = [makeMeal({ id: 'meal-saved-source', source: 'saved' })];
    const request = makeDecisionRequest({ candidateMeals });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-saved-source');
  });
});

describe('decide — an "ooit" (someday) save is eventually suggested (PD-004a)', () => {
  test('a freshly-saved "ooit" meal does not yet outrank a strongly-scored ordinary meal', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 40 });
    const candidateMeals = [
      makeMeal({ id: 'meal-ordinary', estimatedMinutes: 15 }),
      makeMeal({ id: 'meal-someday', estimatedMinutes: null }),
    ];
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-someday', intent: 'someday', savedAt: '2026-08-22T08:00:00.000Z' })];
    const request = makeDecisionRequest({ household, candidateMeals, pendingSomedaySaves, targetDate: '2026-08-22' });

    const result = decide(request);

    // Both meals are never-cooked/never-offered, so both classify into the
    // same novelty tier here (see the next test's comment) — the ordinary
    // meal's fits_time + variety genuinely outscores a same-day save.
    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-ordinary');
  });

  test('the same "ooit" meal wins once it has waited long enough — the ranking bug PD-004a describes is fixed', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 40 });
    const candidateMeals = [
      makeMeal({ id: 'meal-ordinary', estimatedMinutes: 15 }),
      makeMeal({ id: 'meal-someday', estimatedMinutes: null }),
    ];
    // Neither meal has ever been cooked or offered (recentCookEvents and
    // recentDecisions both default to []), so both classify as
    // 'genuinely_new' regardless of which tier today's seed prefers —
    // pickTierWithFallback always cascades to the one non-empty tier. This
    // makes the test deterministic across any targetDate/householdId, not
    // dependent on hitting a lucky seed.
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-someday', intent: 'someday', savedAt: '2026-01-01T08:00:00.000Z' })];
    const request = makeDecisionRequest({ household, candidateMeals, pendingSomedaySaves, targetDate: '2026-08-22' });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-someday');
    // Still an honest reason: the meal really has never been tried before.
    expect(result.kind === 'suggestion' && result.reasonCode).toBe('variety');
  });

  test('an "ooit" save keeps being offered across consecutive target dates once aged in, proving it is not a one-off fluke', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 40 });
    const candidateMeals = [
      makeMeal({ id: 'meal-ordinary', estimatedMinutes: 15 }),
      makeMeal({ id: 'meal-someday', estimatedMinutes: null }),
    ];
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-someday', intent: 'someday', savedAt: '2026-01-01T08:00:00.000Z' })];
    const targetDates = ['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24'];

    for (const targetDate of targetDates) {
      const request = makeDecisionRequest({ household, candidateMeals, pendingSomedaySaves, targetDate });
      const result = decide(request);
      expect(result.kind === 'suggestion' && result.mealId).toBe('meal-someday');
    }
  });
});

describe('decide — tonight-only filters (PD-009)', () => {
  test('a maxMinutes filter narrows the winner to a meal that fits tonight', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 90 });
    const candidateMeals = [
      makeMeal({ id: 'meal-long', householdId: household.id, estimatedMinutes: 60 }),
      makeMeal({ id: 'meal-short', householdId: household.id, estimatedMinutes: 15 }),
    ];
    const request = makeDecisionRequest({
      household,
      candidateMeals,
      filters: makeDecisionFilters({ maxMinutes: 20 }),
    });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-short');
  });

  test('a requiredDishTags filter narrows the winner to a meal in that category', () => {
    const candidateMeals = [
      makeMeal({ id: 'meal-soep', dishTags: ['soep'] }),
      makeMeal({ id: 'meal-pasta', dishTags: ['pasta'] }),
    ];
    const request = makeDecisionRequest({
      candidateMeals,
      filters: makeDecisionFilters({ requiredDishTags: ['pasta'] }),
    });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-pasta');
  });

  test('the default request carries no filters, so pre-PD-009 behaviour is unchanged', () => {
    const candidateMeals = [makeMeal({ id: 'meal-untagged', dishTags: [], estimatedMinutes: null })];
    const request = makeDecisionRequest({ candidateMeals });

    const result = decide(request);

    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-untagged');
  });

  test('a meal with an unknown estimatedMinutes passes the household budget but not an explicit cap', () => {
    // The asymmetry from exclusions.test.ts, proven end to end: the same
    // request differs only in whether the user stated a cap for tonight.
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const candidateMeals = [makeMeal({ id: 'meal-unknown-time', householdId: household.id, estimatedMinutes: null })];

    const withoutCap = decide(makeDecisionRequest({ household, candidateMeals }));
    const withCap = decide(
      makeDecisionRequest({ household, candidateMeals, filters: makeDecisionFilters({ maxMinutes: 30 }) }),
    );

    expect(withoutCap.kind === 'suggestion' && withoutCap.mealId).toBe('meal-unknown-time');
    expect(withCap).toEqual({ kind: 'no_candidate', reason: 'filtered_out' });
  });
});

describe('decide — filtered_out is its own reason, never all_excluded (PD-009)', () => {
  test('filtered_out when only the filter emptied the pool', () => {
    const candidateMeals = [makeMeal({ id: 'meal-soep', dishTags: ['soep'], estimatedMinutes: 20 })];
    const request = makeDecisionRequest({
      candidateMeals,
      filters: makeDecisionFilters({ requiredDishTags: ['pasta'] }),
    });

    const result = decide(request);

    expect(result).toEqual({ kind: 'no_candidate', reason: 'filtered_out' });
  });

  test('all_excluded still wins when restrictions already emptied the pool before the filter ran', () => {
    // Order matters for honesty: telling someone "je filter is te streng"
    // when their allergen restriction is what removed everything would
    // send them to relax the wrong thing.
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'noten' })];
    const candidateMeals = [makeMeal({ id: 'meal-noten', dishTags: ['pasta'], ingredientTags: ['noten'] })];
    const request = makeDecisionRequest({
      restrictions,
      candidateMeals,
      filters: makeDecisionFilters({ requiredDishTags: ['pasta'] }),
    });

    const result = decide(request);

    expect(result).toEqual({ kind: 'no_candidate', reason: 'all_excluded' });
  });

  test('swaps_exhausted still wins when the filter left something that was already offered today', () => {
    // The filter is not the binding constraint here — PD-001's two-swap
    // cap is, and relaxing a chip must never hand out extra swaps.
    const candidateMeals = [
      makeMeal({ id: 'meal-pasta', dishTags: ['pasta'] }),
      makeMeal({ id: 'meal-soep', dishTags: ['soep'] }),
    ];
    const request = makeDecisionRequest({
      candidateMeals,
      excludedMealIds: ['meal-pasta'],
      filters: makeDecisionFilters({ requiredDishTags: ['pasta'] }),
    });

    const result = decide(request);

    expect(result).toEqual({ kind: 'no_candidate', reason: 'swaps_exhausted' });
  });

  test('empty_rotation still wins over filtered_out — an empty library is not a filter problem', () => {
    const request = makeDecisionRequest({
      candidateMeals: [],
      filters: makeDecisionFilters({ requiredDishTags: ['pasta'] }),
    });

    const result = decide(request);

    expect(result).toEqual({ kind: 'no_candidate', reason: 'empty_rotation' });
  });
});

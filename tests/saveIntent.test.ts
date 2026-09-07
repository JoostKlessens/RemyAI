/**
 * The intent an import writes now that nobody is asked "wanneer?", and what
 * the decision engine does with it.
 *
 * WHY THIS FILE EXISTS AT ALL. Removing `SaveIntentSheet` from the import
 * flow is a UI change with a scoring consequence, and until this file
 * landed nothing anywhere could see the second half. `tests/scoring.test.ts`
 * pins what the engine does with a `this_week` save and with a `someday`
 * save; it has no opinion about which of the two an import produces,
 * because that used to be a human's answer to a question on a screen. Now
 * it is a constant, so it is a decision code can hold — and the moment it
 * became a decision code holds, it became one a test must pin, or the next
 * person to widen `SaveIntent` can flip what every household is offered for
 * dinner without a single assertion turning red.
 *
 * THE TWO HALVES ARE DELIBERATELY IN ONE FILE. Asserting the constant alone
 * would be a test that restates its subject; asserting the scoring alone
 * would leave the constant free to change underneath it. Read together they
 * say the thing that actually matters: an imported dish enters the rotation
 * pool with the AGING boost and not with the 100-point one, so it will come
 * around (PD-004a) but it does not jump the queue.
 */

import { describe, expect, test } from 'vitest';
import { decide } from '@/domain/decide';
import { IMPORT_DEFAULT_SAVE_INTENT, SAVE_INTENTS, guaranteesEventualSuggestion } from '@/domain/saveIntent';
import {
  SAVED_THIS_WEEK_BOOST,
  SOMEDAY_SAVE_BASE_BOOST,
  SOMEDAY_SAVE_MAX_BOOST,
  VARIETY_BOOST,
  scoreMeal,
} from '@/domain/scoring';
import type { Save } from '@/domain/types';
import { makeDecisionRequest, makeHousehold, makeMeal, makeSave } from './fixtures';

const TARGET_DATE = '2026-08-22';
/** Same day as `TARGET_DATE`: the dish was imported minutes ago. */
const IMPORTED_TODAY = '2026-08-22T09:00:00.000Z';
/** Far past `SOMEDAY_SAVE_ESCALATION_CAP_WEEKS`, so the aging boost is at its ceiling. */
const IMPORTED_LONG_AGO = '2026-01-01T09:00:00.000Z';

/**
 * The split `RemyRepository.listPendingSaves(householdId, intent)` performs
 * before either array reaches the engine — reproduced here rather than
 * hand-writing two arrays, so a test that says "the import writes THIS
 * intent" cannot quietly file the resulting save in the other bucket and
 * assert on a route the app does not take.
 */
function bucketByIntent(saves: readonly Save[]): {
  readonly pendingThisWeekSaves: readonly Save[];
  readonly pendingSomedaySaves: readonly Save[];
} {
  return {
    pendingThisWeekSaves: saves.filter((save) => save.intent === 'this_week'),
    pendingSomedaySaves: saves.filter((save) => save.intent === 'someday'),
  };
}

describe('IMPORT_DEFAULT_SAVE_INTENT', () => {
  test("is 'someday' — an imported dish enters the rotation, it does not claim tonight", () => {
    expect(IMPORT_DEFAULT_SAVE_INTENT).toBe('someday');
  });

  test("is never 'none', the graveyard intent PD-004a made unreachable from the UI", () => {
    expect(IMPORT_DEFAULT_SAVE_INTENT).not.toBe('none');
  });

  test("keeps PD-004a's promise: whatever it is, the engine is guaranteed to surface it", () => {
    expect(guaranteesEventualSuggestion(IMPORT_DEFAULT_SAVE_INTENT)).toBe(true);
  });
});

describe('guaranteesEventualSuggestion', () => {
  test('both schedulable intents come around', () => {
    expect(guaranteesEventualSuggestion('this_week')).toBe(true);
    expect(guaranteesEventualSuggestion('someday')).toBe(true);
  });

  test("'none' does not — it is the bookmark PD-004a calls a graveyard", () => {
    expect(guaranteesEventualSuggestion('none')).toBe(false);
  });

  /**
   * Walks the runtime list rather than the three cases above, so a fourth
   * `SaveIntent` cannot be added without somebody deciding, here, whether it
   * keeps the promise. That decision is the whole content of PD-004a.
   */
  test('answers for every intent the union carries', () => {
    for (const intent of SAVE_INTENTS) {
      expect(typeof guaranteesEventualSuggestion(intent)).toBe('boolean');
    }
    expect(SAVE_INTENTS).toContain(IMPORT_DEFAULT_SAVE_INTENT);
  });
});

/**
 * The half no test could see before. Every assertion below is about what
 * CHANGED when the "wanneer?" sheet went away — not about the aging boost
 * itself, which tests/scoring.test.ts already owns.
 */
describe('what the engine proposes for a freshly imported dish', () => {
  test('an import no longer earns the full SAVED_THIS_WEEK_BOOST on the day it arrives', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-imported', estimatedMinutes: null });
    const buckets = bucketByIntent([
      makeSave({ mealId: 'meal-imported', intent: IMPORT_DEFAULT_SAVE_INTENT, savedAt: IMPORTED_TODAY }),
    ]);

    const result = scoreMeal(
      meal,
      household,
      [],
      buckets.pendingThisWeekSaves,
      TARGET_DATE,
      buckets.pendingSomedaySaves,
    );

    // Never-cooked, so VARIETY_BOOST always rides along; what an import adds
    // on top of it is the aging boost's opening value, not 100.
    expect(result.score).toBe(VARIETY_BOOST + SOMEDAY_SAVE_BASE_BOOST);
    expect(result.score).toBeLessThan(VARIETY_BOOST + SAVED_THIS_WEEK_BOOST);
  });

  test('and it no longer tells the household it was saved for this week', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-imported', estimatedMinutes: null });
    const buckets = bucketByIntent([
      makeSave({ mealId: 'meal-imported', intent: IMPORT_DEFAULT_SAVE_INTENT, savedAt: IMPORTED_TODAY }),
    ]);

    const result = scoreMeal(
      meal,
      household,
      [],
      buckets.pendingThisWeekSaves,
      TARGET_DATE,
      buckets.pendingSomedaySaves,
    );

    // scoring.ts keeps the someday boost out of `contributions` on purpose:
    // it should make a dish win more often, not change why it is offered.
    expect(result.reasonCode).not.toBe('saved_this_week');
    expect(result.reasonCode).toBe('variety');
  });

  /**
   * THE LIBRARY'S HALF, UNCHANGED, and asserted beside the import's so the
   * two cannot be confused. LIB-04's "Deze week" row on the long-press sheet
   * (src/app/(tabs)/recipes.tsx) still writes `this_week`, so the 100-point
   * boost is not gone from the product — it moved from a question at import
   * time to a deliberate act in Mijn recepten.
   */
  test('the library\'s "Deze week" row still earns the full boost', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-planned', estimatedMinutes: null });
    const buckets = bucketByIntent([
      makeSave({ mealId: 'meal-planned', intent: 'this_week', savedAt: IMPORTED_TODAY }),
    ]);

    const result = scoreMeal(
      meal,
      household,
      [],
      buckets.pendingThisWeekSaves,
      TARGET_DATE,
      buckets.pendingSomedaySaves,
    );

    expect(result.score).toBe(VARIETY_BOOST + SAVED_THIS_WEEK_BOOST);
    expect(result.reasonCode).toBe('saved_this_week');
  });

  test('an imported dish that keeps losing eventually outranks an ordinary rotation meal', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const imported = makeMeal({ id: 'meal-imported', estimatedMinutes: null });
    const ordinary = makeMeal({ id: 'meal-ordinary', estimatedMinutes: null });
    const buckets = bucketByIntent([
      makeSave({ mealId: 'meal-imported', intent: IMPORT_DEFAULT_SAVE_INTENT, savedAt: IMPORTED_LONG_AGO }),
    ]);

    const importedScore = scoreMeal(
      imported,
      household,
      [],
      buckets.pendingThisWeekSaves,
      TARGET_DATE,
      buckets.pendingSomedaySaves,
    );
    const ordinaryScore = scoreMeal(
      ordinary,
      household,
      [],
      buckets.pendingThisWeekSaves,
      TARGET_DATE,
      buckets.pendingSomedaySaves,
    );

    expect(importedScore.score).toBe(VARIETY_BOOST + SOMEDAY_SAVE_MAX_BOOST);
    expect(importedScore.score).toBeGreaterThan(ordinaryScore.score);
  });

  /**
   * The same fact through the whole engine rather than through one scorer,
   * because `decide` is what a household actually meets: the request carries
   * the two save buckets separately, and an import now fills the second one.
   */
  test('decide offers the aged import over an equal competitor, without calling it a week plan', () => {
    const buckets = bucketByIntent([
      makeSave({ mealId: 'meal-imported', intent: IMPORT_DEFAULT_SAVE_INTENT, savedAt: IMPORTED_LONG_AGO }),
    ]);
    const request = makeDecisionRequest({
      candidateMeals: [
        makeMeal({ id: 'meal-ordinary', estimatedMinutes: null }),
        makeMeal({ id: 'meal-imported', estimatedMinutes: null }),
      ],
      targetDate: TARGET_DATE,
      ...buckets,
    });

    const result = decide(request);

    expect(result.kind).toBe('suggestion');
    expect(result.kind === 'suggestion' && result.mealId).toBe('meal-imported');
    expect(result.kind === 'suggestion' && result.reasonCode).not.toBe('saved_this_week');
  });
});

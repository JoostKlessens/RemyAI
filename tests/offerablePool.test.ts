/**
 * The pool the Kiezen filter bar is allowed to describe.
 *
 * WHY THIS FILE EXISTS AT ALL: `DecisionFilterBar`'s header claimed the chip
 * row "never offers a filter guaranteed to return nothing" while the chips
 * were being collected from `listHouseholdMeals` — the household's whole
 * library — in a route module no test can import. The claim was false and
 * unfalsifiable at the same time. `selectOfferableMeals` is the same two
 * passes `decide()` runs first, named, moved somewhere a test can reach, and
 * asserted here.
 */

import { describe, expect, test } from 'vitest';
import { selectOfferableMeals } from '@/domain/offerablePool';
import { makeHousehold, makeMeal, makeMealIngredient, makeMember, makeRestriction } from './fixtures';

const HOUSEHOLD = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
const MEMBER = makeMember();
/** GAP-34: the pre-existing cases say nothing about ingredient rows, so they hand in none. */
const NO_INGREDIENTS = new Map();

describe('selectOfferableMeals', () => {
  test('keeps a meal that survives every standing gate', () => {
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: 20 });

    expect(selectOfferableMeals([meal], HOUSEHOLD, [MEMBER], [], NO_INGREDIENTS)).toEqual([meal]);
  });

  test('drops an archived meal', () => {
    const archived = makeMeal({ id: 'meal-archived', archivedAt: '2026-01-02T00:00:00.000Z' });

    expect(selectOfferableMeals([archived], HOUSEHOLD, [MEMBER], [], NO_INGREDIENTS)).toEqual([]);
  });

  /**
   * The gate that made the old claim most obviously false: a household's
   * standing time budget removes a meal before any chip is tapped, so a
   * category that only exists on a 50-minute recipe was a guaranteed-empty
   * narrowing.
   */
  test('drops a meal over the household weeknight time budget', () => {
    const long = makeMeal({ id: 'meal-long', estimatedMinutes: 50 });

    expect(selectOfferableMeals([long], HOUSEHOLD, [MEMBER], [], NO_INGREDIENTS)).toEqual([]);
  });

  test('keeps a meal with no recorded duration, which the budget cannot judge', () => {
    const untimed = makeMeal({ id: 'meal-untimed', estimatedMinutes: null });

    expect(selectOfferableMeals([untimed], HOUSEHOLD, [MEMBER], [], NO_INGREDIENTS)).toEqual([untimed]);
  });

  test('drops a meal carrying an excluded allergen tag', () => {
    const peanuts = makeMeal({ id: 'meal-peanuts', ingredientTags: ['peanuts'] });
    const safe = makeMeal({ id: 'meal-safe' });
    const restriction = makeRestriction({ excludesTag: 'peanuts' });

    expect(selectOfferableMeals([peanuts, safe], HOUSEHOLD, [MEMBER], [restriction], NO_INGREDIENTS)).toEqual([safe]);
  });

  /**
   * PD-006, and the measurement behind the correction: with any allergen
   * restriction in the household, an untagged meal is UNKNOWN and excluded.
   * Most meals are unknown, so before this the chip row was largely built
   * out of meals that could never be offered.
   */
  test('drops an unverified meal once the household carries an allergen restriction', () => {
    const unknown = makeMeal({ id: 'meal-unknown', allergenTagStatus: 'unknown' });
    const verified = makeMeal({ id: 'meal-verified', allergenTagStatus: 'verified' });
    const restriction = makeRestriction({ type: 'allergen', excludesTag: 'peanuts' });

    expect(selectOfferableMeals([unknown, verified], HOUSEHOLD, [MEMBER], [restriction], NO_INGREDIENTS)).toEqual([verified]);
  });

  test('keeps an unverified meal when nobody in the household has an allergen restriction', () => {
    const unknown = makeMeal({ id: 'meal-unknown', allergenTagStatus: 'unknown' });

    expect(selectOfferableMeals([unknown], HOUSEHOLD, [MEMBER], [], NO_INGREDIENTS)).toEqual([unknown]);
  });

  test('never mutates the array it was handed', () => {
    const meals = [makeMeal({ id: 'meal-1' }), makeMeal({ id: 'meal-2', estimatedMinutes: 90 })];
    const before = [...meals];

    selectOfferableMeals(meals, HOUSEHOLD, [MEMBER], [], NO_INGREDIENTS);

    expect(meals).toEqual(before);
  });

  /**
   * GAP-34. The chip pool and the decision pool have to be the same pool,
   * and the dislike-by-name gate is one of the standing gates: a category
   * that only exists on a dish the household said it dislikes would be a
   * guaranteed-empty narrowing all over again.
   */
  test('drops a meal whose ingredient rows name a disliked ingredient', () => {
    const mushrooms = makeMeal({ id: 'meal-mushrooms' });
    const safe = makeMeal({ id: 'meal-safe' });
    const dislike = makeRestriction({ type: 'dislike', excludesTag: 'paddenstoelen' });
    const ingredientsByMeal = new Map([['meal-mushrooms', [makeMealIngredient({ mealId: 'meal-mushrooms' })]]]);

    expect(selectOfferableMeals([mushrooms, safe], HOUSEHOLD, [MEMBER], [dislike], ingredientsByMeal)).toEqual([safe]);
  });
});

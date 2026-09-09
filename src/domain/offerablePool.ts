/**
 * The meals tonight's filter chips are allowed to describe: everything that
 * survives the household's STANDING gates, before anybody has tapped
 * anything.
 *
 * ===========================================================================
 * WHY THIS IS ITS OWN NAMED THING AND NOT A LINE INSIDE A SCREEN
 * ===========================================================================
 *
 * `DecisionFilterBar`'s header argued a restraint: "Only categories the
 * household actually has. `availableDishTags` comes from the real candidate
 * pool, so the chip row is short for a small library and never offers a
 * filter guaranteed to return nothing."
 *
 * THE SECOND HALF OF THAT SENTENCE WAS FALSE. The tags were collected in
 * `(tabs)/index.tsx` from `candidateMeals`, which is `listHouseholdMeals` —
 * every unarchived meal the household owns, not the pool `decide()` will
 * actually choose from. Between the two sit three exclusions:
 *
 *   - an excluded allergen or dislike tag (`Restriction.excludesTag`);
 *   - `Household.weeknightTimeBudgetMinutes`, which is a hard `<=` and drops
 *     a 50-minute recipe from a 30-minute household every single evening;
 *   - and, for a household carrying ANY allergen restriction, every meal
 *     whose `allergenTagStatus` is not `'verified'` — which is MOST meals,
 *     because PD-006 fails safe and an untagged meal is `'unknown'`, never
 *     "safe".
 *
 * A chip drawn from a meal that cannot clear those is a narrowing that was
 * empty before it was offered: tap it and the only possible answer is
 * `filtered_out`. That is precisely what the restraint denied.
 *
 * It was also UNFALSIFIABLE where it lived. Route modules under src/app
 * cannot be imported by the test environment (vitest runs node with
 * react-native stubbed), so the collection ran where nothing could assert
 * it. Naming the pool and moving it here is what makes the corrected claim
 * checkable — tests/offerablePool.test.ts holds each of the three gates.
 *
 * ===========================================================================
 * WHAT IT STILL DOES NOT PROMISE
 * ===========================================================================
 *
 * That no chip is empty ON ITS OWN — not that no COMBINATION is. "pasta" AND
 * "vegetarisch" can be empty when neither is, and so can any tag under a
 * five-minute cap, because `filterByDecisionFilters` intersects three axes
 * (`DecisionFilters`: ALL of the tags, ANY of the moods, within the cap).
 * Closing that would mean re-deriving every chip against every other chip
 * and against the cap on each tap, and the product already answers it
 * honestly in one tap: `decide()` returns `filtered_out`, `NoCandidateState`
 * says so, and `Wissen` undoes it.
 *
 * ⚠ THE COMBINATION HALF IS CLOSED SINCE 9 SEPTEMBER 2026 (docs/LONGLIST.md
 * GAP-33), AND THE SENTENCE THAT PRICED IT IS LEFT STANDING BECAUSE THE PRICE
 * WAS WRONG. "Re-deriving every chip against every other chip on each tap"
 * is one `filterByDecisionFilters` pass per chip row over THIS pool — the
 * pass `decide()` runs on the same render anyway — and Mijn recepten had
 * been paying it per render since LIB-07. `collectSelectableDecisionDishTags`
 * and `collectSelectableDecisionDishMoods` (src/domain/recipeSearch.ts) do
 * it for Kiezen, over the meals this function returns. The split is now
 * exact: this module answers "which meals may a chip describe at all"
 * (standing gates, once per load), those two answer "which of them survive
 * what is already tapped" (per render). What is still true above is the
 * cap: `TimeCapPicker` is a ladder and not a set of chips, so the clock
 * alone can empty the pool, and `filtered_out` with `NoCandidateState`'s
 * "Filters wissen" is still the answer to that — the bar's own `Wissen` was
 * withdrawn the same day.
 *
 * ===========================================================================
 * IT IS `decide()`'s OWN FIRST TWO PASSES, IMPORTED
 * ===========================================================================
 *
 * Not a reimplementation of them, and that identity is the point rather than
 * economy: the pool the chips describe and the pool the engine narrows have
 * to be the same pool, and two spellings of "which meals count" is how they
 * come to differ by an allergen rule somebody added to one of them. What is
 * deliberately NOT included is `excludeAlreadyOffered` — a dish swapped away
 * this evening is still a dish the household owns, and hiding its category
 * would make the chip row flicker as somebody taps "Iets anders".
 *
 * Pure: no I/O, no throwing, no React, and it never mutates its argument.
 */

import { filterByRestrictionsAndTimeBudget, filterUnarchived } from './exclusions';
import type { Household, Meal, Member, Restriction } from './types';

/**
 * Takes the four values apart rather than a `DecisionRequest`, so a caller
 * holding a partially-built request (index.tsx's `requestBase` omits
 * `excludedMealIds` and `filters` on purpose) can call it without assembling
 * fields this answer does not depend on.
 */
export function selectOfferableMeals(
  candidateMeals: readonly Meal[],
  household: Household,
  members: readonly Member[],
  restrictions: readonly Restriction[],
): readonly Meal[] {
  return filterByRestrictionsAndTimeBudget(filterUnarchived(candidateMeals), household, members, restrictions);
}

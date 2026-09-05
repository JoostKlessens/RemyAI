/**
 * IS THIS RECIPE ALREADY IN THE LIBRARY? Asked before an import writes a
 * second copy of something the household already has.
 *
 * THE DEFECT THIS CLOSES, AND IT IS A DOCUMENTATION LIE RATHER THAN AN
 * OVERSIGHT. `src/app/import/confirm.tsx` has stated since it was written
 * that "`sourceUrl` is the row's deduplication key, not its id" — a
 * sentence load-bearing enough that the same comment uses it to explain
 * why `recipeId` may never be re-derived. Nothing ever implemented it.
 * `createMeal` (src/lib/repository/local/meals.ts) appends
 * unconditionally, so importing the same link twice put the same dish in
 * the library twice, which is what the owner hit on the first day he used
 * the app on a phone.
 *
 * IT DEDUPLICATES ON `sourceUrl` AND EXPLICITLY NOT ON `recipeId`. The
 * canonical id is the better key wherever it exists — it is what makes
 * twenty households' copies of one TikTok the same dish — but it is null
 * for every platform `canStoreCanonicalRecipe` refuses and for every
 * manual entry, so a check built on it would silently stop working for
 * exactly the routes that have no other protection. `sourceUrl` is
 * present on precisely the imports that can be repeated, because
 * repeating one means pasting the same address again.
 *
 * A NULL `sourceUrl` IS NEVER A DUPLICATE OF ANOTHER NULL, and this is the
 * trap worth naming. Two manual entries both carry null. So does every
 * pasted-text import (SRC-08: the user pasted the recipe, so there is no
 * address and never was one). Matching null to null would mean the second
 * dish anybody types by hand is refused as a copy of the first, which is
 * both wrong and unrecoverable from inside the flow. Null means "this has
 * no address", not "this has the same address as everything else without
 * one".
 *
 * IT COMPARES AGAINST WHAT IS ACTUALLY IN THE LIBRARY. The caller passes
 * `listHouseholdMeals`'s answer, which is the household's own unarchived
 * meals plus curated ones — the same list the library screen renders. That
 * is deliberate on both halves: an ARCHIVED meal is gone from the library,
 * so re-importing it is a legitimate way to get it back rather than a
 * mistake to block; and a CURATED meal with the same address really would
 * appear twice on screen, which is the complaint in its literal form.
 *
 * PURE, so the rule is provable in tests/import/duplicateImport.test.ts
 * rather than trusted to a route module the test suite cannot import —
 * which is how the original claim survived as a comment for months without
 * anything behind it.
 */

import type { Meal } from '../types';

/** Only what the check needs off a `Meal`, so a test does not build a whole dish to ask one question. */
export interface DuplicateCandidateMeal {
  readonly id: Meal['id'];
  readonly title: string;
  readonly sourceUrl: string | null;
}

/**
 * The already-imported meal this import would duplicate, or null.
 *
 * Returns the MEAL and not a boolean, because every useful thing the
 * caller does next needs it: name the dish in the sentence it shows, and
 * offer to open the copy that already exists. A boolean would force a
 * second lookup for information this function already held.
 *
 * `sourceUrl` is compared exactly, with no normalisation, and that is
 * safe here rather than lazy: every URL reaching this point has been
 * through `normalizeRecipeUrl` (src/domain/import/urlParsing.ts), which is
 * the one place canonicalisation happens and the same function the edge
 * function uses. Normalising a second time here would create a second
 * definition of "the same link" that could drift from the first.
 */
export function findDuplicateImport(
  meals: readonly DuplicateCandidateMeal[],
  sourceUrl: string | null,
): DuplicateCandidateMeal | null {
  if (sourceUrl === null) {
    return null;
  }
  return meals.find((meal) => meal.sourceUrl === sourceUrl) ?? null;
}

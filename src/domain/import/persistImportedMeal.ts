/**
 * The import flow's one write: a real meal + ingredients + steps row, then
 * a real save row carrying a `SaveIntent`.
 *
 * EXTRACTED FROM src/app/import/confirm.tsx ON 10 SEPTEMBER 2026, with
 * editedRecipe.ts and importMealInput.ts, unchanged in behaviour. The
 * three moved together because they are one chain and splitting it in the
 * middle would have left the interesting half unreachable again: vitest
 * cannot import src/app (src/domain/offerablePool.ts's header measured
 * it), so the duplicate check, the order of the two writes and the intent
 * that reaches `saves.intent` were all unassertable where they sat.
 * tests/import/persistImportedMeal.test.ts is what the move buys.
 *
 * IT PERFORMS NO I/O OF ITS OWN AND OWNS NO CLIENT, which is what keeps it
 * under src/domain rather than in the impure shell: the repository is
 * injected, this module calls it and reports. That is exactly
 * src/domain/social/publicVote.ts's arrangement ("The planner is pure.
 * `castPublicVote` performs no I/O of its own: it calls one injected write
 * and reports, which is what makes both halves testable without a
 * database"), and the same sentence is the whole argument for this file.
 */

import { findDuplicateImport } from './duplicateImport.ts';
import { buildMealInput, type ImportMealContext } from './importMealInput.ts';
import type { ParsedRecipe } from './types';
import type { AllergenTagStatus, SaveIntent } from '../types';
import type { RemyRepository } from '../../lib/repository/types';

/**
 * The four reads and writes this path uses, and not the whole repository.
 * Narrowed for `FriendProofSource`'s reason (src/lib/friendProof.ts): a
 * `Pick` is what keeps an import screen's save from ever being able to
 * reach `markSendsSeen`, `deleteMeal` or anything else it has no business
 * touching, and it lets a test hand over four functions instead of
 * impersonating an entire backend.
 */
export type ImportSaveRepository = Pick<
  RemyRepository,
  'getCurrentHouseholdId' | 'listHouseholdMeals' | 'createMeal' | 'createSave'
>;

/**
 * What a save attempt did. A duplicate is NOT an error and must not be
 * reported as one: nothing failed, the household simply already owns this
 * dish, and the outcome they wanted is already true. Modelling it as a
 * third result rather than a thrown error is what keeps it out of the red
 * `danger` line — the same distinction PD-011's `display_only` earns on
 * the screen before the confirmation one.
 */
export type ImportSaveResult = { readonly kind: 'saved' } | { readonly kind: 'duplicate'; readonly title: string };

/**
 * IT STILL TAKES THE INTENT AS A PARAMETER even though exactly one caller
 * passes exactly one value (`IMPORT_DEFAULT_SAVE_INTENT`). Hardcoding it in
 * here would move the product decision out of src/domain/saveIntent.ts,
 * where it is documented and tested, into a helper somewhere else — and
 * until this file existed, into an unexported helper inside a route module
 * no test could reach, which is the arrangement this whole change exists to
 * undo. The parameter is the seam that keeps the decision somewhere it can
 * be read.
 *
 * PD-004a: 'this_week' or 'someday', never 'none'.
 */
export async function persistImportedMeal(
  repository: ImportSaveRepository,
  intent: SaveIntent,
  editedRecipe: ParsedRecipe,
  context: ImportMealContext,
  allergenTags: readonly string[],
  allergenStatus: AllergenTagStatus,
): Promise<ImportSaveResult> {
  const householdId = await repository.getCurrentHouseholdId();
  // The check confirm.tsx's own header has claimed for months. `sourceUrl`
  // really is the deduplication key now, rather than a sentence describing
  // one that was never built — see duplicateImport.ts, which also explains
  // why a null address can never collide with another null.
  //
  // Read here rather than at paste time, deliberately. Catching it earlier
  // would spare a round trip, but it would also mean the paste screen
  // deciding what the library contains, and the whole reason that screen
  // never inspects its own input is that guessing belongs in one layer.
  // This is the layer that already holds a household id.
  const existing = findDuplicateImport(await repository.listHouseholdMeals(householdId), context.sourceUrl);
  if (existing !== null) {
    return { kind: 'duplicate', title: existing.title };
  }
  const mealInput = buildMealInput(editedRecipe, context, householdId, allergenTags, allergenStatus);
  const meal = await repository.createMeal(mealInput);
  await repository.createSave({
    householdId,
    memberId: null,
    mealId: meal.id,
    intent,
    sourceUrl: context.sourceUrl,
  });
  return { kind: 'saved' };
}

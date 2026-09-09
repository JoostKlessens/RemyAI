/**
 * The repository calls behind `Bewaren` on the shared recipe screen —
 * DESIGN-SOCIAL.md §3.3's one reaction, "there is deliberately no lighter
 * one".
 *
 * WHY THIS MODULE EXISTS, and it is sendRecipe.ts's lesson one feature
 * later. `/friends/[feedItemId]` is a route module, and a route module
 * cannot be imported in this test environment — expo-router and
 * react-native internals fail to parse under Vite — so any composition
 * written inside it is composition nothing can assert on. GAP-31 recorded
 * what that costs: `rateRecipe` shipped with two backends, an interface
 * line and zero callers, and an empty Ranglijst everybody read as policy.
 * The wiring lives here, where tests/saveRecipeCopy.test.ts can reach it.
 *
 * IT IS A SHELL, AND EVERY JUDGEMENT IT MAKES BELONGS TO SOMEBODY ELSE.
 * `buildMealCopy` decides what a copy contains — and keeps PD-010's
 * `'unknown'` — `findExistingRecipeCopy` decides whether the household
 * already holds one, the sheet decided the intent. What is new here is only
 * the order of three calls, and the order is the part that matters: read,
 * then copy, then save, so a save row never points at a meal that does not
 * exist yet.
 *
 * TWO REPOSITORIES, AND WHY THE READ AND THE WRITE SIT ON DIFFERENT ONES.
 * A canonical recipe is cross-household by definition, so reading it is
 * `RemySocialRepository`'s (its header explains the split); the copy is
 * this household's own row, so writing it is `RemyRepository`'s, scoped by
 * `householdId` like everything else there. The `Pick`s narrow each to the
 * methods this composition needs — one read on one side, four calls on
 * the other — for `SendAudienceSource`'s reason: a question about a
 * recipe can never grow into a read of anybody's sends, and a write of a
 * meal can never grow into a cook event.
 *
 * REPORTED, NEVER THROWN, exactly like `sendRecipeToFriend`. A refusal
 * here is ordinary — no session, no network, a withdrawn recipe — and the
 * button that asked is the only place it means anything. Three outcomes
 * rather than two because a vanished recipe and a failed write are
 * different sentences on screen: one invites a retry, the other cannot.
 */

import { buildMealCopy, findExistingRecipeCopy } from '@/domain/social/recipeCopy';
import type { RecipeId } from '@/domain/social/types';
import type { SchedulableSaveIntent } from '@/domain/saveIntent';
import type { MealId } from '@/domain/types';
import type { CreateMealInput, RemyRepository } from './repository';
import type { RemySocialRepository } from './repository/social/types';

/** The one read this composition may perform. */
export type RecipeCopySource = Pick<RemySocialRepository, 'getCanonicalRecipe'>;

/** The household-side calls, and no others — see the file header. */
export type RecipeCopySink = Pick<
  RemyRepository,
  'getCurrentHouseholdId' | 'listHouseholdMeals' | 'createMeal' | 'createSave'
>;

export type RecipeCopyOutcome =
  | {
      readonly kind: 'saved';
      readonly mealId: MealId;
      readonly title: string;
      /** False when the household already held this recipe and only the intent was written. */
      readonly isNewCopy: boolean;
    }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'failed' };

/**
 * Copies one canonical recipe into the current household and writes the
 * chosen intent against the copy — or against the copy the household
 * already had, so `Bewaren` twice never stacks two rows in Mijn recepten.
 *
 * The intent is `SchedulableSaveIntent`, not `SaveIntent`: PD-004a's
 * graveyard cannot be written from here even if the sheet ever grows a
 * row for it. `memberId: null` is the same value the import confirmation
 * and the library sheet write — a save belongs to the household.
 */
export async function saveRecipeCopy(
  source: RecipeCopySource,
  sink: RecipeCopySink,
  recipeId: RecipeId,
  intent: SchedulableSaveIntent,
): Promise<RecipeCopyOutcome> {
  try {
    const recipe = await source.getCanonicalRecipe(recipeId);
    if (recipe === null) {
      return { kind: 'not_found' };
    }

    const householdId = await sink.getCurrentHouseholdId();
    const existing = findExistingRecipeCopy(await sink.listHouseholdMeals(householdId), recipe, householdId);
    // The annotation is the seam: `MealCopyInsert` is declared in the
    // domain with its two literals, and this line is where the compiler
    // confirms it is still a `CreateMealInput` the repository accepts.
    const copy: CreateMealInput = buildMealCopy(recipe, householdId);
    const meal = existing ?? (await sink.createMeal(copy));

    await sink.createSave({ householdId, memberId: null, mealId: meal.id, intent, sourceUrl: recipe.sourceUrl });
    return { kind: 'saved', mealId: meal.id, title: meal.title, isNewCopy: existing === null };
  } catch {
    return { kind: 'failed' };
  }
}

/**
 * The last rebuild before the write: an edited `ParsedRecipe` plus the
 * facts only the import route knows, turned into the `CreateMealInput` the
 * repository inserts.
 *
 * EXTRACTED FROM src/app/import/confirm.tsx ON 10 SEPTEMBER 2026 together
 * with editedRecipe.ts, unchanged in behaviour, for the reason that file's
 * header gives: vitest cannot import src/app (src/domain/offerablePool.ts
 * measured it), so this was the one layer in the chain no test could
 * assert. That matters more here than anywhere else in the flow, because
 * BOTH of the field losses recorded below happened at exactly this step —
 * a literal that did not mention a field it had — and a literal is the one
 * shape a type cannot police on its own.
 * tests/import/importMealInput.test.ts is what says the fields survive.
 *
 * Pure: no I/O and no repository. The write is persistImportedMeal.ts's.
 */

import { toMealDraft, type MealDraftInsert } from './toMealDraft.ts';
import type { ImportPlatform, ParsedRecipe } from './types';
import type { AllergenTagStatus, HouseholdId } from '../types';
import type { CreateMealInput } from '../../lib/repository/types';

/**
 * The facts about the IMPORT that the recipe itself cannot carry — the
 * resolved address, the platform, the thumbnail, and the canonical
 * `recipes` row.
 *
 * DECLARED HERE RATHER THAN IMPORTED FROM src/navigation, deliberately.
 * `ImportConfirmParams` satisfies this structurally, so the screen passes
 * its route payload straight in and nothing at the call site changes — but
 * the dependency does not run the other way. src/domain/import is the
 * Deno-reachable graph of supabase/functions/parse-recipe (OPS-09) and an
 * edge function has no router, no screens and no search params;
 * importRouteParams.ts's own header spells out why a URL codec is not
 * domain. This narrow shape is the half of that payload the WRITE needs,
 * and it happens to be `MealDraftContext` minus the household id, with
 * `platform` widened to nullable — which is precisely the branch below.
 */
export interface ImportMealContext {
  readonly sourceUrl: string | null;
  /** `null` means NO ROUTE WAS TAKEN AT ALL — see `buildMealInput`, where that single fact decides the whole write path. */
  readonly platform: ImportPlatform | null;
  readonly thumbnailUrl: string | null;
  readonly recipeId: string | null;
}

/** toMealDraft's steps carry no durationMinutes (cook-mode timers aren't part of import) — CreateMealInput requires the field explicitly, so it's filled in as null here, not omitted. */
function toMealStepInputs(draft: MealDraftInsert): CreateMealInput['steps'] {
  return draft.steps.map((step) => ({ ...step, durationMinutes: null }));
}

/**
 * Overlays the confirmation screen's OWN allergen tagging on top of
 * toMealDraft's always-'unknown'/[] defaults (PD-006: toMealDraft never
 * classifies allergens itself — see its file header). `allergenStatus` is
 * only ever 'verified' here when the user actually tapped "Bevestigen" on
 * AllergenTaggingSection; leaving a meal unconfirmed keeps it 'unknown',
 * exactly like a title-only seeded meal.
 */
function buildMealInputFromDraft(
  draft: MealDraftInsert,
  allergenTags: readonly string[],
  allergenStatus: AllergenTagStatus,
): CreateMealInput {
  return {
    householdId: draft.householdId,
    title: draft.title,
    source: draft.source,
    estimatedMinutes: draft.estimatedMinutes,
    skillLevel: draft.skillLevel,
    servings: draft.servings,
    ingredientTags: allergenTags,
    allergenTagStatus: allergenStatus,
    // The model's dish categories, and the SECOND time the import screen
    // has lost them. `ParsedRecipe.dishTags` was made required so
    // `buildEditedRecipe` could not omit it and `toMealDraft` duly puts it
    // on the draft — then this literal, the last rebuild before the write,
    // did not mention it, because `CreateMealInput.dishTags` is OPTIONAL.
    // Word for word `recipeId`'s sentence below: every layer had the
    // value, and every layer left it out. Only REQUIRING the field stops
    // the third occurrence — a wave-6 decision, recorded not taken.
    dishTags: draft.dishTags,
    sourceUrl: draft.sourceUrl,
    sourcePlatform: draft.sourcePlatform,
    thumbnailUrl: draft.thumbnailUrl,
    // The canonical `recipes` row this import is a household's private
    // copy of. Carried straight off the draft — which took it from the
    // route params, which took it from the function's answer — because
    // this is the field `shared_cooks` (0009) joins a friend's cook to.
    // Dropping it here is how the link stayed unwritten from 0006 until
    // W-01b: every layer had the value, and every layer left it out.
    recipeId: draft.recipeId,
    ingredients: draft.ingredients,
    steps: toMealStepInputs(draft),
  };
}

/**
 * FROM-SCRATCH MANUAL ENTRY — after SRC-08 a narrower set than "an import
 * without a URL", reached only when there is NO ROUTE AT ALL: no platform,
 * so no oEmbed hop, no page GET, no pasted text, nothing ever read. Which
 * keeps the three `null` literals below honest rather than assumed: here
 * `sourceUrl`, `thumbnailUrl` and `recipeId` are not merely absent, they
 * are permanently unavailable. Stating them rather than omitting them is
 * what stops a reader wondering whether they were forgotten — exactly how
 * `recipeId` went unwritten everywhere, and `dishTags` here.
 */
function buildManualMealInput(
  recipe: ParsedRecipe,
  householdId: HouseholdId,
  allergenTags: readonly string[],
  allergenStatus: AllergenTagStatus,
): CreateMealInput {
  return {
    householdId,
    title: recipe.title,
    source: 'saved',
    estimatedMinutes: recipe.estimatedMinutes,
    skillLevel: null,
    servings: recipe.servings,
    ingredientTags: allergenTags,
    allergenTagStatus: allergenStatus,
    // Same drop, same fix as the drafted path. `[]` is what a hand-typed
    // recipe has, but "no categories" and "the writer forgot" were
    // indistinguishable here until this line said which one it is.
    dishTags: recipe.dishTags,
    sourceUrl: null,
    sourcePlatform: null,
    // A from-scratch add has no post to take a thumbnail from, so the
    // library falls back to a monogram tile. Not a rule about manual entry
    // in general: a display-only import (PD-011) is typed by hand too but
    // keeps its image, arrives with a platform, and so drafts instead.
    thumbnailUrl: null,
    // Stated, not omitted: a from-scratch add is a copy of nothing.
    recipeId: null,
    // `section` is deliberately NOT carried here while `toIngredientDrafts`
    // (toMealDraft.ts) does carry it, and the asymmetry is real rather than
    // an oversight: this branch is reached only when nothing was ever read,
    // so every ingredient reaching it was typed by hand and
    // `resolveEditedIngredients` built it as free text with no heading to
    // carry. There is nothing here to lose. It would become a genuine drop
    // the day a route WITH headings could reach this builder — which is the
    // day `platform === null` stops meaning "no route at all".
    ingredients: recipe.ingredients.map((ingredient, index) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      sortOrder: index,
    })),
    steps: recipe.steps.map((instruction, index) => ({ stepNumber: index + 1, instruction, durationMinutes: null })),
  };
}

/**
 * WHICH WRITE PATH — AND THE TEST IS THE PLATFORM, NOT THE URL AND NOT
 * `mode`. This read `sourceUrl !== null && platform !== null`; the extra
 * clause was invisible while every route that had one had the other.
 * SRC-08 separates them: a pasted-text import is a genuine parsed recipe
 * that never had an address, so the old condition dropped it into the
 * manual builder — which hardcodes `recipeId`/`thumbnailUrl` and, until
 * that change, omitted `dishTags`, being written for a caller that
 * provably has none. It would have reached the database stripped of its
 * categories, silently.
 *
 * So the branch tests what `toMealDraft` cannot do without: a nullable
 * `sourceUrl` (widened for this route) and a REQUIRED `platform` it
 * derives `source_platform` from. `platform === null` therefore means
 * something precise — no route taken, nothing fetched or pasted — and that
 * alone is manual entry. `mode` is not consulted: it says which SCREEN the
 * user came through, which is a fact about the journey, not the row.
 */
export function buildMealInput(
  recipe: ParsedRecipe,
  context: ImportMealContext,
  householdId: HouseholdId,
  allergenTags: readonly string[],
  allergenStatus: AllergenTagStatus,
): CreateMealInput {
  const { sourceUrl, platform, thumbnailUrl, recipeId } = context;
  if (platform === null) {
    return buildManualMealInput(recipe, householdId, allergenTags, allergenStatus);
  }
  const draft = toMealDraft(recipe, { householdId, sourceUrl, platform, thumbnailUrl, recipeId });
  return buildMealInputFromDraft(draft, allergenTags, allergenStatus);
}

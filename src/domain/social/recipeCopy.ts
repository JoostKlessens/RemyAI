/**
 * The write path that copies a canonical `recipes` row into a household's
 * own `meals` — DESIGN-SOCIAL.md §3.3's `Bewaren`, and the half GAP-55
 * measured as missing on 8 September 2026: nothing in this codebase turned
 * a `recipes` row into a `meals` row. `toMealDraft` (src/domain/import)
 * copies a freshly PARSED recipe, `mealStub` (src/domain/feed) copies a
 * feed item's title; this copies the shared object that twenty households
 * already hold a private copy of, into a twenty-first kitchen.
 *
 * PURE, NO I/O, exactly like both siblings: it builds the insertable shape
 * and performs no INSERT. Reading the canonical row is
 * `RemySocialRepository.getCanonicalRecipe`'s job, writing the copy is
 * `RemyRepository.createMeal`'s, and composing the two is
 * src/lib/saveRecipeCopy.ts — the impure shell a test can still reach.
 *
 * ============================================================================
 * THE ONE RULE THAT MUST NEVER BREAK (PD-010, PD-006)
 * ============================================================================
 *
 * The copy starts at `allergenTagStatus: 'unknown'` and carries NO allergen
 * tags. A canonical recipe has no allergen column at all — 0006 refuses one
 * on purpose, so there is nothing to inherit even by accident — and
 * `MealCopyInsert.allergenTagStatus` is the LITERAL `'unknown'` rather than
 * the wider `AllergenTagStatus`, so widening it is a compile error, exactly
 * as `MealDraftInsert` and `MealStubInsert` enforce for their paths.
 * `ingredientTags` is likewise a hardcoded `[]` and never derived from the
 * ingredient names, however much "pinda" looks like a tag: a value there
 * REMOVES a meal from somebody's rotation on safety grounds, and a guess
 * from a friend's ingredient list is not a household's own check.
 *
 * Postgres keeps the same promise from the other side —
 * `meals_recipe_copy_starts_unverified` (0006) resets the column on insert
 * for any row carrying a `recipe_id`, whatever the client sent. This module
 * keeps it without being made to, so the local store and every test agree
 * with the database rather than depending on it.
 *
 * ============================================================================
 * `recipeId` IS REQUIRED, AND THAT IS THE POINT OF COPYING
 * ============================================================================
 *
 * `CreateMealInput.recipeId` is optional because most meals are a copy of
 * nothing. A copy of a canonical recipe is the one case where the link is
 * the entire reason for the write: `shared_cooks` (0009) joins a friend's
 * cook to this household's copy on `meals.recipe_id` and nothing else, so
 * without it the copied dish never earns `FRIEND_PROOF_BOOST`, never casts
 * a public vote when it is graded (publicVote.ts), and can never be the
 * closed loop §3.4 describes. The field is therefore required on both the
 * input and the output here — a caller with no id has nothing to copy.
 *
 * ============================================================================
 * ONE COPY PER HOUSEHOLD
 * ============================================================================
 *
 * `findExistingRecipeCopy` is the reason `Bewaren` on a dish the household
 * already keeps does not stack a second row in Mijn recepten. It matches on
 * the canonical id first, and on the source address second — the second
 * catches an import older than W-01b, which stored the URL but never the
 * link. Archived copies do not count (the household removed that dish, so a
 * new save is a new copy), curated meals do not count (they belong to no
 * household), and another household's copy is invisible by construction.
 */

import type { CreatorPlatform } from '../feed/types';
import type { HouseholdId, Meal } from '../types';
import type { RecipeId } from './types';

export interface CopyableRecipeIngredient {
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sortOrder: number;
  /** The source's own sub-recipe heading (0018), or null — carried, never invented. */
  readonly section: string | null;
}

export interface CopyableRecipeStep {
  readonly stepNumber: number;
  readonly instruction: string;
}

/**
 * What a canonical recipe has to offer before it can be copied. Satisfied
 * structurally by `CanonicalRecipe` (src/lib/repository/social/types.ts);
 * stated here in the domain's own words so this module imports nothing
 * from the repository layer.
 */
export interface CopyableRecipe {
  readonly recipeId: RecipeId;
  readonly title: string;
  readonly platform: CreatorPlatform;
  /** `recipes.normalized_url` — becomes the copy's `sourceUrl`, so PD-010.2's original-post link survives the copy. */
  readonly sourceUrl: string;
  readonly thumbnailUrl: string | null;
  readonly estimatedMinutes: number | null;
  readonly servings: number | null;
  readonly dishTags: readonly string[];
  readonly ingredients: readonly CopyableRecipeIngredient[];
  readonly steps: readonly CopyableRecipeStep[];
}

export interface MealCopyIngredientInsert {
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sortOrder: number;
  readonly section: string | null;
}

export interface MealCopyStepInsert {
  readonly stepNumber: number;
  readonly instruction: string;
  /** A canonical recipe carries no timers (0006's `recipe_steps` has no such column), so the copy states none. */
  readonly durationMinutes: null;
}

/**
 * The insertable shape of the copy. Structurally a `CreateMealInput`
 * (src/lib/repository/types.ts) — src/lib/saveRecipeCopy.ts hands it to
 * `createMeal` unchanged — but declared here with the two literals that
 * make the guarantees above compile-time facts rather than defaults.
 */
export interface MealCopyInsert {
  readonly householdId: HouseholdId;
  readonly title: string;
  /** A copy of a shared recipe is a save, matching the existing `MealSource` vocabulary. */
  readonly source: 'saved';
  readonly estimatedMinutes: number | null;
  /** Never inferred — left for a human to set, same as every other saved meal. */
  readonly skillLevel: null;
  readonly servings: number | null;
  /** Always empty — see the file header. */
  readonly ingredientTags: readonly string[];
  /** Literal `'unknown'`, never the wider `AllergenTagStatus` — see the file header. */
  readonly allergenTagStatus: 'unknown';
  readonly dishTags: readonly string[];
  /** Required, unlike `CreateMealInput.recipeId` — see the file header. */
  readonly recipeId: RecipeId;
  readonly sourceUrl: string;
  readonly sourcePlatform: 'tiktok' | 'reels' | null;
  readonly thumbnailUrl: string | null;
  readonly ingredients: readonly MealCopyIngredientInsert[];
  readonly steps: readonly MealCopyStepInsert[];
}

/**
 * `meals.source_platform` (0001) still speaks the two-word vocabulary it
 * was born with — the same bridge `toMealDraft` and `mealStub` apply, and
 * duplicated here for the reason both give: the three copy paths are
 * deliberately decoupled.
 *
 * THE `default` ARM IS REACHABLE, and the type is what lies. 0011 widened
 * `recipes.platform` to `'youtube'` while `CanonicalRecipeSummary.platform`
 * stayed `CreatorPlatform`, so a YouTube row arrives here typed as one of
 * two values and being neither. `null` is the honest column value for it —
 * "this column's vocabulary has no word for this platform", exactly what
 * `toMealDraft` writes for the same import — and a throw on the exhaustive
 * check this codebase usually puts here would crash a save over a fact
 * the type declined to model.
 */
function toMealSourcePlatform(platform: CreatorPlatform): 'tiktok' | 'reels' | null {
  switch (platform) {
    case 'tiktok':
      return 'tiktok';
    case 'instagram':
      return 'reels';
    default:
      return null;
  }
}

function toIngredientInserts(recipe: CopyableRecipe): readonly MealCopyIngredientInsert[] {
  return recipe.ingredients.map((ingredient) => ({
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    sortOrder: ingredient.sortOrder,
    section: ingredient.section,
  }));
}

function toStepInserts(recipe: CopyableRecipe): readonly MealCopyStepInsert[] {
  return recipe.steps.map((step) => ({
    stepNumber: step.stepNumber,
    instruction: step.instruction,
    durationMinutes: null,
  }));
}

/** The copy, as this household's own meal. Pure; see the file header for every literal below. */
export function buildMealCopy(recipe: CopyableRecipe, householdId: HouseholdId): MealCopyInsert {
  return {
    householdId,
    title: recipe.title,
    source: 'saved',
    estimatedMinutes: recipe.estimatedMinutes,
    skillLevel: null,
    servings: recipe.servings,
    ingredientTags: [],
    allergenTagStatus: 'unknown',
    dishTags: recipe.dishTags,
    recipeId: recipe.recipeId,
    sourceUrl: recipe.sourceUrl,
    sourcePlatform: toMealSourcePlatform(recipe.platform),
    thumbnailUrl: recipe.thumbnailUrl,
    ingredients: toIngredientInserts(recipe),
    steps: toStepInserts(recipe),
  };
}

/** What `findExistingRecipeCopy` needs off a meal — a `Meal` satisfies it, and nothing narrower is invented. */
export type ExistingCopyCandidate = Pick<Meal, 'id' | 'title' | 'householdId' | 'recipeId' | 'sourceUrl' | 'archivedAt'>;

/**
 * The household's live copy of this recipe, if it already holds one. See
 * the file header on the two keys and the three exclusions.
 */
export function findExistingRecipeCopy<T extends ExistingCopyCandidate>(
  meals: readonly T[],
  recipe: Pick<CopyableRecipe, 'recipeId' | 'sourceUrl'>,
  householdId: HouseholdId,
): T | null {
  const match = meals.find(
    (meal) =>
      meal.householdId === householdId &&
      meal.archivedAt === null &&
      (meal.recipeId === recipe.recipeId || meal.sourceUrl === recipe.sourceUrl),
  );
  return match ?? null;
}

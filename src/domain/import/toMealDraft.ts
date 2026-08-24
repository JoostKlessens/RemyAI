/**
 * Converts a validated `ParsedRecipe` into the insertable shape for a new
 * `meals` row plus its `meal_ingredients` / `meal_steps` rows — mirroring
 * `src/domain/feed/mealStub.ts`'s `MealStubInsert` pattern (no `id`, no
 * `createdAt`: those are database-generated, and this layer is pure, so
 * it never fabricates them). Pure: no I/O, no Supabase client. The actual
 * INSERT is a repository/glue-layer concern, out of scope here, exactly
 * like `mealStub.ts`'s own module note says of itself.
 *
 * PD-006, the one rule that must never break: this pipeline never
 * classifies allergens. The LLM is asked only for title/ingredients/
 * steps/time/servings (see buildExtractionRequest.ts) — it is never asked
 * to tag an ingredient as containing a given allergen, so there is no
 * inferred allergen data to plumb through here in the first place.
 * `ingredientTags` therefore stays empty and `allergenTagStatus` is the
 * literal `'unknown'` — not the wider `AllergenTagStatus` — so that
 * widening this field to allow `'verified'` is a compile error, exactly
 * as `MealStubInsert.allergenTagStatus` enforces in mealStub.ts. A future
 * change that wants AI-suggested allergen tags (PD-006 permits *suggesting*
 * for human confirmation) must add a clearly separate field for it — it
 * must never flow into `ingredientTags`/`allergenTagStatus`, which is what
 * the decision engine's exclusion filter (src/domain/exclusions.ts) treats
 * as this meal's real, if unverified, data.
 */

import type { HouseholdId } from '../types';
import type { ImportPlatform, ParsedRecipe } from './types';

export interface MealDraftContext {
  readonly householdId: HouseholdId;
  /** The oEmbed-resolved URL actually used (`ImportResult.parsed.sourceUrl`) — carried straight through, never re-derived. */
  readonly sourceUrl: string;
  readonly platform: ImportPlatform;
  /**
   * `ImportAttribution.thumbnailUrl` (buildAttribution.ts), carried
   * straight through — never re-derived or guessed. Null whenever oEmbed
   * itself had no thumbnail to offer (Instagram without credentials, a
   * 404/region-locked post, ...); the library must render a monogram
   * fallback for that case, never a broken image.
   */
  readonly thumbnailUrl: string | null;
}

export interface MealIngredientDraft {
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sortOrder: number;
}

export interface MealStepDraft {
  readonly stepNumber: number;
  readonly instruction: string;
}

export interface MealDraftInsert {
  readonly householdId: HouseholdId;
  readonly title: string;
  /** A pasted-and-parsed recipe is a save, matching the existing `MealSource` vocabulary — no new source value needed. */
  readonly source: 'saved';
  readonly estimatedMinutes: number | null;
  /** Never inferred by this pipeline — left for a human to set, same as any other saved meal. */
  readonly skillLevel: null;
  readonly servings: number | null;
  /** Always empty — see the file header's PD-006 note. */
  readonly ingredientTags: readonly string[];
  /** Literal `'unknown'`, never the wider `AllergenTagStatus` — see the file header. */
  readonly allergenTagStatus: 'unknown';
  readonly sourceUrl: string;
  readonly sourcePlatform: 'tiktok' | 'reels';
  /** See MealDraftContext.thumbnailUrl — carried straight through. */
  readonly thumbnailUrl: string | null;
  readonly ingredients: readonly MealIngredientDraft[];
  readonly steps: readonly MealStepDraft[];
}

/**
 * `meals.source_platform` (0001_init.sql) predates this feature's
 * `'tiktok' | 'instagram'` vocabulary and uses `'reels'` for Instagram —
 * the exact same bridge `mealStub.ts`'s (unexported) `toMealSourcePlatform`
 * applies for Feed saves. Duplicated here rather than imported: the two
 * features are deliberately decoupled (see types.ts's `ImportPlatform`
 * note), and it's three lines.
 */
function toMealSourcePlatform(platform: ImportPlatform): 'tiktok' | 'reels' {
  return platform === 'tiktok' ? 'tiktok' : 'reels';
}

function toIngredientDrafts(recipe: ParsedRecipe): readonly MealIngredientDraft[] {
  return recipe.ingredients.map((ingredient, index) => ({
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    sortOrder: index,
  }));
}

function toStepDrafts(recipe: ParsedRecipe): readonly MealStepDraft[] {
  return recipe.steps.map((instruction, index) => ({
    stepNumber: index + 1,
    instruction,
  }));
}

export function toMealDraft(recipe: ParsedRecipe, context: MealDraftContext): MealDraftInsert {
  return {
    householdId: context.householdId,
    title: recipe.title,
    source: 'saved',
    estimatedMinutes: recipe.estimatedMinutes,
    skillLevel: null,
    servings: recipe.servings,
    ingredientTags: [],
    allergenTagStatus: 'unknown',
    sourceUrl: context.sourceUrl,
    sourcePlatform: toMealSourcePlatform(context.platform),
    thumbnailUrl: context.thumbnailUrl,
    ingredients: toIngredientDrafts(recipe),
    steps: toStepDrafts(recipe),
  };
}

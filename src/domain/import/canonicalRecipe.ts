/**
 * Canonical recipes (Fase 1b): the pure half of "one URL, one recipe."
 *
 * THE PROBLEM THIS SOLVES. Before this, every paste ran the whole
 * pipeline: resolve the short link, call oEmbed, call Gemini, write a
 * fresh `meals` row. One TikTok link imported by twenty households cost
 * twenty oEmbed calls, twenty LLM calls, and produced twenty unrelated
 * rows that no later feature can aggregate a rating across. The `recipes`
 * table (supabase/migrations/0006_canonical_recipes.sql) makes the
 * extraction itself a shared, household-agnostic artifact keyed on
 * `normalized_url`, and this module is the pure mapping in both
 * directions: `ParsedRecipe` -> insertable rows, and a stored row -> the
 * same `ImportResult` a fresh extraction would have produced.
 *
 * ---
 *
 * PD-006, AND WHY IT CANNOT BREAK HERE. A canonical recipe carries no
 * allergen state of any kind: no `allergen_tag_status`, and — unlike
 * `meal_ingredients` in 0001_init.sql — `recipe_ingredients` has no
 * `allergen_tags` column either. That is not an oversight to be tidied up
 * later. Allergen verification is a human act performed by one household
 * for its own members; a `'verified'` earned by household A means A's cook
 * read the ingredients, not that the recipe is safe for B's peanut-
 * allergic child. Sharing that flag across households would serve an
 * allergen to someone who never checked anything.
 *
 * The type system is what enforces this rather than a convention:
 * `RecipeRowInsert` below has no allergen field, so writing one would be a
 * compile error, and `parseStoredRecipe` reconstructs a `ParsedRecipe` — a
 * shape that has never had an allergen field at all. A cache hit therefore
 * flows into `toMealDraft` (whose `allergenTagStatus: 'unknown'` literal is
 * its own compile-time guarantee) with literally nothing to inherit. See
 * toMealDraft.ts's header for the other half of the same argument.
 *
 * `dishTags` is the one piece of model-derived tagging that IS canonical
 * and is stored. It is descriptive and additive (a wrong tag costs a
 * missed search result), where allergen tags are subtractive and safety-
 * relevant (a wrong tag costs someone a reaction). Same separation
 * toMealDraft.ts draws; storing one here is not a precedent for the other.
 *
 * ---
 *
 * WHY THIS FILE SPEAKS snake_case. The row shapes below use literal
 * Postgres column names rather than the camelCase the rest of the domain
 * layer uses. That is deliberate: the alternative is doing the mapping
 * inline in supabase/functions/parse-recipe/index.ts, which is excluded
 * from both `tsc --noEmit` and `npm run lint` because it is Deno code — so
 * a typo'd column name there would be caught by nothing until a PostgREST
 * 400 in production. Keeping the mapping here makes it unit-testable, at
 * the cost of one module knowing the schema's spelling. These names must
 * stay in lockstep with 0006_canonical_recipes.sql.
 *
 * ---
 *
 * WHY A HIT IS RETURNED AS A FULL `ImportResult`, NOT A NARROWER TYPE. The
 * edge function returns whatever comes back from here verbatim, so a
 * deduplicated import is indistinguishable from a fresh one to the client
 * — same `kind: 'parsed'`, same populated `attribution`, same `sourceUrl`.
 * The client's own `parseImportResult` then narrows it with the identical
 * validator either way. Anything narrower would create a second response
 * shape the app would have to learn about, and a second place for the two
 * paths to drift apart.
 *
 * "INDISTINGUISHABLE" NOW INCLUDES THE ROW'S OWN ID (W-01b), and that is
 * the half of deduplication that is about people rather than cost. Saving
 * an oEmbed call and an LLM call is the visible win; joining two
 * households to ONE `recipes` row is the reason the table exists at all,
 * because that shared row is the only thing a friend's cook can be matched
 * against (`shared_cooks` in 0009). So `parseStoredRecipe` reads `id` and
 * puts it on `ImportResult.recipeId`, exactly as the fresh path puts the
 * id its insert returned there — same URL, same id, whichever path served
 * it. A row that arrives without an `id` is rejected as a cache miss
 * rather than served with a null one; see the guard for why the loud
 * failure is the cheap one.
 *
 * THE TRADEOFF WE ARE ACCEPTING. Deduplication makes a bad extraction
 * sticky: once a mediocre parse of a URL is stored, every later importer
 * of that URL gets it, instead of rolling the dice on the model again.
 * That is the actual price of not paying for twenty LLM calls, and it is
 * worth paying — but it is why `parseStoredRecipe` re-validates every
 * stored row through the same `validateParsedRecipe` that guards fresh
 * model output (see below) rather than trusting the database, and why a
 * future "re-extract this recipe" path is the right fix if bad rows
 * accumulate, not weakening the validation here.
 */

import type { ImportAttribution, ImportPlatform, ImportResult, ParsedRecipe } from './types';
import { validateParsedRecipe } from './validateParsed.ts';

/** The `recipes` columns this pipeline writes. `id` and `created_at` are database-generated and deliberately absent — the same reasoning as `MealDraftInsert` in toMealDraft.ts. */
export interface RecipeRowInsert {
  /** THE deduplication key: the post-redirect, normalized URL, unique in the table. See the edge function on why it must be resolved before this is read. */
  readonly normalized_url: string;
  readonly platform: ImportPlatform;
  readonly title: string;
  readonly thumbnail_url: string | null;
  readonly estimated_minutes: number | null;
  readonly servings: number | null;
  readonly author_name: string | null;
  readonly author_url: string | null;
  /** Closed-vocabulary dish categories (src/domain/dishTags.ts). NOT allergen data — see the file header. */
  readonly dish_tags: readonly string[];
}

export interface RecipeIngredientRowInsert {
  readonly recipe_id: string;
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sort_order: number;
}

export interface RecipeStepRowInsert {
  readonly recipe_id: string;
  readonly step_number: number;
  readonly instruction: string;
}

/** Everything about a recipe that comes from the import context rather than the model's answer. */
export interface CanonicalRecipeContext {
  /** The effective (post-short-link-resolution) normalized URL — see `resolveEffectiveUrl` in the edge function. */
  readonly normalizedUrl: string;
  readonly platform: ImportPlatform;
  /** From `buildAttribution`, on the oEmbed payload already fetched to read the caption. Never a second round trip. */
  readonly attribution: ImportAttribution;
}

export function buildRecipeRowInsert(recipe: ParsedRecipe, context: CanonicalRecipeContext): RecipeRowInsert {
  return {
    normalized_url: context.normalizedUrl,
    platform: context.platform,
    title: recipe.title,
    thumbnail_url: context.attribution.thumbnailUrl,
    estimated_minutes: recipe.estimatedMinutes,
    servings: recipe.servings,
    author_name: context.attribution.authorName,
    author_url: context.attribution.authorUrl,
    // `ParsedRecipe.dishTags` is optional only for the object literals that
    // predate it (src/app/import/_fixtures.ts, confirm.tsx — see its own
    // comment in types.ts); `validateParsedRecipe` always populates it.
    // `[]` is the right reading of a missing one — no categories — exactly
    // as `toMealDraft` treats it. Never `undefined`: the column is
    // `not null default '{}'` (0004_dish_tags.sql).
    dish_tags: recipe.dishTags ?? [],
  };
}

/**
 * `sort_order` is 0-based below and `step_number` is 1-based. That is not
 * an inconsistency introduced here — it mirrors `meal_ingredients.
 * sort_order` / `meal_steps.step_number` in 0001_init.sql exactly (and
 * `toMealDraft`'s two draft builders), because the check constraint on
 * `step_number` is `> 0` and diverging from the existing convention would
 * be a worse surprise than the convention itself.
 */
export function buildRecipeIngredientRows(
  recipeId: string,
  recipe: ParsedRecipe,
): readonly RecipeIngredientRowInsert[] {
  return recipe.ingredients.map((ingredient, index) => ({
    recipe_id: recipeId,
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    sort_order: index,
  }));
}

export function buildRecipeStepRows(recipeId: string, recipe: ParsedRecipe): readonly RecipeStepRowInsert[] {
  return recipe.steps.map((instruction, index) => ({
    recipe_id: recipeId,
    step_number: index + 1,
    instruction,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

type NullableStringResult = { readonly ok: true; readonly value: string | null } | { readonly ok: false };

/**
 * A missing/null column is a valid "not stated"; anything present that
 * isn't a string is a malformed row. Deliberately a third local copy
 * alongside validateParsed.ts's `readOptionalString` and
 * parseImportResult.ts's `readNullableString` rather than a shared export:
 * each guards a different trust boundary (model output, server response,
 * database row), and tightening one of them must not silently change the
 * other two.
 */
function readNullableString(value: unknown): NullableStringResult {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false };
  }
  const trimmed = value.trim();
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

/**
 * Re-orders an embedded child collection by its own integer sort column
 * and strips that column off, leaving values for `validateParsedRecipe` to
 * narrow.
 *
 * Sorting here rather than relying on an `order=` parameter in the
 * PostgREST query is on purpose: an unordered SQL result set has no
 * guaranteed row order, so a caller that forgets the parameter would
 * produce a recipe whose steps are silently shuffled — a failure that
 * looks like a working import and is invisible in every test of the query.
 * This module cannot forget.
 *
 * A child row missing its sort key fails the whole read (returns `null`)
 * rather than defaulting to 0 and guessing an order. Guessing here would
 * mean serving someone instructions in the wrong sequence.
 */
function readSortedChildren(
  raw: unknown,
  sortKey: string,
  project: (row: Record<string, unknown>) => unknown,
): readonly unknown[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const entries: { readonly order: number; readonly value: unknown }[] = [];
  for (const item of raw) {
    if (!isRecord(item)) {
      return null;
    }
    const order = item[sortKey];
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      return null;
    }
    entries.push({ order, value: project(item) });
  }
  return [...entries].sort((left, right) => left.order - right.order).map((entry) => entry.value);
}

function readAttribution(row: Record<string, unknown>): ImportAttribution | null {
  const authorName = readNullableString(row.author_name);
  const authorUrl = readNullableString(row.author_url);
  const thumbnailUrl = readNullableString(row.thumbnail_url);
  if (!authorName.ok || !authorUrl.ok || !thumbnailUrl.ok) {
    return null;
  }
  return { authorName: authorName.value, authorUrl: authorUrl.value, thumbnailUrl: thumbnailUrl.value };
}

function isImportPlatform(value: unknown): value is ImportPlatform {
  return value === 'tiktok' || value === 'instagram' || value === 'youtube';
}

/**
 * Turns one stored `recipes` row (with `recipe_ingredients` and
 * `recipe_steps` embedded, as PostgREST returns them) back into the
 * `parsed` result a fresh extraction would have produced — or `null`,
 * which the caller must treat as a plain cache MISS and re-run the
 * pipeline for.
 *
 * WHY NULL IS A MISS AND NOT AN ERROR. Everything this can reject is
 * either a corrupt row or one written by an older version of this schema.
 * Failing the user's import over that would punish them for our storage
 * problem; falling through to oEmbed + the model costs one extraction and
 * produces a correct answer. The only lasting cost is that such a row is
 * re-extracted on every import of that URL (the upsert will not replace
 * it), which is a loud, cheap-to-notice symptom rather than a silently
 * half-populated recipe.
 *
 * The content itself is re-validated by `validateParsedRecipe` — the SAME
 * function that guards fresh model output — rather than a looser,
 * database-flavoured check. A row is untrusted input like any other:
 * "written by the service role" is not the same claim as "still satisfies
 * the domain's rules", and those rules can tighten (a narrowed dish-tag
 * vocabulary, a stricter numeric bound) after a row was already stored.
 * One validator means the two paths cannot disagree about what a valid
 * recipe is.
 */
export function parseStoredRecipe(raw: unknown): ImportResult | null {
  if (!isRecord(raw)) {
    return null;
  }

  // A `recipes` row always has an id — it is the primary key — so a row
  // without one means the SELECT forgot to ask for it. Failing the row is
  // the loud version of that mistake: the URL simply stops benefiting from
  // deduplication until someone notices the extra extractions. The quiet
  // version — returning the recipe with a null `recipeId` — is strictly
  // worse and is the exact bug W-01 was: every importer of that URL gets a
  // meal linked to no canonical row, no friend's cook can ever match it,
  // and nothing anywhere reports a problem.
  if (!isNonEmptyString(raw.id)) {
    return null;
  }

  if (!isNonEmptyString(raw.normalized_url) || !isImportPlatform(raw.platform)) {
    return null;
  }

  const ingredients = readSortedChildren(raw.recipe_ingredients, 'sort_order', (row) => ({
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
  }));
  const steps = readSortedChildren(raw.recipe_steps, 'step_number', (row) => row.instruction);
  if (ingredients === null || steps === null) {
    return null;
  }

  const attribution = readAttribution(raw);
  if (attribution === null) {
    return null;
  }

  // Reassembled into the domain's own camelCase shape first, so the shared
  // validator sees exactly what it sees on the model path.
  const recipe = validateParsedRecipe({
    title: raw.title,
    ingredients,
    steps,
    estimatedMinutes: raw.estimated_minutes,
    servings: raw.servings,
    dishTags: raw.dish_tags,
  });
  if (recipe === null) {
    return null;
  }

  return {
    kind: 'parsed',
    recipe,
    // THE POINT OF THE CACHE, for the social half of the product. The
    // stored row's own primary key is what makes a hit worth more than
    // saved tokens: it hands the twentieth household the SAME canonical
    // recipe the first one created, which is the only object their two
    // cooks can be joined on (`shared_cooks`, 0009). Read off the row,
    // never derived from `normalized_url` below — that column is this
    // row's deduplication KEY, not its identity, and the two are not
    // interchangeable.
    recipeId: raw.id.trim(),
    // The deduplication key IS the source URL — by construction the same
    // normalized, post-redirect URL the original import resolved.
    sourceUrl: raw.normalized_url.trim(),
    platform: raw.platform,
    // Always populated, never omitted: the fresh path always calls
    // `buildAttribution`, so a hit that left this undefined would be a
    // visible difference between the two paths for no reason.
    attribution,
  };
}

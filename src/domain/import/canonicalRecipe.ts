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
 * "INDISTINGUISHABLE" ALSO NOW INCLUDES PROVENANCE (RCP-06), and that one
 * is the uncomfortable one, because unlike `id` and `attribution` it is
 * not stored anywhere. `ImportResult.parsed` requires a `RecipeProvenance`
 * — the publisher's own structured data, or a model's reading of prose —
 * and the `recipes` table has no column for it. So the cache path DEDUCES
 * it from what `canStoreCanonicalRecipe` permits, which is sound today and
 * stops being sound the moment that guard widens. That whole argument, and
 * the warning attached to it, lives on `STORED_ROW_PROVENANCE` below.
 *
 * TWO OF THE FIVE PLATFORMS GET NONE OF THIS, FOR TWO DIFFERENT REASONS,
 * AND THE DIFFERENCE MATTERS MORE THAN THE COUNT. `recipes.platform`
 * accepts `'tiktok'`, `'instagram'` and — since migration 0011 —
 * `'youtube'`. A WEB import still cannot be stored and permanently reports
 * `recipeId: null`: no deduplication, and no `shared_cooks` join, which is
 * the social half of everything argued above. That is a CEILING and it is
 * now a deliberate one: 0011 was applied in its conservative form because a
 * publisher edits a page under a row we cached, where a video description
 * is frozen. `canStoreCanonicalRecipe` below states what lifting it costs.
 *
 * `'text'` is excluded by something no migration can lift. Every argument
 * on this page rests on `normalized_url`: it is the deduplication key, it
 * is what makes the twentieth household's paste find the first
 * household's row, and it is `unique` in the table. A pasted-text import
 * has no URL — the user pasted a recipe, not a link — so there is no key
 * to store it under and nothing for a later import to match against. Two
 * people who paste the same recipe out of the same WhatsApp group are not
 * even in principle recognisable as having done so, because the only
 * thing this table can compare is an address neither of them has. So
 * `'text'` is not waiting on a decision the way web is; it is outside what
 * this table can express.
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

import type { ImportAttribution, ImportPlatform, ImportResult, ParsedRecipe, RecipeProvenance } from './types';
import { validateParsedRecipe } from './validateParsed.ts';

/** The `recipes` columns this pipeline writes. `id` and `created_at` are database-generated and deliberately absent — the same reasoning as `MealDraftInsert` in toMealDraft.ts. */
export interface RecipeRowInsert {
  /** THE deduplication key: the post-redirect, normalized URL, unique in the table. See the edge function on why it must be resolved before this is read. */
  readonly normalized_url: string;
  /** Typed as the full `ImportPlatform`, but the COLUMN accepts only three of its members — call `canStoreCanonicalRecipe` before building a row, and read that function for why `'web'` is still outside and `'text'` can never be inside. */
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

/**
 * The platforms the `recipes` table will actually accept a row for. Not a
 * preference — a mirror of a database constraint:
 *
 *   platform text not null check (platform in ('tiktok', 'instagram', 'youtube'))
 *      — supabase/migrations/0011_canonical_recipes_platform_widening.sql,
 *        which replaced 0006's two-member CHECK
 *
 * The column is NOT NULL, so there is no "leave it blank" escape either: a
 * `'web'` canonical row is not undesirable, it is REJECTED, and the INSERT
 * fails. Defined here as "the values that CHECK accepts",
 * deliberately not as "the platforms we want to cache" — if the two ever
 * diverge, this constant is wrong and the fix is to reread the migration,
 * not to relitigate the product question.
 *
 * WHAT THIS STILL COSTS, STATED PLAINLY BECAUSE IT IS NOT A DETAIL. A WEB
 * import returns `recipeId: null`, permanently. That means it deduplicates
 * against nothing — the twentieth household to import the
 * same food blog pays the same fetch and gets its own unrelated meal — and
 * it means the social layer can never fire for it: `shared_cooks` (0009)
 * joins two households on a shared `recipes` row, and
 * `FRIEND_PROOF_BOOST` (src/domain/scoring.ts) is computed from that join.
 * A web-imported dinner therefore cannot be proof to a friend, however
 * many friends cook it. That is a real product hole, not a rough edge.
 *
 * WHAT WOULD LIFT IT, AND WHY IT WAS NOT LIFTED. One migration, adding
 * `'web'` to the list 0011 already widened:
 *
 *   alter table public.recipes drop constraint recipes_platform_check;
 *   alter table public.recipes add constraint recipes_platform_check
 *     check (platform in ('tiktok', 'instagram', 'youtube', 'web'));
 *
 * 0011 deliberately stopped one member short of that. A video description
 * is frozen; a web page is edited under us, so a row cached in March and
 * served in November hands a household a recipe the publisher has since
 * corrected, with no signal that it is stale. Adding `'web'` means first
 * answering that — never re-fetch, re-fetch after N days, or re-fetch and
 * mark superseded — AND changing `STORED_ROW_PROVENANCE` below, which would
 * otherwise report a publisher's own structured data as a model's reading
 * of prose on the same day.
 *
 * ⚠ `'text'` IS ABSENT FROM THAT LIST ON PURPOSE AND MUST STAY ABSENT.
 * Whoever eventually writes this migration will be reading a five-member
 * `ImportPlatform` and the obvious move is to paste all five in. It would
 * not be a widening, it would be a broken table: `normalized_url` is
 * `not null unique` and a pasted-text import has no URL to put there, so
 * every such row would either fail the insert or — far worse — be given a
 * synthesised key, at which point the second person to paste any recipe
 * would silently receive the first person's. The exclusion of `'text'`
 * from this table is structural, not a policy waiting to be revisited.
 *
 * ⚠ AND THAT MIGRATION CANNOT SHIP ALONE. `STORED_ROW_PROVENANCE` further
 * down this file reports every stored row as `'model_from_caption'`, and
 * it is allowed to do so ONLY because this constant permits nothing but
 * TikTok in practice (Instagram being display-only). Widen the CHECK
 * without changing that line and a web import's cache hit will tell the
 * user a publisher-written recipe was a model's reading of prose. Read
 * that constant's comment before running the SQL above; the two changes
 * belong in one commit.
 *
 * WRITING THAT MIGRATION IS DELIBERATELY OUT OF THIS CHANGE'S SCOPE AND IS
 * THE OWNER'S CALL. It is not a mechanical widening: making a web page's
 * extraction a shared, cross-household artifact is a decision about what
 * `recipes` is for, and it drags in questions this change has no standing
 * to answer — whether a page whose content can change under us should be
 * cached indefinitely (a video's caption is frozen; a blog post is
 * edited), and whether a `'web'` row's `author_url` is attribution of the
 * same kind PD-007 means. Until someone answers those, the honest code is
 * code that degrades rather than code that pretends.
 *
 * WHY NOT JUST ATTEMPT THE INSERT AND LET IT FAIL? Because a
 * guaranteed-to-fail write is worse than no write in every dimension that
 * matters here. It spends a round trip to learn something this function
 * knows for free; it puts a real Postgres constraint violation in the logs
 * of every single YouTube and web import, which trains whoever reads those
 * logs to ignore constraint violations; and the `recipeId: null` the user
 * ends up with is identical either way — so the only thing the failed
 * INSERT adds is noise that looks like a bug. Not attempting it says the
 * same thing quietly and truthfully: this platform has no canonical row,
 * by construction.
 */
const STORABLE_CANONICAL_PLATFORMS: ReadonlySet<ImportPlatform> = new Set<ImportPlatform>([
  'tiktok',
  'instagram',
  // Added with migration 0011, and NOT the mechanical widening the comment
  // above warned about. Two facts had to hold before this member could be
  // listed, and both are worth naming here because the day either stops
  // being true is the day this line has to move again:
  //
  //  1. A YOUTUBE DESCRIPTION IS FROZEN, exactly as a caption is. So the
  //     staleness argument that keeps `'web'` out — a publisher edits the
  //     page under a row we cached in March — simply does not apply. This
  //     is the whole reason 0011 shipped in its conservative form.
  //  2. YOUTUBE IS A CAPTION ROUTE. resolveYouTubeImport.ts hands the Data
  //     API description to the same shared tail TikTok's caption goes to,
  //     and states `provenance: 'model_from_caption'` while doing it. That
  //     is what keeps `STORED_ROW_PROVENANCE` below a deduction rather than
  //     a lie — see its comment, which is the thing to read before adding a
  //     fourth member here.
  'youtube',
]);

/**
 * DELIBERATELY UNCHANGED BY SRC-08, WHICH IS WORTH ONE LINE BECAUSE THE
 * SILENCE COULD BE READ AS AN OVERSIGHT. `'text'` is refused by this set
 * for free — a `Set` excludes by default, so a new union member needs no
 * edit here to be rejected — and that default happens to be the right
 * answer for exactly the reason given above: there is no normalized URL to
 * key a canonical row on. The set is opt-in and stays opt-in; the day
 * somebody widens it, `'text'` must not be the member they wave through
 * because it was easier than reading why the other four are listed.
 */

export function canStoreCanonicalRecipe(platform: ImportPlatform): boolean {
  return STORABLE_CANONICAL_PLATFORMS.has(platform);
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
    // Straight through, with no `?? []` in front of it any more.
    // `ParsedRecipe.dishTags` is now a REQUIRED field (types.ts), so
    // "the recipe forgot to state its categories" is no longer a state
    // that can reach this function — the coalesce that used to stand here
    // was defending against object literals the type has since made
    // impossible. An empty list still arrives, often, and is written as
    // one: the column is `not null default '{}'` (0004_dish_tags.sql), so
    // `[]` and "no categories" are the same row either way.
    dish_tags: recipe.dishTags,
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

/**
 * The third independent copy of the import platform vocabulary — one per
 * trust boundary, exactly like the three copies of `readNullableString`
 * this directory keeps (see that function's own note). This one guards a
 * DATABASE ROW; parseImportResult.ts's guards an HTTP response, and
 * routeParams.ts's guards a router param.
 *
 * Derived from an exhaustive `Record` rather than written as a chain of
 * `===` comparisons, and the change is not cosmetic: the chain compiled
 * happily while missing a member, so widening the union meant finding
 * every such list by hand — and the widening before this one missed two of
 * them, leaving a live bug in routeParams.ts. A `Record<ImportPlatform,
 * true>` cannot be missing a key. The next member added to the union
 * breaks this file's build instead of quietly rejecting rows.
 *
 * Note this is NOT the same question as `canStoreCanonicalRecipe` above,
 * and the two must not be collapsed. This asks "is this string one of our
 * platforms" (a vocabulary check, five members); that asks "will the
 * `recipes` CHECK constraint accept it" (a schema fact, two members). A
 * stored row naming `'web'` is a row from a future in which that migration
 * was written — reading it back is correct; writing it today is not.
 */
const PLATFORM_MEMBERS: Readonly<Record<ImportPlatform, true>> = {
  tiktok: true,
  instagram: true,
  youtube: true,
  web: true,
  // Present because this is a VOCABULARY check and `'text'` is in the
  // vocabulary — not because such a row can exist. It cannot: the CHECK
  // constraint refuses it, and more permanently, a row here needs a
  // `normalized_url` that a pasted-text import does not have, so nothing
  // could ever look one up even if it were somehow written. Keeping the
  // key is still right. This function answers "is this string one of our
  // routes", and quietly answering "no" for a real member would be a
  // second, hidden storability rule pretending to be a spelling check —
  // exactly the collapse the note above warns against.
  text: true,
};

function isImportPlatform(value: unknown): value is ImportPlatform {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLATFORM_MEMBERS, value);
}

/**
 * RCP-06 on the cache path. `parseStoredRecipe` returns a `parsed`
 * result, and `provenance` is required on that shape — so a cache hit has
 * to answer "was this the publisher's own structured data, or a model
 * reading prose?" for a row that does not record the answer.
 *
 * THE CHAIN THAT MAKES `'model_from_caption'` A DEDUCTION AND NOT A
 * GUESS. It is three links, all of them already in this file:
 *
 *  1. `canStoreCanonicalRecipe` above permits exactly `'tiktok'`,
 *     `'instagram'` and `'youtube'`, mirroring 0011's CHECK constraint. A
 *     `'web'` row cannot be inserted; the write is never attempted. Nor can
 *     a `'text'` one, and that member strengthens rather than threatens
 *     this chain: it is refused by the table's shape (no URL, no key)
 *     rather than by a constraint someone might widen, so it cannot arrive
 *     here even in the future this warning is about.
 *  2. Instagram is display-only (PD-011, displayOnlyPolicy.ts). An
 *     Instagram import returns `display_only` and never reaches a
 *     `ParsedRecipe`, so it never reaches a canonical write either.
 *  3. That leaves TikTok and YouTube, AND BOTH ARE CAPTION ROUTES. TikTok
 *     sends an oEmbed caption to the model; YouTube sends a Data API
 *     description to the very same shared tail, stating `provenance:
 *     'model_from_caption'` as it goes (resolveYouTubeImport.ts). Link 3
 *     is the one 0011 could have broken and did not — which is exactly
 *     why 0011 stopped short of `'web'`, whose route produces
 *     `'publisher_structured_data'` instead.
 *
 * Every row that can exist in `recipes` today therefore came from the
 * caption pipeline. This constant reports that, and reports nothing the
 * row did not earn.
 *
 * ⚠ AND IT IS AN INFERENCE FROM A GUARD, NOT A STORED FACT. That is the
 * fragile part and it should be read as fragile. Nothing in the database
 * says how a row was extracted; this line says it on the database's
 * behalf, and it is true only for exactly as long as link 1 holds. WIDEN
 * `canStoreCanonicalRecipe` — which is precisely what the pending
 * `recipes.platform` migration written out in that function's own doc
 * comment would do — AND THIS LINE BECOMES A LIE ON THE SAME DAY: a
 * stored `'web'` row came from a page's JSON-LD and is
 * `'publisher_structured_data'`, and reporting it as a model's reading
 * would tell a user their publisher-written recipe was interpreted by
 * software. It must change in the same commit as that migration, into a
 * per-platform mapping, or into a real column.
 *
 * `parseStoredRecipe` deliberately still READS rows for any platform in
 * the vocabulary (`isImportPlatform` above says why), which sharpens rather
 * than softens the warning: the day a widened constraint lets such a row
 * be written, this file will happily read it back and mislabel it.
 * Nothing here fails loudly. Only this comment stands between that and a
 * shipped falsehood.
 */
const STORED_ROW_PROVENANCE: RecipeProvenance = 'model_from_caption';

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

  // A row naming the pasted-text route is refused, and this is the one
  // platform refused HERE rather than only at the write gate. The contrast
  // with `'web'` two paragraphs up is the whole reason: a stored `'web'`
  // row is merely impossible TODAY, so reading one back is how the first
  // day after that migration works instead of silently missing the cache.
  // A stored `'text'` row is INCOHERENT in any future. Every row in this
  // table has a `normalized_url` — it is `not null unique` and it is the
  // only thing a lookup can be keyed on — and a pasted-text import has no
  // URL at all. Such a row could only have been written by giving one a
  // URL it does not have, and serving it would hand the reader a
  // `parsed` result whose platform says "no source" while its `sourceUrl`
  // names one; `parseImportResult` rejects exactly that pairing on the
  // wire (see `readSourceUrl`), so accepting it here would put the two
  // boundaries into disagreement about what a valid result is. Treated as
  // a corrupt row, which this module already has one answer for: a cache
  // MISS, re-extract, no user harmed.
  if (raw.platform === 'text') {
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
    // NOT READ OFF THE ROW — there is no such column, and adding one is a
    // migration this change does not write. Deduced instead, from what
    // the storability guard already permits. See
    // `STORED_ROW_PROVENANCE` above for the three-link chain and for the
    // warning about the one change that breaks it.
    provenance: STORED_ROW_PROVENANCE,
  };
}

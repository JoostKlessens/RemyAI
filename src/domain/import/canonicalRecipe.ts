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
 * and the `recipes` table has no column for it. So the cache path DEDUCES it,
 * PER PLATFORM, in `STORED_ROW_PROVENANCE` below.
 *
 * THAT DEDUCTION USED TO BE ONE CONSTANT RESTING ON A PARAGRAPH, and SRC-07
 * turned it into a table over the whole union: the same file answering the
 * same question in a form the compiler can hold it to, rather than one a
 * reader has to re-verify. The argument for the change, and each platform's
 * answer, is on that constant.
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
 * corrected, with no signal that it is stale. Adding `'web'` still means
 * answering that first — never re-fetch, re-fetch after N days, or re-fetch
 * and mark superseded.
 *
 * THE SECOND HALF OF THAT SENTENCE IS DISCHARGED AS OF SRC-07. It used to
 * read "AND changing `STORED_ROW_PROVENANCE` below, which would otherwise
 * report a publisher's own structured data as a model's reading of prose on
 * the same day". That constant is now a table over every platform and already
 * answers `'publisher_structured_data'` for `'web'`, so the migration above
 * no longer drags a second, easily-forgotten edit along behind it. What
 * remains is a genuine product question about staleness — which is the part
 * that always deserved the owner's attention rather than a reader's memory.
 *
 * ⚠ `'text'` AND `'photo'` ARE ABSENT FROM THAT LIST ON PURPOSE AND MUST
 * STAY ABSENT. Whoever eventually writes this migration will be reading a
 * six-member `ImportPlatform` and the obvious move is to paste all six in. It
 * would not be a widening, it would be a broken table: `normalized_url` is
 * `not null unique`, and neither a pasted-text import nor a photographed one
 * has a URL to put there, so every such row would either fail the insert or —
 * far worse — be given a synthesised key, at which point the second person to
 * paste or photograph any recipe would silently receive the first person's.
 * The exclusion of both is structural, not a policy waiting to be revisited.
 *
 * `'photo'` (SRC-07) IS THE SAME CASE AS `'text'`, NOT MERELY A SIMILAR ONE,
 * and that is worth saying because the temptation with a photograph is to
 * reach for a content hash as the missing key. That is a different
 * deduplication scheme with different questions hanging off it — two
 * photographs of one page are not the same bytes — and it is the owner's to
 * take deliberately, exactly as the same suggestion for pasted text is.
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
 * DELIBERATELY UNCHANGED BY SRC-08 AND AGAIN BY SRC-07, WHICH IS WORTH A LINE
 * BECAUSE THE SILENCE COULD TWICE HAVE BEEN READ AS AN OVERSIGHT. `'text'`
 * and `'photo'` are both refused by this set for free — a `Set` excludes by
 * default, so a new union member needs no edit here to be rejected — and that
 * default happens to be the right answer for exactly the reason given above:
 * neither route has a normalized URL to key a canonical row on.
 *
 * THE SET IS OPT-IN AND STAYS OPT-IN. The day somebody widens it, neither of
 * those two may be the member they wave through because it was easier than
 * reading why the others are listed. Note also that this free default is the
 * WEAKER of the two protections each route has: `STORED_ROW_PROVENANCE` below
 * now refuses both explicitly, by name, in a table that does not compile
 * without them. Deliberate belt and braces, on the one mistake in this file
 * that would hand one household another household's recipe.
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
  // SRC-07, and present for exactly `'text'`'s reason, which is worth
  // saying because the two are the same case rather than two similar ones:
  // a photographed recipe has no URL either, so no row can be keyed under
  // it and none can ever be read back. Listed anyway, because this is a
  // spelling check over the vocabulary and `'photo'` is in the vocabulary.
  photo: true,
};

function isImportPlatform(value: unknown): value is ImportPlatform {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLATFORM_MEMBERS, value);
}

/**
 * RCP-06 on the cache path. `parseStoredRecipe` returns a `parsed` result,
 * and `provenance` is required on that shape — so a cache hit has to answer
 * "was this the publisher's own structured data, or a model reading prose?"
 * for a row that does not record the answer.
 *
 * ---
 *
 * THIS WAS A SINGLE CONSTANT — `const STORED_ROW_PROVENANCE: RecipeProvenance
 * = 'model_from_caption'` — AND SRC-07 IS WHERE IT STOPPED BEING TENABLE. Its
 * own comment carried a ⚠ warning saying it was "an inference from a guard,
 * not a stored fact", true only for as long as `canStoreCanonicalRecipe`
 * permitted nothing but caption routes, and that it "must change in the same
 * commit as that migration, into a per-platform mapping, or into a real
 * column". This is that per-platform mapping, taken early.
 *
 * IT WAS NOT ACTUALLY WRONG YET, AND THAT IS THE INTERESTING PART. Every row
 * that can exist in `recipes` today really did come from the caption
 * pipeline: 0011's CHECK permits only TikTok, Instagram and YouTube;
 * Instagram is display-only, so it never produces a `ParsedRecipe` to store;
 * and TikTok and YouTube both run the shared caption tail. The pasted-text
 * route did not break it either, for the reason `canStoreCanonicalRecipe`'s
 * own note gives — `recipes` is keyed on `normalized_url`, a paste has no
 * URL, so no such row can be written — and `parseStoredRecipe` refused one
 * outright if somehow one were.
 *
 * SO WHY CHANGE IT NOW. Because the argument keeping it true was A PARAGRAPH,
 * verified by whoever last read the paragraph, and SRC-07 is the second route
 * in a row to arrive whose only protection was that same paragraph being
 * re-read in time. `'photo'` is one more URL-less route, refused by one more
 * hand-written `=== 'text'` comparison three hundred lines away from the
 * constant that depends on it. Two facts held apart by prose is exactly the
 * arrangement pastedTextLimits.ts's header calls out as describing a problem
 * accurately and solving none of it: "an obligation written in prose is
 * discharged by whoever happens to read the prose."
 *
 * A `Record` OVER THE WHOLE UNION DISCHARGES IT MECHANICALLY. The next
 * platform added to `ImportPlatform` fails to compile here until somebody
 * states what a stored row of it would mean — which is precisely the decision
 * the old ⚠ asked a future reader to remember to make. It also lets the
 * `'web'` answer be written AHEAD of the migration that would permit such
 * rows, so widening 0011's CHECK becomes a one-line SQL change that cannot
 * silently relabel a publisher's own structured recipe as a model's reading
 * of prose. The two changes no longer have to ship together, because the
 * second one is already here.
 *
 * `null` MEANS "A STORED ROW OF THIS PLATFORM CANNOT BE READ BACK", which is
 * a stronger statement than the absence it looks like — not "unknown
 * provenance". `parseStoredRecipe` treats it as a corrupt row and therefore
 * as a cache MISS: re-extract, nobody harmed, the answer this module already
 * has for every other unreadable row. The two members carrying it are the two
 * with no URL, and they are refused HERE, by one table and one rule, rather
 * than by a separate guard somebody has to remember to widen.
 */
const STORED_ROW_PROVENANCE: Readonly<Record<ImportPlatform, RecipeProvenance | null>> = {
  // The original caption route: an oEmbed caption, read by the model.
  tiktok: 'model_from_caption',
  // Rows written BEFORE PD-011 made Instagram display-only. No new one can be
  // created — an Instagram import now returns `display_only` and never
  // reaches a `ParsedRecipe` — but an old row is still readable, and it
  // genuinely was caption-derived when it was written. Reporting that is
  // reporting history accurately.
  //
  // Whether such a row may be SERVED at all is a different question, answered
  // somewhere else on purpose: index.ts takes the display-only branch BEFORE
  // the cache lookup, precisely so that no caption-derived Instagram row can
  // be handed back (PD-011). This table says what a row means; that ordering
  // says whether anyone is allowed to see it.
  instagram: 'model_from_caption',
  // Added with 0011. The Data API description goes to the very same shared
  // tail TikTok's caption goes to, stating `model_from_caption` as it goes
  // (resolveYouTubeImport.ts) — so this is that route's own answer repeated,
  // not an inference about it.
  youtube: 'model_from_caption',
  // NO ROW CAN CARRY THIS TODAY — 0011's CHECK refuses `'web'`, so the write
  // is never attempted (`canStoreCanonicalRecipe`). Stated anyway, and that is
  // the whole point of converting a constant into a table: a web recipe comes
  // from a page's own JSON-LD with no model in the loop at all, so a stored
  // one is `publisher_structured_data`. Saying so before such a row can exist
  // costs nothing and removes the trap the old ⚠ was standing guard over.
  web: 'publisher_structured_data',
  // Unreadable, permanently, and not because of a constraint anyone could
  // lift. Every row in `recipes` has a `not null unique normalized_url` — the
  // only thing a lookup can be keyed on — and a pasted-text import has no URL
  // at all. Such a row could only exist by having been given a URL it does
  // not have, and serving it would hand back a `parsed` result whose platform
  // says "no source" while its `sourceUrl` names one; `parseImportResult`
  // rejects exactly that pairing on the wire (see `readSourceUrl`), so
  // accepting it here would put the two boundaries into disagreement about
  // what a valid result even is.
  text: null,
  // SRC-07, and the identical case rather than a similar one: a photographed
  // recipe has no URL either. It arrives at this table by the same road as the
  // line above and is refused by the same rule — which is the argument for the
  // table in miniature. `'photo'` needed no new guard, no new branch and no
  // new paragraph to be excluded correctly, only a key it could not compile
  // without.
  photo: null,
};

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

  // WHAT A STORED ROW OF THIS PLATFORM WOULD MEAN, ASKED ONCE, HERE.
  //
  // This used to read `if (raw.platform === 'text') return null;` — a
  // hand-written refusal of the one route that could not coherently have a
  // row, sitting three hundred lines away from the constant whose
  // correctness depended on it. `STORED_ROW_PROVENANCE` is now a table over
  // the whole union, so the same question is answered in one place for every
  // platform and a new one cannot be forgotten in either half.
  //
  // `null` HERE IS A CACHE MISS AND NOT AN ERROR, on this function's standing
  // rule: everything it can reject is a corrupt row or one written by another
  // schema, and failing a user's import over our storage problem is worse
  // than re-extracting. The two members answering `null` today are the two
  // with no URL — `'text'` and, since SRC-07, `'photo'`. Such a row could
  // only have been written by giving it a `normalized_url` it does not have,
  // and serving it would hand back a `parsed` result whose platform says "no
  // source" while its `sourceUrl` names one; `parseImportResult` rejects
  // exactly that pairing on the wire (see `readSourceUrl`), so accepting it
  // here would put the two boundaries into disagreement about what a valid
  // result is.
  //
  // NOTE THE DELIBERATE CONTRAST WITH `'web'`, which does NOT answer `null`:
  // a stored `'web'` row is merely impossible TODAY (0011's CHECK), so
  // reading one back is how the first day after that migration works, instead
  // of silently missing the cache on every hit.
  const provenance = STORED_ROW_PROVENANCE[raw.platform];
  if (provenance === null) {
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
    // migration this change does not write. Deduced instead, PER PLATFORM,
    // from what that route can have produced. See `STORED_ROW_PROVENANCE`
    // above for each answer and for why it is a table rather than the single
    // constant it used to be. Already narrowed to non-null by the guard at
    // the top of this function, which is the same lookup: one table decides
    // both whether a row is readable and what it means.
    provenance,
  };
}

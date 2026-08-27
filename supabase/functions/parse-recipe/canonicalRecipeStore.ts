/**
 * ---------------------------------------------------------------------------
 * CANONICAL RECIPE DEDUPLICATION (Fase 1b) — the store itself
 * ---------------------------------------------------------------------------
 *
 * Every read and write of the three canonical tables from
 * 0006_canonical_recipes.sql, and nothing else. index.ts calls exactly two
 * of these — `findStoredRecipe` before it spends anything, and
 * `storeCanonicalRecipe` after it has — and the race handling, the
 * PostgREST filter rules and the service role key stay behind that pair.
 *
 * WHY IT IS ITS OWN FILE. It was a section inside index.ts, which had grown
 * past this repo's 800-line ceiling; splitting on cohesion rather than on
 * length is what decided the cut. Two things make this the seam. First, the
 * service role key bypasses RLS entirely, and every line that touches it is
 * here — a credential whose blast radius is one importable module is one a
 * reviewer can actually bound, where a credential in a 800-line request
 * handler is one they have to take on trust. Second, the whole section is
 * best-effort by design (below), and best-effort code sitting inline next
 * to code that must not swallow anything is how the two postures blur: a
 * later edit copies the nearest `catch {}` and a real failure disappears.
 *
 * REJECTED: moving this into src/domain/import/ beside canonicalRecipe.ts.
 * That directory is pure, type-checked and unit-tested precisely because it
 * has no I/O; a module that opens sockets and reads secrets would be the
 * first exception, and the first exception is what ends the rule. The split
 * is the same one canonicalRecipe.ts already makes — it owns every
 * judgement about what a row MEANS (`parseStoredRecipe`, the row builders),
 * this file owns only the fetching — and that is why the narrowing below is
 * delegated rather than repeated. supabase/functions/** is excluded from
 * both `tsc --noEmit` and ESLint because it is Deno, so any real logic
 * living here would be unchecked and untestable.
 *
 * THE `.ts` EXTENSIONS ON THE IMPORTS BELOW ARE LOAD-BEARING, not a style
 * choice — see index.ts's header for Deno's resolution rule. Dropping one
 * does not fail a type-check or a lint; it fails the deploy.
 *
 * WHY THE LOOKUP RUNS WHERE IT DOES. `findStoredRecipe` is called from
 * `resolveImport` (index.ts) immediately after `resolveEffectiveUrl` and
 * strictly BEFORE the oEmbed call. That position is the whole feature, not
 * an implementation detail:
 *
 *  - Later (after oEmbed) would still save the LLM call, but would pay an
 *    oEmbed round trip on every duplicate import for nothing.
 *  - Earlier (on the raw pasted URL, before the redirect is followed) would
 *    be actively wrong. A `vm.tiktok.com`/`vt.tiktok.com` share link's path
 *    is an opaque short code, and the same video handed around by different
 *    people yields different short codes — so keying on the pre-resolution
 *    URL would miss every real duplicate and write a second `recipes` row
 *    for a video we already had. Deduplicating too early guarantees exactly
 *    the duplicate rows this exists to prevent.
 *
 * The window between the two is where the URL first becomes canonical, so
 * that is where the cache key becomes meaningful.
 *
 * EVERY FAILURE HERE IS BEST-EFFORT, BY DESIGN. A lookup that errors
 * returns null (a plain miss) and a write that errors is logged and
 * swallowed. Deduplication is a cost and consistency optimization, never a
 * correctness requirement: a database blip must degrade to "do the work
 * again", which is slower and more expensive but produces the right recipe.
 * It must never turn a working import into a failed one — the user pasted a
 * link and deserves their recipe regardless of whether our cache is
 * healthy. This is the one place in this function where swallowing an error
 * is right, and it is why each one is still logged loudly. Nothing in this
 * module throws, which is what lets index.ts call it without a guard.
 *
 * WHAT A SWALLOWED FAILURE NOW ALSO COSTS (W-01b). Since the response
 * carries `recipeId`, a degraded write no longer costs only money: the
 * import comes back with a null id, the client writes a meal that is a
 * copy of nothing, and no friend's cook can ever match it. That is still
 * the right trade — a recipe with no canonical link beats no recipe — but
 * it raises the stakes on the logging, and it is why the lost-race branch
 * goes and reads the winner's id (`findStoredRecipeId`) instead of
 * shrugging. A null here must always mean "there is no row", never "there
 * is a row and we did not bother to look".
 */

import { readRequiredEnvVar } from './env.ts';
import {
  buildRecipeIngredientRows,
  buildRecipeRowInsert,
  buildRecipeStepRows,
  parseStoredRecipe,
} from '../../../src/domain/import/canonicalRecipe.ts';
import type {
  ImportAttribution,
  ImportPlatform,
  ImportResult,
  ParsedRecipe,
} from '../../../src/domain/import/types.ts';

// Both are injected into every Edge Function by the platform itself — no
// `supabase secrets set`, no new secret to manage or rotate, nothing added
// to .env.example. That is the whole reason the canonical-recipe cache
// uses the service role rather than, say, a bespoke key: the credential
// with exactly the right power already exists here.
//
// SECURITY: the service role key bypasses RLS entirely, so it must never
// leave this function — not in a response body, not in a log line. It is
// used below only to read and write the three canonical tables from
// 0006_canonical_recipes.sql, which have no client-writable policy at all
// precisely because this is the only writer. Same posture as GEMINI_API_KEY
// (see the file header's SECURITY note).
//
// Read via readRequiredEnvVar for the same reason as GEMINI_API_KEY: a
// function that boots without them would silently degrade to "never
// deduplicate anything" — every import paying full oEmbed + LLM cost — and
// that is exactly the kind of expensive non-failure nobody notices.
const SUPABASE_URL = readRequiredEnvVar('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = readRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY');

/**
 * The `id` off a PostgREST row, or null when there is not a usable one.
 *
 * A named read rather than index.ts's general `isRecord` guard: this module
 * pulls exactly one field off exactly one shape, in two places that must
 * agree about what an unusable row is. Sharing the broad guard instead
 * would have meant importing it across the new file boundary and then
 * repeating the `typeof … === 'string'` half at both call sites, which is
 * the half that actually decides.
 */
function readRowId(row: unknown): string | null {
  if (typeof row !== 'object' || row === null) {
    return null;
  }
  const id: unknown = (row as { readonly id?: unknown }).id;
  return typeof id === 'string' ? id : null;
}

const RECIPES_ENDPOINT = `${SUPABASE_URL}/rest/v1/recipes`;

/**
 * PostgREST resource embedding pulls both child tables in the same request
 * as the parent, so a cache hit costs exactly one round trip — the thing
 * being optimized for. Ordering is deliberately NOT requested here (no
 * `order=`): `parseStoredRecipe` sorts by `sort_order`/`step_number` itself,
 * because a forgotten order parameter would produce a recipe with silently
 * shuffled steps, and that is a bug no test of this query would catch.
 */
const STORED_RECIPE_SELECT = [
  // W-01b. Not display data — it is the whole social half of the cache.
  // `parseStoredRecipe` puts it on `ImportResult.recipeId` so the second
  // household to import a URL ends up pointing at the SAME `recipes` row
  // as the first, which is the only object their two cooks can be joined
  // on (`shared_cooks`, 0009). Dropping it from this list does not break
  // an import; it silently unlinks every deduplicated one, so
  // `parseStoredRecipe` rejects a row without it rather than serving a
  // recipe with a null id.
  'id',
  'normalized_url',
  'platform',
  'title',
  'thumbnail_url',
  'estimated_minutes',
  'servings',
  'author_name',
  'author_url',
  'dish_tags',
  'recipe_ingredients(name,quantity,unit,sort_order)',
  'recipe_steps(step_number,instruction)',
].join(',');

function serviceRoleHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    // Both are the service role key: PostgREST wants it as `apikey` for
    // routing and as a Bearer token for the role claim. It never appears in
    // this function's own response or in a log line — see its declaration.
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    ...extra,
  };
}

/**
 * The cache read. Returns the stored recipe as a fully-formed
 * `ImportResult` (indistinguishable from a fresh extraction — see
 * canonicalRecipe.ts), or null for a miss, an unusable row, or any failure.
 */
export async function findStoredRecipe(normalizedUrl: string): Promise<ImportResult | null> {
  // DO NOT re-add double quotes around the filter value. That was tried as
  // defence against reserved characters and it silently broke every cache
  // read: PostgREST does not strip surrounding quotes here, it matches them
  // as literal characters, so a stored
  //   https://www.tiktok.com/@user/video/123
  // never equals the queried
  //   "https://www.tiktok.com/@user/video/123"
  // and every lookup returned []. The store kept succeeding into a cache
  // nobody could read, so imports still worked and nothing looked broken —
  // they just always paid for oEmbed and the LLM again. encodeURIComponent
  // already escapes every reserved character, which is the whole job.
  const endpoint =
    `${RECIPES_ENDPOINT}?select=${encodeURIComponent(STORED_RECIPE_SELECT)}` +
    `&normalized_url=eq.${encodeURIComponent(normalizedUrl)}&limit=1`;

  try {
    const response = await fetch(endpoint, { headers: serviceRoleHeaders() });
    if (!response.ok) {
      const detail = await response.text().catch(() => '<unreadable body>');
      console.error(
        `parse-recipe: canonical recipe lookup failed. status=${response.status} body=${detail.slice(0, 600)}`,
      );
      return null;
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    // Narrowed in the domain layer, not here: this file is excluded from
    // `tsc --noEmit` and ESLint (it is Deno), so any real logic living here
    // would be untested and unchecked. See canonicalRecipe.ts.
    return parseStoredRecipe(rows[0]);
  } catch (error) {
    console.error(`parse-recipe: canonical recipe lookup threw before a response. ${String(error)}`);
    return null;
  }
}

/**
 * The race-safe half. Two people importing the same link at the same
 * instant both reach here having both missed the lookup, and exactly one of
 * them must end up with a row.
 *
 * `on_conflict=normalized_url` + `Prefer: resolution=ignore-duplicates`
 * compiles to `INSERT ... ON CONFLICT (normalized_url) DO NOTHING`, so the
 * UNIQUE constraint in 0006_canonical_recipes.sql — not application code,
 * and not a read-then-write check that has a window between the two — is
 * what decides the winner. `return=representation` then makes the outcome
 * legible: PostgREST's RETURNING only yields rows actually inserted, so a
 * non-empty response means WE created the row, and an empty one means
 * somebody else already had it.
 *
 * WHY ignore-duplicates RATHER THAN merge-duplicates. `merge-duplicates`
 * (`DO UPDATE`) would also be race-safe and would always return an id, which
 * is superficially simpler. It is wrong here for two reasons. First, both
 * racers would then think they owned the row and both would insert child
 * rows, duplicating every ingredient and step. Second, two extractions of
 * one caption are not guaranteed identical (the model is not deterministic),
 * so `DO UPDATE` would let a later, worse parse silently overwrite a good
 * stored one on every duplicate import. Write-once is the intended
 * behaviour — see the `recipes` table's own note on why it has no
 * `updated_at`.
 *
 * WHY THE OUTCOME IS THREE-VALUED RATHER THAN `string | null` (W-01b).
 * "We lost the race" and "the write failed" used to collapse into the same
 * null, which was fine while the id was only used to hang child rows off:
 * both meant "do not write children". They are not the same answer to the
 * question the client now asks. A lost race means the row EXISTS and has a
 * perfectly good id that this import should still point its meal at; a
 * failed write means there is no row and `null` is the honest reply. The
 * caller distinguishes them so the first case can be resolved with one
 * cheap lookup instead of silently unlinking the import.
 */
type CanonicalInsertOutcome =
  /** This caller created the row, and owes it its children. */
  | { readonly kind: 'inserted'; readonly recipeId: string }
  /** Somebody else's row is already there — it has children, or will; ours must not add a second set. */
  | { readonly kind: 'existed' }
  /** No row, and no id to report. */
  | { readonly kind: 'failed' };

async function insertCanonicalRecipe(
  recipe: ParsedRecipe,
  normalizedUrl: string,
  platform: ImportPlatform,
  attribution: ImportAttribution,
): Promise<CanonicalInsertOutcome> {
  try {
    const response = await fetch(`${RECIPES_ENDPOINT}?on_conflict=normalized_url&select=id`, {
      method: 'POST',
      headers: serviceRoleHeaders({ prefer: 'resolution=ignore-duplicates,return=representation' }),
      body: JSON.stringify([buildRecipeRowInsert(recipe, { normalizedUrl, platform, attribution })]),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '<unreadable body>');
      console.error(
        `parse-recipe: canonical recipe insert failed. status=${response.status} body=${detail.slice(0, 600)}`,
      );
      return { kind: 'failed' };
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      // Lost the race, or the row already existed. Not an error, and
      // deliberately not logged as one — it is the constraint doing its job.
      // Saying 'existed' rather than 'failed' is what stops this caller
      // writing a second set of children onto the winner's row, while still
      // letting it go and read the winner's id.
      return { kind: 'existed' };
    }
    const recipeId = readRowId(rows[0]);
    if (recipeId === null) {
      return { kind: 'failed' };
    }
    return { kind: 'inserted', recipeId };
  } catch (error) {
    console.error(`parse-recipe: canonical recipe insert threw before a response. ${String(error)}`);
    return { kind: 'failed' };
  }
}

/**
 * The id of an existing `recipes` row, and nothing else.
 *
 * WHY THIS EXISTS SEPARATELY FROM `findStoredRecipe` ABOVE. That one
 * returns a full `ImportResult` and refuses a row whose children are
 * missing or unreadable — correct for a cache read, and precisely wrong
 * here. Both cases that reach this function have a real parent row whose
 * id a household's meal should point at:
 *
 *  - The race: two importers of one URL at the same instant. The loser has
 *    a fully extracted recipe of its own; it just may not write it. Without
 *    this lookup that import would store a meal linked to nothing, purely
 *    for having been a few milliseconds late.
 *  - The orphaned parent (see `storeCanonicalRecipe`): a row whose child
 *    inserts failed once, so every later import misses the cache, re-
 *    extracts, and then conflicts here. Forever. The recipe is correct
 *    either way; this is what keeps those imports linked to the canonical
 *    row rather than permanently unlinked.
 *
 * Best-effort like everything else in this section: any failure returns
 * null, and the import proceeds with an honest "no canonical row".
 */
async function findStoredRecipeId(normalizedUrl: string): Promise<string | null> {
  // Same rule as `findStoredRecipe`: encodeURIComponent only, NEVER quotes
  // around the value — PostgREST matches quotes literally.
  const endpoint = `${RECIPES_ENDPOINT}?select=id&normalized_url=eq.${encodeURIComponent(normalizedUrl)}&limit=1`;

  try {
    const response = await fetch(endpoint, { headers: serviceRoleHeaders() });
    if (!response.ok) {
      const detail = await response.text().catch(() => '<unreadable body>');
      console.error(
        `parse-recipe: canonical recipe id lookup failed. status=${response.status} body=${detail.slice(0, 600)}`,
      );
      return null;
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      // The conflicting row is gone already. Nothing to point at, and
      // nothing to invent — see ImportResult.recipeId.
      return null;
    }
    return readRowId(rows[0]);
  } catch (error) {
    console.error(`parse-recipe: canonical recipe id lookup threw before a response. ${String(error)}`);
    return null;
  }
}

/** One best-effort bulk insert of a recipe's child rows. Failures are logged, never thrown — see this file's header. */
async function insertCanonicalChildRows(table: string, rows: readonly unknown[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      // return=minimal: nothing here reads the inserted rows back, and not
      // asking for them saves serializing a payload we would throw away.
      headers: serviceRoleHeaders({ prefer: 'return=minimal' }),
      body: JSON.stringify(rows),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '<unreadable body>');
      console.error(
        `parse-recipe: canonical ${table} insert failed. status=${response.status} body=${detail.slice(0, 600)}`,
      );
    }
  } catch (error) {
    console.error(`parse-recipe: canonical ${table} insert threw before a response. ${String(error)}`);
  }
}

/**
 * Stores a freshly extracted recipe as the canonical row for its URL.
 *
 * THE NON-ATOMICITY THIS ACCEPTS. The parent and its children are three
 * separate PostgREST requests, so a failure between them can leave a
 * `recipes` row with no ingredients or steps. That degrades honestly rather
 * than dangerously: `parseStoredRecipe` rejects an ingredient-less or
 * step-less row, so the next importer simply gets a cache miss and a
 * correct, freshly extracted recipe — the URL just stops benefiting from
 * deduplication, forever, until someone notices the logged failure.
 *
 * The atomic alternative is a `security definer` Postgres function taking
 * the whole recipe as jsonb and inserting all three tables in one
 * transaction. Rejected for now: it moves real logic into SQL where this
 * repo can neither type-check nor unit-test it, and it trades a rare,
 * self-healing, loudly-logged inconsistency for a permanently larger
 * write surface. Revisit if orphaned parents actually show up in the logs.
 *
 * RETURNS THE CANONICAL ID (W-01b), which is what the client needs in
 * order to set `meals.recipe_id`, and therefore the only reason a friend's
 * cook can ever match this household's copy of the dish. It is READ, never
 * derived: from the insert's own RETURNING when this caller won the race,
 * from a lookup of the winner's row when it did not. `null` means there
 * genuinely is no canonical row to point at, and the caller passes that
 * through unchanged rather than substituting the normalized URL — which is
 * this row's deduplication key and not its identity.
 */
export async function storeCanonicalRecipe(
  recipe: ParsedRecipe,
  normalizedUrl: string,
  platform: ImportPlatform,
  attribution: ImportAttribution,
): Promise<string | null> {
  const outcome = await insertCanonicalRecipe(recipe, normalizedUrl, platform, attribution);
  if (outcome.kind === 'failed') {
    return null;
  }
  if (outcome.kind === 'existed') {
    // Somebody else's row. This caller must not write children onto it —
    // that is the entire reason the insert uses ignore-duplicates — but
    // its id is still the correct one for this import to point at.
    return findStoredRecipeId(normalizedUrl);
  }
  // Parallel: the two tables are independent, and both are already gated on
  // this caller having won the parent insert above.
  await Promise.all([
    insertCanonicalChildRows('recipe_ingredients', buildRecipeIngredientRows(outcome.recipeId, recipe)),
    insertCanonicalChildRows('recipe_steps', buildRecipeStepRows(outcome.recipeId, recipe)),
  ]);
  return outcome.recipeId;
}

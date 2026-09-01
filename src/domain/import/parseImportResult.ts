/**
 * Narrows the `parse-recipe` edge function's raw `unknown` HTTP response
 * body into an `ImportResult`, or `null` when it isn't one.
 *
 * This is the CLIENT side of the boundary. Its sibling
 * parseExtractionResponse.ts sits on the far side of a different one —
 * that module narrows Gemini's reply inside the edge function, this one
 * narrows the edge function's reply inside the app. Neither substitutes
 * for the other, and the app must not assume the server it is talking to
 * is the same version as the code it shipped with: a rolled-back or
 * half-deployed function is exactly the case this exists for.
 *
 * Same posture as validateParsed.ts, for the same reason: any structural
 * doubt fails the whole result rather than salvaging part of it. A
 * half-understood response becoming a half-populated recipe is the
 * failure mode this feature can least afford.
 *
 * ON REJECTING A MALFORMED `attribution`. It would be easy to treat a
 * broken attribution object as simply absent and show the recipe anyway.
 * That is deliberately not what happens: creator attribution is a legal
 * obligation here, not decoration (PD-007, and the legal risk review held
 * outside this repo), so
 * silently dropping it is a worse outcome than an honest failure the user
 * can retry. A shape we don't recognize means client/function version
 * skew, which is worth surfacing rather than papering over. On the
 * `display_only` variant an ABSENT attribution is rejected too, not just a
 * malformed one — showing someone's post is only defensible while their
 * name travels with it (PD-011).
 */

import type { OembedErrorReason } from '../../lib/oembed';
import type { ImportAttribution, ImportPlatform, ImportResult, SourceFetchFailureReason } from './types';
import { validateParsedRecipe } from './validateParsed';

/**
 * The CLIENT-side mirror of "which platform values are real": a value this
 * set doesn't recognise fails the whole result rather than passing a
 * client/function version-skew platform through untyped.
 *
 * DERIVED FROM AN EXHAUSTIVE RECORD, NOT WRITTEN AS A LIST, and that is a
 * deliberate change rather than a flourish. The previous version was a
 * hand-written `new Set<ImportPlatform>([...])`, which type-checks
 * perfectly well while MISSING a member — so "must stay in lockstep with
 * `ImportPlatform`" was a comment asking a reader to remember something,
 * and the widening that added `'web'` had to find three such lists by
 * hand, two of which a previous widening had already left stale. A
 * `Record<ImportPlatform, true>` cannot be missing a key: the next member
 * added to the union stops this file from compiling, which is the only
 * form of "stay in lockstep" that actually holds.
 *
 * Two sibling copies of this vocabulary exist on purpose, each guarding a
 * different trust boundary, and both are now forced the same way:
 * `isImportPlatform` in canonicalRecipe.ts (a stored database row) and
 * `decodeImportConfirmParams` in src/app/import/routeParams.ts (a router
 * param round-tripping through the UI). Merging them into one shared
 * export was considered and rejected for the same reason this directory
 * already keeps three copies of `readNullableString`: tightening the rule
 * for one boundary must not silently move the other two.
 */
const PLATFORM_MEMBERS: Readonly<Record<ImportPlatform, true>> = {
  tiktok: true,
  instagram: true,
  youtube: true,
  web: true,
};
const PLATFORMS: ReadonlySet<string> = new Set(Object.keys(PLATFORM_MEMBERS));

const OEMBED_ERROR_REASONS: ReadonlySet<string> = new Set<OembedErrorReason>([
  'invalid_url',
  'missing_credentials',
  'not_found',
  'region_locked',
  'rate_limited',
  'invalid_response',
  'network_error',
  'unknown_error',
]);

/**
 * `SourceFetchFailureReason`'s vocabulary (types.ts), held to exactly the
 * same posture as `OEMBED_ERROR_REASONS` above: a reason this client does
 * not recognise fails the WHOLE result rather than being downgraded to a
 * generic fetch failure. A newer function that learned a new reason is
 * telling us something we cannot render honestly, and the retry the user
 * gets from `llm_request_failed` (src/lib/importRecipe.ts's transport
 * fallback) is a better answer than copy written for a different failure.
 */
const SOURCE_FETCH_FAILURE_REASONS: ReadonlySet<string> = new Set<SourceFetchFailureReason>([
  'refused',
  'not_found',
  'server_error',
  'too_large',
  'not_html',
  'network_error',
  'missing_credentials',
]);

/**
 * What an absent `attribution` on a `parsed` response decodes to.
 *
 * The field is required on the type as of the `'web'` widening, but a
 * function deployed before that change sends no key at all, and rejecting
 * those responses would break every client during a rollout for no gain.
 * All-null is not an invention: types.ts has always defined `undefined`
 * here as "equivalent to a populated but all-null `ImportAttribution`",
 * and this constant is that sentence in code. A MALFORMED attribution is a
 * different matter entirely and still fails the result — see the file
 * header on why a creator we mis-read is worse than one we cannot name.
 */
const UNNAMED_CREATOR: ImportAttribution = { authorName: null, authorUrl: null, thumbnailUrl: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

type NullableStringResult = { readonly ok: true; readonly value: string | null } | { readonly ok: false };

/** A missing/undefined/null key is a valid "not stated"; anything present that isn't a string is a malformed shape. */
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

type AttributionResult =
  | { readonly ok: true; readonly value: ImportAttribution | undefined }
  | { readonly ok: false };

function readAttribution(value: unknown): AttributionResult {
  if (value === undefined || value === null) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(value)) {
    return { ok: false };
  }
  const authorName = readNullableString(value.authorName);
  const authorUrl = readNullableString(value.authorUrl);
  const thumbnailUrl = readNullableString(value.thumbnailUrl);
  if (!authorName.ok || !authorUrl.ok || !thumbnailUrl.ok) {
    return { ok: false };
  }
  return {
    ok: true,
    value: { authorName: authorName.value, authorUrl: authorUrl.value, thumbnailUrl: thumbnailUrl.value },
  };
}

function parseParsedVariant(raw: Record<string, unknown>): ImportResult | null {
  const recipe = validateParsedRecipe(raw.recipe);
  if (recipe === null || !isNonEmptyString(raw.sourceUrl) || typeof raw.platform !== 'string') {
    return null;
  }
  if (!PLATFORMS.has(raw.platform)) {
    return null;
  }
  const attribution = readAttribution(raw.attribution);
  if (!attribution.ok) {
    return null;
  }
  // W-01b. Absent reads as `null` rather than failing the result, and the
  // asymmetry with `attribution` above is deliberate: a function deployed
  // before W-01b sends no such key, and "this response cannot tell me the
  // canonical row" is a true, renderable statement — a meal that is a copy
  // of nothing — where a missing creator is a legal problem worth a
  // retryable failure. A key that is PRESENT but not a string is a
  // different thing entirely (client/function version skew) and fails the
  // whole result, same as a malformed attribution.
  //
  // The one thing this must never do is fall back to `raw.sourceUrl`. That
  // is the `recipes` row's deduplication key, not its id, and a meal
  // pointed at it points at no row at all.
  const recipeId = readNullableString(raw.recipeId);
  if (!recipeId.ok) {
    return null;
  }
  return {
    kind: 'parsed',
    recipe,
    sourceUrl: raw.sourceUrl.trim(),
    platform: raw.platform as ImportPlatform,
    // Both of these are now ALWAYS stated, even when the response said
    // nothing about them. That is the whole point of the two fields having
    // become required on the type: one spelling of "we do not know the
    // creator" and one spelling of "there is no canonical row", so no
    // reader downstream has to check `undefined` and `null` to learn the
    // same fact. See `UNNAMED_CREATOR` for why filling one in is a reading
    // of the old contract rather than a fabrication.
    attribution: attribution.value ?? UNNAMED_CREATOR,
    recipeId: recipeId.value,
  };
}

/**
 * The display-only variant (PD-011): a post we may show and credit, with
 * no recipe and — deliberately — no caption. Two ways it is stricter than
 * `parseParsedVariant`:
 *
 *  - `attribution` is REQUIRED, not optional. There are no pre-existing
 *    object literals to stay compatible with (unlike `parsed`, whose
 *    optionality exists only for src/app/import/_fixtures.ts), and a
 *    display-only post without a creator is the one shape that should never
 *    render.
 *  - Nothing is copied off `raw` beyond the four fields named below, so a
 *    caption attached by a rogue or future function is dropped here rather
 *    than narrowed through into the app.
 */
function parseDisplayOnlyVariant(raw: Record<string, unknown>): ImportResult | null {
  if (!isNonEmptyString(raw.sourceUrl) || typeof raw.platform !== 'string' || !PLATFORMS.has(raw.platform)) {
    return null;
  }
  const attribution = readAttribution(raw.attribution);
  if (!attribution.ok || attribution.value === undefined) {
    return null;
  }
  return {
    kind: 'display_only',
    platform: raw.platform as ImportPlatform,
    sourceUrl: raw.sourceUrl.trim(),
    attribution: attribution.value,
  };
}

/**
 * IMP-02. Unlike `parsed` (where an absent `attribution` is a real,
 * renderable "this response cannot tell me the creator" — see
 * `parseParsedVariant`'s own comment on that asymmetry), attribution is
 * REQUIRED here, exactly as strictly as on `display_only`: the function
 * only ever constructs this variant after oEmbed has already resolved, so
 * there is no legitimate "not fetched yet" reading of an absent
 * attribution — only client/function version skew, which this file's own
 * header says is worth failing the whole result over, not papering over.
 */
function parseNoRecipeInCaptionVariant(raw: Record<string, unknown>): ImportResult | null {
  const caption = readNullableString(raw.caption);
  if (!caption.ok) {
    return null;
  }
  const attribution = readAttribution(raw.attribution);
  if (!attribution.ok || attribution.value === undefined) {
    return null;
  }
  return { kind: 'no_recipe_in_caption', caption: caption.value, attribution: attribution.value };
}

/** The single entry point: takes the parsed JSON body of a parse-recipe response and narrows it, or returns null. */
export function parseImportResult(raw: unknown): ImportResult | null {
  if (!isRecord(raw) || typeof raw.kind !== 'string') {
    return null;
  }

  switch (raw.kind) {
    case 'parsed':
      return parseParsedVariant(raw);
    case 'display_only':
      return parseDisplayOnlyVariant(raw);
    case 'no_recipe_in_caption':
      return parseNoRecipeInCaptionVariant(raw);
    case 'oembed_failed':
      return typeof raw.reason === 'string' && OEMBED_ERROR_REASONS.has(raw.reason)
        ? { kind: 'oembed_failed', reason: raw.reason as OembedErrorReason }
        : null;
    // Nothing to check beyond the kind itself, and nothing to copy off
    // `raw`. That is the variant's meaning, not laziness: the page was
    // read and published no structured recipe, so there is no caption to
    // quote and no creator to credit — see its doc comment in types.ts on
    // why attaching a scraped `<title>` here would be inventing a source.
    case 'no_recipe_on_page':
      return { kind: 'no_recipe_on_page' };
    case 'source_fetch_failed':
      return typeof raw.reason === 'string' && SOURCE_FETCH_FAILURE_REASONS.has(raw.reason)
        ? { kind: 'source_fetch_failed', reason: raw.reason as SourceFetchFailureReason }
        : null;
    case 'unsupported_url':
      return { kind: 'unsupported_url' };
    case 'llm_request_failed':
      return { kind: 'llm_request_failed' };
    case 'parse_failed':
      return { kind: 'parse_failed' };
    default:
      return null;
  }
}

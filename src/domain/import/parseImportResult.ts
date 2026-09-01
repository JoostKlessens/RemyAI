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
import type { ImportAttribution, ImportPlatform, ImportResult } from './types';
import { validateParsedRecipe } from './validateParsed';

/**
 * Must stay in lockstep with `ImportPlatform` (types.ts) and with
 * urlParsing.ts's own host-recognition Sets — this is the CLIENT-side
 * mirror of "which platform values are real," so a value this Set doesn't
 * recognise fails the whole result rather than passing a client/function
 * version-skew platform through untyped. SRC-02/SRC-03 add `'youtube'`
 * here in the same commit that adds it to `ImportPlatform` and to
 * urlParsing.ts's `YOUTUBE_HOSTS`/`YOUTUBE_SHORT_LINK_HOSTS`, for the same
 * reason those two must not drift apart from each other either.
 *
 * (canonicalRecipe.ts, elsewhere in this directory, keeps a THIRD,
 * independent copy of this same vocabulary — `isImportPlatform` — for the
 * canonical-recipe cache row shape. That module is outside this change's
 * scope; whoever wires up YouTube's actual extraction pipeline needs to
 * widen that guard too before a YouTube import can be cached.)
 */
const PLATFORMS: ReadonlySet<string> = new Set<ImportPlatform>(['tiktok', 'instagram', 'youtube']);

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
  const base = {
    kind: 'parsed',
    recipe,
    sourceUrl: raw.sourceUrl.trim(),
    platform: raw.platform as ImportPlatform,
    // Always stated, even as null — unlike `attribution` below, which is
    // spread in only when present. One spelling of "no canonical row" is
    // enough; a reader should never have to check both `undefined` and
    // `null` to learn the same fact.
    recipeId: recipeId.value,
  } as const;
  return attribution.value === undefined ? base : { ...base, attribution: attribution.value };
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

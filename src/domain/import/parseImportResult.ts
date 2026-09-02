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
 *
 * WHERE VERSION SKEW IS TOLERATED AND WHERE IT IS NOT, in one place,
 * because this module now makes that call three different ways and the
 * difference is not arbitrary. A field gets a backward-compatible reading
 * exactly when an old function's silence has a TRUE sentence behind it: an
 * absent `attribution` on `parsed` means "we cannot name the creator", an
 * absent `recipeId` means "there is no canonical row", and both are states
 * a real import genuinely reaches and the UI already draws. A field gets
 * no such reading when silence means nothing at all — `provenance`
 * (RCP-06) was the first such case, and `platform` is now the second. The
 * test is never "how important is this field", it is "is there something
 * true to say when the response says nothing".
 *
 * `platform` LANDS ON THE STRICT SIDE, ON EIGHT OF THE NINE VARIANTS.
 * types.ts requires it everywhere except `unsupported_url`, on the grounds
 * that the value is settled by `normalizeRecipeUrl` before any network call
 * and is therefore in hand at every producer. That argument is exactly what
 * makes silence here meaningless: a function that answered at all had
 * already computed the platform, so an omitted one is not an old function
 * being modest, it is a response this client cannot account for. There is
 * no true sentence to fall back on and no default that does not fabricate
 * one — see `readPlatform`. The single exception is narrowed as an
 * exception rather than by omission: `unsupported_url` reads no platform
 * because the outcome exists precisely because none was established.
 *
 * `sourceUrl` BECAME NULLABLE ON `parsed` (SRC-08) AND THIS FILE IS WHERE
 * THAT DOES NOT BECOME A HOLE. A `'text'` import has no URL by
 * construction, so the type had to admit `null`; the other four routes
 * settle their URL before any network call and have always had one. Typed
 * nullability alone would hand all five the same latitude, and the one
 * that would suffer is `'web'`: a malformed response whose `sourceUrl`
 * went missing would decode into a recipe with no link back to the
 * publisher who wrote it — the same silent loss of a source this header
 * refuses one paragraph up for `attribution`. So the field is read
 * TOGETHER WITH the platform (`readSourceUrl`), and the pairing is
 * checked rather than assumed in both directions.
 */

import type { OembedErrorReason } from '../../lib/oembed';
import type {
  ImportAttribution,
  ImportPlatform,
  ImportResult,
  RecipeProvenance,
  SourceFetchFailureReason,
} from './types';
// The `.ts` IS LOAD-BEARING even though nothing under
// `supabase/functions/**` imports this file today, and it is spelled out
// here rather than left for whoever adds that import. Deno resolves
// relative specifiers literally, so an extensionless VALUE import anywhere
// in a graph the edge function pulls in fails the DEPLOY and nothing else:
// not `tsc --noEmit`, not ESLint, not vitest. This directory has already
// paid for that once (resolveShortLinkTarget.ts), and the cost of being
// wrong is asymmetric — an extension that turns out to be unnecessary
// costs three characters, a missing one costs a broken deploy discovered
// after merge. `allowImportingTsExtensions` (tsconfig.json) is what keeps
// it legal for the Node/Metro build that DOES check this file.
import { validateParsedRecipe } from './validateParsed.ts';

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
  // SRC-08. Added by the compiler's insistence rather than by anyone
  // remembering — which is the entire argument the paragraph above makes,
  // now paid off once: widening `ImportPlatform` broke this file's build
  // instead of quietly rejecting every pasted-text import as an unknown
  // platform.
  text: true,
};
const PLATFORMS: ReadonlySet<string> = new Set(Object.keys(PLATFORM_MEMBERS));

/**
 * The one reader for a field EIGHT of the nine variants now carry, written
 * once so that all eight are held to the same standard.
 *
 * ABSENT AND UNRECOGNISED ARE THE SAME ANSWER HERE, and that is the
 * module's standing posture rather than a new one. The file header states
 * the test: a field gets a backward-compatible reading exactly when an old
 * function's silence has a TRUE sentence behind it. Platform has none. A
 * response that reached this client at all was produced by a function that
 * had already run `normalizeRecipeUrl` and therefore already knew the
 * answer — that is the whole argument types.ts makes for requiring the
 * field — so silence about it means one thing only: the function on the
 * other end is not the function this client was built against.
 *
 * Defaulting is worse than failing, for the reason `readProvenance` below
 * gives about its own field and one more that is specific to this one.
 * Every plausible default is a lie somebody would act on: `'web'` would
 * file a broken TikTok import under the route that cannot hallucinate, and
 * a most-common-platform guess would inflate whichever number is already
 * largest. The user's alternative is a retryable failure they can
 * understand, and IMP-07's denominator stays a measurement rather than a
 * mixture of measurement and assumption.
 */
function readPlatform(value: unknown): ImportPlatform | null {
  return typeof value === 'string' && PLATFORMS.has(value) ? (value as ImportPlatform) : null;
}

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
  // Both added by the same change that split "we refused the host" from
  // "they refused us" (types.ts). They are listed here rather than folded
  // into `refused` for the reason that split exists at all: this set is
  // what decides whether the app can render a reason honestly, and a
  // client that quietly accepted `'forbidden'` as `'refused'` would show
  // copy blaming Remy's own safety guard for a publisher's bot wall.
  'forbidden',
  'rate_limited',
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

/**
 * RCP-06's vocabulary, forced exhaustive the same way `PLATFORM_MEMBERS`
 * is and for the same reason — a hand-written list compiles perfectly
 * while missing a member, and this directory has already been bitten twice
 * by exactly that.
 */
const PROVENANCE_MEMBERS: Readonly<Record<RecipeProvenance, true>> = {
  publisher_structured_data: true,
  model_from_caption: true,
  model_from_pasted_text: true,
};
const PROVENANCES: ReadonlySet<string> = new Set(Object.keys(PROVENANCE_MEMBERS));

/**
 * THE ONE FIELD ON `parsed` THAT GETS NO BACKWARD-COMPATIBLE READING, and
 * the asymmetry with its two neighbours is the whole point of writing it
 * down. `attribution` absent decodes to `UNNAMED_CREATOR` and `recipeId`
 * absent decodes to `null`, because in both cases there is a true
 * sentence to fall back on — "we cannot name the creator", "there is no
 * canonical row" — that some real import genuinely produces, and the UI
 * already renders it. Provenance has no such sentence. There is no import
 * that legitimately does not know whether it called a model; the answer is
 * free at every producer (types.ts's field comment lists them). So an
 * absent or unrecognised value means exactly one thing — the function on
 * the other end is not the function this client was built against — and
 * this module's standing posture for that is to fail the whole result
 * rather than render half of it.
 *
 * INVENTING A DEFAULT HERE WOULD BE THE WORST AVAILABLE OPTION, worse
 * than the failure and worse than an "unknown" state. Defaulting to
 * `'model_from_caption'` would tell a user that a recipe their publisher
 * wrote down was software's interpretation; defaulting to
 * `'publisher_structured_data'` would put a publisher's name on a model's
 * reading of a caption. Both are the app stating, in its own voice, a fact
 * about the origin of a recipe that nobody told it. The user gets a
 * retryable failure instead, which is honest and recoverable.
 */
function readProvenance(value: unknown): RecipeProvenance | null {
  return typeof value === 'string' && PROVENANCES.has(value) ? (value as RecipeProvenance) : null;
}

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

type SourceUrlResult = { readonly ok: true; readonly value: string | null } | { readonly ok: false };

/**
 * Reads `parsed`'s `sourceUrl` AGAINST the platform that came with it,
 * because after SRC-08 the field's legal values depend on which route
 * produced the result and no single rule covers both.
 *
 * FOUR ROUTES STILL REQUIRE A NON-EMPTY STRING, exactly as before this
 * function existed. TikTok, Instagram, YouTube and web all resolve and
 * normalize their URL before any network call — it is the first thing the
 * pipeline does — so a response from any of them without one is not an
 * older function being terse, it is a response this client cannot account
 * for. And the failure it would cause is the expensive kind: a `'web'`
 * recipe that lost its URL is a publisher's recipe with the link back to
 * them deleted, which is the same harm the file header refuses for a
 * dropped attribution. Nullability on the TYPE must not become permission
 * on the WIRE.
 *
 * `'text'` REQUIRES THE OPPOSITE, AND THAT SYMMETRY IS THE POINT. A
 * pasted-text import has no URL, so absent, `null` and blank all decode to
 * `null` — three spellings of the same true sentence, and a blank string
 * is what a hand-built payload most plausibly sends. But a text result
 * that NAMES a URL is rejected rather than quietly stripped. This client
 * models pasted text as having no origin at all; a function that attaches
 * one is telling us something we have no way to render honestly — we
 * could not say whether it is where the text came from, where the user
 * found it, or a leftover from another branch — and dropping it silently
 * would be this module deciding what a server meant. Same posture the
 * rest of the file takes towards a value it does not recognise: fail the
 * whole result and let the user retry.
 */
function readSourceUrl(value: unknown, platform: ImportPlatform): SourceUrlResult {
  if (platform === 'text') {
    const pasted = readNullableString(value);
    return pasted.ok && pasted.value === null ? { ok: true, value: null } : { ok: false };
  }
  return isNonEmptyString(value) ? { ok: true, value: value.trim() } : { ok: false };
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

/**
 * ON `dishTags`, WHICH IS NOW REQUIRED AND STILL HAS NO CODE HERE. That
 * absence is the design, not an omission: the recipe body is narrowed by
 * `validateParsedRecipe` — the SAME function the edge function runs over
 * the model's answer — so this client cannot end up with a different idea
 * of what a valid recipe is than the server that sent it. That validator
 * reads a missing `dishTags` key as `[]` and states it, which is why a
 * response from a function older than the field still decodes and still
 * satisfies the required type. Adding a second dish-tag reading here
 * would be a second place for the two to drift.
 *
 * It is worth naming why that leniency is right for `dishTags` and wrong
 * for `provenance` one field below, since they look like the same
 * question. A dish tag gates nothing, so `[]` is a true and useful thing
 * to say when nobody said otherwise. A provenance is a claim about where
 * a recipe came from, and there is no such thing as a true default for
 * it.
 */
function parseParsedVariant(raw: Record<string, unknown>): ImportResult | null {
  const recipe = validateParsedRecipe(raw.recipe);
  const platform = readPlatform(raw.platform);
  if (recipe === null || platform === null) {
    return null;
  }
  // Read together, never separately — see `readSourceUrl` for why the
  // field's legal values depend on the platform beside it, and why the
  // check runs in both directions.
  const sourceUrl = readSourceUrl(raw.sourceUrl, platform);
  if (!sourceUrl.ok) {
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
  // RCP-06, and deliberately NOT given the tolerant reading the two fields
  // above get — see `readProvenance` for why an absent one has no true
  // sentence to fall back on and a defaulted one would be the app
  // inventing a claim about where a recipe came from.
  const provenance = readProvenance(raw.provenance);
  if (provenance === null) {
    return null;
  }
  return {
    kind: 'parsed',
    recipe,
    sourceUrl: sourceUrl.value,
    platform,
    // Both of these are now ALWAYS stated, even when the response said
    // nothing about them. That is the whole point of the two fields having
    // become required on the type: one spelling of "we do not know the
    // creator" and one spelling of "there is no canonical row", so no
    // reader downstream has to check `undefined` and `null` to learn the
    // same fact. See `UNNAMED_CREATOR` for why filling one in is a reading
    // of the old contract rather than a fabrication.
    attribution: attribution.value ?? UNNAMED_CREATOR,
    recipeId: recipeId.value,
    provenance,
  };
}

/**
 * The display-only variant (PD-011): a post we may show and credit, with
 * no recipe and — deliberately — no caption. Two ways it is stricter than
 * `parseParsedVariant`:
 *
 *  - An ABSENT `attribution` fails the result outright, where on `parsed`
 *    it decodes to `UNNAMED_CREATOR`. Both variants require the field on
 *    the type; only this one refuses to materialise a stand-in for it,
 *    because a display-only post without a creator is the one shape that
 *    should never render at all — crediting the creator is the entire
 *    justification for showing the post (PD-011).
 *  - Nothing is copied off `raw` beyond the four fields named below, so a
 *    caption attached by a rogue or future function is dropped here rather
 *    than narrowed through into the app.
 */
function parseDisplayOnlyVariant(raw: Record<string, unknown>): ImportResult | null {
  const platform = readPlatform(raw.platform);
  if (platform === null || !isNonEmptyString(raw.sourceUrl)) {
    return null;
  }
  const attribution = readAttribution(raw.attribution);
  if (!attribution.ok || attribution.value === undefined) {
    return null;
  }
  return {
    kind: 'display_only',
    platform,
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
  const platform = readPlatform(raw.platform);
  if (!caption.ok || platform === null) {
    return null;
  }
  const attribution = readAttribution(raw.attribution);
  if (!attribution.ok || attribution.value === undefined) {
    return null;
  }
  return { kind: 'no_recipe_in_caption', caption: caption.value, attribution: attribution.value, platform };
}

/**
 * The single entry point: takes the parsed JSON body of a parse-recipe
 * response and narrows it, or returns null.
 *
 * EIGHT OF THE NINE ARMS NOW READ A PLATFORM, AND `unsupported_url` IS THE
 * ONE THAT DOES NOT — the same single exception types.ts argues for on the
 * type, restated in code rather than trusted to it, because a narrower that
 * merely typed the field would compile perfectly while never checking it.
 * `readPlatform` above carries the argument for why an absent or
 * unrecognised value fails the whole result instead of being defaulted.
 *
 * The two `reason`-carrying arms deliberately check their platform FIRST,
 * so an unknown platform and an unknown reason produce the same answer —
 * null — rather than one silently mattering less than the other. Both are
 * the same fact about the same response: the function that sent it is not
 * the function this client was built against.
 */
export function parseImportResult(raw: unknown): ImportResult | null {
  if (!isRecord(raw) || typeof raw.kind !== 'string') {
    return null;
  }
  const platform = readPlatform(raw.platform);

  switch (raw.kind) {
    case 'parsed':
      return parseParsedVariant(raw);
    case 'display_only':
      return parseDisplayOnlyVariant(raw);
    case 'no_recipe_in_caption':
      return parseNoRecipeInCaptionVariant(raw);
    case 'oembed_failed':
      return platform !== null && typeof raw.reason === 'string' && OEMBED_ERROR_REASONS.has(raw.reason)
        ? { kind: 'oembed_failed', reason: raw.reason as OembedErrorReason, platform }
        : null;
    // The platform is the ONLY thing copied off `raw` here, and the
    // contrast is the variant's meaning rather than laziness: the page was
    // read and published no structured recipe, so there is no caption to
    // quote and no creator to credit — see its doc comment in types.ts on
    // why attaching a scraped `<title>` here would be inventing a source.
    // Which route found nothing is a fact about our own pipeline, not
    // something read off the page, so it is the one thing there is to say.
    case 'no_recipe_on_page':
      return platform === null ? null : { kind: 'no_recipe_on_page', platform };
    case 'source_fetch_failed':
      return platform !== null && typeof raw.reason === 'string' && SOURCE_FETCH_FAILURE_REASONS.has(raw.reason)
        ? { kind: 'source_fetch_failed', reason: raw.reason as SourceFetchFailureReason, platform }
        : null;
    // The one arm that reads no platform, because there is none to read:
    // this outcome is produced by the branch that runs before a URL has
    // been identified at all. types.ts's variant comment argues why a
    // nullable field or a `'web'` default would both be worse than the
    // honest absence.
    case 'unsupported_url':
      return { kind: 'unsupported_url' };
    case 'llm_request_failed':
      return platform === null ? null : { kind: 'llm_request_failed', platform };
    case 'parse_failed':
      return platform === null ? null : { kind: 'parse_failed', platform };
    default:
      return null;
  }
}

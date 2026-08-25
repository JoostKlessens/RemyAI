/**
 * oEmbed client for resolving a single TikTok or Instagram post URL to its
 * embeddable metadata (PD-007).
 *
 * What this is NOT: a way to browse a creator's content. oEmbed only ever
 * resolves one URL you already hold to a title/thumbnail/author payload —
 * it is not a feed or search API. See docs/PRODUCT-DECISIONS.md PD-007 and
 * research/03-video-recipe-extraction.md [S31][S35][S36].
 *
 * TikTok: `https://www.tiktok.com/oembed?url=...` is publicly documented
 * with no auth requirement described for it.
 *
 * Instagram: oEmbed requires an approved Meta/Facebook App and an
 * `access_token` (`{app-id}|{client-token}`) on every request. Without one
 * configured, this module does NOT pretend to succeed with an empty
 * result — it returns the explicit, typed `missing_credentials` failure
 * below, before making any network call at all. The app must degrade
 * honestly (per the brief) rather than silently show nothing and leave a
 * caller guessing why.
 *
 * Every other expected failure — a 404 for a deleted/private post, a 429
 * for rate limiting, a region-locked post, a malformed response body — is
 * likewise modeled as a typed `reason`, never thrown. `resolveOembed`
 * itself is the only function here that can reject its returned promise,
 * and only for a genuine transport-level exception (`fetchFn` itself
 * throwing/rejecting), which is caught and converted into
 * `{ kind: 'error', reason: 'network_error' }` too — callers never need a
 * try/catch around this.
 *
 * No network calls happen inside this module's own logic beyond the single
 * injected `fetchFn` call — that's the whole reason `fetchFn` is a
 * parameter rather than a direct reference to the global `fetch`: tests
 * stub it, nothing here ever touches a real network.
 */

export type OembedPlatform = 'tiktok' | 'instagram';

/**
 * Every failure mode this client can report. `region_locked` and
 * `rate_limited` are real, documented failure modes for both platforms
 * (per the brief), not speculative — but neither platform documents a
 * dedicated HTTP status code for "region-locked" specifically, so this
 * client infers it from HTTP 403 (the closest documented behavior for a
 * request the platform refuses to fulfil for a reason other than "not
 * found"). Confirm against live traffic before relying on this
 * distinction in production; see `classifyErrorStatus` below.
 */
export type OembedErrorReason =
  | 'invalid_url'
  | 'missing_credentials'
  | 'not_found'
  | 'region_locked'
  | 'rate_limited'
  | 'invalid_response'
  | 'network_error'
  | 'unknown_error';

/** oEmbed fields this app actually uses. Deliberately narrow — see the file header on why the video itself is never part of this shape. */
export interface OembedPayload {
  readonly thumbnailUrl: string | null;
  readonly title: string | null;
  readonly authorName: string | null;
  /**
   * The creator's profile URL. Both TikTok and Instagram return this as
   * `author_url`. It is carried because attribution without a link back to
   * the creator is weak attribution — and a display name cannot be turned
   * into a profile URL reliably, since an oEmbed `author_name` is not a
   * URL-safe handle.
   */
  readonly authorUrl: string | null;
}

/** Discriminated union result, matching the style of src/domain/types.ts's `DecisionResult`. */
export type OembedResult =
  | { readonly kind: 'ok'; readonly payload: OembedPayload }
  | { readonly kind: 'error'; readonly reason: OembedErrorReason };

/**
 * The minimal shape this module needs from a fetch call — deliberately not
 * `typeof fetch` / the DOM `Response` type, so this file has zero
 * dependency on which `lib` the project's tsconfig happens to include.
 * A real `fetch` satisfies this structurally; a test stub only needs to
 * implement these three members.
 */
export interface OembedFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}

export type OembedFetchFunction = (requestUrl: string) => Promise<OembedFetchResponse>;

export interface OembedClientConfig {
  readonly fetchFn: OembedFetchFunction;
  /**
   * Instagram oEmbed's required `{app-id}|{client-token}` credential.
   * Undefined or blank means "not configured" — every Instagram resolution
   * fails with `missing_credentials`, never a silent empty result. Not
   * needed for `platform: 'tiktok'`.
   */
  readonly instagramAccessToken?: string;
}

const TIKTOK_OEMBED_ENDPOINT = 'https://www.tiktok.com/oembed';
// Graph API versions are sunset roughly two years after release, and a
// call to a retired version fails in a way that looks exactly like a bad
// token — so this is pinned deliberately and needs revisiting, not left
// to drift. v19 was already past its window; v25 is current as of this
// change. TikTok needs no equivalent: its oEmbed endpoint is public and
// unversioned.
const INSTAGRAM_OEMBED_ENDPOINT = 'https://graph.facebook.com/v25.0/instagram_oembed';

const TIKTOK_URL_PATTERN = /^https:\/\/(www\.)?tiktok\.com\/.+/i;
const INSTAGRAM_URL_PATTERN = /^https:\/\/(www\.)?instagram\.com\/.+/i;

function isValidSourceUrl(sourceUrl: string, platform: OembedPlatform): boolean {
  const pattern = platform === 'tiktok' ? TIKTOK_URL_PATTERN : INSTAGRAM_URL_PATTERN;
  return pattern.test(sourceUrl);
}

type RequestUrlResolution =
  | { readonly kind: 'ok'; readonly requestUrl: string }
  | { readonly kind: 'error'; readonly reason: 'missing_credentials' };

function buildRequestUrl(
  sourceUrl: string,
  platform: OembedPlatform,
  config: OembedClientConfig,
): RequestUrlResolution {
  if (platform === 'tiktok') {
    return { kind: 'ok', requestUrl: `${TIKTOK_OEMBED_ENDPOINT}?url=${encodeURIComponent(sourceUrl)}` };
  }
  const token = config.instagramAccessToken;
  if (token === undefined || token.trim().length === 0) {
    return { kind: 'error', reason: 'missing_credentials' };
  }
  const requestUrl =
    `${INSTAGRAM_OEMBED_ENDPOINT}?url=${encodeURIComponent(sourceUrl)}` +
    `&access_token=${encodeURIComponent(token)}`;
  return { kind: 'ok', requestUrl };
}

/**
 * Maps an HTTP status to a specific typed reason where the brief calls one
 * out explicitly (404, 429, and the inferred region-lock case — see the
 * `OembedErrorReason` doc comment above). Any other non-2xx status falls
 * through to the generic `unknown_error` in `fetchAndParse`, rather than
 * this function claiming certainty it doesn't have.
 */
function classifyErrorStatus(status: number): OembedErrorReason | null {
  if (status === 404) {
    return 'not_found';
  }
  if (status === 429) {
    return 'rate_limited';
  }
  if (status === 403) {
    return 'region_locked';
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Narrows an untrusted response body into `OembedPayload`, or `null` if it
 * isn't shaped like one at all. Never trusts the network's declared
 * content-type or status alone — a 200 response with an unrelated JSON
 * body (an HTML error page a proxy mistakenly labeled as JSON, a
 * completely different API shape) must not be silently accepted as valid
 * oEmbed data. A payload with all three fields empty is treated the same
 * way: a genuine oEmbed video response always carries at least a title or
 * a thumbnail, so an all-null result is more likely a malformed body than
 * real data.
 */
function parseOembedPayload(raw: unknown): OembedPayload | null {
  if (!isRecord(raw)) {
    return null;
  }
  const payload: OembedPayload = {
    thumbnailUrl: readOptionalString(raw.thumbnail_url),
    title: readOptionalString(raw.title),
    authorName: readOptionalString(raw.author_name),
    authorUrl: readOptionalString(raw.author_url),
  };
  const isEntirelyEmpty = payload.thumbnailUrl === null && payload.title === null && payload.authorName === null;
  return isEntirelyEmpty ? null : payload;
}

/**
 * Meta reports an unapproved oEmbed Read feature as a 400 carrying
 * `error.code === 10` — literally: "To use Meta oEmbed Read, your use of
 * this endpoint must be reviewed and approved by Facebook." That is a
 * credential problem, not an unknown one: the token authenticates fine, it
 * simply is not cleared for this endpoint, and no retry will change that.
 *
 * Mapping it onto `missing_credentials` reuses copy that is already exactly
 * right — "Instagram-links kan Remy op dit moment nog niet ophalen" — rather
 * than the generic `unknown_error`, which implies something transient broke
 * and invites a pointless retry. A 400 whose body we do not recognise still
 * falls through to `unknown_error`.
 */
function classifyMetaErrorBody(raw: unknown): OembedErrorReason | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const error = (raw as { readonly error?: unknown }).error;
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  return (error as { readonly code?: unknown }).code === 10 ? 'missing_credentials' : null;
}

async function fetchAndParse(requestUrl: string, fetchFn: OembedFetchFunction): Promise<OembedResult> {
  let response: OembedFetchResponse;
  try {
    response = await fetchFn(requestUrl);
  } catch {
    return { kind: 'error', reason: 'network_error' };
  }

  const classifiedReason = classifyErrorStatus(response.status);
  if (classifiedReason !== null) {
    return { kind: 'error', reason: classifiedReason };
  }
  if (!response.ok) {
    // The body is read only on the failure path, and only to tell a
    // known provider error apart from a genuinely unknown one.
    const errorBody: unknown = await response.json().catch(() => null);
    return { kind: 'error', reason: classifyMetaErrorBody(errorBody) ?? 'unknown_error' };
  }

  let rawBody: unknown;
  try {
    rawBody = await response.json();
  } catch {
    return { kind: 'error', reason: 'invalid_response' };
  }

  const payload = parseOembedPayload(rawBody);
  if (payload === null) {
    return { kind: 'error', reason: 'invalid_response' };
  }
  return { kind: 'ok', payload };
}

/**
 * Resolves one TikTok or Instagram post URL to its oEmbed metadata.
 * Never throws for an expected failure — every reachable error path
 * returns `{ kind: 'error', reason }` instead. See the file header for the
 * full list of modeled reasons.
 */
export async function resolveOembed(
  sourceUrl: string,
  platform: OembedPlatform,
  config: OembedClientConfig,
): Promise<OembedResult> {
  if (!isValidSourceUrl(sourceUrl, platform)) {
    return { kind: 'error', reason: 'invalid_url' };
  }

  const requestUrlResolution = buildRequestUrl(sourceUrl, platform, config);
  if (requestUrlResolution.kind === 'error') {
    return { kind: 'error', reason: requestUrlResolution.reason };
  }

  return fetchAndParse(requestUrlResolution.requestUrl, config.fetchFn);
}

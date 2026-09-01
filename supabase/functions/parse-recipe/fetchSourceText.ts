/**
 * ---------------------------------------------------------------------------
 * EVERY OUTBOUND REQUEST TO A HOST A USER CHOSE
 * ---------------------------------------------------------------------------
 *
 * Three of them, and nothing else in this function makes a fourth:
 *
 *  - an ordinary web page (SRC-01), fetched as HTML so that
 *    `extractRecipeFromHtml` can read its JSON-LD with no model call at all;
 *  - the YouTube Data API's `videos.list` endpoint (SRC-02/SRC-03), whose
 *    description feeds the existing caption pipeline; and
 *  - the TikTok short-link redirect chain (IMP-01, at the foot of this
 *    file), which resolves a `vm.`/`vt.` share code to the canonical URL
 *    oEmbed will accept.
 *
 * The two readers return the same typed `SourceFetchOutcome` — never a
 * throw, never an empty-but-successful answer — so index.ts can map either
 * failure straight onto `{ kind: 'source_fetch_failed', reason, platform }`
 * and stay a pipeline instead of becoming a fetch client. NEITHER READER
 * NAMES THE PLATFORM ITSELF, and that stays true deliberately: a reader
 * knows which endpoint it called, but the platform is the pipeline's own
 * classification of the pasted URL (`normalizeRecipeUrl`), and having two
 * modules able to state it is how the two answers start disagreeing. Each
 * caller in index.ts adds it at the one line that already branched on it. (The oEmbed and Gemini calls
 * are the deliberate exceptions: both go to a fixed endpoint this repo
 * chose, carry a credential, and already have owners — src/lib/oembed.ts and
 * callExtractionModel.ts, which makes the same blast-radius argument for the
 * Gemini key that this file makes for the YouTube one.)
 *
 * WHY THIS IS ITS OWN FILE. Two reasons, and the second is the real one.
 * index.ts was already ~700 lines against this repo's 800-line ceiling, so
 * these routes had to go somewhere — but WHERE was decided by cohesion,
 * exactly as canonicalRecipeStore.ts was: that module owns every line that
 * touches the service role key, and this one owns every line that opens a
 * socket to A HOST A USER CHOSE. That is a security surface worth being able
 * to read in one sitting. In a 900-line request handler, "does anything here
 * fetch an arbitrary URL, and what does it do with the response" is a
 * question a reviewer has to take on trust; here it is the whole file.
 *
 * ---
 *
 * THE SSRF SURFACE HERE IS GENUINELY WORSE THAN THE ONE IMP-01 CLOSED, SO
 * THE MITIGATIONS ARE NOT OPTIONAL.
 *
 * `expandShortLink`, at the foot of this file, follows a redirect chain
 * that always STARTS at one of two hardcoded TikTok hostnames, issues HEAD
 * only, and never reads a body — so the worst case there is blind SSRF against TikTok's own
 * redirector, which is what resolveShortLinkTarget.ts's header says in as
 * many words. This file breaks all three of those comforts at once:
 *
 *  - the host is whatever the user pasted, not one this repo chose;
 *  - the request is a GET, not a HEAD; and
 *  - THE BODY IS READ, AND WHAT IT SAYS BECOMES THE RESPONSE. An internal
 *    endpoint's output would not merely be touched here, it would be parsed
 *    and handed back to the caller as a recipe.
 *
 * So the same three IMP-01 mitigations apply, reusing the SAME pure,
 * unit-tested functions rather than a second, weaker copy of them — a second
 * copy is precisely how one of them quietly stops matching the other:
 *
 *  - `isBlockedRedirectHost` refuses loopback/private/link-local (cloud
 *    metadata) destinations BEFORE the first request, and again — through
 *    `resolveRedirectTarget` — for every hop after it. The pure gate in
 *    `normalizeRecipeUrl` cannot do this job alone: it sees only the URL the
 *    user pasted, and the address actually fetched can be three redirects
 *    away from that. Checking the pasted host a second time is belt and
 *    braces; checking each redirect target is the part nothing else does.
 *  - `MAX_SHORT_LINK_REDIRECT_HOPS` bounds the chain, and `redirect:
 *    'manual'` is what makes that bound OURS. Handing `redirect: 'follow'`
 *    to the runtime would delegate both the cap and the per-hop host check
 *    to a fetch implementation this repo cannot read, audit or test — the
 *    argument the short-link section at the foot of this file already makes
 *    at length, which applies with more force to an arbitrary host.
 *  - a per-request `AbortController` timeout, because a hanging publisher
 *    must not hang this function. It is deliberately larger than
 *    `SHORT_LINK_HOP_TIMEOUT_MS`: that budget covers a HEAD against TikTok,
 *    this one covers a whole HTML body from a food blog on shared hosting.
 *
 * WHY THE HOP BOUND IS REUSED RATHER THAN GIVEN ITS OWN CONSTANT. It is the
 * same decision about the same class of risk — how far this function will
 * chase a third party before giving up — and two constants would be two
 * numbers to keep in agreement with nothing to notice when they drift.
 * Redirect chains on recipe URLs are short and boring in practice (http to
 * https, apex to www, the occasional share-link shim); five is generous.
 *
 * WHY THIS LOOP IS NOT `expandShortLink`. They look alike and are not the
 * same function. That one issues HEAD, never reads a body, and returns null
 * when the URL never redirected at all (for it, "no redirect" means the
 * short link resolved to nothing usable). This one issues GET, must hold on
 * to the terminal RESPONSE rather than its URL, and treats "never
 * redirected" as the normal case. Merging them yields one function with two
 * methods, two return shapes and a flag — while the parts genuinely worth
 * sharing (the hop bound, the Location resolution, the host refusal) ARE
 * shared already, because those are the pure ones.
 *
 * WHAT IS DELIBERATELY NOT ATTEMPTED, same as resolveShortLinkTarget.ts:
 * DNS-level SSRF hardening. A hostname that RESOLVES to a private address
 * still passes (DNS rebinding); catching it needs a resolve-and-connect race
 * this runtime does not expose. The literal-IP case — the one an open
 * redirect actually hands you — is closed. Recorded here rather than
 * silently skipped.
 *
 * ---
 *
 * THE BODY CAP IS A DENIAL-OF-SERVICE CONTROL, NOT A TIDINESS ONE. An
 * unbounded read of a URL a stranger chose is a way to make this function
 * spend its memory and its wall clock on someone else's terms. So the body
 * is read as a STREAM and abandoned the moment the running byte total passes
 * `MAX_RECIPE_PAGE_BYTES`. `Content-Length` is checked first, but only as an
 * optimization: it is optional, it is routinely absent under chunked
 * transfer encoding, and a hostile server can simply lie. A
 * Content-Length-only check is not a cap at all — it is a cap against
 * servers that were not trying.
 *
 * NO VIDEO, AUDIO OR IMAGE BINARY IS EVER FETCHED HERE (SRC-09). This file
 * reads a page's own published metadata and a documented JSON API, exactly
 * like the oEmbed client beside it. Downloading a video to transcribe its
 * audio or OCR its on-screen text stays out of scope on copyright grounds —
 * see index.ts's SCOPE section and types.ts's header. The short-link chain
 * below is HEAD-only and never reads a body at all, for the same reason. The `isHtmlContentType`
 * refusal below happens BEFORE a single body byte is read, which is also,
 * incidentally, what stops this route from ever pulling a media file down by
 * accident.
 *
 * ---
 *
 * WHAT AN HTTP STATUS IS ALLOWED TO MEAN.
 *
 * `mapHttpStatusToReason` below is the only status judgement in this file and
 * it feeds BOTH readers, so what it decides is what a user is eventually told
 * about a page fetch AND about a YouTube lookup. It used to collapse every
 * 4xx into `not_found` — "we couldn't find that page" — about two situations
 * that are not that: a publisher refusing an automated reader, and a quota or
 * rate limit. Those are different facts with different fixes, one permanent
 * and about us, the other temporary and about volume, and `not_found` was
 * wrong about both. `SourceFetchFailureReason` carries `forbidden` and
 * `rate_limited` now (types.ts), so this file can stop rounding.
 *
 * THE STATUS IS ALL WE GET AND WE DO NOT GUESS PAST IT. A 403 is genuinely
 * ambiguous on the YouTube route in particular; `mapHttpStatusToReason`
 * records how that was resolved and why the detail that disambiguates it
 * belongs in the log line `logYouTubeApiRejection` already writes rather than
 * in a reason code a user is shown.
 *
 * ---
 *
 * THE YOUTUBE KEY travels in an `x-goog-api-key` header and never in the
 * query string, for the same reason `GEMINI_API_KEY` does (index.ts's
 * SECURITY note, and callExtractionModel.ts's header): query strings end up
 * in proxy logs, referrer headers and
 * error reports, and a header does not. It is never logged and never
 * returned. Its ABSENCE is a first-class typed outcome —
 * `missing_credentials`, the same answer Instagram gives without its oEmbed
 * token — and specifically not a boot-time throw, which would take TikTok
 * and the web route down over a key neither uses; env.ts's header carries
 * that argument in full.
 *
 * THE `.ts` EXTENSIONS ON THE IMPORTS BELOW ARE LOAD-BEARING, not a style
 * choice — see index.ts's header for Deno's resolution rule. Dropping one
 * fails neither `tsc --noEmit` nor `npm run lint` (this directory is
 * excluded from both); it fails the deploy.
 */

import { isHtmlContentType, MAX_RECIPE_PAGE_BYTES } from '../../../src/domain/import/htmlJsonLd.ts';
import {
  isBlockedRedirectHost,
  MAX_SHORT_LINK_REDIRECT_HOPS,
  resolveRedirectTarget,
} from '../../../src/domain/import/resolveShortLinkTarget.ts';
import { buildYouTubeVideosUrl, parseYouTubeVideoSnippet } from '../../../src/domain/import/youtubeVideoSnippet.ts';
import type { YouTubeVideoSnippet } from '../../../src/domain/import/youtubeVideoSnippet.ts';
import type { SourceFetchFailureReason } from '../../../src/domain/import/types.ts';
import { readOptionalEnvVar } from './env.ts';

/**
 * Whatever the fetch produced, or the one honest reason it did not. Generic
 * because the two exported readers differ only in what a SUCCESS carries —
 * page HTML, or a parsed video snippet — and never in how a failure is
 * shaped.
 */
export type SourceFetchOutcome<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'failed'; readonly reason: SourceFetchFailureReason };

type SourceFetchFailure = { readonly kind: 'failed'; readonly reason: SourceFetchFailureReason };

function failed(reason: SourceFetchFailureReason): SourceFetchFailure {
  return { kind: 'failed', reason };
}

/**
 * Bigger than `SHORT_LINK_HOP_TIMEOUT_MS` below on purpose: that budget
 * covers a HEAD against TikTok's redirector, this one covers a whole HTML
 * document from an arbitrary publisher — and it must stay armed while the
 * body streams, since a server that sends headers instantly and then
 * dribbles bytes forever is otherwise unbounded.
 */
const RECIPE_PAGE_REQUEST_TIMEOUT_MS = 8000;

/** One small JSON document from one of Google's own endpoints. Nothing here justifies the page budget. */
const YOUTUBE_API_REQUEST_TIMEOUT_MS = 5000;

/** Matches the truncation index.ts and canonicalRecipeStore.ts already use when logging a third party's error body. */
const MAX_LOGGED_BODY_CHARS = 600;

/**
 * Sent on every page request. The user agent identifies this importer
 * honestly rather than impersonating a browser: a publisher who does not
 * want automated readers should be able to recognise and refuse one, and
 * that refusal is a legitimate answer we surface as a typed failure rather
 * than something to route around. `accept-language` asks for the Dutch
 * variant of a page that serves several, because the recipe this app stores
 * is the one its user will cook from; a site that ignores the header simply
 * returns what it always would.
 */
const RECIPE_PAGE_REQUEST_HEADERS: Record<string, string> = {
  accept: 'text/html,application/xhtml+xml',
  'accept-language': 'nl,en;q=0.8',
  'user-agent': 'RemyRecipeImport/1.0',
};

/** Their side broke: the floor of the 5xx range. */
const HTTP_SERVER_ERROR_STATUS = 500;
/** The floor of the 4xx range — at or above it, the request is the problem. */
const HTTP_CLIENT_ERROR_STATUS = 400;
/** Too many requests: the one status that is explicitly about volume and time. */
const HTTP_TOO_MANY_REQUESTS_STATUS = 429;

/** No credential was accepted. */
const HTTP_UNAUTHORIZED_STATUS = 401;
/** A credential was accepted and the answer is still no — or none was wanted. */
const HTTP_FORBIDDEN_STATUS = 403;
/** Unavailable for legal reasons: a block, stated as one. */
const HTTP_LEGAL_REASONS_STATUS = 451;

/**
 * The three statuses that all say the same thing — THEY will not serve US —
 * whether the stated cause is a missing credential, a refused one, or a legal
 * block. A `readonly` list because it is a fixed fact about HTTP, not state.
 */
const FORBIDDEN_STATUSES: readonly number[] = [
  HTTP_UNAUTHORIZED_STATUS,
  HTTP_FORBIDDEN_STATUS,
  HTTP_LEGAL_REASONS_STATUS,
];

/**
 * The only HTTP-status judgement in this file, in one place so its two
 * callers cannot drift apart.
 *
 * THE IMPRECISION FLAGGED HERE LAST WAVE IS DISCHARGED. This used to answer
 * every 4xx with `not_found` and say so in a comment, because widening the
 * vocabulary was a domain decision and `SourceFetchFailureReason` did not
 * have the words. It has them now. Note what did NOT change: `refused` still
 * means WE refused, in our own SSRF guard above, and no status maps to it.
 * `refused` and `forbidden` are one word apart in English and opposite in
 * blame; they are never interchangeable.
 *
 *  - 401/403/451 -> `forbidden`. One fact from the user's side (this source
 *    will not be served to us) with one absence of a user-side fix. Splitting
 *    them would produce reason codes no piece of copy could say anything
 *    different about.
 *  - 429 -> `rate_limited`, alone, because it is the one status that is
 *    genuinely TEMPORARY. That is the entire reason the word exists: a
 *    failure a later retry fixes must not wear the same label as one no
 *    retry will ever fix.
 *  - every other 4xx -> `not_found`, which is now true of what is left.
 *  - 5xx -> `server_error`, unchanged.
 *
 * THE YOUTUBE 403 IS A REAL AMBIGUITY AND WAS NOT MISSED. The Data API
 * answers 403 both when a video is genuinely closed to us and when this
 * project's daily quota is spent, and Google returns the same status for
 * both. Resolved to `forbidden` for both, deliberately rather than by
 * defaulting:
 *
 *  - `rate_limited` promises a retry that soon works. YouTube quota resets on
 *    a daily boundary, so that promise would be false for the MORE likely of
 *    the two meanings — and this pipeline's whole posture is that it never
 *    states something the source did not give it.
 *  - `forbidden` is true of both meanings: "they would not serve us" holds
 *    whether the refusal was about that video or about our billing.
 *  - The detail that actually separates them is Google's own `error.reason`
 *    in the response body, which `logYouTubeApiRejection` already logs in
 *    full. That distinction is operational — somebody has to raise a quota or
 *    fix a key — so it belongs in the log an operator reads, not in a reason
 *    code shown to a user who can act on neither.
 *
 * Branching on that body here was the rejected alternative: it would put a
 * Google-shaped JSON judgement in the one file nothing type-checks, tests or
 * lints, to produce a distinction no user-facing copy would use.
 */
function mapHttpStatusToReason(status: number): SourceFetchFailureReason {
  if (status >= HTTP_SERVER_ERROR_STATUS) {
    return 'server_error';
  }
  if (FORBIDDEN_STATUSES.includes(status)) {
    return 'forbidden';
  }
  if (status === HTTP_TOO_MANY_REQUESTS_STATUS) {
    return 'rate_limited';
  }
  if (status >= HTTP_CLIENT_ERROR_STATUS) {
    return 'not_found';
  }
  // A 1xx/2xx that still failed `response.ok`. Not a modeled outcome;
  // treating it as a transport-level surprise is the honest bucket.
  return 'network_error';
}

/**
 * Reads the hostname off a URL we are about to fetch. The DECISION about
 * that hostname belongs to `isBlockedRedirectHost`, in the pure and
 * unit-tested domain layer; this is only the field read that gets it there,
 * which is why it lives in the shell and stays this small.
 */
function readHttpHostname(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.hostname;
  } catch {
    return null;
  }
}

/** Releases a response's body without reading it — a redirect hop, or a response we have already decided to refuse. */
async function discardBody(response: Response): Promise<void> {
  const body = response.body;
  if (body === null) {
    return;
  }
  try {
    await body.cancel();
  } catch {
    // Cancelling an already-errored stream throws and means nothing here.
  }
}

/**
 * A declared `Content-Length` over budget lets us refuse before reading a
 * byte. An absent, unparseable or lying header returns false and the real
 * cap — the streaming one below — does the work. That is why this is an
 * optimization rather than a control, and why it is fine for it to live in
 * this unchecked file: on its own it decides nothing that matters.
 */
function exceedsDeclaredLength(contentLengthHeader: string | null): boolean {
  if (contentLengthHeader === null) {
    return false;
  }
  const declaredBytes = Number.parseInt(contentLengthHeader, 10);
  return Number.isFinite(declaredBytes) && declaredBytes > MAX_RECIPE_PAGE_BYTES;
}

type BodyReadOutcome =
  | { readonly kind: 'ok'; readonly text: string }
  | { readonly kind: 'too_large' }
  | { readonly kind: 'error' };

/**
 * Reads a response body as text, abandoning it the moment it exceeds
 * `MAX_RECIPE_PAGE_BYTES`. THE CAP COUNTS BYTES OFF THE WIRE, not decoded
 * characters: bytes are what actually cost this function memory, and bytes
 * are the number the sender controls.
 *
 * `TextDecoder` is non-fatal by design — a publisher serving broken UTF-8
 * gets U+FFFD in place of the bad bytes rather than failing the whole
 * import, because the JSON-LD block this route is after is almost always
 * ASCII and a mangled accent in unrelated body copy should not cost the user
 * their recipe. `{ stream: true }` is what makes that safe across chunk
 * boundaries: a multi-byte character split across two reads is held until it
 * completes instead of being corrupted at the seam.
 */
async function readCappedBody(response: Response): Promise<BodyReadOutcome> {
  const body = response.body;
  if (body === null) {
    return { kind: 'error' };
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) {
        return { kind: 'ok', text: text + decoder.decode() };
      }
      byteCount += chunk.value.byteLength;
      if (byteCount > MAX_RECIPE_PAGE_BYTES) {
        await reader.cancel();
        return { kind: 'too_large' };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch {
    // A mid-stream transport failure, or the request timeout firing. Both
    // mean the same thing to the caller: there is no page here.
    return { kind: 'error' };
  }
}

/**
 * Turns the response the chain ended on into an outcome. The order is
 * deliberate: status first (a 404 page's body is not worth reading), then
 * content type (a PDF or a video is refused before a byte is read — see the
 * file header's SRC-09 note), then the declared length, and only then the
 * body itself.
 */
async function readTerminalPageResponse(response: Response): Promise<SourceFetchOutcome<string>> {
  if (!response.ok) {
    await discardBody(response);
    return failed(mapHttpStatusToReason(response.status));
  }
  if (!isHtmlContentType(response.headers.get('content-type'))) {
    await discardBody(response);
    return failed('not_html');
  }
  if (exceedsDeclaredLength(response.headers.get('content-length'))) {
    await discardBody(response);
    return failed('too_large');
  }
  const body = await readCappedBody(response);
  if (body.kind === 'too_large') {
    return failed('too_large');
  }
  if (body.kind === 'error') {
    return failed('network_error');
  }
  return { kind: 'ok', value: body.text };
}

type PageHopOutcome =
  /** A 3xx. `location` is null when the server sent one without the header — nothing to follow. */
  | { readonly kind: 'redirect'; readonly location: string | null }
  | { readonly kind: 'terminal'; readonly outcome: SourceFetchOutcome<string> }
  | { readonly kind: 'error' };

/**
 * One GET, with its own timeout, resolved either into "follow this" or into
 * the final answer.
 *
 * `readTerminalPageResponse` is awaited INSIDE this try/finally on purpose:
 * that keeps the abort signal armed while the body streams, so the timeout
 * bounds the whole exchange rather than just the moment the headers
 * arrived. Reading the body after `clearTimeout` would leave the slowest and
 * cheapest attack on this function completely unguarded.
 */
async function requestPageHop(url: string): Promise<PageHopOutcome> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RECIPE_PAGE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'GET',
      // Never 'follow' — see the file header. The cap and the per-hop host
      // check have to be ours.
      redirect: 'manual',
      headers: RECIPE_PAGE_REQUEST_HEADERS,
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await discardBody(response);
      return { kind: 'redirect', location };
    }
    return { kind: 'terminal', outcome: await readTerminalPageResponse(response) };
  } catch {
    // DNS, TLS, a connection reset, or the timeout firing — deliberately
    // indistinguishable, because they are the same answer to the caller.
    return { kind: 'error' };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetches an ordinary web page as HTML, following its redirect chain
 * ourselves under every guard the file header describes. Returns the page's
 * text and never a parsed recipe: what the markup MEANS is decided by
 * `extractRecipeFromHtml` in the pure domain layer, and this function is
 * only the part that could not live there.
 *
 * Deliberately NOT validated against `normalizeRecipeUrl` the way
 * `validateShortLinkTarget` validates a short link's destination. For the
 * web route, "a host this repo has never heard of" is not a red flag, it is
 * the entire feature. `isBlockedRedirectHost` on every hop is the check that
 * still applies, and it is the one that was actually protecting anything.
 */
export async function fetchRecipePageHtml(pageUrl: string): Promise<SourceFetchOutcome<string>> {
  const hostname = readHttpHostname(pageUrl);
  if (hostname === null || isBlockedRedirectHost(hostname)) {
    return failed('refused');
  }

  let currentUrl = pageUrl;
  for (let hop = 0; hop < MAX_SHORT_LINK_REDIRECT_HOPS; hop += 1) {
    const hopOutcome = await requestPageHop(currentUrl);
    if (hopOutcome.kind === 'error') {
      return failed('network_error');
    }
    if (hopOutcome.kind === 'terminal') {
      return hopOutcome.outcome;
    }
    if (hopOutcome.location === null) {
      // A 3xx with no Location. Not our refusal, and not a status class we
      // model, so it takes the transport bucket: the exchange produced
      // nothing followable.
      return failed('network_error');
    }
    const nextUrl = resolveRedirectTarget(currentUrl, hopOutcome.location);
    if (nextUrl === null) {
      // OUR guard said no: a non-http(s) scheme, or a loopback/private/
      // link-local host. Refused, and never fetched.
      return failed('refused');
    }
    currentUrl = nextUrl;
  }
  // The bound is the point — see the file header. Exhausting it is a
  // refusal, not a reason to keep going.
  return failed('refused');
}

/**
 * Read once, at module load, and never logged. Null means the secret is
 * unset or blank, which every caller must treat as `missing_credentials` —
 * see env.ts's header for why this one does not throw the way
 * `GEMINI_API_KEY` does. It lives in this module rather than index.ts for
 * the same reason canonicalRecipeStore.ts keeps the service role key and
 * callExtractionModel.ts keeps the Gemini one: a credential whose blast
 * radius is one importable file is one a reviewer can actually bound.
 */
const YOUTUBE_API_KEY = readOptionalEnvVar('YOUTUBE_API_KEY');

/**
 * Logs a non-2xx from the Data API, for the same reason
 * `callExtractionModel` logs Gemini's (callExtractionModel.ts): a bad key, a
 * disabled API
 * and an exhausted quota are told apart by status and message, and
 * swallowing them makes an outage undebuggable from outside — all three
 * reach the user as the same failure copy. The request carries no user
 * secrets and the key travels in a header, so neither can appear here.
 *
 * THIS IS ALSO THE 403 DISAMBIGUATOR, which is now load-bearing rather than
 * incidental: `mapHttpStatusToReason` deliberately answers "quota spent" and
 * "video closed to us" with the same `forbidden`, because the status cannot
 * tell them apart and guessing would be inventing a fact. Google's own
 * `error.reason` in the body below is what does tell them apart, and an
 * operator reading this line is the only person who can act on either.
 */
async function logYouTubeApiRejection(response: Response, videoId: string): Promise<void> {
  const detail = await response.text().catch(() => '<unreadable body>');
  console.error(
    `parse-recipe: YouTube Data API rejected the request. status=${response.status} ` +
      `videoId=${videoId} body=${detail.slice(0, MAX_LOGGED_BODY_CHARS)}`,
  );
}

/**
 * Reads one video's `snippet` from the YouTube Data API — the endpoint
 * displayOnlyPolicy.ts identifies as the LICENSED route for reading a
 * description, as opposed to YouTube's oEmbed endpoint, which carries the
 * same embedding-only restriction PD-011 rules out for Instagram. This
 * function is the whole reason a YouTube paste is not display-only; do not
 * "simplify" it into an oEmbed call.
 *
 * The URL comes from `buildYouTubeVideosUrl` (pure, tested, and carrying no
 * key), and the untrusted response body is narrowed by
 * `parseYouTubeVideoSnippet` (pure, tested). This function contributes the
 * request, the key, the timeout and the status mapping — and no judgement
 * whatsoever about what the JSON means.
 */
export async function fetchYouTubeVideoSnippet(videoId: string): Promise<SourceFetchOutcome<YouTubeVideoSnippet>> {
  if (YOUTUBE_API_KEY === null) {
    // Never silent: the import fails with the one reason that says exactly
    // what is wrong, and the fix is one `supabase secrets set` away.
    console.error('parse-recipe: YOUTUBE_API_KEY is not set, so YouTube imports cannot be fetched.');
    return failed('missing_credentials');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), YOUTUBE_API_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(buildYouTubeVideosUrl(videoId), {
      method: 'GET',
      headers: {
        accept: 'application/json',
        // A header, never a `?key=` query parameter — see the file header.
        'x-goog-api-key': YOUTUBE_API_KEY,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      await logYouTubeApiRejection(response, videoId);
      return failed(mapHttpStatusToReason(response.status));
    }

    const snippet = parseYouTubeVideoSnippet(await response.json());
    if (snippet === null) {
      // A 200 with an empty `items` array: the video is deleted, private, or
      // never existed. The API answers "no such video" with a success
      // status, so this is the branch that has to notice.
      return failed('not_found');
    }
    return { kind: 'ok', value: snippet };
  } catch (error) {
    // A transport failure, the timeout firing, or a body that was not JSON
    // at all — distinct from the non-2xx above, and worth telling apart in
    // the logs.
    console.error(`parse-recipe: YouTube Data API call threw before a usable response. ${String(error)}`);
    return failed('network_error');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * ---------------------------------------------------------------------------
 * THE TIKTOK SHORT-LINK CHAIN (IMP-01)
 * ---------------------------------------------------------------------------
 *
 * Moved here from index.ts, and not only for that file's line budget: this
 * module's rule is that every outbound request whose destination a user
 * influenced lives in one place, and a redirect chain starting at a pasted
 * `vm.tiktok.com` code is exactly that. Keeping it beside the page fetcher
 * also puts the two redirect loops where they can be compared — see the
 * file header's argument for why they are deliberately not one function.
 */

/**
 * TikTok's native share sheet copies a `vm.tiktok.com`/`vt.tiktok.com`
 * short link, not the canonical `www.tiktok.com/@user/video/...` form
 * oEmbed requires (see urlParsing.ts's file header). Resolving that needs
 * a real network round trip, so it lives here, not in the pure domain
 * layer.
 *
 * IMP-01. This used to hand the whole job to `redirect: 'follow'` and
 * trust whatever `response.url` came back with — which is exactly the
 * shape of request that should never be handed to an outbound fetch whose
 * ultimate destination is not one this function chose: an unbounded
 * redirect chain can hang the function on a slow or misbehaving
 * redirector, and an unvalidated destination hands oEmbed a URL nobody
 * here ever decided to trust. This now follows the chain manually, one hop
 * at a time, so it can enforce all three of IMP-01's constraints:
 *
 *  - a BOUNDED hop count (`MAX_SHORT_LINK_REDIRECT_HOPS`,
 *    resolveShortLinkTarget.ts) that THIS repo controls and a test can
 *    assert against, rather than whatever cap the runtime's own `fetch`
 *    happens to apply for `redirect: 'follow'`;
 *  - a per-hop TIMEOUT (`SHORT_LINK_HOP_TIMEOUT_MS` below), so a hanging
 *    third-party redirect cannot hang this function; and
 *  - VALIDATION of the URL the chain ends on (`validateShortLinkTarget`,
 *    resolveShortLinkTarget.ts) — re-run through the exact same
 *    `normalizeRecipeUrl` gate a pasted URL itself has to pass — before it
 *    is ever treated as resolved and handed to oEmbed.
 *
 * The hop-counting, Location-header and final-URL decisions are pure and
 * live in resolveShortLinkTarget.ts (src/domain/import/), where they are
 * unit-tested directly; this function is the thin, untestable-by-necessity
 * loop that actually makes the requests — see that file's header for the
 * full split, and for what is deliberately NOT attempted here (DNS-level
 * SSRF hardening of intermediate hops).
 *
 * HEAD-only, body never read, on every hop: this resolves the redirect
 * target, it does not fetch the video or any page content — no video is
 * downloaded anywhere in this function, matching this file header's SRC-09
 * note. Best-effort: ANY failure here (a timed-out or failed hop, too many
 * hops, an unfetchable Location header, or a final URL that fails
 * validation) simply returns null and falls through to calling oEmbed with
 * the original short link, which fails honestly with its own typed
 * `invalid_url` reason (mapped to `oembed_failed` by the caller) rather
 * than this function throwing. No new `ImportResult` variant was needed to
 * close IMP-01 — every failure this can produce already had an honest typed
 * home.
 *
 * The third constraint above — validating the URL the chain ends on — is
 * applied by the CALLER, `resolveEffectiveUrl` in index.ts, and not here:
 * this function only reports where the chain stopped, and deciding whether
 * that destination is one this app resolves recipes from is the step that
 * turns a stopping point into a resolved URL. The split is unchanged by
 * this code having moved out of index.ts.
 */
const SHORT_LINK_HOP_TIMEOUT_MS = 4000;

/**
 * One HEAD request for one hop, with its own timeout. Returns the response
 * status and `Location` header, or null for ANY failure — a network error,
 * a DNS failure, or the timeout firing — deliberately indistinguishable
 * from each other here, since every one of them means the same thing to
 * the caller: give up on this hop.
 */
async function fetchRedirectHop(
  url: string,
): Promise<{ readonly status: number; readonly location: string | null } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SHORT_LINK_HOP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: controller.signal });
    return { status: response.status, location: response.headers.get('location') };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Manually follows a short link's redirect chain to a BOUNDED depth,
 * timing out any single hop that hangs. Returns the terminal URL (the one
 * a non-redirect response was returned for) with no validation performed
 * yet — `resolveEffectiveUrl` below is what validates it — or null for any
 * failure along the way, including never having redirected at all (a
 * non-redirect response on the very first hop means this "short link"
 * never actually pointed anywhere else).
 */
export async function expandShortLink(shortUrl: string): Promise<string | null> {
  let currentUrl = shortUrl;
  for (let hop = 0; hop < MAX_SHORT_LINK_REDIRECT_HOPS; hop += 1) {
    const hopResult = await fetchRedirectHop(currentUrl);
    if (hopResult === null) {
      return null;
    }
    const isRedirectStatus = hopResult.status >= 300 && hopResult.status < 400;
    if (!isRedirectStatus) {
      return currentUrl !== shortUrl ? currentUrl : null;
    }
    if (hopResult.location === null) {
      return null;
    }
    const nextUrl = resolveRedirectTarget(currentUrl, hopResult.location);
    if (nextUrl === null) {
      return null;
    }
    currentUrl = nextUrl;
  }
  // Exhausted MAX_SHORT_LINK_REDIRECT_HOPS without reaching a terminal
  // response — a bounded depth means this is a failure, not a longer wait.
  return null;
}

/**
 * Recognises and normalises a pasted recipe URL — the single gate a paste
 * has to pass before any network call is made. Pure: never throws, never
 * touches the network, never resolves a redirect (that's an I/O concern;
 * see the edge function's `expandShortLink`).
 *
 * Handles, per the brief:
 *  - desktop vs. mobile hosts (`m.tiktok.com` / `m.instagram.com` /
 *    `m.youtube.com`),
 *  - query-param / hash noise from a native share sheet
 *    (`?is_from_webapp=1&sender_device=pc`, `?igsh=...&utm_source=...`),
 *  - TikTok's short share links (`vm.tiktok.com`, `vt.tiktok.com`) — these
 *    are recognised (so a paste isn't wrongly rejected as unsupported) but
 *    NOT rewritten to a `www.tiktok.com/...` form, because their path is
 *    an opaque short code, not a real video id; only a server-side
 *    redirect (real I/O) can resolve what it actually points to. See
 *    `isShortLink` below.
 *  - YouTube's `www.youtube.com/watch?v=<id>`, bare `youtube.com`,
 *    `m.youtube.com`, `www.youtube.com/shorts/<id>`, and `youtu.be/<id>`
 *    short links (SRC-02/SRC-03) — see `normalizeYouTubeUrl` below for why
 *    YouTube, unlike TikTok's short links, needs no server-side redirect
 *    at all.
 *  - ANY OTHER http(s) page, as `'web'` — the LAST resort, reached only
 *    after every known platform host has failed to match. See
 *    `normalizeWebUrl` below, which is where the interesting decisions
 *    live.
 *
 * WHAT THE `'web'` FALLBACK CHANGES ABOUT THIS MODULE'S JOB. Until it, a
 * URL was either one of a handful of hostnames hardcoded here or it was
 * nothing, and "unsupported" was the overwhelmingly common answer. Now
 * `unsupported_url` means one of four specific things — not a web address
 * at all, a scheme we do not fetch, a host that names no page, or a host
 * pointing back at the machine this runs on — and everything else is a
 * fetch the edge function will genuinely attempt against a
 * user-controlled address. That promotes this function from an incidental
 * filter to the FIRST LINE OF SSRF DEFENCE, which is why
 * `isBlockedRedirectHost` is imported from resolveShortLinkTarget.ts and
 * reused verbatim rather than reimplemented: two copies of a
 * private-network blocklist is one copy too many, and the weaker copy is
 * always the one that ends up being called.
 *
 * PINTEREST FALLS OUT OF THIS FOR FREE, said out loud here because
 * otherwise someone will write a Pinterest branch. `pinterest.com/pin/<id>`
 * is an ordinary `'web'` URL, and so is the `pin.it` share-sheet short
 * link — the fetcher follows redirects (bounded and validated), so it
 * needs none of the `isShortLink` handling TikTok's `vm./vt.` hosts do. A
 * rich pin is generated from the SOURCE page's own schema.org data, so a
 * pin that carries Recipe JSON-LD parses like any other page, and one that
 * does not fails honestly as `no_recipe_on_page`.
 *
 * WHAT IS DELIBERATELY NOT DONE FOR PINTEREST, recorded rather than
 * silently skipped: reading a pin's outbound link and following it through
 * to the original publisher's page, which is where the full recipe usually
 * lives. Doing that needs knowledge of Pinterest's own markup, and
 * guessing at a third party's markup is exactly how a scraper starts
 * inventing data. It is a documented follow-up, not an omission.
 *
 * `src/lib/oembed.ts` (frozen, owned elsewhere) validates a URL again with
 * its own narrower regex (`^https:\/\/(www\.)?tiktok\.com\/.+`) before
 * ever calling out — this module's normalization is specifically designed
 * so an "ok" desktop/mobile TikTok/Instagram result always satisfies that
 * regex too. A short-link result may not; that's a known, explicitly typed
 * gap the edge function accounts for, not a silent one. `oembed.ts` is
 * simply not on the path for the other two platforms, which is why it has
 * no pattern for them: a `'youtube'` result is fetched through the Data
 * API (`readYouTubeVideoId` below hands the edge function the id that call
 * needs) and a `'web'` result through a plain page GET. This module only
 * decides whether a pasted URL is recognised and what its canonical,
 * deduplication-ready form is.
 */

// A deliberate import cycle: resolveShortLinkTarget.ts already imports
// `normalizeRecipeUrl` from here to validate where a redirect chain ended.
// Both directions are plain function declarations called at run time, never
// read while the modules evaluate, so the cycle is inert — and it is the
// cheaper of the two options, the other being a second, inevitably weaker
// copy of the blocklist. The `.ts` extension is required because this file
// is imported by the Deno edge function (see its header).
import { isBlockedRedirectHost } from './resolveShortLinkTarget.ts';
import type { ImportPlatform } from './types';

export type NormalizedUrlResult =
  | {
      readonly kind: 'ok';
      readonly platform: ImportPlatform;
      readonly normalizedUrl: string;
      /**
       * True only for `vm.tiktok.com` / `vt.tiktok.com` — see file header.
       * The caller must resolve the redirect before oEmbed will accept
       * this URL. `youtu.be` is a short link too (an opaque host, not the
       * canonical `youtube.com`) but is never flagged here: its path IS
       * the video id (see `normalizeYouTubeUrl`), so this module already
       * produces the final canonical form for it with no redirect needed —
       * unlike TikTok's `vm./vt.` codes, which carry no id this module can
       * read on its own. A `'web'` result is never flagged either, for a
       * third reason again: a generic URL may redirect and `pin.it` always
       * does, but the fetcher follows those itself rather than asking the
       * caller to resolve them first.
       */
      readonly isShortLink: boolean;
    }
  | { readonly kind: 'unsupported_url' };

const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);
const TIKTOK_SHORT_LINK_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);
/** `youtu.be` is YouTube's own short-link host — see file header on why it does not need the `isShortLink` treatment TikTok's short hosts do. */
const YOUTUBE_SHORT_LINK_HOSTS = new Set(['youtu.be']);

/**
 * The exact host and path of the one canonical YouTube form this module
 * emits. Named rather than inlined because `normalizeYouTubeUrl` writes
 * that form and `readYouTubeVideoId` reads it back: two literals would be
 * two chances for the writer and the reader to disagree about the same
 * string.
 */
const CANONICAL_YOUTUBE_HOST = 'www.youtube.com';
const YOUTUBE_WATCH_PATH = '/watch';

/**
 * `platform` is narrowed to the three this can actually name, NOT the full
 * `ImportPlatform`. `'web'` is by definition the absence of a host match —
 * `resolvePlatform` returning `null` is what produces it — so allowing it
 * in this shape would be a value that cannot occur, and its only effect
 * would be to stop the compiler from proving that `canonicalHost` below is
 * only ever asked about a platform it has a canonical host for.
 *
 * `'text'` IS EXCLUDED FOR A STRONGER VERSION OF THE SAME REASON (SRC-08),
 * and the exclusion had to be written by hand rather than inherited: a
 * pasted-text import never reaches this file at all, because there is no
 * URL to normalize. Leaving it in the type would have let a hostname
 * resolve to a route that by definition has no host — and the compiler
 * caught exactly that, refusing to hand `canonicalHost` a widened
 * parameter. That is the narrowing doing the job the paragraph above
 * claims for it, on the first union widening after it was written.
 */
interface HostResolution {
  readonly platform: Exclude<ImportPlatform, 'web' | 'text'>;
  readonly isShortLink: boolean;
}

/** Exact hostname matching only (a `Set`, never `.includes`/substring) — deliberately immune to suffix-spoofing hosts like `tiktok.com.evil.example`. */
function resolvePlatform(hostname: string): HostResolution | null {
  if (TIKTOK_HOSTS.has(hostname)) {
    return { platform: 'tiktok', isShortLink: false };
  }
  if (TIKTOK_SHORT_LINK_HOSTS.has(hostname)) {
    return { platform: 'tiktok', isShortLink: true };
  }
  if (INSTAGRAM_HOSTS.has(hostname)) {
    return { platform: 'instagram', isShortLink: false };
  }
  // Both host sets resolve to `isShortLink: false` — see the field's doc
  // comment above and `normalizeYouTubeUrl` below for why `youtu.be` never
  // needs the redirect-required flag TikTok's short hosts do.
  if (YOUTUBE_HOSTS.has(hostname) || YOUTUBE_SHORT_LINK_HOSTS.has(hostname)) {
    return { platform: 'youtube', isShortLink: false };
  }
  return null;
}

/**
 * Collapses desktop/mobile TikTok/Instagram host variants onto the
 * canonical `www.` host oembed.ts's own validation expects. Short-link
 * hosts are left untouched — see file header.
 *
 * The `platform` parameter is narrowed to the two platforms this actually
 * serves rather than taking the full `ImportPlatform`, and that narrowing
 * is the point. `normalizeYouTubeUrl` builds YouTube's canonical
 * host+path+query together (the id is not always in the path alone) and
 * `normalizeWebUrl` keeps a generic host as it found it, so neither ever
 * reaches here — but a `ImportPlatform`-shaped parameter would let the
 * final `else` silently hand a later platform an `instagram.com` host,
 * which is precisely the failure a two-branch ternary produced elsewhere
 * in this codebase when this union last grew. Typed this way, the caller
 * stops compiling instead.
 */
function canonicalHost(hostname: string, platform: 'tiktok' | 'instagram', isShortLink: boolean): string {
  if (isShortLink) {
    return hostname;
  }
  return platform === 'tiktok' ? 'www.tiktok.com' : 'www.instagram.com';
}

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

/**
 * YouTube video ids are an opaque token in YouTube's own URL-safe alphabet
 * (letters, digits, `-`, `_`) — 11 characters in every id YouTube has
 * issued so far. This is deliberately bounded but not pinned to exactly
 * 11: the point is not to validate YouTube's id format precisely, it is to
 * refuse building a normalized URL out of arbitrary attacker-controlled
 * text smuggled into `?v=` or a path segment (defense in depth — nothing
 * downstream executes this string, but a normalized URL is a
 * deduplication key other rows get matched against, and an id-shaped
 * value is the only thing that belongs there).
 */
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function isValidYouTubeVideoId(id: string): boolean {
  return YOUTUBE_VIDEO_ID_PATTERN.test(id);
}

function firstPathSegment(pathname: string): string | null {
  return pathname.split('/').find((segment) => segment.length > 0) ?? null;
}

/**
 * Extracts a video id from any of the three YouTube URL shapes this module
 * recognises: the `v` query parameter on `/watch`, the path segment on
 * `/shorts/<id>`, and the sole path segment on a `youtu.be` short link.
 * Returns `null` for a YouTube host + path this module doesn't recognise
 * as pointing at one specific video — a channel page, `/playlist`, a bare
 * host with no path — the same "no specific post to import" reasoning
 * `normalizeRecipeUrl` already applies to a bare TikTok/Instagram host.
 */
function extractYouTubeVideoId(parsed: URL, hostname: string): string | null {
  if (YOUTUBE_SHORT_LINK_HOSTS.has(hostname)) {
    const id = firstPathSegment(parsed.pathname);
    return id !== null && isValidYouTubeVideoId(id) ? id : null;
  }

  if (parsed.pathname === YOUTUBE_WATCH_PATH) {
    // The one deliberate exception to "never read query params" — see
    // `normalizeYouTubeUrl` below.
    const id = parsed.searchParams.get('v');
    return id !== null && isValidYouTubeVideoId(id) ? id : null;
  }

  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  if (segments[0] === 'shorts' && segments[1] !== undefined) {
    return isValidYouTubeVideoId(segments[1]) ? segments[1] : null;
  }

  return null;
}

/**
 * WHY YOUTUBE IS THE ONE PLATFORM WHOSE NORMALIZER READS A QUERY
 * PARAMETER. `normalizeRecipeUrl`'s TikTok/Instagram path deliberately
 * rebuilds its output from host + pathname only, discarding every query
 * string and hash by construction — that is what makes it immune to
 * share-sheet noise like `?is_from_webapp=1` or `?igsh=...&utm_source=...`.
 * For those two platforms the query string is never anything but noise:
 * the video id always lives in the path.
 *
 * YouTube's `/watch` URL shape is the opposite: `?v=<id>` is not noise, it
 * is the ONLY place the id appears in that shape. Stripping the query
 * string the way TikTok/Instagram normalization does would throw away the
 * one thing this function exists to preserve, and every `/watch?v=<id>`
 * import would collapse to the unusable `https://www.youtube.com/watch`
 * with no id at all. So this function reads exactly one query parameter,
 * explicitly, for exactly one path shape (`extractYouTubeVideoId` above) —
 * everything else about a YouTube URL (any OTHER query param, e.g. a
 * `/shorts/<id>?feature=share`'s `feature`, or `youtu.be/<id>?t=42`'s `t`)
 * is still discarded, exactly like TikTok/Instagram. This is a narrow,
 * explicit carve-out for one field on one path, not a general weakening of
 * the noise-stripping behavior the rest of this module relies on.
 */
function normalizeYouTubeUrl(parsed: URL, hostname: string): NormalizedUrlResult {
  const videoId = extractYouTubeVideoId(parsed, hostname);
  if (videoId === null) {
    return { kind: 'unsupported_url' };
  }
  return {
    kind: 'ok',
    platform: 'youtube',
    // Canonical form: always `https://www.youtube.com/watch?v=<id>`,
    // regardless of which of the three input shapes it came from.
    //
    // Chosen over `youtu.be/<id>` (shorter, but an opaque redirect-style
    // host that says nothing about the content and isn't itself a
    // dereferenceable page without a client following a redirect) and over
    // preserving `/shorts/<id>` (a Shorts video and its `/watch?v=`
    // counterpart are the SAME underlying video — the same id, the same
    // eventual Data API lookup — so keeping that presentation-only
    // distinction in the deduplication key would let one video dedupe
    // under two different canonical URLs depending on which UI surface it
    // was shared from). One shape, one row, one deduplication key — the
    // same reasoning `canonicalHost` already applies when it collapses
    // TikTok/Instagram's desktop and mobile hosts onto a single `www.`
    // form above.
    normalizedUrl: `https://${CANONICAL_YOUTUBE_HOST}${YOUTUBE_WATCH_PATH}?v=${videoId}`,
    isShortLink: false,
  };
}

/**
 * Reads a video id back out of the canonical `https://www.youtube.com/
 * watch?v=<id>` form `normalizeYouTubeUrl` above produces — nothing else.
 *
 * WHY IT LIVES HERE, BESIDE THE NORMALISER RATHER THAN IN THE FETCHER.
 * The YouTube Data API's `videos.list` takes an id, not a URL, so the edge
 * function needs one; and the only URL it ever holds by then is the
 * canonical form this module built. Putting the read anywhere else means
 * writing a second YouTube URL parser — in Deno code that neither
 * `tsc --noEmit` nor `npm run lint` nor any test in this repo covers — and
 * the two would drift the first time either shape changed. Keeping the
 * writer and the reader of a format in one file is the cheapest guarantee
 * that they still agree, and it costs a function.
 *
 * DELIBERATELY STRICT, and it will return null for URLs a human would say
 * obviously name a video: a `youtu.be` link, a `/shorts/<id>`, even a
 * `/watch?v=<id>&t=42`. This is not a general YouTube URL parser and must
 * not become one — it is the inverse of ONE function, and the way to
 * handle any other shape is to run it through `normalizeRecipeUrl` first,
 * which is the thing that knows how to canonicalise. A null here means
 * "you did not give me the canonical form", never "that video does not
 * exist".
 */
export function readYouTubeVideoId(normalizedUrl: string): string | null {
  const parsed = parseUrl(normalizedUrl.trim());
  if (parsed === null || parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== CANONICAL_YOUTUBE_HOST) {
    return null;
  }
  if (parsed.pathname !== YOUTUBE_WATCH_PATH) {
    return null;
  }
  // Exactly one parameter, and it is `v`: anything else is a URL some
  // other code path assembled, which is precisely what this function
  // refuses to guess about.
  const id = parsed.searchParams.get('v');
  if (id === null || Array.from(parsed.searchParams.keys()).length !== 1) {
    return null;
  }
  return isValidYouTubeVideoId(id) ? id : null;
}

/**
 * Query parameters we can be certain carry no page identity: campaign
 * tags a share sheet or an ad network appended, which every one of these
 * URLs resolves identically without. `utm_*` is a documented, open-ended
 * convention (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
 * `utm_term`, and whatever else a marketing tool invents), so it is
 * matched by prefix; the other three are single, named parameters from
 * Facebook, Google Ads and Instagram respectively.
 *
 * The list is short ON PURPOSE and must stay that way. Every entry is a
 * claim that a page is the same page with and without it, and for a
 * generic site that claim is only safe for parameters whose whole
 * documented purpose is attribution. `?p=`, `?id=`, `?page=`, `?ref=` and
 * friends look like noise and routinely are not — `?ref=` in particular is
 * a real path segment on plenty of CMSes. When in doubt the parameter
 * stays: a redundant deduplication key costs one extra `recipes` row,
 * where a wrongly-stripped one costs an import of the wrong page.
 */
const TRACKING_QUERY_PARAM_PREFIX = 'utm_';
const TRACKING_QUERY_PARAMS: ReadonlySet<string> = new Set(['fbclid', 'gclid', 'igsh']);

/** The raw `key=value` pair is inspected, never decoded: a percent-encoded `utm_source` is not something a real share sheet emits, and treating one as page identity costs a duplicate row rather than a wrong page. */
function isTrackingParam(rawPair: string): boolean {
  const separatorIndex = rawPair.indexOf('=');
  const key = (separatorIndex === -1 ? rawPair : rawPair.slice(0, separatorIndex)).toLowerCase();
  return key.startsWith(TRACKING_QUERY_PARAM_PREFIX) || TRACKING_QUERY_PARAMS.has(key);
}

/**
 * Drops the tracking parameters above and leaves every surviving pair
 * BYTE-FOR-BYTE as it arrived — split on `&`, filter, rejoin. Deliberately
 * not `URLSearchParams`, which would re-encode as it serialises (a space
 * becomes `+`, an already-encoded character can change form) and so would
 * rewrite parameters this function has no business rewriting. Order is
 * never touched either: `?a=1&b=2` and `?b=2&a=1` stay two different
 * deduplication keys, because for an arbitrary site they may genuinely be
 * two different pages and sorting them would be us asserting otherwise.
 */
function stripTrackingParams(search: string): string {
  if (search.length <= 1) {
    return '';
  }
  const kept = search
    .slice(1)
    .split('&')
    .filter((pair) => pair.length > 0 && !isTrackingParam(pair));
  return kept.length === 0 ? '' : `?${kept.join('&')}`;
}

/**
 * The last resort: an ordinary web page. Reached only when no known
 * platform host matched, so nothing here can ever shadow a TikTok,
 * Instagram or YouTube URL.
 *
 * WHY THIS NORMALISES DIFFERENTLY FROM TIKTOK/INSTAGRAM, which is the one
 * thing about this function worth reading twice. `normalizeRecipeUrl`'s
 * platform path rebuilds its output from host + pathname alone and so
 * discards the query string BY CONSTRUCTION — safe there because for those
 * two platforms the video id always lives in the path and the query is
 * always share-sheet noise. For a generic page the query is frequently the
 * page itself: `?p=1234` on a WordPress site, `?recipe=x`, a print or
 * paging parameter. Throwing it away would not tidy the URL, it would
 * point the fetcher at a DIFFERENT page than the one the user pasted — and
 * then store that wrong page under the user's link as a canonical recipe.
 * So the query is kept, minus the provably-attribution-only parameters
 * `stripTrackingParams` removes.
 *
 * What IS normalised: the host is lowercased (hostnames are
 * case-insensitive, so `EXAMPLE.com` and `example.com` are one page and
 * must be one deduplication key), the fragment is dropped (`#recept` is a
 * scroll position the server never even sees), and a default port is
 * dropped — the `URL` parser has already done that last one, which is why
 * only a non-default port survives below.
 *
 * WHAT IS NOT NORMALISED: the scheme. A pasted `http://` URL stays
 * `http://`, unlike TikTok/Instagram, whose output is hardcoded to
 * `https://`. Upgrading a third party's URL would be asserting that their
 * site serves TLS on that address, which we have no way to know from
 * here; when it does not, we would have turned a fetchable link into a
 * failing one. The cost is honest and small: an `http` and an `https`
 * paste of the same page dedupe as two `recipes` rows.
 *
 * A bare host is rejected exactly as `https://www.tiktok.com/` is —
 * there is no specific page to import. "Bare" means no path AND no
 * surviving query, because `https://example.com/?p=1234` names a page
 * perfectly well; rejecting it would contradict the whole reason the
 * query is kept.
 *
 * `isShortLink` is always false. A generic URL may well redirect, and
 * `pin.it` always does — but redirects here are followed by the fetcher
 * itself, bounded and validated, not resolved by a caller round trip the
 * way TikTok's opaque `vm./vt.` codes require.
 */
function normalizeWebUrl(parsed: URL, hostname: string): NormalizedUrlResult {
  // The pure half of SSRF defence, before any fetch is even considered —
  // see the file header. Reused from resolveShortLinkTarget.ts rather than
  // reimplemented, so the redirect chain and the pasted URL are held to
  // one blocklist.
  if (isBlockedRedirectHost(hostname)) {
    return { kind: 'unsupported_url' };
  }

  const query = stripTrackingParams(parsed.search);
  if (parsed.pathname.length <= 1 && query.length === 0) {
    return { kind: 'unsupported_url' };
  }

  const host = parsed.port.length === 0 ? hostname : `${hostname}:${parsed.port}`;
  return {
    kind: 'ok',
    platform: 'web',
    normalizedUrl: `${parsed.protocol}//${host}${parsed.pathname}${query}`,
    isShortLink: false,
  };
}

/**
 * The single entry point for "is this a URL we can even try to import."
 * For TikTok/Instagram, strips query/hash noise by construction (the
 * output is built from only the host and pathname — nothing else
 * survives). A bare host with no path (`https://www.tiktok.com/`) is
 * rejected too: there's no specific post to import. YouTube is normalized
 * by `normalizeYouTubeUrl` instead — see that function's header for why it
 * is the one exception that reads a query parameter. Anything else that is
 * still an http(s) address falls through to `normalizeWebUrl` as `'web'`,
 * which is the LAST branch on purpose: a known platform must never be
 * reachable as a generic page.
 */
export function normalizeRecipeUrl(rawUrl: string): NormalizedUrlResult {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return { kind: 'unsupported_url' };
  }

  const parsed = parseUrl(trimmed);
  if (parsed === null) {
    return { kind: 'unsupported_url' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { kind: 'unsupported_url' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const resolution = resolvePlatform(hostname);
  if (resolution === null) {
    return normalizeWebUrl(parsed, hostname);
  }

  if (resolution.platform === 'youtube') {
    return normalizeYouTubeUrl(parsed, hostname);
  }

  if (parsed.pathname.length <= 1) {
    return { kind: 'unsupported_url' };
  }

  const normalizedUrl = `https://${canonicalHost(hostname, resolution.platform, resolution.isShortLink)}${parsed.pathname}`;

  return {
    kind: 'ok',
    platform: resolution.platform,
    normalizedUrl,
    isShortLink: resolution.isShortLink,
  };
}

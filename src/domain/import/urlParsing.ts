/**
 * Recognises and normalises a pasted TikTok/Instagram/YouTube URL — the
 * single gate a paste has to pass before any network call is made. Pure:
 * never throws, never touches the network, never resolves a redirect
 * (that's an I/O concern; see the edge function's `expandShortLink`).
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
 *
 * `src/lib/oembed.ts` (frozen, owned elsewhere) validates a URL again with
 * its own narrower regex (`^https:\/\/(www\.)?tiktok\.com\/.+`) before
 * ever calling out — this module's normalization is specifically designed
 * so an "ok" desktop/mobile TikTok/Instagram result always satisfies that
 * regex too. A short-link result may not; that's a known, explicitly typed
 * gap the edge function accounts for, not a silent one. `oembed.ts` has no
 * equivalent YouTube pattern yet — see `ImportPlatform`'s doc comment
 * (types.ts) for what still needs building before a YouTube paste can be
 * fetched at all; this module only decides whether a pasted URL is
 * recognised and what its canonical, deduplication-ready form is.
 */

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
       * read on its own.
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

interface HostResolution {
  readonly platform: ImportPlatform;
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

/** Collapses desktop/mobile TikTok/Instagram host variants onto the canonical `www.` host oembed.ts's own validation expects. Short-link hosts are left untouched — see file header. Never called for YouTube; `normalizeYouTubeUrl` builds that platform's canonical host+path+query together, since the id there is not always in the path alone. */
function canonicalHost(hostname: string, resolution: HostResolution): string {
  if (resolution.isShortLink) {
    return hostname;
  }
  return resolution.platform === 'tiktok' ? 'www.tiktok.com' : 'www.instagram.com';
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

  if (parsed.pathname === '/watch') {
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
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
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
 * is the one exception that reads a query parameter.
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
    return { kind: 'unsupported_url' };
  }

  if (resolution.platform === 'youtube') {
    return normalizeYouTubeUrl(parsed, hostname);
  }

  if (parsed.pathname.length <= 1) {
    return { kind: 'unsupported_url' };
  }

  const normalizedUrl = `https://${canonicalHost(hostname, resolution)}${parsed.pathname}`;

  return {
    kind: 'ok',
    platform: resolution.platform,
    normalizedUrl,
    isShortLink: resolution.isShortLink,
  };
}

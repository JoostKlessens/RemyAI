/**
 * Recognises and normalises a pasted TikTok/Instagram URL — the single
 * gate a paste has to pass before any network call is made. Pure: never
 * throws, never touches the network, never resolves a redirect (that's an
 * I/O concern; see the edge function's `expandShortLink`).
 *
 * Handles, per the brief:
 *  - desktop vs. mobile hosts (`m.tiktok.com` / `m.instagram.com`),
 *  - query-param / hash noise from a native share sheet
 *    (`?is_from_webapp=1&sender_device=pc`, `?igsh=...&utm_source=...`),
 *  - TikTok's short share links (`vm.tiktok.com`, `vt.tiktok.com`) — these
 *    are recognised (so a paste isn't wrongly rejected as unsupported) but
 *    NOT rewritten to a `www.tiktok.com/...` form, because their path is
 *    an opaque short code, not a real video id; only a server-side
 *    redirect (real I/O) can resolve what it actually points to. See
 *    `isShortLink` below.
 *
 * `src/lib/oembed.ts` (frozen, owned elsewhere) validates a URL again with
 * its own narrower regex (`^https:\/\/(www\.)?tiktok\.com\/.+`) before
 * ever calling out — this module's normalization is specifically designed
 * so an "ok" desktop/mobile result always satisfies that regex too. A
 * short-link result may not; that's a known, explicitly typed gap the
 * edge function accounts for, not a silent one.
 */

import type { ImportPlatform } from './types';

export type NormalizedUrlResult =
  | {
      readonly kind: 'ok';
      readonly platform: ImportPlatform;
      readonly normalizedUrl: string;
      /** True for `vm.tiktok.com` / `vt.tiktok.com` — see file header. The caller must resolve the redirect before oEmbed will accept this URL. */
      readonly isShortLink: boolean;
    }
  | { readonly kind: 'unsupported_url' };

const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);
const TIKTOK_SHORT_LINK_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com', 'm.instagram.com']);

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
  return null;
}

/** Collapses desktop/mobile host variants onto the canonical `www.` host oembed.ts's own validation expects. Short-link hosts are left untouched — see file header. */
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
 * The single entry point for "is this a URL we can even try to import."
 * Strips query/hash noise by construction (the output is built from only
 * the host and pathname — nothing else survives). A bare host with no
 * path (`https://www.tiktok.com/`) is rejected too: there's no specific
 * post to import.
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

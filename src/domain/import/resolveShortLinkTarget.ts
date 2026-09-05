/**
 * Pure decision logic for safely resolving a TikTok short link
 * (`vm.tiktok.com` / `vt.tiktok.com`) to the canonical URL oEmbed actually
 * accepts (IMP-01). The actual HTTP redirect-following loop lives in the
 * impure shell (supabase/functions/parse-recipe/index.ts's
 * `expandShortLink`) because each hop is a real network round trip;
 * everything ABOUT a hop that can be decided from data already in hand —
 * how many hops are still allowed, whether a `Location` header is safe to
 * follow at all, and whether the URL the chain ends on is one this app
 * actually resolves recipes from — belongs here instead, so it is provable
 * in a test rather than trusted to a fetch loop nothing in this repo
 * type-checks or unit-tests (`supabase/functions/**` is excluded from both
 * `tsc --noEmit` and ESLint — see index.ts's file header).
 *
 * THIS IS THE SSRF-SHAPED PART OF IMP-01, MADE TESTABLE. An outbound fetch
 * whose ultimate destination is derived from a URL a user pasted should
 * never be handed an unbounded, unvalidated redirect chain: follow forever
 * and a slow or misbehaving redirector hangs the function; follow blindly
 * and it can walk the request wherever the chain likes before the response
 * is ever inspected. Two of the three mitigations IMP-01 needs live here as
 * pure, unit-tested functions:
 *
 *  - `MAX_SHORT_LINK_REDIRECT_HOPS` bounds the depth explicitly, rather
 *    than trusting whatever cap the runtime's own `fetch` happens to apply
 *    when given `redirect: 'follow'` — a cap this file cannot read, audit,
 *    or test. That is the whole reason index.ts follows redirects manually
 *    (`redirect: 'manual'`) instead of relying on the engine.
 *  - `resolveRedirectTarget` refuses to hand the fetch loop anything but an
 *    absolute http(s) URL to request next — a `Location` header pointing
 *    at `javascript:`, `data:`, or any other non-fetchable scheme is
 *    rejected outright, before it is ever handed to `fetch`.
 *  - `validateShortLinkTarget` is the gate that closes IMP-01 honestly: the
 *    URL the redirect chain ends on is re-run through the exact same
 *    `normalizeRecipeUrl` a pasted URL itself has to pass, so a chain that
 *    ends anywhere this app does not already trust enough to call oEmbed
 *    on is rejected exactly as if the user had pasted it directly. A
 *    result still flagged `isShortLink` is rejected too — a chain that
 *    "resolved" to another short link has not actually told this app
 *    anything oEmbed can read, so accepting it would just move the same
 *    failure one step later. A result of `platform: 'web'` is rejected on
 *    the same principle, and that rejection became load-bearing the day
 *    `'web'` joined `ImportPlatform`: `normalizeRecipeUrl` now accepts
 *    almost any public http(s) host, so without this clause TikTok's own
 *    redirector would be a way to make this function fetch an arbitrary
 *    third-party page. The user asked to import a TikTok video; silently
 *    following an open redirect to somebody else's website and scraping
 *    that instead is a different act, not a resolution of the one they
 *    asked for. That a user could paste the same page directly is not a
 *    defence — then they chose it, which is precisely the difference.
 *
 * The third mitigation — the actual network timeout per hop — cannot live
 * here: it has nothing to decide without making the request, so it stays
 * in index.ts, where the request is made.
 *
 * NOT IN SCOPE: resolving the DNS of an intermediate hop to check it isn't
 * a private/internal address (e.g. a cloud metadata endpoint). The chain
 * always starts from one of two hardcoded, real TikTok hostnames — never
 * from an arbitrary attacker-supplied host, since `normalizeRecipeUrl`
 * already restricted the pasted URL to a small recognised host set before
 * any of this runs — so the residual risk is TikTok's own redirect
 * infrastructure misbehaving, not a user pointing this function at an
 * arbitrary target. Full DNS-level SSRF hardening is a larger, separate
 * change and not what this function's few-hop redirect chain needs to
 * defend against today.
 */

import type { UrlImportPlatform } from './types';
import { normalizeRecipeUrl } from './urlParsing.ts';

/**
 * TikTok's own vm./vt. redirector is normally one hop (short host straight
 * to www.tiktok.com/...). Five is generous headroom for an intermediate
 * analytics/redirector hop while still being a hard, explicit ceiling that
 * this file — not the runtime's default `fetch` behaviour — controls and a
 * test can assert against.
 */
export const MAX_SHORT_LINK_REDIRECT_HOPS = 5;

/**
 * Resolves a `Location` header against the URL that produced it, refusing
 * anything that doesn't resolve to an absolute http(s) URL. A relative
 * Location (`/video/123`) is legal HTTP and genuinely used by some
 * redirectors, so it is resolved via the `URL` two-argument constructor
 * rather than rejected outright — but the RESULT must still be http(s):
 * `javascript:`, `data:`, and every other scheme are refused here, before
 * the caller ever fetches it. Never throws — a malformed `Location` header
 * is exactly the kind of thing a third party sends, not a programmer error.
 */
export function resolveRedirectTarget(currentUrl: string, locationHeader: string): string | null {
  try {
    const resolved = new URL(locationHeader, currentUrl);
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') {
      return null;
    }
    if (isBlockedRedirectHost(resolved.hostname)) {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * Refuses a redirect target pointing at the machine this function runs on,
 * or at the private network around it.
 *
 * WHY THIS EXISTS EVEN THOUGH THE FINAL URL IS ALREADY VALIDATED.
 * `validateShortLinkTarget` gates the URL the chain ENDS on, which is the
 * only one ever handed to oEmbed. It does not gate the intermediate hops,
 * and those are fetched: the loop in index.ts issues a real HEAD request to
 * each `Location` before it knows where the chain finishes. So a chain that
 * redirected to `http://169.254.169.254/...` would have that request made,
 * and only then be rejected as a destination — the request having already
 * happened. On Deno Deploy, a link-local address is the cloud metadata
 * endpoint, which is the textbook SSRF target.
 *
 * What this is and is not worth. The exposure is narrow: only status and
 * `Location` are read, never a body, so nothing fetched here can be
 * returned to the caller — this is blind SSRF at most. And the chain always
 * starts at one of two hardcoded TikTok hosts, so reaching this state means
 * TikTok's own redirector sent us somewhere hostile, not that a user picked
 * the target. But the check is a dozen lines of pure string comparison
 * against a fixed list, it is unit-testable, and it costs one function call
 * per hop — far cheaper than the argument for leaving it out.
 *
 * DELIBERATELY NOT DNS RESOLUTION. A hostname that RESOLVES to a private
 * address still passes this (DNS rebinding); catching that needs a resolve
 * step plus a resolve-and-connect race this pure module cannot express, and
 * it is a much larger change than IMP-01's few-hop chain warrants. This
 * closes the literal-IP case, which is the one an open redirect actually
 * hands you. The rest is recorded here rather than silently skipped.
 */
export function isBlockedRedirectHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true;
  }
  // IPv6 loopback (::1), unspecified (::), unique-local (fc00::/7 — fc/fd)
  // and link-local (fe80::/10). Prefix matching is enough: these ranges are
  // defined by their leading hextets.
  if (host === '::1' || host === '::' || /^f[cd][0-9a-f]{0,2}:/.test(host) || /^fe[89ab][0-9a-f]?:/.test(host)) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4 === null) {
    return false;
  }
  const octets = ipv4.slice(1).map(Number);
  const [a, b] = octets as [number, number, number, number];
  if (octets.some((octet) => octet > 255)) {
    // Not a valid dotted quad at all. Refuse rather than guess what a
    // permissive resolver might make of it.
    return true;
  }
  return (
    a === 0 || // 0.0.0.0/8 — "this host"
    a === 10 || // private
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) // private
  );
}

/**
 * The platforms a short-link chain is allowed to land on. A short link is a
 * PLATFORM'S OWN share-sheet redirector, so its destination is a post on
 * that kind of platform — never an ordinary web page. Stated as an explicit
 * allowlist rather than as `!== 'web'` so that the next member of
 * `ImportPlatform` has to be looked at and decided, instead of being
 * admitted here by failing to match an exclusion — the same reasoning
 * `displayOnlyPolicy.ts` gives for writing its own check the way it does.
 */
// `UrlImportPlatform` rather than the full `ImportPlatform` this named until
// SRC-07, and the narrowing is the type finally saying what the paragraph
// above already meant: a short link RESOLVES TO A URL, so the two routes the
// user hands over directly could not appear in this set even in principle.
// The wider union permitted exactly one mistake — listing `'text'` or
// `'photo'` here would have compiled — and the narrower one makes that
// unwritable while leaving the allowlist's opt-in shape untouched.
const SHORT_LINK_TARGET_PLATFORMS: ReadonlySet<UrlImportPlatform> = new Set<UrlImportPlatform>([
  'tiktok',
  'instagram',
  'youtube',
]);

/**
 * The gate a redirect chain's final URL must pass before this app will
 * treat it as resolved and call oEmbed on it — see the file header.
 * Reuses `normalizeRecipeUrl` itself rather than a second, drifting copy of
 * its host logic, and additionally rejects two shapes that pass that
 * function but mean "not resolved": a result still flagged `isShortLink`
 * (a chain that "resolved" to another short link has produced nothing
 * oEmbed can read), and a result whose platform is not one a share-sheet
 * short link can legitimately point at.
 *
 * THE SECOND REJECTION IS THE SSRF-RELEVANT ONE and it is newer than this
 * function. While `ImportPlatform` was a closed set of social platforms,
 * `normalizeRecipeUrl` was itself the allowlist, and reusing it was the
 * whole guarantee. `'web'` widened that function to accept almost any
 * public host, which quietly turned this gate into a pass-through: a
 * `vm.tiktok.com` link redirecting to `evil.example/page` would have been
 * reported as a perfectly good `'web'` target and fetched. The gate now
 * says what it always meant — a TikTok short link resolves to a TikTok
 * post, or it does not resolve.
 */
export function validateShortLinkTarget(
  resolvedUrl: string,
): { readonly normalizedUrl: string; readonly platform: UrlImportPlatform } | null {
  const result = normalizeRecipeUrl(resolvedUrl);
  if (result.kind !== 'ok' || result.isShortLink) {
    return null;
  }
  if (!SHORT_LINK_TARGET_PLATFORMS.has(result.platform)) {
    return null;
  }
  return { normalizedUrl: result.normalizedUrl, platform: result.platform };
}

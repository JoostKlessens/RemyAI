/**
 * The hostnames this app refuses to fetch because they name the machine it
 * runs on, or the private network around it: loopback, link-local
 * (including the cloud metadata endpoint), the RFC 1918 ranges, and the
 * IPv6 equivalents of all three. One list, one predicate, consulted by
 * everything in the import pipeline that is about to turn a string
 * somebody handed us into an outbound request.
 *
 * WHY THIS IS ITS OWN MODULE, AND WHAT IT REVERSES. Until now this
 * function lived in resolveShortLinkTarget.ts and urlParsing.ts imported
 * it from there, while resolveShortLinkTarget.ts imported
 * `normalizeRecipeUrl` back out of urlParsing.ts. That was a require
 * cycle, and a DELIBERATE one — the comment above the import said so in
 * its first four words and argued it: the alternative on the table was a
 * second, inevitably weaker copy of the blocklist, "and the weaker copy is
 * always the one that ends up being called". Given those two options the
 * cycle was the cheaper one. It was chosen, not stumbled into.
 *
 * WHAT CHANGED IS NOT THE ARGUMENT BUT ITS PRICE. Metro says it out loud
 * on every start, in the owner's own Expo Go log:
 *
 *     WARN  Require cycle: src/domain/import/urlParsing.ts ->
 *     src/domain/import/resolveShortLinkTarget.ts ->
 *     src/domain/import/urlParsing.ts
 *
 *     Require cycles are allowed, but can result in uninitialized values.
 *     Consider refactoring to remove the need for a cycle.
 *
 * The old comment's technical claim survives being checked, and that is
 * worth recording rather than quietly dropping: neither module ever read
 * the other while they evaluate. Both cross-module names were called from
 * inside function bodies only, and every top-level initializer in both
 * files is a literal `Set`, string or `RegExp` that touches no import — so
 * the cycle really was inert, and Metro's "can result in uninitialized
 * values" never came true here. This was not a latent bug being fixed.
 *
 * It cost two other things instead. A warning on every single start, which
 * is how a log teaches the person reading it to skip warnings — and the
 * next real one goes with it. And an inertness that holds only for as long
 * as nobody moves one of those calls to the top level of either file: the
 * guarantee is a property of today's function bodies, not of the
 * arrangement. "Inert today" is precisely what a later refactor breaks
 * without anyone noticing, because nothing fails, it just starts reading
 * `undefined`.
 *
 * THE OPTION THAT WAS NEVER ON THE LIST IS THIS FILE. The old comment
 * weighed a cycle against a duplicated blocklist and picked the better of
 * two bad choices. A third module that OWNS the list costs one file and
 * leaves both readers pointing one way at it, so there is still exactly
 * one blocklist and no cycle at all. The duplicate copy stays rejected,
 * for the same reason it was rejected the first time.
 *
 * NAMED FOR WHAT IT IS ABOUT, NOT FOR WHO ASKS. `redirectGuard.ts` or
 * `ssrfGuard.ts` would have named a caller and a threat model; this file
 * knows nothing about redirects, imports, or SSRF. It knows which
 * hostnames name a machine you did not mean to talk to, which is a fact
 * about addresses and stays true no matter who asks. The FUNCTION keeps
 * the name it has always had, `isBlockedRedirectHost`, even though this
 * module is not about redirects: it is imported by that name from
 * supabase/functions/parse-recipe/fetchSourceText.ts, which is Deno code
 * that neither `tsc --noEmit` nor ESLint compiles, so a rename there is
 * caught by the deploy and nothing earlier. Buying a tidier name with a
 * silent deploy failure is a bad trade. Renaming it is a separate,
 * mechanical change that should touch every call site in one commit or
 * none.
 *
 * NO IMPORTS, DELIBERATELY, and it should stay that way — everything this
 * needs is a string and two regular expressions. A leaf cannot be half of
 * a cycle, which is the structural half of the fix; the other half is that
 * both importers now name this file instead of each other. It is also why
 * OPS-09's `.ts`-extension rule has nothing to say about this file's own
 * imports: there are none to resolve. Its two importers spell the
 * extension out when they name it, because that is the direction Deno has
 * to resolve.
 */

/**
 * Refuses a host pointing at the machine this function runs on, or at the
 * private network around it.
 *
 * TWO CALLERS, ONE LIST, which is the whole reason it is worth having a
 * module of its own. `normalizeWebUrl` (urlParsing.ts) asks about the host
 * a user pasted, before any fetch is even considered;
 * `resolveRedirectTarget` (resolveShortLinkTarget.ts) — and the fetch
 * loops in supabase/functions/parse-recipe/ — ask about every hop a
 * redirect chain proposes. Same question, same answer, and a pasted URL
 * that would be refused must not become reachable by arriving as a
 * redirect instead.
 *
 * WHY THIS EXISTS EVEN THOUGH THE FINAL URL IS ALREADY VALIDATED.
 * `validateShortLinkTarget` (resolveShortLinkTarget.ts) gates the URL a
 * chain ENDS on, which is the only one ever handed to oEmbed. It does not
 * gate the intermediate hops, and those are fetched: the loop in the edge
 * function's index.ts issues a real HEAD request to each `Location` before
 * it knows where the chain finishes. So a chain that redirected to
 * `http://169.254.169.254/...` would have that request made, and only then
 * be rejected as a destination — the request having already happened. On
 * Deno Deploy, a link-local address is the cloud metadata endpoint, which
 * is the textbook SSRF target.
 *
 * What this is and is not worth. On the redirect path the exposure is
 * narrow: only status and `Location` are read, never a body, so nothing
 * fetched there can be returned to the caller — that is blind SSRF at
 * most. And a short-link chain always starts at one of two hardcoded
 * TikTok hosts, so reaching that state means TikTok's own redirector sent
 * us somewhere hostile, not that a user picked the target. But the check
 * is a dozen lines of pure string comparison against a fixed list, it is
 * unit-testable, and it costs one function call per hop — far cheaper than
 * the argument for leaving it out. On the pasted-URL path it is not
 * marginal at all: since `'web'` joined the platforms, the host is chosen
 * by whoever typed it.
 *
 * DELIBERATELY NOT DNS RESOLUTION. A hostname that RESOLVES to a private
 * address still passes this (DNS rebinding); catching that needs a resolve
 * step plus a resolve-and-connect race this pure module cannot express,
 * and it is a much larger change than IMP-01's few-hop chain warrants.
 * This closes the literal-IP case, which is the one an open redirect
 * actually hands you. The rest is recorded here rather than silently
 * skipped.
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

/**
 * What a sign-in link hands back when it lands on the app, read out of the
 * URL and turned into one of four answers.
 *
 * THE HALF THAT WAS MISSING. `requestMagicLink` (src/lib/auth.ts) has always
 * sent a link with `emailRedirectTo` pointing at this app, and
 * `supabase.ts:52-59` explains that `detectSessionInUrl` is web-only because
 * "on native there is no URL to read: the link arrives as a deep link and is
 * exchanged explicitly". Nothing did the exchanging. The link opened the
 * app and the app ignored it, which on a phone looks exactly like a login
 * that cannot be got past — the reported symptom being a bounce through
 * Safari and no way through the sign-in screen.
 *
 * WHY THE TOKENS ARE IN THE FRAGMENT AND NOT THE QUERY. supabase-js v2
 * defaults to the implicit flow and this project does not set `flowType`,
 * so a magic link comes back as `#access_token=...&refresh_token=...`
 * rather than `?code=...`. A fragment is never sent to a server by a
 * browser, which is the property that flow relies on. If this project ever
 * switches to PKCE this parser stops matching — so a `code` in the query is
 * reported as its own outcome rather than as nothing, and the caller can
 * fail loudly instead of leaving somebody on a dead screen.
 *
 * WHY THIS IS PURE AND LIVES HERE. Everything below is string handling with
 * exactly one interesting decision in it — what counts as a usable session —
 * and that decision has to be testable. The impure half is one call to
 * `supabase.auth.setSession`, in src/lib/auth.ts, where the client lives.
 */

/**
 * An error the link itself reports. Supabase puts these in the same
 * fragment as a success, which is why they are read here rather than
 * inferred from a missing token: "the link expired" and "this is not an
 * auth link at all" are different sentences to a person, and a parser that
 * collapsed them would make the UI guess.
 */
export interface AuthRedirectError {
  /** Supabase's machine-readable code (`otp_expired`, `access_denied`, ...), when it sends one. */
  readonly code: string | null;
  /** Supabase's own prose, already URL-decoded. Not shown verbatim — the UI owns its wording — but worth logging. */
  readonly description: string | null;
}

export type AuthRedirect =
  /** A complete, usable pair. The only outcome that can produce a session. */
  | { readonly kind: 'session'; readonly accessToken: string; readonly refreshToken: string }
  /** The link arrived but refuses to sign anybody in — expired, already used, or cancelled. */
  | { readonly kind: 'error'; readonly error: AuthRedirectError }
  /**
   * A PKCE-style `?code=` came back, which this client cannot exchange as
   * configured. Its own outcome rather than `none`, so a future change of
   * `flowType` surfaces as a loud failure instead of a link that quietly
   * does nothing — see the file header.
   */
  | { readonly kind: 'unsupported_flow' }
  /** An ordinary deep link with nothing to do with signing in. By far the common case. */
  | { readonly kind: 'none' };

/**
 * Reads a fragment or query string into a lookup.
 *
 * `URLSearchParams` rather than a hand-rolled split, because the values are
 * percent-encoded: a JWT is not, but the `error_description` beside it very
 * much is — Supabase sends prose with spaces in it.
 */
function readParams(raw: string): URLSearchParams {
  return new URLSearchParams(raw.startsWith('#') || raw.startsWith('?') ? raw.slice(1) : raw);
}

/**
 * A token that is present but empty is not a token. Supabase never sends
 * one, but a truncated deep link — a mail client that wrapped a long URL,
 * which is the commonest way these arrive damaged — produces exactly that,
 * and `setSession` with an empty string fails in a way that reads like a
 * server problem rather than a broken link.
 */
function readNonEmpty(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value !== null && value.trim().length > 0 ? value : null;
}

/**
 * BOTH TOKENS OR NEITHER, and that is the one real decision in this file.
 * An access token alone would sign somebody in for an hour and then log
 * them out with no way back, because `autoRefreshToken` would have nothing
 * to refresh from — a session that expires into a mystery is worse than a
 * link that visibly failed, since only one of the two tells you to try
 * again.
 */
export function readAuthRedirect(url: string): AuthRedirect {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  const fragment = hashIndex >= 0 ? readParams(url.slice(hashIndex)) : new URLSearchParams();
  const queryEnd = hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : url.length;
  const query = queryIndex >= 0 ? readParams(url.slice(queryIndex, queryEnd)) : new URLSearchParams();

  // Errors first: an expired link sometimes carries no tokens at all, so
  // checking tokens first would report "not an auth link" for something
  // that plainly is one.
  const errorCode = readNonEmpty(fragment, 'error_code') ?? readNonEmpty(query, 'error_code');
  const errorName = readNonEmpty(fragment, 'error') ?? readNonEmpty(query, 'error');
  const errorDescription =
    readNonEmpty(fragment, 'error_description') ?? readNonEmpty(query, 'error_description');
  if (errorCode !== null || errorName !== null || errorDescription !== null) {
    return { kind: 'error', error: { code: errorCode ?? errorName, description: errorDescription } };
  }

  const accessToken = readNonEmpty(fragment, 'access_token');
  const refreshToken = readNonEmpty(fragment, 'refresh_token');
  if (accessToken !== null && refreshToken !== null) {
    return { kind: 'session', accessToken, refreshToken };
  }

  // See the union's `unsupported_flow` comment: this is what a PKCE
  // redirect looks like, and it must not be mistaken for an ordinary link.
  if (readNonEmpty(query, 'code') !== null) {
    return { kind: 'unsupported_flow' };
  }

  return { kind: 'none' };
}

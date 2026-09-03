/**
 * The three things onboarding actually does: ask for a sign-in link, claim
 * a handle, and sign out.
 *
 * This is the impure edge. Every rule lives in `@/domain/social/session` —
 * read that header for why an account is required at all (PD-012) and why a
 * profile rather than a verified email is what finishes onboarding.
 *
 * WHY A CLICKABLE LINK RATHER THAN A TYPED CODE. Supabase can send either,
 * and a typed code is the better fit for a phone app: no round trip out to
 * a mail client, no deep-link handling, identical behaviour on web and
 * native. It is not available to us. The code only appears in the email if
 * `{{ .Token }}` is in the template, and Supabase gates template editing
 * behind custom SMTP. So the link it is, until there is a real mail sender.
 * Rechecked on 3 September 2026 and it has got stricter, not looser: since
 * 3 June 2026 a free-tier project on the default provider cannot edit those
 * templates at all. Custom SMTP is the prerequisite for a typed code, and
 * it is needed anyway before real users — the built-in sender caps at a
 * couple of messages an hour and refuses any address that is not on the
 * project team.
 *
 * THE LINK'S OTHER HALF NOW EXISTS, AND UNTIL TODAY IT DID NOT. Sending was
 * always here; receiving was not. On native the link arrives as a deep link
 * and has to be exchanged explicitly (supabase.ts:52-59 says so), and
 * nothing did — so on a phone the mail opened the app and the app ignored
 * it. `completeSignInFromUrl` below is that exchange, and it is called from
 * the root layout so it works no matter which screen was showing.
 *
 * RELATED LIMIT, WORTH KNOWING BEFORE REAL USERS. Supabase's built-in
 * sender is explicitly a testing facility: a handful of messages an hour,
 * from their domain, unmodifiable. `rate_limited` below is therefore an
 * expected outcome during development, not a bug, and it is reported as its
 * own result so the UI can say something true about it.
 *
 * Nothing here throws. Every failure is a returned, named outcome, because
 * these are all ordinary things that happen to people signing in — a typo,
 * a dropped connection, a handle someone else already took.
 */

import * as Linking from 'expo-linking';
import { readAuthRedirect } from '@/domain/social/authRedirect';
import { classifyProfileCreationFailure, type ProfileCreationFailure } from '@/domain/social/session';
import { supabase } from './supabase';

export type MagicLinkResult =
  | { readonly kind: 'sent' }
  | { readonly kind: 'rate_limited' }
  | { readonly kind: 'failed' };

/**
 * What arrived on a deep link. `not_an_auth_link` is the overwhelmingly
 * common answer and is not a failure: every deep link into this app reaches
 * the same handler, and most of them are not sign-ins.
 */
export type SignInFromUrlResult =
  | { readonly kind: 'signed_in' }
  /** The link was real but Supabase refused it: expired, already used, or cancelled. `code` is Supabase's own, for the UI to distinguish "expired" from the rest. */
  | { readonly kind: 'link_rejected'; readonly code: string | null }
  | { readonly kind: 'failed' }
  | { readonly kind: 'not_an_auth_link' };

export type ProfileCreationResult =
  | { readonly kind: 'created' }
  | { readonly kind: 'failed'; readonly reason: ProfileCreationFailure };

/**
 * Supabase treats addresses case-insensitively but not whitespace-tolerantly,
 * and a trailing space from an autocomplete or a paste is the single most
 * common way a sign-in silently goes to nobody.
 */
export function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

/**
 * Deliberately permissive: the only authority on whether an address exists
 * is whether the mail arrives. This exists to catch an empty box or an
 * obvious typo before spending one of a very small number of hourly sends,
 * not to adjudicate RFC 5322.
 */
export function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Resolved rather than hardcoded so the same build works on the dev server,
 * a deployed web build and a phone: `createURL` yields the site origin on
 * web and the `remy://` scheme on native (app.json).
 *
 * Whatever this returns must be allowlisted in the Supabase dashboard under
 * Authentication → URL Configuration → Redirect URLs, or Supabase refuses
 * the redirect and the link lands nowhere.
 */
export function resolveRedirectUrl(): string {
  return Linking.createURL('/');
}

function isRateLimited(error: { readonly status?: number; readonly message?: string }): boolean {
  if (error.status === 429) {
    return true;
  }
  // The built-in sender reports its hourly cap in prose rather than a
  // dedicated code, so the message is the only signal available.
  return typeof error.message === 'string' && /rate limit|too many/i.test(error.message);
}

export async function requestMagicLink(rawEmail: string): Promise<MagicLinkResult> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(rawEmail),
      options: { emailRedirectTo: resolveRedirectUrl() },
    });
    if (error === null) {
      return { kind: 'sent' };
    }
    return isRateLimited(error) ? { kind: 'rate_limited' } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

/**
 * Turn a deep link into a session, or say precisely why not.
 *
 * SAFE TO CALL WITH EVERY URL THE APP RECEIVES, which is what makes the
 * caller simple: it does not have to know which links are sign-ins. A URL
 * carrying no auth fragment returns `not_an_auth_link` and touches nothing.
 *
 * `setSession` rather than `refreshSession` or a manual write: it validates
 * the pair, stores it through the AsyncStorage adapter configured in
 * supabase.ts, and — the part that matters here — fires `onAuthStateChange`,
 * which is what `useSession` is already subscribed to. So a successful call
 * needs no navigation of its own; the gate that was showing the sign-in
 * screen re-resolves and moves on by itself.
 *
 * Nothing throws, matching every other function in this file: a mail client
 * that mangles a URL is an ordinary event, not an exceptional one.
 */
export async function completeSignInFromUrl(url: string): Promise<SignInFromUrlResult> {
  const redirect = readAuthRedirect(url);
  if (redirect.kind === 'none') {
    return { kind: 'not_an_auth_link' };
  }
  if (redirect.kind === 'error') {
    return { kind: 'link_rejected', code: redirect.error.code };
  }
  // A PKCE `?code=` against an implicit-flow client. Reported as a failure
  // rather than ignored, because the alternative is a link that does
  // nothing for a reason no one can see — see authRedirect.ts's header.
  if (redirect.kind === 'unsupported_flow') {
    return { kind: 'failed' };
  }
  try {
    const { error } = await supabase.auth.setSession({
      access_token: redirect.accessToken,
      refresh_token: redirect.refreshToken,
    });
    return error === null ? { kind: 'signed_in' } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

/**
 * The row every social RLS policy joins against. `id` is the authenticated
 * user's own id — the insert policy in 0007_social.sql accepts nothing else,
 * so this cannot be used to create a profile for somebody else.
 *
 * A taken handle arrives here as a unique violation, which
 * `classifyProfileCreationFailure` turns into a specific outcome rather than
 * a generic failure: it is the one error the person can actually act on.
 *
 * CALL IT THROUGH `claimProfile` (./claimProfile.ts), NEVER DIRECTLY. This
 * function writes the row and stops there, which is correct in itself and
 * was also the whole of the thirty-second bug: an insert into `profiles` is
 * not an auth event, so `onAuthStateChange` never fires and no `useSession`
 * has any reason to re-resolve. A caller that awaits this and does nothing
 * else leaves somebody staring at a finished form. `claimProfile` is the
 * one place the write is paired with the signal that has to follow it.
 */
export async function createProfile(handle: string, displayName: string): Promise<ProfileCreationResult> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (userId === undefined) {
      return { kind: 'failed', reason: 'unknown_error' };
    }

    const { error } = await supabase.from('profiles').insert({ id: userId, handle, display_name: displayName });
    if (error === null) {
      return { kind: 'created' };
    }
    return { kind: 'failed', reason: classifyProfileCreationFailure(error) };
  } catch {
    return { kind: 'failed', reason: 'unknown_error' };
  }
}

/** Never throws: a failed sign-out still clears the local session, which is what the caller wanted. */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Intentionally swallowed — see the doc comment.
  }
}

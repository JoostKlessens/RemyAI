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
import { classifyProfileCreationFailure, type ProfileCreationFailure } from '@/domain/social/session';
import { supabase } from './supabase';

export type MagicLinkResult =
  | { readonly kind: 'sent' }
  | { readonly kind: 'rate_limited' }
  | { readonly kind: 'failed' };

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

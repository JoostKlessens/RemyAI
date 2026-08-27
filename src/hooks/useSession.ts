/**
 * Establishes the signed-in identity and keeps it live for the app run.
 *
 * This is the impure adapter for `@/domain/social/session`, which holds
 * every actual rule. Read that header first: an account is required before
 * anything (PD-012), and a profile rather than a verified email is what
 * finishes onboarding.
 *
 * NOTHING HERE MAY THROW. A network failure, an expired refresh token or a
 * cleared store all mean the same thing — no identity right now — and that
 * resolves to `signed_out`, which the root layout answers with the sign-in
 * screen. Every call is wrapped and no failure is rethrown, so a flaky
 * connection produces a sign-in prompt rather than a crashed render.
 *
 * It subscribes to `onAuthStateChange` rather than only reading once,
 * because the session appears asynchronously: the user types a code on the
 * sign-in screen and the token arrives afterwards. Without the
 * subscription the app would sit on the sign-in screen holding a perfectly
 * valid session.
 *
 * AND IT SUBSCRIBES TO A SECOND CHANNEL, because `onAuthStateChange` is not
 * enough. The other thing this hook resolves against is a `profiles` row,
 * and inserting one is not an auth event — no token is issued and nothing
 * in the auth store moves — so claiming a handle used to leave the app on
 * the claim screen until Supabase happened to fire a scheduled token
 * refresh, roughly half a minute later. `@/lib/sessionRevalidation` carries
 * that missing signal, and its header carries the full account. The channel
 * is module-scoped rather than per-hook on purpose: every caller of
 * `useSession()` holds its own state, and the copy that decides which
 * screen is correct — the root layout's `AuthGate` — is a SIBLING of the
 * screen that finishes onboarding, not an ancestor of it.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  describeSessionCapability,
  resolveSessionState,
  type ProfilePresence,
  type SessionCapability,
  type SessionSnapshot,
  type SessionState,
} from '@/domain/social/session';
import {
  getSessionRevalidationToken,
  requestSessionRevalidation,
  subscribeToSessionRevalidation,
} from '@/lib/sessionRevalidation';
import { supabase } from '@/lib/supabase';

export interface SessionInfo {
  readonly state: SessionState;
  readonly capability: SessionCapability;
  readonly userId: string | null;
  readonly handle: string | null;
  /** True only until the first resolution settles. Never a reason to block a render — see the file header. */
  readonly isResolving: boolean;
  /**
   * Re-runs the whole resolution, including a fresh sign-in attempt — in
   * THIS hook and in every other one open in the app, because it goes
   * through the module-scoped channel rather than this instance's state.
   *
   * The profile claim does not call this: it calls
   * `requestSessionRevalidation` directly from `@/lib/claimProfile`, since
   * a route module cannot hold the only copy of that wire and still be
   * testable. This stays for a caller that already has the hook in hand.
   */
  readonly refresh: () => void;
}

type ResolvedProfile = ProfilePresence & { readonly handle: string };

interface ResolvedIdentity {
  readonly session: SessionSnapshot | null;
  readonly profile: ResolvedProfile | null;
}

const NO_IDENTITY: ResolvedIdentity = { session: null, profile: null };

async function readSession(): Promise<SessionSnapshot | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (user === undefined) {
      return null;
    }
    return { userId: user.id };
  } catch {
    return null;
  }
}

/**
 * A missing row is the ordinary case between verifying an email and
 * claiming a handle, so `maybeSingle` is used and a null result is not an
 * error — it is what puts the app on the handle screen.
 */
async function readProfile(userId: string): Promise<ResolvedProfile | null> {
  try {
    const { data, error } = await supabase.from('profiles').select('id, handle').eq('id', userId).maybeSingle();
    if (error !== null || data === null) {
      return null;
    }
    const row = data as { readonly id?: unknown; readonly handle?: unknown };
    if (typeof row.id !== 'string' || typeof row.handle !== 'string') {
      return null;
    }
    return { id: row.id, handle: row.handle };
  } catch {
    return null;
  }
}

async function resolveIdentity(): Promise<ResolvedIdentity> {
  const session = await readSession();
  if (session === null) {
    return NO_IDENTITY;
  }
  return { session, profile: await readProfile(session.userId) };
}

export function useSession(): SessionInfo {
  const [identity, setIdentity] = useState<ResolvedIdentity>(NO_IDENTITY);
  const [isResolving, setIsResolving] = useState(true);
  // Seeded from the channel rather than from 0, so a request that landed
  // between this mount and the subscription below is not lost: the effect
  // keyed on `attempt` is already running against the newer value.
  const [attempt, setAttempt] = useState(getSessionRevalidationToken);

  // A profile insert is not an auth event, so this is the only thing that
  // tells an already-mounted session to look again. See the file header.
  useEffect(() => subscribeToSessionRevalidation(setAttempt), []);

  useEffect(() => {
    let isMounted = true;
    setIsResolving(true);

    resolveIdentity().then((resolved) => {
      if (isMounted) {
        setIdentity(resolved);
        setIsResolving(false);
      }
    });

    // The session arrives after the user verifies a code, so a one-shot
    // read would leave the app on the sign-in screen holding a valid token.
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) {
        resolveIdentity().then((resolved) => {
          if (isMounted) {
            setIdentity(resolved);
            setIsResolving(false);
          }
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [attempt]);

  // Broadcast rather than local: a re-resolve that only reached the caller
  // would leave the root layout — which is what actually decides the
  // screen — sitting on the identity it read before the change.
  const refresh = useCallback(() => requestSessionRevalidation(), []);

  const state = resolveSessionState(identity);
  return {
    state,
    capability: describeSessionCapability(state),
    userId: identity.session?.userId ?? null,
    handle: identity.profile?.handle ?? null,
    isResolving,
    refresh,
  };
}

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
import { supabase } from '@/lib/supabase';

export interface SessionInfo {
  readonly state: SessionState;
  readonly capability: SessionCapability;
  readonly userId: string | null;
  readonly handle: string | null;
  /** True only until the first resolution settles. Never a reason to block a render — see the file header. */
  readonly isResolving: boolean;
  /** Re-runs the whole resolution, including a fresh sign-in attempt. */
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
  const [attempt, setAttempt] = useState(0);

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

  const refresh = useCallback(() => setAttempt((previous) => previous + 1), []);

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

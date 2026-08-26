/**
 * Establishes the device's identity once per app run, and reports it as one
 * of three ordinary states.
 *
 * This is the impure adapter for `@/domain/social/session`, which holds
 * every actual rule. Read that file's header first — it explains why a
 * profile rather than an email is what unlocks friends, and why
 * `signed_out` is a normal permanent state rather than an error.
 *
 * NOTHING HERE MAY BE FATAL. Anonymous sign-in is a project-level setting
 * that can be off (the live API answers `anonymous_provider_disabled` when
 * it is), the device can be offline, and a refresh can fail. Every one of
 * those resolves to `signed_out` and the app carries on: deciding, saving
 * and cooking never needed an account. So every call below is wrapped, no
 * failure is rethrown, and no error state is exposed for callers to render.
 *
 * It also must not gate the splash screen. `src/app/_layout.tsx` holds the
 * splash until fonts resolve, and fonts are a hard dependency — text cannot
 * render without them. Identity is not: the UI is fully usable while this
 * is still resolving, so `isResolving` exists to suppress a premature
 * signed-out flash on the one screen that cares, never to block a render.
 *
 * ONE ATTEMPT, NOT A RETRY LOOP. If anonymous sign-in is disabled, retrying
 * produces the same 422 forever. A failed attempt is remembered for the
 * lifetime of the app run and re-driven only by an explicit `refresh()` —
 * which is what the Vrienden screen's retry offers.
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
    return { userId: user.id, isAnonymous: user.is_anonymous === true };
  } catch {
    return null;
  }
}

async function signInAnonymously(): Promise<SessionSnapshot | null> {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error !== null || data.user === null) {
      // Expected whenever the provider is disabled. Deliberately not logged
      // as an error: it is a configuration answer, not a malfunction.
      return null;
    }
    return { userId: data.user.id, isAnonymous: data.user.is_anonymous === true };
  } catch {
    return null;
  }
}

/**
 * A missing row is the ordinary case for an anonymous user who has never
 * upgraded, so `maybeSingle` is used and a null result is not an error.
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
  const existing = await readSession();
  const session = existing ?? (await signInAnonymously());
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

    return () => {
      isMounted = false;
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

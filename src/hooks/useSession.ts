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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  describeSessionCapability,
  resolveSessionState,
  preferReadableProfile,
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

/**
 * `ProfileLookup` narrowed to the shape this hook carries: the handle rides
 * along on `present` because the hook exposes it, while the domain's rule
 * only ever needs presence.
 */
type ProfileReadResult =
  | { readonly kind: 'present'; readonly profile: ResolvedProfile }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unreadable' };

interface ResolvedIdentity {
  readonly session: SessionSnapshot | null;
  readonly profile: ProfileReadResult;
}

const NO_IDENTITY: ResolvedIdentity = { session: null, profile: { kind: 'absent' } };

/**
 * What `needsRetry` actually costs, in milliseconds, and why the list is
 * short and finite.
 *
 * An unreadable profile leaves the app in the one state no screen answers:
 * the root layout deliberately routes nowhere, so without this nothing
 * would ever look again and the person would sit on whatever was already
 * mounted until they killed the app. A capability flag with no reader is
 * exactly the dead wiring this repo has now found three times
 * (`rateRecipe`, `expo-notifications`, `FRIEND_PROOF_BOOST`), so the flag
 * and its consumer land together or not at all.
 *
 * BOUNDED, NOT PERPETUAL. Three attempts over about five seconds covers the
 * transient causes — a request that lost the network, a token refreshing
 * underneath the read — and stops well short of a phone with no signal
 * spending its battery re-asking a question that will keep failing. After
 * the last one the app stays put and a later auth event or an explicit
 * `refresh()` is what tries again.
 */
const PROFILE_RETRY_DELAYS_MS: readonly number[] = [400, 1200, 3000];

/**
 * A `setIdentity` updater rather than a plain value, because the rule needs
 * the PREVIOUS answer and a `.then` callback does not have one — reading
 * `identity` from the closure would read whatever it was when this effect
 * was created, which on a re-resolve is exactly the stale value the rule is
 * trying to consult. `preferReadableProfile` owns the rule and is tested;
 * this only supplies it with both sides.
 */
function keepKnownProfile(resolved: ResolvedIdentity): (previous: ResolvedIdentity) => ResolvedIdentity {
  return (previous) => ({
    session: resolved.session,
    profile: preferReadableProfile(previous.profile, resolved.profile),
  });
}

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
 * claiming a handle, so `maybeSingle` is used and an empty result is not an
 * error — it is what puts the app on the handle screen.
 *
 * A FAILED READ IS NOT AN EMPTY ONE, AND THIS FUNCTION USED TO SAY IT WAS.
 * The line was `if (error !== null || data === null) return null;` — one
 * branch for "there is no row" and for "I could not find out", which made
 * every dropped connection look exactly like a person who had not finished
 * onboarding. The owner hit it on 6 September 2026: already signed in,
 * already holding a handle, sent to `claim-handle` and stuck there, because
 * that route is a full-screen modal with `gestureEnabled: false` whose only
 * exit is a profile insert that could never succeed (see
 * `ProfileCreationFailure`'s `profile_exists`).
 *
 * The three-way return is the repair, and `catch` is `unreadable` for the
 * same reason: a thrown transport error is the one thing we can be most
 * certain is not evidence about what `profiles` contains.
 */
async function readProfile(userId: string): Promise<ProfileReadResult> {
  try {
    const { data, error } = await supabase.from('profiles').select('id, handle').eq('id', userId).maybeSingle();
    if (error !== null) {
      return { kind: 'unreadable' };
    }
    if (data === null) {
      return { kind: 'absent' };
    }
    const row = data as { readonly id?: unknown; readonly handle?: unknown };
    if (typeof row.id !== 'string' || typeof row.handle !== 'string') {
      // A row came back and it is not shaped like a profile. That is a
      // broken projection, not a missing account — answering `absent` here
      // would route somebody to claim a handle they already hold.
      return { kind: 'unreadable' };
    }
    return { kind: 'present', profile: { id: row.id, handle: row.handle } };
  } catch {
    return { kind: 'unreadable' };
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

  // Consecutive failed profile reads. A ref rather than state: changing it
  // must not re-render, and the effect below must see the value it wrote on
  // its previous run rather than one captured when the effect was created.
  const failedReads = useRef(0);

  useEffect(() => {
    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setIsResolving(true);

    /**
     * Ask for one more look, on the domain's say-so rather than on a local
     * reading of the same facts — `needsRetry` is the rule and this is its
     * only consumer.
     */
    const scheduleRetryIfUnreadable = (resolved: ResolvedIdentity): void => {
      if (!describeSessionCapability(resolveSessionState(resolved)).needsRetry) {
        failedReads.current = 0;
        return;
      }
      const delay = PROFILE_RETRY_DELAYS_MS[failedReads.current];
      if (delay === undefined) {
        return;
      }
      failedReads.current += 1;
      retryTimer = setTimeout(() => requestSessionRevalidation(), delay);
    };

    resolveIdentity().then((resolved) => {
      if (isMounted) {
        setIdentity(keepKnownProfile(resolved));
        setIsResolving(false);
        scheduleRetryIfUnreadable(resolved);
      }
    });

    // The session arrives after the user verifies a code, so a one-shot
    // read would leave the app on the sign-in screen holding a valid token.
    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      if (isMounted) {
        resolveIdentity().then((resolved) => {
          if (isMounted) {
            setIdentity(keepKnownProfile(resolved));
            setIsResolving(false);
            scheduleRetryIfUnreadable(resolved);
          }
        });
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
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
    handle: identity.profile.kind === 'present' ? identity.profile.profile.handle : null,
    isResolving,
    refresh,
  };
}

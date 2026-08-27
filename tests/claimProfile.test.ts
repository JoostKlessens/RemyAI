/**
 * The regression test for the thirty-second account creation
 * (src/lib/claimProfile.ts).
 *
 * WHAT IT IS ACTUALLY GUARDING, said plainly, because a test that only
 * checked "does `refresh` exist" would have been green throughout the bug.
 * `useSession` re-resolves on `supabase.auth.onAuthStateChange` and on
 * nothing else. A row inserted into `profiles` is not an auth event, so
 * after a successful `createProfile` NOTHING asked the session to look
 * again, and the claim-handle screen — which deliberately does not
 * navigate, because the root layout is the single authority on which
 * screen is correct — sat there until Supabase happened to fire a
 * scheduled token refresh. `useSession.refresh()` existed for exactly this
 * and had zero call sites.
 *
 * That is this repo's third consumer with no producer, after
 * `Meal.recipeId` (written by nobody) and `OutcomeCard.onSendRecipe`
 * (passed by nobody). The shape of the bug is always the same: one half of
 * a wire is tested, the other half does not exist, and no test can see the
 * gap because the wiring lives in a route module. So the wiring was lifted
 * into src/lib — the same move `friendProof.ts` and `sendRecipe.ts` made,
 * and for the same reason: src/app/claim-handle.tsx cannot be imported
 * here at all, since expo-router and react-native internals fail to parse
 * under Vite.
 *
 * The subscribers below stand in for real `useSession()` instances. There
 * is deliberately more than one in the first test: the hook gives every
 * caller its own state, and the copy that matters is the root layout's
 * `AuthGate`, which is a SIBLING of the claim screen rather than an
 * ancestor. A fix that re-resolved only the caller's own session would
 * pass a one-listener test and leave the reported bug exactly where it
 * was.
 */

import { describe, expect, test, vi } from 'vitest';
import type { ProfileCreationResult } from '@/lib/auth';
import { claimProfile } from '@/lib/claimProfile';
import { getSessionRevalidationToken, subscribeToSessionRevalidation } from '@/lib/sessionRevalidation';

const CREATED: ProfileCreationResult = { kind: 'created' };

const HANDLE_TAKEN: ProfileCreationResult = { kind: 'failed', reason: 'handle_taken' };

/** Every way the claim can fail. None of them changes what `resolveSessionState` would say. */
const FAILURES: readonly ProfileCreationResult[] = [
  HANDLE_TAKEN,
  { kind: 'failed', reason: 'invalid_handle' },
  { kind: 'failed', reason: 'unknown_error' },
];

/**
 * Collects "look again" requests for the duration of one test and detaches
 * itself afterwards. The token is monotonic and never reset, so everything
 * below asserts on MOVEMENT rather than on a value.
 */
function watchRevalidations(): { readonly calls: readonly number[]; readonly stop: () => void } {
  const calls: number[] = [];
  const stop = subscribeToSessionRevalidation((token: number) => {
    calls.push(token);
  });
  return { calls, stop };
}

describe('claimProfile', () => {
  test('a created profile asks every open session to resolve again', async () => {
    // Arrange — two sessions, because the app really does hold several:
    // the root layout's AuthGate decides the screen, the tab bar reads the
    // user id, and neither is an ancestor of claim-handle.
    const authGate = watchRevalidations();
    const tabBar = watchRevalidations();
    const before = getSessionRevalidationToken();

    // Act
    await claimProfile(async () => CREATED, 'joost', 'Joost');

    // Assert
    expect(authGate.calls).toHaveLength(1);
    expect(tabBar.calls).toHaveLength(1);
    expect(getSessionRevalidationToken()).toBeGreaterThan(before);

    authGate.stop();
    tabBar.stop();
  });

  test('the request is made once, not once per listener', async () => {
    const first = watchRevalidations();
    const second = watchRevalidations();
    const before = getSessionRevalidationToken();

    await claimProfile(async () => CREATED, 'joost', 'Joost');

    // Both heard the same single request rather than two, which is what
    // keeps `useSession` from resolving the identity N times per claim.
    expect(first.calls).toEqual(second.calls);
    expect(getSessionRevalidationToken()).toBe(before + 1);

    first.stop();
    second.stop();
  });

  test.each(FAILURES)('a claim that fails asks nothing to resolve again (%o)', async (failure) => {
    const watcher = watchRevalidations();
    const before = getSessionRevalidationToken();

    await claimProfile(async () => failure, 'joost', 'Joost');

    // A taken handle leaves the session exactly as it was: still
    // `needs_profile`, still on this screen. Re-resolving would spend two
    // network reads to learn nothing.
    expect(watcher.calls).toEqual([]);
    expect(getSessionRevalidationToken()).toBe(before);

    watcher.stop();
  });

  test('the request comes after the write lands, never before it', async () => {
    const order: string[] = [];
    const stop = subscribeToSessionRevalidation(() => {
      order.push('revalidate');
    });

    await claimProfile(
      async () => {
        order.push('write');
        return CREATED;
      },
      'joost',
      'Joost',
    );

    // The ordering is the whole point. `useSession` answers a re-resolve by
    // reading `profiles`; asking before the insert has landed would find no
    // row, resolve straight back to `needs_profile`, and reinstate the wait
    // this module exists to remove.
    expect(order).toEqual(['write', 'revalidate']);

    stop();
  });

  test('the writer is handed the handle and the display name unchanged', async () => {
    const writeProfile = vi.fn(async () => CREATED);

    await claimProfile(writeProfile, 'joost', 'Joost');

    // This module composes; it does not validate. `parseHandle` already
    // decided what a handle is, and a second opinion here is a second place
    // for the database's CHECK constraint to be mirrored wrongly.
    expect(writeProfile).toHaveBeenCalledWith('joost', 'Joost');
  });

  test('the outcome reaches the caller unchanged', async () => {
    const created = await claimProfile(async () => CREATED, 'joost', 'Joost');
    const taken = await claimProfile(async () => HANDLE_TAKEN, 'joost', 'Joost');

    // The screen still owns the error copy and the announcement, so nothing
    // here may swallow, rewrite or reclassify a result.
    expect(created).toEqual({ kind: 'created' });
    expect(taken).toEqual({ kind: 'failed', reason: 'handle_taken' });
  });
});

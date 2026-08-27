/**
 * The "look again" channel (src/lib/sessionRevalidation.ts) — the half of
 * the thirty-second bug that `useSession` listens to.
 *
 * tests/claimProfile.test.ts asserts that a finished profile SENDS the
 * request. This file asserts the three properties the receiving side
 * depends on, none of which the producer test can see:
 *
 * - every open session hears it, not just the one that asked, because the
 *   copy that decides which screen you are on is a sibling of the screen
 *   that claims the handle rather than an ancestor of it;
 * - an unmounted session hears nothing, so a `setState` never lands on a
 *   component that has gone;
 * - the token moves on every request, because a React effect re-runs on a
 *   changed value and not on a callback having been called.
 */

import { describe, expect, test } from 'vitest';
import {
  getSessionRevalidationToken,
  requestSessionRevalidation,
  subscribeToSessionRevalidation,
} from '@/lib/sessionRevalidation';

describe('sessionRevalidation', () => {
  test('every subscriber hears a request, not only the one that made it', () => {
    // Arrange — the root layout's AuthGate, the tab bar and a screen.
    const heard: string[] = [];
    const stopGate = subscribeToSessionRevalidation(() => heard.push('gate'));
    const stopTabs = subscribeToSessionRevalidation(() => heard.push('tabs'));
    const stopScreen = subscribeToSessionRevalidation(() => heard.push('screen'));

    // Act
    requestSessionRevalidation();

    // Assert — the gate is the one that matters: it is what replaces
    // /claim-handle with /, and it is not an ancestor of the claim screen.
    expect(heard).toEqual(['gate', 'tabs', 'screen']);

    stopGate();
    stopTabs();
    stopScreen();
  });

  test('an unsubscribed session hears nothing further', () => {
    let calls = 0;
    const stop = subscribeToSessionRevalidation(() => {
      calls += 1;
    });

    requestSessionRevalidation();
    stop();
    requestSessionRevalidation();

    // A hook unmounts by calling exactly this. Without it, the second
    // request would set state on a component that is gone.
    expect(calls).toBe(1);
  });

  test('the token advances on every request, so an effect keyed on it re-runs', () => {
    const seen: number[] = [];
    const stop = subscribeToSessionRevalidation((token: number) => seen.push(token));

    const before = getSessionRevalidationToken();
    requestSessionRevalidation();
    requestSessionRevalidation();

    // Two claims in one app run — a failed first attempt, then a free
    // handle — must produce two distinct values. A boolean flag or a bare
    // callback would collapse the second into a no-op.
    expect(seen).toEqual([before + 1, before + 2]);
    expect(getSessionRevalidationToken()).toBe(before + 2);

    stop();
  });

  test('a request made before anybody subscribes is still visible in the token', () => {
    const before = getSessionRevalidationToken();

    requestSessionRevalidation();

    // `useSession` seeds its attempt counter from this getter at mount and
    // only then subscribes. A request landing in that gap is not lost: the
    // seeded value already differs, so the first resolve is the fresh one.
    expect(getSessionRevalidationToken()).toBe(before + 1);
  });
});

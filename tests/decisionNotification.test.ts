/**
 * WHEN `expo-notifications` IS EVALUATED, AND WHAT IT COSTS WHEN IT IS.
 *
 * `src/lib/decisionNotification.ts` had no test at all before this file,
 * and the reason was structural rather than an oversight: it imported
 * `expo-notifications` at module scope, and that package's entry module
 * reaches `expo` and `expo-modules-core` on load, neither of which parses
 * in this repo's `node`-environment vitest run. A module you cannot import
 * is a module you cannot test. Moving the import inside the function is
 * what made these tests possible, which is a second argument for the
 * change and not the one it was made for.
 *
 * WHAT THE FIRST GROUP ACTUALLY MEASURES, said plainly so nobody reads
 * more into it than is there. The two warnings in the owner's Expo Go log
 * are `console.warn` calls in the module body of
 * `expo-notifications/build/index.js` and in
 * `build/DevicePushTokenAutoRegistration.fx`, which `index.js` re-exports
 * — read from the installed package, version 57.0.16. The mock below
 * reproduces exactly that: a factory that warns with the real message
 * text when, and only when, it is evaluated. So these tests answer "does
 * this module still make the package evaluate at load?" with the same
 * observable the owner has — a line in a log.
 *
 * They do NOT prove anything about Metro. Vitest's module registry is not
 * Metro's, and no test in a node process can be. What carries the claim on
 * device is that both warnings are evaluation-time side effects rather
 * than parse-time ones, which is a fact about the package's source; what
 * these tests guard is the half that can regress here — that this file
 * keeps deferring the evaluation. The final test in the group makes that
 * guard independent of any module-registry behaviour at all by reading the
 * source text.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DecisionNotificationResult } from '@/lib/decisionNotification';
import {
  DECISION_NOTIFICATION_BODY,
  DECISION_NOTIFICATION_IDENTIFIER,
  DECISION_NOTIFICATION_TITLE,
  type DecisionNotificationConditions,
} from '@/domain/decisionNotificationCopy';

const spy = {
  /** How many times the fake `expo-notifications` has been evaluated. */
  evaluations: 0,
  /** Every API call, in order — the cancel/schedule ORDER is load-bearing. */
  calls: [] as string[],
  /** Set to make the module throw on evaluation: Expo Go on Android. */
  throwOnEvaluate: null as Error | null,
  /**
   * Set to make the first API call reject. Separate from
   * `throwOnEvaluate` because Vitest replaces a mock factory's error
   * message with its own advice text, so an evaluation failure can prove
   * the OUTCOME but never the `reason` string — and `describeError` is
   * worth testing on its own terms.
   */
  rejectOnPermissionCheck: null as Error | null,
  granted: true,
  canAskAgain: true,
};

/**
 * `vi.doMock` RATHER THAN `vi.mock`, and this cost a run to find out.
 *
 * The hoisted `vi.mock` was the obvious first attempt and it silently
 * measures the wrong thing: Vitest caches a factory's RESULT in a mock
 * registry that `vi.resetModules()` does not clear, so the factory runs
 * once for the whole file and every test after the first sees an
 * evaluation count that never moves. Four tests failed in exactly that
 * shape — `expected +0 to be 1`, and a `throwOnEvaluate` that was never
 * consulted — which is the good failure: a stale mock that happened to
 * agree with the assertions would have made this file decorative.
 *
 * `vi.doMock` is not hoisted and re-registers per test, so paired with
 * `vi.resetModules()` the factory genuinely re-runs and "when was this
 * module evaluated" becomes a real question again.
 *
 * WHAT THE FACTORY REPRODUCES: the real entry module's two side effects.
 * The message strings are copied from `expo-notifications@57.0.16`
 * (`build/warnOfExpoGoPushUsage.js:6` and `build/index.js:6-7`) and the
 * order is the one the owner's log shows — the push warning first,
 * because ESM evaluates a re-exported module before the re-exporting
 * module's own body.
 */
function installNotificationsMock(): void {
  vi.doMock('expo-notifications', () => {
    spy.evaluations += 1;
    if (spy.throwOnEvaluate !== null) {
      throw spy.throwOnEvaluate;
    }
    console.warn(
      'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go with the release of SDK 53.',
    );
    console.warn(
      '`expo-notifications` functionality is not fully supported in Expo Go:\n' +
        'We recommend you instead use a development build to avoid limitations.',
    );
    return {
      getPermissionsAsync: async () => {
        spy.calls.push('getPermissions');
        if (spy.rejectOnPermissionCheck !== null) {
          throw spy.rejectOnPermissionCheck;
        }
        return { granted: spy.granted, canAskAgain: spy.canAskAgain };
      },
      requestPermissionsAsync: async () => {
        spy.calls.push('requestPermissions');
        return { granted: spy.granted };
      },
      setNotificationChannelAsync: async (id: string) => {
        spy.calls.push(`setChannel:${id}`);
        return null;
      },
      cancelScheduledNotificationAsync: async (id: string) => {
        spy.calls.push(`cancel:${id}`);
      },
      scheduleNotificationAsync: async (request: { readonly identifier: string }) => {
        spy.calls.push(`schedule:${request.identifier}`);
        return request.identifier;
      },
      AndroidImportance: { DEFAULT: 3 },
      SchedulableTriggerInputTypes: { DAILY: 'daily' },
    };
  });
}

const SOURCE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/lib/decisionNotification.ts',
);

interface LoadedModule {
  /**
   * Spelled out rather than borrowed with `typeof import(...)`, which
   * `@typescript-eslint/consistent-type-imports` forbids as an annotation.
   * Writing it by hand is not a loss: a signature change in the module
   * under test now fails this file at compile time instead of quietly
   * following along.
   */
  readonly scheduleDecisionNotification: (
    conditions: DecisionNotificationConditions,
  ) => Promise<DecisionNotificationResult>;
  /**
   * The `react-native` stub instance THIS load of the module under test is
   * holding. After `vi.resetModules()` the statically imported `Platform`
   * at the top of this file is a different object from the one the freshly
   * loaded module sees, so writing `OS` on it would change nothing — the
   * second reason a test run was needed to get this file right.
   */
  readonly platform: { OS: string };
}

/**
 * Imported fresh per test because `vi.resetModules()` in `beforeEach` is
 * what lets the "evaluated / not evaluated" question be asked more than
 * once. A static top-level import would bind one instance for the whole
 * file and every count after the first would be a leftover.
 */
async function loadModule(): Promise<LoadedModule> {
  const reactNative = await import('react-native');
  const loaded = await import('@/lib/decisionNotification');
  return {
    scheduleDecisionNotification: loaded.scheduleDecisionNotification,
    platform: reactNative.Platform as unknown as { OS: string },
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  installNotificationsMock();
  spy.evaluations = 0;
  spy.calls = [];
  spy.throwOnEvaluate = null;
  spy.rejectOnPermissionCheck = null;
  spy.granted = true;
  spy.canAskAgain = true;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  vi.doUnmock('expo-notifications');
});

describe('when expo-notifications is evaluated', () => {
  it('stays unevaluated when the module is only imported', async () => {
    // Arrange & Act — this is a launch that never schedules: signed out,
    // mid sign-in, or no household row yet. `armDecisionNotification` in
    // _layout.tsx returns before calling anything here.
    await loadModule();

    // Assert
    expect(spy.evaluations).toBe(0);
  });

  it('prints neither Expo Go warning when the module is only imported', async () => {
    // Arrange & Act
    await loadModule();

    // Assert — the whole point of the change, in the owner's own terms.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('evaluates it at the moment something is first scheduled', async () => {
    // Arrange
    const { scheduleDecisionNotification } = await loadModule();
    expect(spy.evaluations).toBe(0);

    // Act
    await scheduleDecisionNotification({ candidateMealCount: 4, decisionPushTime: '16:00' });

    // Assert — deferred, not removed. On a launch that does schedule, the
    // warnings still arrive; they arrive here rather than before first paint.
    expect(spy.evaluations).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('evaluates it once no matter how many foregrounds arm the notification', async () => {
    // Arrange
    const { scheduleDecisionNotification } = await loadModule();

    // Act — `armDecisionNotification` runs on every foreground.
    await scheduleDecisionNotification({ candidateMealCount: 4, decisionPushTime: '16:00' });
    await scheduleDecisionNotification({ candidateMealCount: 4, decisionPushTime: '16:00' });
    await scheduleDecisionNotification({ candidateMealCount: 4, decisionPushTime: '16:00' });

    // Assert — the module cache makes the deferral a one-off cost, so a
    // long session does not accumulate a warning per foreground.
    expect(spy.evaluations).toBe(1);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it('has no top-level import of expo-notifications in its source', () => {
    // Arrange
    const source = readFileSync(SOURCE_PATH, 'utf8');
    // A top-level VALUE import at column 0. `(?!\s+type\b)` is the whole
    // subtlety: `import type * as NotificationsModule` is there on purpose
    // and is erased by the compiler, so it evaluates nothing and must not
    // trip this guard — while a mixed `import { type A, b }` still counts
    // as a value import and still does. The `\r?$` is deliberate too: line
    // endings are not uniform in this tree and `$` under `m` does not
    // match through a carriage return.
    const topLevelImport = /^import(?!\s+type\b)[^\n]*from 'expo-notifications';\r?$/m;

    // Act
    const found = topLevelImport.test(source);

    // Assert — the guard that does not depend on vitest's module registry,
    // and so survives a test-runner upgrade that changes when a mock
    // factory runs. Re-adding that line is the one regression that would
    // silently put both warnings back before the splash screen.
    expect(found).toBe(false);
  });
});

describe('scheduleDecisionNotification', () => {
  it('arms a daily trigger at the household time under the fixed identifier', async () => {
    // Arrange
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    const result = await scheduleDecisionNotification({
      candidateMealCount: 4,
      decisionPushTime: '16:00',
    });

    // Assert
    expect(result).toEqual({ kind: 'scheduled', hour: 16, minute: 0 });
    expect(spy.calls).toContain(`schedule:${DECISION_NOTIFICATION_IDENTIFIER}`);
  });

  it('cancels before it schedules', async () => {
    // Arrange
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    await scheduleDecisionNotification({ candidateMealCount: 4, decisionPushTime: '16:00' });

    // Assert — the ordering, not merely the presence, is what stops a
    // household that opened the app ten times being notified ten times.
    const cancelIndex = spy.calls.indexOf(`cancel:${DECISION_NOTIFICATION_IDENTIFIER}`);
    const scheduleIndex = spy.calls.indexOf(`schedule:${DECISION_NOTIFICATION_IDENTIFIER}`);
    expect(cancelIndex).toBeGreaterThanOrEqual(0);
    expect(scheduleIndex).toBeGreaterThan(cancelIndex);
  });

  it('still cancels when the library is empty, and schedules nothing', async () => {
    // Arrange
    const { scheduleDecisionNotification } = await loadModule();

    // Act — the evening after the last recipe is archived.
    const result = await scheduleDecisionNotification({
      candidateMealCount: 0,
      decisionPushTime: '16:00',
    });

    // Assert — without the cancel, a trigger armed while the library still
    // had meals would keep firing into an empty app forever.
    expect(result).toEqual({ kind: 'skipped', reason: 'empty_library' });
    expect(spy.calls).toContain(`cancel:${DECISION_NOTIFICATION_IDENTIFIER}`);
    expect(spy.calls).not.toContain(`schedule:${DECISION_NOTIFICATION_IDENTIFIER}`);
  });

  it('skips an unreadable time rather than falling back to a time nobody chose', async () => {
    // Arrange
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    const result = await scheduleDecisionNotification({
      candidateMealCount: 4,
      decisionPushTime: 'kwart over vier',
    });

    // Assert
    expect(result).toEqual({ kind: 'skipped', reason: 'unparseable_time' });
    expect(spy.calls).not.toContain(`schedule:${DECISION_NOTIFICATION_IDENTIFIER}`);
  });

  it('reads the seconds Postgres renders on a time column', async () => {
    // Arrange
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    const result = await scheduleDecisionNotification({
      candidateMealCount: 4,
      decisionPushTime: '16:30:00',
    });

    // Assert
    expect(result).toEqual({ kind: 'scheduled', hour: 16, minute: 30 });
  });

  it('does not re-ask somebody who said no and cannot be asked again', async () => {
    // Arrange
    spy.granted = false;
    spy.canAskAgain = false;
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    const result = await scheduleDecisionNotification({
      candidateMealCount: 4,
      decisionPushTime: '16:00',
    });

    // Assert — that decision lives in Settings, not in a prompt this
    // module spends on every foreground.
    expect(result).toEqual({ kind: 'permission_denied' });
    expect(spy.calls).not.toContain('requestPermissions');
  });

  it('asks once when the answer has not been given yet', async () => {
    // Arrange
    spy.granted = false;
    spy.canAskAgain = true;
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    const result = await scheduleDecisionNotification({
      candidateMealCount: 4,
      decisionPushTime: '16:00',
    });

    // Assert
    expect(result).toEqual({ kind: 'permission_denied' });
    expect(spy.calls).toEqual(['getPermissions', 'requestPermissions']);
  });

  it('reports a package that throws on evaluation as unavailable, not as a crash', async () => {
    // Arrange — Expo Go on Android: `warnOfExpoGoPushUsage` throws instead
    // of warning, from the module body of the package's own entry point.
    // With the import at module scope this took `_layout.tsx` down with it
    // and the app did not start.
    spy.throwOnEvaluate = new Error(
      'expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go with the release of SDK 53.',
    );
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    const result = await scheduleDecisionNotification({
      candidateMealCount: 4,
      decisionPushTime: '16:00',
    });

    // Assert — a named outcome the caller already tolerates. No
    // notification today is never no app today.
    //
    // The KIND is the contract; the `reason` deliberately is not asserted
    // here. Vitest replaces a mock factory's thrown message with its own
    // advice text, so the string that arrives is the runner's and not the
    // package's — asserting it would be asserting a fact about Vitest.
    // `describeError`'s own behaviour is covered by the two tests below,
    // which throw from an API call instead.
    expect(result.kind).toBe('unavailable');
    expect(spy.calls).not.toContain(`schedule:${DECISION_NOTIFICATION_IDENTIFIER}`);
  });

  it('carries the platform message through as the reason', async () => {
    // Arrange
    spy.rejectOnPermissionCheck = new Error('Notification permissions module unavailable');
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    const result = await scheduleDecisionNotification({
      candidateMealCount: 4,
      decisionPushTime: '16:00',
    });

    // Assert — `reason` is for a log line, and a log line that says only
    // "unavailable" cannot answer why nobody is being told anything.
    expect(result).toEqual({
      kind: 'unavailable',
      reason: 'Notification permissions module unavailable',
    });
  });

  it('names an unnamed failure rather than returning an empty reason', async () => {
    // Arrange
    spy.rejectOnPermissionCheck = new Error('   ');
    const { scheduleDecisionNotification } = await loadModule();

    // Act
    const result = await scheduleDecisionNotification({
      candidateMealCount: 4,
      decisionPushTime: '16:00',
    });

    // Assert — a blank reason in a log is indistinguishable from no log.
    expect(result).toEqual({ kind: 'unavailable', reason: 'unknown error' });
  });

  it('creates the Android channel before scheduling, because Android shows nothing without one', async () => {
    // Arrange — `platform` is the stub instance the freshly loaded module
    // is holding, not the one this file imported at the top; see
    // `LoadedModule`. `as const` in the stub is a compile-time claim only,
    // so the assignment is real at run time. Restored in `finally`:
    // vitest isolates per file, but a stub left mutated is a trap for
    // whoever adds the next test here.
    const { scheduleDecisionNotification, platform } = await loadModule();
    const original = platform.OS;
    platform.OS = 'android';
    try {
      // Act
      await scheduleDecisionNotification({ candidateMealCount: 4, decisionPushTime: '16:00' });

      // Assert
      const channelIndex = spy.calls.indexOf('setChannel:decision');
      const scheduleIndex = spy.calls.indexOf(`schedule:${DECISION_NOTIFICATION_IDENTIFIER}`);
      expect(channelIndex).toBeGreaterThanOrEqual(0);
      expect(scheduleIndex).toBeGreaterThan(channelIndex);
    } finally {
      platform.OS = original;
    }
  });

  it('sends the copy the product decided on and nothing more', async () => {
    // Arrange — guards the constants against being re-typed here rather
    // than imported, which is how a notification's text quietly drifts
    // from the one place that argues for it.
    expect(DECISION_NOTIFICATION_TITLE).toBe('Wat eten we vanavond?');
    expect(DECISION_NOTIFICATION_BODY).toBe('Remy heeft een voorstel klaarstaan.');
    expect(DECISION_NOTIFICATION_IDENTIFIER).toBe('remy-decision-daily');
  });
});

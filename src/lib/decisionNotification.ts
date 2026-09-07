/**
 * SCHEDULING THE 16:00 NOTIFICATION ON THE DEVICE ITSELF.
 *
 * GAP-30: every part of this feature existed and none of it was wired.
 * `expo-notifications` sat in package.json with a notification icon
 * configured in app.json, `push_tokens` has had a table and an index since
 * 0001, ARCHITECTURE.md described the whole delivery path — and
 * `expo-notifications` was imported by exactly zero files under `src/`.
 * The core loop the product is named for had no way to start.
 *
 * WHY LOCAL AND NOT A SERVER PUSH: see decisionNotificationCopy.ts's
 * header. The short version is that the decision engine's inputs —
 * members, restrictions, saves, decisions — deliberately never leave the
 * phone (mirror/types.ts), so a server would have to be handed a
 * household's allergens in order to tell it what is for dinner. The device
 * already knows.
 *
 * IT NEVER THROWS AND EVERY OUTCOME IS NAMED. This runs on app start and
 * on every foreground, beside `startHouseholdSync`, and holds the contract
 * that module's header states: no notification today is never no app
 * today. A refused permission, an empty library and a device that cannot
 * schedule are three different facts, and collapsing them into `false` is
 * how you end up unable to answer why nobody is being told anything.
 *
 * IT CANCELS BEFORE IT SCHEDULES, and that is the load-bearing line.
 * `scheduleNotificationAsync` ADDS a request; it does not replace one. A
 * household that opened the app ten times would otherwise hold ten
 * identical daily triggers and be notified ten times every evening — which
 * is not a worse version of this feature, it is the reason a person turns
 * notifications off for good. The fixed `DECISION_NOTIFICATION_IDENTIFIER`
 * is what makes the cancel possible.
 *
 * ---------------------------------------------------------------------
 * WHY `expo-notifications` IS IMPORTED INSIDE THE FUNCTION AND NOT AT THE
 * TOP OF THIS FILE. The owner's Expo Go log opened with two warnings, on
 * every single launch, before anything had been scheduled:
 *
 *   WARN  expo-notifications: Android Push notifications (remote
 *         notifications) functionality provided by expo-notifications was
 *         removed from Expo Go with the release of SDK 53. …
 *   WARN  `expo-notifications` functionality is not fully supported in
 *         Expo Go: We recommend you instead use a development build …
 *
 * NEITHER OF THEM IS ABOUT ANYTHING THIS APP DOES. Both are side effects
 * of *evaluating the package's entry module*, and were measured in
 * `expo-notifications@57.0.16`'s own build output rather than guessed:
 *
 *  - The second is `build/index.js:5-9` — a bare
 *    `if (isRunningInExpoGo()) console.warn(…)` in the module body,
 *    reached by importing the package at all.
 *  - The first is `warnOfExpoGoPushUsage()` (`build/warnOfExpoGoPushUsage.js:5`),
 *    which is called from FOUR places and all four are remote-token
 *    paths: `getDevicePushTokenAsync`, `addPushTokenListener`,
 *    `subscribeToTopicAsync`, `unsubscribeFromTopicAsync`. This module
 *    calls none of them. It fires anyway because `build/index.js`
 *    re-exports `./DevicePushTokenAutoRegistration.fx`, whose module body
 *    calls `addPushTokenListener` unconditionally at load.
 *
 * The ORDER in the owner's log is the proof, and it is the reason this is
 * a measurement rather than a story: the push warning arrives BEFORE the
 * "not fully supported" one, even though the latter sits above the export
 * list in `index.js`. That inversion is only explicable by ESM hoisting —
 * re-exported modules are evaluated before the importing module's body.
 * Both warnings therefore live at package-evaluation time, and nothing in
 * `app.json` produces either: a config plugin runs at prebuild against a
 * native project and never runs in Expo Go's JS bundle at all.
 *
 * SO THE HONEST CLAIM, STATED AS TWO DIFFERENT CLAIMS. Moving the import
 * in here REMOVES both warnings from any launch that never schedules —
 * signed out, mid sign-in, no handle yet, no household row — because
 * `armDecisionNotification` in `_layout.tsx` returns before calling this
 * at all, and an unevaluated module warns about nothing. On a launch that
 * DOES schedule the warnings still appear; they are DEFERRED, not
 * removed, from before the splash screen to the moment the app genuinely
 * reaches for the notification API. That is worth having — a warning next
 * to the work it describes is information, the same warning before first
 * paint is noise — but it is a smaller claim and must not be sold as the
 * larger one.
 *
 * AND IT FIXES SOMETHING THAT IS NOT NOISE AT ALL. Read
 * `warnOfExpoGoPushUsage.js:7-10` again: on `Platform.OS === 'android'`
 * it THROWS instead of warning. With the import at module scope, that
 * throw happened while `_layout.tsx`'s own module was being evaluated —
 * so on Android in Expo Go this app failed to start, over a push feature
 * it deliberately does not have. From inside the `try` below, the same
 * throw is caught and returned as `{ kind: 'unavailable' }`, which
 * `armDecisionNotification` already tolerates. The app starts.
 *
 * WHAT WAS REJECTED. (1) Deep-importing past the entry point —
 * `expo-notifications/build/scheduleNotificationAsync` and four more —
 * would remove both warnings outright, and is the wrong trade: it reaches
 * into a dependency's compiled output, which no version promise covers,
 * five separate times, to silence a warning that stays TRUE for whoever
 * adds remote push later. (2) Dropping the `expo-notifications` entry
 * from `app.json` — it is not a warning source, and it is what gives the
 * Android local notification its icon and colour. (3) A LogBox filter or
 * a patched dependency — a false silence, which is strictly worse than a
 * true warning.
 *
 * The cost is one `await` on a module that Metro has already bundled
 * (React Native does no code splitting, so nothing is fetched here and
 * the bundle is not one byte smaller); what moves is evaluation, which is
 * exactly where both warnings live.
 */

import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';
import {
  DECISION_NOTIFICATION_BODY,
  DECISION_NOTIFICATION_IDENTIFIER,
  DECISION_NOTIFICATION_TITLE,
  planDecisionNotification,
  type DecisionNotificationConditions,
} from '@/domain/decisionNotificationCopy';

/**
 * The package's shape, named without pulling the package in.
 *
 * `import type` — not `typeof import(...)`, which reads more directly but
 * which `@typescript-eslint/consistent-type-imports` forbids as a type
 * annotation, and this repo's lint run is otherwise warning-free. Both
 * forms are erased outright by the compiler, so this line adds no
 * `require` to the bundle and nothing to evaluate at load; the ONE runtime
 * import of this package is the `await import(...)` far below.
 *
 * It exists so `ensurePermission` can take the module as an argument and
 * still be fully typed — the alternative, `any`, would have thrown away
 * the compile-time check on the five call shapes below, which is the only
 * thing standing between a renamed trigger field and a notification that
 * silently never fires.
 */
type NotificationsApi = typeof NotificationsModule;

export type DecisionNotificationResult =
  /** A daily notification is armed for this time. */
  | { readonly kind: 'scheduled'; readonly hour: number; readonly minute: number }
  /** Nothing to suggest, or a time that could not be read — see `planDecisionNotification`. */
  | { readonly kind: 'skipped'; readonly reason: 'empty_library' | 'unparseable_time' }
  /** The user was asked and said no. A complete answer; never ask again. */
  | { readonly kind: 'permission_denied' }
  /** The platform refused. `reason` is for a log line, never for a user. */
  | { readonly kind: 'unavailable'; readonly reason: string };

/**
 * Asks for permission only when it has not already been decided.
 *
 * `getPermissionsAsync` first, deliberately: iOS shows its system prompt
 * exactly once per install, and calling `requestPermissionsAsync` when the
 * answer is already stored spends that one prompt on nothing. Somebody who
 * said no keeps saying no until they change it in Settings, which is the
 * right place for that decision to live — this module must never re-ask.
 *
 * TAKES THE MODULE RATHER THAN IMPORTING IT so that the whole file has
 * exactly one line that can evaluate `expo-notifications`, and it is in
 * the caller's `try`. A second import site here would quietly reopen the
 * launch-time warning this file's header spends sixty lines closing.
 */
async function ensurePermission(Notifications: NotificationsApi): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }
  if (!existing.canAskAgain) {
    return false;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Arms — or disarms — the household's daily suggestion notification.
 *
 * Call it on every foreground. It is idempotent by construction: the
 * cancel runs first and the identifier is fixed, so calling it a hundred
 * times leaves exactly one trigger armed.
 *
 * THE CANCEL RUNS EVEN WHEN THE PLAN SAYS SKIP, and that is not tidiness.
 * A household that archives its last recipe must stop being promised a
 * suggestion the same evening — without this, the trigger armed while the
 * library still had meals would keep firing into an empty app forever.
 */
export async function scheduleDecisionNotification(
  conditions: DecisionNotificationConditions,
): Promise<DecisionNotificationResult> {
  const plan = planDecisionNotification(conditions);

  try {
    // THE ONLY LINE IN THIS APP THAT EVALUATES `expo-notifications`, and
    // it is deliberately inside the `try` rather than above it — see the
    // header: in Expo Go on Android the package's own entry module throws
    // on evaluation, and this is what turns that into a named outcome
    // instead of an app that will not start. It sits after
    // `planDecisionNotification` for a smaller reason: that call is pure,
    // and there is no sense evaluating a native module to answer a
    // question already answered.
    const Notifications = await import('expo-notifications');

    const granted = await ensurePermission(Notifications);
    if (!granted) {
      return { kind: 'permission_denied' };
    }

    // Android will not display a notification at all without a channel.
    // Created here rather than at module load so it costs nothing for
    // somebody who never grants permission.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('decision', {
        name: 'Wat eten we vanavond',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    await Notifications.cancelScheduledNotificationAsync(DECISION_NOTIFICATION_IDENTIFIER);

    if (plan.kind === 'skip') {
      return { kind: 'skipped', reason: plan.reason };
    }

    await Notifications.scheduleNotificationAsync({
      identifier: DECISION_NOTIFICATION_IDENTIFIER,
      content: {
        title: DECISION_NOTIFICATION_TITLE,
        body: DECISION_NOTIFICATION_BODY,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: plan.at.hour,
        minute: plan.at.minute,
      },
    });
    return { kind: 'scheduled', hour: plan.at.hour, minute: plan.at.minute };
  } catch (error: unknown) {
    return { kind: 'unavailable', reason: describeError(error) };
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'unknown error';
}

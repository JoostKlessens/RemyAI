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
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  DECISION_NOTIFICATION_BODY,
  DECISION_NOTIFICATION_IDENTIFIER,
  DECISION_NOTIFICATION_TITLE,
  planDecisionNotification,
  type DecisionNotificationConditions,
} from '@/domain/decisionNotificationCopy';

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
 */
async function ensurePermission(): Promise<boolean> {
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
    const granted = await ensurePermission();
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

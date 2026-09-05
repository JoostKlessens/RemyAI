/**
 * PUTTING THIS DEVICE'S EXPO PUSH TOKEN IN `push_tokens`, so the scheduled
 * function has somewhere to deliver the 16:00 decision.
 *
 * THIS IS THE HALF THAT WAS MISSING, AND IT WAS MISSING COMPLETELY.
 * `push_tokens` has existed since 0001_init.sql:727 with its index and its
 * composite foreign key; `expo-notifications` has been in package.json and
 * configured as a plugin in app.json, with a notification icon;
 * ARCHITECTURE.md describes the whole delivery path under "How the 16:00
 * push works". And `expo-notifications` was imported by exactly zero files
 * under `src/`. Every part was bought and none was wired — the same shape
 * of defect as the cook-mode timer bar and `FRIEND_PROOF_BOOST` before it.
 *
 * IT NEVER THROWS, AND IT REPORTS WHY IT DID NOTHING. Every outcome is a
 * named value in `PushRegistrationResult`. That is not defensive padding:
 * this runs on app start, beside `runHouseholdSync`, whose header states
 * the same contract for the same reason — a failure here means "no push
 * today", never "no app today". A rejected permission, a device without a
 * push service, a network blip and a missing build configuration are four
 * different facts, and collapsing them into `false` is how you end up
 * unable to answer why nobody is getting notifications.
 *
 * ---
 *
 * TWO REASONS IT CANNOT SUCCEED TODAY, both verified in the installed
 * packages rather than assumed, and both worth stating here because the
 * next person will otherwise conclude this module is broken.
 *
 * 1. THERE IS NO EAS PROJECT ID. `getExpoPushTokenAsync` reads
 *    `Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas
 *    ?.projectId` and throws `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID` when
 *    neither exists (expo-notifications/build/getExpoPushTokenAsync.js:49).
 *    `app.json`'s `extra` block contains only `router`. So no token can be
 *    issued in Expo Go OR in a development build until an EAS project
 *    exists — this is OPS-02, the same dependency the share extension
 *    waits on, and it is not payable in code.
 *
 * 2. EXPO GO DROPPED REMOTE PUSH ON ANDROID IN SDK 53.
 *    `warnOfExpoGoPushUsage` THROWS on Android in Expo Go and warns on
 *    iOS. So even with a project id, the Android half needs a development
 *    build.
 *
 * Both are reported as `unavailable` with the reason attached, so the app
 * says what is missing instead of crashing or going quiet. When OPS-02
 * lands, this module starts working with no change to its callers.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const PUSH_TOKENS_TABLE = 'push_tokens';

export type PushRegistrationResult =
  /** A token exists in `push_tokens` for this member and device. */
  | { readonly kind: 'registered'; readonly token: string }
  /** The user was asked and said no. A complete answer, not a failure — never ask again on this run. */
  | { readonly kind: 'permission_denied' }
  /** The platform or the build cannot issue a token at all. `reason` is for a log line, not for a user. */
  | { readonly kind: 'unavailable'; readonly reason: string }
  /** A token was obtained but storing it failed — the one case worth retrying on the next app start. */
  | { readonly kind: 'store_failed'; readonly reason: string };

export interface PushRegistrationIdentity {
  readonly memberId: string;
  readonly householdId: string;
}

/**
 * Asks for permission only when it has not already been decided.
 *
 * `getPermissionsAsync` first, deliberately: `requestPermissionsAsync` on
 * iOS shows the system prompt exactly once per install, and calling it
 * when the answer is already stored spends that one prompt on nothing.
 * A user who said no keeps saying no until they change it in Settings,
 * which is the correct place for that decision to live — this module must
 * never re-ask.
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
 * Registers this device for the household's decision push.
 *
 * `memberId` is the member this account resolves to — `chooseBootstrapMember`
 * (householdSync.ts) already owns that question, and this takes its answer
 * rather than asking it a second way. The composite foreign key on
 * `push_tokens` is `(member_id, household_id)`, so both are required and
 * neither may be guessed.
 */
export async function registerForDecisionPush(
  identity: PushRegistrationIdentity,
): Promise<PushRegistrationResult> {
  try {
    const granted = await ensurePermission();
    if (!granted) {
      return { kind: 'permission_denied' };
    }

    // Android needs a channel before a notification can be shown at all;
    // created here rather than at module load so it costs nothing for a
    // user who never grants permission.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('decision', {
        name: 'Wat eten we vanavond',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    return await storeToken(identity, token);
  } catch (error: unknown) {
    // Includes ERR_NOTIFICATIONS_NO_EXPERIENCE_ID (no EAS project id) and
    // the Expo Go Android throw — see the file header. Both are "this
    // build cannot do push", which is a fact about the build and not an
    // error the user caused.
    return { kind: 'unavailable', reason: describeError(error) };
  }
}

/**
 * UPSERT, unlike `ensureRemoteHousehold`'s deliberate insert-only rule, and
 * the difference is the point rather than an inconsistency. That module
 * refuses upsert because an insert that quietly becomes an update can
 * overwrite a household's own name. Here the conflict target IS the
 * identity of the row — `(member_id, expo_push_token)` is unique — so the
 * only thing an update can change is `last_seen_at`, which is exactly what
 * a returning device should refresh. Expo re-issues tokens, so a device
 * that reinstalls arrives with a new token and gets a new row; the stale
 * one is pruned by whatever reads Expo's `DeviceNotRegistered` receipt,
 * not here.
 */
async function storeToken(
  identity: PushRegistrationIdentity,
  token: string,
): Promise<PushRegistrationResult> {
  const { error } = await supabase.from(PUSH_TOKENS_TABLE).upsert(
    {
      member_id: identity.memberId,
      household_id: identity.householdId,
      expo_push_token: token,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,expo_push_token' },
  );
  if (error) {
    return { kind: 'store_failed', reason: error.message };
  }
  return { kind: 'registered', token };
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return 'unknown error';
}

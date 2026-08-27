/**
 * `Stuur door`, mounted — the state DESIGN-SOCIAL.md §3.1's first entry
 * point needs, on any screen that shows an `OutcomeCard`.
 *
 * WHY A HOOK RATHER THAN A COPY PER SCREEN. There are two outcome
 * surfaces (PD-003: the end of Kookmodus, and the pending-outcome overlay
 * on Kiezen) and both must offer the identical send. Written inline, that
 * is two reducers, two note fields, two stale-result guards and two
 * announcements — and src/app/(tabs)/index.tsx is already the largest
 * screen in this repo. Bibliotheek's long-press already carries its own
 * copy of this shape (§3.1's second entry point); a third and fourth would
 * be how the two entry points quietly start behaving differently.
 *
 * WHY THE REPOSITORY WORK IS NOT HERE. It is in src/lib/sendRecipe.ts,
 * which tests/sendRecipe.test.ts can import and assert on. This file holds
 * only what React owns — state, effects, callbacks — and no test
 * environment in this repo can render a hook (vitest is node-only with
 * react-native stubbed). So the split is deliberate and the line is sharp:
 * anything that decides something lives one file down, where it is
 * covered; anything that merely remembers something lives here.
 *
 * THE AUDIENCE IS READ BEFORE THE BUTTON EXISTS, NOT WHEN IT IS TAPPED.
 * §3.1 offers the affordance "only when ≥1 accepted friend exists", and
 * `OutcomeCard` answers that question by being handed a handler or not —
 * its own prop header refuses to ask who your friends are, because that is
 * a repository read. So the read runs as soon as an outcome card is up,
 * and `onSendRecipe` stays `undefined` until it comes back with somebody.
 * The rejected alternative was always offering the button and letting the
 * sheet say "Nog geen vrienden om naar te sturen." — that is the honest
 * copy for Bibliotheek, where the long-press menu is a general-purpose
 * surface, but here it would put a control leading to a dead end on the
 * one card in the app whose entire job is to be cheap to walk away from.
 * It also costs the sheet its loading state: the list is already in hand
 * when it opens.
 *
 * EVERY COMMITTED ROW IS WIPED ON EACH OPEN, which is `reduceSendSheet`'s
 * own rule (`load-started`) reached by a different route: the sheet is
 * re-seeded from the audience on every `open`, so a reopened sheet never
 * reads `Verstuurd`. A sheet that remembered would be a sender-side record
 * of what you sent whom, kept on the device and shown back to you — the
 * history §3.5 has not asked for.
 *
 * NO COOK GATE (PD-016). This hook takes a meal id and nothing else. Both
 * call sites happen to sit beside a cook event; neither passes it, and
 * there is no parameter here that could carry one.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  INITIAL_SEND_SHEET,
  reduceSendSheet,
  type SendFriendIdentity,
  type SendSheetState,
} from '@/components/sendRecipeSheetCopy';
import type { ProfileId } from '@/domain/social/types';
import type { MealId } from '@/domain/types';
import { useSession } from '@/hooks/useSession';
import { getAppMirrorOutbox } from './repository/createRepository';
import { createSupabaseSocialRepository } from './repository/social/supabaseSocialRepository';
import {
  describeSendOutcomeAnnouncement,
  isSendableRowStatus,
  loadSendAudience,
  sendRecipeToFriend,
} from './sendRecipe';
import { supabase } from './supabase';

/** Stable empty list, so clearing the audience does not re-render everything downstream. */
const NO_AUDIENCE: readonly SendFriendIdentity[] = [];

/**
 * Everything the two screens need, and deliberately nothing shaped like
 * `SendRecipeSheetProps`.
 *
 * Returning a ready-made props object would read shorter at both call
 * sites and would tie this module to a component's prop list — so a field
 * added to the sheet for one screen would silently arrive on the other.
 * The screens spell the sheet out instead, and each still passes its own
 * `dishTitle` and `reduceMotionEnabled`, which they already hold.
 */
export interface OutcomeSend {
  /**
   * Handed straight to `OutcomeCard`'s optional `onSendRecipe`.
   * `undefined` until the audience read lands with at least one friend —
   * which is exactly how that prop asks to be told "no friends, no
   * button".
   */
  readonly onSendRecipe: (() => void) | undefined;
  readonly sheetVisible: boolean;
  readonly friends: SendSheetState;
  /** Raw as typed. Trimming and measuring belong to `normalizeSendNote`, at the write. */
  readonly note: string;
  readonly onChangeNote: (note: string) => void;
  readonly onSend: (recipientProfileId: ProfileId) => void;
  readonly onRetryFriends: () => void;
  readonly onDismiss: () => void;
}

/**
 * @param mealId the dish the outcome card is currently about, or null
 * whenever no card is up. Null stops the audience read rather than merely
 * hiding its result, so a screen holding a finished meal in state does not
 * keep querying for it.
 */
export function useOutcomeSend(mealId: MealId | null): OutcomeSend {
  /** The sender. `profiles.id` IS `auth.users.id`, so the session's user id is the profile id. */
  const { userId } = useSession();

  const [audience, setAudience] = useState<readonly SendFriendIdentity[]>(NO_AUDIENCE);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [friends, dispatch] = useReducer(reduceSendSheet, INITIAL_SEND_SHEET);
  /**
   * Cleared per dish rather than carried between them. A note is written
   * about one meal for one person; keeping it would attach words somebody
   * chose for a traybake to a curry, without them ever seeing it happen.
   */
  const [note, setNote] = useState('');
  /**
   * The dish the OPEN sheet is about — a snapshot taken on `open`, not the
   * parameter above. Two things depend on the difference. A slow write
   * belonging to a dish the user has already closed must not land on the
   * next one (recipes.tsx keeps the same ref for the same reason). And on
   * Kiezen the card can dismiss while the sheet is still up — §3.1's "the
   * send opens while the card closes underneath" — at which point `mealId`
   * goes null and the send would otherwise lose the meal it is about.
   */
  const openMealRef = useRef<MealId | null>(null);

  useEffect(() => {
    if (mealId === null || userId === null) {
      setAudience(NO_AUDIENCE);
      return;
    }
    let cancelled = false;
    // Never rejects: a failed friendship read resolves to an empty
    // audience, which removes the button rather than putting an error on a
    // card that is asking how dinner was. See `loadSendAudience`.
    void loadSendAudience(createSupabaseSocialRepository(supabase), userId).then((friendIdentities) => {
      if (!cancelled) {
        setAudience(friendIdentities);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mealId, userId]);

  const open = useCallback((): void => {
    if (mealId === null) {
      return;
    }
    openMealRef.current = mealId;
    setNote('');
    // Seeded from the read that already happened, so the sheet opens on
    // its list rather than on a spinner — and re-seeded every time, which
    // is what wipes any row a previous open committed.
    dispatch({ type: 'load-succeeded', friends: audience });
    setSheetVisible(true);
  }, [mealId, audience]);

  const onDismiss = useCallback((): void => {
    openMealRef.current = null;
    setSheetVisible(false);
  }, []);

  /**
   * A refresh, and the sheet's `unavailable` retry if it ever reaches that
   * phase. It cannot today: `open` seeds the list from an audience read
   * that has already resolved, and a failed read resolves to an empty list
   * rather than to a failure, so the sheet opens `ready` every time. This
   * stays a real re-read rather than a stub because the moment the button
   * is offered before its read lands — the obvious next change — this is
   * the handler that has to work.
   */
  const onRetryFriends = useCallback((): void => {
    const openMealId = openMealRef.current;
    if (openMealId === null || userId === null) {
      return;
    }
    dispatch({ type: 'load-started' });
    void loadSendAudience(createSupabaseSocialRepository(supabase), userId).then((friendIdentities) => {
      if (openMealRef.current !== openMealId) {
        return;
      }
      setAudience(friendIdentities);
      dispatch({ type: 'load-succeeded', friends: friendIdentities });
    });
  }, [userId]);

  /**
   * One send, one row, optimistic in the shape Bibliotheek's already is:
   * the row goes into flight on tap, and either commits or says plainly
   * that nothing was sent.
   *
   * The announcement is the whole confirmation for anyone who cannot see
   * the accent stroke draw — the sheet stays open on a commit (§4.1), so
   * there is no new surface a screen reader would land on. Word for word
   * identical on a re-send: `sendRecipe` upserts on (meal, recipient) and
   * `describeSendOutcomeAnnouncement` is handed no count and no previous
   * attempt, so there is no second delivery to announce.
   */
  const onSend = useCallback(
    (recipientProfileId: ProfileId): void => {
      const openMealId = openMealRef.current;
      if (openMealId === null || userId === null) {
        return;
      }
      const recipient = friends.friends.find((friend) => friend.profileId === recipientProfileId);
      // `idle` or `failed` only — the reducer would ignore anything else,
      // and a write fired against an ignored transition is a request
      // nothing on screen would ever account for.
      if (recipient === undefined || !isSendableRowStatus(recipient.status)) {
        return;
      }

      dispatch({ type: 'send-started', recipientProfileId });
      // The outbox goes in because a send is the one act that opens this
      // meal to somebody outside the household, and a meal whose mirror
      // has not landed reaches them as a recipe with no ingredients.
      // `sendRecipeToFriend` refuses in that window and reports `failed`,
      // which the row already treats as its own retry (§4.1).
      void sendRecipeToFriend(createSupabaseSocialRepository(supabase), getAppMirrorOutbox(), {
        mealId: openMealId,
        senderProfileId: userId,
        recipientProfileId,
        // Raw. `normalizeSendNote` trims it, nulls a blank one and rejects
        // an over-long one rather than cutting it short — one
        // implementation of that rule, at the write.
        note,
      }).then((outcome) => {
        if (openMealRef.current !== openMealId) {
          return;
        }
        dispatch({ type: outcome === 'sent' ? 'send-succeeded' : 'send-failed', recipientProfileId });
        AccessibilityInfo.announceForAccessibility(describeSendOutcomeAnnouncement(outcome, recipient.displayName));
      });
    },
    [userId, friends, note],
  );

  return {
    onSendRecipe: audience.length > 0 ? open : undefined,
    sheetVisible,
    friends,
    note,
    onChangeNote: setNote,
    onSend,
    onRetryFriends,
    onDismiss,
  };
}

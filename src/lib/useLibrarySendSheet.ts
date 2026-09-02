/**
 * `Sturen` from the Bibliotheek long-press sheet (DESIGN-SOCIAL.md §3.1's
 * second entry point), mounted — the state, the friend read, and the one
 * write, lifted out of src/app/(tabs)/recipes.tsx.
 *
 * WHY IT LEFT THE SCREEN. That file crossed the repo's own 800-line ceiling,
 * and this was the block that came out whole: everything below is about ONE
 * dish going to ONE person, and none of it touches the grid, the search, the
 * scheduling row or the removal confirm that make up the rest of the screen.
 * A hook is also the shape the app already reaches for here —
 * useOutcomeSend.ts is the same lift, made for the same reason, on the
 * largest screen in the repo.
 *
 * WHY IT IS NOT `useOutcomeSend` ITSELF, which is the obvious question and
 * deserves an answer rather than a shrug. That hook's own header names this
 * surface and argues the difference: it READS THE AUDIENCE BEFORE THE BUTTON
 * EXISTS, so an outcome card offers no send at all until somebody is there to
 * send to — deliberately, because that card's whole job is to be cheap to
 * walk away from and a control leading to a dead end would spoil it. It then
 * says, in as many words, that always offering the row and letting the sheet
 * answer "Nog geen vrienden om naar te sturen." is "the honest copy for
 * Bibliotheek, where the long-press menu is a general-purpose surface".
 *
 * So the two behaviours differ on purpose, each in the direction its surface
 * needs, and merging them behind a flag would erase a documented decision to
 * save a file. What IS shared is everything that decides anything:
 * `reduceSendSheet` and its copy (components/sendRecipeSheetCopy.ts), which
 * both entry points run, and which is where the two would actually drift if
 * they were ever going to.
 *
 * WHAT LIVES HERE AND WHAT DOES NOT — the line useOutcomeSend.ts draws and
 * this file keeps: no test environment in this repo can render a hook (vitest
 * is node-only with react-native stubbed), so anything that DECIDES something
 * belongs one file down where a test can reach it, and only what REMEMBERS
 * something belongs here. The reducer, the copy and the note's length rule
 * are all elsewhere and all covered.
 */

import { useCallback, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  INITIAL_SEND_SHEET,
  SEND_FAILED_ANNOUNCEMENT,
  describeSendAnnouncement,
  reduceSendSheet,
  type SendFriendIdentity,
  type SendSheetState,
} from '@/components/sendRecipeSheetCopy';
import { collectAcceptedFriendIds } from '@/domain/social/friendship';
import type { ProfileId } from '@/domain/social/types';
import type { Meal, MealId } from '@/domain/types';
import { createSupabaseSocialRepository } from './repository/social/supabaseSocialRepository';
import { supabase } from './supabase';

/**
 * The friends a dish could go to: every mutually accepted friend, named.
 *
 * NO PRE-FLIGHT PERMISSION CHECK HERE OR ANYWHERE BELOW IT. `recipe_shares`
 * carries a three-clause insert policy — the sender is you, the recipient is
 * a friend, the meal is your household's — and RLS enforces every one on the
 * write. A client-side copy of a permission rule is the copy that drifts, and
 * the supabase implementation says so about the same three clauses. This read
 * answers "who do I know", never "who may I write to"; a refusal surfaces as
 * a failed send, on the row that asked for it.
 *
 * AND NO COOK CHECK. PD-016: anything in the library may be sent. There is no
 * cook event in this function's inputs and none belongs there.
 *
 * A friend whose profile row fails to load is dropped rather than listed
 * nameless — a blank name beside a `Stuur` action is a tap nobody should be
 * invited to take.
 */
async function loadSendFriends(profileId: ProfileId): Promise<readonly SendFriendIdentity[]> {
  const repository = createSupabaseSocialRepository(supabase);
  const friendIds = collectAcceptedFriendIds(await repository.listFriendships(profileId), profileId);
  if (friendIds.size === 0) {
    return [];
  }

  const profiles = await Promise.all([...friendIds].map((friendId) => repository.getProfile(friendId)));
  return profiles.flatMap((profile) =>
    profile === null ? [] : [{ profileId: profile.id, displayName: profile.displayName, handle: profile.handle }],
  );
}

export interface LibrarySendSheet {
  /** The dish the sheet is about, or null when it is closed. It mounts only for a dish — its title IS that dish. */
  readonly meal: Meal | null;
  readonly state: SendSheetState;
  readonly note: string;
  readonly onChangeNote: (note: string) => void;
  readonly open: (meal: Meal) => void;
  readonly close: () => void;
  readonly onRetryFriends: () => void;
  readonly onSend: (recipientProfileId: ProfileId) => void;
}

export interface LibrarySendSheetOptions {
  /** The signed-in profile, or null while the identity is still resolving. */
  readonly userId: ProfileId | null;
  /**
   * Run just before the sheet opens, so the caller can close whatever the
   * user opened it FROM.
   *
   * A CALLBACK RATHER THAN THIS HOOK KNOWING ABOUT THE ACTION SHEET: two
   * stacked modals over one dish means two scrims and a back gesture whose
   * meaning depends on which is on top, and the screen is the only thing that
   * can close the other one. Making it a parameter keeps that fact at the
   * call site instead of importing the action sheet's state in here.
   */
  readonly onBeforeOpen: () => void;
}

export function useLibrarySendSheet(options: LibrarySendSheetOptions): LibrarySendSheet {
  const { userId, onBeforeOpen } = options;

  const [meal, setMeal] = useState<Meal | null>(null);
  const [state, dispatch] = useReducer(reduceSendSheet, INITIAL_SEND_SHEET);
  /**
   * Raw as typed, and cleared per dish rather than kept between them. A note
   * is written about one meal for one person; carrying it to the next
   * long-press would attach words somebody chose for a traybake to a curry,
   * without them ever seeing it happen.
   */
  const [note, setNote] = useState('');
  /** The dish the sheet is about: a slow read must not land on the next dish. */
  const mealRef = useRef<MealId | null>(null);

  const loadFriends = useCallback((mealId: MealId, profileId: ProfileId | null): void => {
    dispatch({ type: 'load-started' });
    // Not a signed-out branch — PD-012 means the root layout answers that
    // before this tab ever renders, so a null id here only means the identity
    // has not resolved yet. Reading without one would ask the database a
    // question with no `auth.uid()` behind it; the sheet stays on its loading
    // line instead, which is the truthful state.
    if (profileId === null) {
      return;
    }
    loadSendFriends(profileId)
      .then((friends: readonly SendFriendIdentity[]) => {
        if (mealRef.current === mealId) {
          dispatch({ type: 'load-succeeded', friends });
        }
      })
      .catch(() => {
        if (mealRef.current === mealId) {
          dispatch({ type: 'load-failed' });
        }
      });
  }, []);

  const open = useCallback(
    (nextMeal: Meal): void => {
      onBeforeOpen();
      mealRef.current = nextMeal.id;
      setNote('');
      setMeal(nextMeal);
      loadFriends(nextMeal.id, userId);
    },
    [loadFriends, userId, onBeforeOpen],
  );

  const close = useCallback((): void => {
    mealRef.current = null;
    setMeal(null);
  }, []);

  const onRetryFriends = useCallback((): void => {
    if (meal === null) {
      return;
    }
    loadFriends(meal.id, userId);
  }, [meal, loadFriends, userId]);

  /**
   * One send, one row. Optimistic in the same shape the exclusion write is:
   * the row goes into flight immediately, and one of two things follows — the
   * write lands and the row commits, or it fails and the row says so with
   * nothing pretending to have been sent.
   *
   * THERE IS NO RE-READ AFTER THE WRITE, unlike the screen's
   * `commitExclusion`. That one re-reads because `getMealCookProofExclusion`
   * refuses to invent a fail-open answer and the returned row cannot be
   * trusted for it. Here `sendRecipe` returns the `RecipeShare` it just
   * upserted, and there is no second question to ask: a send either exists or
   * the write threw. Asking again would also be the first step toward a
   * sender-side list of what you have sent whom, which §3.5 has not asked for.
   *
   * The note goes in RAW. `normalizeSendNote` trims it, turns whitespace-only
   * into null, and REJECTS an over-long one rather than cutting it short — one
   * implementation of that rule, at the write. The sheet has already disabled
   * every row while the note is too long, so this path is reached with a note
   * the repository will accept; if that ever stops being true, the throw lands
   * on the row that asked for it.
   */
  const commitSend = useCallback(
    async (mealId: MealId, senderProfileId: ProfileId, recipient: SendFriendIdentity, text: string): Promise<void> => {
      const recipientProfileId = recipient.profileId;
      dispatch({ type: 'send-started', recipientProfileId });

      try {
        await createSupabaseSocialRepository(supabase).sendRecipe({
          mealId,
          senderProfileId,
          recipientProfileId,
          note: text,
        });
      } catch {
        if (mealRef.current === mealId) {
          dispatch({ type: 'send-failed', recipientProfileId });
          AccessibilityInfo.announceForAccessibility(SEND_FAILED_ANNOUNCEMENT);
        }
        return;
      }

      if (mealRef.current === mealId) {
        dispatch({ type: 'send-succeeded', recipientProfileId });
        // The sheet stays open and the accent stroke is silent, so this is the
        // whole confirmation for anyone who cannot see it. Word for word
        // identical on a re-send: `sendRecipe` upserts on (meal, recipient),
        // moves no `sentAt` and resets no seen state, so there is no second
        // delivery to announce.
        AccessibilityInfo.announceForAccessibility(describeSendAnnouncement(recipient.displayName));
      }
    },
    [],
  );

  const onSend = useCallback(
    (recipientProfileId: ProfileId): void => {
      if (meal === null || userId === null) {
        return;
      }
      const recipient = state.friends.find((friend) => friend.profileId === recipientProfileId);
      // `idle` or `failed` only — the reducer would ignore anything else, and
      // a write fired against an ignored transition is a request nothing on
      // screen would ever account for.
      if (recipient === undefined || (recipient.status !== 'idle' && recipient.status !== 'failed')) {
        return;
      }
      void commitSend(meal.id, userId, recipient, note);
    },
    [meal, state, userId, note, commitSend],
  );

  return { meal, state, note, onChangeNote: setNote, open, close, onRetryFriends, onSend };
}

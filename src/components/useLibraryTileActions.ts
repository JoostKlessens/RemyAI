/**
 * The three things "Mijn recepten"'s long-press sheet can do to a dish —
 * exclude it from cook proof, take it out of the library, put it in or out of
 * this week — together with the sheet's own open/close state.
 *
 * ===========================================================================
 * WHY THIS IS A MODULE AND NOT STILL INLINE
 * ===========================================================================
 *
 * recipes.tsx was 786 lines against coding-style.md's 800 ceiling, and the
 * 3-across grid adds to it rather than taking away. Something had to leave,
 * and this is the part that is a self-contained state machine rather than a
 * composition: three reducers, three async writes, three guard refs, and
 * nothing on screen. Extracting it is the same move `LibraryHeader` and
 * `useLibrarySendSheet` already made from the same file.
 *
 * IT SITS BESIDE `useThumbnailFallback` IN src/components, not in src/hooks
 * or src/lib, for the reason that one already established: a hook whose only
 * consumer is one screen's own surface belongs with it. `useLibrarySendSheet`
 * is in src/lib because it reaches the SOCIAL repository, a seam this screen's
 * header is at pains to keep separate; nothing here touches it.
 *
 * ===========================================================================
 * WHAT MOVED, AND WHAT DID NOT
 * ===========================================================================
 *
 * Every behaviour below is recipes.tsx's, unchanged, comments included. Two
 * things deliberately stayed behind:
 *
 * - "Aanpassen" (RCP-03). It closes the sheet and pushes a route, and a
 *   router belongs to the screen; there is no repository call to move.
 * - The send sheet. Its state, its friend read and its one write live in
 *   src/lib/useLibrarySendSheet.ts and are not this module's — see that
 *   file's header for why.
 *
 * THE TWO CALLBACKS ARE THE SEAM. `onRemoved` and `onSchedulingChanged` exist
 * because the two writes need opposite things from the grid, and that
 * asymmetry is load-bearing rather than incidental:
 *
 *   onRemoved            drops one row locally. An archived meal would be
 *                        excluded by the next `listHouseholdMeals` read
 *                        regardless, so a full reload would be a loading
 *                        state over a grid that mostly did not change.
 *
 *   onSchedulingChanged  reloads. A save changes the meal's SCHEDULING, which
 *                        `resolveRecipeSchedulingState` computes from saves
 *                        and cook events together and `sortMealsByScheduling`
 *                        then reorders the grid around. Reproducing that here
 *                        would be a second implementation of the ordering
 *                        rule; removal only had to drop a row, which is
 *                        genuinely local.
 */

import { useCallback, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { Meal, MealId } from '@/domain/types';
import { getAppRepository } from '@/lib/repository';
import {
  INITIAL_LIBRARY_REMOVAL,
  LIBRARY_REMOVE_FAILED_ANNOUNCEMENT,
  describeLibraryRemovedAnnouncement,
  reduceLibraryRemoval,
  type LibraryRemovalState,
} from './libraryRemovalCopy';
import {
  INITIAL_LIBRARY_SCHEDULING,
  LIBRARY_SCHEDULE_FAILED_NOTE,
  LIBRARY_UNSCHEDULE_FAILED_NOTE,
  describeLibraryScheduledAnnouncement,
  describeLibraryUnscheduledAnnouncement,
  reduceLibraryScheduling,
  type LibrarySchedulingState,
} from './librarySchedulingCopy';
import {
  COOK_PROOF_WRITE_FAILED_ANNOUNCEMENT,
  INITIAL_COOK_PROOF_EXCLUSION,
  describeCookProofExclusionAnnouncement,
  reduceCookProofExclusion,
  type CookProofExclusionState,
} from './libraryTileActionCopy';

export interface LibraryTileActionsOptions {
  /** Called once an archive has actually landed, with the row the grid should drop. */
  readonly onRemoved: (mealId: MealId) => void;
  /** Called once a save has landed in either direction — the grid must be re-read, not patched. See the header. */
  readonly onSchedulingChanged: () => void;
}

export interface LibraryTileActions {
  /** The dish the sheet is open on, or `null` when it is closed — the sheet's title IS that dish, so there is nothing correct to render without one. */
  readonly meal: Meal | null;
  readonly exclusion: CookProofExclusionState;
  readonly removal: LibraryRemovalState;
  readonly scheduling: LibrarySchedulingState;
  /**
   * `isPlanned` is passed IN, from the row the user long-pressed, rather than
   * read here. Whether this dish is in the week is already resolved for every
   * tile in the grid by `resolveRecipeSchedulingState` — it is what draws the
   * badge that was just long-pressed — so a second read would be a second
   * definition of "deze week", which `listPendingSaves`' own doc comment
   * warns against.
   */
  readonly open: (meal: Meal, isPlanned: boolean) => void;
  readonly close: () => void;
  readonly onPressCookProofRow: () => void;
  readonly onRequestRemoval: () => void;
  readonly onCancelRemoval: () => void;
  readonly onConfirmRemoval: () => void;
  readonly onPressSchedulingRow: () => void;
}

export function useLibraryTileActions(options: LibraryTileActionsOptions): LibraryTileActions {
  const { onRemoved, onSchedulingChanged } = options;

  const [actionSheetMeal, setActionSheetMeal] = useState<Meal | null>(null);
  const [exclusion, dispatchExclusion] = useReducer(reduceCookProofExclusion, INITIAL_COOK_PROOF_EXCLUSION);
  /**
   * The dish whose exclusion the reducer currently describes. Every async
   * resolution below checks it before dispatching, because closing the sheet
   * and long-pressing a different tile is one flick apart: without this, a
   * slow read for the dish you just closed lands on the dish you just opened
   * and tells you it is withheld when it is not. A `cancelled` boolean per
   * call would cover the close but not the switch.
   */
  const exclusionMealRef = useRef<MealId | null>(null);

  // LIB-04 — "Verwijderen". Same shape as `exclusion`/`exclusionMealRef`
  // above, for the same reason: `open` resets both to a fresh dish's starting
  // state, and `removalMealRef` guards `commitRemoval`'s async resolution
  // against landing on a dish the household has since closed or switched
  // away from.
  const [removal, dispatchRemoval] = useReducer(reduceLibraryRemoval, INITIAL_LIBRARY_REMOVAL);
  const removalMealRef = useRef<MealId | null>(null);

  /**
   * "Deze week" / "Uit de week halen" — the library-side half of planning,
   * which this app shipped without: `createSave` was reachable from the
   * import confirmation screen and nowhere else, so a dish could only ever be
   * planned at the moment it arrived. See librarySchedulingCopy.ts.
   *
   * NO `loadScheduling` BESIDE `loadExclusion`, and the absence is the design
   * — see `open`'s `isPlanned` parameter.
   */
  const [scheduling, dispatchScheduling] = useReducer(reduceLibraryScheduling, INITIAL_LIBRARY_SCHEDULING);
  const schedulingMealRef = useRef<MealId | null>(null);

  const loadExclusion = useCallback((mealId: MealId): void => {
    dispatchExclusion({ type: 'load-started' });
    getAppRepository()
      .getMealCookProofExclusion(mealId)
      .then((excluded: boolean) => {
        if (exclusionMealRef.current === mealId) {
          dispatchExclusion({ type: 'load-succeeded', excluded });
        }
      })
      .catch(() => {
        if (exclusionMealRef.current === mealId) {
          dispatchExclusion({ type: 'load-failed' });
        }
      });
  }, []);

  const open = useCallback(
    (meal: Meal, isPlanned: boolean): void => {
      exclusionMealRef.current = meal.id;
      setActionSheetMeal(meal);
      loadExclusion(meal.id);
      // LIB-04: a freshly opened sheet always starts at "Verwijderen" idle —
      // see libraryRemovalCopy.ts's header on why there is nothing to read
      // here, unlike the exclusion above.
      removalMealRef.current = meal.id;
      dispatchRemoval({ type: 'reset' });
      schedulingMealRef.current = meal.id;
      dispatchScheduling({ type: 'opened', isPlanned });
    },
    [loadExclusion],
  );

  const close = useCallback((): void => {
    exclusionMealRef.current = null;
    setActionSheetMeal(null);
    removalMealRef.current = null;
    dispatchRemoval({ type: 'reset' });
    schedulingMealRef.current = null;
  }, []);

  /**
   * Optimistic, then confirmed. The row flips the instant it is tapped
   * (`write-started`), and one of exactly three things follows:
   *
   * - the write fails -> `write-failed` rolls the row back to where it was
   *   and says so under it. Nothing was withheld and nothing pretends to
   *   have been.
   * - the write lands and the re-read agrees -> `write-succeeded` with the
   *   repository's own answer, not the guess.
   * - the write lands but the re-read fails -> `load-failed`. NOT
   *   `write-failed`: the change may well have gone through, so claiming
   *   "er is niets veranderd" would be the one wrong thing to say. The sheet
   *   drops back to "we can't read this right now" with a retry.
   *
   * THE EXCLUSION IS NEVER READ OFF `Meal.excludedFromCookProof`, not even
   * off the `Meal` that `setMealCookProofExclusion` hands back. That field is
   * optional (legacy rows lack the key) and it is the one field in the domain
   * whose absent reading is fail-OPEN — missing means "share it" — so
   * src/domain/types.ts asks callers to go through
   * `getMealCookProofExclusion`, which normalises and refuses an unknown id
   * rather than answering "not excluded". That is why the write is followed
   * by a re-read instead of trusting the returned row.
   */
  const commitExclusion = useCallback(async (mealId: MealId, nextExcluded: boolean): Promise<void> => {
    const repository = getAppRepository();
    dispatchExclusion({ type: 'write-started' });

    try {
      await repository.setMealCookProofExclusion(mealId, nextExcluded);
    } catch {
      if (exclusionMealRef.current === mealId) {
        dispatchExclusion({ type: 'write-failed' });
        AccessibilityInfo.announceForAccessibility(COOK_PROOF_WRITE_FAILED_ANNOUNCEMENT);
      }
      return;
    }

    try {
      const confirmed = await repository.getMealCookProofExclusion(mealId);
      if (exclusionMealRef.current === mealId) {
        dispatchExclusion({ type: 'write-succeeded', excluded: confirmed });
        // The sheet morphs in place with no navigation — the same silent
        // state change SaveIntentSheet and AllergenTaggingSection announce.
        AccessibilityInfo.announceForAccessibility(describeCookProofExclusionAnnouncement(confirmed));
      }
    } catch {
      if (exclusionMealRef.current === mealId) {
        dispatchExclusion({ type: 'load-failed' });
      }
    }
  }, []);

  const onPressCookProofRow = useCallback((): void => {
    if (actionSheetMeal === null) {
      return;
    }
    // In `unavailable` the row IS the retry — there is no value to toggle
    // yet, and guessing one is exactly what the getter refuses to do. A
    // FAILED READ IS NOT "NOT EXCLUDED": a control shown off after a failed
    // read displays a privacy choice the household never made.
    if (exclusion.phase === 'unavailable') {
      loadExclusion(actionSheetMeal.id);
      return;
    }
    if (exclusion.phase !== 'ready' || exclusion.pending) {
      return;
    }
    void commitExclusion(actionSheetMeal.id, !exclusion.excluded);
  }, [actionSheetMeal, exclusion, loadExclusion, commitExclusion]);

  // -------------------------------------------------------------------------
  // Verwijderen (LIB-04) — the only row that removes a dish from the grid
  // rather than changing how it is shared. See libraryRemovalCopy.ts for why
  // archiving (never a hard delete) and why a two-button in-place confirm.
  // -------------------------------------------------------------------------

  const onRequestRemoval = useCallback((): void => {
    dispatchRemoval({ type: 'request-removal' });
  }, []);

  const onCancelRemoval = useCallback((): void => {
    dispatchRemoval({ type: 'cancel-removal' });
  }, []);

  /**
   * Unlike `commitExclusion`, there is no re-read after the write and no
   * rollback on the row: `archiveMeal` either lands or throws, and a
   * confirmed removal has nowhere to roll back TO — the sheet closes and the
   * tile leaves the grid the moment the write succeeds. On failure the sheet
   * stays open and the row itself becomes the retry (`failed` phase),
   * matching `describeLibraryRemovalRow`'s contract.
   */
  const commitRemoval = useCallback(
    async (meal: Meal): Promise<void> => {
      dispatchRemoval({ type: 'confirm-removal' });

      try {
        await getAppRepository().archiveMeal(meal.id);
      } catch {
        if (removalMealRef.current === meal.id) {
          dispatchRemoval({ type: 'removal-failed' });
          AccessibilityInfo.announceForAccessibility(LIBRARY_REMOVE_FAILED_ANNOUNCEMENT);
        }
        return;
      }

      if (removalMealRef.current !== meal.id) {
        return;
      }
      onRemoved(meal.id);
      close();
      AccessibilityInfo.announceForAccessibility(describeLibraryRemovedAnnouncement(meal.title));
    },
    [close, onRemoved],
  );

  const onConfirmRemoval = useCallback((): void => {
    if (actionSheetMeal === null || removal.phase !== 'confirming') {
      return;
    }
    void commitRemoval(actionSheetMeal);
  }, [actionSheetMeal, removal, commitRemoval]);

  /**
   * The write behind the "Deze week" row, in whichever direction the row is
   * currently pointing.
   *
   * IT DOES NOT CLOSE THE SHEET, unlike `commitRemoval`. Removal ends the
   * dish's presence in this grid, so there is nothing left to be on screen;
   * planning is reversible in one tap, and the row morphing in place is the
   * confirmation (librarySchedulingCopy.ts). Closing would take that feedback
   * away at the moment it is earned.
   *
   * `memberId: null` — the same value the import confirmation screen writes.
   * A save belongs to the household, and nothing in this app asks which
   * member planned a dish.
   */
  const commitScheduling = useCallback(
    async (meal: Meal, isPlanned: boolean): Promise<void> => {
      dispatchScheduling({ type: 'toggle-started' });

      try {
        const repository = getAppRepository();
        const householdId = await repository.getCurrentHouseholdId();
        if (isPlanned) {
          await repository.removeSaves(householdId, meal.id, 'this_week');
        } else {
          await repository.createSave({
            householdId,
            memberId: null,
            mealId: meal.id,
            intent: 'this_week',
            sourceUrl: null,
          });
        }
      } catch {
        // The ref guard `commitRemoval` and `commitExclusion` both use: a
        // slow write must not report its failure onto whichever dish the
        // sheet has since been reopened on.
        if (schedulingMealRef.current === meal.id) {
          dispatchScheduling({ type: 'toggle-failed' });
          AccessibilityInfo.announceForAccessibility(
            isPlanned ? LIBRARY_UNSCHEDULE_FAILED_NOTE : LIBRARY_SCHEDULE_FAILED_NOTE,
          );
        }
        return;
      }

      if (schedulingMealRef.current !== meal.id) {
        return;
      }
      dispatchScheduling({ type: 'toggle-succeeded' });
      AccessibilityInfo.announceForAccessibility(
        isPlanned
          ? describeLibraryUnscheduledAnnouncement(meal.title)
          : describeLibraryScheduledAnnouncement(meal.title),
      );
      onSchedulingChanged();
    },
    [onSchedulingChanged],
  );

  const onPressSchedulingRow = useCallback((): void => {
    if (actionSheetMeal === null || scheduling.phase === 'pending') {
      return;
    }
    void commitScheduling(actionSheetMeal, scheduling.isPlanned);
  }, [actionSheetMeal, scheduling, commitScheduling]);

  return {
    meal: actionSheetMeal,
    exclusion,
    removal,
    scheduling,
    open,
    close,
    onPressCookProofRow,
    onRequestRemoval,
    onCancelRemoval,
    onConfirmRemoval,
    onPressSchedulingRow,
  };
}

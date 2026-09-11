/**
 * `Bewaren` -> sheet -> write -> `Bewaard`, as one reducer and one effect
 * (docs/DESIGN-SOCIAL.md §3.3).
 *
 * LIFTED OUT OF `/friends/[feedItemId]` BECAUSE THERE ARE TWO SCREENS NOW.
 * The save is keyed on a CANONICAL recipe id and nothing else, which is
 * exactly why it transplants without a line changing: a send card carries
 * one off the sender's meal (`FriendRecipeCardModel.canonicalRecipeId`), a
 * proof card IS one. The two routes read different rows under different
 * permissions — that difference is why they stayed two files — but by the
 * time either has a recipe id in hand, the write is the same write.
 *
 * EVERY TRANSITION IS `reduceSharedRecipeSave`'s, and it is tested. This
 * only dispatches, and performs the single write through `saveRecipeCopy`,
 * which reports rather than throws — so there is no error path to forget.
 */

import { useCallback, useReducer } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  IDLE_SHARED_RECIPE_SAVE,
  describeSharedRecipeSaveAnnouncement,
  describeSharedRecipeSaveControl,
  reduceSharedRecipeSave,
  type SharedRecipeSaveControl,
  type SharedRecipeSaveState,
} from '@/components/sharedRecipeSaveCopy';
import { isSchedulableSaveIntent } from '@/domain/saveIntent';
import type { RecipeId } from '@/domain/social/types';
import type { SaveIntent, SaveOrigin } from '@/domain/types';
import { getAppRepository } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { saveRecipeCopy } from '@/lib/saveRecipeCopy';
import { supabase } from '@/lib/supabase';

export interface SharedRecipeSaveHandle {
  readonly state: SharedRecipeSaveState;
  readonly control: SharedRecipeSaveControl;
  readonly press: () => void;
  readonly dismiss: () => void;
  readonly chooseIntent: (intent: SaveIntent) => void;
}

/**
 * `recipeId` is null exactly when there is no canonical row to copy — a
 * friend's hand-entered dish. The control then draws disabled with
 * `SHARED_RECIPE_SAVE_UNAVAILABLE_NOTE` under it rather than offering a
 * save that cannot land, and `chooseIntent` writes nothing even if a sheet
 * somehow resolved.
 *
 * `origin` IS THE CALLER'S TO KNOW AND THIS HOOK'S TO CARRY (PD-024).
 * There are two screens today and they answer differently — the send
 * screen is `'send'`, the canonical recipe screen is `'proof'`, because
 * that is the only card that routes to it. ⚠ **That second answer stops
 * being true the moment a kring row or a search result also opens
 * `/friends/recipe/[recipeId]`**, which fase 2 and fase 3 both intend. At
 * that point the origin has to arrive as a route param rather than as a
 * literal in that screen, or every search-driven save reports itself as
 * proof and the closed-loop rate this field exists to protect starts
 * lying quietly. It is written here rather than in a backlog because this
 * is the file a future edit will be looking at.
 */
export function useSharedRecipeSave(recipeId: RecipeId | null, origin: SaveOrigin): SharedRecipeSaveHandle {
  const [state, dispatch] = useReducer(reduceSharedRecipeSave, IDLE_SHARED_RECIPE_SAVE);

  const chooseIntent = useCallback(
    (intent: SaveIntent): void => {
      // The sheet's contract is `SaveIntent`; the write's is the schedulable
      // half of it. A `'none'` cannot arrive from the two rows the sheet
      // offers, and if it ever did the honest answer is to write nothing.
      if (recipeId === null || !isSchedulableSaveIntent(intent)) {
        dispatch({ type: 'sheet-dismissed' });
        return;
      }
      dispatch({ type: 'intent-chosen' });
      void saveRecipeCopy(
        createSupabaseSocialRepository(supabase),
        getAppRepository(),
        recipeId,
        intent,
        origin,
      ).then((outcome) => {
        dispatch({ type: 'write-settled', outcome });
        // The sheet already said "Bewaard: …" the instant a row was
        // tapped, before the write. This confirms it, or corrects it.
        AccessibilityInfo.announceForAccessibility(describeSharedRecipeSaveAnnouncement(outcome));
      });
    },
    [recipeId, origin],
  );

  return {
    state,
    control: describeSharedRecipeSaveControl(state, recipeId !== null),
    press: () => dispatch({ type: 'save-pressed' }),
    dismiss: () => dispatch({ type: 'sheet-dismissed' }),
    chooseIntent,
  };
}

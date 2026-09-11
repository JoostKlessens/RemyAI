/**
 * The live half of `/friends/[feedItemId]`: one `recipe_shares` id in the
 * route, resolved against a live read, into the same `SharedRecipeView`
 * the `__DEV__` fixture path already renders.
 *
 * WHY THIS IS A HOOK AND NOT INLINE IN THE ROUTE. `useSharedRecipeSave.ts`
 * and `useUnseenSendCount.ts` set the pattern this follows: a route module
 * cannot be imported under vitest at all (expo-router and react-native
 * internals fail to parse), so the fetch-and-assemble step has to live
 * somewhere a test CAN reach it, or it is unassertable by construction.
 * What actually decides the screen — turning a `SentMeal` into a
 * `SharedRecipeView` — is `buildLiveSentSharedRecipe`
 * (src/components/sharedRecipePresentation.ts), which is pure and tested
 * directly; this hook is only the impure shell around it, exactly as
 * `useSharedRecipeSave` is the shell around `saveRecipeCopy`.
 *
 * TWO READS, IN THIS ORDER, AND THE ORDER IS WHY THE SECOND ONE HAPPENS AT
 * ALL. `listMealsSentToMe` is the one named explicitly by this change's
 * brief — it is also the only source of a meal id here, matching that
 * method's own "the shares are read first" discipline. `getProfile` runs
 * only once a matching send is found, because `buildSharedRecipeEyebrow`
 * needs an actual name and `SentMeal` carries none of its sender's beyond
 * `senderProfileId` — see `buildLiveSentSharedRecipe`'s header on the
 * fields this path still leaves null rather than chasing every one of
 * them through a further read.
 *
 * THREE STATES, NEVER COLLAPSED INTO TWO. `SharedRecipeNoticeKind`
 * ('loading' | 'missing' | 'failed') already exists for the fixture path;
 * this hook is what makes the LIVE path honour the same three rather than
 * defaulting to 'missing' the instant a real id fails to resolve
 * synchronously, which is the exact bug this change exists to close.
 * 'missing' here means the read succeeded and named nobody — a withdrawn
 * or already-gone send, or (defensively) a sender whose own profile row
 * cannot be found. 'failed' means the read itself did not complete.
 *
 * `active` GUARDS AGAINST A STALE RESOLUTION, the same guard
 * `(tabs)/friends.tsx`'s `load` uses: a slower fetch for an id the reader
 * has since navigated away from (or a fast re-run of this effect for a
 * new one) must not land on the wrong state.
 */

import { useEffect, useState } from 'react';
import {
  buildLiveSentSharedRecipe,
  type SharedRecipeNoticeKind,
  type SharedRecipeView,
} from '@/components/sharedRecipePresentation';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';

export type LiveSharedRecipeState =
  | { readonly kind: 'view'; readonly view: SharedRecipeView }
  | { readonly kind: 'notice'; readonly notice: SharedRecipeNoticeKind };

const LOADING_STATE: LiveSharedRecipeState = { kind: 'notice', notice: 'loading' };

/**
 * `profileId` and `shareId` are both nullable on purpose and for different
 * reasons: the profile id has not resolved yet (PD-012 — the same "not a
 * signed-out branch" reasoning `(tabs)/friends.tsx` documents), and the
 * share id is null whenever the caller has already resolved the screen
 * another way — the `__DEV__` fixture path taking priority when it
 * matches, per `/friends/[feedItemId].tsx`'s header. Either null holds the
 * hook at `loading` without reading anything.
 */
export function useLiveSharedRecipe(profileId: string | null, shareId: string | null): LiveSharedRecipeState {
  const [state, setState] = useState<LiveSharedRecipeState>(LOADING_STATE);

  useEffect(() => {
    if (profileId === null || shareId === null) {
      setState(LOADING_STATE);
      return;
    }

    let active = true;
    setState(LOADING_STATE);

    void (async () => {
      try {
        const repository = createSupabaseSocialRepository(supabase);
        const meals = await repository.listMealsSentToMe(profileId);
        const meal = meals.find((candidate) => candidate.shareId === shareId);
        if (meal === undefined) {
          // Withdrawn, never existed, or its meal was dropped underneath
          // the share (`listMealsSentToMe`'s own "not half-built" rule) —
          // all three are the recipient's ordinary "gone" state.
          if (active) {
            setState({ kind: 'notice', notice: 'missing' });
          }
          return;
        }

        const sender = await repository.getProfile(meal.senderProfileId);
        if (sender === null) {
          // Defensive rather than expected: a live send's sender should
          // always have a profile row. Read as a failure rather than as
          // "gone", because the RECIPE plainly still exists — only the
          // name beside it could not be resolved.
          if (active) {
            setState({ kind: 'notice', notice: 'failed' });
          }
          return;
        }

        if (active) {
          setState({ kind: 'view', view: buildLiveSentSharedRecipe(meal, sender.displayName) });
        }
      } catch {
        if (active) {
          setState({ kind: 'notice', notice: 'failed' });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [profileId, shareId]);

  return state;
}

/**
 * The canonical recipe behind a PROOF card — "Sanne maakte dit"
 * (docs/DESIGN-SOCIAL.md §4.2 and §4.3, PD-010, PD-015).
 *
 * WHY THIS SCREEN EXISTS AT ALL: it is the destination four separate files
 * spent a paragraph each saying did not exist. `(tabs)/friends.tsx` passed
 * no `onOpenProof` "because nothing reads a canonical recipe yet";
 * `FriendProofCard` made its handler optional and dropped its
 * `accessibilityRole` when absent, on the argument that "an action that
 * silently does nothing is worse than no action"; `KringRow` and
 * `TrendingCard` say the same. The consequence on a device was the one the
 * owner reported: *"ik kan er niet op klikken"* — and, because `Bewaren`
 * lives at the far end of that tap, *"ik kan geen recepten van vrienden
 * toevoegen"*. Live data produces proof cards and no send cards
 * (src/lib/gekooktSource.ts), so on a real phone this is the ONLY shared
 * recipe screen a card can actually reach.
 *
 * IT IS LIVE, WITH NO FIXTURE ANYWHERE. `getCanonicalRecipe` was built for
 * `Bewaren`'s write path on 9 September 2026 (`5767bda`) and has sat on
 * the interface and on both implementations since, with one caller.
 * Reading `recipes`, `recipe_ingredients` and `recipe_steps` exposes
 * nothing new: 0006 grants SELECT on all three to every authenticated
 * reader (`can_read_recipe`), which is the same fact PD-014 rests its
 * whole safety argument on. No migration stands between this screen and
 * the row it renders, and none was run for it.
 *
 * WHAT IT MUST NEVER OPEN, and this is the trap the send screen names:
 * `/cook/[mealId]`. A proof card holds a canonical `recipeId` and
 * structurally cannot hold a meal id (`FriendProofCardModel` declares
 * `mealId?: never`), because those meal ids belong to the friends'
 * households and this device's repository has no row for any of them. The
 * route param here is a `recipes.id`, and the read below is the only thing
 * it is ever handed to.
 *
 * IT IS A SIBLING OF `/friends/[feedItemId]` AND NOT A MODE OF IT. That
 * screen reads a private household row through `has_active_send_to_me()`;
 * this one reads a world-readable row. Keeping them apart is
 * (tabs)/friends.tsx's own rule — "a single handler would make that a
 * runtime branch instead of two named things" — applied to the destination
 * as well as to the callback. What the two DO share is §4.3's anatomy, as
 * `SharedRecipeArticle` + `SharedRecipeSaveZone` + `SharedRecipeNoticeState`
 * over `sharedRecipePresentation.ts`; none of those four reads anything or
 * routes anywhere, so the privacy model stays in these two route files.
 *
 * NO EYEBROW AND NO NOTE, which is §4.3 verbatim ("the same anatomy minus
 * note and minus sender eyebrow"). Nobody sent this recipe: it fell out of
 * a dinner a friend happened to cook. The card that led here said who, and
 * repeating "Sanne maakte dit" over the recipe would make an ambient fact
 * look like a message addressed to the reader — the exact asymmetry PD-016
 * asks the two card kinds to keep.
 *
 * NOTHING IS COUNTED, LIKED OR ACKNOWLEDGED HERE. §3.2 refuses read
 * receipts by name and PD-015 fixes the floor. Opening this screen writes
 * nothing at all; the `seen_at` that `markSendsSeen` stamps belongs to the
 * TAB, never to a card and never to a recipe.
 */

import { useCallback, useEffect, useState, type JSX } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/components/BackButton';
import { SaveIntentSheet } from '@/components/SaveIntentSheet';
import { SharedRecipeArticle } from '@/components/SharedRecipeArticle';
import { SharedRecipeNoticeState } from '@/components/SharedRecipeNoticeState';
import {
  SHARED_RECIPE_BACK_LABEL,
  buildCanonicalSharedRecipe,
  describeSharedRecipeNotice,
  type SharedRecipeNoticeKind,
  type SharedRecipeView,
} from '@/components/sharedRecipePresentation';
import { SharedRecipeSaveZone } from '@/components/SharedRecipeSaveZone';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSharedRecipeSave } from '@/hooks/useSharedRecipeSave';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';
import { getColors, spacing } from '@/theme/tokens';

/**
 * Four states, and `missing` is not a failure. A canonical recipe can be
 * withdrawn between the moment a card was rendered and the moment it was
 * tapped — PD-007 says withdrawal is honoured immediately — and
 * `meals.recipe_id` is `on delete set null`, so a row can vanish under a
 * card still on screen. That is an ordinary outcome with its own sentence;
 * `failed` is the network, with a different one, because one invites a
 * retry and the other cannot.
 */
type CanonicalRecipeState =
  | { readonly kind: SharedRecipeNoticeKind }
  | { readonly kind: 'ready'; readonly view: SharedRecipeView };

const LOADING_STATE: CanonicalRecipeState = { kind: 'loading' };

export default function CanonicalRecipeScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { recipeId } = useLocalSearchParams<{ recipeId?: string }>();
  const [state, setState] = useState<CanonicalRecipeState>(LOADING_STATE);

  /**
   * ONE READ, KEYED ON THE ROUTE PARAM, AND NOTHING ELSE HERE FETCHES. The
   * grade the card showed is deliberately not re-read — see
   * `buildCanonicalSharedRecipe` on why a second, differently-scoped
   * average one tap from the first would be worse than saying less.
   *
   * `isCurrent` rather than an AbortController: the repository seam has no
   * signal to hand one to, and what this guards against is a setState
   * after the screen has gone, not a request worth cancelling. Same shape
   * the Vrienden tab's own load uses.
   */
  const load = useCallback(async (id: string, isCurrent: () => boolean): Promise<void> => {
    try {
      const recipe = await createSupabaseSocialRepository(supabase).getCanonicalRecipe(id);
      if (!isCurrent()) {
        return;
      }
      // Null means the id names no row — withdrawn, or deleted. Answered
      // with the not-found notice, never by rendering a blank recipe.
      setState(recipe === null ? { kind: 'missing' } : { kind: 'ready', view: buildCanonicalSharedRecipe(recipe) });
    } catch {
      if (isCurrent()) {
        setState({ kind: 'failed' });
      }
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    if (recipeId === undefined || recipeId.length === 0) {
      // A route param that is not there at all is neither a network
      // problem nor a withdrawal — but it is still, truthfully, no recipe.
      setState({ kind: 'missing' });
      return () => {
        isCurrent = false;
      };
    }
    setState(LOADING_STATE);
    void load(recipeId, () => isCurrent);
    return () => {
      isCurrent = false;
    };
  }, [recipeId, load]);

  // All four edges, exactly as on the send screen: the save zone is pinned
  // under the scroll and has to clear the home indicator.
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} accessibilityLabel={SHARED_RECIPE_BACK_LABEL} />
      </View>

      {state.kind === 'ready' ? (
        <CanonicalRecipeWithSave view={state.view} />
      ) : (
        <SharedRecipeNoticeState notice={describeSharedRecipeNotice(state.kind)} onBack={() => router.back()} />
      )}
    </SafeAreaView>
  );
}

/**
 * The article, the thumb-zone save under it, and the sheet between them —
 * the same three in the same order the send screen holds, which is how
 * PD-010.2's "the link stays under the last step" is kept by structure on
 * both rather than by two people remembering it.
 *
 * Split out so the save hook runs only once a recipe has resolved: a save
 * keyed on a recipe that is not on screen has no business existing, and
 * here the recipe arrives a network round-trip late.
 */
function CanonicalRecipeWithSave(props: { readonly view: SharedRecipeView }): JSX.Element {
  const { view } = props;
  const reduceMotionEnabled = useReduceMotion();
  // Never null on this screen — a canonical recipe IS the row `Bewaren`
  // copies — so the "no source recipe" note the hook can produce is
  // unreachable here and reachable on the send screen. The nullable type
  // is shared anyway; narrowing it here would be a second shape for one
  // field.
  // PD-024. `'proof'` because a proof card is the only thing that routes
  // here today (`friends.tsx`'s `onOpenCanonicalRecipe`). ⚠ When the kring
  // and the search results start opening this same route, this literal has
  // to become a route param — see `useSharedRecipeSave`'s header.
  const save = useSharedRecipeSave(view.canonicalRecipeId, 'proof');

  return (
    <>
      <SharedRecipeArticle view={view} />
      <SharedRecipeSaveZone control={save.control} isFailure={save.state.kind === 'failed'} onPress={save.press} />
      <SaveIntentSheet
        visible={save.state.kind === 'choosing'}
        dishTitle={view.title}
        onSelectIntent={save.chooseIntent}
        onDismiss={save.dismiss}
        reduceMotionEnabled={reduceMotionEnabled}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.screenHeaderTop,
  },
});

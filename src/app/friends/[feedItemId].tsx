/**
 * The full recipe behind a friend's SEND (docs/DESIGN.md §8, PD-010) —
 * the sender's own `meals` row, readable only while
 * `has_active_send_to_me()` says so.
 *
 * THERE IS A SECOND SHARED RECIPE SCREEN NOW, AND THE SPLIT IS THE
 * PRIVACY MODEL. `/friends/recipe/[recipeId]` opens the CANONICAL,
 * world-readable `recipes` row a PROOF card points at. §4.3 describes one
 * anatomy for both ("the same anatomy minus note and minus sender
 * eyebrow"), and that anatomy is shared as three components —
 * `SharedRecipeArticle`, `SharedRecipeSaveZone`, `SharedRecipeNoticeState`
 * — plus one pure module, `sharedRecipePresentation.ts`. What is NOT
 * shared is this file: the READ. (tabs)/friends.tsx argued that the two
 * destinations must be "two named things" rather than one handler taking a
 * union, because one is a private household row and the other is public,
 * and one screen branching on a route param would make that a runtime
 * decision. Two routes, one row each; the components they share open
 * nothing and hold no id they could route on.
 *
 * PD-010 is the decision this screen exists to honour, and it was taken
 * with its cost stated out loud: showing someone else's recipe to a third
 * party is rebroadcast, the top rung of the exposure ladder, and the thing
 * that got Recipeasly killed in a day. The owner chose it anyway, because
 * a card that never opens is too little value to be worth building —
 * which makes the mitigations conditions of shipping rather than garnish.
 * Three of them are structural to this file:
 *
 *   1. **Creator attribution above the recipe** (`CreatorAttribution`,
 *      rendered by `SharedRecipeArticle`) — handle, platform, and a live
 *      link to their profile. Not a footer, not a tooltip.
 *   2. **The link to the original post sits with the recipe**, directly
 *      under the last step, at full width. The pitch that we send viewers
 *      to the creator has to be true on the surface where it matters
 *      most, so it is the largest single control here and it names the
 *      platform it leaves for.
 *   3. **The video is never re-hosted or embedded.** What renders is text
 *      plus one remote thumbnail reference; playback happens on the
 *      creator's own platform, always.
 *
 * `BEWAREN` (DESIGN-SOCIAL.md §3.3, §4.3). The one reaction, in the thumb
 * zone under the scroll: a full-width primary that opens the existing
 * `SaveIntentSheet` unchanged — `Deze week` / `Ooit`, no third option —
 * and hands the answer to `saveRecipeCopy` (src/lib), which reads the
 * canonical `recipes` row and writes this household's copy starting at
 * `allergenTagStatus: 'unknown'`, exactly as PD-010 requires
 * (src/domain/social/recipeCopy.ts keeps that promise; 0006's trigger keeps
 * it again server-side). After the write lands the control re-renders as
 * `positiveMuted` fill with `positive` text, `Bewaard`. The card keeps its
 * ranked place in the feed; nothing here hides it.
 *
 * THE SAVE ZONE SITS OUTSIDE THE SCROLL, and that is PD-010.2 rather than
 * layout taste: the original-post link stays directly under the last step
 * in document order, and a control pinned below the scroll can never push
 * it below the fold. Same shape as `/recipe/[mealId]`'s `Koken` footer.
 *
 * THE SAVE IS KEYED ON THE SENDER'S CANONICAL RECIPE, which the card carries
 * off their meal (`FriendRecipeCardModel.canonicalRecipeId` — see that
 * field on why it is not called `recipeId`). A friend's hand-entered dish
 * has none — there is no canonical row to copy — and the zone says so
 * under a disabled primary rather than offering a save that cannot land.
 * Copying a sender's OWN version (their `meals` row, readable through
 * `has_active_send_to_me`) is a separate change and not this one.
 *
 * WHY THIS IS NOT COOK MODE. Tapping a friend's card must never open
 * `/cook/[mealId]`: these meal ids belong to the friends' households and
 * this device's repository holds no row for any of them. See RecipeTile's
 * `onPress` header for the same seam on the other tab.
 *
 * THE SENDER'S NOTE (DESIGN-SOCIAL.md §4.3) renders here in the card's own
 * dress, and it is the one thing on this screen that is a private message
 * rather than a republished recipe. It is quoted behind a left rule for
 * that reason and carried undecorated by `FriendRecipeCardModel`, so the
 * card and this screen add the quotation marks separately instead of one
 * of them unpicking the other's string. A null note renders nothing at
 * all: a send without one is ordinary, and the canonical recipe screen
 * beside this one never has one at all — §4.3's "minus note".
 *
 * ⚠ THE READING HALF IS STILL FIXTURES, AND AS OF 10 SEPTEMBER 2026 IT IS
 * BEHIND `__DEV__` — WHICH IS THE HONEST HALF OF THE FIX, NOT THE WHOLE
 * ONE. What stood here before said "on every build and behind no flag",
 * and that was true and was a live defect: a production deep link to
 * `/friends/<a fixture id>` rendered Sanne's invented pasta as though it
 * were somebody's dinner, with a `Bewaren` that could only ever fail —
 * `FIXTURE_RECIPE_IDS` exist in no database, by design. In a production
 * build the fixture read is now simply not there, and an unresolvable
 * `feedItemId` gets `describeSharedRecipeNotice('missing')`, which is true.
 *
 * WHAT WOULD MAKE IT LIVE, MEASURED RATHER THAN GUESSED, because the next
 * reader will want to know whether this is a day's work or a week's:
 *
 *   1. `SentMeal` (src/lib/repository/social/types.ts) carries no STEPS.
 *      `listMealsSentToMe` reads `meals` and `meal_ingredients` and stops.
 *      No migration is needed for the third read — 0009 already ships
 *      `meal_steps_select_sent_to_me`, `for select using
 *      (public.has_active_send_to_me(meal_id))`, and migrations 0001-0019
 *      are all applied. This is an interface field, one more `.in()` in
 *      the Supabase implementation, the mirror of it in the local one, and
 *      a row mapper.
 *   2. `SentMeal` carries no ATTRIBUTION — no author name, platform or
 *      profile url, only `sourceUrl`. It does carry `recipeId`
 *      (`meals.recipe_id`), and the canonical row behind it holds all
 *      three and is world-readable, so the attribution is reachable
 *      through `getCanonicalRecipe` without any new permission. A friend's
 *      hand-entered dish has no such row and would credit nobody, which
 *      `SharedRecipeArticle` already renders correctly (null attribution).
 *   3. The LIST has to produce a live send card first, and that is the
 *      real gate: `FriendRecipeCardModel.creator` is a whole `Creator`,
 *      i.e. a PD-007 consent record, and `assembleFriendFeed` is built
 *      around `FeedItem`/`Creator`/`Meal` triples that a live send is not.
 *      src/lib/gekooktSource.ts carries that argument in full. Until the
 *      list produces one, a live read here would be a screen nothing
 *      reaches — which is why this change stops at the `__DEV__` gate
 *      rather than building half of (1) and (2).
 *
 * THE SAVE WAS NEVER A FIXTURE and still is not: `Bewaren` reads `recipes`
 * through the Supabase social repository and writes through the app
 * repository. On a fixture card that read answers null and the zone shows
 * its not-found line. When this screen gains a live read, the save works
 * unchanged.
 */

import { useMemo, type JSX } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FIXTURE_TARGET_DATE, getFriendFeedFixture, parseFriendFeedScenario } from '@/fixtures/friendFeedFixtures';
import { BackButton } from '@/components/BackButton';
import { assembleFriendFeed } from '@/components/friendFeedPresentation';
import { SaveIntentSheet } from '@/components/SaveIntentSheet';
import { SharedRecipeArticle } from '@/components/SharedRecipeArticle';
import { SharedRecipeNoticeState } from '@/components/SharedRecipeNoticeState';
import {
  SHARED_RECIPE_BACK_LABEL,
  buildSentSharedRecipe,
  describeSharedRecipeNotice,
  type SharedRecipeView,
} from '@/components/sharedRecipePresentation';
import { SharedRecipeSaveZone } from '@/components/SharedRecipeSaveZone';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSharedRecipeSave } from '@/hooks/useSharedRecipeSave';
import { getColors, spacing } from '@/theme/tokens';

export default function SharedRecipeScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { feedItemId, scenario: rawScenario } = useLocalSearchParams<{
    feedItemId?: string;
    scenario?: string;
  }>();

  /**
   * Resolved through the SAME `assembleFriendFeed` the list uses, rather
   * than by reaching into the fixture arrays directly. That is the point:
   * the PD-007 consent gate and the PD-007a collision lookup run again
   * here, so a creator who withdrew is gone from this screen too — even
   * for someone who deep-linked straight to it, or backgrounded the app
   * before it happened — and the "bevat noten" label can never say one
   * thing on the card and another on the recipe.
   *
   * `__DEV__` GATES THE WHOLE READ, not the render below it. A production
   * build must not so much as resolve a fixture id: see this file's header
   * on what a deep link used to get. The gate is inside the memo rather
   * than around the component so there is exactly one branch, and it
   * collapses to `null` — which every consumer below already handles,
   * because a withdrawn recipe produces the same null.
   */
  const view = useMemo<SharedRecipeView | null>(() => {
    if (!__DEV__) {
      return null;
    }
    const fixture = getFriendFeedFixture(parseFriendFeedScenario(rawScenario));
    const card = assembleFriendFeed({ ...fixture, targetDate: FIXTURE_TARGET_DATE }).find(
      (candidate) => candidate.feedItemId === feedItemId,
    );
    if (card === undefined) {
      return null;
    }
    return buildSentSharedRecipe(
      card,
      fixture.ingredientsByMealId.get(card.mealId) ?? [],
      fixture.stepsByMealId.get(card.mealId) ?? [],
    );
  }, [feedItemId, rawScenario]);

  // All four edges now, where this screen used to leave the bottom to its
  // scroll padding: the save zone is pinned under the scroll, and it has to
  // clear the home indicator the way `/recipe/[mealId]`'s footer does.
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        {/* The fourth and last of the hand-copied back rows, folded into
            `BackButton` on 9 September 2026 with the other three. This one
            never carried the `hitSlop` the others grew, which is itself the
            argument for the component: the row was described in three
            separate headers as "byte-for-byte the same" and it had already
            drifted. */}
        <BackButton onPress={() => router.back()} accessibilityLabel={SHARED_RECIPE_BACK_LABEL} />
      </View>

      {view === null ? (
        <SharedRecipeNoticeState notice={describeSharedRecipeNotice('missing')} onBack={() => router.back()} />
      ) : (
        <SharedRecipeWithSave view={view} />
      )}
    </SafeAreaView>
  );
}

/**
 * The article, the thumb-zone save under it, and the sheet between them.
 * Split from `SharedRecipeScreen` so the save hook runs only once a recipe
 * has resolved — a save keyed on a recipe that is not on screen has no
 * business existing. `/friends/recipe/[recipeId]` holds the same three in
 * the same order, for the same reason.
 */
function SharedRecipeWithSave(props: { readonly view: SharedRecipeView }): JSX.Element {
  const { view } = props;
  const reduceMotionEnabled = useReduceMotion();
  // PD-024: this route only ever opens a meal somebody SENT to this
  // household — `has_active_send_to_me()` is the permission that made the
  // row readable at all — so a save from here is a save from a send, which
  // is the numerator DESIGN-SOCIAL.md §9's closed-loop rate is about.
  const save = useSharedRecipeSave(view.canonicalRecipeId, 'send');

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

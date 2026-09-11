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
 * ⚠ THE READ WAS FIXTURES-ONLY, BEHIND `__DEV__`, UNTIL 11 SEPTEMBER 2026 —
 * AND IS NOW TWO PATHS RATHER THAN ONE. The `__DEV__` fixture path below is
 * unchanged in shape (synchronous, gated, resolved through
 * `assembleFriendFeed`) and still runs FIRST when it matches, so switching
 * scenarios on the Vrienden tab renders exactly what it did before. What
 * changed is what happens when it does not match: instead of falling
 * straight to `describeSharedRecipeNotice('missing')` regardless of what
 * the id actually names, the screen now treats `feedItemId` as a
 * `RecipeShareId` and reads it LIVE, through `useLiveSharedRecipe`
 * (src/hooks) — which calls `listMealsSentToMe(profileId)` and looks for
 * the row whose `shareId` matches. A production build never has a fixture
 * to prefer, so this is the only path it takes. That is the bug this
 * closed: a live send's id used to resolve to nothing on the screen it
 * opens, no matter what the row actually held.
 *
 * NO MIGRATION WAS NEEDED. 0009 already shipped
 * `meal_steps_select_sent_to_me`, `for select using
 * (public.has_active_send_to_me(meal_id))`, so the missing piece was
 * entirely TypeScript: a `steps` field on `SentMeal`
 * (src/lib/repository/social/types.ts), filled symmetrically with
 * `ingredients` in both repository implementations.
 *
 * WHAT THE LIVE PATH STILL DOES NOT CARRY, MEASURED RATHER THAN GUESSED,
 * because the next reader should not assume the card is complete now that
 * the notice is merely correct:
 *
 *   1. NO NOTE. `SentMeal` has no `note` field — it lives on
 *      `IncomingSend`, behind `listSendsToMe`, a second read this path
 *      does not make. `buildLiveSentSharedRecipe`
 *      (src/components/sharedRecipePresentation.ts) passes `note: null`.
 *   2. NO ATTRIBUTION. `SentMeal` carries only `recipeId`; the credit
 *      behind it is reachable through `getCanonicalRecipe` without any new
 *      permission (see that interface's own comment) but that read is not
 *      made here either. `SharedRecipeArticle` already renders this
 *      correctly — null attribution is a real, drawn state, not a gap.
 *   3. NO ALLERGEN COLLISION LABEL. A real one needs THIS household's own
 *      restriction set, which lives on `RemyRepository` — a seam
 *      `useLiveSharedRecipe` never touches. `buildAllergenCollisionLabel([])`
 *      is still called, so the label is null rather than wrong, the same
 *      move `buildCanonicalSharedRecipe` makes for a different reason.
 *      PD-007a's "ranked down AND labelled, never hidden" is a rule about
 *      the LIST; a single deep-linked item is not the list.
 *
 * Each is a nullable field on `SharedRecipeView` for exactly this reason —
 * a view that knows less is still a correct view, never a broken one.
 *
 * ⚠ THE LIST PRODUCES A LIVE SEND CARD AS OF 11 SEPTEMBER 2026, AND THIS
 * PARAGRAPH SAID THE OPPOSITE UNTIL THAT AFTERNOON. It read "THE LIST
 * STILL PRODUCES NO LIVE SEND CARD", which was true when it was written
 * and stopped being true a few hours later on the same day: fase 2 built
 * `buildSentMealCardModels` and wired it into `loadLiveFriends`, so
 * Ontdek's feed side now carries both card kinds live. The correction is
 * recorded rather than quietly swapped, because this file's own history is
 * the argument for doing so — the blocker it used to name (a whole
 * `Creator`, i.e. a PD-007 consent record, where a friend's imported meal
 * has only attribution) had ALREADY been cleared on 10 September without
 * anybody updating the headers that cited it, and that is how the gap
 * survived the change that unblocked it.
 *
 * WHAT WAS TRUE AND STAYS TRUE is that this file's fix was independent of
 * that one: it never went through `assembleFriendFeed` for the live case
 * at all, only through `listMealsSentToMe` keyed on the route's own id. So
 * the screen a live card opens told the truth before the card existed, and
 * tells it now that the card does.
 *
 * THE SAVE WAS NEVER A FIXTURE and still is not: `Bewaren` reads `recipes`
 * through the Supabase social repository and writes through the app
 * repository. On a fixture card, or a live send whose `canonicalRecipeId`
 * is null, that read answers null and the zone shows its not-found line —
 * unchanged by any of the above, on both the fixture and the live path.
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
import { useLiveSharedRecipe } from '@/hooks/useLiveSharedRecipe';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSession } from '@/hooks/useSession';
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
  const { userId } = useSession();

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
   *
   * STILL RUNS FIRST, AND STILL SYNCHRONOUS. Nothing about adding the live
   * path below changes this one: a fixture id never collides with a real
   * `recipe_shares` uuid, so the two paths never disagree about the same
   * id, and a `__DEV__` build gets the instant fixture answer it always
   * did rather than waiting on a network round trip it does not need.
   */
  const fixtureView = useMemo<SharedRecipeView | null>(() => {
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

  /**
   * The LIVE path (this file's header). Held off entirely once the
   * fixture already answered — passing `null` through both arguments
   * leaves `useLiveSharedRecipe` at its `loading` state without reading
   * anything, so a `__DEV__` scenario tap never fires a network request
   * for an id it was never going to find.
   */
  const live = useLiveSharedRecipe(fixtureView === null ? userId : null, fixtureView === null ? (feedItemId ?? null) : null);

  const view: SharedRecipeView | null = fixtureView ?? (live.kind === 'view' ? live.view : null);

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
        // `fixtureView` is null on every branch that reaches here, so
        // `live.kind` is 'notice' whenever it is not 'view' — the three
        // states `describeSharedRecipeNotice` distinguishes (loading,
        // missing, failed) are exactly `live.notice`, never hard-coded to
        // 'missing' the way this line used to be before the live path
        // existed.
        <SharedRecipeNoticeState
          notice={describeSharedRecipeNotice(live.kind === 'notice' ? live.notice : 'loading')}
          onBack={() => router.back()}
        />
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

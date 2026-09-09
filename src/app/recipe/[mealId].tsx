/**
 * A recipe the household owns, to look at.
 *
 * ============================================================================
 * THE GAP THIS FILLS
 * ============================================================================
 *
 * Until this screen existed there was no way to READ a saved recipe. There
 * was a way to cook it (`cook/[mealId].tsx`, one step per screen, screen
 * awake, a cook_events row waiting at the end) and a way to correct it
 * (`recipe-edit/[mealId].tsx`, every field a `TextInput`), and a grid tile
 * that opened the first of those on a tap. So "what was in this again?" had
 * two answers, and both of them started something: a cook you were not doing
 * or an edit you did not want to make.
 *
 * Curiously, the app already had exactly this screen — for somebody else's
 * recipe. `friends/[feedItemId].tsx` is a friend's dish laid out to be read:
 * eyebrow, title, meta, attribution, ingredients, steps, and one link to the
 * original. This is that screen for a dish you own, which is why the
 * anatomy matches it deliberately rather than by coincidence.
 *
 * WHY IT IS NOT THAT FILE WITH A FLAG. That screen resolves from fixtures
 * through `assembleFriendFeed`, so the PD-007 consent gate and the PD-007a
 * collision lookup run on every read; it must never open cook mode, because
 * those meal ids belong to other households and this device holds no row for
 * them; and it carries a sender's note and a "these tags came from whoever
 * shared this" caveat, neither of which is true here. Sharing one component
 * would mean a component that is half a republished recipe and half your own
 * kitchen, with a boolean deciding which — and the two halves disagree about
 * the one thing that matters, whether the tap at the bottom may start
 * cooking.
 *
 * ============================================================================
 * IT REPLACES THE TILE'S TAP, WHICH OVERRIDES A SENTENCE IN docs/DESIGN.md
 * ============================================================================
 *
 * DESIGN.md §2 says of the library grid: "Tap → Kookmodus directly
 * (unchanged behavior)", and `RecipeTile.tsx`'s own header repeats it. That
 * sentence is older than the screen it now has to share the tap with, and it
 * was written when opening a recipe and cooking it were the same act because
 * there was nothing else to open. Cook mode is the heaviest surface in the
 * app — it keeps the screen awake, it counts steps, and its terminus writes
 * a cook event — and making it the consequence of a single tap on a
 * thumbnail means the cheapest gesture in the library starts the most
 * committed thing in the product.
 *
 * `RecipeTile` was built for this: its header says `onPress` exists because
 * the cook-mode default "is only correct for a recipe the household actually
 * owns", and asks any caller overriding it to override `accessibilityHint`
 * too. `(tabs)/recipes.tsx` now does both. Cooking is one tap further away
 * and is the primary control at the foot of this screen, in the thumb zone,
 * carrying `RecipeTile`'s own promise word for word.
 *
 * THE LONG-PRESS SHEET IS UNTOUCHED. Everything it offers still works from
 * the grid; this screen simply gives four of its five rows a second,
 * non-gesture door — which `RecipeTile`'s header asked for in as many words
 * ("REJECTED: a visible '...' button in the tile corner… Worth revisiting if
 * the sheet grows past two rows"). It has five now.
 *
 * ============================================================================
 * WHAT IT OFFERS, AND WHAT IT DELIBERATELY DOES NOT
 * ============================================================================
 *
 * Four acts, all of them routes the repository already exposes: cook it
 * (`/cook/[mealId]`), correct it (`/recipe-edit/[mealId]`), plan it
 * (`createSave` / `removeSaves` at `'this_week'`), send it
 * (`useLibrarySendSheet`). Every label, explainer, failure note and
 * announcement for the planning row is `librarySchedulingCopy.ts`'s, and
 * "Sturen"/"Aanpassen" are `libraryTileActionCopy.ts`'s and
 * `recipeEditCopy.ts`'s — the same act must not acquire a second name for
 * appearing on a second surface.
 *
 * NOT HERE: "Verwijderen" and "Deel deze niet". Both are on the long-press
 * sheet and both stay there. They are the two rarest acts in the library —
 * `libraryTileActionRows.ts` orders the sheet on exactly that axis and puts
 * them last — and this is a screen for reading a dish you are interested in.
 * Putting an archive button under a recipe somebody opened to read is
 * offering a destructive act to the one person who just showed they want it.
 *
 * NO CREATOR HANDLE. `Meal` has no author field; the handle exists in
 * `recipes.author_name` (0006) behind `Meal.recipeId`, and `RemyRepository`
 * exposes no read that reaches it. recipeOverviewCopy.ts's header carries
 * that gap in full. This screen credits the source with a link that names
 * its platform, and credits no person, because inventing "onbekende maker"
 * for data we were never given is what importCreatorCopy.ts already refuses.
 *
 * ============================================================================
 * TWO REPOSITORY SEAMS, AND THEY DO NOT MIX
 * ============================================================================
 *
 * The recipe, its saves and its cook events go through `RemyRepository`,
 * which is scoped by household. The friend list and the send go through
 * `RemySocialRepository`, which is not — a friendship joins two people
 * usually in different households. `(tabs)/recipes.tsx`'s header argues that
 * separation at length and `useLibrarySendSheet` is the seam that keeps it:
 * this screen hands that hook a `Meal` and a profile id and never asks
 * either repository a question belonging to the other.
 *
 * SCHEDULING STATE IS READ THROUGH `resolveRecipeSchedulingState`, THE SAME
 * FUNCTION THAT DRAWS THE TILE'S BADGE. Not a narrower query of its own:
 * `listPendingSaves`' doc comment warns that the moment a screen derives
 * "deze week" for itself, the app holds two definitions of the week and the
 * second one wins because it ran last. The cost is that this screen reads
 * the household's whole `listSaves`/`listCookEvents` to answer one meal's
 * question, which is what the library grid already does for forty.
 *
 * ============================================================================
 * ICONS
 * ============================================================================
 *
 * Every glyph goes through the `iconFont.ts` seam and no call site names a
 * font's glyph. `external-link` draws from Feather and every dish-tag glyph
 * from MaterialCommunityIcons since GAP-19 landed on 7 September 2026 —
 * before that the dish half resolved to nothing, and the row laid out as
 * text-only rather than as text with a hole in front of it, because
 * `isIconAvailable` is asked FIRST. That order is why this screen needed no
 * edit when the glyphs arrived. Both halves of that argument live in the two
 * components this screen composes — `RecipeSourceLinkRow` and `RecipeTagRow`,
 * whose headers carry it, including why the pills are not `Chip`s. Nothing
 * anywhere in this screen renders a literal `×`, `▶` or `+` in place of a
 * glyph.
 *
 * THE INGREDIENT LIST HAS NO GLYPHS AT ALL, AND THAT IS A REVERSAL. It drew a
 * category ahead of every line it could place — a fruit glyph for both the
 * apple and the banana — for one day, at the owner's request, and the owner
 * then asked for the opposite in as many words: "in het recept zelf (en met
 * name de ingredientenlijst) [moeten] de icoontjes niet komen te staan maar
 * gewoon een duidelijke, overzichtelijke opsomming van ingredienten". The
 * argument the old code made for itself was never wrong about the glyphs; it
 * was wrong about the surface. A tile in a grid is skimmed and a mark helps;
 * a shopping list is READ, top to bottom, and forty small pictures down the
 * left margin are forty things to look past.
 *
 * That reversal and its consequences — including why
 * `ingredientCategoryIcons.ts` and `ingredientCategories.ts` were kept rather
 * than deleted with their last caller — are argued in full in
 * `RecipeIngredientList`, which is where the list now lives.
 *
 * ============================================================================
 * INGREDIENTS ARE GROUPED BY SUB-RECIPE WHEN THE SOURCE NAMED ONE
 * ============================================================================
 *
 * The second half of the same instruction: "als het recept de ingredienten
 * verdeelt per categorie, bijvoorbeeld in 'beslag' en 'frosting' dan moet het
 * ook duidelijk zijn welke ingredienten er per subonderdeel nodig zijn". The
 * heading comes off the row (`MealIngredient.section`, migration 0018), was
 * transcribed from the source at import and is rendered in the source's own
 * words; this screen neither derives, translates nor prefixes one.
 *
 * NONE OF IT IS DECIDED HERE, WHICH IS THE POINT OF THE TWO SEAMS.
 * `groupIngredientsBySection` (src/domain/ingredientSections.ts) owns every
 * ruling about what a group IS — the same heading twice, unlabelled
 * ingredients, two spellings of one word — because those are decisions with
 * tests, not layout. `RecipeIngredientList` owns how one is drawn. This
 * screen hands over an array and keeps exactly one thing: the sentence for a
 * recipe with no ingredients at all, which has to agree in tone with the one
 * for a recipe with no steps directly below it.
 *
 * ============================================================================
 * WHY THREE COMPONENTS AND NOT THREE LOCAL FUNCTIONS
 * ============================================================================
 *
 * The first two started here and were lifted out at 782 lines, eighteen short
 * of this repo's 800-line ceiling. `RecipeIngredientList` went the same way
 * for the same reason and with the reason proved rather than predicted: with
 * the sections drawn inline this file measured 806 lines, over the ceiling,
 * and the recorded answer to that here is to find the seam a file already
 * argues for rather than to shorten its arguments. All three are purely
 * presentational and none reads a repository, so the splits cost nothing and
 * they are what keeps the next edit to this screen from having to do a
 * refactor before it starts.
 */

import { useCallback, useReducer, useState, type JSX } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readMealDishMoods } from '@/domain/dishMoods';
import type { HouseholdId, Meal, MealIngredient, MealStep } from '@/domain/types';
import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { RecipeIngredientList } from '@/components/RecipeIngredientList';
import { iconForDishTag } from '@/components/dishTagIcons';
import {
  INITIAL_LIBRARY_SCHEDULING,
  LIBRARY_SCHEDULE_FAILED_NOTE,
  LIBRARY_UNSCHEDULE_FAILED_NOTE,
  describeLibraryScheduledAnnouncement,
  describeLibrarySchedulingRow,
  describeLibraryUnscheduledAnnouncement,
  reduceLibraryScheduling,
} from '@/components/librarySchedulingCopy';
import { LIBRARY_TILE_SEND_ACCESSIBILITY_LABEL, LIBRARY_TILE_SEND_LABEL } from '@/components/libraryTileActionCopy';
import { RECIPE_EDIT_ROW_ACCESSIBILITY_LABEL, RECIPE_EDIT_ROW_LABEL } from '@/components/recipeEditCopy';
import {
  RECIPE_OVERVIEW_BACK_ACCESSIBILITY_LABEL,
  RECIPE_OVERVIEW_COOK_ACCESSIBILITY_LABEL,
  RECIPE_OVERVIEW_COOK_LABEL,
  RECIPE_OVERVIEW_INGREDIENTS_HEADING,
  RECIPE_OVERVIEW_LOADING_LABEL,
  RECIPE_OVERVIEW_LOAD_FAILED,
  RECIPE_OVERVIEW_MOODS_HEADING,
  RECIPE_OVERVIEW_NO_INGREDIENTS,
  RECIPE_OVERVIEW_NO_STEPS,
  RECIPE_OVERVIEW_RETRY_ACCESSIBILITY_LABEL,
  RECIPE_OVERVIEW_RETRY_LABEL,
  RECIPE_OVERVIEW_STEPS_HEADING,
  RECIPE_OVERVIEW_TAGS_HEADING,
  buildRecipeOverviewMetaLine,
  describeRecipeOverviewSourceLink,
  readRecipeOverviewDishMoods,
  readRecipeOverviewDishTags,
} from '@/components/recipeOverviewCopy';
import { buildSchedulingLabel, resolveRecipeSchedulingState } from '@/components/recipeScheduling';
import { RecipeSourceLinkRow } from '@/components/RecipeSourceLinkRow';
import { RecipeTagRow } from '@/components/RecipeTagRow';
import { SendRecipeSheet } from '@/components/SendRecipeSheet';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSession } from '@/hooks/useSession';
import { getAppRepository } from '@/lib/repository';
import { useLibrarySendSheet } from '@/lib/useLibrarySendSheet';
import { getColors, spacing, typeScale } from '@/theme/tokens';

type LoadState = 'loading' | 'ready' | 'error';

interface LoadedRecipe {
  readonly householdId: HouseholdId;
  readonly meal: Meal;
  readonly ingredients: readonly MealIngredient[];
  readonly steps: readonly MealStep[];
  /** Whether a pending `this_week` save exists — the tile badge's own answer, from the tile's own resolver. */
  readonly isPlanned: boolean;
  /** What the tile's corner badge would say for this dish, so the two surfaces cannot disagree. */
  readonly schedulingLabel: string;
}

/**
 * One read of everything this screen shows.
 *
 * `Promise.all` rather than a waterfall: the five reads are independent, and
 * the household id is the only one anything waits on. `recipe-edit` takes
 * the same shape for its three.
 *
 * A NULL MEAL IS AN ERROR STATE, NOT AN EMPTY ONE. `getMeal` answers null
 * for an id that does not exist and for one that belongs to another
 * household; both mean this screen has nothing to draw, and a half-rendered
 * recipe is worse than an honest failure — `recipe-edit`'s load makes the
 * same call for the same reason.
 */
async function loadRecipe(mealId: string): Promise<LoadedRecipe | null> {
  const repository = getAppRepository();
  const householdId = await repository.getCurrentHouseholdId();
  const [meal, ingredients, steps, saves, cookEvents] = await Promise.all([
    repository.getMeal(mealId),
    repository.getMealIngredients(mealId),
    repository.getMealSteps(mealId),
    repository.listSaves(householdId),
    repository.listCookEvents(householdId),
  ]);
  if (meal === null) {
    return null;
  }
  const scheduling = resolveRecipeSchedulingState(meal.id, saves, cookEvents);
  return {
    householdId,
    meal,
    ingredients: [...ingredients].sort((a, b) => a.sortOrder - b.sortOrder),
    steps: [...steps].sort((a, b) => a.stepNumber - b.stepNumber),
    isPlanned: scheduling.state === 'deze_week',
    schedulingLabel: buildSchedulingLabel(scheduling.state),
  };
}

export default function RecipeOverviewScreen(): JSX.Element {
  const router = useRouter();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  // docs/DESIGN.md "Global rules": read once per screen, pass it down.
  const reduceMotionEnabled = useReduceMotion();
  /** The sender, for `sendRecipe`. `profiles.id` IS `auth.users.id`, so the session's user id is the profile id. */
  const { userId } = useSession();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loaded, setLoaded] = useState<LoadedRecipe | null>(null);
  const [scheduling, dispatchScheduling] = useReducer(reduceLibraryScheduling, INITIAL_LIBRARY_SCHEDULING);

  const load = useCallback(() => {
    let cancelled = false;
    setLoadState('loading');

    loadRecipe(mealId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result === null) {
          setLoadState('error');
          return;
        }
        setLoaded(result);
        // The reducer's own contract: `opened` is dispatched with the answer
        // the caller already has, rather than the row reading the week a
        // second time. Here that answer is the tile resolver's.
        dispatchScheduling({ type: 'opened', isPlanned: result.isPlanned });
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mealId]);

  /**
   * ON EVERY FOCUS, NOT JUST ON MOUNT, and that is the difference between
   * this screen and `recipe-edit`'s `useEffect(load, [load])`.
   *
   * `Aanpassen` pushes the editor and the editor calls `router.back()` when
   * it saves, landing the household right here — on a title, an ingredient
   * list and a step list they have just changed. A mount-only read would
   * show them the version they edited away from, which is the same defect
   * `(tabs)/recipes.tsx`'s header names for its own grid: "An edited title
   * has to reappear on the tile". Cook mode returns here too, and a cook
   * event moves this dish's scheduling state from "Deze week" to "Al
   * gekookt".
   *
   * IT COSTS A LOADING FLASH on the way back from either, since `load`
   * re-enters `'loading'`. The library grid already pays exactly that, and
   * the alternative — reading in the background and swapping the content
   * under the reader — is the one thing worse than a brief honest wait.
   */
  useFocusEffect(load);

  /**
   * The planning write, in whichever direction the button currently points.
   *
   * NO REF GUARD, UNLIKE `(tabs)/recipes.tsx`'s COPY OF THIS. There, the
   * sheet can be closed and reopened on a different dish while a write is in
   * flight, so a slow failure has to be checked against the dish it belongs
   * to. This screen is one dish for its whole lifetime — `mealId` is a route
   * param — so there is no second dish for a late answer to land on, and a
   * ref here would be ceremony implying a hazard that does not exist.
   *
   * IT DOES NOT RELOAD. `(tabs)/recipes.tsx` refreshes after this write
   * because a save reorders its grid (`sortMealsByScheduling`) and
   * reproducing that ordering locally would be a second implementation of
   * the rule. Nothing on this screen is ordered by scheduling; the only
   * thing that changes is the button's own label, which the reducer flips.
   * The eyebrow above deliberately does NOT flip with it — see its comment.
   */
  const commitScheduling = useCallback(async (recipe: LoadedRecipe, isPlanned: boolean): Promise<void> => {
    dispatchScheduling({ type: 'toggle-started' });
    try {
      const repository = getAppRepository();
      if (isPlanned) {
        await repository.removeSaves(recipe.householdId, recipe.meal.id, 'this_week');
      } else {
        // `memberId: null` — the same value the import confirmation screen
        // and the library sheet write. A save belongs to the household, and
        // nothing in this app asks which member planned a dish.
        await repository.createSave({
          householdId: recipe.householdId,
          memberId: null,
          mealId: recipe.meal.id,
          intent: 'this_week',
          sourceUrl: null,
        });
      }
    } catch {
      dispatchScheduling({ type: 'toggle-failed' });
      AccessibilityInfo.announceForAccessibility(
        isPlanned ? LIBRARY_UNSCHEDULE_FAILED_NOTE : LIBRARY_SCHEDULE_FAILED_NOTE,
      );
      return;
    }
    dispatchScheduling({ type: 'toggle-succeeded' });
    AccessibilityInfo.announceForAccessibility(
      isPlanned
        ? describeLibraryUnscheduledAnnouncement(recipe.meal.title)
        : describeLibraryScheduledAnnouncement(recipe.meal.title),
    );
  }, []);

  const handleSchedulingPress = useCallback((): void => {
    if (loaded === null || scheduling.phase === 'pending') {
      return;
    }
    void commitScheduling(loaded, scheduling.isPlanned);
  }, [loaded, scheduling, commitScheduling]);

  /**
   * Sturen — the one act here that writes to the social seam. Its state, its
   * friend read and its one write live in src/lib/useLibrarySendSheet.ts.
   *
   * `onBeforeOpen` is a no-op, and that is the honest value rather than a
   * missing one: the hook takes it so a caller can close whatever the sheet
   * was opened FROM, and on this screen there is nothing open. The library
   * passes a closer for its action sheet because two stacked modals over one
   * dish is the hazard; a full-screen route under one sheet is not.
   */
  const send = useLibrarySendSheet({
    userId,
    onBeforeOpen: useCallback((): void => {
      // Nothing to close — see above.
    }, []),
  });

  const backRow = (
    <View style={styles.header}>
      {/* ONE COMPONENT NOW, 9 SEPTEMBER 2026. What stood here argued that
          this row was byte-for-byte identical on four screens and that
          repairing one without the others would make them "quietly behave
          in two ways" — true, and now enforced by there only being one of
          them. The measurement that comment carried survives in
          BackButton.tsx: the 44pt box was already met here, so the arrow is
          a change to the VISIBLE target and not to the touch target. */}
      <BackButton onPress={() => router.back()} accessibilityLabel={RECIPE_OVERVIEW_BACK_ACCESSIBILITY_LABEL} />
    </View>
  );

  if (loadState !== 'ready' || loaded === null) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        {backRow}
        <View style={styles.centered}>
          <Text style={[typeScale.body, styles.centeredText, { color: colors.textMuted }]}>
            {loadState === 'loading' ? RECIPE_OVERVIEW_LOADING_LABEL : RECIPE_OVERVIEW_LOAD_FAILED}
          </Text>
          {loadState === 'loading' ? null : (
            <Button
              label={RECIPE_OVERVIEW_RETRY_LABEL}
              variant="secondary"
              onPress={load}
              accessibilityLabel={RECIPE_OVERVIEW_RETRY_ACCESSIBILITY_LABEL}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { meal, ingredients, steps, schedulingLabel } = loaded;
  const metaLine = buildRecipeOverviewMetaLine(meal.estimatedMinutes, meal.servings);
  const sourceLink = describeRecipeOverviewSourceLink(meal.sourcePlatform, meal.sourceUrl);
  const dishTags = readRecipeOverviewDishTags(meal.dishTags);
  const dishMoods = readRecipeOverviewDishMoods(readMealDishMoods(meal));
  const schedulingRow = describeLibrarySchedulingRow(scheduling);

  // EVERY EDGE, unlike the tabs' own screens. This is a pushed route with no
  // tab bar under it, so the footer's `Koken` would sit on the home indicator
  // without the bottom inset. Same reason `recipe-edit` and `import/confirm`
  // take all four, and the reason `(tabs)/recipes.tsx` does not.
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      {backRow}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* The tile's own badge word, as an eyebrow. Uppercased here rather
            than in the source string, per tokens.ts's note on `label`.

            IT DOES NOT FOLLOW THE BUTTON BELOW, deliberately. This says what
            the dish's state WAS when the screen loaded — including "Al
            gekookt", which the planning button can neither produce nor undo
            — and the button says what will happen if you press it. Wiring
            the two together would make this line re-derive the badge's
            four-state precedence from one boolean, and it would get "Al
            gekookt" wrong the moment somebody planned a dish they had
            already cooked. `resolveRecipeSchedulingState` owns that
            precedence; this screen reads it once and quotes it. */}
        <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>{schedulingLabel}</Text>

        {/* A6: no numberOfLines cap anywhere on this screen — a truncated
            dish title is the clipping docs/DESIGN.md asks screens to avoid,
            and this one has a whole column to grow into. */}
        <Text style={[typeScale.title1, { color: colors.textPrimary }]}>{meal.title}</Text>

        {metaLine !== null ? (
          <Text style={[typeScale.numeral, styles.metaRow, { color: colors.textMuted }]}>{metaLine}</Text>
        ) : null}

        {sourceLink !== null && meal.sourceUrl !== null ? (
          <RecipeSourceLinkRow link={sourceLink} url={meal.sourceUrl} />
        ) : null}

        {dishTags.length > 0 ? (
          <RecipeTagRow
            heading={RECIPE_OVERVIEW_TAGS_HEADING}
            entries={dishTags.map((entry) => ({ key: entry.tag, label: entry.label, icon: iconForDishTag(entry.tag) }))}
          />
        ) : null}

        {dishMoods.length > 0 ? (
          <RecipeTagRow
            heading={RECIPE_OVERVIEW_MOODS_HEADING}
            // No glyph vocabulary for moods, and none is invented here:
            // dishTagIcons.ts maps the seventeen dish TAGS and says in its
            // header why deriving a drawing from anything looser is a matcher
            // nobody can read, argue with or correct by hand.
            entries={dishMoods.map((entry) => ({ key: entry.mood, label: entry.label, icon: null }))}
          />
        ) : null}

        <Text style={[typeScale.title3, styles.sectionHeading, { color: colors.textPrimary }]}>
          {RECIPE_OVERVIEW_INGREDIENTS_HEADING}
        </Text>
        {ingredients.length > 0 ? (
          <RecipeIngredientList ingredients={ingredients} />
        ) : (
          <Text style={[typeScale.bodySmall, styles.emptySection, { color: colors.textMuted }]}>
            {RECIPE_OVERVIEW_NO_INGREDIENTS}
          </Text>
        )}

        <Text style={[typeScale.title3, styles.sectionHeading, { color: colors.textPrimary }]}>
          {RECIPE_OVERVIEW_STEPS_HEADING}
        </Text>
        {steps.length > 0 ? (
          steps.map((step) => (
            <Text key={step.id} style={[typeScale.body, styles.listLine, { color: colors.textSecondary }]}>
              {`${step.stepNumber}. ${step.instruction}`}
            </Text>
          ))
        ) : (
          <Text style={[typeScale.bodySmall, styles.emptySection, { color: colors.textMuted }]}>
            {RECIPE_OVERVIEW_NO_STEPS}
          </Text>
        )}

        {/* The three secondary acts, after the reading rather than before
            it, behind a hairline that separates "what this dish is" from
            "what you can do with it". Cooking is not among them: it is the
            reason most people opened this screen, so it sits in the footer's
            thumb zone instead of at the end of a scroll that can be several
            screens long. */}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          {/* `disabled` AND NOT `loading`, which would have been the tidier
              call and is the wrong one. `Button`'s `loading` replaces the
              label with a spinner, and `describeLibrarySchedulingRow`'s own
              contract is that a pending row shows "its CURRENT label,
              disabled — never the label it is about to become", because a
              control that changes its mind before the write lands makes the
              user watch it change back on a failure. Taking the label away
              entirely breaks that rule from the other side. `Button` still
              announces `accessibilityState.disabled`, so the pending moment
              is spoken as well as seen. */}
          <Button
            label={schedulingRow.label}
            variant="secondary"
            onPress={handleSchedulingPress}
            disabled={schedulingRow.disabled}
            accessibilityLabel={schedulingRow.accessibilityLabel}
          />
          {/* The explainer the long-press sheet renders under this same row.
              It is not decoration: "en op de boodschappenlijst" is the one
              consequence of planning a dish that nothing else on this screen
              says, and a household that learns it only by opening
              /boodschappen has learned it too late. The button's spoken
              label already carries it (`withExplainer`), so this line is
              what gives a sighted user the same sentence.

              AND IT IS SET AS A SENTENCE SINCE 9 SEPTEMBER 2026. It was the
              mono `caption`, which is this system's face for something
              measured; `withExplainer` composes these exact words into one
              spoken sentence with the button label, and a listener and a
              reader should not be handed two different registers of it. */}
          <Text style={[typeScale.bodySmall, styles.actionExplainer, { color: colors.textMuted }]}>
            {schedulingRow.explainer}
          </Text>
          {/* `danger`, and never a toast: a failed write is something the
              household has to see, and this note names the direction that
              failed rather than the direction the button now points. */}
          {schedulingRow.errorNote !== null ? (
            <Text style={[typeScale.bodySmall, styles.actionError, { color: colors.danger }]}>
              {schedulingRow.errorNote}
            </Text>
          ) : null}

          <View style={styles.actionPair}>
            <View style={styles.actionPairItem}>
              <Button
                label={RECIPE_EDIT_ROW_LABEL}
                variant="tertiary"
                onPress={() => router.push(`/recipe-edit/${meal.id}`)}
                accessibilityLabel={RECIPE_EDIT_ROW_ACCESSIBILITY_LABEL}
              />
            </View>
            <View style={styles.actionPairItem}>
              <Button
                label={LIBRARY_TILE_SEND_LABEL}
                variant="tertiary"
                onPress={() => send.open(meal)}
                accessibilityLabel={LIBRARY_TILE_SEND_ACCESSIBILITY_LABEL}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          label={RECIPE_OVERVIEW_COOK_LABEL}
          variant="primary"
          onPress={() => router.push(`/cook/${meal.id}`)}
          accessibilityLabel={RECIPE_OVERVIEW_COOK_ACCESSIBILITY_LABEL}
        />
      </View>

      {/* Mounted only while a dish is chosen — the sheet's title IS that
          dish, so there is nothing correct for it to render without one. */}
      {send.meal !== null ? (
        <SendRecipeSheet
          visible
          dishTitle={send.meal.title}
          friends={send.state}
          note={send.note}
          onChangeNote={send.onChangeNote}
          onSend={send.onSend}
          onRetryFriends={send.onRetryFriends}
          onDismiss={send.close}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.space4,
  },
  centeredText: {
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space8,
  },
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: spacing.space2,
  },
  metaRow: {
    marginTop: spacing.space2,
  },
  sectionHeading: {
    marginTop: spacing.space6,
    marginBottom: spacing.space2,
  },
  // The step list only, now that the ingredient list draws its own — see
  // RecipeIngredientList's `line`, which deliberately carries the same value
  // so two lists under two sibling headings share one rhythm.
  listLine: {
    marginBottom: spacing.space2,
  },
  emptySection: {
    marginBottom: spacing.space2,
  },
  actions: {
    borderTopWidth: 1,
    marginTop: spacing.space8,
    paddingTop: spacing.space5,
    gap: spacing.space3,
  },
  actionExplainer: {
    // Negative margin against the block's `gap`: the explainer belongs to
    // the button above it, not to the pair below, and an even gap on both
    // sides would make it read as a note about the whole action block.
    marginTop: -spacing.space2,
  },
  actionError: {
    textAlign: 'center',
  },
  actionPair: {
    flexDirection: 'row',
    gap: spacing.space3,
  },
  actionPairItem: {
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space6,
  },
});

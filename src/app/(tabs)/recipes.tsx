/**
 * Mijn recepten — the library of saved short-form-video recipes
 * (docs/DESIGN.md §2). It read "Bibliotheek" until the owner asked why the
 * app used a word he would not; the tab and this header now say the same
 * plain thing, and only the labels changed.
 *
 * Every recipe shows its real scheduling state (deze week / ooit / al
 * gekookt / nog geen planning) via
 * src/components/recipeScheduling.ts, "deze week" first, so the tab
 * communicates what will actually happen, not just what got hoarded — the
 * same failure mode PD-004's "when?" prompt exists to prevent.
 *
 * Curated meals (householdId null) are deliberately excluded — this is
 * the household's own rotation, not a global catalogue.
 *
 * The entry point into the import flow (src/app/import/paste.tsx) is a
 * persistent header button, always visible (not just in the empty state) —
 * that screen is the ONLY way this library grows, since the old
 * "type 10-15 meals" onboarding is gone, and it is the one control this
 * screen's header carries. This sentence used to say "pasting a LINK is the
 * only way", which had quietly become false twice over: since SRC-08 the
 * same screen accepts the recipe as TEXT with no link at all, and manual
 * entry has always been reachable from it. Naming the link route as the
 * only way in is the same defect ENT-05 fixed in the empty state below, one
 * comment above the code it describes. The household settings screen
 * (src/app/settings.tsx) is reachable from here too, as a quiet text link
 * on the title line rather than a second button beneath it, and never a
 * gating step before any tab is usable. `LibraryHeader` below carries the
 * argument for that arrangement.
 *
 * *Empty is the honest first-run state.* A fresh install seeds nothing but
 * a bare household (src/lib/repository/seedData.ts) — no curated starter
 * set, no fixture recipes — so this screen must say so plainly and point
 * at Plakken, not paper over it with fake content.
 *
 * Reads through `RemyRepository` (@/lib/repository). Reloads on every
 * screen focus (`useFocusEffect`), not just on first mount, so returning
 * here right after confirm.tsx's `router.replace('/recipes')` shows the
 * just-saved meal without needing a full app restart.
 *
 * *TAPPING A TILE OPENS THE RECIPE* (src/app/recipe/[mealId].tsx), and that
 * is a change from what docs/DESIGN.md §2 and `RecipeTile.tsx`'s own header
 * both say ("Tap → Kookmodus directly (unchanged behavior)"). That sentence
 * was written when there was nothing else a tile could open, so opening a
 * recipe and cooking it were the same act. They are not any more: cook mode
 * keeps the screen awake, counts steps and writes a cook event at its
 * terminus, and making it the consequence of one tap on a thumbnail spends
 * the library's cheapest gesture on the product's most committed surface.
 * The recipe screen carries `Koken` as its primary control, so cooking is
 * one tap further away and nothing else about the grid moved.
 *
 * `accessibilityHint` IS OVERRIDDEN ALONGSIDE `onPress`, because RecipeTile
 * asks callers to do exactly that: the two together are what a tile
 * promises, and changing one without the other leaves the tile telling
 * screen-reader users it opens cook mode while it opens something else.
 *
 * *Long-pressing a tile* opens `LibraryTileActionSheet` (DESIGN-SOCIAL.md
 * §3.1), which carries two rows: "Sturen", which opens
 * `SendRecipeSheet`, and "Deel deze niet", the per-meal cook-proof
 * exclusion of §3.5. This screen owns every repository call behind both —
 * the exclusion read on open, the write on tap and the re-read that
 * confirms it; the friend list and the send write — because that is how
 * the rest of this app is arranged and because both sheets are
 * deliberately presentational.
 *
 * TWO REPOSITORY SEAMS, AND THEY DO NOT MIX. The grid and the exclusion go
 * through `RemyRepository` (@/lib/repository), which is scoped by
 * household. The friend list and the send go through
 * `RemySocialRepository`, which is not scoped by anything — a friendship
 * joins two people usually in different households. src/lib/repository/
 * social/types.ts argues that separation at length; the practical
 * consequence here is that `getAppRepository()` and
 * `createSupabaseSocialRepository(supabase)` are never interchangeable and
 * neither is asked a question belonging to the other.
 *
 * NOTHING ABOUT SENDING CHECKS WHETHER THE DISH WAS COOKED, and nothing
 * should be added that does. PD-016 decided the cook gate, built it, and
 * then reversed it: proof is the tier that has to be earned, and a send is
 * "ik moest aan jou denken". `sortMealsByScheduling` already knows which
 * meals have cook events; that knowledge is for the grid's ordering and
 * must never reach `useLibrarySendSheet` (src/lib), which takes a meal and a
 * profile and has no parameter a cook event could arrive through.
 *
 * THE EXCLUSION IS NEVER READ OFF `Meal.excludedFromCookProof`, not even
 * off the `Meal` that `setMealCookProofExclusion` hands back. That field is
 * optional (legacy rows lack the key) and it is the one field in the domain
 * whose absent reading is fail-OPEN — missing means "share it" — so
 * src/domain/types.ts asks callers to go through
 * `getMealCookProofExclusion`, which normalises and refuses an unknown id
 * rather than answering "not excluded". That is why the write below is
 * followed by a re-read instead of trusting the returned row: one extra
 * round trip against a local store, in exchange for never re-inventing the
 * fail-open answer the repository deliberately declined to give.
 *
 * A FAILED READ IS NOT "NOT EXCLUDED". The getter throws on an unknown
 * meal; the sheet answers that with its own `unavailable` row rather than
 * a control rendered "uit", for the same reason the household switch does
 * (cookSharingCopy.ts): a control shown off after a failed read displays a
 * privacy choice the household never made.
 *
 * The grid is deliberately NOT reloaded after an exclusion changes — no
 * tile renders the flag, so a refetch would be a loading state over an
 * identical screen. It becomes necessary the day a tile shows an
 * "uitgezonderd" mark, and belongs in that change.
 *
 * SEARCH AND FILTER (LIB-01/LIB-03/LIB-05) ADD NO REPOSITORY CALLS OF THEIR
 * OWN. `loadRows` above already fetches every meal the household owns and
 * returns it fully sorted, "deze week" first; `search` state
 * (`LibrarySearchState`, src/domain/recipeSearch.ts) narrows that same
 * array client-side, in `useMemo`, after the fact. That ordering is what
 * keeps "deze week first" true of the visible rows without this screen
 * re-deriving or re-asserting it: filtering a sorted array never reorders
 * what survives it.
 *
 * FIVE AXES, IN TWO PLACES, AND ONE CALL. The title match and the
 * dishTags-AND / dishMoods-OR / course-OR / time-cap semantics live in
 * recipeSearch.ts, reusing the decision engine's own `filterByDecisionFilters`
 * where they can. The SCHEDULING STATE cannot live there — it is derived per
 * row rather than stored on `Meal`, and the domain layer refuses the
 * component import that reaching for it would need — so
 * src/components/libraryGridFilter.ts composes both halves and hands this
 * screen one `filterLibraryGrid` call. That is also where the chip lists
 * come from: which chips are worth offering depends on which are already
 * selected, and computing it against the full library (as this screen used
 * to) offers controls guaranteed to return zero.
 *
 * THE ZERO-RESULTS STATE IS NOT THE FIRST-RUN EMPTY STATE ABOVE, on purpose:
 * a household with forty recipes and a mistyped search term is not a
 * household that needs to be told to paste a link, so a search producing
 * nothing renders `LibrarySearchEmptyState` with copy from
 * librarySearchCopy.ts, gated on `rows.length > 0` — the branch below it,
 * never the one above.
 *
 * THREE COLUMNS AT 4:5 (the owner: "3 recepten breed"), and the grid is
 * MEASURED rather than flexed — libraryGridMetrics.ts owns every number and
 * says why a `flex: 1` cell breaks a partial last row at three columns.
 *
 * THE SORT ROW (LIB-04) WAS REMOVED ON 2026-09-05 at the owner's request
 * ("sorteren kan voor nu weg"), taking with it the `sort` state, the
 * `sortLibraryRows` memo, and the `cookEvents` state that existed only to
 * feed it. src/domain/librarySort.ts and its tests deliberately survive
 * uncalled — that file's own header says why. `visibleRows` below is now
 * the filter's output directly, so "deze week eerst" holds unconditionally
 * again, with nothing on this screen allowed to reorder anything.
 *
 * REMOVE (LIB-04) ARCHIVES, NEVER HARD-DELETES. "Verwijderen" on the
 * long-press sheet calls `RemyRepository.archiveMeal` — see that method's
 * own comment in src/lib/repository/types.ts for why: `decisions.meal_id`
 * and `cook_events.meal_id` are declared `on delete restrict` in
 * 0001_init.sql precisely so a real delete cannot silently corrupt a
 * household's cook history, and `meals.archived_at` already existed,
 * already documented as "removing a meal from rotation", before this
 * screen wrote to it for the first time. A successful archive filters the
 * meal out of `rows` locally (no `refresh()` needed — an archived meal
 * would be excluded by the next `listHouseholdMeals` read regardless) and
 * closes the sheet; the confirm step itself lives entirely in
 * libraryRemovalCopy.ts's state machine, rendered through the same
 * `LibraryTileActionSheet` §3.1 already uses, never a second modal.
 */

import { useCallback, useMemo, useState, type JSX } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NO_LIBRARY_SEARCH, type LibrarySearchState } from '@/domain/recipeSearch';
import type { HouseholdId, MealId } from '@/domain/types';
import { Button } from '@/components/Button';
import { describeEmptyLibrary } from '@/components/emptyLibraryCopy';
import { LibraryHeader } from '@/components/LibraryHeader';
import { filterLibraryGrid } from '@/components/libraryGridFilter';
import {
  LIBRARY_GRID_COLUMNS,
  LIBRARY_GRID_GUTTER,
  libraryTileHeight,
  libraryTileWidth,
} from '@/components/libraryGridMetrics';
import { LibrarySearchBar } from '@/components/LibrarySearchBar';
import { LibrarySearchEmptyState } from '@/components/LibrarySearchEmptyState';
import { describeLibrarySearchEmpty } from '@/components/librarySearchCopy';
import { LibraryTileActionSheet } from '@/components/LibraryTileActionSheet';
import { LIBRARY_TILE_OPEN_RECIPE_HINT } from '@/components/libraryTileActionCopy';
import { RecipeTile } from '@/components/RecipeTile';
import { sortMealsByScheduling, type ScheduledMealRow } from '@/components/recipeScheduling';
import { SendRecipeSheet } from '@/components/SendRecipeSheet';
import { useLibraryTileActions } from '@/components/useLibraryTileActions';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSession } from '@/hooks/useSession';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { useLibrarySendSheet } from '@/lib/useLibrarySendSheet';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

/** Three rows of placeholders at three columns — about one screenful, matching what the real grid shows. */
const LOADING_TILE_COUNT = 9;

/**
 * The first-run empty state's words (ENT-05), resolved once at module load
 * rather than per render: this surface's copy depends on nothing — not on
 * props, not on state, not on the household — so deriving it inside the
 * component would be a `useMemo` guarding a `Record` lookup, which costs
 * more to read than it saves to run.
 *
 * It is a CONSTANT and not a literal because of where it comes from: a
 * sentence written inline in this file is one no test can reach (vitest
 * collects `.test.ts` only, with react-native stubbed), and the sentence
 * that used to sit here spent four route additions telling new users Remy
 * accepts two platforms when it accepts six. emptyLibraryCopy.ts carries
 * that whole argument, and shares this state with Kiezen's `empty_rotation`
 * so the two screens cannot drift into describing one fact two ways.
 */
const LIBRARY_EMPTY_COPY = describeEmptyLibrary('library');

async function loadRows(householdId: HouseholdId): Promise<readonly ScheduledMealRow[]> {
  const repository = getAppRepository();
  const [meals, saves, cookEvents] = await Promise.all([
    repository.listHouseholdMeals(householdId),
    repository.listSaves(householdId),
    repository.listCookEvents(householdId),
  ]);
  // The household's own rotation only — curated (householdId null) meals
  // are excluded here even though listHouseholdMeals returns both,
  // matching this screen's own file header.
  const ownMeals = meals.filter((meal) => meal.householdId === householdId);
  return sortMealsByScheduling(ownMeals, saves, cookEvents);
}

export default function RecipesScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  // docs/DESIGN.md "Global rules": read once per screen, pass it down.
  const reduceMotionEnabled = useReduceMotion();
  /** The sender, for `sendRecipe`. `profiles.id` IS `auth.users.id`, so the session's user id is the profile id. */
  const { userId } = useSession();

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [rows, setRows] = useState<readonly ScheduledMealRow[]>([]);

  /**
   * LIB-01/LIB-03/LIB-05. `rows` above stays the full, repository-fetched
   * set — see this file's header for why filtering never touches it and
   * instead derives a view.
   *
   * ONE MEMO FOR ALL FIVE AXES, AND THE CHIPS COME OUT OF IT TOO. It used to
   * be three: `filterLibraryRows` for the grid, and two `collect…` calls that
   * asked the FULL library which chips to offer. That second half was wrong
   * in a way nothing on screen admitted — `requiredDishTags` is ANDed, so
   * after one chip was chosen every non-co-occurring chip was still offered
   * and every one of them returned zero. libraryGridFilter.ts carries the
   * whole argument, and the property the old comment was protecting ("a chip
   * a household has already selected never disappears out from under them")
   * is now guaranteed explicitly rather than as a side effect of not
   * narrowing at all.
   */
  const [search, setSearch] = useState<LibrarySearchState>(NO_LIBRARY_SEARCH);
  const grid = useMemo(() => filterLibraryGrid(rows, search), [rows, search]);
  const visibleRows = grid.rows;

  /**
   * The grid is measured rather than flexed, because at three columns a
   * `flex: 1` cell stretches to fill a PARTIAL last row — a seventh recipe
   * drawn triple width. `libraryGridMetrics.ts` owns the arithmetic and its
   * test is WS-2 §5's density table.
   *
   * `useWindowDimensions` and not `Dimensions.get`: it re-renders on
   * rotation and on a foldable's hinge, where the static read would leave
   * every tile the width of the screen the app started on.
   */
  const { width: windowWidth } = useWindowDimensions();
  const tileWidth = libraryTileWidth(windowWidth);

  const refresh = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    ensureSeeded()
      .then(() => getAppRepository().getCurrentHouseholdId())
      .then((householdId) => loadRows(householdId))
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setRows(loaded);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(refresh);

  /**
   * The long-press sheet's three writes and their state, in
   * src/components/useLibraryTileActions.ts — see that module's header for
   * why they left this file (the 800-line ceiling) and why its two callbacks
   * are shaped the way they are.
   *
   * THE TWO CALLBACKS ARE OPPOSITE ON PURPOSE. A removal drops one row
   * locally, because an archived meal would be excluded by the next
   * `listHouseholdMeals` read regardless and a full reload would be a loading
   * state over a grid that mostly did not change. A scheduling change
   * refreshes, because a save changes what `resolveRecipeSchedulingState`
   * computes and `sortMealsByScheduling` then reorders the grid around;
   * reproducing that here would be a second implementation of the ordering
   * rule.
   */
  const actions = useLibraryTileActions({
    onRemoved: useCallback((mealId: MealId): void => {
      setRows((current) => current.filter((row) => row.meal.id !== mealId));
    }, []),
    onSchedulingChanged: refresh,
  });
  const closeActions = actions.close;

  /**
   * RCP-03 — "Aanpassen" on the long-press sheet.
   *
   * CLOSES THE SHEET FIRST, then navigates. The sheet is a modal over this
   * screen; pushing a full-screen route out from under an open one leaves
   * it mounted behind the editor and standing there on the way back, which
   * is the same reason the send sheet's `onBeforeOpen` closes this one
   * before opening its own.
   *
   * NO REPOSITORY CALL HERE, unlike every other row on that sheet. This one
   * only opens a door — the edit screen does its own load, its own write and
   * its own error state, because a correction is a multi-field task with a
   * real failure mode and a sheet row has nowhere to put either.
   *
   * THE GRID IS REFRESHED ON THE WAY BACK BY `useFocusEffect`, which this
   * screen already runs on every focus (see the file header). An edited
   * title has to reappear on the tile, so unlike the exclusion — which no
   * tile renders — this genuinely needs the reload, and it needs no new code
   * to get it.
   */
  const openRecipeEdit = useCallback(
    (mealId: MealId) => {
      closeActions();
      router.push(`/recipe-edit/${mealId}`);
    },
    // `actions.close` and not `actions`: the hook returns a fresh object every
    // render, so depending on the whole thing would rebuild this callback on
    // every keystroke in the search field.
    [closeActions, router],
  );

  /**
   * Sturen (DESIGN-SOCIAL.md §3.1 / §4.1) — the second thing the long-press
   * sheet offers, and the only one that writes to the social seam. Its state,
   * its friend read and its one write live in src/lib/useLibrarySendSheet.ts;
   * that file's header carries why they are not this screen's and why they are
   * not `useOutcomeSend`'s either.
   *
   * `onBeforeOpen` closes the action sheet. Two stacked modals over one dish
   * means two scrims and a back gesture whose meaning depends on which is on
   * top — and this screen is the only thing that can close the other one.
   */
  const send = useLibrarySendSheet({
    userId,
    // Two stacked modals over one dish means two scrims and a back gesture
    // whose meaning depends on which is on top — and this screen is the only
    // thing that can close the other one.
    onBeforeOpen: closeActions,
  });

  /**
   * Bound to a local before the JSX so TypeScript's narrowing survives into
   * the callbacks below. `actions.meal !== null` narrows a property read, but
   * not one inside an arrow function that could run after the check — and the
   * sheet's `onSturen`/`onAanpassen` are exactly that.
   */
  const actionSheetMeal = actions.meal;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <LibraryHeader
        onPasteLink={() => router.push('/import/paste')}
        onOpenSettings={() => router.push('/settings')}
        onOpenWeekPlan={() => router.push('/deze-week')}
      />

      {phase === 'loading' ? <LoadingGrid /> : null}

      {phase === 'error' ? (
        <View style={styles.empty}>
          <Text style={[typeScale.title3, styles.emptyTitle, { color: colors.textPrimary }]}>
            Kon recepten niet laden
          </Text>
          <View style={styles.retryButton}>
            <Button label="Opnieuw proberen" variant="secondary" onPress={refresh} accessibilityLabel="Recepten opnieuw laden" />
          </View>
        </View>
      ) : null}

      {/* ENT-05. Every word below comes from `emptyLibraryCopy.ts`; none of
          it is written inline any more, because a sentence typed into a
          route module is one vitest cannot import — which is exactly how
          the old copy survived four additions to `ImportPlatform` still
          naming two platforms out of six. That module carries the argument
          in full, and it is deliberately not repeated here. */}
      {phase === 'ready' && rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>{LIBRARY_EMPTY_COPY.title}</Text>
          <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>{LIBRARY_EMPTY_COPY.body}</Text>
          <View style={styles.emptyAction}>
            <Button
              label={LIBRARY_EMPTY_COPY.actionLabel}
              variant="primary"
              onPress={() => router.push('/import/paste')}
              accessibilityLabel={LIBRARY_EMPTY_COPY.actionAccessibilityLabel}
            />
          </View>
        </View>
      ) : null}

      {/* The search bar stays mounted regardless of how many rows match —
          see this file's header — so a query or filter that narrows the
          grid to nothing still leaves the household somewhere to change
          its mind, rather than disappearing along with the results it
          produced. */}
      {phase === 'ready' && rows.length > 0 ? (
        <LibrarySearchBar
          search={search}
          selectableDishTags={grid.selectableDishTags}
          selectableDishMoods={grid.selectableDishMoods}
          selectableDishCourses={grid.selectableDishCourses}
          selectableSchedulingStates={grid.selectableSchedulingStates}
          onChange={setSearch}
        />
      ) : null}

      {phase === 'ready' && rows.length > 0 && visibleRows.length === 0 ? (
        <LibrarySearchEmptyState copy={describeLibrarySearchEmpty(search)} onClear={() => setSearch(NO_LIBRARY_SEARCH)} />
      ) : null}

      {phase === 'ready' && visibleRows.length > 0 ? (
        <FlatList
          data={visibleRows}
          keyExtractor={(row: ScheduledMealRow) => row.meal.id}
          numColumns={LIBRARY_GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }: { item: ScheduledMealRow }) => (
            // The exact width, not `flex: 1`: a flexed cell stretches to fill
            // a PARTIAL last row, so at three columns a seventh recipe would
            // be drawn triple width. See libraryGridMetrics.ts for why this
            // is measured rather than expressed as a percentage, and why the
            // placeholder-row alternative was rejected.
            <View style={{ width: tileWidth }}>
              <RecipeTile
                meal={item.meal}
                scheduling={item.scheduling}
                // A TAP OPENS THE RECIPE, NOT COOK MODE — see this file's
                // header for the argument, and RecipeTile's for why the prop
                // exists. `accessibilityHint` moves with it, because that
                // component's header asks any caller overriding `onPress` to
                // override the hint too: a tile still promising cook mode
                // while opening something else would lie to exactly the users
                // who cannot see where they landed.
                onPress={() => router.push(`/recipe/${item.meal.id}`)}
                accessibilityHint={LIBRARY_TILE_OPEN_RECIPE_HINT}
                onLongPress={() => actions.open(item.meal, item.scheduling.state === 'deze_week')}
              />
            </View>
          )}
          contentContainerStyle={styles.gridContent}
        />
      ) : null}

      {/* Mounted only while a dish is chosen: the sheet's title IS that
          dish, so there is no correct thing for it to render without one. */}
      {actionSheetMeal !== null ? (
        <LibraryTileActionSheet
          visible
          dishTitle={actionSheetMeal.title}
          cookProofExclusion={actions.exclusion}
          onPressCookProofRow={actions.onPressCookProofRow}
          onSturen={() => send.open(actionSheetMeal)}
          onAanpassen={() => openRecipeEdit(actionSheetMeal.id)}
          scheduling={actions.scheduling}
          onPressSchedulingRow={actions.onPressSchedulingRow}
          removal={actions.removal}
          onRequestRemoval={actions.onRequestRemoval}
          onCancelRemoval={actions.onCancelRemoval}
          onConfirmRemoval={actions.onConfirmRemoval}
          onDismiss={actions.close}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ) : null}

      {/* Mounted only while a dish is chosen, for the sheet above's reason:
          the title IS that dish. Never mounted at the same time as the
          action sheet — the hook's `onBeforeOpen` closes that one first. */}
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

/**
 * Loading state: a grid of flat surfaceSunken tiles, no shimmer —
 * docs/DESIGN.md §2.
 *
 * IT DRAWS THE SAME RECTANGLE THE REAL GRID DOES, which it did not before:
 * the placeholders were `width: '47%'` and `aspectRatio: 9 / 16` while the
 * tile beside them was `flex: 1` at the same aspect — 48.4% in practice, so
 * the stand-in was a different shape from the thing it stood in for and the
 * grid visibly resettled when the data arrived. Both now come from
 * libraryGridMetrics.ts, which is the whole reason that module exists.
 */
function LoadingGrid(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { width: windowWidth } = useWindowDimensions();
  const placeholders = Array.from({ length: LOADING_TILE_COUNT }, (_, index) => index);

  return (
    <View style={styles.loadingGrid} accessibilityLabel="Recepten laden" accessible>
      {placeholders.map((index) => (
        <View
          key={index}
          style={[
            styles.loadingTile,
            {
              backgroundColor: colors.surfaceSunken,
              width: libraryTileWidth(windowWidth),
              height: libraryTileHeight(windowWidth),
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  gridContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.space10,
    gap: LIBRARY_GRID_GUTTER,
  },
  gridRow: {
    gap: LIBRARY_GRID_GUTTER,
  },
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: LIBRARY_GRID_GUTTER,
  },
  loadingTile: {
    // Width and height come from the props, not from here — see LoadingGrid.
    borderRadius: radii.radiusSm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  emptyTitle: {
    marginBottom: spacing.space2,
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.space6,
    minWidth: 220,
  },
  retryButton: {
    marginTop: spacing.space5,
    minWidth: 200,
  },
});

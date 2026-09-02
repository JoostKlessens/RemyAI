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
 * SEARCH AND FILTER (LIB-01/LIB-03) ADD NO REPOSITORY CALLS OF THEIR OWN.
 * `loadRows` above already fetches every meal the household owns and
 * returns it fully sorted, "deze week" first; `search` state
 * (`LibrarySearchState`, src/domain/recipeSearch.ts) narrows that same
 * array client-side, in `useMemo`, after the fact. That ordering is what
 * keeps "deze week first" true of the visible rows without this screen
 * re-deriving or re-asserting it: filtering a sorted array never reorders
 * what survives it. ALL of the matching logic — the title match, and the
 * dishTags-AND / dishMoods-OR / time-cap semantics reused from the
 * decision engine's own `filterByDecisionFilters` — lives in
 * recipeSearch.ts; this screen only holds the `LibrarySearchState` and
 * calls `filterLibraryRows`. THE ZERO-RESULTS STATE IS NOT THE FIRST-RUN
 * EMPTY STATE ABOVE, on purpose: a household with forty recipes and a
 * mistyped search term is not a household that needs to be told to paste a
 * link, so a search producing nothing renders `LibrarySearchEmptyState`
 * with copy from librarySearchCopy.ts, gated on `rows.length > 0` — the
 * branch below it, never the one above.
 *
 * SORT (LIB-04) COMPOSES AFTER FILTER, AND ADDS NO REPOSITORY CALLS OF ITS
 * OWN EITHER. `filteredRows` narrows `rows`; `visibleRows` then reorders
 * whatever survived, via `sortLibraryRows` (src/domain/librarySort.ts) —
 * the one place on this screen allowed to change row order, and only while
 * `sort` is not `'default'`. `cookEvents`, which `nog_nooit_gekookt` needs,
 * is kept in state alongside `rows` purely because `loadRows` already
 * fetches it for `sortMealsByScheduling`; nothing new is read from the
 * repository to support it.
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

import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { AccessibilityInfo, FlatList, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collectAvailableDishMoods } from '@/domain/dishMoods';
import { DEFAULT_LIBRARY_SORT, sortLibraryRows, type LibrarySortOption } from '@/domain/librarySort';
import {
  NO_LIBRARY_SEARCH,
  collectAvailableDishTags,
  filterLibraryRows,
  type LibrarySearchState,
} from '@/domain/recipeSearch';
import type { CookEvent, HouseholdId, Meal, MealId } from '@/domain/types';
import { Button } from '@/components/Button';
import { describeEmptyLibrary } from '@/components/emptyLibraryCopy';
import { LibraryHeader } from '@/components/LibraryHeader';
import { LibrarySearchBar } from '@/components/LibrarySearchBar';
import { LibrarySearchEmptyState } from '@/components/LibrarySearchEmptyState';
import { describeLibrarySearchEmpty } from '@/components/librarySearchCopy';
import {
  INITIAL_LIBRARY_REMOVAL,
  LIBRARY_REMOVE_FAILED_ANNOUNCEMENT,
  describeLibraryRemovedAnnouncement,
  reduceLibraryRemoval,
} from '@/components/libraryRemovalCopy';
import {
  INITIAL_LIBRARY_SCHEDULING,
  LIBRARY_SCHEDULE_FAILED_NOTE,
  LIBRARY_UNSCHEDULE_FAILED_NOTE,
  describeLibraryScheduledAnnouncement,
  describeLibraryUnscheduledAnnouncement,
  reduceLibraryScheduling,
} from '@/components/librarySchedulingCopy';
import { LibraryTileActionSheet } from '@/components/LibraryTileActionSheet';
import {
  COOK_PROOF_WRITE_FAILED_ANNOUNCEMENT,
  INITIAL_COOK_PROOF_EXCLUSION,
  describeCookProofExclusionAnnouncement,
  reduceCookProofExclusion,
} from '@/components/libraryTileActionCopy';
import { RecipeTile } from '@/components/RecipeTile';
import { sortMealsByScheduling, type ScheduledMealRow } from '@/components/recipeScheduling';
import { SendRecipeSheet } from '@/components/SendRecipeSheet';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSession } from '@/hooks/useSession';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { useLibrarySendSheet } from '@/lib/useLibrarySendSheet';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

const GRID_COLUMNS = 2;
const LOADING_TILE_COUNT = 6;

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

interface LoadedLibraryRows {
  readonly rows: readonly ScheduledMealRow[];
  /**
   * Kept alongside `rows` rather than discarded once scheduling is
   * resolved — LIB-04's `nog_nooit_gekookt` sort needs the raw events, not
   * `ScheduledMealRow.scheduling.state`, per librarySort.ts's own header
   * (that module stays domain-pure and never imports the components-layer
   * `RecipeSchedulingInfo` type this screen already has on hand). No extra
   * repository call: `loadRows` already fetched this for scheduling.
   */
  readonly cookEvents: readonly CookEvent[];
}

async function loadRows(householdId: HouseholdId): Promise<LoadedLibraryRows> {
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
  return { rows: sortMealsByScheduling(ownMeals, saves, cookEvents), cookEvents };
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
  // See `LoadedLibraryRows`'s own comment above — kept only for LIB-04's sort.
  const [cookEvents, setCookEvents] = useState<readonly CookEvent[]>([]);

  // LIB-01/LIB-03. `rows` above stays the full, repository-fetched set —
  // see this file's header for why filtering never touches it and instead
  // derives a view. `availableDishTags`/`availableDishMoods` are computed
  // from the FULL set, not `visibleRows`, so a chip a household has
  // already selected never disappears out from under them just because
  // their current query also narrowed the pool to nothing that carries it.
  const [search, setSearch] = useState<LibrarySearchState>(NO_LIBRARY_SEARCH);
  // LIB-04. A standing choice independent of `search` — see
  // LibrarySearchBar.tsx's header on why it is not a `LibrarySearchState`
  // field, and librarySort.ts's header on why "deze week first" (the order
  // `rows` already arrives in) only survives while this stays `default`.
  const [sort, setSort] = useState<LibrarySortOption>(DEFAULT_LIBRARY_SORT);
  const availableDishTags = useMemo(() => collectAvailableDishTags(rows.map((row) => row.meal)), [rows]);
  const availableDishMoods = useMemo(() => collectAvailableDishMoods(rows.map((row) => row.meal)), [rows]);
  // Filter first, then sort — narrowing the pool never depends on its
  // eventual order, and this composition is what keeps "filtering never
  // reorders survivors" (this file's header) true of the FILTER step
  // specifically, while the sort step is exactly the one place that is
  // allowed to reorder, and only when the household asked for it.
  const filteredRows = useMemo(() => filterLibraryRows(rows, search), [rows, search]);
  const visibleRows = useMemo(
    () => sortLibraryRows(filteredRows, sort, cookEvents),
    [filteredRows, sort, cookEvents],
  );

  const [actionSheetMeal, setActionSheetMeal] = useState<Meal | null>(null);
  const [exclusion, dispatchExclusion] = useReducer(reduceCookProofExclusion, INITIAL_COOK_PROOF_EXCLUSION);
  /**
   * The dish whose exclusion the reducer currently describes. Every async
   * resolution below checks it before dispatching, because closing the
   * sheet and long-pressing a different tile is one flick apart: without
   * this, a slow read for the dish you just closed lands on the dish you
   * just opened and tells you it is withheld when it is not. A `cancelled`
   * boolean per call would cover the close but not the switch.
   */
  const exclusionMealRef = useRef<MealId | null>(null);

  // LIB-04 — "Verwijderen". Same shape as `exclusion`/`exclusionMealRef`
  // above, for the same reason: `openActionSheet` resets both to a fresh
  // dish's starting state, and `removalMealRef` guards `commitRemoval`'s
  // async resolution against landing on a dish the household has since
  // closed or switched away from.
  const [removal, dispatchRemoval] = useReducer(reduceLibraryRemoval, INITIAL_LIBRARY_REMOVAL);
  const removalMealRef = useRef<MealId | null>(null);

  /**
   * "Deze week" / "Uit de week halen" — the library-side half of planning,
   * which this app shipped without: `createSave` was reachable from the
   * import confirmation screen and nowhere else, so a dish could only ever
   * be planned at the moment it arrived. See librarySchedulingCopy.ts.
   *
   * NO `loadScheduling` BESIDE `loadExclusion`, and the absence is the
   * design. Whether this dish is in the week is already resolved for every
   * tile in the grid by `resolveRecipeSchedulingState` — it is what draws
   * the badge the user just long-pressed — so `openActionSheet` is handed
   * that answer rather than reading it again. A second read would be a
   * second definition of "deze week", which `listPendingSaves`' own doc
   * comment warns against.
   */
  const [scheduling, dispatchScheduling] = useReducer(reduceLibraryScheduling, INITIAL_LIBRARY_SCHEDULING);
  const schedulingMealRef = useRef<MealId | null>(null);


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
        setRows(loaded.rows);
        setCookEvents(loaded.cookEvents);
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

  const openActionSheet = useCallback(
    /**
     * `isPlanned` is passed IN, from the row the user long-pressed, rather
     * than read here — see the `scheduling` reducer above for why the sheet
     * must not answer that question a second time.
     */
    (meal: Meal, isPlanned: boolean): void => {
      exclusionMealRef.current = meal.id;
      setActionSheetMeal(meal);
      loadExclusion(meal.id);
      // LIB-04: a freshly opened sheet always starts at "Verwijderen" idle
      // — see libraryRemovalCopy.ts's header on why there is nothing to
      // read here, unlike the exclusion above.
      removalMealRef.current = meal.id;
      dispatchRemoval({ type: 'reset' });
      schedulingMealRef.current = meal.id;
      dispatchScheduling({ type: 'opened', isPlanned });
    },
    [loadExclusion],
  );

  const closeActionSheet = useCallback((): void => {
    exclusionMealRef.current = null;
    setActionSheetMeal(null);
    removalMealRef.current = null;
    dispatchRemoval({ type: 'reset' });
    schedulingMealRef.current = null;
  }, []);

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
    (meal: Meal) => {
      closeActionSheet();
      router.push(`/recipe-edit/${meal.id}`);
    },
    [closeActionSheet, router],
  );

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
   *   "er is niets veranderd" would be the one wrong thing to say. The
   *   sheet drops back to "we can't read this right now" with a retry.
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

  const handleCookProofRowPress = useCallback((): void => {
    if (actionSheetMeal === null) {
      return;
    }
    // In `unavailable` the row IS the retry — there is no value to toggle
    // yet, and guessing one is exactly what the getter refuses to do.
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
  // Verwijderen (LIB-04) — the third thing the long-press sheet offers, and
  // the only one that removes a dish from the grid rather than changing how
  // it is shared. See libraryRemovalCopy.ts's header for why archiving
  // (never a hard delete) and why a two-button in-place confirm.
  // -------------------------------------------------------------------------

  const handleRequestRemoval = useCallback((): void => {
    dispatchRemoval({ type: 'request-removal' });
  }, []);

  const handleCancelRemoval = useCallback((): void => {
    dispatchRemoval({ type: 'cancel-removal' });
  }, []);

  /**
   * Unlike `commitExclusion`, there is no re-read after the write and no
   * rollback on the row: `archiveMeal` either lands or throws, and a
   * confirmed removal has nowhere to roll back TO — the sheet closes and
   * the tile leaves the grid the moment the write succeeds. On failure the
   * sheet stays open and the row itself becomes the retry (`failed` phase),
   * matching `describeLibraryRemovalRow`'s contract.
   */
  const commitRemoval = useCallback(async (meal: Meal): Promise<void> => {
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
    // The tile leaves the grid immediately — an archived meal would be
    // filtered out by the next `listHouseholdMeals` read regardless (this
    // file's header: `archivedAt === null`), so updating `rows` locally
    // rather than a full `refresh()` is the cheaper way to the same result,
    // and it avoids a loading flash over a grid that mostly did not change.
    setRows((current) => current.filter((row) => row.meal.id !== meal.id));
    closeActionSheet();
    AccessibilityInfo.announceForAccessibility(describeLibraryRemovedAnnouncement(meal.title));
  }, [closeActionSheet]);

  const handleConfirmRemoval = useCallback((): void => {
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
   * confirmation (librarySchedulingCopy.ts). Closing would take that
   * feedback away at the moment it is earned.
   *
   * IT REFRESHES RATHER THAN PATCHING `rows` LOCALLY, which is the opposite
   * of what removal does and for a reason worth stating: a save changes the
   * SCHEDULING of a meal, and `resolveRecipeSchedulingState` computes that
   * from saves and cook events together, then `sortMealsByScheduling`
   * reorders the grid around it. Reproducing that here would be a second
   * implementation of the ordering rule; removal only had to drop a row,
   * which is genuinely local.
   *
   * `memberId: null` — the same value the import confirmation screen
   * writes. A save belongs to the household, and nothing in this app asks
   * which member planned a dish.
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
        isPlanned ? describeLibraryUnscheduledAnnouncement(meal.title) : describeLibraryScheduledAnnouncement(meal.title),
      );
      refresh();
    },
    [refresh],
  );

  const handleSchedulingRowPress = useCallback((): void => {
    if (actionSheetMeal === null || scheduling.phase === 'pending') {
      return;
    }
    void commitScheduling(actionSheetMeal, scheduling.isPlanned);
  }, [actionSheetMeal, scheduling, commitScheduling]);

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
    onBeforeOpen: useCallback((): void => {
      exclusionMealRef.current = null;
      setActionSheetMeal(null);
    }, []),
  });

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
          availableDishTags={availableDishTags}
          availableDishMoods={availableDishMoods}
          onChange={setSearch}
          sort={sort}
          onChangeSort={setSort}
        />
      ) : null}

      {phase === 'ready' && rows.length > 0 && visibleRows.length === 0 ? (
        <LibrarySearchEmptyState copy={describeLibrarySearchEmpty(search)} onClear={() => setSearch(NO_LIBRARY_SEARCH)} />
      ) : null}

      {phase === 'ready' && visibleRows.length > 0 ? (
        <FlatList
          data={visibleRows}
          keyExtractor={(row: ScheduledMealRow) => row.meal.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }: { item: ScheduledMealRow }) => (
            <RecipeTile
              meal={item.meal}
              scheduling={item.scheduling}
              onLongPress={() => openActionSheet(item.meal, item.scheduling.state === 'deze_week')}
            />
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
          cookProofExclusion={exclusion}
          onPressCookProofRow={handleCookProofRowPress}
          onSturen={() => send.open(actionSheetMeal)}
          onAanpassen={() => openRecipeEdit(actionSheetMeal)}
          scheduling={scheduling}
          onPressSchedulingRow={handleSchedulingRowPress}
          removal={removal}
          onRequestRemoval={handleRequestRemoval}
          onCancelRemoval={handleCancelRemoval}
          onConfirmRemoval={handleConfirmRemoval}
          onDismiss={closeActionSheet}
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

/** Loading state: a grid of flat surfaceSunken tiles, no shimmer — docs/DESIGN.md §2. */
function LoadingGrid(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const placeholders = Array.from({ length: LOADING_TILE_COUNT }, (_, index) => index);

  return (
    <View style={styles.loadingGrid} accessibilityLabel="Recepten laden" accessible>
      {placeholders.map((index) => (
        <View key={index} style={[styles.loadingTile, { backgroundColor: colors.surfaceSunken }]} />
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
    gap: spacing.space3,
  },
  gridRow: {
    gap: spacing.space3,
  },
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.space3,
  },
  loadingTile: {
    width: '47%',
    aspectRatio: 9 / 16,
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

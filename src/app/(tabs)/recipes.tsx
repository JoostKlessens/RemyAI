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
 * pasting a link is the ONLY way this library grows, since the old
 * "type 10-15 meals" onboarding is gone, and it is the one control this
 * screen's header carries. The household settings screen
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
 * must never reach `openSendSheet`.
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
import { collectAcceptedFriendIds } from '@/domain/social/friendship';
import type { ProfileId } from '@/domain/social/types';
import type { CookEvent, HouseholdId, Meal, MealId } from '@/domain/types';
import { Button } from '@/components/Button';
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
import {
  INITIAL_SEND_SHEET,
  SEND_FAILED_ANNOUNCEMENT,
  describeSendAnnouncement,
  reduceSendSheet,
  type SendFriendIdentity,
} from '@/components/sendRecipeSheetCopy';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSession } from '@/hooks/useSession';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

const GRID_COLUMNS = 2;
const LOADING_TILE_COUNT = 6;

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

/**
 * The friends a dish could go to: every mutually accepted friend, named.
 *
 * NO PRE-FLIGHT PERMISSION CHECK HERE OR ANYWHERE BELOW IT. `recipe_shares`
 * carries a three-clause insert policy — the sender is you, the recipient
 * is a friend, the meal is your household's — and RLS enforces every one
 * on the write. A client-side copy of a permission rule is the copy that
 * drifts, and the supabase implementation says so about the same three
 * clauses. This read answers "who do I know", never "who may I write to";
 * a refusal surfaces as a failed send, on the row that asked for it.
 *
 * AND NO COOK CHECK. PD-016: anything in the library may be sent. There is
 * no cook event in this function's inputs and none belongs there.
 *
 * A friend whose profile row fails to load is dropped rather than listed
 * nameless — a blank name beside a `Stuur` action is a tap nobody should
 * be invited to take.
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

  const [sendSheetMeal, setSendSheetMeal] = useState<Meal | null>(null);
  const [sendState, dispatchSend] = useReducer(reduceSendSheet, INITIAL_SEND_SHEET);
  /**
   * Raw as typed, and cleared per dish rather than kept between them. A
   * note is written about one meal for one person; carrying it to the next
   * long-press would attach words somebody chose for a traybake to a
   * curry, without them ever seeing it happen.
   */
  const [sendNote, setSendNote] = useState('');
  /** The dish the send sheet is about, for `exclusionMealRef`'s reason: a slow read must not land on the next dish. */
  const sendMealRef = useRef<MealId | null>(null);

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
    (meal: Meal): void => {
      exclusionMealRef.current = meal.id;
      setActionSheetMeal(meal);
      loadExclusion(meal.id);
      // LIB-04: a freshly opened sheet always starts at "Verwijderen" idle
      // — see libraryRemovalCopy.ts's header on why there is nothing to
      // read here, unlike the exclusion above.
      removalMealRef.current = meal.id;
      dispatchRemoval({ type: 'reset' });
    },
    [loadExclusion],
  );

  const closeActionSheet = useCallback((): void => {
    exclusionMealRef.current = null;
    setActionSheetMeal(null);
    removalMealRef.current = null;
    dispatchRemoval({ type: 'reset' });
  }, []);

  /**
   * RCP-03 — "Aanpassen" on the long-press sheet.
   *
   * CLOSES THE SHEET FIRST, then navigates. The sheet is a modal over this
   * screen; pushing a full-screen route out from under an open one leaves
   * it mounted behind the editor and standing there on the way back, which
   * is the same reason `openSendSheet` closes this sheet before opening
   * its own.
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

  // -------------------------------------------------------------------------
  // Sturen (DESIGN-SOCIAL.md §3.1 / §4.1) — the second thing the long-press
  // sheet offers, and the only one that writes to the social seam.
  // -------------------------------------------------------------------------

  const loadFriends = useCallback((mealId: MealId, profileId: string | null): void => {
    dispatchSend({ type: 'load-started' });
    // Not a signed-out branch — PD-012 means the root layout answers that
    // before this tab ever renders, so a null id here only means the
    // identity has not resolved yet. Reading without one would ask the
    // database a question with no `auth.uid()` behind it; the sheet stays
    // on its loading line instead, which is the truthful state.
    if (profileId === null) {
      return;
    }
    loadSendFriends(profileId)
      .then((friends: readonly SendFriendIdentity[]) => {
        if (sendMealRef.current === mealId) {
          dispatchSend({ type: 'load-succeeded', friends });
        }
      })
      .catch(() => {
        if (sendMealRef.current === mealId) {
          dispatchSend({ type: 'load-failed' });
        }
      });
  }, []);

  const openSendSheet = useCallback(
    (meal: Meal): void => {
      // The action sheet closes as this one opens. Two stacked modals over
      // one dish means two scrims and a back gesture whose meaning depends
      // on which one is on top.
      exclusionMealRef.current = null;
      setActionSheetMeal(null);
      sendMealRef.current = meal.id;
      setSendNote('');
      setSendSheetMeal(meal);
      loadFriends(meal.id, userId);
    },
    [loadFriends, userId],
  );

  const closeSendSheet = useCallback((): void => {
    sendMealRef.current = null;
    setSendSheetMeal(null);
  }, []);

  const retryFriends = useCallback((): void => {
    if (sendSheetMeal === null) {
      return;
    }
    loadFriends(sendSheetMeal.id, userId);
  }, [sendSheetMeal, loadFriends, userId]);

  /**
   * One send, one row. Optimistic in the same shape the exclusion write
   * is: the row goes into flight immediately, and one of two things
   * follows — the write lands and the row commits, or it fails and the row
   * says so with nothing pretending to have been sent.
   *
   * THERE IS NO RE-READ AFTER THE WRITE, unlike `commitExclusion` above.
   * That one re-reads because `getMealCookProofExclusion` refuses to
   * invent a fail-open answer and the returned row cannot be trusted for
   * it. Here `sendRecipe` returns the `RecipeShare` it just upserted, and
   * there is no second question to ask: a send either exists or the write
   * threw. Asking again would also be the first step toward a sender-side
   * list of what you have sent whom, which §3.5 has not asked for.
   *
   * The note goes in RAW. `normalizeSendNote` trims it, turns
   * whitespace-only into null, and REJECTS an over-long one rather than
   * cutting it short — one implementation of that rule, at the write. The
   * sheet has already disabled every row while the note is too long, so
   * this path is reached with a note the repository will accept; if that
   * ever stops being true, the throw lands on the row that asked for it.
   */
  const commitSend = useCallback(
    async (
      mealId: MealId,
      senderProfileId: ProfileId,
      recipient: SendFriendIdentity,
      note: string,
    ): Promise<void> => {
      const recipientProfileId = recipient.profileId;
      dispatchSend({ type: 'send-started', recipientProfileId });

      try {
        await createSupabaseSocialRepository(supabase).sendRecipe({
          mealId,
          senderProfileId,
          recipientProfileId,
          note,
        });
      } catch {
        if (sendMealRef.current === mealId) {
          dispatchSend({ type: 'send-failed', recipientProfileId });
          AccessibilityInfo.announceForAccessibility(SEND_FAILED_ANNOUNCEMENT);
        }
        return;
      }

      if (sendMealRef.current === mealId) {
        dispatchSend({ type: 'send-succeeded', recipientProfileId });
        // The sheet stays open and the accent stroke is silent, so this is
        // the whole confirmation for anyone who cannot see it. Word for
        // word identical on a re-send: `sendRecipe` upserts on (meal,
        // recipient), moves no `sentAt` and resets no seen state, so there
        // is no second delivery to announce.
        AccessibilityInfo.announceForAccessibility(describeSendAnnouncement(recipient.displayName));
      }
    },
    [],
  );

  const handleSendRow = useCallback(
    (recipientProfileId: ProfileId): void => {
      if (sendSheetMeal === null || userId === null) {
        return;
      }
      const recipient = sendState.friends.find((friend) => friend.profileId === recipientProfileId);
      // `idle` or `failed` only — the reducer would ignore anything else,
      // and a write fired against an ignored transition is a request
      // nothing on screen would ever account for.
      if (recipient === undefined || (recipient.status !== 'idle' && recipient.status !== 'failed')) {
        return;
      }
      void commitSend(sendSheetMeal.id, userId, recipient, sendNote);
    },
    [sendSheetMeal, sendState, userId, sendNote, commitSend],
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <LibraryHeader
        onPasteLink={() => router.push('/import/paste')}
        onOpenSettings={() => router.push('/settings')}
        onOpenShoppingList={() => router.push('/boodschappen')}
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

      {phase === 'ready' && rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>Nog geen recepten</Text>
          <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
            Plak een link naar een TikTok- of Instagram-video om te beginnen.
          </Text>
          <View style={styles.emptyAction}>
            <Button
              label="Plak je eerste link"
              variant="primary"
              onPress={() => router.push('/import/paste')}
              accessibilityLabel="Plak je eerste link, importeer een recept"
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
            <RecipeTile meal={item.meal} scheduling={item.scheduling} onLongPress={() => openActionSheet(item.meal)} />
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
          onSturen={() => openSendSheet(actionSheetMeal)}
          onAanpassen={() => openRecipeEdit(actionSheetMeal)}
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
          action sheet — `openSendSheet` closes that one first. */}
      {sendSheetMeal !== null ? (
        <SendRecipeSheet
          visible
          dishTitle={sendSheetMeal.title}
          friends={sendState}
          note={sendNote}
          onChangeNote={setSendNote}
          onSend={handleSendRow}
          onRetryFriends={retryFriends}
          onDismiss={closeSendSheet}
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

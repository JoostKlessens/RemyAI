/**
 * Ontdek — one tab, two surfaces (PD-024, docs/ONTDEK-PLAN.md fase 2).
 *
 * ⚠ THE ROUTE SEGMENT IS STILL `ranglijst`, AND THAT IS DELIBERATE. Only
 * the LABEL became Ontdek. (tabs)/_layout.tsx carries the reason: a route
 * segment is not user-facing, and renaming one is how deep links and
 * history entries break. A reader looking for "the Ontdek screen" is
 * looking at it.
 *
 * ===========================================================================
 * WHAT WAS MERGED, AND WHY IT COULD NOT BE MERGED BY MERGING
 * ===========================================================================
 *
 * This screen is `(tabs)/friends.tsx` (907 lines) and this file's own
 * previous self (934) — 1841 lines against an 800-line ceiling. So fase 2
 * was never an append; it was a DECOMPOSITION, and this file is what was
 * left after it:
 *
 * - the decisions went to `src/components/ontdekPresentation.ts`, because
 *   vitest runs node-only with react-native stubbed and can import no route
 *   module in this repo — a ternary in here is a ternary no test can reach;
 * - the Dutch went to `src/components/ontdekCopy.ts`;
 * - the two bodies and their eight empty/loading/error states went to
 *   `src/components/OntdekBodies.tsx`;
 * - the two reads were already in `src/lib/gekooktSource.ts` and
 *   `src/lib/trendingSource.ts` and stayed there, separate.
 *
 * What remains here is state, four effects, and a render.
 *
 * ===========================================================================
 * THE HARD BOUNDARY, ON THE SURFACE THAT MAKES IT EASY TO BREAK
 * ===========================================================================
 *
 * PD-024: "nothing from the feed may touch explore's ordering, and explore
 * may never backfill the feed." Until fase 2 the two lists lived on two
 * tabs and could not meet. They are now two pages of one screen, and this
 * file is where "the feed is thin today, drop in a few global rows" would
 * be written.
 *
 * It is held in three places, none of which is a comment:
 *
 * 1. **Two states, never one.** `feed` and `explore` are separate objects
 *    with separate statuses, separate messages and separate loaders. There
 *    is no combined state to accidentally spread.
 * 2. **Two loaders, never one.** `loadLiveTrending()` takes NO ARGUMENTS —
 *    explore is never told who is reading, so PD-014's sixth condition
 *    ("no personalisation, ever") cannot be broken by accident here.
 * 3. **`assertFeedCards` at the seam**, because the compiler alone is not
 *    enough: `isProofCard` narrows on `'recipeId' in card`, and a
 *    `BoardRowModel` HAS a `recipeId`, so a board row cast into the feed
 *    would render as a proof card and look entirely ordinary doing it.
 *
 * ===========================================================================
 * WHAT MOVED, AND WHAT WAS PAID FOR IT
 * ===========================================================================
 *
 * ⚠ **DE KRING IS GONE AS A LIST.** Trending's `Vrienden` scope ranked
 * recipes by friends' votes (PD-018). The friend evidence moved to the feed,
 * where it is a grade on a proof card — and ONTDEK-PLAN.md's valkuil 7
 * names the price exactly: `rankKring` loses its ORDERING role. The average
 * and the named voters survive in the consent-gated read
 * (`listNamableRecipeVotes`, now in gekooktSource.ts); the order does not.
 * Nothing on the feed sorts by score.
 *
 * ⚠ **THE TAB LABEL NO LONGER COUNTS ANYTHING** (O-1b). It read
 * `Vrienden · 2` over a list that rendered no send cards at all. The count
 * is now one line at the top of this screen, over EVERY kind of post —
 * follow requests and unseen sends together, one sentence, one destination,
 * no coloured badge. `formatWaitingPost` writes it and
 * `resolveWaitingPostDestination` decides whether it is tappable.
 *
 * ⚠ **THE SURFACE YOU LAND ON CHANGED.** Trending opened on `Iedereen`;
 * Ontdek opens on the feed. `DEFAULT_ONTDEK_SURFACE` is the one constant
 * that says so, and ontdekPresentation.ts carries the argument.
 *
 * WHAT THIS SCREEN STILL REFUSES, carried over from both headers because
 * this is now the one file somebody would add it to: no pagination, no
 * `onEndReached`, no pull-for-more, no timestamp in any view model, no
 * "nieuw" badge, no sort by recency, and no fifth body that pads one
 * surface from the other.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ADD_FRIEND_ROUTE } from '@/components/addFriendCopy';
import { FilterTrigger } from '@/components/FilterTrigger';
import { PendingRequestsLine, SuggestionSection } from '@/components/FriendSuggestionRows';
import { SUGGESTION_FAILED, SUGGESTION_SENT_LABEL } from '@/components/friendSuggestionCopy';
import { isProofCard } from '@/components/gekooktPresentation';
import { OntdekExploreBody, OntdekFeedBody } from '@/components/OntdekBodies';
import {
  ONTDEK_DEV_ROW_LABEL,
  ONTDEK_DEV_SCENARIO_LABEL,
  ONTDEK_SURFACE_LABEL,
  ONTDEK_TITLE,
  describeDevScenario,
  describeSurfaceSwitchOption,
  formatWaitingPost,
} from '@/components/ontdekCopy';
import {
  DEFAULT_ONTDEK_SURFACE,
  ONTDEK_SCENARIOS,
  ONTDEK_SURFACES,
  assertFeedCards,
  resolveBoardScenario,
  resolveFeedScenario,
  resolvePageForSurface,
  resolveSurfaceForPage,
  resolveWaitingPostDestination,
  type OntdekScenario,
  type OntdekStatus,
  type OntdekSurface,
} from '@/components/ontdekPresentation';
import { TrendingFilterBar } from '@/components/TrendingFilterBar';
import {
  NO_TRENDING_FILTER,
  collectSelectableBoardDishTags,
  countTrendingFilters,
  describeTrendingFilters,
  filterBoardRows,
  type TrendingFilterState,
} from '@/components/trendingFilter';
import type { FriendSuggestion } from '@/domain/social/friendSuggestions';
import type { ProfileId } from '@/domain/social/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useSession } from '@/hooks/useSession';
import { DEV_SCENARIO_ROWS_VISIBLE } from '@/lib/devFlags';
import {
  countIncomingFollowRequestsForProfile,
  loadFriendSuggestions,
  requestFriendship,
} from '@/lib/friendSuggestionSource';
import {
  NO_FRIENDS_DATA,
  loadFixtureFriends,
  loadLiveFriends,
  markVisitSeen,
  type FriendsData,
} from '@/lib/gekooktSource';
import { hapticCompleted } from '@/lib/haptics';
import { NO_TRENDING_DATA, loadFixtureTrending, loadLiveTrending, type TrendingData } from '@/lib/trendingSource';
import { getColors, spacing, typeScale, type ColorTokens } from '@/theme/tokens';

/**
 * ⚠ TWO STATES AND NOT ONE, and this is the first of the three places the
 * boundary is held. A combined `{ cards, boardRows, status }` would make
 * "spread one into the other" a plausible typo; two objects with two
 * statuses make it a deliberate act.
 *
 * Both keep their rows through an error, so a refresh that fails does not
 * blank a list the reader was already looking at, and both keep the
 * repository's own message rather than flattening it to a generic string:
 * the Postgres code in it is what tells an RLS refusal apart from a network
 * failure.
 */
interface FeedState extends FriendsData {
  readonly status: OntdekStatus;
  readonly message: string | null;
}

interface ExploreState extends TrendingData {
  readonly status: OntdekStatus;
  readonly message: string | null;
}

const INITIAL_FEED: FeedState = { ...NO_FRIENDS_DATA, status: 'loading', message: null };
const INITIAL_EXPLORE: ExploreState = { ...NO_TRENDING_DATA, status: 'loading', message: null };

export default function OntdekScreen(): JSX.Element {
  const router = useRouter();
  const colors = getColors(useColorScheme());
  // docs/DESIGN.md "Global rules": read once per screen, pass it down.
  const reduceMotionEnabled = useReduceMotion();
  /** `profiles.id` IS `auth.users.id`, so the session's user id is the profile id the feed narrows on. */
  const { userId } = useSession();

  const [surface, setSurface] = useState<OntdekSurface>(DEFAULT_ONTDEK_SURFACE);
  const [scenario, setScenario] = useState<OntdekScenario>('live');
  const [feed, setFeed] = useState<FeedState>(INITIAL_FEED);
  const [explore, setExplore] = useState<ExploreState>(INITIAL_EXPLORE);

  /**
   * The reader's own narrowing, and it survives nothing: a `useState` whose
   * initializer reads nothing, so every mount starts at
   * `NO_TRENDING_FILTER`. The same rule (tabs)/index.tsx applies to
   * `DecisionFilters` — a narrowing that followed a household into tomorrow
   * would be a taste profile with extra steps, which is the thing PD-014's
   * sixth condition forbids.
   *
   * ⚠ IT IS EXPLORE'S ALONE. The feed is not filtered and has no filter to
   * clear; a drawer that acted on both surfaces would be a control whose
   * meaning changed under a swipe.
   */
  const [filter, setFilter] = useState<TrendingFilterState>(NO_TRENDING_FILTER);
  const [isFilterOpen, setFilterOpen] = useState(false);

  /**
   * The people half, held apart from both lists on purpose.
   *
   * TWO READS THAT MUST BE ABLE TO FAIL SEPARATELY. A failed suggestion read
   * must not blank a feed that loaded, and a failed feed read must not hide
   * the suggestions that tell a new person what to do next — which is the
   * exact case where suggestions matter most, because `loadLiveFriends`
   * returns early with nothing when you follow nobody.
   */
  const [suggestions, setSuggestions] = useState<readonly FriendSuggestion[]>([]);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);
  const [requestedProfileIds, setRequestedProfileIds] = useState<ReadonlySet<ProfileId>>(new Set());
  const requestedRef = useRef<ReadonlySet<ProfileId>>(new Set());

  /**
   * PD-020.2's closed-loop haptic, for the moment you learn somebody cooked
   * the thing you sent them.
   *
   * ON THE SCREEN, NOT ON THE CARD. "Once, when you arrive and it is true"
   * is a property of the visit, and a card cannot know whether it is the
   * first closed loop in the list or the third — a card-level haptic would
   * buzz once per closed loop, turning a greeting into a rattle.
   *
   * NOT GATED ON REDUCED MOTION: a haptic is feedback, not motion.
   */
  const hasBuzzedForClosedLoop = useRef(false);
  useEffect(() => {
    if (hasBuzzedForClosedLoop.current || feed.status !== 'ready') {
      return;
    }
    if (!feed.cards.some((card) => isProofCard(card) && card.closedLoop)) {
      return;
    }
    hasBuzzedForClosedLoop.current = true;
    hapticCompleted();
  }, [feed.status, feed.cards]);

  /** The feed's own read. Separate from explore's, and it is the only one that is told an identity. */
  const loadFeed = useCallback(
    async (next: OntdekScenario, profileId: string | null, isCurrent: () => boolean): Promise<void> => {
      const fixture = resolveFeedScenario(next);
      if (fixture !== null) {
        setFeed({ ...loadFixtureFriends(fixture), status: 'ready', message: null });
        return;
      }

      setFeed((previous) => ({ ...previous, status: 'loading', message: null }));
      // Not a signed-out branch — PD-012 means the root layout answers that
      // before this tab renders. A null id means the identity has not
      // resolved yet, and reading without one would ask the database a
      // question with no `auth.uid()` behind it.
      if (profileId === null) {
        return;
      }

      try {
        const data = await loadLiveFriends(profileId);
        if (isCurrent()) {
          setFeed({ ...data, status: 'ready', message: null });
          // After the state lands, so the band the reader came to see is
          // already on screen when its rows stop being unseen. Not awaited:
          // nothing below depends on the stamp.
          //
          // ⚠ AND ONLY WHEN THE SEND HALF WAS ACTUALLY DRAWN. `sendsShown`
          // is false when `readExcludedTags` failed and the send cards were
          // withheld rather than rendered unlabelled; stamping then would
          // record "seen" against cards nobody was shown, permanently and
          // with no way back. See `FriendsData.sendsShown`.
          if (data.sendsShown) {
            void markVisitSeen(profileId);
          }
        }
      } catch (error: unknown) {
        if (isCurrent()) {
          setFeed((previous) => ({
            ...previous,
            status: 'error',
            message: error instanceof Error ? error.message : null,
          }));
        }
      }
    },
    [],
  );

  /**
   * Explore's own read.
   *
   * ⚠ IT IS NEVER HANDED `userId`, AND THAT IS THE SECOND PLACE THE
   * BOUNDARY IS HELD. `loadLiveTrending()` takes no arguments at all — see
   * trendingSource.ts. Passing an identity in here is the change a reviewer
   * should refuse.
   */
  const loadExplore = useCallback(async (next: OntdekScenario, isCurrent: () => boolean): Promise<void> => {
    const fixture = resolveBoardScenario(next);
    if (fixture !== null) {
      setExplore({ ...loadFixtureTrending(fixture), status: 'ready', message: null });
      return;
    }

    setExplore((previous) => ({ ...previous, status: 'loading', message: null }));
    try {
      const data = await loadLiveTrending();
      if (isCurrent()) {
        setExplore({ ...data, status: 'ready', message: null });
      }
    } catch (error: unknown) {
      if (isCurrent()) {
        setExplore((previous) => ({
          ...previous,
          status: 'error',
          message: error instanceof Error ? error.message : null,
        }));
      }
    }
  }, []);

  useEffect(() => {
    // Guarded against a scenario change landing while an older read is still
    // in flight: without it, a slow live response overwrites a fixture the
    // developer switched to afterwards.
    let active = true;
    void loadFeed(scenario, userId, () => active);
    return () => {
      active = false;
    };
  }, [scenario, userId, loadFeed]);

  useEffect(() => {
    let active = true;
    void loadExplore(scenario, () => active);
    return () => {
      active = false;
    };
  }, [scenario, loadExplore]);

  /**
   * The people read, and the two facts it produces.
   *
   * IT RUNS FOR THE LIVE SOURCE ONLY. The `__DEV__` scenarios are fixtures
   * for the two LISTS; there is no suggestion fixture, and inventing one
   * would put three fictional strangers under a designer's demo list with
   * real `Toevoegen` buttons behind them.
   *
   * (!) A FAILURE HERE IS SWALLOWED WITHOUT A MESSAGE, and it is not the
   * same swallow `markVisitSeen` performs. Until 0019 is pushed this call
   * fails on every device with `PGRST202` — function not found — and a
   * screen that shouted about it would report a deployment fact as a user
   * error, on a block the reader did not ask for, under a list that loaded.
   */
  const loadPeople = useCallback(
    async (next: OntdekScenario, profileId: string | null, isCurrent: () => boolean): Promise<void> => {
      if (next !== 'live' || profileId === null) {
        return;
      }
      try {
        const [rows, waiting] = await Promise.all([
          loadFriendSuggestions(requestedRef.current),
          countIncomingFollowRequestsForProfile(profileId),
        ]);
        if (isCurrent()) {
          setSuggestions(rows);
          setPendingRequestCount(waiting);
        }
      } catch {
        // See above. No message, and the previous rows are left standing.
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void loadPeople(scenario, userId, () => active);
    return () => {
      active = false;
    };
  }, [scenario, userId, loadPeople]);

  /**
   * Ask one suggested person, optimistically.
   *
   * THE ROW IS MARKED BEFORE THE WRITE AND UNMARKED IF IT FAILS. A
   * `Toevoegen` that stays live for the length of a round trip is one that
   * gets tapped twice, and the second tap hits the unique pair constraint —
   * which would then report a failure for a request that actually went out.
   *
   * `requestedRef` IS UPDATED SYNCHRONOUSLY beside the state, because the
   * reload at the end reads it and a state setter has not landed by then.
   */
  const addSuggestedFriend = useCallback(
    async (profileId: ProfileId): Promise<void> => {
      if (userId === null || requestedRef.current.has(profileId)) {
        return;
      }
      const marked = new Set(requestedRef.current).add(profileId);
      requestedRef.current = marked;
      setRequestedProfileIds(marked);
      setSuggestionMessage(null);

      try {
        await requestFriendship(userId, profileId);
        AccessibilityInfo.announceForAccessibility(SUGGESTION_SENT_LABEL);
        void loadPeople('live', userId, () => true);
      } catch {
        const rolledBack = new Set(requestedRef.current);
        rolledBack.delete(profileId);
        requestedRef.current = rolledBack;
        setRequestedProfileIds(rolledBack);
        setSuggestionMessage(SUGGESTION_FAILED);
        AccessibilityInfo.announceForAccessibility(SUGGESTION_FAILED);
      }
    },
    [userId, loadPeople],
  );

  /**
   * O-1b's one line.
   *
   * ⚠ THE SEND COUNT COMES FROM THE BAND AND NOT FROM `useUnseenSendCount`,
   * and the difference is the whole reason this line is trustworthy.
   * `unseenBandSize` is computed at LOAD, against the snapshot
   * `listSendsToMe` returned, so it describes the VISIT — and it survives
   * the `markSendsSeen` that fires immediately afterwards. The hook would
   * drop to zero the moment this screen opened, so the line would appear and
   * vanish in the same breath. It is also the count that cannot drift from
   * the cards, because it IS the cards: exactly the drift O-1b was
   * answering, where the tab said `Vrienden · 2` over an empty list.
   */
  const waitingPost = { followRequests: pendingRequestCount, unseenSends: feed.unseenBandSize };
  const waitingLine = formatWaitingPost(waitingPost);
  const waitingDestination = resolveWaitingPostDestination(waitingPost);

  // Both derived from the SAME unfiltered board, and the asymmetry between
  // them is the narrowing rule: the cards are the board with the filter
  // applied, while the chips come from `collectSelectableBoardDishTags`,
  // which applies the filter itself and then unions the selection back in —
  // so a chip that narrowed the list to one card is still on screen to undo
  // it. LIB-07's rule; src/components/trendingFilter.ts carries the argument.
  const visibleBoardRows = useMemo(() => filterBoardRows(explore.boardRows, filter), [explore.boardRows, filter]);
  const selectableDishTags = useMemo(
    () => collectSelectableBoardDishTags(explore.boardRows, filter),
    [explore.boardRows, filter],
  );

  /**
   * The pager, and the two-way binding between it and `surface`.
   *
   * `pageWidth` IS MEASURED RATHER THAN TAKEN FROM `Dimensions`. A tab
   * screen is not always the window: a split view on iPad, a rotation
   * mid-gesture and the safe-area insets all make the window width the wrong
   * number, and a pager whose page is wider than its viewport tears halfway
   * between two surfaces with no way back.
   */
  const pagerRef = useRef<ScrollView | null>(null);
  const [pageWidth, setPageWidth] = useState(0);

  const handlePagerLayout = useCallback((event: LayoutChangeEvent): void => {
    setPageWidth(event.nativeEvent.layout.width);
  }, []);

  /**
   * The swipe telling the switch what happened. `onMomentumScrollEnd` and
   * not `onScroll`: a surface that flipped mid-drag would relabel the words
   * under the finger that is still deciding.
   */
  const handlePagerSettled = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const width = event.nativeEvent.layoutMeasurement.width;
    if (width <= 0) {
      return;
    }
    setSurface(resolveSurfaceForPage(Math.round(event.nativeEvent.contentOffset.x / width)));
  }, []);

  /** The switch telling the pager what to do — the other half of the same binding. Guarded on a measured width. */
  useEffect(() => {
    if (pageWidth <= 0) {
      return;
    }
    pagerRef.current?.scrollTo({ x: resolvePageForSurface(surface) * pageWidth, animated: true });
  }, [surface, pageWidth]);

  /**
   * ONE NODE, RENDERED IN BOTH FEED BODIES. The suggestion block sits under
   * the feed when there is one and under the empty state when there is not,
   * and it is the same element either way — built once here rather than
   * twice down there, because two copies would be two places to forget the
   * search line that is this app's only durable way to `/friends/add`.
   */
  const footer = (
    <SuggestionSection
      suggestions={suggestions}
      colors={colors}
      requestedProfileIds={requestedProfileIds}
      onAdd={(profileId: string) => void addSuggestedFriend(profileId)}
      onSearch={() => router.push(ADD_FRIEND_ROUTE)}
      message={suggestionMessage}
    />
  );

  /**
   * A send opens the SENDER'S OWN MEAL. A fixture send has to say which
   * scenario it came from; a live one does not, because
   * `/friends/[feedItemId]` reads live when it is given no scenario.
   */
  const openSend = (feedItemId: string): void => {
    const fixture = resolveFeedScenario(scenario);
    router.push(fixture === null ? `/friends/${feedItemId}` : `/friends/${feedItemId}?scenario=${fixture}`);
  };

  /**
   * A canonical recipe opens the SAME row for every reader — and since ONT-08
   * both surfaces of this screen use this one handler.
   *
   * ⚠ IT TAKES NO SCENARIO, AND THAT IS THE DIFFERENCE WITH `openSend` ABOVE.
   * A send resolves a feed item that a fixture can invent, so a fixture send
   * must say which scenario it came from. A canonical recipe is a `recipes`
   * row that exists or does not; there is no fixture variant of it, and
   * passing one would invite a demo id into a world-readable route.
   *
   * ONE HANDLER RATHER THAN TWO IDENTICAL ONES. The line was written inline
   * for the feed on 11 September and explore would have been the second copy
   * — the shape in which one of them later gets a `meals` id, under different
   * permissions, and keeps working just long enough not to be noticed.
   */
  const openCanonicalRecipe = (recipeId: string): void => {
    router.push(`/friends/recipe/${recipeId}`);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ && DEV_SCENARIO_ROWS_VISIBLE ? <DevScenarioRow active={scenario} onSelect={setScenario} /> : null}

      {/*
        A NAME, THEN USUALLY NOTHING, THEN THE SWITCH.

        `waitingLine` IS THE ONE EXCEPTION, and it is an exception the reader
        asked for by being asked something. It is null unless post is
        genuinely waiting, so on almost every visit this header is one word
        and two more words.
      */}
      <View style={styles.header}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>{ONTDEK_TITLE}</Text>
        {waitingLine === null ? null : (
          <PendingRequestsLine
            text={waitingLine}
            colors={colors}
            onPress={waitingDestination === null ? null : () => router.push(ADD_FRIEND_ROUTE)}
          />
        )}
        <View style={styles.controlRow}>
          <SurfaceSwitch surface={surface} onChange={setSurface} colors={colors} />
          {/* The glyph IS the button — see FilterTrigger's header. */}
          <FilterTrigger
            activeFilterCount={countTrendingFilters(filter)}
            isExpanded={isFilterOpen}
            onToggle={() => setFilterOpen((wasOpen) => !wasOpen)}
            accessibilityLabel={describeTrendingFilters(countTrendingFilters(filter)).accessibilityLabel}
          />
        </View>
      </View>

      {/* UNMOUNTED WHEN SHUT rather than hidden with a style: a shut drawer
          must cost no height and must give a screen reader nothing to walk
          past. It narrows EXPLORE only — see `filter`. */}
      {isFilterOpen ? (
        <TrendingFilterBar filter={filter} selectableDishTags={selectableDishTags} onChange={setFilter} />
      ) : null}

      {/* TWO PAGES SIDE BY SIDE, so the surfaces can be swiped between.

          A PAGING ScrollView AND NOT A GESTURE HANDLER. The swipe has to BE
          the scroll: a `PanResponder` that jumped at a threshold would move
          in one step where a finger moves continuously, and it would fight
          the vertical FlatList inside each page for the same touch.

          BOTH PAGES STAY MOUNTED. That is the cost and it is worth it: a
          surface that unmounted would lose its scroll position on every
          swipe, which is what makes a pager feel like two tabs rather than
          two pages. Each list is virtualised. */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handlePagerSettled}
        onLayout={handlePagerLayout}
        style={styles.pager}
        directionalLockEnabled
      >
        <View style={[styles.page, { width: pageWidth }]}>
          <OntdekFeedBody
            status={feed.status}
            // ⚠ THE THIRD PLACE THE BOUNDARY IS HELD — see this file's
            // header. The compiler alone would not catch a board row cast
            // into this list, because a board row has a `recipeId` and so
            // does a proof card.
            cards={assertFeedCards(feed.cards)}
            unseenBandSize={feed.unseenBandSize}
            message={feed.message}
            reduceMotionEnabled={reduceMotionEnabled}
            footer={footer}
            onOpenSend={openSend}
            onOpenCanonicalRecipe={openCanonicalRecipe}
          />
        </View>
        <View style={[styles.page, { width: pageWidth }]}>
          <OntdekExploreBody
            status={explore.status}
            boardRows={explore.boardRows}
            visibleRows={visibleBoardRows}
            message={explore.message}
            // ONT-08: the same handler the feed gets, one line above. Both
            // sides of this screen now open a canonical recipe the same way.
            onOpenCanonicalRecipe={openCanonicalRecipe}
            reduceMotionEnabled={reduceMotionEnabled}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SurfaceSwitchProps {
  readonly surface: OntdekSurface;
  readonly onChange: (surface: OntdekSurface) => void;
  readonly colors: ColorTokens;
}

/**
 * Two words, and the current one is the one you can read.
 *
 * IT REPLACED A `SegmentedControl` — a filled, bordered, full-width box —
 * because the owner asked for "subtieler", and because a segmented control
 * is the wrong instrument for this choice. That control is for picking a
 * mode you might not be in; these two words label the page you are already
 * on and the one a swipe away. The switch is a caption on the gesture, not
 * a substitute for it.
 *
 * ⚠ THE WORDS CHANGED WITH THEIR MEANING (O-2c). `Iedereen | Vrienden`
 * named two SCOPES of one question. `Vrienden | Ontdekken` names two
 * SURFACES, and the owner chose it on 11 September 2026.
 *
 * `accessibilityRole="tab"` and `selected`, so a screen reader announces
 * this as the two-page structure it genuinely is.
 */
function SurfaceSwitch(props: SurfaceSwitchProps): JSX.Element {
  const { surface, onChange, colors } = props;

  return (
    <View style={styles.surfaceSwitch} accessibilityRole="tablist">
      {ONTDEK_SURFACES.map((option) => {
        const isActive = option === surface;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={styles.surfaceWord}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={describeSurfaceSwitchOption(option)}
          >
            <Text
              style={[
                // `button` is Archivo SemiBold at the same 16pt as `body`, so
                // the active word gains weight without gaining height — the
                // two words must not shift sideways when the surface changes,
                // or the switch appears to twitch under the thumb.
                isActive ? typeScale.button : typeScale.body,
                { color: isActive ? colors.textPrimary : colors.textMuted },
              ]}
            >
              {ONTDEK_SURFACE_LABEL[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface DevScenarioRowProps {
  readonly active: OntdekScenario;
  readonly onSelect: (scenario: OntdekScenario) => void;
}

/**
 * ONE row that moves BOTH surfaces, and it never renders in a production
 * build. The two merged screens each had their own; two rows above the
 * first photograph would be two bands of scaffolding. See `OntdekScenario`
 * for why these five entries and not the union of both old sets.
 */
function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { active, onSelect } = props;
  const colors = getColors(useColorScheme());

  return (
    <View style={styles.devRow} accessibilityLabel={ONTDEK_DEV_ROW_LABEL}>
      {ONTDEK_SCENARIOS.map((option) => (
        <Pressable
          key={option}
          onPress={() => onSelect(option)}
          style={styles.devButton}
          accessibilityRole="button"
          accessibilityLabel={describeDevScenario(option)}
        >
          <Text style={[typeScale.caption, { color: active === option ? colors.accent : colors.textMuted }]}>
            {ONTDEK_DEV_SCENARIO_LABEL[option]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.screenHeaderTop,
    paddingBottom: spacing.space4,
  },
  controlRow: {
    // The surface words on the left, the funnel hard right. One line where
    // there used to be three bands.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.space3,
  },
  surfaceSwitch: {
    flexDirection: 'row',
    // Wider than the gap inside a word, so the two read as two choices
    // rather than as one phrase.
    gap: spacing.space4,
  },
  surfaceWord: {
    // The 44pt floor on a bare word: the text is 21pt tall, and a tap target
    // the size of its own glyphs is a bug this app has already met once.
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  page: {
    // Width is measured and injected at render — see `pageWidth`.
    flex: 1,
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
    gap: spacing.space3,
  },
  devButton: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
});

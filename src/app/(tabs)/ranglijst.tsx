/**
 * Trending — one question, two scopes (docs/DESIGN.md §9, PD-014). The
 * fourth tab, added in Fase 6.
 *
 * The tab reads `Trending` and the header reads `Trending recipes`. Both
 * are the owner's own words, chosen over the Dutch alternatives after he
 * asked what "Ranglijst" was supposed to mean; they are not a translation
 * oversight. The tab label is the shorter of the two because it shares a
 * monospace caption line with three other words.
 *
 * ===========================================================================
 * THE RANKING BECAME A SCROLL FEED ON 8 SEPTEMBER 2026
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Als ik naar de trending tab ga, kan ik
 * niet op de recepten klikken die ik daar zie, ook hebben ze geen foto, een
 * soort scroll feature zou ik hier liever willen dan een ranking. Ik wil dat
 * je hier gewoon een zelfde soort ervaring krijgt als bij kiezen maar dan dat
 * je naar beneden kan scrollen en er een nieuw recept komt. Bijvoorbeeld
 * zoals instagram met foto's werkt. Ook hier wil ik dat je een filter kan
 * aanzetten."
 *
 * PD-014's amendment of that date is the decision; this file is where it
 * lands. THE SHORT VERSION: the FORM changed and the SUPPLY did not.
 *
 * WHAT THE THREE CONDITIONS BELOW STILL SAY, RE-CHECKED RATHER THAN ASSUMED.
 * They were written against a numbered list, and a reader arriving at a feed
 * would be right to suspect they had quietly stopped holding. They have not:
 *
 * - **Each list is finite and says so.** Unchanged, and it is the condition a
 *   feed most easily loses. Same `LEADERBOARD_MAX_ROWS`, same
 *   `buildLeaderboard`, same `BOARD_END_COPY` at the bottom. No pagination,
 *   no "meer laden", no pull-for-more, and no `onEndReached` anywhere in this
 *   file. A feed that fills itself up is a different decision from a feed
 *   that shows itself, and only the second one was taken.
 * - **Ordered by score, never by recency.** Unchanged. No timestamps, no
 *   "nieuw" badge; `RecipeRating.ratedAt` still reaches no view model. The
 *   filter is an `Array#filter`, so what survives it stands in exactly the
 *   order `rankRecipes` produced.
 * - **The global list is identical for every reader.** Unchanged, and this is
 *   the one the new filter has to answer for. `rankRecipes` still never sees
 *   the household. A filter is a narrowing the READER SETS, sees, and can
 *   clear in one tap — not a model choosing on their behalf — and
 *   src/components/trendingFilter.ts's header makes that argument in full.
 *
 * ⚠ WHAT IS GENUINELY GIVEN UP, recorded here rather than only in the
 * amendment, because this is the file somebody would look in:
 *
 * 1. **The rank number is gone from the surface.** "Wat staat er op 1" is no
 *    longer readable. `BoardRowModel.rank` still carries it and nothing draws
 *    it. It left the spoken label at the same moment, so both readers get the
 *    same card — see `buildBoardRowAccessibilityLabel`.
 * 2. **Twenty-five scannable lines became one card at a time.** Comparing the
 *    top five at a glance was a real thing this screen could do and now
 *    cannot. That is the cost of the picture, and the owner asked for the
 *    picture knowing this screen had none.
 *
 * ⚠ AND THE HALF OF THE OLD DEFENCE THAT NEVER APPLIED HERE, said plainly
 * because it is the sharpest thing to know about this reversal.
 * DESIGN-SOCIAL.md §2.4 defends the friend feed against DESIGN.md's refused
 * "Ontdekken" surface on TWO words: not strangers, and not algorithmic. Its
 * structural argument — "the feed cannot exceed what your friends actually
 * cook" — is about the VRIENDEN TAB. This scope is by definition a list of
 * strangers and always was. So half of that defence never covered this
 * surface and does not now. What covers it is the other half, and it is
 * untouched: nothing here is selected by a model optimising anything, the
 * supply is bounded by arithmetic rather than by editorial restraint, and the
 * order is the same for everybody. That is what makes this reversal smaller
 * than it looks — it changes how a bounded, deterministic, identical list is
 * DRAWN.
 *
 * THIS SCREEN EXISTS OVER A STATED OBJECTION, and PD-014 records the
 * objection rather than dissolving it: DESIGN.md's rule was that "a fourth
 * tab needs a fourth question of that kind, and there isn't one", and the
 * same section refuses an "Ontdekken" surface outright. The owner chose the
 * board with both in view, and has now chosen its form as well. What that
 * buys still has to be paid for here, on the surface itself, which is what
 * the re-checked conditions above are.
 *
 * TWO SCOPES, ONE SEGMENTED CONTROL, NEVER PERSISTED. `Iedereen` |
 * `Vrienden`, defaulting to `Iedereen` on every visit. This is the same
 * control that was once deleted from Vrienden, and the difference is the
 * whole reason it belongs here and did not belong there. On Vrienden the
 * two modes answered DIFFERENT QUESTIONS — what friends cooked, and what
 * friends rated — so half of that tab's purpose sat behind a control most
 * people would never tap. Here the two lists answer the SAME question at
 * two scopes, which is exactly what a scope selector is for: "what is
 * highly rated" — among everyone, or among the people I know. Reading one
 * tells you what the other is for.
 *
 * ⚠ THE TWO SCOPES NOW DRAW DIFFERENT SHAPES, AND THAT IS A KNOWN, RECORDED
 * INCONSISTENCY RATHER THAN AN OVERSIGHT. `Iedereen` is a card feed;
 * `Vrienden` is still `KringRow`'s compact strip with its small thumbnail.
 * The owner's complaint was measured against `Iedereen`, which is the default
 * and the only scope that never had a photo at all. Converting the friends
 * scope needs `dishTags` and `estimatedMinutes` on `KringRecipe`, and the
 * only producer of that type outside this package is
 * `src/fixtures/friendFeedFixtures.ts` — a file this package does not own, so
 * doing it here would have meant either an optional field nobody else fills
 * or an edit across a package boundary that 7 September's lesson was written
 * about. It is the highest-value follow-up on this surface and it is in the
 * report rather than hidden in a diff.
 *
 * WHY NOT TWO STACKED SECTIONS. Because DESIGN-SOCIAL.md §2.2 forbids
 * padding a thin friends list to make it look fuller, and stacking is how
 * that rule dies by accident: a short friends section sitting directly
 * above a full global one reads as a single scroll with a heading in it,
 * invites "just a few more rows to balance it", and gives the tab two end
 * notes it then has to pretend are one. Separate views keep the two lists
 * structurally separate — never merged, never backfilled, never topped up
 * from each other — and a friends list of two rows renders exactly like a
 * friends list of twenty.
 *
 * WHY SWITCHING SCOPE NEVER FETCHES, AND NEITHER DOES A CHIP. Both lists come
 * from one read (`@/lib/trendingSource`), keyed on the source and not on the
 * scope, so tapping a segment is pure and instant. The filter has the same
 * property for the same reason: it runs over rows already in hand. A control
 * that produced a spinner would read as navigation rather than as a view
 * switch. `@/lib/trendingSource`'s header carries why the filter runs AFTER
 * the top-25 cut, which is the arithmetic that keeps those rows in hand.
 *
 * THE ONE THING ON THIS SCREEN THAT LOOKS LIKE A BUG, and now there are
 * two. First: a recipe carrying a "bevat noten" chip still sits wherever
 * its score put it — often first. The friend feed demotes a colliding
 * recipe; this one must not, because demoting is per-household and PD-014's
 * sixth condition is "no personalisation, ever". The ordering stays global;
 * the warning stays personal. Second: the global list can be EMPTY while
 * the friends list is full. `rankRecipes` applies a floor and shrinkage
 * because its voters are strangers; `rankKring` applies neither, because
 * two named friends are evidence where a stranger's single vote is noise.
 * Both are correct at the same time.
 *
 * WHY A COLLISION CHIP WILL NEVER APPEAR ON LIVE DATA, in either scope.
 * `recipes` carries no allergen tags, and that is PD-006 rather than an
 * omission: tagging is something a household does to its own copy on
 * Bevestigen, and an untagged recipe is UNKNOWN, never "safe". So the
 * excluded-tag list this screen passes is empty, and the absence of a chip
 * says nothing about the dish. It must never be styled or read as
 * reassurance.
 *
 * LIVE, WITH FIXTURES BEHIND A DEV SWITCH. In a production build "live" is
 * the only source there is; the scenario row exists only under `__DEV__`,
 * so design work has something to look at while the real tables are still
 * empty. One switch moves both scopes — see `@/lib/trendingSource`.
 */

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOARD_SCENARIOS, type BoardScenario } from '@/fixtures/boardFixtures';
import {
  NO_TRENDING_DATA,
  loadFixtureTrending,
  loadLiveTrending,
  type TrendingData,
} from '@/lib/trendingSource';
import { KringRow } from '@/components/KringRow';
import {
  KRING_EMPTY_BODY,
  KRING_EMPTY_TITLE,
  KRING_END_COPY,
  type KringRowModel,
} from '@/components/kringPresentation';
import { BOARD_EMPTY_COPY, BOARD_END_COPY, type BoardRowModel } from '@/components/leaderboardPresentation';
import { TrendingCard } from '@/components/TrendingCard';
import { TrendingFilterBar } from '@/components/TrendingFilterBar';
import {
  NO_TRENDING_FILTER,
  TRENDING_FILTER_EMPTY_BODY,
  TRENDING_FILTER_EMPTY_TITLE,
  collectSelectableBoardDishTags,
  filterBoardRows,
  type TrendingFilterState,
} from '@/components/trendingFilter';
import { SegmentedControl, type SegmentedControlOption } from '@/components/SegmentedControl';
import { useSession } from '@/hooks/useSession';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { DEV_SCENARIO_ROWS_VISIBLE } from '@/lib/devFlags';

/** The two scopes of one question. Never persisted — see this file's header. */
type TrendingScope = 'iedereen' | 'vrienden';

const DEFAULT_SCOPE: TrendingScope = 'iedereen';

const SCOPE_OPTIONS: readonly SegmentedControlOption<TrendingScope>[] = [
  { value: 'iedereen', label: 'Iedereen' },
  { value: 'vrienden', label: 'Vrienden' },
];

/** Says which list you are looking at, in the terms that separate the two. */
const SCOPE_SUBTITLE: Readonly<Record<TrendingScope, string>> = {
  iedereen: 'Wat over alle keukens heen het hoogst scoort.',
  vrienden: 'Wat de mensen die je kent het hoogst beoordelen.',
};

/** Names the thing the reader is actually looking at, rather than "er ging iets mis". */
const SCOPE_ERROR_COPY: Readonly<Record<TrendingScope, string>> = {
  iedereen: 'De lijst kon niet geladen worden.',
  vrienden: 'De lijst van je vrienden kon niet geladen worden.',
};

const LOADING_COPY = 'Even kijken...';

/** "live" is the real read; the rest are `__DEV__`-only fixtures to design against. */
type TrendingSource = 'live' | BoardScenario;

const TRENDING_SOURCES: readonly TrendingSource[] = ['live', ...BOARD_SCENARIOS];

/**
 * Loading and error are real states here, because this screen genuinely
 * fetches. Both lists survive an error so a refresh that fails does not
 * blank a list the reader was already looking at.
 */
interface TrendingState extends TrendingData {
  readonly status: 'loading' | 'ready' | 'error';
  readonly message: string | null;
}

const INITIAL_STATE: TrendingState = { ...NO_TRENDING_DATA, status: 'loading', message: null };

export default function TrendingScreen(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  /** `profiles.id` IS `auth.users.id`, so the session's user id is the profile id the friends scope narrows on. */
  const { userId } = useSession();

  const [source, setSource] = useState<TrendingSource>('live');
  const [scope, setScope] = useState<TrendingScope>(DEFAULT_SCOPE);
  const [state, setState] = useState<TrendingState>(INITIAL_STATE);
  /**
   * The reader's own narrowing, and it survives nothing: this is a `useState`
   * whose initializer reads nothing, so every mount of this tab starts at
   * `NO_TRENDING_FILTER`. Deliberate, and the same rule (tabs)/index.tsx
   * applies to `DecisionFilters` — a narrowing that followed a household into
   * tomorrow would be a taste profile with extra steps, which is the thing
   * PD-014's sixth condition forbids.
   *
   * IT IS NOT CLEARED WHEN THE SCOPE SWITCHES, and that is a choice rather
   * than an omission. Only `Iedereen` is filtered, so a filter set here is
   * inert while `Vrienden` is on screen and comes back with its count visible
   * on the shut drawer the moment the reader returns. Clearing it would
   * punish a look sideways.
   */
  const [filter, setFilter] = useState<TrendingFilterState>(NO_TRENDING_FILTER);

  const load = useCallback(
    async (next: TrendingSource, profileId: string | null, isCurrent: () => boolean): Promise<void> => {
      if (next !== 'live') {
        setState({ ...loadFixtureTrending(next), status: 'ready', message: null });
        return;
      }

      setState((previous) => ({ ...previous, status: 'loading', message: null }));
      try {
        // The global half needs no identity; the friends half short-circuits
        // to an empty list without one, and this effect re-runs the moment
        // the id lands. See `@/lib/trendingSource` on why that is not a
        // signed-out branch.
        const data = await loadLiveTrending(profileId);
        if (isCurrent()) {
          setState({ ...data, status: 'ready', message: null });
        }
      } catch (error: unknown) {
        if (isCurrent()) {
          // The message is kept rather than flattened to a generic string:
          // the repository puts the Postgres code in it, and that code is
          // what tells an RLS refusal apart from a network failure.
          setState((previous) => ({
            ...previous,
            status: 'error',
            message: error instanceof Error ? error.message : null,
          }));
        }
      }
    },
    [],
  );

  useEffect(() => {
    // Guarded against a source change landing while an older read is still
    // in flight: without it, a slow "live" response can overwrite a fixture
    // the developer switched to afterwards.
    let active = true;
    void load(source, userId, () => active);
    return () => {
      active = false;
    };
  }, [source, userId, load]);

  // Both derived from the SAME unfiltered board, and the asymmetry between
  // them is the narrowing rule: the cards are the board with the filter
  // applied, while the chips come from `collectSelectableBoardDishTags`,
  // which applies the filter itself and then unions the selection back in —
  // so a chip that narrowed the feed to one card is still on screen to undo
  // it. LIB-07's rule; src/components/trendingFilter.ts carries the argument.
  const visibleBoardRows = useMemo(() => filterBoardRows(state.boardRows, filter), [state.boardRows, filter]);
  const selectableDishTags = useMemo(
    () => collectSelectableBoardDishTags(state.boardRows, filter),
    [state.boardRows, filter],
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ && DEV_SCENARIO_ROWS_VISIBLE ? <DevScenarioRow active={source} onSelect={setSource} /> : null}

      <View style={styles.header}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Trending recipes</Text>
        {/*
          The one control this header carries, in the slot the other tabs
          give their single action. Every tab header in this app is a name
          and at most one control, which is what keeps the top of a screen
          from reading as a second menu above the tab bar.
        */}
        <View style={styles.scopeSwitch}>
          <SegmentedControl
            options={SCOPE_OPTIONS}
            value={scope}
            onChange={setScope}
            accessibilityLabel="Wiens beoordelingen je ziet"
          />
        </View>
        <Text style={[typeScale.bodySmall, styles.headerSubtitle, { color: colors.textMuted }]}>
          {SCOPE_SUBTITLE[scope]}
        </Text>
      </View>

      {/* The filter belongs to one scope, so it is mounted with that scope
          rather than in the header — the header's "a name and at most one
          control" rule is what keeps the top of this screen from becoming a
          menu, and a bar that stayed while its list went away would be a
          control with nothing to act on.

          It IS mounted for every state of that scope, including the empty and
          error ones, which is the opposite of what `showFilterBar` does on
          Kiezen. The reason is the failure it has to survive: a filter that
          emptied the feed must be undoable from the screen it emptied, and
          unmounting the bar with the list would strand the reader with no
          "Wissen" and no way back. */}
      {scope === 'iedereen' ? (
        <TrendingFilterBar filter={filter} selectableDishTags={selectableDishTags} onChange={setFilter} />
      ) : null}

      {scope === 'iedereen' ? <BoardBody state={state} rows={visibleBoardRows} /> : <FriendsBoardBody state={state} />}
    </SafeAreaView>
  );
}

interface ScopeBodyProps {
  readonly state: TrendingState;
}

interface BoardBodyProps extends ScopeBodyProps {
  /** `state.boardRows` with the reader's filter applied. Never a re-ordering — see the screen header. */
  readonly rows: readonly BoardRowModel[];
}

/**
 * Everyone's feed. FIVE bodies now, chosen by early return rather than by
 * nested ternaries, matching Vrienden.
 *
 * THE FIFTH IS THE FILTERED-OUT ONE. It fires when the board has rows and
 * none of them survive the filter. That cannot happen from a chip — the chip
 * row is collected from these very rows, so every tag it offers leaves at
 * least one card standing — but it CAN happen from the time ladder alone,
 * which has no way to narrow itself. Measured on the demo seed: the three
 * recipes clearing the vote floor take 45, 25 and 30 minutes, so a cap of 20
 * empties the feed in one drag. The filter bar stays mounted through this
 * state precisely so that drag is undoable where it happened.
 *
 * There is deliberately no signed-out branch: an account is required before
 * the app renders at all (PD-012), so a signed-out person never reaches
 * this tab, and a gate here would be a second, weaker copy of a rule
 * already enforced once at the root.
 */
function BoardBody(props: BoardBodyProps): JSX.Element {
  const { state, rows } = props;

  if (state.boardRows.length === 0 && state.status === 'loading') {
    return <TrendingNotice title={LOADING_COPY} body={null} />;
  }
  if (state.boardRows.length === 0 && state.status === 'error') {
    return <TrendingNotice title={SCOPE_ERROR_COPY.iedereen} body={state.message} />;
  }
  if (state.boardRows.length === 0) {
    return <EmptyBoardState />;
  }
  if (rows.length === 0) {
    return <FilteredOutBoardState />;
  }

  // NO `onEndReached`, AND THAT ABSENCE IS THE CONDITION RATHER THAN AN
  // OVERSIGHT. PD-014's second condition is "no pagination, no infinite
  // scroll, no pull-for-more", and that one prop is what would undo it
  // silently. `BOARD_END_COPY` in the footer is what this list says instead.
  return (
    <FlatList
      data={rows}
      keyExtractor={(row: BoardRowModel) => row.recipeId}
      renderItem={({ item }: { item: BoardRowModel }) => <TrendingCard row={item} />}
      ItemSeparatorComponent={ListGap}
      ListFooterComponent={BoardEndNote}
      contentContainerStyle={styles.listContent}
    />
  );
}

/**
 * The same four bodies over the friends list, and the rows are `KringRow`
 * unchanged — the component, its model and its accessibility label all
 * moved here from Vrienden without a line of rendering changing, and the
 * card feed next door deliberately left them that way (see this file's
 * header on the recorded inconsistency).
 *
 * IT IS NOT FILTERED, and that follows from the same boundary:
 * `KringRowModel` carries no `dishTags` and no `estimatedMinutes`, so there
 * is nothing here to narrow on. A filter bar over an unfilterable list would
 * be a control that changes nothing.
 *
 * IT IS NOT PADDED FROM THE LIST NEXT DOOR, ever. §2.2: a thin friends
 * ranking is the honest one, and blending in strangers' rows to make it
 * look fuller would rebuild the refused "Ontdekken" surface out of spare
 * parts. There is no parameter here to do it with, and there must not be.
 */
function FriendsBoardBody(props: ScopeBodyProps): JSX.Element {
  const { state } = props;

  if (state.friendRows.length === 0 && state.status === 'loading') {
    return <TrendingNotice title={LOADING_COPY} body={null} />;
  }
  if (state.friendRows.length === 0 && state.status === 'error') {
    return <TrendingNotice title={SCOPE_ERROR_COPY.vrienden} body={state.message} />;
  }
  if (state.friendRows.length === 0) {
    return <EmptyFriendsBoardState />;
  }

  return (
    <FlatList
      data={state.friendRows}
      keyExtractor={(row: KringRowModel) => row.recipeId}
      renderItem={({ item }: { item: KringRowModel }) => <KringRow row={item} />}
      ItemSeparatorComponent={ListGap}
      ListFooterComponent={FriendsBoardEndNote}
      contentContainerStyle={styles.listContent}
    />
  );
}

/** Cards are separated by space, not by a rule — each card carries its own hairline border. */
function ListGap(): JSX.Element {
  return <View style={styles.listGap} />;
}

/**
 * The end of the list, said out loud. A list that visibly stops is the
 * structural form of PD-004: there is nothing further to scroll for, so
 * scrolling further is not something this product rewards.
 *
 * IT MATTERS MORE UNDER A FEED THAN IT DID UNDER A RANKING. A numbered list
 * that stopped at 25 said so twice — in this copy and in its last number.
 * Cards carry no number, so this sentence is now the only thing saying the
 * list ended rather than ran out of patience.
 */
function BoardEndNote(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return <Text style={[typeScale.caption, styles.endNote, { color: colors.textMuted }]}>{BOARD_END_COPY}</Text>;
}

/** The same full stop, in the friends list's own words (DESIGN-SOCIAL §2.2 pins the copy). */
function FriendsBoardEndNote(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return <Text style={[typeScale.caption, styles.endNote, { color: colors.textMuted }]}>{KRING_END_COPY}</Text>;
}

/**
 * The honest first state of the global list. It says a true thing — not
 * enough ratings yet — and promises nothing: no skeleton, no placeholder
 * row, no zero. The same refusal to fabricate a verdict that `average:
 * null` makes in the domain, and the reason BOARD_EMPTY_COPY is pinned by a
 * test.
 */
function EmptyBoardState(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>Nog niets beoordeeld</Text>
      <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>{BOARD_EMPTY_COPY}</Text>
      <Text style={[typeScale.caption, styles.emptyFootnote, { color: colors.textMuted }]}>
        Een recept komt hier pas op zodra genoeg mensen het beoordeeld hebben.
      </Text>
    </View>
  );
}

/**
 * The board is not empty; the reader's own filter emptied it.
 *
 * A SEPARATE STATE FROM `EmptyBoardState` FOR THE REASON THE LIBRARY KEEPS
 * TWO: "nothing has been rated enough yet" and "nothing here matches what you
 * asked for" are different facts, and showing the first when the second is
 * true tells a household the app is empty when it is their own two taps that
 * are. The words come from trendingFilter.ts, which explains why they name
 * the filter and the list and never the world — there may well be an
 * excellent curry; it is simply not on this list.
 */
function FilteredOutBoardState(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>
        {TRENDING_FILTER_EMPTY_TITLE}
      </Text>
      <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
        {TRENDING_FILTER_EMPTY_BODY}
      </Text>
    </View>
  );
}

/**
 * The friends list's own empty state, and the expected one for months
 * (§2.2): a handful of friends and fewer votes is the honest shape of this
 * list, not a failure to paper over. It states a fact and promises nothing
 * — never a zero, never a placeholder row, never a skeleton implying more
 * is coming, and never a global row borrowed to fill the space. The copy is
 * pinned in kringPresentation.ts, so this screen cannot drift from the
 * tested string.
 */
function EmptyFriendsBoardState(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>{KRING_EMPTY_TITLE}</Text>
      <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>{KRING_EMPTY_BODY}</Text>
    </View>
  );
}

/**
 * Loading and failure, said plainly and in the same shape as the empty
 * states. No spinner: this screen has nothing to animate toward, and a
 * spinner over an empty list promises content that may not exist.
 */
function TrendingNotice(props: { readonly title: string; readonly body: string | null }): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>{props.title}</Text>
      {props.body === null ? null : (
        <Text style={[typeScale.caption, styles.emptyFootnote, { color: colors.textMuted }]}>{props.body}</Text>
      )}
    </View>
  );
}

interface DevScenarioRowProps {
  readonly active: TrendingSource;
  readonly onSelect: (source: TrendingSource) => void;
}

/**
 * Mirrors Kiezen's and Vrienden's `__DEV__` rows and never renders in a
 * production build. Each scenario switches BOTH scopes at once, so the two
 * lists always describe the same world.
 *
 * "Net te weinig" is the one worth flipping to: ratings exist but nothing
 * has cleared the global floor, so `Iedereen` shows its empty state while
 * `Vrienden` stays full. That is the state on this screen a reader is most
 * likely to mistake for a bug, and it would otherwise only be met in
 * production.
 */
const DEV_SCENARIO_LABELS: Readonly<Record<TrendingSource, string>> = {
  live: 'Live',
  gevuld: 'Gevuld',
  'net-te-weinig': 'Net te weinig',
  leeg: 'Leeg',
};

function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { active, onSelect } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.devRow} accessibilityLabel="Ontwikkelaarsmodus: demoscenario kiezen">
      {TRENDING_SOURCES.map((scenario) => (
        <Pressable
          key={scenario}
          onPress={() => onSelect(scenario)}
          style={styles.devButton}
          accessibilityRole="button"
          accessibilityLabel={`Demoscenario: ${DEV_SCENARIO_LABELS[scenario]}`}
        >
          <Text style={[typeScale.caption, { color: active === scenario ? colors.accent : colors.textMuted }]}>
            {DEV_SCENARIO_LABELS[scenario]}
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
    paddingTop: spacing.space4,
    paddingBottom: spacing.space4,
  },
  scopeSwitch: {
    marginTop: spacing.space3,
  },
  headerSubtitle: {
    marginTop: spacing.space3,
  },
  listContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    // Cards want air above them the way rows did not: the filter bar's rule
    // sits directly on top of this list, and a card starting flush against it
    // reads as attached to the control rather than to the feed.
    paddingTop: spacing.space4,
    paddingBottom: spacing.space10,
  },
  listGap: {
    // Wider than the rows' `space3`, and the separator now does the work the
    // rank used to: with no number saying where one entry ends, the gap is
    // what makes a card one thing rather than a run of stacked panels.
    height: spacing.space5,
  },
  endNote: {
    marginTop: spacing.space6,
    textAlign: 'center',
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
  emptyFootnote: {
    marginTop: spacing.space4,
    textAlign: 'center',
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

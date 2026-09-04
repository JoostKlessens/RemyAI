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
 * THIS SCREEN EXISTS OVER A STATED OBJECTION, and PD-014 records the
 * objection rather than dissolving it: DESIGN.md's rule was that "a fourth
 * tab needs a fourth question of that kind, and there isn't one", and the
 * same section refuses an "Ontdekken" surface outright. The owner chose the
 * board with both in view. What that buys has to be paid for here, on the
 * surface itself, so the conditions are not paperwork:
 *
 * - **Each list is finite and says so.** The global one is capped at
 *   LEADERBOARD_MAX_ROWS and the friends one at whatever the circle
 *   actually voted on; both end in a line telling you that is the whole
 *   list. No pagination, no infinite scroll, no pull-for-more. A board that
 *   silently kept going would be a feed, and PD-004 measures this surface
 *   on save-to-cook.
 * - **Ordered by score, never by recency.** No timestamps, no "nieuw"
 *   badge. A board that moves because something is new is a feed wearing a
 *   ranking's clothes.
 * - **The global list is identical for every reader.** No personalisation
 *   of any kind; `rankRecipes` never sees the household. The friends list
 *   is per-reader by definition — it is a list of people you chose — which
 *   is a different thing from tuning a global ranking to a taste profile,
 *   and the two orderings stay in separate modules so that distinction
 *   cannot quietly erode.
 *
 * TWO SCOPES, ONE SEGMENTED CONTROL, NEVER PERSISTED. `Iedereen` |
 * `Vrienden`, defaulting to `Iedereen` on every visit. This is the same
 * control that was just deleted from Vrienden, and the difference is the
 * whole reason it belongs here and did not belong there. On Vrienden the
 * two modes answered DIFFERENT QUESTIONS — what friends cooked, and what
 * friends rated — so half of that tab's purpose sat behind a control most
 * people would never tap. Here the two lists answer the SAME question at
 * two scopes, which is exactly what a scope selector is for: "what is
 * highly rated" — among everyone, or among the people I know. Reading one
 * tells you what the other is for.
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
 * WHY SWITCHING SCOPE NEVER FETCHES. Both lists come from one read
 * (`_trendingSource.ts`), keyed on the source and not on the scope, so
 * tapping a segment is pure and instant. A segmented control that produced
 * a spinner would read as navigation rather than as a view switch.
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
 * empty. One switch moves both scopes — see `_trendingSource.ts`.
 */

import { useCallback, useEffect, useState, type JSX } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOARD_SCENARIOS, type BoardScenario } from '@/app/ranglijst/_fixtures';
import {
  NO_TRENDING_DATA,
  loadFixtureTrending,
  loadLiveTrending,
  type TrendingData,
} from '@/app/ranglijst/_trendingSource';
import { KringRow } from '@/components/KringRow';
import {
  KRING_EMPTY_BODY,
  KRING_EMPTY_TITLE,
  KRING_END_COPY,
  type KringRowModel,
} from '@/components/kringPresentation';
import {
  BOARD_EMPTY_COPY,
  BOARD_END_COPY,
  buildBoardRowAccessibilityLabel,
  type BoardRowModel,
} from '@/components/leaderboardPresentation';
import { SegmentedControl, type SegmentedControlOption } from '@/components/SegmentedControl';
import { useSession } from '@/hooks/useSession';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
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
        // the id lands. See `_trendingSource.ts` on why that is not a
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

      {scope === 'iedereen' ? <BoardBody state={state} /> : <FriendsBoardBody state={state} />}
    </SafeAreaView>
  );
}

interface ScopeBodyProps {
  readonly state: TrendingState;
}

/**
 * Everyone's list. Four bodies, chosen by early return rather than by
 * nested ternaries, matching Vrienden.
 *
 * There is deliberately no signed-out branch: an account is required before
 * the app renders at all (PD-012), so a signed-out person never reaches
 * this tab, and a gate here would be a second, weaker copy of a rule
 * already enforced once at the root.
 */
function BoardBody(props: ScopeBodyProps): JSX.Element {
  const { state } = props;

  if (state.boardRows.length === 0 && state.status === 'loading') {
    return <TrendingNotice title={LOADING_COPY} body={null} />;
  }
  if (state.boardRows.length === 0 && state.status === 'error') {
    return <TrendingNotice title={SCOPE_ERROR_COPY.iedereen} body={state.message} />;
  }
  if (state.boardRows.length === 0) {
    return <EmptyBoardState />;
  }

  return (
    <FlatList
      data={state.boardRows}
      keyExtractor={(row: BoardRowModel) => row.recipeId}
      renderItem={({ item }: { item: BoardRowModel }) => <BoardRow row={item} />}
      ItemSeparatorComponent={ListGap}
      ListFooterComponent={BoardEndNote}
      contentContainerStyle={styles.listContent}
    />
  );
}

/**
 * The same four bodies over the friends list, and the rows are `KringRow`
 * unchanged — the component, its model and its accessibility label all
 * moved here from Vrienden without a line of rendering changing.
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

/** Rows are separated by space, not by a rule — each row carries its own hairline border. */
function ListGap(): JSX.Element {
  return <View style={styles.listGap} />;
}

interface BoardRowProps {
  readonly row: BoardRowModel;
}

/**
 * One row of the global list: rank, dish, score, creator, and the collision
 * chip when there is one.
 *
 * The rank is `numeral` rather than `caption` for one specific reason —
 * `numeral` carries tabular figures, so the column does not shift
 * horizontally between 9 and 10 and make the whole list look broken.
 *
 * The creator line is not decoration. These rows are extractions of
 * somebody's public post, and PD-007's attribution obligation applies here
 * exactly as it does in the Feed and on Bevestigen.
 *
 * The row is one tap target and, per PD-014's fourth condition, it is a
 * route to cooking rather than to more browsing. The destination screen
 * does not exist yet, so the row is not yet pressable — deliberately, and
 * for the same reason Vrienden's empty state offers no "invite a friend"
 * button: an action that silently does nothing is worse than no action.
 * `KringRow` reached the same conclusion for the same reason.
 */
function BoardRow(props: BoardRowProps): JSX.Element {
  const { row } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={buildBoardRowAccessibilityLabel(row)}
    >
      <Text style={[typeScale.numeral, styles.rank, { color: colors.textMuted }]}>{row.rank}</Text>

      <View style={styles.rowText}>
        <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{row.title}</Text>
        <Text style={[typeScale.numeral, styles.rowMeta, { color: colors.textSecondary }]}>{row.metaLine}</Text>
        <Text style={[typeScale.caption, styles.rowCreator, { color: colors.textMuted }]}>{row.creatorLine}</Text>

        {row.collisionLabel === null ? null : (
          <View style={[styles.chip, { backgroundColor: colors.warningMuted }]}>
            <Text style={[typeScale.caption, { color: colors.warning }]}>{row.collisionLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * The end of the list, said out loud. A list that visibly stops is the
 * structural form of PD-004: there is nothing further to scroll for, so
 * scrolling further is not something this product rewards.
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
    paddingBottom: spacing.space10,
  },
  listGap: {
    height: spacing.space3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.radiusSm,
    padding: spacing.space3,
    gap: spacing.space3,
  },
  rank: {
    minWidth: spacing.space6,
    textAlign: 'right',
  },
  rowText: {
    flex: 1,
  },
  rowMeta: {
    marginTop: spacing.space1,
  },
  rowCreator: {
    marginTop: spacing.space1,
  },
  chip: {
    alignSelf: 'flex-start',
    marginTop: spacing.space2,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
    borderRadius: radii.radiusSm,
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

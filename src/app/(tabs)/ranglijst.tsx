/**
 * Ranglijst — the global board (docs/DESIGN.md §9, PD-014). The fourth
 * tab, added in Fase 6.
 *
 * This screen exists over a stated objection, and PD-014 records the
 * objection rather than dissolving it: DESIGN.md's rule was that "a fourth
 * tab needs a fourth question of that kind, and there isn't one", and the
 * same section refuses an "Ontdekken" surface outright. The owner chose
 * the board with both in view. What that buys has to be paid for here, on
 * the surface itself, so the conditions are not paperwork:
 *
 * - **The board is finite and says so.** Capped at LEADERBOARD_MAX_ROWS,
 *   ending in a line that tells you that is the whole list. No pagination,
 *   no infinite scroll, no pull-for-more. A board that silently kept going
 *   would be a feed, and PD-004 measures this surface on save-to-cook.
 * - **Ordered by score, never by recency.** No timestamps, no "nieuw"
 *   badge, no "trending". A board that moves because something is new is a
 *   feed wearing a ranking's clothes.
 * - **Identical for every reader.** No personalisation of any kind. The
 *   ordering comes from `rankRecipes`, which never sees the household.
 *
 * THE ONE THING ON THIS SCREEN THAT LOOKS LIKE A BUG. A recipe carrying a
 * "bevat noten" chip still sits wherever its score put it — often first.
 * The friend feed demotes a colliding recipe; this one must not, because
 * demoting is per-household and PD-014's sixth condition is "no
 * personalisation, ever". The ordering stays global; the warning stays
 * personal. PD-007a's safety half — never hidden, always labelled — is
 * untouched, and `assembleLeaderboard` owns that split rather than this
 * file.
 *
 * LIVE, WITH FIXTURES BEHIND A DEV SWITCH. The board reads
 * `recipe_ratings` and `recipes` through supabaseSocialRepository, both of
 * which grant SELECT to any authenticated user, so no definer-rights
 * function is involved. In a production build "live" is the only source
 * there is; the scenario row exists only under `__DEV__`, so design work
 * has something to look at while the real tables are still empty.
 *
 * WHY A COLLISION CHIP WILL NEVER APPEAR ON LIVE DATA. `recipes` carries
 * no allergen tags, and that is PD-006 rather than an omission: tagging is
 * something a household does to its own copy on Bevestigen, and an
 * untagged recipe is UNKNOWN, never "safe". So the excluded-tag list this
 * screen passes is empty, and the absence of a chip here says nothing
 * about the dish. It must never be styled or read as reassurance. Giving
 * the board a real collision label needs allergen data on the canonical
 * recipe, which is a product decision nobody has taken.
 */

import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOARD_SCENARIOS, getBoardFixture, type BoardScenario } from '@/app/ranglijst/_fixtures';
import {
  BOARD_EMPTY_COPY,
  BOARD_END_COPY,
  LEADERBOARD_MAX_ROWS,
  assembleLeaderboard,
  buildBoardRowAccessibilityLabel,
  type BoardRecipe,
  type BoardRowModel,
} from '@/components/leaderboardPresentation';
import { buildLeaderboard } from '@/domain/social/leaderboard';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

/** "live" is the real board; the rest are `__DEV__`-only fixtures to design against. */
type BoardSource = 'live' | BoardScenario;

const BOARD_SOURCES: readonly BoardSource[] = ['live', ...BOARD_SCENARIOS];

/**
 * Loading and error are real states here, unlike on Vrienden, because this
 * screen genuinely fetches. `rows` survives an error so a refresh that
 * fails does not blank a board the reader was already looking at.
 */
interface BoardState {
  readonly status: 'loading' | 'ready' | 'error';
  readonly rows: readonly BoardRowModel[];
  readonly message: string | null;
}

const LOADING_COPY = 'Even kijken...';
const ERROR_COPY = 'De ranglijst kon niet geladen worden.';

/**
 * Reads the board. Ranks first, then fetches display data for only the
 * recipes that made the cut — the alternative is pulling every canonical
 * recipe in the database to render at most LEADERBOARD_MAX_ROWS of them.
 *
 * `buildLeaderboard` runs twice: once here to learn which ids matter, and
 * once inside `assembleLeaderboard`. That is deliberate. It is a pure
 * function of the same input, so the two runs cannot disagree, and paying
 * for it twice is cheaper than giving this screen its own copy of the
 * ranking to keep in step with the domain's.
 */
async function loadLiveBoard(): Promise<readonly BoardRowModel[]> {
  const repository = createSupabaseSocialRepository(supabase);
  const ratings = await repository.listAllRecipeRatings();

  const ranked = buildLeaderboard(ratings).slice(0, LEADERBOARD_MAX_ROWS);
  const recipes = await repository.listCanonicalRecipes(ranked.map((entry) => entry.recipeId));

  const boardRecipes: readonly BoardRecipe[] = recipes.map((recipe) => ({
    recipeId: recipe.recipeId,
    title: recipe.title,
    creatorHandle: recipe.authorName ?? '',
    creatorPlatform: recipe.platform,
    thumbnailUrl: recipe.thumbnailUrl,
    // Empty, and see this file's header: a canonical recipe carries no
    // allergen tags by design (PD-006), so there is nothing here to
    // collide with. Absence is UNKNOWN, never "safe".
    allergenTags: [],
  }));

  return assembleLeaderboard({ ratings, recipes: boardRecipes, excludedAllergenTags: [] });
}

export default function RanglijstScreen(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [source, setSource] = useState<BoardSource>('live');
  const [state, setState] = useState<BoardState>({ status: 'loading', rows: [], message: null });

  const load = useCallback(async (next: BoardSource, isCurrent: () => boolean): Promise<void> => {
    if (next !== 'live') {
      setState({ status: 'ready', rows: assembleLeaderboard(getBoardFixture(next)), message: null });
      return;
    }

    setState((previous) => ({ status: 'loading', rows: previous.rows, message: null }));
    try {
      const rows = await loadLiveBoard();
      if (isCurrent()) {
        setState({ status: 'ready', rows, message: null });
      }
    } catch (error: unknown) {
      if (isCurrent()) {
        // The message is kept rather than flattened to a generic string:
        // the repository puts the Postgres code in it, and that code is
        // what tells an RLS refusal apart from a network failure.
        setState((previous) => ({
          status: 'error',
          rows: previous.rows,
          message: error instanceof Error ? error.message : null,
        }));
      }
    }
  }, []);

  useEffect(() => {
    // Guarded against a source change landing while an older read is still
    // in flight: without it, a slow "live" response can overwrite a
    // fixture the developer switched to afterwards.
    let active = true;
    void load(source, () => active);
    return () => {
      active = false;
    };
  }, [source, load]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ ? <DevScenarioRow active={source} onSelect={setSource} /> : null}

      <View style={styles.header}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Best beoordeeld</Text>
        <Text style={[typeScale.bodySmall, styles.headerSubtitle, { color: colors.textMuted }]}>
          Wat over alle keukens heen het hoogst scoort.
        </Text>
      </View>

      <BoardBody state={state} />
    </SafeAreaView>
  );
}

interface BoardBodyProps {
  readonly state: BoardState;
}

/**
 * Two bodies, chosen by early return rather than a ternary, matching
 * Vrienden. There is deliberately no signed-out branch: an account is
 * required before the app renders at all (PD-012), so a signed-out person
 * never reaches this tab, and a gate here would be a second, weaker copy
 * of a rule already enforced once at the root.
 */
function BoardBody(props: BoardBodyProps): JSX.Element {
  const { state } = props;

  if (state.rows.length === 0 && state.status === 'loading') {
    return <BoardNotice title={LOADING_COPY} body={null} />;
  }
  if (state.rows.length === 0 && state.status === 'error') {
    return <BoardNotice title={ERROR_COPY} body={state.message} />;
  }
  if (state.rows.length === 0) {
    return <EmptyBoardState />;
  }

  return (
    <FlatList
      data={state.rows}
      keyExtractor={(row: BoardRowModel) => row.recipeId}
      renderItem={({ item }: { item: BoardRowModel }) => <BoardRow row={item} />}
      ItemSeparatorComponent={ListGap}
      ListFooterComponent={BoardEndNote}
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
 * One row: rank, dish, score, creator, and the collision chip when there
 * is one.
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
 * The end of the board, said out loud. A list that visibly stops is the
 * structural form of PD-004: there is nothing further to scroll for, so
 * scrolling further is not something this product rewards.
 */
function BoardEndNote(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return <Text style={[typeScale.caption, styles.endNote, { color: colors.textMuted }]}>{BOARD_END_COPY}</Text>;
}

/**
 * The honest first state of this tab. It says a true thing — not enough
 * ratings yet — and promises nothing: no skeleton, no placeholder row, no
 * zero. The same refusal to fabricate a verdict that `average: null` makes
 * in the domain, and the reason BOARD_EMPTY_COPY is pinned by a test.
 */
function EmptyBoardState(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>Nog geen ranglijst</Text>
      <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>{BOARD_EMPTY_COPY}</Text>
      <Text style={[typeScale.caption, styles.emptyFootnote, { color: colors.textMuted }]}>
        Een recept komt hier pas op zodra genoeg mensen het beoordeeld hebben.
      </Text>
    </View>
  );
}

/**
 * Loading and failure, said plainly and in the same shape as the empty
 * state. No spinner: this screen has nothing to animate toward, and a
 * spinner over an empty list promises content that may not exist.
 */
function BoardNotice(props: { readonly title: string; readonly body: string | null }): JSX.Element {
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
  readonly active: BoardSource;
  readonly onSelect: (source: BoardSource) => void;
}

/**
 * Mirrors Kiezen's and Vrienden's `__DEV__` rows and never renders in a
 * production build. "Net te weinig" is the one worth flipping to: ratings
 * exist but nothing has cleared the floor, which is the empty state the
 * copy actually claims and the one that would otherwise only be seen in
 * production.
 */
const DEV_SCENARIO_LABELS: Readonly<Record<BoardSource, string>> = {
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
      {BOARD_SOURCES.map((scenario) => (
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
  headerSubtitle: {
    marginTop: spacing.space1,
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

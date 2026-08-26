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
 * FIXTURES ONLY (src/app/ranglijst/_fixtures.ts). There is no loading
 * state and no error state because there is no fetch: a global board needs
 * a cross-household read path and `src/lib/repository/social/` has only an
 * on-device store. That file's header explains what has to land first, and
 * the one scaling decision to take before it does. Same staging Vrienden
 * shipped under in Fase 5b.
 */

import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BOARD_SCENARIOS,
  DEFAULT_BOARD_SCENARIO,
  getBoardFixture,
  type BoardScenario,
} from '@/app/ranglijst/_fixtures';
import {
  BOARD_EMPTY_COPY,
  BOARD_END_COPY,
  assembleLeaderboard,
  buildBoardRowAccessibilityLabel,
  type BoardRowModel,
} from '@/components/leaderboardPresentation';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export default function RanglijstScreen(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [scenario, setScenario] = useState<BoardScenario>(DEFAULT_BOARD_SCENARIO);

  const rows = useMemo(() => assembleLeaderboard(getBoardFixture(scenario)), [scenario]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ ? <DevScenarioRow active={scenario} onSelect={setScenario} /> : null}

      <View style={styles.header}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Best beoordeeld</Text>
        <Text style={[typeScale.bodySmall, styles.headerSubtitle, { color: colors.textMuted }]}>
          Wat over alle keukens heen het hoogst scoort.
        </Text>
      </View>

      <BoardBody rows={rows} />
    </SafeAreaView>
  );
}

interface BoardBodyProps {
  readonly rows: readonly BoardRowModel[];
}

/**
 * Two bodies, chosen by early return rather than a ternary, matching
 * Vrienden. There is deliberately no signed-out branch: an account is
 * required before the app renders at all (PD-012), so a signed-out person
 * never reaches this tab, and a gate here would be a second, weaker copy
 * of a rule already enforced once at the root.
 */
function BoardBody(props: BoardBodyProps): JSX.Element {
  if (props.rows.length === 0) {
    return <EmptyBoardState />;
  }

  return (
    <FlatList
      data={props.rows}
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

interface DevScenarioRowProps {
  readonly active: BoardScenario;
  readonly onSelect: (scenario: BoardScenario) => void;
}

/**
 * Mirrors Kiezen's and Vrienden's `__DEV__` rows and never renders in a
 * production build. "Net te weinig" is the one worth flipping to: ratings
 * exist but nothing has cleared the floor, which is the empty state the
 * copy actually claims and the one that would otherwise only be seen in
 * production.
 */
const DEV_SCENARIO_LABELS: Readonly<Record<BoardScenario, string>> = {
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
      {BOARD_SCENARIOS.map((scenario) => (
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

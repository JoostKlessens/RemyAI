/**
 * Vrienden — recipes people you know have actually cooked and sent on
 * (docs/DESIGN.md §8, PD-010). The third tab, added in Fase 5b.
 *
 * This screen is a list, which is the one thing Kiezen is forbidden to be,
 * so it is worth being precise about why that is not a contradiction.
 * Kiezen answers "wat eten we vanavond", and a list there would hand the
 * question straight back to the user — the whole product thesis (PD-001).
 * Vrienden answers a different question, "wat hebben mensen die ik ken
 * gemaakt", and that one genuinely has more than one answer. What it must
 * never become is a place to spend time:
 *
 * - **The list is finite and says so.** No pagination, no infinite scroll,
 *   no pull-for-more, no autoplay. It ends in a plain line telling you
 *   that you have seen everything, because a feed that can end is a feed
 *   that cannot be scrolled for its own sake (PD-004: measured on
 *   save-to-cook, never on dwell time).
 * - **Nothing here is sorted by recency.** Order comes from
 *   `rankFeedItems` — cookability, not freshness — and no card carries a
 *   timestamp or a "nieuw" badge. A freshness stamp is the cheapest way
 *   to smuggle "check back often" into a surface that exists to answer a
 *   cooking question.
 *
 * PD-007a lives on this screen in visible form: a recipe colliding with
 * the household's restrictions is ranked to the bottom by the domain layer
 * and labelled "bevat noten" on its own card — ranked down AND labelled,
 * never hidden. `assembleFriendFeed` (friendFeedPresentation.ts) runs the
 * consent gate, the ranking and the collision lookup in that one correct
 * order; this screen deliberately owns none of that logic itself.
 *
 * FIXTURES ONLY (src/app/friends/_fixtures.ts). There is no loading state
 * and no error state below, and that is a deliberate omission rather than
 * an oversight: the data is a synchronous constant, so a spinner here
 * would be theatre — the "spinner that resolves into nothing"
 * docs/DESIGN.md §3 warns about, with no network behind it to justify it.
 * Both states become real the moment this reads through a repository, and
 * they belong in that change, beside the call that can actually fail.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DEFAULT_FRIEND_FEED_SCENARIO,
  FIXTURE_TARGET_DATE,
  getFriendFeedFixture,
  type FriendFeedScenario,
} from '@/app/friends/_fixtures';
import { Button } from '@/components/Button';
import { FriendRecipeCard } from '@/components/FriendRecipeCard';
import { assembleFriendFeed, type FriendRecipeCardModel } from '@/components/friendFeedPresentation';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getColors, spacing, typeScale } from '@/theme/tokens';

export default function FriendsScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  // docs/DESIGN.md "Global rules": read once per screen, pass it down.
  const reduceMotionEnabled = useReduceMotion();

  const [scenario, setScenario] = useState<FriendFeedScenario>(DEFAULT_FRIEND_FEED_SCENARIO);

  const cards = useMemo(() => {
    const fixture = getFriendFeedFixture(scenario);
    return assembleFriendFeed({ ...fixture, targetDate: FIXTURE_TARGET_DATE });
  }, [scenario]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ ? <DevScenarioRow active={scenario} onSelect={setScenario} /> : null}

      <View style={styles.header}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Vrienden</Text>
        <Text style={[typeScale.bodySmall, styles.headerSubtitle, { color: colors.textMuted }]}>
          Wat vrienden echt gekookt hebben.
        </Text>
      </View>

      <FriendsBody
        cards={cards}
        reduceMotionEnabled={reduceMotionEnabled}
        onOpenLibrary={() => router.push('/recipes')}
        onOpenCard={(feedItemId: string) => router.push(`/friends/${feedItemId}?scenario=${scenario}`)}
      />
    </SafeAreaView>
  );
}

interface FriendsBodyProps {
  readonly cards: readonly FriendRecipeCardModel[];
  readonly reduceMotionEnabled: boolean;
  readonly onOpenLibrary: () => void;
  readonly onOpenCard: (feedItemId: string) => void;
}

/**
 * Two bodies, chosen by early return rather than a ternary, so adding a
 * third later does not mean nesting one.
 *
 * There is deliberately no signed-out branch. An account is required
 * before the app renders at all (PD-012), so a signed-out person never
 * reaches this tab — the root layout answers that case with the sign-in
 * screen. A gate here would be a second, weaker copy of a rule that is
 * already enforced once.
 */
function FriendsBody(props: FriendsBodyProps): JSX.Element {
  if (props.cards.length === 0) {
    return <EmptyFeedState onOpenLibrary={props.onOpenLibrary} />;
  }

  return (
    <FlatList
      data={props.cards}
      keyExtractor={(card: FriendRecipeCardModel) => card.feedItemId}
      renderItem={({ item }: { item: FriendRecipeCardModel }) => (
        <FriendRecipeCard
          model={item}
          reduceMotionEnabled={props.reduceMotionEnabled}
          onPress={() => props.onOpenCard(item.feedItemId)}
        />
      )}
      ItemSeparatorComponent={ListGap}
      ListFooterComponent={FeedEndNote}
      contentContainerStyle={styles.listContent}
    />
  );
}
/** Cards are separated by space, not by a rule — each card already carries its own hairline border. */
function ListGap(): JSX.Element {
  return <View style={styles.listGap} />;
}

/**
 * The end of the feed, said out loud. A list that visibly stops is the
 * structural form of PD-004: there is nothing further to scroll for, so
 * scrolling further is not something this product rewards.
 */
function FeedEndNote(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <Text style={[typeScale.caption, styles.endNote, { color: colors.textMuted }]}>
      Dat is alles wat er gedeeld is.
    </Text>
  );
}

interface EmptyFeedStateProps {
  readonly onOpenLibrary: () => void;
}

/**
 * The honest first state of this tab, and the one most people will meet
 * first — sharing needs two households and a fresh install has one.
 *
 * The copy does two jobs. It says what will appear here, so the tab is not
 * a mystery, and it states PD-010.3 out loud in the one place it actually
 * reassures somebody: your own recipes stay private until you share one,
 * every time, deliberately. There is no "nodig een vriend uit" button
 * because there is no invite flow behind it yet, and a primary action that
 * does nothing is worse than no action at all. The real, working exit —
 * back to your own library — is offered instead.
 */
function EmptyFeedState(props: EmptyFeedStateProps): JSX.Element {
  const { onOpenLibrary } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.empty}>
      <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>Nog niets gedeeld</Text>
      <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
        Stuurt iemand je een recept, dan staat het hier — met het originele filmpje erbij.
      </Text>
      <View style={[styles.emptyRule, { backgroundColor: colors.border }]} />
      <Text style={[typeScale.caption, styles.emptyFootnote, { color: colors.textMuted }]}>
        Andersom blijft alles van jou privé. Delen doe je zelf, per recept.
      </Text>
      <View style={styles.emptyAction}>
        <Button
          label="Naar je bibliotheek"
          variant="secondary"
          onPress={onOpenLibrary}
          accessibilityLabel="Naar je bibliotheek, je eigen opgeslagen recepten"
        />
      </View>
    </View>
  );
}

interface DevScenarioRowProps {
  readonly active: FriendFeedScenario;
  readonly onSelect: (scenario: FriendFeedScenario) => void;
}

/**
 * Mirrors Kiezen's `__DEV__` row exactly (src/app/(tabs)/index.tsx) and
 * never renders in a production build. "Zonder allergie" is the one worth
 * flipping back and forth: the recipes are identical in both scenarios, so
 * the appearing and disappearing "bevat noten" label makes PD-006's point
 * physically visible — the label describes the household, never the dish.
 */
const DEV_SCENARIOS: ReadonlyArray<{ value: FriendFeedScenario; label: string }> = [
  { value: 'gedeeld', label: 'Gedeeld' },
  { value: 'zonder_allergie', label: 'Zonder allergie' },
  { value: 'leeg', label: 'Leeg' },
];

function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { active, onSelect } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.devRow} accessibilityLabel="Ontwikkelaarsmodus: demoscenario kiezen">
      {DEV_SCENARIOS.map((scenario) => (
        <Pressable
          key={scenario.value}
          onPress={() => onSelect(scenario.value)}
          style={styles.devButton}
          accessibilityRole="button"
          accessibilityLabel={`Demoscenario: ${scenario.label}`}
        >
          <Text style={[typeScale.caption, { color: active === scenario.value ? colors.accent : colors.textMuted }]}>
            {scenario.label}
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
  emptyRule: {
    height: 1,
    alignSelf: 'stretch',
    marginTop: spacing.space6,
    marginBottom: spacing.space4,
  },
  emptyFootnote: {
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: spacing.space6,
    minWidth: 220,
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

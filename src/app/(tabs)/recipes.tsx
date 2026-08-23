/**
 * "Mijn recepten" — replaces the removed Feed tab. A live list, not an
 * archive: every recipe shows its real scheduling state (deze week / ooit
 * / al gekookt / nog geen planning) via src/components/recipeScheduling.ts,
 * "deze week" items first, so the tab communicates what will actually
 * happen, not just what got hoarded — the same failure mode PD-004's
 * "when?" prompt exists to prevent.
 *
 * Curated meals (householdId null) are deliberately excluded — this is
 * "MY recipes," the household's own rotation, not the global catalogue.
 *
 * The entry point into the import flow (src/app/import/paste.tsx) lives
 * here, at the top of the screen.
 *
 * Reads through `RemyRepository` (@/lib/repository), never `_fixtures.ts`
 * directly — a fresh install seeds from fixtures once (see
 * src/lib/repository/local/seed.ts); everything after that, including a
 * meal just saved via the import flow, comes from real persisted data.
 * Reloads on every screen focus (`useFocusEffect`), not just on first
 * mount, so returning here right after confirm.tsx's `router.replace('/
 * recipes')` shows the just-saved meal without needing a full app restart.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HouseholdId } from '@/domain/types';
import { Button } from '@/components/Button';
import { RecipeListRow } from '@/components/RecipeListRow';
import { sortMealsByScheduling, type ScheduledMealRow } from '@/components/recipeScheduling';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { getColors, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

async function loadRows(householdId: HouseholdId): Promise<readonly ScheduledMealRow[]> {
  const repository = getAppRepository();
  const [meals, saves, cookEvents] = await Promise.all([
    repository.listHouseholdMeals(householdId),
    repository.listSaves(householdId),
    repository.listCookEvents(householdId),
  ]);
  // "MY recipes": the household's own rotation only — curated (householdId
  // null) meals are excluded here even though listHouseholdMeals returns
  // both, matching this screen's own file header.
  const ownMeals = meals.filter((meal) => meal.householdId === householdId);
  return sortMealsByScheduling(ownMeals, saves, cookEvents);
}

export default function RecipesScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [rows, setRows] = useState<readonly ScheduledMealRow[]>([]);

  const refresh = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    ensureSeeded()
      .then(() => getAppRepository().getCurrentHouseholdId())
      .then((householdId) => loadRows(householdId))
      .then((nextRows) => {
        if (cancelled) {
          return;
        }
        setRows(nextRows);
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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Mijn recepten</Text>
        <View style={styles.importButton}>
          <Button
            label="+ Recept importeren"
            variant="secondary"
            onPress={() => router.push('/import/paste')}
            accessibilityLabel="Nieuw recept importeren via een TikTok- of Instagram-link"
          />
        </View>
      </View>

      {phase === 'error' ? (
        <View style={styles.empty}>
          <Text style={[typeScale.title3, styles.emptyTitle, { color: colors.textPrimary }]}>
            Kon recepten niet laden
          </Text>
          <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
            Controleer je verbinding en probeer het opnieuw.
          </Text>
          <View style={styles.retryButton}>
            <Button label="Opnieuw proberen" variant="secondary" onPress={refresh} accessibilityLabel="Recepten opnieuw laden" />
          </View>
        </View>
      ) : null}

      {phase === 'ready' && rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[typeScale.title3, styles.emptyTitle, { color: colors.textPrimary }]}>Nog geen recepten</Text>
          <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
            Voeg gerechten toe tijdens onboarding, of importeer er een via een link.
          </Text>
        </View>
      ) : null}

      {phase !== 'error' && rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(row: ScheduledMealRow) => row.meal.id}
          renderItem={({ item }: { item: ScheduledMealRow }) => (
            <RecipeListRow meal={item.meal} scheduling={item.scheduling} />
          )}
          contentContainerStyle={styles.listContent}
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
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space4,
    gap: spacing.space3,
  },
  importButton: {
    alignSelf: 'flex-start',
    minWidth: 220,
  },
  listContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.space10,
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
  retryButton: {
    marginTop: spacing.space5,
    minWidth: 200,
  },
});

/**
 * Bibliotheek — the library of saved short-form-video recipes
 * (docs/DESIGN.md §2). Every recipe shows its real scheduling state (deze
 * week / ooit / al gekookt / nog geen planning) via
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
 * "type 10-15 meals" onboarding is gone. The household settings screen
 * (src/app/settings.tsx) is reachable from here too, as a small secondary
 * link, never a gating step before either tab is usable.
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
 */

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HouseholdId } from '@/domain/types';
import { Button } from '@/components/Button';
import { RecipeTile } from '@/components/RecipeTile';
import { sortMealsByScheduling, type ScheduledMealRow } from '@/components/recipeScheduling';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

const GRID_COLUMNS = 2;
const LOADING_TILE_COUNT = 6;

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
      <LibraryHeader onPasteLink={() => router.push('/import/paste')} onOpenSettings={() => router.push('/settings')} />

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

      {phase === 'ready' && rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(row: ScheduledMealRow) => row.meal.id}
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }: { item: ScheduledMealRow }) => (
            <RecipeTile meal={item.meal} scheduling={item.scheduling} />
          )}
          contentContainerStyle={styles.gridContent}
        />
      ) : null}
    </SafeAreaView>
  );
}

interface LibraryHeaderProps {
  readonly onPasteLink: () => void;
  readonly onOpenSettings: () => void;
}

function LibraryHeader(props: LibraryHeaderProps): JSX.Element {
  const { onPasteLink, onOpenSettings } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.header}>
      <Text style={[typeScale.title2, { color: colors.textPrimary }]}>Bibliotheek</Text>
      <View style={styles.headerActions}>
        <View style={styles.pasteButton}>
          <Button
            label="+ Link plakken"
            variant="secondary"
            onPress={onPasteLink}
            accessibilityLabel="Nieuw recept importeren via een TikTok- of Instagram-link"
          />
        </View>
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Instellingen, huishoud-voorkeuren aanpassen"
          style={styles.settingsLink}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Instellingen</Text>
        </Pressable>
      </View>
    </View>
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
  header: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space4,
    gap: spacing.space2,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: spacing.space2,
  },
  pasteButton: {
    alignSelf: 'flex-end',
    minWidth: 200,
  },
  settingsLink: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    paddingHorizontal: spacing.space2,
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

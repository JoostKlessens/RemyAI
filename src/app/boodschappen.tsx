/**
 * Boodschappen — the shopping list for what's planned this week (BSK-01
 * UI). The domain layer (src/domain/shopping/{types,normalizeIngredient,
 * buildShoppingList}.ts) already turns a pile of recipe ingredient lines
 * into one clean, de-duplicated `ShoppingListItem[]`; before this file
 * existed, nothing in the app ever called it, so a user could not see a
 * shopping list at all. This screen is the thinnest possible bridge: fetch
 * this week's planned meals' ingredients through `RemyRepository`, hand
 * them to `buildShoppingList`, and render exactly what comes back. NO
 * FILTERING, SUMMING, OR UNIT LOGIC LIVES HERE — that is this repo's rule
 * for every screen sitting on a pure domain layer, and it is also simply
 * true: `buildShoppingList`'s own header explains at length why summing a
 * multi-measure item ("200 g" + "2 stuks") would be a fabricated number,
 * and duplicating even a shred of that logic here would be the one way to
 * reintroduce it by accident.
 *
 * "PLANNED THIS WEEK" MEANS `listPendingSaves(householdId, 'this_week')`,
 * not every meal with an active "deze week" save. That method (see
 * src/lib/repository/local/saves.ts) already drops a save once its meal has
 * been cooked since — once dinner happened, there is nothing left to shop
 * for, and continuing to list its ingredients would make a shopper re-buy
 * what they already have. A meal saved twice with the same intent
 * contributes its ingredients once: `uniqueMealIds` below dedupes by
 * `mealId` before any ingredient is ever fetched, matching
 * `buildShoppingList`'s own "one bucket per (name, unit)" de-duplication in
 * spirit — a re-save should not double an ingredient's total.
 *
 * CHECK-OFF IS SESSION-MEMORY, NOT REPOSITORY STATE. `RemyRepository`
 * (src/lib/repository/types.ts) has no method for "which shopping-list
 * items has this household bought," and this screen does not invent one —
 * adding a new persistence seam is a decision for whoever owns that
 * interface, not a side effect of building the screen on top of it. The
 * module-level `sessionCheckedItemNames` below survives leaving and
 * returning to this route (a shopper who backs out mid-aisle keeps their
 * progress) for as long as the app process is alive, and is lost on a
 * fresh launch — an honest "at least this much" that reaches for no
 * storage mechanism of its own (no AsyncStorage, no new table). Keyed by
 * `ShoppingListItem.name`, which `buildShoppingList` already guarantees is
 * unique within one computed list.
 *
 * TWO EMPTY STATES, ON PURPOSE. See shoppingListCopy.ts's header for the
 * full argument: a household with nothing saved "deze week" and a
 * household that has bought everything on an otherwise real list both
 * present as "nothing left to check off," and confusing the two would mean
 * telling a household mid-shop to go plan a meal, or telling a household
 * that saved nothing "well done." `items.length === 0` renders
 * `NothingPlannedState`; a non-empty list with every row checked renders
 * `AllCheckedBanner` ABOVE the (still fully visible, still interactive)
 * list — the list stays mounted on purpose, so ticking something off by
 * mistake is one tap to undo, not a screen to re-navigate to.
 *
 * NAVIGATION: this route is deliberately NOT wired into any tab bar or
 * existing screen — that is explicitly out of scope for this change, owned
 * by whoever adds the entry point. It works standing alone at
 * `/boodschappen` (expo-router mounts every file under src/app as a route
 * whether or not `_layout.tsx`'s `<Stack>` declares it — see that file's
 * own `AuthGate` comment) and reachable today via `router.push('/boodschappen')`
 * from anywhere in the app.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { buildShoppingList } from '@/domain/shopping/buildShoppingList';
import type { RawIngredientLine, ShoppingListItem, ShoppingListMealInput } from '@/domain/shopping/types';
import type { MealId, MealIngredient, Save } from '@/domain/types';
import { Button } from '@/components/Button';
import { ShoppingListRow } from '@/components/ShoppingListRow';
import {
  describeShoppingListAllChecked,
  describeShoppingListMealCount,
  describeShoppingListNothingPlanned,
} from '@/components/shoppingListCopy';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

// ---------------------------------------------------------------------------
// Session-only check-off memory — see this file's header for why this is
// not repository state.
// ---------------------------------------------------------------------------

let sessionCheckedItemNames: ReadonlySet<string> = new Set();

function toggleCheckedItemName(current: ReadonlySet<string>, name: string): ReadonlySet<string> {
  const next = new Set(current);
  if (next.has(name)) {
    next.delete(name);
  } else {
    next.add(name);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Data loading — repository reads + one call into the pure domain layer.
// ---------------------------------------------------------------------------

interface ShoppingListData {
  readonly items: readonly ShoppingListItem[];
  readonly mealCount: number;
}

function toRawIngredientLine(ingredient: MealIngredient): RawIngredientLine {
  return { name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit };
}

function uniqueMealIds(saves: readonly Save[]): readonly MealId[] {
  return [...new Set(saves.map((save) => save.mealId))];
}

async function loadShoppingListData(): Promise<ShoppingListData> {
  await ensureSeeded();
  const repository = getAppRepository();
  const householdId = await repository.getCurrentHouseholdId();
  const saves = await repository.listPendingSaves(householdId, 'this_week');
  const mealIds = uniqueMealIds(saves);

  const ingredientsByMeal = await Promise.all(mealIds.map((mealId) => repository.getMealIngredients(mealId)));
  const mealInputs: readonly ShoppingListMealInput[] = ingredientsByMeal.map((ingredients) => ({
    ingredients: ingredients.map(toRawIngredientLine),
  }));

  return { items: buildShoppingList(mealInputs), mealCount: mealIds.length };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ShoppingListScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [items, setItems] = useState<readonly ShoppingListItem[]>([]);
  const [mealCount, setMealCount] = useState(0);
  const [checkedNames, setCheckedNames] = useState<ReadonlySet<string>>(sessionCheckedItemNames);

  const refresh = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    loadShoppingListData()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setItems(data.items);
        setMealCount(data.mealCount);
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

  const handleToggle = useCallback((name: string): void => {
    setCheckedNames((current) => {
      const next = toggleCheckedItemName(current, name);
      // Kept in step with the module-level cache so leaving and returning
      // to this route resumes where the shopper left off — see this file's
      // header for why that cache exists and what it deliberately is not.
      sessionCheckedItemNames = next;
      return next;
    });
  }, []);

  const allChecked = items.length > 0 && items.every((item) => checkedNames.has(item.name));
  const subtitle = phase === 'ready' && items.length > 0 ? describeShoppingListMealCount(mealCount) : null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header onClose={() => router.back()} subtitle={subtitle} />

      {phase === 'loading' ? <LoadingRows /> : null}

      {phase === 'error' ? (
        <View style={styles.centered}>
          <Text style={[typeScale.title3, styles.centeredTitle, { color: colors.textPrimary }]}>
            Kon boodschappenlijst niet laden
          </Text>
          <View style={styles.actionButton}>
            <Button
              label="Opnieuw proberen"
              variant="secondary"
              onPress={refresh}
              accessibilityLabel="Boodschappenlijst opnieuw laden"
            />
          </View>
        </View>
      ) : null}

      {phase === 'ready' && items.length === 0 ? (
        <NothingPlannedState onBrowseRecipes={() => router.push('/recipes')} />
      ) : null}

      {phase === 'ready' && items.length > 0 ? (
        <>
          {allChecked ? <AllCheckedBanner itemCount={items.length} /> : null}
          <FlatList
            data={items}
            keyExtractor={(item: ShoppingListItem) => item.name}
            renderItem={({ item }: { item: ShoppingListItem }) => (
              <ShoppingListRow item={item} checked={checkedNames.has(item.name)} onToggle={() => handleToggle(item.name)} />
            )}
            contentContainerStyle={styles.listContent}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Private sub-components — same "small, in-file pieces" shape as
// recipes.tsx's LoadingGrid/LibraryHeader and settings.tsx's EatersSection.
// ---------------------------------------------------------------------------

interface HeaderProps {
  readonly onClose: () => void;
  /** `describeShoppingListMealCount`'s output, or null while there is nothing to summarize yet. */
  readonly subtitle: string | null;
}

function Header(props: HeaderProps): JSX.Element {
  const { onClose, subtitle } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>Boodschappen</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Sluiten, terug naar vorig scherm"
          style={styles.closeButton}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Sluiten</Text>
        </Pressable>
      </View>
      {subtitle !== null ? <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const LOADING_ROW_COUNT = 6;

/** Loading state: flat surfaceSunken bars, no shimmer — same treatment as recipes.tsx's LoadingGrid. */
function LoadingRows(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const placeholders = Array.from({ length: LOADING_ROW_COUNT }, (_, index) => index);

  return (
    <View style={styles.loadingList} accessibilityLabel="Boodschappenlijst laden" accessible>
      {placeholders.map((index) => (
        <View key={index} style={[styles.loadingRow, { backgroundColor: colors.surfaceSunken }]} />
      ))}
    </View>
  );
}

interface NothingPlannedStateProps {
  readonly onBrowseRecipes: () => void;
}

/** "Nothing planned this week" — see shoppingListCopy.ts's describeShoppingListNothingPlanned for why this is a distinct state from AllCheckedBanner below. */
function NothingPlannedState(props: NothingPlannedStateProps): JSX.Element {
  const { onBrowseRecipes } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const copy = describeShoppingListNothingPlanned();

  return (
    <View style={styles.centered}>
      <Text style={[typeScale.title2, styles.centeredTitle, { color: colors.textPrimary }]}>{copy.title}</Text>
      <Text style={[typeScale.bodySmall, styles.centeredBody, { color: colors.textMuted }]}>{copy.body}</Text>
      <View style={styles.actionButton}>
        <Button
          label="Naar Mijn recepten"
          variant="secondary"
          onPress={onBrowseRecipes}
          accessibilityLabel="Naar Mijn recepten om iets voor deze week te plannen"
        />
      </View>
    </View>
  );
}

interface AllCheckedBannerProps {
  readonly itemCount: number;
}

/** "Everything already ticked off" — a positive-toned banner ABOVE the still-visible list, never a replacement for it (see this file's header). */
function AllCheckedBanner(props: AllCheckedBannerProps): JSX.Element {
  const { itemCount } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const copy = describeShoppingListAllChecked(itemCount);

  return (
    <View style={[styles.banner, { backgroundColor: colors.positiveMuted }]}>
      {/* positive/textSecondary on positiveMuted — both pairs already
          guarded by tests/contrast.test.ts's TEXT_ON_FILL cases. */}
      <Text style={[typeScale.title3, { color: colors.positive }]}>{copy.title}</Text>
      <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{copy.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space2,
    paddingBottom: spacing.space4,
    gap: spacing.space2,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space3,
  },
  title: {
    flexShrink: 1,
  },
  closeButton: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    paddingLeft: spacing.space2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  centeredTitle: {
    marginBottom: spacing.space2,
    textAlign: 'center',
  },
  centeredBody: {
    textAlign: 'center',
  },
  actionButton: {
    marginTop: spacing.space6,
    minWidth: 220,
  },
  listContent: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.space10,
  },
  loadingList: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.space3,
  },
  loadingRow: {
    height: spacing.space10,
    borderRadius: radii.radiusSm,
  },
  banner: {
    marginHorizontal: spacing.screenPaddingHorizontal,
    marginBottom: spacing.space3,
    padding: spacing.space4,
    borderRadius: radii.radiusMd,
    gap: spacing.space1,
  },
});

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
 * src/lib/repository/local/saves.ts) drops a save on either of two facts,
 * and both of them are reasons this list would otherwise buy food nobody
 * wanted. It drops a save once its meal has been cooked since — once
 * dinner happened, there is nothing left to shop for, and continuing to
 * list its ingredients would make a shopper re-buy what they already have.
 * And it drops a save whose meal the household has ARCHIVED: "Verwijderen"
 * in Mijn recepten does not touch saves, so until that filter existed a
 * dish somebody had deliberately removed kept its ingredients on this list
 * forever, with no act available to anybody that could take them off. That
 * check lives at the repository and NOT in this file, which is the whole
 * point of stating the definition here once: a filter this screen applied
 * privately would be a second definition of the week, and /deze-week would
 * still be showing the dish this list had quietly stopped buying for. A
 * meal saved twice with the same intent
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
 * NAVIGATION, AND THE SIBLING THIS SCREEN NOW HAS. This paragraph used to
 * say the route was deliberately wired into nothing, its entry point owned
 * by whoever added one. It has been wired twice since: `LibraryHeader` puts
 * the way in on Mijn recepten's title line, and LIB-06 added a door out to
 * `/deze-week` — the plan this list is built from.
 *
 * THAT DOOR IS A `replace`, NOT A `push`, because the two screens are
 * siblings rather than parent and child. Both read the one query stated
 * above, so moving between them switches which reading of the week you are
 * looking at; it does not descend into anything. Pushing would stack
 * list-on-plan-on-list and leave "Sluiten" walking back through a corridor
 * of alternating views of the same seven days, while replacing keeps the
 * stack one deep so "Sluiten" always lands back on Mijn recepten.
 *
 * IT IS THE DERIVED VIEW THAT HOLDS THE ENTRY POINT, WHICH IS BACKWARDS.
 * Mijn recepten's one door says "Boodschappen", so a household meets the
 * ingredients before the plan they came from. The better arrangement is the
 * reverse — plan first, list one step on from it — but LibraryHeader.tsx is
 * owned by another change in flight, so this is recorded rather than taken.
 *
 * Either route still works standing alone: expo-router mounts every file
 * under src/app as a route whether or not `_layout.tsx`'s `<Stack>`
 * declares it — see that file's own `AuthGate` comment.
 */

import { useCallback, useState, type JSX } from 'react';
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
import { hapticValueMoved } from '@/lib/haptics';
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

  /**
   * The research never looked at this screen (STYLING-PLAN.md: neither WS4
   * nor WS5 has a single mention of `boodschappen`), so the haptic is read
   * off WS5 §3.2's vocabulary rather than lifted from a row of its table.
   * Checking an item off is "a value moved, and it is reversible" — the
   * definition of `selectionAsync`, and the same style a cook step gets.
   *
   * ON CHECK ONLY, matching `Chip` and `SegmentedControl`. Unchecking
   * corrects a mistake; it does not do the shopping. It also matters more
   * here than anywhere else that the buzz means one thing: this is the only
   * screen in the product used standing up, one-handed, in a supermarket,
   * where the phone is being looked at in glances and the hand is doing
   * most of the reading.
   */
  const handleToggle = useCallback((name: string): void => {
    // Read from the module-level mirror rather than from inside the
    // updater below, and this is not a style preference: React may call a
    // state updater more than once for a single dispatch (StrictMode does
    // it deliberately), so a haptic fired in there buzzes twice for one
    // tap in development and is a latent double-buzz in production. The
    // updater stays pure; the side effect happens exactly once, here.
    // `sessionCheckedItemNames` is kept in step with the state on every
    // toggle, so it is the same set `current` is about to be.
    if (!sessionCheckedItemNames.has(name)) {
      hapticValueMoved();
    }
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
      <Header
        onClose={() => router.back()}
        onOpenWeekPlan={() => router.replace('/deze-week')}
        subtitle={subtitle}
      />

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
  /** Switches to `/deze-week`, the plan this list is derived from. See this file's NAVIGATION note on why it replaces rather than pushes. */
  readonly onOpenWeekPlan: () => void;
  /** `describeShoppingListMealCount`'s output, or null while there is nothing to summarize yet. */
  readonly subtitle: string | null;
}

function Header(props: HeaderProps): JSX.Element {
  const { onClose, onOpenWeekPlan, subtitle } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>Boodschappen</Text>
        {/*
         * "Deze week" is a door to the other reading of this same query, so
         * it is quiet muted text on the title line rather than a button in
         * an action slot — LibraryHeader.tsx's rule, argued there: the
         * title line carries doors out of a screen, the action slot carries
         * things you do TO it. It sits before "Sluiten" because leaving is
         * always the last thing on the line.
         */}
        <Pressable
          onPress={onOpenWeekPlan}
          accessibilityRole="button"
          accessibilityLabel="Deze week, wat je gepland hebt"
          style={styles.headerLink}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Deze week</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Sluiten, terug naar vorig scherm"
          style={styles.headerLink}
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
  /** Shared by both title-line doors ("Deze week", "Sluiten") — one shape, so neither reads as the more important of the two. */
  headerLink: {
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

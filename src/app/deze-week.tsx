/**
 * Deze week — what the household has actually planned, as a list (LIB-06).
 *
 * A household could already mark a recipe "deze week" from Mijn recepten,
 * and that mark already fed two things: the decision engine's
 * `pendingThisWeekSaves` boost, and the shopping list. What it never fed
 * was a view of the week itself, so the plan existed only as a scattering
 * of badges across a library grid and as a pile of ingredients one screen
 * further on. This closes that loop rather than opening a new surface.
 *
 * ---
 *
 * IT READS THE SAME QUERY AS THE SHOPPING LIST, AND THAT IS THE WHOLE
 * DESIGN. `listPendingSaves(householdId, 'this_week')` — the definition
 * src/app/boodschappen.tsx states once, in its own header, in as many
 * words. Nothing here re-derives, re-filters or supplements it. A second
 * definition of "deze week" is precisely how a plan and the list it fills
 * start disagreeing, and the household is then holding ingredients for a
 * dinner its own plan no longer shows. The ordering, de-duplication and
 * counting all happen in src/domain/weekPlan.ts, which is pure and tested
 * and which narrows nothing it is given; this file fetches and renders.
 *
 * THE COUNT IN THE HEADER IS THE SAME NUMBER BOODSCHAPPEN QUOTES.
 * `WeekPlan.plannedMealCount` is distinct meal ids across those saves —
 * exactly `uniqueMealIds(saves).length` there — including the ones this
 * screen could not draw a row for. Counting only the drawable rows would
 * let two screens quote different sizes for one week; see weekPlan.ts's
 * header on unresolved meals.
 *
 * ---
 *
 * WHY THIS IS NOT A FIFTH TAB. DESIGN.md's rule, restated in PD-014 and
 * again in PD-018: a tab exists for a distinct QUESTION a household asks,
 * never for a distinct kind of content. "Wat eten we deze week" is not a
 * fifth question — it is Mijn recepten's own question ("wat heb ik, en wat
 * staat er gepland") with one filter applied. That tab already sorts
 * `deze_week` to the top and labels every tile with its scheduling state
 * (`recipeScheduling.ts`), so the week is ALREADY a section of the answer
 * that tab gives; promoting a filtered view of an existing list to a tab of
 * its own is the definition of a tab for a kind of content. And a tab
 * beside Kiezen answering "what are we eating" over a different horizon
 * would put two decision surfaces next to each other, blurring which one
 * the product is for — PD-014 condition 1 keeps Kiezen first precisely
 * because tab order is a claim about priority.
 *
 * SO IT SITS WHERE BOODSCHAPPEN SITS: a full-screen route one level in from
 * Mijn recepten, tab bar and all. The two are siblings, not parent and
 * child — one query, two readings of it — which is also why moving between
 * them uses `router.replace` rather than `push`. Pushing would stack
 * plan-on-list-on-plan and leave "Sluiten" walking a corridor of
 * alternating views of the same week; replacing swaps one reading for the
 * other, so the back gesture and "Sluiten" always land back on Mijn
 * recepten.
 *
 * ITS ENTRY POINT TODAY IS THE SHOPPING LIST, AND THAT IS BACKWARDS.
 * `LibraryHeader` puts one door on Mijn recepten's title line and it says
 * "Boodschappen", so a household reaches the derived view first and the
 * plan behind it second. The right arrangement is the reverse — plan first,
 * list one step on from it — but LibraryHeader.tsx belongs to another
 * change in flight; this file therefore adds the "Deze week" door to
 * boodschappen.tsx and the wish is reported rather than silently taken.
 * Standing alone at `/deze-week` in the meantime is exactly how
 * `/boodschappen` itself shipped: expo-router mounts every file under
 * src/app whether or not `_layout.tsx`'s `<Stack>` declares it.
 *
 * ---
 *
 * "VAN DEZE WEEK AF" EXISTS NOW, AND THE PARAGRAPH THAT USED TO STAND HERE
 * IS GONE RATHER THAN AMENDED. It argued that this screen had to ship
 * without the obvious action a plan view needs, because `RemyRepository`
 * had `createSave` and nothing that withdrew one — and that building the
 * button anyway would have meant inventing a persistence seam inside a
 * screen, the same thing boodschappen.tsx refused to do for check-off
 * state. The seam was the right thing to ask for and it exists:
 * `removeSaves(householdId, mealId, intent)`. So the row carries the
 * control, this file calls the repository, and nothing about "deze week" is
 * decided here.
 *
 * THE OTHER EXIT IS STILL THE ONE THAT NEEDS NO BUTTON. Cooking a dish
 * resolves its save, so this list and the shopping list empty themselves
 * through that one act; the footer keeps saying so, in the indicative. Two
 * exits, and only one of them is a thing to do.
 *
 * AN ARCHIVED DISH CAN NO LONGER STAND HERE AT ALL. It used to —
 * `listPendingSaves` did not read `meals.archived_at`, so a dish removed
 * from Mijn recepten kept its "deze week" save and kept its ingredients on
 * the shopping list, and this screen carried an amber note admitting it.
 * The repository filters those saves now (see local/saves.ts), so the note,
 * its copy and the flag on `WeekPlanEntry` are all gone with the bug.
 */

import { useCallback, useReducer, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { AccessibilityInfo, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HouseholdId, Meal, MealId, SaveIntent } from '@/domain/types';
import { buildWeekPlan, type WeekPlan, type WeekPlanEntry } from '@/domain/weekPlan';
import { Button } from '@/components/Button';
import { WeekPlanRow } from '@/components/WeekPlanRow';
import {
  INITIAL_WEEK_PLAN_REMOVAL,
  WEEK_PLAN_COOKED_NOTE,
  WEEK_PLAN_EMPTY_BODY,
  WEEK_PLAN_EMPTY_TITLE,
  WEEK_PLAN_END_COPY,
  WEEK_PLAN_REMOVE_FAILED_ANNOUNCEMENT,
  WEEK_PLAN_SHOPPING_LINE,
  describeWeekPlanMealCount,
  describeWeekPlanRemovedAnnouncement,
  describeWeekPlanUnresolvedNote,
  reduceWeekPlanRemoval,
} from '@/components/weekPlanCopy';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

const EMPTY_PLAN: WeekPlan = { entries: [], unresolvedMealIds: [], plannedMealCount: 0 };

/**
 * The one intent this screen reads and the one it writes, named once so the
 * two can never drift apart. Reading `'this_week'` and removing `'someday'`
 * would be a screen that shows one week and cancels another — and a
 * household's separate "ooit" commitment to the same dish is deliberately
 * left standing here (see `removeSaves` on `RemyRepository`).
 */
const WEEK_PLAN_INTENT: SaveIntent = 'this_week';

// ---------------------------------------------------------------------------
// Data loading — repository reads, then one call into the pure domain layer.
// ---------------------------------------------------------------------------

/** The plan plus the household it belongs to — the removal write needs the second. */
interface LoadedWeek {
  readonly householdId: HouseholdId;
  readonly plan: WeekPlan;
}

/**
 * `getMeal` per planned dish rather than `listHouseholdMeals`. That used to
 * be an argument about archived dishes — the repository settles those now,
 * before a save ever reaches this function. What still makes a per-id read
 * the right one is `unresolvedMealIds`: the ids come from saves, and a save
 * whose meal row is GONE has to be reported rather than silently dropped
 * (the shopping list still counts it), which a list read cannot tell apart
 * from a meal that simply was not in the list. The `Set` here only avoids
 * fetching one meal twice; the authoritative de-duplication is
 * `buildWeekPlan`'s.
 */
async function loadWeekPlan(): Promise<LoadedWeek> {
  await ensureSeeded();
  const repository = getAppRepository();
  const householdId = await repository.getCurrentHouseholdId();
  const saves = await repository.listPendingSaves(householdId, WEEK_PLAN_INTENT);
  const mealIds = [...new Set(saves.map((save) => save.mealId))];

  const fetched = await Promise.all(mealIds.map((mealId) => repository.getMeal(mealId)));
  const meals = fetched.filter((meal): meal is Meal => meal !== null);

  return { householdId, plan: buildWeekPlan(saves, meals) };
}

/**
 * The plan with one dish taken out, WITHOUT a re-fetch.
 *
 * `plannedMealCount` is recomputed with the identical expression
 * `buildWeekPlan` uses — entries plus unresolved — rather than decremented,
 * because that number is the one src/app/boodschappen.tsx quotes for the
 * same week and a count maintained by subtraction is a count that drifts.
 * Updating locally rather than calling `refresh()` avoids throwing the whole
 * list back into its loading state over one removed row, exactly as
 * (tabs)/recipes.tsx does after an archive; the next focus re-reads anyway.
 */
function withoutDish(plan: WeekPlan, mealId: MealId): WeekPlan {
  const entries = plan.entries.filter((entry) => entry.meal.id !== mealId);
  return { ...plan, entries, plannedMealCount: entries.length + plan.unresolvedMealIds.length };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function WeekPlanScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [plan, setPlan] = useState<WeekPlan>(EMPTY_PLAN);
  const [householdId, setHouseholdId] = useState<HouseholdId | null>(null);

  // ONE ARMED ROW AT A TIME, WHICH IS WHY THIS LIVES HERE AND NOT IN
  // `WeekPlanRow`. A row owning its own confirm state would let somebody arm
  // three dinners, walk away, and come back to a screen holding three
  // half-asked questions. `removalMealId` names the single row the state
  // below belongs to; every other row is handed `INITIAL_WEEK_PLAN_REMOVAL`.
  const [removalMealId, setRemovalMealId] = useState<MealId | null>(null);
  const [removal, dispatchRemoval] = useReducer(reduceWeekPlanRemoval, INITIAL_WEEK_PLAN_REMOVAL);

  const refresh = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    loadWeekPlan()
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setPlan(loaded.plan);
        setHouseholdId(loaded.householdId);
        // A reload replaces the rows, so any confirm still standing belongs
        // to a row that may not be here any more.
        setRemovalMealId(null);
        dispatchRemoval({ type: 'reset' });
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

  // ---------------------------------------------------------------------------
  // "Van deze week af" — the row's second action. See weekPlanCopy.ts's header
  // for what its sentences promise and this file's for why it exists at all.
  // ---------------------------------------------------------------------------

  const handleRequestRemoval = useCallback((mealId: MealId): void => {
    // `reset` first so arming a second row cannot inherit the first row's
    // phase — `reduceWeekPlanRemoval` ignores `request-removal` from
    // `pending`, and silently doing nothing is the one outcome a person
    // cannot interpret.
    setRemovalMealId(mealId);
    dispatchRemoval({ type: 'reset' });
    dispatchRemoval({ type: 'request-removal' });
  }, []);

  const handleCancelRemoval = useCallback((): void => {
    dispatchRemoval({ type: 'cancel-removal' });
  }, []);

  /**
   * No rollback and no re-read: `removeSaves` is one read and one write, so
   * it either lands or leaves every save exactly where it was — which is
   * precisely what `WEEK_PLAN_REMOVE_FAILED_NOTE` tells the household. On
   * success the row leaves the list; on failure the control itself becomes
   * the retry, matching (tabs)/recipes.tsx's archive path.
   */
  const commitRemoval = useCallback(
    async (entry: WeekPlanEntry): Promise<void> => {
      if (householdId === null || removal.phase !== 'confirming') {
        return;
      }
      dispatchRemoval({ type: 'confirm-removal' });

      try {
        await getAppRepository().removeSaves(householdId, entry.meal.id, WEEK_PLAN_INTENT);
      } catch {
        dispatchRemoval({ type: 'removal-failed' });
        AccessibilityInfo.announceForAccessibility(WEEK_PLAN_REMOVE_FAILED_ANNOUNCEMENT);
        return;
      }

      setPlan((current) => withoutDish(current, entry.meal.id));
      setRemovalMealId(null);
      dispatchRemoval({ type: 'reset' });
      AccessibilityInfo.announceForAccessibility(describeWeekPlanRemovedAnnouncement(entry.meal.title));
    },
    [householdId, removal.phase],
  );

  // Re-read on focus, like boodschappen.tsx: cooking a dish from this very
  // list resolves its save, so the week is stale the moment Cook Mode hands
  // the screen back.
  useFocusEffect(refresh);

  const isPlanned = phase === 'ready' && plan.plannedMealCount > 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Header
        onClose={() => router.back()}
        subtitle={isPlanned ? describeWeekPlanMealCount(plan.plannedMealCount) : null}
        unresolvedNote={
          isPlanned && plan.unresolvedMealIds.length > 0
            ? describeWeekPlanUnresolvedNote(plan.unresolvedMealIds.length)
            : null
        }
      />

      {phase === 'loading' ? <LoadingRows /> : null}

      {phase === 'error' ? (
        <View style={styles.centered}>
          <Text style={[typeScale.title3, styles.centeredTitle, { color: colors.textPrimary }]}>
            Kon deze week niet laden
          </Text>
          <View style={styles.actionButton}>
            <Button
              label="Opnieuw proberen"
              variant="secondary"
              onPress={refresh}
              accessibilityLabel="Deze week opnieuw laden"
            />
          </View>
        </View>
      ) : null}

      {phase === 'ready' && plan.plannedMealCount === 0 ? (
        <NothingPlannedState onBrowseRecipes={() => router.push('/recipes')} />
      ) : null}

      {isPlanned ? (
        <FlatList
          data={plan.entries}
          keyExtractor={(entry: WeekPlanEntry) => entry.meal.id}
          // FlatList's rows are pure by default, so the armed row would keep
          // drawing "Van deze week af" without this. A string rather than an
          // object literal: it changes exactly when the armed row or its
          // phase does, instead of on every render of the screen.
          extraData={`${removalMealId ?? ''}:${removal.phase}`}
          renderItem={({ item }: { item: WeekPlanEntry }) => (
            <WeekPlanRow
              entry={item}
              onPress={() => router.push(`/cook/${item.meal.id}`)}
              removal={item.meal.id === removalMealId ? removal : INITIAL_WEEK_PLAN_REMOVAL}
              onRequestRemoval={() => handleRequestRemoval(item.meal.id)}
              onCancelRemoval={handleCancelRemoval}
              onConfirmRemoval={() => {
                void commitRemoval(item);
              }}
            />
          )}
          ListFooterComponent={<PlanFooter onOpenShoppingList={() => router.replace('/boodschappen')} />}
          contentContainerStyle={styles.listContent}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Private sub-components — the same "small, in-file pieces" shape
// boodschappen.tsx and recipes.tsx already use.
// ---------------------------------------------------------------------------

interface HeaderProps {
  readonly onClose: () => void;
  /** `describeWeekPlanMealCount`'s output, or null while there is nothing to count. */
  readonly subtitle: string | null;
  /** `describeWeekPlanUnresolvedNote`'s output, or null in the ordinary case where every planned dish could be read. */
  readonly unresolvedNote: string | null;
}

function Header(props: HeaderProps): JSX.Element {
  const { onClose, subtitle, unresolvedNote } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>Deze week</Text>
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
      {/* Sits directly under the count it explains, because it is the only
          reason that count can exceed the rows below it. */}
      {unresolvedNote !== null ? (
        <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{unresolvedNote}</Text>
      ) : null}
    </View>
  );
}

/**
 * Three bars, not boodschappen's six. A loading placeholder is a guess about
 * how much is coming, and a household plans a handful of dinners a week, not
 * a shelf of groceries — a tall stack here would promise a list most weeks
 * cannot deliver, which is the failure PD-018 names for empty states and
 * which a loading state can commit just as easily. Flat `surfaceSunken`, no
 * shimmer, matching recipes.tsx's LoadingGrid.
 */
const LOADING_ROW_COUNT = 3;

function LoadingRows(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const placeholders = Array.from({ length: LOADING_ROW_COUNT }, (_, index) => index);

  return (
    <View style={styles.loadingList} accessibilityLabel="Deze week laden" accessible>
      {placeholders.map((index) => (
        <View key={index} style={[styles.loadingRow, { backgroundColor: colors.surfaceSunken }]} />
      ))}
    </View>
  );
}

interface NothingPlannedStateProps {
  readonly onBrowseRecipes: () => void;
}

/**
 * Nothing has an active "deze week" save. The common state early on, and
 * PD-018's posture applies in full: a fact and a way forward, never a zero,
 * never a placeholder row, never a count of nothing.
 *
 * IT POINTS AT MIJN RECEPTEN, NOT AT THE SHOPPING LIST. Both screens are
 * empty at the same moment, for the same reason, so sending somebody from
 * one to the other is a corridor rather than an answer; planning is the act
 * that ends this state, and planning happens on a recipe.
 */
function NothingPlannedState(props: NothingPlannedStateProps): JSX.Element {
  const { onBrowseRecipes } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.centered}>
      <Text style={[typeScale.title2, styles.centeredTitle, { color: colors.textPrimary }]}>
        {WEEK_PLAN_EMPTY_TITLE}
      </Text>
      <Text style={[typeScale.bodySmall, styles.centeredBody, { color: colors.textMuted }]}>{WEEK_PLAN_EMPTY_BODY}</Text>
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

interface PlanFooterProps {
  readonly onOpenShoppingList: () => void;
}

/**
 * Where the loop is actually stated. The list ends and says so (PD-018's
 * shape), then the two sentences that name the relationship this screen
 * exists to make visible: what stands here is what the shopping list buys,
 * and cooking is what empties both. The door to the list sits between them
 * rather than in the header, because it is the thing you do AFTER reading
 * the plan — a header button would invite leaving before looking.
 */
function PlanFooter(props: PlanFooterProps): JSX.Element {
  const { onOpenShoppingList } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.footer}>
      <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{WEEK_PLAN_END_COPY}</Text>
      <View style={[styles.footerBlock, { borderColor: colors.border }]}>
        <Text style={[typeScale.body, { color: colors.textPrimary }]}>{WEEK_PLAN_SHOPPING_LINE}</Text>
        <View style={styles.footerButton}>
          <Button
            label="Naar boodschappen"
            variant="primary"
            onPress={onOpenShoppingList}
            accessibilityLabel="Naar boodschappen, de lijst voor wat je deze week gepland hebt"
          />
        </View>
        <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>{WEEK_PLAN_COOKED_NOTE}</Text>
      </View>
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
  footer: {
    paddingTop: spacing.space4,
    gap: spacing.space4,
  },
  footerBlock: {
    borderWidth: 1,
    borderRadius: radii.radiusMd,
    padding: spacing.space4,
    gap: spacing.space3,
  },
  footerButton: {
    minWidth: 220,
  },
});

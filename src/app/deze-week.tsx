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
 * THERE IS NO "VAN DE LIJST AF" BUTTON, AND ITS ABSENCE IS A REPORTED GAP
 * RATHER THAN AN OVERSIGHT. `RemyRepository` (src/lib/repository/types.ts)
 * has `createSave` and nothing that withdraws, retracts or re-intends one;
 * `archiveMeal` removes a dish from the library and does not touch its
 * save, which is why an archived dish can still be standing here (see
 * `WeekPlanRow`'s amber note). Building the button anyway would mean
 * inventing a persistence seam inside a screen — the same thing
 * boodschappen.tsx refused to do for check-off state. So the screen is
 * built around what exists: cooking a dish resolves its save, and both this
 * list and the shopping list empty themselves through that one act. The
 * footer says so in the indicative rather than offering a control that
 * cannot work.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Meal } from '@/domain/types';
import { buildWeekPlan, type WeekPlan, type WeekPlanEntry } from '@/domain/weekPlan';
import { Button } from '@/components/Button';
import { WeekPlanRow } from '@/components/WeekPlanRow';
import {
  WEEK_PLAN_COOKED_NOTE,
  WEEK_PLAN_EMPTY_BODY,
  WEEK_PLAN_EMPTY_TITLE,
  WEEK_PLAN_END_COPY,
  WEEK_PLAN_SHOPPING_LINE,
  describeWeekPlanMealCount,
  describeWeekPlanUnresolvedNote,
} from '@/components/weekPlanCopy';
import { ensureSeeded, getAppRepository } from '@/lib/repository';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';

const EMPTY_PLAN: WeekPlan = { entries: [], unresolvedMealIds: [], plannedMealCount: 0 };

// ---------------------------------------------------------------------------
// Data loading — repository reads, then one call into the pure domain layer.
// ---------------------------------------------------------------------------

/**
 * `getMeal` per planned dish rather than `listHouseholdMeals`, deliberately:
 * that method filters `archivedAt === null`, so a dish the household removed
 * from Mijn recepten while its "deze week" save still stood would vanish from
 * this screen while its ingredients stayed on the shopping list — two screens,
 * two different weeks. The `Set` here only avoids fetching one meal twice; the
 * authoritative de-duplication is `buildWeekPlan`'s.
 */
async function loadWeekPlan(): Promise<WeekPlan> {
  await ensureSeeded();
  const repository = getAppRepository();
  const householdId = await repository.getCurrentHouseholdId();
  const saves = await repository.listPendingSaves(householdId, 'this_week');
  const mealIds = [...new Set(saves.map((save) => save.mealId))];

  const fetched = await Promise.all(mealIds.map((mealId) => repository.getMeal(mealId)));
  const meals = fetched.filter((meal): meal is Meal => meal !== null);

  return buildWeekPlan(saves, meals);
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

  const refresh = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    loadWeekPlan()
      .then((loaded) => {
        if (cancelled) {
          return;
        }
        setPlan(loaded);
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
          renderItem={({ item }: { item: WeekPlanEntry }) => (
            <WeekPlanRow entry={item} onPress={() => router.push(`/cook/${item.meal.id}`)} />
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

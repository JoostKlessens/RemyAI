/**
 * The Vanavond screen's one load: everything `decide()` needs for the
 * evening, fetched once, plus today's persisted decision row.
 *
 * EXTRACTED FROM src/app/(tabs)/index.tsx ON 10 SEPTEMBER 2026, with GAP-34,
 * for two reasons that point the same way. That file stood at 825 lines
 * against the 800 cap (docs/LONGLIST.md OPS-16) and GAP-34 needed one more
 * read in it; and a loader inside a route module is unfalsifiable — vitest
 * cannot import src/app (offerablePool.ts's header measured this) — while
 * one under src/lib at least can be. The body is the screen's own, moved
 * and split at its two read boundaries — `readHouseholdData` and
 * `readDecisionContext` are its two `Promise.all`s, taken out so no part
 * exceeds the 50-line rule — and the only behavioural
 * change is the ingredient read that feeds `ingredientsByMeal`.
 */

import { decide, type DecisionRequestWithProof } from '@/domain/decide';
import { groupIngredientsByMeal, type IngredientsByMeal } from '@/domain/dislikedIngredients';
import { NO_DECISION_FILTERS } from '@/domain/exclusions';
import { selectOfferableMeals } from '@/domain/offerablePool';
import type { Decision, HouseholdId, Meal, MealId } from '@/domain/types';
import { loadFriendProof } from '@/lib/friendProof';
import { daysAgoIso, ensureSeeded, getAppRepository, todayIso } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';

/** How far back "recent" decisions/cook history reach for novelty-tier classification — see novelty.ts. */
const RECENT_DECISIONS_LOOKBACK_DAYS = 60;

export interface LiveSession {
  readonly householdId: HouseholdId;
  /**
   * PD-009: `filters` is omitted alongside `excludedMealIds` because both
   * change *within* a session without any reload. The loaded household data
   * is the stable part; what the user asks for tonight is not, and baking a
   * filter into `requestBase` would mean re-fetching the whole household to
   * un-tap a chip.
   */
  readonly requestBase: Omit<DecisionRequestWithProof, 'excludedMealIds' | 'filters'>;
  readonly decisionRow: Decision | null;
  readonly mealById: ReadonlyMap<MealId, Meal>;
  /**
   * The meals tonight's chips are allowed to describe: `selectOfferableMeals`
   * (src/domain/offerablePool.ts), the household's standing gates already
   * applied. THE POOL, NOT THE CHIPS — until 9 September 2026 this held two
   * arrays of tags and moods collected here, once, at load, and the bar
   * re-offered all of them after every tap (docs/LONGLIST.md GAP-33: choose
   * two chips no dish shares and the answer is `filtered_out` with nothing
   * saying which chip did it). The chips are now derived per render in
   * `VanavondScreen`, against the filters the household has set — session
   * state this loader cannot see, for the reason `requestBase` omits it.
   */
  readonly offerableMeals: readonly Meal[];
}

type AppRepository = ReturnType<typeof getAppRepository>;

/** The local reads every evening starts with, in one round trip. */
interface HouseholdData {
  readonly household: NonNullable<Awaited<ReturnType<AppRepository['getHousehold']>>>;
  readonly members: Awaited<ReturnType<AppRepository['listMembers']>>;
  readonly restrictions: Awaited<ReturnType<AppRepository['listRestrictions']>>;
  readonly candidateMeals: readonly Meal[];
  /** GAP-34: the rows behind `candidateMeals`, keyed by meal, so a typed dislike can read what a dish is made of. */
  readonly ingredientsByMeal: IngredientsByMeal;
  readonly recentCookEvents: Awaited<ReturnType<AppRepository['listCookEvents']>>;
  readonly thisWeekSaves: Awaited<ReturnType<AppRepository['listPendingSaves']>>;
  readonly somedaySaves: Awaited<ReturnType<AppRepository['listPendingSaves']>>;
}

async function readHouseholdData(repository: AppRepository, householdId: HouseholdId): Promise<HouseholdData> {
  const [household, members, restrictions, candidateMeals, ingredientRows, recentCookEvents, thisWeekSaves, somedaySaves] =
    await Promise.all([
      repository.getHousehold(householdId),
      repository.listMembers(householdId),
      repository.listRestrictions(householdId),
      repository.listHouseholdMeals(householdId),
      repository.listHouseholdMealIngredients(householdId),
      repository.listCookEvents(householdId),
      repository.listPendingSaves(householdId, 'this_week'),
      repository.listPendingSaves(householdId, 'someday'),
    ]);
  if (household === null) {
    throw new Error('Household not found after seeding.');
  }
  return {
    household,
    members,
    restrictions,
    candidateMeals,
    ingredientsByMeal: groupIngredientsByMeal(ingredientRows),
    recentCookEvents,
    thisWeekSaves,
    somedaySaves,
  };
}

type DecisionContext = readonly [
  Awaited<ReturnType<AppRepository['listRecentDecisions']>>,
  Awaited<ReturnType<typeof loadFriendProof>>,
];

/**
 * In parallel: the last local read, and the one remote read this screen
 * makes. `loadFriendProof` never rejects (see its header) so it cannot
 * take the decision down with it, and it is handed the SUPABASE social
 * repository deliberately — cook proof is a cross-household fact living
 * in the `shared_cooks` view, and the local implementation answers `[]`
 * by design ("there is no friend's kitchen in here to read"). Ranglijst
 * already reaches for its own cross-household table this way while the
 * rest of the app is local-first; this is the same seam.
 */
function readDecisionContext(
  repository: AppRepository,
  householdId: HouseholdId,
  candidateMeals: readonly Meal[],
): Promise<DecisionContext> {
  return Promise.all([
    repository.listRecentDecisions(householdId, daysAgoIso(RECENT_DECISIONS_LOOKBACK_DAYS)),
    loadFriendProof(createSupabaseSocialRepository(supabase), candidateMeals),
  ]);
}

export async function loadLiveSession(): Promise<LiveSession> {
  await ensureSeeded();
  const repository = getAppRepository();
  const householdId = await repository.getCurrentHouseholdId();
  const targetDate = todayIso();
  const { household, members, restrictions, candidateMeals, ingredientsByMeal, recentCookEvents, thisWeekSaves, somedaySaves } =
    await readHouseholdData(repository, householdId);
  const [recentDecisions, friendProof] = await readDecisionContext(repository, householdId, candidateMeals);

  const requestBase: Omit<DecisionRequestWithProof, 'excludedMealIds' | 'filters'> = {
    household,
    members,
    restrictions,
    candidateMeals,
    ingredientsByMeal,
    recentCookEvents,
    pendingThisWeekSaves: thisWeekSaves,
    pendingSomedaySaves: somedaySaves,
    recentDecisions,
    targetDate,
    friendProof,
  };

  const existingDecision = await repository.getDecisionByDate(householdId, targetDate);
  const decisionRow = existingDecision ?? (await createTodayDecisionIfSuggested(repository, requestBase, householdId));

  return {
    householdId,
    requestBase,
    decisionRow,
    mealById: new Map(candidateMeals.map((meal) => [meal.id, meal])),
    // PD-009. The chips describe the meals that survive the household's
    // STANDING gates, not the whole library — `selectOfferableMeals` carries
    // the measurement and the claim it corrects. Run once, here, because
    // these gates depend on nothing a chip can change; the per-tap narrowing
    // over this pool is `VanavondScreen`'s. (A private copy of
    // `collectAvailableDishTags` stood below this function until GAP-33
    // closed; the domain's own is what the screen calls now.)
    offerableMeals: selectOfferableMeals(candidateMeals, household, members, restrictions, ingredientsByMeal),
  };
}

async function createTodayDecisionIfSuggested(
  repository: AppRepository,
  requestBase: Omit<DecisionRequestWithProof, 'excludedMealIds' | 'filters'>,
  householdId: HouseholdId,
): Promise<Decision | null> {
  // PD-009, deliberately unfiltered: this is the household's offer *for the
  // day* — the row the scheduled Edge Function will eventually write at
  // 16:00, before anyone has touched a chip. Persisting a filtered offer
  // would freeze a passing mood ("iets met soep", tapped once) into the
  // permanent record of what Remy suggested, and would make the
  // accept-rate metric in plan §8 unreadable. Filters live only in this
  // screen's state and are applied on every subsequent `decide()` below.
  const result = decide({ ...requestBase, excludedMealIds: [], filters: NO_DECISION_FILTERS });
  if (result.kind !== 'suggestion') {
    return null;
  }
  return repository.createDecision({
    householdId,
    decisionDate: requestBase.targetDate,
    mealId: result.mealId,
    initialMealId: result.mealId,
    reasonCode: result.reasonCode,
    reasonText: result.reasonText,
  });
}

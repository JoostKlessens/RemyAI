/**
 * The decision engine's public entry point.
 *
 * `decide(request: DecisionRequest): DecisionResult` is a pure function:
 * no I/O, no `Date.now()`, no `Math.random()`. Every input the engine
 * needs travels in `request`; every output is derived from it
 * deterministically. This is what makes the same household + same
 * `targetDate` reproducible for debugging, and what lets both callers
 * (the scheduled Edge Function and the "Iets anders" swap endpoint,
 * see docs/ARCHITECTURE.md) share one implementation.
 *
 * The six steps below mirror the product brief exactly:
 *   1. Hard exclusions          -> exclusions.ts
 *   2. Scoring the survivors    -> scoring.ts
 *   3. The novelty ratio        -> novelty.ts
 *   4. Reason text              -> reason.ts
 *   5. alternativesRemaining    -> computeAlternativesRemaining (below)
 *   6. No candidate             -> the three early returns below
 */

import { excludeAlreadyOffered, filterByRestrictionsAndTimeBudget, filterUnarchived } from './exclusions';
import {
  buildNoveltySeed,
  classifyNoveltyTier,
  pickTierWithFallback,
  selectNoveltyTier,
  type NoveltyTier,
} from './novelty';
import { buildReasonText, type ReasonContext } from './reason';
import { scoreMeals, type ScoredMeal } from './scoring';
import type { DecisionRequest, DecisionResult, IsoDateTimeString, Meal, MealId, Save } from './types';

export function decide(request: DecisionRequest): DecisionResult {
  const unarchived = filterUnarchived(request.candidateMeals);
  if (unarchived.length === 0) {
    // No unarchived meals at all -- nothing has ever been pasted/saved yet.
    return { kind: 'no_candidate', reason: 'empty_rotation' };
  }

  const restrictionEligible = filterByRestrictionsAndTimeBudget(
    unarchived,
    request.household,
    request.members,
    request.restrictions,
  );
  if (restrictionEligible.length === 0) {
    // Meals exist, but restrictions/time budget removed every one of them.
    return { kind: 'no_candidate', reason: 'all_excluded' };
  }

  const swapEligible = excludeAlreadyOffered(restrictionEligible, request.excludedMealIds);
  if (swapEligible.length === 0) {
    // Something would have been eligible, but it was already offered
    // today -- PD-001's two-swap cap has been reached.
    return { kind: 'no_candidate', reason: 'swaps_exhausted' };
  }

  const winner = selectWinner(swapEligible, request);

  return {
    kind: 'suggestion',
    mealId: winner.meal.id,
    reasonCode: winner.reasonCode,
    reasonText: buildReasonTextFor(winner, request),
    alternativesRemaining: computeAlternativesRemaining(request.excludedMealIds.length),
  };
}

/**
 * Steps 2 and 3: score the survivors, then pick the seed-selected novelty
 * tier's best -- but only from the "competitive" pool (score > 0).
 *
 * Why the score > 0 filter: the novelty ratio is a target *distribution*
 * across many decisions, not a license to override a strong negative
 * signal within one decision. Without this filter, a meal that took a
 * `wouldRepeat === false` penalty (scoring.ts's WOULD_NOT_REPEAT_PENALTY)
 * could still win outright just by being the sole occupant of whichever
 * tier the seed happened to land on today, even against a far
 * better-scored untried meal in a different tier -- silently
 * re-suggesting food the household explicitly said no to. Restricting
 * tier preference to positively-scored candidates keeps novelty a
 * "which good option to lead with" choice, never a "resurrect a
 * rejected one" mechanism. Every meal that has never been cooked always
 * scores positively (VARIETY_BOOST alone guarantees it -- see
 * scoring.ts), so this filter only ever removes candidates the scoring
 * model has actively soured on, not merely "the ones with no boosts".
 *
 * If literally nothing scores positively (a genuinely bleak candidate
 * set), the tier gate applies to the full scored list instead of
 * returning nothing -- there is still a "least bad" option to serve.
 */
function selectWinner(swapEligible: readonly Meal[], request: DecisionRequest): ScoredMeal {
  const scored = scoreMeals(
    swapEligible,
    request.household,
    request.recentCookEvents,
    request.pendingThisWeekSaves,
    request.targetDate,
    request.pendingSomedaySaves,
  );

  const competitivePool = scored.filter((scoredMeal) => scoredMeal.score > 0);
  const pool = competitivePool.length > 0 ? competitivePool : scored;

  const classified = groupByNoveltyTier(pool, request);
  const seed = buildNoveltySeed(request.household.id, request.targetDate);
  const preferredTier = selectNoveltyTier(seed);
  const tierMembers = pickTierWithFallback(classified, preferredTier);

  // `scored` (and therefore `pool`) is sorted deterministically (score
  // desc, meal id asc) by scoreMeals; grouping by tier preserves that
  // relative order, so the first element of any tier group is already
  // that tier's best pick.
  const winner = tierMembers[0];
  if (winner === undefined) {
    /* c8 ignore next 4 -- unreachable: swapEligible is non-empty here, so
       `pool` covers at least one meal, and pickTierWithFallback always
       finds it in some tier. */
    throw new Error('Novelty tier selection produced no candidate despite a non-empty eligible set.');
  }
  return winner;
}

function groupByNoveltyTier(
  scoredPool: readonly ScoredMeal[],
  request: DecisionRequest,
): ReadonlyMap<NoveltyTier, readonly ScoredMeal[]> {
  const groups = new Map<NoveltyTier, ScoredMeal[]>([
    ['known_rotation', []],
    ['variation', []],
    ['genuinely_new', []],
  ]);
  for (const scoredMeal of scoredPool) {
    const tier = classifyNoveltyTier(
      scoredMeal.meal,
      request.recentCookEvents,
      request.recentDecisions,
      request.candidateMeals,
    );
    groups.get(tier)?.push(scoredMeal);
  }
  return groups;
}

function findSavedAt(mealId: MealId, pendingThisWeekSaves: readonly Save[]): IsoDateTimeString | null {
  const match = pendingThisWeekSaves.find((save) => save.mealId === mealId);
  return match?.savedAt ?? null;
}

/** Step 4: compose the winning meal's Dutch reason text. */
function buildReasonTextFor(winner: ScoredMeal, request: DecisionRequest): string {
  const context: ReasonContext = {
    targetDate: request.targetDate,
    savedAt: findSavedAt(winner.meal.id, request.pendingThisWeekSaves),
    estimatedMinutes: winner.meal.estimatedMinutes,
  };
  return buildReasonText(winner.reasonCode, context);
}

/**
 * Step 5 (PD-001): two swaps maximum. `excludedMealIds` holds every meal
 * already offered today (the original plus any prior swaps), so its
 * length alone tells us how many "Iets anders" taps are left: 2 on the
 * first offer, 1 after the first swap, 0 after the second.
 */
function computeAlternativesRemaining(excludedMealIdCount: number): 0 | 1 | 2 {
  if (excludedMealIdCount <= 0) {
    return 2;
  }
  if (excludedMealIdCount === 1) {
    return 1;
  }
  return 0;
}

/**
 * PD-001 / Finding 3: "the third swap fires a tracked `swap_exhausted`
 * event... it must never be a silent fallback." No analytics pipeline
 * lives in src/domain (see docs/ARCHITECTURE.md — that's a separate,
 * out-of-scope concern), so this module can't fire the event itself. What
 * it CAN do is remove all ambiguity about exactly when a caller should:
 * `alternativesRemaining === 0` on a `suggestion` result only ever happens
 * on the third dish offered today (the original offer always starts at 2,
 * see `computeAlternativesRemaining` above), which is precisely the moment
 * PD-001 means by "the third swap."
 *
 * Exported so the caller that owns the swap UI (a different agent's code)
 * has one unambiguous, testable predicate to call right after receiving
 * the next suggestion — no need to re-derive "0 remaining == exhausted"
 * itself, and no risk of confusing it with the unrelated
 * `{ kind: 'no_candidate', reason: 'swaps_exhausted' }` case, which means
 * "nothing left to offer at all," not "here is the last dish."
 */
export function isSwapExhausted(result: DecisionResult): boolean {
  return result.kind === 'suggestion' && result.alternativesRemaining === 0;
}

/** PD-001's fixed event name, so every caller that fires it agrees on the exact string. */
export const SWAP_EXHAUSTED_EVENT = 'swap_exhausted';

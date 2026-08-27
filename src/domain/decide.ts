/**
 * The decision engine's public entry point.
 *
 * `decide(request: DecisionRequestWithProof): DecisionResult` is a pure
 * function: no I/O, no `Date.now()`, no `Math.random()`. Every input the
 * engine needs travels in `request`; every output is derived from it
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
 *   6. No candidate             -> the four early returns below
 *
 * ---
 *
 * PD-009 — where tonight's filters sit, and why that order:
 *
 * Step 1 now runs three narrowing passes, and their ORDER is the whole
 * point, because whichever one empties the pool is the one the user is
 * told about (see `NoCandidateReason`):
 *
 *   empty_rotation  <- nothing in the library at all
 *   all_excluded    <- the household's standing settings emptied it
 *   filtered_out    <- tonight's stated filters emptied it
 *   swaps_exhausted <- something survived, but it was already offered today
 *
 * Restrictions before filters: if an allergen restriction already removed
 * everything, saying "je filter is te streng" would send someone to relax
 * the one thing they must not, and would imply their allergies are why
 * there's no dinner. The standing settings get named first because they
 * are the deeper cause.
 *
 * Filters before "already offered": if a filter left something and it has
 * merely been offered already, PD-001's two-swap cap is the binding
 * constraint, not the filter — so `swaps_exhausted` and its two exits are
 * the truthful answer. This also closes a loophole: were the order
 * reversed, toggling a chip could keep producing fresh `filtered_out`
 * states and, on relaxing it again, hand out swaps the cap already spent.
 *
 * ---
 *
 * Cook proof (docs/DESIGN-SOCIAL.md §2.1) enters at exactly one point.
 *
 * `request.friendProof` is a map from canonical recipe id to the friends
 * who cooked it, assembled by `assembleFriendProof` (social/proof.ts) from
 * the `shared_cooks` view. It is the single input behind BOTH halves of the
 * social reason, and that is deliberate rather than economical:
 *
 *   - its KEYS become `scoreMeals`' `friendCookedRecipeIds`, which is what
 *     lets FRIEND_PROOF_BOOST fire and `friend_proof` be picked as the
 *     reason code (see `friendCookedRecipeIds` below for why the set is
 *     derived and never supplied separately);
 *   - its VALUES become the winner's `ReasonContext.friendProof`, which is
 *     what turns that code into "Sanne heeft dit ook gemaakt en gaf het
 *     een 8,5."
 *
 * The join is on `Meal.recipeId` and on nothing else. Proof is "we are
 * talking about the same recipe", and a household's own meal row is not
 * that object — so a meal with no canonical recipe (the seeded, curated
 * and hand-entered majority) gets no boost and no social reason, however
 * busy its friends' kitchens are. Matching on title instead would invent
 * an agreement between two households that does not exist.
 */

import {
  excludeAlreadyOffered,
  filterByDecisionFilters,
  filterByRestrictionsAndTimeBudget,
  filterUnarchived,
} from './exclusions';
import {
  buildNoveltySeed,
  classifyNoveltyTier,
  pickTierWithFallback,
  selectNoveltyTier,
  type NoveltyTier,
} from './novelty';
import { buildReasonText, type FriendProofContext, type ReasonContext } from './reason';
import { scoreMeals, type ScoredMeal } from './scoring';
import type { DecisionRequest, DecisionResult, IsoDateTimeString, Meal, MealId, Save } from './types';

/**
 * What the engine actually reads: the shared `DecisionRequest` contract
 * plus tonight's assembled cook proof.
 *
 * WHY THE FIELD IS NOT ON `DecisionRequest` ITSELF. src/domain/types.ts is
 * the frozen contract every other agent builds against, and it has no
 * imports at all — declarations depending on nothing. `FriendProofContext`
 * belongs to reason.ts, which already imports types.ts, so putting the
 * field there would point the contract file at a copy module and close a
 * cycle around it. src/domain/social/types.ts makes the same call from the
 * other side ("neither the decision engine nor the Vanavond screens have
 * any dependency on the social vocabulary"). decide.ts is the one module
 * that legitimately needs both halves and already imports both, so the
 * join belongs here — and `extends` keeps it one shape at every call site,
 * not a second request object to keep in step.
 *
 * WHY THE FIELD IS REQUIRED AND NOT `friendProof?:`. An optional input with
 * a quiet default is precisely how FRIEND_PROOF_BOOST stayed dead code
 * across three migrations: `scoreMeals` defaults `friendCookedRecipeIds` to
 * an empty set, so nothing ever failed to compile while no caller passed
 * one, and the weight's own tests stayed green throughout. Required, an
 * empty map is something a builder has to write down — the same argument
 * PD-009 records for `filters` on `DecisionRequest`, for the same reason.
 */
export interface DecisionRequestWithProof extends DecisionRequest {
  /**
   * Per canonical recipe, the friends who cooked it and the grade they
   * publicly gave it. Keyed by `Meal.recipeId`, so the key type is the
   * plain `string` the rest of the engine uses for ids (scoring.ts's set
   * is `ReadonlySet<string>` for the same reason) rather than social/
   * types.ts's `RecipeId` alias, which is that same string.
   *
   * Empty whenever nobody has opted in — the common case, and not an
   * error. See docs/DESIGN-SOCIAL.md §5: the switch is off by default.
   */
  readonly friendProof: ReadonlyMap<string, FriendProofContext>;
}

export function decide(request: DecisionRequestWithProof): DecisionResult {
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

  const filterEligible = filterByDecisionFilters(restrictionEligible, request.filters);
  if (filterEligible.length === 0) {
    // PD-009. Something WOULD have been eligible; tonight's stated filters
    // are what removed it, and one tap on a chip undoes that.
    return { kind: 'no_candidate', reason: 'filtered_out' };
  }

  const swapEligible = excludeAlreadyOffered(filterEligible, request.excludedMealIds);
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
function selectWinner(swapEligible: readonly Meal[], request: DecisionRequestWithProof): ScoredMeal {
  const scored = scoreMeals(
    swapEligible,
    request.household,
    request.recentCookEvents,
    request.pendingThisWeekSaves,
    request.targetDate,
    request.pendingSomedaySaves,
    friendCookedRecipeIds(request.friendProof),
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

/**
 * The recipes FRIEND_PROOF_BOOST may fire for: exactly the proof map's
 * keys, derived here and never accepted as a second input.
 *
 * THAT IDENTITY IS LOAD-BEARING, NOT TIDINESS. `assembleFriendProof`
 * (social/proof.ts) DROPS a recipe whose every cook is unnameable — a
 * profile row that failed to load — because DESIGN-SOCIAL.md §2.1 bans a
 * count without a name ("an anonymous count is a stranger-aggregate
 * wearing a friendly tone"). Were the boosted set supplied separately, it
 * could contain exactly those recipes: the meal would win on
 * `friend_proof` and reason.ts would fall back to its defensive "Iemand
 * uit je kring heeft dit ook gemaakt." — publishing the anonymous
 * aggregate §2.1 refuses, in a friend's tone, on the highest-intent
 * surface in the product. Deriving the set from the map makes "boosted"
 * and "sayable" the same condition by construction, so no caller can put
 * them out of step.
 */
function friendCookedRecipeIds(friendProof: ReadonlyMap<string, FriendProofContext>): ReadonlySet<string> {
  return new Set(friendProof.keys());
}

/**
 * The proof for one specific meal, matched on its canonical recipe and
 * nothing else — see this file's header on why the join cannot be a title.
 *
 * `?? null` twice over, and both are real states: `recipeId` is optional on
 * `Meal` (the column arrived after the type did, so an older row has no
 * key at all), and a meal that does have one is usually absent from the
 * map, because most recipes have no friend behind them.
 */
function findFriendProof(
  meal: Meal,
  friendProof: ReadonlyMap<string, FriendProofContext>,
): FriendProofContext | null {
  const recipeId = meal.recipeId ?? null;
  if (recipeId === null) {
    return null;
  }
  return friendProof.get(recipeId) ?? null;
}

/** Step 4: compose the winning meal's Dutch reason text. */
function buildReasonTextFor(winner: ScoredMeal, request: DecisionRequestWithProof): string {
  const context: ReasonContext = {
    targetDate: request.targetDate,
    savedAt: findSavedAt(winner.meal.id, request.pendingThisWeekSaves),
    estimatedMinutes: winner.meal.estimatedMinutes,
    // The winner's OWN proof, looked up per meal rather than passed down
    // from selection: `scoreMeals` ranks the whole pool, and the friends
    // behind some other candidate must never end up in this sentence.
    friendProof: findFriendProof(winner.meal, request.friendProof),
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

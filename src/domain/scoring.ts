/**
 * Step 2 of the decision engine: scoring the survivors of exclusions.ts.
 *
 * Every factor below is a small, named, exported constant so the weights
 * can be tuned and measured without hunting through logic — see plan
 * §3B's instruction to treat the novelty ratio (novelty.ts) the same way.
 *
 * ---
 *
 * Resolving an overlap in the brief: `not_recent` vs `variety`.
 *
 * The brief's factor list gives `variety` to "meals never cooked / not
 * seen in a while" while also giving `not_recent` to "the more recently
 * cooked, the worse... reason not_recent when this factor dominates."
 * Read literally those overlap: a meal cooked long ago could plausibly
 * earn either code.
 *
 * This module resolves it by splitting "time since last cooked" into two
 * non-overlapping cases, so every meal has exactly one clear story:
 *   - Never cooked at all           -> `variety`     ("something new")
 *   - Cooked before, but a while ago -> `not_recent`  ("bring it back")
 *   - Cooked recently                -> penalty only, no positive reason
 *     code from this factor (a meal that just barely survives scoring
 *     because of some other factor won't get an incoherent "not_recent"
 *     label while it was in fact cooked three days ago).
 *
 * This keeps `reasonText` (reason.ts) always true: a meal is never
 * described as "it's been a while" when it hasn't, and never described
 * as "something new" when the household has cooked it before.
 */

import { daysBetween } from './date';
import type { CookEvent, Household, Meal, MealId, ReasonCode, Save } from './types';

export const SAVED_THIS_WEEK_BOOST = 100;
export const HOUSEHOLD_FAVOURITE_BOOST = 30;
export const WOULD_NOT_REPEAT_PENALTY = 50;
export const FITS_TIME_BOOST = 10;
export const VARIETY_BOOST = 15;
export const NOT_RECENT_BOOST = 12;

/** Meals cooked within this many days of targetDate incur a recency penalty. */
export const RECENCY_PENALTY_WINDOW_DAYS = 14;
/** Penalty applied to a meal cooked *today*; tapers linearly to 0 at the window edge. */
export const RECENCY_MAX_PENALTY = 40;

/** A meal is "comfortably" under budget at this fraction of weeknightTimeBudgetMinutes. */
export const COMFORTABLE_TIME_RATIO = 0.6;

export interface ScoredMeal {
  readonly meal: Meal;
  readonly score: number;
  readonly reasonCode: ReasonCode;
}

function mostRecentCookEvent(
  mealId: MealId,
  recentCookEvents: readonly CookEvent[],
): CookEvent | undefined {
  let latest: CookEvent | undefined;
  for (const event of recentCookEvents) {
    if (event.mealId !== mealId) {
      continue;
    }
    // ISO "YYYY-MM-DD" strings sort lexically in chronological order.
    if (latest === undefined || event.cookedOn > latest.cookedOn) {
      latest = event;
    }
  }
  return latest;
}

function isSavedThisWeek(mealId: MealId, pendingThisWeekSaves: readonly Save[]): boolean {
  return pendingThisWeekSaves.some((save) => save.mealId === mealId);
}

interface RecencySignal {
  readonly penalty: number; // <= 0
  readonly notRecentBoost: number; // >= 0, mutually exclusive with a non-zero penalty
}

function computeRecencySignal(
  mealId: MealId,
  recentCookEvents: readonly CookEvent[],
  targetDate: string,
): RecencySignal {
  const latest = mostRecentCookEvent(mealId, recentCookEvents);
  if (latest === undefined) {
    return { penalty: 0, notRecentBoost: 0 };
  }
  const daysSinceCooked = daysBetween(latest.cookedOn, targetDate);
  if (daysSinceCooked < RECENCY_PENALTY_WINDOW_DAYS) {
    const closeness = Math.min(
      1,
      Math.max(0, (RECENCY_PENALTY_WINDOW_DAYS - daysSinceCooked) / RECENCY_PENALTY_WINDOW_DAYS),
    );
    return { penalty: -Math.round(RECENCY_MAX_PENALTY * closeness), notRecentBoost: 0 };
  }
  return { penalty: 0, notRecentBoost: NOT_RECENT_BOOST };
}

function wouldRepeatAdjustment(mealId: MealId, recentCookEvents: readonly CookEvent[]): number {
  const latest = mostRecentCookEvent(mealId, recentCookEvents);
  if (latest === undefined || latest.wouldRepeat === null) {
    return 0;
  }
  return latest.wouldRepeat ? HOUSEHOLD_FAVOURITE_BOOST : -WOULD_NOT_REPEAT_PENALTY;
}

function fitsTimeBoost(meal: Meal, household: Household): number {
  if (meal.estimatedMinutes === null) {
    return 0;
  }
  const comfortableCeiling = household.weeknightTimeBudgetMinutes * COMFORTABLE_TIME_RATIO;
  return meal.estimatedMinutes <= comfortableCeiling ? FITS_TIME_BOOST : 0;
}

function hasBeenCooked(mealId: MealId, recentCookEvents: readonly CookEvent[]): boolean {
  return recentCookEvents.some((event) => event.mealId === mealId);
}

function varietyBoost(mealId: MealId, recentCookEvents: readonly CookEvent[]): number {
  return hasBeenCooked(mealId, recentCookEvents) ? 0 : VARIETY_BOOST;
}

/**
 * When several factors tie for the largest positive contribution, this
 * fixed order decides which reasonCode wins — earlier entries are the
 * strongest possible stories ("we saved this for you this week" beats
 * "you haven't had this in a while").
 */
const REASON_PRIORITY: readonly ReasonCode[] = [
  'saved_this_week',
  'household_favourite',
  'fits_time',
  'not_recent',
  'variety',
];

interface Contribution {
  readonly code: ReasonCode;
  readonly weight: number;
}

function pickReasonCode(contributions: readonly Contribution[], hasCookHistory: boolean): ReasonCode {
  const positive = contributions.filter((contribution) => contribution.weight > 0);
  if (positive.length === 0) {
    // Finding 2 (bleak-fallback path): this branch is reached whenever the
    // whole candidate pool scores <= 0 (see decide.ts's selectWinner,
    // which widens the pool to the full `scored` list in exactly that
    // case) and this particular meal has no positive factor either. A
    // meal with prior cook history must never be mislabeled 'variety'
    // here -- that renders "Nog niet eerder geprobeerd" ("never tried
    // before") for a dish the household has literally already cooked,
    // which states something false and breaks this module's own
    // "reasonText is always true" invariant (see the file header). Reserve
    // 'variety' for a meal that has genuinely never been cooked; anything
    // else gets the honest, no-claims 'fallback' copy ("Een optie voor
    // vanavond").
    // hasCookHistory is always true when this branch is reached in
    // practice -- VARIETY_BOOST alone guarantees a positive 'variety'
    // contribution for any never-cooked meal (see decide.ts's
    // selectWinner comment), so a meal reaching here with zero positive
    // contributions always has cook history. The check stays explicit
    // rather than assumed, so a future scoring-weight change can't
    // silently reintroduce the false 'variety' bug this guards against.
    /* c8 ignore next -- see comment above: the never-cooked side of this ternary is unreachable via scoreMeal today. */
    return hasCookHistory ? 'fallback' : 'variety';
  }
  const maxWeight = Math.max(...positive.map((contribution) => contribution.weight));
  const topCodes = new Set(
    positive.filter((contribution) => contribution.weight === maxWeight).map((c) => c.code),
  );
  for (const code of REASON_PRIORITY) {
    if (topCodes.has(code)) {
      return code;
    }
  }
  /* c8 ignore next -- REASON_PRIORITY covers every code this function can produce */
  return 'variety';
}

export function scoreMeal(
  meal: Meal,
  household: Household,
  recentCookEvents: readonly CookEvent[],
  pendingThisWeekSaves: readonly Save[],
  targetDate: string,
): ScoredMeal {
  const savedBoost = isSavedThisWeek(meal.id, pendingThisWeekSaves) ? SAVED_THIS_WEEK_BOOST : 0;
  const recency = computeRecencySignal(meal.id, recentCookEvents, targetDate);
  const repeatAdjustment = wouldRepeatAdjustment(meal.id, recentCookEvents);
  const timeBoost = fitsTimeBoost(meal, household);
  const noveltyBoost = varietyBoost(meal.id, recentCookEvents);

  const score =
    savedBoost + recency.penalty + recency.notRecentBoost + repeatAdjustment + timeBoost + noveltyBoost;

  const reasonCode = pickReasonCode(
    [
      { code: 'saved_this_week', weight: savedBoost },
      { code: 'household_favourite', weight: repeatAdjustment > 0 ? repeatAdjustment : 0 },
      { code: 'fits_time', weight: timeBoost },
      { code: 'not_recent', weight: recency.notRecentBoost },
      { code: 'variety', weight: noveltyBoost },
    ],
    hasBeenCooked(meal.id, recentCookEvents),
  );

  return { meal, score, reasonCode };
}

/** Deterministic tie-break by meal id keeps ordering stable across runs with identical scores. */
function compareScoredMeals(a: ScoredMeal, b: ScoredMeal): number {
  if (b.score !== a.score) {
    return b.score - a.score;
  }
  return a.meal.id < b.meal.id ? -1 : a.meal.id > b.meal.id ? 1 : 0;
}

export function scoreMeals(
  meals: readonly Meal[],
  household: Household,
  recentCookEvents: readonly CookEvent[],
  pendingThisWeekSaves: readonly Save[],
  targetDate: string,
): readonly ScoredMeal[] {
  return meals
    .map((meal) => scoreMeal(meal, household, recentCookEvents, pendingThisWeekSaves, targetDate))
    .sort(compareScoredMeals);
}

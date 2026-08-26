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
import { resolveRepeatSignal } from './rating';
import type { CookEvent, Household, Meal, MealId, ReasonCode, Save } from './types';

export const SAVED_THIS_WEEK_BOOST = 100;
export const HOUSEHOLD_FAVOURITE_BOOST = 30;
export const WOULD_NOT_REPEAT_PENALTY = 50;
export const FITS_TIME_BOOST = 10;
export const VARIETY_BOOST = 15;
export const NOT_RECENT_BOOST = 12;

/**
 * A friend cooked this recipe (DESIGN-SOCIAL.md §2.1).
 *
 * WHY IT IS A COOKABILITY SIGNAL AND NOT A SOCIAL ORNAMENT. PD-004
 * measures every surface on save-to-cook, and a dish somebody you know
 * actually produced is more likely to convert to a cook than one nobody
 * you know has. That is the currency this engine already runs on, which
 * is why the boost belongs here rather than being bolted on as a
 * tiebreak.
 *
 * WHY 20, deliberately between VARIETY_BOOST (15) and
 * HOUSEHOLD_FAVOURITE_BOOST (30). Above the novelty and timing factors,
 * because a named person beats a calendar fact. Below your own
 * household's history and far below an explicit save, because a friend's
 * opinion is evidence where your own kitchen's verdict is a decision. A
 * friend liking something must never outrank you having asked for it.
 *
 * WHY PERSONALISATION IS LEGITIMATE HERE, given PD-014.6 bans it on the
 * board: Kiezen is per-household by definition and always has been — it
 * already reads your restrictions, your history, your time budget. The
 * board's ban exists because per-viewer ordering there creates an
 * unaccountable private reality out of a list whose whole meaning is
 * that everyone sees the same thing. A household's own dinner suggestion
 * is the opposite surface.
 */
export const FRIEND_PROOF_BOOST = 20;

/**
 * PD-004a: an 'ooit' (someday) save must be a genuine rotation candidate
 * the engine WILL eventually surface, not a parked item that only wins by
 * luck. `pendingSomedaySaves` is otherwise scored like any ordinary
 * candidate, so a meal with a merely-average score could in principle lose
 * its novelty-tier tie-break indefinitely — the same failure mode PD-004a
 * calls out for the old "Alleen bewaren" option, just at the ranking layer
 * instead of the UI layer.
 *
 * The fix is an aging boost: a someday save starts small
 * (SOMEDAY_SAVE_BASE_BOOST) and grows by SOMEDAY_SAVE_WEEKLY_ESCALATION per
 * full week it has waited, capped after SOMEDAY_SAVE_ESCALATION_CAP_WEEKS
 * weeks at SOMEDAY_SAVE_MAX_BOOST. That cap (45) comfortably exceeds the
 * highest score an ordinary never-cooked competitor can reach from organic
 * factors alone (VARIETY_BOOST + FITS_TIME_BOOST = 25 — `household_favourite`
 * and `not_recent` both require prior cook history, which a never-cooked
 * meal by definition lacks) — so once a someday save has waited out the
 * cap, it is guaranteed to win a tie-break within whichever novelty tier it
 * lands in. It stays below SAVED_THIS_WEEK_BOOST (100) on purpose: an
 * aged 'ooit' save earns priority over ordinary rotation meals, but never
 * outranks something the household explicitly asked for this week.
 *
 * Deliberately NOT added to scoreMeal's `contributions` list (below): the
 * boost should make a someday save win more often, not change *why* it's
 * being suggested — reasonText stays whatever the meal's honest organic
 * factor is (almost always 'variety', since a someday save is normally
 * never-cooked).
 */
export const SOMEDAY_SAVE_BASE_BOOST = 5;
export const SOMEDAY_SAVE_WEEKLY_ESCALATION = 10;
export const SOMEDAY_SAVE_ESCALATION_CAP_WEEKS = 4;
export const SOMEDAY_SAVE_MAX_BOOST =
  SOMEDAY_SAVE_BASE_BOOST + SOMEDAY_SAVE_WEEKLY_ESCALATION * SOMEDAY_SAVE_ESCALATION_CAP_WEEKS;

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

/** The earliest pending someday save for this meal — the longest-waiting one earns the biggest aging boost. */
function findEarliestSomedaySave(mealId: MealId, pendingSomedaySaves: readonly Save[]): Save | undefined {
  let earliest: Save | undefined;
  for (const save of pendingSomedaySaves) {
    if (save.mealId !== mealId) {
      continue;
    }
    if (earliest === undefined || save.savedAt < earliest.savedAt) {
      earliest = save;
    }
  }
  return earliest;
}

/** See the SOMEDAY_SAVE_* constants above for the full rationale. */
function somedaySaveBoost(
  mealId: MealId,
  pendingSomedaySaves: readonly Save[],
  targetDate: string,
): number {
  const earliestSave = findEarliestSomedaySave(mealId, pendingSomedaySaves);
  if (earliestSave === undefined) {
    return 0;
  }
  const daysWaited = Math.max(0, daysBetween(earliestSave.savedAt, targetDate));
  const weeksWaited = Math.min(Math.floor(daysWaited / 7), SOMEDAY_SAVE_ESCALATION_CAP_WEEKS);
  return SOMEDAY_SAVE_BASE_BOOST + weeksWaited * SOMEDAY_SAVE_WEEKLY_ESCALATION;
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

/**
 * PD-008. Reads the household's verdict on the last time this meal was
 * cooked through `resolveRepeatSignal` rather than off `wouldRepeat`
 * directly — that resolver prefers a numeric rating when one was given
 * and falls back to the boolean for events written before the scale
 * existed.
 *
 * Both weights keep the values they were tuned with: a rating changes how
 * the verdict is *captured*, not what a favourite is worth. A middling
 * score resolves to null and lands in the `=== null` branch below,
 * scoring exactly like an unanswered question — which is the whole reason
 * the scale has a middle.
 */
function ratingAdjustment(mealId: MealId, recentCookEvents: readonly CookEvent[]): number {
  const latest = mostRecentCookEvent(mealId, recentCookEvents);
  if (latest === undefined) {
    return 0;
  }
  const repeatSignal = resolveRepeatSignal(latest);
  if (repeatSignal === null) {
    return 0;
  }
  return repeatSignal ? HOUSEHOLD_FAVOURITE_BOOST : -WOULD_NOT_REPEAT_PENALTY;
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
  // A named person beats a calendar fact: "Sanne heeft dit ook gemaakt"
  // is a better story than "alweer even geleden" or "klaar in 20
  // minuten", and it is the only reason pointing at somebody the reader
  // actually knows. It sits below the household's own signals because a
  // save and a cook history are decisions, where a friend's cook is
  // evidence.
  'friend_proof',
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
  pendingSomedaySaves: readonly Save[] = [],
  /**
   * Canonical recipe ids at least one accepted friend has cooked, from
   * the `shared_cooks` view (0009). Empty by default so every existing
   * caller behaves exactly as before — a household with no friends, or
   * one whose friends have not opted in, scores precisely as it did.
   *
   * Recipe ids and not meal ids: proof is about the shared canonical
   * recipe, the only object two households have in common.
   */
  friendCookedRecipeIds: ReadonlySet<string> = new Set(),
): ScoredMeal {
  const savedBoost = isSavedThisWeek(meal.id, pendingThisWeekSaves) ? SAVED_THIS_WEEK_BOOST : 0;
  const recency = computeRecencySignal(meal.id, recentCookEvents, targetDate);
  const repeatAdjustment = ratingAdjustment(meal.id, recentCookEvents);
  const timeBoost = fitsTimeBoost(meal, household);
  const noveltyBoost = varietyBoost(meal.id, recentCookEvents);
  const somedayBoost = somedaySaveBoost(meal.id, pendingSomedaySaves, targetDate);
  // `?? null` rather than a truthiness check: recipeId is optional on
  // Meal, and an empty-string id must not be looked up as a match.
  const mealRecipeId = meal.recipeId ?? null;
  const friendProofBoost =
    mealRecipeId !== null && friendCookedRecipeIds.has(mealRecipeId) ? FRIEND_PROOF_BOOST : 0;

  const score =
    savedBoost +
    recency.penalty +
    recency.notRecentBoost +
    repeatAdjustment +
    timeBoost +
    noveltyBoost +
    somedayBoost +
    friendProofBoost;

  const reasonCode = pickReasonCode(
    [
      { code: 'saved_this_week', weight: savedBoost },
      { code: 'household_favourite', weight: repeatAdjustment > 0 ? repeatAdjustment : 0 },
      { code: 'friend_proof', weight: friendProofBoost },
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
  pendingSomedaySaves: readonly Save[] = [],
  /** Passed straight through to scoreMeal; see its parameter for what this is and why it is recipe ids. */
  friendCookedRecipeIds: ReadonlySet<string> = new Set(),
): readonly ScoredMeal[] {
  return meals
    .map((meal) =>
      scoreMeal(
        meal,
        household,
        recentCookEvents,
        pendingThisWeekSaves,
        targetDate,
        pendingSomedaySaves,
        friendCookedRecipeIds,
      ),
    )
    .sort(compareScoredMeals);
}

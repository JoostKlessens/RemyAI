/**
 * The cook's score for a meal, and how it projects onto the boolean
 * signal scoring.ts was built around.
 *
 * THE SCALE LIVES HERE AND NOWHERE ELSE. Every threshold below is stated
 * once rather than hardcoded at call sites, so moving from a 1-5 scale to
 * a Dutch 1-10 report-card scale is an edit to this file plus one CHECK
 * constraint in a migration — not a hunt through components and queries.
 * tests/rating.test.ts asserts the scale stays *coherent* rather than
 * asserting specific numbers, so it keeps passing across that change.
 *
 * Why a middle band exists: with only "liked it / didn't", every lukewarm
 * meal is recorded as `wouldRepeat: true` and quietly inflates
 * HOUSEHOLD_FAVOURITE_BOOST — the signal that decides what gets served
 * again. A score in the middle deliberately produces *no* signal, which
 * keeps the two real signals clean.
 */

import type { CookEvent } from './types';

export const RATING_MIN = 1;
export const RATING_MAX = 10;

/**
 * The granularity of a single vote: one decimal, so 7.5 is expressible and
 * 7.55 is not.
 *
 * This is the Dutch report-card grade, which is how people here already
 * talk about whether something was any good — "een 7,5" needs no legend,
 * where "4 out of 5" is a rating-site convention borrowed from English
 * apps. PD-008 anticipated this exact move and named its cost: the scale
 * is stated once, here, so it is this file plus one CHECK constraint.
 *
 * Why a decimal at all, rather than 1-10 whole numbers: the whole point of
 * a ten-point scale is the room between the numbers, and a grader who
 * means "just over a seven" has somewhere to put it. Why only one decimal:
 * two would be false precision — nobody holds an opinion to a hundredth,
 * and offering it invites a spread the aggregate cannot honestly use.
 */
export const RATING_STEP = 0.1;

/**
 * A score at or below this is a genuine "not again" and earns
 * scoring.ts's WOULD_NOT_REPEAT_PENALTY; a score at or above
 * RATING_POSITIVE_AT_OR_ABOVE earns HOUSEHOLD_FAVOURITE_BOOST. Anything
 * strictly between the two is neutral — recorded, but never scored.
 *
 * These are 4 and 8 on the ten-point scale, exactly the pair PD-008 named
 * when it wrote down what a move to a Dutch report card would cost. They
 * are also where the words already sit: a 4 is a fail and an 8 is properly
 * good, and the band between them is the shrug PD-008 built the middle
 * for. The tests assert the ordering and the existence of a gap, never the
 * values.
 */
export const RATING_NEGATIVE_AT_OR_BELOW = 4;
export const RATING_POSITIVE_AT_OR_ABOVE = 8;

/**
 * In range, and on the step — never a fraction finer than one decimal,
 * never NaN, never out of range.
 *
 * WHY THE ROUND-TRIP THROUGH toFixed RATHER THAN `value * 10 % 1 === 0`.
 * Binary floating point cannot hold 7.3, so `7.3 * 10` is
 * 72.99999999999999 and the modulo test rejects a value the user
 * legitimately picked. Comparing against `Number(value.toFixed(1))` asks
 * the question that is actually meant — "is this the same number once
 * written to one decimal?" — and answers it in decimal, where the scale
 * lives. 7.5 and 7.3 pass; 7.55 and 7.30000000001 do not.
 *
 * Rejecting rather than rounding is the same stance `resolveRepeatSignal`
 * takes below: a value off the scale is somebody else's data or a bug, and
 * snapping it to the nearest legal grade would put an opinion in a
 * person's mouth.
 */
export function isValidRating(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= RATING_MIN &&
    value <= RATING_MAX &&
    value === Number(value.toFixed(1))
  );
}

/**
 * The lossy projection onto `CookEvent.wouldRepeat`. Null for the middle
 * band — deliberately not `false`, because "it was fine" is not the same
 * claim as "never again", and scoring.ts penalizes the latter by 50
 * points.
 */
export function toRepeatSignal(rating: number): boolean | null {
  if (!isValidRating(rating)) {
    return null;
  }
  if (rating >= RATING_POSITIVE_AT_OR_ABOVE) {
    return true;
  }
  if (rating <= RATING_NEGATIVE_AT_OR_BELOW) {
    return false;
  }
  return null;
}

/**
 * The one way scoring should ask "did this household like this meal?".
 *
 * Prefers a real score when one exists and falls back to `wouldRepeat`
 * for events written before ratings existed — the same
 * read-through-a-resolver posture `resolveAllergenTagStatus` takes in
 * exclusions.ts for a field that was added later.
 *
 * An out-of-range score is treated as absent rather than trusted: stored
 * data can be older than the current scale, and silently clamping it
 * would invent an opinion nobody expressed.
 */
export function resolveRepeatSignal(event: CookEvent): boolean | null {
  const rating = event.rating;
  if (rating !== undefined && rating !== null && isValidRating(rating)) {
    return toRepeatSignal(rating);
  }
  return event.wouldRepeat;
}

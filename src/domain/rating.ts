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
export const RATING_MAX = 5;

/**
 * A score at or below this is a genuine "not again" and earns
 * scoring.ts's WOULD_NOT_REPEAT_PENALTY; a score at or above
 * RATING_POSITIVE_AT_OR_ABOVE earns HOUSEHOLD_FAVOURITE_BOOST. Anything
 * strictly between the two is neutral — recorded, but never scored.
 *
 * On a 1-10 scale these would become 4 and 8; the tests assert the
 * ordering and the existence of a gap, not the values.
 */
export const RATING_NEGATIVE_AT_OR_BELOW = 2;
export const RATING_POSITIVE_AT_OR_ABOVE = 4;

/** Whole numbers on the scale only — never a fraction, never NaN, never out of range. */
export function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= RATING_MIN && value <= RATING_MAX;
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

import { describe, expect, test } from 'vitest';
import { RATING_MAX, RATING_MIN } from '@/domain/rating';
import {
  RATING_DISTRIBUTION_BASE,
  emptyRecipeRatingSummary,
  summarizeRecipeRatings,
  summarizeRecipeRatingsByRecipe,
} from '@/domain/social/ratings';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeRecipeRating } from './fixtures';

const SCALE_LENGTH = RATING_MAX - RATING_MIN + 1;

describe('emptyRecipeRatingSummary', () => {
  test('a recipe nobody has rated has no score at all, never a fabricated zero', () => {
    const summary = emptyRecipeRatingSummary('recipe-1');
    expect(summary.count).toBe(0);
    expect(summary.average).toBeNull();
  });

  test('its distribution has one bucket per point on the scale, all empty', () => {
    expect(emptyRecipeRatingSummary('recipe-1').distribution).toEqual(Array.from({ length: SCALE_LENGTH }, () => 0));
  });
});

describe('summarizeRecipeRatings', () => {
  test('an empty list summarizes to the empty summary', () => {
    expect(summarizeRecipeRatings('recipe-1', [])).toEqual(emptyRecipeRatingSummary('recipe-1'));
  });

  /** The whole reason a rating hangs off `recipe_id` and not `meal_id`: every household's copy counts once, into one score. */
  test('counts every rater of the same recipe, whichever household they came from', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: 5 }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_B, rating: 3 }),
      makeRecipeRating({ id: 'r3', raterProfileId: PROFILE_C, rating: 4 }),
    ]);
    expect(summary.count).toBe(3);
    expect(summary.average).toBe(4);
  });

  test('ignores ratings belonging to a different recipe', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 5 }),
      makeRecipeRating({ id: 'r2', recipeId: 'recipe-2', raterProfileId: PROFILE_B, rating: 1 }),
    ]);
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(5);
  });

  test('does not round the average — how a score is displayed is the caller decision', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: 4 }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_B, rating: 5 }),
      makeRecipeRating({ id: 'r3', raterProfileId: PROFILE_C, rating: 5 }),
    ]);
    expect(summary.average).toBeCloseTo(14 / 3, 10);
  });

  /** Mirrors `unique (recipe_id, rater_profile_id)` in 0007_social.sql: one vote per person per recipe, whatever a merged cache hands us. */
  test('one person cannot count twice — the most recent vote wins', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: 1, ratedAt: '2026-01-01T00:00:00.000Z' }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_A, rating: 5, ratedAt: '2026-02-01T00:00:00.000Z' }),
    ]);
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(5);
  });

  test('deduplication does not depend on the order the rows arrive in', () => {
    const older = makeRecipeRating({
      id: 'r1',
      raterProfileId: PROFILE_A,
      rating: 1,
      ratedAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = makeRecipeRating({
      id: 'r2',
      raterProfileId: PROFILE_A,
      rating: 5,
      ratedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(summarizeRecipeRatings('recipe-1', [newer, older])).toEqual(
      summarizeRecipeRatings('recipe-1', [older, newer]),
    );
  });

  test('a duplicate rater with identical timestamps still counts once', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: 2 }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_A, rating: 4 }),
    ]);
    expect(summary.count).toBe(1);
  });

  /** An off-scale value is stored data that predates, or violates, the scale rating.ts owns. Dropping it is honest; clamping would invent an opinion. */
  test('drops off-scale and off-step scores instead of clamping them', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: RATING_MIN - 1 }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_B, rating: RATING_MAX + 1 }),
      makeRecipeRating({ id: 'r3', raterProfileId: PROFILE_C, rating: 3.55 }),
    ]);
    expect(summary).toEqual(emptyRecipeRatingSummary('recipe-1'));
  });

  /**
   * The scale carries one decimal but the histogram cannot carry 91 bars,
   * so a vote lands in the bucket for its nearest whole grade — a 7,5 is
   * counted as an eight, the way it is read aloud. `average` keeps the
   * precise figure, so nothing is lost, only reduced.
   */
  test('buckets a decimal vote by its nearest whole grade', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: 7.5 }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_B, rating: 7.4 }),
    ]);
    expect(summary.count).toBe(2);
    expect(summary.average).toBeCloseTo(7.45, 10);
    expect(summary.distribution[8 - RATING_DISTRIBUTION_BASE]).toBe(1);
    expect(summary.distribution[7 - RATING_DISTRIBUTION_BASE]).toBe(1);
  });

  test('an off-scale duplicate never displaces the valid vote from the same rater', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: 4, ratedAt: '2026-01-01T00:00:00.000Z' }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_A, rating: 99, ratedAt: '2026-02-01T00:00:00.000Z' }),
    ]);
    expect(summary.count).toBe(1);
    expect(summary.average).toBe(4);
  });

  test('buckets each kept vote into the distribution at score minus the base', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: RATING_MIN }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_B, rating: RATING_MAX }),
      makeRecipeRating({ id: 'r3', raterProfileId: PROFILE_C, rating: RATING_MAX }),
    ]);
    const expected = Array.from({ length: SCALE_LENGTH }, () => 0);
    expected[RATING_MIN - RATING_DISTRIBUTION_BASE] = 1;
    expected[RATING_MAX - RATING_DISTRIBUTION_BASE] = 2;
    expect(summary.distribution).toEqual(expected);
  });

  test('the distribution always sums to the count it reports', () => {
    const summary = summarizeRecipeRatings('recipe-1', [
      makeRecipeRating({ id: 'r1', raterProfileId: PROFILE_A, rating: 2 }),
      makeRecipeRating({ id: 'r2', raterProfileId: PROFILE_B, rating: 4 }),
      makeRecipeRating({ id: 'r3', raterProfileId: PROFILE_C, rating: 4 }),
    ]);
    expect(summary.distribution.reduce((total, bucket) => total + bucket, 0)).toBe(summary.count);
  });

  test('the distribution base is the bottom of the scale rating.ts owns', () => {
    expect(RATING_DISTRIBUTION_BASE).toBe(RATING_MIN);
  });
});

describe('summarizeRecipeRatingsByRecipe', () => {
  test('groups a mixed list into one summary per recipe', () => {
    const summaries = summarizeRecipeRatingsByRecipe([
      makeRecipeRating({ id: 'r1', recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 5 }),
      makeRecipeRating({ id: 'r2', recipeId: 'recipe-1', raterProfileId: PROFILE_B, rating: 3 }),
      makeRecipeRating({ id: 'r3', recipeId: 'recipe-2', raterProfileId: PROFILE_A, rating: 2 }),
    ]);
    expect(summaries.get('recipe-1')?.count).toBe(2);
    expect(summaries.get('recipe-1')?.average).toBe(4);
    expect(summaries.get('recipe-2')?.count).toBe(1);
  });

  test('agrees with summarizeRecipeRatings for every recipe present', () => {
    const ratings = [
      makeRecipeRating({ id: 'r1', recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 5 }),
      makeRecipeRating({ id: 'r2', recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 1 }),
      makeRecipeRating({ id: 'r3', recipeId: 'recipe-2', raterProfileId: PROFILE_B, rating: 4 }),
    ];
    for (const [recipeId, summary] of summarizeRecipeRatingsByRecipe(ratings)) {
      expect(summary).toEqual(summarizeRecipeRatings(recipeId, ratings));
    }
  });

  test('a recipe whose only votes were off-scale is absent rather than present with a zero score', () => {
    const summaries = summarizeRecipeRatingsByRecipe([
      makeRecipeRating({ id: 'r1', recipeId: 'recipe-2', raterProfileId: PROFILE_A, rating: 0 }),
    ]);
    expect(summaries.has('recipe-2')).toBe(false);
  });

  test('an empty list produces an empty map', () => {
    expect(summarizeRecipeRatingsByRecipe([]).size).toBe(0);
  });
});

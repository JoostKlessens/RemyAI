/**
 * Fase 6 — the global board (PD-014).
 *
 * These tests assert the board stays *coherent* rather than asserting
 * specific numbers, the same way tests/rating.test.ts treats the scale:
 * every expectation is written against LEADERBOARD_MIN_VOTES and
 * LEADERBOARD_PRIOR_VOTES rather than against 3 and 5, so retuning either
 * constant does not turn this file red.
 */

import { describe, expect, test } from 'vitest';
import { RATING_MAX, RATING_MIN } from '@/domain/rating';
import { summarizeRecipeRatingsByRecipe } from '@/domain/social/ratings';
import {
  LEADERBOARD_MIN_VOTES,
  LEADERBOARD_PRIOR_VOTES,
  buildLeaderboard,
  populationMean,
  rankRecipes,
} from '@/domain/social/leaderboard';
import type { RecipeRating } from '@/domain/social/types';
import { makeRecipeRating } from './fixtures';

/**
 * N votes for one recipe, each from a different rater — `ratings.ts`
 * collapses a repeated rater to one vote, so a helper that reused a rater
 * id would silently build a much smaller sample than the test claims.
 */
function votes(recipeId: string, scores: readonly number[]): readonly RecipeRating[] {
  return scores.map((rating, index) =>
    makeRecipeRating({
      id: `${recipeId}-vote-${index}`,
      recipeId,
      raterProfileId: `rater-${index}`,
      rating,
    }),
  );
}

/** `count` copies of one score — the usual way these tests build a sample of a given size. */
function repeated(score: number, count: number): readonly number[] {
  return Array.from({ length: count }, () => score);
}

const ranked = (entries: readonly { readonly recipeId: string }[]): readonly string[] =>
  entries.map((entry) => entry.recipeId);

describe('populationMean', () => {
  test('is null when nothing has been rated — there is no prior to shrink toward', () => {
    expect(populationMean([])).toBeNull();
  });

  /**
   * The prior is the population's actual level, never the midpoint of the
   * scale. PD-008 gives the middle band the specific meaning "no signal",
   * so shrinking every recipe toward it would drag the whole board toward
   * an opinion nobody expressed.
   */
  test('is the population average, not the midpoint of the scale', () => {
    const midpoint = (RATING_MIN + RATING_MAX) / 2;
    const summaries = summarizeRecipeRatingsByRecipe([
      ...votes('recipe-1', repeated(RATING_MAX, 10)),
      ...votes('recipe-2', repeated(RATING_MAX, 10)),
    ]);
    expect(populationMean(summaries.values())).toBe(RATING_MAX);
    expect(populationMean(summaries.values())).not.toBe(midpoint);
  });

  /** Every counted vote weighs the same. A mean of recipe means would let one vote outweigh two hundred. */
  test('weights by vote, not by recipe', () => {
    const summaries = summarizeRecipeRatingsByRecipe([
      ...votes('recipe-1', repeated(5, 1)),
      ...votes('recipe-2', repeated(1, 9)),
    ]);
    expect(populationMean(summaries.values())).toBeCloseTo((5 + 9) / 10, 10);
  });
});

describe('rankRecipes — the minimum-votes floor', () => {
  test('a recipe with a single perfect rating does not reach the board at all', () => {
    const entries = buildLeaderboard([
      ...votes('thin', repeated(RATING_MAX, 1)),
      ...votes('supported', repeated(4, LEADERBOARD_MIN_VOTES + 10)),
    ]);
    expect(ranked(entries)).not.toContain('thin');
    expect(ranked(entries)).toContain('supported');
  });

  test('the floor is inclusive — exactly LEADERBOARD_MIN_VOTES votes qualifies', () => {
    const entries = buildLeaderboard([
      ...votes('just-enough', repeated(4, LEADERBOARD_MIN_VOTES)),
      ...votes('one-short', repeated(4, LEADERBOARD_MIN_VOTES - 1)),
    ]);
    expect(ranked(entries)).toContain('just-enough');
    expect(ranked(entries)).not.toContain('one-short');
  });

  /**
   * An unranked recipe still says something about the population's general
   * level, so it counts toward the prior even though it cannot appear.
   * Dropping it would make the prior swing with the floor.
   */
  test('recipes below the floor still count toward the prior', () => {
    const withThinLowVotes = buildLeaderboard([
      ...votes('supported', repeated(4, LEADERBOARD_MIN_VOTES + 10)),
      ...votes('thin', repeated(RATING_MIN, LEADERBOARD_MIN_VOTES - 1)),
    ]);
    const withoutThin = buildLeaderboard([...votes('supported', repeated(4, LEADERBOARD_MIN_VOTES + 10))]);

    const supportedWith = withThinLowVotes.find((entry) => entry.recipeId === 'supported');
    const supportedWithout = withoutThin.find((entry) => entry.recipeId === 'supported');
    expect(supportedWith?.score).toBeLessThan(supportedWithout?.score ?? 0);
  });
});

describe('rankRecipes — shrinkage', () => {
  /** The whole point of the Bayesian weighting: thin evidence is pulled toward the population. */
  test("a recipe's score sits between its own average and the prior", () => {
    const ratings = [
      ...votes('perfect', repeated(RATING_MAX, LEADERBOARD_MIN_VOTES)),
      ...votes('poor', repeated(RATING_MIN, 40)),
    ];
    const entries = buildLeaderboard(ratings);
    const prior = populationMean(summarizeRecipeRatingsByRecipe(ratings).values()) ?? 0;

    const perfect = entries.find((entry) => entry.recipeId === 'perfect');
    expect(perfect).toBeDefined();
    expect(perfect?.score).toBeGreaterThan(prior);
    expect(perfect?.score).toBeLessThan(RATING_MAX);
  });

  test('more votes at the same average means less shrinkage', () => {
    const entries = buildLeaderboard([
      ...votes('thinly-liked', repeated(RATING_MAX, LEADERBOARD_MIN_VOTES)),
      ...votes('widely-liked', repeated(RATING_MAX, LEADERBOARD_PRIOR_VOTES * 10)),
      ...votes('ballast', repeated(RATING_MIN, 40)),
    ]);
    const thin = entries.find((entry) => entry.recipeId === 'thinly-liked');
    const wide = entries.find((entry) => entry.recipeId === 'widely-liked');
    expect(wide?.score).toBeGreaterThan(thin?.score ?? 0);
  });

  /**
   * The requirement the owner stated for this board in as few numbers as
   * possible: strong support at a slightly lower average must outrank a
   * barely-qualifying perfect score.
   */
  test('a well-supported good recipe outranks a thinly-supported perfect one', () => {
    const entries = buildLeaderboard([
      ...votes('thin-perfect', repeated(RATING_MAX, LEADERBOARD_MIN_VOTES)),
      ...votes('well-supported', repeated(RATING_MAX - 1, LEADERBOARD_PRIOR_VOTES * 8)),
      ...votes('ballast', repeated(RATING_MIN, 40)),
    ]);
    expect(ranked(entries)[0]).toBe('well-supported');
  });
});

describe('rankRecipes — what the board reports', () => {
  test('reports the honest average, not the score it ordered by', () => {
    const entries = buildLeaderboard([
      ...votes('perfect', repeated(RATING_MAX, LEADERBOARD_MIN_VOTES)),
      ...votes('ballast', repeated(RATING_MIN, 40)),
    ]);
    const perfect = entries.find((entry) => entry.recipeId === 'perfect');
    expect(perfect?.average).toBe(RATING_MAX);
    expect(perfect?.count).toBe(LEADERBOARD_MIN_VOTES);
    expect(perfect?.score).not.toBe(RATING_MAX);
  });

  test('ranks run 1, 2, 3 down the board', () => {
    const entries = buildLeaderboard([
      ...votes('best', repeated(5, 20)),
      ...votes('middle', repeated(4, 20)),
      ...votes('worst', repeated(2, 20)),
    ]);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(ranked(entries)).toEqual(['best', 'middle', 'worst']);
  });

  /** Two recipes the arithmetic genuinely cannot separate are the same rank, not an arbitrary 1 and 2. */
  test('an exact tie shares a rank, and the next recipe skips one', () => {
    const entries = buildLeaderboard([
      ...votes('tied-a', repeated(5, 20)),
      ...votes('tied-b', repeated(5, 20)),
      ...votes('lower', repeated(2, 20)),
    ]);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });
});

describe('rankRecipes — determinism', () => {
  /** A board that reshuffles between two reads of the same data is a board nobody can trust. */
  test('the order does not depend on the order the ratings arrived in', () => {
    const ratings = [
      ...votes('a', repeated(5, 12)),
      ...votes('b', repeated(4, 12)),
      ...votes('c', repeated(3, 12)),
      ...votes('d', repeated(5, 12)),
    ];
    const forwards = buildLeaderboard(ratings);
    const backwards = buildLeaderboard([...ratings].reverse());
    expect(ranked(backwards)).toEqual(ranked(forwards));
  });

  /**
   * Two recipes with identical samples produce a bit-identical score and an
   * identical count, so the comparator runs out of meaningful tiebreaks and
   * falls through to the id. That last step is what makes the order total —
   * without it these two would sit in whatever order the input happened to
   * hand over.
   */
  test('recipes the score and the sample size cannot separate fall back to the id', () => {
    const entries = buildLeaderboard([
      ...votes('zzz-later', repeated(5, LEADERBOARD_PRIOR_VOTES * 4)),
      ...votes('aaa-earlier', repeated(5, LEADERBOARD_PRIOR_VOTES * 4)),
      ...votes('ballast', repeated(1, 30)),
    ]);
    expect(ranked(entries).slice(0, 2)).toEqual(['aaa-earlier', 'zzz-later']);
    expect(entries[0]?.score).toBe(entries[1]?.score);
  });
});

describe('buildLeaderboard — one definition of the score', () => {
  test('an empty rating list produces an empty board, never a zeroed one', () => {
    expect(buildLeaderboard([])).toEqual([]);
  });

  /** Deduplication belongs to ratings.ts. This asserts the board inherits it rather than re-implementing it. */
  test('a rater who voted twice on one recipe still counts once', () => {
    const entries = buildLeaderboard([
      ...votes('recipe-1', repeated(5, LEADERBOARD_MIN_VOTES + 5)),
      makeRecipeRating({
        id: 'late-change-of-mind',
        recipeId: 'recipe-1',
        raterProfileId: 'rater-0',
        rating: 1,
        ratedAt: '2099-01-01T00:00:00.000Z',
      }),
    ]);
    expect(entries[0]?.count).toBe(LEADERBOARD_MIN_VOTES + 5);
  });

  /** Off-scale rows are dropped by ratings.ts, so a recipe whose only votes were junk never reaches the board. */
  test('a recipe whose only votes were off-scale is absent, not present with a zero', () => {
    const entries = buildLeaderboard([
      ...votes('real', repeated(4, LEADERBOARD_MIN_VOTES + 5)),
      ...votes('junk', repeated(RATING_MAX + 7, LEADERBOARD_MIN_VOTES + 5)),
    ]);
    expect(ranked(entries)).toEqual(['real']);
  });

  test('rankRecipes and buildLeaderboard agree, so neither becomes a second definition', () => {
    const ratings = [...votes('a', repeated(5, 12)), ...votes('b', repeated(3, 12))];
    expect(rankRecipes(summarizeRecipeRatingsByRecipe(ratings).values())).toEqual(buildLeaderboard(ratings));
  });
});

/**
 * De kring — the circle's verdict (docs/DESIGN-SOCIAL.md §2.2).
 *
 * WHY THIS IS NOT tests/social/leaderboard.test.ts WITH DIFFERENT NUMBERS.
 * The two lists answer different questions and their arithmetic is
 * deliberately opposite. The board tames anonymous strangers: a floor of
 * three votes, Bayesian shrinkage toward a population mean, two decimals.
 * None of those devices survives contact with five named people, so the
 * kring has a floor of one, no shrinkage at all, and one decimal. Several
 * assertions below are the exact inverse of an assertion in the board's
 * file, and that is the point — if these two ever agree, one of them has
 * drifted into the other.
 */

import { describe, expect, test } from 'vitest';
import { RATING_MAX, RATING_MIN } from '@/domain/rating';
import { KRING_MIN_VOTES, rankKring } from '@/domain/social/kring';
import { LEADERBOARD_MIN_VOTES } from '@/domain/social/leaderboard';
import type { RecipeRating } from '@/domain/social/types';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeRecipeRating } from './fixtures';

const TITLES = new Map([
  ['recipe-1', 'Ramen'],
  ['recipe-2', 'Zalm'],
  ['recipe-3', 'Aubergine'],
]);

/** One vote per (recipe, voter) — a repeated voter collapses, so ids must differ to build a real sample. */
function vote(recipeId: string, voterProfileId: string, rating: number): RecipeRating {
  return makeRecipeRating({ id: `${recipeId}-${voterProfileId}`, recipeId, raterProfileId: voterProfileId, rating });
}

const idsOf = (entries: readonly { readonly recipeId: string }[]): readonly string[] =>
  entries.map((entry) => entry.recipeId);

describe('the floor', () => {
  /** The whole reason the kring exists: with four friends, nothing ever clears the board's floor. */
  test('a single vote is enough to rank, unlike the board', () => {
    const entries = rankKring([vote('recipe-1', PROFILE_A, 8.5)], TITLES);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.count).toBe(1);
  });

  test('its floor is genuinely lower than the boardedge it replaces', () => {
    expect(KRING_MIN_VOTES).toBeLessThan(LEADERBOARD_MIN_VOTES);
  });

  /** Never padded: a recipe nobody in the circle voted on does not appear, even though it has a title. */
  test('a recipe with no votes from the circle is absent, never a zero row', () => {
    const entries = rankKring([vote('recipe-1', PROFILE_A, 8)], TITLES);
    expect(idsOf(entries)).toEqual(['recipe-1']);
  });

  test('no votes at all is an empty list, not a list of empty rows', () => {
    expect(rankKring([], TITLES)).toEqual([]);
  });
});

describe('the average', () => {
  /**
   * The inverse of the board's defining assertion. There, three tens are
   * shrunk toward the population and display below 10. Here the honest
   * number is what the named voters actually said.
   */
  test('a perfect vote is reported as perfect — there is no shrinkage', () => {
    const entries = rankKring([vote('recipe-1', PROFILE_A, RATING_MAX)], TITLES);
    expect(entries[0]?.average).toBe(RATING_MAX);
  });

  test('is the plain mean of the votes cast', () => {
    const entries = rankKring([vote('recipe-1', PROFILE_A, 8), vote('recipe-1', PROFILE_B, 9)], TITLES);
    expect(entries[0]?.average).toBe(8.5);
  });

  /** One decimal, not the board's two: two decimals on a handful of known votes is false precision. */
  test('is rounded to one decimal', () => {
    const entries = rankKring(
      [vote('recipe-1', PROFILE_A, 8), vote('recipe-1', PROFILE_B, 9), vote('recipe-1', PROFILE_C, 8.1)],
      TITLES,
    );
    expect(entries[0]?.average).toBe(8.4);
  });
});

describe('the voters', () => {
  /** The list names people, so it has to carry who counted — "8,5 · Sanne en Joris". */
  test('carries the profile of every counted vote', () => {
    const entries = rankKring([vote('recipe-1', PROFILE_A, 8), vote('recipe-1', PROFILE_B, 9)], TITLES);
    expect([...(entries[0]?.voterProfileIds ?? [])].sort()).toEqual([PROFILE_A, PROFILE_B].sort());
  });

  test('the voter list always matches the count it reports', () => {
    const entries = rankKring([vote('recipe-1', PROFILE_A, 8), vote('recipe-1', PROFILE_B, 9)], TITLES);
    expect(entries[0]?.voterProfileIds).toHaveLength(entries[0]?.count ?? 0);
  });

  /** Dedup belongs to ratings.ts; this asserts the kring inherits it rather than counting a person twice. */
  test('a friend who voted twice counts once', () => {
    const entries = rankKring(
      [
        makeRecipeRating({ id: 'first', recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 4 }),
        makeRecipeRating({
          id: 'second',
          recipeId: 'recipe-1',
          raterProfileId: PROFILE_A,
          rating: 9,
          ratedAt: '2099-01-01T00:00:00.000Z',
        }),
      ],
      TITLES,
    );
    expect(entries[0]?.count).toBe(1);
    expect(entries[0]?.average).toBe(9);
  });

  test('an off-scale vote is dropped, not repaired', () => {
    const entries = rankKring([vote('recipe-1', PROFILE_A, RATING_MAX + 5)], TITLES);
    expect(entries).toEqual([]);
  });
});

describe('the order', () => {
  test('ranks by average, best first', () => {
    const entries = rankKring(
      [vote('recipe-1', PROFILE_A, 7), vote('recipe-2', PROFILE_B, 9), vote('recipe-3', PROFILE_C, 8)],
      TITLES,
    );
    expect(idsOf(entries)).toEqual(['recipe-2', 'recipe-3', 'recipe-1']);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  /** Evidence breaks a tie here exactly as it does on the board. */
  test('an equal average is broken by the number of votes', () => {
    const entries = rankKring(
      [vote('recipe-1', PROFILE_A, 8), vote('recipe-2', PROFILE_B, 8), vote('recipe-2', PROFILE_C, 8)],
      TITLES,
    );
    expect(idsOf(entries)).toEqual(['recipe-2', 'recipe-1']);
  });

  /**
   * The board falls back to the recipe id, which is opaque. This list
   * shows dish names, so it falls back to something the reader can
   * actually see — otherwise two identical-looking rows sit in an order
   * nothing on screen explains.
   */
  test('an equal average and equal evidence is broken alphabetically by dish', () => {
    // recipe-3 is "Aubergine", recipe-2 is "Zalm".
    const entries = rankKring([vote('recipe-2', PROFILE_A, 8), vote('recipe-3', PROFILE_B, 8)], TITLES);
    expect(idsOf(entries)).toEqual(['recipe-3', 'recipe-2']);
  });

  test('two recipes showing the same number share a rank', () => {
    const entries = rankKring(
      [vote('recipe-2', PROFILE_A, 8), vote('recipe-3', PROFILE_B, 8), vote('recipe-1', PROFILE_C, RATING_MIN)],
      TITLES,
    );
    expect(entries.map((entry) => entry.rank)).toEqual([1, 1, 3]);
  });

  /** A list that reshuffles between two reads of the same data is a list nobody can trust. */
  test('does not depend on the order the votes arrived in', () => {
    const votes = [
      vote('recipe-1', PROFILE_A, 7),
      vote('recipe-2', PROFILE_B, 9),
      vote('recipe-3', PROFILE_C, 8),
    ];
    expect(idsOf(rankKring([...votes].reverse(), TITLES))).toEqual(idsOf(rankKring(votes, TITLES)));
  });

  /** A missing title must not crash the list or make the order unstable. */
  test('a recipe with no known title still ranks', () => {
    const entries = rankKring([vote('recipe-onbekend', PROFILE_A, 9)], TITLES);
    expect(idsOf(entries)).toEqual(['recipe-onbekend']);
  });
});

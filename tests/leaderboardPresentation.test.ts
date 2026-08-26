/**
 * Fase 6 — the global board's pure presentation layer (PD-014, DESIGN §9).
 *
 * Same split as tests/friendFeedPresentation.test.ts and for the same
 * reason: vitest runs in `node` with react-native stubbed, so the copy and
 * the view-model construction live outside the component and are asserted
 * directly. The two things most able to regress silently here are the
 * Dutch decimal comma and the PD-007a collision label, and both are pinned
 * below.
 */

import { describe, expect, test } from 'vitest';
import {
  LEADERBOARD_MIN_VOTES,
  LEADERBOARD_SCORE_DECIMALS,
  buildLeaderboard,
} from '@/domain/social/leaderboard';
import { RATING_MAX, RATING_MIN } from '@/domain/rating';
import {
  BOARD_EMPTY_COPY,
  BOARD_END_COPY,
  LEADERBOARD_MAX_ROWS,
  assembleLeaderboard,
  buildBoardMetaLine,
  buildBoardRowAccessibilityLabel,
  formatBoardScore,
  formatVoteCount,
} from '@/components/leaderboardPresentation';
import type { BoardRecipe } from '@/components/leaderboardPresentation';
import type { RecipeRating } from '@/domain/social/types';
import { makeRecipeRating } from './social/fixtures';

function votes(recipeId: string, score: number, count: number): readonly RecipeRating[] {
  return Array.from({ length: count }, (_unused, index) =>
    makeRecipeRating({
      id: `${recipeId}-vote-${index}`,
      recipeId,
      raterProfileId: `rater-${index}`,
      rating: score,
    }),
  );
}

function makeBoardRecipe(overrides: Partial<BoardRecipe> = {}): BoardRecipe {
  return {
    recipeId: 'recipe-1',
    title: 'Pistache-tiramisu',
    creatorHandle: 'kokenmetkees',
    creatorPlatform: 'tiktok',
    thumbnailUrl: null,
    allergenTags: [],
    ...overrides,
  };
}

describe('formatBoardScore', () => {
  /** The single most likely silent regression on this screen: a Dutch interface printing "8.72". */
  test('writes the decimal separator as a comma, never a point', () => {
    expect(formatBoardScore(8.72)).toBe('8,72');
    expect(formatBoardScore(8.72)).not.toContain('.');
  });

  test('keeps trailing zeros, so a column of grades stays the same width', () => {
    expect(formatBoardScore(8)).toBe('8,00');
    expect(formatBoardScore(8.7)).toBe('8,70');
    expect(formatBoardScore(10)).toBe('10,00');
  });

  /** Two decimals is the precision the domain already rounded to; this must not add a third. */
  test('shows exactly LEADERBOARD_SCORE_DECIMALS decimals', () => {
    const decimals = formatBoardScore(7.5).split(',')[1];
    expect(decimals).toHaveLength(LEADERBOARD_SCORE_DECIMALS);
  });
});

describe('formatVoteCount', () => {
  /** Dutch singular. "1 stemmen" is the kind of thing that survives to production. */
  test('a single vote is singular', () => {
    expect(formatVoteCount(1)).toBe('1 stem');
  });

  test('anything else is plural', () => {
    expect(formatVoteCount(204)).toBe('204 stemmen');
    expect(formatVoteCount(0)).toBe('0 stemmen');
  });
});

describe('buildBoardMetaLine', () => {
  test('pairs the grade with the evidence behind it', () => {
    expect(buildBoardMetaLine(8.72, 204)).toBe(`8,72  ·  204 stemmen`);
  });

  /**
   * DESIGN §9: "the vote count is never omitted... '8,72' alone is a claim
   * with its evidence removed."
   */
  test('never renders the grade on its own', () => {
    expect(buildBoardMetaLine(8.72, 3)).not.toBe('8,72');
    expect(buildBoardMetaLine(8.72, 3)).toContain('3 stemmen');
  });
});

describe('assembleLeaderboard', () => {
  const supported = (recipeId: string, score: number) => votes(recipeId, score, LEADERBOARD_MIN_VOTES + 10);

  test('an empty board is empty, never a row of zeroes', () => {
    expect(assembleLeaderboard({ ratings: [], recipes: [], excludedAllergenTags: [] })).toEqual([]);
  });

  test('orders by score and numbers the rows', () => {
    const rows = assembleLeaderboard({
      ratings: [...supported('best', 5), ...supported('worst', 2)],
      recipes: [
        makeBoardRecipe({ recipeId: 'best', title: 'Beste' }),
        makeBoardRecipe({ recipeId: 'worst', title: 'Slechtste' }),
      ],
      excludedAllergenTags: [],
    });
    expect(rows.map((row) => row.title)).toEqual(['Beste', 'Slechtste']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
  });

  /** The board ranks canonical recipes; one without display data cannot be rendered, so it is dropped rather than shown blank. */
  test('a ranked recipe with no display data is dropped, not rendered empty', () => {
    const rows = assembleLeaderboard({
      ratings: [...supported('known', 5), ...supported('unknown', 4)],
      recipes: [makeBoardRecipe({ recipeId: 'known', title: 'Bekend' })],
      excludedAllergenTags: [],
    });
    expect(rows.map((row) => row.recipeId)).toEqual(['known']);
  });

  /**
   * The board shows the number it sorted by, never the raw mean. A recipe
   * rated 10,10,10 with the population sitting far below does NOT show
   * 10,00 — printing a number the order contradicts is the failure this
   * whole arrangement exists to prevent.
   */
  test('shows the score that ordered the board, not the raw average', () => {
    const entries = buildLeaderboard([
      ...votes('perfect', RATING_MAX, LEADERBOARD_MIN_VOTES),
      ...votes('ballast', RATING_MIN, 40),
    ]);
    const perfect = entries.find((entry) => entry.recipeId === 'perfect');
    expect(perfect?.average).toBe(RATING_MAX);
    expect(perfect?.score).toBeLessThan(RATING_MAX);

    const rows = assembleLeaderboard({
      ratings: [...votes('perfect', RATING_MAX, LEADERBOARD_MIN_VOTES), ...votes('ballast', RATING_MIN, 40)],
      recipes: [
        makeBoardRecipe({ recipeId: 'perfect' }),
        makeBoardRecipe({ recipeId: 'ballast', title: 'Ballast' }),
      ],
      excludedAllergenTags: [],
    });
    expect(rows[0]?.metaLine).toContain(formatBoardScore(perfect?.score ?? 0));
    expect(rows[0]?.metaLine).not.toContain(formatBoardScore(RATING_MAX));
  });

  test('caps the board at LEADERBOARD_MAX_ROWS', () => {
    const many = Array.from({ length: LEADERBOARD_MAX_ROWS + 8 }, (_unused, index) => `recipe-${index}`);
    const rows = assembleLeaderboard({
      ratings: many.flatMap((recipeId, index) => supported(recipeId, (index % 4) + 2)),
      recipes: many.map((recipeId) => makeBoardRecipe({ recipeId, title: recipeId })),
      excludedAllergenTags: [],
    });
    expect(rows).toHaveLength(LEADERBOARD_MAX_ROWS);
  });

  describe('PD-007a — labelled, but not reordered', () => {
    const request = {
      ratings: [...supported('nuts', 5), ...supported('safe', 4)],
      recipes: [
        makeBoardRecipe({ recipeId: 'nuts', title: 'Notenkoek', allergenTags: ['noten'] }),
        makeBoardRecipe({ recipeId: 'safe', title: 'Veilig' }),
      ],
    };

    test('a colliding recipe is labelled', () => {
      const rows = assembleLeaderboard({ ...request, excludedAllergenTags: ['noten'] });
      expect(rows.find((row) => row.recipeId === 'nuts')?.collisionLabel).toBe('bevat noten');
    });

    test('a recipe that does not collide carries no label', () => {
      const rows = assembleLeaderboard({ ...request, excludedAllergenTags: ['noten'] });
      expect(rows.find((row) => row.recipeId === 'safe')?.collisionLabel).toBeNull();
    });

    /**
     * The whole point of DESIGN §9's departure from §8: ranking down is
     * per-household, and PD-014 condition 6 forbids a board that differs
     * per reader. Two readers with different restrictions must see the
     * same order.
     */
    test('the order is identical whether or not the reader excludes the tag', () => {
      const withRestriction = assembleLeaderboard({ ...request, excludedAllergenTags: ['noten'] });
      const without = assembleLeaderboard({ ...request, excludedAllergenTags: [] });
      expect(withRestriction.map((row) => row.recipeId)).toEqual(without.map((row) => row.recipeId));
      expect(withRestriction[0]?.recipeId).toBe('nuts');
    });

    test('a colliding recipe is never hidden', () => {
      const rows = assembleLeaderboard({ ...request, excludedAllergenTags: ['noten'] });
      expect(rows.map((row) => row.recipeId)).toContain('nuts');
    });
  });
});

describe('buildBoardRowAccessibilityLabel', () => {
  test('reads the position, the dish and the score as one sentence', () => {
    const rows = assembleLeaderboard({
      ratings: votes('recipe-1', 5, LEADERBOARD_MIN_VOTES + 10),
      recipes: [makeBoardRecipe()],
      excludedAllergenTags: [],
    });
    const row = rows[0];
    expect(row).toBeDefined();
    const label = buildBoardRowAccessibilityLabel(row!);
    expect(label).toContain('1');
    expect(label).toContain('Pistache-tiramisu');
    expect(label).toContain('5,0');
  });

  test('carries the collision label into the spoken description', () => {
    const rows = assembleLeaderboard({
      ratings: votes('recipe-1', 5, LEADERBOARD_MIN_VOTES + 10),
      recipes: [makeBoardRecipe({ allergenTags: ['noten'] })],
      excludedAllergenTags: ['noten'],
    });
    expect(buildBoardRowAccessibilityLabel(rows[0]!)).toContain('bevat noten');
  });
});

describe('the board copy', () => {
  /** DESIGN §9 pins both strings; a screen that drifts from them stops matching the spec silently. */
  test('says the list has ended, and never implies more is coming', () => {
    expect(BOARD_END_COPY).toBe('Dat is de hele lijst.');
  });

  test('the empty state states a fact rather than promising content', () => {
    expect(BOARD_EMPTY_COPY).toBe('Nog niet genoeg beoordelingen.');
  });
});

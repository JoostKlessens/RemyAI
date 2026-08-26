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
import { LEADERBOARD_MIN_VOTES } from '@/domain/social/leaderboard';
import {
  BOARD_EMPTY_COPY,
  BOARD_END_COPY,
  LEADERBOARD_MAX_ROWS,
  assembleLeaderboard,
  buildBoardMetaLine,
  buildBoardRowAccessibilityLabel,
  formatBoardAverage,
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

describe('formatBoardAverage', () => {
  /** The single most likely silent regression on this screen: a Dutch interface printing "4.8". */
  test('writes the decimal separator as a comma, never a point', () => {
    expect(formatBoardAverage(4.83)).toBe('4,8');
    expect(formatBoardAverage(4.83)).not.toContain('.');
  });

  test('always shows one decimal, so a column of scores stays the same width', () => {
    expect(formatBoardAverage(5)).toBe('5,0');
    expect(formatBoardAverage(4)).toBe('4,0');
  });

  test('rounds rather than truncates', () => {
    expect(formatBoardAverage(4.86)).toBe('4,9');
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
  test('pairs the average with the evidence behind it', () => {
    expect(buildBoardMetaLine(4.83, 204)).toContain('4,8');
    expect(buildBoardMetaLine(4.83, 204)).toContain('204 stemmen');
  });

  /**
   * DESIGN §9: "the vote count is never omitted... '4,8' alone is a claim
   * with its evidence removed."
   */
  test('never renders the average on its own', () => {
    expect(buildBoardMetaLine(5, 3)).not.toBe('5,0');
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

  test('shows the honest average, not the score that ordered the board', () => {
    const rows = assembleLeaderboard({
      ratings: [...votes('perfect', 5, LEADERBOARD_MIN_VOTES), ...votes('ballast', 1, 40)],
      recipes: [
        makeBoardRecipe({ recipeId: 'perfect' }),
        makeBoardRecipe({ recipeId: 'ballast', title: 'Ballast' }),
      ],
      excludedAllergenTags: [],
    });
    expect(rows[0]?.metaLine).toContain('5,0');
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

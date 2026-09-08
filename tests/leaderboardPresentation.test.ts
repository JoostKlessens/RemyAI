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
  describeCookTime,
  formatBoardScore,
  formatCookTime,
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
    // The two filter axes, added 8 September 2026. Both default to their
    // absent value rather than to something convenient: an empty `dish_tags`
    // and a null `estimated_minutes` are the ordinary state of a canonical
    // recipe, not an edge case, so the default fixture is the ordinary one.
    dishTags: [],
    estimatedMinutes: null,
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

describe('the cook time on a card', () => {
  /** The visible form, which `DecisionCard` prints inline on Kiezen and which therefore has no coverage there. */
  test('is written the way Kiezen writes it', () => {
    expect(formatCookTime(25)).toBe('25 min');
  });

  /**
   * The spoken form is deliberately NOT the visible one: "min" is an
   * abbreviation a screen reader may or may not expand, and which expansion
   * it picks is not something to gamble on.
   */
  test('is spoken in full, never as the abbreviation', () => {
    expect(describeCookTime(25)).toBe('25 minuten');
    expect(describeCookTime(25)).not.toBe(formatCookTime(25));
  });
});

describe('buildBoardRowAccessibilityLabel', () => {
  const label = (recipe: BoardRecipe): string => {
    const rows = assembleLeaderboard({
      ratings: votes(recipe.recipeId, 5, LEADERBOARD_MIN_VOTES + 10),
      recipes: [recipe],
      excludedAllergenTags: recipe.allergenTags,
    });
    expect(rows[0]).toBeDefined();
    return buildBoardRowAccessibilityLabel(rows[0]!);
  };

  test('reads the dish and the score as one sentence', () => {
    const spoken = label(makeBoardRecipe());
    expect(spoken).toContain('Pistache-tiramisu');
    expect(spoken).toContain('5,0');
    expect(spoken).toContain('@kokenmetkees');
  });

  /**
   * THE RANK LEFT THE SENTENCE WHEN IT LEFT THE CARD (8 September 2026).
   * A position spoken to one reader and drawn for nobody is the mirror image
   * of the failure PD-007a's "labelled, never hidden" is about: two readers
   * would be told two different things about one card, and the one who cannot
   * see the screen would be the only one holding a number they cannot check.
   *
   * Asserted on the FIRST card, whose rank is 1, and against a title and a
   * score that contain no "1." — so this fails the moment a rank prefix comes
   * back.
   */
  test('no longer announces a board position the card does not draw', () => {
    const spoken = label(makeBoardRecipe({ title: 'Zalm met venkel' }));
    expect(spoken.startsWith('1.')).toBe(false);
    expect(spoken.startsWith('Zalm met venkel')).toBe(true);
  });

  test('speaks the cook time when the recipe has one', () => {
    expect(label(makeBoardRecipe({ estimatedMinutes: 25 }))).toContain('25 minuten');
  });

  /** Null is the ordinary state of `estimated_minutes`, and an absent fact must produce no sentence rather than "onbekend". */
  test('says nothing at all about time when the recipe has none', () => {
    expect(label(makeBoardRecipe({ estimatedMinutes: null }))).not.toContain('minuten');
  });

  test('carries the collision label into the spoken description', () => {
    expect(label(makeBoardRecipe({ allergenTags: ['noten'] }))).toContain('bevat noten');
  });
});

describe('the filter axes on a row model', () => {
  /**
   * The board's own filter reads these two fields off the assembled cards
   * rather than re-fetching the recipes behind them (see
   * src/lib/trendingSource.ts on why the cut happens first), so a row that
   * dropped them would silently make every chip return nothing.
   */
  test('carries the recipe’s dishTags and cook time through to the card', () => {
    const rows = assembleLeaderboard({
      ratings: votes('recipe-1', 5, LEADERBOARD_MIN_VOTES + 10),
      recipes: [makeBoardRecipe({ dishTags: ['soep', 'veganistisch'], estimatedMinutes: 30 })],
      excludedAllergenTags: [],
    });
    expect(rows[0]?.dishTags).toEqual(['soep', 'veganistisch']);
    expect(rows[0]?.estimatedMinutes).toBe(30);
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

/**
 * The write path that copies a canonical `recipes` row into a household's
 * `meals` (src/domain/social/recipeCopy.ts).
 *
 * WHY THIS SUITE EXISTS. Measured on 8 September 2026 (GAP-55): there was
 * no write path anywhere in this codebase that turned a `recipes` row into
 * a `meals` row. `importRecipe.ts` posts a URL and re-parses; the shared
 * recipe screen had no `Bewaren` for exactly that reason and said so in its
 * own header. This module is that path, and this file is what notices if it
 * ever stops keeping PD-010's one hard promise — a copied meal starts at
 * `allergenTagStatus: 'unknown'`, because someone else's "verified" is not
 * evidence for your kitchen — or drops the `recipeId` that makes cook proof
 * possible at all.
 */

import { describe, expect, test } from 'vitest';
import { EU_ALLERGEN_TAGS } from '@/domain/allergens';
import { buildMealCopy, findExistingRecipeCopy, type CopyableRecipe } from '@/domain/social/recipeCopy';
import { makeMeal } from '../fixtures';

const HOUSEHOLD = 'household-1';

function makeCopyableRecipe(overrides: Partial<CopyableRecipe> = {}): CopyableRecipe {
  return {
    recipeId: 'recipe-1',
    title: 'Traybake met kip, paprika en citroen',
    platform: 'tiktok',
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/7412998877665',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/traybake~tplv-thumb.jpg',
    estimatedMinutes: 35,
    servings: 4,
    dishTags: ['ovenschotel'],
    ingredients: [
      { name: 'kipdijfilet', quantity: '600', unit: 'g', sortOrder: 0, section: null },
      { name: 'paprika', quantity: '2', unit: null, sortOrder: 1, section: 'Voor de bakplaat' },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Oven op 200 graden.' },
      { stepNumber: 2, instruction: 'Alles op de bakplaat, 35 minuten.' },
    ],
    ...overrides,
  };
}

describe('buildMealCopy — PD-010 / PD-006 guarantee', () => {
  test('always starts the copy at the literal "unknown", whatever the recipe says', () => {
    const copy = buildMealCopy(makeCopyableRecipe(), HOUSEHOLD);
    expect(copy.allergenTagStatus).toBe('unknown');
  });

  test('never carries allergen tags across the household boundary, even when an ingredient is named after one', () => {
    const copy = buildMealCopy(
      makeCopyableRecipe({
        ingredients: [
          { name: 'pinda', quantity: null, unit: null, sortOrder: 0, section: null },
          { name: 'noten', quantity: null, unit: null, sortOrder: 1, section: null },
        ],
      }),
      HOUSEHOLD,
    );
    expect(copy.ingredientTags).toEqual([]);
    expect(copy.allergenTagStatus).toBe('unknown');
  });

  test('no dish tag it carries is ever an allergen literal', () => {
    const copy = buildMealCopy(makeCopyableRecipe({ dishTags: ['ovenschotel', 'kip'] }), HOUSEHOLD);
    for (const tag of copy.dishTags) {
      expect(EU_ALLERGEN_TAGS).not.toContain(tag);
    }
  });
});

describe('buildMealCopy — the link that makes cook proof possible', () => {
  test('carries the canonical recipe id verbatim', () => {
    const copy = buildMealCopy(makeCopyableRecipe({ recipeId: 'recipe-42' }), HOUSEHOLD);
    expect(copy.recipeId).toBe('recipe-42');
  });

  test('belongs to the household that saved it, as a saved meal with no skill level guessed', () => {
    const copy = buildMealCopy(makeCopyableRecipe(), 'household-9');
    expect(copy.householdId).toBe('household-9');
    expect(copy.source).toBe('saved');
    expect(copy.skillLevel).toBeNull();
  });
});

describe('buildMealCopy — what travels', () => {
  test('carries the recipe facts straight through', () => {
    const copy = buildMealCopy(makeCopyableRecipe(), HOUSEHOLD);
    expect(copy.title).toBe('Traybake met kip, paprika en citroen');
    expect(copy.estimatedMinutes).toBe(35);
    expect(copy.servings).toBe(4);
    expect(copy.dishTags).toEqual(['ovenschotel']);
    expect(copy.sourceUrl).toBe('https://www.tiktok.com/@kokenmetkees/video/7412998877665');
    expect(copy.thumbnailUrl).toBe('https://p16-sign.tiktokcdn.com/traybake~tplv-thumb.jpg');
  });

  test('carries ingredients with their order and sub-recipe heading', () => {
    const copy = buildMealCopy(makeCopyableRecipe(), HOUSEHOLD);
    expect(copy.ingredients).toEqual([
      { name: 'kipdijfilet', quantity: '600', unit: 'g', sortOrder: 0, section: null },
      { name: 'paprika', quantity: '2', unit: null, sortOrder: 1, section: 'Voor de bakplaat' },
    ]);
  });

  test('carries steps with no timer, because a canonical recipe holds none', () => {
    const copy = buildMealCopy(makeCopyableRecipe(), HOUSEHOLD);
    expect(copy.steps).toEqual([
      { stepNumber: 1, instruction: 'Oven op 200 graden.', durationMinutes: null },
      { stepNumber: 2, instruction: 'Alles op de bakplaat, 35 minuten.', durationMinutes: null },
    ]);
  });

  test('an empty canonical recipe yields a title-only meal, never an invented list', () => {
    const copy = buildMealCopy(makeCopyableRecipe({ ingredients: [], steps: [] }), HOUSEHOLD);
    expect(copy.ingredients).toEqual([]);
    expect(copy.steps).toEqual([]);
  });

  /**
   * `meals.source_platform` (0001) still speaks the two-word vocabulary it
   * was born with — the same bridge `toMealDraft` and `mealStub` apply.
   */
  test('bridges the platform onto the meals column, and admits when it has no word', () => {
    expect(buildMealCopy(makeCopyableRecipe({ platform: 'tiktok' }), HOUSEHOLD).sourcePlatform).toBe('tiktok');
    expect(buildMealCopy(makeCopyableRecipe({ platform: 'instagram' }), HOUSEHOLD).sourcePlatform).toBe('reels');
    // 0011 widened `recipes.platform` to YouTube while the summary type did
    // not follow; the row is real and the honest column value is null.
    const youtube = { ...makeCopyableRecipe(), platform: 'youtube' as CopyableRecipe['platform'] };
    expect(buildMealCopy(youtube, HOUSEHOLD).sourcePlatform).toBeNull();
  });

  test('never mutates the recipe it was handed', () => {
    const recipe = makeCopyableRecipe();
    const snapshot = JSON.parse(JSON.stringify(recipe)) as CopyableRecipe;
    const copy = buildMealCopy(recipe, HOUSEHOLD);
    expect(recipe).toEqual(snapshot);
    expect(copy.ingredients).not.toBe(recipe.ingredients);
    expect(copy.steps).not.toBe(recipe.steps);
  });
});

describe('findExistingRecipeCopy — a household holds one copy, not a stack', () => {
  const recipe = makeCopyableRecipe();

  test('finds the household meal already copied from this recipe', () => {
    const meals = [makeMeal({ id: 'meal-a', householdId: HOUSEHOLD, recipeId: 'recipe-1' })];
    expect(findExistingRecipeCopy(meals, recipe, HOUSEHOLD)?.id).toBe('meal-a');
  });

  test('finds an older import of the same address that predates the recipe link', () => {
    const meals = [makeMeal({ id: 'meal-old', householdId: HOUSEHOLD, recipeId: null, sourceUrl: recipe.sourceUrl })];
    expect(findExistingRecipeCopy(meals, recipe, HOUSEHOLD)?.id).toBe('meal-old');
  });

  test('ignores an archived copy — the household removed it, so a new save is a new copy', () => {
    const meals = [
      makeMeal({ id: 'meal-gone', householdId: HOUSEHOLD, recipeId: 'recipe-1', archivedAt: '2026-08-01T00:00:00.000Z' }),
    ];
    expect(findExistingRecipeCopy(meals, recipe, HOUSEHOLD)).toBeNull();
  });

  test('ignores a curated meal, which belongs to no household', () => {
    const meals = [makeMeal({ id: 'meal-curated', householdId: null, recipeId: 'recipe-1' })];
    expect(findExistingRecipeCopy(meals, recipe, HOUSEHOLD)).toBeNull();
  });

  test("ignores another household's copy", () => {
    const meals = [makeMeal({ id: 'meal-theirs', householdId: 'household-2', recipeId: 'recipe-1' })];
    expect(findExistingRecipeCopy(meals, recipe, HOUSEHOLD)).toBeNull();
  });

  test('a hand-entered meal with no address and no recipe never matches', () => {
    const meals = [makeMeal({ id: 'meal-typed', householdId: HOUSEHOLD, recipeId: null, sourceUrl: null })];
    expect(findExistingRecipeCopy(meals, recipe, HOUSEHOLD)).toBeNull();
  });
});

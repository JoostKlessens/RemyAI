/**
 * Grouping a recipe's ingredients under the sub-recipe headings the source
 * itself printed ("Voor het beslag", "Voor de frosting").
 *
 * These tests are mostly about the ORDINARY case, which is a recipe with no
 * headings at all. That is what almost every row in every install is, so the
 * assertion that matters most here is the boring one: an unsectioned list
 * comes back as exactly one unlabelled group, in `sortOrder` order, with
 * nothing added and nothing moved. A grouping function that made a plain
 * shopping-style list look different would have broken the majority case to
 * serve the minority one.
 *
 * The rest pin the three rulings the module makes that a reader could
 * otherwise reasonably guess the other way: the same heading twice is one
 * group, an ingredient with no heading is never rendered underneath somebody
 * else's, and a heading is compared case/whitespace-insensitively but
 * DISPLAYED exactly as the source wrote it.
 */

import { describe, expect, test } from 'vitest';
import { groupIngredientsBySection } from '@/domain/ingredientSections';
import type { MealIngredient } from '@/domain/types';

function makeIngredient(overrides: Partial<MealIngredient> & { readonly sortOrder: number }): MealIngredient {
  return {
    id: `ingredient-${overrides.sortOrder}`,
    mealId: 'meal-1',
    name: `ingredient ${overrides.sortOrder}`,
    quantity: null,
    unit: null,
    allergenTags: [],
    ...overrides,
  };
}

/** The shape the screen actually renders: labels in order, names in order. */
function summarize(
  groups: readonly { readonly label: string | null; readonly ingredients: readonly MealIngredient[] }[],
): readonly (readonly [string | null, readonly string[]])[] {
  return groups.map((group) => [group.label, group.ingredients.map((ingredient) => ingredient.name)] as const);
}

describe('groupIngredientsBySection — the ordinary recipe, which has no sections', () => {
  test('returns no groups at all for an empty ingredient list', () => {
    expect(groupIngredientsBySection([])).toEqual([]);
  });

  test('returns one unlabelled group holding every ingredient in sortOrder', () => {
    const ingredients = [
      makeIngredient({ sortOrder: 1, name: 'ui' }),
      makeIngredient({ sortOrder: 0, name: 'bloem' }),
      makeIngredient({ sortOrder: 2, name: 'zout' }),
    ];

    expect(summarize(groupIngredientsBySection(ingredients))).toEqual([[null, ['bloem', 'ui', 'zout']]]);
  });

  test('treats a legacy row with no section key at all exactly like an explicit null', () => {
    const withKey = makeIngredient({ sortOrder: 0, name: 'bloem', section: null });
    // A row written before migration 0018 has no `section` key whatsoever.
    const withoutKey = makeIngredient({ sortOrder: 1, name: 'ui' });

    expect(summarize(groupIngredientsBySection([withKey, withoutKey]))).toEqual([[null, ['bloem', 'ui']]]);
  });

  test('reads a blank or whitespace-only section as no section, never as a heading', () => {
    const ingredients = [
      makeIngredient({ sortOrder: 0, name: 'bloem', section: '' }),
      makeIngredient({ sortOrder: 1, name: 'ui', section: '   ' }),
    ];

    expect(summarize(groupIngredientsBySection(ingredients))).toEqual([[null, ['bloem', 'ui']]]);
  });
});

describe('groupIngredientsBySection — a recipe that names its sub-recipes', () => {
  test('splits the list into one group per heading, in the order the headings first appear', () => {
    const ingredients = [
      makeIngredient({ sortOrder: 0, name: 'bloem', section: 'Voor het beslag' }),
      makeIngredient({ sortOrder: 1, name: 'suiker', section: 'Voor het beslag' }),
      makeIngredient({ sortOrder: 2, name: 'roomboter', section: 'Voor de frosting' }),
    ];

    expect(summarize(groupIngredientsBySection(ingredients))).toEqual([
      ['Voor het beslag', ['bloem', 'suiker']],
      ['Voor de frosting', ['roomboter']],
    ]);
  });

  test('displays the heading exactly as the source wrote it, trimmed and never reworded', () => {
    const ingredients = [makeIngredient({ sortOrder: 0, name: 'bloem', section: '  Beslag  ' })];

    expect(groupIngredientsBySection(ingredients)[0]?.label).toBe('Beslag');
  });

  test('folds a heading that reappears further down into the group it already opened', () => {
    const ingredients = [
      makeIngredient({ sortOrder: 0, name: 'bloem', section: 'Beslag' }),
      makeIngredient({ sortOrder: 1, name: 'roomboter', section: 'Frosting' }),
      makeIngredient({ sortOrder: 2, name: 'eieren', section: 'Beslag' }),
    ];

    expect(summarize(groupIngredientsBySection(ingredients))).toEqual([
      ['Beslag', ['bloem', 'eieren']],
      ['Frosting', ['roomboter']],
    ]);
  });

  test('treats two spellings of one heading as one heading and shows the first spelling', () => {
    const ingredients = [
      makeIngredient({ sortOrder: 0, name: 'bloem', section: 'Beslag' }),
      makeIngredient({ sortOrder: 1, name: 'eieren', section: 'beslag ' }),
    ];

    expect(summarize(groupIngredientsBySection(ingredients))).toEqual([['Beslag', ['bloem', 'eieren']]]);
  });

  test('puts the unlabelled ingredients first, so none of them can read as part of a heading', () => {
    const ingredients = [
      makeIngredient({ sortOrder: 0, name: 'bloem', section: 'Beslag' }),
      makeIngredient({ sortOrder: 1, name: 'roomboter', section: 'Frosting' }),
      // Trailing and unlabelled: belongs to neither, and would read as
      // frosting if it were left where the source put it.
      makeIngredient({ sortOrder: 2, name: 'snufje zout', section: null }),
    ];

    expect(summarize(groupIngredientsBySection(ingredients))).toEqual([
      [null, ['snufje zout']],
      ['Beslag', ['bloem']],
      ['Frosting', ['roomboter']],
    ]);
  });

  test('never mutates or reorders the array it was given', () => {
    const ingredients = [
      makeIngredient({ sortOrder: 2, name: 'zout' }),
      makeIngredient({ sortOrder: 0, name: 'bloem' }),
    ];
    const before = ingredients.map((ingredient) => ingredient.name);

    groupIngredientsBySection(ingredients);

    expect(ingredients.map((ingredient) => ingredient.name)).toEqual(before);
  });

  test('keeps every ingredient exactly once, whatever the headings say', () => {
    const ingredients = [
      makeIngredient({ sortOrder: 0, name: 'a', section: 'X' }),
      makeIngredient({ sortOrder: 1, name: 'b' }),
      makeIngredient({ sortOrder: 2, name: 'c', section: 'Y' }),
      makeIngredient({ sortOrder: 3, name: 'd', section: 'X' }),
    ];

    const flattened = groupIngredientsBySection(ingredients).flatMap((group) => group.ingredients);

    expect(flattened).toHaveLength(ingredients.length);
    expect(new Set(flattened.map((ingredient) => ingredient.id)).size).toBe(ingredients.length);
  });
});

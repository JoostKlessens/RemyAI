/**
 * Test data builders for the recipe-import test suite. Mirrors the
 * `makeX(overrides)` convention in tests/fixtures.ts and
 * tests/feed/fixtures.ts: fully-populated, valid defaults, overridable via
 * a partial, no shared mutable state between calls.
 */

import type { ParsedIngredient, ParsedRecipe } from '@/domain/import/types';

export function makeParsedIngredient(overrides: Partial<ParsedIngredient> = {}): ParsedIngredient {
  return {
    name: 'Kipfilet',
    quantity: '300',
    unit: 'g',
    ...overrides,
  };
}

export function makeParsedRecipe(overrides: Partial<ParsedRecipe> = {}): ParsedRecipe {
  return {
    title: 'Traybake met kip en citroen',
    ingredients: [makeParsedIngredient()],
    steps: ['Oven voorverwarmen op 200 graden.', 'Kip en groenten 25 minuten roosteren.'],
    estimatedMinutes: 25,
    servings: 4,
    ...overrides,
  };
}

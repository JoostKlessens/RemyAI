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
    // STATED, and `null` rather than a heading. `dishTags` below defaults to a
    // non-empty value precisely so a regression that drops it still fails an
    // assertion; this one defaults the opposite way for the opposite reason.
    // A sub-recipe heading is the field a model is tempted to INVENT
    // (buildExtractionRequest.ts's header argues it), so the fixture's normal
    // state has to be the normal recipe: no heading anywhere. Tests about
    // headings state one explicitly.
    section: null,
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
    // Deliberately non-empty by default: a `[]` default would let a
    // regression that drops dishTags on the floor (toMealDraft, the
    // repository) still pass every assertion downstream of it.
    dishTags: ['kip'],
    ...overrides,
  };
}

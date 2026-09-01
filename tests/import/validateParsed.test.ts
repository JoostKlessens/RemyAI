import { describe, expect, test } from 'vitest';
import { validateParsedRecipe } from '@/domain/import/validateParsed';

const VALID_RAW = {
  title: 'Traybake met kip en citroen',
  ingredients: [
    { name: 'Kipfilet', quantity: '300', unit: 'g' },
    { name: 'Citroen', quantity: '1', unit: null },
  ],
  steps: ['Oven voorverwarmen op 200 graden.', 'Alles 25 minuten roosteren.'],
  estimatedMinutes: 25,
  servings: 4,
  dishTags: ['kip'],
};

describe('validateParsedRecipe — valid shapes', () => {
  test('accepts a fully populated, well-formed recipe', () => {
    expect(validateParsedRecipe(VALID_RAW)).toEqual(VALID_RAW);
  });

  test('trims a title with surrounding whitespace', () => {
    const result = validateParsedRecipe({ ...VALID_RAW, title: '  Traybake  ' });
    expect(result?.title).toBe('Traybake');
  });

  test('treats a missing quantity/unit key on an ingredient as null', () => {
    const result = validateParsedRecipe({
      ...VALID_RAW,
      ingredients: [{ name: 'Zout' }],
    });
    expect(result?.ingredients).toEqual([{ name: 'Zout', quantity: null, unit: null }]);
  });

  test('treats explicit null quantity/unit as null', () => {
    const result = validateParsedRecipe({
      ...VALID_RAW,
      ingredients: [{ name: 'Zout', quantity: null, unit: null }],
    });
    expect(result?.ingredients).toEqual([{ name: 'Zout', quantity: null, unit: null }]);
  });

  test('treats missing estimatedMinutes/servings keys as null', () => {
    const { estimatedMinutes: _m, servings: _s, ...withoutOptionalFields } = VALID_RAW;
    const result = validateParsedRecipe(withoutOptionalFields);
    expect(result?.estimatedMinutes).toBeNull();
    expect(result?.servings).toBeNull();
  });

  test('ignores unknown extra fields on the raw object', () => {
    const result = validateParsedRecipe({ ...VALID_RAW, extraField: 'should be ignored', confidence: 0.9 });
    expect(result).toEqual(VALID_RAW);
  });
});

/**
 * The closed dish vocabulary (src/domain/dishTags.ts) meets untrusted
 * input here. Two different failures are deliberately treated differently:
 *
 * - A value the vocabulary does not know is DROPPED, not rejected. That is
 *   the entire point of a closed vocabulary — a model that answers
 *   "italiaans" loses that one tag, and the perfectly good recipe around
 *   it survives. Rejecting the whole recipe over a descriptive, optional
 *   category would turn a cosmetic miss into a user-facing `parse_failed`.
 * - A malformed CONTAINER (dishTags is a bare string, or holds a number)
 *   is rejected like any other bad shape in this file, because that is not
 *   the model choosing a wrong word — it is the model not honouring the
 *   schema at all, and this file's contract is that structural doubt fails
 *   the whole recipe rather than being silently coerced.
 *
 * Normalization is `sanitizeDishTags` + `normalizeTag` and nothing else:
 * one path, shared with restriction entry and meal tagging, so a stored
 * dish tag is comparable by `Set.has()` with no re-normalization anywhere
 * downstream.
 */
describe('validateParsedRecipe — dishTags (closed vocabulary)', () => {
  test('keeps a tag the vocabulary knows', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, dishTags: ['pasta', 'soep'] })?.dishTags).toEqual(['pasta', 'soep']);
  });

  test('treats a missing dishTags key as an empty list, not as a malformed recipe', () => {
    const { dishTags: _dishTags, ...withoutDishTags } = VALID_RAW;
    expect(validateParsedRecipe(withoutDishTags)?.dishTags).toEqual([]);
  });

  test('treats an explicit null dishTags as an empty list', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, dishTags: null })?.dishTags).toEqual([]);
  });

  test('treats an empty dishTags array as an empty list', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, dishTags: [] })?.dishTags).toEqual([]);
  });

  test('normalizes a capitalized/padded model answer rather than storing the raw spelling', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, dishTags: ['Pasta', ' SOEP '] })?.dishTags).toEqual(['pasta', 'soep']);
  });

  test('drops an invented category but keeps the rest of the recipe', () => {
    const result = validateParsedRecipe({ ...VALID_RAW, dishTags: ['italiaans', 'pasta'] });
    expect(result?.dishTags).toEqual(['pasta']);
    expect(result?.title).toBe(VALID_RAW.title);
  });

  test('drops every tag when the model invents all of them, rather than failing the recipe', () => {
    const result = validateParsedRecipe({ ...VALID_RAW, dishTags: ['italiaans', 'comfortfood'] });
    expect(result?.dishTags).toEqual([]);
    expect(result?.steps).toEqual(VALID_RAW.steps);
  });

  test('de-duplicates tags that normalize to the same value', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, dishTags: ['pasta', 'Pasta', ' pasta'] })?.dishTags).toEqual(['pasta']);
  });

  /**
   * PD-006 boundary at the import seam: an allergen literal must never
   * survive into `dishTags`, and — just as importantly — must never reach
   * `ingredientTags` from here either (toMealDraft.ts holds that second
   * half; see its own suite).
   */
  test('drops an allergen value rather than accepting it as a category', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, dishTags: ['noten', 'gluten'] })?.dishTags).toEqual([]);
  });

  test('rejects dishTags that is not an array (a malformed shape, not a wrong word)', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, dishTags: 'pasta' })).toBeNull();
  });

  test('rejects a dishTags array holding a non-string entry', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, dishTags: ['pasta', 42] })).toBeNull();
  });

  /**
   * `ParsedRecipe.dishTags` is a REQUIRED field now, and this function is
   * the only door a real model response comes through — so "the key is
   * always present on what comes out" has to hold whatever went in. The
   * type enforces it at the single `return`; this asserts it across every
   * shape of input that produces a recipe at all, so a future early
   * success path cannot quietly ship a recipe whose categories are a
   * missing key rather than an empty list.
   */
  test('always states dishTags on the way out, for every input that yields a recipe', () => {
    const { dishTags: _dishTags, ...withoutDishTags } = VALID_RAW;
    const inputs: readonly unknown[] = [
      VALID_RAW,
      { ...VALID_RAW, dishTags: [] },
      { ...VALID_RAW, dishTags: null },
      { ...VALID_RAW, dishTags: ['italiaans'] },
      withoutDishTags,
    ];

    for (const input of inputs) {
      const result = validateParsedRecipe(input);
      expect(result).not.toBeNull();
      expect(result !== null && 'dishTags' in result).toBe(true);
      expect(Array.isArray(result?.dishTags)).toBe(true);
    }
  });
});

describe('validateParsedRecipe — rejects malformed shapes (never a half-populated recipe)', () => {
  test('rejects a non-object root value', () => {
    expect(validateParsedRecipe('just a string')).toBeNull();
    expect(validateParsedRecipe(42)).toBeNull();
    expect(validateParsedRecipe(null)).toBeNull();
    expect(validateParsedRecipe(undefined)).toBeNull();
    expect(validateParsedRecipe([])).toBeNull();
  });

  test('rejects a missing title', () => {
    const { title: _title, ...withoutTitle } = VALID_RAW;
    expect(validateParsedRecipe(withoutTitle)).toBeNull();
  });

  test('rejects a blank/whitespace-only title', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, title: '   ' })).toBeNull();
  });

  test('rejects a non-string title', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, title: 123 })).toBeNull();
  });

  test('rejects a missing ingredients array', () => {
    const { ingredients: _ingredients, ...withoutIngredients } = VALID_RAW;
    expect(validateParsedRecipe(withoutIngredients)).toBeNull();
  });

  test('rejects an empty ingredients array (structurally recipe-shaped but substantively empty)', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, ingredients: [] })).toBeNull();
  });

  test('rejects ingredients that is not an array', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, ingredients: 'kip, citroen' })).toBeNull();
  });

  test('rejects an ingredient missing a name', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, ingredients: [{ quantity: '1', unit: 'stuk' }] })).toBeNull();
  });

  test('rejects an ingredient with a non-string quantity (e.g. a bare number)', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, ingredients: [{ name: 'Citroen', quantity: 1 }] })).toBeNull();
  });

  test('rejects an ingredient with a non-string unit', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, ingredients: [{ name: 'Citroen', unit: 5 }] })).toBeNull();
  });

  test('rejects a missing steps array', () => {
    const { steps: _steps, ...withoutSteps } = VALID_RAW;
    expect(validateParsedRecipe(withoutSteps)).toBeNull();
  });

  test('rejects an empty steps array', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, steps: [] })).toBeNull();
  });

  test('rejects steps that is not an array', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, steps: 'do the thing' })).toBeNull();
  });

  test('rejects a non-string step entry', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, steps: ['Roast it', 42] })).toBeNull();
  });

  test('rejects a blank step entry', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, steps: ['Roast it', '   '] })).toBeNull();
  });

  test('rejects a non-integer estimatedMinutes', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, estimatedMinutes: 25.5 })).toBeNull();
  });

  test('rejects a zero or negative estimatedMinutes', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, estimatedMinutes: 0 })).toBeNull();
    expect(validateParsedRecipe({ ...VALID_RAW, estimatedMinutes: -5 })).toBeNull();
  });

  test('rejects a non-numeric estimatedMinutes', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, estimatedMinutes: '25' })).toBeNull();
  });

  test('rejects a zero or negative servings', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, servings: 0 })).toBeNull();
    expect(validateParsedRecipe({ ...VALID_RAW, servings: -1 })).toBeNull();
  });

  test('rejects a non-numeric servings', () => {
    expect(validateParsedRecipe({ ...VALID_RAW, servings: '4 personen' })).toBeNull();
  });
});

import { describe, expect, test } from 'vitest';
import { buildEditedRecipe } from '@/domain/import/editedRecipe';
import { makeParsedIngredient } from './fixtures';
import type { ParsedIngredient } from '@/domain/import/types';

/**
 * THE FIRST TESTS THIS FUNCTION HAS EVER HAD. It lived inside
 * src/app/import/confirm.tsx, which vitest cannot import
 * (src/domain/offerablePool.ts's header holds the measurement), and its own
 * comments record two field losses that shipped silently from exactly that
 * position — `dishTags` dropped on every edit, and every ingredient
 * flattened to free text on every save. Both are asserted below, in the
 * direction that fails if either comes back.
 */

const ARRIVED: readonly ParsedIngredient[] = [
  makeParsedIngredient({ name: 'Kipfilet', quantity: '300', unit: 'g' }),
  makeParsedIngredient({ name: 'Paprika', quantity: '2', unit: null }),
];

/** The lines the screen renders for `ARRIVED`, i.e. nobody has typed anything. */
const UNTOUCHED_LINES: readonly string[] = ['300 g Kipfilet', '2 Paprika'];

function build(overrides: Partial<Parameters<typeof buildEditedRecipe>[0]> = {}) {
  return buildEditedRecipe({
    title: 'Traybake met kip',
    arrivedIngredients: ARRIVED,
    ingredientLines: UNTOUCHED_LINES,
    stepLines: ['Oven voorverwarmen.', 'Kip roosteren.'],
    estimatedMinutesText: '25',
    servingsText: '4',
    dishTags: ['kip'],
    ...overrides,
  });
}

describe('CARRIED — dishTags', () => {
  /**
   * The regression that made `ParsedRecipe.dishTags` a required field: a
   * user who fixed a typo in the title lost the recipe's categories, and
   * Bibliotheek's filter then under-reported what the household owns.
   */
  test('travel through unchanged, whatever else was edited', () => {
    const recipe = build({ title: 'Andere titel', dishTags: ['kip', 'ovenschotel'] });
    expect(recipe.dishTags).toEqual(['kip', 'ovenschotel']);
  });

  test('an empty list stays empty and is never guessed at from the title or the ingredients', () => {
    expect(build({ dishTags: [] }).dishTags).toEqual([]);
  });
});

describe('BOTH, PER LINE — ingredients', () => {
  /**
   * The other shipped loss. Every line used to be written back as
   * `{ name: line, quantity: null, unit: null }`, so merely opening the
   * screen destroyed amounts the source had given us — `scaleRecipe.ts`
   * cannot halve an amount folded into a name.
   */
  test('a line nobody touched recovers its arriving ingredient, quantity and unit intact', () => {
    expect(build().ingredients).toEqual(ARRIVED);
  });

  test('a line the user edited becomes honest free text, with no quantity re-parsed out of it', () => {
    const recipe = build({ ingredientLines: ['400 g Kipfilet', '2 Paprika'] });
    expect(recipe.ingredients[0]).toEqual({ name: '400 g Kipfilet', quantity: null, unit: null });
    // The untouched second line is unaffected by its neighbour's edit.
    expect(recipe.ingredients[1]).toEqual(ARRIVED[1]);
  });

  test('a trailing space is not an edit — a soft keyboard must not cost a quantity', () => {
    const recipe = build({ ingredientLines: ['300 g Kipfilet ', ' 2 Paprika'] });
    expect(recipe.ingredients).toEqual(ARRIVED);
  });

  test('a line the user added is free text, and a line the user removed is gone', () => {
    const recipe = build({ ingredientLines: ['300 g Kipfilet', 'snufje zout'] });
    expect(recipe.ingredients).toEqual([ARRIVED[0], { name: 'snufje zout', quantity: null, unit: null }]);
  });

  test('a blank row left behind by "+ Ingrediënt toevoegen" is dropped, not stored empty', () => {
    const recipe = build({ ingredientLines: ['300 g Kipfilet', '   ', '2 Paprika'] });
    expect(recipe.ingredients).toEqual(ARRIVED);
  });

  /** Manual entry: nothing arrived, so nothing can be recovered and every line is correctly free text. */
  test('with no arrival at all, every line is free text', () => {
    const recipe = build({ arrivedIngredients: [], ingredientLines: ['300 g Kipfilet'] });
    expect(recipe.ingredients).toEqual([{ name: '300 g Kipfilet', quantity: null, unit: null }]);
  });
});

describe('EDITED — title, steps, minutes, servings', () => {
  test('the title is taken as given, never from the pre-edit arrival', () => {
    expect(build({ title: 'Andere titel' }).title).toBe('Andere titel');
  });

  test('steps are trimmed and blank ones dropped', () => {
    const recipe = build({ stepLines: ['  Oven voorverwarmen.  ', '', '   ', 'Kip roosteren.'] });
    expect(recipe.steps).toEqual(['Oven voorverwarmen.', 'Kip roosteren.']);
  });

  test('step order is the order on the screen', () => {
    const recipe = build({ stepLines: ['Eerst', 'Dan', 'Tot slot'] });
    expect(recipe.steps).toEqual(['Eerst', 'Dan', 'Tot slot']);
  });

  test('minutes and servings are read from the fields, not from the arrival', () => {
    const recipe = build({ estimatedMinutesText: '45', servingsText: '2' });
    expect(recipe.estimatedMinutes).toBe(45);
    expect(recipe.servings).toBe(2);
  });
});

/**
 * `ParsedRecipe` says these two are set only when genuinely known, so every
 * unusable field has to reach `null` rather than 0, NaN or a guess — a
 * stored `estimatedMinutes: 0` would read as "this takes no time".
 */
describe('minutes and servings that are not a usable number', () => {
  test.each([
    ['an empty field', ''],
    ['whitespace only', '   '],
    ['a zero', '0'],
    ['a negative number', '-5'],
    ['text', 'abc'],
  ])('%s becomes null', (_label, text) => {
    const recipe = build({ estimatedMinutesText: text, servingsText: text });
    expect(recipe.estimatedMinutes).toBeNull();
    expect(recipe.servings).toBeNull();
  });

  test('surrounding whitespace around a real number is ignored', () => {
    expect(build({ estimatedMinutesText: '  30  ' }).estimatedMinutes).toBe(30);
  });

  /**
   * CHARACTERISATION, not a decision taken here: `Number.parseInt` stops at
   * the first non-digit, so "12,5" typed into that field stores 12. Both
   * fields are `keyboardType="number-pad"`, which offers no comma on either
   * platform, so this is unreachable from the screen today — pinned so that
   * a future change to the keyboard, or to this parser, has to look at it
   * deliberately rather than discover it in storage.
   */
  test('a decimal separator truncates rather than rounding or refusing', () => {
    expect(build({ servingsText: '12,5' }).servings).toBe(12);
    expect(build({ servingsText: '3.9' }).servings).toBe(3);
  });
});

import { describe, expect, test } from 'vitest';
import { buildShoppingList } from '@/domain/shopping/buildShoppingList';
import type { RawIngredientLine, ShoppingListMealInput } from '@/domain/shopping/types';

function makeIngredient(overrides: Partial<RawIngredientLine> = {}): RawIngredientLine {
  return {
    name: 'ui',
    quantity: '2',
    unit: 'stuk',
    ...overrides,
  };
}

function makeMeal(ingredients: readonly RawIngredientLine[]): ShoppingListMealInput {
  return { ingredients };
}

describe('buildShoppingList', () => {
  test('returns an empty list for no meals', () => {
    expect(buildShoppingList([])).toEqual([]);
  });

  test('returns an empty list when every meal has no ingredients', () => {
    expect(buildShoppingList([makeMeal([]), makeMeal([])])).toEqual([]);
  });

  test('combines the same ingredient and unit across two meals into one summed measure', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'olijfolie', quantity: '2', unit: 'el' })]),
      makeMeal([makeIngredient({ name: 'olijfolie', quantity: '1', unit: 'el' })]),
    ];

    const result = buildShoppingList(meals);

    expect(result).toEqual([
      {
        name: 'olijfolie',
        measures: [
          {
            unit: { kind: 'known', canonical: 'el' },
            numericTotal: 3,
            unparsedLabels: [],
            unspecifiedCount: 0,
          },
        ],
      },
    ]);
  });

  test('combines many different spellings of the same unit into one measure', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'bloem', quantity: '1', unit: 'eetlepel' })]),
      makeMeal([makeIngredient({ name: 'bloem', quantity: '2', unit: 'Eetlepels' })]),
      makeMeal([makeIngredient({ name: 'bloem', quantity: '1', unit: 'el' })]),
    ];

    const result = buildShoppingList(meals);

    expect(result).toHaveLength(1);
    expect(result[0]?.measures).toEqual([
      { unit: { kind: 'known', canonical: 'el' }, numericTotal: 4, unparsedLabels: [], unspecifiedCount: 0 },
    ]);
  });

  test('combines the same ingredient written with different preparation notes', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'ui, fijngesneden', quantity: '1', unit: 'stuk' })]),
      makeMeal([makeIngredient({ name: 'ui, in ringen', quantity: '1', unit: 'stuk' })]),
    ];

    const result = buildShoppingList(meals);

    expect(result).toEqual([
      {
        name: 'ui',
        measures: [
          { unit: { kind: 'known', canonical: 'stuk' }, numericTotal: 2, unparsedLabels: [], unspecifiedCount: 0 },
        ],
      },
    ]);
  });

  test('keeps grams and pieces separate when the same ingredient is measured both ways', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'tomaat', quantity: '200', unit: 'g' })]),
      makeMeal([makeIngredient({ name: 'tomaat', quantity: '2', unit: 'stuks' })]),
    ];

    const result = buildShoppingList(meals);

    expect(result).toHaveLength(1);
    const [item] = result;
    expect(item?.name).toBe('tomaat');
    expect(item?.measures).toHaveLength(2);
    // Never a single combined total for two incompatible units — verify both
    // survive as distinct, individually-readable measures.
    expect(item?.measures).toContainEqual({
      unit: { kind: 'known', canonical: 'g' },
      numericTotal: 200,
      unparsedLabels: [],
      unspecifiedCount: 0,
    });
    expect(item?.measures).toContainEqual({
      unit: { kind: 'known', canonical: 'stuk' },
      numericTotal: 2,
      unparsedLabels: [],
      unspecifiedCount: 0,
    });
  });

  test('never sums grams and pieces into one number', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'tomaat', quantity: '200', unit: 'g' })]),
      makeMeal([makeIngredient({ name: 'tomaat', quantity: '2', unit: 'stuks' })]),
    ];

    const result = buildShoppingList(meals);
    const totals = result[0]?.measures.map((measure) => measure.numericTotal) ?? [];

    expect(totals).not.toContain(202);
  });

  test('keeps an unparsed quantity alongside a numeric total for the same measure without corrupting the sum', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'olijfolie', quantity: '3', unit: 'el' })]),
      makeMeal([makeIngredient({ name: 'olijfolie', quantity: 'een scheut', unit: 'el' })]),
    ];

    const result = buildShoppingList(meals);

    expect(result).toEqual([
      {
        name: 'olijfolie',
        measures: [
          {
            unit: { kind: 'known', canonical: 'el' },
            numericTotal: 3,
            unparsedLabels: ['een scheut'],
            unspecifiedCount: 0,
          },
        ],
      },
    ]);
  });

  test('surfaces a fully unparsed ingredient line with a null numeric total, never coerced to a number', () => {
    const meals = [makeMeal([makeIngredient({ name: 'peper', quantity: 'naar smaak', unit: null })])];

    const result = buildShoppingList(meals);

    expect(result).toEqual([
      {
        name: 'peper',
        measures: [
          { unit: { kind: 'none' }, numericTotal: null, unparsedLabels: ['naar smaak'], unspecifiedCount: 0 },
        ],
      },
    ]);
  });

  test('counts ingredient lines with no quantity at all as unspecified rather than dropping or zeroing them', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'zout', quantity: null, unit: null })]),
      makeMeal([makeIngredient({ name: 'zout', quantity: null, unit: null })]),
    ];

    const result = buildShoppingList(meals);

    expect(result).toEqual([
      {
        name: 'zout',
        measures: [{ unit: { kind: 'none' }, numericTotal: null, unparsedLabels: [], unspecifiedCount: 2 }],
      },
    ]);
  });

  test('drops an ingredient line whose name normalizes to nothing usable', () => {
    const meals = [
      makeMeal([
        makeIngredient({ name: '   ', quantity: '1', unit: 'stuk' }),
        makeIngredient({ name: 'ui', quantity: '1', unit: 'stuk' }),
      ]),
    ];

    const result = buildShoppingList(meals);

    expect(result.map((item) => item.name)).toEqual(['ui']);
  });

  test('keeps a genuinely unrecognized unit separate from ingredients with no unit stated', () => {
    const meals = [
      makeMeal([
        makeIngredient({ name: 'bloem', quantity: '1', unit: 'cup' }),
        makeIngredient({ name: 'bloem', quantity: '2', unit: null }),
      ]),
    ];

    const result = buildShoppingList(meals);

    expect(result).toHaveLength(1);
    expect(result[0]?.measures).toContainEqual({
      unit: { kind: 'unrecognized', raw: 'cup' },
      numericTotal: 1,
      unparsedLabels: [],
      unspecifiedCount: 0,
    });
    expect(result[0]?.measures).toContainEqual({
      unit: { kind: 'none' },
      numericTotal: 2,
      unparsedLabels: [],
      unspecifiedCount: 0,
    });
  });

  test('orders items alphabetically by name regardless of input order', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'zout' }), makeIngredient({ name: 'appel' }), makeIngredient({ name: 'melk' })]),
    ];

    const result = buildShoppingList(meals);

    expect(result.map((item) => item.name)).toEqual(['appel', 'melk', 'zout']);
  });

  test('produces the same output regardless of the order meals are given in', () => {
    const tomaatGrams = makeIngredient({ name: 'tomaat', quantity: '200', unit: 'g' });
    const tomaatStuks = makeIngredient({ name: 'tomaat', quantity: '2', unit: 'stuks' });
    const ui = makeIngredient({ name: 'ui', quantity: '1', unit: 'stuk' });

    const forwardOrder = buildShoppingList([makeMeal([tomaatGrams]), makeMeal([tomaatStuks]), makeMeal([ui])]);
    const reverseOrder = buildShoppingList([makeMeal([ui]), makeMeal([tomaatStuks]), makeMeal([tomaatGrams])]);

    expect(forwardOrder).toEqual(reverseOrder);
  });

  test('does not mutate any input meal or ingredient array', () => {
    const ingredients = [makeIngredient({ name: 'ui' })];
    const meal = makeMeal(ingredients);
    const snapshot = JSON.parse(JSON.stringify(ingredients));

    buildShoppingList([meal]);

    expect(ingredients).toEqual(snapshot);
  });

  test('combines ingredients across more than two meals', () => {
    const meals = [
      makeMeal([makeIngredient({ name: 'knoflook', quantity: '1', unit: 'teen' })]),
      makeMeal([makeIngredient({ name: 'knoflook', quantity: '2', unit: 'teentjes' })]),
      makeMeal([makeIngredient({ name: 'knoflook', quantity: '1', unit: 'teen' })]),
    ];

    const result = buildShoppingList(meals);

    expect(result).toEqual([
      {
        name: 'knoflook',
        measures: [
          { unit: { kind: 'known', canonical: 'teen' }, numericTotal: 4, unparsedLabels: [], unspecifiedCount: 0 },
        ],
      },
    ]);
  });
});

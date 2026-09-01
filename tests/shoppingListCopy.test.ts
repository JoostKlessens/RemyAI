import { describe, expect, test } from 'vitest';
import type { ShoppingListItem, ShoppingListMeasure } from '@/domain/shopping/types';
import {
  describeMeasureQuantity,
  describeShoppingListAllChecked,
  describeShoppingListItemName,
  describeShoppingListItemQuantity,
  describeShoppingListMealCount,
  describeShoppingListNothingPlanned,
  describeShoppingListRowAccessibilityLabel,
} from '@/components/shoppingListCopy';

function measure(overrides: Partial<ShoppingListMeasure> = {}): ShoppingListMeasure {
  return {
    unit: { kind: 'none' },
    numericTotal: null,
    unparsedLabels: [],
    unspecifiedCount: 0,
    ...overrides,
  };
}

function item(name: string, measures: readonly ShoppingListMeasure[]): ShoppingListItem {
  return { name, measures };
}

describe('describeMeasureQuantity', () => {
  test('numeric only, known unit: renders "<n> <unit>"', () => {
    const text = describeMeasureQuantity(measure({ unit: { kind: 'known', canonical: 'g' }, numericTotal: 200 }));
    expect(text).toBe('200 g');
  });

  test('numeric only, unit "none": renders "<n>x" rather than inventing a unit word', () => {
    const text = describeMeasureQuantity(measure({ unit: { kind: 'none' }, numericTotal: 2 }));
    expect(text).toBe('2x');
  });

  test('numeric only, unrecognized unit: keeps the raw unit text verbatim', () => {
    const text = describeMeasureQuantity(measure({ unit: { kind: 'unrecognized', raw: 'cup' }, numericTotal: 2 }));
    expect(text).toBe('2 cup');
  });

  test('pluralizes a spelled-out unit above 1, keeps it singular at exactly 1', () => {
    const singular = describeMeasureQuantity(measure({ unit: { kind: 'known', canonical: 'teen' }, numericTotal: 1 }));
    const plural = describeMeasureQuantity(measure({ unit: { kind: 'known', canonical: 'teen' }, numericTotal: 3 }));
    expect(singular).toBe('1 teentje');
    expect(plural).toBe('3 teentjes');
  });

  test('does not pluralize an abbreviation unit ("g", "el") regardless of amount', () => {
    const text = describeMeasureQuantity(measure({ unit: { kind: 'known', canonical: 'el' }, numericTotal: 3 }));
    expect(text).toBe('3 el');
  });

  test('formats a Dutch decimal comma for a non-integer total', () => {
    const text = describeMeasureQuantity(measure({ unit: { kind: 'known', canonical: 'tl' }, numericTotal: 1.5 }));
    expect(text).toBe('1,5 tl');
  });

  test('rounds a repeating-fraction total to two decimals rather than reproducing floating-point noise', () => {
    const text = describeMeasureQuantity(measure({ unit: { kind: 'known', canonical: 'tl' }, numericTotal: 1 / 3 }));
    expect(text).toBe('0,33 tl');
  });

  test('unparsed only: the verbatim label IS the amount, never coerced to a number', () => {
    const text = describeMeasureQuantity(measure({ unparsedLabels: ['een scheut'] }));
    expect(text).toBe('een scheut');
  });

  test('multiple unparsed labels in one bucket join with "en", not a comma', () => {
    const text = describeMeasureQuantity(measure({ unparsedLabels: ['een scheut', 'naar smaak'] }));
    expect(text).toBe('een scheut en naar smaak');
  });

  test('numeric AND unparsed in the same bucket: both survive, joined with "+", never summed', () => {
    const text = describeMeasureQuantity(
      measure({ unit: { kind: 'known', canonical: 'el' }, numericTotal: 3, unparsedLabels: ['een scheut'] }),
    );
    expect(text).toBe('3 el + een scheut');
    // The number must never absorb the unparsed text into itself.
    expect(text).not.toContain('NaN');
  });

  test('neither numeric nor unparsed (unspecifiedCount only): an explicit, honest label, never a blank string', () => {
    const text = describeMeasureQuantity(measure({ unspecifiedCount: 2 }));
    expect(text).toBe('hoeveelheid niet genoemd');
    expect(text.length).toBeGreaterThan(0);
  });
});

describe('describeShoppingListItemQuantity', () => {
  test('a single-measure item renders that one measure', () => {
    const text = describeShoppingListItemQuantity(
      item('bloem', [measure({ unit: { kind: 'known', canonical: 'g' }, numericTotal: 300 })]),
    );
    expect(text).toBe('300 g');
  });

  test('a multi-measure item (incompatible units) shows both, comma-separated, never summed into one figure', () => {
    const text = describeShoppingListItemQuantity(
      item('tomaat', [
        measure({ unit: { kind: 'known', canonical: 'g' }, numericTotal: 200 }),
        measure({ unit: { kind: 'known', canonical: 'stuk' }, numericTotal: 2 }),
      ]),
    );
    expect(text).toBe('200 g, 2 stuks');
    // Nothing here ever fabricates a combined number like "202".
    expect(text).not.toMatch(/^\d+$/);
  });
});

describe('describeShoppingListItemName', () => {
  test('capitalizes only the first letter, not every word', () => {
    expect(describeShoppingListItemName('rode ui')).toBe('Rode ui');
  });

  test('leaves an empty name untouched rather than throwing', () => {
    expect(describeShoppingListItemName('')).toBe('');
  });
});

describe('describeShoppingListRowAccessibilityLabel', () => {
  test('combines the display name and the quantity phrase into one label', () => {
    const label = describeShoppingListRowAccessibilityLabel(
      item('tomaat', [measure({ unit: { kind: 'known', canonical: 'g' }, numericTotal: 200 })]),
    );
    expect(label).toBe('Tomaat, 200 g');
  });

  test('never restates checked/unchecked in the label text — that is the role/state contract, not the label', () => {
    const label = describeShoppingListRowAccessibilityLabel(
      item('tomaat', [measure({ unit: { kind: 'known', canonical: 'g' }, numericTotal: 200 })]),
    );
    expect(label.toLowerCase()).not.toContain('afgevinkt');
    expect(label.toLowerCase()).not.toContain('aangevinkt');
  });
});

describe('describeShoppingListMealCount', () => {
  test('singular phrasing for exactly one recipe', () => {
    expect(describeShoppingListMealCount(1)).toBe('Op basis van 1 recept dat deze week op het menu staat.');
  });

  test('plural phrasing for more than one recipe', () => {
    expect(describeShoppingListMealCount(3)).toBe('Op basis van 3 recepten die deze week op het menu staan.');
  });
});

describe('describeShoppingListNothingPlanned vs describeShoppingListAllChecked', () => {
  test('are two genuinely different states, not the same sentence twice', () => {
    const nothingPlanned = describeShoppingListNothingPlanned();
    const allChecked = describeShoppingListAllChecked(4);
    expect(nothingPlanned.title).not.toBe(allChecked.title);
    expect(nothingPlanned.body).not.toBe(allChecked.body);
  });

  test('nothing-planned copy never tells a household it finished shopping', () => {
    const copy = describeShoppingListNothingPlanned();
    const text = `${copy.title} ${copy.body}`.toLowerCase();
    expect(text).not.toContain('afgevinkt');
    expect(text).not.toContain('binnen');
  });

  test('all-checked copy never tells a household to go plan something', () => {
    const copy = describeShoppingListAllChecked(1);
    const text = `${copy.title} ${copy.body}`.toLowerCase();
    expect(text).not.toContain('plan');
    expect(text).not.toContain('deze week');
  });

  test('describeShoppingListAllChecked branches singular vs plural on item count', () => {
    const single = describeShoppingListAllChecked(1);
    const multiple = describeShoppingListAllChecked(5);
    expect(single.body).not.toBe(multiple.body);
    expect(multiple.body).toContain('5');
  });
});

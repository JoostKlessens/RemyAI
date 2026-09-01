import { describe, expect, test } from 'vitest';
import {
  normalizeIngredient,
  normalizeIngredientName,
  normalizeIngredientUnit,
  parseIngredientQuantity,
  UNIT_ALIASES,
} from '@/domain/shopping/normalizeIngredient';
import type { RawIngredientLine } from '@/domain/shopping/types';

function makeRawIngredient(overrides: Partial<RawIngredientLine> = {}): RawIngredientLine {
  return {
    name: 'ui',
    quantity: '2',
    unit: 'stuk',
    ...overrides,
  };
}

describe('normalizeIngredientName', () => {
  test('lowercases and trims the name', () => {
    expect(normalizeIngredientName('  Ui  ')).toBe('ui');
  });

  test('strips a preparation note after the first comma', () => {
    expect(normalizeIngredientName('ui, fijngesneden')).toBe('ui');
  });

  test('strips everything after the first comma even with a second comma present', () => {
    expect(normalizeIngredientName('ui, fijngesneden, apart gehouden')).toBe('ui');
  });

  test('collapses whitespace left behind by stripping the note', () => {
    expect(normalizeIngredientName('ui  , fijngesneden')).toBe('ui');
  });

  test('strips diacritics, matching normalizeTag conventions', () => {
    expect(normalizeIngredientName('crème fraîche')).toBe('creme fraiche');
  });

  test('returns an empty string for blank input', () => {
    expect(normalizeIngredientName('   ')).toBe('');
  });

  test('returns an empty string for a comma-only name', () => {
    expect(normalizeIngredientName(', fijngesneden')).toBe('');
  });
});

describe('normalizeIngredientUnit', () => {
  test('returns kind "none" for a null unit', () => {
    expect(normalizeIngredientUnit(null)).toEqual({ kind: 'none' });
  });

  test('maps "el" to the canonical "el"', () => {
    expect(normalizeIngredientUnit('el')).toEqual({ kind: 'known', canonical: 'el' });
  });

  test('maps every spelling of eetlepel to the same canonical unit', () => {
    expect(normalizeIngredientUnit('eetlepel')).toEqual({ kind: 'known', canonical: 'el' });
    expect(normalizeIngredientUnit('eetlepels')).toEqual({ kind: 'known', canonical: 'el' });
    expect(normalizeIngredientUnit('Eetlepels')).toEqual({ kind: 'known', canonical: 'el' });
  });

  test('maps theelepel spellings to "tl"', () => {
    expect(normalizeIngredientUnit('tl')).toEqual({ kind: 'known', canonical: 'tl' });
    expect(normalizeIngredientUnit('theelepel')).toEqual({ kind: 'known', canonical: 'tl' });
  });

  test('maps gram spellings to "g", distinct from kilogram spellings mapping to "kg"', () => {
    expect(normalizeIngredientUnit('gram')).toEqual({ kind: 'known', canonical: 'g' });
    expect(normalizeIngredientUnit('kg')).toEqual({ kind: 'known', canonical: 'kg' });
    expect(normalizeIngredientUnit('kilogram')).toEqual({ kind: 'known', canonical: 'kg' });
  });

  test('maps ml and liter spellings to distinct canonical units', () => {
    expect(normalizeIngredientUnit('ml')).toEqual({ kind: 'known', canonical: 'ml' });
    expect(normalizeIngredientUnit('l')).toEqual({ kind: 'known', canonical: 'l' });
    expect(normalizeIngredientUnit('liter')).toEqual({ kind: 'known', canonical: 'l' });
  });

  test('maps snufje, teen/tenen, blikje/blik, stuk/stuks, bosje, and scheut', () => {
    expect(normalizeIngredientUnit('snufje')).toEqual({ kind: 'known', canonical: 'snufje' });
    expect(normalizeIngredientUnit('teen')).toEqual({ kind: 'known', canonical: 'teen' });
    expect(normalizeIngredientUnit('tenen')).toEqual({ kind: 'known', canonical: 'teen' });
    expect(normalizeIngredientUnit('blikje')).toEqual({ kind: 'known', canonical: 'blikje' });
    expect(normalizeIngredientUnit('blik')).toEqual({ kind: 'known', canonical: 'blikje' });
    expect(normalizeIngredientUnit('stuk')).toEqual({ kind: 'known', canonical: 'stuk' });
    expect(normalizeIngredientUnit('stuks')).toEqual({ kind: 'known', canonical: 'stuk' });
    expect(normalizeIngredientUnit('bosje')).toEqual({ kind: 'known', canonical: 'bosje' });
    expect(normalizeIngredientUnit('scheut')).toEqual({ kind: 'known', canonical: 'scheut' });
  });

  test('strips a trailing period before lookup ("el." -> "el")', () => {
    expect(normalizeIngredientUnit('el.')).toEqual({ kind: 'known', canonical: 'el' });
  });

  test('keeps an unrecognized unit as its verbatim (normalized) text rather than dropping it', () => {
    expect(normalizeIngredientUnit('cup')).toEqual({ kind: 'unrecognized', raw: 'cup' });
  });

  test('treats an empty-string unit the same as null', () => {
    expect(normalizeIngredientUnit('  ')).toEqual({ kind: 'none' });
  });

  test('UNIT_ALIASES only maps to values from the canonical unit set', () => {
    const canonicalUnits = new Set(Object.values(UNIT_ALIASES));
    // Every value that appears must be one of the twelve documented codes —
    // this guards against a typo silently introducing a 13th "canonical" unit.
    const knownUnits = new Set([
      'el',
      'tl',
      'g',
      'kg',
      'ml',
      'l',
      'snufje',
      'teen',
      'blikje',
      'stuk',
      'bosje',
      'scheut',
    ]);
    for (const unit of canonicalUnits) {
      expect(knownUnits.has(unit)).toBe(true);
    }
  });
});

describe('parseIngredientQuantity', () => {
  test('returns kind "unspecified" for a null quantity', () => {
    expect(parseIngredientQuantity(null)).toEqual({ kind: 'unspecified' });
  });

  test('parses a plain integer', () => {
    expect(parseIngredientQuantity('2')).toEqual({ kind: 'numeric', value: 2 });
  });

  test('parses a plain decimal', () => {
    expect(parseIngredientQuantity('2.5')).toEqual({ kind: 'numeric', value: 2.5 });
  });

  test('parses a Dutch decimal comma', () => {
    expect(parseIngredientQuantity('1,5')).toEqual({ kind: 'numeric', value: 1.5 });
  });

  test('parses an ASCII fraction', () => {
    expect(parseIngredientQuantity('1/2')).toEqual({ kind: 'numeric', value: 0.5 });
  });

  test('parses a mixed ASCII fraction ("1 1/2")', () => {
    expect(parseIngredientQuantity('1 1/2')).toEqual({ kind: 'numeric', value: 1.5 });
  });

  test('parses a mixed ASCII fraction written with a hyphen ("1-1/2")', () => {
    expect(parseIngredientQuantity('1-1/2')).toEqual({ kind: 'numeric', value: 1.5 });
  });

  test('parses a Unicode vulgar fraction on its own ("½")', () => {
    expect(parseIngredientQuantity('½')).toEqual({ kind: 'numeric', value: 0.5 });
  });

  test('parses a Unicode vulgar fraction combined with a whole number ("1½")', () => {
    expect(parseIngredientQuantity('1½')).toEqual({ kind: 'numeric', value: 1.5 });
  });

  test('parses a whole number and a Unicode vulgar fraction separated by a space ("1 ½")', () => {
    expect(parseIngredientQuantity('1 ½')).toEqual({ kind: 'numeric', value: 1.5 });
  });

  test('keeps a non-numeric quantity as an unparsed label rather than inventing a number', () => {
    expect(parseIngredientQuantity('een scheut')).toEqual({ kind: 'unparsed', label: 'een scheut' });
  });

  test('keeps "naar smaak" as an unparsed label', () => {
    expect(parseIngredientQuantity('naar smaak')).toEqual({ kind: 'unparsed', label: 'naar smaak' });
  });

  test('trims an unparsed label but otherwise preserves it verbatim', () => {
    expect(parseIngredientQuantity('  een scheut  ')).toEqual({ kind: 'unparsed', label: 'een scheut' });
  });

  test('never coerces a non-numeric quantity to 1', () => {
    const result = parseIngredientQuantity('een scheut');
    expect(result.kind).not.toBe('numeric');
  });

  test('treats a zero-denominator fraction as unparsed rather than Infinity', () => {
    expect(parseIngredientQuantity('1/0')).toEqual({ kind: 'unparsed', label: '1/0' });
  });

  test('treats an empty-string quantity the same as null (unspecified)', () => {
    expect(parseIngredientQuantity('')).toEqual({ kind: 'unspecified' });
    expect(parseIngredientQuantity('   ')).toEqual({ kind: 'unspecified' });
  });
});

describe('normalizeIngredient', () => {
  test('normalizes name, unit, and quantity together', () => {
    const result = normalizeIngredient(makeRawIngredient({ name: 'Ui, fijngesneden', quantity: '2', unit: 'stuk' }));

    expect(result).toEqual({
      name: 'ui',
      unit: { kind: 'known', canonical: 'stuk' },
      quantity: { kind: 'numeric', value: 2 },
    });
  });

  test('handles a fully unparsed line ("een scheut olijfolie") without inventing a number', () => {
    const result = normalizeIngredient(makeRawIngredient({ name: 'olijfolie', quantity: 'een scheut', unit: null }));

    expect(result).toEqual({
      name: 'olijfolie',
      unit: { kind: 'none' },
      quantity: { kind: 'unparsed', label: 'een scheut' },
    });
  });

  test('handles a line with no quantity and no unit at all', () => {
    const result = normalizeIngredient(makeRawIngredient({ name: 'zout', quantity: null, unit: null }));

    expect(result).toEqual({
      name: 'zout',
      unit: { kind: 'none' },
      quantity: { kind: 'unspecified' },
    });
  });

  test('returns null for a blank ingredient name', () => {
    expect(normalizeIngredient(makeRawIngredient({ name: '   ' }))).toBeNull();
  });

  test('returns null for a comma-only ingredient name', () => {
    expect(normalizeIngredient(makeRawIngredient({ name: ', fijngesneden' }))).toBeNull();
  });

  test('does not mutate the input object', () => {
    const input = makeRawIngredient({ name: 'Ui, fijngesneden' });
    const snapshot = { ...input };

    normalizeIngredient(input);

    expect(input).toEqual(snapshot);
  });
});

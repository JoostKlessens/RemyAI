import { describe, expect, test } from 'vitest';
import { ICON_NAMES, isIconAvailable, resolveInstalledGlyph, type IconName } from '@/components/iconFont';

/**
 * The names iconFont.ts documents as drawable by the CURRENTLY installed
 * font (Feather), listed here independently rather than derived from the
 * module — a test that reads the same table it is checking asserts nothing.
 * Each was verified against
 * node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json,
 * which holds 287 glyphs.
 */
const EXPECTED_AVAILABLE: readonly IconName[] = [
  'calendar',
  'check',
  'chevron-right',
  'clipboard',
  'clock',
  'close',
  'external-link',
  'filter',
  'friends',
  'plus',
  'recipes',
  'send',
  'settings',
  'shuffle',
  'warning',
];

/** WS4's own inventory: "The sixteen glyphs are Remy's, not a library sampler". */
const WS4_UI_GLYPHS: readonly IconName[] = [
  'calendar',
  'check',
  'chevron-right',
  'clipboard',
  'clock',
  'close',
  'external-link',
  'filter',
  'friends',
  'plus',
  'recipes',
  'send',
  'settings',
  'shuffle',
  'timer',
  'warning',
];

describe('ICON_NAMES', () => {
  test('has no duplicate entry', () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  test("carries all sixteen of WS4's UI glyphs", () => {
    for (const name of WS4_UI_GLYPHS) {
      expect(ICON_NAMES).toContain(name);
    }
  });
});

describe('isIconAvailable', () => {
  test('is true for exactly the names the installed Feather font can draw', () => {
    const available = ICON_NAMES.filter((name) => isIconAvailable(name));
    expect([...available].sort()).toEqual([...EXPECTED_AVAILABLE].sort());
  });

  test('is false for every kitchen glyph — Feather has none of them, and the seam must say so', () => {
    for (const name of ['cooking-pot', 'bowl-steam', 'pasta', 'rice-bowl', 'potato', 'noodles', 'bread'] as const) {
      expect(isIconAvailable(name)).toBe(false);
    }
  });

  test('is false for `timer`, which Feather cannot draw and must not fake with `watch` or `clock`', () => {
    expect(isIconAvailable('timer')).toBe(false);
    // The glyph it would be tempting to substitute IS available, which is
    // exactly why the absence has to be deliberate rather than accidental.
    expect(isIconAvailable('clock')).toBe(true);
  });
});

describe('resolveInstalledGlyph', () => {
  test('agrees with isIconAvailable for every single name', () => {
    for (const name of ICON_NAMES) {
      expect(resolveInstalledGlyph(name) !== null).toBe(isIconAvailable(name));
    }
  });

  test("translates Remy's vocabulary into the installed font's — the reason the seam exists", () => {
    expect(resolveInstalledGlyph('close')).toBe('x');
    expect(resolveInstalledGlyph('friends')).toBe('users');
    expect(resolveInstalledGlyph('recipes')).toBe('book-open');
    expect(resolveInstalledGlyph('warning')).toBe('alert-triangle');
  });

  test('passes a name through unchanged where the two vocabularies happen to agree', () => {
    expect(resolveInstalledGlyph('clock')).toBe('clock');
    expect(resolveInstalledGlyph('calendar')).toBe('calendar');
  });

  test('returns null — never a placeholder name — for a glyph the font lacks', () => {
    expect(resolveInstalledGlyph('cooking-pot')).toBeNull();
    expect(resolveInstalledGlyph('timer')).toBeNull();
  });

  test('never maps two Remy names onto one installed glyph, which would make two controls look identical', () => {
    const glyphs = ICON_NAMES.map((name) => resolveInstalledGlyph(name)).filter((glyph) => glyph !== null);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });
});

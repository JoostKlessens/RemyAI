/**
 * The 45 coloured drawings, and the invariants that keep them honest.
 *
 * WHAT THIS FILE CAN AND CANNOT SEE. It imports `drawings.ts` and
 * `palette.ts`, which are plain `.ts` data — vitest runs node with
 * react-native stubbed, so `IconArtwork.tsx` itself is out of reach, as is
 * anything about how a phone rasterises this. What is testable is the part
 * that used to be checked by a compiler against a glyph map and now is not:
 * that every name has a drawing, that every drawing names real colours, and
 * that nothing in the set is invisible.
 */
import { describe, expect, test } from 'vitest';

import { resolveFillKey } from '@/components/iconArtwork/controlState';
import { ICON_ARTWORK } from '@/components/iconArtwork/drawings';
import { iconPalette } from '@/components/iconArtwork/palette';
import { ICON_NAMES } from '@/components/iconFont';

/** The four neutrals palette.ts flips, and the only keys allowed to differ between schemes. */
const NEUTRALS = ['INK', 'INK_SOFT', 'CREAM', 'WHITE', 'FAT'];

describe('every name is drawn', () => {
  test('all 45 ICON_NAMES have artwork — this is what makes Icon.tsx\u2019s font fallback unreachable', () => {
    const missing = ICON_NAMES.filter((name) => ICON_ARTWORK[name] === undefined);
    expect(missing).toEqual([]);
  });

  test('no drawing is an orphan — a name removed from the vocabulary must not leave art behind', () => {
    const orphans = Object.keys(ICON_ARTWORK).filter(
      (name) => !(ICON_NAMES as readonly string[]).includes(name),
    );
    expect(orphans).toEqual([]);
  });

  test('the set is exactly 45, so a silently dropped drawing fails here rather than on a phone', () => {
    expect(Object.keys(ICON_ARTWORK)).toHaveLength(45);
  });
});

describe('every drawing names real colours', () => {
  const light = iconPalette('light');

  test('no element references a key the palette does not define', () => {
    const unknown: string[] = [];
    for (const [name, elements] of Object.entries(ICON_ARTWORK)) {
      for (const element of elements) {
        for (const key of [element.fill, element.stroke]) {
          if (key !== undefined && light[key] === undefined) {
            unknown.push(`${name}: ${key}`);
          }
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  test('every element is visible — a shape with neither fill nor stroke draws nothing', () => {
    const invisible: string[] = [];
    for (const [name, elements] of Object.entries(ICON_ARTWORK)) {
      elements.forEach((element, index) => {
        if (element.fill === undefined && element.stroke === undefined) {
          invisible.push(`${name}[${index}]`);
        }
      });
    }
    expect(invisible).toEqual([]);
  });

  test('every stroked element carries a width — a stroke without one renders hairline or not at all', () => {
    const widthless: string[] = [];
    for (const [name, elements] of Object.entries(ICON_ARTWORK)) {
      elements.forEach((element, index) => {
        if (element.stroke !== undefined && element.sw === undefined) {
          widthless.push(`${name}[${index}]`);
        }
      });
    }
    expect(widthless).toEqual([]);
  });
});

describe('the dark scheme is the documented rule and not a second set of choices', () => {
  const light = iconPalette('light');
  const dark = iconPalette('dark');

  test('both schemes define exactly the same keys', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  test('every hue is byte-identical between schemes — only the neutrals may move', () => {
    const keys = Object.keys(light) as (keyof typeof light)[];
    const moved: string[] = keys.filter((key) => light[key] !== dark[key]);
    expect(moved.sort()).toEqual([...NEUTRALS].sort());
  });

  test('the ink actually inverts — a dark outline on a dark page is the failure this rule exists to prevent', () => {
    // Crude but sufficient: the light ink must be dark and the dark ink light.
    // A precise contrast assertion belongs in contrast.test.ts against real
    // surface tokens; this one only catches the table being filled in the
    // wrong order, which is the mistake a regenerate can actually make.
    expect(luminance(light.INK)).toBeLessThan(0.2);
    expect(luminance(dark.INK)).toBeGreaterThan(0.7);
  });
});

/** Relative luminance, sRGB, enough to tell "dark" from "light". */
function luminance(hex: string): number {
  const channel = (start: number): number => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/**
 * GAP-58 — a control that is off must look off.
 *
 * The defect this guards was invisible to every gate the repo has: `Icon`
 * discards `color` for a name with artwork, so `FilterTrigger`'s
 * `isFiltering ? accent : textMuted` never arrived and the funnel rendered
 * the same either way. Nothing type-checks a prop that is accepted and
 * dropped, and no test could see it because the drop happens in a `.tsx`
 * this run cannot import.
 *
 * So the rule was put in a plain `.ts` — controlState.ts — precisely so
 * these rows can exist. What they pin is the SUBSTITUTION, not the render.
 */
describe('a UI glyph can say its control is off', () => {
  test('an inactive control empties its accent fill, so the funnel reads as off', () => {
    expect(resolveFillKey('GREEN_SOFT', false)).toBe('WHITE');
    expect(resolveFillKey('GREEN', false)).toBe('WHITE');
  });

  test('an active control is drawn exactly as designed', () => {
    expect(resolveFillKey('GREEN_SOFT', true)).toBe('GREEN_SOFT');
    expect(resolveFillKey('GREEN', true)).toBe('GREEN');
  });

  test('a glyph with no active state is untouched — undefined is not false', () => {
    // The 44 drawings that are not `filter` pass `undefined`, and this is the
    // row that proves the rule cannot reach them by accident.
    expect(resolveFillKey('GREEN_SOFT', undefined)).toBe('GREEN_SOFT');
    expect(resolveFillKey('ORANGE', undefined)).toBe('ORANGE');
  });

  test('only the two green control keys move — a carrot stays orange even when off', () => {
    // The whole reason this is a substitution table and not a tint: an
    // inactive control must not be able to recolour food.
    const untouched = ['ORANGE', 'AMBER', 'TEAL', 'MEAT', 'BERRY', 'BROWN', 'RED', 'INK'] as const;
    for (const key of untouched) {
      expect(resolveFillKey(key, false)).toBe(key);
    }
  });

  test('an absent fill stays absent — `none` must not become a white blob', () => {
    expect(resolveFillKey(undefined, false)).toBeUndefined();
    expect(resolveFillKey(undefined, undefined)).toBeUndefined();
  });

  test('the funnel is still a single filled path, so the rule above has something to act on', () => {
    // If a regenerate ever splits `filter` into outline plus body, or renames
    // its fill, the substitution silently stops mattering and the state stops
    // being drawn again. This row fails on that day instead.
    const filter = ICON_ARTWORK['filter'];
    expect(filter).toHaveLength(1);
    expect(filter?.[0]?.fill).toBe('GREEN_SOFT');
    expect(filter?.[0]?.stroke).toBe('INK');
  });
});

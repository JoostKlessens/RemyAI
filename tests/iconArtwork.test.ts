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

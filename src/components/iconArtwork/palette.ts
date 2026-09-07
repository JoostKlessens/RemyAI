/**
 * The twenty-two colours the 45 drawings are made of, and the one rule that
 * gives them a dark scheme.
 *
 * GENERATED from design/icons-v2/*.svg by tools/build_icons.py's companion
 * emitter; the SVGs are the source and this file is the app's copy of them.
 * Regenerate rather than hand-edit — a drawing corrected here and not there
 * is exactly the drift the .svg files exist to prevent.
 *
 * WHY KEYS AND NOT HEXES IN THE DRAWINGS. Every element names a colour by
 * ROLE (`INK`, `AMBER_SOFT`) instead of by value, which is what makes a second
 * scheme cost a table rather than a second set of 45 drawings. It is also the
 * only reason `Icon`'s theme contract survives at all — see IconArtwork.tsx.
 *
 * THE DARK SCHEME IS A RULE, NOT TWENTY-TWO NEW DECISIONS: the four NEUTRALS
 * flip and the fifteen HUES stay. `INK` and `INK_SOFT` are the outline, which
 * has to be light on a dark ground or the drawing disappears; `CREAM`, `WHITE`
 * and `FAT` are the PAPER inside an object — rice, dough, a bowl's interior,
 * a bone — and paper follows the page. Everything else is the object's own
 * colour: a carrot is orange at midnight too, and a pale mint fill inside a
 * light outline reads as a bright object rather than as a hole.
 *
 * ⚠ THE DARK VALUES ARE DERIVED, NOT EYEBALLED. They are taken straight from
 * the dark scheme's own surface and text tokens so the drawings sit in the
 * same range as everything around them. No device has rendered them, and the
 * five neutrals are where to look first if the set feels wrong at night.
 */
export type IconPaletteKey =
  | 'AMBER'
  | 'AMBER_SOFT'
  | 'BERRY'
  | 'BERRY_SOFT'
  | 'BROWN'
  | 'BROWN_SOFT'
  | 'CREAM'
  | 'FAT'
  | 'GREEN'
  | 'GREEN_DEEP'
  | 'GREEN_SOFT'
  | 'INK'
  | 'INK_SOFT'
  | 'MEAT'
  | 'MEAT_SOFT'
  | 'ORANGE'
  | 'ORANGE_SOFT'
  | 'RED'
  | 'RED_SOFT'
  | 'TEAL'
  | 'TEAL_SOFT'
  | 'WHITE';

/** The set as drawn: light scheme, straight from the .svg sources. */
const LIGHT: Readonly<Record<IconPaletteKey, string>> = {
  AMBER: '#E4AC44',
  AMBER_SOFT: '#F7E2B4',
  BERRY: '#8D4C85',
  BERRY_SOFT: '#E0C3DB',
  BROWN: '#8C6446',
  BROWN_SOFT: '#D9BCA1',
  CREAM: '#F8F2E4',
  FAT: '#F3E3D2',
  GREEN: '#2E7A4E',
  GREEN_DEEP: '#1C5637',
  GREEN_SOFT: '#BCDFC6',
  INK: '#26332C',
  INK_SOFT: '#7A887F',
  MEAT: '#B45A3E',
  MEAT_SOFT: '#DE9A72',
  ORANGE: '#E07C3A',
  ORANGE_SOFT: '#F6C9A2',
  RED: '#CB4A3D',
  RED_SOFT: '#EFAA9E',
  TEAL: '#3E8AA6',
  TEAL_SOFT: '#C2DEE9',
  WHITE: '#FFFFFF',
};

/** The four neutrals flipped; every hue is byte-identical to LIGHT above. */
const DARK: Readonly<Record<IconPaletteKey, string>> = {
  AMBER: '#E4AC44',
  AMBER_SOFT: '#F7E2B4',
  BERRY: '#8D4C85',
  BERRY_SOFT: '#E0C3DB',
  BROWN: '#8C6446',
  BROWN_SOFT: '#D9BCA1',
  CREAM: '#273028',  // flipped
  FAT: '#4D584E',  // flipped
  GREEN: '#2E7A4E',
  GREEN_DEEP: '#1C5637',
  GREEN_SOFT: '#BCDFC6',
  INK: '#ECF2ED',  // flipped
  INK_SOFT: '#A1ABA3',  // flipped
  MEAT: '#B45A3E',
  MEAT_SOFT: '#DE9A72',
  ORANGE: '#E07C3A',
  ORANGE_SOFT: '#F6C9A2',
  RED: '#CB4A3D',
  RED_SOFT: '#EFAA9E',
  TEAL: '#3E8AA6',
  TEAL_SOFT: '#C2DEE9',
  WHITE: '#353F36',  // flipped
};

/** The palette for a scheme. `scheme` is the same value `getColors` takes, so a caller never has to know these two tables exist. */
export function iconPalette(scheme: 'light' | 'dark'): Readonly<Record<IconPaletteKey, string>> {
  return scheme === 'dark' ? DARK : LIGHT;
}

/**
 * The 45 drawings, as data. GENERATED from design/icons-v2/*.svg — regenerate,
 * do not hand-edit.
 *
 * A 24x24 view box throughout, matching remyGlyphs.ts and the two icon fonts
 * this replaced, so `Icon`'s `size` keeps meaning exactly what it meant.
 *
 * WHY DATA AND NOT 45 .tsx COMPONENTS, or an svg-transformer import: the same
 * argument remyGlyphs.ts made against generating a .ttf. This is text in the
 * source — greppable, diffable, and correctable by hand in an emergency —
 * with no build step and no new dependency. `react-native-svg-transformer`
 * would have been fewer lines here and a metro config plus a dev dependency
 * everywhere else.
 *
 * COLOURS ARE ROLE KEYS, never hexes: see palette.ts for why, and for the one
 * rule that turns this single set of geometry into two schemes.
 *
 * `stroke-linecap` and `stroke-linejoin` are absent on purpose. All 185 strokes
 * in the source set them to `round` and nothing sets anything else, so they are
 * renderer defaults in IconArtwork.tsx rather than 185 repetitions here. If a
 * drawing ever needs a butt cap, that is the moment to add the field — not
 * before.
 */
import type { IconPaletteKey } from './palette';

/** Shared paint. `sw` is stroke width in view-box units; `rot` is [degrees, cx, cy]. */
interface IconPaint {
  readonly fill?: IconPaletteKey;
  readonly stroke?: IconPaletteKey;
  readonly sw?: number;
  readonly rot?: readonly [number, number, number];
}

export type IconArtworkElement = IconPaint &
  (
    | { readonly k: 'path'; readonly d: string }
    | { readonly k: 'polyline'; readonly p: string }
    | { readonly k: 'polygon'; readonly p: string }
    | { readonly k: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
    | { readonly k: 'ellipse'; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number }
    | {
        readonly k: 'rect';
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
        readonly rx?: number;
      }
  );

/** Drawn back-to-front, exactly as the .svg lists them. */
export const ICON_ARTWORK: Readonly<Record<string, readonly IconArtworkElement[]>> = {
  'beef': [
    { k: 'path', d: 'M3.6 11.4 C3.2 7.6 6.8 5.0 11.2 4.9 C16.4 4.8 20.8 7.6 21.0 12.0 C21.2 16.4 17.0 19.7 12.2 19.5 C7.4 19.3 4.0 15.4 3.6 11.4 Z', fill: 'MEAT', stroke: 'INK', sw: 1.45 },
    { k: 'polyline', p: '15.2,8.8 17.8,10.4', stroke: 'MEAT_SOFT', sw: 1.3 },
    { k: 'polyline', p: '14.8,12.6 17.8,13.6', stroke: 'MEAT_SOFT', sw: 1.3 },
    { k: 'polyline', p: '12.8,6.8 11.2,15.4', stroke: 'INK', sw: 4.8 },
    { k: 'polyline', p: '7.8,14.4 15,16.2', stroke: 'INK', sw: 4.2 },
    { k: 'polyline', p: '12.8,6.8 11.2,15.4', stroke: 'FAT', sw: 3.4 },
    { k: 'polyline', p: '7.8,14.4 15,16.2', stroke: 'FAT', sw: 2.9 },
  ],
  'bowl-steam': [
    { k: 'path', d: 'M8.6 2.6 C7.4 3.9 9.8 5.0 8.6 6.3', stroke: 'INK_SOFT', sw: 1.5 },
    { k: 'path', d: 'M12 2.0 C10.8 3.3 13.2 4.4 12 5.7', stroke: 'INK_SOFT', sw: 1.5 },
    { k: 'path', d: 'M15.4 2.6 C14.2 3.9 16.6 5.0 15.4 6.3', stroke: 'INK_SOFT', sw: 1.5 },
    { k: 'path', d: 'M2.6 10.4 H21.4 C21.4 15.8 17.2 20.0 12 20.0 C6.8 20.0 2.6 15.8 2.6 10.4 Z', fill: 'WHITE', stroke: 'INK', sw: 1.45 },
    { k: 'path', d: 'M4.4 12.0 H19.6 C19.0 15.6 15.8 18.4 12 18.4 C8.2 18.4 5.0 15.6 4.4 12.0 Z', fill: 'AMBER_SOFT' },
    { k: 'circle', cx: 10.2, cy: 14.4, r: 1, fill: 'ORANGE' },
    { k: 'circle', cx: 13.8, cy: 15.4, r: 0.9, fill: 'GREEN' },
  ],
  'bread': [
    { k: 'path', d: 'M3.2 13.6 C3.2 9.5 7.2 6.4 12 6.4 C16.8 6.4 20.8 9.5 20.8 13.6 V16.4 C20.8 18.0 19.5 19.2 18.0 19.2 H6.0 C4.5 19.2 3.2 18.0 3.2 16.4 Z', fill: 'AMBER', stroke: 'INK', sw: 1.45 },
    { k: 'path', d: 'M3.2 15.9 H20.8 V16.4 C20.8 18.0 19.5 19.2 18.0 19.2 H6.0 C4.5 19.2 3.2 18.0 3.2 16.4 Z', fill: 'CREAM', stroke: 'INK', sw: 1.2 },
    { k: 'polyline', p: '7.2,12.6 9.2,10', stroke: 'INK', sw: 1.3 },
    { k: 'polyline', p: '10.9,13 12.9,10.4', stroke: 'INK', sw: 1.3 },
    { k: 'polyline', p: '14.6,12.6 16.6,10', stroke: 'INK', sw: 1.3 },
  ],
  'calendar': [
    { k: 'polyline', p: '8,2.4 8,6.4', stroke: 'INK', sw: 1.9 },
    { k: 'polyline', p: '16,2.4 16,6.4', stroke: 'INK', sw: 1.9 },
    { k: 'rect', rx: 2.6, x: 3, y: 4.6, width: 18, height: 16.8, fill: 'WHITE', stroke: 'INK', sw: 1.9 },
    { k: 'path', d: 'M3 7.2 C3 5.76 4.16 4.6 5.6 4.6 H18.4 C19.84 4.6 21 5.76 21 7.2 V9.8 H3 Z', fill: 'GREEN_SOFT' },
    { k: 'polyline', p: '3,9.8 21,9.8', stroke: 'INK', sw: 1.5 },
    { k: 'rect', rx: 2.6, x: 3, y: 4.6, width: 18, height: 16.8, stroke: 'INK', sw: 1.9 },
    { k: 'rect', rx: 1.1, x: 10.4, y: 12.6, width: 4.6, height: 4.6, fill: 'GREEN' },
  ],
  'casserole-dish': [
    { k: 'rect', rx: 1.4, x: 4.2, y: 5.6, width: 15.6, height: 3.6, fill: 'ORANGE', stroke: 'INK', sw: 1.2 },
    { k: 'circle', cx: 8, cy: 7, r: 1.1, fill: 'CREAM' },
    { k: 'circle', cx: 12, cy: 6.6, r: 1, fill: 'CREAM' },
    { k: 'circle', cx: 16, cy: 7.1, r: 1.1, fill: 'CREAM' },
    { k: 'rect', rx: 0.9, x: 0.9, y: 8.3, width: 2.2, height: 1.8, fill: 'CREAM', stroke: 'INK', sw: 1.2 },
    { k: 'rect', rx: 0.9, x: 20.9, y: 8.3, width: 2.2, height: 1.8, fill: 'CREAM', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M3.2 10.0 H20.8 V16.6 C20.8 18.0 19.7 19.1 18.3 19.1 H5.7 C4.3 19.1 3.2 18.0 3.2 16.6 Z', fill: 'CREAM', stroke: 'INK', sw: 1.45 },
    { k: 'rect', rx: 1.1, x: 2.2, y: 7.6, width: 19.6, height: 2.8, fill: 'CREAM', stroke: 'INK', sw: 1.45 },
  ],
  'check': [
    { k: 'polyline', p: '4.8,12.6 9.6,17.6 19.2,7', stroke: 'GREEN', sw: 2.5 },
  ],
  'cheese': [
    { k: 'path', d: 'M4.0 17.8 H19.6 C20.6 17.8 21.2 17.0 21.2 16.2 V7.4 C21.2 6.4 20.2 6.0 19.4 6.6 L3.4 16.0 C2.4 16.6 2.8 17.8 4.0 17.8 Z', fill: 'AMBER', stroke: 'INK', sw: 1.45 },
    { k: 'circle', cx: 15.6, cy: 11.4, r: 1.5, fill: 'CREAM', stroke: 'INK', sw: 1 },
    { k: 'circle', cx: 11, cy: 14.4, r: 1.2, fill: 'CREAM', stroke: 'INK', sw: 1 },
    { k: 'circle', cx: 17.8, cy: 14.6, r: 1, fill: 'CREAM', stroke: 'INK', sw: 1 },
  ],
  'chevron-right': [
    { k: 'polyline', p: '9.2,5.4 15.8,12 9.2,18.6', stroke: 'INK', sw: 2.2 },
  ],
  'chicken': [
    { k: 'polyline', p: '12.4,13.4 18.2,7.4', stroke: 'INK', sw: 5 },
    { k: 'polyline', p: '12.4,13.4 18.2,7.4', stroke: 'FAT', sw: 3.6 },
    { k: 'circle', cx: 17, cy: 6.2, r: 2.4, fill: 'FAT', stroke: 'INK', sw: 1.2 },
    { k: 'circle', cx: 19.4, cy: 8.4, r: 2.2, fill: 'FAT', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M4.2 16.2 C2.6 12.6 5.0 8.4 9.0 7.8 C12.6 7.3 15.4 9.8 14.8 13.4 C14.2 17.0 10.6 19.6 7.4 18.9 C5.6 18.5 4.8 17.6 4.2 16.2 Z', fill: 'MEAT_SOFT', stroke: 'INK', sw: 1.45 },
  ],
  'clipboard': [
    { k: 'rect', rx: 2.4, x: 4, y: 4.6, width: 16, height: 16.8, fill: 'WHITE', stroke: 'INK', sw: 1.9 },
    { k: 'rect', rx: 1.6, x: 8.4, y: 2.2, width: 7.2, height: 4.2, fill: 'GREEN_SOFT', stroke: 'INK', sw: 1.6 },
    { k: 'polyline', p: '7.8,12 16.2,12', stroke: 'GREEN', sw: 1.6 },
    { k: 'polyline', p: '7.8,15.6 14,15.6', stroke: 'INK_SOFT', sw: 1.5 },
  ],
  'clock': [
    { k: 'circle', cx: 12, cy: 12, r: 8.6, fill: 'WHITE', stroke: 'INK', sw: 1.9 },
    { k: 'polyline', p: '12,12 12,7.2', stroke: 'INK', sw: 1.8 },
    { k: 'polyline', p: '12,12 15.8,13.6', stroke: 'INK', sw: 1.8 },
    { k: 'circle', cx: 12, cy: 12, r: 1.05, fill: 'GREEN' },
  ],
  'close': [
    { k: 'polyline', p: '6.6,6.6 17.4,17.4', stroke: 'INK', sw: 2.2 },
    { k: 'polyline', p: '17.4,6.6 6.6,17.4', stroke: 'INK', sw: 2.2 },
  ],
  'cooked': [
    { k: 'path', d: 'M5.2 12.8 C3.0 12.8 1.9 11.0 2.4 9.0 C2.9 6.8 5.0 5.8 6.8 6.6 C6.6 4.0 8.6 2.0 12 2.0 C15.4 2.0 17.4 4.0 17.2 6.6 C19.0 5.8 21.1 6.8 21.6 9.0 C22.1 11.0 21.0 12.8 18.8 12.8 Z', fill: 'WHITE', stroke: 'INK', sw: 1.45 },
    { k: 'rect', rx: 0.9, x: 7.4, y: 12.4, width: 9.2, height: 5.4, fill: 'GREEN', stroke: 'INK', sw: 1.45 },
  ],
  'cooking-pot': [
    { k: 'path', d: 'M4.2 12.2 C2.2 12.2 2.2 15.6 4.2 15.6', stroke: 'INK', sw: 1.8 },
    { k: 'path', d: 'M19.8 12.2 C21.8 12.2 21.8 15.6 19.8 15.6', stroke: 'INK', sw: 1.8 },
    { k: 'path', d: 'M4.2 9.6 H19.8 V16.4 C19.8 19 17.8 20.9 15.4 20.9 H8.6 C6.2 20.9 4.2 19 4.2 16.4 Z', fill: 'GREEN', stroke: 'INK', sw: 1.45 },
    { k: 'circle', cx: 12, cy: 5.4, r: 1.6, fill: 'CREAM', stroke: 'INK', sw: 1.45 },
    { k: 'rect', rx: 1.4, x: 2.9, y: 6.9, width: 18.2, height: 2.8, fill: 'CREAM', stroke: 'INK', sw: 1.45 },
  ],
  'curry-bowl': [
    { k: 'path', d: 'M3.0 11.6 H21.0 C21.0 16.5 16.9 20.4 12 20.4 C7.1 20.4 3.0 16.5 3.0 11.6 Z', fill: 'ORANGE', stroke: 'INK', sw: 1.45 },
    { k: 'ellipse', cx: 12, cy: 11.6, rx: 9, ry: 2.1, fill: 'ORANGE', stroke: 'INK', sw: 1.45 },
    { k: 'path', d: 'M8.4 11.4 C9.4 10.2 12.0 10.0 13.4 11.0 C14.6 11.9 14.0 13.0 12.4 12.8', stroke: 'CREAM', sw: 1.5 },
    { k: 'path', d: 'M16.4 8.4 C17.97 9.61 17.97 11.59 16.4 12.8 C14.83 11.59 14.83 9.61 16.4 8.4 Z', fill: 'GREEN', stroke: 'INK', sw: 1, rot: [35, 16.4, 10.6] },
  ],
  'dairy': [
    { k: 'path', d: 'M4.4 9.8 H19.6 V19.6 C19.6 20.7 18.7 21.6 17.6 21.6 H6.4 C5.3 21.6 4.4 20.7 4.4 19.6 Z', fill: 'CREAM', stroke: 'INK', sw: 1.45 },
    { k: 'path', d: 'M4.4 9.8 L8.6 4.6 H15.4 L19.6 9.8 Z', fill: 'WHITE', stroke: 'INK', sw: 1.45 },
    { k: 'rect', rx: 0.7, x: 8.4, y: 2.4, width: 7.2, height: 2.4, fill: 'WHITE', stroke: 'INK', sw: 1.2 },
    { k: 'rect', rx: 1, x: 6.4, y: 12.4, width: 11.2, height: 6.4, fill: 'TEAL', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M12 13.2 C13.3 14.6 14.1 15.5 14.1 16.4 C14.1 17.6 13.2 18.4 12 18.4 C10.8 18.4 9.9 17.6 9.9 16.4 C9.9 15.5 10.7 14.6 12 13.2 Z', fill: 'WHITE' },
  ],
  'egg': [
    { k: 'path', d: 'M4.4 13.6 C3.2 10.0 5.8 6.4 9.4 6.2 C11.2 6.1 12.2 4.8 14.6 5.2 C18.4 5.8 21.0 8.8 20.4 12.2 C20.0 14.6 21.0 16.2 19.2 18.2 C17.2 20.6 13.2 20.9 10.2 19.7 C7.6 18.6 5.2 17.2 4.4 13.6 Z', fill: 'CREAM', stroke: 'INK', sw: 1.45 },
    { k: 'circle', cx: 12.6, cy: 12.4, r: 4, fill: 'AMBER', stroke: 'INK', sw: 1.2 },
    { k: 'circle', cx: 11.2, cy: 11, r: 1.1, fill: 'AMBER_SOFT' },
  ],
  'external-link': [
    { k: 'polyline', p: '19.4,13.2 19.4,18.8 5.2,18.8 5.2,4.6 10.8,4.6', stroke: 'INK', sw: 1.9 },
    { k: 'polyline', p: '11.4,12.6 19.4,4.6', stroke: 'GREEN', sw: 1.9 },
    { k: 'polyline', p: '14.2,4.6 19.4,4.6 19.4,9.8', stroke: 'GREEN', sw: 1.9 },
  ],
  'filter': [
    { k: 'path', d: 'M3.6 5 H20.4 L14.2 12.6 V19.4 L9.8 17.2 V12.6 Z', fill: 'GREEN_SOFT', stroke: 'INK', sw: 1.7 },
  ],
  'fish': [
    { k: 'path', d: 'M7.4 12 L2.6 7.6 L3.8 12 L2.6 16.4 Z', fill: 'TEAL', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M12.0 6.4 C13.2 4.0 15.6 3.4 16.8 4.8 C15.6 5.2 14.4 5.6 13.6 6.2 Z', fill: 'TEAL', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M6.4 12.0 C6.4 8.0 10.6 5.4 14.6 5.8 C18.6 6.2 21.4 9.0 21.4 12.0 C21.4 15.0 18.6 17.8 14.6 18.2 C10.6 18.6 6.4 16.0 6.4 12.0 Z', fill: 'TEAL', stroke: 'INK', sw: 1.45 },
    { k: 'ellipse', cx: 14.4, cy: 14.6, rx: 4, ry: 1.9, fill: 'TEAL_SOFT' },
    { k: 'path', d: 'M16.6 7.0 C15.4 9.4 15.4 14.4 16.6 16.8', stroke: 'INK', sw: 1.2 },
    { k: 'circle', cx: 18.2, cy: 10.4, r: 1.05, fill: 'INK' },
    { k: 'circle', cx: 18.5, cy: 10.1, r: 0.36, fill: 'WHITE' },
  ],
  'friends': [
    { k: 'circle', cx: 15.8, cy: 8.6, r: 3, fill: 'WHITE', stroke: 'INK', sw: 1.6 },
    { k: 'path', d: 'M10.4 20.2 C10.4 16.5 12.8 14 15.8 14 C18.8 14 21.2 16.5 21.2 20.2 Z', fill: 'WHITE', stroke: 'INK', sw: 1.6 },
    { k: 'circle', cx: 9, cy: 8.8, r: 3.4, fill: 'GREEN_SOFT', stroke: 'INK', sw: 1.7 },
    { k: 'path', d: 'M2.6 20.6 C2.6 16.4 5.4 13.8 9 13.8 C12.6 13.8 15.4 16.4 15.4 20.6 Z', fill: 'GREEN_SOFT', stroke: 'INK', sw: 1.7 },
  ],
  'fruit': [
    { k: 'path', d: 'M12 8.2 C12 6.2 12.4 4.6 13.4 3.4', stroke: 'BROWN', sw: 1.5 },
    { k: 'path', d: 'M15.4 2.2 C17.3 3.74 17.3 6.26 15.4 7.8 C13.5 6.26 13.5 3.74 15.4 2.2 Z', fill: 'GREEN', stroke: 'INK', sw: 1.2, rot: [125, 15.4, 5] },
    { k: 'path', d: 'M12 8.4 C10.6 6.6 7.6 6.2 5.6 7.8 C3.4 9.6 3.4 13.9 5.2 17.1 C6.4 19.3 8.2 20.9 9.8 20.5 C10.8 20.2 11.2 19.7 12 19.7 C12.8 19.7 13.2 20.2 14.2 20.5 C15.8 20.9 17.6 19.3 18.8 17.1 C20.6 13.9 20.6 9.6 18.4 7.8 C16.4 6.2 13.4 6.6 12 8.4 Z', fill: 'RED', stroke: 'INK', sw: 1.45 },
    { k: 'ellipse', cx: 8.4, cy: 11.2, rx: 1.8, ry: 1.1, fill: 'RED_SOFT', rot: [-30, 8.4, 11.2] },
  ],
  'grain': [
    { k: 'path', d: 'M12 21.4 C12 17.0 12 12.0 12 6.4', stroke: 'BROWN', sw: 1.6 },
    { k: 'path', d: 'M8 13.6 C9.68 15.25 9.68 17.95 8 19.6 C6.32 17.95 6.32 15.25 8 13.6 Z', fill: 'AMBER_SOFT', stroke: 'INK', sw: 1, rot: [-62, 8, 16.6] },
    { k: 'path', d: 'M16 14.6 C17.68 16.25 17.68 18.95 16 20.6 C14.32 18.95 14.32 16.25 16 14.6 Z', fill: 'AMBER_SOFT', stroke: 'INK', sw: 1, rot: [62, 16, 17.6] },
    { k: 'path', d: 'M9 8.3 C10.9 9.89 10.9 12.5 9 14.1 C7.1 12.5 7.1 9.89 9 8.3 Z', fill: 'AMBER', stroke: 'INK', sw: 1, rot: [-38, 9, 11.2] },
    { k: 'path', d: 'M15 8.3 C16.9 9.89 16.9 12.5 15 14.1 C13.1 12.5 13.1 9.89 15 8.3 Z', fill: 'AMBER', stroke: 'INK', sw: 1, rot: [38, 15, 11.2] },
    { k: 'path', d: 'M9.2 4.5 C11.1 6.1 11.1 8.71 9.2 10.3 C7.3 8.71 7.3 6.1 9.2 4.5 Z', fill: 'AMBER', stroke: 'INK', sw: 1, rot: [-38, 9.2, 7.4] },
    { k: 'path', d: 'M14.8 4.5 C16.7 6.1 16.7 8.71 14.8 10.3 C12.9 8.71 12.9 6.1 14.8 4.5 Z', fill: 'AMBER', stroke: 'INK', sw: 1, rot: [38, 14.8, 7.4] },
    { k: 'path', d: 'M12 1.7 C13.9 3.29 13.9 5.9 12 7.5 C10.1 5.9 10.1 3.29 12 1.7 Z', fill: 'AMBER', stroke: 'INK', sw: 1 },
  ],
  'herbs': [
    { k: 'path', d: 'M4.8 20.8 C6.8 15.8 10.4 10.4 15.6 6.2', stroke: 'GREEN', sw: 1.7 },
    { k: 'path', d: 'M5.4 12.6 C7.19 14.14 7.19 16.66 5.4 18.2 C3.61 16.66 3.61 14.14 5.4 12.6 Z', fill: 'GREEN', stroke: 'INK', sw: 1, rot: [-58, 5.4, 15.4] },
    { k: 'path', d: 'M9.8 14.2 C11.59 15.74 11.59 18.26 9.8 19.8 C8.01 18.26 8.01 15.74 9.8 14.2 Z', fill: 'GREEN_SOFT', stroke: 'INK', sw: 1, rot: [32, 9.8, 17] },
    { k: 'path', d: 'M9.4 8.6 C11.19 10.14 11.19 12.66 9.4 14.2 C7.61 12.66 7.61 10.14 9.4 8.6 Z', fill: 'GREEN', stroke: 'INK', sw: 1, rot: [-58, 9.4, 11.4] },
    { k: 'path', d: 'M14 10 C15.79 11.54 15.79 14.06 14 15.6 C12.21 14.06 12.21 11.54 14 10 Z', fill: 'GREEN_SOFT', stroke: 'INK', sw: 1, rot: [32, 14, 12.8] },
    { k: 'path', d: 'M16.4 3 C18.08 4.43 18.08 6.77 16.4 8.2 C14.72 6.77 14.72 4.43 16.4 3 Z', fill: 'GREEN', stroke: 'INK', sw: 1, rot: [-20, 16.4, 5.6] },
  ],
  'leaf': [
    { k: 'polyline', p: '2.4,21.6 5.4,18.6', stroke: 'INK', sw: 1.8 },
    { k: 'path', d: 'M4.4 19.6 C3.8 12.2 8.6 5.2 19.8 4.4 C20.6 15.2 13.4 20.6 4.4 19.6 Z', fill: 'GREEN', stroke: 'INK', sw: 1.45 },
    { k: 'path', d: 'M5.0 19.0 C9.0 15.2 14.0 10.6 18.4 6.6', stroke: 'CREAM', sw: 1.3 },
    { k: 'polyline', p: '8.8,13.8 8.2,10.4', stroke: 'CREAM', sw: 1 },
    { k: 'polyline', p: '12.8,10 12.4,6.8', stroke: 'CREAM', sw: 1 },
    { k: 'polyline', p: '10.6,16.2 13.4,15', stroke: 'CREAM', sw: 1 },
  ],
  'legumes': [
    { k: 'path', d: 'M2.6 12.0 C6.4 6.6 17.6 6.6 21.4 12.0 C17.6 17.4 6.4 17.4 2.6 12.0 Z', fill: 'GREEN', stroke: 'INK', sw: 1.45, rot: [-18, 12, 12] },
    { k: 'circle', cx: 7.9, cy: 12, r: 2, fill: 'GREEN_SOFT', stroke: 'INK', sw: 1, rot: [-18, 12, 12] },
    { k: 'circle', cx: 12, cy: 12, r: 2, fill: 'GREEN_SOFT', stroke: 'INK', sw: 1, rot: [-18, 12, 12] },
    { k: 'circle', cx: 16.1, cy: 12, r: 2, fill: 'GREEN_SOFT', stroke: 'INK', sw: 1, rot: [-18, 12, 12] },
    { k: 'polyline', p: '2.8,12 1.4,10.4', stroke: 'GREEN', sw: 1.5, rot: [-18, 12, 12] },
  ],
  'meat': [
    { k: 'polyline', p: '3.8,20.2 20.2,3.8', stroke: 'BROWN', sw: 1.7 },
    { k: 'rect', rx: 1.5, x: 5, y: 13.4, width: 5.6, height: 5.6, fill: 'MEAT', stroke: 'INK', sw: 1.45, rot: [-45, 7.8, 16.2] },
    { k: 'rect', rx: 1.5, x: 9.2, y: 9.2, width: 5.6, height: 5.6, fill: 'MEAT', stroke: 'INK', sw: 1.45, rot: [-45, 12, 12] },
    { k: 'rect', rx: 1.5, x: 13.4, y: 5, width: 5.6, height: 5.6, fill: 'MEAT', stroke: 'INK', sw: 1.45, rot: [-45, 16.2, 7.8] },
    { k: 'polyline', p: '6.4,16.4 7.6,17.6', stroke: 'FAT', sw: 1.3 },
    { k: 'polyline', p: '10.6,12.2 11.8,13.4', stroke: 'FAT', sw: 1.3 },
    { k: 'polyline', p: '14.8,8 16,9.2', stroke: 'FAT', sw: 1.3 },
  ],
  'noodles': [
    { k: 'path', d: 'M2.6 13.6 C4.8 10.8 9.0 10.8 11.2 13.4', stroke: 'AMBER_SOFT', sw: 2.3 },
    { k: 'path', d: 'M2.4 16.4 C4.8 13.2 9.2 13.0 11.6 15.8 C13.4 17.8 15.8 17.6 17.2 15.6', stroke: 'AMBER', sw: 2.3 },
    { k: 'path', d: 'M2.8 19.4 C5.0 16.6 9.0 16.4 11.4 18.6 C13.2 20.2 15.6 20.0 17.0 18.2', stroke: 'AMBER', sw: 2.3 },
    { k: 'polyline', p: '12.6,16.4 21.4,5.8', stroke: 'BROWN', sw: 1.8 },
    { k: 'polyline', p: '15.4,17.2 22.2,9', stroke: 'BROWN', sw: 1.8 },
    { k: 'path', d: 'M11.0 14.4 C13.0 11.8 15.2 9.8 17.4 8.2', stroke: 'AMBER', sw: 2.3 },
  ],
  'nuts': [
    { k: 'polyline', p: '12,6.4 12,3.2', stroke: 'BROWN', sw: 1.6 },
    { k: 'path', d: 'M4.8 13.6 C4.8 10.2 8.0 7.8 12 7.8 C16 7.8 19.2 10.2 19.2 13.6 C19.2 17.8 15.8 21.6 12 21.6 C8.2 21.6 4.8 17.8 4.8 13.6 Z', fill: 'BROWN_SOFT', stroke: 'INK', sw: 1.45 },
    { k: 'path', d: 'M4.2 11.8 C4.2 8.6 7.7 6.2 12 6.2 C16.3 6.2 19.8 8.6 19.8 11.8 C18.6 11.0 17.8 9.8 16.4 10.2 C15.0 10.6 14.6 9.4 12 9.4 C9.4 9.4 9.0 10.6 7.6 10.2 C6.2 9.8 5.4 11.0 4.2 11.8 Z', fill: 'BROWN', stroke: 'INK', sw: 1.45 },
    { k: 'ellipse', cx: 9, cy: 14.8, rx: 1.9, ry: 1.2, fill: 'CREAM', rot: [-30, 9, 14.8] },
  ],
  'pasta': [
    { k: 'path', d: 'M10.6 10.3 C8.0 8.5 5.4 7.3 3.2 7.5 C3.8 9.3 3.8 14.7 3.2 16.5 C5.4 16.7 8.0 15.5 10.6 13.7 Z', fill: 'AMBER_SOFT', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M13.4 10.3 C16.0 8.5 18.6 7.3 20.8 7.5 C20.2 9.3 20.2 14.7 20.8 16.5 C18.6 16.7 16.0 15.5 13.4 13.7 Z', fill: 'AMBER_SOFT', stroke: 'INK', sw: 1.2 },
    { k: 'rect', rx: 1, x: 10, y: 9.9, width: 4, height: 4.2, fill: 'AMBER', stroke: 'INK', sw: 1.2 },
    { k: 'polyline', p: '11.4,10.9 11.4,13.1', stroke: 'INK', sw: 0.9 },
    { k: 'polyline', p: '12.6,10.9 12.6,13.1', stroke: 'INK', sw: 0.9 },
  ],
  'plus': [
    { k: 'polyline', p: '12,5 12,19', stroke: 'GREEN', sw: 2.4 },
    { k: 'polyline', p: '5,12 19,12', stroke: 'GREEN', sw: 2.4 },
  ],
  'pork': [
    { k: 'path', d: 'M2.6 7.2 C5.8 4.4 9.0 9.4 12.2 6.6 C15.4 3.8 18.2 7.8 21.4 6.2 L21.4 10.4 C18.2 12.0 15.4 8.0 12.2 10.8 C9.0 13.6 5.8 8.6 2.6 11.4 Z', fill: 'MEAT', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M2.6 9.3 C5.8 6.5 9.0 11.5 12.2 8.7 C15.4 5.9 18.2 9.9 21.4 8.3', stroke: 'FAT', sw: 1.8 },
    { k: 'path', d: 'M2.6 14.4 C5.8 11.6 9.0 16.6 12.2 13.8 C15.4 11.0 18.2 15.0 21.4 13.4 L21.4 17.6 C18.2 19.2 15.4 15.2 12.2 18.0 C9.0 20.8 5.8 15.8 2.6 18.6 Z', fill: 'MEAT', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M2.6 16.5 C5.8 13.7 9.0 18.7 12.2 15.9 C15.4 13.1 18.2 17.1 21.4 15.5', stroke: 'FAT', sw: 1.8 },
  ],
  'potato': [
    { k: 'path', d: 'M4.0 13.2 C3.2 9.0 6.8 5.6 11.4 5.5 C16.4 5.4 20.6 8.2 20.8 12.4 C21.0 16.8 17.0 19.9 12.2 19.7 C7.8 19.5 4.8 17.2 4.0 13.2 Z', fill: 'BROWN_SOFT', stroke: 'INK', sw: 1.45 },
    { k: 'ellipse', cx: 8.6, cy: 8.8, rx: 2.2, ry: 1.2, fill: 'CREAM', rot: [-25, 8.6, 8.8] },
    { k: 'polyline', p: '8.8,11 9.8,11.7', stroke: 'BROWN', sw: 1.3 },
    { k: 'polyline', p: '14,9.2 15,9.9', stroke: 'BROWN', sw: 1.3 },
    { k: 'polyline', p: '11.4,14.8 12.4,15.5', stroke: 'BROWN', sw: 1.3 },
    { k: 'polyline', p: '16.4,13.6 17.2,14.3', stroke: 'BROWN', sw: 1.3 },
  ],
  'recipes': [
    { k: 'path', d: 'M12 6.6 C10 4.9 6.6 4.3 3.4 4.7 V18.7 C6.6 18.3 10 18.9 12 20.5 Z', fill: 'CREAM', stroke: 'INK', sw: 1.6 },
    { k: 'path', d: 'M12 6.6 C14 4.9 17.4 4.3 20.6 4.7 V18.7 C17.4 18.3 14 18.9 12 20.5 Z', fill: 'WHITE', stroke: 'INK', sw: 1.6 },
    { k: 'polyline', p: '5.4,9.6 10,9.6', stroke: 'GREEN', sw: 1.3 },
    { k: 'polyline', p: '5.4,12.6 9.2,12.6', stroke: 'INK_SOFT', sw: 1.3 },
    { k: 'polyline', p: '14,9.6 18.6,9.6', stroke: 'INK_SOFT', sw: 1.3 },
    { k: 'polyline', p: '14,12.6 17.8,12.6', stroke: 'INK_SOFT', sw: 1.3 },
  ],
  'rice-bowl': [
    { k: 'path', d: 'M6.4 12.4 C6.4 8.8 8.8 6.4 12 6.4 C15.2 6.4 17.6 8.8 17.6 12.4 Z', fill: 'WHITE', stroke: 'INK', sw: 1.45 },
    { k: 'ellipse', cx: 9.8, cy: 9.6, rx: 0.95, ry: 0.5, fill: 'INK_SOFT', rot: [-25, 9.8, 9.6] },
    { k: 'ellipse', cx: 12.2, cy: 8.6, rx: 0.95, ry: 0.5, fill: 'INK_SOFT', rot: [15, 12.2, 8.6] },
    { k: 'ellipse', cx: 14.4, cy: 10, rx: 0.95, ry: 0.5, fill: 'INK_SOFT', rot: [-15, 14.4, 10] },
    { k: 'ellipse', cx: 11.4, cy: 10.9, rx: 0.95, ry: 0.5, fill: 'INK_SOFT', rot: [30, 11.4, 10.9] },
    { k: 'rect', rx: 0.9, x: 9.4, y: 19.4, width: 5.2, height: 2.2, fill: 'CREAM', stroke: 'INK', sw: 1.45 },
    { k: 'path', d: 'M3.4 12.2 H20.6 C20.6 16.8 16.8 20.4 12 20.4 C7.2 20.4 3.4 16.8 3.4 12.2 Z', fill: 'CREAM', stroke: 'INK', sw: 1.45 },
  ],
  'salad-bowl': [
    { k: 'path', d: 'M7 6 C9.91 8.2 9.91 11.8 7 14 C4.09 11.8 4.09 8.2 7 6 Z', fill: 'GREEN', stroke: 'INK', sw: 1.2, rot: [-38, 7, 10] },
    { k: 'path', d: 'M12 4.2 C15.14 6.62 15.14 10.58 12 13 C8.86 10.58 8.86 6.62 12 4.2 Z', fill: 'GREEN_SOFT', stroke: 'INK', sw: 1.2, rot: [4, 12, 8.6] },
    { k: 'path', d: 'M17 6.2 C19.91 8.4 19.91 12 17 14.2 C14.09 12 14.09 8.4 17 6.2 Z', fill: 'GREEN', stroke: 'INK', sw: 1.2, rot: [38, 17, 10.2] },
    { k: 'path', d: 'M2.4 12.6 H21.6 C21.6 16.9 17.3 20.4 12 20.4 C6.7 20.4 2.4 16.9 2.4 12.6 Z', fill: 'BROWN_SOFT', stroke: 'INK', sw: 1.45 },
    { k: 'circle', cx: 15.8, cy: 11.6, r: 1.9, fill: 'RED', stroke: 'INK', sw: 1.2 },
  ],
  'send': [
    { k: 'polygon', p: '21.2,3 3,9.6 11.3,13', fill: 'WHITE', stroke: 'INK', sw: 1.5 },
    { k: 'polygon', p: '21.2,3 11.3,13 14.2,21', fill: 'GREEN_SOFT', stroke: 'INK', sw: 1.5 },
  ],
  'settings': [
    { k: 'polygon', p: '21.47,10.42 21.47,13.58 18.7,13.66 17.91,15.56 19.81,17.58 17.58,19.81 15.56,17.91 13.66,18.7 13.58,21.47 10.42,21.47 10.34,18.7 8.44,17.91 6.42,19.81 4.19,17.58 6.09,15.56 5.3,13.66 2.53,13.58 2.53,10.42 5.3,10.34 6.09,8.44 4.19,6.42 6.42,4.19 8.44,6.09 10.34,5.3 10.42,2.53 13.58,2.53 13.66,5.3 15.56,6.09 17.58,4.19 19.81,6.42 17.91,8.44 18.7,10.34', fill: 'WHITE', stroke: 'INK', sw: 1.6 },
    { k: 'circle', cx: 12, cy: 12, r: 3.3, fill: 'GREEN_SOFT', stroke: 'INK', sw: 1.6 },
  ],
  'shuffle': [
    { k: 'path', d: 'M3.2 6.8 H6.6 C10.2 6.8 11.8 17.2 15.4 17.2 H19.4', stroke: 'INK', sw: 1.9 },
    { k: 'polyline', p: '17.4,15.1 19.7,17.2 17.4,19.3', stroke: 'INK', sw: 1.9 },
    { k: 'path', d: 'M3.2 17.2 H6.6 C10.2 17.2 11.8 6.8 15.4 6.8 H19.4', stroke: 'GREEN', sw: 1.9 },
    { k: 'polyline', p: '17.4,4.7 19.7,6.8 17.4,8.9', stroke: 'GREEN', sw: 1.9 },
  ],
  'sprout': [
    { k: 'path', d: 'M3.4 20.8 C4.6 17.6 8.0 16.0 12 16.0 C16 16.0 19.4 17.6 20.6 20.8 Z', fill: 'BROWN', stroke: 'INK', sw: 1.45 },
    { k: 'polyline', p: '12,17 12,10', stroke: 'GREEN', sw: 1.8 },
    { k: 'path', d: 'M9.6 4.7 C12.4 6.74 12.4 10.07 9.6 12.1 C6.8 10.07 6.8 6.74 9.6 4.7 Z', fill: 'GREEN', stroke: 'INK', sw: 1.2, rot: [-42, 9.6, 8.4] },
    { k: 'path', d: 'M14.4 3.9 C17.2 5.93 17.2 9.27 14.4 11.3 C11.6 9.27 11.6 5.93 14.4 3.9 Z', fill: 'GREEN_SOFT', stroke: 'INK', sw: 1.2, rot: [42, 14.4, 7.6] },
  ],
  'sweets': [
    { k: 'polygon', p: '7.8,12 3,8.4 4.4,12 3,15.6', fill: 'BERRY_SOFT', stroke: 'INK', sw: 1.2 },
    { k: 'polygon', p: '16.2,12 21,8.4 19.6,12 21,15.6', fill: 'BERRY_SOFT', stroke: 'INK', sw: 1.2 },
    { k: 'ellipse', cx: 12, cy: 12, rx: 4.8, ry: 4.2, fill: 'BERRY', stroke: 'INK', sw: 1.45 },
    { k: 'polyline', p: '9.6,14.4 13.2,9.6', stroke: 'WHITE', sw: 1.5 },
    { k: 'polyline', p: '11.8,15.2 15,10.8', stroke: 'WHITE', sw: 1.5 },
  ],
  'timer': [
    { k: 'polyline', p: '6.6,3 17.4,3', stroke: 'INK', sw: 2 },
    { k: 'polyline', p: '6.6,21 17.4,21', stroke: 'INK', sw: 2 },
    { k: 'path', d: 'M7.6 3.4 H16.4 C16.4 8.2 12 11 12 12 C12 13 16.4 15.8 16.4 20.6 H7.6 C7.6 15.8 12 13 12 12 C12 11 7.6 8.2 7.6 3.4 Z', fill: 'WHITE', stroke: 'INK', sw: 1.6 },
    { k: 'path', d: 'M9.3 5.4 H14.7 C14.4 8.2 12 10.3 12 10.3 C12 10.3 9.6 8.2 9.3 5.4 Z', fill: 'AMBER' },
    { k: 'path', d: 'M8.9 18.9 C9.5 16.5 12 15.2 12 15.2 C12 15.2 14.5 16.5 15.1 18.9 Z', fill: 'AMBER' },
    { k: 'polyline', p: '12,12.4 12,14', stroke: 'AMBER', sw: 1 },
  ],
  'vegetables': [
    { k: 'path', d: 'M8.4 1.8 C10.42 3.56 10.42 6.44 8.4 8.2 C6.38 6.44 6.38 3.56 8.4 1.8 Z', fill: 'GREEN', stroke: 'INK', sw: 1.2, rot: [-30, 8.4, 5] },
    { k: 'path', d: 'M12 0.4 C14.02 2.27 14.02 5.33 12 7.2 C9.98 5.33 9.98 2.27 12 0.4 Z', fill: 'GREEN', stroke: 'INK', sw: 1.2 },
    { k: 'path', d: 'M15.6 1.8 C17.62 3.56 17.62 6.44 15.6 8.2 C13.58 6.44 13.58 3.56 15.6 1.8 Z', fill: 'GREEN', stroke: 'INK', sw: 1.2, rot: [30, 15.6, 5] },
    { k: 'path', d: 'M8.4 9.8 C8.4 8.4 9.8 7.6 12 7.6 C14.2 7.6 15.6 8.4 15.6 9.8 L12.8 20.8 C12.5 21.8 11.5 21.8 11.2 20.8 Z', fill: 'ORANGE', stroke: 'INK', sw: 1.45 },
    { k: 'polyline', p: '9.4,11.6 11.2,11.2', stroke: 'INK', sw: 1.1 },
    { k: 'polyline', p: '12.6,13.8 14.4,13.4', stroke: 'INK', sw: 1.1 },
    { k: 'polyline', p: '10.6,16.2 12.4,15.8', stroke: 'INK', sw: 1.1 },
  ],
  'warning': [
    { k: 'path', d: 'M10.5 4.0 C11.2 2.9 12.8 2.9 13.5 4.0 L22.0 18.6 C22.7 19.8 21.9 21.2 20.5 21.2 H3.5 C2.1 21.2 1.3 19.8 2.0 18.6 Z', fill: 'AMBER', stroke: 'INK', sw: 1.6 },
    { k: 'polyline', p: '12,9.2 12,14.6', stroke: 'INK', sw: 2 },
    { k: 'circle', cx: 12, cy: 17.6, r: 1.15, fill: 'INK' },
  ],
  'wok': [
    { k: 'circle', cx: 5.4, cy: 5.6, r: 1.5, fill: 'GREEN', stroke: 'INK', sw: 1.2 },
    { k: 'rect', rx: 0.95, x: 8.6, y: 3, width: 3.2, height: 1.9, fill: 'ORANGE', stroke: 'INK', sw: 1.2 },
    { k: 'circle', cx: 12.6, cy: 5.2, r: 1.3, fill: 'RED', stroke: 'INK', sw: 1.2 },
    { k: 'polyline', p: '19,11.2 23.4,11.2', stroke: 'INK', sw: 2.2, rot: [-20, 11, 13] },
    { k: 'polyline', p: '21.6,11.2 23.4,11.2', stroke: 'BROWN', sw: 2.9, rot: [-20, 11, 13] },
    { k: 'path', d: 'M2.0 11.4 H20.0 C20.0 15.6 16.0 18.4 11.0 18.4 C6.0 18.4 2.0 15.6 2.0 11.4 Z', fill: 'CREAM', stroke: 'INK', sw: 1.45, rot: [-20, 11, 13] },
    { k: 'circle', cx: 7.4, cy: 13.4, r: 1.1, fill: 'GREEN', rot: [-20, 11, 13] },
    { k: 'circle', cx: 11.4, cy: 14, r: 1, fill: 'ORANGE', rot: [-20, 11, 13] },
  ],
};

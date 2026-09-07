/**
 * How wide a library tile is, how tall, and how many fit across.
 *
 * ===========================================================================
 * THE OWNER'S INSTRUCTION, VERBATIM
 * ===========================================================================
 *
 * "Bij mijn recepten zijn de filters, te groot en wil ik dat je 3 recepten
 * breed hebt onderin het scherm om door je recepten heen te scrollen."
 *
 * ===========================================================================
 * WHY THREE NUMBERS LIVE IN A MODULE INSTEAD OF IN THE TWO FILES THAT DRAW
 * ===========================================================================
 *
 * They were in both, and they had already drifted. `RecipeTile` framed its
 * thumbnail at `9 / 16` with `flex: 1`; `recipes.tsx`'s loading grid drew the
 * same tile at `9 / 16` and `width: '47%'`, which is not the width a
 * two-column grid with a 12pt gutter and 20pt margins actually produces
 * (48.4%). The placeholder and the thing it stood in for were different
 * rectangles, and the only way to notice was to open both files.
 *
 * A `.ts` rather than constants in a `.tsx` for the reason every sibling
 * module here gives — vitest has react-native stubbed, so a number written
 * inside a component is a number nothing can assert — and in this case the
 * assertion is the point: tests/libraryGridMetrics.test.ts is WS-2 §5's
 * density table, in a place a change to the columns has to walk past.
 *
 * ===========================================================================
 * WHY 4:5 AND NOT DESIGN.md §2's 9:16
 * ===========================================================================
 *
 * WS-2 §5.2 measured it, and `ui-research/ASSEMBLY.md` §2.2 refereed it in
 * WS-2's favour: at 393pt a two-column 9:16 tile is 303.1pt tall and the
 * library shows 3.7 recipes per screen, on a surface `DESIGN.md` §1.1 says
 * must "grow from nothing to hundreds" and whose stated measure of good is
 * "recognition at speed". A hundred saved recipes is twenty-seven screens.
 *
 * The frame already uses `resizeMode: 'cover'`, so nothing is distorted by
 * this — the question is only how much of the SCREEN one still is worth. In
 * short-form video the top and bottom thirds carry platform chrome and
 * burned-in captions and the dish is centred, so a 4:5 crop keeps the middle
 * 56% and drops the least recognisable parts.
 *
 * `DESIGN.md` §2 names 9:16 explicitly and is therefore now wrong about this
 * screen. That is D11 in ASSEMBLY.md §4.3, listed there as needing the
 * owner's ratification; he has since asked for three columns, which cannot
 * be built at 9:16 at all — a 109.7pt-wide tile would be 195pt tall, and
 * three of those cost more vertical space per recipe than the two-column
 * grid they replace.
 *
 * ===========================================================================
 * THREE COLUMNS OVERTURNS WS-2's OWN REJECTION, AND THE COST IS REAL
 * ===========================================================================
 *
 * WS-2 §5.2 tested three columns and rejected them, on measurement rather
 * than taste: at 393pt the tile is 109.7pt wide, its scrim column is 93.7pt,
 * and "Traybake met kip, paprika en citroen" at `bodySmall` wraps to five
 * lines — a 116pt scrim on a 137pt tile. Its conclusion was that "the title
 * would have to leave the tile", and that a title below the frame costs 44pt
 * of pitch, putting three columns level with two.
 *
 * The measurement is right and the conclusion was answered rather than
 * overruled: the title stays on the scrim and is capped at two lines, which
 * is the trade `RecipeTile`'s own A6 comment refused and which that file's
 * header now records as reversed. What WS-2 could not weigh is that the
 * owner asked for three columns in the same breath as he asked for a shorter
 * filter bar — the density gain is the two changes together, not the grid
 * alone.
 */

import { spacing } from '@/theme/tokens';

/** The owner's number. Not derived from anything — he said three. */
export const LIBRARY_GRID_COLUMNS = 3;

/** WS-2 §5.2's redline, refereed in ASSEMBLY.md §2.2. Width : height, so a portrait tile is < 1. */
export const LIBRARY_TILE_ASPECT_RATIO = 4 / 5;

/** The gutter between tiles, in both axes — `FlatList`'s `columnWrapperStyle` gap and the grid's own row gap. */
export const LIBRARY_GRID_GUTTER = spacing.space3;

/**
 * One tile's width at a given screen width.
 *
 * Computed rather than expressed as a percentage, and that is the fix for
 * the drift described in the header: a percentage has to be re-derived by
 * hand every time the column count, the gutter or the screen padding moves,
 * and the last time somebody did that by hand they got 47% for a rectangle
 * that is 48.4% wide.
 *
 * It also solves a `FlatList` problem that only appears at three columns. A
 * tile styled `flex: 1` inside `columnWrapperStyle` stretches to fill a
 * PARTIAL last row — with seven recipes the seventh would be drawn triple
 * width. Giving every cell an exact width makes the last row look like every
 * other one, without the placeholder-row padding trick that would put fake
 * entries into `data` and therefore into `keyExtractor`.
 *
 * CLAMPED AT ZERO. `useWindowDimensions` can report 0 before first layout,
 * and a negative `width` style throws where a zero merely draws nothing.
 */
export function libraryTileWidth(screenWidth: number): number {
  const gutters = LIBRARY_GRID_GUTTER * (LIBRARY_GRID_COLUMNS - 1);
  const usable = screenWidth - 2 * spacing.screenPaddingHorizontal - gutters;
  return usable <= 0 ? 0 : usable / LIBRARY_GRID_COLUMNS;
}

/**
 * One tile's height at a given screen width — the width through the aspect
 * ratio, which is what `aspectRatio: 4 / 5` resolves to on the frame itself.
 *
 * Exported for the loading grid, which draws the same rectangle without a
 * `RecipeTile` inside it. Nothing else should need it: the real tile still
 * lets Yoga do the division from `aspectRatio`, so there is exactly one
 * rectangle rather than a computed one and a declared one that can disagree.
 */
export function libraryTileHeight(screenWidth: number): number {
  return libraryTileWidth(screenWidth) / LIBRARY_TILE_ASPECT_RATIO;
}

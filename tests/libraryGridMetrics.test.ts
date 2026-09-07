/**
 * The arithmetic behind "3 recepten breed", asserted rather than eyeballed.
 *
 * WS-2 §5 settled the library's density by measurement and nothing else, and
 * every number it produced was a calculation somebody did by hand into a
 * markdown table — which is exactly how `DESIGN.md` ended up naming 9:16
 * while the screen it described showed 3.7 tiles. These tests are that table,
 * in a place a change to the columns or the aspect has to walk past.
 */

import { describe, expect, test } from 'vitest';
import {
  LIBRARY_GRID_COLUMNS,
  LIBRARY_TILE_ASPECT_RATIO,
  libraryTileHeight,
  libraryTileWidth,
} from '@/components/libraryGridMetrics';

/** The reference phone every WS-2 measurement is stated at. */
const IPHONE_15_WIDTH = 393;

describe('LIBRARY_GRID_COLUMNS', () => {
  test('is three — the owner asked for "3 recepten breed"', () => {
    expect(LIBRARY_GRID_COLUMNS).toBe(3);
  });
});

describe('LIBRARY_TILE_ASPECT_RATIO', () => {
  test("is 4:5, WS-2 §5.2's redline, not DESIGN.md §2's 9:16", () => {
    expect(LIBRARY_TILE_ASPECT_RATIO).toBe(4 / 5);
  });

  test('is portrait — a still from a vertical video read as a shape, not a filmstrip frame', () => {
    expect(LIBRARY_TILE_ASPECT_RATIO).toBeLessThan(1);
  });
});

describe('libraryTileWidth', () => {
  test('divides the screen minus both margins and both gutters, at 393pt', () => {
    // (393 - 2x20 screen padding - 2x12 gutter) / 3 = 109.666…
    expect(libraryTileWidth(IPHONE_15_WIDTH)).toBeCloseTo(109.667, 3);
  });

  test('three tiles plus two gutters plus two margins is exactly the screen', () => {
    const width = libraryTileWidth(IPHONE_15_WIDTH);
    expect(3 * width + 2 * 12 + 2 * 20).toBeCloseTo(IPHONE_15_WIDTH, 6);
  });

  test('holds at the four widths WS-2 measures', () => {
    expect(libraryTileWidth(320)).toBeCloseTo(85.333, 3);
    expect(libraryTileWidth(375)).toBeCloseTo(103.667, 3);
    expect(libraryTileWidth(430)).toBeCloseTo(122, 3);
  });

  test('never returns a negative width, however narrow the screen is reported to be', () => {
    // A zero-width first frame is a real thing on this platform:
    // `useWindowDimensions` can report 0 before layout, and a negative `width`
    // style throws where a zero merely draws nothing.
    expect(libraryTileWidth(0)).toBe(0);
    expect(libraryTileWidth(40)).toBe(0);
  });
});

describe('libraryTileHeight', () => {
  test('is the width divided by 4:5 — 137.08pt at 393pt', () => {
    expect(libraryTileHeight(IPHONE_15_WIDTH)).toBeCloseTo(137.083, 3);
  });

  test('is taller than it is wide, at every supported width', () => {
    for (const screenWidth of [320, 375, 393, 430]) {
      expect(libraryTileHeight(screenWidth)).toBeGreaterThan(libraryTileWidth(screenWidth));
    }
  });

  test('the vertical cost per tile beats the 2-column 9:16 grid it replaces', () => {
    // Old: (393 - 40 - 12) / 2 = 170.5 wide, / (9/16) = 303.1 tall, 12pt gutter,
    // two per row. New: three per row at 137.08.
    const oldPitchPerTile = (303.111 + 12) / 2;
    const newPitchPerTile = (libraryTileHeight(IPHONE_15_WIDTH) + 12) / LIBRARY_GRID_COLUMNS;
    expect(newPitchPerTile).toBeLessThan(oldPitchPerTile / 3);
  });
});

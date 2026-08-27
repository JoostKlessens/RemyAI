/**
 * The order of the Bibliotheek action sheet's rows, and the shape the
 * separator reads off them (src/components/libraryTileActionRows.ts).
 *
 * WHY THIS FILE EXISTS. DESIGN-SOCIAL.md §3.1 orders `Sturen` FIRST —
 * sending is the reason someone long-presses a tile, withholding is the
 * rare case — and until the rows moved out of LibraryTileActionSheet.tsx
 * the only thing enforcing that was a paragraph in a file header. A
 * paragraph cannot fail. Position is also invisible to the copy tests next
 * door: libraryTileActionCopy.test.ts would stay green with the two rows
 * rendered in either order, because not one constant changes.
 *
 * THE SEPARATOR IS THE SECOND HALF OF THE SAME RULE. The sheet draws a
 * bottom border on every row where `index < rows.length - 1`, never on a
 * named row — that is what lets `Sturen` appear, disappear, or be followed
 * by a third row without touching any JSX. The tests below pin the two
 * facts that rule stands on: the array is dense and ordered, and its
 * length is exactly the number of rows the sheet was given handlers for.
 * A `buildLibraryTileActionRows` that returned a fixed-length array with a
 * hole in it — the obvious way to "simplify" the optional row — would keep
 * every copy assertion green while drawing a border under nothing.
 */

import { describe, expect, test } from 'vitest';
import {
  COOK_PROOF_EXCLUDE_LABEL,
  COOK_PROOF_SCOPE_NOTE,
  INITIAL_COOK_PROOF_EXCLUSION,
  LIBRARY_TILE_SEND_LABEL,
  reduceCookProofExclusion,
  type CookProofExclusionState,
} from '@/components/libraryTileActionCopy';
import { buildLibraryTileActionRows, type LibraryTileActionRow } from '@/components/libraryTileActionRows';

/** The state a sheet reaches after a successful read, ready to be toggled. */
function readyState(excluded: boolean): CookProofExclusionState {
  return reduceCookProofExclusion(INITIAL_COOK_PROOF_EXCLUSION, { type: 'load-succeeded', excluded });
}

function noop(): void {}

/**
 * `rows[0]` under `noUncheckedIndexedAccess` is `Row | undefined`, and
 * `!` would turn "the array was shorter than expected" — the exact
 * regression these tests are here to catch — into an unreadable
 * `Cannot read properties of undefined`. This says what was expected.
 */
function rowAt(rows: readonly LibraryTileActionRow[], index: number): LibraryTileActionRow {
  const row = rows[index];
  if (row === undefined) {
    throw new Error(`expected a row at index ${index}, but the sheet built ${rows.length}`);
  }
  return row;
}

/**
 * The separator the sheet actually draws, expressed exactly as the JSX
 * does it: keyed on position, blind to what the row is called. Asserting
 * through this rather than against a hardcoded list of keys is the point —
 * if the rule ever starts naming a row, this helper stops matching the
 * component and the tests below stop meaning anything.
 */
function rowsWithSeparator(rows: readonly LibraryTileActionRow[]): readonly boolean[] {
  return rows.map((_row, index) => index < rows.length - 1);
}

describe('row order — §3.1 puts Sturen first', () => {
  test('Sturen sorts before the sharing row when the surface can send', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
    });

    expect(rows.map((row) => row.key)).toEqual(['sturen', 'cook-proof-exclusion']);
    expect(rowAt(rows, 0).label).toBe(LIBRARY_TILE_SEND_LABEL);
    expect(rowAt(rows, 1).label).toBe(COOK_PROOF_EXCLUDE_LABEL);
  });

  test('Sturen still sorts first when the sharing row is excluded, loading or failed', () => {
    const states: readonly CookProofExclusionState[] = [
      INITIAL_COOK_PROOF_EXCLUSION,
      readyState(true),
      reduceCookProofExclusion(INITIAL_COOK_PROOF_EXCLUSION, { type: 'load-failed' }),
      reduceCookProofExclusion(reduceCookProofExclusion(readyState(false), { type: 'write-started' }), {
        type: 'write-failed',
      }),
    ];

    for (const cookProofExclusion of states) {
      const rows = buildLibraryTileActionRows({ cookProofExclusion, onPressCookProofRow: noop, onSturen: noop });
      expect(rowAt(rows, 0).key).toBe('sturen');
    }
  });

  test('a missing onSturen removes the row rather than disabling it', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
    });

    expect(rows.map((row) => row.key)).toEqual(['cook-proof-exclusion']);
    expect(rows.some((row) => row.key === 'sturen')).toBe(false);
  });

  test('Sturen is never disabled — its refusals belong to the sheet it opens', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: INITIAL_COOK_PROOF_EXCLUSION,
      onPressCookProofRow: noop,
      onSturen: noop,
    });

    expect(rowAt(rows, 0).disabled).toBe(false);
    expect(rowAt(rows, 0).errorNote).toBeNull();
  });
});

describe('the separator keys off position, never off a row name', () => {
  test('two rows: a border under the first only', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
    });

    expect(rowsWithSeparator(rows)).toEqual([true, false]);
  });

  test('one row: no border at all, with no special case for the row that is missing', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
    });

    expect(rowsWithSeparator(rows)).toEqual([false]);
  });

  test('the array is dense and its keys are unique — the separator has nothing else to stand on', () => {
    for (const onSturen of [undefined, noop]) {
      const rows = buildLibraryTileActionRows({
        cookProofExclusion: readyState(false),
        onPressCookProofRow: noop,
        onSturen,
      });

      expect(rows.every((row) => row !== undefined && row !== null)).toBe(true);
      expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
      expect(rows.length).toBe(onSturen === undefined ? 1 : 2);
    }
  });
});

describe('the rows the sheet renders carry what the sheet renders them with', () => {
  test('the scope note sits on the exclusion row, never on Sturen', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
    });

    expect(rowAt(rows, 0).footnote).toBeNull();
    expect(rowAt(rows, 1).footnote).toBe(COOK_PROOF_SCOPE_NOTE);
  });

  test('each row presses its own handler, and neither presses the other', () => {
    const pressed: string[] = [];
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: () => pressed.push('cook-proof'),
      onSturen: () => pressed.push('sturen'),
    });

    rowAt(rows, 0).onPress();
    rowAt(rows, 1).onPress();

    expect(pressed).toEqual(['sturen', 'cook-proof']);
  });

  test('the exclusion row is disabled exactly while its state is not actionable', () => {
    const loading = buildLibraryTileActionRows({
      cookProofExclusion: INITIAL_COOK_PROOF_EXCLUSION,
      onPressCookProofRow: noop,
      onSturen: noop,
    });
    const ready = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
    });

    expect(rowAt(loading, 1).disabled).toBe(true);
    expect(rowAt(ready, 1).disabled).toBe(false);
  });
});

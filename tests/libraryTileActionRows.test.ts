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
import { INITIAL_LIBRARY_REMOVAL, type LibraryRemovalState } from '@/components/libraryRemovalCopy';
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
 * Every call in this file that does not specifically exercise removal
 * passes this — the removal row is unconditional (see this module's own
 * header), so leaving it out of a test fixture would be leaving the third
 * row's shape unpinned in every test but its own.
 */
const IDLE_REMOVAL: LibraryRemovalState = INITIAL_LIBRARY_REMOVAL;
const REMOVAL_HANDLERS = { onRequestRemoval: noop, onCancelRemoval: noop, onConfirmRemoval: noop };

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

describe('row order — §3.1 puts Sturen first, Verwijderen (LIB-04) last', () => {
  test('Sturen, then the sharing row, then Verwijderen when the surface can send', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rows.map((row) => row.key)).toEqual(['sturen', 'cook-proof-exclusion', 'remove']);
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
      const rows = buildLibraryTileActionRows({
        cookProofExclusion,
        onPressCookProofRow: noop,
        onSturen: noop,
        removal: IDLE_REMOVAL,
        ...REMOVAL_HANDLERS,
      });
      expect(rowAt(rows, 0).key).toBe('sturen');
      expect(rowAt(rows, rows.length - 1).key).toBe('remove');
    }
  });

  test('a missing onSturen removes the row rather than disabling it — Verwijderen still renders', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rows.map((row) => row.key)).toEqual(['cook-proof-exclusion', 'remove']);
    expect(rows.some((row) => row.key === 'sturen')).toBe(false);
  });

  test('Sturen is never disabled — its refusals belong to the sheet it opens', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: INITIAL_COOK_PROOF_EXCLUSION,
      onPressCookProofRow: noop,
      onSturen: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rowAt(rows, 0).disabled).toBe(false);
    expect(rowAt(rows, 0).errorNote).toBeNull();
  });
});

describe('the separator keys off position, never off a row name', () => {
  test('three rows: a border under the first two only', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rowsWithSeparator(rows)).toEqual([true, true, false]);
  });

  test('two rows (no Sturen): a border under the first only, with no special case for the row that is missing', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rowsWithSeparator(rows)).toEqual([true, false]);
  });

  test('the array is dense and its keys are unique — the separator has nothing else to stand on', () => {
    for (const onSturen of [undefined, noop]) {
      const rows = buildLibraryTileActionRows({
        cookProofExclusion: readyState(false),
        onPressCookProofRow: noop,
        onSturen,
        removal: IDLE_REMOVAL,
        ...REMOVAL_HANDLERS,
      });

      expect(rows.every((row) => row !== undefined && row !== null)).toBe(true);
      expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
      expect(rows.length).toBe(onSturen === undefined ? 2 : 3);
    }
  });
});

describe('the rows the sheet renders carry what the sheet renders them with', () => {
  test('the scope note sits on the exclusion row, never on Sturen or Verwijderen', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rowAt(rows, 0).footnote).toBeNull();
    expect(rowAt(rows, 1).footnote).toBe(COOK_PROOF_SCOPE_NOTE);
    expect(rowAt(rows, 2).footnote).toBeNull();
  });

  test('each row presses its own handler, and none presses another', () => {
    const pressed: string[] = [];
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: () => pressed.push('cook-proof'),
      onSturen: () => pressed.push('sturen'),
      removal: IDLE_REMOVAL,
      onRequestRemoval: () => pressed.push('remove'),
      onCancelRemoval: noop,
      onConfirmRemoval: noop,
    });

    rowAt(rows, 0).onPress();
    rowAt(rows, 1).onPress();
    rowAt(rows, 2).onPress();

    expect(pressed).toEqual(['sturen', 'cook-proof', 'remove']);
  });

  test('the exclusion row is disabled exactly while its state is not actionable', () => {
    const loading = buildLibraryTileActionRows({
      cookProofExclusion: INITIAL_COOK_PROOF_EXCLUSION,
      onPressCookProofRow: noop,
      onSturen: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });
    const ready = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rowAt(loading, 1).disabled).toBe(true);
    expect(rowAt(ready, 1).disabled).toBe(false);
  });

  test('every row but Verwijderen carries the default tone and no cancel action', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      onSturen: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rowAt(rows, 0).tone).toBe('default');
    expect(rowAt(rows, 0).cancelAction).toBeNull();
    expect(rowAt(rows, 1).tone).toBe('default');
    expect(rowAt(rows, 1).cancelAction).toBeNull();
  });
});

describe('Verwijderen (LIB-04) — always present, danger-toned, and confirms in place', () => {
  test('is present even with no onSturen and a loading exclusion — every dish in the library can be removed', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: INITIAL_COOK_PROOF_EXCLUSION,
      onPressCookProofRow: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    expect(rows.some((row) => row.key === 'remove')).toBe(true);
  });

  test('carries the danger tone, unlike every other row', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      removal: IDLE_REMOVAL,
      ...REMOVAL_HANDLERS,
    });

    const remove = rowAt(rows, rows.length - 1);
    expect(remove.tone).toBe('danger');
  });

  test('idle: no cancel action, pressing it requests the confirm rather than removing outright', () => {
    let requested = false;
    let confirmed = false;
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      removal: IDLE_REMOVAL,
      onRequestRemoval: () => {
        requested = true;
      },
      onCancelRemoval: noop,
      onConfirmRemoval: () => {
        confirmed = true;
      },
    });

    const remove = rowAt(rows, rows.length - 1);
    expect(remove.cancelAction).toBeNull();
    remove.onPress();
    expect(requested).toBe(true);
    expect(confirmed).toBe(false);
  });

  test('confirming: a cancel action appears beside the row, and the row itself now fires the confirm', () => {
    let confirmed = false;
    let cancelled = false;
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      removal: { phase: 'confirming' },
      onRequestRemoval: noop,
      onCancelRemoval: () => {
        cancelled = true;
      },
      onConfirmRemoval: () => {
        confirmed = true;
      },
    });

    const remove = rowAt(rows, rows.length - 1);
    expect(remove.cancelAction).not.toBeNull();
    remove.onPress();
    expect(confirmed).toBe(true);

    remove.cancelAction?.onPress();
    expect(cancelled).toBe(true);
  });

  test('pending: disabled, and no cancel action — a write already in flight cannot be cancelled mid-air', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      removal: { phase: 'pending' },
      ...REMOVAL_HANDLERS,
    });

    const remove = rowAt(rows, rows.length - 1);
    expect(remove.disabled).toBe(true);
    expect(remove.cancelAction).toBeNull();
  });

  test('failed: an error note under the row, back to the plain label, and no cancel action', () => {
    const rows = buildLibraryTileActionRows({
      cookProofExclusion: readyState(false),
      onPressCookProofRow: noop,
      removal: { phase: 'failed' },
      ...REMOVAL_HANDLERS,
    });

    const remove = rowAt(rows, rows.length - 1);
    expect(remove.errorNote).not.toBeNull();
    expect(remove.cancelAction).toBeNull();
  });
});

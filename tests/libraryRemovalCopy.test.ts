/**
 * "Verwijderen" — LIB-04's own state machine and copy
 * (src/components/libraryRemovalCopy.ts). Mirrors the shape of
 * libraryTileActionCopy.test.ts for the exclusion row: the state machine is
 * asserted directly (no out-of-order event may fire a write it shouldn't),
 * and the copy is asserted to say the two things the row must never drop —
 * the dish leaves the grid, and what was already cooked with it survives.
 */

import { describe, expect, test } from 'vitest';
import {
  INITIAL_LIBRARY_REMOVAL,
  LIBRARY_REMOVE_CANCEL_LABEL,
  LIBRARY_REMOVE_CONFIRM_LABEL,
  LIBRARY_REMOVE_FAILED_NOTE,
  LIBRARY_REMOVE_LABEL,
  describeLibraryRemovalRow,
  describeLibraryRemovedAnnouncement,
  reduceLibraryRemoval,
  type LibraryRemovalState,
} from '@/components/libraryRemovalCopy';

function confirming(): LibraryRemovalState {
  return reduceLibraryRemoval(INITIAL_LIBRARY_REMOVAL, { type: 'request-removal' });
}

function pending(): LibraryRemovalState {
  return reduceLibraryRemoval(confirming(), { type: 'confirm-removal' });
}

function failed(): LibraryRemovalState {
  return reduceLibraryRemoval(pending(), { type: 'removal-failed' });
}

describe('the removal state machine', () => {
  test('starts idle, showing plain "Verwijderen"', () => {
    expect(INITIAL_LIBRARY_REMOVAL.phase).toBe('idle');
    expect(describeLibraryRemovalRow(INITIAL_LIBRARY_REMOVAL).label).toBe(LIBRARY_REMOVE_LABEL);
    expect(describeLibraryRemovalRow(INITIAL_LIBRARY_REMOVAL).cancelLabel).toBeNull();
  });

  test('request-removal moves idle to confirming, offering both a confirm and a cancel action', () => {
    const state = confirming();
    expect(state.phase).toBe('confirming');
    const row = describeLibraryRemovalRow(state);
    expect(row.label).toBe(LIBRARY_REMOVE_CONFIRM_LABEL);
    expect(row.cancelLabel).toBe(LIBRARY_REMOVE_CANCEL_LABEL);
  });

  test('cancel-removal returns confirming to idle', () => {
    const state = reduceLibraryRemoval(confirming(), { type: 'cancel-removal' });
    expect(state.phase).toBe('idle');
  });

  test('confirm-removal moves confirming to pending, and the row disables itself while the write is in flight', () => {
    const state = pending();
    expect(state.phase).toBe('pending');
    expect(describeLibraryRemovalRow(state).disabled).toBe(true);
  });

  test('removal-failed moves pending to failed, with the cancel offered nowhere — the row itself becomes the retry', () => {
    const state = failed();
    expect(state.phase).toBe('failed');
    const row = describeLibraryRemovalRow(state);
    expect(row.label).toBe(LIBRARY_REMOVE_LABEL);
    expect(row.errorNote).toBe(LIBRARY_REMOVE_FAILED_NOTE);
    expect(row.cancelLabel).toBeNull();
  });

  test('failed can be re-armed by request-removal, back to confirming', () => {
    const state = reduceLibraryRemoval(failed(), { type: 'request-removal' });
    expect(state.phase).toBe('confirming');
  });

  test('reset always returns idle, regardless of the current phase', () => {
    for (const state of [INITIAL_LIBRARY_REMOVAL, confirming(), pending(), failed()]) {
      expect(reduceLibraryRemoval(state, { type: 'reset' })).toEqual(INITIAL_LIBRARY_REMOVAL);
    }
  });

  /**
   * The guard rail this whole state machine exists for: a second
   * "confirm-removal" landing while the first write is still pending must
   * not fire a second write. Ignored transitions return the SAME object so
   * a test — or a component relying on reference equality — can tell the
   * difference between "handled" and "ignored".
   */
  test('an out-of-order confirm-removal while already pending is ignored, not double-fired', () => {
    const state = pending();
    expect(reduceLibraryRemoval(state, { type: 'confirm-removal' })).toBe(state);
  });

  test('an out-of-order cancel-removal while idle is ignored', () => {
    expect(reduceLibraryRemoval(INITIAL_LIBRARY_REMOVAL, { type: 'cancel-removal' })).toBe(INITIAL_LIBRARY_REMOVAL);
  });

  test('an out-of-order removal-failed while idle is ignored', () => {
    expect(reduceLibraryRemoval(INITIAL_LIBRARY_REMOVAL, { type: 'removal-failed' })).toBe(INITIAL_LIBRARY_REMOVAL);
  });
});

describe('what the copy must never drop', () => {
  test('the idle explainer states both that the dish leaves the grid and that cook history survives', () => {
    const explainer = describeLibraryRemovalRow(INITIAL_LIBRARY_REMOVAL).explainer;
    expect(explainer.toLowerCase()).toContain('mijn recepten');
    expect(explainer.toLowerCase()).toContain('blijft');
  });

  test('the confirming row asks a real question, not just a restated label', () => {
    expect(describeLibraryRemovalRow(confirming()).explainer.toLowerCase()).toContain('zeker');
  });

  test('the accessibility label folds label and explainer into one string for a screen reader', () => {
    const row = describeLibraryRemovalRow(INITIAL_LIBRARY_REMOVAL);
    expect(row.accessibilityLabel).toContain(row.label);
    expect(row.accessibilityLabel).toContain(row.explainer);
  });

  test('describeLibraryRemovedAnnouncement names the dish, since the sheet showing it has already closed', () => {
    expect(describeLibraryRemovedAnnouncement('Kip kerrie')).toBe('Kip kerrie is verwijderd uit Mijn recepten.');
  });
});

/**
 * The words and the states around `Bewaren` on the shared recipe screen
 * (src/components/sharedRecipeSaveCopy.ts) — DESIGN-SOCIAL.md §3.3.
 *
 * The screen itself is a route module and cannot be imported here, so the
 * two things it decides — what the control reads, and which state a tap or
 * a write moves it to — live in a module this file can reach. Same reason
 * `sendRecipeSheetCopy.ts` carries `reduceSendSheet` beside its strings.
 */

import { describe, expect, test } from 'vitest';
import {
  SHARED_RECIPE_SAVED_ACCESSIBILITY_LABEL,
  SHARED_RECIPE_SAVED_LABEL,
  SHARED_RECIPE_SAVE_ACCESSIBILITY_LABEL,
  SHARED_RECIPE_SAVE_FAILED_NOTE,
  SHARED_RECIPE_SAVE_LABEL,
  SHARED_RECIPE_SAVE_NOT_FOUND_NOTE,
  SHARED_RECIPE_SAVE_UNAVAILABLE_NOTE,
  describeSharedRecipeSaveAnnouncement,
  describeSharedRecipeSaveControl,
  reduceSharedRecipeSave,
  type SharedRecipeSaveState,
} from '@/components/sharedRecipeSaveCopy';

const IDLE: SharedRecipeSaveState = { kind: 'idle' };
const CHOOSING: SharedRecipeSaveState = { kind: 'choosing' };
const SAVING: SharedRecipeSaveState = { kind: 'saving' };
const SAVED: SharedRecipeSaveState = { kind: 'saved' };
const NOT_FOUND: SharedRecipeSaveState = { kind: 'not_found' };
const FAILED: SharedRecipeSaveState = { kind: 'failed' };

describe('the two labels §3.3 names', () => {
  test('the primary reads "Bewaren" and the completed state reads "Bewaard"', () => {
    expect(SHARED_RECIPE_SAVE_LABEL).toBe('Bewaren');
    expect(SHARED_RECIPE_SAVED_LABEL).toBe('Bewaard');
  });

  test('both spoken labels name where the recipe lands', () => {
    expect(SHARED_RECIPE_SAVE_ACCESSIBILITY_LABEL).toContain('Mijn recepten');
    expect(SHARED_RECIPE_SAVED_ACCESSIBILITY_LABEL).toContain('Mijn recepten');
  });
});

describe('the three notes', () => {
  test('a failed write invites a retry', () => {
    expect(SHARED_RECIPE_SAVE_FAILED_NOTE).toMatch(/opnieuw/i);
  });

  test('a vanished recipe is named as gone, and nobody is blamed for it', () => {
    expect(SHARED_RECIPE_SAVE_NOT_FOUND_NOTE).toMatch(/niet meer/i);
    expect(SHARED_RECIPE_SAVE_NOT_FOUND_NOTE).not.toMatch(/\bje\b|\bjij\b|\bjouw\b/i);
  });

  test('a dish with no canonical recipe is told it cannot be saved YET, not that something failed', () => {
    expect(SHARED_RECIPE_SAVE_UNAVAILABLE_NOTE).toMatch(/nog niet/i);
    expect(SHARED_RECIPE_SAVE_UNAVAILABLE_NOTE).not.toMatch(/mislukt|lukte niet/i);
  });
});

describe('reduceSharedRecipeSave', () => {
  test('a tap opens the sheet, and dismissing the sheet returns to rest', () => {
    expect(reduceSharedRecipeSave(IDLE, { type: 'save-pressed' })).toEqual(CHOOSING);
    expect(reduceSharedRecipeSave(CHOOSING, { type: 'sheet-dismissed' })).toEqual(IDLE);
  });

  test('choosing an intent starts the write', () => {
    expect(reduceSharedRecipeSave(CHOOSING, { type: 'intent-chosen' })).toEqual(SAVING);
  });

  test('the write settles into exactly the outcome it reported', () => {
    expect(
      reduceSharedRecipeSave(SAVING, {
        type: 'write-settled',
        outcome: { kind: 'saved', mealId: 'meal-1', title: 'Ramen', isNewCopy: true },
      }),
    ).toEqual(SAVED);
    expect(reduceSharedRecipeSave(SAVING, { type: 'write-settled', outcome: { kind: 'not_found' } })).toEqual(
      NOT_FOUND,
    );
    expect(reduceSharedRecipeSave(SAVING, { type: 'write-settled', outcome: { kind: 'failed' } })).toEqual(FAILED);
  });

  test('a failed write is its own retry: the next tap opens the sheet again', () => {
    expect(reduceSharedRecipeSave(FAILED, { type: 'save-pressed' })).toEqual(CHOOSING);
  });

  test('a saved recipe and a vanished one do not reopen the sheet', () => {
    expect(reduceSharedRecipeSave(SAVED, { type: 'save-pressed' })).toEqual(SAVED);
    expect(reduceSharedRecipeSave(NOT_FOUND, { type: 'save-pressed' })).toEqual(NOT_FOUND);
  });

  test('events that do not belong to the current state are ignored rather than applied', () => {
    expect(reduceSharedRecipeSave(IDLE, { type: 'intent-chosen' })).toEqual(IDLE);
    expect(reduceSharedRecipeSave(SAVING, { type: 'sheet-dismissed' })).toEqual(SAVING);
    expect(reduceSharedRecipeSave(IDLE, { type: 'write-settled', outcome: { kind: 'failed' } })).toEqual(IDLE);
  });
});

describe('describeSharedRecipeSaveControl', () => {
  test('a dish with no canonical recipe gets a disabled primary and the reason under it', () => {
    expect(describeSharedRecipeSaveControl(IDLE, false)).toEqual({
      kind: 'button',
      label: SHARED_RECIPE_SAVE_LABEL,
      disabled: true,
      loading: false,
      note: SHARED_RECIPE_SAVE_UNAVAILABLE_NOTE,
    });
  });

  test('at rest, and while the sheet is up, the primary is live and says nothing else', () => {
    for (const state of [IDLE, CHOOSING]) {
      expect(describeSharedRecipeSaveControl(state, true)).toEqual({
        kind: 'button',
        label: SHARED_RECIPE_SAVE_LABEL,
        disabled: false,
        loading: false,
        note: null,
      });
    }
  });

  test('while writing, the primary shows the spinner', () => {
    expect(describeSharedRecipeSaveControl(SAVING, true)).toMatchObject({ kind: 'button', loading: true });
  });

  test('once saved, the control is the completed state and no longer a button', () => {
    expect(describeSharedRecipeSaveControl(SAVED, true)).toEqual({ kind: 'completed', label: SHARED_RECIPE_SAVED_LABEL });
  });

  test('a failed write keeps the primary live and explains under it', () => {
    expect(describeSharedRecipeSaveControl(FAILED, true)).toEqual({
      kind: 'button',
      label: SHARED_RECIPE_SAVE_LABEL,
      disabled: false,
      loading: false,
      note: SHARED_RECIPE_SAVE_FAILED_NOTE,
    });
  });

  test('a vanished recipe disables the primary and says why', () => {
    expect(describeSharedRecipeSaveControl(NOT_FOUND, true)).toMatchObject({
      kind: 'button',
      disabled: true,
      note: SHARED_RECIPE_SAVE_NOT_FOUND_NOTE,
    });
  });
});

describe('describeSharedRecipeSaveAnnouncement', () => {
  test('a saved copy is announced as landed in the library', () => {
    expect(
      describeSharedRecipeSaveAnnouncement({ kind: 'saved', mealId: 'meal-1', title: 'Ramen', isNewCopy: true }),
    ).toBe(SHARED_RECIPE_SAVED_ACCESSIBILITY_LABEL);
  });

  test('the two failures are announced with the same words the screen prints', () => {
    expect(describeSharedRecipeSaveAnnouncement({ kind: 'failed' })).toBe(SHARED_RECIPE_SAVE_FAILED_NOTE);
    expect(describeSharedRecipeSaveAnnouncement({ kind: 'not_found' })).toBe(SHARED_RECIPE_SAVE_NOT_FOUND_NOTE);
  });
});

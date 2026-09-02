/**
 * The recipe-edit screen's branching Dutch copy
 * (src/components/recipeEditCopy.ts).
 *
 * WHY THIS FILE EXISTS. The branch below decides whether somebody is warned,
 * BEFORE they save, that editing the ingredients will cost this dish its
 * allergen verification. That warning is the only moment PD-006's demotion
 * is visible to the person it protects — the demotion itself shows up weeks
 * later as a dish that quietly stopped being suggested, with nothing
 * connecting the two events. A branch that important cannot live in a `.tsx`
 * this repo's test setup cannot even parse.
 *
 * THE INVARIANT AT THE BOTTOM IS THE POINT OF THE WHOLE FILE. PD-006 ends on
 * the rule that this copy never claims safety, only whether a human checked
 * — "the copy says 'sluit uit wat je hebt getagd' and never 'veilig voor'".
 * Asserting that across EVERY string in the module, rather than per
 * sentence, is what makes it survive a future edit that adds a fifth state
 * and a reassuring adjective with it.
 */

import { describe, expect, test } from 'vitest';
import {
  RECIPE_EDIT_ALLERGEN_NOTES,
  RECIPE_EDIT_HEADING,
  RECIPE_EDIT_ROW_EXPLAINER,
  RECIPE_EDIT_ROW_LABEL,
  RECIPE_EDIT_SAVE_BLOCKED_HINT,
  RECIPE_EDIT_SUBTITLE,
  buildRecipeEditSaveErrorMessage,
  describeRecipeEditAllergens,
} from '@/components/recipeEditCopy';

describe('describeRecipeEditAllergens — a verification that is about to lapse', () => {
  test('warns, in warning tone, when a verified meal has had its ingredients edited', () => {
    const note = describeRecipeEditAllergens({
      storedStatus: 'verified',
      ingredientsChanged: true,
      recheckedOnScreen: false,
    });

    expect(note.outlook).toBe('verification_lost');
    expect(note.tone).toBe('warning');
  });

  test('that warning names the cause, the consequence and the fix in one sentence', () => {
    const note = describeRecipeEditAllergens({
      storedStatus: 'verified',
      ingredientsChanged: true,
      recheckedOnScreen: false,
    });

    expect(note.text).toContain('ingrediënten aangepast');
    expect(note.text).toContain('niet gecontroleerd');
    expect(note.text).toContain('bevestigen');
  });

  test('it is the ONLY state that spends the warning colour', () => {
    const warnings = RECIPE_EDIT_ALLERGEN_NOTES.filter((note) => note.tone === 'warning');

    expect(warnings.map((note) => note.outlook)).toEqual(['verification_lost']);
  });
});

describe('describeRecipeEditAllergens — the three states that are merely facts', () => {
  test('a verified meal whose ingredients are untouched is told the verification stands, and what would end it', () => {
    const note = describeRecipeEditAllergens({
      storedStatus: 'verified',
      ingredientsChanged: false,
      recheckedOnScreen: false,
    });

    expect(note.outlook).toBe('verified_intact');
    expect(note.tone).toBe('muted');
    expect(note.text).toContain('vervalt');
  });

  test('a meal nobody has checked says so, and offers the check rather than just reporting the gap', () => {
    const note = describeRecipeEditAllergens({
      storedStatus: 'unknown',
      ingredientsChanged: false,
      recheckedOnScreen: false,
    });

    expect(note.outlook).toBe('unchecked');
    expect(note.text).toContain('niet op allergenen gecontroleerd');
    expect(note.text).toContain('hieronder');
  });

  test('editing an unchecked meal changes nothing — there is no verification to lose', () => {
    const note = describeRecipeEditAllergens({
      storedStatus: 'unknown',
      ingredientsChanged: true,
      recheckedOnScreen: false,
    });

    expect(note.outlook).toBe('unchecked');
  });
});

describe('describeRecipeEditAllergens — a confirmation on this screen retracts the warning', () => {
  test('re-tagging the edited list replaces the warning rather than sitting beside it', () => {
    const note = describeRecipeEditAllergens({
      storedStatus: 'verified',
      ingredientsChanged: true,
      recheckedOnScreen: true,
    });

    expect(note.outlook).toBe('rechecked');
    expect(note.tone).toBe('muted');
  });

  test('a confirmation on a meal nobody had ever checked also lands on rechecked, not on "niet gecontroleerd"', () => {
    const note = describeRecipeEditAllergens({
      storedStatus: 'unknown',
      ingredientsChanged: true,
      recheckedOnScreen: true,
    });

    // The screen must not contradict itself by calling a dish unchecked
    // while the person is looking at the tags they just confirmed on it.
    expect(note.outlook).toBe('rechecked');
  });

  test('the confirmation branch wins whatever the stored status and the edit were', () => {
    const outlooks = [true, false].flatMap((ingredientsChanged) =>
      (['verified', 'unknown'] as const).map(
        (storedStatus) =>
          describeRecipeEditAllergens({ storedStatus, ingredientsChanged, recheckedOnScreen: true }).outlook,
      ),
    );

    expect(new Set(outlooks)).toEqual(new Set(['rechecked']));
  });
});

describe('buildRecipeEditSaveErrorMessage', () => {
  test('carries the underlying reason through, so a person has something to act on', () => {
    expect(buildRecipeEditSaveErrorMessage(new Error('quota exceeded'))).toBe('Opslaan is mislukt: quota exceeded');
  });

  test('falls back to the plain sentence for an Error with a blank message', () => {
    expect(buildRecipeEditSaveErrorMessage(new Error('   '))).toBe('Opslaan is mislukt. Probeer het opnieuw.');
  });

  test('never renders "undefined" for a throw that was not an Error at all', () => {
    const message = buildRecipeEditSaveErrorMessage('iets raars');

    expect(message).toBe('Opslaan is mislukt. Probeer het opnieuw.');
    expect(message).not.toContain('undefined');
  });
});

describe('the copy as a whole', () => {
  /**
   * PD-006's closing rule, asserted across the module rather than sentence
   * by sentence: this app states whether a human CHECKED a dish, never
   * whether it is safe for anybody. "veilig" is the word that would turn an
   * exclusion into a guarantee we cannot honour.
   */
  test('no allergen sentence ever claims safety', () => {
    for (const note of RECIPE_EDIT_ALLERGEN_NOTES) {
      expect(note.text.toLowerCase()).not.toContain('veilig');
      expect(note.text.toLowerCase()).not.toContain('geschikt voor');
    }
  });

  test('every allergen sentence is about checking, which is the fact we actually hold', () => {
    for (const note of RECIPE_EDIT_ALLERGEN_NOTES) {
      expect(note.text.toLowerCase()).toContain('gecontroleerd');
    }
  });

  test('the outlook on every note matches the key it is filed under, so a branch cannot return the wrong sentence', () => {
    const outlooks = RECIPE_EDIT_ALLERGEN_NOTES.map((note) => note.outlook);

    expect(new Set(outlooks).size).toBe(RECIPE_EDIT_ALLERGEN_NOTES.length);
  });

  test('nothing user-facing is blank, which is how a missing constant would otherwise ship', () => {
    const strings = [
      RECIPE_EDIT_HEADING,
      RECIPE_EDIT_SUBTITLE,
      RECIPE_EDIT_SAVE_BLOCKED_HINT,
      RECIPE_EDIT_ROW_LABEL,
      RECIPE_EDIT_ROW_EXPLAINER,
      ...RECIPE_EDIT_ALLERGEN_NOTES.map((note) => note.text),
    ];

    for (const value of strings) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  test('the sheet row is a verb, matching Sturen / Verwijderen beside it', () => {
    expect(RECIPE_EDIT_ROW_LABEL).toBe('Aanpassen');
  });
});

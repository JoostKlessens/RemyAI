/**
 * PD-006's edit rule, unit-tested where it is decided.
 *
 * WHY IT IS TESTED HERE AND AGAIN AT THE REPOSITORY. These assertions pin
 * the RULE — what "the list changed" means, which move is fail-closed,
 * which branch may promote. tests/repository/mealRecipeEdit.test.ts pins
 * that the repository actually applies it, against the STORED list, so a
 * caller cannot route around it. Neither file covers the other's failure:
 * a correct rule nobody calls and a called rule that is wrong are both
 * shipped bugs, and only one of them looks like one in a diff.
 *
 * THE SHAPE OF THE TABLE BELOW. Every case is stated as what a person did
 * ("fixed the title", "swapped an ingredient", "re-tagged the new list")
 * rather than as an input permutation, because the rule is about acts and
 * the acts are what a future reader has to weigh when they are tempted to
 * relax it.
 */

import { describe, expect, test } from 'vitest';
import {
  NOT_RECHECKED,
  haveIngredientsChanged,
  recheckedAllergens,
  resolveAllergenStateAfterEdit,
  type ComparableIngredient,
  type MealAllergenState,
} from '@/domain/mealAllergenReverification';

const KIPFILET: ComparableIngredient = { name: 'kipfilet', quantity: '400', unit: 'g' };
const CITROEN: ComparableIngredient = { name: 'citroen', quantity: '1', unit: null };
const PINDAKAAS: ComparableIngredient = { name: 'pindakaas', quantity: '2', unit: 'el' };

const VERIFIED_WITH_NUTS: MealAllergenState = { ingredientTags: ['noten'], allergenTagStatus: 'verified' };
const UNKNOWN_UNTAGGED: MealAllergenState = { ingredientTags: [], allergenTagStatus: 'unknown' };

describe('haveIngredientsChanged — is this still the list somebody checked?', () => {
  test('an identical list is unchanged', () => {
    expect(haveIngredientsChanged([KIPFILET, CITROEN], [KIPFILET, CITROEN])).toBe(false);
  });

  test('a renamed ingredient is a change', () => {
    expect(haveIngredientsChanged([KIPFILET], [{ ...KIPFILET, name: 'kalkoenfilet' }])).toBe(true);
  });

  test('a changed quantity is a change — this module refuses to rule that "only the amount moved"', () => {
    expect(haveIngredientsChanged([KIPFILET], [{ ...KIPFILET, quantity: '600' }])).toBe(true);
  });

  test('a changed unit is a change', () => {
    expect(haveIngredientsChanged([KIPFILET], [{ ...KIPFILET, unit: 'kg' }])).toBe(true);
  });

  test('a unit that arrives where there was none is a change, and not silently the same', () => {
    expect(haveIngredientsChanged([CITROEN], [{ ...CITROEN, unit: 'stuk' }])).toBe(true);
  });

  test('an added ingredient is a change', () => {
    expect(haveIngredientsChanged([KIPFILET], [KIPFILET, PINDAKAAS])).toBe(true);
  });

  test('a removed ingredient is a change — a shorter list is a different list', () => {
    expect(haveIngredientsChanged([KIPFILET, CITROEN], [KIPFILET])).toBe(true);
  });

  test('a reorder counts as a change, because deciding it does not would be a judgement about food', () => {
    expect(haveIngredientsChanged([KIPFILET, CITROEN], [CITROEN, KIPFILET])).toBe(true);
  });

  test('an invisible trailing space is NOT a change — the save path already trims, and nobody can see it', () => {
    expect(haveIngredientsChanged([KIPFILET], [{ name: 'kipfilet ', quantity: ' 400', unit: 'g ' }])).toBe(false);
  });

  test('internal whitespace that survives trimming IS a change — that is a different stored name', () => {
    expect(haveIngredientsChanged([KIPFILET], [{ ...KIPFILET, name: 'kip  filet' }])).toBe(true);
  });

  test('two empty lists are unchanged, which is the manual-entry case and a real answer', () => {
    expect(haveIngredientsChanged([], [])).toBe(false);
  });

  test('emptying a list is a change', () => {
    expect(haveIngredientsChanged([KIPFILET], [])).toBe(true);
  });

  test('neither input is mutated or reordered by the comparison', () => {
    const before = [KIPFILET, CITROEN];
    const after = [CITROEN, KIPFILET];

    haveIngredientsChanged(before, after);

    expect(before).toEqual([KIPFILET, CITROEN]);
    expect(after).toEqual([CITROEN, KIPFILET]);
  });
});

describe('resolveAllergenStateAfterEdit — nobody re-checked the list', () => {
  test('a verified meal whose ingredients changed is DEMOTED to unknown', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: VERIFIED_WITH_NUTS,
      storedIngredients: [KIPFILET],
      editedIngredients: [PINDAKAAS],
      check: NOT_RECHECKED,
    });

    expect(resolved.allergenTagStatus).toBe('unknown');
  });

  test('that demotion KEEPS the existing tags — a tag is an exclusion, and losing one is the dangerous direction', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: VERIFIED_WITH_NUTS,
      storedIngredients: [KIPFILET],
      editedIngredients: [PINDAKAAS],
      check: NOT_RECHECKED,
    });

    expect(resolved.ingredientTags).toEqual(['noten']);
  });

  test('a verified meal whose ingredients did NOT change stays verified — a title fix is not an ingredient change', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: VERIFIED_WITH_NUTS,
      storedIngredients: [KIPFILET, CITROEN],
      editedIngredients: [KIPFILET, CITROEN],
      check: NOT_RECHECKED,
    });

    expect(resolved).toEqual(VERIFIED_WITH_NUTS);
  });

  test('an unknown meal is never promoted by an edit, however much of it moved', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: UNKNOWN_UNTAGGED,
      storedIngredients: [KIPFILET],
      editedIngredients: [KIPFILET],
      check: NOT_RECHECKED,
    });

    expect(resolved.allergenTagStatus).toBe('unknown');
  });

  test('an unknown meal that already carries tags keeps them — the exclusions stand whatever the status says', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: { ingredientTags: ['noten'], allergenTagStatus: 'unknown' },
      storedIngredients: [KIPFILET],
      editedIngredients: [PINDAKAAS],
      check: NOT_RECHECKED,
    });

    expect(resolved).toEqual({ ingredientTags: ['noten'], allergenTagStatus: 'unknown' });
  });
});

describe('resolveAllergenStateAfterEdit — a human tagged the edited list', () => {
  test('re-checking earns verified back, which is the only way out of a demotion', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: { ingredientTags: ['noten'], allergenTagStatus: 'unknown' },
      storedIngredients: [KIPFILET],
      editedIngredients: [PINDAKAAS],
      check: recheckedAllergens(['pinda']),
    });

    expect(resolved).toEqual({ ingredientTags: ['pinda'], allergenTagStatus: 'verified' });
  });

  test('confirming ZERO tags is a real answer and still earns verified, PD-006.1 style', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: VERIFIED_WITH_NUTS,
      storedIngredients: [KIPFILET],
      editedIngredients: [KIPFILET],
      check: recheckedAllergens([]),
    });

    expect(resolved).toEqual({ ingredientTags: [], allergenTagStatus: 'verified' });
  });

  test('only a human check may drop a tag — this is the branch that can widen eligibility, and it is explicit', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: VERIFIED_WITH_NUTS,
      storedIngredients: [PINDAKAAS],
      editedIngredients: [KIPFILET],
      check: recheckedAllergens(['gluten']),
    });

    expect(resolved.ingredientTags).toEqual(['gluten']);
  });

  test('confirmed tags are normalised, so a household restriction can match them with Set.has()', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: UNKNOWN_UNTAGGED,
      storedIngredients: [],
      editedIngredients: [],
      check: recheckedAllergens(['  Noten ', 'SELDERIJ']),
    });

    expect(resolved.ingredientTags).toEqual(['noten', 'selderij']);
  });

  test('two spellings of one tag collapse to one — deduplication can only shorten a list, never weaken it', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: UNKNOWN_UNTAGGED,
      storedIngredients: [],
      editedIngredients: [],
      check: recheckedAllergens(['noten', 'Noten', ' noten ']),
    });

    expect(resolved.ingredientTags).toEqual(['noten']);
  });

  test('a blank tag is dropped rather than stored, because no restriction could ever match it', () => {
    const resolved = resolveAllergenStateAfterEdit({
      stored: UNKNOWN_UNTAGGED,
      storedIngredients: [],
      editedIngredients: [],
      check: recheckedAllergens(['', '   ', 'melk']),
    });

    expect(resolved.ingredientTags).toEqual(['melk']);
  });

  test('the caller tag array is never mutated or sorted in place', () => {
    const tags = ['SELDERIJ', 'noten'];

    resolveAllergenStateAfterEdit({
      stored: UNKNOWN_UNTAGGED,
      storedIngredients: [],
      editedIngredients: [],
      check: recheckedAllergens(tags),
    });

    expect(tags).toEqual(['SELDERIJ', 'noten']);
  });
});

describe('the check cannot be produced by copying a status off a row', () => {
  /**
   * The type-level guarantee stated as a runtime fact: `NOT_RECHECKED` and
   * `recheckedAllergens` are the only two ways to build a
   * `MealAllergenCheck`, and neither is a string a caller could get out of
   * `meal.allergenTagStatus`. This is what stops the "spread the old row
   * forward" bug that the module header is about.
   */
  test('the fail-closed default is a distinct value, not the string "unknown"', () => {
    expect(NOT_RECHECKED).toEqual({ kind: 'not_rechecked' });
    expect(String(NOT_RECHECKED)).not.toBe('unknown');
  });

  test('a check has to name the tags it is standing behind', () => {
    expect(recheckedAllergens(['noten'])).toEqual({ kind: 'rechecked', tags: ['noten'] });
  });
});

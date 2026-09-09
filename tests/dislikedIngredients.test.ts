/**
 * GAP-34 — the dislike path over INGREDIENT NAMES.
 *
 * Until this module existed a typed dislike was compared against
 * `Meal.ingredientTags`, which holds EU-14 allergen tags and nothing else, so
 * `paddenstoelen` — the app's own placeholder example — never excluded a
 * single dish. These tests pin the rule that replaced that: whole words,
 * never substrings; unknown fails toward NOT excluding; and a dislike that
 * names a KIND of food (`vis`, `vlees`) reaches every ingredient of that
 * kind through `categorizeIngredient`.
 */

import { describe, expect, test } from 'vitest';
import {
  collectDislikeTerms,
  groupIngredientsByMeal,
  hasDislikedIngredient,
  matchesDislikeTerm,
} from '@/domain/dislikedIngredients';
import { makeMealIngredient, makeMember, makeRestriction } from './fixtures';

const MEMBERS = [makeMember({ id: 'member-1' })];

describe('collectDislikeTerms', () => {
  test('collects only dislike-type restrictions — an allergen never becomes a name-matched term', () => {
    const restrictions = [
      makeRestriction({ id: 'r-1', memberId: 'member-1', type: 'dislike', excludesTag: 'paddenstoelen' }),
      makeRestriction({ id: 'r-2', memberId: 'member-1', type: 'allergen', excludesTag: 'noten' }),
    ];

    expect(collectDislikeTerms(MEMBERS, restrictions)).toEqual([['paddenstoelen']]);
  });

  test('ignores a dislike from a member outside the household', () => {
    const restrictions = [makeRestriction({ memberId: 'stranger', type: 'dislike', excludesTag: 'paddenstoelen' })];

    expect(collectDislikeTerms(MEMBERS, restrictions)).toEqual([]);
  });

  test('normalizes case and diacritics and splits a multi-word dislike into whole words', () => {
    const restrictions = [
      makeRestriction({ id: 'r-1', memberId: 'member-1', type: 'dislike', excludesTag: 'Rode Kool' }),
      makeRestriction({ id: 'r-2', memberId: 'member-1', type: 'dislike', excludesTag: 'Crème fraîche' }),
    ];

    expect(collectDislikeTerms(MEMBERS, restrictions)).toEqual([
      ['rode', 'kool'],
      ['creme', 'fraiche'],
    ]);
  });

  test('reads a dislike like an ingredient line: a note after the first comma is dropped', () => {
    const restrictions = [
      makeRestriction({ memberId: 'member-1', type: 'dislike', excludesTag: 'paddenstoelen, alle soorten' }),
    ];

    expect(collectDislikeTerms(MEMBERS, restrictions)).toEqual([['paddenstoelen']]);
  });

  test('drops a dislike that normalizes to nothing, and digit-only or single-letter words', () => {
    const restrictions = [
      makeRestriction({ id: 'r-1', memberId: 'member-1', type: 'dislike', excludesTag: '   ' }),
      makeRestriction({ id: 'r-2', memberId: 'member-1', type: 'dislike', excludesTag: '2 g' }),
      makeRestriction({ id: 'r-3', memberId: 'member-1', type: 'dislike', excludesTag: 'g paddenstoelen' }),
    ];

    expect(collectDislikeTerms(MEMBERS, restrictions)).toEqual([['paddenstoelen']]);
  });
});

describe('matchesDislikeTerm — whole words, never substrings', () => {
  test("the owner's case: `paddenstoelen` matches an ingredient line that carries a quantity", () => {
    expect(matchesDislikeTerm('250 g paddenstoelen', ['paddenstoelen'])).toBe(true);
  });

  test('matches through a preparation note and regardless of case or diacritics', () => {
    expect(matchesDislikeTerm('Paddenstoelen, in plakjes', ['paddenstoelen'])).toBe(true);
    expect(matchesDislikeTerm('Crème fraîche', ['creme', 'fraiche'])).toBe(true);
  });

  test('`boter` does not match `boterhamworst`, and `water` does not match `waterkers`', () => {
    expect(matchesDislikeTerm('4 plakken boterhamworst', ['boter'])).toBe(false);
    expect(matchesDislikeTerm('waterkers', ['water'])).toBe(false);
  });

  test('a multi-word dislike needs every one of its words', () => {
    expect(matchesDislikeTerm('1 rode kool', ['rode', 'kool'])).toBe(true);
    expect(matchesDislikeTerm('1 kool', ['rode', 'kool'])).toBe(false);
    expect(matchesDislikeTerm('1 rode paprika', ['rode', 'kool'])).toBe(false);
  });

  test('an unknown word fails toward NOT excluding — there is no synonym table, and a plural is its own word', () => {
    expect(matchesDislikeTerm('250 g champignons', ['paddenstoelen'])).toBe(false);
    expect(matchesDislikeTerm('1 paddenstoel', ['paddenstoelen'])).toBe(false);
  });
});

describe('matchesDislikeTerm — a dislike that names a KIND reaches every ingredient of that kind', () => {
  test('`vis` excludes zalmfilet, which never contains the word vis', () => {
    expect(matchesDislikeTerm('400 g zalmfilet', ['vis'])).toBe(true);
  });

  test('`vlees` reaches boterhamworst by its own line in the table — still never by substring', () => {
    expect(matchesDislikeTerm('boterhamworst', ['vlees'])).toBe(true);
    expect(matchesDislikeTerm('boterhamworst', ['boter'])).toBe(false);
  });

  test('`paddenstoelen` is not a kind, so it does not reach champignons through their shared category', () => {
    expect(matchesDislikeTerm('champignons', ['paddenstoelen'])).toBe(false);
  });

  test('a kind name only expands when it is the whole dislike', () => {
    expect(matchesDislikeTerm('400 g zalmfilet', ['verse', 'vis'])).toBe(false);
  });

  test('an ingredient the table has never been taught is not excluded by a kind', () => {
    expect(matchesDislikeTerm('xyzfood', ['vis'])).toBe(false);
  });
});

describe('hasDislikedIngredient', () => {
  test('true when any ingredient matches any term', () => {
    const ingredients = [
      makeMealIngredient({ id: 'i-1', name: '400 g kipfilet', sortOrder: 0 }),
      makeMealIngredient({ id: 'i-2', name: '250 g paddenstoelen', sortOrder: 1 }),
    ];

    expect(hasDislikedIngredient(ingredients, [['noten'], ['paddenstoelen']])).toBe(true);
  });

  test('false when nothing matches, when there are no terms, or when the meal has no ingredient rows at all', () => {
    const ingredients = [makeMealIngredient({ name: '400 g kipfilet' })];

    expect(hasDislikedIngredient(ingredients, [['paddenstoelen']])).toBe(false);
    expect(hasDislikedIngredient(ingredients, [])).toBe(false);
    expect(hasDislikedIngredient([], [['kipfilet']])).toBe(false);
  });
});

describe('groupIngredientsByMeal', () => {
  test('groups rows by meal id, and a meal with no rows has no entry', () => {
    const rows = [
      makeMealIngredient({ id: 'i-1', mealId: 'meal-1', name: 'ui' }),
      makeMealIngredient({ id: 'i-2', mealId: 'meal-2', name: 'kipfilet' }),
      makeMealIngredient({ id: 'i-3', mealId: 'meal-1', name: 'paddenstoelen' }),
    ];

    const grouped = groupIngredientsByMeal(rows);

    expect(grouped.get('meal-1')?.map((row) => row.name)).toEqual(['ui', 'paddenstoelen']);
    expect(grouped.get('meal-2')?.map((row) => row.name)).toEqual(['kipfilet']);
    expect(grouped.get('meal-3')).toBeUndefined();
  });

  test('does not mutate its input', () => {
    const rows = [makeMealIngredient({ id: 'i-1', mealId: 'meal-1' })];
    const snapshot = [...rows];

    groupIngredientsByMeal(rows);

    expect(rows).toEqual(snapshot);
  });
});

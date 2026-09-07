/**
 * The course a dish takes in a meal — the THIRD taxonomy on a `Meal`, and
 * these tests exist mostly to keep it distinguishable from the other two.
 *
 * tests/dishTags.test.ts asserts that dish categories share no value with
 * the EU allergens; tests/dishMoods.test.ts extends that to three
 * vocabularies. This file makes it four, and adds the assertion the other
 * two cannot make about themselves: a course is SINGLE-VALUED and has a
 * DEFAULT, where a tag and a mood are sets whose empty state means "nobody
 * has said anything yet". That difference is the whole reason this is not
 * a fourth entry in `DISH_TAGS`.
 */

import { describe, expect, test } from 'vitest';
import { EU_ALLERGENS } from '@/domain/allergens';
import { DISH_MOODS } from '@/domain/dishMoods';
import { DISH_TAGS } from '@/domain/dishTags';
import {
  DEFAULT_DISH_COURSE,
  DISH_COURSES,
  DISH_COURSE_VALUES,
  isDishCourse,
  readMealDishCourse,
  sanitizeDishCourse,
} from '@/domain/dishCourses';
import { normalizeTag } from '@/domain/normalizeTag';
import type { Meal } from '@/domain/types';

function makeMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    householdId: 'household-1',
    title: 'Pasta pesto',
    source: 'saved',
    estimatedMinutes: 20,
    skillLevel: null,
    servings: 2,
    ingredientTags: [],
    dishTags: [],
    sourceUrl: null,
    sourcePlatform: null,
    thumbnailUrl: null,
    archivedAt: null,
    createdAt: '2026-09-06T18:00:00.000Z',
    ...overrides,
  };
}

describe('the vocabulary', () => {
  test('is exactly the owner’s four courses', () => {
    expect(DISH_COURSES.map((entry) => entry.course)).toEqual([
      'voorgerecht',
      'hoofdgerecht',
      'bijgerecht',
      'toetje',
    ]);
  });

  test('defaults to hoofdgerecht, and the default is itself a member', () => {
    expect(DEFAULT_DISH_COURSE).toBe('hoofdgerecht');
    expect(DISH_COURSE_VALUES.has(DEFAULT_DISH_COURSE)).toBe(true);
  });

  test('every value is already normalizeTag-clean, so a stored value compares directly', () => {
    for (const entry of DISH_COURSES) {
      expect(normalizeTag(entry.course)).toBe(entry.course);
    }
  });

  test('every course has a distinct, non-empty Dutch label', () => {
    const labels = DISH_COURSES.map((entry) => entry.label);
    for (const label of labels) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  test('the value set matches the list it is built from', () => {
    expect(DISH_COURSE_VALUES.size).toBe(DISH_COURSES.length);
  });
});

describe('the three taxonomies stay apart', () => {
  test('no course is also a dish tag', () => {
    const tags = new Set(DISH_TAGS.map((entry) => entry.tag));
    for (const entry of DISH_COURSES) {
      expect(tags.has(entry.course)).toBe(false);
    }
  });

  test('no course is also a dish mood', () => {
    const moods = new Set(DISH_MOODS.map((entry) => entry.mood));
    for (const entry of DISH_COURSES) {
      expect(moods.has(entry.course)).toBe(false);
    }
  });

  test('no course is also an EU allergen — the PD-006 boundary, extended one vocabulary further', () => {
    const allergens = new Set(EU_ALLERGENS.map((entry) => entry.tag));
    for (const entry of DISH_COURSES) {
      expect(allergens.has(entry.course)).toBe(false);
    }
  });
});

describe('isDishCourse', () => {
  test('accepts every member', () => {
    for (const entry of DISH_COURSES) {
      expect(isDishCourse(entry.course)).toBe(true);
    }
  });

  test('rejects a value outside the vocabulary', () => {
    expect(isDishCourse('nagerecht')).toBe(false);
    expect(isDishCourse('pasta')).toBe(false);
    expect(isDishCourse('')).toBe(false);
  });

  test('does not normalize its argument, matching isDishTag and isDishMood', () => {
    expect(isDishCourse('Toetje')).toBe(false);
    expect(isDishCourse(' toetje ')).toBe(false);
  });
});

describe('sanitizeDishCourse', () => {
  test('normalizes an untrusted value onto the stored spelling', () => {
    expect(sanitizeDishCourse('Toetje', normalizeTag)).toBe('toetje');
    expect(sanitizeDishCourse('  BIJGERECHT ', normalizeTag)).toBe('bijgerecht');
  });

  test('falls back to the default rather than throwing or inventing a value', () => {
    expect(sanitizeDishCourse('dessert', normalizeTag)).toBe(DEFAULT_DISH_COURSE);
    expect(sanitizeDishCourse('', normalizeTag)).toBe(DEFAULT_DISH_COURSE);
  });

  test('leaves a value already in the vocabulary alone', () => {
    for (const entry of DISH_COURSES) {
      expect(sanitizeDishCourse(entry.course, normalizeTag)).toBe(entry.course);
    }
  });
});

describe('readMealDishCourse', () => {
  test('a meal that never said anything is a hoofdgerecht', () => {
    expect(readMealDishCourse(makeMeal())).toBe('hoofdgerecht');
    expect(readMealDishCourse(makeMeal({ dishCourse: undefined }))).toBe(DEFAULT_DISH_COURSE);
  });

  test('a meal that stated a course keeps it', () => {
    expect(readMealDishCourse(makeMeal({ dishCourse: 'toetje' }))).toBe('toetje');
    expect(readMealDishCourse(makeMeal({ dishCourse: 'voorgerecht' }))).toBe('voorgerecht');
  });

  test('a corrupt stored value reads as the default rather than escaping the vocabulary', () => {
    // A row hand-edited in storage, or written by a build that knew a
    // value this one does not. `toMealRow`'s `Array.isArray` repair in
    // local/meals.ts is the same move applied to a different shape.
    const meal = makeMeal({ dishCourse: 'nagerecht' as never });
    expect(readMealDishCourse(meal)).toBe(DEFAULT_DISH_COURSE);
  });
});

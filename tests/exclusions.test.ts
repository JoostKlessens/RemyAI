import { describe, expect, test } from 'vitest';
import {
  collectExcludedTags,
  excludeAlreadyOffered,
  filterByRestrictionsAndTimeBudget,
  filterUnarchived,
} from '@/domain/exclusions';
import { makeHousehold, makeMeal, makeMember, makeRestriction } from './fixtures';

describe('collectExcludedTags', () => {
  test('combines tags across multiple household members', () => {
    const members = [makeMember({ id: 'member-1' }), makeMember({ id: 'member-2' })];
    const restrictions = [
      makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'peanuts' }),
      makeRestriction({ memberId: 'member-2', type: 'dislike', excludesTag: 'mushrooms' }),
    ];

    const excludedTags = collectExcludedTags(members, restrictions);

    expect(excludedTags.has('peanuts')).toBe(true);
    expect(excludedTags.has('mushrooms')).toBe(true);
  });

  test('ignores a restriction referencing a member outside the household', () => {
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'stranger', excludesTag: 'gluten' })];

    const excludedTags = collectExcludedTags(members, restrictions);

    expect(excludedTags.has('gluten')).toBe(false);
  });
});

describe('filterUnarchived', () => {
  test('drops meals with a non-null archivedAt', () => {
    const meals = [
      makeMeal({ id: 'meal-active', archivedAt: null }),
      makeMeal({ id: 'meal-archived', archivedAt: '2026-01-01T00:00:00.000Z' }),
    ];

    const result = filterUnarchived(meals);

    expect(result.map((meal) => meal.id)).toEqual(['meal-active']);
  });

  test('does not mutate the input array', () => {
    const meals = [makeMeal({ id: 'meal-1', archivedAt: '2026-01-01T00:00:00.000Z' })];
    const originalLength = meals.length;

    filterUnarchived(meals);

    expect(meals).toHaveLength(originalLength);
  });
});

describe('filterByRestrictionsAndTimeBudget — allergen exclusion', () => {
  test('excludes meals containing an allergen tagged by any household member', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' }), makeMember({ id: 'member-2' })];
    const restrictions = [
      makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'shellfish' }),
    ];
    const meals = [
      makeMeal({ id: 'meal-safe', ingredientTags: ['chicken'] }),
      makeMeal({ id: 'meal-shellfish', ingredientTags: ['shellfish', 'rice'] }),
    ];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result.map((meal) => meal.id)).toEqual(['meal-safe']);
  });

  test('excludes a meal matching an allergen from a second member even when the first member has none', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' }), makeMember({ id: 'member-2' })];
    const restrictions = [
      makeRestriction({ memberId: 'member-2', type: 'allergen', excludesTag: 'peanuts' }),
    ];
    const meals = [makeMeal({ id: 'meal-peanut', ingredientTags: ['peanuts'] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result).toHaveLength(0);
  });

  test('a meal with no matching tag is not treated as "safe" beyond simply surviving the filter', () => {
    // Regression guard for the "exclusion only, never a safety claim" rule:
    // this only asserts the meal is not excluded, not that any positive
    // safety property has been established.
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', excludesTag: 'peanuts' })];
    const meals = [makeMeal({ id: 'meal-untagged', ingredientTags: [] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result.map((meal) => meal.id)).toEqual(['meal-untagged']);
  });
});

describe('filterByRestrictionsAndTimeBudget — dislike exclusion', () => {
  test('excludes meals containing a disliked ingredient tag', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [
      makeRestriction({ memberId: 'member-1', type: 'dislike', excludesTag: 'mushrooms' }),
    ];
    const meals = [
      makeMeal({ id: 'meal-liked', ingredientTags: ['chicken'] }),
      makeMeal({ id: 'meal-disliked', ingredientTags: ['mushrooms'] }),
    ];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result.map((meal) => meal.id)).toEqual(['meal-liked']);
  });
});

describe('filterByRestrictionsAndTimeBudget — time budget exclusion', () => {
  test('excludes meals estimated to take longer than the household weeknight time budget', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const members = [makeMember()];
    const meals = [
      makeMeal({ id: 'meal-quick', estimatedMinutes: 25 }),
      makeMeal({ id: 'meal-slow', estimatedMinutes: 45 }),
    ];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, []);

    expect(result.map((meal) => meal.id)).toEqual(['meal-quick']);
  });

  test('includes a meal exactly at the time budget boundary', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meals = [makeMeal({ id: 'meal-boundary', estimatedMinutes: 30 })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, [makeMember()], []);

    expect(result.map((meal) => meal.id)).toEqual(['meal-boundary']);
  });

  test('does not exclude a meal with an unknown estimatedMinutes', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meals = [makeMeal({ id: 'meal-unknown-time', estimatedMinutes: null })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, [makeMember()], []);

    expect(result.map((meal) => meal.id)).toEqual(['meal-unknown-time']);
  });
});

describe('filterByRestrictionsAndTimeBudget — tag normalization (Finding 1b)', () => {
  test('a restriction tag matches a meal tag that differs only in case', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'Noten' })];
    const meals = [makeMeal({ id: 'meal-noten', ingredientTags: ['noten'] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result).toHaveLength(0);
  });

  test('a restriction tag matches a meal tag that differs only in diacritics', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'dislike', excludesTag: 'crème' })];
    const meals = [makeMeal({ id: 'meal-creme', ingredientTags: ['creme'] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result).toHaveLength(0);
  });

  test('collectExcludedTags normalizes every tag it collects', () => {
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', excludesTag: '  Pinda  ' })];

    const excludedTags = collectExcludedTags(members, restrictions);

    expect(excludedTags.has('pinda')).toBe(true);
    expect(excludedTags.has('  Pinda  ')).toBe(false);
  });
});

describe('filterByRestrictionsAndTimeBudget — PD-006 allergen tag tri-state gate', () => {
  test('a household with no allergen restriction is unaffected by an unknown allergenTagStatus', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'dislike', excludesTag: 'mushrooms' })];
    const meals = [makeMeal({ id: 'meal-unknown', allergenTagStatus: 'unknown', ingredientTags: [] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result.map((meal) => meal.id)).toEqual(['meal-unknown']);
  });

  test('a household with no restrictions at all is unaffected by an unknown allergenTagStatus', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const meals = [makeMeal({ id: 'meal-unknown', allergenTagStatus: 'unknown' })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, [makeMember()], []);

    expect(result.map((meal) => meal.id)).toEqual(['meal-unknown']);
  });

  test('a household WITH an allergen restriction excludes a meal with unknown allergenTagStatus, even with no matching tag', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'noten' })];
    const meals = [makeMeal({ id: 'meal-unknown', allergenTagStatus: 'unknown', ingredientTags: [] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result).toHaveLength(0);
  });

  test('a household WITH an allergen restriction still admits a verified meal with no matching tag', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'noten' })];
    const meals = [makeMeal({ id: 'meal-verified', allergenTagStatus: 'verified', ingredientTags: [] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result.map((meal) => meal.id)).toEqual(['meal-verified']);
  });

  test('a meal missing allergenTagStatus entirely defaults to unknown and is excluded for an allergen restriction', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'noten' })];
    // Simulates a Meal object built by code that predates this field —
    // undefined, not the fixture's 'verified' default.
    const mealWithoutStatus = makeMeal({ id: 'meal-legacy', allergenTagStatus: undefined });

    const result = filterByRestrictionsAndTimeBudget([mealWithoutStatus], household, members, restrictions);

    expect(result).toHaveLength(0);
  });

  test('a verified meal that DOES carry the matching allergen tag is still excluded by ordinary tag matching', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'noten' })];
    const meals = [makeMeal({ id: 'meal-verified-noten', allergenTagStatus: 'verified', ingredientTags: ['noten'] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result).toHaveLength(0);
  });

  test('only an allergen-type restriction triggers the gate, not a dislike-type one', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 60 });
    const members = [makeMember({ id: 'member-1' })];
    const restrictions = [makeRestriction({ memberId: 'member-1', type: 'dislike', excludesTag: 'paddenstoelen' })];
    const meals = [makeMeal({ id: 'meal-unknown', allergenTagStatus: 'unknown', ingredientTags: [] })];

    const result = filterByRestrictionsAndTimeBudget(meals, household, members, restrictions);

    expect(result.map((meal) => meal.id)).toEqual(['meal-unknown']);
  });
});

describe('excludeAlreadyOffered', () => {
  test('a swap never repeats a meal already offered today', () => {
    const meals = [
      makeMeal({ id: 'meal-1' }),
      makeMeal({ id: 'meal-2' }),
      makeMeal({ id: 'meal-3' }),
    ];

    const result = excludeAlreadyOffered(meals, ['meal-1', 'meal-2']);

    expect(result.map((meal) => meal.id)).toEqual(['meal-3']);
  });

  test('returns every meal unchanged when nothing has been offered yet', () => {
    const meals = [makeMeal({ id: 'meal-1' }), makeMeal({ id: 'meal-2' })];

    const result = excludeAlreadyOffered(meals, []);

    expect(result).toHaveLength(2);
  });
});

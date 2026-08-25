import { describe, expect, test } from 'vitest';
import {
  collectExcludedTags,
  excludeAlreadyOffered,
  filterByDecisionFilters,
  filterByRestrictionsAndTimeBudget,
  filterUnarchived,
  NO_DECISION_FILTERS,
} from '@/domain/exclusions';
import { makeDecisionFilters, makeHousehold, makeMeal, makeMember, makeRestriction } from './fixtures';

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

describe('filterByDecisionFilters — maxMinutes (PD-009)', () => {
  test('excludes a meal estimated to take longer than the cap the user set for tonight', () => {
    const meals = [
      makeMeal({ id: 'meal-quick', estimatedMinutes: 20 }),
      makeMeal({ id: 'meal-slow', estimatedMinutes: 45 }),
    ];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ maxMinutes: 30 }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-quick']);
  });

  test('includes a meal exactly at the cap — "max 30 minuten" still means 30 is fine', () => {
    const meals = [makeMeal({ id: 'meal-boundary', estimatedMinutes: 30 })];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ maxMinutes: 30 }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-boundary']);
  });

  test('a null maxMinutes applies no time filter at all', () => {
    const meals = [
      makeMeal({ id: 'meal-long', estimatedMinutes: 180 }),
      makeMeal({ id: 'meal-unknown-time', estimatedMinutes: null }),
    ];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ maxMinutes: null }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-long', 'meal-unknown-time']);
  });

  test('EXCLUDES a meal with an unknown estimatedMinutes — the deliberate inverse of the household time budget', () => {
    const meals = [makeMeal({ id: 'meal-unknown-time', estimatedMinutes: null })];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ maxMinutes: 30 }));

    expect(result).toHaveLength(0);
  });

  test('the same unknown-duration meal survives the household time budget — the two rules disagree on purpose', () => {
    // Pins the asymmetry from both sides in one place, so anyone "fixing"
    // the two into agreement is told which guarantee they broke. The
    // household budget is a standing background preference, so unknown
    // means "not disqualified" there; "ik heb vanavond 30 minuten" is a
    // statement about right now, and a meal whose duration nobody ever
    // recorded is not an honest answer to it.
    const meal = makeMeal({ id: 'meal-unknown-time', estimatedMinutes: null });
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });

    const budgetSurvivors = filterByRestrictionsAndTimeBudget([meal], household, [makeMember()], []);
    const filterSurvivors = filterByDecisionFilters([meal], makeDecisionFilters({ maxMinutes: 30 }));

    expect(budgetSurvivors.map((survivor) => survivor.id)).toEqual(['meal-unknown-time']);
    expect(filterSurvivors).toHaveLength(0);
  });
});

describe('filterByDecisionFilters — requiredDishTags (PD-009)', () => {
  test('an empty requiredDishTags applies no category filter', () => {
    const meals = [
      makeMeal({ id: 'meal-untagged', dishTags: [] }),
      makeMeal({ id: 'meal-pasta', dishTags: ['pasta'] }),
    ];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: [] }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-untagged', 'meal-pasta']);
  });

  test('keeps only meals carrying the requested category', () => {
    const meals = [
      makeMeal({ id: 'meal-pasta', dishTags: ['pasta'] }),
      makeMeal({ id: 'meal-soep', dishTags: ['soep'] }),
      makeMeal({ id: 'meal-untagged', dishTags: [] }),
    ];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: ['pasta'] }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-pasta']);
  });

  test('requires ALL listed tags, not any of them', () => {
    const meals = [
      makeMeal({ id: 'meal-veg-pasta', dishTags: ['pasta', 'vegetarisch'] }),
      makeMeal({ id: 'meal-meat-pasta', dishTags: ['pasta', 'rundvlees'] }),
      makeMeal({ id: 'meal-veg-soep', dishTags: ['soep', 'vegetarisch'] }),
    ];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: ['pasta', 'vegetarisch'] }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-veg-pasta']);
  });

  test('extra categories on the meal never disqualify it — the filter narrows, it does not match exactly', () => {
    const meals = [makeMeal({ id: 'meal-rich', dishTags: ['pasta', 'kip', 'ovenschotel'] })];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: ['pasta'] }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-rich']);
  });

  test('matches through normalizeTag, so a stray capitalized or padded value still compares', () => {
    const meals = [makeMeal({ id: 'meal-pasta', dishTags: ['pasta'] })];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: ['  Pasta '] }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-pasta']);
  });

  test('never reads ingredientTags — a dish category and an allergen tag are separate vocabularies', () => {
    // The other half of the guarantee dishTags.ts's header and
    // Meal.dishTags's doc comment both make: if this ever passed, an
    // allergen string would have become a category filter's input.
    const meals = [makeMeal({ id: 'meal-allergen-only', dishTags: [], ingredientTags: ['pasta'] })];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: ['pasta'] }));

    expect(result).toHaveLength(0);
  });

  test('does not mutate the input array', () => {
    const meals = [
      makeMeal({ id: 'meal-pasta', dishTags: ['pasta'] }),
      makeMeal({ id: 'meal-soep', dishTags: ['soep'] }),
    ];

    filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: ['pasta'] }));

    expect(meals.map((meal) => meal.id)).toEqual(['meal-pasta', 'meal-soep']);
  });
});

describe('filterByDecisionFilters — deliberately NOT folded into filterByRestrictionsAndTimeBudget (PD-006 boundary)', () => {
  test('carries no allergen exclusion of its own — a meal tagged with an allergen still passes here', () => {
    // Not an oversight: this function's single job is "narrow what the
    // user asked to narrow." The PD-006 allergen guarantee lives in
    // filterByRestrictionsAndTimeBudget and stays there, so nobody can
    // weaken it by editing a category filter. decide.ts runs both, in that
    // order.
    const meals = [makeMeal({ id: 'meal-noten', dishTags: ['pasta'], ingredientTags: ['noten'] })];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: ['pasta'] }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-noten']);
  });

  test('carries no PD-006 tri-state gate either — an unknown allergenTagStatus is untouched here', () => {
    const meals = [makeMeal({ id: 'meal-unknown-status', allergenTagStatus: 'unknown', dishTags: ['soep'] })];

    const result = filterByDecisionFilters(meals, makeDecisionFilters({ requiredDishTags: ['soep'] }));

    expect(result.map((meal) => meal.id)).toEqual(['meal-unknown-status']);
  });
});

describe('NO_DECISION_FILTERS (PD-009)', () => {
  test('is the identity: it removes nothing, whatever the meal looks like', () => {
    const meals = [
      makeMeal({ id: 'meal-untagged', dishTags: [], estimatedMinutes: null }),
      makeMeal({ id: 'meal-long', dishTags: ['stamppot'], estimatedMinutes: 240 }),
    ];

    const result = filterByDecisionFilters(meals, NO_DECISION_FILTERS);

    expect(result.map((meal) => meal.id)).toEqual(['meal-untagged', 'meal-long']);
  });
});

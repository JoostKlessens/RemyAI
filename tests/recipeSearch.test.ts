import { describe, expect, test } from 'vitest';
import {
  LIBRARY_QUICK_MAX_MINUTES,
  NO_LIBRARY_SEARCH,
  collectAvailableDishTags,
  filterLibraryMeals,
  filterLibraryRows,
  isLibrarySearchActive,
  matchesTitleQuery,
  type LibrarySearchState,
} from '@/domain/recipeSearch';
import { makeMeal } from './fixtures';

function search(overrides: Partial<LibrarySearchState> = {}): LibrarySearchState {
  return { ...NO_LIBRARY_SEARCH, ...overrides };
}

describe('matchesTitleQuery', () => {
  test('an empty query matches every title', () => {
    expect(matchesTitleQuery('Aardappelpuree', '')).toBe(true);
  });

  test('a whitespace-only query matches every title', () => {
    expect(matchesTitleQuery('Aardappelpuree', '   ')).toBe(true);
  });

  test('matches a substring case-insensitively', () => {
    expect(matchesTitleQuery('Aardappelpuree met worst', 'PUREE')).toBe(true);
  });

  test('is diacritic-tolerant both ways', () => {
    expect(matchesTitleQuery('Crème brûlée', 'creme brulee')).toBe(true);
    expect(matchesTitleQuery('Aardappelpuree', 'purée')).toBe(true);
  });

  test('does not match an unrelated title', () => {
    expect(matchesTitleQuery('Kip curry', 'pasta')).toBe(false);
  });
});

describe('filterLibraryMeals — title', () => {
  test('keeps only meals whose title matches the query', () => {
    const meals = [makeMeal({ id: 'm-1', title: 'Aardappelpuree' }), makeMeal({ id: 'm-2', title: 'Kip curry' })];
    const result = filterLibraryMeals(meals, search({ query: 'puree' }));
    expect(result.map((meal) => meal.id)).toEqual(['m-1']);
  });

  test('an empty search returns every meal, unfiltered', () => {
    const meals = [makeMeal({ id: 'm-1' }), makeMeal({ id: 'm-2' })];
    expect(filterLibraryMeals(meals, NO_LIBRARY_SEARCH)).toEqual(meals);
  });
});

describe('filterLibraryMeals — dishTags (AND) and dishMoods (OR), reused from filterByDecisionFilters', () => {
  test('requiredDishTags is AND — a meal must carry every selected tag', () => {
    const meals = [
      makeMeal({ id: 'm-both', dishTags: ['pasta', 'vegetarisch'] }),
      makeMeal({ id: 'm-one', dishTags: ['pasta'] }),
    ];
    const result = filterLibraryMeals(meals, search({ requiredDishTags: ['pasta', 'vegetarisch'] }));
    expect(result.map((meal) => meal.id)).toEqual(['m-both']);
  });

  test('anyDishMoods is OR — a meal matching any one selected mood is kept', () => {
    const meals = [
      makeMeal({ id: 'm-zomers', dishMoods: ['zomers'] }),
      makeMeal({ id: 'm-winters', dishMoods: ['winters'] }),
      makeMeal({ id: 'm-neither', dishMoods: ['soul-food'] }),
    ];
    const result = filterLibraryMeals(meals, search({ anyDishMoods: ['zomers', 'winters'] }));
    expect(result.map((meal) => meal.id).sort()).toEqual(['m-winters', 'm-zomers']);
  });
});

describe('filterLibraryMeals — quickOnly ("Snel")', () => {
  test('keeps only meals at or under the quick threshold when quickOnly is set', () => {
    const meals = [
      makeMeal({ id: 'm-quick', estimatedMinutes: LIBRARY_QUICK_MAX_MINUTES }),
      makeMeal({ id: 'm-slow', estimatedMinutes: LIBRARY_QUICK_MAX_MINUTES + 1 }),
    ];
    const result = filterLibraryMeals(meals, search({ quickOnly: true }));
    expect(result.map((meal) => meal.id)).toEqual(['m-quick']);
  });

  test('a meal with no recorded duration is excluded once quickOnly is explicitly requested', () => {
    const meals = [makeMeal({ id: 'm-unknown', estimatedMinutes: null })];
    expect(filterLibraryMeals(meals, search({ quickOnly: true }))).toEqual([]);
  });

  test('an unknown duration is NOT excluded when quickOnly is off', () => {
    const meals = [makeMeal({ id: 'm-unknown', estimatedMinutes: null })];
    expect(filterLibraryMeals(meals, NO_LIBRARY_SEARCH).map((meal) => meal.id)).toEqual(['m-unknown']);
  });
});

describe('filterLibraryMeals — composition', () => {
  test('title, dishTags, dishMoods and quickOnly all narrow together', () => {
    const meals = [
      makeMeal({
        id: 'm-match',
        title: 'Snelle pastasalade',
        dishTags: ['pasta', 'vegetarisch'],
        dishMoods: ['zomers'],
        estimatedMinutes: 15,
      }),
      makeMeal({
        id: 'm-wrong-title',
        title: 'Kip curry',
        dishTags: ['pasta', 'vegetarisch'],
        dishMoods: ['zomers'],
        estimatedMinutes: 15,
      }),
      makeMeal({
        id: 'm-too-slow',
        title: 'Trage pastasalade',
        dishTags: ['pasta', 'vegetarisch'],
        dishMoods: ['zomers'],
        estimatedMinutes: 45,
      }),
    ];
    const result = filterLibraryMeals(
      meals,
      search({ query: 'pasta', requiredDishTags: ['pasta', 'vegetarisch'], anyDishMoods: ['zomers'], quickOnly: true }),
    );
    expect(result.map((meal) => meal.id)).toEqual(['m-match']);
  });
});

describe('isLibrarySearchActive', () => {
  test('is false for the no-op identity', () => {
    expect(isLibrarySearchActive(NO_LIBRARY_SEARCH)).toBe(false);
  });

  test('is true when only the query is set', () => {
    expect(isLibrarySearchActive(search({ query: 'paella' }))).toBe(true);
  });

  test('is false for a whitespace-only query alone', () => {
    expect(isLibrarySearchActive(search({ query: '   ' }))).toBe(false);
  });

  test('is true when only a dish tag is selected', () => {
    expect(isLibrarySearchActive(search({ requiredDishTags: ['pasta'] }))).toBe(true);
  });

  test('is true when only a dish mood is selected', () => {
    expect(isLibrarySearchActive(search({ anyDishMoods: ['zomers'] }))).toBe(true);
  });

  test('is true when only quickOnly is set', () => {
    expect(isLibrarySearchActive(search({ quickOnly: true }))).toBe(true);
  });
});

interface FakeRow {
  readonly meal: ReturnType<typeof makeMeal>;
  readonly marker: string;
}

function makeRow(id: string, title: string, marker: string): FakeRow {
  return { meal: makeMeal({ id, title }), marker };
}

describe('filterLibraryRows', () => {
  test('returns the identical array reference when no search is active', () => {
    const rows = [makeRow('m-1', 'Aardappelpuree', 'a'), makeRow('m-2', 'Kip curry', 'b')];
    expect(filterLibraryRows(rows, NO_LIBRARY_SEARCH)).toBe(rows);
  });

  test('filters by the underlying meal while preserving row order and shape', () => {
    const rows = [
      makeRow('m-week', 'Aardappelpuree', 'deze-week'),
      makeRow('m-ooit', 'Kip curry', 'ooit'),
      makeRow('m-cooked', 'Andere puree', 'al-gekookt'),
    ];
    const result = filterLibraryRows(rows, search({ query: 'puree' }));
    expect(result.map((row) => row.marker)).toEqual(['deze-week', 'al-gekookt']);
  });

  test('preserves a pre-sorted order — filtering never reorders what survives', () => {
    // Simulates rows already sorted "deze week" first by sortMealsByScheduling.
    const rows = [
      makeRow('m-a', 'Zalm', 'deze-week'),
      makeRow('m-b', 'Zalm met broccoli', 'ooit'),
      makeRow('m-c', 'Zalmsoep', 'al-gekookt'),
    ];
    const result = filterLibraryRows(rows, search({ query: 'zalm' }));
    expect(result.map((row) => row.marker)).toEqual(['deze-week', 'ooit', 'al-gekookt']);
  });

  test('returns an empty array when nothing matches', () => {
    const rows = [makeRow('m-1', 'Aardappelpuree', 'a')];
    expect(filterLibraryRows(rows, search({ query: 'paella' }))).toEqual([]);
  });
});

describe('collectAvailableDishTags', () => {
  test('unions the tags across the pool', () => {
    const meals = [makeMeal({ id: 'm-1', dishTags: ['pasta'] }), makeMeal({ id: 'm-2', dishTags: ['soep', 'kip'] })];
    expect([...collectAvailableDishTags(meals)].sort()).toEqual(['kip', 'pasta', 'soep']);
  });

  test('de-duplicates a tag carried by more than one meal', () => {
    const meals = [makeMeal({ id: 'm-1', dishTags: ['pasta'] }), makeMeal({ id: 'm-2', dishTags: ['pasta'] })];
    expect(collectAvailableDishTags(meals)).toEqual(['pasta']);
  });

  test('is empty for a library with no categorized meals', () => {
    expect(collectAvailableDishTags([makeMeal(), makeMeal({ id: 'm-2' })])).toEqual([]);
  });
});

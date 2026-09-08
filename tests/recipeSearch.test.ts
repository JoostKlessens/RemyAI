import { describe, expect, test } from 'vitest';
import {
  LIBRARY_TIME_CAP_OPTIONS,
  NO_LIBRARY_SEARCH,
  collectAvailableDishCourses,
  collectAvailableDishTags,
  collectSelectableDishCourses,
  collectSelectableDishMoods,
  collectSelectableDishTags,
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

/** The caps a household can actually choose — `null` is the absence of a cap, not one of them. */
const EXPLICIT_CAPS = LIBRARY_TIME_CAP_OPTIONS.filter((option): option is number => option !== null);

describe('LIBRARY_TIME_CAP_OPTIONS', () => {
  test('offers "no cap" first, then DecisionFilterBar\'s own 20/30/45 steps', () => {
    expect(LIBRARY_TIME_CAP_OPTIONS).toEqual([null, 20, 30, 45]);
  });

  test('every cap is strictly narrower than the one before it, so no two chips can mean the same thing', () => {
    expect(EXPLICIT_CAPS).toEqual([...EXPLICIT_CAPS].sort((a, b) => a - b));
    expect(new Set(EXPLICIT_CAPS).size).toBe(EXPLICIT_CAPS.length);
  });
});

describe('filterLibraryMeals — maxMinutes (the time cap)', () => {
  test('keeps only meals at or under an explicit cap', () => {
    const meals = [makeMeal({ id: 'm-quick', estimatedMinutes: 20 }), makeMeal({ id: 'm-slow', estimatedMinutes: 21 })];
    const result = filterLibraryMeals(meals, search({ maxMinutes: 20 }));
    expect(result.map((meal) => meal.id)).toEqual(['m-quick']);
  });

  test('a wider cap keeps what a narrower one dropped — the whole reason the "Snel" boolean was replaced', () => {
    const meals = [makeMeal({ id: 'm-30', estimatedMinutes: 30 })];
    expect(filterLibraryMeals(meals, search({ maxMinutes: 20 }))).toEqual([]);
    expect(filterLibraryMeals(meals, search({ maxMinutes: 30 })).map((meal) => meal.id)).toEqual(['m-30']);
  });

  test('a meal with no recorded duration is excluded under EVERY explicit cap, not just the narrowest', () => {
    const meals = [makeMeal({ id: 'm-unknown', estimatedMinutes: null })];
    for (const cap of EXPLICIT_CAPS) {
      expect(filterLibraryMeals(meals, search({ maxMinutes: cap }))).toEqual([]);
    }
  });

  test('an unknown duration is NOT excluded when no cap is set', () => {
    const meals = [makeMeal({ id: 'm-unknown', estimatedMinutes: null })];
    expect(filterLibraryMeals(meals, NO_LIBRARY_SEARCH).map((meal) => meal.id)).toEqual(['m-unknown']);
  });
});

describe('filterLibraryMeals — composition', () => {
  test('title, dishTags, dishMoods and the time cap all narrow together', () => {
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
      search({ query: 'pasta', requiredDishTags: ['pasta', 'vegetarisch'], anyDishMoods: ['zomers'], maxMinutes: 20 }),
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

  test('is true when only a time cap is set', () => {
    expect(isLibrarySearchActive(search({ maxMinutes: 20 }))).toBe(true);
  });

  test('is false for a null time cap — the absence of a cap is not a filter', () => {
    expect(isLibrarySearchActive(search({ maxMinutes: null }))).toBe(false);
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

  /**
   * The widening this function got on 8 September 2026 so Trending could use
   * it instead of copying it (GAP-33 is about the copy that already exists).
   * Asserted with a row shape that is deliberately NOT a `Meal`: if the
   * constraint ever narrows back to `readonly Meal[]`, this stops compiling,
   * which is the failure mode worth having.
   */
  test('collects from any row carrying dishTags, not only from a Meal', () => {
    const boardRows = [
      { recipeId: 'recipe-1', dishTags: ['pasta', 'vegetarisch'] },
      { recipeId: 'recipe-2', dishTags: ['soep'] },
    ];
    expect([...collectAvailableDishTags(boardRows)].sort()).toEqual(['pasta', 'soep', 'vegetarisch']);
  });
});

// ---------------------------------------------------------------------------
// The course axis (LIB-05). `dishCourse` landed with migration 0017 and had
// no reader in the library; these tests pin the one property that makes it
// safe to filter on a column almost every stored row is missing.
// ---------------------------------------------------------------------------

describe('filterLibraryMeals — anyDishCourses', () => {
  test('is OR, not AND — a dish has exactly one course, so AND would be empty by construction', () => {
    const meals = [
      makeMeal({ id: 'm-voor', dishCourse: 'voorgerecht' }),
      makeMeal({ id: 'm-toetje', dishCourse: 'toetje' }),
      makeMeal({ id: 'm-bij', dishCourse: 'bijgerecht' }),
    ];
    const result = filterLibraryMeals(meals, search({ anyDishCourses: ['voorgerecht', 'toetje'] }));
    expect(result.map((meal) => meal.id)).toEqual(['m-voor', 'm-toetje']);
  });

  test('a meal that never stated a course IS a hoofdgerecht and survives that filter', () => {
    // The owner's rule, via `readMealDishCourse`: "standaard is iets een
    // hoofdgerecht". Every row written before 0017 is in this shape, so a
    // course filter that dropped them would empty the library for the one
    // value a household is most likely to pick first.
    const meals = [makeMeal({ id: 'm-untagged', dishCourse: undefined })];
    expect(filterLibraryMeals(meals, search({ anyDishCourses: ['hoofdgerecht'] })).map((meal) => meal.id)).toEqual([
      'm-untagged',
    ]);
  });

  test('a meal that never stated a course is NOT a toetje', () => {
    const meals = [makeMeal({ id: 'm-untagged', dishCourse: undefined })];
    expect(filterLibraryMeals(meals, search({ anyDishCourses: ['toetje'] }))).toEqual([]);
  });

  test('an unrecognised stored course reads as the default rather than vanishing from every filter', () => {
    const meals = [makeMeal({ id: 'm-broken', dishCourse: 'amuse' as never })];
    expect(filterLibraryMeals(meals, search({ anyDishCourses: ['hoofdgerecht'] })).map((meal) => meal.id)).toEqual([
      'm-broken',
    ]);
  });

  test('an empty course selection narrows nothing', () => {
    const meals = [makeMeal({ id: 'm-1', dishCourse: 'toetje' }), makeMeal({ id: 'm-2' })];
    expect(filterLibraryMeals(meals, search({ anyDishCourses: [] })).length).toBe(2);
  });
});

describe('collectAvailableDishCourses', () => {
  test('reads an absent course as the default, so an untagged library still offers "hoofdgerecht"', () => {
    expect(collectAvailableDishCourses([makeMeal({ id: 'm-1', dishCourse: undefined })])).toEqual(['hoofdgerecht']);
  });

  test('unions and de-duplicates across the pool', () => {
    const meals = [
      makeMeal({ id: 'm-1', dishCourse: 'toetje' }),
      makeMeal({ id: 'm-2', dishCourse: 'toetje' }),
      makeMeal({ id: 'm-3', dishCourse: 'voorgerecht' }),
    ];
    expect([...collectAvailableDishCourses(meals)].sort()).toEqual(['toetje', 'voorgerecht']);
  });

  test('is empty for an empty pool — the one case where no course is offered at all', () => {
    expect(collectAvailableDishCourses([])).toEqual([]);
  });
});

describe('isLibrarySearchActive — the two axes added with the 3-across grid', () => {
  test('is true when only a course is selected', () => {
    expect(isLibrarySearchActive(search({ anyDishCourses: ['toetje'] }))).toBe(true);
  });

  test('is true when only a scheduling state is selected', () => {
    expect(isLibrarySearchActive(search({ anySchedulingStates: ['deze_week'] }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Chip availability recomputed against the CURRENT selection — the defect
// this pass exists to close. `requiredDishTags` is ANDed, so a chip offered
// off the full pool is a control that returns zero the moment a first chip
// is chosen. Availability now runs against the rows that survive the other
// active filters.
// ---------------------------------------------------------------------------

describe('collectSelectableDishTags', () => {
  test('offers every tag in the library when nothing is selected', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-1', dishTags: ['pasta', 'vegetarisch'] }) },
      { meal: makeMeal({ id: 'm-2', dishTags: ['soep'] }) },
    ];
    expect([...collectSelectableDishTags(rows, NO_LIBRARY_SEARCH)].sort()).toEqual(['pasta', 'soep', 'vegetarisch']);
  });

  test('drops a tag that co-occurs with nothing currently selected — the AND dead end', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-pasta-veg', dishTags: ['pasta', 'vegetarisch'] }) },
      { meal: makeMeal({ id: 'm-soep', dishTags: ['soep'] }) },
    ];
    // With "pasta" chosen, "soep" would return zero rows: no meal carries both.
    expect([...collectSelectableDishTags(rows, search({ requiredDishTags: ['pasta'] }))].sort()).toEqual([
      'pasta',
      'vegetarisch',
    ]);
  });

  test('keeps a selected tag on offer even when it survives on no row at all', () => {
    // Nothing is both pasta and soep, so the grid is empty — and the two
    // chips a household would tap to escape must still be there to tap.
    const rows = [{ meal: makeMeal({ id: 'm-pasta', dishTags: ['pasta'] }) }];
    expect([...collectSelectableDishTags(rows, search({ requiredDishTags: ['pasta', 'soep'] }))].sort()).toEqual([
      'pasta',
      'soep',
    ]);
  });

  test('narrows against the OTHER axes too — a typed query removes tags it excluded', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-1', title: 'Pastasalade', dishTags: ['pasta'] }) },
      { meal: makeMeal({ id: 'm-2', title: 'Kippensoep', dishTags: ['soep'] }) },
    ];
    expect(collectSelectableDishTags(rows, search({ query: 'salade' }))).toEqual(['pasta']);
  });

  test('narrows against the time cap, which is the axis that hides most of a library at once', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-quick', dishTags: ['pasta'], estimatedMinutes: 15 }) },
      { meal: makeMeal({ id: 'm-slow', dishTags: ['stamppot'], estimatedMinutes: 90 }) },
    ];
    expect(collectSelectableDishTags(rows, search({ maxMinutes: 20 }))).toEqual(['pasta']);
  });
});

describe('collectSelectableDishMoods', () => {
  test('ignores its OWN selection, because moods are ORed and each extra chip widens the pool', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-zomers', dishMoods: ['zomers'] }) },
      { meal: makeMeal({ id: 'm-winters', dishMoods: ['winters'] }) },
    ];
    // With "zomers" chosen, "winters" still returns rows — it adds them.
    expect([...collectSelectableDishMoods(rows, search({ anyDishMoods: ['zomers'] }))].sort()).toEqual([
      'winters',
      'zomers',
    ]);
  });

  test('still narrows against the other axes', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-1', dishTags: ['pasta'], dishMoods: ['zomers'] }) },
      { meal: makeMeal({ id: 'm-2', dishTags: ['soep'], dishMoods: ['winters'] }) },
    ];
    expect(collectSelectableDishMoods(rows, search({ requiredDishTags: ['pasta'] }))).toEqual(['zomers']);
  });

  test('keeps a selected mood on offer even when the other axes leave it standing on nothing', () => {
    const rows = [{ meal: makeMeal({ id: 'm-1', dishTags: ['pasta'], dishMoods: ['zomers'] }) }];
    expect([...collectSelectableDishMoods(rows, search({ requiredDishTags: ['soep'], anyDishMoods: ['winters'] }))]).toEqual(
      ['winters'],
    );
  });
});

describe('collectSelectableDishCourses', () => {
  test('ignores its own selection, for the mood row\'s reason — the axis is ORed', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-1', dishCourse: 'toetje' }) },
      { meal: makeMeal({ id: 'm-2', dishCourse: 'voorgerecht' }) },
    ];
    expect([...collectSelectableDishCourses(rows, search({ anyDishCourses: ['toetje'] }))].sort()).toEqual([
      'toetje',
      'voorgerecht',
    ]);
  });

  test('narrows against the other axes', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-1', dishTags: ['pasta'], dishCourse: 'hoofdgerecht' }) },
      { meal: makeMeal({ id: 'm-2', dishTags: ['soep'], dishCourse: 'voorgerecht' }) },
    ];
    expect(collectSelectableDishCourses(rows, search({ requiredDishTags: ['soep'] }))).toEqual(['voorgerecht']);
  });
});

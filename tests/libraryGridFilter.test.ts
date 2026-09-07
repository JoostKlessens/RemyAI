import { describe, expect, test } from 'vitest';
import { NO_LIBRARY_SEARCH, type LibrarySearchState } from '@/domain/recipeSearch';
import {
  LIBRARY_SCHEDULING_STATES,
  collectSelectableSchedulingStates,
  filterLibraryGrid,
  filterRowsBySchedulingStates,
} from '@/components/libraryGridFilter';
import type { RecipeSchedulingState, ScheduledMealRow } from '@/components/recipeScheduling';
import { makeMeal } from './fixtures';

function search(overrides: Partial<LibrarySearchState> = {}): LibrarySearchState {
  return { ...NO_LIBRARY_SEARCH, ...overrides };
}

function makeRow(
  id: string,
  state: RecipeSchedulingState,
  mealOverrides: Partial<Parameters<typeof makeMeal>[0]> = {},
): ScheduledMealRow {
  return {
    meal: makeMeal({ id, ...mealOverrides }),
    scheduling: { state, lastCookedOn: state === 'al_gekookt' ? '2026-09-01' : null },
  };
}

describe('LIBRARY_SCHEDULING_STATES', () => {
  test('is every state a tile can draw, in the order the grid already sorts them', () => {
    expect(LIBRARY_SCHEDULING_STATES).toEqual(['deze_week', 'ooit', 'geen_planning', 'al_gekookt']);
  });
});

describe('filterRowsBySchedulingStates', () => {
  test('an empty selection narrows nothing and hands back the identical array', () => {
    const rows = [makeRow('m-1', 'deze_week'), makeRow('m-2', 'ooit')];
    expect(filterRowsBySchedulingStates(rows, [])).toBe(rows);
  });

  test('keeps only the selected states', () => {
    const rows = [makeRow('m-week', 'deze_week'), makeRow('m-ooit', 'ooit'), makeRow('m-done', 'al_gekookt')];
    const result = filterRowsBySchedulingStates(rows, ['deze_week', 'al_gekookt']);
    expect(result.map((row) => row.meal.id)).toEqual(['m-week', 'm-done']);
  });

  test('is OR across states — a row has exactly one, so AND would be empty by construction', () => {
    const rows = [makeRow('m-week', 'deze_week')];
    expect(filterRowsBySchedulingStates(rows, ['deze_week', 'ooit']).map((row) => row.meal.id)).toEqual(['m-week']);
  });

  test('preserves the pre-sorted order — filtering never reorders what survives', () => {
    const rows = [makeRow('m-a', 'deze_week'), makeRow('m-b', 'geen_planning'), makeRow('m-c', 'deze_week')];
    const result = filterRowsBySchedulingStates(rows, ['deze_week']);
    expect(result.map((row) => row.meal.id)).toEqual(['m-a', 'm-c']);
  });

  test('"geen planning" is a state you can ask for, not the absence of one', () => {
    const rows = [makeRow('m-none', 'geen_planning'), makeRow('m-week', 'deze_week')];
    expect(filterRowsBySchedulingStates(rows, ['geen_planning']).map((row) => row.meal.id)).toEqual(['m-none']);
  });
});

describe('collectSelectableSchedulingStates', () => {
  test('offers only the states actually present, in canonical order', () => {
    const rows = [makeRow('m-done', 'al_gekookt'), makeRow('m-week', 'deze_week')];
    expect(collectSelectableSchedulingStates(rows, NO_LIBRARY_SEARCH)).toEqual(['deze_week', 'al_gekookt']);
  });

  test('keeps a selected state on offer even when nothing carries it any more', () => {
    // The whole point: this is the chip that undoes an empty grid.
    const rows = [makeRow('m-week', 'deze_week')];
    expect(collectSelectableSchedulingStates(rows, search({ anySchedulingStates: ['al_gekookt'] }))).toEqual([
      'deze_week',
      'al_gekookt',
    ]);
  });

  test('ignores its own selection when narrowing, because the axis is ORed', () => {
    const rows = [makeRow('m-week', 'deze_week'), makeRow('m-ooit', 'ooit')];
    expect(collectSelectableSchedulingStates(rows, search({ anySchedulingStates: ['deze_week'] }))).toEqual([
      'deze_week',
      'ooit',
    ]);
  });

  test('narrows against the meal-level axes — a typed query removes the states it excluded', () => {
    const rows = [
      makeRow('m-week', 'deze_week', { title: 'Pastasalade' }),
      makeRow('m-ooit', 'ooit', { title: 'Kippensoep' }),
    ];
    expect(collectSelectableSchedulingStates(rows, search({ query: 'pasta' }))).toEqual(['deze_week']);
  });
});

describe('filterLibraryGrid', () => {
  test('applies the meal axes and the scheduling axis together', () => {
    const rows = [
      makeRow('m-1', 'deze_week', { title: 'Pastasalade', dishTags: ['pasta'] }),
      makeRow('m-2', 'ooit', { title: 'Pasta pesto', dishTags: ['pasta'] }),
      makeRow('m-3', 'deze_week', { title: 'Kippensoep', dishTags: ['soep'] }),
    ];
    const view = filterLibraryGrid(rows, search({ requiredDishTags: ['pasta'], anySchedulingStates: ['deze_week'] }));
    expect(view.rows.map((row) => row.meal.id)).toEqual(['m-1']);
  });

  test('hands back the identical rows array when no search is active', () => {
    const rows = [makeRow('m-1', 'deze_week'), makeRow('m-2', 'ooit')];
    expect(filterLibraryGrid(rows, NO_LIBRARY_SEARCH).rows).toBe(rows);
  });

  test('the chips it offers are narrowed by the scheduling filter, which the domain layer cannot see', () => {
    // This is the composition that only exists here: `collectSelectableDishTags`
    // is handed rows the scheduling axis has already thinned.
    const rows = [
      makeRow('m-week', 'deze_week', { dishTags: ['pasta'] }),
      makeRow('m-done', 'al_gekookt', { dishTags: ['stamppot'] }),
    ];
    const view = filterLibraryGrid(rows, search({ anySchedulingStates: ['deze_week'] }));
    expect(view.selectableDishTags).toEqual(['pasta']);
  });

  test('offers every axis at once for an untouched library', () => {
    const rows = [
      makeRow('m-1', 'deze_week', { dishTags: ['pasta'], dishMoods: ['zomers'], dishCourse: 'hoofdgerecht' }),
      makeRow('m-2', 'ooit', { dishTags: ['soep'], dishMoods: ['winters'], dishCourse: 'voorgerecht' }),
    ];
    const view = filterLibraryGrid(rows, NO_LIBRARY_SEARCH);
    expect([...view.selectableDishTags].sort()).toEqual(['pasta', 'soep']);
    expect([...view.selectableDishMoods].sort()).toEqual(['winters', 'zomers']);
    expect([...view.selectableDishCourses].sort()).toEqual(['hoofdgerecht', 'voorgerecht']);
    expect(view.selectableSchedulingStates).toEqual(['deze_week', 'ooit']);
  });

  test('an empty library offers no chips at all rather than a row of dead controls', () => {
    const view = filterLibraryGrid([], NO_LIBRARY_SEARCH);
    expect(view.rows).toEqual([]);
    expect(view.selectableDishTags).toEqual([]);
    expect(view.selectableDishMoods).toEqual([]);
    expect(view.selectableDishCourses).toEqual([]);
    expect(view.selectableSchedulingStates).toEqual([]);
  });

  test('choosing one plan chip does not hide the other three — the axis is ORed, so each would ADD rows', () => {
    // The bug this pins: if the scheduling facet were computed from rows the
    // scheduling filter had already thinned, picking "Deze week" would leave
    // "Deze week" as the only chip on the row and there would be no way back
    // to the rest of the library except "Wissen".
    const rows = [makeRow('m-week', 'deze_week'), makeRow('m-ooit', 'ooit'), makeRow('m-done', 'al_gekookt')];
    const view = filterLibraryGrid(rows, search({ anySchedulingStates: ['deze_week'] }));
    expect(view.rows.map((row) => row.meal.id)).toEqual(['m-week']);
    expect(view.selectableSchedulingStates).toEqual(['deze_week', 'ooit', 'al_gekookt']);
  });

  test('the plan chips still narrow against the meal axes, which the scheduling filter must not hide', () => {
    const rows = [
      makeRow('m-week', 'deze_week', { title: 'Pastasalade' }),
      makeRow('m-ooit', 'ooit', { title: 'Kippensoep' }),
    ];
    const view = filterLibraryGrid(rows, search({ query: 'pasta', anySchedulingStates: ['deze_week'] }));
    expect(view.selectableSchedulingStates).toEqual(['deze_week']);
  });

  test('a search that matches nothing still offers every chip needed to undo it', () => {
    const rows = [makeRow('m-1', 'deze_week', { dishTags: ['pasta'] })];
    const view = filterLibraryGrid(
      rows,
      search({ requiredDishTags: ['pasta', 'soep'], anySchedulingStates: ['al_gekookt'] }),
    );
    expect(view.rows).toEqual([]);
    expect([...view.selectableDishTags].sort()).toEqual(['pasta', 'soep']);
    expect(view.selectableSchedulingStates).toEqual(['al_gekookt']);
  });
});

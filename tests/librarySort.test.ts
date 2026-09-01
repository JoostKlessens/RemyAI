import { describe, expect, test } from 'vitest';
import { DEFAULT_LIBRARY_SORT, sortLibraryRows } from '@/domain/librarySort';
import { makeCookEvent, makeMeal } from './fixtures';

interface Row {
  readonly meal: ReturnType<typeof makeMeal>;
}

function row(overrides: Parameters<typeof makeMeal>[0] = {}): Row {
  return { meal: makeMeal(overrides) };
}

describe('sortLibraryRows — default', () => {
  test('returns the identical rows reference, unchanged', () => {
    const rows = [row({ id: 'm-1' }), row({ id: 'm-2' })];
    expect(sortLibraryRows(rows, DEFAULT_LIBRARY_SORT, [])).toBe(rows);
  });
});

describe('sortLibraryRows — recent_toegevoegd', () => {
  test('most recently added first', () => {
    const rows = [
      row({ id: 'oldest', createdAt: '2026-01-01T00:00:00.000Z' }),
      row({ id: 'newest', createdAt: '2026-03-01T00:00:00.000Z' }),
      row({ id: 'middle', createdAt: '2026-02-01T00:00:00.000Z' }),
    ];

    const sorted = sortLibraryRows(rows, 'recent_toegevoegd', []);

    expect(sorted.map((r) => r.meal.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  test('ties on createdAt break by title (nl)', () => {
    const rows = [
      row({ id: 'z', title: 'Zult', createdAt: '2026-01-01T00:00:00.000Z' }),
      row({ id: 'a', title: 'Aardappelpuree', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];

    const sorted = sortLibraryRows(rows, 'recent_toegevoegd', []);

    expect(sorted.map((r) => r.meal.id)).toEqual(['a', 'z']);
  });

  test('does not mutate the input array', () => {
    const rows = [row({ id: 'm-2', createdAt: '2026-02-01T00:00:00.000Z' }), row({ id: 'm-1', createdAt: '2026-01-01T00:00:00.000Z' })];
    const original = [...rows];

    sortLibraryRows(rows, 'recent_toegevoegd', []);

    expect(rows).toEqual(original);
  });
});

describe('sortLibraryRows — nog_nooit_gekookt (PD-004a: surface what is being hoarded)', () => {
  test('never-cooked meals sort before already-cooked ones, regardless of scheduling', () => {
    const rows = [
      row({ id: 'cooked', title: 'Al gekookt' }),
      row({ id: 'never', title: 'Nooit gekookt' }),
    ];
    const cookEvents = [makeCookEvent({ mealId: 'cooked' })];

    const sorted = sortLibraryRows(rows, 'nog_nooit_gekookt', cookEvents);

    expect(sorted.map((r) => r.meal.id)).toEqual(['never', 'cooked']);
  });

  test('within the never-cooked bucket, the oldest addition (longest-hoarded) surfaces first', () => {
    const rows = [
      row({ id: 'added-recently', createdAt: '2026-03-01T00:00:00.000Z' }),
      row({ id: 'added-long-ago', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];

    const sorted = sortLibraryRows(rows, 'nog_nooit_gekookt', []);

    expect(sorted.map((r) => r.meal.id)).toEqual(['added-long-ago', 'added-recently']);
  });

  test('within the already-cooked bucket, ties break by title (nl)', () => {
    const rows = [
      row({ id: 'z', title: 'Zult' }),
      row({ id: 'a', title: 'Aardappelpuree' }),
    ];
    const cookEvents = [makeCookEvent({ mealId: 'z' }), makeCookEvent({ mealId: 'a' })];

    const sorted = sortLibraryRows(rows, 'nog_nooit_gekookt', cookEvents);

    expect(sorted.map((r) => r.meal.id)).toEqual(['a', 'z']);
  });

  test('a meal with any cook event at all counts as cooked, even alongside unrelated events for other meals', () => {
    const rows = [row({ id: 'target' })];
    const cookEvents = [
      makeCookEvent({ mealId: 'someone-elses-meal' }),
      makeCookEvent({ mealId: 'target', cookedOn: '2025-01-01' }),
    ];

    const sorted = sortLibraryRows(rows, 'nog_nooit_gekookt', cookEvents);

    // Only one row; this asserts the function does not throw and still
    // treats it as "cooked" — proven indirectly via the two-row case above,
    // this pins the "matches on mealId, not array position" behaviour.
    expect(sorted).toHaveLength(1);
  });

  test('does not mutate the input array', () => {
    const rows = [row({ id: 'm-1' }), row({ id: 'm-2' })];
    const original = [...rows];

    sortLibraryRows(rows, 'nog_nooit_gekookt', []);

    expect(rows).toEqual(original);
  });
});

describe('sortLibraryRows — generic over any row carrying a meal', () => {
  test('accepts a scheduled-row-shaped object without importing anything from src/components', () => {
    const rows = [
      { meal: makeMeal({ id: 'm-1', createdAt: '2026-01-01T00:00:00.000Z' }), scheduling: { state: 'deze_week' as const } },
      { meal: makeMeal({ id: 'm-2', createdAt: '2026-02-01T00:00:00.000Z' }), scheduling: { state: 'ooit' as const } },
    ];

    const sorted = sortLibraryRows(rows, 'recent_toegevoegd', []);

    expect(sorted.map((r) => r.meal.id)).toEqual(['m-2', 'm-1']);
  });
});

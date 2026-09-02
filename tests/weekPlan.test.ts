import { describe, expect, test } from 'vitest';
import { buildWeekPlan } from '@/domain/weekPlan';
import type { Meal, Save } from '@/domain/types';
import { makeMeal, makeSave } from './fixtures';

/**
 * The one number this module and the shopping list must never disagree
 * about: how many distinct meals the same `listPendingSaves(household,
 * 'this_week')` result describes. src/app/boodschappen.tsx computes it as
 * `[...new Set(saves.map((save) => save.mealId))].length`; this mirrors
 * that expression rather than importing it, because a route module is not
 * importable by this suite — see the assertions below that pin
 * `plannedMealCount` to it.
 */
function distinctMealCount(saves: readonly Save[]): number {
  return new Set(saves.map((save) => save.mealId)).size;
}

describe('buildWeekPlan — ordering', () => {
  test('orders entries by when the dish entered the week, oldest first', () => {
    // Arrange
    const saves: readonly Save[] = [
      makeSave({ id: 'save-late', mealId: 'meal-late', savedAt: '2026-08-20T12:00:00.000Z' }),
      makeSave({ id: 'save-early', mealId: 'meal-early', savedAt: '2026-08-18T09:00:00.000Z' }),
    ];
    const meals: readonly Meal[] = [
      makeMeal({ id: 'meal-late', title: 'Aubergine uit de oven' }),
      makeMeal({ id: 'meal-early', title: 'Zalm met dille' }),
    ];

    // Act
    const plan = buildWeekPlan(saves, meals);

    // Assert
    expect(plan.entries.map((entry) => entry.meal.id)).toEqual(['meal-early', 'meal-late']);
  });

  test('breaks a same-instant tie on the dish title in Dutch collation, not on input order', () => {
    // Arrange
    const sameInstant = '2026-08-18T09:00:00.000Z';
    const saves: readonly Save[] = [
      makeSave({ id: 'save-z', mealId: 'meal-z', savedAt: sameInstant }),
      makeSave({ id: 'save-a', mealId: 'meal-a', savedAt: sameInstant }),
    ];
    const meals: readonly Meal[] = [
      makeMeal({ id: 'meal-z', title: 'Zuurkool' }),
      makeMeal({ id: 'meal-a', title: 'Andijviestamppot' }),
    ];

    // Act
    const plan = buildWeekPlan(saves, meals);

    // Assert
    expect(plan.entries.map((entry) => entry.meal.title)).toEqual(['Andijviestamppot', 'Zuurkool']);
  });

  test('produces the same order however the saves and meals arrive', () => {
    // Arrange
    const saves: readonly Save[] = [
      makeSave({ id: 'save-1', mealId: 'meal-1', savedAt: '2026-08-18T09:00:00.000Z' }),
      makeSave({ id: 'save-2', mealId: 'meal-2', savedAt: '2026-08-19T09:00:00.000Z' }),
      makeSave({ id: 'save-3', mealId: 'meal-3', savedAt: '2026-08-20T09:00:00.000Z' }),
    ];
    const meals: readonly Meal[] = [makeMeal({ id: 'meal-1' }), makeMeal({ id: 'meal-2' }), makeMeal({ id: 'meal-3' })];

    // Act
    const forwards = buildWeekPlan(saves, meals);
    const backwards = buildWeekPlan([...saves].reverse(), [...meals].reverse());

    // Assert
    expect(backwards.entries.map((entry) => entry.meal.id)).toEqual(forwards.entries.map((entry) => entry.meal.id));
  });

  test('never sorts its input arrays in place', () => {
    // Arrange
    const saves: readonly Save[] = [
      makeSave({ id: 'save-late', mealId: 'meal-late', savedAt: '2026-08-20T12:00:00.000Z' }),
      makeSave({ id: 'save-early', mealId: 'meal-early', savedAt: '2026-08-18T09:00:00.000Z' }),
    ];
    const meals: readonly Meal[] = [makeMeal({ id: 'meal-late' }), makeMeal({ id: 'meal-early' })];
    const savesOrderBefore = saves.map((save) => save.id);
    const mealsOrderBefore = meals.map((meal) => meal.id);

    // Act
    buildWeekPlan(saves, meals);

    // Assert
    expect(saves.map((save) => save.id)).toEqual(savesOrderBefore);
    expect(meals.map((meal) => meal.id)).toEqual(mealsOrderBefore);
  });
});

describe('buildWeekPlan — one row per dish', () => {
  test('a dish saved twice for the same week is one entry, dated by the first save', () => {
    // Arrange
    const saves: readonly Save[] = [
      makeSave({ id: 'save-second', mealId: 'meal-1', savedAt: '2026-08-20T12:00:00.000Z' }),
      makeSave({ id: 'save-first', mealId: 'meal-1', savedAt: '2026-08-18T09:00:00.000Z' }),
    ];

    // Act
    const plan = buildWeekPlan(saves, [makeMeal({ id: 'meal-1' })]);

    // Assert
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]?.plannedAt).toBe('2026-08-18T09:00:00.000Z');
  });

  test('plannedMealCount equals the distinct meals in the saves it was given', () => {
    // Arrange
    const saves: readonly Save[] = [
      makeSave({ id: 'save-1', mealId: 'meal-1' }),
      makeSave({ id: 'save-1b', mealId: 'meal-1' }),
      makeSave({ id: 'save-2', mealId: 'meal-2' }),
    ];

    // Act
    const plan = buildWeekPlan(saves, [makeMeal({ id: 'meal-1' }), makeMeal({ id: 'meal-2' })]);

    // Assert
    expect(plan.plannedMealCount).toBe(distinctMealCount(saves));
    expect(plan.plannedMealCount).toBe(2);
  });
});

describe('buildWeekPlan — the query is the definition of "this week"', () => {
  test('does not re-filter on intent: every save it is handed is part of the week', () => {
    // Arrange — a caller could only produce this by passing the wrong
    // query; narrowing it here would be a second definition of the week
    // that the shopping list does not share.
    const saves: readonly Save[] = [makeSave({ id: 'save-1', mealId: 'meal-1', intent: 'someday' })];

    // Act
    const plan = buildWeekPlan(saves, [makeMeal({ id: 'meal-1' })]);

    // Assert
    expect(plan.entries).toHaveLength(1);
    expect(plan.plannedMealCount).toBe(1);
  });

  /**
   * The archived case used to live here, asserting an `isArchived` flag this
   * module carried so the screen could admit that a removed dish was still
   * filling the shopping list. `listPendingSaves` drops those saves now
   * (tests/repository/saves.test.ts holds it to that), so no archived meal
   * can reach this function through its documented input. What is still
   * worth pinning is the rule that made the flag possible in the first
   * place: this function narrows NOTHING it is handed, so it must not start
   * second-guessing an archived meal on its own either.
   */
  test('does not drop a meal on account of its archivedAt — narrowing is the repository job, not this one', () => {
    // Arrange
    const saves: readonly Save[] = [makeSave({ id: 'save-1', mealId: 'meal-1' })];
    const meals: readonly Meal[] = [makeMeal({ id: 'meal-1', archivedAt: '2026-08-19T08:00:00.000Z' })];

    // Act
    const plan = buildWeekPlan(saves, meals);

    // Assert
    expect(plan.entries).toHaveLength(1);
    expect(plan.plannedMealCount).toBe(distinctMealCount(saves));
  });
});

describe('buildWeekPlan — a save whose meal could not be read', () => {
  test('reports the meal id instead of inventing a row for it', () => {
    // Arrange
    const saves: readonly Save[] = [
      makeSave({ id: 'save-1', mealId: 'meal-1' }),
      makeSave({ id: 'save-gone', mealId: 'meal-gone' }),
    ];

    // Act
    const plan = buildWeekPlan(saves, [makeMeal({ id: 'meal-1' })]);

    // Assert
    expect(plan.entries.map((entry) => entry.meal.id)).toEqual(['meal-1']);
    expect(plan.unresolvedMealIds).toEqual(['meal-gone']);
  });

  test('still counts toward plannedMealCount, so the week and the shopping list agree', () => {
    // Arrange
    const saves: readonly Save[] = [
      makeSave({ id: 'save-1', mealId: 'meal-1' }),
      makeSave({ id: 'save-gone', mealId: 'meal-gone' }),
    ];

    // Act
    const plan = buildWeekPlan(saves, [makeMeal({ id: 'meal-1' })]);

    // Assert
    expect(plan.plannedMealCount).toBe(distinctMealCount(saves));
    expect(plan.plannedMealCount).toBe(2);
  });

  test('orders the unresolved ids deterministically', () => {
    // Arrange
    const saves: readonly Save[] = [
      makeSave({ id: 'save-b', mealId: 'meal-b' }),
      makeSave({ id: 'save-a', mealId: 'meal-a' }),
    ];

    // Act
    const plan = buildWeekPlan(saves, []);

    // Assert
    expect(plan.unresolvedMealIds).toEqual(['meal-a', 'meal-b']);
  });
});

describe('buildWeekPlan — nothing planned', () => {
  test('returns an empty plan rather than throwing when there are no saves', () => {
    // Arrange / Act
    const plan = buildWeekPlan([], [makeMeal({ id: 'meal-1' })]);

    // Assert
    expect(plan.entries).toEqual([]);
    expect(plan.unresolvedMealIds).toEqual([]);
    expect(plan.plannedMealCount).toBe(0);
  });
});

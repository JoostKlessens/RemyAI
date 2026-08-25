import { describe, expect, test } from 'vitest';
import type { CookEvent, Meal, Save } from '@/domain/types';
import { buildSchedulingLabel, resolveRecipeSchedulingState, sortMealsByScheduling } from '@/components/recipeScheduling';

function buildMeal(id: string, title: string): Meal {
  return {
    id,
    householdId: 'household-1',
    title,
    source: 'seeded',
    estimatedMinutes: 20,
    skillLevel: 'beginner',
    servings: 2,
    ingredientTags: [],
    dishTags: [],
    sourceUrl: null,
    sourcePlatform: null,
    thumbnailUrl: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function buildSave(mealId: string, intent: Save['intent'], savedAt: string): Save {
  return { id: `save-${mealId}-${savedAt}`, householdId: 'household-1', memberId: null, mealId, intent, sourceUrl: null, savedAt };
}

function buildCookEvent(mealId: string, cookedOn: string): CookEvent {
  return { id: `cook-${mealId}-${cookedOn}`, householdId: 'household-1', mealId, decisionId: null, cookedOn, wouldRepeat: null, createdAt: `${cookedOn}T18:00:00.000Z` };
}

describe('resolveRecipeSchedulingState', () => {
  test('a meal with no save and no cook event has no planning', () => {
    expect(resolveRecipeSchedulingState('meal-1', [], []).state).toBe('geen_planning');
  });

  test('an active "this_week" save resolves to deze_week', () => {
    const saves = [buildSave('meal-1', 'this_week', '2026-08-20T08:00:00.000Z')];
    expect(resolveRecipeSchedulingState('meal-1', saves, []).state).toBe('deze_week');
  });

  test('an active "someday" save resolves to ooit', () => {
    const saves = [buildSave('meal-1', 'someday', '2026-08-20T08:00:00.000Z')];
    expect(resolveRecipeSchedulingState('meal-1', saves, []).state).toBe('ooit');
  });

  test('a "none" intent save is a bare bookmark, not a schedule', () => {
    const saves = [buildSave('meal-1', 'none', '2026-08-20T08:00:00.000Z')];
    expect(resolveRecipeSchedulingState('meal-1', saves, []).state).toBe('geen_planning');
  });

  test('a cook event beats an active save — once cooked, "when" is moot', () => {
    const saves = [buildSave('meal-1', 'this_week', '2026-08-20T08:00:00.000Z')];
    const cookEvents = [buildCookEvent('meal-1', '2026-08-10')];
    const info = resolveRecipeSchedulingState('meal-1', saves, cookEvents);
    expect(info.state).toBe('al_gekookt');
    expect(info.lastCookedOn).toBe('2026-08-10');
  });

  test('the most recent cook event wins when a meal was cooked more than once', () => {
    const cookEvents = [buildCookEvent('meal-1', '2026-07-01'), buildCookEvent('meal-1', '2026-08-15')];
    expect(resolveRecipeSchedulingState('meal-1', [], cookEvents).lastCookedOn).toBe('2026-08-15');
  });

  test('the most recent active save wins when a meal has several', () => {
    const saves = [
      buildSave('meal-1', 'someday', '2026-08-01T08:00:00.000Z'),
      buildSave('meal-1', 'this_week', '2026-08-20T08:00:00.000Z'),
    ];
    expect(resolveRecipeSchedulingState('meal-1', saves, []).state).toBe('deze_week');
  });
});

describe('sortMealsByScheduling', () => {
  test('orders deze_week first, then ooit, then geen_planning, then al_gekookt', () => {
    const meals = [buildMeal('m-cooked', 'Gekookt'), buildMeal('m-none', 'Zonder planning'), buildMeal('m-someday', 'Ooit'), buildMeal('m-week', 'Deze week')];
    const saves = [buildSave('m-week', 'this_week', '2026-08-20T08:00:00.000Z'), buildSave('m-someday', 'someday', '2026-08-01T08:00:00.000Z')];
    const cookEvents = [buildCookEvent('m-cooked', '2026-08-10')];

    const rows = sortMealsByScheduling(meals, saves, cookEvents);

    expect(rows.map((row) => row.meal.id)).toEqual(['m-week', 'm-someday', 'm-none', 'm-cooked']);
  });

  test('sorts alphabetically (Dutch collation) within the same scheduling state', () => {
    const meals = [buildMeal('m-b', 'Zalm met broccoli'), buildMeal('m-a', 'Aardappelpuree')];
    const rows = sortMealsByScheduling(meals, [], []);
    expect(rows.map((row) => row.meal.id)).toEqual(['m-a', 'm-b']);
  });
});

describe('buildSchedulingLabel', () => {
  test('every state has distinct, non-empty Dutch copy', () => {
    const labels = (['deze_week', 'ooit', 'al_gekookt', 'geen_planning'] as const).map(buildSchedulingLabel);
    expect(new Set(labels).size).toBe(4);
    for (const label of labels) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

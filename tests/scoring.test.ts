import { describe, expect, test } from 'vitest';
import {
  FITS_TIME_BOOST,
  NOT_RECENT_BOOST,
  RECENCY_PENALTY_WINDOW_DAYS,
  SAVED_THIS_WEEK_BOOST,
  scoreMeal,
  scoreMeals,
  VARIETY_BOOST,
} from '@/domain/scoring';
import { makeCookEvent, makeHousehold, makeMeal, makeSave } from './fixtures';

const TARGET_DATE = '2026-08-22';

describe('scoreMeal — saved_this_week', () => {
  test('a this_week save wins over an equally-scored ordinary meal', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const savedMeal = makeMeal({ id: 'meal-saved', estimatedMinutes: 20 });
    const ordinaryMeal = makeMeal({ id: 'meal-ordinary', estimatedMinutes: 20 });
    const saves = [makeSave({ mealId: 'meal-saved' })];

    const savedScore = scoreMeal(savedMeal, household, [], saves, TARGET_DATE);
    const ordinaryScore = scoreMeal(ordinaryMeal, household, [], saves, TARGET_DATE);

    expect(savedScore.score).toBeGreaterThan(ordinaryScore.score);
    expect(savedScore.reasonCode).toBe('saved_this_week');
  });

  test('applies the full SAVED_THIS_WEEK_BOOST on top of the variety boost a never-cooked meal always earns', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: null });
    const saves = [makeSave({ mealId: 'meal-1' })];

    const result = scoreMeal(meal, household, [], saves, TARGET_DATE);

    // No cook history -> VARIETY_BOOST always applies alongside the save boost.
    expect(result.score).toBe(SAVED_THIS_WEEK_BOOST + VARIETY_BOOST);
  });
});

describe('scoreMeal — wouldRepeat history', () => {
  test('wouldRepeat === false meal loses to an untried one', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const rejectedMeal = makeMeal({ id: 'meal-rejected', estimatedMinutes: 20 });
    const untriedMeal = makeMeal({ id: 'meal-untried', estimatedMinutes: 20 });
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-rejected', cookedOn: '2026-06-01', wouldRepeat: false }),
    ];

    const rejectedScore = scoreMeal(rejectedMeal, household, recentCookEvents, [], TARGET_DATE);
    const untriedScore = scoreMeal(untriedMeal, household, recentCookEvents, [], TARGET_DATE);

    expect(untriedScore.score).toBeGreaterThan(rejectedScore.score);
  });

  test('wouldRepeat === true boosts the meal with reason household_favourite', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-favourite', estimatedMinutes: 20 });
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-favourite', cookedOn: '2026-06-01', wouldRepeat: true }),
    ];

    const result = scoreMeal(meal, household, recentCookEvents, [], TARGET_DATE);

    expect(result.score).toBeGreaterThan(0);
    expect(result.reasonCode).toBe('household_favourite');
  });

  test('a null wouldRepeat answer contributes no adjustment', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-unanswered', estimatedMinutes: 20 });
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-unanswered', cookedOn: '2026-06-01', wouldRepeat: null }),
    ];

    const result = scoreMeal(meal, household, recentCookEvents, [], TARGET_DATE);

    // Cooked long before the recency window, no repeat answer, not
    // comfortably under budget (20 of a 30 min budget, ratio 0.66 > 0.6):
    // only the not_recent boost should apply.
    expect(result.score).toBe(NOT_RECENT_BOOST);
    expect(result.reasonCode).toBe('not_recent');
  });
});

describe('scoreMeal — recency', () => {
  test('penalizes a meal cooked very recently', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: 20 });
    const recentCookEvents = [makeCookEvent({ mealId: 'meal-1', cookedOn: '2026-08-21' })];

    const result = scoreMeal(meal, household, recentCookEvents, [], TARGET_DATE);

    expect(result.score).toBeLessThan(0);
  });

  test('a meal cooked just outside the recency window earns the not_recent boost', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: 20 });
    const cookedOn = '2026-08-08'; // exactly RECENCY_PENALTY_WINDOW_DAYS (14) before target
    const recentCookEvents = [makeCookEvent({ mealId: 'meal-1', cookedOn })];

    const result = scoreMeal(meal, household, recentCookEvents, [], TARGET_DATE);

    expect(RECENCY_PENALTY_WINDOW_DAYS).toBe(14);
    expect(result.reasonCode).toBe('not_recent');
  });
});

describe('scoreMeal — fits_time', () => {
  test('boosts a meal comfortably under the weeknight time budget', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 40 });
    const meal = makeMeal({ id: 'meal-quick', estimatedMinutes: 15 });

    const result = scoreMeal(meal, household, [], [], TARGET_DATE);

    expect(result.score).toBe(FITS_TIME_BOOST + VARIETY_BOOST);
    expect(result.reasonCode).toBe('variety');
  });

  test('does not boost a meal that only barely fits the budget', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-tight', estimatedMinutes: 29 });

    const result = scoreMeal(meal, household, [], [], TARGET_DATE);

    expect(result.score).toBe(VARIETY_BOOST);
  });
});

describe('scoreMeal — variety', () => {
  test('a never-cooked meal with no other signal gets the variety boost', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 20 });
    const meal = makeMeal({ id: 'meal-new', estimatedMinutes: 25 });

    const result = scoreMeal(meal, household, [], [], TARGET_DATE);

    expect(result.score).toBe(VARIETY_BOOST);
    expect(result.reasonCode).toBe('variety');
  });
});

describe('scoreMeal — negative-score fallback path (Finding 2 regression)', () => {
  test('a meal cooked a few days ago never gets mislabeled variety, even though it has no positive factor', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-recent', estimatedMinutes: 20 });
    // 3 days before TARGET_DATE: inside RECENCY_PENALTY_WINDOW_DAYS, so
    // this meal gets a recency penalty and no not_recent/variety boost —
    // the exact "positive.length === 0" bleak case Finding 2 describes.
    const recentCookEvents = [makeCookEvent({ mealId: 'meal-recent', cookedOn: '2026-08-19' })];

    const result = scoreMeal(meal, household, recentCookEvents, [], TARGET_DATE);

    expect(result.score).toBeLessThanOrEqual(0);
    expect(result.reasonCode).toBe('fallback');
    expect(result.reasonCode).not.toBe('variety');
  });

  test('a genuinely never-cooked meal still gets variety, not fallback', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-new', estimatedMinutes: 29 });

    const result = scoreMeal(meal, household, [], [], TARGET_DATE);

    expect(result.reasonCode).toBe('variety');
  });
});

describe('scoreMeals', () => {
  test('sorts descending by score', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meals = [
      makeMeal({ id: 'meal-low', estimatedMinutes: 20 }),
      makeMeal({ id: 'meal-high', estimatedMinutes: 20 }),
    ];
    const saves = [makeSave({ mealId: 'meal-high' })];

    const result = scoreMeals(meals, household, [], saves, TARGET_DATE);

    expect(result[0]?.meal.id).toBe('meal-high');
  });

  test('breaks ties deterministically by meal id', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meals = [
      makeMeal({ id: 'meal-b', estimatedMinutes: 20 }),
      makeMeal({ id: 'meal-a', estimatedMinutes: 20 }),
    ];

    const first = scoreMeals(meals, household, [], [], TARGET_DATE);
    const second = scoreMeals([...meals].reverse(), household, [], [], TARGET_DATE);

    expect(first.map((s) => s.meal.id)).toEqual(['meal-a', 'meal-b']);
    expect(second.map((s) => s.meal.id)).toEqual(['meal-a', 'meal-b']);
  });

  test('does not mutate the input meals array', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meals = [makeMeal({ id: 'meal-b' }), makeMeal({ id: 'meal-a' })];
    const originalOrder = meals.map((m) => m.id);

    scoreMeals(meals, household, [], [], TARGET_DATE);

    expect(meals.map((m) => m.id)).toEqual(originalOrder);
  });
});

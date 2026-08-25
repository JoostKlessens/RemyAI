import { describe, expect, test } from 'vitest';
import {
  FITS_TIME_BOOST,
  NOT_RECENT_BOOST,
  RECENCY_PENALTY_WINDOW_DAYS,
  SAVED_THIS_WEEK_BOOST,
  scoreMeal,
  scoreMeals,
  SOMEDAY_SAVE_BASE_BOOST,
  SOMEDAY_SAVE_ESCALATION_CAP_WEEKS,
  SOMEDAY_SAVE_MAX_BOOST,
  SOMEDAY_SAVE_WEEKLY_ESCALATION,
  VARIETY_BOOST,
} from '@/domain/scoring';
import { RATING_MAX, RATING_MIN, RATING_NEGATIVE_AT_OR_BELOW } from '@/domain/rating';
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

describe('scoreMeal — numeric rating (PD-008)', () => {
  const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });

  test('a top score boosts the meal as a household favourite', () => {
    const meal = makeMeal({ id: 'meal-loved', estimatedMinutes: 20 });
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-loved', cookedOn: '2026-06-01', wouldRepeat: null, rating: RATING_MAX }),
    ];

    const result = scoreMeal(meal, household, recentCookEvents, [], TARGET_DATE);

    expect(result.reasonCode).toBe('household_favourite');
    expect(result.score).toBeGreaterThan(NOT_RECENT_BOOST);
  });

  test('a bottom score penalizes the meal below an untried one', () => {
    const ratedMeal = makeMeal({ id: 'meal-disliked', estimatedMinutes: 20 });
    const untriedMeal = makeMeal({ id: 'meal-untried', estimatedMinutes: 20 });
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-disliked', cookedOn: '2026-06-01', wouldRepeat: null, rating: RATING_MIN }),
    ];

    const ratedScore = scoreMeal(ratedMeal, household, recentCookEvents, [], TARGET_DATE);
    const untriedScore = scoreMeal(untriedMeal, household, recentCookEvents, [], TARGET_DATE);

    expect(untriedScore.score).toBeGreaterThan(ratedScore.score);
  });

  /**
   * The reason the scale has a middle at all. Without it a lukewarm meal
   * is recorded as a favourite and inflates the very signal that decides
   * what gets served again — so a middling score must score exactly like
   * an unanswered one.
   */
  test('a middling score contributes no adjustment, exactly like no answer', () => {
    const meal = makeMeal({ id: 'meal-fine', estimatedMinutes: 20 });
    const middlingScore = RATING_NEGATIVE_AT_OR_BELOW + 1;
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-fine', cookedOn: '2026-06-01', wouldRepeat: null, rating: middlingScore }),
    ];

    const result = scoreMeal(meal, household, recentCookEvents, [], TARGET_DATE);

    expect(result.score).toBe(NOT_RECENT_BOOST);
    expect(result.reasonCode).toBe('not_recent');
  });

  test('a meal rated before the scale existed still scores on wouldRepeat alone', () => {
    const meal = makeMeal({ id: 'meal-legacy', estimatedMinutes: 20 });
    const recentCookEvents = [
      makeCookEvent({ mealId: 'meal-legacy', cookedOn: '2026-06-01', wouldRepeat: true }),
    ];

    const result = scoreMeal(meal, household, recentCookEvents, [], TARGET_DATE);

    expect(result.reasonCode).toBe('household_favourite');
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

describe('scoreMeal — someday save aging boost (PD-004a)', () => {
  test('a meal with no pending someday save gets no boost', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: null });

    const result = scoreMeal(meal, household, [], [], TARGET_DATE, []);

    expect(result.score).toBe(VARIETY_BOOST);
  });

  test('a someday save for a DIFFERENT meal does not boost this one', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: null });
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-other', intent: 'someday', savedAt: TARGET_DATE })];

    const result = scoreMeal(meal, household, [], [], TARGET_DATE, pendingSomedaySaves);

    expect(result.score).toBe(VARIETY_BOOST);
  });

  test('applies the base boost the moment a meal is saved (0 days waited)', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: null });
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-1', intent: 'someday', savedAt: '2026-08-22T08:00:00.000Z' })];

    const result = scoreMeal(meal, household, [], [], TARGET_DATE, pendingSomedaySaves);

    expect(result.score).toBe(VARIETY_BOOST + SOMEDAY_SAVE_BASE_BOOST);
  });

  test('the boost escalates by SOMEDAY_SAVE_WEEKLY_ESCALATION per full week waited', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: null });
    // Exactly 2 weeks (14 days) before TARGET_DATE.
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-1', intent: 'someday', savedAt: '2026-08-08T08:00:00.000Z' })];

    const result = scoreMeal(meal, household, [], [], TARGET_DATE, pendingSomedaySaves);

    expect(result.score).toBe(VARIETY_BOOST + SOMEDAY_SAVE_BASE_BOOST + 2 * SOMEDAY_SAVE_WEEKLY_ESCALATION);
  });

  test('the boost caps at SOMEDAY_SAVE_MAX_BOOST no matter how long ago it was saved', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: null });
    // Far beyond SOMEDAY_SAVE_ESCALATION_CAP_WEEKS.
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-1', intent: 'someday', savedAt: '2026-01-01T08:00:00.000Z' })];

    const result = scoreMeal(meal, household, [], [], TARGET_DATE, pendingSomedaySaves);

    expect(result.score).toBe(VARIETY_BOOST + SOMEDAY_SAVE_MAX_BOOST);
    expect(SOMEDAY_SAVE_MAX_BOOST).toBe(
      SOMEDAY_SAVE_BASE_BOOST + SOMEDAY_SAVE_WEEKLY_ESCALATION * SOMEDAY_SAVE_ESCALATION_CAP_WEEKS,
    );
  });

  test('an earlier of two pending someday saves for the same meal drives the boost (longest wait wins)', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: null });
    const pendingSomedaySaves = [
      makeSave({ id: 'save-recent', mealId: 'meal-1', intent: 'someday', savedAt: '2026-08-20T08:00:00.000Z' }),
      makeSave({ id: 'save-old', mealId: 'meal-1', intent: 'someday', savedAt: '2026-01-01T08:00:00.000Z' }),
    ];

    const result = scoreMeal(meal, household, [], [], TARGET_DATE, pendingSomedaySaves);

    expect(result.score).toBe(VARIETY_BOOST + SOMEDAY_SAVE_MAX_BOOST);
  });

  test('the boost never changes reasonCode away from the meal\'s honest organic factor', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const meal = makeMeal({ id: 'meal-1', estimatedMinutes: null });
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-1', intent: 'someday', savedAt: '2026-01-01T08:00:00.000Z' })];

    const result = scoreMeal(meal, household, [], [], TARGET_DATE, pendingSomedaySaves);

    // Never cooked -> 'variety' stays the true story, even though the
    // invisible boost is what wins it the tie-break against other meals.
    expect(result.reasonCode).toBe('variety');
  });

  test('a fully-aged someday save outscores the strongest possible ordinary never-cooked competitor', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 40 });
    const ordinaryMeal = makeMeal({ id: 'meal-ordinary', estimatedMinutes: 15 }); // comfortably under budget
    const somedayMeal = makeMeal({ id: 'meal-someday', estimatedMinutes: null });
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-someday', intent: 'someday', savedAt: '2026-01-01T08:00:00.000Z' })];

    const ordinaryScore = scoreMeal(ordinaryMeal, household, [], [], TARGET_DATE, []);
    const somedayScore = scoreMeal(somedayMeal, household, [], [], TARGET_DATE, pendingSomedaySaves);

    // The strongest an ordinary never-cooked meal can score from organic
    // factors alone is VARIETY_BOOST + FITS_TIME_BOOST — household_favourite
    // and not_recent both require prior cook history.
    expect(ordinaryScore.score).toBe(VARIETY_BOOST + FITS_TIME_BOOST);
    expect(somedayScore.score).toBeGreaterThan(ordinaryScore.score);
  });

  test('scoreMeals sorts a fully-aged someday save ahead of an ordinary competitor', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 40 });
    const meals = [
      makeMeal({ id: 'meal-ordinary', estimatedMinutes: 15 }),
      makeMeal({ id: 'meal-someday', estimatedMinutes: null }),
    ];
    const pendingSomedaySaves = [makeSave({ mealId: 'meal-someday', intent: 'someday', savedAt: '2026-01-01T08:00:00.000Z' })];

    const result = scoreMeals(meals, household, [], [], TARGET_DATE, pendingSomedaySaves);

    expect(result[0]?.meal.id).toBe('meal-someday');
  });
});

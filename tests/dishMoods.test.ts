import { describe, expect, test } from 'vitest';
import {
  DISH_MOOD_VALUES,
  DISH_MOODS,
  collectAvailableDishMoods,
  isDishMood,
  readMealDishMoods,
  sanitizeDishMoods,
} from '@/domain/dishMoods';
import { DISH_TAG_VALUES } from '@/domain/dishTags';
import { EU_ALLERGEN_TAGS } from '@/domain/allergens';
import { normalizeTag } from '@/domain/normalizeTag';
import { makeMeal } from './fixtures';

describe('DISH_MOODS — closed vocabulary', () => {
  test('every mood is already normalizeTag()-clean', () => {
    for (const entry of DISH_MOODS) {
      expect(normalizeTag(entry.mood)).toBe(entry.mood);
    }
  });

  test('every mood is unique', () => {
    const moods = DISH_MOODS.map((entry) => entry.mood);
    expect(new Set(moods).size).toBe(moods.length);
  });

  test('every label is non-empty', () => {
    for (const entry of DISH_MOODS) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  test('DISH_MOOD_VALUES mirrors DISH_MOODS exactly', () => {
    expect(DISH_MOOD_VALUES.size).toBe(DISH_MOODS.length);
    for (const entry of DISH_MOODS) {
      expect(DISH_MOOD_VALUES.has(entry.mood)).toBe(true);
    }
  });

  /**
   * The two axes must stay two axes. A value in both would mean one chip
   * tap on Kiezen narrowing through two predicates with opposite
   * semantics — axis 1 is AND, axis 2 is OR — and a cook's mood tap
   * silently rewriting a composition fact set at import time.
   */
  test('shares no value with the dish-tag vocabulary', () => {
    for (const entry of DISH_MOODS) {
      expect(DISH_TAG_VALUES.has(entry.mood)).toBe(false);
    }
  });

  /**
   * The PD-006 boundary dishTags.ts already holds, restated for this
   * vocabulary: a mood must never be able to collide with an allergen
   * string, or a descriptive filter and a safety exclusion would operate
   * on the same value.
   */
  test('shares no value with the allergen vocabulary', () => {
    for (const entry of DISH_MOODS) {
      expect(EU_ALLERGEN_TAGS.has(entry.mood)).toBe(false);
    }
  });

  /**
   * The row is rendered in full on the outcome card — every mood, every
   * time — so the vocabulary's size is directly the height of a wrapping
   * chip row on a phone. This is a budget, not a trivia assertion: adding
   * a seventh mood should be a deliberate act that fails here first.
   */
  test('stays small enough to render as one wrapping chip row', () => {
    expect(DISH_MOODS.length).toBeLessThanOrEqual(6);
  });
});

describe('isDishMood', () => {
  test('accepts every mood in the vocabulary', () => {
    for (const entry of DISH_MOODS) {
      expect(isDishMood(entry.mood)).toBe(true);
    }
  });

  test('rejects a value outside the vocabulary', () => {
    expect(isDishMood('gluten')).toBe(false);
    expect(isDishMood('pasta')).toBe(false);
    expect(isDishMood('')).toBe(false);
  });

  test('rejects an unnormalized variant rather than silently accepting it', () => {
    expect(isDishMood('Zomers')).toBe(false);
    expect(isDishMood(' zomers ')).toBe(false);
  });
});

describe('sanitizeDishMoods — narrowing untrusted input', () => {
  test('keeps a mood that is already in the vocabulary', () => {
    expect(sanitizeDishMoods(['zomers'], normalizeTag)).toEqual(['zomers']);
  });

  test('normalizes before matching, so a capitalized or padded value survives', () => {
    expect(sanitizeDishMoods(['Zomers', ' WINTERS '], normalizeTag)).toEqual(['zomers', 'winters']);
  });

  test('drops a value the vocabulary does not know', () => {
    expect(sanitizeDishMoods(['herfstig', 'winters'], normalizeTag)).toEqual(['winters']);
  });

  test('drops a dish tag rather than accepting it as a mood', () => {
    expect(sanitizeDishMoods(['pasta', 'vegetarisch'], normalizeTag)).toEqual([]);
  });

  test('de-duplicates values that normalize to the same mood', () => {
    expect(sanitizeDishMoods(['licht', 'Licht', ' licht'], normalizeTag)).toEqual(['licht']);
  });

  test('returns an empty array for empty input', () => {
    expect(sanitizeDishMoods([], normalizeTag)).toEqual([]);
  });
});

describe('readMealDishMoods — the optional field, read safely', () => {
  test('returns the stored moods when the meal has them', () => {
    expect(readMealDishMoods(makeMeal({ dishMoods: ['zomers'] }))).toEqual(['zomers']);
  });

  /**
   * `Meal.dishMoods` is optional, so a row written by any build before
   * this feature — which is every row in every real install today — has
   * no such key at all. That absent state means "nobody has described
   * this dish yet", which is exactly what an empty array means.
   */
  test('reads a meal that predates the field as having no moods', () => {
    expect(readMealDishMoods(makeMeal())).toEqual([]);
  });

  test('reads a corrupt non-array value as having no moods rather than crashing', () => {
    const corrupt = makeMeal({ dishMoods: undefined });
    expect(readMealDishMoods({ ...corrupt, dishMoods: 'zomers' as unknown as readonly string[] })).toEqual([]);
  });
});

describe('collectAvailableDishMoods — what the filter row may offer', () => {
  test('unions the moods across the candidate pool', () => {
    const meals = [
      makeMeal({ id: 'meal-1', dishMoods: ['zomers'] }),
      makeMeal({ id: 'meal-2', dishMoods: ['winters', 'soul-food'] }),
    ];

    expect([...collectAvailableDishMoods(meals)].sort()).toEqual(['soul-food', 'winters', 'zomers']);
  });

  test('de-duplicates a mood carried by more than one meal', () => {
    const meals = [
      makeMeal({ id: 'meal-1', dishMoods: ['zomers'] }),
      makeMeal({ id: 'meal-2', dishMoods: ['zomers'] }),
    ];

    expect(collectAvailableDishMoods(meals)).toEqual(['zomers']);
  });

  test('is empty for a library nobody has described yet', () => {
    expect(collectAvailableDishMoods([makeMeal(), makeMeal({ id: 'meal-2' })])).toEqual([]);
  });
});

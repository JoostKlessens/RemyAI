import { describe, expect, test } from 'vitest';
import {
  buildNoveltySeed,
  classifyNoveltyTier,
  NOVELTY_RATIO,
  pickTierWithFallback,
  selectNoveltyTier,
} from '@/domain/novelty';
import { makeCookEvent, makeDecision, makeMeal } from './fixtures';

describe('NOVELTY_RATIO', () => {
  test('the three tiers sum to 1', () => {
    const total = NOVELTY_RATIO.known_rotation + NOVELTY_RATIO.variation + NOVELTY_RATIO.genuinely_new;
    expect(total).toBeCloseTo(1);
  });

  test('targets roughly 70/20/10', () => {
    expect(NOVELTY_RATIO.known_rotation).toBe(0.7);
    expect(NOVELTY_RATIO.variation).toBe(0.2);
    expect(NOVELTY_RATIO.genuinely_new).toBe(0.1);
  });
});

describe('buildNoveltySeed', () => {
  test('is deterministic for the same householdId and targetDate', () => {
    const first = buildNoveltySeed('household-1', '2026-08-22');
    const second = buildNoveltySeed('household-1', '2026-08-22');

    expect(first).toBe(second);
  });

  test('falls within [0, 1)', () => {
    const seed = buildNoveltySeed('household-1', '2026-08-22');

    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(1);
  });

  test('differs for a different targetDate (in general)', () => {
    const seedDayOne = buildNoveltySeed('household-1', '2026-08-22');
    const seedDayTwo = buildNoveltySeed('household-1', '2026-08-23');

    expect(seedDayOne).not.toBe(seedDayTwo);
  });

  test('differs for a different household on the same date (in general)', () => {
    const seedHouseholdOne = buildNoveltySeed('household-1', '2026-08-22');
    const seedHouseholdTwo = buildNoveltySeed('household-2', '2026-08-22');

    expect(seedHouseholdOne).not.toBe(seedHouseholdTwo);
  });
});

describe('selectNoveltyTier', () => {
  test('picks known_rotation for a seed inside the first 70%', () => {
    expect(selectNoveltyTier(0)).toBe('known_rotation');
    expect(selectNoveltyTier(0.69)).toBe('known_rotation');
  });

  test('picks variation for a seed inside the next 20%', () => {
    expect(selectNoveltyTier(0.7)).toBe('variation');
    expect(selectNoveltyTier(0.89)).toBe('variation');
  });

  test('picks genuinely_new for a seed inside the final 10%', () => {
    expect(selectNoveltyTier(0.9)).toBe('genuinely_new');
    expect(selectNoveltyTier(0.999)).toBe('genuinely_new');
  });
});

describe('classifyNoveltyTier', () => {
  test('classifies a meal the household has cooked as known_rotation', () => {
    const meal = makeMeal({ id: 'meal-cooked' });
    const recentCookEvents = [makeCookEvent({ mealId: 'meal-cooked' })];

    const tier = classifyNoveltyTier(meal, recentCookEvents, [], [meal]);

    expect(tier).toBe('known_rotation');
  });

  test('classifies a meal previously offered (but never cooked) as known_rotation', () => {
    const meal = makeMeal({ id: 'meal-offered' });
    const recentDecisions = [makeDecision({ mealId: 'meal-offered', initialMealId: 'meal-offered' })];

    const tier = classifyNoveltyTier(meal, [], recentDecisions, [meal]);

    expect(tier).toBe('known_rotation');
  });

  test('classifies an uncooked meal sharing an ingredient tag with a cooked meal as variation', () => {
    const cookedMeal = makeMeal({ id: 'meal-cooked', ingredientTags: ['chicken', 'rice'] });
    const candidate = makeMeal({ id: 'meal-candidate', ingredientTags: ['chicken', 'lemon'] });
    const recentCookEvents = [makeCookEvent({ mealId: 'meal-cooked' })];

    const tier = classifyNoveltyTier(candidate, recentCookEvents, [], [cookedMeal, candidate]);

    expect(tier).toBe('variation');
  });

  test('classifies an uncooked meal with no tag overlap as genuinely_new', () => {
    const cookedMeal = makeMeal({ id: 'meal-cooked', ingredientTags: ['chicken'] });
    const candidate = makeMeal({ id: 'meal-candidate', ingredientTags: ['tofu'] });
    const recentCookEvents = [makeCookEvent({ mealId: 'meal-cooked' })];

    const tier = classifyNoveltyTier(candidate, recentCookEvents, [], [cookedMeal, candidate]);

    expect(tier).toBe('genuinely_new');
  });

  test('classifies a meal with no history at all as genuinely_new', () => {
    const meal = makeMeal({ id: 'meal-brand-new', ingredientTags: [] });

    const tier = classifyNoveltyTier(meal, [], [], [meal]);

    expect(tier).toBe('genuinely_new');
  });
});

describe('pickTierWithFallback', () => {
  test('returns the preferred tier when it has members', () => {
    const classified = new Map([
      ['known_rotation', ['a']],
      ['variation', ['b']],
      ['genuinely_new', ['c']],
    ] as const);

    expect(pickTierWithFallback(classified, 'variation')).toEqual(['b']);
  });

  test('cascades to the next tier when the preferred tier is empty', () => {
    const classified = new Map([
      ['known_rotation', []],
      ['variation', ['b']],
      ['genuinely_new', ['c']],
    ] as const);

    expect(pickTierWithFallback(classified, 'known_rotation')).toEqual(['b']);
  });

  test('cascades all the way to genuinely_new when the first two tiers are empty', () => {
    const classified = new Map([
      ['known_rotation', []],
      ['variation', []],
      ['genuinely_new', ['c']],
    ] as const);

    expect(pickTierWithFallback(classified, 'known_rotation')).toEqual(['c']);
  });

  test('returns an empty array when every tier is empty', () => {
    const classified = new Map([
      ['known_rotation', []],
      ['variation', []],
      ['genuinely_new', []],
    ] as const);

    expect(pickTierWithFallback(classified, 'known_rotation')).toEqual([]);
  });
});

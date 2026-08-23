import { describe, expect, test } from 'vitest';
import {
  FITS_TIME_BUDGET_WEIGHT,
  HAS_PARSED_MEAL_WEIGHT,
  RANKING_JITTER_WEIGHT,
  RESTRICTION_COLLISION_WEIGHT,
  getCollidingTagsByFeedItem,
  rankFeedItems,
  type FeedRankingRequest,
} from '@/domain/feed/ranking';
import type { Meal, MealId } from '@/domain/types';
import { makeHousehold, makeMeal, makeMember, makeRestriction } from '../fixtures';
import { makeFeedItem } from './fixtures';

function baseRequest(overrides: Partial<FeedRankingRequest> = {}): FeedRankingRequest {
  const household = overrides.household ?? makeHousehold();
  return {
    household,
    members: [makeMember({ householdId: household.id })],
    restrictions: [],
    items: [],
    mealsById: new Map<MealId, Meal>(),
    targetDate: '2026-08-22',
    ...overrides,
  };
}

describe('rankFeedItems weight constants', () => {
  test('the jitter weight is small enough to never override a single real cookability factor', () => {
    expect(RANKING_JITTER_WEIGHT).toBeLessThan(FITS_TIME_BUDGET_WEIGHT);
    expect(RANKING_JITTER_WEIGHT).toBeLessThan(HAS_PARSED_MEAL_WEIGHT);
  });

  test('restriction collision is a penalty, not a boost', () => {
    expect(RESTRICTION_COLLISION_WEIGHT).toBeLessThan(0);
  });
});

describe('rankFeedItems', () => {
  test('prefers an item with a parsed meal attached over one without', () => {
    const meal = makeMeal({ id: 'meal-parsed' });
    const items = [
      makeFeedItem({ id: 'item-no-meal', mealId: null }),
      makeFeedItem({ id: 'item-parsed', mealId: 'meal-parsed' }),
    ];
    const request = baseRequest({ items, mealsById: new Map([[meal.id, meal]]) });

    const ranked = rankFeedItems(request);

    expect(ranked.map((item) => item.id)).toEqual(['item-parsed', 'item-no-meal']);
  });

  test('prefers a parsed meal that fits the household weeknight time budget', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const fastMeal = makeMeal({ id: 'meal-fast', estimatedMinutes: 20 });
    const slowMeal = makeMeal({ id: 'meal-slow', estimatedMinutes: 90 });
    const items = [
      makeFeedItem({ id: 'item-slow', mealId: 'meal-slow' }),
      makeFeedItem({ id: 'item-fast', mealId: 'meal-fast' }),
    ];
    const request = baseRequest({
      household,
      items,
      mealsById: new Map([
        [fastMeal.id, fastMeal],
        [slowMeal.id, slowMeal],
      ]),
    });

    const ranked = rankFeedItems(request);

    expect(ranked.map((item) => item.id)).toEqual(['item-fast', 'item-slow']);
  });

  test('does not penalize a meal with an unknown (null) estimatedMinutes for the time-budget factor', () => {
    const household = makeHousehold({ weeknightTimeBudgetMinutes: 30 });
    const unknownTimeMeal = makeMeal({ id: 'meal-unknown-time', estimatedMinutes: null });
    const slowMeal = makeMeal({ id: 'meal-slow', estimatedMinutes: 90 });
    const items = [
      makeFeedItem({ id: 'item-slow', mealId: 'meal-slow' }),
      makeFeedItem({ id: 'item-unknown-time', mealId: 'meal-unknown-time' }),
    ];
    const request = baseRequest({
      household,
      items,
      mealsById: new Map([
        [unknownTimeMeal.id, unknownTimeMeal],
        [slowMeal.id, slowMeal],
      ]),
    });

    const ranked = rankFeedItems(request);

    // Both have a parsed meal (equal HAS_PARSED_MEAL_WEIGHT); neither gets
    // the FITS_TIME_BUDGET_WEIGHT boost (unknown is neutral, slow doesn't
    // fit), so this must NOT read as "unknown loses to slow" -- both stay
    // in the higher parsed-meal tier, ordering between them settled only
    // by the deterministic jitter tie-break.
    expect(ranked.map((item) => item.id).sort()).toEqual(['item-slow', 'item-unknown-time']);
  });

  test('penalizes a parsed meal whose ingredient tags collide with a household restriction', () => {
    const member = makeMember({ id: 'member-1' });
    const restriction = makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'peanuts' });
    const cleanMeal = makeMeal({ id: 'meal-clean', ingredientTags: ['chicken'] });
    const collidingMeal = makeMeal({ id: 'meal-colliding', ingredientTags: ['peanuts'] });
    const items = [
      makeFeedItem({ id: 'item-colliding', mealId: 'meal-colliding' }),
      makeFeedItem({ id: 'item-clean', mealId: 'meal-clean' }),
    ];
    const request = baseRequest({
      members: [member],
      restrictions: [restriction],
      items,
      mealsById: new Map([
        [cleanMeal.id, cleanMeal],
        [collidingMeal.id, collidingMeal],
      ]),
    });

    const ranked = rankFeedItems(request);

    expect(ranked.map((item) => item.id)).toEqual(['item-clean', 'item-colliding']);
  });

  test('normalizes restriction tags before comparing, matching exclusions.ts semantics', () => {
    const member = makeMember({ id: 'member-1' });
    const restriction = makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'Noten' });
    const collidingMeal = makeMeal({ id: 'meal-colliding', ingredientTags: ['noten'] });
    const cleanMeal = makeMeal({ id: 'meal-clean', ingredientTags: ['rijst'] });
    const items = [
      makeFeedItem({ id: 'item-colliding', mealId: 'meal-colliding' }),
      makeFeedItem({ id: 'item-clean', mealId: 'meal-clean' }),
    ];
    const request = baseRequest({
      members: [member],
      restrictions: [restriction],
      items,
      mealsById: new Map([
        [collidingMeal.id, collidingMeal],
        [cleanMeal.id, cleanMeal],
      ]),
    });

    const ranked = rankFeedItems(request);

    expect(ranked.map((item) => item.id)).toEqual(['item-clean', 'item-colliding']);
  });

  test('does not penalize an item with no linked meal, even under an active restriction', () => {
    const member = makeMember({ id: 'member-1' });
    const restriction = makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'peanuts' });
    const items = [makeFeedItem({ id: 'item-unparsed', mealId: null })];
    const request = baseRequest({ members: [member], restrictions: [restriction], items });

    const ranked = rankFeedItems(request);

    expect(ranked.map((item) => item.id)).toEqual(['item-unparsed']);
  });

  test('is deterministic: the same request ranked twice produces the same order', () => {
    const meal = makeMeal({ id: 'meal-1' });
    const items = [
      makeFeedItem({ id: 'item-a', mealId: 'meal-1' }),
      makeFeedItem({ id: 'item-b', mealId: null }),
      makeFeedItem({ id: 'item-c', mealId: null }),
    ];
    const request = baseRequest({ items, mealsById: new Map([[meal.id, meal]]) });

    const first = rankFeedItems(request).map((item) => item.id);
    const second = rankFeedItems(request).map((item) => item.id);

    expect(first).toEqual(second);
  });

  test('produces a different tie-break order for a different targetDate (in general)', () => {
    // A large item count keeps this "in general" claim reliable rather than
    // flaky (the same reasoning as novelty.test.ts's buildNoveltySeed
    // tests): with only a handful of equally-scored items, two different
    // dates' independent jitter draws can coincidentally land on the same
    // permutation by chance. With 20 items that coincidence is
    // astronomically unlikely without being a tautology.
    const items = Array.from({ length: 20 }, (_, index) => makeFeedItem({ id: `item-${index}`, mealId: null }));
    const dayOne = rankFeedItems(baseRequest({ items, targetDate: '2026-08-22' })).map((item) => item.id);
    const dayTwo = rankFeedItems(baseRequest({ items, targetDate: '2026-08-23' })).map((item) => item.id);

    expect(dayOne).not.toEqual(dayTwo);
  });

  test('treats a dangling mealId (not present in mealsById) as no parsed meal', () => {
    const items = [makeFeedItem({ id: 'item-dangling', mealId: 'meal-missing' })];
    const request = baseRequest({ items, mealsById: new Map() });

    const ranked = rankFeedItems(request);

    expect(ranked.map((item) => item.id)).toEqual(['item-dangling']);
  });

  test('does not mutate the input items array', () => {
    const items = [makeFeedItem({ id: 'item-a' }), makeFeedItem({ id: 'item-b' })];
    const request = baseRequest({ items });
    const originalOrder = items.map((item) => item.id);

    rankFeedItems(request);

    expect(items.map((item) => item.id)).toEqual(originalOrder);
  });
});

describe('getCollidingTagsByFeedItem (PD-007a card-label data)', () => {
  test('exposes which specific tags collided, keyed by feed item id', () => {
    const member = makeMember({ id: 'member-1' });
    const restriction = makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'peanuts' });
    const cleanMeal = makeMeal({ id: 'meal-clean', ingredientTags: ['chicken'] });
    const collidingMeal = makeMeal({ id: 'meal-colliding', ingredientTags: ['chicken', 'peanuts'] });
    const items = [
      makeFeedItem({ id: 'item-colliding', mealId: 'meal-colliding' }),
      makeFeedItem({ id: 'item-clean', mealId: 'meal-clean' }),
    ];
    const request = baseRequest({
      members: [member],
      restrictions: [restriction],
      items,
      mealsById: new Map([
        [cleanMeal.id, cleanMeal],
        [collidingMeal.id, collidingMeal],
      ]),
    });

    const collisions = getCollidingTagsByFeedItem(request);

    expect(collisions.get('item-colliding')).toEqual(['peanuts']);
    expect(collisions.get('item-clean')).toEqual([]);
  });

  test('is empty for an item with no linked meal, not merely absent (PD-007a: absence must not read as "checked and clean")', () => {
    const member = makeMember({ id: 'member-1' });
    const restriction = makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'peanuts' });
    const items = [makeFeedItem({ id: 'item-unparsed', mealId: null })];
    const request = baseRequest({ members: [member], restrictions: [restriction], items });

    const collisions = getCollidingTagsByFeedItem(request);

    expect(collisions.get('item-unparsed')).toEqual([]);
  });

  test('normalizes restriction tags before comparing, matching exclusions.ts semantics', () => {
    const member = makeMember({ id: 'member-1' });
    const restriction = makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'Noten' });
    const collidingMeal = makeMeal({ id: 'meal-colliding', ingredientTags: ['noten'] });
    const items = [makeFeedItem({ id: 'item-colliding', mealId: 'meal-colliding' })];
    const request = baseRequest({
      members: [member],
      restrictions: [restriction],
      items,
      mealsById: new Map([[collidingMeal.id, collidingMeal]]),
    });

    const collisions = getCollidingTagsByFeedItem(request);

    // The returned tag is the meal's own stored casing ("noten"), suitable
    // for direct display -- normalization only governs the comparison.
    expect(collisions.get('item-colliding')).toEqual(['noten']);
  });

  test('treats a dangling mealId (not present in mealsById) the same as no linked meal', () => {
    const member = makeMember({ id: 'member-1' });
    const restriction = makeRestriction({ memberId: 'member-1', type: 'allergen', excludesTag: 'peanuts' });
    const items = [makeFeedItem({ id: 'item-dangling', mealId: 'meal-missing' })];
    const request = baseRequest({ members: [member], restrictions: [restriction], items, mealsById: new Map() });

    const collisions = getCollidingTagsByFeedItem(request);

    expect(collisions.get('item-dangling')).toEqual([]);
  });
});

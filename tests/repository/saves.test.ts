/**
 * The save seam, held to the two promises `RemyRepository` makes about it
 * in src/lib/repository/types.ts: what `listPendingSaves` may still show,
 * and what `removeSaves` takes away.
 *
 * WHY AT THE REPOSITORY LEVEL RATHER THAN THROUGH THE SCREENS. Route
 * modules under src/app cannot be imported by a test in this repo at all —
 * expo-router and react-native internals fail to parse under Vite — so a
 * rule only /deze-week or /boodschappen asserts is a rule nothing asserts.
 * That matters more here than usual, because the whole point of the change
 * these tests cover is that the rule lives at the seam and NOT in either
 * screen: both read one query, and a filter either of them applied
 * privately would be a second definition of the week.
 *
 * THE TWO GROUPS:
 *
 *   1. AN ARCHIVED DISH IS NOT PLANNED. `archiveMeal` never touches saves,
 *      so before this filter existed a dish removed from Mijn recepten kept
 *      its `this_week` save forever and kept its ingredients on the
 *      shopping list, with no act available to any household that could
 *      stop it. The asymmetry with `listSaves` is asserted too, because the
 *      raw read is the only thing that can still see the row, and losing
 *      that would leave nothing able to tell "hidden" from "deleted" —
 *      which group 2 depends on being able to do.
 *
 *   2. `removeSaves` DELETES, AND DELETES EXACTLY WHAT IT SAID. One
 *      household, one meal, one intent: not the copy the household next
 *      door holds, not the same dish's "ooit" commitment, and not the meal,
 *      whose row has to survive so the dish stays in Mijn recepten and
 *      stays a rotation candidate — which is the whole of this method's
 *      answer to PD-004a. That N saves for one dish leave together is
 *      asserted here as well, since folding them into one row is exactly
 *      what src/domain/weekPlan.ts does on screen.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { createInMemoryKeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalRepository } from '@/lib/repository/localRepository';
import type { CreateMealInput, RemyRepository } from '@/lib/repository/types';

const HOUSEHOLD_ID = 'household-1';
const OTHER_HOUSEHOLD_ID = 'household-2';

function makeCreateMealInput(overrides: Partial<CreateMealInput> = {}): CreateMealInput {
  return {
    householdId: HOUSEHOLD_ID,
    title: 'Kip met citroen',
    source: 'saved',
    estimatedMinutes: 25,
    skillLevel: null,
    servings: 4,
    ingredientTags: [],
    allergenTagStatus: 'unknown',
    dishTags: [],
    sourceUrl: null,
    sourcePlatform: null,
    thumbnailUrl: null,
    ingredients: [{ name: 'kipfilet', quantity: '400', unit: 'g', sortOrder: 0 }],
    steps: [{ stepNumber: 1, instruction: 'Bak de kip.', durationMinutes: null }],
    ...overrides,
  };
}

describe('listPendingSaves — an archived dish is no longer planned', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('a this_week save stops being pending once its meal is archived, so the shopping list stops buying for it', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: meal.id,
      intent: 'this_week',
      sourceUrl: null,
    });
    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'this_week')).toHaveLength(1);

    await repository.archiveMeal(meal.id);

    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'this_week')).toHaveLength(0);
  });

  test('an archived dish is withheld from the decision engine too — an ooit save stops being pending on the same fact', async () => {
    const meal = await repository.createMeal(makeCreateMealInput({ title: 'Ooit' }));
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: meal.id,
      intent: 'someday',
      sourceUrl: null,
    });

    await repository.archiveMeal(meal.id);

    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'someday')).toHaveLength(0);
  });

  test('archiving one dish leaves every other planned dish standing', async () => {
    const archived = await repository.createMeal(makeCreateMealInput({ title: 'Weg' }));
    const kept = await repository.createMeal(makeCreateMealInput({ title: 'Blijft' }));
    for (const mealId of [archived.id, kept.id]) {
      await repository.createSave({
        householdId: HOUSEHOLD_ID,
        memberId: null,
        mealId,
        intent: 'this_week',
        sourceUrl: null,
      });
    }

    await repository.archiveMeal(archived.id);

    const pending = await repository.listPendingSaves(HOUSEHOLD_ID, 'this_week');
    expect(pending.map((save) => save.mealId)).toEqual([kept.id]);
  });

  test('a save whose meal row cannot be read at all still counts as pending — absent is not archived', async () => {
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: 'meal-that-was-never-created',
      intent: 'this_week',
      sourceUrl: null,
    });

    // src/domain/weekPlan.ts reports this as `unresolvedMealIds` rather than
    // dropping it, because the shopping list still counts it; filtering it
    // here would make the two screens disagree about the size of one week.
    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'this_week')).toHaveLength(1);
  });

  test('listSaves still returns the archived save — the raw read is what can tell hidden apart from deleted', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: meal.id,
      intent: 'this_week',
      sourceUrl: null,
    });

    await repository.archiveMeal(meal.id);

    expect(await repository.listSaves(HOUSEHOLD_ID)).toHaveLength(1);
  });
});

describe('removeSaves — van deze week af', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('removes the dish from this week, in both the pending view and the raw table', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: meal.id,
      intent: 'this_week',
      sourceUrl: null,
    });

    await repository.removeSaves(HOUSEHOLD_ID, meal.id, 'this_week');

    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'this_week')).toHaveLength(0);
    expect(await repository.listSaves(HOUSEHOLD_ID)).toHaveLength(0);
  });

  test('every save for that dish and intent goes at once — two members planning one dinner is still one dinner', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    for (const memberId of ['member-1', 'member-2']) {
      await repository.createSave({
        householdId: HOUSEHOLD_ID,
        memberId,
        mealId: meal.id,
        intent: 'this_week',
        sourceUrl: null,
      });
    }
    expect(await repository.listSaves(HOUSEHOLD_ID)).toHaveLength(2);

    await repository.removeSaves(HOUSEHOLD_ID, meal.id, 'this_week');

    expect(await repository.listSaves(HOUSEHOLD_ID)).toHaveLength(0);
  });

  test('the ooit commitment for the same dish survives being taken off this week — two commitments, cancelled separately', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    for (const intent of ['this_week', 'someday'] as const) {
      await repository.createSave({
        householdId: HOUSEHOLD_ID,
        memberId: null,
        mealId: meal.id,
        intent,
        sourceUrl: null,
      });
    }

    await repository.removeSaves(HOUSEHOLD_ID, meal.id, 'this_week');

    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'this_week')).toHaveLength(0);
    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'someday')).toHaveLength(1);
  });

  test('another dish planned the same week is untouched', async () => {
    const removed = await repository.createMeal(makeCreateMealInput({ title: 'Weg' }));
    const kept = await repository.createMeal(makeCreateMealInput({ title: 'Blijft' }));
    for (const mealId of [removed.id, kept.id]) {
      await repository.createSave({
        householdId: HOUSEHOLD_ID,
        memberId: null,
        mealId,
        intent: 'this_week',
        sourceUrl: null,
      });
    }

    await repository.removeSaves(HOUSEHOLD_ID, removed.id, 'this_week');

    const pending = await repository.listPendingSaves(HOUSEHOLD_ID, 'this_week');
    expect(pending.map((save) => save.mealId)).toEqual([kept.id]);
  });

  test('a save another household holds for the same meal is untouched — this table holds every household in one key', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: meal.id,
      intent: 'this_week',
      sourceUrl: null,
    });
    await repository.createSave({
      householdId: OTHER_HOUSEHOLD_ID,
      memberId: null,
      mealId: meal.id,
      intent: 'this_week',
      sourceUrl: null,
    });

    await repository.removeSaves(HOUSEHOLD_ID, meal.id, 'this_week');

    expect(await repository.listSaves(HOUSEHOLD_ID)).toHaveLength(0);
    expect(await repository.listSaves(OTHER_HOUSEHOLD_ID)).toHaveLength(1);
  });

  test('the meal itself survives — PD-004a: an unplanned dish is still in Mijn recepten and still a rotation candidate', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: meal.id,
      intent: 'this_week',
      sourceUrl: null,
    });

    await repository.removeSaves(HOUSEHOLD_ID, meal.id, 'this_week');

    const stillThere = await repository.getMeal(meal.id);
    expect(stillThere?.archivedAt).toBeNull();
    const candidates = await repository.listHouseholdMeals(HOUSEHOLD_ID);
    expect(candidates.map((candidate) => candidate.id)).toContain(meal.id);
  });

  test('is idempotent and silent on a dish that was never planned — a second tap is not an error', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());

    await expect(repository.removeSaves(HOUSEHOLD_ID, meal.id, 'this_week')).resolves.toBeUndefined();
    await expect(repository.removeSaves(HOUSEHOLD_ID, 'nope', 'this_week')).resolves.toBeUndefined();
  });
});

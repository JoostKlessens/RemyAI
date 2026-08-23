import { beforeEach, describe, expect, test } from 'vitest';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalRepository } from '@/lib/repository/localRepository';
import type { CreateMealInput, RemyRepository } from '@/lib/repository/types';

const HOUSEHOLD_ID = 'household-1';

function makeCreateMealInput(overrides: Partial<CreateMealInput> = {}): CreateMealInput {
  return {
    householdId: HOUSEHOLD_ID,
    title: 'Test gerecht',
    source: 'saved',
    estimatedMinutes: 20,
    skillLevel: null,
    servings: 4,
    ingredientTags: [],
    allergenTagStatus: 'unknown',
    sourceUrl: 'https://www.tiktok.com/@test/video/1',
    sourcePlatform: 'tiktok',
    ingredients: [{ name: '400 g kipfilet', quantity: null, unit: null, sortOrder: 0 }],
    steps: [{ stepNumber: 1, instruction: 'Bak de kip.', durationMinutes: null }],
    ...overrides,
  };
}

describe('localRepository — seeding', () => {
  test('seedIfEmpty populates the household/meals/saves from fixture data on a fresh store', async () => {
    const store = createInMemoryKeyValueStore();
    const repository = createLocalRepository(store);

    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();
    const meals = await repository.listHouseholdMeals(householdId);
    const saves = await repository.listSaves(householdId);

    expect(householdId).toBe('household-1');
    expect(meals.length).toBeGreaterThan(0);
    expect(saves.length).toBeGreaterThan(0);
  });

  test('seedIfEmpty is a no-op once a household already exists — a real save is never clobbered by re-seeding', async () => {
    const store = createInMemoryKeyValueStore();
    const repository = createLocalRepository(store);
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    const created = await repository.createMeal(makeCreateMealInput({ householdId }));
    await repository.seedIfEmpty();

    const meals = await repository.listHouseholdMeals(householdId);
    expect(meals.some((meal) => meal.id === created.id)).toBe(true);
  });

  test('getCurrentHouseholdId throws before anything has been seeded — a caller must seed first', async () => {
    const store = createInMemoryKeyValueStore();
    const repository = createLocalRepository(store);

    await expect(repository.getCurrentHouseholdId()).rejects.toThrow();
  });
});

describe('localRepository — meals (+ ingredients, + steps)', () => {
  let store: KeyValueStore;
  let repository: RemyRepository;

  beforeEach(() => {
    store = createInMemoryKeyValueStore();
    repository = createLocalRepository(store);
  });

  test('createMeal writes a real meal + ingredients + steps, readable back by id', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    const meal = await repository.getMeal(created.id);
    const ingredients = await repository.getMealIngredients(created.id);
    const steps = await repository.getMealSteps(created.id);

    expect(meal?.title).toBe('Test gerecht');
    expect(meal?.source).toBe('saved');
    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]?.name).toBe('400 g kipfilet');
    expect(steps).toHaveLength(1);
    expect(steps[0]?.instruction).toBe('Bak de kip.');
  });

  test('a created meal survives a fresh repository instance over the same store — "survives an app restart"', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    // A brand-new repository instance wrapping the SAME store simulates an
    // app restart: nothing here is in-memory state shared with `repository`.
    const restarted = createLocalRepository(store);
    const meal = await restarted.getMeal(created.id);

    expect(meal?.id).toBe(created.id);
    expect(meal?.title).toBe('Test gerecht');
  });

  test("createMeal preserves the confirm screen's own allergen tagging, not toMealDraft's always-unknown default", async () => {
    const created = await repository.createMeal(
      makeCreateMealInput({ ingredientTags: ['noten'], allergenTagStatus: 'verified' }),
    );

    expect(created.ingredientTags).toEqual(['noten']);
    expect(created.allergenTagStatus).toBe('verified');
  });

  test("listHouseholdMeals includes the household's own meals and curated (null householdId) meals", async () => {
    // Matches real app ordering (src/app/_layout.tsx awaits ensureSeeded()
    // before any screen can write): seed first, then create.
    await repository.seedIfEmpty();
    await repository.createMeal(makeCreateMealInput({ householdId: HOUSEHOLD_ID, title: 'Eigen gerecht' }));

    const meals = await repository.listHouseholdMeals(HOUSEHOLD_ID);
    expect(meals.some((meal) => meal.title === 'Eigen gerecht')).toBe(true);
    expect(meals.some((meal) => meal.householdId === null)).toBe(true);
  });

  test("listHouseholdMeals excludes another household's meals", async () => {
    await repository.createMeal(makeCreateMealInput({ householdId: 'other-household', title: 'Niet van mij' }));

    const meals = await repository.listHouseholdMeals(HOUSEHOLD_ID);
    expect(meals.some((meal) => meal.title === 'Niet van mij')).toBe(false);
  });
});

describe('localRepository — saves (PD-004a)', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('createSave writes a real save row, readable back via listSaves', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const save = await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: 'member-1',
      mealId: meal.id,
      intent: 'someday',
      sourceUrl: null,
    });

    const saves = await repository.listSaves(HOUSEHOLD_ID);
    expect(saves.find((s) => s.id === save.id)?.intent).toBe('someday');
  });

  test('listPendingSaves only returns saves of the requested intent', async () => {
    const thisWeekMeal = await repository.createMeal(makeCreateMealInput({ title: 'Deze week' }));
    const somedayMeal = await repository.createMeal(makeCreateMealInput({ title: 'Ooit' }));
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: thisWeekMeal.id,
      intent: 'this_week',
      sourceUrl: null,
    });
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: somedayMeal.id,
      intent: 'someday',
      sourceUrl: null,
    });

    const pendingSomeday = await repository.listPendingSaves(HOUSEHOLD_ID, 'someday');
    expect(pendingSomeday).toHaveLength(1);
    expect(pendingSomeday[0]?.mealId).toBe(somedayMeal.id);
  });

  test('a save stops being "pending" once its meal has a cook event on or after the save date', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    await repository.createSave({
      householdId: HOUSEHOLD_ID,
      memberId: null,
      mealId: meal.id,
      intent: 'someday',
      sourceUrl: null,
    });
    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'someday')).toHaveLength(1);

    await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: new Date().toISOString().slice(0, 10),
    });

    expect(await repository.listPendingSaves(HOUSEHOLD_ID, 'someday')).toHaveLength(0);
  });
});

describe('localRepository — cook events (outcome loop, PD-003)', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('createCookEvent writes a real row with wouldRepeat null, then setCookEventRepeat fills it in', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const cookEvent = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-22',
    });
    expect(cookEvent.wouldRepeat).toBeNull();

    const updated = await repository.setCookEventRepeat(cookEvent.id, true);
    expect(updated.wouldRepeat).toBe(true);
    expect(updated.id).toBe(cookEvent.id);
  });

  test('getPendingOutcomeDecision returns an accepted decision with no recorded cook event', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const decision = await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-21',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });
    await repository.respondToDecision(decision.id, { status: 'accepted' });

    const pending = await repository.getPendingOutcomeDecision(HOUSEHOLD_ID);
    expect(pending?.id).toBe(decision.id);
  });

  test('getPendingOutcomeDecision returns null once a cook event references the decision', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const decision = await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-21',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });
    await repository.respondToDecision(decision.id, { status: 'accepted' });
    await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: decision.id,
      cookedOn: '2026-08-21',
    });

    expect(await repository.getPendingOutcomeDecision(HOUSEHOLD_ID)).toBeNull();
  });

  test('getPendingOutcomeDecision ignores a still-pending (not yet accepted) decision', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-22',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });

    expect(await repository.getPendingOutcomeDecision(HOUSEHOLD_ID)).toBeNull();
  });
});

describe('localRepository — decisions (decision responses)', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('createDecision is an upsert-by-date — calling it twice for the same date returns the same row', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const first = await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-22',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });
    const second = await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-22',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'fallback',
      reasonText: 'Een optie voor vanavond',
    });

    expect(second.id).toBe(first.id);
    expect(second.reasonCode).toBe('variety');
  });

  test('updateDecisionOffer advances mealId + reason on a swap without touching initialMealId', async () => {
    const mealA = await repository.createMeal(makeCreateMealInput({ title: 'A' }));
    const mealB = await repository.createMeal(makeCreateMealInput({ title: 'B' }));
    const decision = await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-22',
      mealId: mealA.id,
      initialMealId: mealA.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });

    const swapped = await repository.updateDecisionOffer(decision.id, {
      mealId: mealB.id,
      reasonCode: 'fits_time',
      reasonText: 'Klaar in 15 minuten',
    });

    expect(swapped.mealId).toBe(mealB.id);
    expect(swapped.initialMealId).toBe(mealA.id);
    expect(swapped.reasonCode).toBe('fits_time');
    expect(swapped.reasonText).toBe('Klaar in 15 minuten');
  });

  test('respondToDecision sets status and respondedAt', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const decision = await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-22',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });
    expect(decision.status).toBe('pending');
    expect(decision.respondedAt).toBeNull();

    const responded = await repository.respondToDecision(decision.id, { status: 'skipped' });

    expect(responded.status).toBe('skipped');
    expect(responded.respondedAt).not.toBeNull();
  });

  test('setDecisionDeclineReason updates the decline reason on an already-declined decision', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const decision = await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-22',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });
    await repository.respondToDecision(decision.id, { status: 'skipped' });

    const updated = await repository.setDecisionDeclineReason(decision.id, 'afhalen');

    expect(updated.declineReason).toBe('afhalen');
    expect(updated.status).toBe('skipped');
  });

  test('listRecentDecisions filters by householdId and decisionDate >= sinceDate', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-01',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });
    await repository.createDecision({
      householdId: HOUSEHOLD_ID,
      decisionDate: '2026-08-20',
      mealId: meal.id,
      initialMealId: meal.id,
      reasonCode: 'variety',
      reasonText: 'Nog niet eerder geprobeerd',
    });

    const recent = await repository.listRecentDecisions(HOUSEHOLD_ID, '2026-08-10');

    expect(recent).toHaveLength(1);
    expect(recent[0]?.decisionDate).toBe('2026-08-20');
  });
});

import { beforeEach, describe, expect, test } from 'vitest';
import {
  RATING_MAX,
  RATING_MIN,
  RATING_NEGATIVE_AT_OR_BELOW,
  RATING_POSITIVE_AT_OR_ABOVE,
  resolveRepeatSignal,
  toRepeatSignal,
} from '@/domain/rating';
import type { Meal } from '@/domain/types';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalRepository } from '@/lib/repository/localRepository';
import { createRepositoryTables } from '@/lib/repository/local/tables';
import type { CreateMealInput, RemyRepository } from '@/lib/repository/types';

/**
 * A curated meal (`householdId: null`) is never created through
 * `RemyRepository.createMeal` — its input type requires a real
 * `HouseholdId`, matching 0001_init.sql's `meals_insert` RLS policy, which
 * only the service-role content pipeline bypasses. This helper writes one
 * directly into the underlying table, the same way a real curated row
 * would arrive (out-of-band, not through this client), so tests can still
 * exercise `listHouseholdMeals`'s "household's own + curated" contract.
 */
function makeCuratedMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'curated-meal-1',
    householdId: null,
    title: 'Curated gerecht',
    source: 'curated',
    estimatedMinutes: 20,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: [],
    dishTags: ['ovenschotel'],
    allergenTagStatus: 'verified',
    sourceUrl: null,
    sourcePlatform: null,
    thumbnailUrl: null,
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

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
    dishTags: ['kip'],
    allergenTagStatus: 'unknown',
    sourceUrl: 'https://www.tiktok.com/@test/video/1',
    sourcePlatform: 'tiktok',
    thumbnailUrl: null,
    ingredients: [{ name: '400 g kipfilet', quantity: null, unit: null, sortOrder: 0 }],
    steps: [{ stepNumber: 1, instruction: 'Bak de kip.', durationMinutes: null }],
    ...overrides,
  };
}

describe('localRepository — seeding', () => {
  test('seedIfEmpty creates exactly one default household and nothing else — an honest empty first run', async () => {
    const store = createInMemoryKeyValueStore();
    const repository = createLocalRepository(store);

    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();
    const household = await repository.getHousehold(householdId);
    const meals = await repository.listHouseholdMeals(householdId);
    const saves = await repository.listSaves(householdId);
    const members = await repository.listMembers(householdId);
    const restrictions = await repository.listRestrictions(householdId);

    expect(household).not.toBeNull();
    expect(household?.weeknightTimeBudgetMinutes).toBeGreaterThan(0);
    // Curated (householdId null) meals would still show up here if any
    // existed — none do on a fresh store, so this is a genuine "nothing at
    // all" assertion, not just "nothing of mine".
    expect(meals).toHaveLength(0);
    expect(saves).toHaveLength(0);
    expect(members).toHaveLength(0);
    expect(restrictions).toHaveLength(0);
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

  /**
   * PD-006 at the persistence seam. `dishTags` and `ingredientTags` are
   * both `text[]` on the same row, so the only thing keeping a category
   * out of the exclusion gate is that they are separate columns written
   * from separate inputs — asserted here rather than assumed.
   */
  test('createMeal persists dishTags without touching ingredientTags', async () => {
    const created = await repository.createMeal(
      makeCreateMealInput({ dishTags: ['pasta', 'vegetarisch'], ingredientTags: ['gluten'] }),
    );

    expect(created.dishTags).toEqual(['pasta', 'vegetarisch']);
    expect(created.ingredientTags).toEqual(['gluten']);
  });

  test('createMeal stores an empty dishTags list for a meal with no categories', async () => {
    const created = await repository.createMeal(makeCreateMealInput({ dishTags: [] }));
    expect(created.dishTags).toEqual([]);
  });

  test('createMeal survives an app restart with its dishTags intact', async () => {
    const created = await repository.createMeal(makeCreateMealInput({ dishTags: ['curry', 'rijst'] }));

    const restarted = createLocalRepository(store);
    expect((await restarted.getMeal(created.id))?.dishTags).toEqual(['curry', 'rijst']);
  });

  /**
   * `Meal.dishTags` is a required, non-nullable array, but rows written by
   * a build that predates it are sitting in real installs' AsyncStorage
   * without the key. Reading one back would hand every downstream caller
   * an `undefined` where the type promises an array — a crash on the first
   * `.some()`, not a missing filter. The read path backfills instead, in
   * the same spirit as table.ts's "persisted storage is untrusted" note.
   */
  test('reads a meal row written before dishTags existed as having no categories, never undefined', async () => {
    const tables = createRepositoryTables(store);
    const { dishTags: _dishTags, ...legacyRow } = makeCuratedMeal();
    await tables.meals.replaceAll([legacyRow as Meal]);

    const meal = await repository.getMeal('curated-meal-1');
    expect(meal?.dishTags).toEqual([]);

    const listed = await repository.listHouseholdMeals(HOUSEHOLD_ID);
    expect(listed.find((entry) => entry.id === 'curated-meal-1')?.dishTags).toEqual([]);
  });

  test('createMeal persists thumbnailUrl, and a meal without one stores null so the library can fall back to a monogram', async () => {
    const withThumbnail = await repository.createMeal(
      makeCreateMealInput({ thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg' }),
    );
    const withoutThumbnail = await repository.createMeal(makeCreateMealInput({ thumbnailUrl: null }));

    expect(withThumbnail.thumbnailUrl).toBe('https://p16-sign.tiktokcdn.com/thumb.jpg');
    expect(withoutThumbnail.thumbnailUrl).toBeNull();
  });

  test("listHouseholdMeals includes the household's own meals and curated (null householdId) meals", async () => {
    // Matches real app ordering (src/app/_layout.tsx awaits ensureSeeded()
    // before any screen can write): seed first, then create.
    await repository.seedIfEmpty();
    await repository.createMeal(makeCreateMealInput({ householdId: HOUSEHOLD_ID, title: 'Eigen gerecht' }));
    // Curated meals arrive out-of-band (service role, not this client) —
    // see makeCuratedMeal's own comment.
    const tables = createRepositoryTables(store);
    await tables.meals.replaceAll([...(await tables.meals.list()), makeCuratedMeal()]);

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

  /**
   * Fase 4. The scale itself lives in src/domain/rating.ts and is never
   * spelled out here — every expectation below is derived from its
   * constants, so a move to a 1-10 scale stays one edit there plus one
   * CHECK constraint in a migration, exactly as rating.ts's header
   * promises.
   */
  test('createCookEvent leaves rating unset — the question has not been asked yet, and unasked is not neutral', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const cookEvent = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-22',
    });

    expect(cookEvent.rating).toBeNull();
    expect(resolveRepeatSignal(cookEvent)).toBeNull();
  });

  test('setCookEventRating stores the score and projects a high one onto wouldRepeat', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const cookEvent = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-22',
    });

    const updated = await repository.setCookEventRating(cookEvent.id, RATING_MAX);

    expect(updated.id).toBe(cookEvent.id);
    expect(updated.rating).toBe(RATING_MAX);
    expect(updated.wouldRepeat).toBe(toRepeatSignal(RATING_MAX));
    expect(updated.wouldRepeat).toBe(true);
  });

  test('setCookEventRating projects a low score onto wouldRepeat false', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const cookEvent = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-22',
    });

    const updated = await repository.setCookEventRating(cookEvent.id, RATING_MIN);

    expect(updated.rating).toBe(RATING_MIN);
    expect(updated.wouldRepeat).toBe(false);
  });

  /**
   * The whole reason `wouldRepeat` survives alongside `rating`: a shrug
   * must not inflate scoring.ts's HOUSEHOLD_FAVOURITE_BOOST, and it must
   * not trigger WOULD_NOT_REPEAT_PENALTY either. The score is still
   * recorded — the household did say something — it just produces no
   * signal.
   */
  test('setCookEventRating records a middling score but leaves wouldRepeat null — recorded, never scored', async () => {
    const middleBandRating = RATING_NEGATIVE_AT_OR_BELOW + 1;
    expect(middleBandRating).toBeLessThan(RATING_POSITIVE_AT_OR_ABOVE);

    const meal = await repository.createMeal(makeCreateMealInput());
    const cookEvent = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-22',
    });

    const updated = await repository.setCookEventRating(cookEvent.id, middleBandRating);

    expect(updated.rating).toBe(middleBandRating);
    expect(updated.wouldRepeat).toBeNull();
  });

  /**
   * A previously answered "Nog een keer?" must not survive underneath a
   * later score that contradicts it. `resolveRepeatSignal` prefers the
   * score, so a stale `wouldRepeat` would be invisible in the app yet
   * still wrong in any query (or future Supabase view) reading the column
   * directly. Overwriting it back to null is the honest state.
   */
  test('setCookEventRating clears a stale wouldRepeat when the new score carries no signal', async () => {
    const middleBandRating = RATING_NEGATIVE_AT_OR_BELOW + 1;
    const meal = await repository.createMeal(makeCreateMealInput());
    const cookEvent = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-22',
    });
    await repository.setCookEventRepeat(cookEvent.id, true);

    const updated = await repository.setCookEventRating(cookEvent.id, middleBandRating);

    expect(updated.wouldRepeat).toBeNull();
  });

  test('setCookEventRating refuses an off-scale score rather than storing an opinion nobody expressed', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const cookEvent = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-22',
    });

    await expect(repository.setCookEventRating(cookEvent.id, RATING_MAX + 1)).rejects.toThrow();
    await expect(repository.setCookEventRating(cookEvent.id, RATING_MIN - 1)).rejects.toThrow();
    await expect(repository.setCookEventRating(cookEvent.id, RATING_MIN + 0.55)).rejects.toThrow();

    const events = await repository.listCookEvents(HOUSEHOLD_ID);
    expect(events.find((event) => event.id === cookEvent.id)?.rating).toBeNull();
  });

  test('setCookEventRating throws for an unknown cook event id instead of silently writing nothing', async () => {
    await expect(repository.setCookEventRating('does-not-exist', RATING_MAX)).rejects.toThrow();
  });

  test('setCookEventRating leaves every other cook event untouched', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());
    const rated = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-22',
    });
    const untouched = await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-23',
    });

    await repository.setCookEventRating(rated.id, RATING_MAX);

    const events = await repository.listCookEvents(HOUSEHOLD_ID);
    expect(events.find((event) => event.id === untouched.id)?.rating).toBeNull();
    expect(events.find((event) => event.id === untouched.id)?.wouldRepeat).toBeNull();
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

describe('localRepository — household settings screen (PD-006 needs somewhere to write)', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('updateHouseholdSettings persists a new weeknight time budget', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    const updated = await repository.updateHouseholdSettings(householdId, { weeknightTimeBudgetMinutes: 45 });

    expect(updated.weeknightTimeBudgetMinutes).toBe(45);
    expect((await repository.getHousehold(householdId))?.weeknightTimeBudgetMinutes).toBe(45);
  });

  test('createMember writes a real member with no health data consent yet', async () => {
    const member = await repository.createMember({ householdId: HOUSEHOLD_ID, displayName: 'Sanne' });

    expect(member.displayName).toBe('Sanne');
    expect(member.healthDataConsentAt).toBeNull();
    expect(await repository.listMembers(HOUSEHOLD_ID)).toContainEqual(member);
  });

  test('setMemberHealthDataConsent sets and revokes consent (PD-005)', async () => {
    const member = await repository.createMember({ householdId: HOUSEHOLD_ID, displayName: 'Joost' });

    const consented = await repository.setMemberHealthDataConsent(member.id, '2026-08-22T10:00:00.000Z');
    expect(consented.healthDataConsentAt).toBe('2026-08-22T10:00:00.000Z');

    const revoked = await repository.setMemberHealthDataConsent(member.id, null);
    expect(revoked.healthDataConsentAt).toBeNull();
  });

  test('removeMember deletes the member and every restriction attached to them (PD-005 hard-delete)', async () => {
    const member = await repository.createMember({ householdId: HOUSEHOLD_ID, displayName: 'Kees' });
    await repository.createRestriction({ memberId: member.id, type: 'allergen', excludesTag: 'noten', notes: null });

    await repository.removeMember(member.id);

    expect(await repository.listMembers(HOUSEHOLD_ID)).toHaveLength(0);
    expect(await repository.listRestrictions(HOUSEHOLD_ID)).toHaveLength(0);
  });

  test('createRestriction and removeRestriction round-trip a dislike/allergen tag, readable via listRestrictions', async () => {
    const member = await repository.createMember({ householdId: HOUSEHOLD_ID, displayName: 'Sanne' });

    const restriction = await repository.createRestriction({
      memberId: member.id,
      type: 'allergen',
      excludesTag: 'pinda',
      notes: null,
    });
    expect(await repository.listRestrictions(HOUSEHOLD_ID)).toContainEqual(restriction);

    await repository.removeRestriction(restriction.id);
    expect(await repository.listRestrictions(HOUSEHOLD_ID)).toHaveLength(0);
  });

  test('listRestrictions never returns a restriction belonging to another household', async () => {
    const ownMember = await repository.createMember({ householdId: HOUSEHOLD_ID, displayName: 'Sanne' });
    const otherMember = await repository.createMember({ householdId: 'other-household', displayName: 'Anna' });
    await repository.createRestriction({ memberId: ownMember.id, type: 'dislike', excludesTag: 'paddenstoelen', notes: null });
    await repository.createRestriction({ memberId: otherMember.id, type: 'dislike', excludesTag: 'ui', notes: null });

    const restrictions = await repository.listRestrictions(HOUSEHOLD_ID);

    expect(restrictions).toHaveLength(1);
    expect(restrictions[0]?.excludesTag).toBe('paddenstoelen');
  });
});

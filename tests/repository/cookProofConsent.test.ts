/**
 * The two PD-010 / DESIGN-SOCIAL.md §5 consent controls at the repository
 * seam: `households.share_cooks_with_friends` (the one global cook-proof
 * opt-in) and `meals.excluded_from_cook_proof` ("Deel deze niet",
 * DESIGN-SOCIAL.md §3.5) — both added by
 * supabase/migrations/0009_cook_proof_and_sends.sql.
 *
 * Its own file rather than more cases inside localRepository.test.ts
 * because the property that actually matters here is not "the value round
 * trips" — that is one assertion each — but the INDEPENDENCE of the two
 * controls, which needs both of them driven together against one store.
 * 0009's own column comment is the contract these tests hold to
 * ("independent of households.share_cooks_with_friends and unaffected by
 * toggling it"), and a single global switch is only honest if that
 * sentence is literally true of the code rather than merely intended by
 * it.
 *
 * Both getters are asserted to REFUSE an unknown id rather than answer
 * `false`. That is the one behaviour here worth a test of its own: a
 * lookup miss answered with `false` reads, at the call site, exactly like
 * a household that deliberately never opted in, and on the meal side it
 * fails open — "no such meal" would silently become "share it".
 */

import { beforeEach, describe, expect, test } from 'vitest';
import type { Household, Meal } from '@/domain/types';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalRepository } from '@/lib/repository/localRepository';
import { createRepositoryTables } from '@/lib/repository/local/tables';
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
    dishTags: ['kip'],
    allergenTagStatus: 'unknown',
    sourceUrl: null,
    sourcePlatform: null,
    thumbnailUrl: null,
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

describe('cook-proof consent — the global opt-in (households.share_cooks_with_friends)', () => {
  let store: KeyValueStore;
  let repository: RemyRepository;

  beforeEach(() => {
    store = createInMemoryKeyValueStore();
    repository = createLocalRepository(store);
  });

  test('a freshly seeded household shares nothing — the default IS the consent model', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    expect(await repository.getHouseholdCookSharing(householdId)).toBe(false);
  });

  test('setHouseholdCookSharing turns the opt-in on and back off, and the change survives a re-read', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    const consented = await repository.setHouseholdCookSharing(householdId, true);
    expect(consented.shareCooksWithFriends).toBe(true);
    expect(await repository.getHouseholdCookSharing(householdId)).toBe(true);

    const revoked = await repository.setHouseholdCookSharing(householdId, false);
    expect(revoked.shareCooksWithFriends).toBe(false);
    expect(await repository.getHouseholdCookSharing(householdId)).toBe(false);
  });

  test('setHouseholdCookSharing leaves every other household field alone', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();
    const before = await repository.getHousehold(householdId);

    const after = await repository.setHouseholdCookSharing(householdId, true);

    expect({ ...after, shareCooksWithFriends: undefined }).toEqual({ ...before, shareCooksWithFriends: undefined });
  });

  test('a household row written before this column existed reads as "never opted in", not as consent', async () => {
    const tables = createRepositoryTables(store);
    const legacy: Household = {
      id: HOUSEHOLD_ID,
      name: 'Mijn huishouden',
      timezone: 'Europe/Amsterdam',
      decisionPushTime: '16:00',
      weeknightTimeBudgetMinutes: 30,
      skillLevel: 'intermediate',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    await tables.households.replaceAll([legacy]);

    expect(await repository.getHouseholdCookSharing(HOUSEHOLD_ID)).toBe(false);
  });

  test('getHouseholdCookSharing refuses an unknown household rather than answering "not consented"', async () => {
    await expect(repository.getHouseholdCookSharing('no-such-household')).rejects.toThrow(/no-such-household/);
  });

  test('setHouseholdCookSharing refuses an unknown household', async () => {
    await expect(repository.setHouseholdCookSharing('no-such-household', true)).rejects.toThrow(/no-such-household/);
  });
});

describe('cook-proof consent — the per-meal exclusion (meals.excluded_from_cook_proof)', () => {
  let store: KeyValueStore;
  let repository: RemyRepository;

  beforeEach(() => {
    store = createInMemoryKeyValueStore();
    repository = createLocalRepository(store);
  });

  test('a newly created meal is not excluded, and says so explicitly on the stored row', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());

    expect(meal.excludedFromCookProof).toBe(false);
    expect(await repository.getMealCookProofExclusion(meal.id)).toBe(false);
  });

  test('setMealCookProofExclusion excludes a meal and un-excludes it again ("Weer delen")', async () => {
    const meal = await repository.createMeal(makeCreateMealInput());

    const excluded = await repository.setMealCookProofExclusion(meal.id, true);
    expect(excluded.excludedFromCookProof).toBe(true);
    expect((await repository.getMeal(meal.id))?.excludedFromCookProof).toBe(true);

    const shared = await repository.setMealCookProofExclusion(meal.id, false);
    expect(shared.excludedFromCookProof).toBe(false);
    expect(await repository.getMealCookProofExclusion(meal.id)).toBe(false);
  });

  test('excluding one meal never touches another meal in the same household', async () => {
    const excluded = await repository.createMeal(makeCreateMealInput({ title: 'Medisch dieet' }));
    const untouched = await repository.createMeal(makeCreateMealInput({ title: 'Pasta pesto' }));

    await repository.setMealCookProofExclusion(excluded.id, true);

    expect(await repository.getMealCookProofExclusion(untouched.id)).toBe(false);
  });

  test('a meal row written before this column existed reads as "not excluded"', async () => {
    const tables = createRepositoryTables(store);
    const created = await repository.createMeal(makeCreateMealInput());
    const { excludedFromCookProof: _excluded, ...legacyRow } = created;
    await tables.meals.replaceAll([legacyRow as Meal]);

    expect(await repository.getMealCookProofExclusion(created.id)).toBe(false);
  });

  test('getMealCookProofExclusion refuses an unknown meal rather than failing open', async () => {
    await expect(repository.getMealCookProofExclusion('no-such-meal')).rejects.toThrow(/no-such-meal/);
  });

  test('setMealCookProofExclusion refuses an unknown meal', async () => {
    await expect(repository.setMealCookProofExclusion('no-such-meal', true)).rejects.toThrow(/no-such-meal/);
  });
});

describe('cook-proof consent — the two controls are independent (0009 says so in the column comment)', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('a per-meal exclusion survives the global switch being toggled off and on', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();
    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));

    await repository.setHouseholdCookSharing(householdId, true);
    await repository.setMealCookProofExclusion(meal.id, true);

    await repository.setHouseholdCookSharing(householdId, false);
    expect(await repository.getMealCookProofExclusion(meal.id)).toBe(true);

    await repository.setHouseholdCookSharing(householdId, true);
    expect(await repository.getMealCookProofExclusion(meal.id)).toBe(true);
  });

  test('excluding a meal does not silently revoke the household opt-in', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();
    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));
    await repository.setHouseholdCookSharing(householdId, true);

    await repository.setMealCookProofExclusion(meal.id, true);

    expect(await repository.getHouseholdCookSharing(householdId)).toBe(true);
  });

  test('a meal can be excluded while the household has never opted in at all', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();
    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));

    await repository.setMealCookProofExclusion(meal.id, true);

    expect(await repository.getMealCookProofExclusion(meal.id)).toBe(true);
    expect(await repository.getHouseholdCookSharing(householdId)).toBe(false);
  });
});

describe('createMeal writes the whole meal row', () => {
  /**
   * A key-set assertion, not a spot check on the one field this change
   * adds. `buildMealRow` is a wide object literal that several agents now
   * edit in sequence, and a field silently dropped from it is invisible to
   * every test that asserts only on what it came to check — the row still
   * saves, the app still runs, and the loss only surfaces later as an
   * `undefined` somewhere far away. Listing the keys turns any such drop
   * into a failing test on the very next run instead.
   */
  test('every field a meal row carries is present after createMeal', async () => {
    const repository = createLocalRepository(createInMemoryKeyValueStore());

    const meal = await repository.createMeal(makeCreateMealInput());

    expect(Object.keys(meal).sort()).toEqual(
      [
        'allergenTagStatus',
        'archivedAt',
        'createdAt',
        // Written as `[]` by `buildMealRow`, never taken from the input:
        // a meal is never born with a mood (see `Meal.dishMoods`). Its
        // presence here is what proves the row states that explicitly
        // rather than leaving the key absent for a reader to interpret.
        'dishMoods',
        'dishTags',
        'estimatedMinutes',
        'excludedFromCookProof',
        'householdId',
        'id',
        'ingredientTags',
        'recipeId',
        'servings',
        'skillLevel',
        'source',
        'sourcePlatform',
        'sourceUrl',
        'thumbnailUrl',
        'title',
      ].sort(),
    );
  });
});

/**
 * RCP-03 — `RemyRepository.updateMealRecipe`, held to the four promises its
 * comment in src/lib/repository/types.ts makes.
 *
 * WHY THESE TESTS EXIST AT THE REPOSITORY LEVEL AND NOT ONLY THROUGH THE
 * SCREEN. Route modules under src/app cannot be imported by a test in this
 * repo at all — expo-router and react-native internals fail to parse under
 * Vite — so a guarantee only the screen asserts is a guarantee nothing
 * asserts. Three of the four promises below are also ones a screen could
 * not check even if it could be imported: what a write did NOT touch, what
 * reached the mirror, and what happened to a row the caller never mentioned.
 *
 * THE FOUR:
 *
 *   1. THE EDIT LANDS. Title, time, servings, ingredients and steps are
 *      what comes back, and the child rows are REPLACED rather than
 *      appended to — an append is the bug this method exists in the shadow
 *      of, since `createMeal` was the only child writer before it.
 *
 *   2. NOTHING ELSE MOVES. The long list of fields an edit must leave alone
 *      (provenance, the canonical recipe link, cook-proof exclusion,
 *      archive state, dish tags, creation time) is asserted field by field,
 *      because "touches nothing else" is the kind of promise that decays
 *      one convenient spread at a time.
 *
 *   3. PD-006 IS ENFORCED AT THIS SEAM, NOT ABOVE IT. The demotion rule
 *      lives in src/domain/mealAllergenReverification.ts and is unit-tested
 *      there; what is tested HERE is that the repository actually applies
 *      it, against the STORED ingredient list, so a screen cannot skip the
 *      comparison by asserting its own answer. This is the group that
 *      matters most — see the module header of the domain file for why a
 *      stale `verified` is the one failure in this codebase that can hurt
 *      somebody.
 *
 *   4. THE EDIT REACHES THE MIRROR, CARRYING THE NEW CHILDREN. A write that
 *      stops at the device is the "every layer had the value and every layer
 *      left it out" bug this repo has shipped three times. The job must
 *      carry the EDITED ingredients, which means the re-read has to happen
 *      after the replace — a detail no amount of reading localRepository.ts
 *      proves on its own.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NOT_RECHECKED, recheckedAllergens } from '@/domain/mealAllergenReverification';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalRepository, type MirrorJobSink } from '@/lib/repository/localRepository';
import type { MirrorJob, MirrorMealJob } from '@/lib/repository/mirror/types';
import type { CreateMealInput, RemyRepository, UpdateMealRecipeInput } from '@/lib/repository/types';

const HOUSEHOLD_ID = 'household-1';

function makeCreateMealInput(overrides: Partial<CreateMealInput> = {}): CreateMealInput {
  return {
    householdId: HOUSEHOLD_ID,
    title: 'Kip met citroen',
    source: 'saved',
    estimatedMinutes: 25,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: [],
    allergenTagStatus: 'unknown',
    dishTags: ['kip'],
    recipeId: 'recipe-1',
    sourceUrl: 'https://www.tiktok.com/@test/video/1',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://cdn.example/thumb.jpg',
    ingredients: [
      { name: 'kipfilet', quantity: '400', unit: 'g', sortOrder: 0 },
      { name: 'citroen', quantity: '1', unit: null, sortOrder: 1 },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Bak de kip.', durationMinutes: null },
      { stepNumber: 2, instruction: 'Pers de citroen.', durationMinutes: null },
    ],
    ...overrides,
  };
}

/**
 * The edit a caller sends when nothing about the ingredients changed —
 * every ingredient restated exactly as `makeCreateMealInput` wrote it. Used
 * as the baseline so a test that DOES change the list changes exactly the
 * one thing it is about.
 */
function makeUpdateInput(overrides: Partial<UpdateMealRecipeInput> = {}): UpdateMealRecipeInput {
  return {
    title: 'Kip met citroen',
    estimatedMinutes: 25,
    servings: 4,
    ingredients: [
      { name: 'kipfilet', quantity: '400', unit: 'g', sortOrder: 0 },
      { name: 'citroen', quantity: '1', unit: null, sortOrder: 1 },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Bak de kip.', durationMinutes: null },
      { stepNumber: 2, instruction: 'Pers de citroen.', durationMinutes: null },
    ],
    allergenCheck: NOT_RECHECKED,
    ...overrides,
  };
}

describe('updateMealRecipe — the edit itself', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('writes the corrected title, time and servings back onto the meal', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    const edited = await repository.updateMealRecipe(
      created.id,
      makeUpdateInput({ title: 'Kip met limoen', estimatedMinutes: 35, servings: 2 }),
    );

    expect(edited.title).toBe('Kip met limoen');
    expect(edited.estimatedMinutes).toBe(35);
    expect(edited.servings).toBe(2);
    const reread = await repository.getMeal(created.id);
    expect(reread?.title).toBe('Kip met limoen');
  });

  test('accepts null for a time and a serving count nobody knows, rather than inventing a number', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    const edited = await repository.updateMealRecipe(
      created.id,
      makeUpdateInput({ estimatedMinutes: null, servings: null }),
    );

    expect(edited.estimatedMinutes).toBeNull();
    expect(edited.servings).toBeNull();
  });

  test('REPLACES the ingredient list rather than appending to it — a corrected line does not leave the wrong one behind', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    await repository.updateMealRecipe(
      created.id,
      makeUpdateInput({
        ingredients: [{ name: 'kalkoenfilet', quantity: '400', unit: 'g', sortOrder: 0 }],
        allergenCheck: NOT_RECHECKED,
      }),
    );

    const ingredients = await repository.getMealIngredients(created.id);
    expect(ingredients.map((ingredient) => ingredient.name)).toEqual(['kalkoenfilet']);
  });

  test('REPLACES the step list, and the survivors are numbered from what the caller sent', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    await repository.updateMealRecipe(
      created.id,
      makeUpdateInput({
        steps: [
          { stepNumber: 1, instruction: 'Pers de citroen.', durationMinutes: null },
          { stepNumber: 2, instruction: 'Bak de kip.', durationMinutes: 12 },
        ],
      }),
    );

    const steps = await repository.getMealSteps(created.id);
    expect(steps.map((step) => step.instruction)).toEqual(['Pers de citroen.', 'Bak de kip.']);
    expect(steps.map((step) => step.stepNumber)).toEqual([1, 2]);
    expect(steps[1]?.durationMinutes).toBe(12);
  });

  test('every child row gets a FRESH id, which is what lets the mirror prune the departed ones', async () => {
    const created = await repository.createMeal(makeCreateMealInput());
    const idsBefore = (await repository.getMealIngredients(created.id)).map((ingredient) => ingredient.id);

    await repository.updateMealRecipe(created.id, makeUpdateInput());

    const idsAfter = (await repository.getMealIngredients(created.id)).map((ingredient) => ingredient.id);
    expect(idsAfter).toHaveLength(2);
    expect(idsAfter.some((id) => idsBefore.includes(id))).toBe(false);
  });

  test('an ingredient the source stated keeps its quantity and unit — the edit path never flattens what it was given', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    await repository.updateMealRecipe(created.id, makeUpdateInput());

    const ingredients = await repository.getMealIngredients(created.id);
    expect(ingredients[0]?.quantity).toBe('400');
    expect(ingredients[0]?.unit).toBe('g');
    expect(ingredients[1]?.quantity).toBe('1');
    expect(ingredients[1]?.unit).toBeNull();
  });

  test('touches only this meal — another meal keeps every one of its own ingredients and steps', async () => {
    const kept = await repository.createMeal(makeCreateMealInput({ title: 'Ander gerecht' }));
    const edited = await repository.createMeal(makeCreateMealInput());

    await repository.updateMealRecipe(edited.id, makeUpdateInput({ ingredients: [], steps: [] }));

    expect(await repository.getMealIngredients(kept.id)).toHaveLength(2);
    expect(await repository.getMealSteps(kept.id)).toHaveLength(2);
  });

  test('rejects an unknown meal id rather than silently doing nothing, like every other single-meal setter', async () => {
    await expect(repository.updateMealRecipe('does-not-exist', makeUpdateInput())).rejects.toThrow();
  });

  test('a rejected unknown id writes NO child rows — the meal is proved to exist before anything is replaced', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    await expect(repository.updateMealRecipe('does-not-exist', makeUpdateInput())).rejects.toThrow();

    // The real meal's rows are untouched, and no orphan row was written for
    // the id that does not exist.
    expect(await repository.getMealIngredients(created.id)).toHaveLength(2);
    expect(await repository.getMealIngredients('does-not-exist')).toHaveLength(0);
    expect(await repository.getMealSteps('does-not-exist')).toHaveLength(0);
  });

  test('the edit survives a fresh repository instance over the same store — it is a real write, not screen state', async () => {
    const store = createInMemoryKeyValueStore();
    const first = createLocalRepository(store);
    const created = await first.createMeal(makeCreateMealInput());
    await first.updateMealRecipe(created.id, makeUpdateInput({ title: 'Kip met limoen' }));

    const second = createLocalRepository(store);
    expect((await second.getMeal(created.id))?.title).toBe('Kip met limoen');
  });
});

describe('updateMealRecipe — what an edit must NOT touch', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  test('provenance, the canonical recipe link, categories and creation time all survive untouched', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    const edited = await repository.updateMealRecipe(created.id, makeUpdateInput({ title: 'Iets anders' }));

    expect(edited.householdId).toBe(HOUSEHOLD_ID);
    expect(edited.source).toBe('saved');
    expect(edited.sourceUrl).toBe('https://www.tiktok.com/@test/video/1');
    expect(edited.sourcePlatform).toBe('tiktok');
    expect(edited.thumbnailUrl).toBe('https://cdn.example/thumb.jpg');
    // The one column cook proof is entirely made of (0006/0009). An edit
    // that re-pointed it would silently move whose cooks this dish can be
    // joined to.
    expect(edited.recipeId).toBe('recipe-1');
    expect(edited.dishTags).toEqual(['kip']);
    expect(edited.skillLevel).toBe('beginner');
    expect(edited.createdAt).toBe(created.createdAt);
    expect(edited.archivedAt).toBeNull();
  });

  test('a household that withheld this dish from cook proof still withholds it after correcting a typo', async () => {
    const created = await repository.createMeal(makeCreateMealInput());
    await repository.setMealCookProofExclusion(created.id, true);

    await repository.updateMealRecipe(created.id, makeUpdateInput({ title: 'Kip met limoen' }));

    // Read through the normalising getter, not off the row: that is the
    // field whose absent reading is fail-OPEN.
    expect(await repository.getMealCookProofExclusion(created.id)).toBe(true);
  });

  test('a mood somebody gave this dish after cooking it survives an edit — axis 2 is not the editor to clear', async () => {
    const created = await repository.createMeal(makeCreateMealInput());
    await repository.addMealDishMood(created.id, 'soul-food');

    const edited = await repository.updateMealRecipe(created.id, makeUpdateInput());

    expect(edited.dishMoods).toEqual(['soul-food']);
  });

  test('cook history is untouched: the events pointing at this meal still point at it', async () => {
    const created = await repository.createMeal(makeCreateMealInput());
    await repository.createCookEvent({
      householdId: HOUSEHOLD_ID,
      mealId: created.id,
      decisionId: null,
      cookedOn: '2026-02-01',
    });

    await repository.updateMealRecipe(created.id, makeUpdateInput({ title: 'Kip met limoen', ingredients: [] }));

    const events = await repository.listCookEvents(HOUSEHOLD_ID);
    expect(events).toHaveLength(1);
    expect(events[0]?.mealId).toBe(created.id);
  });
});

/**
 * PD-006. The group that matters: a `verified` flag is a claim that a human
 * checked AN INGREDIENT LIST, so it cannot outlive the list it describes.
 * The rule itself is argued and unit-tested in
 * src/domain/mealAllergenReverification.ts; these assertions are that the
 * repository applies it against the STORED list, so no caller can skip it.
 */
describe('updateMealRecipe — PD-006: a verification does not outlive its ingredient list', () => {
  let repository: RemyRepository;

  beforeEach(() => {
    repository = createLocalRepository(createInMemoryKeyValueStore());
  });

  async function createVerifiedMeal(): Promise<string> {
    const created = await repository.createMeal(
      makeCreateMealInput({ ingredientTags: ['noten'], allergenTagStatus: 'verified' }),
    );
    return created.id;
  }

  test('DEMOTES a verified meal to unknown when the ingredient list changes and nobody re-checked it', async () => {
    const mealId = await createVerifiedMeal();

    const edited = await repository.updateMealRecipe(
      mealId,
      makeUpdateInput({
        ingredients: [{ name: 'pindakaas', quantity: '2', unit: 'el', sortOrder: 0 }],
        allergenCheck: NOT_RECHECKED,
      }),
    );

    expect(edited.allergenTagStatus).toBe('unknown');
  });

  test('KEEPS the existing allergen tags through that demotion — a tag is an exclusion, and dropping one is the direction that hurts', async () => {
    const mealId = await createVerifiedMeal();

    const edited = await repository.updateMealRecipe(
      mealId,
      makeUpdateInput({
        ingredients: [{ name: 'pindakaas', quantity: '2', unit: 'el', sortOrder: 0 }],
        allergenCheck: NOT_RECHECKED,
      }),
    );

    expect(edited.ingredientTags).toEqual(['noten']);
  });

  test('a title-only correction leaves a verified meal verified — the check describes the ingredients, and they did not move', async () => {
    const mealId = await createVerifiedMeal();

    const edited = await repository.updateMealRecipe(
      mealId,
      makeUpdateInput({ title: 'Kip met limoen', estimatedMinutes: 40, servings: 6 }),
    );

    expect(edited.allergenTagStatus).toBe('verified');
    expect(edited.ingredientTags).toEqual(['noten']);
  });

  test('REMOVING an ingredient demotes too — a shorter list is a different list', async () => {
    const mealId = await createVerifiedMeal();

    const edited = await repository.updateMealRecipe(
      mealId,
      makeUpdateInput({ ingredients: [{ name: 'kipfilet', quantity: '400', unit: 'g', sortOrder: 0 }] }),
    );

    expect(edited.allergenTagStatus).toBe('unknown');
  });

  test('a human re-checking the edited list is the one act that earns verified back', async () => {
    const mealId = await createVerifiedMeal();

    const edited = await repository.updateMealRecipe(
      mealId,
      makeUpdateInput({
        ingredients: [{ name: 'pindakaas', quantity: '2', unit: 'el', sortOrder: 0 }],
        allergenCheck: recheckedAllergens(['pinda']),
      }),
    );

    expect(edited.allergenTagStatus).toBe('verified');
    expect(edited.ingredientTags).toEqual(['pinda']);
  });

  test('confirming ZERO tags is still a check — "none of these are in it" is an answer, not a skip', async () => {
    const mealId = await createVerifiedMeal();

    const edited = await repository.updateMealRecipe(
      mealId,
      makeUpdateInput({
        ingredients: [{ name: 'kalkoenfilet', quantity: '400', unit: 'g', sortOrder: 0 }],
        allergenCheck: recheckedAllergens([]),
      }),
    );

    expect(edited.allergenTagStatus).toBe('verified');
    expect(edited.ingredientTags).toEqual([]);
  });

  test('an unknown meal stays unknown — an edit can never promote a meal nobody has checked', async () => {
    const created = await repository.createMeal(makeCreateMealInput({ allergenTagStatus: 'unknown' }));

    const edited = await repository.updateMealRecipe(created.id, makeUpdateInput({ title: 'Nieuwe titel' }));

    expect(edited.allergenTagStatus).toBe('unknown');
  });

  test('the demotion is decided from the STORED list, so a caller cannot assert its way past it', async () => {
    const mealId = await createVerifiedMeal();
    // A first edit changes the list without re-checking: demoted.
    await repository.updateMealRecipe(
      mealId,
      makeUpdateInput({ ingredients: [{ name: 'pindakaas', quantity: '2', unit: 'el', sortOrder: 0 }] }),
    );

    // A second edit restates that SAME list. Nothing changed this time, so
    // nothing is demoted further — but nothing is promoted either, because
    // no human has checked it since.
    const edited = await repository.updateMealRecipe(
      mealId,
      makeUpdateInput({ ingredients: [{ name: 'pindakaas', quantity: '2', unit: 'el', sortOrder: 0 }] }),
    );

    expect(edited.allergenTagStatus).toBe('unknown');
  });

  test('tags a human confirms are normalised on the way in, so a household restriction can actually match them', async () => {
    const created = await repository.createMeal(makeCreateMealInput());

    const edited = await repository.updateMealRecipe(
      created.id,
      makeUpdateInput({ allergenCheck: recheckedAllergens(['  Noten ', 'NOTEN', 'gluten']) }),
    );

    expect(edited.ingredientTags).toEqual(['noten', 'gluten']);
  });
});

/** The mirror is fire-and-forget, so a meal job lands a microtask after the write returns. */
function settleAll(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('updateMealRecipe — the edit reaches the mirror', () => {
  let store: KeyValueStore;
  let mirror: ReturnType<typeof vi.fn>;
  let repository: RemyRepository;

  beforeEach(() => {
    store = createInMemoryKeyValueStore();
    mirror = vi.fn();
    repository = createLocalRepository(store, mirror as unknown as MirrorJobSink);
  });

  function mealJob(): MirrorMealJob | undefined {
    return mirror.mock.calls
      .map((call) => call[0] as MirrorJob)
      .find((candidate): candidate is MirrorMealJob => candidate.kind === 'meal');
  }

  test('an edited recipe announces a meal job carrying the NEW ingredients and steps, not the replaced ones', async () => {
    const created = await repository.createMeal(makeCreateMealInput());
    await settleAll();
    mirror.mockClear();

    await repository.updateMealRecipe(
      created.id,
      makeUpdateInput({
        title: 'Kip met limoen',
        ingredients: [{ name: 'limoen', quantity: '2', unit: null, sortOrder: 0 }],
        steps: [{ stepNumber: 1, instruction: 'Pers de limoen.', durationMinutes: null }],
      }),
    );
    await settleAll();

    expect(mealJob()?.meal.id).toBe(created.id);
    expect(mealJob()?.meal.title).toBe('Kip met limoen');
    expect(mealJob()?.ingredients.map((ingredient) => ingredient.name)).toEqual(['limoen']);
    expect(mealJob()?.steps.map((step) => step.instruction)).toEqual(['Pers de limoen.']);
  });

  test('the mirrored meal carries the DEMOTED allergen status, so Postgres never holds a verified claim the device retracted', async () => {
    const created = await repository.createMeal(
      makeCreateMealInput({ ingredientTags: ['noten'], allergenTagStatus: 'verified' }),
    );
    await settleAll();
    mirror.mockClear();

    await repository.updateMealRecipe(
      created.id,
      makeUpdateInput({ ingredients: [{ name: 'pindakaas', quantity: '2', unit: 'el', sortOrder: 0 }] }),
    );
    await settleAll();

    expect(mealJob()?.meal.allergenTagStatus).toBe('unknown');
    expect(mealJob()?.meal.ingredientTags).toEqual(['noten']);
  });

  test('a mirror that throws does not fail the edit — a broken mirror is not a broken save', async () => {
    const created = await repository.createMeal(makeCreateMealInput());
    await settleAll();
    mirror.mockImplementation(() => {
      throw new Error('offline');
    });

    const edited = await repository.updateMealRecipe(created.id, makeUpdateInput({ title: 'Kip met limoen' }));
    await settleAll();

    expect(edited.title).toBe('Kip met limoen');
    expect((await repository.getMeal(created.id))?.title).toBe('Kip met limoen');
  });
});

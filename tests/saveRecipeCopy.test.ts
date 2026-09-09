/**
 * The repository calls behind `Bewaren` on the shared recipe screen
 * (src/lib/saveRecipeCopy.ts) — DESIGN-SOCIAL.md §3.3.
 *
 * WHY THIS SUITE EXISTS, and it is tests/sendRecipe.test.ts's lesson one
 * feature later. `/friends/[feedItemId]` is a route module, and a route
 * module cannot be imported in this environment — expo-router and
 * react-native internals fail to parse under Vite — so any wiring written
 * inside it is wiring nothing can assert on. GAP-31 recorded what that
 * costs: a fully specified `rateRecipe` with two backends and zero callers,
 * and an empty Ranglijst everybody read as policy. The composition below
 * lives in a module a test can reach, and this file asks the question the
 * screen's own tests cannot: does anybody actually copy the recipe?
 *
 * The fakes are one method and four methods wide, which is exactly what
 * `RecipeCopySource` and `RecipeCopySink` narrow the two repositories to.
 */

import { describe, expect, test, vi } from 'vitest';
import type { CreateMealInput, CreateSaveInput } from '@/lib/repository';
import type { CanonicalRecipe } from '@/lib/repository/social/types';
import { saveRecipeCopy, type RecipeCopySink, type RecipeCopySource } from '@/lib/saveRecipeCopy';
import type { Meal } from '@/domain/types';
import { makeMeal, makeSave } from './fixtures';

const HOUSEHOLD = 'household-1';

function makeCanonicalRecipe(overrides: Partial<CanonicalRecipe> = {}): CanonicalRecipe {
  return {
    recipeId: 'recipe-1',
    title: 'Miso-ramen met zachtgekookt ei',
    platform: 'tiktok',
    authorName: 'noedelnoah',
    authorUrl: 'https://www.tiktok.com/@noedelnoah',
    thumbnailUrl: null,
    dishTags: ['soep'],
    estimatedMinutes: 25,
    servings: 2,
    sourceUrl: 'https://www.tiktok.com/@noedelnoah/video/1',
    ingredients: [{ name: 'noedels', quantity: '200', unit: 'g', sortOrder: 0, section: null }],
    steps: [{ stepNumber: 1, instruction: 'Bouillon koken.' }],
    ...overrides,
  };
}

function makeSource(answer: CanonicalRecipe | null | 'throws') {
  return {
    getCanonicalRecipe: vi.fn(async (): Promise<CanonicalRecipe | null> => {
      if (answer === 'throws') {
        throw new Error('no session');
      }
      return answer;
    }),
  } satisfies RecipeCopySource;
}

interface SinkOptions {
  readonly meals?: readonly Meal[];
  readonly failCreateMeal?: boolean;
  readonly failCreateSave?: boolean;
}

function makeSink(options: SinkOptions = {}) {
  return {
    getCurrentHouseholdId: vi.fn(async () => HOUSEHOLD),
    listHouseholdMeals: vi.fn(async (): Promise<readonly Meal[]> => options.meals ?? []),
    createMeal: vi.fn(async (input: CreateMealInput): Promise<Meal> => {
      if (options.failCreateMeal === true) {
        throw new Error('RLS refused the meal');
      }
      return makeMeal({
        id: 'meal-new',
        householdId: input.householdId,
        title: input.title,
        recipeId: input.recipeId ?? null,
        allergenTagStatus: input.allergenTagStatus,
      });
    }),
    createSave: vi.fn(async (input: CreateSaveInput) => {
      if (options.failCreateSave === true) {
        throw new Error('RLS refused the save');
      }
      return makeSave({ mealId: input.mealId, intent: input.intent, householdId: input.householdId });
    }),
  } satisfies RecipeCopySink;
}

describe('saveRecipeCopy — the happy path', () => {
  test('copies the canonical recipe into the household, then writes the chosen intent against the copy', async () => {
    const recipe = makeCanonicalRecipe();
    const sink = makeSink();

    const outcome = await saveRecipeCopy(makeSource(recipe), sink, 'recipe-1', 'this_week');

    expect(sink.createMeal).toHaveBeenCalledTimes(1);
    expect(sink.createMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: HOUSEHOLD,
        title: recipe.title,
        source: 'saved',
        recipeId: 'recipe-1',
        allergenTagStatus: 'unknown',
        ingredientTags: [],
      }),
    );
    expect(sink.createSave).toHaveBeenCalledWith({
      householdId: HOUSEHOLD,
      memberId: null,
      mealId: 'meal-new',
      intent: 'this_week',
      sourceUrl: recipe.sourceUrl,
    });
    expect(outcome).toEqual({ kind: 'saved', mealId: 'meal-new', title: recipe.title, isNewCopy: true });
  });

  test('the save never precedes the meal it points at', async () => {
    const sink = makeSink();
    await saveRecipeCopy(makeSource(makeCanonicalRecipe()), sink, 'recipe-1', 'someday');

    const mealOrder = sink.createMeal.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const saveOrder = sink.createSave.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY;
    expect(mealOrder).toBeLessThan(saveOrder);
  });

  test("'someday' is written as 'someday' — the intent is the household's, never a default", async () => {
    const sink = makeSink();
    await saveRecipeCopy(makeSource(makeCanonicalRecipe()), sink, 'recipe-1', 'someday');
    expect(sink.createSave).toHaveBeenCalledWith(expect.objectContaining({ intent: 'someday' }));
  });
});

describe('saveRecipeCopy — one copy per household', () => {
  test('a recipe the household already holds is not copied twice; the intent lands on the existing meal', async () => {
    const existing = makeMeal({ id: 'meal-mine', householdId: HOUSEHOLD, recipeId: 'recipe-1', title: 'Mijn ramen' });
    const sink = makeSink({ meals: [existing] });

    const outcome = await saveRecipeCopy(makeSource(makeCanonicalRecipe()), sink, 'recipe-1', 'this_week');

    expect(sink.createMeal).not.toHaveBeenCalled();
    expect(sink.createSave).toHaveBeenCalledWith(expect.objectContaining({ mealId: 'meal-mine', intent: 'this_week' }));
    expect(outcome).toEqual({ kind: 'saved', mealId: 'meal-mine', title: 'Mijn ramen', isNewCopy: false });
  });

  test('a retry after a failed save finds the copy the first attempt made rather than making a second', async () => {
    const recipe = makeCanonicalRecipe();
    const firstAttempt = makeSink({ failCreateSave: true });
    expect(await saveRecipeCopy(makeSource(recipe), firstAttempt, 'recipe-1', 'someday')).toEqual({ kind: 'failed' });

    const copyFromFirstAttempt = makeMeal({ id: 'meal-new', householdId: HOUSEHOLD, recipeId: 'recipe-1' });
    const retry = makeSink({ meals: [copyFromFirstAttempt] });
    const outcome = await saveRecipeCopy(makeSource(recipe), retry, 'recipe-1', 'someday');

    expect(retry.createMeal).not.toHaveBeenCalled();
    expect(outcome.kind).toBe('saved');
  });
});

describe('saveRecipeCopy — reported, never thrown', () => {
  test('a canonical recipe that no longer exists is reported, and nothing about the household is touched', async () => {
    const sink = makeSink();
    const outcome = await saveRecipeCopy(makeSource(null), sink, 'recipe-gone', 'this_week');

    expect(outcome).toEqual({ kind: 'not_found' });
    expect(sink.getCurrentHouseholdId).not.toHaveBeenCalled();
    expect(sink.createMeal).not.toHaveBeenCalled();
    expect(sink.createSave).not.toHaveBeenCalled();
  });

  test('a refused read is reported as failed rather than thrown at the screen', async () => {
    const sink = makeSink();
    expect(await saveRecipeCopy(makeSource('throws'), sink, 'recipe-1', 'this_week')).toEqual({ kind: 'failed' });
    expect(sink.createMeal).not.toHaveBeenCalled();
  });

  test('a failed copy is reported as failed and no save is written against a meal that does not exist', async () => {
    const sink = makeSink({ failCreateMeal: true });
    expect(await saveRecipeCopy(makeSource(makeCanonicalRecipe()), sink, 'recipe-1', 'this_week')).toEqual({
      kind: 'failed',
    });
    expect(sink.createSave).not.toHaveBeenCalled();
  });
});

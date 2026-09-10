import { describe, expect, test } from 'vitest';
import { persistImportedMeal, type ImportSaveRepository } from '@/domain/import/persistImportedMeal';
import type { ImportMealContext } from '@/domain/import/importMealInput';
import { IMPORT_DEFAULT_SAVE_INTENT } from '@/domain/saveIntent';
import { makeMeal, makeSave } from '../fixtures';
import { makeParsedRecipe } from './fixtures';
import type { CreateMealInput, CreateSaveInput } from '@/lib/repository/types';
import type { HouseholdId, Meal } from '@/domain/types';

/**
 * THE IMPORT'S ONE WRITE, tested for the first time. It lived in
 * src/app/import/confirm.tsx, so none of the three things that actually
 * matter here — that a duplicate writes NOTHING, that the save row carries
 * the intent it was handed, and that both rows land on the household the
 * repository named — could be asserted at all.
 *
 * The fake is four functions and not a backend, which is what the `Pick`
 * on `ImportSaveRepository` buys. It records rather than simulates: every
 * assertion below is about what was CALLED, since "nothing was written" is
 * the claim the duplicate branch rests on, and an in-memory store would let
 * a spurious write hide inside it.
 */

const HOUSEHOLD = 'household-1' as HouseholdId;
const TIKTOK_URL = 'https://www.tiktok.com/@chefremy/video/123';

const IMPORT_CONTEXT: ImportMealContext = {
  sourceUrl: TIKTOK_URL,
  platform: 'tiktok',
  thumbnailUrl: null,
  recipeId: 'recipe-abc',
};

interface RecordingRepository {
  readonly repository: ImportSaveRepository;
  readonly createdMeals: CreateMealInput[];
  readonly createdSaves: CreateSaveInput[];
}

function makeRepository(library: readonly Meal[] = []): RecordingRepository {
  const createdMeals: CreateMealInput[] = [];
  const createdSaves: CreateSaveInput[] = [];
  return {
    createdMeals,
    createdSaves,
    repository: {
      getCurrentHouseholdId: () => Promise.resolve(HOUSEHOLD),
      listHouseholdMeals: () => Promise.resolve(library),
      createMeal: (input) => {
        createdMeals.push(input);
        return Promise.resolve(makeMeal({ id: 'meal-new', title: input.title }));
      },
      createSave: (input) => {
        createdSaves.push(input);
        return Promise.resolve(makeSave(input));
      },
    },
  };
}

function save(repository: ImportSaveRepository, context: ImportMealContext = IMPORT_CONTEXT) {
  return persistImportedMeal(repository, IMPORT_DEFAULT_SAVE_INTENT, makeParsedRecipe(), context, [], 'unknown');
}

describe('a recipe the household does not have yet', () => {
  test('reports that it was saved', async () => {
    const { repository } = makeRepository();
    await expect(save(repository)).resolves.toEqual({ kind: 'saved' });
  });

  test('writes the meal on the household the repository named', async () => {
    const { repository, createdMeals } = makeRepository();
    await save(repository);
    expect(createdMeals).toHaveLength(1);
    expect(createdMeals[0]?.householdId).toBe(HOUSEHOLD);
    expect(createdMeals[0]?.title).toBe(makeParsedRecipe().title);
    // W-01b: the canonical row this copy points at, all the way to the write.
    expect(createdMeals[0]?.recipeId).toBe('recipe-abc');
  });

  /**
   * PD-004a's floor: everything saved must eventually be suggested. The
   * intent is a PARAMETER precisely so the product decision stays in
   * src/domain/saveIntent.ts, and this asserts the one the import passes.
   */
  test('writes a save row carrying the intent it was handed', async () => {
    const { repository, createdSaves } = makeRepository();
    await save(repository);
    expect(createdSaves).toHaveLength(1);
    expect(createdSaves[0]?.intent).toBe(IMPORT_DEFAULT_SAVE_INTENT);
    expect(IMPORT_DEFAULT_SAVE_INTENT).not.toBe('none');
  });

  test('the save row points at the meal that was just created', async () => {
    const { repository, createdSaves } = makeRepository();
    await save(repository);
    expect(createdSaves[0]?.mealId).toBe('meal-new');
    expect(createdSaves[0]?.householdId).toBe(HOUSEHOLD);
    // An import is the household's, not any one member's.
    expect(createdSaves[0]?.memberId).toBeNull();
    expect(createdSaves[0]?.sourceUrl).toBe(TIKTOK_URL);
  });

  test('a different intent travels through unchanged', async () => {
    const { repository, createdSaves } = makeRepository();
    await persistImportedMeal(repository, 'this_week', makeParsedRecipe(), IMPORT_CONTEXT, [], 'unknown');
    expect(createdSaves[0]?.intent).toBe('this_week');
  });
});

/**
 * A duplicate is NOT an error. Nothing failed — the household already owns
 * this dish, which is the outcome they were trying to reach — so it is a
 * third result rather than a rejection, and above all nothing is written.
 */
describe('a recipe whose address is already in the library', () => {
  const LIBRARY = [makeMeal({ id: 'meal-1', title: 'Pasta pesto', sourceUrl: TIKTOK_URL })];

  test('reports the duplicate, naming the dish that is already there', async () => {
    const { repository } = makeRepository(LIBRARY);
    await expect(save(repository)).resolves.toEqual({ kind: 'duplicate', title: 'Pasta pesto' });
  });

  test('writes nothing at all — no meal and no save', async () => {
    const { repository, createdMeals, createdSaves } = makeRepository(LIBRARY);
    await save(repository);
    expect(createdMeals).toEqual([]);
    expect(createdSaves).toEqual([]);
  });

  test('a different address on the same platform is not a duplicate', async () => {
    const { repository, createdMeals } = makeRepository(LIBRARY);
    const other = { ...IMPORT_CONTEXT, sourceUrl: 'https://www.tiktok.com/@chefremy/video/456' };
    await expect(save(repository, other)).resolves.toEqual({ kind: 'saved' });
    expect(createdMeals).toHaveLength(1);
  });
});

/**
 * duplicateImport.ts's trap, asserted at the layer that would suffer it:
 * a manual entry and a pasted-text import both carry `sourceUrl: null`, and
 * matching null to null would refuse the second dish anybody types by hand.
 */
describe('an import with no address', () => {
  const MANUAL: ImportMealContext = { sourceUrl: null, platform: null, thumbnailUrl: null, recipeId: null };

  test('never collides with an existing meal that also has none', async () => {
    const { repository, createdMeals, createdSaves } = makeRepository([
      makeMeal({ id: 'meal-1', title: 'Zelf getypt gerecht', sourceUrl: null }),
    ]);
    await expect(save(repository, MANUAL)).resolves.toEqual({ kind: 'saved' });
    expect(createdMeals).toHaveLength(1);
    expect(createdSaves[0]?.sourceUrl).toBeNull();
  });
});

import { describe, expect, test } from 'vitest';
import { buildMealInput, type ImportMealContext } from '@/domain/import/importMealInput';
import { makeParsedIngredient, makeParsedRecipe } from './fixtures';
import type { HouseholdId } from '@/domain/types';

/**
 * THE LAST REBUILD BEFORE THE WRITE, tested for the first time. It sat
 * inside src/app/import/confirm.tsx, where vitest cannot reach it, and
 * tests/import/toMealDraft.test.ts says so in as many words at the point
 * where its own coverage stops. Every assertion here is about a field
 * SURVIVING a hand-written object literal, because that is the exact shape
 * that lost `dishTags` twice and `recipeId` from 0006 until W-01b: a type
 * cannot require a field that is optional downstream, so only a test can.
 */

const HOUSEHOLD = 'household-1' as HouseholdId;

const TIKTOK: ImportMealContext = {
  sourceUrl: 'https://www.tiktok.com/@chefremy/video/123',
  platform: 'tiktok',
  thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
  recipeId: 'recipe-abc',
};

/** No route was taken at all: no platform, so nothing was ever fetched, pasted or photographed. */
const MANUAL: ImportMealContext = {
  sourceUrl: null,
  platform: null,
  thumbnailUrl: null,
  recipeId: null,
};

describe('the drafted path — a real import', () => {
  test('carries the canonical recipes id through to the write', () => {
    // The field `shared_cooks` (0009) joins a friend's cook to. It went
    // unwritten from 0006 until W-01b because every layer left it out.
    const input = buildMealInput(makeParsedRecipe(), TIKTOK, HOUSEHOLD, [], 'unknown');
    expect(input.recipeId).toBe('recipe-abc');
  });

  test('carries the dish categories through to the write', () => {
    const input = buildMealInput(
      makeParsedRecipe({ dishTags: ['kip', 'ovenschotel'] }),
      TIKTOK,
      HOUSEHOLD,
      [],
      'unknown',
    );
    expect(input.dishTags).toEqual(['kip', 'ovenschotel']);
  });

  test('carries the source url, the thumbnail and the household', () => {
    const input = buildMealInput(makeParsedRecipe(), TIKTOK, HOUSEHOLD, [], 'unknown');
    expect(input.sourceUrl).toBe(TIKTOK.sourceUrl);
    expect(input.thumbnailUrl).toBe(TIKTOK.thumbnailUrl);
    expect(input.householdId).toBe(HOUSEHOLD);
    expect(input.source).toBe('saved');
    expect(input.skillLevel).toBeNull();
  });

  test('maps the platform onto the legacy source_platform vocabulary', () => {
    expect(buildMealInput(makeParsedRecipe(), TIKTOK, HOUSEHOLD, [], 'unknown').sourcePlatform).toBe('tiktok');
    expect(
      buildMealInput(makeParsedRecipe(), { ...TIKTOK, platform: 'instagram' }, HOUSEHOLD, [], 'unknown')
        .sourcePlatform,
    ).toBe('reels');
    // Neither word in that two-value column is honest for a YouTube video,
    // so the column says nothing rather than saying "Reel".
    expect(
      buildMealInput(makeParsedRecipe(), { ...TIKTOK, platform: 'youtube' }, HOUSEHOLD, [], 'unknown').sourcePlatform,
    ).toBeNull();
  });

  test('numbers the steps from one and leaves every cook-mode timer unset', () => {
    const input = buildMealInput(makeParsedRecipe({ steps: ['Eerst', 'Dan'] }), TIKTOK, HOUSEHOLD, [], 'unknown');
    expect(input.steps).toEqual([
      { stepNumber: 1, instruction: 'Eerst', durationMinutes: null },
      { stepNumber: 2, instruction: 'Dan', durationMinutes: null },
    ]);
  });

  test('keeps each ingredient decomposed, in order, with its sub-recipe heading', () => {
    const input = buildMealInput(
      makeParsedRecipe({
        ingredients: [
          makeParsedIngredient({ name: 'Kipfilet', quantity: '300', unit: 'g', section: 'Voor de marinade' }),
          makeParsedIngredient({ name: 'Paprika', quantity: '2', unit: null }),
        ],
      }),
      TIKTOK,
      HOUSEHOLD,
      [],
      'unknown',
    );
    expect(input.ingredients).toEqual([
      { name: 'Kipfilet', quantity: '300', unit: 'g', sortOrder: 0, section: 'Voor de marinade' },
      { name: 'Paprika', quantity: '2', unit: null, sortOrder: 1, section: null },
    ]);
  });
});

/**
 * SRC-08. A pasted recipe has a platform and no address, and the branch
 * used to test both — so it fell into the manual builder, which hardcodes
 * `recipeId`/`thumbnailUrl` and was written for a caller that provably has
 * no categories. It would have reached the database stripped of them.
 */
describe('a pasted-text import has no address and still drafts', () => {
  const PASTED: ImportMealContext = { sourceUrl: null, platform: 'text', thumbnailUrl: null, recipeId: null };

  test('keeps its dish categories', () => {
    const input = buildMealInput(makeParsedRecipe({ dishTags: ['pasta'] }), PASTED, HOUSEHOLD, [], 'unknown');
    expect(input.dishTags).toEqual(['pasta']);
  });

  test('states both empty columns honestly rather than inventing a placeholder url', () => {
    const input = buildMealInput(makeParsedRecipe(), PASTED, HOUSEHOLD, [], 'unknown');
    expect(input.sourceUrl).toBeNull();
    expect(input.sourcePlatform).toBeNull();
  });
});

describe('the manual path — no platform means no route was ever taken', () => {
  test('keeps the categories of a recipe somebody typed', () => {
    const input = buildMealInput(makeParsedRecipe({ dishTags: ['soep'] }), MANUAL, HOUSEHOLD, [], 'unknown');
    expect(input.dishTags).toEqual(['soep']);
  });

  test('writes a copy of nothing: no url, no thumbnail, no canonical recipe', () => {
    const input = buildMealInput(makeParsedRecipe(), MANUAL, HOUSEHOLD, [], 'unknown');
    expect(input.sourceUrl).toBeNull();
    expect(input.sourcePlatform).toBeNull();
    expect(input.thumbnailUrl).toBeNull();
    expect(input.recipeId).toBeNull();
  });

  /**
   * The three nulls above are HARDCODED in this branch rather than read off
   * the context, and that is deliberate: `platform === null` means nothing
   * was ever fetched, so anything else on the payload would be a leftover.
   * Pinned because the alternative reading looks equally plausible.
   */
  test('ignores anything else the context happens to carry', () => {
    const input = buildMealInput(makeParsedRecipe(), { ...TIKTOK, platform: null }, HOUSEHOLD, [], 'unknown');
    expect(input.sourceUrl).toBeNull();
    expect(input.thumbnailUrl).toBeNull();
    expect(input.recipeId).toBeNull();
  });

  test('numbers the steps from one and leaves every cook-mode timer unset', () => {
    const input = buildMealInput(makeParsedRecipe({ steps: ['Eerst', 'Dan'] }), MANUAL, HOUSEHOLD, [], 'unknown');
    expect(input.steps).toEqual([
      { stepNumber: 1, instruction: 'Eerst', durationMinutes: null },
      { stepNumber: 2, instruction: 'Dan', durationMinutes: null },
    ]);
  });

  test('keeps each ingredient decomposed and in order', () => {
    const input = buildMealInput(
      makeParsedRecipe({
        ingredients: [
          makeParsedIngredient({ name: 'Kipfilet', quantity: '300', unit: 'g' }),
          makeParsedIngredient({ name: 'Paprika', quantity: null, unit: null }),
        ],
      }),
      MANUAL,
      HOUSEHOLD,
      [],
      'unknown',
    );
    expect(input.ingredients).toEqual([
      { name: 'Kipfilet', quantity: '300', unit: 'g', sortOrder: 0 },
      { name: 'Paprika', quantity: null, unit: null, sortOrder: 1 },
    ]);
  });
});

/**
 * PD-006. The pipeline never classifies an allergen — `toMealDraft` pins
 * `[]`/'unknown' — so the ONLY thing that may reach these two columns is
 * what a human confirmed on AllergenTaggingSection. Both paths overlay it,
 * and both must, or a verified tagging is silently discarded on one of them.
 */
describe('the allergen tagging is the human one, on both paths', () => {
  test.each([
    ['the drafted path', TIKTOK],
    ['the manual path', MANUAL],
  ])('%s stores the confirmed tags and the verified status', (_label, context) => {
    const input = buildMealInput(makeParsedRecipe(), context, HOUSEHOLD, ['gluten', 'melk'], 'verified');
    expect(input.ingredientTags).toEqual(['gluten', 'melk']);
    expect(input.allergenTagStatus).toBe('verified');
  });

  test.each([
    ['the drafted path', TIKTOK],
    ['the manual path', MANUAL],
  ])('%s leaves an unconfirmed meal unknown', (_label, context) => {
    const input = buildMealInput(makeParsedRecipe(), context, HOUSEHOLD, [], 'unknown');
    expect(input.ingredientTags).toEqual([]);
    expect(input.allergenTagStatus).toBe('unknown');
  });
});

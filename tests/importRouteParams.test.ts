import { describe, expect, test } from 'vitest';
import { decodeImportConfirmParams, encodeImportConfirmParams, type ImportConfirmParams } from '@/app/import/routeParams';

const RECIPE_ID = '11111111-2222-3333-4444-555555555555';

describe('encodeImportConfirmParams / decodeImportConfirmParams', () => {
  test('round-trips a "parsed" payload', () => {
    const params: ImportConfirmParams = {
      mode: 'parsed',
      recipe: {
        title: 'Traybake met kip',
        ingredients: [{ name: 'kipfilet', quantity: '400', unit: 'g' }],
        steps: ['Verwarm de oven voor op 200°C.'],
        estimatedMinutes: 35,
        servings: 4,
      },
      sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
      platform: 'tiktok',
      authorName: 'kokenmetkees',
      thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
      recipeId: RECIPE_ID,
    };

    expect(decodeImportConfirmParams(encodeImportConfirmParams(params))).toEqual(params);
  });

  test('round-trips a "manual" payload with no recipe/source at all', () => {
    const params: ImportConfirmParams = {
      mode: 'manual',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      thumbnailUrl: null,
      recipeId: null,
    };
    expect(decodeImportConfirmParams(encodeImportConfirmParams(params))).toEqual(params);
  });

  test('decodes to a safe empty manual shape when the param is undefined', () => {
    expect(decodeImportConfirmParams(undefined)).toEqual({
      mode: 'manual',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      thumbnailUrl: null,
      recipeId: null,
    });
  });

  test('decodes to the same safe empty shape for malformed JSON rather than throwing', () => {
    expect(() => decodeImportConfirmParams('{not json')).not.toThrow();
    expect(decodeImportConfirmParams('{not json').mode).toBe('manual');
  });

  test('decodes to the safe empty shape when mode is not a recognised value', () => {
    const raw = JSON.stringify({
      mode: 'bogus',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      thumbnailUrl: null,
    });
    expect(decodeImportConfirmParams(raw).mode).toBe('manual');
  });

  /**
   * W-01b: the canonical `recipes` id is the one thing on this payload
   * that cannot be recovered on the far side. `sourceUrl` survives the
   * hop and looks like it would do — it is the row's deduplication key,
   * not its id, and a screen that "recovered" the id from it would point
   * a household's meal at a row that does not exist.
   */
  test('carries a canonical recipeId across the paste -> confirm hop', () => {
    const raw = encodeImportConfirmParams({
      mode: 'parsed',
      recipe: null,
      sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
      platform: 'tiktok',
      authorName: 'kokenmetkees',
      thumbnailUrl: null,
      recipeId: RECIPE_ID,
    });
    expect(decodeImportConfirmParams(raw).recipeId).toBe(RECIPE_ID);
  });

  test('keeps an explicitly null recipeId null — a manual add is a copy of nothing', () => {
    const raw = encodeImportConfirmParams({
      mode: 'manual',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      thumbnailUrl: null,
      recipeId: null,
    });
    expect(decodeImportConfirmParams(raw).recipeId).toBeNull();
  });

  test('decodes to the safe empty shape when recipeId is missing or is not a string', () => {
    const withoutKey = JSON.stringify({
      mode: 'parsed',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      thumbnailUrl: null,
    });
    expect(decodeImportConfirmParams(withoutKey).mode).toBe('manual');

    const wrongType = JSON.stringify({
      mode: 'parsed',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      thumbnailUrl: null,
      recipeId: 42,
    });
    expect(decodeImportConfirmParams(wrongType).mode).toBe('manual');
    expect(decodeImportConfirmParams(wrongType).recipeId).toBeNull();
  });

  test('decodes to the safe empty shape when platform is outside the known union', () => {
    const raw = JSON.stringify({
      mode: 'manual',
      recipe: null,
      sourceUrl: null,
      platform: 'youtube',
      authorName: null,
      thumbnailUrl: null,
      recipeId: RECIPE_ID,
    });
    expect(decodeImportConfirmParams(raw)).toEqual({
      mode: 'manual',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      thumbnailUrl: null,
      recipeId: null,
    });
  });
});

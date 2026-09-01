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
        // Required since the confirmation screen stopped dropping it — see
        // `buildEditedRecipe` in src/app/import/confirm.tsx.
        dishTags: ['kip', 'ovenschotel'],
      },
      sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
      platform: 'tiktok',
      authorName: 'kokenmetkees',
      authorUrl: 'https://www.tiktok.com/@kokenmetkees',
      thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
      recipeId: RECIPE_ID,
      provenance: 'model_from_caption',
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
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: null,
      provenance: null,
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
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: null,
      provenance: null,
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
      authorUrl: null,
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
      authorUrl: 'https://www.tiktok.com/@kokenmetkees',
      thumbnailUrl: null,
      recipeId: RECIPE_ID,
      provenance: 'model_from_caption',
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
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: null,
      provenance: null,
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
      authorUrl: null,
      thumbnailUrl: null,
    });
    expect(decodeImportConfirmParams(withoutKey).mode).toBe('manual');

    const wrongType = JSON.stringify({
      mode: 'parsed',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: 42,
    });
    expect(decodeImportConfirmParams(wrongType).mode).toBe('manual');
    expect(decodeImportConfirmParams(wrongType).recipeId).toBeNull();
  });

  /**
   * THIS TEST USED TO ASSERT THE BUG. It pinned down that `platform:
   * 'youtube'` decoded to the safe empty shape — which was the decoder
   * listing two of the three platforms that existed, so a YouTube import
   * round-tripped from paste.tsx to a BLANK confirmation screen with the
   * recipe, the URL and the creator all silently discarded. The list is
   * now derived from an exhaustive `Record<ImportPlatform, true>`, and
   * this asserts every member survives the hop rather than the two someone
   * happened to remember.
   */
  test('carries every platform in the import vocabulary across the hop', () => {
    for (const platform of ['tiktok', 'instagram', 'youtube', 'web'] as const) {
      const raw = encodeImportConfirmParams({
        mode: 'parsed',
        recipe: null,
        sourceUrl: 'https://example.test/recept',
        platform,
        authorName: 'kokenmetkees',
        authorUrl: null,
        thumbnailUrl: null,
        recipeId: RECIPE_ID,
        provenance: 'publisher_structured_data',
      });
      const decoded = decodeImportConfirmParams(raw);
      expect(decoded.platform).toBe(platform);
      expect(decoded.mode).toBe('parsed');
      expect(decoded.sourceUrl).toBe('https://example.test/recept');
    }
  });

  test('decodes to the safe empty shape when platform is outside the known union', () => {
    const raw = JSON.stringify({
      mode: 'manual',
      recipe: null,
      sourceUrl: null,
      platform: 'pinterest',
      authorName: null,
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: RECIPE_ID,
    });
    expect(decodeImportConfirmParams(raw)).toEqual({
      mode: 'manual',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: null,
      provenance: null,
    });
  });

  /**
   * `authorUrl` travels for the same reason `recipeId` does: the far side
   * cannot rebuild it. A YouTube channel URL is keyed on a channel id the
   * display name does not contain, and a recipe site's author page follows
   * no pattern at all — so a confirm screen that tried to reconstruct one
   * would link the credit to the wrong person, or to nobody.
   */
  test('carries the creator page URL across the paste -> confirm hop', () => {
    const raw = encodeImportConfirmParams({
      mode: 'parsed',
      recipe: null,
      sourceUrl: 'https://www.leukerecepten.nl/recepten/traybake-kip/',
      platform: 'web',
      authorName: 'Sanne Bakker',
      authorUrl: 'https://www.leukerecepten.nl/over-sanne',
      thumbnailUrl: null,
      recipeId: null,
      provenance: 'publisher_structured_data',
    });
    expect(decodeImportConfirmParams(raw).authorUrl).toBe('https://www.leukerecepten.nl/over-sanne');
  });

  test('keeps an explicitly null authorUrl null — a creator we can name but not link to is a real state', () => {
    const raw = encodeImportConfirmParams({
      mode: 'parsed',
      recipe: null,
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      platform: 'youtube',
      authorName: 'De Kookkanaal',
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: null,
      provenance: 'model_from_caption',
    });
    const decoded = decodeImportConfirmParams(raw);
    expect(decoded.authorName).toBe('De Kookkanaal');
    expect(decoded.authorUrl).toBeNull();
  });

  /**
   * RCP-06. Provenance travels for the same reason `authorUrl` and
   * `recipeId` do: the confirmation screen cannot recover it. `platform`
   * arrives right beside it and looks like it would answer the question,
   * and a screen that concluded "web means the publisher wrote it" would
   * be restating a pipeline rule rather than reporting what happened to
   * this import.
   */
  test('carries each provenance across the paste -> confirm hop', () => {
    for (const provenance of ['publisher_structured_data', 'model_from_caption'] as const) {
      const raw = encodeImportConfirmParams({
        mode: 'parsed',
        recipe: null,
        sourceUrl: 'https://example.test/recept',
        platform: 'web',
        authorName: 'Sanne Bakker',
        authorUrl: null,
        thumbnailUrl: null,
        recipeId: null,
        provenance,
      });
      expect(decodeImportConfirmParams(raw).provenance).toBe(provenance);
    }
  });

  test('keeps an explicitly null provenance null — a recipe the user types has no origin to report', () => {
    const raw = encodeImportConfirmParams({
      mode: 'manual',
      recipe: null,
      sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
      platform: 'tiktok',
      authorName: 'kokenmetkees',
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: null,
      provenance: null,
    });
    expect(decodeImportConfirmParams(raw).provenance).toBeNull();
  });

  /**
   * The version-skew case, and the one field on this payload that is read
   * leniently rather than all-or-nothing. A value from a NEWER build is
   * refused — we will not render a note built on a word we do not know —
   * but it is refused as ABSENT, because blanking a recipe the user waited
   * for, over a missing sentence, is the worse trade. See `readProvenance`.
   */
  test('reads an unrecognised provenance as absent, and keeps the rest of the payload', () => {
    const raw = JSON.stringify({
      mode: 'parsed',
      recipe: null,
      sourceUrl: 'https://example.test/recept',
      platform: 'web',
      authorName: 'Sanne Bakker',
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: RECIPE_ID,
      provenance: 'vibes',
    });
    const decoded = decodeImportConfirmParams(raw);
    expect(decoded.provenance).toBeNull();
    expect(decoded.mode).toBe('parsed');
    expect(decoded.recipeId).toBe(RECIPE_ID);
    expect(decoded.sourceUrl).toBe('https://example.test/recept');
  });

  test('reads a missing or wrongly-typed provenance as absent rather than discarding the import', () => {
    const withoutKey = JSON.stringify({
      mode: 'parsed',
      recipe: null,
      sourceUrl: 'https://example.test/recept',
      platform: 'web',
      authorName: null,
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: RECIPE_ID,
    });
    expect(decodeImportConfirmParams(withoutKey).provenance).toBeNull();
    expect(decodeImportConfirmParams(withoutKey).mode).toBe('parsed');

    const wrongType = JSON.stringify({
      mode: 'parsed',
      recipe: null,
      sourceUrl: 'https://example.test/recept',
      platform: 'web',
      authorName: null,
      authorUrl: null,
      thumbnailUrl: null,
      recipeId: RECIPE_ID,
      provenance: 7,
    });
    expect(decodeImportConfirmParams(wrongType).provenance).toBeNull();
    expect(decodeImportConfirmParams(wrongType).mode).toBe('parsed');
  });

  test('decodes to the safe empty shape when authorUrl is missing or is not a string', () => {
    const withoutKey = JSON.stringify({
      mode: 'parsed',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      thumbnailUrl: null,
      recipeId: null,
    });
    expect(decodeImportConfirmParams(withoutKey).mode).toBe('manual');

    const wrongType = JSON.stringify({
      mode: 'parsed',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
      authorUrl: 42,
      thumbnailUrl: null,
      recipeId: null,
    });
    expect(decodeImportConfirmParams(wrongType).mode).toBe('manual');
    expect(decodeImportConfirmParams(wrongType).authorUrl).toBeNull();
  });
});

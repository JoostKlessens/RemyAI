import { describe, expect, test } from 'vitest';
import { decodeImportConfirmParams, encodeImportConfirmParams, type ImportConfirmParams } from '@/app/import/routeParams';

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
    };

    expect(decodeImportConfirmParams(encodeImportConfirmParams(params))).toEqual(params);
  });

  test('round-trips a "manual" payload with no recipe/source at all', () => {
    const params: ImportConfirmParams = { mode: 'manual', recipe: null, sourceUrl: null, platform: null, authorName: null };
    expect(decodeImportConfirmParams(encodeImportConfirmParams(params))).toEqual(params);
  });

  test('decodes to a safe empty manual shape when the param is undefined', () => {
    expect(decodeImportConfirmParams(undefined)).toEqual({
      mode: 'manual',
      recipe: null,
      sourceUrl: null,
      platform: null,
      authorName: null,
    });
  });

  test('decodes to the same safe empty shape for malformed JSON rather than throwing', () => {
    expect(() => decodeImportConfirmParams('{not json')).not.toThrow();
    expect(decodeImportConfirmParams('{not json').mode).toBe('manual');
  });

  test('decodes to the safe empty shape when mode is not a recognised value', () => {
    const raw = JSON.stringify({ mode: 'bogus', recipe: null, sourceUrl: null, platform: null, authorName: null });
    expect(decodeImportConfirmParams(raw).mode).toBe('manual');
  });

  test('decodes to the safe empty shape when platform is outside the known union', () => {
    const raw = JSON.stringify({ mode: 'manual', recipe: null, sourceUrl: null, platform: 'youtube', authorName: null });
    expect(decodeImportConfirmParams(raw)).toEqual({ mode: 'manual', recipe: null, sourceUrl: null, platform: null, authorName: null });
  });
});

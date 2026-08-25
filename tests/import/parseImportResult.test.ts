import { describe, expect, test } from 'vitest';
import { parseImportResult } from '@/domain/import/parseImportResult';

const VALID_RECIPE = {
  title: 'Traybake met kip',
  ingredients: [{ name: 'kipfilet', quantity: '400', unit: 'g' }],
  steps: ['Verwarm de oven voor.', 'Bak 25 minuten.'],
  estimatedMinutes: 35,
  servings: 4,
};

const VALID_ATTRIBUTION = {
  authorName: 'kokenmetkees',
  authorUrl: 'https://www.tiktok.com/@kokenmetkees',
  thumbnailUrl: 'https://example.test/thumb.jpg',
};

function parsedResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    kind: 'parsed',
    recipe: VALID_RECIPE,
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/123',
    platform: 'tiktok',
    attribution: VALID_ATTRIBUTION,
    ...overrides,
  };
}

describe('parseImportResult — parsed', () => {
  test('accepts a well-formed parsed result and carries the recipe through', () => {
    const result = parseImportResult(parsedResponse());
    expect(result).toMatchObject({
      kind: 'parsed',
      sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/123',
      platform: 'tiktok',
      attribution: VALID_ATTRIBUTION,
    });
    expect(result?.kind === 'parsed' && result.recipe.title).toBe('Traybake met kip');
  });

  test('accepts a parsed result with no attribution key at all', () => {
    const response = parsedResponse() as Record<string, unknown>;
    delete response.attribution;
    const result = parseImportResult(response);
    expect(result?.kind).toBe('parsed');
    expect(result && 'attribution' in result).toBe(false);
  });

  test('accepts an attribution whose optional fields are all null', () => {
    const result = parseImportResult(
      parsedResponse({ attribution: { authorName: null, authorUrl: null, thumbnailUrl: null } }),
    );
    expect(result).toMatchObject({
      attribution: { authorName: null, authorUrl: null, thumbnailUrl: null },
    });
  });

  test('rejects a parsed result whose recipe does not validate', () => {
    expect(parseImportResult(parsedResponse({ recipe: { title: 'Leeg', ingredients: [], steps: [] } }))).toBeNull();
  });

  test('rejects a parsed result with an unknown platform', () => {
    expect(parseImportResult(parsedResponse({ platform: 'youtube' }))).toBeNull();
  });

  test('rejects a parsed result with a blank sourceUrl', () => {
    expect(parseImportResult(parsedResponse({ sourceUrl: '   ' }))).toBeNull();
  });

  /**
   * Attribution is a legal obligation, not decoration — a shape we don't
   * recognize fails the import rather than silently dropping the creator.
   */
  test('rejects a parsed result whose attribution is malformed rather than dropping the creator', () => {
    expect(parseImportResult(parsedResponse({ attribution: { authorName: 42 } }))).toBeNull();
    expect(parseImportResult(parsedResponse({ attribution: 'kokenmetkees' }))).toBeNull();
  });
});

describe('parseImportResult — failure variants', () => {
  test('accepts no_recipe_in_caption with a caption', () => {
    expect(parseImportResult({ kind: 'no_recipe_in_caption', caption: 'POV: zondagavond' })).toEqual({
      kind: 'no_recipe_in_caption',
      caption: 'POV: zondagavond',
    });
  });

  test('accepts no_recipe_in_caption with a null caption', () => {
    expect(parseImportResult({ kind: 'no_recipe_in_caption', caption: null })).toEqual({
      kind: 'no_recipe_in_caption',
      caption: null,
    });
  });

  test('rejects no_recipe_in_caption whose caption is not a string', () => {
    expect(parseImportResult({ kind: 'no_recipe_in_caption', caption: 12 })).toBeNull();
  });

  test('accepts oembed_failed for every reason in the vocabulary', () => {
    for (const reason of ['invalid_url', 'missing_credentials', 'not_found', 'rate_limited', 'unknown_error']) {
      expect(parseImportResult({ kind: 'oembed_failed', reason })).toEqual({ kind: 'oembed_failed', reason });
    }
  });

  test('rejects oembed_failed carrying a reason outside the vocabulary', () => {
    expect(parseImportResult({ kind: 'oembed_failed', reason: 'teapot' })).toBeNull();
    expect(parseImportResult({ kind: 'oembed_failed' })).toBeNull();
  });

  test('accepts the bare failure kinds', () => {
    expect(parseImportResult({ kind: 'unsupported_url' })).toEqual({ kind: 'unsupported_url' });
    expect(parseImportResult({ kind: 'llm_request_failed' })).toEqual({ kind: 'llm_request_failed' });
    expect(parseImportResult({ kind: 'parse_failed' })).toEqual({ kind: 'parse_failed' });
  });
});

describe('parseImportResult — trust nothing from the network', () => {
  test('rejects non-object roots', () => {
    expect(parseImportResult(null)).toBeNull();
    expect(parseImportResult(undefined)).toBeNull();
    expect(parseImportResult('parsed')).toBeNull();
    expect(parseImportResult(42)).toBeNull();
  });

  test('rejects a body with no kind', () => {
    expect(parseImportResult({ recipe: VALID_RECIPE })).toBeNull();
  });

  test('rejects a kind this client does not know, rather than guessing', () => {
    expect(parseImportResult({ kind: 'some_future_variant' })).toBeNull();
  });
});

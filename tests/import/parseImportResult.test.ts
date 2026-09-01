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

const RECIPE_ID = '11111111-2222-3333-4444-555555555555';

function parsedResponse(overrides: Record<string, unknown> = {}): unknown {
  return {
    kind: 'parsed',
    recipe: VALID_RECIPE,
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/123',
    platform: 'tiktok',
    attribution: VALID_ATTRIBUTION,
    recipeId: RECIPE_ID,
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

  /**
   * W-01b. The id is the canonical `recipes` row this import deduplicated
   * to, and it is the only thing a friend's cook can later be joined to.
   */
  test('carries the canonical recipeId through from the function response', () => {
    const result = parseImportResult(parsedResponse());
    expect(result?.kind === 'parsed' && result.recipeId).toBe(RECIPE_ID);
  });

  /**
   * A function deployed before W-01b sends no such key. That is a real
   * "we do not know one", which is exactly what null means — and it must
   * NEVER be papered over by deriving something from `sourceUrl`, which
   * is the row's deduplication key and not its id.
   */
  test('reads an absent or null recipeId as null rather than deriving one from the sourceUrl', () => {
    const response = parsedResponse() as Record<string, unknown>;
    delete response.recipeId;
    const withoutKey = parseImportResult(response);
    expect(withoutKey?.kind === 'parsed' && withoutKey.recipeId).toBeNull();

    const explicitNull = parseImportResult(parsedResponse({ recipeId: null }));
    expect(explicitNull?.kind === 'parsed' && explicitNull.recipeId).toBeNull();
  });

  test('rejects a parsed result whose recipeId is present but not a string', () => {
    expect(parseImportResult(parsedResponse({ recipeId: 42 }))).toBeNull();
    expect(parseImportResult(parsedResponse({ recipeId: { id: 'x' } }))).toBeNull();
  });

  test('rejects a parsed result whose recipe does not validate', () => {
    expect(parseImportResult(parsedResponse({ recipe: { title: 'Leeg', ingredients: [], steps: [] } }))).toBeNull();
  });

  test('rejects a parsed result with an unknown platform', () => {
    expect(parseImportResult(parsedResponse({ platform: 'pinterest' }))).toBeNull();
  });

  /** SRC-02/SRC-03: youtube joined the vocabulary — parseImportResult.ts's PLATFORMS Set must stay in sync with ImportPlatform (types.ts) and urlParsing.ts's host recognition. */
  test('accepts a parsed result for the youtube platform', () => {
    const result = parseImportResult(parsedResponse({ platform: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }));
    expect(result?.kind === 'parsed' && result.platform).toBe('youtube');
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

describe('parseImportResult — no_recipe_in_caption (IMP-02: attribution required)', () => {
  function noRecipeResponse(overrides: Record<string, unknown> = {}): unknown {
    return {
      kind: 'no_recipe_in_caption',
      caption: 'POV: zondagavond',
      attribution: VALID_ATTRIBUTION,
      ...overrides,
    };
  }

  test('accepts no_recipe_in_caption with a caption and an attribution', () => {
    expect(parseImportResult(noRecipeResponse())).toEqual({
      kind: 'no_recipe_in_caption',
      caption: 'POV: zondagavond',
      attribution: VALID_ATTRIBUTION,
    });
  });

  test('accepts a null caption alongside a real attribution — oEmbed can succeed with no title at all', () => {
    expect(parseImportResult(noRecipeResponse({ caption: null }))).toEqual({
      kind: 'no_recipe_in_caption',
      caption: null,
      attribution: VALID_ATTRIBUTION,
    });
  });

  test('rejects no_recipe_in_caption whose caption is not a string', () => {
    expect(parseImportResult(noRecipeResponse({ caption: 12 }))).toBeNull();
  });

  test('accepts an attribution whose fields are all null — a creator we cannot name is a real state', () => {
    const result = parseImportResult(
      noRecipeResponse({ attribution: { authorName: null, authorUrl: null, thumbnailUrl: null } }),
    );
    expect(result).toMatchObject({ attribution: { authorName: null, authorUrl: null, thumbnailUrl: null } });
  });

  /**
   * Unlike `parsed`, attribution is REQUIRED here: the function only ever
   * constructs this variant after oEmbed has already resolved, so there is
   * no legitimate "not fetched yet" reading of an absent attribution —
   * only client/function version skew, which the file header's own note on
   * malformed attribution says is worth failing the whole result over.
   */
  test('rejects no_recipe_in_caption with no attribution at all', () => {
    const response = noRecipeResponse() as Record<string, unknown>;
    delete response.attribution;
    expect(parseImportResult(response)).toBeNull();
    expect(parseImportResult(noRecipeResponse({ attribution: null }))).toBeNull();
  });

  test('rejects no_recipe_in_caption whose attribution is malformed rather than dropping the creator', () => {
    expect(parseImportResult(noRecipeResponse({ attribution: { authorName: 42 } }))).toBeNull();
    expect(parseImportResult(noRecipeResponse({ attribution: 'kokenmetkees' }))).toBeNull();
  });
});

describe('parseImportResult — failure variants', () => {
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

describe('parseImportResult — display_only', () => {
  function displayOnlyResponse(overrides: Record<string, unknown> = {}): unknown {
    return {
      kind: 'display_only',
      platform: 'instagram',
      sourceUrl: 'https://www.instagram.com/reel/Cx1y2z3',
      attribution: VALID_ATTRIBUTION,
      ...overrides,
    };
  }

  test('accepts a well-formed display_only result and keeps the creator attached', () => {
    expect(parseImportResult(displayOnlyResponse())).toEqual({
      kind: 'display_only',
      platform: 'instagram',
      sourceUrl: 'https://www.instagram.com/reel/Cx1y2z3',
      attribution: VALID_ATTRIBUTION,
    });
  });

  test('accepts an attribution whose fields are all null — a creator we cannot name is a real state', () => {
    const result = parseImportResult(
      displayOnlyResponse({ attribution: { authorName: null, authorUrl: null, thumbnailUrl: null } }),
    );
    expect(result).toMatchObject({ attribution: { authorName: null, authorUrl: null, thumbnailUrl: null } });
  });

  /**
   * Unlike `parsed`, attribution is REQUIRED here: crediting the creator is
   * the entire justification for this variant existing, so a response
   * without one is version skew worth failing on, not a recipe-less post to
   * render anonymously.
   */
  test('rejects a display_only result with no attribution at all', () => {
    const response = displayOnlyResponse() as Record<string, unknown>;
    delete response.attribution;
    expect(parseImportResult(response)).toBeNull();
    expect(parseImportResult(displayOnlyResponse({ attribution: null }))).toBeNull();
  });

  test('rejects a display_only result whose attribution is malformed rather than dropping the creator', () => {
    expect(parseImportResult(displayOnlyResponse({ attribution: { authorName: 42 } }))).toBeNull();
    expect(parseImportResult(displayOnlyResponse({ attribution: 'plantaardigpauline' }))).toBeNull();
  });

  test('rejects a display_only result with an unknown platform or a blank sourceUrl', () => {
    expect(parseImportResult(displayOnlyResponse({ platform: 'pinterest' }))).toBeNull();
    expect(parseImportResult(displayOnlyResponse({ sourceUrl: '   ' }))).toBeNull();
  });

  /** Display-only is a property of the response, not of a hardcoded platform list on the client. */
  test('accepts display_only for any known platform, without second-guessing the function', () => {
    const result = parseImportResult(
      displayOnlyResponse({ platform: 'tiktok', sourceUrl: 'https://www.tiktok.com/@x/video/1' }),
    );
    expect(result?.kind).toBe('display_only');
  });

  /** A caption must never reach the client on this path — if one is smuggled in, it is dropped, never narrowed through. */
  test('drops any caption a rogue response tries to attach', () => {
    const caption = '350 g pasta, 4 el pesto';
    const result = parseImportResult(displayOnlyResponse({ caption }));
    expect(JSON.stringify(result)).not.toContain(caption);
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

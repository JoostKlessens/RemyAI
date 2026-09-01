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
    provenance: 'model_from_caption',
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

  /**
   * A function deployed before `attribution` became required sends no such
   * key. That still decodes — breaking every client mid-rollout would buy
   * nothing — but it now decodes to an explicit all-null attribution
   * rather than an absent field. That is not an invention: types.ts has
   * always defined an absent attribution here as exactly equivalent to a
   * populated all-null one, and materialising it means no reader
   * downstream has to check both `undefined` and three nulls to learn the
   * same fact.
   */
  test('materialises an all-null attribution when the response carries no attribution key', () => {
    const response = parsedResponse() as Record<string, unknown>;
    delete response.attribution;
    const result = parseImportResult(response);
    expect(result?.kind).toBe('parsed');
    expect(result && 'attribution' in result).toBe(true);
    expect(result).toMatchObject({ attribution: { authorName: null, authorUrl: null, thumbnailUrl: null } });
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

  /**
   * `ParsedRecipe.dishTags` is required now, and this boundary has no
   * dish-tag code of its own on purpose: the recipe body goes through
   * `validateParsedRecipe`, the same function the edge function runs over
   * the model's answer, which reads a missing key as `[]` and states it.
   * So a response from a function older than the field still decodes, and
   * still decodes into something that satisfies the required type — no
   * second reading of dish tags to drift from the first.
   */
  test('states an empty dishTags list when the response omits the key entirely', () => {
    const result = parseImportResult(parsedResponse());
    expect(result?.kind === 'parsed' && 'dishTags' in result.recipe).toBe(true);
    expect(result?.kind === 'parsed' && result.recipe.dishTags).toEqual([]);
  });

  test('carries stated dishTags through the boundary untouched', () => {
    const result = parseImportResult(
      parsedResponse({ recipe: { ...VALID_RECIPE, dishTags: ['pasta', 'vegetarisch'] } }),
    );
    expect(result?.kind === 'parsed' && result.recipe.dishTags).toEqual(['pasta', 'vegetarisch']);
  });

  test('rejects a parsed result whose recipe does not validate', () => {
    expect(parseImportResult(parsedResponse({ recipe: { title: 'Leeg', ingredients: [], steps: [] } }))).toBeNull();
  });

  test('rejects a parsed result with an unknown platform', () => {
    expect(parseImportResult(parsedResponse({ platform: 'pinterest' }))).toBeNull();
  });

  /**
   * The client-side platform vocabulary is now derived from an exhaustive
   * `Record<ImportPlatform, true>`, so it cannot fall behind the union the
   * way a hand-written list did twice. This asserts every member of that
   * union decodes — the previous version of this suite only ever checked
   * the members someone had remembered to add.
   */
  test('accepts a parsed result for every platform in the import vocabulary', () => {
    const platforms = [
      { platform: 'tiktok', sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/123' },
      { platform: 'instagram', sourceUrl: 'https://www.instagram.com/reel/Cx1y2z3' },
      { platform: 'youtube', sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { platform: 'web', sourceUrl: 'https://www.leukerecepten.nl/recepten/traybake-kip/' },
    ];
    for (const overrides of platforms) {
      const result = parseImportResult(parsedResponse(overrides));
      expect(result?.kind === 'parsed' && result.platform).toBe(overrides.platform);
    }
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

/**
 * RCP-06. Provenance is the one field on `parsed` that gets no
 * backward-compatible reading, and these tests exist to keep it that way:
 * `attribution` and `recipeId` both have a true sentence to fall back on
 * when a response says nothing, and this one does not.
 */
describe('parseImportResult — provenance (RCP-06)', () => {
  test('carries both members of the vocabulary through unchanged', () => {
    for (const provenance of ['publisher_structured_data', 'model_from_caption'] as const) {
      const result = parseImportResult(parsedResponse({ provenance }));
      expect(result?.kind === 'parsed' && result.provenance).toBe(provenance);
    }
  });

  /**
   * The asymmetry with the two fields beside it, asserted rather than
   * described. A function older than this field says nothing about
   * provenance, and there is no honest default to fill in: guessing
   * `model_from_caption` would tell a user their publisher-written recipe
   * was interpreted by software, and guessing
   * `publisher_structured_data` would put a publisher's name on a model's
   * reading of a caption. So the whole result fails, and the user gets a
   * retryable error instead of a fabricated claim about where their
   * recipe came from.
   */
  test('fails the whole result when the response states no provenance at all', () => {
    const response = parsedResponse() as Record<string, unknown>;
    delete response.provenance;
    expect(parseImportResult(response)).toBeNull();
    expect(parseImportResult(parsedResponse({ provenance: null }))).toBeNull();
  });

  test('fails the whole result on a provenance outside the vocabulary, rather than guessing', () => {
    expect(parseImportResult(parsedResponse({ provenance: 'human_transcription' }))).toBeNull();
    expect(parseImportResult(parsedResponse({ provenance: 'model_from_video' }))).toBeNull();
  });

  test('fails the whole result on a provenance that is not a string', () => {
    expect(parseImportResult(parsedResponse({ provenance: 1 }))).toBeNull();
    expect(parseImportResult(parsedResponse({ provenance: { kind: 'model_from_caption' } }))).toBeNull();
  });

  /**
   * PD-019's "precision follows the instrument" applied to this field: a
   * number attached to a provenance would read as measured and be
   * guessed. Nothing in the pipeline produces one, and nothing here may
   * narrow one through if a future function starts sending it.
   */
  test('never narrows a confidence score through, however plausibly a response offers one', () => {
    const result = parseImportResult(parsedResponse({ provenance: 'model_from_caption', confidence: 0.87 }));
    expect(result?.kind).toBe('parsed');
    expect(JSON.stringify(result)).not.toContain('0.87');
    expect(JSON.stringify(result)).not.toContain('confidence');
  });
});

describe('parseImportResult — no_recipe_in_caption (IMP-02: attribution required)', () => {
  function noRecipeResponse(overrides: Record<string, unknown> = {}): unknown {
    return {
      kind: 'no_recipe_in_caption',
      caption: 'POV: zondagavond',
      attribution: VALID_ATTRIBUTION,
      platform: 'tiktok',
      ...overrides,
    };
  }

  test('accepts no_recipe_in_caption with a caption, an attribution and a platform', () => {
    expect(parseImportResult(noRecipeResponse())).toEqual({
      kind: 'no_recipe_in_caption',
      caption: 'POV: zondagavond',
      attribution: VALID_ATTRIBUTION,
      platform: 'tiktok',
    });
  });

  test('accepts a null caption alongside a real attribution — oEmbed can succeed with no title at all', () => {
    expect(parseImportResult(noRecipeResponse({ caption: null }))).toEqual({
      kind: 'no_recipe_in_caption',
      caption: null,
      attribution: VALID_ATTRIBUTION,
      platform: 'tiktok',
    });
  });

  /**
   * The two platforms the shared caption tail serves, both narrowed
   * through unchanged. This is the boundary the SRC-09 number crosses: a
   * client that folded a YouTube caption failure into TikTok's would
   * corrupt the split before anybody ever counted it.
   */
  test('keeps a YouTube caption failure distinct from a TikTok one', () => {
    const tiktok = parseImportResult(noRecipeResponse({ platform: 'tiktok' }));
    const youtube = parseImportResult(noRecipeResponse({ platform: 'youtube' }));
    expect(tiktok?.kind === 'no_recipe_in_caption' && tiktok.platform).toBe('tiktok');
    expect(youtube?.kind === 'no_recipe_in_caption' && youtube.platform).toBe('youtube');
    expect(tiktok).not.toEqual(youtube);
  });

  /**
   * The same version-skew posture the rest of this module takes: an absent
   * or unrecognised platform means the function on the other end is not the
   * one this client was built against, and there is no true sentence to
   * fall back on — every producer knows the platform before it makes a
   * network call at all (types.ts). Defaulting would file a caption failure
   * under a route that never ran.
   */
  test('fails the whole result when the platform is absent or outside the vocabulary', () => {
    const response = noRecipeResponse() as Record<string, unknown>;
    delete response.platform;
    expect(parseImportResult(response)).toBeNull();
    expect(parseImportResult(noRecipeResponse({ platform: null }))).toBeNull();
    expect(parseImportResult(noRecipeResponse({ platform: 'pinterest' }))).toBeNull();
    expect(parseImportResult(noRecipeResponse({ platform: 42 }))).toBeNull();
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
      expect(parseImportResult({ kind: 'oembed_failed', reason, platform: 'tiktok' })).toEqual({
        kind: 'oembed_failed',
        reason,
        platform: 'tiktok',
      });
    }
  });

  test('rejects oembed_failed carrying a reason outside the vocabulary', () => {
    expect(parseImportResult({ kind: 'oembed_failed', reason: 'teapot', platform: 'tiktok' })).toBeNull();
    expect(parseImportResult({ kind: 'oembed_failed', platform: 'tiktok' })).toBeNull();
  });

  /**
   * An unknown platform and an unknown reason are the same fact about the
   * same response — the function that sent it is not the one this client
   * was built against — so they must produce the same answer rather than
   * one silently mattering less than the other.
   */
  test('rejects oembed_failed whose platform is absent or unknown, exactly as it rejects a bad reason', () => {
    expect(parseImportResult({ kind: 'oembed_failed', reason: 'not_found' })).toBeNull();
    expect(parseImportResult({ kind: 'oembed_failed', reason: 'not_found', platform: 'pinterest' })).toBeNull();
  });

  test('accepts the two model failures, each carrying the platform whose caption it failed on', () => {
    expect(parseImportResult({ kind: 'llm_request_failed', platform: 'tiktok' })).toEqual({
      kind: 'llm_request_failed',
      platform: 'tiktok',
    });
    expect(parseImportResult({ kind: 'parse_failed', platform: 'youtube' })).toEqual({
      kind: 'parse_failed',
      platform: 'youtube',
    });
  });

  test('rejects the two model failures when they name no platform, rather than defaulting one', () => {
    expect(parseImportResult({ kind: 'llm_request_failed' })).toBeNull();
    expect(parseImportResult({ kind: 'parse_failed' })).toBeNull();
    expect(parseImportResult({ kind: 'parse_failed', platform: 'pinterest' })).toBeNull();
  });

  /**
   * THE ONE OUTCOME THAT NARROWS WITHOUT A PLATFORM, and it must keep
   * doing so: it is returned by the branch that runs before a URL has been
   * identified at all, so requiring one here would reject the only response
   * that honestly cannot carry one (types.ts). A platform a rogue or future
   * function attaches is dropped rather than narrowed through — this
   * variant has no field to hold it, and inventing a route for text we
   * declined to open is the exact fabrication IMP-07's denominator cannot
   * survive.
   */
  test('accepts unsupported_url on its kind alone, and drops any platform attached to it', () => {
    expect(parseImportResult({ kind: 'unsupported_url' })).toEqual({ kind: 'unsupported_url' });
    expect(parseImportResult({ kind: 'unsupported_url', platform: 'web' })).toEqual({ kind: 'unsupported_url' });
  });
});

describe('parseImportResult — no_recipe_on_page (the web route)', () => {
  test('accepts the variant on its kind and its platform', () => {
    expect(parseImportResult({ kind: 'no_recipe_on_page', platform: 'web' })).toEqual({
      kind: 'no_recipe_on_page',
      platform: 'web',
    });
  });

  test('rejects the variant when it names no platform — which route found nothing is the whole fact', () => {
    expect(parseImportResult({ kind: 'no_recipe_on_page' })).toBeNull();
    expect(parseImportResult({ kind: 'no_recipe_on_page', platform: 'pinterest' })).toBeNull();
  });

  /**
   * The variant deliberately carries no caption and no attribution: the
   * only thing a web import ever reads is the page's structured recipe
   * object, and there wasn't one, so anything else attached here would be
   * scraped text we invented a source for (types.ts). A rogue or future
   * function attaching either must not have it narrowed through.
   */
  test('drops a caption or attribution a rogue response tries to attach', () => {
    const caption = '350 g pasta, 4 el pesto';
    const result = parseImportResult({
      kind: 'no_recipe_on_page',
      platform: 'web',
      caption,
      attribution: VALID_ATTRIBUTION,
    });
    expect(result).toEqual({ kind: 'no_recipe_on_page', platform: 'web' });
    expect(JSON.stringify(result)).not.toContain(caption);
  });
});

describe('parseImportResult — source_fetch_failed', () => {
  test('accepts every reason in the vocabulary, both producers included', () => {
    const reasons = [
      'refused',
      'forbidden',
      'rate_limited',
      'not_found',
      'server_error',
      'too_large',
      'not_html',
      'network_error',
      'missing_credentials',
    ];
    for (const reason of reasons) {
      // `'youtube'` for the one reason only the Data API route can produce
      // (an unset key), `'web'` for the rest — the same pairing the real
      // pipeline makes. A loop that pinned one platform for all nine would
      // assert a `missing_credentials` from a route that has no credential.
      const platform = reason === 'missing_credentials' ? 'youtube' : 'web';
      expect(parseImportResult({ kind: 'source_fetch_failed', reason, platform })).toEqual({
        kind: 'source_fetch_failed',
        reason,
        platform,
      });
    }
  });

  /**
   * Same version-skew posture as `oembed_failed`: a reason this client
   * cannot render honestly fails the whole result rather than being
   * downgraded to generic copy written for a different failure.
   */
  test('rejects a reason outside the vocabulary, and a missing one', () => {
    expect(parseImportResult({ kind: 'source_fetch_failed', reason: 'teapot', platform: 'web' })).toBeNull();
    expect(parseImportResult({ kind: 'source_fetch_failed', platform: 'web' })).toBeNull();
    expect(parseImportResult({ kind: 'source_fetch_failed', reason: 42, platform: 'web' })).toBeNull();
  });

  /**
   * Two producers share this variant, and the platform is the only thing
   * that tells them apart for whoever has to fix the failure — so an
   * absent one is version skew, failed on exactly like an unknown reason.
   */
  test('rejects a fetch failure that names no platform, or one outside the vocabulary', () => {
    expect(parseImportResult({ kind: 'source_fetch_failed', reason: 'refused' })).toBeNull();
    expect(parseImportResult({ kind: 'source_fetch_failed', reason: 'refused', platform: 'pinterest' })).toBeNull();
  });

  /** The two routes that share this variant stay two numbers, not one. */
  test('keeps a YouTube fetch failure distinct from a web one', () => {
    const youtube = parseImportResult({
      kind: 'source_fetch_failed',
      reason: 'missing_credentials',
      platform: 'youtube',
    });
    const web = parseImportResult({ kind: 'source_fetch_failed', reason: 'not_found', platform: 'web' });
    expect(youtube?.kind === 'source_fetch_failed' && youtube.platform).toBe('youtube');
    expect(web?.kind === 'source_fetch_failed' && web.platform).toBe('web');
  });

  /** oEmbed's vocabulary overlaps this one but is not it — the two unions are separate on purpose (types.ts). */
  test('rejects an oEmbed-only reason smuggled onto this variant', () => {
    expect(parseImportResult({ kind: 'source_fetch_failed', reason: 'region_locked', platform: 'web' })).toBeNull();
    expect(parseImportResult({ kind: 'source_fetch_failed', reason: 'invalid_url', platform: 'web' })).toBeNull();
  });

  /**
   * `refused` and `forbidden` are one word apart and name opposite
   * decisions — ours and theirs (types.ts). A client that quietly folded a
   * 403 into `refused` would show copy blaming Remy's own safety guard for
   * a publisher's bot wall, so each must survive the trip home as itself.
   */
  test('keeps refused and forbidden distinct rather than collapsing one into the other', () => {
    const refused = parseImportResult({ kind: 'source_fetch_failed', reason: 'refused', platform: 'web' });
    const forbidden = parseImportResult({ kind: 'source_fetch_failed', reason: 'forbidden', platform: 'web' });
    expect(refused).toEqual({ kind: 'source_fetch_failed', reason: 'refused', platform: 'web' });
    expect(forbidden).toEqual({ kind: 'source_fetch_failed', reason: 'forbidden', platform: 'web' });
    expect(refused).not.toEqual(forbidden);
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

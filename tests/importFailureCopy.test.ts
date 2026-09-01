import { describe, expect, test } from 'vitest';
import type { OembedErrorReason } from '@/lib/oembed';
import { buildImportFailureCopy, type ImportFailureResult } from '@/components/importFailureCopy';

const DISPLAY_ONLY_RESULT: ImportFailureResult = {
  kind: 'display_only',
  platform: 'instagram',
  sourceUrl: 'https://www.instagram.com/reel/Cx1y2z3',
  attribution: {
    authorName: 'plantaardigpauline',
    authorUrl: 'https://www.instagram.com/plantaardigpauline',
    thumbnailUrl: 'https://scontent.cdninstagram.com/pasta~thumb.jpg',
  },
};

/**
 * IMP-02. `no_recipe_in_caption` now carries a required `attribution` —
 * the function only ever constructs it after oEmbed has already resolved
 * (see types.ts's doc comment on that variant), so every test literal of
 * this kind needs one, exactly like `DISPLAY_ONLY_RESULT` above already
 * does for its own variant.
 */
const NO_RECIPE_ATTRIBUTION = {
  authorName: 'kokenmetkees',
  authorUrl: 'https://www.tiktok.com/@kokenmetkees',
  thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
};

describe('buildImportFailureCopy', () => {
  test('unsupported_url: no retry (no URL context), manual entry not elevated', () => {
    const copy = buildImportFailureCopy({ kind: 'unsupported_url' });
    expect(copy.canRetry).toBe(false);
    expect(copy.manualEntryIsPrimary).toBe(false);
    expect(copy.quote).toBeNull();
  });

  test('no_recipe_in_caption: manual entry elevated, carries the caption through as a quote', () => {
    const result: ImportFailureResult = {
      kind: 'no_recipe_in_caption',
      caption: 'POV: lekker eten vanavond',
      attribution: NO_RECIPE_ATTRIBUTION,
    };
    const copy = buildImportFailureCopy(result);
    expect(copy.manualEntryIsPrimary).toBe(true);
    expect(copy.canRetry).toBe(false);
    expect(copy.quote).toBe('POV: lekker eten vanavond');
  });

  test('no_recipe_in_caption: a null caption (nothing to read) surfaces no quote', () => {
    const copy = buildImportFailureCopy({ kind: 'no_recipe_in_caption', caption: null, attribution: NO_RECIPE_ATTRIBUTION });
    expect(copy.quote).toBeNull();
  });

  test('llm_request_failed: retryable, manual entry not elevated (usually transient)', () => {
    const copy = buildImportFailureCopy({ kind: 'llm_request_failed' });
    expect(copy.canRetry).toBe(true);
    expect(copy.manualEntryIsPrimary).toBe(false);
  });

  test('parse_failed: retryable AND manual entry elevated — distinct from llm_request_failed', () => {
    const copy = buildImportFailureCopy({ kind: 'parse_failed' });
    expect(copy.canRetry).toBe(true);
    expect(copy.manualEntryIsPrimary).toBe(true);
  });

  test('llm_request_failed and parse_failed never collapse into identical copy', () => {
    const llmCopy = buildImportFailureCopy({ kind: 'llm_request_failed' });
    const parseCopy = buildImportFailureCopy({ kind: 'parse_failed' });
    expect(llmCopy.title).not.toBe(parseCopy.title);
    expect(llmCopy.body).not.toBe(parseCopy.body);
  });

  test('oembed_failed: every reason maps to distinct, non-empty body copy', () => {
    const reasons: readonly OembedErrorReason[] = [
      'invalid_url',
      'missing_credentials',
      'not_found',
      'region_locked',
      'rate_limited',
      'invalid_response',
      'network_error',
      'unknown_error',
    ];

    const bodies = reasons.map((reason) => buildImportFailureCopy({ kind: 'oembed_failed', reason }).body);
    expect(new Set(bodies).size).toBe(reasons.length);
    for (const body of bodies) {
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test('oembed_failed is always retryable', () => {
    const copy = buildImportFailureCopy({ kind: 'oembed_failed', reason: 'rate_limited' });
    expect(copy.canRetry).toBe(true);
  });

  test('none of the failure copy ever claims safety ("veilig")', () => {
    const results: readonly ImportFailureResult[] = [
      { kind: 'unsupported_url' },
      { kind: 'oembed_failed', reason: 'not_found' },
      { kind: 'no_recipe_in_caption', caption: null, attribution: NO_RECIPE_ATTRIBUTION },
      { kind: 'llm_request_failed' },
      { kind: 'parse_failed' },
      DISPLAY_ONLY_RESULT,
    ];
    for (const result of results) {
      const copy = buildImportFailureCopy(result);
      expect((copy.title + ' ' + copy.body).toLowerCase()).not.toContain('veilig');
    }
  });
});

/**
 * `display_only` is the one member of `ImportFailureResult` that is not a
 * failure (see importFailureCopy.ts's own note): oEmbed resolved, the
 * creator is known, and we deliberately never asked the model. The copy has
 * to read that way — these tests exist so a later edit cannot quietly turn
 * a working path back into an apology.
 */
describe('buildImportFailureCopy — display_only', () => {
  test('manual entry is the elevated action; retrying is not offered', () => {
    const copy = buildImportFailureCopy(DISPLAY_ONLY_RESULT);
    expect(copy.manualEntryIsPrimary).toBe(true);
    // Not transient: the same link resolves the same way every time, so an
    // "Opnieuw proberen" button would promise a different answer it cannot
    // deliver.
    expect(copy.canRetry).toBe(false);
  });

  test('never quotes a caption — none is ever returned for this variant', () => {
    expect(buildImportFailureCopy(DISPLAY_ONLY_RESULT).quote).toBeNull();
  });

  test('names the platform the user actually pasted', () => {
    const copy = buildImportFailureCopy(DISPLAY_ONLY_RESULT);
    expect(`${copy.title} ${copy.body}`).toContain('Instagram');
  });

  test('reads as a working path, not as breakage', () => {
    const copy = buildImportFailureCopy(DISPLAY_ONLY_RESULT);
    const text = `${copy.title} ${copy.body}`.toLowerCase();
    for (const brokenWord of ['mislukt', 'fout', 'ging mis', 'niet gelukt', 'probeer het opnieuw']) {
      expect(text).not.toContain(brokenWord);
    }
  });

  test('does not reuse no_recipe_in_caption copy — a different reason deserves different words', () => {
    const displayOnly = buildImportFailureCopy(DISPLAY_ONLY_RESULT);
    const noRecipe = buildImportFailureCopy({ kind: 'no_recipe_in_caption', caption: null, attribution: NO_RECIPE_ATTRIBUTION });
    expect(displayOnly.title).not.toBe(noRecipe.title);
    expect(displayOnly.body).not.toBe(noRecipe.body);
  });
});

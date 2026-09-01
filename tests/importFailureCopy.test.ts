import { describe, expect, test } from 'vitest';
import type { OembedErrorReason } from '@/lib/oembed';
import type { SourceFetchFailureReason } from '@/domain/import/types';
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

  /**
   * The copy said "Remy herkent links van TikTok, Instagram en YouTube"
   * while ordinary recipe pages were already accepted — a sentence telling
   * users we reject links we accept. It had been wrong once before, for
   * the same reason, which is why the fix is to stop naming platforms
   * rather than to add one more. This test is what keeps the list from
   * growing back.
   */
  test('unsupported_url: never names the platforms Remy accepts, since it now accepts almost any page', () => {
    const copy = buildImportFailureCopy({ kind: 'unsupported_url' });
    const text = `${copy.title} ${copy.body}`;
    for (const platformName of ['TikTok', 'Instagram', 'YouTube']) {
      expect(text).not.toContain(platformName);
    }
  });

  test('unsupported_url: describes what is rejected — an address Remy cannot open', () => {
    const copy = buildImportFailureCopy({ kind: 'unsupported_url' });
    expect(copy.body.toLowerCase()).toContain('webadres');
    expect(copy.body.length).toBeGreaterThan(0);
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
      { kind: 'no_recipe_on_page' },
      { kind: 'source_fetch_failed', reason: 'refused' },
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

/**
 * The web route's own "nothing here" (types.ts). Like `display_only`, it
 * is not an outage — the page was read without incident and simply does
 * not publish a machine-readable recipe — so the copy must not apologise
 * for a failure that did not happen, and must not offer a retry that
 * would read the same page and find the same nothing.
 */
describe('buildImportFailureCopy — no_recipe_on_page', () => {
  const RESULT: ImportFailureResult = { kind: 'no_recipe_on_page' };

  test('elevates manual entry and offers no retry — a second read finds the same nothing', () => {
    const copy = buildImportFailureCopy(RESULT);
    expect(copy.manualEntryIsPrimary).toBe(true);
    expect(copy.canRetry).toBe(false);
  });

  test('quotes nothing — this variant carries no caption to show', () => {
    expect(buildImportFailureCopy(RESULT).quote).toBeNull();
  });

  test('has a non-empty title and body of its own', () => {
    const copy = buildImportFailureCopy(RESULT);
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.body.length).toBeGreaterThan(0);
  });

  /**
   * Sibling variants, different reasons, different words. Telling someone
   * whose food blog failed that "sommige makers vertellen het recept alleen
   * hardop in de video" is copy written for a different problem.
   */
  test('does not reuse no_recipe_in_caption copy — a page is not a video', () => {
    const onPage = buildImportFailureCopy(RESULT);
    const inCaption = buildImportFailureCopy({
      kind: 'no_recipe_in_caption',
      caption: null,
      attribution: NO_RECIPE_ATTRIBUTION,
    });
    expect(onPage.title).not.toBe(inCaption.title);
    expect(onPage.body).not.toBe(inCaption.body);
  });

  test('never mentions a bijschrift, which a web page does not have', () => {
    const copy = buildImportFailureCopy(RESULT);
    expect(`${copy.title} ${copy.body}`.toLowerCase()).not.toContain('bijschrift');
  });
});

describe('buildImportFailureCopy — source_fetch_failed', () => {
  const REASONS: readonly SourceFetchFailureReason[] = [
    'refused',
    'not_found',
    'server_error',
    'too_large',
    'not_html',
    'network_error',
    'missing_credentials',
  ];

  test('every reason maps to distinct, non-empty body copy', () => {
    const bodies = REASONS.map((reason) => buildImportFailureCopy({ kind: 'source_fetch_failed', reason }).body);
    expect(new Set(bodies).size).toBe(REASONS.length);
    for (const body of bodies) {
      expect(body.length).toBeGreaterThan(0);
    }
  });

  test('shares one title across both producers — the user pasted a link either way', () => {
    const titles = REASONS.map((reason) => buildImportFailureCopy({ kind: 'source_fetch_failed', reason }).title);
    expect(new Set(titles).size).toBe(1);
  });

  /**
   * The one property this copy must not get wrong: a retry button on a
   * failure a retry cannot fix. A missing API key is a deployment fact, and
   * a too-large or non-HTML response is a property of the address itself —
   * all three return the same answer however often they are asked.
   */
  test('offers no retry for the three failures a retry cannot help', () => {
    for (const reason of ['missing_credentials', 'too_large', 'not_html'] as const) {
      const copy = buildImportFailureCopy({ kind: 'source_fetch_failed', reason });
      expect(copy.canRetry).toBe(false);
    }
  });

  test('offers a retry for the server and network failures, which are usually a bad moment', () => {
    for (const reason of ['refused', 'not_found', 'server_error', 'network_error'] as const) {
      const copy = buildImportFailureCopy({ kind: 'source_fetch_failed', reason });
      expect(copy.canRetry).toBe(true);
    }
  });

  /** Typing it yourself becomes the elevated action exactly when it is the only way forward. */
  test('elevates manual entry precisely when a retry is not offered', () => {
    for (const reason of REASONS) {
      const copy = buildImportFailureCopy({ kind: 'source_fetch_failed', reason });
      expect(copy.manualEntryIsPrimary).toBe(!copy.canRetry);
    }
  });

  test('quotes nothing — nothing was ever read', () => {
    for (const reason of REASONS) {
      expect(buildImportFailureCopy({ kind: 'source_fetch_failed', reason }).quote).toBeNull();
    }
  });

  /** The missing YouTube key is named as such rather than hidden behind generic outage copy. */
  test('missing_credentials names YouTube instead of blaming the link', () => {
    const copy = buildImportFailureCopy({ kind: 'source_fetch_failed', reason: 'missing_credentials' });
    expect(copy.body).toContain('YouTube');
  });
});

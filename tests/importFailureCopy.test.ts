import { describe, expect, test } from 'vitest';
import type { OembedErrorReason } from '@/lib/oembed';
import { buildImportFailureCopy, type ImportFailureResult } from '@/components/importFailureCopy';

describe('buildImportFailureCopy', () => {
  test('unsupported_url: no retry (no URL context), manual entry not elevated', () => {
    const copy = buildImportFailureCopy({ kind: 'unsupported_url' });
    expect(copy.canRetry).toBe(false);
    expect(copy.manualEntryIsPrimary).toBe(false);
    expect(copy.quote).toBeNull();
  });

  test('no_recipe_in_caption: manual entry elevated, carries the caption through as a quote', () => {
    const result: ImportFailureResult = { kind: 'no_recipe_in_caption', caption: 'POV: lekker eten vanavond' };
    const copy = buildImportFailureCopy(result);
    expect(copy.manualEntryIsPrimary).toBe(true);
    expect(copy.canRetry).toBe(false);
    expect(copy.quote).toBe('POV: lekker eten vanavond');
  });

  test('no_recipe_in_caption: a null caption (nothing to read) surfaces no quote', () => {
    const copy = buildImportFailureCopy({ kind: 'no_recipe_in_caption', caption: null });
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
      { kind: 'no_recipe_in_caption', caption: null },
      { kind: 'llm_request_failed' },
      { kind: 'parse_failed' },
    ];
    for (const result of results) {
      const copy = buildImportFailureCopy(result);
      expect((copy.title + ' ' + copy.body).toLowerCase()).not.toContain('veilig');
    }
  });
});

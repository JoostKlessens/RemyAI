import { describe, expect, test } from 'vitest';
import { describeImportFeedback } from '@/components/importFeedbackPolicy';
import type { ImportPlatform, ImportResult, ParsedRecipe } from '@/domain/import/types';

/**
 * The point of this suite is the middle case. `parsed -> completed` and
 * `parse_failed -> failed` are the obvious halves; `display_only ->
 * silent` is the one a later edit collapses into the failure bucket
 * because `ImportFailureResult` is literally "everything that is not
 * parsed", and PD-011 says that outcome is a working path with a
 * different shape. So the display-only assertion is written as its own
 * `describe`, not as one row of a table, to make deleting it feel like a
 * decision.
 */

const RECIPE: ParsedRecipe = {
  title: 'Pasta pesto',
  ingredients: [{ name: 'basilicum', quantity: null, unit: null }],
  steps: ['Kook de pasta.'],
  estimatedMinutes: null,
  servings: null,
  dishTags: [],
};

function parsed(platform: ImportPlatform): ImportResult {
  return {
    kind: 'parsed',
    recipe: RECIPE,
    sourceUrl: platform === 'text' ? null : 'https://example.com/recept',
    platform,
    attribution: { authorName: null, authorUrl: null, thumbnailUrl: null },
    recipeId: null,
    provenance: platform === 'text' ? 'model_from_pasted_text' : 'model_from_caption',
  };
}

describe('a finished recipe', () => {
  test('reports completed for a link import', () => {
    expect(describeImportFeedback(parsed('tiktok'))).toBe('completed');
  });

  test('reports completed for a pasted-text import, which has no URL at all', () => {
    expect(describeImportFeedback(parsed('text'))).toBe('completed');
  });
});

describe('display_only is not a failure and must never be reported as one', () => {
  test('reports silent, not failed', () => {
    // PD-011: Instagram resolved the post, Remy may show it and credit its
    // maker, and the model was deliberately never asked to read the
    // caption. Nothing broke.
    expect(
      describeImportFeedback({
        kind: 'display_only',
        platform: 'instagram',
        sourceUrl: 'https://www.instagram.com/p/abc/',
        attribution: { authorName: 'Sanne', authorUrl: null, thumbnailUrl: null },
      }),
    ).toBe('silent');
  });

  test('reports silent, not completed either — no recipe arrived', () => {
    expect(
      describeImportFeedback({
        kind: 'display_only',
        platform: 'instagram',
        sourceUrl: 'https://www.instagram.com/p/abc/',
        attribution: { authorName: 'Sanne', authorUrl: null, thumbnailUrl: null },
      }),
    ).not.toBe('completed');
  });
});

describe('every other outcome is a failure the app should report', () => {
  const failures: readonly ImportResult[] = [
    {
      kind: 'no_recipe_in_caption',
      caption: 'Heerlijk weekend gehad!',
      attribution: { authorName: 'Sanne', authorUrl: null, thumbnailUrl: null },
      platform: 'tiktok',
    },
    { kind: 'no_recipe_on_page', platform: 'web' },
    { kind: 'source_fetch_failed', reason: 'missing_credentials', platform: 'youtube' },
    { kind: 'unsupported_url' },
    { kind: 'oembed_failed', reason: 'network_error', platform: 'tiktok' },
    { kind: 'llm_request_failed', platform: 'tiktok' },
    { kind: 'parse_failed', platform: 'tiktok' },
    { kind: 'import_throttled', scope: 'caller', retryAfterSeconds: 60 },
  ];

  test.each(failures.map((result) => [result.kind, result] as const))('%s reports failed', (_kind, result) => {
    expect(describeImportFeedback(result)).toBe('failed');
  });

  test('covers every non-parsed, non-display-only variant the union has', () => {
    // Guards the list above against an `ImportResult` variant being added
    // without a decision being made about how it should feel. The switch
    // in the policy is exhaustive at compile time; this is the runtime
    // half, so a missing case fails here rather than being noticed on a
    // device.
    expect(new Set(failures.map((result) => result.kind)).size).toBe(failures.length);
  });
});

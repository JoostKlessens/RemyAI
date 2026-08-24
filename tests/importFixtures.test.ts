import { describe, expect, test } from 'vitest';
import { buildFixtureImportAttempt, detectFixtureScenario } from '@/app/import/_fixtures';

describe('detectFixtureScenario', () => {
  test('defaults to the happy "parsed" path for an ordinary URL', () => {
    expect(detectFixtureScenario('https://www.tiktok.com/@kokenmetkees/video/000001')).toBe('parsed');
  });

  test('recognises each demo marker', () => {
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/geen-recept')).toBe('no_recipe_in_caption');
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/oembed-fout')).toBe('oembed_failed');
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/llm-fout')).toBe('llm_request_failed');
    expect(detectFixtureScenario('https://www.tiktok.com/@x/video/parse-fout')).toBe('parse_failed');
  });
});

describe('buildFixtureImportAttempt', () => {
  test('"parsed" carries a recipe, the given sourceUrl/platform, and a known author', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'tiktok', 'https://www.tiktok.com/@x/video/1');
    expect(attempt.result.kind).toBe('parsed');
    expect(attempt.authorName).not.toBeNull();
    if (attempt.result.kind === 'parsed') {
      expect(attempt.result.recipe.ingredients.length).toBeGreaterThan(0);
      expect(attempt.result.recipe.steps.length).toBeGreaterThan(0);
      expect(attempt.result.sourceUrl).toBe('https://www.tiktok.com/@x/video/1');
      expect(attempt.result.platform).toBe('tiktok');
    }
  });

  test('"parsed" on tiktok carries a thumbnail, both as a sidecar and inside attribution', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'tiktok', 'https://www.tiktok.com/@x/video/1');
    expect(attempt.thumbnailUrl).not.toBeNull();
    if (attempt.result.kind === 'parsed') {
      expect(attempt.result.attribution?.thumbnailUrl).toBe(attempt.thumbnailUrl);
      expect(attempt.result.attribution?.authorName).toBe(attempt.authorName);
    }
  });

  test('"parsed" on instagram has no thumbnail — demos the library monogram fallback honestly', () => {
    const attempt = buildFixtureImportAttempt('parsed', 'instagram', 'https://www.instagram.com/reel/1');
    expect(attempt.thumbnailUrl).toBeNull();
    if (attempt.result.kind === 'parsed') {
      expect(attempt.result.attribution?.thumbnailUrl).toBeNull();
    }
  });

  test('"no_recipe_in_caption" still carries an author — oEmbed succeeded before the model ran', () => {
    const attempt = buildFixtureImportAttempt('no_recipe_in_caption', 'instagram', 'https://www.instagram.com/reel/1');
    expect(attempt.result.kind).toBe('no_recipe_in_caption');
    expect(attempt.authorName).not.toBeNull();
    if (attempt.result.kind === 'no_recipe_in_caption') {
      expect(attempt.result.caption).not.toBeNull();
    }
  });

  test('"oembed_failed" never carries an author — oEmbed itself never succeeded', () => {
    const attempt = buildFixtureImportAttempt('oembed_failed', 'instagram', 'https://www.instagram.com/reel/2');
    expect(attempt.result.kind).toBe('oembed_failed');
    expect(attempt.authorName).toBeNull();
  });

  test('"llm_request_failed" and "parse_failed" carry an author but no recipe', () => {
    const llmAttempt = buildFixtureImportAttempt('llm_request_failed', 'tiktok', 'https://www.tiktok.com/@x/video/3');
    const parseAttempt = buildFixtureImportAttempt('parse_failed', 'tiktok', 'https://www.tiktok.com/@x/video/4');
    expect(llmAttempt.result.kind).toBe('llm_request_failed');
    expect(llmAttempt.authorName).not.toBeNull();
    expect(parseAttempt.result.kind).toBe('parse_failed');
    expect(parseAttempt.authorName).not.toBeNull();
  });
});

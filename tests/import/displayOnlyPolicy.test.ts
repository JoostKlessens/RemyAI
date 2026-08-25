import { describe, expect, test } from 'vitest';
import type { OembedPayload } from '@/lib/oembed';
import { buildDisplayOnlyResult, isDisplayOnlyPlatform } from '@/domain/import/displayOnlyPolicy';

const INSTAGRAM_URL = 'https://www.instagram.com/reel/Cx1y2z3';

function makePayload(overrides: Partial<OembedPayload> = {}): OembedPayload {
  return {
    title: 'POV: de makkelijkste pasta van de week',
    authorName: 'plantaardigpauline',
    authorUrl: 'https://www.instagram.com/plantaardigpauline',
    thumbnailUrl: 'https://scontent.cdninstagram.com/pasta~thumb.jpg',
    ...overrides,
  };
}

describe('isDisplayOnlyPlatform', () => {
  test('instagram is display-only — Meta permits embedding, not caption reuse (PD-011)', () => {
    expect(isDisplayOnlyPlatform('instagram')).toBe(true);
  });

  test('tiktok is not display-only — its oEmbed is public and extraction is unaffected', () => {
    expect(isDisplayOnlyPlatform('tiktok')).toBe(false);
  });
});

describe('buildDisplayOnlyResult', () => {
  test('returns a display_only result carrying the source URL, platform and creator', () => {
    const result = buildDisplayOnlyResult({
      sourceUrl: INSTAGRAM_URL,
      platform: 'instagram',
      payload: makePayload(),
    });

    expect(result).toEqual({
      kind: 'display_only',
      platform: 'instagram',
      sourceUrl: INSTAGRAM_URL,
      attribution: {
        authorName: 'plantaardigpauline',
        authorUrl: 'https://www.instagram.com/plantaardigpauline',
        thumbnailUrl: 'https://scontent.cdninstagram.com/pasta~thumb.jpg',
      },
    });
  });

  /**
   * The whole point of the variant: the caption is metadata we may render
   * an embed from, not text we may keep or derive a recipe from. A result
   * that smuggled it back to the client would be exactly the use Meta's
   * policy excludes — so this asserts on the serialized shape, not merely
   * on the absence of one named field.
   */
  test('never carries the caption forward, even though oEmbed returned one', () => {
    const caption = 'Hele recept staat hier: 350 g pasta, 4 el pesto, 100 g roomkaas';
    const result = buildDisplayOnlyResult({
      sourceUrl: INSTAGRAM_URL,
      platform: 'instagram',
      payload: makePayload({ title: caption }),
    });

    expect(JSON.stringify(result)).not.toContain(caption);
    expect(Object.keys(result).sort()).toEqual(['attribution', 'kind', 'platform', 'sourceUrl']);
  });

  test('a creator oEmbed could not name stays an explicit null, never a guess', () => {
    const result = buildDisplayOnlyResult({
      sourceUrl: INSTAGRAM_URL,
      platform: 'instagram',
      payload: makePayload({ authorName: null, authorUrl: null, thumbnailUrl: null }),
    });

    expect(result.attribution).toEqual({ authorName: null, authorUrl: null, thumbnailUrl: null });
  });
});

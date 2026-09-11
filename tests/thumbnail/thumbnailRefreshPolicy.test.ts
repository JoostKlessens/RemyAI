import { describe, expect, test } from 'vitest';
import type { OembedErrorReason, OembedResult } from '@/lib/oembed';
import {
  classifyThumbnailRefreshOutcome,
  resolveThumbnailRefreshTarget,
} from '@/domain/thumbnail/thumbnailRefreshPolicy';

function oembedError(reason: OembedErrorReason): OembedResult {
  return { kind: 'error', reason };
}

function oembedOk(thumbnailUrl: string | null): OembedResult {
  return {
    kind: 'ok',
    payload: { thumbnailUrl, title: 'Creamy cajun chicken pasta', authorName: 'chefremy', authorUrl: null },
  };
}

describe('resolveThumbnailRefreshTarget — nothing to ask about', () => {
  test('refuses a meal with no source at all, which is the ordinary manual entry', () => {
    expect(resolveThumbnailRefreshTarget(null)).toEqual({ kind: 'refused', reason: 'no_source_url' });
  });

  test('treats a blank string exactly as a null, never as an address', () => {
    expect(resolveThumbnailRefreshTarget('   ')).toEqual({ kind: 'refused', reason: 'no_source_url' });
  });

  test('refuses a string that is not a URL', () => {
    expect(resolveThumbnailRefreshTarget('creamy cajun chicken pasta')).toEqual({
      kind: 'refused',
      reason: 'unsupported_url',
    });
  });

  test('refuses a non-http scheme', () => {
    expect(resolveThumbnailRefreshTarget('ftp://www.tiktok.com/@chefremy/video/1')).toEqual({
      kind: 'refused',
      reason: 'unsupported_url',
    });
  });

  test('refuses a bare TikTok host, which names no post', () => {
    expect(resolveThumbnailRefreshTarget('https://www.tiktok.com/')).toEqual({
      kind: 'refused',
      reason: 'unsupported_url',
    });
  });
});

describe('resolveThumbnailRefreshTarget — TikTok is the one platform that qualifies', () => {
  test('accepts a canonical TikTok post URL', () => {
    expect(resolveThumbnailRefreshTarget('https://www.tiktok.com/@chefremy/video/123')).toEqual({
      kind: 'refreshable',
      requestUrl: 'https://www.tiktok.com/@chefremy/video/123',
    });
  });

  test('hands oEmbed the normalized address, not the stored one', () => {
    // The mobile host and the tracking query are exactly what oembed.ts's
    // own URL validation would trip over.
    expect(resolveThumbnailRefreshTarget('https://m.tiktok.com/@chefremy/video/123?is_from_webapp=1')).toEqual({
      kind: 'refreshable',
      requestUrl: 'https://www.tiktok.com/@chefremy/video/123',
    });
  });

  test('refuses an unresolved TikTok short link rather than following the redirect on the device', () => {
    expect(resolveThumbnailRefreshTarget('https://vm.tiktok.com/ZMabc123/')).toEqual({
      kind: 'refused',
      reason: 'unresolved_short_link',
    });
  });
});

describe('resolveThumbnailRefreshTarget — the three platforms that never get asked', () => {
  test('refuses Instagram before any call, because the token belongs to the edge function', () => {
    expect(resolveThumbnailRefreshTarget('https://www.instagram.com/p/abc123/')).toEqual({
      kind: 'refused',
      reason: 'instagram_needs_credentials',
    });
  });

  test('refuses YouTube because an i.ytimg.com address does not expire', () => {
    expect(resolveThumbnailRefreshTarget('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'refused',
      reason: 'thumbnail_does_not_expire',
    });
  });

  test('refuses a YouTube short link for the same reason as the canonical form', () => {
    expect(resolveThumbnailRefreshTarget('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      kind: 'refused',
      reason: 'thumbnail_does_not_expire',
    });
  });

  test('refuses an ordinary recipe page: the still sits on the publishers own server', () => {
    expect(resolveThumbnailRefreshTarget('https://www.ah.nl/allerhande/recept/R-R123/pasta')).toEqual({
      kind: 'refused',
      reason: 'thumbnail_does_not_expire',
    });
  });

  test('separates the two refusals: Instagram is a credential problem, a web page is not', () => {
    const instagram = resolveThumbnailRefreshTarget('https://www.instagram.com/reel/xyz/');
    const web = resolveThumbnailRefreshTarget('https://example.com/recept/pasta');

    expect(instagram).not.toEqual(web);
  });
});

describe('classifyThumbnailRefreshOutcome', () => {
  test('a fresh thumbnail replaces the dead one', () => {
    expect(classifyThumbnailRefreshOutcome(oembedOk('https://p16-sign.tiktokcdn.com/fresh.jpg'))).toEqual({
      kind: 'replace',
      thumbnailUrl: 'https://p16-sign.tiktokcdn.com/fresh.jpg',
    });
  });

  test('a healthy post with no still is not counted as a failure', () => {
    expect(classifyThumbnailRefreshOutcome(oembedOk(null))).toEqual({ kind: 'nothing_to_show' });
  });

  test('a 429 stands the whole session down rather than closing one post', () => {
    expect(classifyThumbnailRefreshOutcome(oembedError('rate_limited'))).toEqual({ kind: 'stand_down' });
  });

  test.each<OembedErrorReason>(['not_found', 'region_locked', 'invalid_url', 'missing_credentials'])(
    'treats %s as settled: this post will not answer differently later',
    (reason) => {
      expect(classifyThumbnailRefreshOutcome(oembedError(reason))).toEqual({ kind: 'gone' });
    },
  );

  test.each<OembedErrorReason>(['network_error', 'invalid_response', 'unknown_error'])(
    'treats %s as circumstantial, so a later session may still succeed',
    (reason) => {
      expect(classifyThumbnailRefreshOutcome(oembedError(reason))).toEqual({ kind: 'unavailable' });
    },
  );

  test('only rate limiting produces the member the budget acts on', () => {
    const everyReason: readonly OembedErrorReason[] = [
      'invalid_url',
      'missing_credentials',
      'not_found',
      'region_locked',
      'rate_limited',
      'invalid_response',
      'network_error',
      'unknown_error',
    ];

    const standDowns = everyReason.filter(
      (reason) => classifyThumbnailRefreshOutcome(oembedError(reason)).kind === 'stand_down',
    );

    expect(standDowns).toEqual(['rate_limited']);
  });
});

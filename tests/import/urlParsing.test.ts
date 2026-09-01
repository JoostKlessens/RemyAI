import { describe, expect, test } from 'vitest';
import { normalizeRecipeUrl } from '@/domain/import/urlParsing';

describe('normalizeRecipeUrl — TikTok', () => {
  test('accepts a canonical www.tiktok.com video URL unchanged', () => {
    const result = normalizeRecipeUrl('https://www.tiktok.com/@chefremy/video/123456789');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'tiktok',
      normalizedUrl: 'https://www.tiktok.com/@chefremy/video/123456789',
      isShortLink: false,
    });
  });

  test('normalizes a bare tiktok.com host to www.tiktok.com', () => {
    const result = normalizeRecipeUrl('https://tiktok.com/@chefremy/video/123');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'tiktok',
      normalizedUrl: 'https://www.tiktok.com/@chefremy/video/123',
      isShortLink: false,
    });
  });

  test('normalizes the mobile host m.tiktok.com to www.tiktok.com', () => {
    const result = normalizeRecipeUrl('https://m.tiktok.com/@chefremy/video/123');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'tiktok',
      normalizedUrl: 'https://www.tiktok.com/@chefremy/video/123',
      isShortLink: false,
    });
  });

  test('strips share-sheet query-param noise', () => {
    const result = normalizeRecipeUrl(
      'https://www.tiktok.com/@chefremy/video/123?is_from_webapp=1&sender_device=pc&sender_web_id=987',
    );
    expect(result).toEqual({
      kind: 'ok',
      platform: 'tiktok',
      normalizedUrl: 'https://www.tiktok.com/@chefremy/video/123',
      isShortLink: false,
    });
  });

  test('recognizes vm.tiktok.com short links and flags isShortLink, leaving the host untouched', () => {
    const result = normalizeRecipeUrl('https://vm.tiktok.com/ZMabcdef1/');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'tiktok',
      normalizedUrl: 'https://vm.tiktok.com/ZMabcdef1/',
      isShortLink: true,
    });
  });

  test('recognizes vt.tiktok.com short links', () => {
    const result = normalizeRecipeUrl('https://vt.tiktok.com/ZMabcdef2/');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.isShortLink).toBe(true);
      expect(result.platform).toBe('tiktok');
    }
  });

  test('upgrades a plain http:// TikTok URL to https://', () => {
    const result = normalizeRecipeUrl('http://www.tiktok.com/@chefremy/video/123');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'tiktok',
      normalizedUrl: 'https://www.tiktok.com/@chefremy/video/123',
      isShortLink: false,
    });
  });

  test('is case-insensitive on the host', () => {
    const result = normalizeRecipeUrl('https://WWW.TIKTOK.COM/@chefremy/video/123');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://www.tiktok.com/@chefremy/video/123');
    }
  });
});

describe('normalizeRecipeUrl — Instagram', () => {
  test('accepts a canonical www.instagram.com reel URL unchanged', () => {
    const result = normalizeRecipeUrl('https://www.instagram.com/reel/Cabc123xyz/');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'instagram',
      normalizedUrl: 'https://www.instagram.com/reel/Cabc123xyz/',
      isShortLink: false,
    });
  });

  test('normalizes a bare instagram.com host to www.instagram.com', () => {
    const result = normalizeRecipeUrl('https://instagram.com/reel/Cabc123xyz/');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://www.instagram.com/reel/Cabc123xyz/');
    }
  });

  test('normalizes the mobile host m.instagram.com', () => {
    const result = normalizeRecipeUrl('https://m.instagram.com/p/Cabc123xyz/');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://www.instagram.com/p/Cabc123xyz/');
    }
  });

  test('strips share-sheet query-param noise (igsh, utm_source)', () => {
    const result = normalizeRecipeUrl('https://www.instagram.com/reel/Cabc123xyz/?igsh=abc123&utm_source=ig_web_copy_link');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://www.instagram.com/reel/Cabc123xyz/');
    }
  });

  test('never flags an Instagram URL as a short link', () => {
    const result = normalizeRecipeUrl('https://www.instagram.com/reel/Cabc123xyz/');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.isShortLink).toBe(false);
    }
  });
});

describe('normalizeRecipeUrl — YouTube', () => {
  test('accepts a canonical www.youtube.com watch URL unchanged', () => {
    const result = normalizeRecipeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'youtube',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isShortLink: false,
    });
  });

  test('normalizes a bare youtube.com host to www.youtube.com', () => {
    const result = normalizeRecipeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'youtube',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isShortLink: false,
    });
  });

  test('normalizes the mobile host m.youtube.com', () => {
    const result = normalizeRecipeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'youtube',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isShortLink: false,
    });
  });

  /**
   * The one place this module reads a query parameter instead of
   * discarding it — see urlParsing.ts's `normalizeYouTubeUrl` header. Any
   * OTHER query param on the same URL is still noise and must still be
   * stripped, so this asserts both halves in one test.
   */
  test('reads the v query param as the id and strips every other query param', () => {
    const result = normalizeRecipeUrl(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=42s&feature=share',
    );
    expect(result).toEqual({
      kind: 'ok',
      platform: 'youtube',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isShortLink: false,
    });
  });

  test('normalizes a youtu.be short link to the canonical watch form, purely, without needing a redirect', () => {
    const result = normalizeRecipeUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'youtube',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isShortLink: false,
    });
  });

  test('strips query-param noise from a youtu.be short link', () => {
    const result = normalizeRecipeUrl('https://youtu.be/dQw4w9WgXcQ?t=42');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    }
  });

  test('normalizes a www.youtube.com/shorts/<id> URL to the canonical watch form', () => {
    const result = normalizeRecipeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'youtube',
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      isShortLink: false,
    });
  });

  test('strips query-param noise from a /shorts/<id> URL', () => {
    const result = normalizeRecipeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    }
  });

  test('a /shorts/<id> URL and its /watch?v= counterpart converge on the same canonical URL', () => {
    const fromShorts = normalizeRecipeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    const fromWatch = normalizeRecipeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(fromShorts).toEqual(fromWatch);
  });

  test('is case-insensitive on the host', () => {
    const result = normalizeRecipeUrl('https://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    }
  });

  test('never flags a YouTube URL as a short link, even youtu.be', () => {
    const result = normalizeRecipeUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.isShortLink).toBe(false);
    }
  });

  test('rejects a /watch URL with no v query param', () => {
    expect(normalizeRecipeUrl('https://www.youtube.com/watch')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('https://www.youtube.com/watch?list=PL123')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a /watch URL whose v value is not a valid id shape', () => {
    expect(normalizeRecipeUrl('https://www.youtube.com/watch?v=')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('https://www.youtube.com/watch?v=has space')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a /shorts/<id> URL whose id is not a valid id shape', () => {
    expect(normalizeRecipeUrl('https://www.youtube.com/shorts/has space')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a YouTube URL that is not one of the recognised shapes (channel, playlist, bare host)', () => {
    expect(normalizeRecipeUrl('https://www.youtube.com/channel/UC1234567890')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('https://www.youtube.com/playlist?list=PL123')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('https://www.youtube.com/')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('https://youtu.be/')).toEqual({ kind: 'unsupported_url' });
  });
});

describe('normalizeRecipeUrl — rejection cases (never throws, always rejects cleanly)', () => {
  test('rejects a completely unrelated domain', () => {
    expect(normalizeRecipeUrl('https://example.com/some/recipe')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a suffix-spoofed host (tiktok.com.evil.example)', () => {
    expect(normalizeRecipeUrl('https://tiktok.com.evil.example/@x/video/1')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a userinfo-trick URL where the real host is not tiktok.com', () => {
    expect(normalizeRecipeUrl('https://tiktok.com@evil.example/@x/video/1')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a suffix-spoofed YouTube host (youtube.com.evil.example)', () => {
    expect(normalizeRecipeUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'unsupported_url',
    });
  });

  test('rejects a suffix-spoofed youtu.be host (youtu.be.evil.example)', () => {
    expect(normalizeRecipeUrl('https://youtu.be.evil.example/dQw4w9WgXcQ')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a bare host with no path', () => {
    expect(normalizeRecipeUrl('https://www.tiktok.com/')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('https://www.instagram.com')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a non-URL string without throwing', () => {
    expect(() => normalizeRecipeUrl('not a url at all')).not.toThrow();
    expect(normalizeRecipeUrl('not a url at all')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects an empty or whitespace-only string', () => {
    expect(normalizeRecipeUrl('')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('   ')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a non-http(s) scheme', () => {
    expect(normalizeRecipeUrl('tiktok://@chefremy/video/123')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('mailto:someone@example.com')).toEqual({ kind: 'unsupported_url' });
  });
});

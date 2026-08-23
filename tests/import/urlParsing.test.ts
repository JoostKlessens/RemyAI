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

describe('normalizeRecipeUrl — rejection cases (never throws, always rejects cleanly)', () => {
  test('rejects a completely unrelated domain', () => {
    expect(normalizeRecipeUrl('https://example.com/some/recipe')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a YouTube URL', () => {
    expect(normalizeRecipeUrl('https://www.youtube.com/watch?v=abc123')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a suffix-spoofed host (tiktok.com.evil.example)', () => {
    expect(normalizeRecipeUrl('https://tiktok.com.evil.example/@x/video/1')).toEqual({ kind: 'unsupported_url' });
  });

  test('rejects a userinfo-trick URL where the real host is not tiktok.com', () => {
    expect(normalizeRecipeUrl('https://tiktok.com@evil.example/@x/video/1')).toEqual({ kind: 'unsupported_url' });
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

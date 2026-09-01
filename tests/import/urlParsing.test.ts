import { describe, expect, test } from 'vitest';
import { normalizeRecipeUrl, readYouTubeVideoId } from '@/domain/import/urlParsing';

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

describe('normalizeRecipeUrl — web (an ordinary recipe page)', () => {
  test('accepts an ordinary page on an unknown host as the web platform', () => {
    const result = normalizeRecipeUrl('https://www.leukerecepten.nl/recepten/traybake-kip/');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'web',
      normalizedUrl: 'https://www.leukerecepten.nl/recepten/traybake-kip/',
      isShortLink: false,
    });
  });

  /**
   * The single most important difference from the TikTok/Instagram path,
   * which discards every query param by construction. For a generic site
   * the query is frequently the page itself — drop `?p=1234` and the
   * fetcher reads a different page than the one the user pasted, then
   * stores that one under their link.
   */
  test('keeps a query string, because for a generic page it is often the page identity', () => {
    const result = normalizeRecipeUrl('https://voorbeeldkeuken.nl/index.php?p=1234&recipe=traybake');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://voorbeeldkeuken.nl/index.php?p=1234&recipe=traybake');
    }
  });

  test('strips only the named tracking parameters, leaving the rest untouched and in order', () => {
    const result = normalizeRecipeUrl(
      'https://voorbeeldkeuken.nl/recept?p=1234&utm_source=pinterest&b=2&fbclid=xyz&gclid=abc&igsh=def&a=1',
    );
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://voorbeeldkeuken.nl/recept?p=1234&b=2&a=1');
    }
  });

  test('never reorders the parameters it keeps — two orderings stay two deduplication keys', () => {
    const first = normalizeRecipeUrl('https://voorbeeldkeuken.nl/recept?a=1&b=2');
    const second = normalizeRecipeUrl('https://voorbeeldkeuken.nl/recept?b=2&a=1');
    expect(first.kind === 'ok' && first.normalizedUrl).toBe('https://voorbeeldkeuken.nl/recept?a=1&b=2');
    expect(second.kind === 'ok' && second.normalizedUrl).toBe('https://voorbeeldkeuken.nl/recept?b=2&a=1');
  });

  test('drops the fragment, lowercases the host and drops a default port', () => {
    const result = normalizeRecipeUrl('https://WWW.VoorbeeldKeuken.NL:443/recept#ingredienten');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.normalizedUrl).toBe('https://www.voorbeeldkeuken.nl/recept');
    }
  });

  test('keeps a non-default port, which is part of the address', () => {
    const result = normalizeRecipeUrl('https://voorbeeldkeuken.nl:8443/recept');
    expect(result.kind === 'ok' && result.normalizedUrl).toBe('https://voorbeeldkeuken.nl:8443/recept');
  });

  /**
   * Unlike TikTok/Instagram, whose output is hardcoded to `https://`.
   * Upgrading a third party's scheme would assert they serve TLS at that
   * address, which this module cannot know — see `normalizeWebUrl`.
   */
  test('leaves an http:// page on http rather than asserting the site serves TLS', () => {
    const result = normalizeRecipeUrl('http://voorbeeldkeuken.nl/recept');
    expect(result.kind === 'ok' && result.normalizedUrl).toBe('http://voorbeeldkeuken.nl/recept');
  });

  test('never flags a web URL as a short link — the fetcher follows redirects itself', () => {
    const result = normalizeRecipeUrl('https://pin.it/abc123');
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.isShortLink).toBe(false);
      expect(result.platform).toBe('web');
    }
  });

  test('a Pinterest pin is an ordinary web URL, needing no Pinterest-specific branch', () => {
    const result = normalizeRecipeUrl('https://www.pinterest.com/pin/123456789/');
    expect(result).toEqual({
      kind: 'ok',
      platform: 'web',
      normalizedUrl: 'https://www.pinterest.com/pin/123456789/',
      isShortLink: false,
    });
  });

  test('rejects a bare host with no path and no query — there is no specific page to import', () => {
    expect(normalizeRecipeUrl('https://voorbeeldkeuken.nl')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('https://voorbeeldkeuken.nl/')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('https://voorbeeldkeuken.nl/?utm_source=pinterest')).toEqual({
      kind: 'unsupported_url',
    });
  });

  test('accepts a root path when a surviving query names the page', () => {
    const result = normalizeRecipeUrl('https://voorbeeldkeuken.nl/?p=1234');
    expect(result.kind === 'ok' && result.normalizedUrl).toBe('https://voorbeeldkeuken.nl/?p=1234');
  });

  /**
   * The pure half of SSRF defence: `normalizeWebUrl` reuses
   * `isBlockedRedirectHost` from resolveShortLinkTarget.ts rather than
   * keeping a second, weaker copy, so a pasted URL and a redirect target
   * are held to one blocklist.
   */
  test('rejects a host pointing at this machine or the private network around it', () => {
    for (const url of [
      'http://localhost/recept',
      'http://127.0.0.1/recept',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/recept',
      'http://192.168.1.10/recept',
      'http://172.16.0.9/recept',
      'http://[::1]/recept',
    ]) {
      expect(normalizeRecipeUrl(url)).toEqual({ kind: 'unsupported_url' });
    }
  });

  /**
   * These used to assert `unsupported_url`. That was never the property
   * worth pinning down — the property is that a lookalike host is NOT
   * treated as the platform it imitates. It is now an ordinary page,
   * fetched as one, and never handed to TikTok's or YouTube's API.
   */
  test('a suffix-spoofed platform host resolves to web, never to the platform it imitates', () => {
    for (const url of [
      'https://tiktok.com.evil.example/@x/video/1',
      'https://tiktok.com@evil.example/@x/video/1',
      'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
      'https://youtu.be.evil.example/dQw4w9WgXcQ',
      'https://instagram.com.evil.example/reel/1',
    ]) {
      const result = normalizeRecipeUrl(url);
      expect(result.kind).toBe('ok');
      if (result.kind === 'ok') {
        expect(result.platform).toBe('web');
      }
    }
  });
});

describe('readYouTubeVideoId', () => {
  test('reads the id back out of the canonical form normalizeRecipeUrl produces', () => {
    const normalized = normalizeRecipeUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(normalized.kind).toBe('ok');
    if (normalized.kind === 'ok') {
      expect(readYouTubeVideoId(normalized.normalizedUrl)).toBe('dQw4w9WgXcQ');
    }
  });

  test('round-trips every recognised input shape through the normalizer', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?t=42',
    ]) {
      const normalized = normalizeRecipeUrl(url);
      expect(normalized.kind === 'ok' && readYouTubeVideoId(normalized.normalizedUrl)).toBe('dQw4w9WgXcQ');
    }
  });

  /**
   * Deliberately not a general YouTube URL parser: the way to handle any
   * other shape is to run it through `normalizeRecipeUrl` first. A null
   * here means "that is not the canonical form", never "no such video".
   */
  test('returns null for a YouTube URL that is not the exact canonical form', () => {
    expect(readYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
    expect(readYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBeNull();
    expect(readYouTubeVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(readYouTubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(readYouTubeVideoId('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(readYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42')).toBeNull();
  });

  test('returns null for a non-YouTube URL, a missing id and a malformed id', () => {
    expect(readYouTubeVideoId('https://www.leukerecepten.nl/recepten/traybake-kip/')).toBeNull();
    expect(readYouTubeVideoId('https://www.youtube.com/watch')).toBeNull();
    expect(readYouTubeVideoId('https://www.youtube.com/watch?v=')).toBeNull();
    expect(readYouTubeVideoId('https://www.youtube.com/watch?v=has%20space')).toBeNull();
  });

  test('never throws on input that is not a URL at all', () => {
    expect(() => readYouTubeVideoId('not a url')).not.toThrow();
    expect(readYouTubeVideoId('not a url')).toBeNull();
    expect(readYouTubeVideoId('')).toBeNull();
  });
});

describe('normalizeRecipeUrl — rejection cases (never throws, always rejects cleanly)', () => {
  test('rejects a bare platform host with no path', () => {
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

  /**
   * The `'web'` fallback deliberately does not widen this: it is reached
   * only after the scheme check, so an app deep link or a `javascript:`
   * URL is still refused rather than becoming an ordinary page.
   */
  test('rejects a non-http(s) scheme, which the web fallback does not rescue', () => {
    expect(normalizeRecipeUrl('tiktok://@chefremy/video/123')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('mailto:someone@example.com')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('javascript:alert(1)')).toEqual({ kind: 'unsupported_url' });
    expect(normalizeRecipeUrl('file:///etc/passwd')).toEqual({ kind: 'unsupported_url' });
  });
});

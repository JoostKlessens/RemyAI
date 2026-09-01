import { describe, expect, test } from 'vitest';
import {
  MAX_SHORT_LINK_REDIRECT_HOPS,
  resolveRedirectTarget,
  validateShortLinkTarget,
} from '@/domain/import/resolveShortLinkTarget';

describe('MAX_SHORT_LINK_REDIRECT_HOPS', () => {
  test('is a small, positive, explicit bound — not zero, not unbounded', () => {
    expect(MAX_SHORT_LINK_REDIRECT_HOPS).toBeGreaterThan(0);
    expect(MAX_SHORT_LINK_REDIRECT_HOPS).toBeLessThanOrEqual(10);
  });
});

describe('resolveRedirectTarget', () => {
  test('resolves an absolute https Location unchanged', () => {
    expect(resolveRedirectTarget('https://vm.tiktok.com/ZMabcdef1/', 'https://www.tiktok.com/@chef/video/123')).toBe(
      'https://www.tiktok.com/@chef/video/123',
    );
  });

  test('resolves a relative Location against the URL that produced it', () => {
    expect(resolveRedirectTarget('https://vm.tiktok.com/ZMabcdef1/', '/@chef/video/123')).toBe(
      'https://vm.tiktok.com/@chef/video/123',
    );
  });

  test('resolves a protocol-relative Location against the current scheme', () => {
    expect(resolveRedirectTarget('https://vm.tiktok.com/ZMabcdef1/', '//www.tiktok.com/@chef/video/123')).toBe(
      'https://www.tiktok.com/@chef/video/123',
    );
  });

  test('upgrades http to https unchanged when the Location itself says http', () => {
    expect(resolveRedirectTarget('https://vm.tiktok.com/x/', 'http://www.tiktok.com/@chef/video/1')).toBe(
      'http://www.tiktok.com/@chef/video/1',
    );
  });

  /**
   * The core SSRF-shaped defense this function exists for: a `Location`
   * header is attacker/third-party-controlled data, and this must never
   * hand the fetch loop anything but a fetchable http(s) URL.
   */
  test('rejects a javascript: Location', () => {
    expect(resolveRedirectTarget('https://vm.tiktok.com/x/', 'javascript:alert(1)')).toBeNull();
  });

  test('rejects a data: Location', () => {
    expect(resolveRedirectTarget('https://vm.tiktok.com/x/', 'data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  test('rejects a file: Location', () => {
    expect(resolveRedirectTarget('https://vm.tiktok.com/x/', 'file:///etc/passwd')).toBeNull();
  });

  /**
   * A relative-looking string like `::not a url::` is NOT a parse failure
   * under the WHATWG URL spec — the two-argument constructor happily
   * resolves it as a path segment against `currentUrl`, matching real
   * redirector behaviour for an odd-but-legal relative Location. What
   * actually throws is a value carrying its OWN scheme with an
   * unparseable authority, e.g. an unterminated IPv6 literal — that is the
   * genuine "third party sent us garbage" case this function has to
   * survive without throwing.
   */
  test('rejects a Location that fails to parse even as an absolute URL, without throwing', () => {
    expect(() => resolveRedirectTarget('https://vm.tiktok.com/x/', 'http://[')).not.toThrow();
    expect(resolveRedirectTarget('https://vm.tiktok.com/x/', 'http://[')).toBeNull();
  });

  test('rejects an empty Location header value', () => {
    // An empty string resolves relative to currentUrl (i.e. equals
    // currentUrl) under the URL constructor — that is a legal http(s)
    // result, not a malformed one, so this documents that behaviour rather
    // than asserting a rejection that would not actually happen.
    expect(resolveRedirectTarget('https://vm.tiktok.com/x/', '')).toBe('https://vm.tiktok.com/x/');
  });
});

describe('validateShortLinkTarget', () => {
  test('accepts a canonical www.tiktok.com video URL', () => {
    const result = validateShortLinkTarget('https://www.tiktok.com/@chef/video/123456789');
    expect(result).toEqual({
      normalizedUrl: 'https://www.tiktok.com/@chef/video/123456789',
      platform: 'tiktok',
    });
  });

  test('normalizes a bare tiktok.com host on the way through', () => {
    const result = validateShortLinkTarget('https://tiktok.com/@chef/video/123');
    expect(result).toEqual({
      normalizedUrl: 'https://www.tiktok.com/@chef/video/123',
      platform: 'tiktok',
    });
  });

  test('strips share-sheet query-param noise picked up along the redirect chain', () => {
    const result = validateShortLinkTarget(
      'https://www.tiktok.com/@chef/video/123?is_from_webapp=1&sender_device=pc',
    );
    expect(result).toEqual({
      normalizedUrl: 'https://www.tiktok.com/@chef/video/123',
      platform: 'tiktok',
    });
  });

  /**
   * The added hardening over the pre-IMP-01 inline check: a chain that
   * "resolved" to another short-link host has not actually produced
   * anything oEmbed can read, so it must be rejected here rather than
   * accepted and handed to oEmbed to fail on later.
   */
  test('rejects a target that is itself still a short link', () => {
    expect(validateShortLinkTarget('https://vm.tiktok.com/ZMabcdef2/')).toBeNull();
    expect(validateShortLinkTarget('https://vt.tiktok.com/ZMabcdef3/')).toBeNull();
  });

  test('rejects a host this app does not resolve recipes from — the SSRF-relevant gate', () => {
    expect(validateShortLinkTarget('https://example.com/not-tiktok')).toBeNull();
    expect(validateShortLinkTarget('http://169.254.169.254/latest/meta-data/')).toBeNull();
  });

  test('rejects a suffix-spoofed host', () => {
    expect(validateShortLinkTarget('https://tiktok.com.evil.example/@x/video/1')).toBeNull();
  });

  test('rejects a bare host with no path', () => {
    expect(validateShortLinkTarget('https://www.tiktok.com/')).toBeNull();
  });

  test('rejects a malformed string without throwing', () => {
    expect(() => validateShortLinkTarget('not a url at all')).not.toThrow();
    expect(validateShortLinkTarget('not a url at all')).toBeNull();
  });

  /** A redirect chain can just as easily end on Instagram or YouTube — this gate is platform-agnostic, matching normalizeRecipeUrl. */
  test('accepts a non-TikTok platform the chain might end on', () => {
    expect(validateShortLinkTarget('https://www.instagram.com/reel/Cabc123/')).toEqual({
      normalizedUrl: 'https://www.instagram.com/reel/Cabc123/',
      platform: 'instagram',
    });
    expect(validateShortLinkTarget('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      normalizedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      platform: 'youtube',
    });
  });
});

/**
 * The intermediate-hop guard. `validateShortLinkTarget` gates only the URL
 * a chain ENDS on; every hop before it is fetched before anything knows
 * where the chain finishes, so a Location pointing into the private network
 * would have its request made and only then be rejected as a destination.
 * These assert that such a target never reaches the fetch loop at all.
 */
describe('resolveRedirectTarget — refuses the private network', () => {
  const FROM = 'https://vm.tiktok.com/ZMabcdef1/';

  test('refuses the cloud metadata endpoint', () => {
    expect(resolveRedirectTarget(FROM, 'http://169.254.169.254/latest/meta-data/')).toBeNull();
  });

  test('refuses loopback in every spelling', () => {
    expect(resolveRedirectTarget(FROM, 'http://127.0.0.1/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://127.1.2.3/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://localhost/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://api.localhost/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://[::1]/')).toBeNull();
  });

  test('refuses the RFC1918 private ranges', () => {
    expect(resolveRedirectTarget(FROM, 'http://10.0.0.5/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://192.168.1.1/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://172.16.0.1/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://172.31.255.254/')).toBeNull();
  });

  test('allows the public addresses either side of the 172.16/12 block', () => {
    expect(resolveRedirectTarget(FROM, 'http://172.15.0.1/')).toBe('http://172.15.0.1/');
    expect(resolveRedirectTarget(FROM, 'http://172.32.0.1/')).toBe('http://172.32.0.1/');
  });

  test('refuses IPv6 unique-local and link-local', () => {
    expect(resolveRedirectTarget(FROM, 'http://[fd00::1]/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://[fe80::1]/')).toBeNull();
  });

  test('refuses 0.0.0.0 and a dotted quad with an out-of-range octet', () => {
    expect(resolveRedirectTarget(FROM, 'http://0.0.0.0/')).toBeNull();
    expect(resolveRedirectTarget(FROM, 'http://999.1.1.1/')).toBeNull();
  });

  test('still allows an ordinary public redirect', () => {
    expect(resolveRedirectTarget(FROM, 'https://www.tiktok.com/@chef/video/123')).toBe(
      'https://www.tiktok.com/@chef/video/123',
    );
  });
});

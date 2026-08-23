import { describe, expect, test } from 'vitest';
import { buildAttribution } from '@/domain/import/buildAttribution';
import type { OembedPayload } from '@/lib/oembed';

function makePayload(overrides: Partial<OembedPayload> = {}): OembedPayload {
  return {
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
    title: 'Traybake met kip en citroen',
    authorName: 'Chef Remy',
    authorUrl: 'https://www.tiktok.com/@chefremy',
    ...overrides,
  };
}

describe('buildAttribution — carries oEmbed data through, no second round trip', () => {
  test('carries authorName through from the oEmbed payload', () => {
    expect(buildAttribution(makePayload({ authorName: 'Chef Remy' })).authorName).toBe('Chef Remy');
  });

  test('carries thumbnailUrl through from the oEmbed payload', () => {
    const attribution = buildAttribution(makePayload({ thumbnailUrl: 'https://cdn.example/thumb.jpg' }));
    expect(attribution.thumbnailUrl).toBe('https://cdn.example/thumb.jpg');
  });

  test('authorName is null when oEmbed did not return one', () => {
    expect(buildAttribution(makePayload({ authorName: null })).authorName).toBeNull();
  });

  test('thumbnailUrl is null when oEmbed did not return one', () => {
    expect(buildAttribution(makePayload({ thumbnailUrl: null })).thumbnailUrl).toBeNull();
  });

  test('does not read the payload title into the attribution (title is caption text, not attribution)', () => {
    const attribution = buildAttribution(makePayload({ title: 'This is caption text, not a creator field' }));
    expect(attribution).not.toHaveProperty('title');
  });
});

describe('buildAttribution — authorUrl comes from oEmbed, and is never fabricated', () => {
  test('carries authorUrl through from the oEmbed payload', () => {
    const attribution = buildAttribution(makePayload({ authorUrl: 'https://www.instagram.com/kokenmetkees' }));
    expect(attribution.authorUrl).toBe('https://www.instagram.com/kokenmetkees');
  });

  test('authorUrl is null when oEmbed did not return one', () => {
    expect(buildAttribution(makePayload({ authorUrl: null })).authorUrl).toBeNull();
  });

  test('authorUrl is never synthesized from authorName when oEmbed omits it', () => {
    // A display name is not a URL-safe handle. Guessing produces a
    // plausible-looking link to the wrong account, which is worse than
    // showing a creator we can name but cannot link to.
    const attribution = buildAttribution(makePayload({ authorName: 'Koken met Kees', authorUrl: null }));
    expect(attribution.authorUrl).toBeNull();
  });
});

describe('buildAttribution — every field is explicitly null, never undefined', () => {
  test('returns all-null attribution for an entirely empty oEmbed payload', () => {
    const attribution = buildAttribution({ thumbnailUrl: null, title: null, authorName: null, authorUrl: null });
    expect(attribution).toEqual({ authorName: null, authorUrl: null, thumbnailUrl: null });
  });

  test('every key is present on the returned object (no key is ever omitted/undefined)', () => {
    const attribution = buildAttribution({ thumbnailUrl: null, title: null, authorName: null, authorUrl: null });
    expect(Object.keys(attribution).sort()).toEqual(['authorName', 'authorUrl', 'thumbnailUrl']);
  });
});

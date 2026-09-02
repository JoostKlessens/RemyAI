import { describe, expect, test } from 'vitest';
import { NO_CREATOR_TO_CREDIT, buildAttribution } from '@/domain/import/buildAttribution';
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

/**
 * SRC-08. The pasted-text route's attribution. Every assertion here is
 * about the SAME three nulls `buildAttribution` produces for an empty
 * oEmbed payload, and the point of the suite is that they are not the same
 * fact: one says "the source named no creator", this one says "there is no
 * creator". Only the name tells them apart, so the name is what is pinned.
 */
describe('NO_CREATOR_TO_CREDIT — a deliberate absence, not a failed lookup', () => {
  test('is an attribution with all three fields explicitly null', () => {
    // Arrange / Act
    const attribution = NO_CREATOR_TO_CREDIT;

    // Assert
    expect(attribution).toEqual({ authorName: null, authorUrl: null, thumbnailUrl: null });
  });

  test('states every key rather than omitting any, so no reader has to check undefined too', () => {
    expect(Object.keys(NO_CREATOR_TO_CREDIT).sort()).toEqual(['authorName', 'authorUrl', 'thumbnailUrl']);
  });

  /**
   * The constant is exported for the edge function to use at the one place
   * a text import is constructed. If it were ever built there by hand
   * instead, this equality would still hold and nothing would break — which
   * is exactly why the export exists: the NAME is the documentation, and a
   * hand-written literal carries none of it.
   */
  test('is exactly what buildAttribution would return for a payload with nothing in it', () => {
    const fromEmptyPayload = buildAttribution({ thumbnailUrl: null, title: null, authorName: null, authorUrl: null });
    expect(fromEmptyPayload).toEqual(NO_CREATOR_TO_CREDIT);
  });

  /**
   * The two are structurally identical and must remain two distinct
   * objects: a shared reference would invite one call site to be "cleaned
   * up" into the other, and the whole value of this constant is that
   * `NO_CREATOR_TO_CREDIT` and a route that merely failed to resolve a
   * creator are greppably different things.
   */
  test('is not the same object buildAttribution returns, so the two absences stay separately greppable', () => {
    const fromEmptyPayload = buildAttribution({ thumbnailUrl: null, title: null, authorName: null, authorUrl: null });
    expect(fromEmptyPayload).not.toBe(NO_CREATOR_TO_CREDIT);
  });

  test('is frozen in shape: it carries no author name under any spelling', () => {
    // A text import has no creator at all — not an anonymous one, not a
    // placeholder, not "Onbekend". Anything non-null here would be the
    // pipeline inventing a source for a recipe the user supplied.
    expect(NO_CREATOR_TO_CREDIT.authorName).toBeNull();
    expect(NO_CREATOR_TO_CREDIT.authorUrl).toBeNull();
    expect(NO_CREATOR_TO_CREDIT.thumbnailUrl).toBeNull();
  });
});

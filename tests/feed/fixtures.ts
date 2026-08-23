/**
 * Test data builders for the Feed domain's test suite (PD-007).
 *
 * Mirrors the shape and intent of tests/fixtures.ts: each `makeX` returns a
 * fully-populated, valid `X` with sensible defaults, overridable via a
 * partial. Nothing here is shared mutable state between calls.
 */

import type { Creator, FeedItem } from '@/domain/feed/types';

const DEFAULT_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export function makeCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: 'creator-1',
    handle: 'chefremy',
    displayName: 'Chef Remy',
    platform: 'tiktok',
    profileUrl: 'https://www.tiktok.com/@chefremy',
    // Opted in and not opted out by default -- most creator fixtures in
    // these tests represent the "servable" case; tests targeting the
    // consent gate itself override these explicitly.
    optedInAt: DEFAULT_TIMESTAMP,
    optedOutAt: null,
    ...overrides,
  };
}

export function makeFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'feed-item-1',
    creatorId: 'creator-1',
    sourceUrl: 'https://www.tiktok.com/@chefremy/video/123',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
    title: 'Traybake met kip en citroen',
    authorName: 'Chef Remy',
    oembedFetchedAt: DEFAULT_TIMESTAMP,
    mealId: null,
    publishedAt: '2026-08-01T12:00:00.000Z',
    removedAt: null,
    ...overrides,
  };
}

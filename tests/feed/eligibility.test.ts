import { describe, expect, test } from 'vitest';
import { filterServableFeedItems, isCreatorConsented, isFeedItemServable } from '@/domain/feed/eligibility';
import { makeCreator, makeFeedItem } from './fixtures';

describe('isCreatorConsented', () => {
  test('is true when opted in and never opted out', () => {
    const creator = makeCreator({ optedInAt: '2026-01-01T00:00:00.000Z', optedOutAt: null });

    expect(isCreatorConsented(creator)).toBe(true);
  });

  test('is false when never opted in', () => {
    const creator = makeCreator({ optedInAt: null, optedOutAt: null });

    expect(isCreatorConsented(creator)).toBe(false);
  });

  test('is false once opted out, even though optedInAt is still set', () => {
    const creator = makeCreator({
      optedInAt: '2026-01-01T00:00:00.000Z',
      optedOutAt: '2026-02-01T00:00:00.000Z',
    });

    expect(isCreatorConsented(creator)).toBe(false);
  });
});

describe('isFeedItemServable', () => {
  test('is true for a non-removed item from a consented creator', () => {
    const creator = makeCreator({ id: 'creator-1' });
    const item = makeFeedItem({ creatorId: 'creator-1', removedAt: null });

    expect(isFeedItemServable(item, creator)).toBe(true);
  });

  test('is false when the creator never opted in', () => {
    const creator = makeCreator({ id: 'creator-1', optedInAt: null });
    const item = makeFeedItem({ creatorId: 'creator-1', removedAt: null });

    expect(isFeedItemServable(item, creator)).toBe(false);
  });

  test('is false when the creator has opted out', () => {
    const creator = makeCreator({
      id: 'creator-1',
      optedInAt: '2026-01-01T00:00:00.000Z',
      optedOutAt: '2026-02-01T00:00:00.000Z',
    });
    const item = makeFeedItem({ creatorId: 'creator-1', removedAt: null });

    expect(isFeedItemServable(item, creator)).toBe(false);
  });

  test('is false when the item itself has been taken down, even for a consented creator', () => {
    const creator = makeCreator({ id: 'creator-1' });
    const item = makeFeedItem({ creatorId: 'creator-1', removedAt: '2026-03-01T00:00:00.000Z' });

    expect(isFeedItemServable(item, creator)).toBe(false);
  });

  test('fails closed when the supplied creator does not match the item.creatorId', () => {
    const creator = makeCreator({ id: 'creator-1' });
    const item = makeFeedItem({ creatorId: 'creator-2', removedAt: null });

    expect(isFeedItemServable(item, creator)).toBe(false);
  });
});

describe('filterServableFeedItems', () => {
  test('keeps only items whose creator is consented and item is not removed', () => {
    const consentedCreator = makeCreator({ id: 'creator-consented' });
    const optedOutCreator = makeCreator({
      id: 'creator-opted-out',
      optedInAt: '2026-01-01T00:00:00.000Z',
      optedOutAt: '2026-02-01T00:00:00.000Z',
    });
    const items = [
      makeFeedItem({ id: 'item-servable', creatorId: 'creator-consented', removedAt: null }),
      makeFeedItem({ id: 'item-opted-out-creator', creatorId: 'creator-opted-out', removedAt: null }),
      makeFeedItem({ id: 'item-removed', creatorId: 'creator-consented', removedAt: '2026-03-01T00:00:00.000Z' }),
    ];
    const creatorsById = new Map([
      [consentedCreator.id, consentedCreator],
      [optedOutCreator.id, optedOutCreator],
    ]);

    const result = filterServableFeedItems(items, creatorsById);

    expect(result.map((item) => item.id)).toEqual(['item-servable']);
  });

  test('fails closed for an item whose creator is entirely missing from the lookup', () => {
    const items = [makeFeedItem({ id: 'item-orphan', creatorId: 'creator-unknown' })];

    const result = filterServableFeedItems(items, new Map());

    expect(result).toEqual([]);
  });

  test('does not mutate the input array', () => {
    const creator = makeCreator({ id: 'creator-1', optedInAt: null });
    const items = [makeFeedItem({ id: 'item-1', creatorId: 'creator-1' })];
    const originalLength = items.length;

    filterServableFeedItems(items, new Map([[creator.id, creator]]));

    expect(items).toHaveLength(originalLength);
  });
});

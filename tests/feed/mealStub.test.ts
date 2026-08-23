import { describe, expect, test } from 'vitest';
import { buildUnparsedFeedItemMealStub, resolveMealForFeedItemSave } from '@/domain/feed/mealStub';
import { makeCreator, makeFeedItem } from './fixtures';

describe('resolveMealForFeedItemSave', () => {
  test('reuses the existing meal id when the feed item is already parsed', () => {
    const item = makeFeedItem({ mealId: 'meal-parsed-1' });
    const creator = makeCreator();

    const result = resolveMealForFeedItemSave(item, creator, 'household-1');

    expect(result).toEqual({ kind: 'existing_meal', mealId: 'meal-parsed-1' });
  });

  test('builds a new meal stub when the feed item has not been parsed', () => {
    const item = makeFeedItem({ mealId: null, title: 'Traybake met kip en citroen' });
    const creator = makeCreator();

    const result = resolveMealForFeedItemSave(item, creator, 'household-9');

    expect(result.kind).toBe('new_meal_stub');
    if (result.kind !== 'new_meal_stub') {
      throw new Error('expected new_meal_stub');
    }
    expect(result.stub.householdId).toBe('household-9');
    expect(result.stub.title).toBe('Traybake met kip en citroen');
    expect(result.stub.source).toBe('saved');
    expect(result.stub.ingredientTags).toEqual([]);
    expect(result.stub.allergenTagStatus).toBe('unknown');
    expect(result.stub.sourceUrl).toBe(item.sourceUrl);
  });
});

describe('buildUnparsedFeedItemMealStub', () => {
  test('never produces a verified allergenTagStatus, always unknown', () => {
    const withTitle = buildUnparsedFeedItemMealStub(
      makeFeedItem({ title: 'Traybake' }),
      makeCreator(),
      'household-1',
    );
    const withoutTitle = buildUnparsedFeedItemMealStub(
      makeFeedItem({ title: null }),
      makeCreator(),
      'household-1',
    );

    expect(withTitle.allergenTagStatus).toBe('unknown');
    expect(withoutTitle.allergenTagStatus).toBe('unknown');
  });

  test('always produces empty ingredientTags -- nothing is known about an unparsed video', () => {
    const stub = buildUnparsedFeedItemMealStub(makeFeedItem(), makeCreator(), 'household-1');

    expect(stub.ingredientTags).toEqual([]);
  });

  test('sets source to "saved"', () => {
    const stub = buildUnparsedFeedItemMealStub(makeFeedItem(), makeCreator(), 'household-1');

    expect(stub.source).toBe('saved');
  });

  test('uses the feed item title when present, trimmed', () => {
    const stub = buildUnparsedFeedItemMealStub(
      makeFeedItem({ title: '  Traybake met kip  ' }),
      makeCreator(),
      'household-1',
    );

    expect(stub.title).toBe('Traybake met kip');
  });

  test('falls back to a handle-based title when the feed item title is null', () => {
    const stub = buildUnparsedFeedItemMealStub(
      makeFeedItem({ title: null }),
      makeCreator({ handle: 'chefremy', platform: 'tiktok' }),
      'household-1',
    );

    expect(stub.title).toBe('@chefremy · TikTok');
  });

  test('falls back to a handle-based title when the feed item title is whitespace-only', () => {
    const stub = buildUnparsedFeedItemMealStub(
      makeFeedItem({ title: '   ' }),
      makeCreator({ handle: 'chefremy', platform: 'instagram' }),
      'household-1',
    );

    expect(stub.title).toBe('@chefremy · Instagram');
  });

  test('never returns an empty-string title, even when the creator handle is blank', () => {
    const stub = buildUnparsedFeedItemMealStub(
      makeFeedItem({ title: null }),
      makeCreator({ handle: '   ', platform: 'tiktok' }),
      'household-1',
    );

    expect(stub.title.length).toBeGreaterThan(0);
    expect(stub.title).toBe('TikTok');
  });

  test('maps a tiktok feed item to the tiktok meals.source_platform value', () => {
    const stub = buildUnparsedFeedItemMealStub(
      makeFeedItem({ sourcePlatform: 'tiktok' }),
      makeCreator({ platform: 'tiktok' }),
      'household-1',
    );

    expect(stub.sourcePlatform).toBe('tiktok');
  });

  test('maps an instagram feed item to the "reels" meals.source_platform value (0001_init.sql vocabulary)', () => {
    const stub = buildUnparsedFeedItemMealStub(
      makeFeedItem({ sourcePlatform: 'instagram' }),
      makeCreator({ platform: 'instagram' }),
      'household-1',
    );

    expect(stub.sourcePlatform).toBe('reels');
  });

  test('carries the feed item source url through verbatim', () => {
    const stub = buildUnparsedFeedItemMealStub(
      makeFeedItem({ sourceUrl: 'https://www.tiktok.com/@chefremy/video/999' }),
      makeCreator(),
      'household-1',
    );

    expect(stub.sourceUrl).toBe('https://www.tiktok.com/@chefremy/video/999');
  });

  test('sets householdId to the saving household, independent of any id on the creator or item', () => {
    const stub = buildUnparsedFeedItemMealStub(makeFeedItem(), makeCreator(), 'household-saving-household');

    expect(stub.householdId).toBe('household-saving-household');
  });
});

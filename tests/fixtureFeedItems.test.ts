import { describe, expect, test } from 'vitest';
import { fixtureFeedCreators, fixtureFeedItems } from '@/app/_fixtures';

/**
 * `fixtureFeedItems` (src/app/_fixtures.ts) is not hand-authored — it's
 * the result of running raw fixture rows through the real
 * src/domain/feed/eligibility.ts and src/domain/feed/ranking.ts pure
 * functions. This guards that wiring itself (not eligibility.ts/
 * ranking.ts's own logic, which is out of scope for this agent): a future
 * edit to the fixture data must not silently start serving an opted-out
 * creator's content again.
 */
describe('fixtureFeedItems', () => {
  test('excludes the item belonging to an opted-out creator', () => {
    const optedOutCreator = fixtureFeedCreators.find((creator) => creator.optedOutAt !== null);

    expect(optedOutCreator).toBeDefined();
    expect(fixtureFeedItems.some((item) => item.creatorId === optedOutCreator?.id)).toBe(false);
  });

  test('every surviving item belongs to a creator who is opted in and not opted out', () => {
    const creatorsById = new Map(fixtureFeedCreators.map((creator) => [creator.id, creator]));

    for (const item of fixtureFeedItems) {
      const creator = creatorsById.get(item.creatorId);
      expect(creator).toBeDefined();
      expect(creator?.optedInAt).not.toBeNull();
      expect(creator?.optedOutAt).toBeNull();
    }
  });

  test('is non-empty, so the Feed screen has something to render in the default fixture set', () => {
    expect(fixtureFeedItems.length).toBeGreaterThan(0);
  });
});

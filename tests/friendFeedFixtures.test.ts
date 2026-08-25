/**
 * Guards the two things about src/app/friends/_fixtures.ts that are not
 * "just data": the boundary parser that turns an untrusted route param
 * into a scenario, and the invariants the fixture set exists to
 * demonstrate. Mirrors tests/importFixtures.test.ts, which covers the
 * import flow's fixture module the same way.
 *
 * It deliberately does NOT assert on titles, handles or copy. Fixture
 * content is meant to be edited freely while the backend is being built,
 * and a test pinning the pesto recipe's name would make improving the
 * demo feel like breaking the build. What is asserted is the shape of the
 * demonstration: that the empty state is reachable, that the consent gate
 * has something to remove, and that exactly one card carries a PD-007a
 * collision and sits last.
 */

import { describe, expect, test } from 'vitest';
import {
  DEFAULT_FRIEND_FEED_SCENARIO,
  FIXTURE_TARGET_DATE,
  getFriendFeedFixture,
  parseFriendFeedScenario,
  type FriendFeedScenario,
} from '@/app/friends/_fixtures';
import { assembleFriendFeed, type FriendRecipeCardModel } from '@/components/friendFeedPresentation';

describe('parseFriendFeedScenario', () => {
  test('accepts each known scenario', () => {
    expect(parseFriendFeedScenario('gedeeld')).toBe('gedeeld');
    expect(parseFriendFeedScenario('zonder_allergie')).toBe('zonder_allergie');
    expect(parseFriendFeedScenario('leeg')).toBe('leeg');
  });

  test('falls back to the default for anything it does not recognise', () => {
    // A deep link, a hand-typed URL and a stale bookmark are all external
    // input: none of them may throw its way onto a red screen.
    expect(parseFriendFeedScenario('nonsense')).toBe(DEFAULT_FRIEND_FEED_SCENARIO);
    expect(parseFriendFeedScenario('')).toBe(DEFAULT_FRIEND_FEED_SCENARIO);
    expect(parseFriendFeedScenario(undefined)).toBe(DEFAULT_FRIEND_FEED_SCENARIO);
  });
});

describe('the fixture set demonstrates what it claims to', () => {
  function assembleScenario(scenario: FriendFeedScenario): readonly FriendRecipeCardModel[] {
    return assembleFriendFeed({ ...getFriendFeedFixture(scenario), targetDate: FIXTURE_TARGET_DATE });
  }

  test('"leeg" produces no cards, so the empty state is actually reachable on device', () => {
    expect(assembleScenario('leeg')).toEqual([]);
  });

  test('"gedeeld" drops the withdrawn creator and the unparsed share, and keeps the rest', () => {
    const cards = assembleScenario('gedeeld');

    // Five feed items go in; the opted-out creator's post and the share
    // with no linked recipe are both gone. See the fixture module header.
    expect(cards).toHaveLength(3);
    expect(cards.every((card) => card.creator.optedOutAt === null)).toBe(true);
  });

  test('"gedeeld" surfaces exactly one PD-007a collision, ranked last but present', () => {
    const cards = assembleScenario('gedeeld');
    const labelled = cards.filter((card) => card.collidingTags.length > 0);

    expect(labelled).toHaveLength(1);
    expect(cards[cards.length - 1]?.feedItemId).toBe(labelled[0]?.feedItemId);
  });

  test('"zonder_allergie" shows the same recipes with no collision label at all', () => {
    const withAllergy = assembleScenario('gedeeld');
    const withoutAllergy = assembleScenario('zonder_allergie');

    expect([...withoutAllergy].map((card) => card.mealId).sort()).toEqual(
      [...withAllergy].map((card) => card.mealId).sort(),
    );
    expect(withoutAllergy.every((card) => card.collidingTags.length === 0)).toBe(true);
  });

  test('every servable card carries the creator attribution PD-010 ships under', () => {
    for (const card of assembleScenario('gedeeld')) {
      expect(card.creator.handle.length).toBeGreaterThan(0);
      expect(card.creator.profileUrl.startsWith('https://')).toBe(true);
      expect(card.sourceUrl.startsWith('https://')).toBe(true);
    }
  });
});

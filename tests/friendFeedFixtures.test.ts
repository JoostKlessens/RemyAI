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
  FRIEND_FEED_SCENARIOS,
  getFriendFeedFixture,
  getKringFixture,
  parseFriendFeedScenario,
  type FriendFeedScenario,
} from '@/app/friends/_fixtures';
import { assembleFriendFeed, type FriendRecipeCardModel } from '@/components/friendFeedPresentation';
import { assembleKring, type KringRowModel } from '@/components/kringPresentation';

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

/**
 * De kring's half of the same fixture set. The Vrienden tab has two modes
 * (docs/DESIGN-SOCIAL.md §4.2) and the `__DEV__` scenario row switches the
 * source for both at once, so a scenario that demonstrates something in
 * `Gekookt` has to demonstrate the matching thing in `Kring` — otherwise
 * flipping to the other mode silently shows an empty screen and design
 * work on the kring is impossible.
 *
 * Same discipline as the block above: no assertions on titles, handles or
 * copy, only on the shape of the demonstration.
 */
describe('the kring fixture demonstrates what it claims to', () => {
  function assembleKringScenario(scenario: FriendFeedScenario): readonly KringRowModel[] {
    return assembleKring(getKringFixture(scenario));
  }

  test('"leeg" produces no rows, so the kring empty state is reachable on device', () => {
    expect(assembleKringScenario('leeg')).toEqual([]);
  });

  test('"gedeeld" produces a ranked list of more than one row', () => {
    const rows = assembleKringScenario('gedeeld');

    expect(rows.length).toBeGreaterThan(1);
    expect(rows.map((row) => row.rank)).toEqual([...rows].map((_, index) => index + 1));
  });

  test('"gedeeld" names its voters rather than counting them', () => {
    // DESIGN-SOCIAL.md §2.2: "8,5 · Sanne en Joris". The name is the whole
    // evidentiary point, so a demo that only ever printed "2 stemmen"
    // would be demonstrating the fallback instead of the rule.
    const named = assembleKringScenario('gedeeld').filter((row) => /[A-Z]/u.test(row.metaLine));

    expect(named.length).toBeGreaterThan(0);
  });

  test('"gedeeld" keeps a single-voter row, because the kring floor is one vote', () => {
    // KRING_MIN_VOTES is 1, deliberately below the board's floor, and a
    // fixture where every row had two votes could not show that. §4.2's
    // own sketch puts "8,0 · Joris" on its second row for exactly this
    // reason: one name and no count is what one vote looks like.
    const singleVoter = assembleKringScenario('gedeeld').filter(
      (row) => !row.metaLine.includes(' en ') && !row.metaLine.includes('stemmen'),
    );

    expect(singleVoter.length).toBeGreaterThan(0);
  });

  test('"gedeeld" surfaces exactly one PD-007a collision, ranked wherever its grade put it', () => {
    const labelled = assembleKringScenario('gedeeld').filter((row) => row.collisionLabel !== null);

    expect(labelled).toHaveLength(1);
  });

  test('"zonder_allergie" ranks the same recipes with no collision label at all', () => {
    const withAllergy = assembleKringScenario('gedeeld');
    const withoutAllergy = assembleKringScenario('zonder_allergie');

    expect(withoutAllergy.map((row) => row.recipeId)).toEqual(withAllergy.map((row) => row.recipeId));
    expect(withoutAllergy.every((row) => row.collisionLabel === null)).toBe(true);
  });

  test('every kring row carries the creator attribution PD-007 requires', () => {
    for (const row of assembleKringScenario('gedeeld')) {
      expect(row.creatorLine.length).toBeGreaterThan(0);
    }
  });

  test('the kring ranks the same dishes the Gekookt feed shows, so one demo describes one circle', () => {
    const feedTitles = new Set(assembleFriendFeed({ ...getFriendFeedFixture('gedeeld'), targetDate: FIXTURE_TARGET_DATE }).map((card) => card.title));

    for (const row of assembleKringScenario('gedeeld')) {
      expect(feedTitles.has(row.title)).toBe(true);
    }
  });
});

describe('FRIEND_FEED_SCENARIOS', () => {
  test('lists exactly the scenarios the route param parser accepts', () => {
    // The dev row iterates this array and the parser guards the route
    // param; a scenario in one and not the other is a demo option that
    // deep-links to the default, silently.
    for (const scenario of FRIEND_FEED_SCENARIOS) {
      expect(parseFriendFeedScenario(scenario)).toBe(scenario);
    }
    expect(new Set(FRIEND_FEED_SCENARIOS).size).toBe(FRIEND_FEED_SCENARIOS.length);
  });
});

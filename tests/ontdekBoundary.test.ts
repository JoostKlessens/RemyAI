/**
 * PD-024's hard boundary: nothing from the feed may touch explore's
 * ordering, and explore may never backfill the feed.
 *
 * THIS FILE EXISTS BECAUSE THE DECISION ASKED FOR IT BY NAME: "that is §8's
 * 'no padding the kring', inverted, and it earns a test — one that nails
 * down that no row produced by `rankRecipes` can land on the feed side."
 *
 * ⚠ WHY IT IS NOT ENOUGH TO LEAN ON `isProofCard`, which is the reason
 * `isFeedCard` had to be written at all. That guard is `'recipeId' in card`
 * (gekooktPresentation.ts), and a `BoardRowModel` HAS a `recipeId` — a
 * board row IS a canonical recipe, and so is a proof card. So a board row
 * spliced into the feed would narrow as proof, render with
 * `FriendProofCard`, and put a stranger's anonymous average exactly where a
 * friend's name belongs, looking entirely ordinary while doing it. The test
 * below asserts that mis-narrowing directly rather than only asserting that
 * correct data works: a happy-path test would not notice the day somebody
 * makes this mistake.
 *
 * WHY THE MISTAKE IS NOW PLAUSIBLE, stated so this file is not read as
 * paranoia. Until fase 2 the two lists lived on two tabs and could not
 * meet. They are two pages of one screen now, holding two state objects in
 * one component, and "the feed is thin today, drop in a few global rows" is
 * a three-line change — which is precisely how Instagram's following feed
 * stopped being a following feed.
 *
 * No React Native import anywhere, so this runs under vitest's `node`
 * environment against the real modules rather than a mirror of them.
 */

import { describe, expect, test } from 'vitest';
import {
  assertFeedCards,
  isFeedCard,
  isProofCard,
  selectExploreBody,
  selectFeedBody,
} from '@/components/ontdekPresentation';
import type { BoardRowModel } from '@/components/leaderboardPresentation';
import type { GekooktCard } from '@/components/gekooktPresentation';
import type { FriendProofCardModel } from '@/components/friendProofPresentation';
import type { FriendRecipeCardModel } from '@/components/friendFeedPresentation';

// ---------------------------------------------------------------------------
// Three rows, shaped exactly as their producers shape them
// ---------------------------------------------------------------------------

function makeProofCard(recipeId: string): FriendProofCardModel {
  return {
    recipeId,
    title: `Proof ${recipeId}`,
    thumbnailUrl: null,
    estimatedMinutes: 25,
    grade: 8.5,
    cookNames: ['Sanne'],
    creatorHandle: 'kokenmetkees',
    creatorPlatform: 'tiktok',
    keyIngredients: null,
    collidingTags: [],
    closedLoop: false,
  };
}

function makeSendCard(mealId: string): FriendRecipeCardModel {
  return {
    feedItemId: `share-${mealId}`,
    mealId,
    title: `Dish ${mealId}`,
    thumbnailUrl: null,
    estimatedMinutes: 20,
    servings: 2,
    rating: 8,
    friendName: 'Joris',
    canonicalRecipeId: null,
    attribution: null,
    sourceUrl: null,
    keyIngredients: null,
    collidingTags: [],
    note: null,
  };
}

/** A row as `assembleLeaderboard` produces it — the thing that must never cross. */
function makeBoardRow(recipeId: string): BoardRowModel {
  return {
    recipeId,
    rank: 1,
    title: `Board ${recipeId}`,
    metaLine: '8,72 · 204 stemmen',
    creatorLine: '@kokenmetkees · TikTok',
    thumbnailUrl: null,
    collisionLabel: null,
    dishTags: [],
    estimatedMinutes: 30,
  };
}

// ---------------------------------------------------------------------------
// The boundary itself
// ---------------------------------------------------------------------------

describe('isFeedCard', () => {
  test('accepts a proof card, which carries the name of whoever cooked it', () => {
    expect(isFeedCard(makeProofCard('r-1'))).toBe(true);
  });

  test('accepts a send card, which carries the share that delivered it', () => {
    expect(isFeedCard(makeSendCard('m-1'))).toBe(true);
  });

  test('refuses a board row, which carries neither a cook nor a recipient', () => {
    expect(isFeedCard(makeBoardRow('r-1'))).toBe(false);
  });

  /**
   * THE ASSERTION THIS FILE EXISTS FOR. `isProofCard` says yes to a board
   * row and `isFeedCard` says no, and the gap between those two answers is
   * the entire reason the second function was written. If this ever goes
   * green on both, the guard has been "simplified" back into the bug.
   */
  test('disagrees with isProofCard about a board row, and that disagreement is the point', () => {
    const boardRow = makeBoardRow('r-1');

    expect(isProofCard(boardRow as unknown as GekooktCard)).toBe(true);
    expect(isFeedCard(boardRow)).toBe(false);
  });

  /**
   * A board row and a proof card can name the SAME canonical recipe — a dish
   * a friend cooked may well also be on the global board. So the test above
   * is not about a strange id; it is about two rows that are equally
   * legitimate on their own surfaces and mean different things.
   */
  test('still refuses a board row whose recipe id matches a proof card on the feed', () => {
    expect(isFeedCard(makeProofCard('shared-recipe'))).toBe(true);
    expect(isFeedCard(makeBoardRow('shared-recipe'))).toBe(false);
  });
});

describe('assertFeedCards', () => {
  test('passes a list of real feed cards through unchanged, by identity', () => {
    const cards: readonly GekooktCard[] = [makeSendCard('m-1'), makeProofCard('r-1')];

    expect(assertFeedCards(cards)).toBe(cards);
  });

  test('passes an empty feed, which is the ordinary state on a fresh install', () => {
    expect(assertFeedCards([])).toEqual([]);
  });

  /**
   * The padding scenario, written out: a thin feed of one card, topped up
   * with a couple of rows off the board to make it look fuller. That is
   * DESIGN-SOCIAL.md §8's refusal inverted, and it throws at the seam rather
   * than rendering.
   */
  test('throws when the feed has been padded from the board', () => {
    const padded = [makeProofCard('r-1'), makeBoardRow('r-2'), makeBoardRow('r-3')] as unknown as GekooktCard[];

    expect(() => assertFeedCards(padded)).toThrow(/non-feed row reached the feed/);
  });

  test('throws on a single board row, so one is as loud as many', () => {
    expect(() => assertFeedCards([makeBoardRow('r-1')] as unknown as GekooktCard[])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// The two surfaces choose their bodies independently
// ---------------------------------------------------------------------------

describe('selectFeedBody and selectExploreBody', () => {
  /**
   * A THIN FEED BESIDE A FULL BOARD IS A CORRECT STATE AND NOT A BUG, and it
   * is the state the padding temptation grows out of. The feed says "nothing
   * shared yet" while explore shows twenty-five cards, and both are true at
   * the same time.
   */
  test('an empty feed and a full board are both right at once', () => {
    expect(selectFeedBody('ready', 0)).toBe('empty');
    expect(selectExploreBody('ready', 25, 25)).toBe('list');
  });

  /** And the inverse, which is `net-te-weinig`: votes exist but none clears the global floor. */
  test('a full feed and an empty board are both right at once', () => {
    expect(selectFeedBody('ready', 3)).toBe('list');
    expect(selectExploreBody('ready', 0, 0)).toBe('empty');
  });

  test('cards already on screen survive a failed refresh on both surfaces', () => {
    expect(selectFeedBody('error', 3)).toBe('list');
    expect(selectExploreBody('error', 25, 25)).toBe('list');
  });

  test('an error with nothing on screen says so on both surfaces', () => {
    expect(selectFeedBody('error', 0)).toBe('error');
    expect(selectExploreBody('error', 0, 0)).toBe('error');
  });

  test('loading only takes over an empty surface', () => {
    expect(selectFeedBody('loading', 0)).toBe('loading');
    expect(selectFeedBody('loading', 2)).toBe('list');
    expect(selectExploreBody('loading', 0, 0)).toBe('loading');
    expect(selectExploreBody('loading', 25, 25)).toBe('list');
  });

  /**
   * THE FIFTH BODY, AND IT IS EXPLORE'S ALONE. "Nothing has been rated
   * enough yet" and "nothing here matches what you asked for" are different
   * facts, and showing the first when the second is true tells a household
   * the app is empty when it is their own two taps that are.
   */
  test('a board emptied by the reader is a different state from an empty board', () => {
    expect(selectExploreBody('ready', 25, 0)).toBe('filtered-out');
    expect(selectExploreBody('ready', 0, 0)).toBe('empty');
  });

  /**
   * The feed has no filter and therefore cannot reach that state — there is
   * no argument to `selectFeedBody` that produces it, which is the type
   * system holding the asymmetry rather than a comment.
   */
  test('the feed never reports filtered-out, at any card count or status', () => {
    for (const status of ['loading', 'ready', 'error'] as const) {
      for (const count of [0, 1, 25]) {
        expect(selectFeedBody(status, count)).not.toBe('filtered-out');
      }
    }
  });
});

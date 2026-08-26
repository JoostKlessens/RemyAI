/**
 * Cook proof assembly (docs/DESIGN-SOCIAL.md §1, §2.1).
 *
 * The assertion that matters most here is the one about whose votes make
 * the number: the copy reads "Sanne en Joris ... gaven het gemiddeld een
 * 8,4", and a grade averaged over a wider pool than the names beside it
 * would be a lie inside a sentence that reads as precise. Both halves
 * look correct on their own, which is exactly why it needs a test.
 */

import { describe, expect, test } from 'vitest';
import { assembleFriendProof, type FriendCookFact } from '@/domain/social/proof';
import { RATING_MAX } from '@/domain/rating';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeRecipeRating } from './fixtures';

const NAMES = new Map([
  [PROFILE_A, 'Sanne'],
  [PROFILE_B, 'Joris'],
  [PROFILE_C, 'Åsa'],
]);

const cooked = (profileId: string, recipeId: string): FriendCookFact => ({ profileId, recipeId });

const voted = (profileId: string, recipeId: string, rating: number) =>
  makeRecipeRating({ id: `${recipeId}-${profileId}`, recipeId, raterProfileId: profileId, rating });

describe('grouping', () => {
  test('nothing in, nothing out — the common case before anybody opts in', () => {
    expect(assembleFriendProof([], NAMES, []).size).toBe(0);
  });

  test('collects every friend who cooked the same recipe into one entry', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'recipe-1'), cooked(PROFILE_B, 'recipe-1')], NAMES, []);
    expect(proof.get('recipe-1')?.friendNames).toEqual(['Joris', 'Sanne']);
  });

  test('keeps recipes apart', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'recipe-1'), cooked(PROFILE_B, 'recipe-2')], NAMES, []);
    expect(proof.get('recipe-1')?.friendNames).toEqual(['Sanne']);
    expect(proof.get('recipe-2')?.friendNames).toEqual(['Joris']);
  });

  /** The view can repeat a pair; a person who cooked something twice is still one name. */
  test('the same friend twice is one name', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'recipe-1'), cooked(PROFILE_A, 'recipe-1')], NAMES, []);
    expect(proof.get('recipe-1')?.friendNames).toEqual(['Sanne']);
  });

  /**
   * The view returns rows in no guaranteed order, and a reason line that
   * reads "Sanne en Joris" on one render and "Joris en Sanne" on the next
   * looks like the app changed its mind about something.
   */
  test('names are ordered the same way regardless of the row order', () => {
    const forwards = assembleFriendProof([cooked(PROFILE_A, 'r'), cooked(PROFILE_B, 'r')], NAMES, []);
    const backwards = assembleFriendProof([cooked(PROFILE_B, 'r'), cooked(PROFILE_A, 'r')], NAMES, []);
    expect(backwards.get('r')?.friendNames).toEqual(forwards.get('r')?.friendNames);
  });

  test('sorts with Dutch collation, so an accented name lands where a reader expects', () => {
    const proof = assembleFriendProof([cooked(PROFILE_C, 'r'), cooked(PROFILE_B, 'r')], NAMES, []);
    expect(proof.get('r')?.friendNames).toEqual(['Åsa', 'Joris'].sort((a, b) => a.localeCompare(b, 'nl')));
  });
});

describe('the unnameable', () => {
  /**
   * §2.1 bans a count without a name, because an anonymous count is a
   * stranger-aggregate in a friendly tone. "Iemand heeft dit gemaakt" is
   * that same aggregate with one fewer person in it.
   */
  test('a recipe whose only cook has no known name produces no entry', () => {
    const proof = assembleFriendProof([cooked('profile-onbekend', 'recipe-1')], NAMES, []);
    expect(proof.has('recipe-1')).toBe(false);
  });

  test('a nameless friend is dropped but the named ones survive', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'r'), cooked('profile-onbekend', 'r')], NAMES, []);
    expect(proof.get('r')?.friendNames).toEqual(['Sanne']);
  });

  test('a blank name counts as no name', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'r')], new Map([[PROFILE_A, '   ']]), []);
    expect(proof.has('r')).toBe(false);
  });
});

describe('the grade', () => {
  test('is null when the friends who cooked it never voted publicly', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'recipe-1')], NAMES, []);
    expect(proof.get('recipe-1')?.grade).toBeNull();
  });

  test('is the vote when one friend cooked and rated it', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'recipe-1')], NAMES, [voted(PROFILE_A, 'recipe-1', 8.5)]);
    expect(proof.get('recipe-1')?.grade).toBe(8.5);
  });

  test('averages the friends who cooked it', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'r'), cooked(PROFILE_B, 'r')], NAMES, [
      voted(PROFILE_A, 'r', 8),
      voted(PROFILE_B, 'r', 9),
    ]);
    expect(proof.get('r')?.grade).toBe(8.5);
  });

  /**
   * THE ASSERTION THIS FILE EXISTS FOR. Joris voted but did not cook, so
   * he is not named — and his opinion must not become the number beside
   * Sanne's name. "Sanne heeft dit ook gemaakt en gaf het een 10,0" has
   * to mean Sanne's 10,0.
   */
  test('ignores votes from friends who did not cook it', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'r')], NAMES, [
      voted(PROFILE_A, 'r', RATING_MAX),
      voted(PROFILE_B, 'r', 1),
    ]);
    expect(proof.get('r')?.friendNames).toEqual(['Sanne']);
    expect(proof.get('r')?.grade).toBe(RATING_MAX);
  });

  test('ignores votes on a different recipe', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'recipe-1')], NAMES, [voted(PROFILE_A, 'recipe-2', 3)]);
    expect(proof.get('recipe-1')?.grade).toBeNull();
  });

  /** One decimal, matching a vote — the board's two are for averages of hundreds. */
  test('is rounded to one decimal', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'r'), cooked(PROFILE_B, 'r'), cooked(PROFILE_C, 'r')], NAMES, [
      voted(PROFILE_A, 'r', 8),
      voted(PROFILE_B, 'r', 9),
      voted(PROFILE_C, 'r', 8.1),
    ]);
    expect(proof.get('r')?.grade).toBe(8.4);
  });

  /** Dedup and validity belong to ratings.ts; this asserts proof inherits them on the filtered subset. */
  test('an off-scale vote is dropped rather than repaired', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'r')], NAMES, [voted(PROFILE_A, 'r', RATING_MAX + 4)]);
    expect(proof.get('r')?.grade).toBeNull();
  });

  test('a friend who voted twice counts once, latest winning', () => {
    const proof = assembleFriendProof([cooked(PROFILE_A, 'r')], NAMES, [
      makeRecipeRating({ id: 'first', recipeId: 'r', raterProfileId: PROFILE_A, rating: 4 }),
      makeRecipeRating({
        id: 'second',
        recipeId: 'r',
        raterProfileId: PROFILE_A,
        rating: 9,
        ratedAt: '2099-01-01T00:00:00.000Z',
      }),
    ]);
    expect(proof.get('r')?.grade).toBe(9);
  });
});

/**
 * De kring's presentation layer (docs/DESIGN-SOCIAL.md §2.2, §4.2).
 *
 * Several assertions here are the deliberate inverse of one in
 * tests/leaderboardPresentation.test.ts: the board prints two decimals
 * and a bare vote count, the kring prints one decimal and names people.
 * If the two ever agree, one has drifted into the other.
 */

import { describe, expect, test } from 'vitest';
import {
  KRING_EMPTY_BODY,
  KRING_EMPTY_TITLE,
  KRING_END_COPY,
  KRING_VOTER_NAME_LIMIT,
  assembleKring,
  buildKringMetaLine,
  buildKringRowAccessibilityLabel,
  type KringRecipe,
} from '@/components/kringPresentation';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeRecipeRating } from './social/fixtures';

const NAMES = new Map([
  [PROFILE_A, 'Sanne'],
  [PROFILE_B, 'Joris'],
  [PROFILE_C, 'Åsa'],
]);

function makeKringRecipe(overrides: Partial<KringRecipe> = {}): KringRecipe {
  return {
    recipeId: 'recipe-1',
    title: 'Ramen met gepocheerd ei',
    creatorHandle: 'noedelnoah',
    creatorPlatform: 'tiktok',
    thumbnailUrl: null,
    allergenTags: [],
    ...overrides,
  };
}

const voted = (profileId: string, recipeId: string, rating: number) =>
  makeRecipeRating({ id: `${recipeId}-${profileId}`, recipeId, raterProfileId: profileId, rating });

describe('buildKringMetaLine', () => {
  /** The board would print "8,50 · 1 stem" here. Naming the person is the entire point of this list. */
  test('names a single voter rather than counting them', () => {
    expect(buildKringMetaLine(8.5, [PROFILE_A], NAMES)).toBe('8,5  ·  Sanne');
  });

  test('names two voters in Dutch', () => {
    expect(buildKringMetaLine(8.5, [PROFILE_A, PROFILE_B], NAMES)).toBe('8,5  ·  Joris en Sanne');
  });

  /** Past the limit a row trying to fit every name would push the dish off its own line. */
  test('falls back to a count beyond the name limit', () => {
    const many = [PROFILE_A, PROFILE_B, PROFILE_C];
    expect(many.length).toBeGreaterThan(KRING_VOTER_NAME_LIMIT);
    expect(buildKringMetaLine(8.2, many, NAMES)).toBe('8,2  ·  3 stemmen');
  });

  /**
   * A missing name must not shrink the sample the number claims. Unlike
   * the Kiezen reason — where the name IS the message, so a nameless
   * voter contributes nothing — here the grade is the message and every
   * vote behind it is real.
   */
  test('falls back to the full count when a name is missing', () => {
    expect(buildKringMetaLine(8.5, [PROFILE_A, 'profile-onbekend'], NAMES)).toBe('8,5  ·  2 stemmen');
  });

  test('writes one decimal with a Dutch comma, never the board two', () => {
    const line = buildKringMetaLine(9, [PROFILE_A], NAMES);
    expect(line).toContain('9,0');
    expect(line).not.toContain('9,00');
    expect(line).not.toContain('9.0');
  });

  test('a single anonymous vote is singular', () => {
    expect(buildKringMetaLine(7, ['profile-onbekend'], NAMES)).toBe('7,0  ·  1 stem');
  });

  /** Row order is not guaranteed upstream; a line that reshuffles looks like a bug. */
  test('name order does not depend on the order the voters arrived in', () => {
    const forwards = buildKringMetaLine(8, [PROFILE_A, PROFILE_B], NAMES);
    const backwards = buildKringMetaLine(8, [PROFILE_B, PROFILE_A], NAMES);
    expect(backwards).toBe(forwards);
  });
});

describe('assembleKring', () => {
  test('an empty circle is an empty list, never a row of zeroes', () => {
    expect(assembleKring({ votes: [], recipes: [], voterNames: NAMES, excludedAllergenTags: [] })).toEqual([]);
  });

  /** Floor of one: with four friends nothing would ever clear the board's floor of three. */
  test('a single vote is enough to produce a row', () => {
    const rows = assembleKring({
      votes: [voted(PROFILE_A, 'recipe-1', 8.5)],
      recipes: [makeKringRecipe()],
      voterNames: NAMES,
      excludedAllergenTags: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metaLine).toBe('8,5  ·  Sanne');
  });

  test('orders by grade and numbers the rows', () => {
    const rows = assembleKring({
      votes: [voted(PROFILE_A, 'recipe-1', 7), voted(PROFILE_B, 'recipe-2', 9)],
      recipes: [makeKringRecipe(), makeKringRecipe({ recipeId: 'recipe-2', title: 'Zalm' })],
      voterNames: NAMES,
      excludedAllergenTags: [],
    });
    expect(rows.map((row) => row.recipeId)).toEqual(['recipe-2', 'recipe-1']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2]);
  });

  test('a voted recipe with no display data is dropped, not rendered blank', () => {
    const rows = assembleKring({
      votes: [voted(PROFILE_A, 'recipe-1', 8), voted(PROFILE_B, 'recipe-onbekend', 9)],
      recipes: [makeKringRecipe()],
      voterNames: NAMES,
      excludedAllergenTags: [],
    });
    expect(rows.map((row) => row.recipeId)).toEqual(['recipe-1']);
  });

  /** No shrinkage here, unlike the board: with named voters the honest number is what they said. */
  test('a perfect vote is reported as perfect', () => {
    const rows = assembleKring({
      votes: [voted(PROFILE_A, 'recipe-1', 10)],
      recipes: [makeKringRecipe()],
      voterNames: NAMES,
      excludedAllergenTags: [],
    });
    expect(rows[0]?.metaLine).toContain('10,0');
  });

  test('carries the creator, because these are extractions of somebody else post', () => {
    const rows = assembleKring({
      votes: [voted(PROFILE_A, 'recipe-1', 8)],
      recipes: [makeKringRecipe()],
      voterNames: NAMES,
      excludedAllergenTags: [],
    });
    expect(rows[0]?.creatorLine).toBe('@noedelnoah · TikTok');
  });

  test('falls back to the platform when the creator has no handle', () => {
    const rows = assembleKring({
      votes: [voted(PROFILE_A, 'recipe-1', 8)],
      recipes: [makeKringRecipe({ creatorHandle: '' })],
      voterNames: NAMES,
      excludedAllergenTags: [],
    });
    expect(rows[0]?.creatorLine).toBe('TikTok');
  });

  describe('PD-007a', () => {
    const request = {
      votes: [voted(PROFILE_A, 'recipe-1', 8)],
      recipes: [makeKringRecipe({ allergenTags: ['noten'] })],
      voterNames: NAMES,
    };

    test('labels a colliding recipe', () => {
      const rows = assembleKring({ ...request, excludedAllergenTags: ['noten'] });
      expect(rows[0]?.collisionLabel).toBe('bevat noten');
    });

    test('never hides a colliding recipe', () => {
      const rows = assembleKring({ ...request, excludedAllergenTags: ['noten'] });
      expect(rows).toHaveLength(1);
    });

    /** Null is not "checked and clean" — an untagged recipe produces the same null (PD-006 tri-state). */
    test('says nothing when there is nothing to say', () => {
      const rows = assembleKring({ ...request, excludedAllergenTags: [] });
      expect(rows[0]?.collisionLabel).toBeNull();
    });
  });
});

describe('buildKringRowAccessibilityLabel', () => {
  const row = () =>
    assembleKring({
      votes: [voted(PROFILE_A, 'recipe-1', 8.5)],
      recipes: [makeKringRecipe({ allergenTags: ['noten'] })],
      voterNames: NAMES,
      excludedAllergenTags: ['noten'],
    })[0];

  test('leads with the position, since on a ranked list that is the information', () => {
    expect(buildKringRowAccessibilityLabel(row()!).startsWith('1.')).toBe(true);
  });

  test('carries the chip, so a screen reader is never told less than a sighted reader', () => {
    expect(buildKringRowAccessibilityLabel(row()!)).toContain('bevat noten');
  });
});

describe('the copy', () => {
  /** The list ends and says so — the structural form of PD-004 that §8 and §9 already use. */
  test('says the circle has ended, without implying more is coming', () => {
    expect(KRING_END_COPY).toBe('Dat is de hele kring.');
  });

  test('the empty state states a fact and promises nothing', () => {
    expect(KRING_EMPTY_TITLE).toBe('Nog geen cijfers uit je kring');
    expect(KRING_EMPTY_BODY).toBe('Geeft een vriend een recept een cijfer, dan staat het hier.');
  });
});

/**
 * The proof card's presentation layer — PD-015's ambient tier, rendered
 * (docs/DESIGN.md §8, docs/DESIGN-SOCIAL.md §2.4 and §4.2).
 *
 * WHY THIS IS ITS OWN FILE RATHER THAN MORE CASES IN
 * tests/friendFeedPresentation.test.ts. That file's fixtures build the
 * SEND side: a `FriendShare` with a sender's name, a `FeedItem` with a
 * meal id behind it. Proof has neither, and a shared fixture set is how
 * one of those fields quietly ends up on the wrong card — the exact
 * mistake the two separate models exist to make impossible. Two files
 * cost one import; a shared `makeCard` costs the guarantee.
 *
 * Several assertions here are deliberate inverses of ones in that file:
 * the send card says "Gedeeld door Sanne" and writes "8,5/10", the proof
 * card says "Sanne maakte dit" and writes "8,5". If the two ever agree,
 * one has drifted into the other and PD-016's rule — a send may never
 * borrow the language of proof — has stopped being enforced by anything.
 */

import { describe, expect, test } from 'vitest';
import {
  CLOSED_LOOP_CHIP_COPY,
  FRIEND_PROOF_CARD_NAME_LIMIT,
  assembleFriendProofCards,
  buildCreatorLine,
  buildFriendProofCardAccessibilityLabel,
  buildFriendProofEyebrow,
  buildFriendProofMetaLine,
  type FriendProofCardModel,
  type FriendProofFeedRequest,
  type ProofRecipe,
} from '@/components/friendFeedPresentation';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeRecipeRating } from './social/fixtures';

const NAMES = new Map([
  [PROFILE_A, 'Sanne'],
  [PROFILE_B, 'Joris'],
  [PROFILE_C, 'Åsa'],
]);

function makeProofRecipe(overrides: Partial<ProofRecipe> = {}): ProofRecipe {
  return {
    recipeId: 'recipe-1',
    title: 'Traybake kip & citroen',
    creatorHandle: 'kokenmetkees',
    creatorPlatform: 'tiktok',
    thumbnailUrl: null,
    estimatedMinutes: 25,
    ingredients: [
      { name: 'kipfilet', sortOrder: 0 },
      { name: 'citroen', sortOrder: 1 },
    ],
    ...overrides,
  };
}

function makeRequest(overrides: Partial<FriendProofFeedRequest> = {}): FriendProofFeedRequest {
  return {
    cooks: [{ profileId: PROFILE_A, recipeId: 'recipe-1' }],
    closedLoopCooks: [],
    displayNamesByProfile: NAMES,
    friendRatings: [],
    recipes: [makeProofRecipe()],
    collidingTagsByRecipeId: new Map(),
    ...overrides,
  };
}

const voted = (profileId: string, recipeId: string, rating: number) =>
  makeRecipeRating({ id: `${recipeId}-${profileId}`, recipeId, raterProfileId: profileId, rating });

/**
 * The single card a one-recipe request produces.
 *
 * Not `cards[0]` with an optional chain: `noUncheckedIndexedAccess` is on,
 * and a test that quietly read `undefined` off an empty list would sail
 * through every `toBe(...)` below while asserting nothing at all. Failing
 * here, loudly, is the point.
 */
function onlyCard(request: FriendProofFeedRequest): FriendProofCardModel {
  const cards = assembleFriendProofCards(request);
  expect(cards).toHaveLength(1);
  const [card] = cards;
  if (card === undefined) {
    throw new Error('assembleFriendProofCards produced no card');
  }
  return card;
}

describe('buildFriendProofEyebrow', () => {
  test('names one cook, singular verb', () => {
    expect(buildFriendProofEyebrow(['Sanne'], false)).toBe('Sanne maakte dit');
  });

  test('names two cooks in Dutch, plural verb', () => {
    expect(buildFriendProofEyebrow(['Sanne', 'Joris'], false)).toBe('Sanne en Joris maakten dit');
  });

  /**
   * Past the limit the overflow still carries a name beside it —
   * DESIGN-SOCIAL.md §2.1 bans the anonymous count ("3 vrienden maakten
   * dit"), because the persuasive thing is the name.
   */
  test('keeps a name beside the overflow past the limit', () => {
    expect(FRIEND_PROOF_CARD_NAME_LIMIT).toBe(2);
    expect(buildFriendProofEyebrow(['Sanne', 'Joris', 'Åsa'], false)).toBe(
      'Sanne, Joris en nog iemand maakten dit',
    );
    expect(buildFriendProofEyebrow(['Sanne', 'Joris', 'Åsa', 'Kees'], false)).toBe(
      'Sanne, Joris en 2 anderen maakten dit',
    );
  });

  test('the closed loop says whose recipe it was', () => {
    expect(buildFriendProofEyebrow(['Sanne'], true)).toBe('Sanne maakte jouw recept');
    expect(buildFriendProofEyebrow(['Sanne', 'Joris'], true)).toBe('Sanne en Joris maakten jouw recept');
  });

  test('drops blank names rather than rendering an empty subject', () => {
    expect(buildFriendProofEyebrow(['Sanne', '   '], false)).toBe('Sanne maakte dit');
  });

  /** Defensive only: `assembleFriendProofCards` never emits a card with no nameable cook. */
  test('falls back to the circle rather than inventing a name', () => {
    expect(buildFriendProofEyebrow([], false)).toBe('Iemand die je kent maakte dit');
  });

  /** PD-016: a send says a person thought of you; proof says a kitchen made this. Never the same words. */
  test('never borrows the send card language', () => {
    for (const closedLoop of [false, true]) {
      expect(buildFriendProofEyebrow(['Sanne'], closedLoop).toLowerCase()).not.toContain('gedeeld');
    }
  });
});

describe('buildFriendProofMetaLine', () => {
  test('writes the cook time and the circle grade', () => {
    expect(buildFriendProofMetaLine(25, 8.5)).toBe('25 min  ·  8,5');
  });

  /**
   * The bare grade is the deliberate inverse of the send card's "8,5/10"
   * (`buildFriendRecipeMetaLine`): this number is a public `recipe_ratings`
   * vote on the canonical recipe, printed the way the two other surfaces
   * that print public votes print it.
   */
  test('does not spell the scale the way the send card does', () => {
    expect(buildFriendProofMetaLine(25, 8.5)).not.toContain('/');
  });

  test('drops the half it does not know', () => {
    expect(buildFriendProofMetaLine(null, 8)).toBe('8,0');
    expect(buildFriendProofMetaLine(25, null)).toBe('25 min');
  });

  test('renders nothing at all when neither fact is known', () => {
    expect(buildFriendProofMetaLine(null, null)).toBeNull();
  });

  /** An off-scale grade is dropped, never clamped — stored data can be older than the scale. */
  test('drops an off-scale grade rather than repairing it', () => {
    expect(buildFriendProofMetaLine(25, 11)).toBe('25 min');
  });
});

describe('buildCreatorLine', () => {
  test('credits the creator and names the platform', () => {
    expect(buildCreatorLine('kokenmetkees', 'tiktok')).toBe('@kokenmetkees · TikTok');
    expect(buildCreatorLine('lekkerNL', 'instagram')).toBe('@lekkerNL · Instagram');
  });

  test('does not double the at-sign a stored handle already carries', () => {
    expect(buildCreatorLine('@kokenmetkees', 'tiktok')).toBe('@kokenmetkees · TikTok');
  });

  /** Attribution that renders as punctuation credits nobody — oEmbed does not always return an author. */
  test('falls back to the platform alone when there is no handle', () => {
    expect(buildCreatorLine('   ', 'tiktok')).toBe('TikTok');
  });
});

describe('assembleFriendProofCards', () => {
  test('carries no meal id, so there is no private row for a tap to reach', () => {
    const card = onlyCard(makeRequest());
    expect(card.recipeId).toBe('recipe-1');
    expect('mealId' in card).toBe(false);
  });

  test('one recipe two friends cooked is one card naming both', () => {
    const card = onlyCard(
      makeRequest({
        cooks: [
          { profileId: PROFILE_B, recipeId: 'recipe-1' },
          { profileId: PROFILE_A, recipeId: 'recipe-1' },
        ],
      }),
    );
    expect(buildFriendProofEyebrow(card.cookNames, card.closedLoop)).toBe('Joris en Sanne maakten dit');
  });

  /** Ordering is the caller's, from `rankFeedItems`. This module never reorders and never sorts by recency. */
  test('preserves the order it was handed', () => {
    const cards = assembleFriendProofCards(
      makeRequest({
        cooks: [
          { profileId: PROFILE_A, recipeId: 'recipe-2' },
          { profileId: PROFILE_A, recipeId: 'recipe-1' },
        ],
        recipes: [makeProofRecipe({ recipeId: 'recipe-2', title: 'Ramen' }), makeProofRecipe()],
      }),
    );
    expect(cards.map((card) => card.recipeId)).toEqual(['recipe-2', 'recipe-1']);
  });

  test('drops a recipe nobody in the circle cooked', () => {
    expect(assembleFriendProofCards(makeRequest({ cooks: [] }))).toHaveLength(0);
  });

  /** A card whose every cook is unnameable would be the anonymous aggregate PD-015 rejected. */
  test('drops a recipe whose only cook has no known name', () => {
    const cards = assembleFriendProofCards(
      makeRequest({ cooks: [{ profileId: 'profile-onbekend', recipeId: 'recipe-1' }] }),
    );
    expect(cards).toHaveLength(0);
  });

  test('the grade is the public vote of the friends being named', () => {
    const card = onlyCard(
      makeRequest({
        cooks: [{ profileId: PROFILE_A, recipeId: 'recipe-1' }],
        // Joris rated it but never cooked it: he is not named, so his vote is not the number.
        friendRatings: [voted(PROFILE_A, 'recipe-1', 8.5), voted(PROFILE_B, 'recipe-1', 5)],
      }),
    );
    expect(card.grade).toBe(8.5);
  });

  test('summarises the key ingredients and carries the collision verbatim', () => {
    const card = onlyCard(
      makeRequest({ collidingTagsByRecipeId: new Map([['recipe-1', ['noten']]]) }),
    );
    expect(card.keyIngredients?.text).toBe('kipfilet · citroen');
    expect(card.collidingTags).toEqual(['noten']);
  });

  test('no collision recorded means the card says nothing, not that it is safe', () => {
    const card = onlyCard(makeRequest());
    expect(card.collidingTags).toEqual([]);
  });
});

describe('assembleFriendProofCards — PD-020.2, the closed loop', () => {
  test('dresses the card and names it as the sender sees it', () => {
    const card = onlyCard(
      makeRequest({ closedLoopCooks: [{ profileId: PROFILE_A, recipeId: 'recipe-1' }] }),
    );
    expect(card.closedLoop).toBe(true);
    expect(buildFriendProofEyebrow(card.cookNames, card.closedLoop)).toBe('Sanne maakte jouw recept');
  });

  /**
   * The whole point of the dress: it must be false by default, because
   * `positive` is the one colour this screen otherwise never uses.
   */
  test('an ordinary proof card is never dressed', () => {
    const card = onlyCard(makeRequest());
    expect(card.closedLoop).toBe(false);
  });

  /**
   * Sanne got your send and cooked it; Joris found the dish himself. The
   * dressed eyebrow names only the friend the send reached — crediting
   * your send with a cook it did not cause would be a card that lies.
   */
  test('names only the friends the send actually reached', () => {
    const card = onlyCard(
      makeRequest({
        cooks: [
          { profileId: PROFILE_A, recipeId: 'recipe-1' },
          { profileId: PROFILE_B, recipeId: 'recipe-1' },
        ],
        closedLoopCooks: [{ profileId: PROFILE_A, recipeId: 'recipe-1' }],
        friendRatings: [voted(PROFILE_A, 'recipe-1', 9), voted(PROFILE_B, 'recipe-1', 6)],
      }),
    );
    expect(card.cookNames).toEqual(['Sanne']);
    // And the grade follows the names, exactly as `assembleFriendProof` requires.
    expect(card.grade).toBe(9);
  });

  test('the chip says one word and never a count', () => {
    expect(CLOSED_LOOP_CHIP_COPY).toBe('gemaakt');
  });
});

describe('buildFriendProofCardAccessibilityLabel', () => {
  test('speaks every fact the layout shows', () => {
    const card = onlyCard(
      makeRequest({
        friendRatings: [voted(PROFILE_A, 'recipe-1', 8.5)],
        collidingTagsByRecipeId: new Map([['recipe-1', ['noten']]]),
      }),
    );
    expect(buildFriendProofCardAccessibilityLabel(card)).toBe(
      'Traybake kip & citroen, Sanne maakte dit, van kokenmetkees op TikTok, met kipfilet en citroen, 25 minuten, beoordeeld met 8,5 van 10, bevat noten',
    );
  });

  /** The spoken form never reads the visual "+2", which VoiceOver pronounces with no noun attached. */
  test('speaks the hidden ingredients as words', () => {
    const card = onlyCard(
      makeRequest({
        recipes: [
          makeProofRecipe({
            ingredients: [
              { name: 'kipfilet', sortOrder: 0 },
              { name: 'paprika', sortOrder: 1 },
              { name: 'citroen', sortOrder: 2 },
              { name: 'tijm', sortOrder: 3 },
            ],
          }),
        ],
      }),
    );
    expect(card.keyIngredients?.text).toBe('kipfilet · paprika · citroen · +1');
    expect(buildFriendProofCardAccessibilityLabel(card)).toContain(
      'met kipfilet, paprika, citroen en 1 ander ingrediënt',
    );
  });

  test('a card with no handle credits the platform rather than an empty name', () => {
    const card = onlyCard(
      makeRequest({ recipes: [makeProofRecipe({ creatorHandle: '', estimatedMinutes: null })] }),
    );
    expect(buildFriendProofCardAccessibilityLabel(card)).toBe(
      'Traybake kip & citroen, Sanne maakte dit, op TikTok, met kipfilet en citroen',
    );
  });
});

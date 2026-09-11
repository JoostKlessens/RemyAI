/**
 * The live SEND card: `buildSentMealCardModels` and the joins behind it
 * (`friendFeedPresentation.ts`, fed by `toSentMealSource` in
 * `src/lib/gekooktSource.ts`).
 *
 * WHY THIS FILE EXISTS, and it is an uncomfortable reason worth writing
 * down. `friendFeedPresentation.ts`'s header promised
 * `buildSentMealCardModels` "at the foot of this file" for weeks while no
 * such function existed — `grep` found the name in that one sentence and
 * nowhere else. Two file headers agreed about a function nobody had
 * written, which is how the gap survived the very type change that had
 * unblocked it. The function is real now, and this file is what keeps the
 * next such claim honest.
 *
 * ⚠ THE ASSERTION THAT MATTERS MOST IS THE GRADE. A send card can show a
 * number beside a person's name, and there is exactly one number it may
 * show: THAT SENDER'S OWN public vote on THAT recipe. Never an average,
 * never `cook_events.rating` (the decision engine's private input, which
 * never crosses a household boundary), and never another friend's vote on
 * the same dish. Two of the tests below exist only to pin that: two
 * friends sending the same recipe, and one friend sending two recipes.
 *
 * No React Native import anywhere, so this runs under vitest's `node`
 * environment against the real module.
 */

import { describe, expect, test } from 'vitest';
import { buildSentMealCardModels, type SentMealFeedSource } from '@/components/friendFeedPresentation';
import { isProofCard } from '@/components/gekooktPresentation';
import type { RecipeAttribution } from '@/components/recipeAttribution';
import type { ProfileId, RecipeId } from '@/domain/social/types';
import type { RecipeShareId, SentMeal } from '@/lib/repository/social/types';

const SANNE: ProfileId = 'p-sanne';
const JORIS: ProfileId = 'p-joris';
const SHAKSHUKA: RecipeId = 'r-shakshuka';
const RAMEN: RecipeId = 'r-ramen';

const ATTRIBUTION: RecipeAttribution = {
  handle: 'kokenmetkees',
  displayName: 'kokenmetkees',
  platform: 'tiktok',
  profileUrl: null,
};

function makeSentMeal(overrides: Partial<SentMeal> & { readonly shareId: RecipeShareId }): SentMeal {
  return {
    mealId: `m-${overrides.shareId}`,
    senderProfileId: SANNE,
    title: 'Shakshuka',
    thumbnailUrl: null,
    estimatedMinutes: 25,
    servings: 2,
    ingredientTags: [],
    sourceUrl: null,
    recipeId: SHAKSHUKA,
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

/** Everything present and nothing withheld — the ordinary case. */
function makeSource(overrides: Partial<SentMealFeedSource> = {}): SentMealFeedSource {
  return {
    meals: [],
    notesByShareId: new Map(),
    senderNamesByProfileId: new Map([
      [SANNE, 'Sanne'],
      [JORIS, 'Joris'],
    ]),
    gradesByShareId: new Map(),
    attributionsByRecipeId: new Map(),
    excludedTags: new Set(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The card itself
// ---------------------------------------------------------------------------

describe('buildSentMealCardModels', () => {
  test('carries the share id as the card identity, never the meal id', () => {
    const [card] = buildSentMealCardModels(makeSource({ meals: [makeSentMeal({ shareId: 's-1' })] }));

    expect(card?.feedItemId).toBe('s-1');
    expect(card?.mealId).toBe('m-s-1');
  });

  /**
   * The guard that keeps the two card kinds apart narrows on `'recipeId' in
   * card`, and a send card's canonical key is deliberately NOT called that
   * — `canonicalRecipeId` is an attribute of the meal, not the card's
   * identity. tests/gekooktPresentation.test.ts caught exactly this on
   * 9 September 2026; this is the same rule seen from the producer side, so
   * a future field rename cannot quietly turn every send card into a proof
   * card.
   */
  test('never narrows as a proof card, whatever canonical recipe it names', () => {
    const cards = buildSentMealCardModels(makeSource({ meals: [makeSentMeal({ shareId: 's-1' })] }));
    const card = cards[0];

    expect(card).toBeDefined();
    expect(isProofCard(cards[0]!)).toBe(false);
    expect(card?.canonicalRecipeId).toBe(SHAKSHUKA);
    expect('recipeId' in cards[0]!).toBe(false);
  });

  test('preserves input order and does not rank', () => {
    const source = makeSource({
      meals: [
        makeSentMeal({ shareId: 's-1', title: 'Zuurkool' }),
        makeSentMeal({ shareId: 's-2', title: 'Appeltaart' }),
      ],
    });

    expect(buildSentMealCardModels(source).map((card) => card.title)).toEqual(['Zuurkool', 'Appeltaart']);
  });

  /**
   * The one fail-closed drop, and it is the proof side's rule applied here:
   * `assembleFriendProof` "drops an unnameable cook rather than rendering
   * 'iemand maakte dit'". A send card's whole eyebrow is GEDEELD DOOR
   * JORIS; without a name it would say that somebody, unspecified, handed
   * you their kitchen's copy of a dish.
   */
  test('drops a send whose sender cannot be named', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1', senderProfileId: 'p-unknown' })],
      senderNamesByProfileId: new Map(),
    });

    expect(buildSentMealCardModels(source)).toEqual([]);
  });

  test('drops a sender whose name is blank rather than rendering an empty eyebrow', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1' })],
      senderNamesByProfileId: new Map([[SANNE, '   ']]),
    });

    expect(buildSentMealCardModels(source)).toEqual([]);
  });

  test('keeps a card whose note, grade and attribution are all missing', () => {
    const [card] = buildSentMealCardModels(makeSource({ meals: [makeSentMeal({ shareId: 's-1' })] }));

    expect(card?.note).toBeNull();
    expect(card?.rating).toBeNull();
    expect(card?.attribution).toBeNull();
    expect(card?.friendName).toBe('Sanne');
  });
});

// ---------------------------------------------------------------------------
// The grade, which is the join most worth pinning
// ---------------------------------------------------------------------------

describe('the grade on a send card', () => {
  test('is the sender own vote on this recipe', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1' })],
      gradesByShareId: new Map([['s-1', 8.5]]),
    });

    expect(buildSentMealCardModels(source)[0]?.rating).toBe(8.5);
  });

  /**
   * ⚠ TWO FRIENDS, ONE RECIPE. Each card must carry its own sender's
   * number. Keyed on the SHARE rather than on the recipe, precisely so
   * these cannot collide.
   */
  test('does not leak between two friends who sent the same recipe', () => {
    const source = makeSource({
      meals: [
        makeSentMeal({ shareId: 's-sanne', senderProfileId: SANNE }),
        makeSentMeal({ shareId: 's-joris', senderProfileId: JORIS }),
      ],
      gradesByShareId: new Map([
        ['s-sanne', 9],
        ['s-joris', 6.5],
      ]),
    });

    const cards = buildSentMealCardModels(source);

    expect(cards.map((card) => [card.friendName, card.rating])).toEqual([
      ['Sanne', 9],
      ['Joris', 6.5],
    ]);
  });

  /** ⚠ ONE FRIEND, TWO RECIPES. Same person, two numbers, and they must not swap. */
  test('does not leak between two recipes from the same friend', () => {
    const source = makeSource({
      meals: [
        makeSentMeal({ shareId: 's-a', recipeId: SHAKSHUKA, title: 'Shakshuka' }),
        makeSentMeal({ shareId: 's-b', recipeId: RAMEN, title: 'Ramen' }),
      ],
      gradesByShareId: new Map([
        ['s-a', 7],
        ['s-b', 9.5],
      ]),
    });

    expect(buildSentMealCardModels(source).map((card) => [card.title, card.rating])).toEqual([
      ['Shakshuka', 7],
      ['Ramen', 9.5],
    ]);
  });

  /**
   * A friend who never voted shows no number at all. Null is a real,
   * renderable state — the meta row simply drops the grade — and it is the
   * common case, because `PendingRatingSheet` asks twelve hours later and
   * may be skipped.
   */
  test('is null when the sender never voted, rather than a zero or an average', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1' })],
      gradesByShareId: new Map([['s-other', 9]]),
    });

    expect(buildSentMealCardModels(source)[0]?.rating).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PD-007a's label, and whose household decides it
// ---------------------------------------------------------------------------

describe('the collision label on a send card', () => {
  /**
   * PD-006's asymmetry in one test: a tag that travels may only ever ADD a
   * "bevat noten" label, never remove one, and whose allergy it is is
   * decided on the READING side.
   */
  test('is the reading household exclusions against the sender tags', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1', ingredientTags: ['noten', 'ei'] })],
      excludedTags: new Set(['noten']),
    });

    expect(buildSentMealCardModels(source)[0]?.collidingTags).toEqual(['noten']);
  });

  test('is empty when the reading household excludes nothing', () => {
    const source = makeSource({ meals: [makeSentMeal({ shareId: 's-1', ingredientTags: ['noten'] })] });

    expect(buildSentMealCardModels(source)[0]?.collidingTags).toEqual([]);
  });

  /** Tags come back AS STORED, because the stored form is what the card prints. */
  test('reports the tag in the sender own spelling, not the normalized key', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1', ingredientTags: ['Noten'] })],
      excludedTags: new Set(['noten']),
    });

    expect(buildSentMealCardModels(source)[0]?.collidingTags).toEqual(['Noten']);
  });

  test('never hides a colliding dish — it labels it and keeps it', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1', ingredientTags: ['noten'] })],
      excludedTags: new Set(['noten']),
    });

    expect(buildSentMealCardModels(source)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Attribution — PD-010.1, off the canonical row and never invented
// ---------------------------------------------------------------------------

describe('attribution on a send card', () => {
  test('comes off the canonical recipe the meal names', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1' })],
      attributionsByRecipeId: new Map([[SHAKSHUKA, ATTRIBUTION]]),
    });

    expect(buildSentMealCardModels(source)[0]?.attribution).toEqual(ATTRIBUTION);
  });

  test('is null for a hand-entered dish, which credits nobody', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1', recipeId: null })],
      attributionsByRecipeId: new Map([[SHAKSHUKA, ATTRIBUTION]]),
    });

    expect(buildSentMealCardModels(source)[0]?.attribution).toBeNull();
  });

  test('is null when the canonical row named no author', () => {
    const source = makeSource({ meals: [makeSentMeal({ shareId: 's-1' })] });

    expect(buildSentMealCardModels(source)[0]?.attribution).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The note, verbatim
// ---------------------------------------------------------------------------

describe('the sender note', () => {
  test('is carried verbatim, undecorated', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1' })],
      notesByShareId: new Map([['s-1', 'dit moet je maken']]),
    });

    expect(buildSentMealCardModels(source)[0]?.note).toBe('dit moet je maken');
  });

  test('belongs to its own share and no other', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1' }), makeSentMeal({ shareId: 's-2' })],
      notesByShareId: new Map([['s-2', 'alleen bij deze']]),
    });

    expect(buildSentMealCardModels(source).map((card) => card.note)).toEqual([null, 'alleen bij deze']);
  });

  /**
   * Absent and null mean the same thing — the sender wrote nothing — and
   * `normalizeSendNote` at the repository boundary is the one place that
   * decides it, so there is no second trim here.
   */
  test('treats an explicit null the same as an absent entry', () => {
    const source = makeSource({
      meals: [makeSentMeal({ shareId: 's-1' })],
      notesByShareId: new Map([['s-1', null]]),
    });

    expect(buildSentMealCardModels(source)[0]?.note).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// No timestamp reaches the model, at all
// ---------------------------------------------------------------------------

describe('what a send card refuses to carry', () => {
  /**
   * PD-004 measures this surface on save-to-cook and never on dwell time,
   * and a freshness stamp is the cheapest way to smuggle "check back often"
   * into it. `RecipeShare.sentAt` exists on the row and must not reach the
   * card — this test fails the day somebody spreads a whole `SentMeal` into
   * the model.
   */
  test('carries no timestamp field of any kind', () => {
    const cards = buildSentMealCardModels(makeSource({ meals: [makeSentMeal({ shareId: 's-1' })] }));

    expect(cards).toHaveLength(1);
    for (const key of Object.keys(cards[0]!)) {
      expect(key.toLowerCase()).not.toContain('sent');
      expect(key.toLowerCase()).not.toContain('date');
      expect(key.toLowerCase()).not.toContain('seen');
    }
  });
});

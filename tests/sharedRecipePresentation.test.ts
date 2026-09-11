/**
 * GAP-32 (1) and (2) — the two shared recipe screens' article, as a view
 * model rather than as JSX.
 *
 * WHY THESE ASSERTIONS AND NOT OTHERS. Both screens are route modules and
 * neither can be imported here (expo-router and react-native internals
 * fail to parse under Vite), so everything below is exactly the part that
 * WAS unassertable while it lived inside `friends/[feedItemId].tsx`: which
 * sentence appears, which one is absent, and — the two that actually
 * matter — that a canonical recipe never claims a sender and never claims
 * an allergen check.
 *
 * The three claims worth breaking a build over:
 *
 *   1. A canonical article carries NO eyebrow and NO note (§4.3: "the same
 *      anatomy minus note and minus sender eyebrow"). A proof card is
 *      ambient; a sender's voice over it would be PD-016's exact refusal.
 *   2. A canonical article carries NO collision label and says so in its
 *      own caveat line, because `recipes` holds no allergen tags at all
 *      (PD-006). Printing the send screen's "tags come from whoever shared
 *      this" over it would credit a check nobody performed.
 *   3. Attribution is null rather than a platform-only row when the source
 *      named nobody — that row has an avatar disc, and a "T" for TikTok in
 *      it dresses a missing credit up as a person.
 */

import { describe, expect, test } from 'vitest';

import {
  SHARED_RECIPE_CANONICAL_TAG_CAVEAT,
  SHARED_RECIPE_SENT_TAG_CAVEAT,
  buildCanonicalAttribution,
  buildCanonicalSharedRecipe,
  buildLiveSentSharedRecipe,
  buildSentSharedRecipe,
  buildSharedRecipeEyebrow,
  describeSharedRecipeNotice,
  formatStepLine,
} from '@/components/sharedRecipePresentation';
import { buildCreatorCreditLine } from '@/components/friendCardVocabulary';
import { buildCreatorAttribution } from '@/components/recipeAttribution';
import { buildCreatorCreditAccessibilityLabel } from '@/components/creatorPresentation';
import type { FriendRecipeCardModel } from '@/components/friendFeedPresentation';
import type { CanonicalRecipe, SentMeal } from '@/lib/repository/social/types';
import type { MealIngredient, MealStep } from '@/domain/types';
import { makeCreator } from './feed/fixtures';

function makeCanonicalRecipe(overrides: Partial<CanonicalRecipe> = {}): CanonicalRecipe {
  return {
    recipeId: 'recipe-1',
    title: 'Traybake kip & citroen',
    platform: 'tiktok',
    authorName: 'kokenmetkees',
    authorUrl: 'https://www.tiktok.com/@kokenmetkees',
    thumbnailUrl: null,
    dishTags: [],
    estimatedMinutes: 25,
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
    servings: 4,
    ingredients: [
      { name: 'kipdijfilet', quantity: '600', unit: 'g', sortOrder: 0, section: null },
      { name: 'citroen', quantity: '1', unit: null, sortOrder: 1, section: null },
    ],
    steps: [
      { stepNumber: 1, instruction: 'Verwarm de oven voor op 200 graden.' },
      { stepNumber: 2, instruction: 'Meng alles en bak 35 minuten.' },
    ],
    ...overrides,
  };
}

function makeSendCard(overrides: Partial<FriendRecipeCardModel> = {}): FriendRecipeCardModel {
  return {
    feedItemId: 'feed-item-1',
    mealId: 'meal-1',
    title: 'Romige pasta pesto',
    thumbnailUrl: null,
    estimatedMinutes: 20,
    servings: 2,
    rating: 8.5,
    friendName: 'Sanne',
    note: 'echt 20 min, beloofd',
    canonicalRecipeId: 'recipe-9',
    attribution: buildCreatorAttribution(makeCreator()),
    sourceUrl: 'https://www.tiktok.com/@chefremy/video/123',
    keyIngredients: null,
    collidingTags: [],
    ...overrides,
  };
}

function makeMealIngredient(name: string, sortOrder: number): MealIngredient {
  return {
    id: `ing-${sortOrder}`,
    mealId: 'meal-1',
    name,
    quantity: null,
    unit: null,
    allergenTags: [],
    sortOrder,
  };
}

function makeMealStep(stepNumber: number, instruction: string): MealStep {
  return { id: `step-${stepNumber}`, mealId: 'meal-1', stepNumber, instruction, durationMinutes: null };
}

function makeSentMeal(overrides: Partial<SentMeal> = {}): SentMeal {
  return {
    shareId: 'share-1',
    mealId: 'meal-1',
    senderProfileId: 'profile-sanne',
    title: 'Romige pasta pesto',
    thumbnailUrl: null,
    estimatedMinutes: 20,
    servings: 2,
    ingredientTags: [],
    sourceUrl: 'https://www.tiktok.com/@chefremy/video/123',
    recipeId: 'recipe-9',
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

describe('buildSharedRecipeEyebrow', () => {
  test('names the friend who sent it', () => {
    expect(buildSharedRecipeEyebrow('Sanne')).toBe('Gedeeld door Sanne');
  });
});

describe('formatStepLine', () => {
  test('numbers a step the way both screens print it', () => {
    expect(formatStepLine(2, 'Meng alles.')).toBe('2. Meng alles.');
  });
});

describe('buildSentSharedRecipe', () => {
  test('names the sender in the eyebrow and carries their note undecorated', () => {
    const view = buildSentSharedRecipe(makeSendCard(), [], []);

    expect(view.eyebrow).toBe('Gedeeld door Sanne');
    // Undecorated: the quotation marks belong to the renderer, on both
    // surfaces, so neither screen unpicks a string the other decorated.
    expect(view.note).toBe('echt 20 min, beloofd');
  });

  test('renders the friend grade in the meta line beside the cook time', () => {
    expect(buildSentSharedRecipe(makeSendCard(), [], []).metaLine).toBe('20 min  ·  8,5/10');
  });

  test('sorts ingredients and steps into recipe order regardless of input order', () => {
    const view = buildSentSharedRecipe(
      makeSendCard(),
      [makeMealIngredient('citroen', 1), makeMealIngredient('kip', 0)],
      [makeMealStep(2, 'Bakken.'), makeMealStep(1, 'Snijden.')],
    );

    expect(view.ingredientLines.map((line) => line.text)).toEqual(['kip', 'citroen']);
    expect(view.stepLines.map((line) => line.text)).toEqual(['1. Snijden.', '2. Bakken.']);
  });

  test('keys every line on the row it came from rather than on its index', () => {
    const view = buildSentSharedRecipe(makeSendCard(), [makeMealIngredient('kip', 0)], [makeMealStep(1, 'Snijden.')]);

    expect(view.ingredientLines[0]?.key).toBe('ing-0');
    expect(view.stepLines[0]?.key).toBe('step-1');
  });

  test('shows the PD-007a label when the card collides', () => {
    const view = buildSentSharedRecipe(makeSendCard({ collidingTags: ['noten'] }), [], []);

    expect(view.collisionLabel).toBe('bevat noten');
  });

  test('carries the sender caveat, which names whose tags these are', () => {
    expect(buildSentSharedRecipe(makeSendCard(), [], []).tagCaveat).toBe(SHARED_RECIPE_SENT_TAG_CAVEAT);
  });

  test('carries the canonical recipe id the save is keyed on, and null for a hand-entered dish', () => {
    expect(buildSentSharedRecipe(makeSendCard(), [], []).canonicalRecipeId).toBe('recipe-9');
    expect(buildSentSharedRecipe(makeSendCard({ canonicalRecipeId: null }), [], []).canonicalRecipeId).toBeNull();
  });
});

describe('buildLiveSentSharedRecipe', () => {
  test('names the sender in the eyebrow from the resolved profile name, not from SentMeal itself', () => {
    expect(buildLiveSentSharedRecipe(makeSentMeal(), 'Sanne').eyebrow).toBe('Gedeeld door Sanne');
  });

  test('leaves note, attribution and the original-post label null — SentMeal carries none of the three', () => {
    const view = buildLiveSentSharedRecipe(makeSentMeal(), 'Sanne');

    expect(view.note).toBeNull();
    expect(view.attribution).toBeNull();
    expect(view.originalPostLabel).toBeNull();
  });

  test('leaves the collision label null rather than guessing without the household restriction set', () => {
    expect(buildLiveSentSharedRecipe(makeSentMeal({ ingredientTags: ['noten'] }), 'Sanne').collisionLabel).toBeNull();
  });

  test('shows the cook time and never a grade, because SentMeal carries no rating', () => {
    expect(buildLiveSentSharedRecipe(makeSentMeal({ estimatedMinutes: 20 }), 'Sanne').metaLine).toBe('20 min');
  });

  test('sorts ingredients and steps into recipe order regardless of input order', () => {
    const view = buildLiveSentSharedRecipe(
      makeSentMeal({
        ingredients: [
          { name: 'citroen', quantity: '1', unit: null, sortOrder: 1 },
          { name: 'kip', quantity: '600', unit: 'g', sortOrder: 0 },
        ],
        steps: [
          { text: 'Bakken.', sortOrder: 2 },
          { text: 'Snijden.', sortOrder: 1 },
        ],
      }),
      'Sanne',
    );

    expect(view.ingredientLines.map((line) => line.text)).toEqual(['600 g kip', '1 citroen']);
    expect(view.stepLines.map((line) => line.text)).toEqual(['1. Snijden.', '2. Bakken.']);
  });

  test('keys every line on the meal plus its position, since SentMealIngredient/SentMealStep carry no id', () => {
    const view = buildLiveSentSharedRecipe(
      makeSentMeal({
        mealId: 'meal-7',
        ingredients: [{ name: 'kip', quantity: null, unit: null, sortOrder: 0 }],
        steps: [{ text: 'Snijden.', sortOrder: 1 }],
      }),
      'Sanne',
    );

    expect(view.ingredientLines[0]?.key).toBe('meal-7-0');
    expect(view.stepLines[0]?.key).toBe('meal-7-1');
  });

  test('carries the sender caveat, matching the fixture-fed path', () => {
    expect(buildLiveSentSharedRecipe(makeSentMeal(), 'Sanne').tagCaveat).toBe(SHARED_RECIPE_SENT_TAG_CAVEAT);
  });

  test('carries the canonical recipe id the save is keyed on, and null for a hand-entered dish', () => {
    expect(buildLiveSentSharedRecipe(makeSentMeal({ recipeId: 'recipe-9' }), 'Sanne').canonicalRecipeId).toBe(
      'recipe-9',
    );
    expect(buildLiveSentSharedRecipe(makeSentMeal({ recipeId: null }), 'Sanne').canonicalRecipeId).toBeNull();
  });

  test('carries the source url through for PD-010.2, even though there is no label to pair it with yet', () => {
    expect(buildLiveSentSharedRecipe(makeSentMeal({ sourceUrl: null }), 'Sanne').sourceUrl).toBeNull();
    expect(buildLiveSentSharedRecipe(makeSentMeal(), 'Sanne').sourceUrl).toBe(
      'https://www.tiktok.com/@chefremy/video/123',
    );
  });
});

describe('buildCanonicalSharedRecipe', () => {
  test('carries no sender eyebrow and no note — DESIGN-SOCIAL §4.3', () => {
    const view = buildCanonicalSharedRecipe(makeCanonicalRecipe());

    expect(view.eyebrow).toBeNull();
    expect(view.note).toBeNull();
  });

  test('shows the cook time and never a grade, because it does not know whose grade to show', () => {
    expect(buildCanonicalSharedRecipe(makeCanonicalRecipe()).metaLine).toBe('25 min');
  });

  test('drops the meta row entirely when the caption never stated a cook time', () => {
    expect(buildCanonicalSharedRecipe(makeCanonicalRecipe({ estimatedMinutes: null })).metaLine).toBeNull();
  });

  test('never carries a collision label, because a canonical recipe holds no allergen tags at all', () => {
    expect(buildCanonicalSharedRecipe(makeCanonicalRecipe()).collisionLabel).toBeNull();
  });

  test('carries the caveat that says nobody checked, not the one that credits the sharer', () => {
    const view = buildCanonicalSharedRecipe(makeCanonicalRecipe());

    expect(view.tagCaveat).toBe(SHARED_RECIPE_CANONICAL_TAG_CAVEAT);
    expect(view.tagCaveat).not.toBe(SHARED_RECIPE_SENT_TAG_CAVEAT);
  });

  test('names the platform in the original-post link', () => {
    expect(buildCanonicalSharedRecipe(makeCanonicalRecipe()).originalPostLabel).toBe(
      'Bekijk het originele filmpje op TikTok',
    );
  });

  test('renders ingredients and steps in recipe order with keys unique to the recipe', () => {
    const view = buildCanonicalSharedRecipe(makeCanonicalRecipe());

    expect(view.ingredientLines.map((line) => line.text)).toEqual(['600 g kipdijfilet', '1 citroen']);
    expect(view.ingredientLines.map((line) => line.key)).toEqual(['recipe-1-0', 'recipe-1-1']);
    expect(view.stepLines.map((line) => line.key)).toEqual(['recipe-1-1', 'recipe-1-2']);
  });

  test('is keyed on itself for the save — a canonical recipe IS the row Bewaren copies', () => {
    expect(buildCanonicalSharedRecipe(makeCanonicalRecipe()).canonicalRecipeId).toBe('recipe-1');
  });
});

describe('buildCanonicalAttribution', () => {
  test('credits the author name as a handle, matching the card that led here', () => {
    expect(buildCanonicalAttribution(makeCanonicalRecipe())).toEqual({
      handle: 'kokenmetkees',
      displayName: 'kokenmetkees',
      platform: 'tiktok',
      profileUrl: 'https://www.tiktok.com/@kokenmetkees',
    });
  });

  test('keeps a null profile url rather than synthesising one from the name', () => {
    expect(buildCanonicalAttribution(makeCanonicalRecipe({ authorUrl: null }))?.profileUrl).toBeNull();
  });

  test('returns null when the source named nobody, rather than a platform-only credit row', () => {
    expect(buildCanonicalAttribution(makeCanonicalRecipe({ authorName: null }))).toBeNull();
    expect(buildCanonicalAttribution(makeCanonicalRecipe({ authorName: '   ' }))).toBeNull();
  });

  test('leaves the whole attribution block off the article when there is nobody to credit', () => {
    expect(buildCanonicalSharedRecipe(makeCanonicalRecipe({ authorName: null })).attribution).toBeNull();
  });
});

describe('describeSharedRecipeNotice', () => {
  test('says nothing under the title while loading — no spinner, no placeholder body', () => {
    expect(describeSharedRecipeNotice('loading')).toEqual({ title: 'Even kijken...', body: null });
  });

  test('names both real causes of a missing recipe and blames neither party', () => {
    const notice = describeSharedRecipeNotice('missing');

    expect(notice.title).toBe('Dit recept staat er niet meer');
    expect(notice.body).toBe('De maker heeft het teruggetrokken, of de post is verwijderd.');
  });

  test('distinguishes a failed read from a withdrawn recipe, because only one invites a retry', () => {
    expect(describeSharedRecipeNotice('failed').title).not.toBe(describeSharedRecipeNotice('missing').title);
    expect(describeSharedRecipeNotice('failed').body).toContain('opnieuw');
  });
});

describe('buildCreatorCreditLine', () => {
  test('names handle and platform when the profile link is fine', () => {
    expect(buildCreatorCreditLine('kokenmetkees', 'tiktok', false)).toBe('@kokenmetkees · TikTok');
  });

  test('offers a retry instead of the platform after a failed open', () => {
    expect(buildCreatorCreditLine('kokenmetkees', 'tiktok', true)).toBe('@kokenmetkees · opnieuw proberen');
  });

  test('credits the platform alone rather than rendering "@ · TikTok" for a creator with no handle', () => {
    expect(buildCreatorCreditLine('', 'tiktok', false)).toBe('TikTok');
    expect(buildCreatorCreditLine('   ', 'instagram', false)).toBe('Instagram');
  });

  test('leaves the retry clause standing alone when there is no handle, since it is about the tap', () => {
    expect(buildCreatorCreditLine('', 'tiktok', true)).toBe('opnieuw proberen');
  });
});

describe('buildCreatorCreditAccessibilityLabel', () => {
  test('states the credit rather than an action, because a row with no link performs none', () => {
    expect(buildCreatorCreditAccessibilityLabel('Chef Remy', 'TikTok')).toBe('Recept van Chef Remy op TikTok');
  });
});

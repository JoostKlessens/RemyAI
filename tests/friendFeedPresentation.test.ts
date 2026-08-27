/**
 * Fase 5b — the friend feed's pure presentation layer.
 *
 * Everything asserted here is copy and view-model construction, which is
 * exactly the half of a screen that can regress silently: a Dutch list
 * joined with the wrong conjunction, a rating rendered against a
 * hardcoded "5", or — the one that actually matters — a PD-007a collision
 * label that stops appearing because an upstream shape changed. The
 * component that renders these strings is not unit-testable here (vitest
 * runs in `node` with react-native stubbed), so the logic lives outside
 * the component and is tested directly, the same split
 * `recipeScheduling.ts` / `ratingScaleCopy.ts` / `creatorPresentation.ts`
 * already use.
 */

import { describe, expect, test } from 'vitest';

import {
  KEY_INGREDIENT_LIMIT,
  assembleFriendFeed,
  buildAllergenCollisionLabel,
  buildFriendRecipeCardAccessibilityLabel,
  buildFriendRecipeCardModels,
  buildFriendRecipeMetaLine,
  buildOriginalPostLinkLabel,
  formatIngredientLine,
  joinDutchList,
  summarizeKeyIngredients,
  type FriendFeedRequest,
  type FriendFeedSource,
  type FriendRecipeCardModel,
  type FriendShare,
} from '@/components/friendFeedPresentation';
import { RATING_MAX } from '@/domain/rating';
import type { Creator, FeedItem } from '@/domain/feed/types';
import type { Meal, MealIngredient } from '@/domain/types';
import { makeHousehold, makeMeal, makeMember, makeRestriction } from './fixtures';
import { makeCreator, makeFeedItem } from './feed/fixtures';

function makeIngredient(name: string, sortOrder: number): MealIngredient {
  return { id: `ing-${sortOrder}`, mealId: 'meal-1', name, quantity: null, unit: null, allergenTags: [], sortOrder };
}

/** Names in the order given, numbered from 0 — order-sensitive tests build their own `sortOrder`s instead. */
function makeIngredients(...names: readonly string[]): readonly MealIngredient[] {
  return names.map((name, index) => makeIngredient(name, index));
}

function makeShare(overrides: Partial<FriendShare> = {}): FriendShare {
  // `note: null` is the ordinary case — §4.1's input is optional — and it
  // is spelled rather than omitted because `FriendShare.note` is required
  // and nullable on purpose: `normalizeSendNote` gives "sent without a
  // note" exactly one representation, and an optional field would add a
  // second. The note's own behaviour is covered in
  // tests/gekooktPresentation.test.ts.
  return { feedItemId: 'feed-item-1', friendName: 'Sanne', rating: 4, note: null, ...overrides };
}

interface SourceParts {
  readonly items?: readonly FeedItem[];
  readonly creators?: readonly Creator[];
  readonly meals?: readonly Meal[];
  readonly ingredientsByMealId?: ReadonlyMap<string, readonly MealIngredient[]>;
  readonly shares?: readonly FriendShare[];
  readonly collidingTagsByFeedItemId?: ReadonlyMap<string, readonly string[]>;
}

/** Assembles the lookup-map-shaped `FriendFeedSource` from plain arrays, so each test states only what it cares about. */
function makeSource(parts: SourceParts = {}): FriendFeedSource {
  const items = parts.items ?? [makeFeedItem({ mealId: 'meal-1' })];
  const creators = parts.creators ?? [makeCreator()];
  const meals = parts.meals ?? [makeMeal({ id: 'meal-1' })];
  const shares = parts.shares ?? [makeShare()];
  return {
    items,
    creatorsById: new Map(creators.map((creator) => [creator.id, creator])),
    mealsById: new Map(meals.map((meal) => [meal.id, meal])),
    ingredientsByMealId: parts.ingredientsByMealId ?? new Map(),
    sharesByFeedItemId: new Map(shares.map((share) => [share.feedItemId, share])),
    collidingTagsByFeedItemId: parts.collidingTagsByFeedItemId ?? new Map(),
  };
}

describe('joinDutchList', () => {
  test('returns an empty string for no items', () => {
    expect(joinDutchList([])).toBe('');
  });

  test('returns a single item unchanged', () => {
    expect(joinDutchList(['noten'])).toBe('noten');
  });

  test('joins two items with "en", never a comma', () => {
    expect(joinDutchList(['noten', 'melk'])).toBe('noten en melk');
  });

  test('joins three or more items with commas and a final "en"', () => {
    expect(joinDutchList(['noten', 'melk', 'gluten'])).toBe('noten, melk en gluten');
  });
});

describe('summarizeKeyIngredients', () => {
  test('returns null for a recipe with no ingredient data, so the card can say nothing at all', () => {
    // Arrange / Act
    const summary = summarizeKeyIngredients([]);

    // Assert — deliberately null, not a "geen ingrediënten" string: an
    // unparsed recipe has no ingredients *recorded*, which is not the same
    // claim as a recipe having none.
    expect(summary).toBeNull();
  });

  test('reads ingredients in sortOrder, not in array order', () => {
    const summary = summarizeKeyIngredients([
      makeIngredient('citroen', 2),
      makeIngredient('kipfilet', 0),
      makeIngredient('paprika', 1),
    ]);

    expect(summary?.visible).toEqual(['kipfilet', 'paprika', 'citroen']);
  });

  test('joins the visible names with the middot separator', () => {
    const summary = summarizeKeyIngredients(makeIngredients('kipfilet', 'paprika'));

    expect(summary?.text).toBe('kipfilet · paprika');
  });

  test('caps the visible names at the limit and reports the remainder as a compact count', () => {
    const summary = summarizeKeyIngredients(makeIngredients('kipfilet', 'paprika', 'citroen', 'olijfolie', 'knoflook'));

    expect(summary?.visible).toHaveLength(KEY_INGREDIENT_LIMIT);
    expect(summary?.hiddenCount).toBe(2);
    expect(summary?.text).toBe('kipfilet · paprika · citroen · +2');
  });

  test('spells the remainder out in Dutch for screen readers, where "+2" is meaningless', () => {
    const summary = summarizeKeyIngredients(makeIngredients('kipfilet', 'paprika', 'citroen', 'olijfolie', 'knoflook'));

    expect(summary?.spokenText).toBe('kipfilet, paprika, citroen en 2 andere ingrediënten');
  });

  test('uses the singular for exactly one hidden ingredient', () => {
    const summary = summarizeKeyIngredients(makeIngredients('kipfilet', 'paprika', 'citroen', 'olijfolie'));

    expect(summary?.spokenText).toBe('kipfilet, paprika, citroen en 1 ander ingrediënt');
  });

  test('adds no count when every ingredient already fits', () => {
    const summary = summarizeKeyIngredients(makeIngredients('kipfilet', 'paprika'));

    expect(summary?.hiddenCount).toBe(0);
    expect(summary?.text).not.toContain('+');
    expect(summary?.spokenText).toBe('kipfilet en paprika');
  });

  test('skips blank ingredient names rather than rendering an empty slot', () => {
    const summary = summarizeKeyIngredients([
      makeIngredient('kipfilet', 0),
      makeIngredient('   ', 1),
      makeIngredient('paprika', 2),
    ]);

    expect(summary?.visible).toEqual(['kipfilet', 'paprika']);
    expect(summary?.hiddenCount).toBe(0);
  });

  test('honours a caller-supplied limit', () => {
    const summary = summarizeKeyIngredients(makeIngredients('kipfilet', 'paprika', 'citroen'), 1);

    expect(summary?.visible).toEqual(['kipfilet']);
    expect(summary?.hiddenCount).toBe(2);
  });
});

describe('formatIngredientLine', () => {
  test('renders a bare name when no quantity or unit was captured', () => {
    expect(formatIngredientLine(makeIngredient('knoflook', 0))).toBe('knoflook');
  });

  test('renders quantity, unit and name as one line', () => {
    expect(formatIngredientLine({ ...makeIngredient('kipfilet', 0), quantity: '400', unit: 'g' })).toBe('400 g kipfilet');
  });

  test('renders a quantity without a unit', () => {
    expect(formatIngredientLine({ ...makeIngredient('paprika', 0), quantity: '2', unit: null })).toBe('2 paprika');
  });

  test('renders a unit without a quantity rather than dropping it', () => {
    expect(formatIngredientLine({ ...makeIngredient('olijfolie', 0), quantity: null, unit: 'scheut' })).toBe(
      'scheut olijfolie',
    );
  });

  test('treats a blank quantity as absent, so no line ever starts with a space', () => {
    expect(formatIngredientLine({ ...makeIngredient('zout', 0), quantity: '  ', unit: null })).toBe('zout');
  });
});

describe('buildAllergenCollisionLabel (PD-007a)', () => {
  test('returns null when nothing collides, so no chip is rendered at all', () => {
    expect(buildAllergenCollisionLabel([])).toBeNull();
  });

  test('states one colliding tag as a plain fact', () => {
    expect(buildAllergenCollisionLabel(['noten'])).toBe('bevat noten');
  });

  test('renders the EU-14 display label, not the raw tag, so Dutch reads correctly', () => {
    // 'pinda' is the stored vocabulary tag; "bevat pinda" is not Dutch.
    expect(buildAllergenCollisionLabel(['pinda'])).toBe("bevat pinda's");
  });

  test('lowercases stored casing from legacy or hand-entered tags', () => {
    expect(buildAllergenCollisionLabel(['Noten'])).toBe('bevat noten');
  });

  test('joins several colliding tags as a Dutch list', () => {
    expect(buildAllergenCollisionLabel(['noten', 'melk', 'gluten'])).toBe('bevat noten, melk en gluten');
  });

  test('deduplicates tags that differ only in casing', () => {
    expect(buildAllergenCollisionLabel(['Noten', 'noten'])).toBe('bevat noten');
  });

  test('ignores blank tags instead of emitting a dangling separator', () => {
    expect(buildAllergenCollisionLabel(['noten', '  '])).toBe('bevat noten');
  });

  test('falls back to a non-vocabulary tag (a dislike) rather than dropping it', () => {
    expect(buildAllergenCollisionLabel(['champignons'])).toBe('bevat champignons');
  });

  test('never renders a safety verdict — PD-007a forbids "niet veilig voor jou"', () => {
    const label = buildAllergenCollisionLabel(['noten', 'melk']) ?? '';

    expect(label.toLowerCase()).not.toContain('veilig');
    expect(label.toLowerCase()).not.toContain('waarschuwing');
    expect(label.toLowerCase()).not.toContain('gevaar');
  });
});

describe('buildFriendRecipeMetaLine', () => {
  test('returns null when neither a cook time nor a rating is known', () => {
    expect(buildFriendRecipeMetaLine(null, null)).toBeNull();
  });

  test('renders a cook time on its own', () => {
    expect(buildFriendRecipeMetaLine(35, null)).toBe('35 min');
  });

  test('renders a rating against the scale in domain/rating.ts, never a hardcoded maximum', () => {
    expect(buildFriendRecipeMetaLine(null, 4)).toBe(`4,0/${RATING_MAX}`);
  });

  test('joins both with the middot meta separator used everywhere else', () => {
    expect(buildFriendRecipeMetaLine(35, 4)).toBe(`35 min  ·  4,0/${RATING_MAX}`);
  });

  /** A Dutch grade takes a comma. "7.5/10" on a Dutch card reads as a typo. */
  test('writes a half grade with a comma, never a point', () => {
    expect(buildFriendRecipeMetaLine(null, 7.5)).toBe(`7,5/${RATING_MAX}`);
    expect(buildFriendRecipeMetaLine(null, 7.5)).not.toContain('.');
  });

  /** One decimal always, so a column of cards does not jump between "8" and "7,5". */
  test('writes a whole grade to one decimal too', () => {
    expect(buildFriendRecipeMetaLine(null, 8)).toBe(`8,0/${RATING_MAX}`);
  });

  test('drops an out-of-range rating instead of clamping it into an opinion nobody gave', () => {
    expect(buildFriendRecipeMetaLine(35, RATING_MAX + 1)).toBe('35 min');
    expect(buildFriendRecipeMetaLine(35, 0)).toBe('35 min');
    expect(buildFriendRecipeMetaLine(35, 3.55)).toBe('35 min');
  });
});

describe('buildFriendRecipeCardModels', () => {
  test('builds one card per servable item, in the order given (already ranked upstream)', () => {
    const source = makeSource({
      items: [makeFeedItem({ id: 'b', mealId: 'meal-2' }), makeFeedItem({ id: 'a', mealId: 'meal-1' })],
      meals: [makeMeal({ id: 'meal-1', title: 'Traybake' }), makeMeal({ id: 'meal-2', title: 'Pasta pesto' })],
      shares: [makeShare({ feedItemId: 'a' }), makeShare({ feedItemId: 'b', friendName: 'Joris' })],
    });

    const models = buildFriendRecipeCardModels(source);

    expect(models.map((model) => model.feedItemId)).toEqual(['b', 'a']);
    expect(models.map((model) => model.title)).toEqual(['Pasta pesto', 'Traybake']);
  });

  test('carries the meal, friend, rating and creator through onto the card model', () => {
    const source = makeSource({
      meals: [makeMeal({ id: 'meal-1', title: 'Traybake', estimatedMinutes: 35 })],
      shares: [makeShare({ friendName: 'Sanne', rating: 5 })],
    });

    const [model] = buildFriendRecipeCardModels(source);

    expect(model?.title).toBe('Traybake');
    expect(model?.estimatedMinutes).toBe(35);
    expect(model?.friendName).toBe('Sanne');
    expect(model?.rating).toBe(5);
    expect(model?.creator.handle).toBe('chefremy');
    expect(model?.sourceUrl).toBe('https://www.tiktok.com/@chefremy/video/123');
  });

  test('prefers the feed item’s own oEmbed thumbnail over the stored meal’s', () => {
    const source = makeSource({
      items: [makeFeedItem({ mealId: 'meal-1', thumbnailUrl: 'https://cdn/from-oembed.jpg' })],
      meals: [makeMeal({ id: 'meal-1', thumbnailUrl: 'https://cdn/from-meal.jpg' })],
    });

    const [model] = buildFriendRecipeCardModels(source);

    expect(model?.thumbnailUrl).toBe('https://cdn/from-oembed.jpg');
  });

  test('falls back to the meal’s thumbnail when the feed item has none', () => {
    const source = makeSource({
      items: [makeFeedItem({ mealId: 'meal-1', thumbnailUrl: null })],
      meals: [makeMeal({ id: 'meal-1', thumbnailUrl: 'https://cdn/from-meal.jpg' })],
    });

    const [model] = buildFriendRecipeCardModels(source);

    expect(model?.thumbnailUrl).toBe('https://cdn/from-meal.jpg');
  });

  test('leaves the thumbnail null when neither side has one, so the monogram fallback renders', () => {
    const source = makeSource({
      items: [makeFeedItem({ mealId: 'meal-1', thumbnailUrl: null })],
      meals: [makeMeal({ id: 'meal-1', thumbnailUrl: null })],
    });

    const [model] = buildFriendRecipeCardModels(source);

    expect(model?.thumbnailUrl).toBeNull();
  });

  test('summarizes the linked recipe’s key ingredients (PD-010: name + key ingredients on the card)', () => {
    const source = makeSource({
      ingredientsByMealId: new Map([['meal-1', makeIngredients('kipfilet', 'paprika', 'citroen', 'olijfolie')]]),
    });

    const [model] = buildFriendRecipeCardModels(source);

    expect(model?.keyIngredients?.visible).toEqual(['kipfilet', 'paprika', 'citroen']);
    expect(model?.keyIngredients?.hiddenCount).toBe(1);
  });

  test('carries PD-007a colliding tags through verbatim — the card ranks down, it never hides', () => {
    const source = makeSource({ collidingTagsByFeedItemId: new Map([['feed-item-1', ['noten']]]) });

    const [model] = buildFriendRecipeCardModels(source);

    expect(model?.collidingTags).toEqual(['noten']);
  });

  test('skips an item with no linked meal — PD-010 promises a card that opens a full recipe', () => {
    const source = makeSource({ items: [makeFeedItem({ mealId: null })] });

    expect(buildFriendRecipeCardModels(source)).toEqual([]);
  });

  test('skips an item whose linked meal is missing from the lookup, rather than rendering a blank card', () => {
    const source = makeSource({ items: [makeFeedItem({ mealId: 'meal-999' })] });

    expect(buildFriendRecipeCardModels(source)).toEqual([]);
  });

  test('skips an item whose creator is unknown — attribution is a PD-010 shipping condition, not a nicety', () => {
    const source = makeSource({ items: [makeFeedItem({ mealId: 'meal-1', creatorId: 'creator-999' })] });

    expect(buildFriendRecipeCardModels(source)).toEqual([]);
  });

  test('skips an item nobody actually shared, rather than inventing a sender', () => {
    const source = makeSource({ shares: [] });

    expect(buildFriendRecipeCardModels(source)).toEqual([]);
  });
});

describe('buildFriendRecipeCardAccessibilityLabel', () => {
  function makeModel(overrides: Partial<FriendRecipeCardModel> = {}): FriendRecipeCardModel {
    const [model] = buildFriendRecipeCardModels(
      makeSource({
        meals: [makeMeal({ id: 'meal-1', title: 'Traybake met kip', estimatedMinutes: 35 })],
        ingredientsByMealId: new Map([['meal-1', makeIngredients('kipfilet', 'paprika')]]),
      }),
    );
    if (model === undefined) {
      throw new Error('fixture source produced no card model');
    }
    return { ...model, ...overrides };
  }

  test('names the dish, who shared it, and whose video it came from', () => {
    const label = buildFriendRecipeCardAccessibilityLabel(makeModel());

    expect(label).toContain('Traybake met kip');
    expect(label).toContain('Sanne');
    expect(label).toContain('chefremy');
    expect(label).toContain('TikTok');
  });

  test('reads the key ingredients as words, not as the visual "+2" shorthand', () => {
    const label = buildFriendRecipeCardAccessibilityLabel(
      makeModel({ keyIngredients: summarizeKeyIngredients(makeIngredients('a', 'b', 'c', 'd')) }),
    );

    expect(label).toContain('en 1 ander ingrediënt');
    expect(label).not.toContain('+1');
  });

  test('announces a PD-007a collision — a label a screen reader cannot reach is not a label', () => {
    const label = buildFriendRecipeCardAccessibilityLabel(makeModel({ collidingTags: ['noten'] }));

    expect(label).toContain('bevat noten');
    expect(label.toLowerCase()).not.toContain('veilig');
  });

  test('says nothing about allergens when nothing collided — absence is never a clean bill of health', () => {
    const label = buildFriendRecipeCardAccessibilityLabel(makeModel({ collidingTags: [] }));

    expect(label.toLowerCase()).not.toContain('bevat');
    expect(label.toLowerCase()).not.toContain('geen allergenen');
  });
});

describe('buildOriginalPostLinkLabel (PD-010.2)', () => {
  test('names the platform the tap actually leaves for', () => {
    expect(buildOriginalPostLinkLabel('tiktok')).toBe('Bekijk het originele filmpje op TikTok');
    expect(buildOriginalPostLinkLabel('instagram')).toBe('Bekijk het originele filmpje op Instagram');
  });
});

/**
 * The whole pipeline the Vrienden tab runs, end to end: the PD-007
 * consent gate, PD-004's cookability ranking, PD-007a's collision tags,
 * and the card mapping. Worth testing as one unit and not only in parts —
 * the guarantee people actually care about ("a nut recipe is ranked down
 * but still shown, and still labelled") only exists once all four are
 * wired together in the right order, and every one of those wires is
 * exactly the kind of thing a refactor quietly reverses.
 */
describe('assembleFriendFeed', () => {
  const TARGET_DATE = '2026-08-25';

  function makeRequest(overrides: Partial<FriendFeedRequest> = {}): FriendFeedRequest {
    return {
      household: makeHousehold({ weeknightTimeBudgetMinutes: 30 }),
      members: [makeMember()],
      restrictions: [makeRestriction({ type: 'allergen', excludesTag: 'noten' })],
      creators: [makeCreator()],
      items: [makeFeedItem({ mealId: 'meal-1' })],
      meals: [makeMeal({ id: 'meal-1' })],
      ingredientsByMealId: new Map(),
      shares: [makeShare()],
      targetDate: TARGET_DATE,
      ...overrides,
    };
  }

  test('serves a consented creator’s shared recipe', () => {
    const cards = assembleFriendFeed(makeRequest());

    expect(cards.map((card) => card.feedItemId)).toEqual(['feed-item-1']);
  });

  test('drops everything from a creator who withdrew consent (PD-007, honoured immediately)', () => {
    const request = makeRequest({
      creators: [makeCreator({ optedOutAt: '2026-08-01T00:00:00.000Z' })],
    });

    expect(assembleFriendFeed(request)).toEqual([]);
  });

  test('drops a taken-down post even while its creator is still consented', () => {
    const request = makeRequest({
      items: [makeFeedItem({ mealId: 'meal-1', removedAt: '2026-08-02T00:00:00.000Z' })],
    });

    expect(assembleFriendFeed(request)).toEqual([]);
  });

  test('ranks a colliding recipe below a clean one but still returns it — PD-007a: rank down, never hide', () => {
    const request = makeRequest({
      items: [
        makeFeedItem({ id: 'collides', mealId: 'meal-nuts' }),
        makeFeedItem({ id: 'clean', mealId: 'meal-clean' }),
      ],
      meals: [
        makeMeal({ id: 'meal-nuts', title: 'Pasta pesto', estimatedMinutes: 20, ingredientTags: ['noten'] }),
        makeMeal({ id: 'meal-clean', title: 'Miso-ramen', estimatedMinutes: 25, ingredientTags: ['soja'] }),
      ],
      shares: [makeShare({ feedItemId: 'collides' }), makeShare({ feedItemId: 'clean' })],
    });

    const cards = assembleFriendFeed(request);

    expect(cards.map((card) => card.feedItemId)).toEqual(['clean', 'collides']);
  });

  test('attaches the colliding tags, so the card has something factual to label', () => {
    const request = makeRequest({
      meals: [makeMeal({ id: 'meal-1', ingredientTags: ['noten', 'melk'] })],
    });

    const [card] = assembleFriendFeed(request);

    expect(card?.collidingTags).toEqual(['noten']);
    expect(buildAllergenCollisionLabel(card?.collidingTags ?? [])).toBe('bevat noten');
  });

  test('labels nothing for a household without that restriction — the recipe is unchanged, the household is not', () => {
    const request = makeRequest({
      restrictions: [],
      meals: [makeMeal({ id: 'meal-1', ingredientTags: ['noten', 'melk'] })],
    });

    const [card] = assembleFriendFeed(request);

    expect(card?.collidingTags).toEqual([]);
    expect(buildAllergenCollisionLabel(card?.collidingTags ?? [])).toBeNull();
  });

  test('summarizes each card’s key ingredients from the recipe it links to', () => {
    const request = makeRequest({
      ingredientsByMealId: new Map([['meal-1', makeIngredients('kipfilet', 'paprika')]]),
    });

    const [card] = assembleFriendFeed(request);

    expect(card?.keyIngredients?.text).toBe('kipfilet · paprika');
  });

  test('returns nothing at all for a household nobody has shared with yet', () => {
    expect(assembleFriendFeed(makeRequest({ items: [], shares: [] }))).toEqual([]);
  });
});

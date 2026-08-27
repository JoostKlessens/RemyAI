/**
 * PD-020.1 — the unseen band and the `Vrienden · 2` tab count — plus the
 * union the Gekookt list became once it held two card kinds.
 *
 * THE ASSERTION THIS FILE EXISTS FOR is the one in "only sends feed the
 * count": ambient cook proof must never reach the tab label or the band,
 * however many friends cooked something today. DESIGN.md §8 puts it as
 * "a count fed by other people's ordinary dinners is 'check back often'
 * by another name; a count of letters addressed to you is mail", and
 * PD-004 is the rule underneath it — this surface is measured on
 * save-to-cook and never on dwell time. That is a product decision no
 * type can hold on its own, so it is pinned here twice: once against the
 * count, once against the band.
 *
 * It is enforceable rather than merely asserted because of how the two
 * models are shaped. A proof card carries `recipeId` and declares
 * `mealId?: never`; a send card carries `mealId` and no `recipeId`. The
 * unseen set is a set of MEAL ids, so a proof card has no key to be
 * looked up by — the test below drops a proof card's `recipeId` into the
 * unseen set to prove the band still refuses it.
 *
 * No React Native import anywhere, so this runs under vitest's `node`
 * environment against the real module rather than a mirror of it.
 */

import { describe, expect, test } from 'vitest';
import {
  UNSEEN_ENTRANCE_STAGGER_LIMIT,
  UNSEEN_ENTRANCE_STAGGER_MS,
  UNSEEN_TAB_COUNT_CEILING,
  VRIENDEN_TAB_ACCESSIBILITY_LABEL,
  VRIENDEN_TAB_TITLE,
  buildVriendenTabAccessibilityLabel,
  buildVriendenTabLabel,
  collectUnseenSendMealIds,
  countUnseenSends,
  getGekooktCardKey,
  isProofCard,
  orderGekooktList,
  resolveUnseenEntranceDelay,
  type GekooktCard,
} from '@/components/gekooktPresentation';
import {
  buildFriendRecipeCardAccessibilityLabel,
  buildFriendRecipeCardModels,
  type FriendProofCardModel,
  type FriendRecipeCardModel,
  type FriendShare,
} from '@/components/friendFeedPresentation';
import type { Creator, FeedItem } from '@/domain/feed/types';
import type { IncomingSend } from '@/lib/repository/social/types';
import type { Meal, MealIngredient } from '@/domain/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CREATOR: Creator = {
  id: 'creator-1',
  handle: 'kokenmetkees',
  displayName: 'Koken met Kees',
  platform: 'tiktok',
  profileUrl: 'https://www.tiktok.com/@kokenmetkees',
  optedInAt: '2026-01-01T00:00:00.000Z',
  optedOutAt: null,
};

function makeSend(mealId: string, seen: boolean): IncomingSend {
  return {
    id: `share-${mealId}`,
    mealId,
    senderProfileId: 'profile-joris',
    recipientProfileId: 'profile-joost',
    note: null,
    sentAt: '2026-08-20T18:00:00.000Z',
    seen,
  };
}

function makeSendCard(mealId: string): FriendRecipeCardModel {
  return {
    feedItemId: `feed-${mealId}`,
    mealId,
    title: `Dish ${mealId}`,
    thumbnailUrl: null,
    estimatedMinutes: 20,
    servings: 2,
    rating: 4,
    friendName: 'Joris',
    creator: CREATOR,
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
    keyIngredients: null,
    collidingTags: [],
    note: null,
  };
}

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

// ---------------------------------------------------------------------------
// The count that reaches the tab label
// ---------------------------------------------------------------------------

describe('countUnseenSends', () => {
  test('counts the sends waiting to be looked at, and nothing else', () => {
    expect(countUnseenSends([makeSend('m-1', false), makeSend('m-2', true), makeSend('m-3', false)])).toBe(2);
  });

  test('is zero once every send has been seen', () => {
    expect(countUnseenSends([makeSend('m-1', true), makeSend('m-2', true)])).toBe(0);
  });

  test('is zero for an empty list rather than undefined', () => {
    expect(countUnseenSends([])).toBe(0);
  });

  /**
   * PD-020.1, the whole discipline of it. `IncomingSend` is the only
   * shape this function accepts and `shared_cooks` produces nothing of
   * that shape — it carries no reader state there could be an unseen half
   * of. Stated as a test anyway, because the rule is a product decision
   * and the next person to want "a fuller count" will read this file
   * before they read §8.
   */
  test('proof has no way in: the count reads sends and only sends', () => {
    const everythingSeen = [makeSend('m-1', true), makeSend('m-2', true)];
    expect(countUnseenSends(everythingSeen)).toBe(0);
    expect(buildVriendenTabLabel(countUnseenSends(everythingSeen))).toBe('Vrienden');
  });
});

describe('collectUnseenSendMealIds', () => {
  test('holds exactly the meals whose send has not been looked at', () => {
    const ids = collectUnseenSendMealIds([makeSend('m-1', false), makeSend('m-2', true), makeSend('m-3', false)]);
    expect([...ids].sort()).toEqual(['m-1', 'm-3']);
  });

  test('is empty when everything has been seen', () => {
    expect(collectUnseenSendMealIds([makeSend('m-1', true)]).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The tab label
// ---------------------------------------------------------------------------

describe('buildVriendenTabLabel', () => {
  test('is exactly "Vrienden" when nothing is waiting', () => {
    expect(buildVriendenTabLabel(0)).toBe('Vrienden');
    expect(buildVriendenTabLabel(0)).toBe(VRIENDEN_TAB_TITLE);
  });

  test('appends a mono middot count while sends are unseen', () => {
    expect(buildVriendenTabLabel(1)).toBe('Vrienden · 1');
    expect(buildVriendenTabLabel(2)).toBe('Vrienden · 2');
  });

  /** A burned-in frame counter, not a badge: no dot, no red, no "!" anywhere in the string. */
  test('never dresses the count as an alarm', () => {
    const label = buildVriendenTabLabel(7);
    expect(label).not.toMatch(/[!•●]/u);
    expect(label).toBe('Vrienden · 7');
  });

  test('negative or nonsense counts fall back to the bare label', () => {
    expect(buildVriendenTabLabel(-1)).toBe('Vrienden');
    expect(buildVriendenTabLabel(Number.NaN)).toBe('Vrienden');
  });

  /** §8 records no overflow rule; this is the decision, and it needs ratifying. */
  test('overflows above the ceiling rather than widening the tab bar', () => {
    expect(buildVriendenTabLabel(UNSEEN_TAB_COUNT_CEILING)).toBe('Vrienden · 99');
    expect(buildVriendenTabLabel(UNSEEN_TAB_COUNT_CEILING + 1)).toBe('Vrienden · 99+');
    expect(buildVriendenTabLabel(4321)).toBe('Vrienden · 99+');
  });
});

describe('buildVriendenTabAccessibilityLabel', () => {
  test('is the unchanged sentence when nothing is waiting', () => {
    expect(buildVriendenTabAccessibilityLabel(0)).toBe(VRIENDEN_TAB_ACCESSIBILITY_LABEL);
    expect(buildVriendenTabAccessibilityLabel(0)).toBe('Vrienden, recepten die vrienden met je deelden');
  });

  test('states the count in words, agreeing in number', () => {
    expect(buildVriendenTabAccessibilityLabel(1)).toBe(
      'Vrienden, recepten die vrienden met je deelden, 1 recept nog niet bekeken',
    );
    expect(buildVriendenTabAccessibilityLabel(3)).toBe(
      'Vrienden, recepten die vrienden met je deelden, 3 recepten nog niet bekeken',
    );
  });

  test('says the overflow rather than reading a plus sign aloud', () => {
    expect(buildVriendenTabAccessibilityLabel(400)).toBe(
      'Vrienden, recepten die vrienden met je deelden, meer dan 99 recepten nog niet bekeken',
    );
  });

  /** A screen reader must never be left to voice the visual middot. */
  test('never contains the middot the visible label uses', () => {
    for (const count of [0, 1, 2, 40, 500]) {
      expect(buildVriendenTabAccessibilityLabel(count)).not.toContain('·');
    }
  });

  /** A plain statement of fact — never "nieuw", never an exclamation. */
  test('is a statement of fact rather than an announcement', () => {
    const label = buildVriendenTabAccessibilityLabel(2);
    expect(label).not.toMatch(/nieuw|!/iu);
  });
});

// ---------------------------------------------------------------------------
// The union at the render seam
// ---------------------------------------------------------------------------

describe('the two card kinds', () => {
  test('narrows on the identifier each kind actually holds', () => {
    expect(isProofCard(makeProofCard('r-1'))).toBe(true);
    expect(isProofCard(makeSendCard('m-1'))).toBe(false);
  });

  test('keys the two kinds apart, so one id cannot collide with the other', () => {
    expect(getGekooktCardKey(makeSendCard('m-1'))).not.toBe(getGekooktCardKey(makeProofCard('m-1')));
    expect(getGekooktCardKey(makeSendCard('m-1'))).toBe('send:feed-m-1');
    expect(getGekooktCardKey(makeProofCard('r-1'))).toBe('proof:r-1');
  });
});

// ---------------------------------------------------------------------------
// The band
// ---------------------------------------------------------------------------

describe('orderGekooktList', () => {
  test('lifts unseen sends to the top and leaves everything else in its ranked place', () => {
    const cards: readonly GekooktCard[] = [
      makeProofCard('r-1'),
      makeSendCard('m-seen'),
      makeSendCard('m-unseen'),
      makeProofCard('r-2'),
    ];

    const list = orderGekooktList(cards, new Set(['m-unseen']));

    expect(list.cards.map(getGekooktCardKey)).toEqual([
      'send:feed-m-unseen',
      'proof:r-1',
      'send:feed-m-seen',
      'proof:r-2',
    ]);
    expect(list.unseenBandSize).toBe(1);
  });

  /**
   * "ordered by `rankFeedItems` cookability WITHIN the group" — the caller
   * hands the list already ranked, so the only thing this may do is a
   * STABLE partition. Anything that re-sorted would be a second opinion
   * about cookability, and the first sign of a recency order.
   */
  test('preserves the ranked order the caller handed in, inside both halves', () => {
    const cards: readonly GekooktCard[] = [
      makeSendCard('m-a'),
      makeProofCard('r-1'),
      makeSendCard('m-b'),
      makeSendCard('m-c'),
      makeProofCard('r-2'),
    ];

    const list = orderGekooktList(cards, new Set(['m-b', 'm-a']));

    expect(list.cards.map(getGekooktCardKey)).toEqual([
      'send:feed-m-a',
      'send:feed-m-b',
      'proof:r-1',
      'send:feed-m-c',
      'proof:r-2',
    ]);
    expect(list.unseenBandSize).toBe(2);
  });

  /**
   * PD-020.1 again, from the band's side. A proof card whose canonical
   * recipe id happens to equal an unseen meal id must still not be lifted:
   * proof is ambient and has no reader state, so it cannot be "unseen".
   * The model makes this structural — a proof card has no `mealId` to
   * match — and this test is what would notice if that ever softened into
   * a convention.
   */
  test('never lifts a proof card, even when its id collides with an unseen meal id', () => {
    const cards: readonly GekooktCard[] = [makeProofCard('shared-id'), makeSendCard('m-1')];

    const list = orderGekooktList(cards, new Set(['shared-id', 'm-1']));

    expect(list.cards.map(getGekooktCardKey)).toEqual(['send:feed-m-1', 'proof:shared-id']);
    expect(list.unseenBandSize).toBe(1);
  });

  test('is the identity when nothing is unseen', () => {
    const cards: readonly GekooktCard[] = [makeProofCard('r-1'), makeSendCard('m-1')];
    const list = orderGekooktList(cards, new Set());

    expect(list.cards).toEqual(cards);
    expect(list.unseenBandSize).toBe(0);
  });

  test('returns a new array rather than sorting the one it was handed', () => {
    const cards: readonly GekooktCard[] = [makeProofCard('r-1'), makeSendCard('m-1')];
    const list = orderGekooktList(cards, new Set(['m-1']));

    expect(list.cards).not.toBe(cards);
    expect(cards.map(getGekooktCardKey)).toEqual(['proof:r-1', 'send:feed-m-1']);
  });
});

// ---------------------------------------------------------------------------
// The entrance, which is the only announcement
// ---------------------------------------------------------------------------

describe('resolveUnseenEntranceDelay', () => {
  test('staggers the band by 40ms a card', () => {
    expect(resolveUnseenEntranceDelay(0, 4, false)).toBe(0);
    expect(resolveUnseenEntranceDelay(1, 4, false)).toBe(UNSEEN_ENTRANCE_STAGGER_MS);
    expect(resolveUnseenEntranceDelay(3, 4, false)).toBe(3 * UNSEEN_ENTRANCE_STAGGER_MS);
  });

  /** Capped at four: a twenty-card band must not take most of a second to arrive. */
  test('stops accumulating past the cap', () => {
    const capped = (UNSEEN_ENTRANCE_STAGGER_LIMIT - 1) * UNSEEN_ENTRANCE_STAGGER_MS;
    expect(resolveUnseenEntranceDelay(4, 20, false)).toBe(capped);
    expect(resolveUnseenEntranceDelay(19, 20, false)).toBe(capped);
  });

  /** Null means "already at rest" — the card renders without an entrance at all. */
  test('gives nothing to a card below the band', () => {
    expect(resolveUnseenEntranceDelay(2, 2, false)).toBeNull();
    expect(resolveUnseenEntranceDelay(9, 0, false)).toBeNull();
  });

  test('lands everything instantly under reduced motion, with no stagger', () => {
    expect(resolveUnseenEntranceDelay(0, 4, true)).toBeNull();
    expect(resolveUnseenEntranceDelay(3, 4, true)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The note (DESIGN-SOCIAL.md §4.2)
// ---------------------------------------------------------------------------

const SEND_MEAL: Meal = {
  id: 'meal-1',
  householdId: 'household-joris',
  title: 'Romige pasta pesto',
  source: 'saved',
  estimatedMinutes: 20,
  skillLevel: 'beginner',
  servings: 2,
  ingredientTags: [],
  allergenTagStatus: 'unknown',
  dishTags: [],
  sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
  sourcePlatform: 'tiktok',
  thumbnailUrl: null,
  archivedAt: null,
  createdAt: '2026-08-01T09:00:00.000Z',
};

const SEND_ITEM: FeedItem = {
  id: 'feed-1',
  creatorId: CREATOR.id,
  sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
  sourcePlatform: 'tiktok',
  thumbnailUrl: null,
  title: null,
  authorName: 'Koken met Kees',
  oembedFetchedAt: '2026-08-01T09:00:00.000Z',
  mealId: 'meal-1',
  publishedAt: '2026-08-01T09:00:00.000Z',
  removedAt: null,
};

const INGREDIENTS: readonly MealIngredient[] = [
  { id: 'mi-1', mealId: 'meal-1', name: 'tagliatelle', quantity: '250', unit: 'g', allergenTags: [], sortOrder: 0 },
];

function buildCardWithNote(note: string | null): FriendRecipeCardModel {
  const share: FriendShare = { feedItemId: 'feed-1', friendName: 'Joris', rating: 4, note };
  const [model] = buildFriendRecipeCardModels({
    items: [SEND_ITEM],
    creatorsById: new Map([[CREATOR.id, CREATOR]]),
    mealsById: new Map([[SEND_MEAL.id, SEND_MEAL]]),
    ingredientsByMealId: new Map([['meal-1', INGREDIENTS]]),
    sharesByFeedItemId: new Map([['feed-1', share]]),
    collidingTagsByFeedItemId: new Map(),
  });
  if (model === undefined) {
    throw new Error('fixture source produced no card model');
  }
  return model;
}

describe('the note a sender wrote', () => {
  test('travels from the share onto the card, in the sender’s own words', () => {
    expect(buildCardWithNote('echt 20 min, beloofd').note).toBe('echt 20 min, beloofd');
  });

  /**
   * "An empty note is no note" — `normalizeSendNote` already collapsed a
   * whitespace-only note to null at the repository boundary, so null is
   * the one absent state and this layer must not invent a second one.
   */
  test('a send without a note carries null, never an empty string', () => {
    expect(buildCardWithNote(null).note).toBeNull();
  });

  test('is spoken to a screen reader, attributed to the friend who wrote it', () => {
    const label = buildFriendRecipeCardAccessibilityLabel(buildCardWithNote('echt 20 min, beloofd'));
    expect(label).toContain('gedeeld door Joris');
    expect(label).toContain('die erbij schreef: "echt 20 min, beloofd"');
  });

  test('adds nothing to the spoken label when there is no note', () => {
    expect(buildFriendRecipeCardAccessibilityLabel(buildCardWithNote(null))).not.toContain('schreef');
  });
});

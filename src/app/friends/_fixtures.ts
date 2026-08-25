/**
 * FIXTURE DATA — NOT REAL. Stands in for the friend-sharing backend
 * (`src/domain/social/**` plus its Supabase tables, both owned by another
 * agent and landing separately) while the Vrienden tab has nothing live to
 * read from. Kept in its own file under src/app/friends/ rather than mixed
 * into the shared src/app/_fixtures.ts, for exactly the reason that file's
 * header gives: fixtures flow one direction, into a single screen family,
 * and never leak into src/domain or src/lib.
 *
 * No `fetch`, no Supabase import, no I/O of any kind. Nothing here is
 * reachable from the two existing tabs.
 *
 * HOW THIS STAYS HONEST — the same discipline src/app/import/_fixtures.ts
 * describes, applied to a different seam:
 *
 * - **Every shape is the real domain type.** `Creator`/`FeedItem` from
 *   src/domain/feed/types.ts, `Household`/`Member`/`Restriction`/`Meal`/
 *   `MealIngredient`/`MealStep` from src/domain/types.ts, `FriendShare`
 *   from the presentation layer. Nothing here is a convenient UI-shaped
 *   invention, so swapping this module for a real repository call is
 *   meant to be mechanical.
 * - **The data is deliberately awkward, not tidy.** A real feed is not
 *   three perfect cards: one creator here has withdrawn consent, one
 *   share points at a video nobody has parsed into a recipe yet, one
 *   recipe has no thumbnail, one friend never scored what they sent, and
 *   one recipe collides with the household's nut allergy. Five feed items
 *   go in and three cards come out, and each disappearance is a rule
 *   being enforced rather than a bug:
 *     - `feed-friend-4` — creator `bakkerbram` has `optedOutAt` set, so
 *       PD-007's consent gate removes everything of his, immediately.
 *     - `feed-friend-5` — `mealId: null`, a share of a post the content
 *       pipeline has not turned into a recipe. PD-010 promises a card
 *       that opens a *full recipe*; there is none, so there is no card.
 *   If you are counting cards on device and getting three, that is
 *   correct.
 * - **The collision is neither hidden nor removed** (PD-007a). The
 *   household below has a real nut allergen restriction and the pesto
 *   recipe genuinely contains pine nuts, so it ranks last AND carries a
 *   "bevat noten" label. Both facts are on screen at once, deliberately —
 *   that pairing is the whole decision.
 *
 * ON ALLERGEN STATUS: every shared meal is `allergenTagStatus: 'unknown'`,
 * never `'verified'`, even though the tags below are populated. PD-010 is
 * explicit that a shared recipe carries no allergen verification across
 * households — someone else's "verified" is not evidence for your kitchen.
 * The asymmetry that makes this safe is PD-006's: a tag we hold is good
 * enough to state a *presence* ("bevat noten") and never good enough to
 * imply an *absence*, which is why nothing on this surface ever says a
 * recipe is clear.
 *
 * ON `householdId`: these meals belong to the *friends'* households, not
 * to the reader's. That is not decoration — it is the reason a friend's
 * card must never open cook mode (see RecipeTile's `onPress` header): the
 * reader's repository has no row for any of these ids.
 */

import type { FriendShare } from '@/components/friendFeedPresentation';
import type { Creator, FeedItem } from '@/domain/feed/types';
import type { Household, Meal, MealId, MealIngredient, MealStep, Member, Restriction } from '@/domain/types';

const FIXTURE_TIMESTAMP = '2026-08-01T09:00:00.000Z';

// ---------------------------------------------------------------------------
// The reading household — one nut allergy, a 30-minute weeknight budget
// ---------------------------------------------------------------------------

const FIXTURE_HOUSEHOLD: Household = {
  id: 'household-fixture',
  name: 'Thuis',
  timezone: 'Europe/Amsterdam',
  decisionPushTime: '16:00',
  weeknightTimeBudgetMinutes: 30,
  skillLevel: 'intermediate',
  createdAt: FIXTURE_TIMESTAMP,
};

const FIXTURE_MEMBERS: readonly Member[] = [
  {
    id: 'member-fixture-1',
    householdId: FIXTURE_HOUSEHOLD.id,
    displayName: 'Joost',
    authUserId: null,
    // PD-005: an allergen restriction may only exist for a member who has
    // given explicit health-data consent, so the fixture states it rather
    // than leaving a restriction dangling off an unconsented member.
    healthDataConsentAt: FIXTURE_TIMESTAMP,
    createdAt: FIXTURE_TIMESTAMP,
  },
  {
    id: 'member-fixture-2',
    householdId: FIXTURE_HOUSEHOLD.id,
    displayName: 'Emma',
    authUserId: null,
    healthDataConsentAt: null,
    createdAt: FIXTURE_TIMESTAMP,
  },
];

const FIXTURE_RESTRICTIONS: readonly Restriction[] = [
  {
    id: 'restriction-fixture-1',
    memberId: 'member-fixture-1',
    type: 'allergen',
    excludesTag: 'noten',
    notes: null,
    createdAt: FIXTURE_TIMESTAMP,
  },
];

// ---------------------------------------------------------------------------
// Creators — the people whose videos these recipes came out of (PD-007)
// ---------------------------------------------------------------------------

const FIXTURE_CREATORS: readonly Creator[] = [
  {
    id: 'creator-kees',
    handle: 'kokenmetkees',
    displayName: 'Koken met Kees',
    platform: 'tiktok',
    profileUrl: 'https://www.tiktok.com/@kokenmetkees',
    optedInAt: FIXTURE_TIMESTAMP,
    optedOutAt: null,
  },
  {
    id: 'creator-pauline',
    handle: 'plantaardigpauline',
    displayName: 'Plantaardig Pauline',
    platform: 'instagram',
    profileUrl: 'https://www.instagram.com/plantaardigpauline',
    optedInAt: FIXTURE_TIMESTAMP,
    optedOutAt: null,
  },
  {
    /**
     * Withdrew after opting in. PD-007 point 4 — "honoured immediately" —
     * so his post below never reaches a card, even though the share, the
     * recipe and the thumbnail all still exist in this fixture. Kept in
     * the data precisely so the gate has something real to remove.
     */
    id: 'creator-bram',
    handle: 'bakkerbram',
    displayName: 'Bakker Bram',
    platform: 'tiktok',
    profileUrl: 'https://www.tiktok.com/@bakkerbram',
    optedInAt: FIXTURE_TIMESTAMP,
    optedOutAt: '2026-08-20T18:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// The recipes themselves — owned by the friends' households, not by ours
// ---------------------------------------------------------------------------

type SharedMealFields = Pick<
  Meal,
  'id' | 'householdId' | 'title' | 'estimatedMinutes' | 'servings' | 'ingredientTags' | 'dishTags' | 'sourceUrl' | 'sourcePlatform' | 'thumbnailUrl'
>;

/** Every shared meal carries these same columns; only the recipe-specific fields above differ. */
function makeSharedMeal(fields: SharedMealFields): Meal {
  return {
    ...fields,
    source: 'saved',
    skillLevel: 'beginner',
    // See this file's header: never 'verified' across a household boundary.
    allergenTagStatus: 'unknown',
    archivedAt: null,
    createdAt: FIXTURE_TIMESTAMP,
  };
}

const FIXTURE_MEALS: readonly Meal[] = [
  makeSharedMeal({
    id: 'meal-friend-traybake',
    householdId: 'household-sanne',
    title: 'Traybake met kip, paprika en citroen',
    estimatedMinutes: 35,
    servings: 4,
    ingredientTags: ['gluten'],
    dishTags: ['ovenschotel'],
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/7412998877665',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/traybake-kip-citroen~tplv-thumb.jpg',
  }),
  makeSharedMeal({
    id: 'meal-friend-pesto',
    householdId: 'household-joris',
    title: 'Romige pasta pesto met pijnboompitten',
    estimatedMinutes: 20,
    servings: 2,
    // Pine nuts. The collision PD-007a exists for — this recipe is ranked
    // last AND labelled, and is never removed from the feed.
    ingredientTags: ['noten', 'melk', 'gluten'],
    dishTags: ['pasta', 'vegetarisch'],
    sourceUrl: 'https://www.instagram.com/p/CxPestoReel/',
    sourcePlatform: 'reels',
    // No thumbnail: Instagram oEmbed without credentials genuinely returns
    // none (src/lib/oembed.ts), so this exercises the monogram fallback on
    // a real failure mode rather than an invented one.
    thumbnailUrl: null,
  }),
  makeSharedMeal({
    id: 'meal-friend-ramen',
    householdId: 'household-sanne',
    title: 'Miso-ramen met zachtgekookt ei',
    estimatedMinutes: 25,
    servings: 2,
    ingredientTags: ['soja', 'gluten', 'eieren'],
    dishTags: ['soep'],
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/7413001122334',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/miso-ramen-ei~tplv-thumb.jpg',
  }),
  makeSharedMeal({
    id: 'meal-friend-focaccia',
    householdId: 'household-joris',
    title: 'Focaccia met rozemarijn en zeezout',
    estimatedMinutes: 90,
    servings: 6,
    ingredientTags: ['gluten'],
    dishTags: [],
    sourceUrl: 'https://www.tiktok.com/@bakkerbram/video/7410000111222',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/focaccia-rozemarijn~tplv-thumb.jpg',
  }),
];

function makeIngredients(
  mealId: MealId,
  entries: ReadonlyArray<readonly [name: string, quantity: string | null, unit: string | null]>,
): readonly MealIngredient[] {
  return entries.map(([name, quantity, unit], index) => ({
    id: `${mealId}-ing-${index}`,
    mealId,
    name,
    quantity,
    unit,
    allergenTags: [],
    sortOrder: index,
  }));
}

function makeSteps(mealId: MealId, instructions: readonly string[]): readonly MealStep[] {
  return instructions.map((instruction, index) => ({
    id: `${mealId}-step-${index}`,
    mealId,
    stepNumber: index + 1,
    instruction,
    durationMinutes: null,
  }));
}

const FIXTURE_INGREDIENTS: ReadonlyMap<MealId, readonly MealIngredient[]> = new Map([
  [
    'meal-friend-traybake',
    makeIngredients('meal-friend-traybake', [
      ['kipfilet', '400', 'g'],
      ['paprika', '2', null],
      ['citroen', '1', null],
      ['olijfolie', '2', 'el'],
      ['knoflook', '3', 'teentjes'],
    ]),
  ],
  [
    'meal-friend-pesto',
    makeIngredients('meal-friend-pesto', [
      ['pasta', '350', 'g'],
      ['groene pesto', '4', 'el'],
      ['roomkaas', '100', 'g'],
      ['pijnboompitten', '2', 'el'],
      ['parmezaanse kaas', '30', 'g'],
    ]),
  ],
  [
    'meal-friend-ramen',
    makeIngredients('meal-friend-ramen', [
      ['ramennoedels', '200', 'g'],
      ['misopasta', '2', 'el'],
      ['eieren', '2', null],
      ['lente-ui', '2', null],
    ]),
  ],
]);

/**
 * Note what is missing: `meal-friend-ramen` has ingredients but NO steps.
 * That is a real state, not an oversight — a caption that lists what goes
 * in and never says what to do with it is the single most common shape of
 * a half-readable recipe video, and the recipe screen has to say so
 * plainly instead of rendering an empty "Bereiding" heading.
 */
const FIXTURE_STEPS: ReadonlyMap<MealId, readonly MealStep[]> = new Map([
  [
    'meal-friend-traybake',
    makeSteps('meal-friend-traybake', [
      'Verwarm de oven voor op 200°C.',
      'Snijd de paprika in stukken en de citroen in partjes.',
      'Meng alles met de olijfolie, knoflook, zout en peper op een bakplaat.',
      'Bak 25-30 minuten tot de kip gaar is.',
    ]),
  ],
  [
    'meal-friend-pesto',
    makeSteps('meal-friend-pesto', [
      'Kook de pasta volgens de aanwijzingen op de verpakking.',
      'Rooster de pijnboompitten kort in een droge pan.',
      'Roer de pesto en roomkaas door de warme, uitgelekte pasta.',
      'Serveer met de parmezaan en pijnboompitten erover.',
    ]),
  ],
]);

// ---------------------------------------------------------------------------
// The posts, and who shared them
// ---------------------------------------------------------------------------

const FIXTURE_ITEMS: readonly FeedItem[] = [
  {
    id: 'feed-friend-1',
    creatorId: 'creator-kees',
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/7412998877665',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/traybake-kip-citroen~tplv-thumb.jpg',
    title: 'Traybake met kip, paprika en citroen',
    authorName: 'Koken met Kees',
    oembedFetchedAt: FIXTURE_TIMESTAMP,
    mealId: 'meal-friend-traybake',
    publishedAt: '2026-07-28T17:30:00.000Z',
    removedAt: null,
  },
  {
    id: 'feed-friend-2',
    creatorId: 'creator-pauline',
    sourceUrl: 'https://www.instagram.com/p/CxPestoReel/',
    sourcePlatform: 'instagram',
    thumbnailUrl: null,
    title: 'Romige pasta pesto met pijnboompitten',
    authorName: 'Plantaardig Pauline',
    oembedFetchedAt: FIXTURE_TIMESTAMP,
    mealId: 'meal-friend-pesto',
    publishedAt: '2026-08-03T11:15:00.000Z',
    removedAt: null,
  },
  {
    id: 'feed-friend-3',
    creatorId: 'creator-kees',
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/7413001122334',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/miso-ramen-ei~tplv-thumb.jpg',
    title: 'Miso-ramen met zachtgekookt ei',
    authorName: 'Koken met Kees',
    oembedFetchedAt: FIXTURE_TIMESTAMP,
    mealId: 'meal-friend-ramen',
    publishedAt: '2026-08-11T19:05:00.000Z',
    removedAt: null,
  },
  {
    /** Creator withdrew — removed by the PD-007 consent gate, never rendered. */
    id: 'feed-friend-4',
    creatorId: 'creator-bram',
    sourceUrl: 'https://www.tiktok.com/@bakkerbram/video/7410000111222',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/focaccia-rozemarijn~tplv-thumb.jpg',
    title: 'Focaccia met rozemarijn en zeezout',
    authorName: 'Bakker Bram',
    oembedFetchedAt: FIXTURE_TIMESTAMP,
    mealId: 'meal-friend-focaccia',
    publishedAt: '2026-07-19T08:40:00.000Z',
    removedAt: null,
  },
  {
    /** Not parsed into a recipe yet — no full recipe to open, so no card (PD-010). */
    id: 'feed-friend-5',
    creatorId: 'creator-kees',
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/7413555666777',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://p16-sign.tiktokcdn.com/onbekend~tplv-thumb.jpg',
    title: null,
    authorName: 'Koken met Kees',
    oembedFetchedAt: FIXTURE_TIMESTAMP,
    mealId: null,
    publishedAt: '2026-08-22T20:10:00.000Z',
    removedAt: null,
  },
];

const FIXTURE_SHARES: readonly FriendShare[] = [
  { feedItemId: 'feed-friend-1', friendName: 'Sanne', rating: 5 },
  { feedItemId: 'feed-friend-2', friendName: 'Joris', rating: 4 },
  // Never scored it. The card then shows a cook time and no score, rather
  // than a zero — an unanswered question is not a low opinion (PD-008).
  { feedItemId: 'feed-friend-3', friendName: 'Sanne', rating: null },
  { feedItemId: 'feed-friend-4', friendName: 'Joris', rating: 3 },
  { feedItemId: 'feed-friend-5', friendName: 'Sanne', rating: null },
];

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

/**
 * What the `__DEV__` row on the Vrienden tab switches between. Three
 * states, each genuinely hard to reach otherwise:
 *
 * - `gedeeld` — the normal feed, including the PD-007a collision.
 * - `zonder_allergie` — the SAME recipes, read by a household with no
 *   restrictions at all. Put beside `gedeeld`, it makes PD-006's point
 *   that a missing label says something about the *household*, never
 *   about the recipe: the pesto is unchanged, it simply stops being a
 *   collision for a household that never excluded nuts.
 * - `leeg` — nobody has shared anything yet, the honest first state for
 *   every new install.
 */
export type FriendFeedScenario = 'gedeeld' | 'zonder_allergie' | 'leeg';

export interface FriendFeedFixture {
  readonly household: Household;
  readonly members: readonly Member[];
  readonly restrictions: readonly Restriction[];
  readonly creators: readonly Creator[];
  readonly items: readonly FeedItem[];
  readonly meals: readonly Meal[];
  readonly ingredientsByMealId: ReadonlyMap<MealId, readonly MealIngredient[]>;
  readonly stepsByMealId: ReadonlyMap<MealId, readonly MealStep[]>;
  readonly shares: readonly FriendShare[];
}

const BASE_FIXTURE: FriendFeedFixture = {
  household: FIXTURE_HOUSEHOLD,
  members: FIXTURE_MEMBERS,
  restrictions: FIXTURE_RESTRICTIONS,
  creators: FIXTURE_CREATORS,
  items: FIXTURE_ITEMS,
  meals: FIXTURE_MEALS,
  ingredientsByMealId: FIXTURE_INGREDIENTS,
  stepsByMealId: FIXTURE_STEPS,
  shares: FIXTURE_SHARES,
};

/**
 * The fixture for one scenario. Every variant spreads `BASE_FIXTURE`
 * rather than mutating it — nothing in this module is ever changed in
 * place, so a screen re-reading a scenario always gets exactly what it
 * got the first time.
 */
export function getFriendFeedFixture(scenario: FriendFeedScenario): FriendFeedFixture {
  switch (scenario) {
    case 'gedeeld':
      return BASE_FIXTURE;
    case 'zonder_allergie':
      return { ...BASE_FIXTURE, restrictions: [] };
    case 'leeg':
      return { ...BASE_FIXTURE, items: [], shares: [] };
    default: {
      const exhaustiveCheck: never = scenario;
      throw new Error(`Unhandled FriendFeedScenario: ${String(exhaustiveCheck)}`);
    }
  }
}

/** What every non-`__DEV__` build renders, stated once so both Vrienden screens agree. */
export const DEFAULT_FRIEND_FEED_SCENARIO: FriendFeedScenario = 'gedeeld';

const KNOWN_SCENARIOS: ReadonlySet<string> = new Set<FriendFeedScenario>(['gedeeld', 'zonder_allergie', 'leeg']);

/**
 * Narrows a route param to a scenario, falling back to the default for
 * anything unrecognised.
 *
 * The feed passes its current scenario through to the recipe screen so a
 * `__DEV__` demo does not contradict itself — tap the pesto card while
 * "Zonder allergie" is selected and the recipe screen must agree that
 * nothing collides. That makes the value a *route param*, which makes it
 * untrusted input: a stale deep link, a hand-typed URL or a bookmark from
 * an older build can all arrive here. Falling back beats throwing, since
 * a bad demo param should never be able to red-screen the app; the
 * unreachable-`default` throw in `getFriendFeedFixture` above stays as a
 * compile-time exhaustiveness check for *code* paths, which is a
 * different job.
 */
export function parseFriendFeedScenario(raw: string | undefined): FriendFeedScenario {
  if (raw !== undefined && KNOWN_SCENARIOS.has(raw)) {
    return raw as FriendFeedScenario;
  }
  return DEFAULT_FRIEND_FEED_SCENARIO;
}

/**
 * Ranking's deterministic tie-break jitter is seeded from a target date
 * (src/domain/feed/ranking.ts), and a fixture screen has no real
 * "tonight". Pinning it keeps the demo feed in one stable order across
 * app restarts instead of quietly reshuffling at midnight, which would
 * look like a bug while screenshotting.
 */
export const FIXTURE_TARGET_DATE = '2026-08-25';

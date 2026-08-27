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
 *
 * TWO MODES, ONE SCENARIO SWITCH. The Vrienden tab holds `Gekookt` and
 * `Kring` (docs/DESIGN-SOCIAL.md §4.2) and the `__DEV__` row switches the
 * source for both at once, so every scenario below has a kring half as
 * well as a feed half — a scenario that demonstrated something in one
 * mode and left the other blank would make design work on the kring
 * impossible. The kring half deliberately reuses the same three dishes
 * and the same two friends: one demo describes one circle, seen two ways,
 * rather than two unrelated worlds behind one switch.
 *
 * WHY THE KRING HALF KEYS ON `RecipeId` AND THE FEED HALF ON `MealId`.
 * That is not an inconsistency to tidy up — it is the two-tier model. A
 * kring row ranks the canonical `recipes` row twenty households hold a
 * copy of; a feed card opens a specific household's `meals` copy. The
 * fixture keeps both ids and derives the kring row's title, thumbnail and
 * tags from the matching meal, so the two views cannot drift into
 * disagreeing about what a dish is called.
 */

import type { FriendShare } from '@/components/friendFeedPresentation';
import type { KringRecipe, KringRequest } from '@/components/kringPresentation';
import { collectExcludedTags } from '@/domain/exclusions';
import type { Creator, CreatorPlatform, FeedItem } from '@/domain/feed/types';
import type { ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';
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

export const FIXTURE_MEALS: readonly Meal[] = [
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

export const FIXTURE_INGREDIENTS: ReadonlyMap<MealId, readonly MealIngredient[]> = new Map([
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

/**
 * The notes are deliberately uneven, for the same reason the rest of this
 * module is: a real list is not three tidy cards.
 *
 * One send carries a short note, two carry none, and one carries a note
 * near the full 140 (`SEND_NOTE_MAX_LENGTH`) so the card's longest
 * realistic state can be looked at rather than imagined. §1 calls a note
 * "a post-it on a pan lid, not the opening of a chat", and the way to keep
 * that honest in design work is to see the longest post-it the schema
 * allows sitting on a real card at 200% Dynamic Type.
 *
 * `null` is a first-class case here, not a gap to fill in later. §4.1's
 * input is optional and its placeholder says so, `normalizeSendNote`
 * collapses a whitespace-only note to null at the repository boundary,
 * and a null note must render NOTHING — no empty rule, no placeholder,
 * no "geen bericht".
 */
const FIXTURE_SHARES: readonly FriendShare[] = [
  { feedItemId: 'feed-friend-1', friendName: 'Sanne', rating: 5, note: 'die citroen aan het eind niet overslaan' },
  // No note. The most common send, and the one that proves the left rule
  // disappears with the words rather than leaving a stub behind.
  { feedItemId: 'feed-friend-2', friendName: 'Joris', rating: 4, note: null },
  // Never scored it. The card then shows a cook time and no score, rather
  // than a zero — an unanswered question is not a low opinion (PD-008).
  // The long note rides on this one so the two awkward cases land on one
  // card, which is where a layout actually breaks.
  {
    feedItemId: 'feed-friend-3',
    friendName: 'Sanne',
    rating: null,
    note: 'ik heb de helft van de bouillon vervangen door kokosmelk en er limoen over gedaan, veel lekkerder dan het origineel',
  },
  { feedItemId: 'feed-friend-4', friendName: 'Joris', rating: 3, note: null },
  { feedItemId: 'feed-friend-5', friendName: 'Sanne', rating: null, note: null },
];

/**
 * Which of the fixture sends have not been looked at (PD-020.1).
 *
 * KEYED ON MEAL IDS, NOT ON FEED ITEMS, because that is what the real
 * thing is keyed on: "unseen" is a fact about a `recipe_shares` row and
 * `recipe_shares.meal_id` identifies the dish.
 * `collectUnseenSendMealIds` (gekooktPresentation.ts) produces exactly
 * this shape from a live `listSendsToMe`, so the fixture and the live path
 * hand the band the same kind of set rather than two shapes somebody has
 * to keep in step.
 *
 * ONE, not several, and deliberately not the top-ranked card. The band is
 * only visible as a band when it MOVES something: a single unseen send
 * that `rankFeedItems` had placed lower jumps to the top, and that jump is
 * the whole design being demonstrated. Marking everything unseen would
 * produce a list identical to the ranked one, with a stagger running down
 * the entire screen — precisely the "everything here is new" claim §8
 * refuses.
 *
 * NOTHING HERE IS EVER A PROOF RECIPE, and structurally cannot be: a proof
 * card carries no meal id to put in this set. See `orderGekooktList`.
 */
const FIXTURE_UNSEEN_SEND_MEAL_IDS: ReadonlySet<MealId> = new Set(['meal-friend-pesto']);

// ---------------------------------------------------------------------------
// De kring — the same circle, ranked by what it scored (DESIGN-SOCIAL §2.2)
// ---------------------------------------------------------------------------

/**
 * The two friends, as *profiles* rather than as the bare display names
 * the feed's `FriendShare` carries.
 *
 * A kring vote is cast by a person who exists outside any household
 * (src/domain/social/types.ts on why `profiles` is not
 * `household_members`), so the fixture has to hold an id per voter — the
 * meta line resolves ids to names, and a nameless voter falls back to a
 * count rather than disappearing. Same two people as the feed half, so
 * "Sanne" means one person across both modes.
 */
export const FIXTURE_VOTER_NAMES: ReadonlyMap<ProfileId, string> = new Map([
  ['profile-sanne', 'Sanne'],
  ['profile-joris', 'Joris'],
]);

/**
 * A canonical recipe as the kring renders it, derived from the meal of
 * the same dish.
 *
 * Deriving rather than restating is the point: title, thumbnail and tags
 * come from `FIXTURE_MEALS`, so the pesto cannot end up called one thing
 * in `Gekookt` and another in `Kring`. Throwing on an unknown id is a
 * typo guard for this module only — nothing outside it can reach this
 * function.
 */
function makeKringRecipe(
  recipeId: RecipeId,
  mealId: MealId,
  creatorHandle: string,
  creatorPlatform: CreatorPlatform,
): KringRecipe {
  const meal = FIXTURE_MEALS.find((candidate) => candidate.id === mealId);
  if (meal === undefined) {
    throw new Error(`Kring fixture references an unknown meal: ${mealId}`);
  }
  return {
    recipeId,
    title: meal.title,
    creatorHandle,
    creatorPlatform,
    thumbnailUrl: meal.thumbnailUrl,
    // PD-006 tri-state: these are the tags we hold, good enough to state a
    // presence and never good enough to imply an absence. A canonical
    // `recipes` row carries none of these in production (see the Vrienden
    // screen's header) — the fixture populates them so the collision chip
    // has something real to fire on while designing.
    allergenTags: meal.ingredientTags,
  };
}

const FIXTURE_KRING_RECIPES: readonly KringRecipe[] = [
  makeKringRecipe('recipe-friend-traybake', 'meal-friend-traybake', 'kokenmetkees', 'tiktok'),
  makeKringRecipe('recipe-friend-ramen', 'meal-friend-ramen', 'kokenmetkees', 'tiktok'),
  makeKringRecipe('recipe-friend-pesto', 'meal-friend-pesto', 'plantaardigpauline', 'instagram'),
];

/**
 * What the circle actually scored, on src/domain/rating.ts's 1-10 scale.
 *
 * Chosen to make three separate rules visible at once rather than to look
 * plausible:
 *
 * - **Two voters and one voter both produce a row.** The ramen rests on
 *   Sanne's single vote, because `KRING_MIN_VOTES` is 1 and a fixture
 *   where everything had two votes could not show that.
 * - **No two averages are equal**, so the demo shows 1-2-3 rather than
 *   the competition-ranking tie the kring also handles. A tie is real
 *   behaviour but it reads as a bug in a screenshot.
 * - **The colliding dish is not last because it collides.** The pesto
 *   sits third because 7,5 is the lowest grade here. `rankKring` applies
 *   no collision penalty at all — unlike the feed, which demotes — and a
 *   demo that put the chip on the bottom row *by construction* would
 *   teach the wrong rule.
 *
 * `ratedAt` is data and never copy: nothing on either mode of this tab
 * renders a date, and DESIGN-SOCIAL §2.2 forbids one outright.
 */
export const FIXTURE_KRING_VOTES: readonly RecipeRating[] = [
  {
    id: 'rating-fixture-1',
    recipeId: 'recipe-friend-traybake',
    raterProfileId: 'profile-sanne',
    rating: 9,
    ratedAt: FIXTURE_TIMESTAMP,
  },
  {
    id: 'rating-fixture-2',
    recipeId: 'recipe-friend-traybake',
    raterProfileId: 'profile-joris',
    rating: 8,
    ratedAt: FIXTURE_TIMESTAMP,
  },
  {
    id: 'rating-fixture-3',
    recipeId: 'recipe-friend-ramen',
    raterProfileId: 'profile-sanne',
    rating: 8,
    ratedAt: FIXTURE_TIMESTAMP,
  },
  {
    id: 'rating-fixture-4',
    recipeId: 'recipe-friend-pesto',
    raterProfileId: 'profile-joris',
    rating: 8,
    ratedAt: FIXTURE_TIMESTAMP,
  },
  {
    id: 'rating-fixture-5',
    recipeId: 'recipe-friend-pesto',
    raterProfileId: 'profile-sanne',
    rating: 7,
    ratedAt: FIXTURE_TIMESTAMP,
  },
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
 *
 * Each one switches BOTH modes of the tab at once; `getKringFixture`
 * below is the kring half of the same three states.
 */
export type FriendFeedScenario = 'gedeeld' | 'zonder_allergie' | 'leeg';

/**
 * The scenarios, in the order the `__DEV__` row offers them. Exported so
 * that row and `KNOWN_SCENARIOS` below read from one list — mirrors
 * `BOARD_SCENARIOS` in src/app/ranglijst/_fixtures.ts, so both list tabs
 * offer their demo sources the same way.
 */
export const FRIEND_FEED_SCENARIOS: readonly FriendFeedScenario[] = ['gedeeld', 'zonder_allergie', 'leeg'];

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

/**
 * The kring half of one scenario — the same circle, ranked by what it
 * scored rather than listed by what it cooked.
 *
 * The excluded tags are DERIVED from the same household and restrictions
 * the feed half uses, never restated. That is what makes
 * `zonder_allergie` mean one thing in both modes: dropping the household's
 * restriction removes the chip from the feed card and from the kring row
 * in the same edit, and nobody has to remember to keep two lists of
 * allergens in step. `collectExcludedTags` is the same function
 * `assembleFriendFeed` reaches through `rankFeedItems`, so the two modes
 * cannot disagree about what the household excludes.
 *
 * Spreads rather than mutates, exactly as `getFriendFeedFixture` does:
 * re-reading a scenario always returns what it returned the first time.
 */
export function getKringFixture(scenario: FriendFeedScenario): KringRequest {
  const feed = getFriendFeedFixture(scenario);
  return {
    // `leeg` has no shares and no votes: an empty circle is the honest
    // first state here too, and it is what makes the kring's own empty
    // state reachable on device.
    votes: scenario === 'leeg' ? [] : FIXTURE_KRING_VOTES,
    recipes: FIXTURE_KRING_RECIPES,
    voterNames: FIXTURE_VOTER_NAMES,
    excludedAllergenTags: [...collectExcludedTags(feed.members, feed.restrictions)],
  };
}

/**
 * The unseen half of one scenario (PD-020.1) — which sends this demo
 * treats as not yet looked at.
 *
 * A SEPARATE FUNCTION RATHER THAN A FIELD ON `FriendFeedFixture`, and the
 * reason is the same one that keeps it off the card model: unseen is a
 * fact about a `recipe_shares` row, not about a dish or a feed item. The
 * live screen gets it from `listSendsToMe` — a different read from the one
 * that produces the cards — so a fixture that bundled the two into one
 * object would be modelling a join the real path does not have.
 *
 * `leeg` has no shares, so nothing can be unseen there; the empty state is
 * reachable with the tab count at zero, which is the honest pairing. The
 * other two scenarios share one unseen send, so flipping between them
 * changes the collision label and nothing else.
 */
export function getUnseenSendMealIds(scenario: FriendFeedScenario): ReadonlySet<MealId> {
  return scenario === 'leeg' ? new Set() : FIXTURE_UNSEEN_SEND_MEAL_IDS;
}

/** What every non-`__DEV__` build renders, stated once so both Vrienden screens agree. */
export const DEFAULT_FRIEND_FEED_SCENARIO: FriendFeedScenario = 'gedeeld';

const KNOWN_SCENARIOS: ReadonlySet<string> = new Set<FriendFeedScenario>(FRIEND_FEED_SCENARIOS);

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

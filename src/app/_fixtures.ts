/**
 * FIXTURE DATA — NOT REAL.
 *
 * There is no backend wired up yet (see docs/ARCHITECTURE.md — the Edge
 * Functions and RLS-backed queries are Phase 1 infrastructure owned by
 * other agents working on this repo concurrently). Every screen under
 * src/app renders against these fixtures so the app is demoable on device
 * today. Swapping this module for real Supabase queries later is meant to
 * be mechanical: every exported constant/function here has the exact
 * shape a repository/hook would return, typed strictly against
 * src/domain/types.ts.
 *
 * Nothing in src/domain or src/lib imports this file — fixtures flow one
 * direction, into screens only. Do not import Supabase or any I/O client
 * here; this module is pure data.
 */

import type {
  CookEvent,
  Decision,
  DecisionResult,
  Household,
  Meal,
  MealStep,
  Member,
  Restriction,
} from '@/domain/types';
import { filterServableFeedItems } from '@/domain/feed/eligibility';
import { getCollidingTagsByFeedItem, rankFeedItems } from '@/domain/feed/ranking';
import type { FeedRankingRequest } from '@/domain/feed/ranking';
import type { Creator, FeedItem, FeedItemId } from '@/domain/feed/types';

// ---------------------------------------------------------------------------
// Household, members, restrictions
// ---------------------------------------------------------------------------

export const fixtureHousehold: Household = {
  id: 'household-1',
  name: 'Huishouden De Groot',
  timezone: 'Europe/Amsterdam',
  decisionPushTime: '16:00',
  weeknightTimeBudgetMinutes: 30,
  skillLevel: 'intermediate',
  createdAt: '2026-06-01T08:00:00.000Z',
};

export const fixtureMembers: readonly Member[] = [
  {
    id: 'member-1',
    householdId: 'household-1',
    displayName: 'Sanne',
    authUserId: 'auth-1',
    healthDataConsentAt: '2026-06-01T08:05:00.000Z',
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'member-2',
    householdId: 'household-1',
    displayName: 'Joost',
    authUserId: null,
    healthDataConsentAt: null,
    createdAt: '2026-06-01T08:00:00.000Z',
  },
];

export const fixtureRestrictions: readonly Restriction[] = [
  {
    id: 'restriction-1',
    memberId: 'member-1',
    type: 'dislike',
    excludesTag: 'paddenstoelen',
    notes: null,
    createdAt: '2026-06-01T08:10:00.000Z',
  },
  {
    id: 'restriction-2',
    memberId: 'member-1',
    type: 'allergen',
    excludesTag: 'noten',
    notes: null,
    createdAt: '2026-06-01T08:11:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

/**
 * `Meal` (src/domain/types.ts) has no image/photo field, so every screen
 * that would otherwise show a thumbnail omits it entirely, per
 * docs/DESIGN.md's own instruction to "omit entirely rather than show a
 * placeholder/stock image."
 */
export const fixtureMeals: readonly Meal[] = [
  {
    id: 'meal-1',
    householdId: 'household-1',
    title: 'Kip kerrie met rijst',
    source: 'seeded',
    estimatedMinutes: 25,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: ['kip', 'rijst', 'kerrie'],
    sourceUrl: null,
    sourcePlatform: null,
    archivedAt: null,
    createdAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'meal-2',
    householdId: 'household-1',
    title: 'Pasta pesto',
    source: 'seeded',
    estimatedMinutes: 20,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: ['pasta', 'pesto', 'noten'],
    sourceUrl: null,
    sourcePlatform: null,
    archivedAt: null,
    createdAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'meal-3',
    householdId: null,
    title: 'Traybake met kip en citroen',
    source: 'curated',
    estimatedMinutes: 40,
    skillLevel: 'intermediate',
    servings: 4,
    ingredientTags: ['kip', 'citroen', 'aardappel'],
    sourceUrl: 'https://www.tiktok.com/@voorbeeldkok/video/000001',
    sourcePlatform: 'tiktok',
    archivedAt: null,
    createdAt: '2026-06-05T09:00:00.000Z',
  },
  {
    id: 'meal-4',
    householdId: 'household-1',
    title: 'Stamppot boerenkool',
    source: 'seeded',
    estimatedMinutes: 35,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: ['aardappel', 'boerenkool', 'worst'],
    sourceUrl: null,
    sourcePlatform: null,
    archivedAt: null,
    createdAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'meal-5',
    householdId: 'household-1',
    title: 'Wraps met gehakt',
    source: 'seeded',
    estimatedMinutes: 20,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: ['gehakt', 'tortilla'],
    sourceUrl: null,
    sourcePlatform: null,
    archivedAt: null,
    createdAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'meal-6',
    householdId: null,
    title: 'Linzensoep met komijn',
    source: 'curated',
    estimatedMinutes: 30,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: ['linzen', 'komijn'],
    sourceUrl: 'https://www.instagram.com/reel/voorbeeld002',
    sourcePlatform: 'reels',
    archivedAt: null,
    createdAt: '2026-06-05T09:00:00.000Z',
  },
];

export function getMealById(mealId: string): Meal | undefined {
  return fixtureMeals.find((meal) => meal.id === mealId);
}

// ---------------------------------------------------------------------------
// Feed (F) — creators and their opted-in content (PD-007)
//
// Field names/types mirror src/domain/feed/types.ts's `Creator`/`FeedItem`
// exactly (owned by another agent working on this repo concurrently, not
// edited here) so swapping these fixtures for a real Supabase-backed query
// later is mechanical: same shape in, nothing in src/components changes.
// ---------------------------------------------------------------------------

export const fixtureFeedCreators: readonly Creator[] = [
  {
    id: 'creator-1',
    handle: 'kokenmetkees',
    displayName: 'Kees Kookt',
    platform: 'tiktok',
    profileUrl: 'https://www.tiktok.com/@kokenmetkees',
    optedInAt: '2026-06-10T09:00:00.000Z',
    optedOutAt: null,
  },
  {
    id: 'creator-2',
    handle: 'plantaardigpauline',
    displayName: 'Plantaardig met Pauline',
    platform: 'instagram',
    profileUrl: 'https://www.instagram.com/plantaardigpauline',
    optedInAt: '2026-06-18T09:00:00.000Z',
    optedOutAt: null,
  },
  {
    id: 'creator-3',
    handle: 'ovenbakkers',
    displayName: 'De Ovenbakkers',
    platform: 'tiktok',
    profileUrl: 'https://www.tiktok.com/@ovenbakkers',
    optedInAt: '2026-07-02T09:00:00.000Z',
    optedOutAt: null,
  },
  {
    // Demonstrates PD-007.4 ("one-tap opt-out, honoured immediately")
    // through the real eligibility gate below, not a UI-side guess: this
    // creator's item must never reach fixtureFeedItems even though the
    // row itself still exists.
    id: 'creator-4',
    handle: 'oudeaccount',
    displayName: 'Oud account',
    platform: 'tiktok',
    profileUrl: 'https://www.tiktok.com/@oudeaccount',
    optedInAt: '2026-05-01T09:00:00.000Z',
    optedOutAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'creator-5',
    handle: 'snellepastas',
    displayName: 'Snelle Pasta Keuken',
    platform: 'tiktok',
    profileUrl: 'https://www.tiktok.com/@snellepastas',
    optedInAt: '2026-07-15T09:00:00.000Z',
    optedOutAt: null,
  },
];

export function getFeedCreatorById(creatorId: string): Creator | undefined {
  return fixtureFeedCreators.find((creator) => creator.id === creatorId);
}

/**
 * Raw feed items, BEFORE the eligibility gate — includes `feed-4`, which
 * belongs to an opted-out creator, on purpose (see fixtureFeedCreators
 * above). Nothing in the UI should ever read this constant directly; it
 * exists so `fixtureFeedItems` below can prove the real filter removes it.
 */
const fixtureFeedItemsRaw: readonly FeedItem[] = [
  {
    id: 'feed-1',
    creatorId: 'creator-1',
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/000001',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://picsum.photos/seed/remy-traybake-kip-citroen/720/1280',
    title: 'Traybake met kip en citroen',
    authorName: 'kokenmetkees',
    oembedFetchedAt: '2026-08-20T07:00:00.000Z',
    mealId: 'meal-3',
    publishedAt: '2026-08-18T18:00:00.000Z',
    removedAt: null,
  },
  {
    id: 'feed-2',
    creatorId: 'creator-2',
    sourceUrl: 'https://www.instagram.com/reel/voorbeeld002',
    sourcePlatform: 'instagram',
    // Honest degraded state (task requirement 4): Instagram oEmbed needs
    // an approved Facebook App (src/lib/oembed.ts's `instagramAccessToken`
    // config) — when it isn't set, resolution fails `missing_credentials`
    // before any network call, so this stays null rather than a fake
    // placeholder image.
    thumbnailUrl: null,
    title: 'Linzensoep met komijn',
    authorName: null,
    oembedFetchedAt: null,
    mealId: 'meal-6',
    publishedAt: '2026-08-15T12:00:00.000Z',
    removedAt: null,
  },
  {
    id: 'feed-3',
    creatorId: 'creator-3',
    sourceUrl: 'https://www.tiktok.com/@ovenbakkers/video/000002',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://picsum.photos/seed/remy-kikkererwtencurry/720/1280',
    // Not yet parsed into a structured Meal — mealId is null, title comes
    // straight from oEmbed. The card must stay fully usable without it.
    title: 'Kikkererwtencurry uit één pan',
    authorName: 'ovenbakkers',
    oembedFetchedAt: '2026-08-21T07:00:00.000Z',
    mealId: null,
    publishedAt: '2026-08-19T18:00:00.000Z',
    removedAt: null,
  },
  {
    id: 'feed-4',
    creatorId: 'creator-4',
    sourceUrl: 'https://www.tiktok.com/@oudeaccount/video/000003',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://picsum.photos/seed/remy-oud-account/720/1280',
    title: 'Oude video',
    authorName: 'oudeaccount',
    oembedFetchedAt: '2026-07-01T07:00:00.000Z',
    mealId: null,
    publishedAt: '2026-06-01T18:00:00.000Z',
    removedAt: null,
  },
  {
    // PD-007a demo: `meal-2` ("Pasta pesto")'s ingredientTags include
    // 'noten', which collides with fixtureRestrictions' allergen entry
    // ('noten', member-1). This item is expected to (a) rank below the
    // non-colliding items via src/domain/feed/ranking.ts's
    // RESTRICTION_COLLISION_WEIGHT and (b) still be servable and visibly
    // labelled on its card, per PD-007a's "rank down AND label, do not
    // hide" — never filtered out.
    id: 'feed-5',
    creatorId: 'creator-5',
    sourceUrl: 'https://www.tiktok.com/@snellepastas/video/000004',
    sourcePlatform: 'tiktok',
    thumbnailUrl: 'https://picsum.photos/seed/remy-pasta-pesto-noten/720/1280',
    title: 'Romige pastapesto met pijnboompitten',
    authorName: 'snellepastas',
    oembedFetchedAt: '2026-08-22T07:00:00.000Z',
    mealId: 'meal-2',
    publishedAt: '2026-08-20T18:00:00.000Z',
    removedAt: null,
  },
];

const fixtureFeedCreatorsById = new Map(fixtureFeedCreators.map((creator) => [creator.id, creator] as const));
const fixtureMealsById = new Map(fixtureMeals.map((meal) => [meal.id, meal] as const));

/**
 * Built once and reused by both calls below so `fixtureFeedItems` and
 * `fixtureFeedCollidingTagsByItemId` are guaranteed to agree on the exact
 * same servable items/household/target date — two independent requests
 * that happened to diverge would reintroduce the exact drift PD-007a
 * exists to prevent (see ranking.ts's file header on why the two calls
 * are additive/separate in the first place, rather than one combined
 * return shape).
 */
const feedRankingRequest: FeedRankingRequest = {
  household: fixtureHousehold,
  members: fixtureMembers,
  restrictions: fixtureRestrictions,
  items: filterServableFeedItems(fixtureFeedItemsRaw, fixtureFeedCreatorsById),
  mealsById: fixtureMealsById,
  targetDate: '2026-08-22',
};

/**
 * The Feed screen's actual data source: `fixtureFeedItemsRaw` run through
 * the real eligibility gate (src/domain/feed/eligibility.ts) exactly as a
 * live Supabase-backed repository would — `feed-4` (an opted-out creator)
 * never survives this, even though it's listed above. Ranking
 * (src/domain/feed/ranking.ts) then orders what's left for cookability
 * (PD-004: save-to-cook, never dwell time), not engagement.
 */
export const fixtureFeedItems: readonly FeedItem[] = rankFeedItems(feedRankingRequest);

/**
 * PD-007a: which of each servable feed item's linked meal's tags collide
 * with the fixture household's restrictions, keyed by feed item id — the
 * same `feedRankingRequest` that produced `fixtureFeedItems`' order, so a
 * card's "Bevat noten" label can never say something different from what
 * already ranked it down. Missing from the map, or mapped to `[]`, means
 * "no collision found OR no linked meal to check" — see
 * src/domain/feed/ranking.ts's file header on why a caller that cares
 * about that distinction must check `item.mealId` separately.
 */
export const fixtureFeedCollidingTagsByItemId: ReadonlyMap<FeedItemId, readonly string[]> =
  getCollidingTagsByFeedItem(feedRankingRequest);

// ---------------------------------------------------------------------------
// Meal steps (Cook Mode)
// ---------------------------------------------------------------------------

export const fixtureMealSteps: Readonly<Record<string, readonly MealStep[]>> = {
  'meal-1': [
    { id: 'meal-1-step-1', mealId: 'meal-1', stepNumber: 1, instruction: 'Snijd de ui en knoflook fijn.', durationMinutes: null },
    {
      id: 'meal-1-step-2',
      mealId: 'meal-1',
      stepNumber: 2,
      instruction: 'Bak de ui glazig op middelhoog vuur, ca. 4 minuten. Roer regelmatig.',
      durationMinutes: 4,
    },
    {
      id: 'meal-1-step-3',
      mealId: 'meal-1',
      stepNumber: 3,
      instruction: 'Voeg de kerriepasta toe en bak 1 minuut mee tot het geurt.',
      durationMinutes: 1,
    },
    {
      id: 'meal-1-step-4',
      mealId: 'meal-1',
      stepNumber: 4,
      instruction: 'Snijd de kip in blokjes en voeg toe aan de pan. Bak rondom bruin.',
      durationMinutes: 5,
    },
    {
      id: 'meal-1-step-5',
      mealId: 'meal-1',
      stepNumber: 5,
      instruction: 'Blus af met kokosmelk, breng aan de kook en laat 10 minuten zachtjes sudderen.',
      durationMinutes: 10,
    },
    {
      id: 'meal-1-step-6',
      mealId: 'meal-1',
      stepNumber: 6,
      instruction: 'Kook ondertussen de rijst volgens de verpakking.',
      durationMinutes: 12,
    },
    {
      id: 'meal-1-step-7',
      mealId: 'meal-1',
      stepNumber: 7,
      instruction: 'Breng op smaak met zout en peper. Serveer de kerrie over de rijst.',
      durationMinutes: null,
    },
  ],
};

export function getMealStepsById(mealId: string): readonly MealStep[] {
  return fixtureMealSteps[mealId] ?? [];
}

// ---------------------------------------------------------------------------
// Vanavond decision session
//
// Simulates what src/domain/decide.ts (owned by another agent, not
// imported here) would return across one evening's "Iets anders" taps:
// index 0 is the original offer (alternativesRemaining: 2), index 1 the
// first swap (1), index 2 the second and final swap (0). This is fixture
// sequencing only — no decision logic lives here.
// ---------------------------------------------------------------------------

// T3: typed as a non-empty tuple (not `readonly DecisionResult[]`) so
// `fixtureDecisionSession[0]` is provably defined at the type level —
// the call site in src/app/(tabs)/index.tsx previously needed a `!` to
// paper over this.
export const fixtureDecisionSession: readonly [DecisionResult, ...DecisionResult[]] = [
  {
    kind: 'suggestion',
    mealId: 'meal-1',
    reasonCode: 'not_recent',
    reasonText: 'Je at dit al 3 weken niet, en het past binnen 25 minuten.',
    alternativesRemaining: 2,
  },
  {
    kind: 'suggestion',
    mealId: 'meal-2',
    reasonCode: 'fits_time',
    reasonText: 'Snel klaar en alle ingrediënten heb je waarschijnlijk al in huis.',
    alternativesRemaining: 1,
  },
  {
    kind: 'suggestion',
    mealId: 'meal-4',
    reasonCode: 'household_favourite',
    reasonText: 'Dit kookt dit huishouden vaker dan gemiddeld.',
    alternativesRemaining: 0,
  },
];

/** Standalone `no_candidate` scenarios, one per reason, for demoing each state. */
export const fixtureNoCandidateEmptyRotation: DecisionResult = {
  kind: 'no_candidate',
  reason: 'empty_rotation',
};

export const fixtureNoCandidateAllExcluded: DecisionResult = {
  kind: 'no_candidate',
  reason: 'all_excluded',
};

export const fixtureNoCandidateSwapsExhausted: DecisionResult = {
  kind: 'no_candidate',
  reason: 'swaps_exhausted',
};

// ---------------------------------------------------------------------------
// Outcome capture (PD-003)
// ---------------------------------------------------------------------------

/**
 * Yesterday's accepted decision with no recorded outcome yet — models
 * PD-003's second earned surface ("on next app open, if a decision was
 * accepted and no outcome was recorded"). Vanavond checks this on mount.
 */
export const fixturePendingOutcomeDecision: Decision | null = {
  id: 'decision-yesterday',
  householdId: 'household-1',
  decisionDate: '2026-08-21',
  mealId: 'meal-5',
  initialMealId: 'meal-5',
  reasonCode: 'variety',
  reasonText: 'Iets anders dan de afgelopen weken.',
  status: 'accepted',
  declineReason: null,
  createdAt: '2026-08-21T16:00:00.000Z',
  respondedAt: '2026-08-21T16:04:00.000Z',
};

export const fixtureCookEvents: readonly CookEvent[] = [];

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
  Save,
} from '@/domain/types';

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
  /**
   * Demonstrates the outcome of the import flow (src/app/import/**):
   * `source: 'saved'`, a `sourceUrl`/`sourcePlatform` pointing back at the
   * original post, and — per PD-006 — `allergenTagStatus: 'verified'`
   * because this one was confirmed on the import confirmation screen
   * (src/app/import/confirm.tsx) before saving, unlike a seeded
   * title-only meal which always starts 'unknown'.
   */
  {
    id: 'meal-7',
    householdId: 'household-1',
    title: 'Traybake met gehaktballen en paprika',
    source: 'saved',
    estimatedMinutes: 35,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: ['gehakt', 'paprika', 'ui'],
    allergenTagStatus: 'verified',
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/000005',
    sourcePlatform: 'tiktok',
    archivedAt: null,
    createdAt: '2026-08-21T19:00:00.000Z',
  },
];

export function getMealById(mealId: string): Meal | undefined {
  return fixtureMeals.find((meal) => meal.id === mealId);
}

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

/**
 * `meal-4` (Stamppot boerenkool) was cooked once already — the "al
 * gekookt" demo case for "Mijn recepten" (src/app/(tabs)/recipes.tsx).
 * `wouldRepeat: true` mirrors OutcomeCard's "Ja, graag" answer.
 */
export const fixtureCookEvents: readonly CookEvent[] = [
  {
    id: 'cook-event-1',
    householdId: 'household-1',
    mealId: 'meal-4',
    decisionId: null,
    cookedOn: '2026-08-10',
    wouldRepeat: true,
    createdAt: '2026-08-10T19:30:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Saves — scheduling intent per meal (PD-004's "when?" prompt)
//
// "Mijn recepten" (src/app/(tabs)/recipes.tsx) reads these, together with
// fixtureCookEvents above, to show each recipe's real scheduling state
// (deze week / ooit / al gekookt) rather than a flat archive — see
// src/components/recipeScheduling.ts for the precedence rule (cooked beats
// an active save, "this_week" beats "someday").
// ---------------------------------------------------------------------------

export const fixtureSaves: readonly Save[] = [
  {
    id: 'save-1',
    householdId: 'household-1',
    memberId: 'member-1',
    mealId: 'meal-1',
    intent: 'this_week',
    sourceUrl: null,
    savedAt: '2026-08-19T08:00:00.000Z',
  },
  {
    // The meal-7 import-flow demo (see fixtureMeals above): saved with
    // "Deze week" on the SaveIntentSheet at the end of the import flow.
    id: 'save-2',
    householdId: 'household-1',
    memberId: 'member-2',
    mealId: 'meal-7',
    intent: 'this_week',
    sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/000005',
    savedAt: '2026-08-21T19:05:00.000Z',
  },
  {
    id: 'save-3',
    householdId: 'household-1',
    memberId: 'member-1',
    mealId: 'meal-5',
    intent: 'someday',
    sourceUrl: null,
    savedAt: '2026-08-05T20:00:00.000Z',
  },
];

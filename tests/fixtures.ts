/**
 * Test data builders for the decision engine's test suite.
 *
 * Each `makeX` returns a fully-populated, valid `X` with sensible
 * defaults, overridable via a partial. Tests should only specify the
 * fields that matter to the behaviour under test — everything else stays
 * out of the way. Nothing here is shared mutable state between calls;
 * every invocation returns a fresh object.
 */

import type { DecisionRequestWithProof } from '@/domain/decide';
import type {
  CookEvent,
  Decision,
  DecisionFilters,
  Household,
  Meal,
  Member,
  Restriction,
  Save,
} from '@/domain/types';
import { NO_DECISION_FILTERS } from '@/domain/exclusions';

const DEFAULT_CREATED_AT = '2026-01-01T00:00:00.000Z';

export function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: 'household-1',
    name: 'Test Household',
    timezone: 'Europe/Amsterdam',
    decisionPushTime: '16:00',
    weeknightTimeBudgetMinutes: 30,
    skillLevel: 'intermediate',
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

export function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    householdId: 'household-1',
    displayName: 'Test Member',
    authUserId: null,
    healthDataConsentAt: DEFAULT_CREATED_AT,
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

export function makeRestriction(overrides: Partial<Restriction> = {}): Restriction {
  return {
    id: 'restriction-1',
    memberId: 'member-1',
    type: 'allergen',
    excludesTag: 'peanuts',
    notes: null,
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

export function makeMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'meal-1',
    householdId: 'household-1',
    title: 'Test Meal',
    source: 'seeded',
    estimatedMinutes: 20,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: [],
    // Defaults to 'verified' (not PD-006's real-world 'unknown' default)
    // so every pre-existing test exercising tag-matching logic keeps
    // testing exactly that, unaffected by the tri-state gate. Tests that
    // target the gate itself (see exclusions.test.ts) override this
    // explicitly to 'unknown'.
    allergenTagStatus: 'verified',
    // Empty by default, unlike `allergenTagStatus` above: a dish category
    // never gates anything, so no existing suite depends on one being
    // present. Tests about categories set them explicitly.
    dishTags: [],
    sourceUrl: null,
    sourcePlatform: null,
    thumbnailUrl: null,
    archivedAt: null,
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

export function makeCookEvent(overrides: Partial<CookEvent> = {}): CookEvent {
  return {
    id: 'cook-event-1',
    householdId: 'household-1',
    mealId: 'meal-1',
    decisionId: null,
    cookedOn: '2026-01-01',
    wouldRepeat: null,
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

export function makeSave(overrides: Partial<Save> = {}): Save {
  return {
    id: 'save-1',
    householdId: 'household-1',
    memberId: 'member-1',
    mealId: 'meal-1',
    intent: 'this_week',
    sourceUrl: null,
    savedAt: '2026-08-18T10:00:00.000Z',
    ...overrides,
  };
}

export function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'decision-1',
    householdId: 'household-1',
    decisionDate: '2026-08-20',
    mealId: 'meal-1',
    initialMealId: 'meal-1',
    reasonCode: 'variety',
    reasonText: 'Nog niet eerder geprobeerd',
    status: 'pending',
    createdAt: '2026-08-20T16:00:00.000Z',
    respondedAt: null,
    ...overrides,
  };
}

/**
 * Tonight's filters (PD-009). Defaults to the no-op identity so a test that
 * says nothing about filters exercises exactly the pre-filter behaviour —
 * the same posture `makeMeal`'s `dishTags: []` takes.
 */
export function makeDecisionFilters(overrides: Partial<DecisionFilters> = {}): DecisionFilters {
  return {
    ...NO_DECISION_FILTERS,
    ...overrides,
  };
}

/**
 * `friendProof` defaults to an empty map — the state of every household
 * before anybody opts in (docs/DESIGN-SOCIAL.md §5: the switch is off by
 * default), so a test that says nothing about friends exercises exactly
 * the pre-social behaviour, the same posture `makeDecisionFilters` takes.
 * It is written out rather than omitted because the field is required on
 * `DecisionRequestWithProof`: an optional one with a quiet default is how
 * FRIEND_PROOF_BOOST stayed dead code across three migrations.
 */
export function makeDecisionRequest(
  overrides: Partial<DecisionRequestWithProof> = {},
): DecisionRequestWithProof {
  const household = overrides.household ?? makeHousehold();
  return {
    household,
    members: [makeMember({ householdId: household.id })],
    restrictions: [],
    candidateMeals: [makeMeal({ householdId: household.id })],
    recentCookEvents: [],
    pendingThisWeekSaves: [],
    pendingSomedaySaves: [],
    recentDecisions: [],
    targetDate: '2026-08-22',
    excludedMealIds: [],
    filters: NO_DECISION_FILTERS,
    friendProof: new Map(),
    ...overrides,
  };
}

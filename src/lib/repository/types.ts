/**
 * `RemyRepository` — the ONE seam every screen talks to for persistence.
 *
 * This is the whole point of this directory: src/app/** never imports
 * expo-sqlite/AsyncStorage/Supabase directly, never touches a KeyValueStore,
 * never sees a table key string. It calls a method on this interface and
 * gets back plain src/domain/types.ts shapes. `localRepository.ts` is
 * today's implementation (AsyncStorage-backed, works on native + web); a
 * future `supabaseRepository.ts` implementing the exact same interface is
 * the entire migration — no screen changes required.
 *
 * Shaped directly after supabase/migrations/0001_init.sql's tables and the
 * candidate-meal query documented on the `meals` table there, so mapping
 * this interface onto real Supabase queries later is mechanical, not a
 * redesign.
 */

import type {
  AllergenTagStatus,
  CookEvent,
  CookEventId,
  Decision,
  DecisionId,
  DeclineReason,
  Household,
  HouseholdId,
  IsoDateString,
  Meal,
  MealId,
  MealIngredient,
  MealSource,
  MealStep,
  Member,
  MemberId,
  ReasonCode,
  Restriction,
  Save,
  SaveIntent,
  SkillLevel,
} from '@/domain/types';

export interface MealIngredientInput {
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sortOrder: number;
}

export interface MealStepInput {
  readonly stepNumber: number;
  readonly instruction: string;
  readonly durationMinutes: number | null;
}

export interface CreateMealInput {
  readonly householdId: HouseholdId;
  readonly title: string;
  readonly source: MealSource;
  readonly estimatedMinutes: number | null;
  readonly skillLevel: SkillLevel | null;
  readonly servings: number | null;
  /** Denormalized allergen tags — see meals.ingredient_tags's comment in 0001_init.sql. */
  readonly ingredientTags: readonly string[];
  readonly allergenTagStatus: AllergenTagStatus;
  readonly sourceUrl: string | null;
  readonly sourcePlatform: 'tiktok' | 'reels' | null;
  readonly ingredients: readonly MealIngredientInput[];
  readonly steps: readonly MealStepInput[];
}

export interface CreateSaveInput {
  readonly householdId: HouseholdId;
  readonly memberId: MemberId | null;
  readonly mealId: MealId;
  readonly intent: SaveIntent;
  readonly sourceUrl: string | null;
}

export interface CreateCookEventInput {
  readonly householdId: HouseholdId;
  readonly mealId: MealId;
  readonly decisionId: DecisionId | null;
  readonly cookedOn: IsoDateString;
}

export interface CreateDecisionInput {
  readonly householdId: HouseholdId;
  readonly decisionDate: IsoDateString;
  readonly mealId: MealId;
  readonly initialMealId: MealId;
  readonly reasonCode: ReasonCode;
  readonly reasonText: string;
}

export interface RespondToDecisionInput {
  /** Only the two terminal user-driven statuses — 'pending' is the row's own creation-time default, never a response. */
  readonly status: 'accepted' | 'skipped';
}

export interface RemyRepository {
  /** The sole household this on-device install belongs to (no auth/multi-household UI exists yet — see localRepository.ts's module note). */
  getCurrentHouseholdId(): Promise<HouseholdId>;
  getHousehold(householdId: HouseholdId): Promise<Household | null>;
  listMembers(householdId: HouseholdId): Promise<readonly Member[]>;
  listRestrictions(householdId: HouseholdId): Promise<readonly Restriction[]>;

  /** Household's own (unarchived) + curated meals — mirrors the candidate-meal query comment on the `meals` table in 0001_init.sql. */
  listHouseholdMeals(householdId: HouseholdId): Promise<readonly Meal[]>;
  getMeal(mealId: MealId): Promise<Meal | null>;
  getMealIngredients(mealId: MealId): Promise<readonly MealIngredient[]>;
  getMealSteps(mealId: MealId): Promise<readonly MealStep[]>;
  createMeal(input: CreateMealInput): Promise<Meal>;

  /** Every save for this household, regardless of intent or whether it's still "pending" — what recipeScheduling.ts needs. */
  listSaves(householdId: HouseholdId): Promise<readonly Save[]>;
  /** Saves of the given intent not yet "resolved" (their meal has no cook_event recorded since the save) — what DecisionRequest.pendingThisWeekSaves/pendingSomedaySaves need. */
  listPendingSaves(householdId: HouseholdId, intent: SaveIntent): Promise<readonly Save[]>;
  createSave(input: CreateSaveInput): Promise<Save>;

  listCookEvents(householdId: HouseholdId): Promise<readonly CookEvent[]>;
  createCookEvent(input: CreateCookEventInput): Promise<CookEvent>;
  setCookEventRepeat(cookEventId: CookEventId, wouldRepeat: boolean): Promise<CookEvent>;
  /** PD-003: the most recent accepted decision with no recorded outcome yet, or null. */
  getPendingOutcomeDecision(householdId: HouseholdId): Promise<Decision | null>;

  /** Decisions with decisionDate >= sinceDate — feeds DecisionRequest.recentDecisions. */
  listRecentDecisions(householdId: HouseholdId, sinceDate: IsoDateString): Promise<readonly Decision[]>;
  getDecisionByDate(householdId: HouseholdId, decisionDate: IsoDateString): Promise<Decision | null>;
  /** Upsert-by-date: if a decision already exists for (householdId, decisionDate), returns it unchanged rather than creating a duplicate (guards against React double-invoking an effect). */
  createDecision(input: CreateDecisionInput): Promise<Decision>;
  /** "Iets anders" (PD-001 swap) — advances the current offer (mealId + its reason) without touching initialMealId. */
  updateDecisionOffer(
    decisionId: DecisionId,
    offer: { readonly mealId: MealId; readonly reasonCode: ReasonCode; readonly reasonText: string },
  ): Promise<Decision>;
  respondToDecision(decisionId: DecisionId, input: RespondToDecisionInput): Promise<Decision>;
  setDecisionDeclineReason(decisionId: DecisionId, declineReason: DeclineReason): Promise<Decision>;

  /** Populates every table from src/app/_fixtures.ts's seed data, but ONLY on a fresh install (households table empty). No-op otherwise. */
  seedIfEmpty(): Promise<void>;
}

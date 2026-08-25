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
  IsoDateTimeString,
  Meal,
  MealId,
  MealIngredient,
  MealSource,
  MealStep,
  Member,
  MemberId,
  ReasonCode,
  Restriction,
  RestrictionId,
  RestrictionType,
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
  /**
   * Dish categories from the closed vocabulary (src/domain/dishTags.ts) —
   * NEVER allergens, and never merged with `ingredientTags` above; see
   * `Meal.dishTags`'s own comment in src/domain/types.ts for why the two
   * stay apart.
   *
   * Optional here while `Meal.dishTags` is required, and the asymmetry is
   * deliberate: every caller of this input is a screen that may or may not
   * have categories to offer yet, and there is no fail-safe reading to
   * lose — a caller that omits it is saying "no categories", which is
   * exactly what the stored `[]` means. Omitting is therefore honest
   * rather than lossy, and it keeps adding this field from forcing an edit
   * to every call site that has nothing to say. `createMeal` substitutes
   * `[]`, never `undefined` (see local/meals.ts).
   */
  readonly dishTags?: readonly string[];
  readonly sourceUrl: string | null;
  readonly sourcePlatform: 'tiktok' | 'reels' | null;
  /** oEmbed's thumbnail, carried through import — see Meal.thumbnailUrl's own comment in src/domain/types.ts. Null for manual entries. */
  readonly thumbnailUrl: string | null;
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

/**
 * Household settings screen (src/app/settings.tsx) — the only writable
 * household-level fields that screen exposes. `decisionPushTime`/
 * `skillLevel` have no UI yet, so they're deliberately not part of this
 * input; add them here (not as a separate method) when they get one.
 */
export interface UpdateHouseholdSettingsInput {
  readonly weeknightTimeBudgetMinutes: number;
}

export interface CreateMemberInput {
  readonly householdId: HouseholdId;
  readonly displayName: string;
}

export interface CreateRestrictionInput {
  readonly memberId: MemberId;
  readonly type: RestrictionType;
  readonly excludesTag: string;
  readonly notes: string | null;
}

export interface RemyRepository {
  /** The sole household this on-device install belongs to (no auth/multi-household UI exists yet — see localRepository.ts's module note). */
  getCurrentHouseholdId(): Promise<HouseholdId>;
  getHousehold(householdId: HouseholdId): Promise<Household | null>;
  /** Settings screen: the household's weeknight time budget. Nothing else is writable there yet — see UpdateHouseholdSettingsInput. */
  updateHouseholdSettings(householdId: HouseholdId, input: UpdateHouseholdSettingsInput): Promise<Household>;

  listMembers(householdId: HouseholdId): Promise<readonly Member[]>;
  createMember(input: CreateMemberInput): Promise<Member>;
  /** A real delete: a removed member's restrictions go with them (see removeRestriction/PD-005), never left orphaned. */
  removeMember(memberId: MemberId): Promise<void>;
  /**
   * PD-005: allergen data is GDPR Article 9 special-category health data
   * and requires explicit, unbundled consent BEFORE collection.
   * `consentAt: null` revokes consent (the settings screen must then stop
   * collecting/showing allergen tags for this member, matching
   * `Member.healthDataConsentAt`'s own contract in src/domain/types.ts).
   */
  setMemberHealthDataConsent(memberId: MemberId, consentAt: IsoDateTimeString | null): Promise<Member>;

  listRestrictions(householdId: HouseholdId): Promise<readonly Restriction[]>;
  createRestriction(input: CreateRestrictionInput): Promise<Restriction>;
  /** PD-005: a real delete (not a soft-delete flag), so a household can service an erasure request directly. */
  removeRestriction(restrictionId: RestrictionId): Promise<void>;

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
  /**
   * The cook's score for a meal they just made, on the scale owned by
   * src/domain/rating.ts. Also re-derives `wouldRepeat` from it via
   * `toRepeatSignal`, so the two columns can never disagree — see
   * local/cookEvents.ts for why both are kept. Rejects an off-scale score
   * rather than clamping it into range.
   */
  setCookEventRating(cookEventId: CookEventId, rating: number): Promise<CookEvent>;
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

  /** Populates a single default household on a genuinely fresh install (households table empty) — an honest empty start, no curated data. No-op otherwise. See seedData.ts. */
  seedIfEmpty(): Promise<void>;
}

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
  /**
   * The canonical `recipes` row this meal is this household's private copy
   * of (`meals.recipe_id`, 0006). It is what makes cook proof possible at
   * all: a friend's cook and this copy are two unrelated rows without it,
   * so `shared_cooks` (0009) has nothing to join on and scoring.ts's
   * FRIEND_PROOF_BOOST can never fire. Set it whenever the caller actually
   * knows the id — see src/domain/import/toMealDraft.ts, which carries one
   * through from the import context.
   *
   * Optional here for the same reason `dishTags` above is, and it earns it
   * the same way: the absent state and the stored state genuinely coincide.
   * A caller that omits this is saying "this meal is a copy of nothing" —
   * seeded, curated, or typed in by hand — which is exactly what the stored
   * `null` means, so omitting is honest rather than lossy, and there is no
   * fail-safe reading to lose (a missing link costs a social boost, never
   * anyone's safety). `createMeal` substitutes `null`, never `undefined`
   * (see local/meals.ts).
   *
   * Deliberately NOT modeled on `allergenTagStatus` above, which is
   * required precisely because ITS absent state is dangerous — and note
   * the one thing this field must never become: a channel for inheriting a
   * canonical recipe's allergen state. There is none to inherit (0006's
   * `recipes` deliberately has no allergen column), and the database
   * resets any meal carrying a recipe_id to 'unknown' on insert whatever
   * the caller passed (`meals_recipe_copy_starts_unverified`). Passing a
   * recipeId is a statement about provenance and nothing else.
   */
  readonly recipeId?: string | null;
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
  /**
   * PD-010 / DESIGN-SOCIAL.md §5 — reads the household's cook-proof
   * opt-in (`households.share_cooks_with_friends`, 0009) as a plain
   * boolean.
   *
   * Its own method rather than "call getHousehold and look at the field"
   * because `Household.shareCooksWithFriends` is optional (see its comment
   * for why it has to be), so the field alone is `boolean | undefined` and
   * every consent gate would have to remember its own `?? false`. One of
   * them forgetting is not a rendering bug, it is a household sharing what
   * it never agreed to share. Normalising here means the gate is written
   * once, at the seam, and every screen gets an answer it can act on.
   *
   * REJECTS an unknown household id rather than returning `false`. The
   * two are indistinguishable at the call site — both read as "this
   * household has not opted in" — and quietly answering a lookup failure
   * would let a bad id masquerade as a considered privacy choice.
   */
  getHouseholdCookSharing(householdId: HouseholdId): Promise<boolean>;
  /**
   * PD-010 / DESIGN-SOCIAL.md §5 — the settings-screen switch "Deel wat ik
   * kook met vrienden", and the same switch offered once when a first
   * friendship is accepted. Off is the default and revoking is a first-
   * class use of this method, not an afterthought: passing `false` stops
   * all ambient proof, and because proof is assembled per read it takes
   * the household's whole past cook history off every friend surface at
   * their next open.
   *
   * NOT folded into `updateHouseholdSettings` above, deliberately. That
   * input is a bag of preferences a settings screen saves together; this
   * is an unbundled, PD-005-style consent that has to be given by itself,
   * with the consequence stated in full sentences beside it. Sharing one
   * input object with the time budget would make it possible — in one
   * careless spread of a stale object — to flip a household's consent as
   * a side effect of saving something else.
   *
   * Returns the updated `Household`, matching setMemberHealthDataConsent.
   */
  setHouseholdCookSharing(householdId: HouseholdId, shareCooksWithFriends: boolean): Promise<Household>;
  /**
   * DESIGN-SOCIAL.md §5 — whether the one-time cook-proof question has
   * already been PUT to this household. Not what they answered: that is
   * `getHouseholdCookSharing` above, and the two are independent facts.
   *
   * §5 offers the opt-in "once, contextually, when the household's first
   * friendship is accepted... the question is asked once, not
   * campaigned". This method is what makes "once" true across app
   * launches: it is the gate on
   * `CookSharingAskSheet`'s `visible`, and without it a mounted-and-
   * remounted screen re-asks a question whose "no" was supposed to be
   * final — a campaign nobody decided to run.
   *
   * LOCAL-ONLY TODAY, and the seam says so rather than hiding it. There is
   * no `households` column behind this yet; the local implementation keeps
   * it on the stored row and
   * src/lib/repository/local/household.ts's `LocallyStoredHousehold`
   * documents both why and exactly what the eventual migration must do. A
   * Supabase implementation of `RemyRepository` does not exist yet, and
   * when it does, this method needs that column before it can answer
   * honestly — answering `false` from a backend that simply has nowhere to
   * look would re-ask everybody, once per device, forever.
   *
   * REJECTS an unknown household id rather than returning `false`, the
   * same as `getHouseholdCookSharing` and with a sharper edge: `false`
   * here means "put the question to them", so a lookup failure answered
   * `false` would raise a consent sheet against a household that does not
   * exist, and would do it again on the next read.
   */
  getHouseholdCookSharingAsked(householdId: HouseholdId): Promise<boolean>;
  /**
   * DESIGN-SOCIAL.md §5 — records that the question was put. One-way.
   *
   * NO BOOLEAN PARAMETER. The symmetric-looking
   * `setHouseholdCookSharingAsked(id, false)` would be an "un-ask", and
   * §5 describes no such act; a flag that can be cleared is a flag some
   * later reset path clears, re-opening a question the product promised
   * to ask exactly once. Idempotent, so a caller may mark twice without
   * moving the record of the first asking.
   *
   * CALLED ON BOTH ANSWERS, from the single shared path
   * `CookSharingAskSheet.onAnswer` deliberately gives its caller:
   * `if (enabled) await setHouseholdCookSharing(id, true)` and then this,
   * unconditionally. The enable goes first so that a failed write leaves
   * the question unanswered rather than recorded-and-lost. Declining
   * writes only this — the sharing flag is already `false`, and a
   * redundant `false` would make a decline indistinguishable from a
   * revocation.
   *
   * Returns `void` where its two siblings return the updated `Household`,
   * because the field it writes is deliberately not on that type (see the
   * local implementation): handing back a row that cannot show the change
   * would be worse than handing back nothing.
   */
  markHouseholdCookSharingAsked(householdId: HouseholdId): Promise<void>;

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
  /**
   * DESIGN-SOCIAL.md §3.5 — reads "Deel deze niet"
   * (`meals.excluded_from_cook_proof`, 0009) for one meal, as a plain
   * boolean, so the long-press sheet can render either `Deel deze niet` or
   * `Uitgezonderd van delen · Weer delen`.
   *
   * Normalises the optional `Meal.excludedFromCookProof` for the same
   * reason getHouseholdCookSharing normalises its field, with one extra
   * edge to it: this field's absent reading is fail-OPEN. `undefined`
   * means "not excluded", i.e. share it, so a caller that forgets its
   * `?? false` is right by accident and a caller that inverts the check is
   * wrong in the direction that discloses. Hence also the REJECTION of an
   * unknown meal id: answering `false` there would turn a lookup failure
   * into permission to share a dish nobody could even find.
   */
  getMealCookProofExclusion(mealId: MealId): Promise<boolean>;
  /**
   * DESIGN-SOCIAL.md §3.5 — sets or lifts the per-meal cook-proof
   * exclusion ("Deel deze niet" / "Weer delen").
   *
   * Independent of setHouseholdCookSharing by construction: this writes
   * one meal row and nothing else, and the household flag is never
   * consulted here. An exclusion therefore stands whether or not the
   * household has opted in, survives the global switch being toggled off
   * and on, and can be set in advance by a household that has not opted in
   * at all. 0009's column comment states that independence as a contract;
   * tests/repository/cookProofConsent.test.ts holds the code to it.
   *
   * Scope, stated so a future caller does not widen it by accident: this
   * governs COOK PROOF only. It does not block a directed send
   * (`recipe_shares`) — a send is a separate explicit act aimed at one
   * named person, withdrawn per-act — and it has no effect on
   * `recipe_ratings` votes, which are world-readable by design and
   * withdrawn by deleting the vote.
   *
   * Not part of CreateMealInput: a meal is never born excluded. The
   * exclusion is a later, deliberate act on a dish already in the library,
   * so createMeal always writes `false` and this is the only way it
   * becomes true.
   */
  setMealCookProofExclusion(mealId: MealId, excludedFromCookProof: boolean): Promise<Meal>;
  /**
   * LIB-04 — "Verwijderen" on a Mijn recepten tile's long-press sheet. Sets
   * `meals.archived_at` (0001_init.sql) to now; there is no way back through
   * this interface, matching the row's own comment there: "Soft-delete:
   * removing a meal from rotation must not orphan decision / cook_event
   * history that references it."
   *
   * A SOFT DELETE, NOT A REAL ONE, AND NOT A CHOICE THIS METHOD MAKES —
   * 0001 already made it. `decisions.meal_id`, `decisions.initial_meal_id`
   * and `cook_events.meal_id` are all declared `on delete restrict`
   * ("cook history must survive a meal edit/removal attempt", per
   * cook_events' own column comment), so a real `DELETE FROM meals` is not
   * merely undesirable, it is refused outright by Postgres the moment a
   * household has ever cooked or been offered the dish. Archiving is
   * therefore the only removal that can work uniformly — for a dish with
   * history and one without — and it is the one docs/ARCHITECTURE.md and
   * this repository already agreed on before this method existed:
   * `listHouseholdMeals` has filtered `archivedAt === null` since before
   * anything wrote it.
   *
   * DOES NOT CONFLICT WITH PD-004a. "Everything saved must eventually be
   * suggested" is a rule against a silent bookmark-only graveyard where a
   * household never has to decide anything about a saved dish. It is not a
   * rule against ever taking a dish out of rotation once the household HAS
   * decided — an archive is that decision, made explicitly, on one dish, by
   * the people who saved it. What keeps that decision honest rather than
   * punitive is that nothing here purges the ingredients, steps or cook
   * history, even though this interface exposes no way back in yet.
   *
   * ONLY TOUCHES THIS MEAL ROW. Its ingredients, steps, cook events, saves
   * and decisions are all untouched — a friend who was sent this dish
   * earlier keeps whatever they were sent (`recipe_shares` reads the meal
   * row directly, and archiving does not change `visibility`), and
   * `cook_events`/`decisions` keep pointing at a real, readable row so a
   * household's own history never shows a reference to nothing.
   *
   * Rejects an unknown meal id rather than silently doing nothing, matching
   * every other single-meal setter in this file.
   */
  archiveMeal(mealId: MealId): Promise<Meal>;
  /**
   * The second descriptive axis (src/domain/dishMoods.ts) — one person's
   * mood for one dish, added in the outcome moment after they cooked it.
   * "Zomers", "soul-food", "high-protein": what a dish feels like, as
   * opposed to `Meal.dishTags`, which is what it is made of.
   *
   * THE PUBLIC HALF OF THE OUTCOME MOMENT, and the private half —
   * `setCookEventRating` below — is a DIFFERENT METHOD writing a
   * DIFFERENT TABLE. That separation is PD-019 made structural rather
   * than promised: there is no argument on this method that could carry a
   * grade, and none on that one that could carry a mood, so no caller can
   * republish one as the other even by accident. What makes this half
   * safe to publish at all is that a mood carries no number and no mood
   * outranks another — there is nothing in it to inflate, which is the
   * pressure PD-019 keeps the private grade away from.
   *
   * ADDITIVE, IDEMPOTENT, AND NEVER A REPLACE: a dish is cooked by more
   * than one person, and the meal accumulates the union of what they
   * said. Adding a mood already present is a no-op rather than a second
   * vote — this vocabulary must never acquire a count, because a count is
   * a number and a number is the thing PD-019 is about.
   *
   * REJECTS a value outside the closed vocabulary rather than storing it,
   * and rejects an unknown meal id rather than silently doing nothing.
   * Both mirror `setCookEventRating`'s refusal to clamp an off-scale
   * grade: an unfilterable value in storage is worse than a loud failure
   * at the boundary, because nobody can ever ask for it again.
   *
   * Not part of `CreateMealInput`: a meal is never born with a mood. Axis
   * 1 is set at import time by a model reading a caption; axis 2 is only
   * ever set by somebody who actually ate the food.
   */
  addMealDishMood(mealId: MealId, mood: string): Promise<Meal>;

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

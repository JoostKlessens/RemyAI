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
  CookEvent,
  CookEventId,
  Decision,
  DecisionId,
  Household,
  HouseholdId,
  IsoDateString,
  IsoDateTimeString,
  Meal,
  MealId,
  MealIngredient,
  MealStep,
  Member,
  MemberId,
  ReasonCode,
  Restriction,
  RestrictionId,
  Save,
  SaveIntent,
} from '@/domain/types';

// Re-exported below as well; imported here because `export ... from` does
// not bring a name into this file's own scope, and `RemyRepository`'s
// signatures use every one of them.
import type {
  CreateCookEventInput,
  CreateDecisionInput,
  CreateMealInput,
  CreateMemberInput,
  CreateRestrictionInput,
  CreateSaveInput,
  RespondToDecisionInput,
  UpdateHouseholdSettingsInput,
  UpdateMealRecipeInput,
} from './inputs';

/**
 * ⚠ EVERY `Create*Input` / `Update*Input` SHAPE NOW LIVES IN `./inputs`,
 * and is re-exported here so that no call site had to move.
 *
 * The split happened when `CreateSaveInput` gained PD-024's required
 * `origin` and this file crossed the 800-line ceiling — seven files in
 * `src/` are already over it and an eighth is not something to add
 * quietly. The seam is the one the file was already organised around:
 * `./inputs` describes what a write TAKES, this file describes the METHOD
 * that takes it. Read `./inputs` before changing an argument shape.
 */
export type {
  CreateCookEventInput,
  CreateDecisionInput,
  CreateMealInput,
  CreateMemberInput,
  CreateRestrictionInput,
  CreateSaveInput,
  MealIngredientInput,
  MealStepInput,
  RespondToDecisionInput,
  UpdateHouseholdSettingsInput,
  UpdateMealRecipeInput,
} from './inputs';

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
  listHouseholdMealIngredients(householdId: HouseholdId): Promise<readonly MealIngredient[]>; // GAP-34: the rows of exactly the meals above, in one read
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
   * RCP-03 — "Aanpassen": correcting a recipe the household already saved.
   *
   * THE GAP THIS CLOSES. `src/app/import/confirm.tsx` can edit every one of
   * these fields on the way IN, and until this method existed there was no
   * way to touch any of them afterwards — one wrong ingredient, read out of
   * a caption by a model, was a wrong ingredient forever. `createMeal` was
   * the only write path onto `meal_ingredients`/`meal_steps` in the whole
   * interface, and it only ever appends a new meal.
   *
   * AN EDIT IS A REPLACE OF CHILD ROWS, NOT A FIELD UPDATE, because
   * `meal_ingredients` and `meal_steps` are separate tables from `meals`
   * (0001_init.sql). See `UpdateMealRecipeInput`'s own comment for why the
   * replace is total (fresh ids, old rows gone) rather than a per-row diff,
   * and for the exact cost of that.
   *
   * PD-006 IS ENFORCED HERE AND CANNOT BE OPTED OUT OF. The caller states
   * whether a human tagged the ingredient list during this edit
   * (`input.allergenCheck`); this method then applies
   * src/domain/mealAllergenReverification.ts's ruling, which is that a
   * `verified` flag does not survive its ingredient list changing. The
   * screen cannot pass a status through, so no screen can carry a stale
   * `verified` forward by spreading a row. What it CAN do is say a person
   * just checked the new list, which is the only act PD-006.1 recognises as
   * earning `verified` and therefore the only way back.
   *
   * TOUCHES NOTHING ELSE ON THE MEAL, and the list of what it leaves alone
   * is the interesting half: `source`, `sourceUrl`, `sourcePlatform`,
   * `thumbnailUrl`, `recipeId`, `dishMoods`,
   * `excludedFromCookProof`, `archivedAt`, `createdAt`, `skillLevel` and
   * `householdId` all survive an edit untouched. `dishTags` USED TO BE ON
   * THAT LIST AND NO LONGER IS: the owner asked for editable categories,
   * so they are now a field this input carries and this write replaces,
   * alongside `dishCourse`. What replaces the old guarantee is narrower and
   * still worth stating — a save that restates the same categories changes
   * nothing, which is what opening an editor and closing it must do. A
   * household's copy stays
   * pointed at the same canonical recipe, stays as private or as excluded
   * as they last left it, and keeps its cook history — none of which is
   * something a person fixing a typo asked to change.
   *
   * MIRRORS, LIKE EVERY OTHER MEAL WRITE. An edited recipe that never
   * reaches Postgres is a friend reading the version with the wrong
   * ingredient (`meal_ingredients_select_sent_to_me`, 0009), so this
   * announces the same `meal` job `createMeal` does — parent plus BOTH
   * child sets, re-read after the write. The mirror's replace-then-prune
   * strategy (mirrorWrites.ts) then deletes the departed rows remotely
   * rather than leaving an append-only copy behind.
   *
   * Rejects an unknown meal id rather than silently doing nothing, matching
   * every other single-meal setter in this file.
   */
  updateMealRecipe(mealId: MealId, input: UpdateMealRecipeInput): Promise<Meal>;
  /**
   * The second descriptive axis (src/domain/dishMoods.ts) — one person's
   * mood for one dish, added in the outcome moment after they cooked it.
   * "Zomers", "soul-food", "high-protein": what a dish feels like, as
   * opposed to `Meal.dishTags`, which is what it is made of.
   *
   * ONE OF THE OUTCOME MOMENT'S TWO PUBLIC WRITES, and the private one —
   * `setCookEventRating` below — is a DIFFERENT METHOD writing a
   * DIFFERENT TABLE. That separation is PD-019 made structural rather
   * than promised: there is no argument on this method that could carry a
   * grade, and none on that one that could carry a mood, so no caller can
   * republish one as the other even by accident. What makes this half
   * safe to publish at all is that a mood carries no number and no mood
   * outranks another — there is nothing in it to inflate, which is the
   * pressure PD-019 keeps the private grade away from.
   *
   * IT USED TO SAY "THE PUBLIC HALF", SINGULAR, and that stopped being
   * true. The outcome card now also casts a `recipe_ratings` vote from
   * the same gesture that grades a cook (src/domain/social/publicVote.ts
   * — "the rating should also be represented in the global ranking of a
   * recipe"). That vote goes through the SOCIAL repository rather than
   * this one, which is why nothing on this interface changed; and the
   * structural separation the paragraph above claims is if anything
   * sharper for it — three writes, three tables, two repositories, and no
   * argument anywhere that could carry a value from one into another.
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

  /**
   * Every save for this household, regardless of intent, whether its meal
   * has been cooked since, or whether that meal has since been archived —
   * the raw table read, which is what recipeScheduling.ts needs.
   *
   * DELIBERATELY UNFILTERED WHERE `listPendingSaves` IS NOT. Its one
   * caller joins it against `listHouseholdMeals`, which already drops
   * archived meals, so nothing removed can surface through it; and a
   * repository needs exactly one method that can still see a row a view
   * hides, or nothing can ever tell "filtered" apart from "deleted". See
   * local/saves.ts's header for the argument in full.
   */
  listSaves(householdId: HouseholdId): Promise<readonly Save[]>;
  /**
   * Saves of the given intent that are still standing — what
   * DecisionRequest.pendingThisWeekSaves/pendingSomedaySaves need, and the
   * single definition of "deze week" that src/app/boodschappen.tsx and
   * src/app/deze-week.tsx both read.
   *
   * A save stops being pending on either of two facts: its meal has a
   * cook_event on or after the save's own date (dinner happened, so there
   * is nothing left to shop for or to boost), or its meal has been
   * archived (the household removed the dish from Mijn recepten, and a
   * removed dish must stop filling a shopping list). Both checks live in
   * local/saves.ts, never in a caller — see that file's header for why a
   * screen-local version of either would become a second definition of the
   * week.
   */
  listPendingSaves(householdId: HouseholdId, intent: SaveIntent): Promise<readonly Save[]>;
  createSave(input: CreateSaveInput): Promise<Save>;
  /**
   * "Van deze week af" — the act a plan view needs and shipped without.
   * Deletes every save this household holds for ONE meal at ONE intent,
   * and nothing else.
   *
   * A REAL DELETE, WHICH IS THE ONE THING `archiveMeal` IS NOT, AND 0001
   * ALREADY SETTLED THE DIFFERENCE. `saves.meal_id` is declared `on delete
   * cascade` with the reason written beside it — "a save is a bookmark,
   * not a historical record, so it is fine for it to disappear with its
   * meal" — and `saves` carries both a `saves_update` and a `saves_delete`
   * policy for household members. Compare `decision_alternatives`, whose
   * policies stop at select/insert under the line "No update/delete: this
   * is an append-only offer log", and `cook_events`/`decisions`, whose
   * `on delete restrict` foreign keys make deletion impossible on purpose.
   * The schema therefore already says which rows are history and which are
   * intent; this method needs no migration, only the seam.
   *
   * KEYED BY (HOUSEHOLD, MEAL, INTENT) RATHER THAN BY SAVE ID, unlike
   * `removeMember`/`removeRestriction`. Nothing a person can point at is a
   * save: the week screen shows DISHES, folded one row per meal, because
   * two members can both save the same dish for the same week
   * (src/domain/weekPlan.ts). A save-id verb would hand the screen an
   * identity nobody chose and turn one tap into N writes over one table
   * key — racing if issued together, and leaving a dish half-planned if one
   * of them failed, which is a state no sentence on that screen could
   * describe. Intent-scoped rather than dish-scoped for the matching
   * reason: a dish saved BOTH "deze week" and "ooit" has made two separate
   * commitments, and taking it off this week must not silently cancel the
   * other one.
   *
   * WHY DELETING, NOT DEMOTING TO 'ooit', AND HOW THAT SQUARES WITH
   * PD-004a. The founder's rule is "als ik iets in mijn lijst zet moet het
   * altijd een keer voorbij kunnen komen" — saving is scheduling, never
   * filing. Deleting a save does not file anything: the dish stays in Mijn
   * recepten and stays in `listHouseholdMeals`, which IS `candidateMeals`,
   * so the engine can still offer it any evening. Saves are boosts in
   * scoring.ts (SAVED_THIS_WEEK_BOOST, the SOMEDAY_SAVE_* aging boost),
   * never gates — so what a delete removes is priority, not the
   * possibility of ever being suggested, which is the only thing PD-004a
   * protects. Demoting instead would REWRITE the household's commitment
   * into one they did not pick and enrol the dish in an escalating boost
   * that, after four weeks, is guaranteed to win its tie-break — a larger
   * claim about what somebody meant by "not this week" than this method is
   * entitled to make. That the two readings differ at all is a product
   * question; it is reported rather than decided here, and this is the
   * narrower half.
   *
   * IDEMPOTENT, AND SILENT ON A DISH WITH NO SAVES — matching
   * `removeMember` and `removeRestriction`, and unlike every single-meal
   * setter above. Those reject an unknown id because "update the row" is
   * meaningless without one; "make sure this is not planned" is already
   * true of a dish that was never planned, so there is no failure to
   * report and a second tap must not become an error.
   *
   * LOCAL ONLY, LIKE `createSave`. `saves` is not one of the mirror's five
   * tables (src/lib/repository/mirror/types.ts) — nothing outside a
   * household reads a save — so there is no remote row this could delete:
   * the create path never sent one. See localRepository.ts's header.
   */
  removeSaves(householdId: HouseholdId, mealId: MealId, intent: SaveIntent): Promise<void>;

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

  /** Populates a single default household on a genuinely fresh install (households table empty) — an honest empty start, no curated data. No-op otherwise. See seedData.ts. */
  seedIfEmpty(): Promise<void>;
}

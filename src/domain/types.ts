/**
 * Remy domain contract.
 *
 * This file is the single source of truth every other agent builds against:
 * the decision engine (src/domain/decide.ts, owned elsewhere), the Supabase
 * Edge Functions, and the UI screens. It contains type declarations only —
 * no logic, no I/O.
 *
 * Conventions:
 * - Every field is `readonly`; every array is `readonly T[]`. Nothing here
 *   is ever mutated in place — callers build new objects.
 * - IDs are plain `string` aliases (Postgres uuids, serialized as strings
 *   over the JS boundary). They exist for readability at call sites, not
 *   for nominal type safety.
 * - snake_case Postgres columns are NOT modeled 1:1 here — fields are
 *   camelCase domain names. Mapping raw Supabase rows to these shapes is a
 *   repository/mapper concern that lives in src/lib, out of scope for this
 *   file.
 * - Dutch is a UI-copy concern only. Every identifier, comment, and type
 *   name in this file is English.
 */

// ---------------------------------------------------------------------------
// Identifiers & primitive aliases
// ---------------------------------------------------------------------------

export type HouseholdId = string;
export type MemberId = string;
export type RestrictionId = string;
export type MealId = string;
export type MealIngredientId = string;
export type MealStepId = string;
export type SaveId = string;
export type DecisionId = string;
export type DecisionAlternativeId = string;
export type CookEventId = string;
export type VetoId = string;
export type PushTokenId = string;

/** Calendar date only, no time-of-day — "YYYY-MM-DD". */
export type IsoDateString = string;

/** Full ISO 8601 timestamp, always UTC on the wire — e.g. "2026-08-22T14:03:00.000Z". */
export type IsoDateTimeString = string;

/** IANA timezone identifier — e.g. "Europe/Amsterdam". */
export type IanaTimeZone = string;

/** ISO 8601 week label, used to key "one veto per member per week" — e.g. "2026-W34". */
export type IsoWeekString = string;

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

/** Where a meal in the household's rotation came from. */
export type MealSource = 'seeded' | 'saved' | 'curated';

/**
 * What a household member asked to happen with something they saved from
 * the Feed (F). "none" means "just bookmark it, don't schedule anything."
 *
 * PD-004a (founder correction, 2026-08-23): a bare bookmark with no
 * schedule is a graveyard — "if I put something in my list, it must be
 * able to come around at some point." `'none'` is therefore UNREACHABLE
 * from the UI as of PD-004a: `SaveIntentSheet` (src/components) offers only
 * `'this_week'` and `'someday'`, both of which the engine (decide.ts) is
 * guaranteed to eventually surface. `'none'` stays in this union rather
 * than being deleted because the `saves.intent` check constraint
 * (supabase/migrations/0001_init.sql) still accepts it — for legacy rows
 * written before this decision — and `recipeScheduling.ts` still branches
 * on it (a `'none'` save renders as `geen_planning`, never as a schedule).
 * No code should ever construct a new `'none'` save going forward.
 */
export type SaveIntent = 'this_week' | 'someday' | 'none';

/**
 * Why the decision engine picked this meal. Rendered into Dutch UI copy by
 * the caller (e.g. "saved_this_week" + a weekday -> "Je bewaarde dit
 * dinsdag"); this file only defines the vocabulary, not the copy.
 */
export type ReasonCode =
  | 'saved_this_week'
  | 'not_recent'
  | 'fits_time'
  | 'household_favourite'
  | 'friend_proof'
  | 'variety'
  | 'requested_repeat'
  | 'fallback';

/**
 * Lifecycle of a single day's decision. "pending" is the state between the
 * scheduled function creating the row and a member responding to the push —
 * the spec's three user-facing outcomes (accepted/swapped/skipped) are only
 * ever reached from there.
 */
export type DecisionStatus = 'pending' | 'accepted' | 'swapped' | 'skipped';

/**
 * The three actions available on the 16:00 decision screen: "Ja" / "Iets
 * anders" / "Niet koken". Maps 1:1 onto the non-pending DecisionStatus
 * values.
 */
export type DecisionAction = 'accept' | 'request_alternative' | 'decline';

/**
 * Optional, never-nudged-for reason offered after "Niet koken" (PD-002).
 * The decline itself is fully recorded via DecisionStatus regardless of
 * whether this is given — this is bonus signal, not a required field.
 */
export type DeclineReason = 'afhalen' | 'restjes' | 'uit_eten';

/** A restriction is either a taste preference or a health-relevant exclusion. */
export type RestrictionType = 'dislike' | 'allergen';

/**
 * PD-006: a meal's allergen-relevant tagging is either `verified` (a
 * human — the household or a curator — has actually gone through and
 * tagged it) or `unknown` (the default: e.g. a title-only meal captured by
 * Rotation Seeding, which has no ingredient data at all). `unknown` must
 * never be treated as "checked and found clean" — see
 * exclusions.ts's `resolveAllergenTagStatus`.
 */
export type AllergenTagStatus = 'verified' | 'unknown';

// ---------------------------------------------------------------------------
// Household & members
// ---------------------------------------------------------------------------

export interface Household {
  readonly id: HouseholdId;
  readonly name: string;
  readonly timezone: IanaTimeZone;
  /** Local wall-clock time the daily decision is pushed, "HH:mm" — default "16:00". */
  readonly decisionPushTime: string;
  readonly weeknightTimeBudgetMinutes: number;
  readonly skillLevel: SkillLevel;
  readonly createdAt: IsoDateTimeString;
}

export interface Member {
  readonly id: MemberId;
  readonly householdId: HouseholdId;
  readonly displayName: string;
  /**
   * Linked Supabase auth identity, if this member has an account of their
   * own. Null for members added during onboarding who haven't signed up yet
   * (e.g. a partner or child profile) — restrictions and cook history still
   * attach to memberId regardless of whether an account exists.
   */
  readonly authUserId: string | null;
  /**
   * PD-005: allergen data is GDPR Article 9 special-category health data
   * and requires explicit, unbundled consent BEFORE collection. Null means
   * consent has not been given — allergen tags (RestrictionType 'allergen')
   * must not be collected or displayed as filterable for this member until
   * this is set. Dislikes do not require it.
   */
  readonly healthDataConsentAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
}

/**
 * GDPR Article 9 special-category health data when `type` is "allergen".
 *
 * Semantics are EXCLUSION ONLY: this expresses "filter out meals tagged
 * with excludesTag for this household," never "safe for this member" or
 * any other positive safety claim. Naming (`excludesTag`, not `safeFor` or
 * `allergyOf`) is deliberate — see docs/ARCHITECTURE.md.
 *
 * Store the minimum necessary. `notes` is free text and should stay empty
 * unless the household explicitly adds it; prefer `excludesTag` (a
 * controlled vocabulary entry) over prose wherever possible so a member's
 * restrictions can be reasoned about, and hard-deleted, without touching
 * unrelated data.
 */
export interface Restriction {
  readonly id: RestrictionId;
  readonly memberId: MemberId;
  readonly type: RestrictionType;
  readonly excludesTag: string;
  readonly notes: string | null;
  readonly createdAt: IsoDateTimeString;
}

// ---------------------------------------------------------------------------
// Meals
// ---------------------------------------------------------------------------

export interface Meal {
  readonly id: MealId;
  /** Null only for "curated" meals: household-agnostic, visible to every household. */
  readonly householdId: HouseholdId | null;
  readonly title: string;
  readonly source: MealSource;
  readonly estimatedMinutes: number | null;
  readonly skillLevel: SkillLevel | null;
  readonly servings: number | null;
  /**
   * Flattened union of this meal's ingredient allergen tags, denormalized
   * from MealIngredient for fast exclusion filtering when building the
   * candidate list (see DecisionRequest.candidateMeals). Source of truth is
   * still the per-ingredient tags; this field is a query-performance
   * convenience, not independently editable data.
   */
  readonly ingredientTags: readonly string[];
  /**
   * PD-006. Optional for backward compatibility with existing `Meal`
   * object literals elsewhere in the codebase that predate this field —
   * treat a missing value as `'unknown'`, the fail-safe default (see
   * exclusions.ts's `resolveAllergenTagStatus`), never as `'verified'`.
   */
  readonly allergenTagStatus?: AllergenTagStatus;
  /**
   * Dish categories from the closed vocabulary in dishTags.ts — "pasta",
   * "soep", "vegetarisch". Descriptive only: they exist so a household can
   * say "kies iets met pasta" and narrow the pool it already accepted.
   *
   * STRICTLY SEPARATE FROM `ingredientTags` ABOVE, and never merged with
   * it, iterated together with it, or copied between them. That field is a
   * denormalized list of ALLERGENS and it drives the PD-006 exclusion gate
   * (exclusions.ts): a value there REMOVES a meal from someone's rotation
   * on safety grounds. A value here only ever narrows a search the user
   * explicitly asked for. Same `readonly string[]` shape, opposite
   * direction, wholly different blast radius — a wrong dish tag costs a
   * missed suggestion, a wrong allergen tag costs someone a reaction.
   * Keeping them in one column (or one union) would mean a category filter
   * and an allergen exclusion silently operating on the same string, which
   * is exactly the conflation PD-006 forbids. dishTags.ts's own header and
   * tests/dishTags.test.ts hold the other half of this guarantee: the two
   * vocabularies are asserted to share no value.
   *
   * Required and non-nullable, unlike `allergenTagStatus?` above: the
   * absent state and the empty state genuinely coincide here (a meal with
   * no recognized category IS a meal with no categories — there is no
   * fail-safe reading to preserve), so an empty array says everything a
   * missing key would. Rows persisted before this field existed are
   * backfilled to `[]` on read — see src/lib/repository/local/meals.ts.
   */
  readonly dishTags: readonly string[];
  /** Creator video URL for Feed items (F) — resolved to an oEmbed player by the UI layer. */
  readonly sourceUrl: string | null;
  readonly sourcePlatform: 'tiktok' | 'reels' | null;
  /**
   * oEmbed's `thumbnail_url` (src/lib/oembed.ts's `OembedPayload.thumbnailUrl`),
   * carried through import (`ImportAttribution.thumbnailUrl` ->
   * `toMealDraft` -> the repository) so the library (Bibliotheek) can show
   * a real still of the source video. Null for manual entries, meals that
   * predate this field, and any import whose oEmbed response genuinely had
   * no thumbnail (Instagram without credentials, a 404/region-locked post,
   * ...) — the UI must render a monogram fallback for null, never a broken
   * image or a stock placeholder.
   */
  readonly thumbnailUrl: string | null;
  /** Set when a meal is removed from rotation. Soft-delete: history referencing it stays intact. */
  readonly archivedAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
}

export interface MealIngredient {
  readonly id: MealIngredientId;
  readonly mealId: MealId;
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly allergenTags: readonly string[];
  readonly sortOrder: number;
}

export interface MealStep {
  readonly id: MealStepId;
  readonly mealId: MealId;
  readonly stepNumber: number;
  readonly instruction: string;
  /** Drives the cook-mode timer (E), if this step has one. */
  readonly durationMinutes: number | null;
}

// ---------------------------------------------------------------------------
// Saves (Feed / Save-to-Schedule, F)
// ---------------------------------------------------------------------------

export interface Save {
  readonly id: SaveId;
  readonly householdId: HouseholdId;
  readonly memberId: MemberId | null;
  readonly mealId: MealId;
  readonly intent: SaveIntent;
  readonly sourceUrl: string | null;
  readonly savedAt: IsoDateTimeString;
}

// ---------------------------------------------------------------------------
// Decisions (The 16:00 Decision, B)
// ---------------------------------------------------------------------------

export interface Decision {
  readonly id: DecisionId;
  readonly householdId: HouseholdId;
  readonly decisionDate: IsoDateString;
  /** The meal currently on offer for this date — updates as "Iets anders" advances through alternatives. */
  readonly mealId: MealId;
  /**
   * The meal offered FIRST, before any swap. Never overwritten.
   *
   * Plan §8's primary kill criterion is "≥40% accept the first suggestion".
   * Because `mealId` advances on every swap, the identity of the original
   * offer would otherwise be destroyed by the very interaction we most need
   * to measure. Keep this immutable for the life of the row.
   */
  readonly initialMealId: MealId;
  readonly reasonCode: ReasonCode;
  readonly reasonText: string;
  readonly status: DecisionStatus;
  readonly declineReason: DeclineReason | null;
  readonly createdAt: IsoDateTimeString;
  readonly respondedAt: IsoDateTimeString | null;
}

/**
 * A log entry for one "Iets anders" swap. Sequence 1 is the original
 * Decision.mealId itself (not a row here); this table only ever holds
 * sequence 2 and 3 — "one alternative, then a third, then stops."
 */
export interface DecisionAlternative {
  readonly id: DecisionAlternativeId;
  readonly decisionId: DecisionId;
  readonly mealId: MealId;
  readonly sequence: 2 | 3;
  readonly reasonCode: ReasonCode;
  readonly reasonText: string;
  readonly offeredAt: IsoDateTimeString;
}

// ---------------------------------------------------------------------------
// Cook mode + outcome loop (E)
// ---------------------------------------------------------------------------

export interface CookEvent {
  readonly id: CookEventId;
  readonly householdId: HouseholdId;
  readonly mealId: MealId;
  /** Null when logged outside the normal decision flow. */
  readonly decisionId: DecisionId | null;
  readonly cookedOn: IsoDateString;
  /** Null until "Nog een keer?" is answered. */
  readonly wouldRepeat: boolean | null;
  /**
   * The cook's score for this meal, on the scale defined by RATING_MIN /
   * RATING_MAX in domain/rating.ts. Null when the question was skipped —
   * rating is optional, in the same spirit as PD-002's optional decline
   * reason.
   *
   * Optional for backward compatibility with `CookEvent` literals that
   * predate this field, exactly how `Meal.allergenTagStatus?` was added.
   * Never read this directly to decide whether a household liked a meal:
   * go through `resolveRepeatSignal(event)`, which also understands
   * events that only ever carried `wouldRepeat`.
   *
   * `wouldRepeat` is kept in sync as a lossy projection of this score
   * (see `toRepeatSignal`) so scoring.ts's HOUSEHOLD_FAVOURITE_BOOST and
   * WOULD_NOT_REPEAT_PENALTY keep both their meaning and their tuned
   * values.
   */
  readonly rating?: number | null;
  readonly createdAt: IsoDateTimeString;
}

// ---------------------------------------------------------------------------
// Household Sync / paywall (C)
// ---------------------------------------------------------------------------

export interface Veto {
  readonly id: VetoId;
  readonly householdId: HouseholdId;
  readonly memberId: MemberId;
  readonly decisionId: DecisionId;
  /** Enforces "one veto per member per week" — unique per (memberId, isoWeek) at the DB layer. */
  readonly isoWeek: IsoWeekString;
  readonly createdAt: IsoDateTimeString;
}

// ---------------------------------------------------------------------------
// Push delivery (The 16:00 Decision, B)
// ---------------------------------------------------------------------------

/** One row per (member, device) — a member may have more than one device. */
export interface PushToken {
  readonly id: PushTokenId;
  readonly memberId: MemberId;
  readonly householdId: HouseholdId;
  readonly expoPushToken: string;
  readonly createdAt: IsoDateTimeString;
  readonly lastSeenAt: IsoDateTimeString;
}

// ---------------------------------------------------------------------------
// Decision engine contract
//
// decide.ts (owned by another agent) implements a pure function shaped
// roughly like `(request: DecisionRequest) => DecisionResult`. Everything
// it needs must already be fetched and passed in — no I/O inside the
// engine. This section defines that boundary only.
// ---------------------------------------------------------------------------

export interface DecisionRequest {
  readonly household: Household;
  readonly members: readonly Member[];
  readonly restrictions: readonly Restriction[];
  /** Meals eligible for this household: household's own + curated, already filtered for archivedAt = null. */
  readonly candidateMeals: readonly Meal[];
  /** Enough recent history to compute "not_recent" and "variety" — window size is an engine concern. */
  readonly recentCookEvents: readonly CookEvent[];
  /** Saves with intent "this_week" not yet served back as a decision. */
  readonly pendingThisWeekSaves: readonly Save[];
  /**
   * Saves with intent "someday" not yet served back as a decision.
   *
   * PD-004a (additive field): an 'ooit' save must be a genuine rotation
   * candidate, not a parked item that only surfaces if the user goes
   * looking. Because `candidateMeals` already includes any meal the
   * household owns regardless of how it was saved, a someday-saved meal's
   * `Meal` row was always technically "in the pool" — but with nothing
   * distinguishing it from an ordinary rotation meal, a low-scoring one
   * could in principle keep losing its novelty-tier tie-break forever. This
   * field lets scoring.ts apply an aging boost (SOMEDAY_SAVE_*) so a save
   * that keeps losing gets more competitive the longer it waits, giving it
   * a genuine, bounded-time guarantee of eventually winning its tier — see
   * scoring.ts's `somedaySaveBoost` and decide.ts's `selectWinner`.
   */
  readonly pendingSomedaySaves: readonly Save[];
  /** Recent decisions for this household, for variety and to avoid immediate repeats. */
  readonly recentDecisions: readonly Decision[];
  readonly targetDate: IsoDateString;
  /** Meal ids already offered today (original + prior swaps) — a swap must never repeat one of these. */
  readonly excludedMealIds: readonly MealId[];
  /**
   * PD-009 (additive field, same posture as `pendingSomedaySaves` above):
   * what the household asked for *tonight*, before Remy picks.
   *
   * Required, not optional. An omitted filter set and an empty one mean
   * exactly the same thing (`NO_DECISION_FILTERS` in exclusions.ts), so
   * `filters?:` would have compiled everywhere untouched — which is
   * precisely the problem. Making it required forced every existing
   * `decide()` call site to state its answer out loud, and that surfaced
   * the one place where the answer is genuinely "no filters, deliberately":
   * the persisted daily decision row, which must stay the household's
   * unfiltered offer for the day.
   */
  readonly filters: DecisionFilters;
}

/**
 * PD-009 — the narrowing a household states for one evening ("ik heb 20
 * minuten", "iets met pasta"), applied on top of everything the engine
 * already does.
 *
 * DELIBERATELY NOT the same thing as `Household.weeknightTimeBudgetMinutes`
 * or a `Restriction`. Those are standing settings: they persist, they
 * describe the household in general, and they were set once in a calm
 * moment. This is a statement about right now, made on the decision
 * surface, and thrown away afterwards. Keeping the two apart is what lets
 * `maxMinutes` be strict about unknown durations while the household budget
 * stays lenient about them (see `filterByDecisionFilters` in exclusions.ts
 * for the full argument), and what keeps a filter tap from quietly
 * rewriting a household's saved preferences behind its back.
 *
 * Nothing here can ever *widen* the pool: filters run after the PD-006
 * exclusion gate, never instead of it. A household cannot filter its way
 * back to a meal an allergen restriction removed.
 */
export interface DecisionFilters {
  /**
   * Hard upper bound for tonight, separate from
   * `Household.weeknightTimeBudgetMinutes`. Null = the user stated no cap,
   * which is NOT the same as "a very large cap": a null cap leaves meals of
   * unknown duration in the pool, an explicit one removes them.
   */
  readonly maxMinutes: number | null;
  /**
   * Meal must have ALL listed tags — "iets met pasta én vegetarisch" is one
   * request, not two. Empty = no tag filter.
   *
   * Values come from dishTags.ts's closed vocabulary. Typed
   * `readonly string[]` rather than a union for the same reason
   * `Meal.dishTags` is: the vocabulary lives in dishTags.ts as data, and
   * untrusted input is narrowed by `sanitizeDishTags` at the boundary.
   * Matched against `Meal.dishTags` only — never against
   * `Meal.ingredientTags`, which is allergen data (see `Meal.dishTags`).
   */
  readonly requiredDishTags: readonly string[];
}

/**
 * Why the engine could not offer anything. This is a real, reachable state —
 * a household with a small rotation, tight restrictions and two swaps already
 * spent WILL exhaust its candidates — so it is modeled explicitly rather than
 * left to a null check the UI might forget.
 */
export type NoCandidateReason =
  /** The household has no unarchived meals at all (onboarding incomplete). */
  | 'empty_rotation'
  /**
   * Every candidate was removed by restrictions, time budget, skill level,
   * or (PD-006) an unverified allergen tag status for a household with an
   * active allergen restriction.
   */
  | 'all_excluded'
  /**
   * PD-009. Restrictions left something eligible, but tonight's
   * `DecisionFilters` removed all of it.
   *
   * Its own member rather than a reuse of `all_excluded` because the two
   * ask the user to do opposite things. `all_excluded` means the
   * household's standing settings — allergens, dislikes, the weeknight
   * budget — emptied the pool; the honest response is "kies zelf" or grow
   * the library, and the copy must never suggest loosening an allergen
   * restriction. `filtered_out` means one tap on a chip fixes it. Folding
   * the second into the first would tell someone who asked for pasta that
   * their allergies are to blame for there being no dinner, which is both
   * false and, given rule 3 of docs/PRODUCT-DECISIONS.md, the last thing
   * this product should ever imply.
   */
  | 'filtered_out'
  /** Candidates existed but all had already been offered today (PD-001 cap reached). */
  | 'swaps_exhausted';

/**
 * A discriminated union, not a nullable meal id: the UI must render a
 * deliberate "we have nothing for you tonight" state, and that state differs
 * per reason (empty_rotation sends the user to seeding; swaps_exhausted shows
 * the two PD-001 exits). Forcing the caller to switch on `kind` makes it
 * impossible to render a blank screen by accident.
 */
export type DecisionResult =
  | {
      readonly kind: 'suggestion';
      readonly mealId: MealId;
      readonly reasonCode: ReasonCode;
      readonly reasonText: string;
      /** How many more "Iets anders" taps are allowed today: 2 on the first offer, then 1, then 0. */
      readonly alternativesRemaining: 0 | 1 | 2;
    }
  | {
      readonly kind: 'no_candidate';
      readonly reason: NoCandidateReason;
    };

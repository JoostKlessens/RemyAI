/**
 * Step 1 of the decision engine: hard exclusions.
 *
 * A meal that fails any check here is ineligible, full stop — it never
 * reaches scoring. Nothing in this module mutates its inputs; every
 * function returns a new array or set.
 *
 * Two independent gates live here and are never merged:
 * `filterByRestrictionsAndTimeBudget` (the household's standing settings,
 * carrying the PD-006 allergen guarantee) and `filterByDecisionFilters`
 * (PD-009 — what the user asked for tonight). See the latter's own comment
 * for why keeping them apart is load-bearing rather than tidiness, and for
 * the one place they deliberately contradict each other.
 *
 * ---
 *
 * Allergen vs. dislike, both hard (v1 decision):
 *
 * The brief asked us to weigh whether dislikes should be a soft (scored)
 * penalty instead of a hard exclusion. We keep both hard for v1:
 * serving someone a dish tagged with something they've said they dislike
 * breaks trust in the same way an allergen slip would, just with lower
 * stakes — and the product's entire premise is "one dish, stated with
 * confidence." A dish that's technically eligible but tagged as disliked
 * would force the reason text to either lie by omission or undermine
 * itself ("Klaar in 20 minuten" while serving someone mushrooms they
 * hate). An occasional `no_candidate` from a small rotation is a cheaper
 * failure mode than a "why did you suggest THIS" moment. If the rotation
 * turns out to be too small for households with several dislikes, that's
 * a signal to grow the rotation (seeding, Feed saves), not to quietly
 * start ignoring stated preferences.
 *
 * ---
 *
 * Allergen semantics — EXCLUSION ONLY:
 *
 * `Restriction.excludesTag` (type 'allergen') only ever removes a meal
 * from consideration. Nothing in this module — or anywhere downstream —
 * may be read as "this meal is safe for a given allergy." A meal that
 * carries no matching tag is simply *untagged* for that allergen, not
 * verified free of it (ingredient tagging is user/curator-entered data,
 * not lab-verified). Reason text (see reason.ts) never mentions allergens
 * at all, precisely so nothing can be misread as a safety claim.
 *
 * Consent gating (PD-005) is enforced upstream, at collection time — see
 * `Member.healthDataConsentAt`. By the time a `Restriction` row reaches
 * this module inside `DecisionRequest`, its existence is the caller's
 * assertion that it's valid data to exclude on. This module does not
 * re-derive or second-guess consent state: the only safe failure mode for
 * a restriction record is to exclude, never to silently drop it because
 * some other precondition looks unmet.
 *
 * ---
 *
 * PD-006 — the allergen tag tri-state gate:
 *
 * A meal's `ingredientTags` alone used to be the whole story, which meant a
 * title-only seeded meal (empty `ingredientTags`, never reviewed by a
 * human) was structurally indistinguishable from a meal a human actually
 * checked and found clean — both simply "had no matching tag." For a
 * household with an allergen restriction, that made every seeded meal
 * silently unfilterable forever.
 *
 * `Meal.allergenTagStatus` fixes that: `'unknown'` (the default) means
 * nobody has gone through this meal's tags yet; `'verified'` means a human
 * has. Below, `isAllergenStatusEligible` excludes `'unknown'` meals — but
 * ONLY for a household that actually has an allergen restriction (point 2
 * of PD-006: a household with none sees zero extra friction).
 *
 * We exclude rather than "surface with an explicit caveat" (the other
 * option PD-006 allows): the caveat path needs a reasonText/UI affordance
 * change reaching into `decide.ts`'s caller and the Vanavond screen, both
 * owned by another agent this change doesn't touch. It also risks the
 * caveat copy drifting into something that reads as a safety claim later —
 * exactly what the three-rules-that-override-everything header in
 * docs/PRODUCT-DECISIONS.md forbids. Excluding keeps "we don't know" and
 * "assume the worst" the same thing everywhere in this codebase, with no
 * new UI surface. The cost — a smaller candidate pool until the household
 * completes the one bounded seed-time screen PD-006 point 3 describes — is
 * a strictly cheaper failure mode than serving a dish nobody ever checked.
 */

import type {
  AllergenTagStatus,
  DecisionFilters,
  Household,
  Meal,
  MealId,
  Member,
  Restriction,
} from './types';
import { readMealDishMoods } from './dishMoods';
import { normalizeTag } from './normalizeTag';

/**
 * Every `excludesTag` value across all restrictions (allergen and dislike
 * alike — see module note) belonging to members of this household.
 * Restrictions referencing a member id not present in `members` are
 * ignored defensively; they should never occur given how requests are
 * assembled, but a stray row must never silently fail OPEN (i.e. never
 * be excluded) when we can just as easily exclude it as scope creep.
 */
export function collectExcludedTags(
  members: readonly Member[],
  restrictions: readonly Restriction[],
): ReadonlySet<string> {
  const memberIds = new Set(members.map((member) => member.id));
  const excludedTags = new Set<string>();
  for (const restriction of restrictions) {
    if (!memberIds.has(restriction.memberId)) {
      continue;
    }
    // PD-006: normalize here too (not just at entry) so a stray
    // un-normalized value — legacy data, a caller that bypassed
    // RestrictionTagInput — still compares reliably against normalized
    // meal tags below, rather than silently failing open.
    excludedTags.add(normalizeTag(restriction.excludesTag));
  }
  return excludedTags;
}

function hasExcludedTag(meal: Meal, excludedTags: ReadonlySet<string>): boolean {
  return meal.ingredientTags.some((tag) => excludedTags.has(normalizeTag(tag)));
}

/**
 * PD-006, point 2: whether any restriction belonging to this household is
 * an *allergen* (as opposed to a dislike). Only households with at least
 * one allergen restriction are subject to the tri-state gate below — this
 * is a minority of households, and the rest must see zero extra friction.
 */
function hasAllergenRestriction(members: readonly Member[], restrictions: readonly Restriction[]): boolean {
  const memberIds = new Set(members.map((member) => member.id));
  return restrictions.some(
    (restriction) => memberIds.has(restriction.memberId) && restriction.type === 'allergen',
  );
}

/** A meal built before `allergenTagStatus` existed is exactly the "we don't actually know" case PD-006 is about. */
function resolveAllergenTagStatus(meal: Meal): AllergenTagStatus {
  return meal.allergenTagStatus ?? 'unknown';
}

/** See the PD-006 module note above for why "exclude" was chosen over "surface with a caveat." */
function isAllergenStatusEligible(meal: Meal, requiresVerifiedAllergenStatus: boolean): boolean {
  if (!requiresVerifiedAllergenStatus) {
    return true;
  }
  return resolveAllergenTagStatus(meal) === 'verified';
}

function isWithinTimeBudget(meal: Meal, household: Household): boolean {
  // A meal with no recorded estimate can't be judged against the budget;
  // treat "unknown" as "not disqualified" rather than penalizing missing
  // data with exclusion (missing data is a seeding/content problem, not
  // a reason to hide a meal from a tired household that might otherwise
  // be happy to cook it).
  if (meal.estimatedMinutes === null) {
    return true;
  }
  return meal.estimatedMinutes <= household.weeknightTimeBudgetMinutes;
}

/** Defends against `archivedAt` leaking through even though the contract says candidateMeals is pre-filtered. */
export function filterUnarchived(meals: readonly Meal[]): readonly Meal[] {
  return meals.filter((meal) => meal.archivedAt === null);
}

/**
 * Step 1 minus the "already offered today" check (see
 * `excludeAlreadyOffered`) — restrictions and time budget only. Kept
 * separate so `decide.ts` can tell "nothing survives restrictions/time"
 * (`all_excluded`) apart from "something survives but it's already been
 * offered today" (`swaps_exhausted`).
 */
export function filterByRestrictionsAndTimeBudget(
  meals: readonly Meal[],
  household: Household,
  members: readonly Member[],
  restrictions: readonly Restriction[],
): readonly Meal[] {
  const excludedTags = collectExcludedTags(members, restrictions);
  const requiresVerifiedAllergenStatus = hasAllergenRestriction(members, restrictions);
  return meals.filter(
    (meal) =>
      !hasExcludedTag(meal, excludedTags) &&
      isWithinTimeBudget(meal, household) &&
      isAllergenStatusEligible(meal, requiresVerifiedAllergenStatus),
  );
}

/**
 * PD-009 — tonight's stated filters, and NOTHING else.
 *
 * Kept as its own function rather than folded into
 * `filterByRestrictionsAndTimeBudget` above, on purpose. That function
 * carries the PD-006 allergen-exclusion guarantee, and a guarantee is only
 * as strong as the smallest thing you can read in one sitting and be sure
 * about. The moment a category filter and an allergen gate share a
 * predicate, every future edit to "kies iets met pasta" is also an edit to
 * the code path that decides whether someone with a nut allergy is shown a
 * dish — and reviewing the former does not put anyone in the frame of mind
 * to check the latter. One responsibility each: that one excludes on
 * safety and standing household settings, this one narrows what the user
 * asked to narrow. `decide.ts` composes them, in that order, and reports
 * their two empty results as two different `NoCandidateReason`s.
 *
 * The rejected alternative was a single `filterCandidates(meals, context)`
 * taking everything at once. It reads tidier at the call site and is worse
 * everywhere else: it makes `all_excluded` and `filtered_out`
 * indistinguishable without re-running the parts separately anyway, and it
 * would have quietly given `maxMinutes` and `weeknightTimeBudgetMinutes`
 * one shared implementation — which is exactly the thing they must not
 * have (see `isWithinMaxMinutes` below).
 *
 * Note also what is NOT here: no restriction data, no `Household`, no
 * `allergenTagStatus`. A filter cannot widen the pool, because it never
 * sees the inputs that narrowed it.
 */
export function filterByDecisionFilters(meals: readonly Meal[], filters: DecisionFilters): readonly Meal[] {
  const requiredTags = filters.requiredDishTags.map(normalizeTag);
  const requestedMoods = filters.anyDishMoods.map(normalizeTag);
  return meals.filter(
    (meal) =>
      isWithinMaxMinutes(meal, filters.maxMinutes) &&
      hasEveryRequiredDishTag(meal, requiredTags) &&
      hasAnyRequestedDishMood(meal, requestedMoods),
  );
}

/**
 * The "no filters stated" identity — `filterByDecisionFilters(meals,
 * NO_DECISION_FILTERS)` returns every meal.
 *
 * Exported so callers that must pass a filter set but genuinely have none
 * (the persisted daily decision, tests, the Kiezen screen's initial state)
 * name that intent instead of re-typing an object literal whose meaning
 * depends on remembering that `null` and `[]` are the neutral values.
 */
export const NO_DECISION_FILTERS: DecisionFilters = {
  maxMinutes: null,
  requiredDishTags: [],
  anyDishMoods: [],
};

/**
 * THE DELIBERATE ASYMMETRY WITH `isWithinTimeBudget` ABOVE. Read both
 * together before changing either; they disagree, and that is the design.
 *
 * `isWithinTimeBudget` treats an unknown `estimatedMinutes` as "not
 * disqualified": `Household.weeknightTimeBudgetMinutes` is a standing
 * background preference the household set once, and silently hiding every
 * untimed meal from it would punish a content gap (a link import that
 * yielded no duration) as if it were a user choice.
 *
 * An explicit `maxMinutes` is the opposite kind of statement. "Ik heb
 * vanavond 20 minuten" is about right now, said out loud, on the screen
 * where a dish is about to be named with confidence. A meal whose duration
 * nobody ever recorded is not an honest answer to it — offering one would
 * mean answering "does this fit in 20 minutes?" with "possibly", in a
 * product whose entire premise is one dish stated without hedging. So
 * unknown loses here.
 *
 * The cost is real and accepted: a household whose library is mostly
 * untimed imports will see `filtered_out` the first time it asks for
 * something quick. That is a legible, one-tap-recoverable failure (the
 * copy in NoCandidateState offers exactly that tap) and it points at a
 * genuine data gap, rather than papering over it with a dish that might
 * take an hour.
 */
function isWithinMaxMinutes(meal: Meal, maxMinutes: number | null): boolean {
  if (maxMinutes === null) {
    return true;
  }
  if (meal.estimatedMinutes === null) {
    return false;
  }
  return meal.estimatedMinutes <= maxMinutes;
}

/**
 * AND, not OR: asking for "pasta" and "vegetarisch" is one request for a
 * vegetarian pasta, not an invitation to serve either. OR would make each
 * extra chip widen the pool, so a household narrowing its way to a
 * decision would watch the result get vaguer with every tap.
 *
 * Reads `meal.dishTags` and never `meal.ingredientTags` — those are
 * allergens, an entirely separate vocabulary pointed the opposite
 * direction (see `Meal.dishTags` in types.ts and dishTags.ts's header).
 * Both sides go through `normalizeTag` for the same defensive reason
 * `collectExcludedTags` does: a stray un-normalized value from legacy data
 * or a caller that bypassed `sanitizeDishTags` must still compare, rather
 * than silently matching nothing.
 */
function hasEveryRequiredDishTag(meal: Meal, requiredTags: readonly string[]): boolean {
  if (requiredTags.length === 0) {
    return true;
  }
  const mealTags = new Set(meal.dishTags.map(normalizeTag));
  return requiredTags.every((tag) => mealTags.has(tag));
}

/**
 * ANY, where `hasEveryRequiredDishTag` above is EVERY. The two predicates
 * sit next to each other precisely so the disagreement is impossible to
 * miss; the argument for it lives on `DecisionFilters.anyDishMoods` in
 * types.ts, and the short version is that a composition is one dish with
 * several properties while a craving is several dishes any of which would
 * do. The mood vocabulary is built in opposing pairs, so EVERY across a
 * pair would be empty by construction rather than merely strict.
 *
 * Between the two axes it stays AND: `filterByDecisionFilters` conjoins
 * them, so "pasta" and ("zomers" or "licht") is one narrowing, not two.
 *
 * Reads `Meal.dishMoods` through `readMealDishMoods` and NEVER
 * `meal.dishTags` or `meal.ingredientTags` — three fields of identical
 * shape on one row, and the whole point of keeping them apart is that no
 * predicate reaches across. Both sides go through `normalizeTag` for the
 * same defensive reason the tag predicate does: a stray un-normalized
 * value from legacy data or a caller that bypassed `sanitizeDishMoods`
 * must still compare rather than silently matching nothing.
 */
function hasAnyRequestedDishMood(meal: Meal, requestedMoods: readonly string[]): boolean {
  if (requestedMoods.length === 0) {
    return true;
  }
  const mealMoods = new Set(readMealDishMoods(meal).map(normalizeTag));
  return requestedMoods.some((mood) => mealMoods.has(mood));
}

/** A swap must never repeat a meal already offered today (original or a prior swap). */
export function excludeAlreadyOffered(
  meals: readonly Meal[],
  excludedMealIds: readonly MealId[],
): readonly Meal[] {
  const excluded = new Set(excludedMealIds);
  return meals.filter((meal) => !excluded.has(meal.id));
}

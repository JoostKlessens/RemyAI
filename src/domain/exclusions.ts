/**
 * Step 1 of the decision engine: hard exclusions.
 *
 * A meal that fails any check here is ineligible, full stop — it never
 * reaches scoring. Nothing in this module mutates its inputs; every
 * function returns a new array or set.
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
  Household,
  Meal,
  MealId,
  Member,
  Restriction,
} from './types';
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

/** A swap must never repeat a meal already offered today (original or a prior swap). */
export function excludeAlreadyOffered(
  meals: readonly Meal[],
  excludedMealIds: readonly MealId[],
): readonly Meal[] {
  const excluded = new Set(excludedMealIds);
  return meals.filter((meal) => !excluded.has(meal.id));
}

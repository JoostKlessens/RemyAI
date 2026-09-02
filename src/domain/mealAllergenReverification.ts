/**
 * PD-006, applied to the one act the decision never anticipated: EDITING A
 * MEAL THAT WAS ALREADY VERIFIED.
 *
 * ============================================================================
 * THE CLAIM `verified` MAKES, AND WHY AN INGREDIENT EDIT VOIDS IT
 * ============================================================================
 *
 * PD-006.1 defines the tri-state in one sentence: "`verified` means a human
 * (the user or a curator) tagged it." Read it carefully and notice what "it"
 * is. It is not the meal's NAME, and it is not the meal's row id. A person
 * tagging allergens is looking at an INGREDIENT LIST and answering a question
 * about that list — AllergenTaggingSection says so out loud on the screen
 * where the answer is given ("Bekijk de ingrediënten hierboven en tag wat van
 * toepassing is"). The verification is a claim about a list.
 *
 * So when somebody edits the ingredients of a meal marked `verified`, the
 * list the human checked no longer exists. Carrying the flag across that edit
 * would mean the app asserting that a person confirmed a list they have never
 * seen. That is precisely PD-006.4's forbidden state — a meal "silently
 * suggested to a household with an allergen restriction as though it had been
 * checked" — reached by a different door. The seed-time door was "we never
 * had ingredients"; this one is "we had ingredients, a human checked them,
 * and then they became different ingredients". Same lie, same consequence.
 *
 * THIS IS NOT A NEW PRODUCT DECISION AND MUST NOT BE READ AS ONE. It is
 * PD-006's own definition of `verified` applied to a case PD-006 did not
 * enumerate, and every alternative reading requires WEAKENING that
 * definition. The genuinely open product question — whether the household
 * should then be actively prompted to re-tag, PD-006.3's bounded screen, at
 * some later moment — is deliberately NOT answered anywhere in this file.
 * Nothing here schedules, nags or notifies.
 *
 * ============================================================================
 * THE TWO MOVES ARE ASYMMETRIC, AND THAT ASYMMETRY IS THE SAFETY ARGUMENT
 * ============================================================================
 *
 * An edit that changes the ingredients does exactly two things, and they
 * point the same direction:
 *
 *   THE STATUS IS DEMOTED to 'unknown'. For a household with an allergen
 *   restriction, `isAllergenStatusEligible` (exclusions.ts) then drops the
 *   meal out of the candidate pool until a human checks the new list. That
 *   is strictly NARROWING: a meal leaves the pool, none enters it.
 *
 *   THE TAGS ARE KEPT, EXACTLY AS THEY WERE. This is the half that is easy
 *   to get backwards, and getting it backwards is the dangerous direction.
 *   `Meal.ingredientTags` is what `hasExcludedTag` filters on, so a tag is
 *   an EXCLUSION: clearing "noten" off a meal because its ingredient list
 *   moved would hand that meal straight back to a nut-allergic household,
 *   and it would do it silently, as a side effect of a typo fix. Keeping a
 *   possibly-stale tag can only ever exclude a dish that might have been
 *   eligible — a missed dinner. Dropping one can serve somebody a peanut.
 *   PD-006's own principle settles which cost to prefer: "Claiming an
 *   exclusion we cannot honour is worse than admitting ignorance", and the
 *   mirror of that is that a standing exclusion is never given up by
 *   accident.
 *
 * Both moves are therefore fail-closed, and neither can be reversed except
 * by the one act PD-006 recognises: a human tagging the list in front of
 * them. `MealAllergenCheck` below is what that act looks like as a value.
 *
 * ============================================================================
 * WHY A TITLE EDIT DOES NOT DEMOTE
 * ============================================================================
 *
 * The blunt alternative — demote on ANY edit — was considered and rejected.
 * If the verification is a claim about the ingredient list, then it survives
 * exactly as long as the ingredient list does, and no longer. Fixing a typo
 * in a title, correcting 25 minutes to 35, or changing the servings does not
 * change what is in the dish, so the human's answer still describes it
 * precisely. Demoting there would be friction with no safety bought — and
 * worse, it would quietly pull a verified meal out of an allergic
 * household's rotation because somebody fixed a spelling mistake, teaching
 * them that the tri-state is noise. A safety gate people learn to ignore is
 * not a safety gate.
 *
 * ============================================================================
 * WHAT COUNTS AS "THE LIST CHANGED", AND WHY IT IS DELIBERATELY CRUDE
 * ============================================================================
 *
 * `haveIngredientsChanged` compares the lists POSITIONALLY, on all three
 * stated parts (name, quantity, unit), and calls any difference a change.
 * It does not try to decide that "400 g" -> "600 g" is only an amount, that
 * a reorder is not a change, or that a removed line cannot have carried an
 * allergen. Every one of those refinements is the same offer the no-re-parser
 * rule in import/editedIngredients.ts already refused, wearing a safety hat:
 * a judgement about food we cannot verify, whose failures are silent and
 * stored. Being crude here costs a re-tag that was not strictly necessary;
 * being clever costs the thing PD-006 exists to protect. The comparison
 * always errs toward "changed", and that is the correct direction for it to
 * err in.
 *
 * The three parts are trimmed before comparison, and nothing else is
 * normalised — the same rule, for the same reason, as
 * import/editedIngredients.ts's whitespace ruling: the save path already
 * trims, so an invisible trailing space a soft keyboard inserted on its own
 * would otherwise cost a household its verification for a character nobody
 * can see. Anything that survives trimming counts, internal whitespace
 * included.
 *
 * ============================================================================
 * WHY THE CHECK IS A DISCRIMINATED UNION AND NOT AN `AllergenTagStatus`
 * ============================================================================
 *
 * The obvious shape for the caller's answer is the field itself — pass
 * `allergenTagStatus` alongside the edit. It is also the shape that makes
 * the bug trivial to write, because a caller holding a `Meal` produces it by
 * spreading: `allergenTagStatus: meal.allergenTagStatus`. That line compiles,
 * reads as diligent, and asserts a human checked a list that did not exist
 * when they checked it. This repo has shipped the mirror-image of that
 * mistake three times ("every layer had the value and every layer left it
 * out"); this is the version where every layer carries a stale value
 * FORWARD.
 *
 * `MealAllergenCheck` cannot be produced by copying a field off a row. Its
 * `'rechecked'` member has to be constructed, by name, with the tags the
 * person just confirmed — which is a sentence about something that happened,
 * not a column being echoed. A caller with nothing to say says
 * `NOT_RECHECKED` and gets the fail-closed answer. That is the type
 * forbidding the violation rather than documenting it.
 *
 * Pure, like everything under src/domain: no I/O, no clock, no throwing, and
 * nothing here mutates or reorders an input.
 */

import { normalizeTag } from './normalizeTag';
import type { AllergenTagStatus } from './types';

/**
 * The parts of one ingredient that say what is in the dish.
 *
 * Structurally satisfied by both `MealIngredient` (the persisted row) and
 * `MealIngredientInput` (what a write path hands the repository), so neither
 * side needs an adapter — the same trick `shopping/types.ts`'s
 * `RawIngredientLine` plays, and for the same reason: this module cares
 * about three fields and should not import the full contract of either
 * shape to reach them.
 *
 * `id` and `sortOrder` are deliberately absent. Ids churn on every save (the
 * repository replaces child rows rather than diffing them), and order is
 * already carried by the array. Including either would make a comparison
 * about storage mechanics rather than about food.
 */
export interface ComparableIngredient {
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
}

/**
 * A meal's allergen answer as one value: the tags, and whether a human
 * stands behind them.
 *
 * The two travel together because they are one statement — a tag list with
 * no status is a set of exclusions nobody vouched for, and a status with no
 * tags is a vouch for nothing. Splitting them across two fields of an input
 * object is how one of them gets updated without the other.
 */
export interface MealAllergenState {
  readonly ingredientTags: readonly string[];
  readonly allergenTagStatus: AllergenTagStatus;
}

/**
 * Whether a human tagged allergens against the ingredient list IN THIS EDIT.
 *
 * `'rechecked'` is a statement about an act, and only a screen that actually
 * put the list in front of somebody may make it. Confirming zero tags is
 * still a check — "none of these are in it" is an answer, and PD-006 already
 * treats it as one everywhere else.
 */
export type MealAllergenCheck =
  | { readonly kind: 'not_rechecked' }
  | { readonly kind: 'rechecked'; readonly tags: readonly string[] };

/** The honest default: nobody looked at the list during this edit. */
export const NOT_RECHECKED: MealAllergenCheck = { kind: 'not_rechecked' };

/** A human tagged the list in front of them. The one act that earns `verified` (PD-006.1). */
export function recheckedAllergens(tags: readonly string[]): MealAllergenCheck {
  return { kind: 'rechecked', tags };
}

/** A stated part, compared as the save path would store it. See the header's whitespace ruling. */
function samePart(before: string | null, after: string | null): boolean {
  return (before?.trim() ?? '') === (after?.trim() ?? '');
}

/**
 * "Is this still the list somebody checked?" — positional, all three stated
 * parts, any difference is a change. See the header for why it is
 * deliberately crude and why it errs toward "changed".
 */
export function haveIngredientsChanged(
  before: readonly ComparableIngredient[],
  after: readonly ComparableIngredient[],
): boolean {
  if (before.length !== after.length) {
    return true;
  }
  return before.some((ingredient, index) => {
    const edited = after[index];
    return (
      edited === undefined ||
      !samePart(ingredient.name, edited.name) ||
      !samePart(ingredient.quantity, edited.quantity) ||
      !samePart(ingredient.unit, edited.unit)
    );
  });
}

/**
 * PD-006's non-negotiable normalisation, applied to tags a human just
 * confirmed so `Set.has()` comparisons against a household's restrictions
 * stay reliable ("One shared `normalizeTag()` — lowercase, trim, strip
 * diacritics — used by BOTH restriction entry and meal tagging").
 *
 * De-duplicates, which can only ever shorten the list and never weaken it:
 * two spellings of one tag exclude exactly the dishes one spelling of it
 * excludes. Blank entries are dropped rather than stored, because an empty
 * string is a tag no restriction can ever match and therefore an exclusion
 * that silently does nothing.
 *
 * A new array, always. The caller's array is never sorted, spliced or
 * written into.
 */
function normalizeConfirmedTags(tags: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const clean = normalizeTag(tag);
    if (clean.length === 0 || seen.has(clean)) {
      continue;
    }
    seen.add(clean);
    normalized.push(clean);
  }
  return normalized;
}

export interface MealAllergenEditContext {
  /** The meal's allergen answer as it stands, before this edit. */
  readonly stored: MealAllergenState;
  /** The ingredient list the stored answer was given against. */
  readonly storedIngredients: readonly ComparableIngredient[];
  /** The ingredient list this edit is about to write. */
  readonly editedIngredients: readonly ComparableIngredient[];
  /** Whether a human tagged the edited list during this edit. */
  readonly check: MealAllergenCheck;
}

/**
 * The whole ruling, in three branches. Read the module header first; this
 * function is short precisely because the argument is written down once,
 * above, instead of being spread across the cases.
 *
 *   A HUMAN RECHECKED -> `verified`, with the tags they just confirmed.
 *   This is the only branch that may PROMOTE, and the only one that may
 *   drop a tag — both are the same human act, made explicitly, against the
 *   list they were looking at. It is also the only way back from a
 *   demotion, which is what stops the rule below from being a dead end.
 *
 *   NOBODY RECHECKED AND THE LIST MOVED -> `unknown`, tags untouched.
 *   The demotion. Strictly narrowing on both counts — see the header.
 *
 *   NOBODY RECHECKED AND THE LIST IS THE SAME -> nothing changes.
 *   The stored answer still describes the stored list exactly.
 *
 * A stored `allergenTagStatus` of `undefined` — `Meal.allergenTagStatus` is
 * optional for rows that predate the column — is resolved to `'unknown'` by
 * the caller that builds `stored` (the repository reads it through the same
 * `?? 'unknown'` exclusions.ts uses), so this function never has to invent
 * a reading and never hands one back.
 */
export function resolveAllergenStateAfterEdit(context: MealAllergenEditContext): MealAllergenState {
  const { stored, storedIngredients, editedIngredients, check } = context;

  if (check.kind === 'rechecked') {
    return { ingredientTags: normalizeConfirmedTags(check.tags), allergenTagStatus: 'verified' };
  }

  const status: AllergenTagStatus = haveIngredientsChanged(storedIngredients, editedIngredients)
    ? 'unknown'
    : stored.allergenTagStatus;

  return { ingredientTags: stored.ingredientTags, allergenTagStatus: status };
}

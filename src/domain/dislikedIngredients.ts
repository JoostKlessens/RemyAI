/**
 * GAP-34 — dislikes over INGREDIENT NAMES.
 *
 * ===========================================================================
 * WHY THIS MODULE EXISTS
 * ===========================================================================
 *
 * Until 10 September 2026 a typed dislike was compared against
 * `Meal.ingredientTags` (exclusions.ts's `hasExcludedTag`), and that field is
 * the denormalized union of EU-14 ALLERGEN tags — filled from one closed chip
 * list at import time and from nothing else. `paddenstoelen`, the example the
 * app's own placeholder suggests, is not an allergen, so it was stored and
 * never excluded a single dish. The names a dish is actually made of live on
 * `MealIngredient.name`, one row per line, and no filter anywhere read them.
 *
 * THE OBVIOUS FIX WAS REFUSED. Copying ingredient names into
 * `Meal.ingredientTags` would make a category of free text drive the PD-006
 * allergen gate — types.ts forbids exactly that in capitals, and a wrong
 * allergen tag costs someone a reaction where a wrong dislike costs a missed
 * suggestion. So ingredient NAMES travel beside the meals, on
 * `DecisionRequest.ingredientsByMeal`, and this module is the only reader.
 * Nothing here touches `ingredientTags`, and `collectDislikeTerms` looks at
 * `type === 'dislike'` rows only; the allergen path in exclusions.ts is
 * untouched by this change and still reads tags only.
 *
 * ===========================================================================
 * THE MATCHING RULE: WHOLE WORDS, NEVER SUBSTRINGS
 * ===========================================================================
 *
 * The lesson mainIngredients.ts and ingredientCategories.ts already paid for:
 * `boter` is inside `boterhamworst`, `water` inside `waterkers`. A substring
 * rule excludes ham sausage for someone who dislikes butter. Both sides are
 * therefore normalized through `normalizeIngredientName` — lowercase, no
 * diacritics, the preparation note after the first comma dropped — and split
 * into words with the same `splitIntoWords` the category table uses, and a
 * dislike matches a line only when EVERY word of the dislike is a whole word
 * of the line. Quantities cost nothing: "250 g paddenstoelen" splits into
 * `250`, `g`, `paddenstoelen`, and the first two simply never equal anything.
 *
 * A DISLIKE THAT NAMES A KIND REACHES THE WHOLE KIND. "Ik lust geen vis" is
 * a real dislike, and the word `vis` appears in almost no ingredient line —
 * zalmfilet, kabeljauw and tonijn never say it. When the entire dislike is
 * one of the twelve `INGREDIENT_CATEGORIES` names, an ingredient
 * `categorizeIngredient` files under that category matches too. That is the
 * one honest use of the category table here: it answers "what KIND of thing
 * is this line", which is the question a kind-shaped dislike asks. It is NOT
 * used to widen an ordinary word — `paddenstoelen` and `champignons` share a
 * category, and a dislike of one does not reach the other, because "groente"
 * would then reach every vegetable in the library.
 *
 * ===========================================================================
 * UNKNOWN FAILS TOWARD NOT EXCLUDING — THE OPPOSITE OF THE ALLERGEN PATH
 * ===========================================================================
 *
 * A plural is its own word (`paddenstoel` does not match `paddenstoelen`),
 * a synonym is unknown (`champignons` is not `paddenstoelen`), and a meal
 * with no ingredient rows at all — a title-only seed — matches nothing.
 * Every one of those keeps the dish. That is the right direction HERE: a
 * dislike missed is a disappointment, and the household's remedy is to type
 * the word the recipe uses. exclusions.ts argues the opposite direction for
 * allergens, where "we don't know" and "assume the worst" must be the same
 * thing (PD-006). The two rules differ because the two costs differ, and
 * that difference is why they must never share a predicate.
 *
 * Pure: no I/O, no React, and nothing here mutates its arguments.
 */

import {
  categorizeIngredient,
  INGREDIENT_CATEGORIES,
  splitIntoWords,
  type IngredientCategory,
} from './ingredientCategories';
import { normalizeIngredientName } from './shopping/normalizeIngredient';
import type { DecisionRequest, MealId, MealIngredient, Member, Restriction } from './types';

/** One dislike as normalized whole words — `['rode', 'kool']`, `['vis']`. */
export type DislikeTerm = readonly string[];

/** What `DecisionRequest.ingredientsByMeal` carries; named here so the gate and its callers spell it once. */
export type IngredientsByMeal = DecisionRequest['ingredientsByMeal'];

/** The one field this module reads off an ingredient row. */
export type DislikeMatchableIngredient = Pick<MealIngredient, 'name'>;

/**
 * A single letter or a bare number is never a dislike; it is a unit or a
 * quantity that leaked into the field ("2 g"), and as a term it would match
 * half the library.
 */
const MIN_WORD_LENGTH = 2;

function isMatchableWord(word: string): boolean {
  return word.length >= MIN_WORD_LENGTH && !/^\d+$/.test(word);
}

function toDislikeTerm(excludesTag: string): DislikeTerm {
  return splitIntoWords(normalizeIngredientName(excludesTag)).filter(isMatchableWord);
}

/**
 * The household's dislikes as terms — `type === 'dislike'` ONLY. An allergen
 * restriction is never turned into a name term: its answer is the verified
 * tag tri-state in exclusions.ts and nothing else, and matching unverified
 * free text there would look like a check that never happened.
 *
 * A restriction from a member outside `members` is ignored, as
 * `collectExcludedTags` ignores it; a dislike that normalizes to nothing is
 * dropped rather than becoming a term that matches everything.
 */
export function collectDislikeTerms(
  members: readonly Member[],
  restrictions: readonly Restriction[],
): readonly DislikeTerm[] {
  const memberIds = new Set(members.map((member) => member.id));
  return restrictions
    .filter((restriction) => restriction.type === 'dislike' && memberIds.has(restriction.memberId))
    .map((restriction) => toDislikeTerm(restriction.excludesTag))
    .filter((term) => term.length > 0);
}

function isCategoryName(word: string): word is IngredientCategory {
  return (INGREDIENT_CATEGORIES as readonly string[]).includes(word);
}

/** Whether one ingredient line is what one dislike names — see the header for both halves of the rule. */
export function matchesDislikeTerm(ingredientName: string, term: DislikeTerm): boolean {
  if (term.length === 0) {
    return false;
  }
  const words = new Set(splitIntoWords(normalizeIngredientName(ingredientName)));
  if (term.every((word) => words.has(word))) {
    return true;
  }
  const [only] = term;
  return term.length === 1 && only !== undefined && isCategoryName(only) && categorizeIngredient(ingredientName) === only;
}

/** ANY line matching ANY term excludes the dish; no rows and no terms both mean "nothing to exclude on". */
export function hasDislikedIngredient(
  ingredients: readonly DislikeMatchableIngredient[],
  terms: readonly DislikeTerm[],
): boolean {
  if (terms.length === 0 || ingredients.length === 0) {
    return false;
  }
  return ingredients.some((ingredient) => terms.some((term) => matchesDislikeTerm(ingredient.name, term)));
}

/**
 * The repository's flat row list, keyed by meal, in the shape
 * `DecisionRequest.ingredientsByMeal` wants. Input order is preserved within
 * a meal; a meal with no rows has no entry, which the gate reads as "no
 * known ingredients" and keeps.
 */
export function groupIngredientsByMeal(
  ingredients: readonly MealIngredient[],
): ReadonlyMap<MealId, readonly MealIngredient[]> {
  const grouped = new Map<MealId, readonly MealIngredient[]>();
  for (const ingredient of ingredients) {
    grouped.set(ingredient.mealId, [...(grouped.get(ingredient.mealId) ?? []), ingredient]);
  }
  return grouped;
}

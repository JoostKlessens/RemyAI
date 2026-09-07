/**
 * An ingredient list, split into the sub-recipes the source itself named.
 *
 * ============================================================================
 * WHAT THE OWNER ASKED FOR
 * ============================================================================
 *
 * "als het recept de ingredienten verdeelt per categorie, bijvoorbeeld in
 * 'beslag' en 'frosting' dan moet het ook duidelijk zijn welke ingredienten
 * er per subonderdeel nodig zijn". A cake is two shopping lists that happen
 * to be printed under one title, and a reader standing at the counter with
 * the butter in their hand needs to know which of the two it is for.
 *
 * ============================================================================
 * THIS IS NOT A MATCHER, AND THAT IS THE WHOLE DIFFERENCE FROM ITS NEIGHBOUR
 * ============================================================================
 *
 * `ingredientCategories.ts` in this same directory DERIVES a category from an
 * ingredient's free text ("gele paprika" -> groente), and its header spends
 * its length arguing that a hand-maintained word table is the only version of
 * that this codebase can maintain. Nothing of the kind happens here. A
 * section is not inferred from anything: it is a heading the recipe PRINTED,
 * transcribed at import (buildExtractionRequest.ts asks for it verbatim and
 * forbids inventing one) and stored on the row (`meal_ingredients.section`,
 * migration 0018). This module only groups rows by a value they already
 * carry.
 *
 * That is why there is no vocabulary here, no closed list and no
 * normalisation beyond whitespace and case. A heading can be in any
 * language — the extraction prompt's standing rule is "preserve the source's
 * own language, do not translate" — so a Dutch word list would be wrong for
 * most of the world's recipes, and putting "Voor het/de ..." in front of a
 * label would be this app wrapping Dutch grammar around an Italian noun. The
 * label is rendered exactly as the source wrote it, trimmed.
 *
 * ============================================================================
 * THE FOUR RULINGS, EACH OF WHICH COULD REASONABLY HAVE GONE THE OTHER WAY
 * ============================================================================
 *
 * 1. `sortOrder` STAYS THE ONE ORDER. There is no second ordering column and
 *    migration 0018 deliberately adds none. A recipe lists its sub-recipes in
 *    an order, and that order is already fully expressed by the positions the
 *    ingredients occupy; a `section_order` beside it would be a second answer
 *    to a settled question, and the two would disagree the first time
 *    somebody edited one of them.
 *
 * 2. THE SAME HEADING TWICE IS ONE GROUP, NOT TWO. Runs would have been the
 *    simpler implementation — start a new group whenever the label changes —
 *    and it renders "Beslag" twice for a list whose labels are interleaved.
 *    REJECTED because a heading printed twice reads as deliberate, and the
 *    owner's ask is precisely that a reader can see "welke ingredienten er
 *    per subonderdeel nodig zijn" — all of them, in one place. The cost is
 *    named rather than hidden: an ingredient can move UP relative to a
 *    far-away ingredient of the same heading. That is affordable here and
 *    would not be for steps, because an ingredient list has no internal
 *    sequence to destroy — nobody cooks a list top to bottom — which is
 *    exactly why `MealStep` gets no equivalent of this function.
 *
 * 3. THE UNLABELLED INGREDIENTS COME FIRST, ALWAYS. Normally they already
 *    do: a recipe that names its sub-recipes usually names all of them, or
 *    prints its loose ingredients before the first heading. The case this
 *    ruling is for is the trailing orphan — a "snufje zout" the model left
 *    unlabelled after two labelled groups. Left where it sits, it renders
 *    underneath "Voor de frosting" with nothing to say it does not belong
 *    there, which is a heading claiming an ingredient the recipe never gave
 *    it. Hoisting it is visibly odd; a wrong heading is not visible at all,
 *    and the difference between visible and invisible is the whole reason
 *    this direction was chosen. The guarantee is worth stating plainly: NO
 *    INGREDIENT IS EVER RENDERED UNDER A HEADING ITS ROW DOES NOT NAME.
 *
 * 4. TWO SPELLINGS OF ONE HEADING ARE ONE HEADING. Compared on
 *    `trim().toLowerCase()`, displayed as the first spelling seen. A model
 *    transcribing "Beslag" once and "beslag" once has made a typographic
 *    slip, not named two sub-recipes. Deliberately NOT `normalizeTag` from
 *    this same directory: that function also strips diacritics, because it
 *    exists to match untrusted input against the closed PD-006 allergen
 *    vocabulary where "creme" and "crème" must be the same tag. A display
 *    heading is not a vocabulary lookup, and borrowing the allergen
 *    normaliser for one would put a safety-critical function on a
 *    presentational path, where a future tightening of it would silently
 *    change how a cake recipe is laid out.
 *
 * ============================================================================
 * THE ORDINARY RECIPE HAS NO SECTIONS AT ALL, AND MUST NOT NOTICE THIS FILE
 * ============================================================================
 *
 * Every `meal_ingredients` row in every install predates migration 0018, and
 * the great majority of rows written after it will still carry `null`: most
 * recipes are one list. Such a list comes back here as exactly ONE group with
 * `label: null`, holding every ingredient in `sortOrder` — which the screen
 * renders as the flat list it has always rendered, with no heading, no indent
 * and no separator. That is the case the tests lead with.
 *
 * A blank or whitespace-only section is read as no section rather than as an
 * empty heading, and a row missing the key entirely is read the same way. The
 * validator already refuses both on the way in (validateParsed.ts's
 * `readOptionalString`), so this is the second guard rather than the first —
 * table.ts's stance is that persisted data is untrusted input like any other,
 * and a row written by an older build, a future sync job or a manual fix-up
 * reaches this function without having passed that validator.
 *
 * Pure, like everything under src/domain: no I/O, no clock, no throwing, and
 * nothing here mutates, sorts or reorders the caller's array.
 */

import type { MealIngredient } from './types';

/**
 * The two fields this module reads, and nothing else.
 *
 * Structurally satisfied by `MealIngredient` (the persisted row), so the
 * screen passes its rows straight in — the same trick `ComparableIngredient`
 * (mealAllergenReverification.ts) and `RawIngredientLine` (shopping/types.ts)
 * play, and for the same reason: a module that cares about two fields should
 * not import the full contract of a row to reach them. `name`, `quantity` and
 * `unit` are deliberately absent — how a line READS is
 * `formatIngredientLine`'s question, and a grouping function that could see
 * the text would eventually be asked to guess a heading out of it.
 */
export type SectionedIngredient = Pick<MealIngredient, 'section' | 'sortOrder'>;

/**
 * One heading and the ingredients printed under it.
 *
 * `label: null` is the group for ingredients belonging to no sub-recipe. It
 * is a real answer and not a missing one — most recipes produce exactly this
 * group and nothing else — so the screen renders it with no heading at all
 * rather than inventing a word like "Overig" for something the recipe never
 * said.
 *
 * Generic over the ingredient so a caller gets its OWN rows back rather than
 * a narrowed copy: the screen needs `id` for a render key and the whole row
 * for `formatIngredientLine`, neither of which this module knows about.
 */
export interface IngredientSection<T extends SectionedIngredient> {
  readonly label: string | null;
  readonly ingredients: readonly T[];
}

/** Whitespace-only and absent both mean "this ingredient belongs to no sub-recipe" — see the header. */
function readSectionLabel(ingredient: SectionedIngredient): string | null {
  const section = ingredient.section;
  if (typeof section !== 'string') {
    return null;
  }
  const trimmed = section.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * An ingredient list as the sub-recipes it is made of, ready to render.
 *
 * Returns `[]` for an empty list — no groups, not one empty group — so the
 * screen's "geen ingrediënten" state stays the screen's own decision rather
 * than something it has to detect by looking inside a group.
 *
 * The list is sorted here rather than assumed sorted, because `sortOrder` is
 * the only thing carrying the recipe's order and a caller that forgot to sort
 * would otherwise get its headings in arrival order. `Array.prototype.sort`
 * has been stable since ES2019 and Hermes implements that, so two rows
 * sharing a `sortOrder` keep the order they arrived in rather than swapping
 * unpredictably between renders.
 */
export function groupIngredientsBySection<T extends SectionedIngredient>(
  ingredients: readonly T[],
): readonly IngredientSection<T>[] {
  const ordered = [...ingredients].sort((a, b) => a.sortOrder - b.sortOrder);

  const unlabelled: T[] = [];
  // Keyed on the case-folded label so two spellings meet; the VALUE keeps the
  // first spelling seen, which is what gets displayed. A Map because its
  // insertion order IS the first-appearance order ruling 2 rests on.
  const labelled = new Map<string, { label: string; ingredients: T[] }>();

  for (const ingredient of ordered) {
    const label = readSectionLabel(ingredient);
    if (label === null) {
      unlabelled.push(ingredient);
      continue;
    }
    const key = label.toLowerCase();
    const group = labelled.get(key);
    if (group === undefined) {
      labelled.set(key, { label, ingredients: [ingredient] });
      continue;
    }
    group.ingredients.push(ingredient);
  }

  // The unlabelled group first and unconditionally — ruling 3. When it is the
  // only group (the ordinary recipe) this produces the flat list the screen
  // has always drawn.
  const sections: IngredientSection<T>[] = unlabelled.length > 0 ? [{ label: null, ingredients: unlabelled }] : [];
  for (const group of labelled.values()) {
    sections.push({ label: group.label, ingredients: group.ingredients });
  }
  return sections;
}

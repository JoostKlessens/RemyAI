/**
 * The confirmation screen's field state, turned back into a `ParsedRecipe`
 * on the way to the write.
 *
 * EXTRACTED FROM src/app/import/confirm.tsx ON 10 SEPTEMBER 2026, and the
 * move is the point rather than a consequence of it. That file stood at
 * 963 lines against the 800 cap (docs/HANDOVER.md), but the cap is not
 * what makes this worth doing: vitest cannot import src/app — the
 * measurement is src/domain/offerablePool.ts's header — so a
 * rebuild-from-scratch living in a route module was logic no test could
 * reach. Both losses the function's own header memorialises below shipped
 * exactly that way, silently, and neither could have been asserted where
 * the code sat. tests/import/editedRecipe.test.ts is what the move buys;
 * the behaviour is unchanged, line for line.
 *
 * Pure, like everything else under src/domain: no I/O, no clock, no
 * throwing.
 */

import { resolveEditedIngredients } from './editedIngredients.ts';
import type { ParsedIngredient, ParsedRecipe } from './types';

/**
 * Everything the rebuild reads, named rather than counted off in
 * positional order. The screen holds four separate strings and two
 * separate lists, and a signature that takes them as six bare arguments is
 * one careless reorder away from writing the servings into the minutes —
 * a swap nothing downstream could notice, since both are "a small positive
 * number or null".
 *
 * THE TWO LISTS ARE LINES, NOT THE SCREEN'S ROW OBJECTS. The editable list
 * fields carry a local id alongside the text so React can key them; that
 * id is a rendering concern and means nothing here, so the caller passes
 * the text and this module never learns the component's shape.
 */
export interface EditedRecipeFields {
  readonly title: string;
  /** The ingredients as they ARRIVED: "unchanged" is a comparison, and there is nothing to compare a line against without them. `[]` is manual entry's real answer, not a fallback. */
  readonly arrivedIngredients: readonly ParsedIngredient[];
  readonly ingredientLines: readonly string[];
  readonly stepLines: readonly string[];
  readonly estimatedMinutesText: string;
  readonly servingsText: string;
  /** Carried, not edited — see `buildEditedRecipe`'s header. `[]` is a real value here, never a stand-in for "unknown": a recipe the user typed has no model-assigned categories. */
  readonly dishTags: readonly string[];
}

/** "25" -> 25; "" / "0" / "abc" -> null. Mirrors ParsedRecipe's own "only set when genuinely known" contract for these two fields. */
function parseOptionalPositiveInt(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Rebuilds a ParsedRecipe from the confirmation screen's current field
 * state. Every field lands in one of three categories, and the third is
 * scar tissue from two separate bugs of the same shape:
 *
 *  - EDITED — title, steps, minutes, servings. Read from the screen's
 *    state and NEVER from the pre-edit `recipe` route param. "Nothing is
 *    ever saved silently" (confirm.tsx's file header) means the correction
 *    the user made there is what gets persisted, so reading the arrival
 *    for any of these would quietly throw their edit away.
 *  - CARRIED — `dishTags`. Not editable on that screen, so there is no
 *    state to read it from; it travels through from the arrival,
 *    unchanged.
 *  - BOTH, PER LINE — `ingredients`, which is the second bug below.
 *
 * A FIELD IN NEITHER OF THE FIRST TWO IS SIMPLY GONE, AND THAT WAS LIVE.
 * This function used to name only the edited fields, so a user who fixed a
 * typo in the title silently lost the recipe's categories and
 * Bibliotheek's dishTag filter then under-reported what that household
 * owns. Nothing threw and nothing logged, because a rebuild-from-scratch
 * cannot notice what it failed to mention. `ParsedRecipe.dishTags` is
 * required (types.ts) exactly so the next carried field cannot go the same
 * way: it is passed in here, or this file does not compile.
 *
 * AND THE INGREDIENT FLATTENING THIS HEADER USED TO STATE AS AN OPEN COST
 * IS NOW SETTLED, in two halves, because it was two questions under one
 * name. The rebuild wrote every line back as `{ name: line, quantity:
 * null, unit: null }` on EVERY save, the great majority nobody had touched
 * included, so merely opening that screen destroyed amounts the source
 * gave us: `scaleRecipe.ts` cannot halve an amount folded into a name, and
 * the shopping list's quantity column came up empty. A line NOBODY TOUCHED
 * now carries its arriving `ParsedIngredient` through unchanged; a line
 * the user DID edit stays null, deliberately and permanently, since
 * splitting it back into three fields would be a parser inventing
 * structure nobody typed. That decision, whitespace ruling included, is
 * editedIngredients.ts's — pure and unit-tested, which until this move
 * the rebuild around it was not.
 */
export function buildEditedRecipe(fields: EditedRecipeFields): ParsedRecipe {
  return {
    title: fields.title,
    ingredients: resolveEditedIngredients(fields.arrivedIngredients, fields.ingredientLines),
    steps: fields.stepLines.map((text) => text.trim()).filter((text) => text.length > 0),
    estimatedMinutes: parseOptionalPositiveInt(fields.estimatedMinutesText),
    servings: parseOptionalPositiveInt(fields.servingsText),
    dishTags: fields.dishTags,
  };
}

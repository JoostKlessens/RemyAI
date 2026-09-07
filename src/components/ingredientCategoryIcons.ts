/**
 * ⚠ ZERO PRODUCTION CALLERS SINCE 7 SEPTEMBER 2026. READ THIS FIRST.
 *
 * This module had exactly one call site — the ingredient list on
 * src/app/recipe/[mealId].tsx — and the owner asked for the glyphs there to
 * go: "in het recept zelf (en met name de ingredientenlijst) [moeten] de
 * icoontjes niet komen te staan maar gewoon een duidelijke, overzichtelijke
 * opsomming van ingredienten". The list is now
 * src/components/RecipeIngredientList.tsx and draws no icons at all.
 *
 * NOTHING IN src/ IMPORTS THIS ANY MORE. `tests/ingredientCategories.test.ts`
 * still does, and still passes.
 *
 * IT WAS KEPT DELIBERATELY RATHER THAN DELETED. It was built the day before,
 * at the owner's own request (RCP-08/RCP-09), and it is fully tested; whether
 * a working, argued module leaves the codebase is a decision about the
 * product, not a side effect of one screen changing its mind. That is the
 * same treatment mainIngredients.ts got here for the same reason. Deleting it
 * is the owner's call to make, and a future surface that wants a food glyph
 * — a shopping list, a tile, a filter row — finds it here rather than
 * rebuilding it.
 *
 * DO NOT read the paragraphs below as a description of live behaviour. Every
 * argument in them is still true about what this code DOES; none of it is
 * currently reaching a screen.
 */
/**
 * One glyph per `INGREDIENT_CATEGORIES` entry — the drawing beside an
 * ingredient line, and nothing else.
 *
 * WHY THIS IS A SECOND FILE AND NOT A FIELD ON THE CATEGORY. Same split as
 * dishTags.ts / dishTagIcons.ts, and the reason is structural rather than
 * tidy: `src/domain` must not import from `src/components`, and `IconName`
 * lives here. It also keeps the two questions apart — what KIND of food a
 * line is, and what that kind LOOKS LIKE — so a redrawn glyph never edits
 * the vocabulary and a renamed category never edits the font.
 *
 * A FULL `Record`, NOT A `Partial`, and that is the opposite choice from
 * iconFont.ts's own registry. There, an absent key means "no font can draw
 * this" and absence had to be impossible to create by accident. Here every
 * category MUST name an icon, because the question "which drawing means
 * groente" always has an answer even when nothing can supply it yet. So the
 * compiler demands twelve entries, and whether a named icon can actually be
 * drawn is recorded in ONE place — the font registry — rather than in two
 * that can disagree.
 *
 * ALL TWELVE DRAW, AND THE LAST TWO TOOK A DIFFERENT ROUTE. `zuivel` and
 * `peulvruchten` rendered as bare lines for one afternoon: no milk, yoghurt,
 * butter, bean or lentil glyph exists in any of the fifteen families
 * `@expo/vector-icons` ships — measured across all fifteen glyphmaps on
 * 7 September 2026, where the only hit for "butter" is `butterfly`. They are
 * now drawn by this app itself (remyGlyphs.ts), which the seam hands back
 * exactly like a font glyph. That the `Partial`/`Record` split above cost
 * nothing when they arrived is the argument for it.
 *
 * `vis` REUSES `fish`, the icon the `visgerecht` dish tag already uses. That
 * is deliberate and is the same argument dishTagIcons.ts makes for `soep`
 * and `stamppot` reusing the display glyphs: minting `seafood` beside `fish`
 * would be a second name for one drawing, two rows to keep in step, and no
 * visible difference. The two vocabularies are separate; the pictures may
 * overlap where the pictures are the same.
 */

import type { IngredientCategory } from '@/domain/ingredientCategories';
import type { IconName } from './iconFont';

/**
 * Keyed by `IngredientCategory`, so the compiler catches a category added to
 * the vocabulary without a drawing — the failure a hand-maintained table
 * actually suffers, and the one dishTagIcons.ts can only catch from a test
 * because `DISH_TAGS` types its tags as `string`.
 */
const ICON_BY_INGREDIENT_CATEGORY: Readonly<Record<IngredientCategory, IconName>> = {
  groente: 'vegetables',
  fruit: 'fruit',
  // The two Remy draws itself, because no font had them — remyGlyphs.ts.
  zuivel: 'dairy',
  kaas: 'cheese',
  ei: 'egg',
  vlees: 'meat',
  vis: 'fish',
  peulvruchten: 'legumes',
  granen: 'grain',
  noten: 'nuts',
  kruiden: 'herbs',
  zoet: 'sweets',
};

/**
 * The icon for a category. Total rather than nullable, unlike
 * `iconForDishTag`: an `IngredientCategory` is a closed union the compiler
 * checks, so there is no "unknown category" case to answer for. The
 * "we cannot draw this" case lives one layer down in `isIconAvailable`,
 * where every other unavailable glyph in this app already lives.
 */
export function iconForIngredientCategory(category: IngredientCategory): IconName {
  return ICON_BY_INGREDIENT_CATEGORY[category];
}

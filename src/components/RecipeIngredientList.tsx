/**
 * A recipe's ingredients, as a plain list — grouped under the sub-recipe
 * headings the source printed, when it printed any.
 *
 * ============================================================================
 * IT HAS NO GLYPHS, AND THAT IS A REVERSAL RATHER THAN AN OMISSION
 * ============================================================================
 *
 * This list drew a category icon ahead of every line it could place — a fruit
 * glyph for both the apple and the banana — for one day, at the owner's
 * request. The owner then asked for the opposite in as many words: "in het
 * recept zelf (en met name de ingredientenlijst) [moeten] de icoontjes niet
 * komen te staan maar gewoon een duidelijke, overzichtelijke opsomming van
 * ingredienten".
 *
 * The argument the removed code made for itself was never wrong about the
 * glyphs; it was wrong about the surface. A tile in a grid is skimmed, and a
 * mark helps you find it. A shopping list is READ, top to bottom, and forty
 * small pictures down the left margin are forty things to look past on the
 * way to the words. Note that `RecipeTagRow` beside this component keeps its
 * icons and should: a pill row is a handful of items scanned sideways, which
 * is the case a mark was made for.
 *
 * `ingredientCategoryIcons.ts` and `ingredientCategories.ts` WERE NOT DELETED
 * with the call site. They were built at the owner's own request the day
 * before (RCP-08/RCP-09) and are fully tested; deleting a module is a
 * decision about the product, not a consequence of one screen changing its
 * mind. Both now carry a header note saying they have zero production
 * callers, and the choice is the owner's.
 *
 * ============================================================================
 * WHY IT IS A COMPONENT AND NOT TWO FUNCTIONS IN THE SCREEN
 * ============================================================================
 *
 * Exactly the reason `RecipeSourceLinkRow` and `RecipeTagRow` are: they
 * "started here and were lifted out at 782 lines, eighteen short of this
 * repo's 800-line ceiling" (src/app/recipe/[mealId].tsx's own header). Adding
 * sections pushed that screen to 806, and this repo's recorded answer to a
 * file at its ceiling is to find the seam it already argues for rather than
 * to shorten the arguments. This is that seam: purely presentational, reads
 * no repository, and the one thing on that screen with structure of its own.
 *
 * IT READS ITS OWN COLOURS, following `RecipeTagRow` rather than the screen's
 * "read once per screen, pass it down" note. A component taking a
 * `ReturnType<typeof getColors>` prop is one whose signature changes every
 * time the palette type does, and every other lifted-out component on that
 * screen already reads its own.
 *
 * ============================================================================
 * WHAT IT DOES NOT DECIDE
 * ============================================================================
 *
 * NOT WHAT A GROUP IS. `groupIngredientsBySection`
 * (src/domain/ingredientSections.ts) owns every ruling — the same heading
 * twice, ingredients with no heading, two spellings of one word, what
 * `sortOrder` means once headings exist — because those are decisions with
 * tests, not layout. This file draws what that function returns and asks it
 * nothing else.
 *
 * NOT THE EMPTY STATE. A recipe with no ingredients at all is a sentence the
 * screen owns (`RECIPE_OVERVIEW_NO_INGREDIENTS`), sitting beside the one it
 * owns for a recipe with no steps; the two have to agree in tone, and they
 * cannot if one of them lives out here.
 *
 * NOT THE TEXT OF A LINE. `formatIngredientLine` produces the whole string
 * and has since before any of this existed — unchanged when the icons
 * arrived, unchanged now they are gone — so nothing a screen reader hears has
 * moved in either direction across both changes.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { formatIngredientLine } from '@/components/friendCardVocabulary';
import { groupIngredientsBySection, type IngredientSection } from '@/domain/ingredientSections';
import type { MealIngredient } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';

export interface RecipeIngredientListProps {
  /**
   * The meal's ingredients. The caller does not have to settle their order:
   * `groupIngredientsBySection` sorts on `sortOrder`, which is the only thing
   * that carries a recipe's own order.
   */
  readonly ingredients: readonly MealIngredient[];
}

/**
 * One sub-recipe: its heading, when the source printed one, and its lines.
 *
 * THE HEADING IS THE RECIPE'S OWN WORDS AND IS NEVER TRANSFORMED. No
 * `textTransform: 'uppercase'`, even though that is exactly what
 * `typeScale.label` is paired with on the screen this came from — the eyebrow
 * there is a word this app chose ("DEZE WEEK") and this is a word the recipe
 * chose, possibly in Danish. Uppercasing somebody else's sentence is an edit,
 * and this list does not edit the recipe. Nothing is prefixed either: a Dutch
 * "Voor de ..." in front of an Italian noun is the same edit wearing a
 * different hat, and preserving the source's own language is the whole rule
 * the extraction prompt states for this field.
 *
 * `typeScale.label` FOR THE FACE, THOUGH — mono, semibold, tracked — against
 * the sans body of the lines under it. tokens.ts gives mono to what is
 * systemic and sans to what is content, and a sub-recipe heading is honestly
 * both: the app saying "this is a group", in the recipe's word for it. The
 * face carries the first half and the untransformed letters carry the second.
 * REJECTED: a larger sans heading, which competes with "Ingrediënten"
 * directly above it — the one heading in this part of the screen that has to
 * win.
 *
 * A GROUP WITH NO HEADING DRAWS BARE LINES, with no substitute label and no
 * divider. `groupIngredientsBySection` returns exactly one such group for a
 * recipe that names no sub-recipes, which is nearly all of them, so the
 * ordinary case leaves this component as the same flat list the screen drew
 * before any of this existed.
 */
function IngredientSectionBlock(props: {
  readonly section: IngredientSection<MealIngredient>;
  /** The first heading takes no top margin — see `firstHeading` below. */
  readonly isFirst: boolean;
  readonly colors: ReturnType<typeof getColors>;
}): JSX.Element {
  const { section, isFirst, colors } = props;
  return (
    <View>
      {section.label === null ? null : (
        <Text style={[typeScale.label, isFirst ? styles.firstHeading : styles.heading, { color: colors.textSecondary }]}>
          {section.label}
        </Text>
      )}
      {section.ingredients.map((ingredient) => (
        <Text key={ingredient.id} style={[typeScale.body, styles.line, { color: colors.textSecondary }]}>
          {formatIngredientLine(ingredient)}
        </Text>
      ))}
    </View>
  );
}

export function RecipeIngredientList(props: RecipeIngredientListProps): JSX.Element {
  const { ingredients } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const sections = groupIngredientsBySection(ingredients);

  return (
    <View>
      {sections.map((section, index) => (
        // The heading is the key, with the index as the fallback for the one
        // group that has none. Not the index alone: groups reorder when an
        // edit reorders the ingredients, and an index key would then be
        // reused across two different sub-recipes.
        <IngredientSectionBlock
          key={section.label ?? `unsectioned-${index}`}
          section={section}
          isFirst={index === 0}
          colors={colors}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // The same spacing the screen's step list uses, so two lists under two
  // sibling headings do not sit on different rhythms.
  line: {
    marginBottom: spacing.space2,
  },
  // A heading is spaced off the group ABOVE it rather than the one below: the
  // gap belongs to the boundary between two lists, and putting it under the
  // heading instead leaves the label floating between them.
  heading: {
    marginTop: spacing.space4,
    marginBottom: spacing.space2,
  },
  // The first heading sits directly under "Ingrediënten", which already
  // carries its own bottom margin, so it takes none on top — two margins
  // stacking there read as a missing paragraph.
  firstHeading: {
    marginBottom: spacing.space2,
  },
});

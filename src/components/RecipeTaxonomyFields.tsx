/**
 * The two descriptive taxonomies a person can correct about a dish they
 * already own: its categories, and its place in a meal.
 *
 * THE OWNER ASKED FOR BOTH, SEPARATELY:
 *   "Kan je de tags niet aanpassen handmatig? Het lijkt me wel handig dat
 *   je het recept kan aanpassen."
 *   "Ook wil ik ergens kunnen toevoegen dat een recept bijvoorbeeld een
 *   voorgerecht, bijgerecht of toetje is, standaard is iets een
 *   hoofdgerecht."
 *
 * WHAT THE FIRST ONE FIXED, because it was a defect and not a gap.
 * `meals.dish_tags` had exactly one writer — the extraction model reading a
 * caption at import — and manual entry wrote `[]`
 * (src/app/import/confirm.tsx). So a recipe the model tagged wrongly, and
 * every recipe anybody typed in by hand, was permanently invisible to the
 * library's dish-category filter with no way for any person to fix it. The
 * most-used filter in the app was wrong about part of every library, and no
 * amount of work on the filter control repairs that; only a writer does.
 *
 * WHY IT IS A COMPONENT RATHER THAN JSX IN THE SCREEN: the two rows put
 * src/app/recipe-edit/[mealId].tsx eight lines over this project's 800-line
 * ceiling. The seam is an honest one either way — everything below is about
 * describing a dish, and nothing in it knows what a save is.
 *
 * ===========================================================================
 * TWO ROWS, NOT ONE, AND THE REASON IS STRUCTURAL
 * ===========================================================================
 *
 * They look alike enough to merge and they must not be merged. A dish is
 * MADE OF several things and takes exactly ONE place in a meal, so one row
 * is multi-select and the other is single-select — and a single row offering
 * both would make `['toetje', 'pasta']` a representable value with nothing
 * anywhere to stop it. That is precisely what migration 0017 refuses at the
 * database, and a control that can express what the schema forbids is a
 * control that eventually writes it.
 *
 * The filter semantics finish the argument from the other end: chosen
 * `dishTags` are ANDed (src/domain/exclusions.ts), so a merged row would let
 * a household ask for "een voorgerecht én een toetje", which is empty by
 * construction.
 *
 * WHAT THEY DO SHARE IS THE PRIMITIVE. Both rows are `ChipGroup` + `Chip` —
 * the same control `DecisionFilterBar` and `LibrarySearchBar` already use
 * for the same vocabulary — so a household that has learned to tap a
 * category on one screen has learned it on all three. Sharing a primitive is
 * how two questions stay recognisable; sharing a control would make them one
 * question.
 *
 * NOT `RecipeTagRow`, which draws these same two vocabularies on the recipe
 * overview screen. That component says in its own header that it "selects
 * nothing" and deliberately refuses `Chip`'s press animation and checkbox
 * role. This is the editor; those are exactly the affordances it needs.
 *
 * ===========================================================================
 * THE WHOLE VOCABULARY IS OFFERED, WHERE THE FILTER ROWS NARROW
 * ===========================================================================
 *
 * `DecisionFilterBar` and `LibrarySearchBar` render only the categories a
 * household's own library actually carries, and both give the same reason: a
 * chip for a category nothing matches is a control guaranteed to return zero
 * rows, and rendering all seventeen unconditionally "turns a control into a
 * catalogue".
 *
 * An EDITOR is the one place that reasoning inverts. A category this library
 * has never used is exactly the one somebody came here to add, and narrowing
 * to what already exists would make the control unable to fix the thing it
 * was built for — a library with no `soep` in it could never gain one. So
 * all seventeen render, always, and the height that costs is paid on a
 * scrolling form rather than above a hero.
 *
 * ===========================================================================
 * ICONS, AND WHY THIS ROW LOOKED UNCHANGED UNTIL GAP-19
 * ===========================================================================
 *
 * The categories draw through `IconChip` + dishTagIcons.ts, and they gained
 * their glyphs in one step on 7 September 2026. Until then all seventeen
 * were absent from `INSTALLED_GLYPH_BY_ICON` — Feather has, in WS4 §1's
 * measurement, "zero kitchen glyphs" — so `IconChip` rendered the plain
 * `Chip` it wraps and this row was pixel-identical to a bare chip row. That
 * was correct and expected rather than something to work around, and it is
 * why nothing here had to change when the font arrived: iconFont.ts's whole
 * contract is that a call site may ASK for a glyph that cannot be drawn yet
 * and get honest emptiness rather than a placeholder.
 *
 * The course chips get no icon at all, and that is a decision rather than an
 * omission: `IconName` has no member for a course, and minting four would be
 * four more glyphs to draw and licence for a row whose four words are
 * already unambiguous.
 *
 * ===========================================================================
 * ACCESSIBILITY
 * ===========================================================================
 *
 * The categories row is multi-select, so each `Chip`'s default checkbox role
 * carries the whole story and the `ChipGroup` stays unlabelled — a bare
 * `accessibilityLabel` on a role-less `View` is inert (see ChipGroup's own
 * header), so a label there would be dead code.
 *
 * The course row is single-select over a closed four, so it gets a real
 * `radiogroup` with a label, and its chips get `role="radio"`. That is the
 * one case ChipGroup's header permits, and the same pattern
 * `SegmentedControl` uses.
 *
 * NO PER-CHIP SENTENCE, unlike the filter rows. Those spell out AND/OR
 * semantics in every chip's accessibility label, because a filter's effect
 * is invisible to somebody who cannot see the result list. Here a chip
 * describes the dish in front of you and there is no hidden semantics to
 * disclose; a sentence per chip would be seventeen repetitions of something
 * the field label already said.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DISH_COURSES } from '@/domain/dishCourses';
import { DISH_TAGS } from '@/domain/dishTags';
import type { DishCourse } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { IconChip } from './IconChip';
import { iconForDishTag } from './dishTagIcons';
import {
  RECIPE_EDIT_CATEGORIES_HELPER,
  RECIPE_EDIT_CATEGORIES_LABEL,
  RECIPE_EDIT_COURSE_GROUP_LABEL,
  RECIPE_EDIT_COURSE_HELPER,
  RECIPE_EDIT_COURSE_LABEL,
} from './recipeEditCopy';

export interface RecipeTaxonomyFieldsProps {
  /** The categories currently on the dish, from `DISH_TAGS`' closed vocabulary. */
  readonly dishTags: readonly string[];
  /** Toggles one category. The caller owns the array and rebuilds it immutably. */
  readonly onToggleDishTag: (tag: string) => void;
  /** The dish's place in a meal. Never null: a dish that has said nothing is a hoofdgerecht. */
  readonly dishCourse: DishCourse;
  /** Selects a course. There is no deselect — see the render for why. */
  readonly onSelectDishCourse: (course: DishCourse) => void;
}

export function RecipeTaxonomyFields(props: RecipeTaxonomyFieldsProps): JSX.Element {
  const { dishTags, onToggleDishTag, dishCourse, onSelectDishCourse } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <>
      <View style={styles.field}>
        <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{RECIPE_EDIT_CATEGORIES_LABEL}</Text>
        <Text style={[typeScale.bodySmall, styles.helper, { color: colors.textMuted }]}>
          {RECIPE_EDIT_CATEGORIES_HELPER}
        </Text>
        <ChipGroup>
          {DISH_TAGS.map((entry) => (
            <IconChip
              key={entry.tag}
              icon={iconForDishTag(entry.tag)}
              label={entry.label}
              selected={dishTags.includes(entry.tag)}
              onPress={() => onToggleDishTag(entry.tag)}
            />
          ))}
        </ChipGroup>
      </View>

      <View style={styles.field}>
        <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{RECIPE_EDIT_COURSE_LABEL}</Text>
        <Text style={[typeScale.bodySmall, styles.helper, { color: colors.textMuted }]}>
          {RECIPE_EDIT_COURSE_HELPER}
        </Text>
        <ChipGroup accessibilityRole="radiogroup" accessibilityLabel={RECIPE_EDIT_COURSE_GROUP_LABEL}>
          {DISH_COURSES.map((entry) => (
            <Chip
              key={entry.course}
              label={entry.label}
              role="radio"
              selected={dishCourse === entry.course}
              // No deselect: every dish has a course, so tapping the one
              // already chosen is a no-op rather than a way to clear it.
              // `Chip` already withholds its haptic for a tap that changes
              // nothing, so the hand is told the same thing.
              onPress={() => onSelectDishCourse(entry.course)}
            />
          ))}
        </ChipGroup>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.space5,
  },
  /** Between a section's noun and the chips under it — the same beat `EditableTextListField` puts under its own helper. */
  helper: {
    marginTop: spacing.space1,
    marginBottom: spacing.space3,
  },
});

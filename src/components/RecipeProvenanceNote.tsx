/**
 * RCP-06's one note on the import confirmation screen (src/app/import/
 * confirm.tsx): where this recipe's ingredients and steps actually came
 * from, said before the user commits to it.
 *
 * WHERE IT SITS, AND WHY THERE. Directly under the creator credit and
 * above the editable fields — the last thing read before the list the note
 * is about, and the first thing that explains what that list is. Below the
 * fields it would be a footnote nobody scrolls to on the screen where
 * scrolling is exactly what the user is doing. Above the credit it would
 * be the loudest thing on the page, which is how a fact turns into a
 * warning.
 *
 * WHY IT DECIDES NOTHING. Every string comes from recipeProvenanceCopy.ts,
 * including the judgement of whether there is anything to say at all: this
 * component renders whatever that module hands it, or nothing. vitest runs
 * with react-native stubbed, so a Dutch sentence written here is a sentence
 * no test could reach — and this one is a claim about a recipe's origin on
 * the screen where somebody decides to cook from it.
 *
 * IT HAS NO VARIANT PROP, DELIBERATELY. Both provenances render through
 * this same container, at the same weight, in the same place, differing
 * only in their words — see the copy module's header for why a badge on
 * one and silence on the other would be read as a ranking. There is no
 * `tone`, no `severity` and no icon here to switch on, so the next person
 * who wants to make one of them louder has to add the affordance first and
 * argue for it, rather than passing a prop that already exists.
 *
 * `surfaceSunken` with no border, matching ImportFailureState's calm panel
 * and deliberately unlike the bordered inputs beneath it: this is
 * something to read, not something to fill in. `textSecondary` for the
 * body rather than `textMuted` because the reader is being asked to act on
 * it, and muted is the weight this screen already uses for helper text
 * that merely labels a field.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { RecipeProvenance } from '@/domain/import/types';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { buildRecipeProvenanceNote } from './recipeProvenanceCopy';

export interface RecipeProvenanceNoteProps {
  /**
   * `null` is a real, expected state, not a missing value: a recipe the
   * user typed themselves has no provenance, and the note is absent rather
   * than empty. See `buildRecipeProvenanceNote`.
   */
  readonly provenance: RecipeProvenance | null;
}

export function RecipeProvenanceNote(props: RecipeProvenanceNoteProps): JSX.Element | null {
  const { provenance } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const note = buildRecipeProvenanceNote(provenance);

  if (note === null) {
    return null;
  }

  return (
    // Grouped into one accessible node, as ImportCreatorCredit does above
    // it: a screen reader should hear one statement about where the recipe
    // came from, not a heading and then an unattached sentence.
    <View
      style={[styles.container, { backgroundColor: colors.surfaceSunken }]}
      accessible
      accessibilityLabel={note.accessibilityLabel}
    >
      <Text style={[typeScale.label, styles.title, { color: colors.textMuted }]}>{note.title}</Text>
      <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{note.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.radiusMd,
    padding: spacing.space4,
    // The gap under it belongs here rather than to a wrapper on the
    // confirmation screen, and that is not laziness about layout
    // ownership: this component renders NOTHING for a manual entry, and a
    // wrapping `View` carrying the margin would still occupy 20 points on
    // every screen where the note is absent. A block that says nothing
    // must also take up nothing. Every sibling block on that screen owns
    // the space beneath it the same way.
    marginBottom: spacing.space5,
  },
  title: {
    // Uppercased in style, never in the string: the copy module owns the
    // words, and an ALL-CAPS value would also reach the accessibility
    // label, where some screen readers spell it out letter by letter.
    textTransform: 'uppercase',
    marginBottom: spacing.space2,
  },
});

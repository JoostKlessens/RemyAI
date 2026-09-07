/**
 * A row of static pills describing one dish — the dish-tag and dish-mood
 * rows on the recipe overview screen (src/app/recipe/[mealId].tsx).
 *
 * NOT `Chip` OR `IconChip`, AND THAT IS THE POINT OF THE COMPONENT. Both
 * require `onPress` and both announce `accessibilityRole="checkbox"` with a
 * checked state — they are selection controls, and this row selects nothing.
 * Reusing one would give a screen reader a checkbox that cannot be checked
 * and a sighted user a press animation that does nothing, in order to save a
 * `View` and a `Text`. The library's filter bar draws the same vocabularies
 * as real chips, correctly, because there they ARE a control; a read-only
 * screen borrowing that dress would be advertising one it does not have.
 *
 * ITS DRESS IS THE UNSELECTED CHIP'S, deliberately, rather than a third pill
 * shape: `surfaceSunken` at `radiusSm`, the same fill `RecipeTile`'s "Ooit"
 * badge uses. Two pills a household meets in one session should not disagree
 * about what a neutral pill looks like.
 *
 * IT ASKS `isIconAvailable` FIRST rather than rendering an `Icon` and hoping.
 * `Icon` returns `null` for a glyph the installed font cannot draw, so the
 * naive version leaves a wrapper with a gap around nothing — a visible
 * indent on every pill in the row. Asking first is what makes the
 * unavailable case reduce to a plain text pill, and it is `IconChip`'s own
 * worked example applied to a non-interactive row.
 *
 * IT SHIPPED TEXT-ONLY UNTIL 7 SEPTEMBER 2026, every pill of it. Feather
 * has, in WS4 §1's measurement, zero kitchen glyphs, and `dishTagIcons.ts`
 * maps all seventeen dish tags onto names `isIconAvailable` answered `false`
 * for. GAP-19 landed and the row gained its drawings with no change here and
 * none at the call site, which is the whole reason that mapping was written
 * before the font existed. The ask-first order above is what made that safe,
 * so leave it in place: it is the same order the next unavailable glyph will
 * need.
 *
 * THE PILL IS NOT AN ACCESSIBILITY ELEMENT OF ITS OWN and gets no role: it
 * is a word describing the dish, and a screen reader should read it as part
 * of the section its eyebrow names rather than stop on it as though it were
 * something to do. The glyph beside it is already marked
 * `accessibilityElementsHidden` by `Icon` itself.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Icon } from './Icon';
import { isIconAvailable, type IconName } from './iconFont';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface RecipeTagRowEntry {
  /** React key. The stored token (`'pasta'`, `'winters'`), never the label — two vocabularies could legitimately share a word. */
  readonly key: string;
  readonly label: string;
  /**
   * `null` means "this vocabulary has no glyphs at all", which is a
   * different statement from an `IconName` the font cannot draw yet — the
   * distinction `IconChip` draws, for its reason. Dish moods are the first
   * case and dish tags the second, and only the second changes when GAP-19
   * lands.
   */
  readonly icon: IconName | null;
}

export interface RecipeTagRowProps {
  readonly heading: string;
  readonly entries: readonly RecipeTagRowEntry[];
}

/** 16 pt — `IconChip`'s own glyph size, so a tag reads the same here as in the library. */
const TAG_GLYPH_SIZE = 16;

export function RecipeTagRow(props: RecipeTagRowProps): JSX.Element {
  const { heading, entries } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.block}>
      {/* `textTransform` here rather than in the token, per tokens.ts's own
          note on `label`: the source string stays sentence case so nothing
          has to un-shout it to reuse it. */}
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>{heading}</Text>
      <View style={styles.row}>
        {entries.map((entry) => (
          <View key={entry.key} style={[styles.pill, { backgroundColor: colors.surfaceSunken }]}>
            {entry.icon !== null && isIconAvailable(entry.icon) ? (
              <Icon name={entry.icon} size={TAG_GLYPH_SIZE} color={colors.textSecondary} />
            ) : null}
            <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{entry.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: spacing.space6,
  },
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: spacing.space2,
  },
  row: {
    flexDirection: 'row',
    // Wraps rather than scrolls: seventeen tags is the ceiling and a dish
    // carries three or four, so a horizontal scroller would hide content
    // behind a gesture to solve a problem this row does not have.
    flexWrap: 'wrap',
    gap: spacing.space2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    paddingVertical: spacing.space2,
  },
});

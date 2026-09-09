/**
 * "Open the original", on the recipe overview screen
 * (src/app/recipe/[mealId].tsx).
 *
 * `accessibilityRole="link"`, NOT `"button"`. This genuinely leaves Remy,
 * and that is what a screen reader should hear — the same treatment
 * `friends/[feedItemId].tsx` gives PD-010.2's link, for a reason that is not
 * social: a control that hands you to another app without saying so is a
 * control you did not agree to follow. `RecipeOverviewSourceLink`'s
 * `accessibilityLabel` carries the "Opent buiten Remy" clause, and this
 * component appends the retry sentence to it on a failure.
 *
 * IT DECIDES NOTHING. Whether there is a link at all, and what it is called,
 * are `describeRecipeOverviewSourceLink`'s answers — that function reads
 * `Meal.sourceUrl` and `Meal.sourcePlatform` separately and its own comment
 * says why. This component is handed the resolved pair and renders it, which
 * is the split every presentational component in this directory keeps.
 *
 * WHY IT IS A FILE RATHER THAN A LOCAL FUNCTION IN THE ROUTE, where it
 * started: that route reached 782 lines, eighteen short of this repo's
 * 800-line ceiling. Two presentational blocks with long headers were the
 * obvious things to lift out, and lifting them is what stops the next edit
 * to that screen from having to do a refactor first.
 *
 * THE GLYPH GOES THROUGH THE `iconFont.ts` SEAM and is not a `Feather`
 * import. `external-link` resolves against Feather, so it drew before GAP-19
 * and draws after it — the seam gained a second font on 7 September 2026 and
 * nothing here changed, which is the prediction this line used to make about
 * a Phosphor subset that never arrived.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Icon } from './Icon';
import {
  RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_ANNOUNCEMENT,
  RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_NOTE,
  type RecipeOverviewSourceLink,
} from './recipeOverviewCopy';
import { useOpenExternalLink } from './useOpenExternalLink';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface RecipeSourceLinkRowProps {
  readonly link: RecipeOverviewSourceLink;
  /** `Meal.sourceUrl`, already known non-null by the caller — the link would not exist otherwise. */
  readonly url: string;
}

/** 16 pt, the small end of WS4's 16-20 pt UI band for a glyph beside a label. */
const GLYPH_SIZE = 16;

export function RecipeSourceLinkRow(props: RecipeSourceLinkRowProps): JSX.Element {
  const { link, url } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const { status, open } = useOpenExternalLink(RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_ANNOUNCEMENT);
  const hasFailedToOpen = status === 'failed';

  return (
    <View>
      <Pressable
        onPress={() => open(url)}
        accessibilityRole="link"
        accessibilityLabel={
          hasFailedToOpen
            ? `${link.accessibilityLabel} Openen mislukte, tik om opnieuw te proberen.`
            : link.accessibilityLabel
        }
        style={[styles.row, { borderColor: colors.borderStrong }]}
      >
        <Text style={[typeScale.button, styles.label, { color: colors.textPrimary }]}>{link.label}</Text>
        <Icon name="external-link" size={GLYPH_SIZE} color={colors.textMuted} />
      </Pressable>
      {hasFailedToOpen ? (
        <Text style={[typeScale.bodySmall, styles.openFailed, { color: colors.danger }]}>
          {RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_NOTE}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space3,
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    marginTop: spacing.space5,
  },
  label: {
    // Shrinks rather than pushing the glyph off the row: a long platform name
    // at 200% Dynamic Type is the case this exists for.
    flexShrink: 1,
  },
  openFailed: {
    marginTop: spacing.space2,
  },
});

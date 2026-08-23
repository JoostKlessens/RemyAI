/**
 * One row in "Mijn recepten" (src/app/(tabs)/recipes.tsx): title, meta
 * (time/servings), and a scheduling badge so the row communicates what
 * will actually happen with this recipe, not just that it was hoarded —
 * see src/components/recipeScheduling.ts.
 *
 * Tapping a row opens Cook Mode directly (`/cook/[mealId]`) — the one
 * existing screen that already renders a meal's full content, and matches
 * the product's "get to cooking fast" ethos (docs/DESIGN.md). Cook Mode
 * itself already degrades gracefully when a meal has no step fixtures
 * (see src/app/cook/[mealId].tsx's own doc comment), so this never routes
 * into a broken screen.
 */

import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { Meal } from '@/domain/types';
import { dutchWeekdayName } from '@/domain/date';
import { buildSchedulingLabel, type RecipeSchedulingInfo } from './recipeScheduling';
import { type ColorTokens, getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface RecipeListRowProps {
  readonly meal: Meal;
  readonly scheduling: RecipeSchedulingInfo;
}

export function RecipeListRow(props: RecipeListRowProps): JSX.Element {
  const { meal, scheduling } = props;
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const badge = resolveBadgeStyle(scheduling.state, colors);
  const metaText = buildMetaText(meal, scheduling);

  return (
    <Pressable
      onPress={() => router.push(`/cook/${meal.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${meal.title}, ${buildSchedulingLabel(scheduling.state)}`}
      accessibilityHint="Open kookmodus voor dit gerecht"
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.identity}>
        {/* A6: no numberOfLines cap — a truncated recipe title is exactly
            the kind of clipping docs/DESIGN.md asks screens to avoid. */}
        <Text style={[typeScale.body, { color: colors.textPrimary }]}>{meal.title}</Text>
        {metaText !== null ? (
          <Text style={[typeScale.caption, styles.meta, { color: colors.textMuted }]}>{metaText}</Text>
        ) : null}
      </View>
      <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
        <Text style={[typeScale.caption, { color: badge.textColor }]}>{buildSchedulingLabel(scheduling.state)}</Text>
      </View>
    </Pressable>
  );
}

function buildMetaText(meal: Meal, scheduling: RecipeSchedulingInfo): string | null {
  if (scheduling.state === 'al_gekookt' && scheduling.lastCookedOn !== null) {
    return `Laatst gekookt op ${dutchWeekdayName(scheduling.lastCookedOn)}`;
  }
  if (meal.estimatedMinutes !== null) {
    return `${meal.estimatedMinutes} min`;
  }
  return null;
}

interface BadgeStyle {
  readonly backgroundColor: string;
  readonly textColor: string;
}

/**
 * Colour hierarchy matches docs/DESIGN.md's rationing rule: `positive` for
 * the completed state (`al_gekookt`), `accentMuted` for the
 * decision-relevant "this could be tonight's dish" state (`deze_week`,
 * the same fill selected chips use), a neutral surface for `ooit`, and no
 * fill at all for `geen_planning` — the least-resolved state gets the
 * least visual weight, not a warning colour (this is a scheduling gap,
 * not an error).
 */
function resolveBadgeStyle(state: RecipeSchedulingInfo['state'], colors: ColorTokens): BadgeStyle {
  switch (state) {
    case 'deze_week':
      return { backgroundColor: colors.accentMuted, textColor: colors.accentOnMuted };
    case 'al_gekookt':
      return { backgroundColor: colors.positiveMuted, textColor: colors.positive };
    case 'ooit':
      return { backgroundColor: colors.surfaceSunken, textColor: colors.textSecondary };
    case 'geen_planning':
      return { backgroundColor: 'transparent', textColor: colors.textMuted };
    default: {
      const exhaustiveCheck: never = state;
      throw new Error(`Unhandled RecipeSchedulingState: ${String(exhaustiveCheck)}`);
    }
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: spacing.touchTargetMin + 16,
    paddingVertical: spacing.space3,
    borderBottomWidth: 1,
    gap: spacing.space3,
  },
  identity: {
    flex: 1,
  },
  meta: {
    marginTop: spacing.space1,
  },
  badge: {
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    paddingVertical: spacing.space2,
  },
});

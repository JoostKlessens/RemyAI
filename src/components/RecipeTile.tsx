/**
 * One tile in Bibliotheek's two-column thumbnail grid (docs/DESIGN.md §2).
 * Renamed from the old `RecipeListRow` (a single-column text row with no
 * thumbnail) — the library is now built around saved short-form video, so
 * this renders a portrait (9:16) still with a legibility scrim and a
 * scheduling badge, a genuinely different visual model, not just a
 * restyle.
 *
 * No thumbnail (manual entries, or an import whose oEmbed response
 * genuinely had none — Instagram without credentials, a 404/region-locked
 * post) falls back to a flat `surfaceSunken` tile with the dish's first
 * letter in mono — the same monogram idea `CreatorAttribution`'s avatar
 * chip uses, never a broken image or a stock placeholder.
 *
 * Known simplification: `Meal` (src/domain/types.ts) has no persisted
 * creator-handle field — oEmbed's `authorName` is only ever used
 * transiently, to credit the creator on the import confirmation screen
 * (`CreatorAttribution`), not stored on the meal itself. This tile
 * therefore shows the dish title only, never a fabricated or guessed
 * handle — see the top-level report for why that's out of this task's
 * scope (only `thumbnailUrl` was asked for).
 *
 * Tapping a tile opens Cook Mode directly (`/cook/[mealId]`) — unchanged
 * behavior from the old row.
 */

import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { Meal } from '@/domain/types';
import { buildSchedulingLabel, type RecipeSchedulingInfo } from './recipeScheduling';
import { type ColorTokens, fontFamily, getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface RecipeTileProps {
  readonly meal: Meal;
  readonly scheduling: RecipeSchedulingInfo;
}

export function RecipeTile(props: RecipeTileProps): JSX.Element {
  const { meal, scheduling } = props;
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const badge = resolveBadgeStyle(scheduling.state, colors);
  const monogram = meal.title.trim().charAt(0).toUpperCase() || '?';

  return (
    <Pressable
      onPress={() => router.push(`/cook/${meal.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${meal.title}, ${buildSchedulingLabel(scheduling.state)}`}
      accessibilityHint="Open kookmodus voor dit gerecht"
      style={styles.tile}
    >
      <View style={[styles.frame, { backgroundColor: colors.surfaceSunken }]}>
        {meal.thumbnailUrl !== null ? (
          <Image
            source={{ uri: meal.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.monogramWrap} accessible={false}>
            {/* docs/DESIGN.md §2: "the dish's first letter in mono" — same
                monogram idea as CreatorAttribution's avatar chip, but in
                the mono family specifically (title1's own size, not its sans family). */}
            <Text style={[typeScale.title1, { fontFamily: fontFamily.monoSemiBold, color: colors.textMuted }]}>
              {monogram}
            </Text>
          </View>
        )}

        <View style={[styles.scrim, { backgroundColor: colors.videoScrim }]} pointerEvents="none">
          {/* A6: no numberOfLines cap — a truncated dish title is exactly
              the clipping docs/DESIGN.md asks screens to avoid; the tile's
              own minHeight lets this grow instead. */}
          <Text style={[typeScale.bodySmall, { color: colors.onVideoScrim }]}>{meal.title}</Text>
        </View>

        <View style={[styles.badge, { backgroundColor: badge.backgroundColor }]} pointerEvents="none">
          <Text style={[typeScale.caption, { color: badge.textColor }]}>{buildSchedulingLabel(scheduling.state)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

interface BadgeStyle {
  readonly backgroundColor: string;
  readonly textColor: string;
}

/**
 * Colour hierarchy matches docs/DESIGN.md's rationing rule: `positive` for
 * the completed state (`al_gekookt`), `accentMuted` for the
 * decision-relevant "this could be tonight's dish" state (`deze_week`,
 * the same fill selected chips use), a neutral surface for `ooit`, and a
 * translucent scrim-toned chip for `geen_planning` — the least-resolved
 * state gets the least visual weight, not a warning colour (this is a
 * scheduling gap, not an error).
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
      return { backgroundColor: colors.videoScrim, textColor: colors.onVideoScrim };
    default: {
      const exhaustiveCheck: never = state;
      throw new Error(`Unhandled RecipeSchedulingState: ${String(exhaustiveCheck)}`);
    }
  }
}

// 9:16 portrait aspect ratio, docs/DESIGN.md §2.
const TILE_ASPECT_RATIO = 9 / 16;

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: spacing.touchTargetMin,
  },
  frame: {
    width: '100%',
    aspectRatio: TILE_ASPECT_RATIO,
    borderRadius: radii.radiusSm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  monogramWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    paddingHorizontal: spacing.space2,
    paddingTop: spacing.space6,
    paddingBottom: spacing.space2,
  },
  badge: {
    position: 'absolute',
    top: spacing.space2,
    right: spacing.space2,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
  },
});

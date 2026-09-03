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
 * behavior from the old row, and still the default.
 *
 * `onPress` exists because that default is only correct for a recipe the
 * household actually owns. Fase 5b puts recipes on screen that came out
 * of somebody else's kitchen (the Vrienden tab, PD-010), and a tile that
 * hardcodes `/cook/[mealId]` would cheerfully start cook mode — screen
 * awake, step timers, a cook_events row waiting at the end — for a meal
 * id this household has no row for. Handing the destination to the caller
 * is the smallest fix. The alternative, teaching this component to tell
 * an owned meal from a borrowed one, would bury an ownership rule inside
 * a presentational tile, where nobody would think to look for it.
 *
 * Both new props are optional and default to today's exact behavior, so
 * no existing call site changes. A caller overriding `onPress` should
 * override `accessibilityHint` too — otherwise the tile keeps promising a
 * screen reader it will open cook mode while doing something else.
 *
 * `onLongPress` (W-13) adds the app's FIRST long-press affordance —
 * Bibliotheek's action sheet, DESIGN-SOCIAL.md §3.1. It is optional for
 * the same reason `onPress` is: a borrowed meal on the Vrienden side has
 * no library actions to offer, and a tile advertising a menu with nothing
 * in it would be worse than one advertising nothing at all.
 *
 * A GESTURE IS NEVER THE ONLY PATH. A long-press is invisible to a screen
 * reader and impossible for anyone who cannot hold a press steady, so
 * whenever `onLongPress` is supplied the tile also publishes the same
 * action through `accessibilityActions` — the iOS rotor and the Android
 * actions menu both surface it — and swaps in a hint that says the gesture
 * exists at all. The standard `'longpress'` action name is used rather
 * than a custom one because Android maps it onto the platform's own
 * ACTION_LONG_CLICK instead of adding a second, parallel entry beside it.
 *
 * REJECTED: a visible "..." button in the tile corner. It would be the
 * honest third path, but the tile already carries a scheduling badge in
 * that corner and a title over a scrim, and docs/DESIGN.md §2's grid is
 * built around the still image being the thing you read. A second chip
 * competing with the badge costs every tile in the library to serve an
 * action taken on a handful of them. Worth revisiting if the sheet grows
 * past two rows and long-press stops being a rare, deliberate act.
 */

import type { JSX } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { Meal } from '@/domain/types';
import { LIBRARY_TILE_ACTIONS_ACCESSIBILITY_LABEL, LIBRARY_TILE_ACTIONS_HINT } from './libraryTileActionCopy';
import { buildSchedulingLabel, type RecipeSchedulingInfo } from './recipeScheduling';
import { useThumbnailFallback } from './useThumbnailFallback';
import { type ColorTokens, fontFamily, getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface RecipeTileProps {
  readonly meal: Meal;
  readonly scheduling: RecipeSchedulingInfo;
  /** Defaults to opening Cook Mode for this meal — see the file header for when it must not. */
  readonly onPress?: () => void;
  /**
   * Opens the tile's action sheet (`LibraryTileActionSheet`). Omitted, the
   * tile advertises no long-press and no accessibility action at all.
   */
  readonly onLongPress?: () => void;
  /** Defaults to Cook Mode's hint; override it whenever `onPress` is overridden. */
  readonly accessibilityHint?: string;
}

const DEFAULT_ACCESSIBILITY_HINT = 'Open kookmodus voor dit gerecht';

/**
 * RN's standard action name for a long press. Android dispatches it as
 * ACTION_LONG_CLICK; iOS has no native equivalent, so VoiceOver offers it
 * in the rotor under the label below.
 */
const LONG_PRESS_ACTION_NAME = 'longpress';

const LONG_PRESS_ACCESSIBILITY_ACTIONS = [
  { name: LONG_PRESS_ACTION_NAME, label: LIBRARY_TILE_ACTIONS_ACCESSIBILITY_LABEL },
];

export function RecipeTile(props: RecipeTileProps): JSX.Element {
  const { meal, scheduling, onPress, onLongPress, accessibilityHint } = props;
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const badge = resolveBadgeStyle(scheduling.state, colors);
  const monogram = meal.title.trim().charAt(0).toUpperCase() || '?';
  const thumbnail = useThumbnailFallback(meal.thumbnailUrl);
  const hasActions = onLongPress !== undefined;

  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/cook/${meal.id}`))}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${meal.title}, ${buildSchedulingLabel(scheduling.state)}`}
      // An explicit override still wins: a caller that repointed `onPress`
      // knows what its tile does better than this default can.
      accessibilityHint={accessibilityHint ?? (hasActions ? LIBRARY_TILE_ACTIONS_HINT : DEFAULT_ACCESSIBILITY_HINT)}
      accessibilityActions={hasActions ? LONG_PRESS_ACCESSIBILITY_ACTIONS : undefined}
      onAccessibilityAction={
        hasActions
          ? (event) => {
              if (event.nativeEvent.actionName === LONG_PRESS_ACTION_NAME) {
                onLongPress();
              }
            }
          : undefined
      }
      style={styles.tile}
    >
      <View style={[styles.frame, { backgroundColor: colors.surfaceSunken }]}>
        {thumbnail.showsImage ? (
          <Image
            source={{ uri: meal.thumbnailUrl ?? undefined }}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={thumbnail.onError}
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

/**
 * One friend-shared recipe in the Vrienden tab (docs/DESIGN.md §8, PD-010):
 * a portrait still, who sent it, the dish, its key ingredients, how long it
 * takes, what they scored it, and whose video it came out of. Tapping it
 * opens the full recipe.
 *
 * WHY THIS IS NOT `RecipeTile`. Bibliotheek's tile is a square-cut 9:16
 * frame carrying exactly two facts — a title and a scheduling badge — and
 * that badge is the problem: "Deze week" / "Al gekookt" describe a
 * recipe's place in *your* rotation, and a friend's recipe has no place in
 * it at all. Rendering `geen_planning` over someone else's dinner would
 * state something false in the most confident-looking spot on the tile.
 * This card carries five facts rather than two anyway, so it is a
 * landscape row with the still shrunk to a thumbnail column instead — the
 * same proof sheet, laid out as a strip rather than a grid. (RecipeTile
 * did still gain an `onPress` seam in this phase, for the more general
 * reason documented in its own header: a presentational tile should not
 * hardcode a route that assumes ownership.)
 *
 * THE PD-007a LABEL is the one part of this card that is not decoration.
 * A recipe colliding with a household restriction is ranked to the bottom
 * by src/domain/feed/ranking.ts and then labelled here — "bevat noten",
 * amber, stated as a fact about the dish. Never removed from the feed,
 * never phrased as a verdict about the reader ("niet veilig voor jou"),
 * never an icon standing in for the word. The reason it has to be on the
 * *card* and not only inside the recipe is the exact hole PD-007a was
 * written to close: tapping through to the creator's post bypasses
 * `exclusions.ts` entirely, so this may be the last screen someone sees
 * before cooking it.
 *
 * `positive` is deliberately absent here. A friend's five-out-of-five is
 * an opinion, not a completion, and green is reserved for what this
 * household actually finished (docs/DESIGN.md). The score renders as a
 * plain mono numeral beside the cook time, where it reads as measurement
 * rather than as praise.
 */

import { useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getPlatformDisplayName } from './creatorPresentation';
import {
  buildAllergenCollisionLabel,
  buildFriendRecipeCardAccessibilityLabel,
  buildFriendRecipeMetaLine,
  type FriendRecipeCardModel,
} from './friendFeedPresentation';
import { fontFamily, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface FriendRecipeCardProps {
  readonly model: FriendRecipeCardModel;
  readonly onPress: () => void;
  /** Read once per screen and passed down, per docs/DESIGN.md "Global rules". */
  readonly reduceMotionEnabled: boolean;
}

/** Matches Button's press feedback exactly, so a card and a button feel like the same product. */
const PRESS_SCALE = 0.98;

/** 9:16, the same portrait ratio Bibliotheek's grid uses — a short-form video still, not a crop. */
const THUMBNAIL_ASPECT_RATIO = 9 / 16;

export function FriendRecipeCard(props: FriendRecipeCardProps): JSX.Element {
  const { model, onPress, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const scale = useRef(new Animated.Value(1)).current;

  const metaLine = buildFriendRecipeMetaLine(model.estimatedMinutes, model.rating);
  const collisionLabel = buildAllergenCollisionLabel(model.collidingTags);
  const monogram = model.title.trim().charAt(0).toUpperCase() || '?';

  const animateTo = (toValue: number): void => {
    Animated.timing(scale, {
      toValue,
      duration: resolveDuration(motion.durationInstant, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(PRESS_SCALE)}
        onPressOut={() => animateTo(1)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={buildFriendRecipeCardAccessibilityLabel(model)}
        accessibilityHint="Open het volledige recept"
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.thumbnailFrame, { backgroundColor: colors.surfaceSunken }]}>
          {model.thumbnailUrl !== null ? (
            <Image
              source={{ uri: model.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            // The same monogram fallback as Bibliotheek's tile — never a
            // broken image, never a stock placeholder (docs/DESIGN.md §2).
            <Text
              style={[
                typeScale.title2,
                styles.monogram,
                { fontFamily: fontFamily.monoSemiBold, color: colors.textMuted },
              ]}
            >
              {monogram}
            </Text>
          )}
        </View>

        <View style={styles.body}>
          <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>
            {`Gedeeld door ${model.friendName}`}
          </Text>
          {/* No numberOfLines cap anywhere on this card: docs/DESIGN.md
              prefers letting a row grow over clipping it, and a truncated
              dish name is unreadable at 200% Dynamic Type. */}
          <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{model.title}</Text>

          {model.keyIngredients !== null ? (
            <Text style={[typeScale.bodySmall, styles.ingredients, { color: colors.textSecondary }]}>
              {model.keyIngredients.text}
            </Text>
          ) : null}

          {metaLine !== null ? (
            <Text style={[typeScale.numeral, styles.metaRow, { color: colors.textMuted }]}>{metaLine}</Text>
          ) : null}

          {/* PD-010.1: attribution on the card AND on the recipe. This row
              is deliberately not a link — the whole card is one tap target,
              and a nested link inside it would hand a screen reader two
              destinations for one visual object. The creator's profile is
              reachable one screen in, where it can be its own control. */}
          <Text style={[typeScale.caption, styles.creator, { color: colors.textMuted }]}>
            {`@${model.creator.handle} · ${getPlatformDisplayName(model.creator.platform)}`}
          </Text>

          {collisionLabel !== null ? (
            <View style={[styles.collisionChip, { backgroundColor: colors.warningMuted }]}>
              <Text style={[typeScale.caption, { color: colors.warning }]}>{collisionLabel}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.space3,
    padding: spacing.space3,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    // Every real state of this card is far taller than 44pt; the floor is
    // stated anyway so a future single-line variant cannot slip under it.
    minHeight: spacing.touchTargetMin,
  },
  thumbnailFrame: {
    width: spacing.space20,
    aspectRatio: THUMBNAIL_ASPECT_RATIO,
    borderRadius: radii.radiusSm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  monogram: {
    textAlign: 'center',
  },
  body: {
    flex: 1,
  },
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: spacing.space1,
  },
  ingredients: {
    marginTop: spacing.space1,
  },
  metaRow: {
    marginTop: spacing.space1,
  },
  creator: {
    marginTop: spacing.space1,
  },
  collisionChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.space2,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
  },
});

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
 *
 * THE NOTE (DESIGN-SOCIAL.md §4.2) is the one thing on this card that is
 * somebody else's voice, and it is dressed as a quotation for that reason:
 * Archivo `bodySmall` in `textSecondary`, behind a `borderStrong` left
 * rule, in quotation marks. The same treatment §7's "DIT LAS REMY"
 * evidence block uses, and for the same purpose — a left rule is how this
 * product says "these are not our words". It is what a send has and proof
 * does not (PD-016), so it is also the clearest visual difference between
 * the two card kinds.
 *
 * THE ENTRANCE (PD-020.1) belongs to this card and not to the list,
 * because the list must not know which of its rows is which kind. An
 * unseen send fades and rises once, on first render; every other card —
 * every proof card included, always — is handed a null delay and renders
 * already at rest. That asymmetry IS the announcement: §8 allows the band
 * no header, no divider and no "NIEUW" label, so the motion is the only
 * thing that says a letter arrived. Animating the whole list would say
 * "everything here is new", which is the freshness claim this surface
 * exists without.
 */

import { useEffect, useRef } from 'react';
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
  /**
   * PD-020.1's entrance: how long this card waits before fading and
   * rising, or null for "already at rest".
   *
   * NULL IS THE DEFAULT AND THE COMMON CASE. A card with no delay renders
   * at its final opacity and offset and never animates — not a zero-delay
   * animation, no animation at all. `resolveUnseenEntranceDelay`
   * (gekooktPresentation.ts) is the only thing that should compute this:
   * it returns null for every card below the unseen band, and for every
   * card under reduced motion, so this component needs no second opinion
   * about either.
   */
  readonly entranceDelayMs?: number | null;
}

/** Matches Button's press feedback exactly, so a card and a button feel like the same product. */
const PRESS_SCALE = 0.98;

/** 9:16, the same portrait ratio Bibliotheek's grid uses — a short-form video still, not a crop. */
const THUMBNAIL_ASPECT_RATIO = 9 / 16;

/** §8: `translateY` 8→0. Kiezen's reveal at a humbler distance — a card arriving, not a screen. */
const ENTRANCE_RISE = 8;

export function FriendRecipeCard(props: FriendRecipeCardProps): JSX.Element {
  const { model, onPress, reduceMotionEnabled } = props;
  const entranceDelayMs = props.entranceDelayMs ?? null;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const scale = useRef(new Animated.Value(1)).current;
  // Starts at 1 rather than 0 when there is no entrance, so an ordinary
  // card is visible on its very first frame. Beginning at 0 and correcting
  // in an effect would flash every card in the list, which is the exact
  // opposite of "only the band is announced".
  const entrance = useRef(new Animated.Value(entranceDelayMs === null ? 1 : 0)).current;

  const metaLine = buildFriendRecipeMetaLine(model.estimatedMinutes, model.rating);
  const collisionLabel = buildAllergenCollisionLabel(model.collidingTags);
  const monogram = model.title.trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    if (entranceDelayMs === null) {
      // Includes the reduced-motion case, which `resolveUnseenEntranceDelay`
      // has already turned into null: "everything lands instantly, no
      // stagger". Set rather than animated, so a card that leaves the band
      // on a later read does not fade a second time.
      entrance.setValue(1);
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      delay: entranceDelayMs,
      duration: resolveDuration(motion.durationNormal, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingDecelerate),
      useNativeDriver: true,
    }).start();
  }, [entrance, entranceDelayMs, reduceMotionEnabled]);

  const animateTo = (toValue: number): void => {
    Animated.timing(scale, {
      toValue,
      duration: resolveDuration(motion.durationInstant, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          // The rise and the press scale share one transform list: two
          // nested `Animated.View`s would each need their own native
          // driver node for what is one object moving.
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [ENTRANCE_RISE, 0] }) },
          { scale },
        ],
      }}
    >
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

          {/* The sender's own words, quoted (DESIGN-SOCIAL.md §4.2). Null
              renders NOTHING — not an empty rule, not a placeholder, not
              "geen bericht" — because a send without a note is the
              ordinary case and a stub would make it look like a failure
              to load one. The quotation marks are added here rather than
              stored, so §4.3's recipe screen can show the same words in
              its own dress without unpicking a decorated string. */}
          {model.note !== null ? (
            <View style={[styles.note, { borderLeftColor: colors.borderStrong }]}>
              <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{`"${model.note}"`}</Text>
            </View>
          ) : null}

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
  note: {
    marginTop: spacing.space2,
    // The rule is the quotation mark that works at any text size: it grows
    // with the note instead of sitting beside a fixed glyph. `space2` of
    // padding keeps the words off it at 200% Dynamic Type, where a
    // one-unit gap closes up.
    borderLeftWidth: 2,
    paddingLeft: spacing.space2,
  },
  ingredients: {
    marginTop: spacing.space2,
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

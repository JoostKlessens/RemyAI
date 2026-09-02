/**
 * One ambient cook-proof card in the Vrienden tab's `Gekookt` mode
 * (docs/DESIGN.md §8, docs/DESIGN-SOCIAL.md §2.4 and §4.2, PD-015):
 * a portrait still, who cooked it, the dish, its key ingredients, how long
 * it takes and what the circle publicly gave it. Tapping it opens the
 * canonical recipe.
 *
 * WHY THIS IS A SIBLING OF `FriendRecipeCard` AND NOT A MODE OF IT. The
 * two cards in this one list open different rows under different
 * permissions. A send card opens the SENDER'S OWN MEAL — a private
 * household row the reader may see only while `has_active_send_to_me()`
 * says so — and this card opens the canonical `recipes` row, which every
 * authenticated user could already read. An `isProof` boolean on one
 * component would put that distinction behind a prop: a wrong default, a
 * forgotten argument or a copied call site would route a tap into
 * somebody's kitchen, and nothing at the call site would look wrong. Two
 * components, two models, one destination each. The cost is a second file
 * repeating a thumbnail column and a press animation; what it buys is
 * that "which row does this open" has exactly one answer per file.
 *
 * WHAT THIS CARD DOES NOT HAVE, AND WHY THAT IS THE PRODUCT RATHER THAN
 * AN OMISSION. No sender and no note. A send carries a person and one
 * line in their own words ("ik moest aan jou denken"); proof carries
 * neither, because nobody performed it — it falls out of a dinner that
 * was going to happen anyway. PD-016 requires that a send never borrow
 * the language of proof, and the asymmetry between these two cards is
 * where a reader learns, without being told, that one dish was made and
 * the other was suggested. Do not smooth it away.
 *
 * NO TIMESTAMP, NO COUNT, NO BADGE. `shared_cooks` carries neither a date
 * nor a tally to render (src/lib/repository/social/types.ts), the list is
 * ordered for cookability and never for recency, and PD-020.1's unseen
 * band belongs to directed sends alone — ambient proof never feeds a
 * count. Cooking something four times is still one proof.
 *
 * THE ONE PLACE `positive` IS ALLOWED ON THIS SCREEN (PD-020.2). When an
 * opted-in friend cooks a recipe you sent her, this card dresses as the
 * closed loop: the eyebrow becomes "Sanne maakte jouw recept", a
 * `positiveMuted` chip reading `gemaakt` sits with the dish, and a
 * hairline `positive` stroke draws under the dish name — the completion
 * mirror of Kiezen's `accent` stroke (DecisionCard.tsx): blue when you
 * choose, green when what you sent got cooked. Nothing else here is ever
 * green. A friend's 8,5 is an opinion rather than a completion, and it
 * sets as a plain mono numeral beside the cook time. `closedLoop` is the
 * one boolean on this card, and note what it cannot do — it changes the
 * dress, never the destination.
 *
 * THE SUCCESS HAPTIC IS NOT FIRED HERE. §8 allows it "at most once per
 * tab open", which is a fact about the tab and not about a card: a
 * component firing it on mount fires once per dressed card, and again on
 * every remount a scrolling list performs. It belongs to the screen that
 * knows how many of these it just rendered — the same screen that decides
 * whether this visit shows the dress at all, since the dress is read once
 * and then reverts.
 */

import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import {
  CLOSED_LOOP_CHIP_COPY,
  buildAllergenCollisionLabel,
  buildCreatorLine,
  buildFriendProofCardAccessibilityLabel,
  buildFriendProofEyebrow,
  buildFriendProofMetaLine,
  type FriendProofCardModel,
} from './friendFeedPresentation';
import { useThumbnailFallback } from './useThumbnailFallback';
import type { RecipeId } from '@/domain/social/types';
import { fontFamily, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface FriendProofCardProps {
  readonly model: FriendProofCardModel;
  /**
   * Handed the canonical `recipes` id — the only identifier this card
   * holds. It is passed as an argument rather than closed over by the
   * caller so that a screen wiring this up has a publicly readable recipe
   * id in hand and no household row anywhere in reach.
   *
   * OPTIONAL, AND ITS ABSENCE IS MEANINGFUL. No screen in this app reads
   * a canonical recipe yet, so the only caller passed `() => undefined` —
   * and the card still announced itself as a button, hinted "Open het
   * volledige recept", and depressed under a thumb that got nothing back.
   * `KringRow` met the identical question and answered it by not being
   * pressable at all, arguing in its own header that "an action that
   * silently does nothing is worse than no action". This prop now carries
   * that same answer: given a handler the card is a button, given none it
   * is a card. The fix for the missing destination is the
   * canonical-recipe screen, not a handler that pretends.
   */
  readonly onOpenCanonicalRecipe?: (recipeId: RecipeId) => void;
  /** Read once per screen and passed down, per docs/DESIGN.md "Global rules". */
  readonly reduceMotionEnabled: boolean;
}

/** Matches Button's and FriendRecipeCard's press feedback exactly, so every tappable object feels like one product. */
const PRESS_SCALE = 0.98;

/** 9:16, the same portrait ratio Bibliotheek's grid and the send card use — a short-form video still, not a crop. */
const THUMBNAIL_ASPECT_RATIO = 9 / 16;

/** The hairline weight Kiezen's accept stroke draws at (DecisionCard.tsx); this one is its completion mirror. */
const CLOSED_LOOP_STROKE_HEIGHT = 2;

export function FriendProofCard(props: FriendProofCardProps): JSX.Element {
  const { model, onOpenCanonicalRecipe, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const scale = useRef(new Animated.Value(1)).current;
  const strokeScale = useRef(new Animated.Value(0)).current;

  const eyebrow = buildFriendProofEyebrow(model.cookNames, model.closedLoop);
  const metaLine = buildFriendProofMetaLine(model.estimatedMinutes, model.grade);
  const collisionLabel = buildAllergenCollisionLabel(model.collidingTags);
  const monogram = model.title.trim().charAt(0).toUpperCase() || '?';
  const thumbnail = useThumbnailFallback(model.thumbnailUrl);

  useEffect(() => {
    if (!model.closedLoop) {
      // An ordinary proof card starts and stays undrawn. The stroke is
      // never animated away: the dress is read once, and the card simply
      // arrives without it on the next visit.
      strokeScale.setValue(0);
      return;
    }
    Animated.timing(strokeScale, {
      toValue: 1,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingDecelerate),
      useNativeDriver: true,
    }).start();
  }, [model.closedLoop, reduceMotionEnabled, strokeScale]);

  const animateTo = (toValue: number): void => {
    Animated.timing(scale, {
      toValue,
      duration: resolveDuration(motion.durationInstant, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  /**
   * Every affordance that claims this card is a button lives here
   * together, so the claim and the destination cannot drift apart. With
   * no handler there is no role, no hint and no press-scale — the card
   * keeps only its accessibility label, exactly as `KringRow` does.
   */
  const pressAffordance =
    onOpenCanonicalRecipe === undefined
      ? {}
      : {
          onPress: () => onOpenCanonicalRecipe(model.recipeId),
          onPressIn: () => animateTo(PRESS_SCALE),
          onPressOut: () => animateTo(1),
          accessibilityRole: 'button' as const,
          accessibilityHint: 'Open het volledige recept',
        };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        {...pressAffordance}
        accessible
        accessibilityLabel={buildFriendProofCardAccessibilityLabel(model)}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={[styles.thumbnailFrame, { backgroundColor: colors.surfaceSunken }]}>
          {thumbnail.showsImage ? (
            <Image
              source={{ uri: model.thumbnailUrl ?? undefined }}
              style={styles.thumbnail}
              resizeMode="cover"
              onError={thumbnail.onError}
              accessibilityIgnoresInvertColors
            />
          ) : (
            // The same monogram fallback Bibliotheek's tile and the send
            // card use — never a broken image, never a stock placeholder
            // (docs/DESIGN.md §2).
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
          <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>{eyebrow}</Text>

          {/* No numberOfLines cap anywhere on this card, matching the send
              card: docs/DESIGN.md prefers letting a row grow over clipping
              it, and a truncated dish name is unreadable at 200% Dynamic
              Type. */}
          <View style={styles.dishTitleWrap}>
            <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{model.title}</Text>
            {/* Absolutely positioned so it never perturbs the row's height,
                drawn or not — scaleX alone would not collapse its box.
                `transformOrigin` rather than a compensating translateX:
                that fallback needs an onLayout measurement of the title
                before it can scale from the left edge, and a stroke that
                waits for a layout pass draws visibly late. */}
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.closedLoopStroke,
                { backgroundColor: colors.positive, transform: [{ scaleX: strokeScale }] },
              ]}
            />
          </View>

          {model.closedLoop ? (
            <View style={[styles.chip, styles.closedLoopChip, { backgroundColor: colors.positiveMuted }]}>
              <Text style={[typeScale.caption, { color: colors.positive }]}>{CLOSED_LOOP_CHIP_COPY}</Text>
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

          {/* PD-007: attribution is not optional on a proof card either —
              this is still an extraction of somebody's post. Deliberately
              not a link, exactly as on the send card: the whole card is
              one tap target, and a nested link would hand a screen reader
              two destinations for one visual object. */}
          <Text style={[typeScale.caption, styles.creator, { color: colors.textMuted }]}>
            {buildCreatorLine(model.creatorHandle, model.creatorPlatform)}
          </Text>

          {collisionLabel !== null ? (
            <View style={[styles.chip, styles.collisionChip, { backgroundColor: colors.warningMuted }]}>
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
  dishTitleWrap: {
    position: 'relative',
    // Shrinks the wrap to the title's own width, so the stroke underlines
    // the dish name rather than the column it sits in.
    alignSelf: 'flex-start',
  },
  closedLoopStroke: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -spacing.space1,
    height: CLOSED_LOOP_STROKE_HEIGHT,
    transformOrigin: 'left',
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
  chip: {
    alignSelf: 'flex-start',
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
  },
  closedLoopChip: {
    // Sits with the dish (PD-020.2), which means clearing the stroke drawn
    // just under the title rather than taking the ordinary one-step step.
    marginTop: spacing.space2,
  },
  collisionChip: {
    marginTop: spacing.space2,
  },
});

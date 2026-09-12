/**
 * One ambient cook-proof card on Ontdek's feed side (docs/DESIGN.md §8,
 * docs/DESIGN-SOCIAL.md §2.4 and §4.2, PD-015): a portrait still, who
 * cooked it, the dish, its key ingredients, how long it takes and what the
 * circle publicly gave it. Tapping it opens the canonical recipe.
 *
 * ⚠ TWO NAMES IN THAT SENTENCE HAVE GONE AND THE CARD HAS NOT. It used to
 * open "in the Vrienden tab's `Gekookt` mode"; the mode went when the kring
 * moved to Trending, and the TAB went on 11 September 2026 when PD-024
 * merged Vrienden and Trending into Ontdek. This card crossed both moves
 * unchanged, which is the useful thing to know about it.
 *
 * ⚠ IT IS A FULL-WIDTH FEED CARD SINCE THAT SAME DAY, AND IT WAS A COMPACT
 * ROW BEFORE. The owner, looking at the merged tab: "De vrienden pagina op
 * ontdek is nu geen feed meer zoals die bij ontdekken is, dat is wel de
 * bedoeling." The composition — name, clock, 200pt photograph at 9:16,
 * evidence, creator — now comes from `FeedCardFace.tsx` and is shared with
 * the send card and with explore's. What stayed here is what makes a proof
 * card a proof card: the eyebrow, the closed-loop dress, and the
 * destination.
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
 * components, two models, one destination each.
 *
 * ⚠ THE COST OF THAT USED TO BE "a second file repeating a thumbnail column
 * and a press animation", AND MOST OF IT IS GONE. The composition moved to
 * `FeedCardFace.tsx` on 11 September 2026, so what the two siblings repeat
 * now is a press animation and a panel — and what they keep apart is the
 * thing the separation was always for: which row a tap opens, under which
 * permissions, with exactly one answer per file. The extraction made the
 * rule cheaper to keep rather than harder.
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

import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { FeedCardFace, feedCardPanelStyle } from './FeedCardFace';
import { ONTDEK_CARD_PRESS_HINT } from './ontdekCopy';
import {
  CLOSED_LOOP_CHIP_COPY,
  buildAllergenCollisionLabel,
  buildCreatorLine,
  buildFriendProofCardAccessibilityLabel,
  buildFriendProofEyebrow,
  buildFriendProofMetaLine,
  type FriendProofCardModel,
} from './friendFeedPresentation';
import type { RecipeId } from '@/domain/social/types';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface FriendProofCardProps {
  readonly model: FriendProofCardModel;
  /**
   * Handed the canonical `recipes` id — the only identifier this card
   * holds. It is passed as an argument rather than closed over by the
   * caller so that a screen wiring this up has a publicly readable recipe
   * id in hand and no household row anywhere in reach.
   *
   * OPTIONAL, AND ITS ABSENCE WAS MEANINGFUL — AND ON 10 SEPTEMBER 2026
   * THE VRIENDEN TAB FINALLY PASSES ONE. `/friends/recipe/[recipeId]`
   * exists and reads a canonical recipe live, so the card is a button
   * again: role, hint and press-scale all come back together with the
   * destination, in the one branch below, because they were tied to this
   * handler rather than to a flag.
   *
   * THE OPTIONALITY STAYS, and it is worth saying why now that it has a
   * caller. It was introduced because the only caller passed
   * `() => undefined` — the card announced itself as a button, hinted
   * "Open het volledige recept", and depressed under a thumb that got
   * nothing back. `KringRow` met the identical question and answered it by
   * not being pressable at all, arguing that "an action that silently does
   * nothing is worse than no action". Any future surface that renders this
   * card without a destination must be able to inherit that answer rather
   * than pass a handler that pretends.
   */
  readonly onOpenCanonicalRecipe?: (recipeId: RecipeId) => void;
  /** Read once per screen and passed down, per docs/DESIGN.md "Global rules". */
  readonly reduceMotionEnabled: boolean;
}

/** Matches Button's and FriendRecipeCard's press feedback exactly, so every tappable object feels like one product. */
const PRESS_SCALE = 0.98;

/*
  `THUMBNAIL_ASPECT_RATIO` STOOD HERE AND IS GONE, not commented out. The
  9:16 ratio did not change — it moved to `FeedCardFace.tsx` along with the
  photo it describes, where one constant now serves all three cards on
  Ontdek. A dead constant kept "in case" is a number the next person has to
  prove nothing reads.
*/

/** The hairline weight Kiezen's accept stroke draws at (DecisionCard.tsx); this one is its completion mirror. */
const CLOSED_LOOP_STROKE_HEIGHT = 2;

export function FriendProofCard(props: FriendProofCardProps): JSX.Element {
  const { model, onOpenCanonicalRecipe, reduceMotionEnabled } = props;
  const colors = getColors(useColorScheme());
  const scale = useRef(new Animated.Value(1)).current;
  const strokeScale = useRef(new Animated.Value(0)).current;

  const eyebrow = buildFriendProofEyebrow(model.cookNames, model.closedLoop);
  // NULL FOR THE COOK TIME, AND THAT IS THE ONE CALL THIS CHANGE ALTERS.
  // The time is drawn by `FeedCardFace` with a clock, above the photo, where
  // explore has always drawn it — so passing it here too would print it
  // twice. What is left in the meta line is the GRADE, and its spelling
  // ("8,5", no denominator) is meaning rather than form and stays exactly as
  // `buildFriendProofMetaLine` has always written it.
  const metaLine = buildFriendProofMetaLine(null, model.grade);
  const collisionLabel = buildAllergenCollisionLabel(model.collidingTags);

  useEffect(() => {
    if (!model.closedLoop) {
      // An ordinary proof card starts and stays undrawn. The stroke is never
      // animated away: the dress is read once, and the card simply arrives
      // without it on the next visit.
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
   * Every affordance that claims this card is a button lives here together,
   * so the claim and the destination cannot drift apart. With no handler
   * there is no role, no hint and no press-scale — the card keeps only its
   * accessibility label, exactly as `KringRow` does.
   */
  const pressAffordance =
    onOpenCanonicalRecipe === undefined
      ? {}
      : {
          onPress: () => onOpenCanonicalRecipe(model.recipeId),
          onPressIn: () => animateTo(PRESS_SCALE),
          onPressOut: () => animateTo(1),
          accessibilityRole: 'button' as const,
          accessibilityHint: ONTDEK_CARD_PRESS_HINT,
        };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        {...pressAffordance}
        accessible
        accessibilityLabel={buildFriendProofCardAccessibilityLabel(model)}
        style={[feedCardPanelStyle, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <FeedCardFace
          eyebrow={eyebrow}
          title={model.title}
          titleUnderline={
            /* Absolutely positioned so it never perturbs the card's height,
               drawn or not — scaleX alone would not collapse its box.
               `transformOrigin` rather than a compensating translateX: that
               fallback needs an onLayout measurement of the title before it
               can scale from the left edge, and a stroke that waits for a
               layout pass draws visibly late. */
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.closedLoopStroke,
                { backgroundColor: colors.positive, transform: [{ scaleX: strokeScale }] },
              ]}
            />
          }
          estimatedMinutes={model.estimatedMinutes}
          // No source URL, deliberately: `CanonicalRecipeSummary` does not
          // carry one, and a proof feed assembled per read is not a person
          // looking at one post. useThumbnailFallback.ts carries both halves.
          thumbnailUrl={model.thumbnailUrl}
          underPhoto={
            model.closedLoop ? (
              <View style={[styles.closedLoopChip, { backgroundColor: colors.positiveMuted }]}>
                <Text style={[typeScale.caption, { color: colors.positive }]}>{CLOSED_LOOP_CHIP_COPY}</Text>
              </View>
            ) : null
          }
          keyIngredientsText={model.keyIngredients?.text ?? null}
          metaLine={metaLine}
          // PD-007: attribution is not optional on a proof card either — this
          // is still an extraction of somebody's post.
          creatorLine={buildCreatorLine(model.creatorHandle, model.creatorPlatform)}
          collisionLabel={collisionLabel}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  closedLoopStroke: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -spacing.space1,
    height: CLOSED_LOOP_STROKE_HEIGHT,
    transformOrigin: 'left',
  },
  closedLoopChip: {
    // Sits with the dish (PD-020.2), which means clearing the photo above it
    // rather than taking the ordinary one-step step.
    marginTop: spacing.space3,
    alignSelf: 'center',
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
  },
});

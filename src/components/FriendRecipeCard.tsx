/**
 * One friend-shared recipe in the Vrienden tab (docs/DESIGN.md §8, PD-010):
 * a portrait still, who sent it, the dish, its key ingredients, how long it
 * takes, what they scored it, and whose video it came out of. Tapping it
 * opens the full recipe.
 *
 * ⚠ IT IS A FULL-WIDTH FEED CARD SINCE 11 SEPTEMBER 2026, AND IT WAS A
 * COMPACT ROW BEFORE THAT. The owner, looking at the merged tab: "De
 * vrienden pagina op ontdek is nu geen feed meer zoals die bij ontdekken
 * is, dat is wel de bedoeling." He was right, and the measurement is
 * blunt: this card drew an 80pt thumbnail beside a text column — about
 * 150pt tall, four to a screen — while the card one swipe away drew a
 * 200pt photograph at 356pt, one to a screen. Same panel, same tokens, two
 * different ideas of what a card is. The composition now comes from
 * `FeedCardFace.tsx`, which all three cards on Ontdek share.
 *
 * WHAT THAT DID NOT CHANGE is everything below this paragraph: the note,
 * the entrance, the destination and the eyebrow are still this file's, and
 * still the things that make a send a send. PD-016's rule survives the
 * change of shape, because the shape was never what carried it.
 *
 * WHY THIS IS NOT `RecipeTile`. Bibliotheek's tile is a square-cut 9:16
 * frame carrying exactly two facts — a title and a scheduling badge — and
 * that badge is the problem: "Deze week" / "Al gekookt" describe a
 * recipe's place in *your* rotation, and a friend's recipe has no place in
 * it at all. Rendering `geen_planning` over someone else's dinner would
 * state something false in the most confident-looking spot on the tile.
 * (RecipeTile did still gain an `onPress` seam in this phase, for the more
 * general reason documented in its own header: a presentational tile should
 * not hardcode a route that assumes ownership.)
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

import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { FeedCardFace, feedCardPanelStyle } from './FeedCardFace';
import { ONTDEK_CARD_PRESS_HINT } from './ontdekCopy';
import { buildAllergenCollisionLabel, buildCardCreditLine } from './friendCardVocabulary';
import {
  buildFriendRecipeCardAccessibilityLabel,
  buildFriendRecipeMetaLine,
  type FriendRecipeCardModel,
} from './friendFeedPresentation';
import { getColors, motion, resolveDuration, spacing, typeScale } from '@/theme/tokens';

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

/*
  `THUMBNAIL_ASPECT_RATIO` STOOD HERE AND IS GONE, not commented out. The
  9:16 ratio did not change — it moved to `FeedCardFace.tsx` along with the
  photo it describes, where one constant now serves all three cards on
  Ontdek. A dead constant kept "in case" is a number the next person has to
  prove nothing reads.
*/

/** §8: `translateY` 8→0. Kiezen's reveal at a humbler distance — a card arriving, not a screen. */
const ENTRANCE_RISE = 8;

export function FriendRecipeCard(props: FriendRecipeCardProps): JSX.Element {
  const { model, onPress, reduceMotionEnabled } = props;
  const entranceDelayMs = props.entranceDelayMs ?? null;
  const colors = getColors(useColorScheme());
  const scale = useRef(new Animated.Value(1)).current;
  // Starts at 1 rather than 0 when there is no entrance, so an ordinary card
  // is visible on its very first frame. Beginning at 0 and correcting in an
  // effect would flash every card in the list, which is the exact opposite of
  // "only the band is announced".
  const entrance = useRef(new Animated.Value(entranceDelayMs === null ? 1 : 0)).current;

  // NULL FOR THE COOK TIME — see `FriendProofCard` for the same call and the
  // same reason: `FeedCardFace` draws the time with a clock above the photo,
  // so passing it here would print it twice. The grade keeps its own
  // spelling, "8,0/10", which is older copy than proof's and is meaning
  // rather than form.
  const metaLine = buildFriendRecipeMetaLine(null, model.rating);
  const collisionLabel = buildAllergenCollisionLabel(model.collidingTags);
  // PD-010.1's credit, decided in a pure module so a test can read it — null
  // when a friend's hand-entered dish has nobody to credit.
  const creditLine = buildCardCreditLine(model.attribution);

  useEffect(() => {
    if (entranceDelayMs === null) {
      // Includes the reduced-motion case, which `resolveUnseenEntranceDelay`
      // has already turned into null: "everything lands instantly, no
      // stagger". Set rather than animated, so a card that leaves the band on
      // a later read does not fade a second time.
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
          // The rise and the press scale share one transform list: two nested
          // `Animated.View`s would each need their own native driver node for
          // what is one object moving.
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
        accessibilityHint={ONTDEK_CARD_PRESS_HINT}
        style={[feedCardPanelStyle, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <FeedCardFace
          eyebrow={`Gedeeld door ${model.friendName}`}
          title={model.title}
          estimatedMinutes={model.estimatedMinutes}
          // The post a friend actually sent, so an expired still can be
          // re-signed once — see useThumbnailFallback.ts for why this surface
          // qualifies and the board-shaped one does not.
          thumbnailUrl={model.thumbnailUrl}
          thumbnailSourceUrl={model.sourceUrl}
          underPhoto={
            /* The sender's own words, quoted (DESIGN-SOCIAL.md §4.2). Null
               renders NOTHING — not an empty rule, not a placeholder, not
               "geen bericht" — because a send without a note is the ordinary
               case and a stub would make it look like a failure to load one.
               The quotation marks are added here rather than stored, so §4.3's
               recipe screen can show the same words in its own dress without
               unpicking a decorated string.

               ⚠ THIS IS WHAT A SEND HAS AND PROOF DOES NOT (PD-016), and it
               is now the clearest visual difference between the two kinds
               rather than one difference among several. The left rule is how
               this product says "these are not our words" — the same
               treatment §7's "DIT LAS REMY" evidence block uses. */
            model.note === null ? null : (
              <View style={[styles.note, { borderLeftColor: colors.borderStrong }]}>
                <Text style={[typeScale.bodySmall, { color: colors.textSecondary }]}>{`"${model.note}"`}</Text>
              </View>
            )
          }
          keyIngredientsText={model.keyIngredients?.text ?? null}
          metaLine={metaLine}
          creatorLine={creditLine}
          collisionLabel={collisionLabel}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: spacing.space3,
    // Left-aligned inside a centred column, because a quotation centred under
    // its own rule reads as a pull quote rather than as somebody talking.
    alignSelf: 'stretch',
    borderLeftWidth: 2,
    paddingLeft: spacing.space2,
  },
});

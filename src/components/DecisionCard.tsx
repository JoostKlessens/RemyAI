/**
 * The Kiezen hero: eyebrow, dish name, the dish's own photo, what it is made
 * of, and how long it takes. The single most important visual in the
 * product — docs/DESIGN.md §1.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM, 6 SEPTEMBER 2026: "Ik denk dat het voor
 * het kiezen goed is als je ook de foto van het recept hebt, kijk even waar
 * het logisch is om te zetten, niet te groot. De reden hierbij moet weg, dat
 * is niet logisch, ik wil liever dat je de 1 tot max 3 hoofdingredienten er
 * staan en hoe lang het duurt om te maken."
 *
 * ===========================================================================
 * THE REDEN BLOCK IS GONE, EYEBROW AND ALL
 * ===========================================================================
 *
 * It rendered one of seven lines from src/domain/reason.ts. Six of them were
 * the app narrating its own arithmetic — "Alweer even geleden", "Een
 * favoriet in huis" — and told the reader nothing they could not have worked
 * out from their own week. That is the part the owner called niet logisch.
 *
 * THE SEVENTH SURVIVES, AS `friendLine`, and the distinction is his. "Sanne
 * heeft dit ook gemaakt en gaf het een 8,5." is not the app explaining its
 * choice; it is a fact about the DISH, from another household, that appears
 * on no other surface this person opens tonight (PD-017). It renders small,
 * last, with no eyebrow, and only when a real friend actually cooked it —
 * `buildFriendProofLine` (src/domain/reason.ts) is the gate, and it never
 * yields a placeholder, so an empty slot draws nothing rather than "nog
 * niemand die je kent".
 *
 * `reasonText` is still composed by `decide.ts` and still persisted on the
 * `decisions` row. It stopped being rendered; it did not stop existing.
 *
 * ===========================================================================
 * THE PHOTO, AND THE ARGUMENT IT OVERTURNS
 * ===========================================================================
 *
 * This header used to read, in full: "No photo/thumbnail here: the decision
 * surface stays a spoken verdict, not a video still — thumbnails are
 * Bibliotheek's language (§2), kept off the one screen that must never look
 * like a browsable list." The owner has now asked for the photo, and the
 * argument is recorded rather than deleted, because half of it is still
 * doing work.
 *
 * What it had right: a screen that leads with a video still reads as a feed.
 * What it had wrong: it treated "has an image" and "is browsable" as one
 * thing. A list is browsable because it offers a CHOICE between images; one
 * image of one dish offers none. And recognising the dish is most of what
 * kiezen IS — the title is the dish's name, the still is the dish.
 *
 * So the surviving half is expressed in the LAYOUT rather than as a ban: the
 * photo sits UNDER the dish name and not above it, so the name is still the
 * first and largest thing on the screen (see A6 below), and it is
 * deliberately small — `PHOTO_WIDTH` is the 80 pt frame `FriendProofCard`
 * already uses, at the same 9:16 a short-form video still actually is.
 * "Niet te groot" is the owner's phrase, and this is the size this codebase
 * already had for it.
 *
 * Its null case is not optional (docs/DESIGN.md §2, src/domain/types.ts):
 * the monogram, never a broken image and never a stock placeholder. It goes
 * through `useThumbnailFallback` like the four `<Image>` sites before it —
 * an EXPIRED thumbnail is not null, and branching on `thumbnailUrl !== null`
 * alone is precisely the bug that hook exists for. These URLs are pre-signed
 * and short-lived, so here the failure would be a grey rectangle standing
 * where the dish should be.
 *
 * ===========================================================================
 * WHY FOUR THINGS AND NOT FIVE
 * ===========================================================================
 *
 * `voor 4` is gone from the meta row. DESIGN.md §1 pairs it with the cook
 * time ("25 min · voor 4"); the owner named the ingredients and the time and
 * nothing else, and with a photo and a possible friend line on the card the
 * servings count was the weakest fact left standing. It is nearly always the
 * same number, and it changes no decision — portion scaling lives on the
 * recipe screen and in cook mode, where it can actually act. This is the one
 * screen in the product that must not become a list. One line in
 * `SuggestionView` puts it back.
 *
 * The ingredients and the time are TWO lines rather than one. Joining them
 * would put "kipfilet · paprika · citroen" and "25 min" on either side of a
 * middot that already separates the ingredients from each other, so one mark
 * would mean two things in one line — and it would set prose and a mono
 * numeral in a single run.
 *
 * Three motion treatments, all driven by `reduceMotionEnabled` passed down
 * from the screen (read once, per docs/DESIGN.md "Global rules"): the
 * first mount fades+rises in over `durationDeliberate` (the slowest, most
 * considered entrance in the app); a later change of `dishTitle` (an
 * "Iets anders" swap) only cross-fades over `durationNormal` — the action
 * row lives outside this component and never moves, so the thumb never
 * has to re-find the buttons; and `accepted` draws a hairline `accent`
 * stroke under the dish name (scaleX 0→1, `durationFast`) — "the
 * grease-pencil circle landing" — the instant "Ja" is tapped, before the
 * screen navigates to Kookmodus.
 */

import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { describeMainIngredients, formatMainIngredients } from '@/domain/mainIngredients';
import { fontFamily, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { useThumbnailFallback } from './useThumbnailFallback';

export interface DecisionCardProps {
  readonly dishTitle: string;
  /** oEmbed's still, carried through import (`Meal.thumbnailUrl`). Null draws the monogram — never a broken image. */
  readonly thumbnailUrl: string | null;
  /**
   * One to three names from `selectMainIngredients`
   * (src/domain/mainIngredients.ts) — consumed, never re-derived here. An
   * empty array draws nothing: that module returns one both for a recipe
   * whose ingredients were never parsed and for a recipe that is nothing but
   * staples, deliberately without telling them apart, because the rendering
   * decision is identical in both.
   */
  readonly mainIngredients: readonly string[];
  /**
   * The one surviving reason, from `buildFriendProofLine`
   * (src/domain/reason.ts), or null — null for the other six codes, and also
   * for a `friend_proof` that named nobody. See that function for why a card
   * must never print an anonymous count.
   */
  readonly friendLine: string | null;
  readonly estimatedMinutes: number | null;
  readonly reduceMotionEnabled: boolean;
  /** True the instant "Ja" is tapped, until the screen navigates to Kookmodus — draws the accept stroke under the dish name. */
  readonly accepted: boolean;
}

/**
 * 80 pt wide at 9:16 — `FriendProofCard`'s frame, to the token, because
 * "niet te groot" already had an answer in this codebase and a second
 * small-thumbnail size is how two surfaces start showing one still at two
 * scales.
 *
 * 9:16 AND NOT 4:5, even though ui-research/ASSEMBLY.md §2.2 recommends 4:5:
 * that recommendation is about DENSITY (5.8 tiles per screen against 3.7)
 * and it is D11, an owner decision that has not landed. Nothing here is a
 * grid, so none of the density argument reaches this card — and cropping the
 * hero's still tighter than the library's would make one image look like
 * two.
 */
const PHOTO_WIDTH = spacing.space20;
const PHOTO_ASPECT_RATIO = 9 / 16;

export function DecisionCard(props: DecisionCardProps): JSX.Element {
  const { dishTitle, thumbnailUrl, mainIngredients, friendLine, estimatedMinutes, reduceMotionEnabled, accepted } =
    props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const photo = useThumbnailFallback(thumbnailUrl);
  // The same expression `RecipeTile`, `FriendProofCard`, `FriendRecipeCard`
  // and `KringRow` use, character for character — a fifth spelling of one
  // fallback is how five surfaces end up disagreeing about an untitled dish.
  const monogram = dishTitle.trim().charAt(0).toUpperCase() || '?';

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const strokeScale = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);
  const previousDishTitle = useRef(dishTitle);

  useEffect(() => {
    const isInitialReveal = isFirstRender.current;
    isFirstRender.current = false;

    // A1: screen-reader users get no other signal that "Iets anders"
    // produced a new suggestion — the action row never moves and the
    // card cross-fades silently. Guarded on the title actually changing
    // (not just "not the first render"), so a re-run of this effect for
    // an unrelated reason (e.g. reduceMotionEnabled toggling mid-session
    // on the same dish) doesn't announce a change that didn't happen.
    const dishChanged = !isInitialReveal && previousDishTitle.current !== dishTitle;
    previousDishTitle.current = dishTitle;
    if (dishChanged) {
      AccessibilityInfo.announceForAccessibility(`Nieuw voorstel: ${dishTitle}`);
    }

    const duration = resolveDuration(
      isInitialReveal ? motion.durationDeliberate : motion.durationNormal,
      reduceMotionEnabled,
    );

    opacity.setValue(0);
    if (!isInitialReveal) {
      translateY.setValue(0);
    }

    const animations = [
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.bezier(...motion.easingDecelerate),
        useNativeDriver: true,
      }),
    ];

    if (isInitialReveal) {
      animations.push(
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing: Easing.bezier(...motion.easingDecelerate),
          useNativeDriver: true,
        }),
      );
    }

    Animated.parallel(animations).start();
  }, [dishTitle, opacity, reduceMotionEnabled, translateY]);

  useEffect(() => {
    if (!accepted) {
      // A new suggestion (swap, or a fresh screen load) always starts
      // un-accepted — reset instantly, never animate the stroke away.
      strokeScale.setValue(0);
      return;
    }
    Animated.timing(strokeScale, {
      toValue: 1,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  }, [accepted, strokeScale, reduceMotionEnabled]);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>KIEZEN</Text>
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <View style={styles.dishTitleWrap}>
          {/* A6: no numberOfLines cap — this is the single most important
              content in the app; docs/DESIGN.md prefers letting a row grow
              over capping it, and ellipsizing the dish name at 200% type
              would hide the one thing the screen exists to show. */}
          <Text style={[typeScale.display, styles.dishTitle, { color: colors.textPrimary }]}>{dishTitle}</Text>
          {/* Absolutely positioned so it never perturbs dishTitleWrap's own
              layout height/spacing, whether accepted or not (scaleX alone
              wouldn't collapse its box). */}
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.acceptStroke, { backgroundColor: colors.accent, transform: [{ scaleX: strokeScale }] }]}
          />
        </View>
        {/* Hidden from assistive tech as one piece. The still carries
            nothing a screen reader can use that the dish name above it did
            not already say, and the monogram literally IS that name's first
            letter — announcing it would spell the dish's initial back at
            somebody who has just heard the whole word. */}
        <View
          style={[styles.photoFrame, { backgroundColor: colors.surfaceSunken }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {photo.showsImage ? (
            <Image
              source={{ uri: thumbnailUrl ?? undefined }}
              style={styles.photo}
              resizeMode="cover"
              onError={photo.onError}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Text
              style={[typeScale.title2, styles.monogram, { fontFamily: fontFamily.monoSemiBold, color: colors.textMuted }]}
            >
              {monogram}
            </Text>
          )}
        </View>
        {/* The middot is punctuation, not a word: read aloud it is either
            three names run together or three names punctuated by whatever
            the synthesiser decides "·" is called. `describeMainIngredients`
            is the spoken form and exists for exactly this. */}
        {mainIngredients.length > 0 ? (
          <Text
            style={[typeScale.body, styles.ingredients, { color: colors.textSecondary }]}
            accessibilityLabel={describeMainIngredients(mainIngredients)}
          >
            {formatMainIngredients(mainIngredients)}
          </Text>
        ) : null}
        {estimatedMinutes !== null ? (
          <Text
            style={[typeScale.numeral, styles.metaRow, { color: colors.textMuted }]}
            accessibilityLabel={`${estimatedMinutes} minuten`}
          >
            {`${estimatedMinutes} min`}
          </Text>
        ) : null}
        {/* PD-017's sentence, and the only reason copy left on this screen.
            No eyebrow: an eyebrow would announce it as a category with one
            member, and the line is already a full sentence naming a person.
            Last and smallest of the four, so that if this card ever feels
            crowded the friend line is what goes quiet first — never the
            ingredients the owner asked for. */}
        {friendLine !== null ? (
          <Text style={[typeScale.bodySmall, styles.friendLine, { color: colors.textMuted }]}>{friendLine}</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: spacing.space3,
  },
  dishTitleWrap: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: spacing.space5,
  },
  dishTitle: {
    textAlign: 'center',
  },
  acceptStroke: {
    position: 'absolute',
    left: '22.5%',
    right: '22.5%',
    bottom: -spacing.space2,
    height: 2,
    // Draws left-to-right like a pencil mark, rather than growing out
    // from its own middle, which is what an untouched scaleX does.
    // FriendProofCard and SendRecipeSheet both set this already; this
    // stroke — the app's signature one — was the one that missed it.
    transformOrigin: 'left',
  },
  photoFrame: {
    // The parent centres on the cross axis, but this is the only child with
    // a fixed width, so it says so itself rather than relying on the column
    // it happens to sit in today.
    alignSelf: 'center',
    width: PHOTO_WIDTH,
    aspectRatio: PHOTO_ASPECT_RATIO,
    borderRadius: radii.radiusSm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.space4,
  },
  photo: {
    ...StyleSheet.absoluteFill,
  },
  monogram: {
    textAlign: 'center',
  },
  ingredients: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  metaRow: {
    textAlign: 'center',
  },
  friendLine: {
    textAlign: 'center',
    marginTop: spacing.space3,
  },
});

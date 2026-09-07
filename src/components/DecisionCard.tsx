/**
 * The Kiezen hero: eyebrow, dish name, how long it takes, and the dish's own
 * photo. The single most important visual in the product — docs/DESIGN.md
 * §1.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM, 6 SEPTEMBER 2026: "Ik denk dat het voor
 * het kiezen goed is als je ook de foto van het recept hebt, kijk even waar
 * het logisch is om te zetten, niet te groot. De reden hierbij moet weg, dat
 * is niet logisch, ik wil liever dat je de 1 tot max 3 hoofdingredienten er
 * staan en hoe lang het duurt om te maken."
 *
 * AND AGAIN, VERBATIM, 7 SEPTEMBER 2026, after he looked at the screen on a
 * device: "I'm sort of choosing the the ingredients, the key ingredients
 * underneath the title of the video do not match. So I want to remove that.
 * Also, the duration for cooking is under the yes or something else button.
 * So the yes and something else button for selecting the recipe should move
 * down." Asked which duration he meant, he named the dish's own estimated
 * cook time — the `25 min` line on this card — and not `TimeCapPicker`'s
 * time-limit filter above the hero.
 *
 * ===========================================================================
 * THE HOOFDINGREDIËNTEN LINE IS GONE, AND THE MODULE BEHIND IT IS NOT
 * ===========================================================================
 *
 * "The key ingredients ... do not match" is not a rendering defect, and no
 * better line would have fixed it. src/domain/mainIngredients.ts opens by
 * saying so itself — "THIS IS A GUESS, AND THE POINT IS TO MAKE IT WRONG
 * BORINGLY" — because nothing in this codebase records which ingredient a
 * dish is ABOUT. That module guesses first-listed-wins minus a pantry list,
 * which is the best guess available from the data and still a guess. The
 * owner read three names under a dish he knows and did not recognise it,
 * which is the guess landing exactly where its own header predicted. A
 * plausible-looking wrong fact costs more on this screen than on any other,
 * because this is the screen whose whole job is to be believed once.
 *
 * THE MODULE STAYS, WITH ITS TESTS, AND HAS NO CALLER TODAY. Not dead by
 * accident: deleting a heuristic that was argued, measured and tested, in
 * order to re-derive it later from the same absent data, is how a codebase
 * forgets what it already decided. The plausible next home is a Bibliotheek
 * tile, where a wrong guess costs a shrug rather than a dinner — and that is
 * a guess about the future, not a plan: docs/DESIGN.md §2 specifies that
 * tile as thumbnail, creator handle, dish title and scheduling badge, with
 * no ingredients on it. That module's own header now says all of this out
 * loud, so a dead-code sweep meets the reason before it meets the diff.
 *
 * The rejected alternative was keeping the line behind a confidence gate —
 * print the names only when they are probably right. There is no signal to
 * gate on: `selectMainIngredients` deliberately cannot tell a recipe whose
 * ingredients were never parsed from a recipe that is genuinely three
 * ingredients, and says so in its own docblock. A gate over an absent signal
 * is a coin flip with a comment on it.
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
 * photo sits UNDER the dish name and not above it — with the cook time
 * between the two since 7 September, see below — so the name is still the
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
 * WHY THREE THINGS AND NOT FIVE
 * ===========================================================================
 *
 * `voor 4` went from the meta row first. DESIGN.md §1 pairs it with the cook
 * time ("25 min · voor 4"); the owner named the ingredients and the time and
 * nothing else, and with a photo and a possible friend line on the card the
 * servings count was the weakest fact left standing. It is nearly always the
 * same number, and it changes no decision — portion scaling lives on the
 * recipe screen and in cook mode, where it can actually act. One line in
 * `SuggestionView` puts it back.
 *
 * The hoofdingrediënten went second, for the reason above, and what is left
 * is a name, a time and a still. This is the one screen in the product that
 * must not become a list, so three facts is not a shortage — it is what a
 * person is told when somebody else decides what is for dinner.
 *
 * ===========================================================================
 * THE COOK TIME SITS ABOVE THE PHOTO NOW, WITH A CLOCK
 * ===========================================================================
 *
 * It used to be the last line of the block, under the still, which is where
 * the owner found it: "the duration for cooking is under the yes or
 * something else button". At the foot of a centred column it sat a hand's
 * width from the action row and read as something belonging to the buttons
 * rather than to the dish. Moving it up between the name and the still puts
 * it where it is actually used — "kip teriyaki, 25 minuten" is one thought,
 * and it is the thought that settles whether tonight is a yes, taken before
 * the eye ever reaches the picture.
 *
 * The rejected alternative was leaving the number where it was and only
 * pushing the action row further down. That separates the two things without
 * fixing the reading order: the time would still be announced after the
 * picture, which is the wrong way round for a fact you need before you look.
 *
 * THE CLOCK IS DECORATIVE, AND `isIconAvailable` IS ASKED FIRST. That order
 * is iconFont.ts's stated contract and every call site in this app follows
 * it: `Icon` renders `null` for a glyph no installed font has, and a row
 * whose `gap` survives around nothing is a visible indent with no mark in
 * it. `TimeCapPicker`'s readout is the same `clock` at the same 16 pt with
 * the same `space2` gap, deliberately — that control says "ik heb 25
 * minuten" and this line says "dit kost er 25", and drawing one unit with
 * two different marks would make them look like two different facts. The
 * spoken label stays on the number (`25 minuten`); the glyph says nothing at
 * all, per Icon.tsx's "NO ACCESSIBILITY LABEL, ALSO ON PURPOSE".
 *
 * Three motion treatments, all driven by `reduceMotionEnabled` passed down
 * from the screen (read once, per docs/DESIGN.md "Global rules"): the
 * first mount fades+rises in over `durationDeliberate` (the slowest, most
 * considered entrance in the app); a later change of `dishTitle` (an
 * "Iets anders" swap) only cross-fades over `durationNormal` — the action
 * row lives outside this component and does not move when the card changes,
 * so the thumb never has to re-find the buttons; and `accepted` draws a
 * hairline `accent` stroke under the dish name (scaleX 0→1, `durationFast`)
 * — "the grease-pencil circle landing" — the instant "Ja" is tapped, before
 * the screen navigates to Kookmodus.
 *
 * THAT PROMISE IS ABOUT SWAPS, and it used to be written as "the action row
 * never moves", which is now too strong a sentence for what it means. The
 * row's RESTING position was lowered once, deliberately, on 7 September 2026
 * — see `styles.actionZone` in (tabs)/index.tsx for the safe-area inset it
 * was double-counting. A layout decision taken once is not a thing that
 * happens under a thumb that is already reaching.
 */

import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Icon } from '@/components/Icon';
import { isIconAvailable } from '@/components/iconFont';
import { fontFamily, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { useThumbnailFallback } from './useThumbnailFallback';

export interface DecisionCardProps {
  readonly dishTitle: string;
  /** oEmbed's still, carried through import (`Meal.thumbnailUrl`). Null draws the monogram — never a broken image. */
  readonly thumbnailUrl: string | null;
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

/**
 * 16 pt — the small end of WS4's 16-20 pt UI band, and the exact size
 * `TimeCapPicker`'s own clock is drawn at. A mark introducing a number, not
 * an illustration competing with the dish name above it or the still below.
 */
const CLOCK_GLYPH_SIZE = 16;

export function DecisionCard(props: DecisionCardProps): JSX.Element {
  const { dishTitle, thumbnailUrl, friendLine, estimatedMinutes, reduceMotionEnabled, accepted } = props;
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
    // produced a new suggestion — the action row does not move on a swap
    // and the card cross-fades silently. Guarded on the title actually changing
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
        {/* The cook time, between the name and the still — see the header
            for why it moved up out of the foot of the card. The clock is
            asked for FIRST and drawn only if the installed fonts have it;
            with it absent this row holds one child and `gap` contributes
            nothing, so the number stays exactly where it is rather than
            sitting behind an empty indent. The spoken label lives on the
            number because the glyph is silent by design (Icon.tsx). */}
        {estimatedMinutes !== null ? (
          <View style={styles.timeRow}>
            {isIconAvailable('clock') ? <Icon name="clock" size={CLOCK_GLYPH_SIZE} color={colors.textMuted} /> : null}
            <Text style={[typeScale.numeral, { color: colors.textMuted }]} accessibilityLabel={`${estimatedMinutes} minuten`}>
              {`${estimatedMinutes} min`}
            </Text>
          </View>
        ) : null}
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
        {/* PD-017's sentence, and the only reason copy left on this screen.
            No eyebrow: an eyebrow would announce it as a category with one
            member, and the line is already a full sentence naming a person.
            Last and smallest of the three, so that if this card ever feels
            crowded the friend line is what goes quiet first — never the
            name, the time or the dish's own picture. */}
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Says where it sits rather than inheriting it, for the same reason
    // `photoFrame` below does: this row is content-width inside a column
    // whose children otherwise stretch.
    alignSelf: 'center',
    // No gap around nothing: with the clock unavailable this row holds one
    // child, and `gap` contributes only BETWEEN children. `TimeCapPicker`'s
    // readout makes the same note about the same glyph.
    gap: spacing.space2,
    marginBottom: spacing.space4,
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
    // NO marginBottom. It used to hold the ingredient line off the still;
    // with that line gone the photo is the last element on most cards, and a
    // trailing margin under the last child is dead height that shifts a
    // vertically centred column off centre. The one thing that can follow
    // brings its own `marginTop` — see `friendLine`.
  },
  photo: {
    ...StyleSheet.absoluteFill,
  },
  monogram: {
    textAlign: 'center',
  },
  friendLine: {
    textAlign: 'center',
    marginTop: spacing.space3,
  },
});

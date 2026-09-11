/**
 * The face every card in Ontdek shows: a name, how long it takes, a
 * photograph big enough to be one, the evidence, and the creator.
 *
 * ===========================================================================
 * WHY IT EXISTS, IN THE OWNER'S WORDS — TWICE
 * ===========================================================================
 *
 * VERBATIM, 11 SEPTEMBER 2026: "De vrienden pagina op ontdek is nu geen feed
 * meer zoals die bij ontdekken is, dat is wel de bedoeling."
 *
 * ⚠ AND HE HAD ASKED FOR EXACTLY THIS ONCE BEFORE, on 8 September, about the
 * pair of lists that were side by side on Trending at the time: "van alleen
 * vrienden ziet er nog anders uit, zorg dat deze hetzelfde worden." That was
 * answered by giving both scopes ONE component — `TrendingCard` over a
 * structural `TrendingCardModel` that two different row models satisfy
 * "without either becoming the other". The same request has now arrived
 * about the two SURFACES the tabs merged into, and it gets the same answer
 * for the same reason: the only durable guarantee that two cards look alike
 * is that one file draws both.
 *
 * WHAT WAS ACTUALLY DIFFERENT, measured rather than felt. Explore drew a
 * 200pt photo at 9:16 — 356pt tall — in a centred column, one card to
 * roughly one screenful, with the next peeking underneath: the "zoals
 * instagram" rhythm PD-014a asked for. The feed drew an 80pt thumbnail on
 * the LEFT of a text column, so its cards were about 142pt tall and four of
 * them fitted a screen. Same panel, same border, same tokens — but one was a
 * feed and the other was a list of rows, and no amount of shared styling
 * tokens was ever going to close that.
 *
 * ===========================================================================
 * WHAT THIS FILE IS, AND WHAT IT DELIBERATELY IS NOT
 * ===========================================================================
 *
 * It is a FACE: the composition inside the panel. It is NOT the card. Each
 * of the three cards keeps its own outer element, and that is the whole of
 * how the rule below survives.
 *
 * ⚠ PROOF AND SEND CARDS ARE STILL SIBLINGS, AND THIS FILE MUST NOT BECOME
 * THE PLACE THEY STOP BEING. DESIGN-SOCIAL.md §8 and PD-016 are explicit
 * that "a send may never borrow the language of proof", and the standing
 * rule is that the two are two components, never one with a `kind` prop.
 * Nothing here takes a discriminator. What differs between the two kinds
 * stays OUTSIDE this file, in the sibling that owns it:
 *
 *   - the eyebrow — `SANNE MAAKTE DIT` against `GEDEELD DOOR JORIS` — is
 *     built by each kind's own module and handed here as a finished string;
 *   - what a tap opens — a world-readable canonical recipe against somebody
 *     else's private household meal, under different permissions — is a
 *     handler on the sibling, and this file has no `onPress` at all;
 *   - PD-020.1's entrance, which announces a directed send and must never
 *     announce an ambient dinner, is the send card's `Animated.View`;
 *   - PD-020.2's closed-loop stroke is the proof card's, passed in as a
 *     node through `titleUnderline` rather than as a flag this file reads.
 *
 * A slot takes a NODE and not a boolean on purpose. A boolean would be a
 * discriminator wearing a different hat: this file would then know which
 * kind it was drawing, and the next person needing a second difference would
 * add a second boolean rather than a second sibling.
 *
 * ===========================================================================
 * THE COMPOSITION, AND WHERE EACH PIECE OF IT CAME FROM
 * ===========================================================================
 *
 * Name, then cook time with its clock, then the still: `DecisionCard`'s
 * order, carried into `TrendingCard` on 8 September because the owner asked
 * for "een zelfde soort ervaring als bij kiezen", and carried here now for
 * the same reason. "Kip teriyaki, 25 minuten" is one thought, and it is the
 * thought that settles whether a dish is worth reading about — taken before
 * the eye reaches the picture.
 *
 * THE NAME IS `title2` AND NOT `display`, because it names one of several
 * cards and 34pt repeated down a feed is a series of posters rather than a
 * list. ⚠ IT IS ALSO NOT `title3`, WHICH IS WHAT THE TWO FRIEND CARDS USED
 * TO DRAW. That was right for an 80pt row and wrong beside a 356pt
 * photograph; a feed whose cards disagree about the size of their own name
 * is the thing the owner was looking at when he wrote the line at the top of
 * this file.
 *
 * THE TIME MOVED OUT OF THE META LINE FOR THE FRIEND CARDS. It used to be
 * the first half of "25 min · 8,5"; it is now its own row with a clock,
 * where explore has always drawn it. The meta builders are unchanged and
 * still take a cook time — the two callers simply pass `null` for it now,
 * and say so at the call site. What survives in the meta line is the GRADE,
 * and the asymmetry between the two spellings ("8,5" on proof, "8,0/10" on
 * a send) is meaning rather than form, so it is untouched.
 *
 * THE PHOTO DOES NOT SHRINK, AND MUST NOT. `DecisionCard`'s `PHOTO_WIDTH` is
 * a ceiling with a `flexShrink` chain under it, because that card lives in a
 * block that cannot scroll. These cards are inside a `FlatList`: there is no
 * height to run out of, so a shrinking photo would solve a problem that does
 * not exist and would make two cards with different amounts of text draw two
 * different sizes of picture.
 *
 * ⚠ THE VIEWPORT ARITHMETIC IS DERIVED FROM STYLESHEETS AND HAS NEVER BEEN
 * READ OFF A DEVICE, which is the same warning `TrendingCard` carried before
 * this extraction and which the extraction does not weaken. A card is about
 * 356pt of photo plus roughly 145pt of name, time, grade, creator and
 * padding; the list viewport on a 402×874 device is about 500pt once the tab
 * bar, the header and a shut filter drawer are taken off. The failure mode
 * is safe either way: this is a scrolling list, so a card taller than the
 * viewport scrolls rather than overflowing.
 */

import type { JSX, ReactNode } from 'react';
import { Image, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Icon } from '@/components/Icon';
import { isIconAvailable } from '@/components/iconFont';
import { fontFamily, getColors, radii, spacing, typeScale } from '@/theme/tokens';
// `formatCookTime` lives with the board's presentation because the board is
// where it was first needed. It is imported rather than copied for the reason
// this whole file exists: a second spelling of one minute count is how two
// surfaces end up disagreeing about the same dish.
import { formatCookTime } from './leaderboardPresentation';
import { useThumbnailFallback } from './useThumbnailFallback';

/**
 * 200pt wide at 9:16, so 356pt tall — `DecisionCard`'s number, arrived at
 * from a different direction and now shared by all three cards on Ontdek.
 *
 * NOT A SPACING TOKEN, because there is no token for it — that scale stops at
 * `space24` (96) — and adding one for a single call site would put a number
 * in a shared vocabulary only these cards can use. `DecisionCard` and
 * `TrendingCard` both make this note about this number.
 */
const PHOTO_WIDTH = 200;
const PHOTO_ASPECT_RATIO = 9 / 16;

/** 16pt — the small end of WS4's UI band, and the size `TimeCapPicker` and `DecisionCard` draw this same clock at. */
const CLOCK_GLYPH_SIZE = 16;

export interface FeedCardFaceProps {
  /**
   * The small-caps line above the name, or null when the card speaks for
   * itself.
   *
   * ⚠ A FINISHED STRING, NEVER THE PARTS IT IS MADE OF. Each card kind
   * builds its own — `buildFriendProofEyebrow` for a cook, a "Gedeeld door"
   * line for a send — and explore passes null, because nobody on the board
   * is named and nothing on it was addressed to anybody. If this file ever
   * takes a name and a verb instead, it has started deciding which kind of
   * card it is drawing.
   */
  readonly eyebrow: string | null;
  readonly title: string;
  /**
   * Drawn inside the title's own box, which shrinks to the width of the
   * name. PD-020.2's closed-loop stroke is the only thing that uses it, and
   * it arrives as a node so that this file never learns what a closed loop
   * is. Absolutely positioned by its owner, so it costs no height.
   */
  readonly titleUnderline?: ReactNode;
  /** Drawn with a clock between the name and the photo. Null simply omits the row. */
  readonly estimatedMinutes: number | null;
  readonly thumbnailUrl: string | null;
  /**
   * The post this still came from, so an expired URL can be re-signed once.
   * Only the send card has one — see useThumbnailFallback.ts on why a card
   * showing what one person sent qualifies and a board assembled per read
   * does not.
   */
  readonly thumbnailSourceUrl?: string | null;
  /**
   * Between the photo and the evidence: the sender's quoted note, the
   * closed-loop chip. A node, for `titleUnderline`'s reason.
   */
  readonly underPhoto?: ReactNode;
  /** `KeyIngredientsSummary.text`, or null when the projection carries no ingredients. */
  readonly keyIngredientsText: string | null;
  /**
   * The verdict and its evidence, never one without the other — a grade with
   * its sample removed is a picture with a number on it. Null when this card
   * has no number to show, which is the ordinary case on a proof card whose
   * cook never voted.
   */
  readonly metaLine: string | null;
  /** PD-007's attribution obligation. Null only when the source named nobody. */
  readonly creatorLine: string | null;
  /** PD-007a: labelled, never hidden. Its ABSENCE says nothing about the dish and must never be styled as reassurance. */
  readonly collisionLabel: string | null;
}

/**
 * The panel itself, exported so the three cards share one border, one radius
 * and one padding rather than three that drift.
 *
 * ⚠ `alignItems: 'center'` IS WHAT MAKES THIS A FEED. It is also why the
 * chips and the title box below set their own `alignSelf`: a chip stretched
 * across a centred column is a banner.
 */
export const feedCardPanelStyle = {
  alignItems: 'center',
  borderWidth: StyleSheet.hairlineWidth,
  borderRadius: radii.radiusSm,
  padding: spacing.space4,
} as const;

/**
 * Returns a fragment rather than a view: the card around it belongs to the
 * sibling that owns the press, the label and the animation. See this file's
 * header on why that separation is the rule and not a detail.
 */
export function FeedCardFace(props: FeedCardFaceProps): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const thumbnail = useThumbnailFallback(props.thumbnailUrl, props.thumbnailSourceUrl ?? null);
  // The same expression `RecipeTile`, `DecisionCard` and the three cards that
  // compose this face all used before it existed, character for character.
  const monogram = props.title.trim().charAt(0).toUpperCase() || '?';

  return (
    <>
      {props.eyebrow === null ? null : (
        <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>{props.eyebrow}</Text>
      )}

      {/* Shrinks to the title's own width, so an underline drawn inside it
          underlines the NAME rather than the column it sits in. No
          `numberOfLines` cap anywhere on this card, matching Kiezen:
          ellipsizing the dish name at 200% type would hide the one thing the
          card exists to show, and a list that scrolls can afford the line. */}
      <View style={styles.titleWrap}>
        <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>{props.title}</Text>
        {props.titleUnderline}
      </View>

      {/* The clock is asked for FIRST and drawn only if the installed fonts
          have it — iconFont.ts's stated contract: `Icon` renders null for a
          glyph no font can draw, and a row whose `gap` survives around
          nothing is a visible indent with no mark in it. Nothing here speaks
          on its own: the whole card is one accessibility element, and the
          time is in the sentence its owner builds. */}
      {props.estimatedMinutes === null ? null : (
        <View style={styles.timeRow}>
          {isIconAvailable('clock') ? <Icon name="clock" size={CLOCK_GLYPH_SIZE} color={colors.textMuted} /> : null}
          <Text style={[typeScale.numeral, { color: colors.textMuted }]}>
            {formatCookTime(props.estimatedMinutes)}
          </Text>
        </View>
      )}

      <View style={[styles.photoFrame, { backgroundColor: colors.surfaceSunken }]}>
        {thumbnail.showsImage ? (
          <Image
            source={{ uri: thumbnail.imageUrl ?? undefined }}
            style={styles.photo}
            resizeMode="cover"
            onError={thumbnail.onError}
            accessibilityIgnoresInvertColors
          />
        ) : (
          // The monogram, never a broken image and never a stock placeholder
          // (docs/DESIGN.md §2). On the demo seed every card draws it,
          // because all eight demo recipes have a null thumbnail and the
          // seed cannot honestly be given one.
          <Text
            style={[typeScale.title2, styles.monogram, { fontFamily: fontFamily.monoSemiBold, color: colors.textMuted }]}
          >
            {monogram}
          </Text>
        )}
      </View>

      {props.underPhoto}

      {props.keyIngredientsText === null ? null : (
        <Text style={[typeScale.bodySmall, styles.ingredients, { color: colors.textSecondary }]}>
          {props.keyIngredientsText}
        </Text>
      )}

      {props.metaLine === null ? null : (
        <Text style={[typeScale.numeral, styles.meta, { color: colors.textSecondary }]}>{props.metaLine}</Text>
      )}

      {/* Not decoration. These cards are extractions of somebody's public
          post, and PD-007's attribution obligation applies here exactly as it
          does on Bevestigen. Deliberately not a link: the whole card is one
          tap target, and a nested link would hand a screen reader two
          destinations for one visual object. */}
      {props.creatorLine === null ? null : (
        <Text style={[typeScale.caption, styles.creator, { color: colors.textMuted }]}>{props.creatorLine}</Text>
      )}

      {props.collisionLabel === null ? null : (
        <View style={[styles.chip, { backgroundColor: colors.warningMuted }]}>
          <Text style={[typeScale.caption, { color: colors.warning }]}>{props.collisionLabel}</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: spacing.space1,
    textAlign: 'center',
  },
  titleWrap: {
    // Shrink-to-fit, so `titleUnderline` spans the name and not the column.
    alignSelf: 'center',
    position: 'relative',
  },
  title: {
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // No gap around nothing: with the clock unavailable this row holds one
    // child and `gap` contributes only BETWEEN children, so the number stays
    // where it is rather than sitting behind an empty indent.
    gap: spacing.space2,
    marginTop: spacing.space2,
  },
  photoFrame: {
    width: PHOTO_WIDTH,
    aspectRatio: PHOTO_ASPECT_RATIO,
    // A phone narrower than 240pt would otherwise let a fixed 200 push the
    // card wider than the screen. It costs nothing on every device that
    // exists and it is one property rather than a second layout.
    maxWidth: '100%',
    marginTop: spacing.space4,
    borderRadius: radii.radiusSm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    ...StyleSheet.absoluteFill,
  },
  monogram: {
    textAlign: 'center',
  },
  ingredients: {
    marginTop: spacing.space2,
    textAlign: 'center',
  },
  meta: {
    marginTop: spacing.space3,
  },
  creator: {
    marginTop: spacing.space1,
  },
  chip: {
    marginTop: spacing.space2,
    alignSelf: 'center',
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
    borderRadius: radii.radiusSm,
  },
});

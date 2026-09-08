/**
 * One card of Trending's `Iedereen` feed: the dish, how long it takes, its
 * own photo, the grade with the evidence behind it, and its creator.
 *
 * ===========================================================================
 * IT REPLACES A ROW, AND THE OWNER ASKED FOR THAT IN SO MANY WORDS
 * ===========================================================================
 *
 * VERBATIM, 8 SEPTEMBER 2026: "Als ik naar de trending tab ga, kan ik niet op
 * de recepten klikken die ik daar zie, ook hebben ze geen foto, een soort
 * scroll feature zou ik hier liever willen dan een ranking. Ik wil dat je
 * hier gewoon een zelfde soort ervaring krijgt als bij kiezen maar dan dat je
 * naar beneden kan scrollen en er een nieuw recept komt. Bijvoorbeeld zoals
 * instagram met foto's werkt. Ook hier wil ik dat je een filter kan
 * aanzetten."
 *
 * What it replaces is `BoardRow`, which lived inline in
 * (tabs)/ranglijst.tsx: a three-column strip of rank, text block, and no
 * image at all. PD-014's amendment of the same date records what the change
 * costs — the rank, and the scannability of twenty-five lines against one
 * card at a time — and what it deliberately does not touch: the supply, the
 * ordering, and the absence of personalisation.
 *
 * ===========================================================================
 * WHY THERE WAS NO PHOTO, WHICH WAS A DEFECT AND NOT A DECISION
 * ===========================================================================
 *
 * `BoardRowModel` has carried `thumbnailUrl` since it existed and
 * `toBoardRecipe` has always filled it; `BoardRow` simply never drew an
 * `<Image>`. Independently confirmed by useThumbnailFallback.ts's own header,
 * which enumerates the app's `<Image>` call sites — `RecipeTile`,
 * `FriendRecipeCard`, `FriendProofCard`, `KringRow` — and does not name
 * `BoardRow`. So the DEFAULT scope of this tab has never been able to show a
 * picture, while the `Vrienden` scope beside it always could.
 *
 * ⚠ ON THE DEMO SEED EVERY CARD STILL DRAWS THE MONOGRAM, AND THAT IS THE
 * CORRECT BEHAVIOUR RATHER THAN A FAILURE. All eight demo recipes have
 * `thumbnail_url = null` (measured in the local database), and the seed
 * cannot honestly be given one: these URLs are pre-signed and short-lived,
 * research/13-legal-tos.md records that reading oEmbed is permitted and
 * downloading is not, so any invented URL answers 403 and any copied image is
 * not ours to ship. `DecisionCard`'s header pins the rule — "the monogram,
 * never a broken image and never a stock placeholder." The only way real
 * photographs appear here is a real import.
 *
 * IT GOES THROUGH `useThumbnailFallback` LIKE THE FIVE `<Image>` SITES BEFORE
 * IT. An EXPIRED thumbnail is not null — it is a well-formed URL that answers
 * 403 — so branching on `thumbnailUrl !== null` alone is precisely the bug
 * that hook exists for, and here the failure would be a grey rectangle
 * standing where the dish should be.
 *
 * ===========================================================================
 * THE COMPOSITION IS KIEZEN'S, ON PURPOSE, WITH TWO THINGS CHANGED
 * ===========================================================================
 *
 * Name, then cook time with its clock, then the still: `DecisionCard`'s
 * order, because the owner asked for "een zelfde soort ervaring" and because
 * the argument that put the time there holds identically here — "kip
 * teriyaki, 25 minuten" is one thought, and it is the thought that settles
 * whether a dish is worth reading about, taken before the eye reaches the
 * picture.
 *
 * FIRST CHANGE: THE NAME IS `title2` AND NOT `display`. On Kiezen the dish
 * name is the only thing on the screen and 34pt is the point. Here it names
 * one of several cards, and 34pt repeated down a feed is a series of posters
 * rather than a list — the reader would have to scroll past a headline to
 * find out what it is a headline for.
 *
 * SECOND CHANGE: THE PHOTO DOES NOT SHRINK, AND MUST NOT. `DecisionCard`'s
 * `PHOTO_WIDTH` is a CEILING with a `flexShrink` chain under it, because that
 * card lives in a `heroBlock` that cannot scroll and overflow there drew on
 * top of the filter bar. This card is inside a `FlatList`: there is no height
 * to run out of, so a shrinking photo would solve a problem that does not
 * exist here and would make two cards with different amounts of text draw two
 * different sizes of picture. Same number, opposite constraint.
 *
 * WHAT IT IS NOT: A GRID TILE. 9:16 and not the 4:5 that ui-research's
 * ASSEMBLY.md §2.2 recommends, for the reason `DecisionCard` already gives —
 * that recommendation is about DENSITY in a grid, it is D11 and it is an
 * owner decision that has not landed, and cropping this still tighter than
 * Bibliotheek's would make one image look like two.
 *
 * ===========================================================================
 * THE CARD IS NOT PRESSABLE, AND THAT IS NOW A BLOCKED REQUEST RATHER THAN A
 * DESIGN POSITION
 * ===========================================================================
 *
 * The owner asked for the tap first — "kan ik niet op de recepten klikken die
 * ik daar zie" — and he is owed it. `BoardRow` and `KringRow` both argued
 * that the absence was the contract; that argument is now half wrong. The
 * PREMISE still holds and the CONCLUSION is no longer the owner's position.
 *
 * The premise: there is no screen in this app that shows a canonical recipe.
 * `/recipe/[mealId]` reads a household's own `meals` row and a canonical
 * recipe is not one; `/friends/[feedItemId]` resolves a feed item and would
 * answer a recipe id with "Dit recept staat er niet meer", which is a lie
 * about a recipe that exists.
 *
 * THE THREE DESTINATIONS AND WHY NONE COULD BE BUILT IN THIS PACKAGE,
 * measured rather than estimated:
 *
 *   A. NO TAP. Honest, and what ships today — but it is a description of what
 *      is in the way, not an answer to what he asked.
 *   B. THE SOURCE POST, via `recipes.normalized_url` and the existing
 *      `openExternalUrl` (src/components/externalLinking.ts). Blocked on data
 *      rather than on effort: `normalized_url` is NOT on
 *      `CanonicalRecipeSummary` and `listCanonicalRecipes` does not select it
 *      (verified in src/lib/repository/social/types.ts), and that file
 *      belongs to a package running in parallel with this one. It is also the
 *      weakest of the three on its own merits — a link out of the app is not
 *      a route to cooking, which is PD-014's fourth condition.
 *   C. A REAL CANONICAL RECIPE SCREEN whose action is "bewaren". The only
 *      destination that satisfies PD-004 and PD-014.4 at once, and it is a
 *      package rather than a prop: it needs a new route, a repository read
 *      returning a canonical recipe's ingredients and steps (none exists —
 *      `listCanonicalRecipes` returns a summary), and a write copying a
 *      `recipes` row into `meals`. That write exists nowhere in this codebase:
 *      `/friends/[feedItemId]` has no "Opslaan" for exactly this reason and
 *      says so in its own header.
 *
 * So the absence stays and it stops being described as a contract. There is
 * still no `onPress` prop, deliberately: an action that silently does nothing
 * is worse than no action, and a prop nobody can fill in honestly is an
 * invitation to fill it in dishonestly.
 *
 * IT DOES NOT ANIMATE. `DecisionCard` fades and rises because it is one
 * verdict arriving; a feed where every card did that on scroll would be
 * motion for its own sake, and PD-020.1's entrance is reserved for a directed
 * send actually arriving.
 */

import type { JSX } from 'react';
import { Image, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Icon } from '@/components/Icon';
import { isIconAvailable } from '@/components/iconFont';
import { fontFamily, getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { buildBoardRowAccessibilityLabel, formatCookTime, type BoardRowModel } from './leaderboardPresentation';
import { useThumbnailFallback } from './useThumbnailFallback';

export interface TrendingCardProps {
  readonly row: BoardRowModel;
}

/**
 * 200pt wide at 9:16, so 356pt tall — `DecisionCard`'s number, to the point,
 * and arrived at from a different direction.
 *
 * There it is what a 544pt hero block can hold. Here it is what makes one
 * card roughly one screenful, which is the "zoals instagram" rhythm: a card
 * comes to about 356pt of photo plus ~145pt of name, time, grade, creator and
 * padding, and the list viewport on a 402x874 device is about 500pt once the
 * tab bar, the header and a shut filter drawer are taken off. So one card
 * fills the view and the next one peeks — the thing that says "scroll"
 * without a control saying it.
 *
 * ⚠ THOSE VIEWPORT NUMBERS ARE DERIVED FROM STYLESHEETS, NOT MEASURED ON A
 * DEVICE. The header's height depends on `SegmentedControl` and on Dynamic
 * Type, and neither has been read off a phone for this screen. What is safe
 * either way is the failure mode: this is a scrolling list, so a card that
 * turns out taller than the viewport scrolls rather than overflowing — which
 * is precisely the risk `DecisionCard` could not take and had to pay for with
 * a `flexShrink` chain.
 *
 * NOT A SPACING TOKEN, because there is no token for it — that scale stops at
 * `space24` (96) — and adding one for a single call site would put a number
 * in a shared vocabulary only this card can use. `DecisionCard` makes the
 * same note about the same number.
 */
const PHOTO_WIDTH = 200;
const PHOTO_ASPECT_RATIO = 9 / 16;

/** 16pt — the small end of WS4's UI band, and the exact size `TimeCapPicker` and `DecisionCard` draw this same clock at. One unit, one mark. */
const CLOCK_GLYPH_SIZE = 16;

export function TrendingCard(props: TrendingCardProps): JSX.Element {
  const { row } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const photo = useThumbnailFallback(row.thumbnailUrl);
  // The same expression `RecipeTile`, `FriendProofCard`, `FriendRecipeCard`,
  // `KringRow` and `DecisionCard` use, character for character — a sixth
  // spelling of one fallback is how six surfaces end up disagreeing about an
  // untitled dish.
  const monogram = row.title.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={buildBoardRowAccessibilityLabel(row)}
    >
      {/* No numberOfLines cap, matching Kiezen: ellipsizing the dish name at
          200% type would hide the one thing the card exists to show, and a
          list that scrolls can afford the extra line. */}
      <Text style={[typeScale.title2, styles.title, { color: colors.textPrimary }]}>{row.title}</Text>

      {/* The clock is asked for FIRST and drawn only if the installed fonts
          have it — iconFont.ts's stated contract: `Icon` renders null for a
          glyph no font can draw, and a row whose `gap` survives around nothing
          is a visible indent with no mark in it. Nothing in this card speaks
          on its own: the whole card is one accessibility element carrying the
          sentence `buildBoardRowAccessibilityLabel` builds, and the time is
          in it. */}
      {row.estimatedMinutes === null ? null : (
        <View style={styles.timeRow}>
          {isIconAvailable('clock') ? <Icon name="clock" size={CLOCK_GLYPH_SIZE} color={colors.textMuted} /> : null}
          <Text style={[typeScale.numeral, { color: colors.textMuted }]}>{formatCookTime(row.estimatedMinutes)}</Text>
        </View>
      )}

      <View style={[styles.photoFrame, { backgroundColor: colors.surfaceSunken }]}>
        {photo.showsImage ? (
          <Image
            source={{ uri: row.thumbnailUrl ?? undefined }}
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

      {/* The verdict and its evidence, never one without the other. PD-014's
          justification for this whole surface rests on the vote count being
          here: a grade with its sample removed is a picture with a number on
          it, and this would be a stream of plates. */}
      <Text style={[typeScale.numeral, styles.meta, { color: colors.textSecondary }]}>{row.metaLine}</Text>

      {/* Not decoration. These cards are extractions of somebody's public
          post, and PD-007's attribution obligation applies here exactly as it
          does in the feed and on Bevestigen. */}
      <Text style={[typeScale.caption, styles.creator, { color: colors.textMuted }]}>{row.creatorLine}</Text>

      {/* PD-007a: labelled, never hidden, and never ranked down on this
          surface — see leaderboardPresentation.ts for why the ordering is the
          half that gives. Its absence says nothing about the dish. */}
      {row.collisionLabel === null ? null : (
        <View style={[styles.chip, { backgroundColor: colors.warningMuted }]}>
          <Text style={[typeScale.caption, { color: colors.warning }]}>{row.collisionLabel}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // The same proof-sheet panel every list surface in this app uses (DESIGN
    // §8, §9), so Trending and Vrienden still read as siblings after the row
    // became a card. What changed is the composition inside the panel; the
    // panel itself is unchanged.
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.radiusSm,
    padding: spacing.space4,
  },
  title: {
    textAlign: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // No gap around nothing: with the clock unavailable this row holds one
    // child and `gap` contributes only BETWEEN children, so the number stays
    // where it is rather than sitting behind an empty indent. `TimeCapPicker`
    // and `DecisionCard` both make this note about this glyph.
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
  meta: {
    marginTop: spacing.space3,
  },
  creator: {
    marginTop: spacing.space1,
  },
  chip: {
    marginTop: spacing.space2,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
    borderRadius: radii.radiusSm,
  },
});

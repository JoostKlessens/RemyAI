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
 * ⚠ DESTINATION C WAS BUILT ON 10 SEPTEMBER 2026, AND THE PREMISE ABOVE IS
 * NO LONGER TRUE. `/friends/recipe/[recipeId]` is "a real canonical recipe
 * screen whose action is bewaren": a route, a full read
 * (`getCanonicalRecipe`, which returns ingredients AND steps — the thing C
 * said did not exist), and the `recipes` -> `meals` write that shipped with
 * `Bewaren` on 9 September (`5767bda`). It was built for GAP-32's proof
 * cards on the Vrienden tab, and THIS card is still not wired to it.
 *
 * The correction is recorded rather than the paragraph deleted, because
 * what is left is a genuinely different question. C's blockers are gone;
 * what remains is PD-014, which is about this tab and not about this
 * component: the board is "identical for every reader" and a tap that leads
 * to a household's own save is the first place that could stop being true.
 * Whoever answers it has one line to write, not a package.
 *
 * IT DOES NOT ANIMATE. `DecisionCard` fades and rises because it is one
 * verdict arriving; a feed where every card did that on scroll would be
 * motion for its own sake, and PD-020.1's entrance is reserved for a directed
 * send actually arriving.
 */

import type { JSX } from 'react';
import { View, useColorScheme } from 'react-native';
import { getColors } from '@/theme/tokens';
import { FeedCardFace, feedCardPanelStyle } from './FeedCardFace';
import { buildBoardRowAccessibilityLabel } from './leaderboardPresentation';

/**
 * Exactly what this card draws, and nothing else.
 *
 * IT IS A STRUCTURAL SHAPE AND NOT ONE OF THE TWO ROW MODELS, so both
 * scopes of Trending can hand their rows to one component without either
 * model having to become the other. `BoardRowModel` and `KringRowModel`
 * both satisfy it; neither imports it.
 *
 * `rank` IS ABSENT ON PURPOSE. Both models carry one and this card draws
 * neither — the ordering is the information, a printed number on a photo
 * card is a scoreboard, and PD-014a kept the ordering while dropping the
 * scoreboard. Listing it here would invite it back onto the card.
 */
export interface TrendingCardModel {
  readonly recipeId: string;
  readonly title: string;
  /** Whatever the scope means by "the evidence": vote count on the board, named friends in the kring. */
  readonly metaLine: string;
  readonly creatorLine: string;
  readonly thumbnailUrl: string | null;
  readonly collisionLabel: string | null;
  readonly dishTags: readonly string[];
  readonly estimatedMinutes: number | null;
}

export interface TrendingCardProps {
  readonly row: TrendingCardModel;
}

/**
 * ⚠ THE COMPOSITION LEFT THIS FILE ON 11 SEPTEMBER 2026 AND IS NOW SHARED.
 * `PHOTO_WIDTH`, `PHOTO_ASPECT_RATIO`, `CLOCK_GLYPH_SIZE`, the whole
 * stylesheet and the render body all moved to `FeedCardFace.tsx`, with their
 * arguments intact — the 200pt-at-9:16 reasoning, the "one card is roughly
 * one screenful" rhythm, and the warning that those viewport numbers are
 * derived from stylesheets rather than read off a device.
 *
 * WHY: the owner said the feed side of Ontdek "is nu geen feed meer zoals
 * die bij ontdekken is, dat is wel de bedoeling." The two friend cards drew
 * an 80pt thumbnail beside a text column where this one drew a 356pt
 * photograph, so the same screen held two different ideas of what a card is.
 * They compose the same face now. That is the same answer the same owner
 * request got on 8 September for the two SCOPES — one component, satisfied
 * structurally, "without either becoming the other" — applied to the two
 * SURFACES the tabs merged into.
 *
 * WHAT DID NOT MOVE: this card's model, its accessibility sentence, and the
 * fact that it does not press. `TrendingCardModel` is still the structural
 * shape above, `BoardRowModel` still satisfies it without importing it, and
 * the open PD-014 question about the tap is still open and still recorded in
 * this header.
 */
export function TrendingCard(props: TrendingCardProps): JSX.Element {
  const { row } = props;
  const colors = getColors(useColorScheme());

  return (
    <View
      style={[feedCardPanelStyle, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={buildBoardRowAccessibilityLabel(row)}
    >
      <FeedCardFace
        // Null, because nobody on the board is named and nothing on it was
        // addressed to anybody. The two friend cards pass a person here; that
        // difference is the surfaces speaking, not the card.
        eyebrow={null}
        title={row.title}
        estimatedMinutes={row.estimatedMinutes}
        // No source URL, deliberately: `BoardRecipe` does not carry one, and a
        // leaderboard capped at 25 rows is populated by a ranking rather than
        // by anything this household did. See useThumbnailFallback.ts.
        thumbnailUrl={row.thumbnailUrl}
        // A canonical list projection carries no ingredients — see
        // `CanonicalRecipeSummary`. Null is the projection, not the schema.
        keyIngredientsText={null}
        // The verdict and its evidence, never one without the other. PD-014's
        // justification for this whole surface rests on the vote count being
        // here: a grade with its sample removed is a picture with a number on
        // it, and this would be a stream of plates.
        metaLine={row.metaLine}
        creatorLine={row.creatorLine}
        // PD-007a: labelled, never hidden, and never ranked down on this
        // surface — see leaderboardPresentation.ts for why the ordering is the
        // half that gives. Its absence says nothing about the dish.
        collisionLabel={row.collisionLabel}
      />
    </View>
  );
}

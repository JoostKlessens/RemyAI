/**
 * What the corner of a library tile draws for a recipe: a grade, a chef's
 * hat, or — only if the font ever loses that hat — a word.
 *
 * ===========================================================================
 * WHY THE BADGE HAD TO CHANGE AT ALL
 * ===========================================================================
 *
 * It drew `buildSchedulingLabel` in full. WS-2 §5.3 measured what that costs
 * on the OLD two-column grid: "Nog geen planning" is 138.4pt of a 170.5pt
 * tile — 81% of the tile width — and at 320pt it is 122.4pt of a 134pt tile
 * and overflows. At three columns the tile is 109.7pt wide at 393pt and
 * 85.3pt at 320pt, so the full label is not close to fitting; the frame's
 * `overflow: hidden` would clip it mid-word, silently, from the left.
 *
 * WS-2's redline was `maxWidth: 60%` plus `numberOfLines: 1`, with a
 * requirement handed to WS-3: at 12pt mono the budget is 11 characters at
 * 393pt and 8 at 320pt for a TWO-column grid. Three columns tightens that to
 * roughly five (`LIBRARY_TILE_BADGE_TEXT_BUDGET_CHARS` below), which no
 * amount of rewording rescues: "Deze week" is nine and "Al gekookt" is ten.
 *
 * ===========================================================================
 * THEN THE CHECK MARK TURNED OUT TO SAY THE OPPOSITE OF WHAT IT MEANT
 * ===========================================================================
 *
 * THE OWNER, VERBATIM, after looking at the app on a device: "in the picture,
 * the top right corner, you have a check mark or some time like that you want
 * to cook it at some time in the future. And I think we need to make a more
 * logical decision here on what that should look like so that it matches too
 * that you have cooked it before or haven't cooked it before. So maybe use an
 * icon for that."
 *
 * He read the `al_gekookt` check as "I WANT to cook this" — a to-do box, which
 * is what a check mark beside a calendar means nearly everywhere else in
 * software. The badge meant the exact opposite: "I ALREADY cooked this". The
 * check became `cooked` (a chef's hat, iconFont.ts) and the corner otherwise
 * stayed a PLANNING mark: a calendar for `deze_week`, the word "Ooit" for
 * `ooit`, nothing at all for `geen_planning`.
 *
 * ===========================================================================
 * AND THE HAT TURNED OUT TO BE ONLY HALF AN ANSWER
 * ===========================================================================
 *
 * THE OWNER, VERBATIM: "Om duidelijk te maken dat je het recept nog niet hebt
 * gemaakt is het misschien beter om het cijfer dat je het recept gaf weer te
 * geven, als het niet zo is kan je een chefsmuts laten zien (die nu als
 * icoontje staat voor iets dat al gekookt is maar dan met witte achtergrond
 * in plaats van groen)."
 *
 * TWO THINGS ARE BEING SAID THERE, AND BOTH ARE ABOUT THE SAME MISSING HALF.
 *
 * (1) A HAT ON THE COOKED ONES AND NOTHING ON THE REST DOES NOT ANSWER "HAVE
 * I MADE THIS?". It answers it in one direction only. An absent badge is not
 * a statement — it is indistinguishable from a badge the reader has not
 * noticed, from a state the tile does not model, and from a bug. The previous
 * design deleted `geen_planning`'s chrome on the argument that "a bare tile
 * among badged ones reads as 'this one has no plan'", which was a defensible
 * reading of an ABSENCE while the badge was about plans. It is not a
 * defensible way to say "je hebt dit nog niet gemaakt", which is the sentence
 * the owner is now asking the corner for. So every tile wears a mark.
 *
 * (2) A GRADE SAYS MORE THAN A HAT AND COSTS NO MORE ROOM. `formatGrade`
 * writes a Dutch report-card grade — "7,5", four characters at the very worst
 * ("10,0"), inside the five-character budget derived below. A hat says "you
 * made this"; a number says "you made this AND here is what you thought",
 * which is the fact a household actually chooses tonight's dinner on.
 *
 * ===========================================================================
 * SO THE CORNER SWAPPED AXES, AND THIS IS WHAT THAT COST
 * ===========================================================================
 *
 * The corner used to answer "what is the plan for this dish". It now answers
 * "have I made this dish, and how was it". It cannot answer both: it is one
 * mark 14pt wide, and the previous header's own measurement of why a SECOND
 * mark would be dishonest still stands unchanged —
 * `resolveRecipeSchedulingState` (recipeScheduling.ts) returns exactly ONE
 * state and consults cook events FIRST, so a cooked meal's plan is discarded
 * upstream and there is no planning fact left in these props to draw.
 *
 * WHAT WAS DISPLACED, NAMED HONESTLY: the `calendar` for `deze_week` and the
 * word "Ooit" for `ooit`. Both were good marks. Losing them means a tile no
 * longer shows, at a glance, that a dish is in this week's plan.
 *
 * WHY THAT WAS ACCEPTED. The plan is not gone from the screen, only from the
 * corner, and three places still carry it — each checked rather than
 * remembered:
 *
 *   - `LibrarySearchBar` draws one filter chip per scheduling state, labelled
 *     with `buildSchedulingLabel` (LibrarySearchBar.tsx, the `visibleStates`
 *     map), so "Deze week" is a control on this very screen.
 *   - `sortMealsByScheduling` still orders `deze_week` first
 *     (`STATE_SORT_ORDER`, recipeScheduling.ts), so the planned dishes are
 *     the ones already at the top of the grid.
 *   - src/app/deze-week.tsx is a whole screen of nothing else.
 *
 * And the tile still SPEAKS its state in full — see
 * `buildLibraryTileSpokenState` below. The made/not-made fact had none of
 * those three fallbacks: before this change it existed nowhere but in a badge
 * that only appeared half the time.
 *
 * IF THE OWNER WANTS BOTH AXES BACK ON ONE TILE, this is not the file to
 * start in. `RecipeSchedulingInfo` would have to carry the plan alongside the
 * cook history — a type twenty-two modules import — and the tile would need a
 * second slot the previous header already rejected on the grid geometry.
 *
 * ===========================================================================
 * THE THIRD STATE THE INSTRUCTION DOES NOT MENTION, AND THE DATA HAS
 * ===========================================================================
 *
 * "Cooked" and "graded" are not the same set. `CookEvent.rating` is nullable
 * — src/domain/types.ts: "Null when the question was skipped" — and skipping
 * is a first-class answer, not a gap: ratingScaleCopy.ts labels the way out
 * "Klaar", precisely so that walking past the question counts as finishing.
 * Older events predate the field entirely. So a real, common third state
 * exists: MADE, BUT NEVER SCORED.
 *
 * Three answers were available and two of them lie.
 *
 *   A white hat — treat ungraded as not-made. REJECTED: it states, in the one
 *   mark the owner asked to be unambiguous, that a meal the household cooked
 *   was never cooked. It is the exact inversion the check mark was replaced
 *   for, re-introduced one state to the left.
 *
 *   A stand-in numeral — a dash, a "?", a 0. REJECTED: a placeholder in a
 *   slot the reader has learned holds a grade IS a grade to the eye at 12pt,
 *   and a zero on a ten-point scale is the worst thing a household ever said
 *   about a meal. This project does not ship a plausible-looking untruth.
 *
 *   THE GREEN HAT — what `al_gekookt` already drew. TAKEN. It is exactly
 *   true: you made this, and no claim about the grade is made because there
 *   is none. It also gives the palette its meaning, which is what makes the
 *   whole corner readable with one drawing: GREEN says made, the neutral
 *   surface says not made, and a NUMBER is a green-family enrichment of
 *   "made" rather than a fourth thing to learn. RecipeTile's
 *   `resolveBadgeStyle` owns those two colours and the contrast evidence.
 *
 * The cost, stated plainly: an ungraded cooked meal and a graded one no
 * longer look identical, but an ungraded cooked meal and... nothing else
 * looks like it either — the hat on green is unique to "made". The reader
 * loses only the grade, which does not exist.
 *
 * ===========================================================================
 * ONE DRAWING, ONE FONT, AND WHY THE INJECTED PROBE IS WORTH MORE NOW
 * ===========================================================================
 *
 * `isIconAvailable` IS INJECTED so a test can exercise the fallback branch.
 * It defaults to the real one, so no call site passes anything. The previous
 * header argued this was worth more after the badge came to depend on two
 * fonts (Feather's `calendar`, MaterialCommunityIcons' `cooked`). That
 * particular reason has now expired — there is one glyph left — and the
 * parameter is worth MORE again for the opposite reason: the whole corner
 * hangs on that single glyph in all four states, so a font swap does not
 * degrade half the grid, it degrades all of it at once.
 *
 * The fallback is the state's FULL spoken word, over budget and clipped by
 * `maxWidth` plus `numberOfLines: 1` at the call site — deliberately, because
 * a visibly truncated word is a better failure than a silently invented one,
 * and it only happens on a font swap this module's own test fails first. Note
 * what the fallback is: the planning label, because `buildSchedulingLabel` is
 * the only true sentence available about a state whose glyph has gone
 * missing. A graded tile needs no font at all and is unaffected.
 *
 * ⚠ ONE COMMENT ELSEWHERE IS NOW NARROWER THAN THE TRUTH, and is left alone
 * because it is not this change's file: iconFont.ts calls `cooked` "the
 * library tile's history mark". It draws the absence of history too, now. The
 * icon key names its DRAWING (a chef's hat, a kitchen object) rather than the
 * state, which is what lets one glyph carry both directions.
 */

import { RATING_MAX, formatGrade } from '@/domain/rating';
import { isIconAvailable as installedIconAvailable, type IconName } from './iconFont';
import { buildSchedulingLabel, type RecipeSchedulingInfo } from './recipeScheduling';

/**
 * How many characters a visible text badge may carry.
 *
 * Derived, not chosen: 60% of the narrowest tile this grid produces (85.3pt
 * at 320pt across three columns) is 51.2pt, less 16pt of horizontal padding
 * leaves 35.2pt, and `typeScale.caption` is 12pt monospace at roughly 7.2pt
 * per character. That is 4.8, so five.
 *
 * Asserted in tests/libraryTileBadge.test.ts against EVERY grade the scale in
 * src/domain/rating.ts can produce, walked in steps rather than sampled — so
 * a future move to a wider scale (a percentage, say) fails there rather than
 * being clipped on a phone nobody tested. A ten-point scale at one decimal
 * peaks at "10,0", four characters.
 */
export const LIBRARY_TILE_BADGE_TEXT_BUDGET_CHARS = 5;

/**
 * A badge is always one of these two. There is no `none` any more: the whole
 * point of the redesign is that an empty corner cannot say "nog niet
 * gemaakt", and a variant nothing returns is a branch nobody has run.
 */
export type LibraryTileBadge =
  | { readonly kind: 'icon'; readonly icon: IconName }
  | { readonly kind: 'text'; readonly label: string };

/**
 * The one drawing this corner uses, in BOTH directions — the colour is what
 * separates them (RecipeTile's `resolveBadgeStyle`). iconFont.ts carries
 * which glyph it resolves to and the candidates it beat, including why
 * `pot-steam` — the truer drawing of "gekookt" — was unavailable, already
 * spent on the `wok` dish tag that the SAME screen renders in its "Ingrediënten"
 * chip row.
 */
const COOKED_MARK: IconName = 'cooked';

/**
 * The grade this tile may print, or null when there is none to print.
 *
 * THE STATE GUARD IS NOT BELT-AND-BRACES. `resolveRecipeSchedulingState`
 * never builds a row carrying a grade for an uncooked meal, but this function
 * is the thing that makes that structural rather than a habit: a number in
 * this corner is a claim that somebody cooked the dish, so it is refused for
 * any state but the one that means exactly that.
 *
 * The grade's VALIDITY is not re-checked here on purpose. recipeScheduling.ts
 * drops off-scale values at the single point where `lastRating` is built, so
 * a second check here would be a second definition of "a showable grade" —
 * and the one that drifts is always the copy.
 */
function resolveShowableGrade(scheduling: RecipeSchedulingInfo): number | null {
  if (scheduling.state !== 'al_gekookt') {
    return null;
  }
  return scheduling.averageRating ?? null;
}

/**
 * The badge for a row — total over every state, so nothing can render an
 * undefined.
 *
 * Reading order is the owner's own: the grade if there is one, otherwise the
 * hat, otherwise (font gone) the word.
 */
export function describeLibraryTileBadge(
  scheduling: RecipeSchedulingInfo,
  isIconAvailable: (name: IconName) => boolean = installedIconAvailable,
): LibraryTileBadge | null {
  /*
    NOTHING AT ALL FOR A DISH YOU HAVE NOT COOKED, since 8 September 2026.

    The owner: "Misschien beter om het chefshoedje bij mijn recepten (om aan
    te tonen dat je het nog niet hebt gekookt) weg te halen, het is niet
    informatief en ziet er raar uit."

    Both halves are right and the first is the one that matters. The corner
    drew the SAME chef's hat whether or not the dish had been made, and
    separated the two meanings by fill colour alone — green for cooked,
    `surface` for not. So the mark carried no information on its own: you had
    to already know the convention to read it, and it fired on the ORDINARY
    state, which most tiles in a library are in. A badge that marks the
    default is decoration in a badge's clothes.

    THE HAT SURVIVES FOR THE ONE CASE IT ACTUALLY REPORTS: cooked, no grade.
    There it says something the tile says nowhere else — you made this — and
    the green is docs/DESIGN.md's completion colour doing its documented job.
    It is now the only case that draws it, so drawing and meaning are
    one-to-one for the first time.

    ⚠ THE `al_gekookt` GUARD SITS BEFORE THE GRADE LOOKUP, which is belt and
    braces: `resolveShowableGrade` already returns null for every other
    state, so a grade can only exist here. Written as two checks anyway,
    because the day somebody lets a planned dish carry a rating this function
    should keep its promise rather than quietly start badging planning again.
  */
  if (scheduling.state !== 'al_gekookt') {
    return null;
  }

  const grade = resolveShowableGrade(scheduling);
  if (grade !== null) {
    return { kind: 'text', label: formatGrade(grade) };
  }
  if (isIconAvailable(COOKED_MARK)) {
    return { kind: 'icon', icon: COOKED_MARK };
  }
  // The font-gone fallback, unchanged in kind and now reachable only for a
  // cooked dish — so the word it renders is `al_gekookt`'s and never a
  // planning state's.
  return { kind: 'text', label: buildSchedulingLabel(scheduling.state) };
}

/**
 * What a screen reader is told about this tile's state, and the one place the
 * old "a badge costs a screen-reader user nothing" argument stopped holding.
 *
 * WS-2 §3.2's reasoning was that the badge is chrome whose text the tile
 * already speaks, which is why it was safe to shorten it to a glyph and safe
 * to drop it entirely. That was true of every mark this corner has ever
 * carried — until the grade, which appears NOWHERE ELSE on the tile. Drawing
 * it without speaking it would be the first time this component showed a
 * sighted reader something a screen-reader user could not get.
 *
 * "van 10" IS APPENDED BECAUSE A NUMBER ALONE IS NOT A GRADE. A sighted
 * reader infers the scale from a green chip in a Dutch app; a listener hears
 * "zeven komma vijf" with nothing to measure it against. Both halves reuse
 * wording the app already speaks rather than inventing any: OutcomeCard says
 * "Klaar, cijfer <grade> opslaan" and RatingScale announces "<grade> van
 * <RATING_MAX>".
 *
 * The scale is read from RATING_MAX rather than written down, so a move off
 * the ten-point scale does not leave this sentence lying.
 */
export function buildLibraryTileSpokenState(scheduling: RecipeSchedulingInfo): string {
  const spokenState = buildSchedulingLabel(scheduling.state);
  const grade = resolveShowableGrade(scheduling);
  if (grade === null) {
    return spokenState;
  }
  return `${spokenState}, cijfer ${formatGrade(grade)} van ${RATING_MAX}`;
}

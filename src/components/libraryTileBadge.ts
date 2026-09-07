/**
 * What the corner of a library tile draws for a recipe's scheduling state:
 * a glyph, a short word, or nothing at all.
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
 * 393pt and 8 at 320pt for a TWO-column grid, and "the fourth label needs to
 * be <= 8 characters". Three columns tightens that to roughly five
 * (`LIBRARY_TILE_BADGE_TEXT_BUDGET_CHARS` below), which no amount of
 * rewording rescues: "Deze week" is nine and "Al gekookt" is ten.
 *
 * ===========================================================================
 * THE OWNER ASKED FOR ICONS, AND THIS IS THE PLACE THEY ACTUALLY PAY
 * ===========================================================================
 *
 * "hoe je dit zou willen doen met duidelijke, overzichtelijke icoontjes."
 *
 * A glyph is 14pt wide where a word is 80, so this corner is where an icon
 * buys back real space rather than merely looking modern.
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
 * software. The badge meant the exact opposite: "I ALREADY cooked this". That
 * is not a taste complaint about a glyph. It is a mark whose only available
 * reading on a real device was the INVERSE of its meaning, on the one state
 * where being wrong changes what the household cooks tonight.
 *
 * ===========================================================================
 * MEASURED BEFORE ANYTHING WAS REDRAWN: THIS CORNER HAS ONLY ONE AXIS IN IT
 * ===========================================================================
 *
 * The obvious redesign is to split the corner in two — a PLANNING mark
 * (calendar / someday / nothing) plus a separate, quieter COOKED mark —
 * because "is this planned" and "have I made this before" are two independent
 * facts and one badge can carry only one of them.
 *
 * THEY ARE NOT INDEPENDENT HERE, and that was measured rather than assumed.
 * `resolveRecipeSchedulingState` (src/components/recipeScheduling.ts:45-63)
 * returns exactly ONE state and consults cook events FIRST: a single cook
 * event returns `al_gekookt` and that meal's saves are never looked at. So
 * across every value `RecipeSchedulingInfo` can hold:
 *
 *   deze_week     -> zero cook events. NEVER cooked.
 *   ooit          -> zero cook events. NEVER cooked.
 *   geen_planning -> zero cook events. NEVER cooked.
 *   al_gekookt    -> at least one cook event; any plan is discarded upstream.
 *
 * The four states are ALREADY a partition of the owner's own question.
 * "Cooked it before" is exactly `al_gekookt`; "haven't cooked it before" is
 * exactly the other three. A second mark would therefore have nothing to say:
 * on three of four states it is absent by definition, and on the fourth there
 * is no planning fact left in the props to draw. Rendering one anyway would
 * mean inventing a fact this tile was never given.
 *
 * SO TWO MARKS WERE REJECTED ON THE DATA, NOT ON THE SIZE OF THE CORNER.
 * Making two marks honest would mean widening `RecipeSchedulingInfo` to carry
 * both axes — a type twenty-two modules import (`grep -rl recipeScheduling src
 * tests`), including the library filter, the sort order, the search index and
 * the friends feed's vocabulary. That is a domain change wearing a badge
 * redesign's clothes. If the household ever needs "gepland EN al eens gekookt"
 * on one tile, that resolver is where the work starts, not here.
 *
 * ===========================================================================
 * WHAT SHIPPED: ONE BADGE, WITH THE MARKS SPLIT BY KIND INSTEAD OF BY SLOT
 * ===========================================================================
 *
 * The badge stays a single mark, and the four states divide into two visual
 * KINDS. That is what makes the partition legible without a second chip: the
 * reader is never asked to tell two slots apart, only to tell a planning
 * object from a kitchen object.
 *
 *   PLANNING MARKS — how definite the plan is. All three mean "never cooked".
 *
 *     deze_week   -> `calendar`. A plan with a date on it. UNCHANGED; it was
 *                    never the mark anyone misread, and moving it to keep a
 *                    set tidy would spend the one badge that already works.
 *
 *     ooit        -> the WORD "Ooit". Four characters, inside the budget at
 *                    every supported width — and kept as a word ON PURPOSE
 *                    now that a 7448-glyph font is installed and this
 *                    header's original excuse ("no glyph in Remy's vocabulary
 *                    means someday") has expired. Two reasons it survives.
 *
 *                    (1) EVERY CANDIDATE LIES. `bookmark` is true of all four
 *                    states — everything in this grid is saved — so it
 *                    distinguishes nothing. `calendar-blank` is the same
 *                    rounded box with the same header bar as Feather's
 *                    `calendar`; what separates them is the date grid, and at
 *                    14pt that is a pixel or two. `clock` already means "hoe
 *                    lang mag het duren" on this very screen, and iconFont.ts
 *                    refuses clock faces for new meanings by standing rule.
 *
 *                    (2) AN ALL-GLYPH CORNER TEACHES NOBODY WHAT THE CORNER
 *                    IS ABOUT. One legible Dutch word among the marks is the
 *                    anchor that makes the calendar beside it read as
 *                    PLANNING rather than as decoration — which is precisely
 *                    the reading that failed on the device.
 *
 *     geen_planning -> NOTHING. The end of `resolveBadgeStyle`'s own argument
 *                    in RecipeTile, which already gave this state "the least
 *                    visual weight, not a warning colour". The least weight
 *                    available is none, and a bare tile among badged ones
 *                    reads as "this one has no plan" without spending a
 *                    single character on the state that says least. It is
 *                    also the most common state in a fresh library, so it is
 *                    the one whose chrome is worth deleting.
 *
 *   A HISTORY MARK — a kitchen object, categorically not a planning object.
 *
 *     al_gekookt  -> `cooked`, which iconFont.ts draws with
 *                    MaterialCommunityIcons' `chef-hat`. Was `check`, and
 *                    that swap is the whole fix: a check belongs to TASK-LIST
 *                    vocabulary, which is why it inverted, and no kitchen
 *                    object can be read as "to do" because nothing about a
 *                    hat is a completion state. iconFont.ts carries which
 *                    glyph and which better ones were rejected — `pot-steam`
 *                    is the truer drawing of "gekookt" and is already spent
 *                    on the `wok` dish tag, which the SAME screen renders in
 *                    its "Waarmee?" chip row (LibrarySearchBar, via
 *                    `iconForDishTag`).
 *
 * WHAT WAS DELIBERATELY LEFT ALONE: the badge COLOURS, in RecipeTile's
 * `resolveBadgeStyle`. `al_gekookt`'s `positiveMuted`/`positive` pairing is
 * asserted by tests/contrast.test.ts and cited by name in ShoppingListRow.tsx
 * ("the 'gemaakt' chip in RecipeTile.tsx uses the same `positive`-on- ..."),
 * so re-toning it here would falsify a comment in a file this change does not
 * own, in order to fix something that was not broken. The glyph was read
 * backwards; the colour was not.
 *
 * NOTHING IS LOST TO A SCREEN READER, AND THAT IS WHY A GLYPH SWAP IS ALLOWED
 * TO BE THE WHOLE FIX. `RecipeTile`'s `accessibilityLabel` is
 * `"<title>, <buildSchedulingLabel(state)>"` and is untouched, so every tile
 * still announces "Al gekookt" and "Nog geen planning" in full, in the same
 * words, before and after this change. The badge was always chrome whose text
 * is already spoken elsewhere — WS-2 §3.2 says so in as many words — which is
 * what makes it safe to shorten, to redraw and to drop. A reader who cannot
 * see this corner never depended on it and still does not.
 *
 * `isIconAvailable` IS INJECTED so a test can exercise the fallback branch.
 * It defaults to the real one, so no call site passes anything; the parameter
 * exists because the fallback is unreachable (both glyphs resolve) and an
 * unreachable branch nobody has ever run is a branch that will be wrong the
 * first time a glyph moves. It is worth MORE after this change than before:
 * `calendar` comes from Feather and `cooked` from MaterialCommunityIcons, so
 * the two badges now hang off two DIFFERENT fonts and either can go missing
 * alone. GAP-19 was expected to be that moment and turned out not to be — it
 * ADDED MaterialCommunityIcons beside Feather on 7 September 2026 rather than
 * swapping the font — but this two-font split is the shape in which a font
 * swap finally bites.
 */

import { isIconAvailable as installedIconAvailable, type IconName } from './iconFont';
import { buildSchedulingLabel, type RecipeSchedulingState } from './recipeScheduling';

/**
 * How many characters a visible text badge may carry.
 *
 * Derived, not chosen: 60% of the narrowest tile this grid produces (85.3pt
 * at 320pt across three columns) is 51.2pt, less 16pt of horizontal padding
 * leaves 35.2pt, and `typeScale.caption` is 12pt monospace at roughly 7.2pt
 * per character. That is 4.8, so five. Asserted in
 * tests/libraryTileBadge.test.ts against every label this module can return,
 * so a future state whose word does not fit fails there rather than being
 * clipped on a phone nobody tested.
 */
export const LIBRARY_TILE_BADGE_TEXT_BUDGET_CHARS = 5;

/**
 * `none` is a real answer and not a null: a caller that has to distinguish
 * "no badge" from "a badge I could not describe" would otherwise have to
 * invent the difference, and there is only one of them.
 */
export type LibraryTileBadge =
  | { readonly kind: 'icon'; readonly icon: IconName }
  | { readonly kind: 'text'; readonly label: string }
  | { readonly kind: 'none' };

/**
 * Which glyph a state draws, for the two that have an honest one. The absent
 * keys are the argument and not an omission: `ooit` keeps its word and
 * `geen_planning` keeps its silence — the header says why each was chosen
 * over a glyph that exists today and would fit.
 *
 * The two entries are deliberately of different KINDS. A calendar is a
 * planning object; a chef's hat is a kitchen one. A reader who has learned
 * the first has not thereby been taught to expect the second in the same
 * role, which is exactly what `check` got wrong: it belongs to the same
 * task-list family as a calendar, so it read as the NEXT STEP in a plan
 * instead of as a past event.
 */
const ICON_BY_STATE: Readonly<Partial<Record<RecipeSchedulingState, IconName>>> = {
  deze_week: 'calendar',
  al_gekookt: 'cooked',
};

/**
 * The badge for a state — total over the union, so nothing can render an
 * undefined.
 *
 * A state with a glyph the font cannot draw falls back to its FULL spoken
 * label rather than to an abbreviation nobody has agreed on. That label is
 * over budget and would be clipped by `maxWidth` plus `numberOfLines: 1` at
 * the call site — deliberately, because a visibly truncated word is a better
 * failure than a silently invented one, and it only happens on a font swap
 * that this module's own test will have failed first.
 */
export function describeLibraryTileBadge(
  state: RecipeSchedulingState,
  isIconAvailable: (name: IconName) => boolean = installedIconAvailable,
): LibraryTileBadge {
  if (state === 'geen_planning') {
    return { kind: 'none' };
  }
  const icon = ICON_BY_STATE[state];
  if (icon !== undefined && isIconAvailable(icon)) {
    return { kind: 'icon', icon };
  }
  return { kind: 'text', label: state === 'ooit' ? 'Ooit' : buildSchedulingLabel(state) };
}

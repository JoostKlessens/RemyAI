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
 * A glyph is 14pt wide where a word is 80. Two of the four states have an
 * honest one in the installed font, checked rather than assumed:
 *
 *   deze_week   -> `calendar`. A plan with a date on it.
 *   al_gekookt  -> `check`. Done.
 *
 * The other two do not, and this module refuses to invent them — the whole
 * contract of iconFont.ts/Icon.tsx:
 *
 *   ooit        -> the WORD "Ooit". Four characters, inside the budget at
 *                  every supported width. No glyph in Remy's vocabulary
 *                  means "someday": the nearest candidate is `clock`, and
 *                  `clock` already means "hoe lang mag het duren" on this
 *                  very screen, on the filter bar's own picker. iconFont.ts
 *                  refuses to map `timer` onto `clock` for exactly this
 *                  reason ("a clock face already means 'hoeveel tijd heb ik'
 *                  elsewhere in this app"), and the same refusal applies
 *                  here.
 *
 *   geen_planning -> NOTHING. The end of `resolveBadgeStyle`'s own argument
 *                  in RecipeTile, which already gave this state "the least
 *                  visual weight, not a warning colour". The least visual
 *                  weight available is none, and a bare tile among badged
 *                  ones reads as "this one has no plan" without spending a
 *                  single character on the state that says least. It is also
 *                  the most common state in a fresh library, so it is the
 *                  one whose chrome is worth deleting.
 *
 * NOTHING IS LOST TO A SCREEN READER. `RecipeTile`'s `accessibilityLabel` is
 * `"<title>, <buildSchedulingLabel(state)>"` and is untouched, so every tile
 * still announces "Nog geen planning" in full. The badge was always chrome
 * whose text was already spoken elsewhere — WS-2 §3.2 says so in as many
 * words — which is precisely what makes it safe to shorten and to drop.
 *
 * `isIconAvailable` IS INJECTED so a test can exercise the fallback branch.
 * It defaults to the real one, so no call site passes anything; the parameter
 * exists because the fallback is unreachable (both glyphs resolve against
 * Feather) and an unreachable branch nobody has ever run is a branch that
 * will be wrong the first time a glyph moves. GAP-19 was expected to be that
 * moment and turned out not to be — it ADDED MaterialCommunityIcons beside
 * Feather on 7 September 2026 rather than swapping the font, so `calendar`
 * and `check` never moved. The injection keeps its point for the swap that
 * has not happened yet.
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

/** Which glyph a state would use, for the two that have an honest one. See the header for why the other two have none. */
const ICON_BY_STATE: Readonly<Partial<Record<RecipeSchedulingState, IconName>>> = {
  deze_week: 'calendar',
  al_gekookt: 'check',
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

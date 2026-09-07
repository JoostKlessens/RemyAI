/**
 * Every Dutch word `TimeCapPicker` says.
 *
 * A `.ts` beside a `.tsx`, for the reason every sibling `*Copy.ts` module
 * in this directory gives: vitest runs in a `node` environment with
 * react-native stubbed (tests/stubs/react-native.ts), so a sentence written
 * inside a component is a sentence nothing can assert.
 *
 * ===========================================================================
 * IT RESTATES NOTHING. EVERY WORD IS IMPORTED.
 * ===========================================================================
 *
 * The picker replaces two chip rows that asked the same question in two
 * places — `DecisionFilterBar`'s `TIME_OPTIONS` and the library's, whose
 * words live in `libraryFilterCopy.ts`. Those words were argued carefully
 * once already: "Alles" for the absence of a cap, "20 min" for one, and an
 * accessibility label that admits what the visible chip has no room to say
 * — that an explicit cap drops every dish nobody ever timed
 * (`isWithinMaxMinutes`, src/domain/exclusions.ts). All of that is exactly
 * as true of a ladder as it was of a chip row.
 *
 * So this module is an adapter and not a second vocabulary. Retyping
 * "Alles" here would create two strings for one idea, on two screens, at
 * the precise moment those two screens started sharing a control — the
 * drift this codebase's comments warn about repeatedly, arrived at by
 * copying rather than by disagreeing.
 *
 * WHY THE INDIRECTION EXISTS AT ALL, given that a component could import
 * `describeTimeCapOption` directly: the module it lives in is named for the
 * LIBRARY, and Kiezen is not the library. A shared control importing
 * `libraryFilterCopy` reads as a mistake even when it is not, and it is the
 * kind of import somebody eventually "fixes" by copying the string. This
 * file is the neutral name, and it is where these constants should MOVE
 * when the library's chip row is finally deleted — at which point
 * libraryFilterCopy.ts keeps its dish-tag and mood copy and loses its time
 * copy to here, with no caller changing.
 */

import { LIBRARY_FILTER_TIME_GROUP_LABEL, describeTimeCapOption } from './libraryFilterCopy';
import type { TimeCap } from '@/domain/timeCap';

/**
 * What a screen reader calls the control itself, before it reads the value.
 *
 * "Maximale kooktijd", with no "voor vanavond" — and that loss is worth
 * naming, because `DecisionFilterBar` currently says "Maximale kooktijd
 * voor vanavond" and this control will not. One control shared by two
 * screens can carry one name, or it carries a prop that lets each screen
 * ship a different one, which is how two screens quietly become two
 * controls. The screen keeps its own eyebrow above the picker ("HOEVEEL
 * TIJD?" on Kiezen), so the context is still on the surface — it is just
 * not inside the control any more.
 */
export const TIME_CAP_ACCESSIBILITY_LABEL = LIBRARY_FILTER_TIME_GROUP_LABEL;

/**
 * What the picker draws beside the clock: "45 min", or "Alles" for the open
 * end of the ladder.
 *
 * The open end is WORDS on purpose. `timeCap.ts` puts "geen limiet" at the
 * wide end because that is where the absence of a maximum belongs on an
 * axis whose subject is width — and the one thing keeping it from reading
 * as "the cap after 120" is that it never renders as a number.
 */
export function formatTimeCap(cap: TimeCap): string {
  return describeTimeCapOption(cap).label;
}

/**
 * What a screen reader says the value IS: "Maximaal 45 minuten. Gerechten
 * zonder tijd vallen af." — or, for the open end, "Alle kooktijden. Geen
 * maximum."
 *
 * Only the capped stops carry the untimed-dishes note, and that asymmetry
 * is most of what makes this function worth having: with no cap set nothing
 * is dropped for lacking a duration, so warning about it would be a caveat
 * about a thing that is not happening. libraryFilterCopy.ts owns both
 * sentences and tests/libraryFilterCopy.test.ts already holds the
 * asymmetry; this is the same pair of strings reaching a different control.
 */
export function describeTimeCap(cap: TimeCap): string {
  return describeTimeCapOption(cap).accessibilityLabel;
}

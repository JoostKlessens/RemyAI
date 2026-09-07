/**
 * Every Dutch word `VanavondActionRow` says.
 *
 * A `.ts` beside a `.tsx`, for the reason every sibling `*Copy.ts` module in
 * this directory gives: vitest runs in a `node` environment with react-native
 * stubbed (tests/stubs/react-native.ts), so a sentence written inside a
 * component is a sentence nothing can assert. Until 7 September 2026 these
 * five strings were JSX literals and the row was the only Kiezen surface with
 * no copy module at all — survivable while the words were `Ja` and `Iets
 * anders`, two strings nobody was ever going to change. One of them has now
 * changed, and the argument for the new one is a relationship between two
 * labels rather than a preference about either, so it needs somewhere a test
 * can reach it.
 *
 * ===========================================================================
 * `Ja` BECAME `Dit koken`, AND THIS OVERRULES WS3 §3.10
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM, 7 SEPTEMBER 2026: "Bij kiezen wil ik een
 * grotere thumbnail van het gerecht, dit kunnen we denk ik al deels regelen
 * door het volgende te doen: 1. Verwijder de teksten 'hoeveel tijd' en
 * kiezen. 2. Zorg dat 'Ja' (dit mag je overigens veranderen in 'Dit koken')
 * en 'iets anders' naast elkaar komen te staan in plaats van boven elkaar. Zo
 * kunnen we d thumbnail een stuk groter maken dat ziet er beter uit."
 *
 * He gave permission, not an order — "dit mag je overigens" — and the rename
 * is taken anyway, against a research document that says in as many words not
 * to. docs/ui-research/WS3 §3.10 "Deliberately unchanged, and why" lists
 * `Ja` · `Iets anders` · `Ik kies zelf` · `Niet koken` as "the four best
 * labels in the product" and calls `Ja` "the whole thesis in two letters".
 * That was written while `DecisionCard` drew a `KIEZEN` eyebrow ABOVE the
 * dish, so the screen posed a question and `Ja` answered it. Point 1 of the
 * instruction above deletes that eyebrow. WITHOUT A QUESTION, `Ja` IS AN
 * ANSWER TO NOTHING — the two halves of his instruction are coupled, and
 * WS3's sentence is true of a screen that stops existing with this change.
 *
 * The second reason is point 2, and it is the one a test can hold. Side by
 * side the two labels are read as a pair, in boxes of identical width: `Ja`
 * (2 characters) beside `Iets anders` (11) leaves the primary button mostly
 * empty and reads as a bug. See `VANAVOND_LABEL_LENGTH_TOLERANCE`.
 *
 * PUTTING `Ja` BACK IS ONE LINE — the constant below and nothing else, since
 * every call site imports it. But it should not go back alone: it belongs to
 * the eyebrow, and restoring the word without restoring the question is how
 * this screen ends up answering itself.
 */

/**
 * How far apart, in characters, the accept label and the secondary label
 * beside it may be.
 *
 * Three, because `Dit koken` (9) sits beside `Iets anders` (11) and, once the
 * swaps are spent, `Ik kies zelf` (12) — so 3 is the wider of those two gaps
 * rather than a round number chosen to clear them both comfortably. A limit
 * with slack in it is a limit nobody notices crossing.
 *
 * This is a layout constraint and not a style rule because the row is two
 * `flex: 1` halves: both buttons are exactly half the row no matter what is
 * written in them, so an unbalanced pair cannot be absorbed the way it could
 * when each button was full width on a row of its own.
 * `tests/vanavondActionCopy.test.ts` is where it fails.
 */
export const VANAVOND_LABEL_LENGTH_TOLERANCE = 3;

/**
 * The primary, accent-filled half. See the header for why it is no longer
 * `Ja`.
 *
 * A verb phrase and not a noun ("Koken", "Dit gerecht"): both halves of the
 * row name an ACT now, which is what makes them read as a pair of choices
 * rather than as an answer beside an escape hatch. The rejected alternative
 * was `Dit wordt het` — warmer, and four characters too long to sit beside
 * `Iets anders` without the tolerance above turning into decoration.
 */
export const VANAVOND_ACCEPT_LABEL = 'Dit koken';

/**
 * What VoiceOver and TalkBack say instead of the button face.
 *
 * It names the evening, which the visible label has no room for. This is the
 * one irreversible tap on the screen — it writes the decision row and
 * navigates to Kookmodus — and a screen-reader user gets neither the accent
 * stroke nor the photo, so this sentence carries the whole signal that
 * tonight is being settled here.
 *
 * Not "Dit koken, dit kook ik vanavond": a spoken label REPLACES the face, it
 * does not prefix it, so leading with the visible words spends the opening
 * syllables on something the user is not going to hear twice.
 */
export const VANAVOND_ACCEPT_ACCESSIBILITY_LABEL = 'Dit kook ik vanavond';

/**
 * The secondary half while PD-001's two swaps last. Unchanged, and WS3 §3.10
 * is still right about it — it is the accept label that moved.
 */
export const VANAVOND_ALTERNATIVE_LABEL = 'Iets anders';

export const VANAVOND_ALTERNATIVE_ACCESSIBILITY_LABEL = 'Toon een ander gerecht';

/**
 * What is left in that slot once both swaps are spent (PD-001). Styled
 * identically to the affordance it replaces — never accent-filled — so the
 * escape hatch never grows into the primary path.
 *
 * `NoCandidateState.tsx:131` writes this same string inline for its
 * `swaps_exhausted` branch. That is a second spelling of one idea and it
 * belongs here, but that file is outside this change; noted so the next
 * person finds the duplicate rather than adding a third.
 */
export const VANAVOND_CHOOSE_SELF_LABEL = 'Ik kies zelf';

export const VANAVOND_CHOOSE_SELF_ACCESSIBILITY_LABEL = 'Ik kies zelf, open Mijn recepten';

/**
 * What a spent swap budget sounds like.
 *
 * Deliberately carries no number, which is exactly what separates it from
 * `describeAlternativesRemaining`: "nog 0 keer" describes a limit that is
 * still counting, and this describes a state that has stopped. The button it
 * hangs off has already been replaced by the time this is spoken, so a
 * countdown reaching zero would be narrated by a control that no longer
 * exists.
 */
export const VANAVOND_CHOOSE_SELF_HINT = 'Geen wissels meer beschikbaar vandaag';

/**
 * The accessibility hint under "Iets anders": how many of PD-001's two swaps
 * are left today.
 *
 * Typed `1 | 2` rather than `0 | 1 | 2` on purpose. `DecisionResult`'s
 * `alternativesRemaining` is the wider union, and at 0 the caller renders a
 * different button entirely — so making the zero case unrepresentable here
 * means the row cannot accidentally speak a countdown beside "Ik kies zelf".
 * This forces the caller to narrow with `!== 0` rather than `> 0`, because
 * TypeScript narrows a numeric literal union on equality and not on
 * comparison; `VanavondActionRow` says so at its own branch.
 *
 * No plural branch, because Dutch does not need one — "keer" is invariant for
 * 1 and 2 alike, so a `remaining === 1 ? 'keer' : 'keren'` ternary would be a
 * correct-looking bug written by someone thinking in English.
 */
export function describeAlternativesRemaining(remaining: 1 | 2): string {
  return `Nog ${remaining} keer beschikbaar vandaag`;
}

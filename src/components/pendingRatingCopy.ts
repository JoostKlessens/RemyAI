/**
 * The words the delayed rating sheet says, and the one thing it must never
 * claim.
 *
 * WHY A COPY MODULE RATHER THAN LITERALS IN THE `.tsx` — the same reason
 * `decisionFilterCopy.ts` and `vanavondActionCopy.ts` exist since GAP-39:
 * a route or component file cannot be imported by this repo's test run at
 * all (expo-router and react-native internals fail to parse under Vite), so
 * a sentence written as JSX is a sentence no test can read. These strings
 * get asserted; the sheet only arranges them.
 *
 * THE QUESTION IS NOT RE-ASKED IN A NEW VOICE. `RATING_QUESTION` ("Hoe was
 * het?") already exists in ratingScaleCopy.ts and is what the outcome card
 * used to ask at the pan. This sheet asks the SAME question at a better
 * moment, so it imports that constant rather than minting a synonym — two
 * phrasings of one question is how a product starts sounding like two
 * products.
 *
 * WHAT THE TITLE MAY AND MAY NOT SAY. It names the dish and nothing else.
 * It must not say when it was cooked ("gisteravond"), because this module
 * cannot know: `selectPendingRating` returns the OLDEST due cook, which
 * after a quiet week is not last night, and a sheet that guesses wrong
 * about somebody's own evening is worse than a sheet that does not guess.
 * The delay is the reason the sheet is here; it is not a fact to boast
 * about on it.
 */
import { RATING_QUESTION } from './ratingScaleCopy';

export { RATING_QUESTION };

/**
 * The line above the question, naming the dish.
 *
 * A STATEMENT AND NOT A QUESTION, so the sheet asks exactly one thing. The
 * question below it is `RATING_QUESTION`; a title phrased as "Hoe was de
 * lasagne?" would ask it twice and leave the scale answering the second
 * copy.
 */
export function buildPendingRatingTitle(mealTitle: string): string {
  return `Je hebt ${mealTitle} gemaakt.`;
}

/**
 * The sentence under the title, and it exists to explain the DELAY.
 *
 * Somebody opening the app is being asked about a meal they finished
 * cooking half a day ago, which without a word of explanation reads as the
 * app having lost track of time. This is the owner's own reason, given back
 * to the reader: "anders heb je het waarschijnlijk nog helemaal niet
 * gegeten".
 */
export const PENDING_RATING_REASON = 'We vragen het pas achteraf, als je het ook echt gegeten hebt.';

/** Commits whatever the scale currently drafts, exactly like the outcome card's `Klaar`. */
export const PENDING_RATING_CONFIRM_LABEL = 'Klaar';

/**
 * The way out without answering, and it is a real answer rather than a
 * dodge.
 *
 * PD-008's rule — "skipping must cost exactly what answering costs" —
 * survives the move to a sheet: one tap either way, both on ordinary
 * controls. `cook_events.rating` stays null, `averageCookRating` leaves an
 * ungraded cook out of the mean rather than scoring it zero, and nothing is
 * marked as needing a follow-up.
 *
 * ⚠ IT DOES NOT PROMISE "WE VRAGEN HET NIET OPNIEUW", and that is a real
 * difference from `CookSharingAskSheet`'s decline. That sheet asks once,
 * ever. This one asks per cook, and skipping this dish says nothing about
 * the next one — so the label must not imply a permanence the feature does
 * not implement.
 */
export const PENDING_RATING_SKIP_LABEL = 'Niet nu';

/** Spoken on the confirm button, both halves, because one word does two jobs. */
export function buildPendingRatingConfirmAccessibilityLabel(draft: string | null): string {
  return draft === null ? 'Klaar, zonder beoordeling' : `Klaar, cijfer ${draft} opslaan`;
}

/** Spoken hint on the confirm button, matching the label's two states. */
export function buildPendingRatingConfirmAccessibilityHint(hasDraft: boolean): string {
  return hasDraft ? 'Slaat het gekozen cijfer op en sluit' : 'Sluit zonder een cijfer te geven';
}

/** The sheet's own accessible name, so a screen reader lands on what this is about. */
export function buildPendingRatingAccessibilityLabel(mealTitle: string): string {
  return `${buildPendingRatingTitle(mealTitle)} ${RATING_QUESTION}`;
}

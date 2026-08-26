/**
 * Pure copy + option-building helpers for the "Hoe was het?" rating
 * control (src/components/RatingScale.tsx, rendered by OutcomeCard). No
 * React Native imports here on purpose, so this is unit-testable directly
 * under vitest's `node` environment — the same split
 * `allergenTaggingCopy.ts` and `recipeScheduling.ts` already use.
 *
 * NAMED `ratingScaleCopy`, NOT `ratingScale`: the component beside it is
 * `RatingScale.tsx`, and on a case-insensitive filesystem (Windows, and
 * macOS by default) two modules differing only in their first letter's
 * case collide — TypeScript resolves `./RatingScale` to whichever of the
 * two it loaded first and reports TS1149. The `*Copy.ts` suffix matches
 * `allergenTaggingCopy.ts` / `importFailureCopy.ts` anyway, so this ends
 * up being the house convention rather than a workaround. Do not rename
 * it back.
 *
 * THE SCALE IS NEVER WRITTEN DOWN HERE. Every value below is derived from
 * src/domain/rating.ts's constants, which that file's header declares the
 * single source of truth. A move to a Dutch 1-10 report-card scale must
 * change rating.ts plus one CHECK constraint in a migration and nothing
 * else — no chip count to update, no label list to extend, no announcement
 * string with a hardcoded "van 5" baked into it.
 *
 * WHY NUMBERS AND NOT STARS: docs/DESIGN.md bans emoji as a status
 * indicator anywhere in the product and keeps Feather icons sparse, so a
 * ★★★☆☆ row is out on both counts. Numerals also fit the visual direction
 * better than a borrowed app-store idiom — anything measured or systemic
 * in Remy reads as "timecode burned into the frame", set in mono. The
 * other rejected alternative was a thumbs-up/thumbs-down pair: it
 * collapses the middle band rating.ts exists to protect, which is exactly
 * the lukewarm-meal signal inflation `toRepeatSignal` returning null is
 * designed to prevent.
 */

import { RATING_MAX, RATING_MIN, RATING_STEP, toRepeatSignal } from '@/domain/rating';

/**
 * Asked once, plainly, and never repeated. PD-002's optional decline
 * reason is the precedent for the whole control: the question is offered,
 * and walking past it is a complete answer. Nothing here may plead.
 */
/**
 * Re-exported, not defined here. Both moved into src/domain/rating.ts when
 * the Kiezen reason started printing grades: reason.ts is domain code and
 * cannot import from components, and a second copy of the decimal comma is
 * how one screen ends up saying "7.5". Kept exported from this module so
 * every existing importer and test keeps working unchanged.
 */
import { RATING_DECIMALS, formatGrade } from '@/domain/rating';

export { RATING_DECIMALS, formatGrade };

export const RATING_QUESTION = 'Hoe was het?';

/**
 * The way out. Deliberately labelled "Klaar" and not "Sla over" or "Nee,
 * dank je": skipping is not declining something, it is finishing — the
 * outcome ("Gemaakt!") is already fully recorded above this row, and the
 * rating is a bonus on top of it. Calling it a skip would imply something
 * was left unfinished, which is the nag PD-003 forbids in a politer voice.
 */
export const RATING_SKIP_LABEL = 'Klaar';

/** The low end of the scale, in consequence terms rather than taste terms. */
export const RATING_ANCHOR_LOW = 'Nooit meer';

/** The high end, likewise. */
export const RATING_ANCHOR_HIGH = 'Graag weer';

/**
 * Announced before the chips are read, so "optioneel" arrives before the
 * first number rather than after the last — a screen-reader user should
 * know they can leave without answering before they start working through
 * the options, not after.
 */
export const RATING_GROUP_ACCESSIBILITY_LABEL = 'Hoe was het, optioneel';

/**
 * What the numeral shows before anybody has touched the slider.
 *
 * An en dash, not a grade. The slider deliberately does not open
 * pre-filled: a thumb resting on 5,5 with "5,5" above it is an opinion the
 * app invented and the cook would have to correct, and PD-008 is explicit
 * that a rating which nags is a rating that gets lied to. Until it is
 * touched there is no grade, and the control says so.
 */
export const RATING_UNSET_LABEL = '–';

/**
 * Where the thumb rests before first touch, as a fraction of the track.
 *
 * The middle, because every other resting place is an argument: hard left
 * reads as a 1,0 already given, hard right as a 10,0. The middle plus the
 * en-dash numeral reads as "nothing chosen yet", which is what is true.
 */
export const RATING_UNSET_TRACK_FRACTION = 0.5;

/**
 * How far one assistive-technology increment moves the grade.
 *
 * DELIBERATELY COARSER THAN RATING_STEP, and this is a real trade-off
 * rather than an oversight. VoiceOver and TalkBack adjust an `adjustable`
 * control one increment per swipe; at the 0,1 step that is ninety swipes
 * to cross the scale, which is not an accessible control, it is a
 * technically-conformant one. A half grade crosses it in eighteen and
 * lands on the values people actually give. The cost is that a 7,3 cannot
 * be reached by swiping, only by touch. If that ever matters to a real
 * user, the fix is a way to type the grade, not a finer increment.
 */
export const RATING_ACCESSIBILITY_STEP = 0.5;

/**
 * Snaps any raw number onto a legal grade: in range, and on the step.
 *
 * The `toFixed` round-trip is not decoration. Accumulating 0.1 in binary
 * floating point drifts (0.1 * 3 is 0.30000000000000004), so a snapped
 * value built by multiplication can miss `isValidRating` by a
 * quadrillionth and be thrown away as off-scale — a vote silently lost to
 * arithmetic nobody can see. Rounding to the scale's own decimal count
 * settles it in decimal, where the scale lives.
 */
export function snapRatingToStep(value: number): number {
  const clamped = Math.min(RATING_MAX, Math.max(RATING_MIN, value));
  const steps = Math.round((clamped - RATING_MIN) / RATING_STEP);
  return Number((RATING_MIN + steps * RATING_STEP).toFixed(RATING_DECIMALS));
}

/** Where along the track a grade sits, 0 at the scale minimum and 1 at its maximum. */
export function ratingToTrackFraction(rating: number): number {
  const clamped = Math.min(RATING_MAX, Math.max(RATING_MIN, rating));
  return (clamped - RATING_MIN) / (RATING_MAX - RATING_MIN);
}

/**
 * The grade at a fraction along the track. Out-of-range fractions clamp
 * rather than throw: a finger dragged past either end of the track is an
 * ordinary gesture, not an error, and it should pin to the end the way
 * every slider a person has ever used does.
 */
export function trackFractionToRating(fraction: number): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  return snapRatingToStep(RATING_MIN + clamped * (RATING_MAX - RATING_MIN));
}

/** One assistive-technology increment up or down, pinned to the ends of the scale. */
export function nudgeRating(rating: number, direction: 1 | -1): number {
  return snapRatingToStep(rating + direction * RATING_ACCESSIBILITY_STEP);
}

/**
 * What `AccessibilityInfo.announceForAccessibility` says the moment a chip
 * is tapped.
 *
 * The card commits and dismisses itself on that tap (see RatingScale.tsx
 * for why one tap and not two), so there is no confirmation screen a
 * screen reader would naturally pick up — the same gap OutcomeCard's
 * existing "Gemaakt! Nog een keer?" announcement covers for its in-place
 * morph.
 *
 * The consequence clause is read off `toRepeatSignal`, never re-derived
 * from the thresholds here. That matters most for the middle band: it
 * promises nothing, because it genuinely records nothing scoreable, and a
 * cheerful "komt vaker terug" for a shrug would be a lie about what Remy
 * just wrote down.
 */
export function describeRatingAnnouncement(rating: number): string {
  const position = `${formatGrade(rating)} van ${RATING_MAX}`;
  const signal = toRepeatSignal(rating);
  if (signal === true) {
    return `${position}. Dit gerecht komt vaker terug.`;
  }
  if (signal === false) {
    return `${position}. Dit gerecht komt minder vaak terug.`;
  }
  return `${position}. Genoteerd.`;
}

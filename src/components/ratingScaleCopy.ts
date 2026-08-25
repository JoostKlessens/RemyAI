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

import { RATING_MAX, RATING_MIN, toRepeatSignal } from '@/domain/rating';

export interface RatingOption {
  /** The score itself, on rating.ts's scale. */
  readonly value: number;
  /** What the chip shows: the bare numeral, set in mono. */
  readonly label: string;
  /**
   * What a screen reader says. Always states the score's position on the
   * scale ("3 van 5"), because a lone "3" is meaningless out of context,
   * and the two ends additionally carry the anchor words — the visual
   * anchor row beside the chips is hidden from assistive tech, so without
   * this the meaning of the numbers is simply lost.
   */
  readonly accessibilityLabel: string;
}

/**
 * Asked once, plainly, and never repeated. PD-002's optional decline
 * reason is the precedent for the whole control: the question is offered,
 * and walking past it is a complete answer. Nothing here may plead.
 */
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
 * One option per whole number on the scale, ascending.
 *
 * Returns a fresh array rather than a module-level frozen constant: the
 * array is handed straight to a `.map()` in a React component, and a
 * shared instance is one careless in-place `.sort()` away from reordering
 * the scale for every render left in the session. Rebuilding a
 * five-element array per render costs nothing measurable next to that.
 */
export function buildRatingOptions(): readonly RatingOption[] {
  const options: RatingOption[] = [];
  for (let value = RATING_MIN; value <= RATING_MAX; value += 1) {
    options.push({
      value,
      label: String(value),
      accessibilityLabel: buildOptionAccessibilityLabel(value),
    });
  }
  return options;
}

function buildOptionAccessibilityLabel(value: number): string {
  const position = `${value} van ${RATING_MAX}`;
  if (value === RATING_MIN) {
    return `${position}, ${RATING_ANCHOR_LOW.toLowerCase()}`;
  }
  if (value === RATING_MAX) {
    return `${position}, ${RATING_ANCHOR_HIGH.toLowerCase()}`;
  }
  return position;
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
  const position = `${rating} van ${RATING_MAX}`;
  const signal = toRepeatSignal(rating);
  if (signal === true) {
    return `${position}. Dit gerecht komt vaker terug.`;
  }
  if (signal === false) {
    return `${position}. Dit gerecht komt minder vaak terug.`;
  }
  return `${position}. Genoteerd.`;
}

import { describe, expect, test } from 'vitest';
import {
  RATING_ANCHOR_HIGH,
  RATING_ANCHOR_LOW,
  RATING_GROUP_ACCESSIBILITY_LABEL,
  RATING_QUESTION,
  RATING_ACCESSIBILITY_STEP,
  RATING_SKIP_LABEL,
  RATING_UNSET_LABEL,
  RATING_UNSET_TRACK_FRACTION,
  describeRatingAnnouncement,
  formatGrade,
  nudgeRating,
  ratingToTrackFraction,
  snapRatingToStep,
  trackFractionToRating,
} from '@/components/ratingScaleCopy';
import {
  RATING_MAX,
  RATING_MIN,
  RATING_NEGATIVE_AT_OR_BELOW,
  RATING_POSITIVE_AT_OR_ABOVE,
  RATING_STEP,
  isValidRating,
} from '@/domain/rating';

/**
 * Every assertion below derives its expectation from src/domain/rating.ts's
 * constants rather than writing "5" or "1..5" out by hand. That is the
 * whole contract this file exists to guard: rating.ts says the scale lives
 * there and nowhere else, so moving to a Dutch 1-10 report-card scale must
 * be an edit to that one file — not an edit here, and certainly not an
 * edit to the component that renders these chips.
 */

/**
 * The neutral middle band, derived. tests/rating.test.ts already asserts
 * this band is non-empty; recomputing it here (instead of importing a
 * literal 3) keeps these tests honest if the thresholds move apart.
 */
const MIDDLE_BAND_RATING = RATING_NEGATIVE_AT_OR_BELOW + 1;

/**
 * Every grade the slider can emit has to satisfy `isValidRating`, or a
 * vote is silently dropped downstream as off-scale. These sweep the whole
 * track rather than spot-checking, because the failure mode is arithmetic
 * drift at one position out of hundreds — exactly what a hand-picked
 * example misses.
 */
describe('the slider track', () => {
  const SAMPLES = 2000;

  test('every position on the track produces a grade the scale accepts', () => {
    for (let index = 0; index <= SAMPLES; index += 1) {
      const rating = trackFractionToRating(index / SAMPLES);
      expect(isValidRating(rating)).toBe(true);
    }
  });

  test('the ends of the track are exactly the ends of the scale', () => {
    expect(trackFractionToRating(0)).toBe(RATING_MIN);
    expect(trackFractionToRating(1)).toBe(RATING_MAX);
  });

  /** A finger dragged past the end of the track pins, the way every slider anyone has used behaves. */
  test('a fraction outside the track clamps rather than escaping the scale', () => {
    expect(trackFractionToRating(-3)).toBe(RATING_MIN);
    expect(trackFractionToRating(42)).toBe(RATING_MAX);
  });

  test('position and grade are inverses of each other', () => {
    for (const grade of [RATING_MIN, 4.2, 7.5, 8, RATING_MAX]) {
      expect(trackFractionToRating(ratingToTrackFraction(grade))).toBe(grade);
    }
  });

  /** The whole reason the scale carries a decimal: every tenth has somewhere to sit. */
  test('the track can reach all 91 grades, not just the whole numbers', () => {
    const reachable = new Set<number>();
    for (let index = 0; index <= SAMPLES; index += 1) {
      reachable.add(trackFractionToRating(index / SAMPLES));
    }
    expect(reachable.size).toBe((RATING_MAX - RATING_MIN) * 10 + 1);
  });
});

describe('snapRatingToStep', () => {
  test('rounds a finer value onto the step', () => {
    expect(snapRatingToStep(7.55)).toBe(7.6);
    expect(snapRatingToStep(7.549)).toBe(7.5);
  });

  test('leaves a value already on the step alone', () => {
    expect(snapRatingToStep(7.5)).toBe(7.5);
    expect(snapRatingToStep(8)).toBe(8);
  });

  test('clamps to the scale rather than returning something off it', () => {
    expect(snapRatingToStep(-40)).toBe(RATING_MIN);
    expect(snapRatingToStep(99)).toBe(RATING_MAX);
  });

  /**
   * Accumulating 0.1 in binary floating point drifts, and a grade that
   * misses the scale by a quadrillionth is thrown away downstream as
   * off-scale. This is the guard against losing a vote to arithmetic
   * nobody can see.
   */
  test('never emits a value that floating point has nudged off the step', () => {
    for (let step = 0; step <= (RATING_MAX - RATING_MIN) * 10; step += 1) {
      const grade = snapRatingToStep(RATING_MIN + step * 0.1);
      expect(isValidRating(grade)).toBe(true);
    }
  });
});

describe('nudgeRating — the assistive-technology increment', () => {
  test('moves by one accessibility step in the direction asked', () => {
    expect(nudgeRating(7, 1)).toBe(7 + RATING_ACCESSIBILITY_STEP);
    expect(nudgeRating(7, -1)).toBe(7 - RATING_ACCESSIBILITY_STEP);
  });

  test('pins at the ends instead of walking off the scale', () => {
    expect(nudgeRating(RATING_MAX, 1)).toBe(RATING_MAX);
    expect(nudgeRating(RATING_MIN, -1)).toBe(RATING_MIN);
  });

  /** Coarser than the touch step on purpose — ninety swipes to cross the scale is not an accessible control. */
  test('is coarser than the scale step, so the scale is crossable by swiping', () => {
    expect(RATING_ACCESSIBILITY_STEP).toBeGreaterThan(RATING_STEP);
    expect((RATING_MAX - RATING_MIN) / RATING_ACCESSIBILITY_STEP).toBeLessThanOrEqual(20);
  });

  test('every reachable nudge is still a grade the scale accepts', () => {
    let grade = RATING_MIN;
    for (let index = 0; index < 40; index += 1) {
      grade = nudgeRating(grade, 1);
      expect(isValidRating(grade)).toBe(true);
    }
  });
});

describe('formatGrade', () => {
  /** A Dutch report-card grade takes a comma. "7.5" reads as a typo or a thousands separator. */
  test('writes the separator as a comma, never a point', () => {
    expect(formatGrade(7.5)).toBe('7,5');
    expect(formatGrade(7.5)).not.toContain('.');
  });

  test('keeps one decimal by default, so a column of grades holds its width', () => {
    expect(formatGrade(8)).toBe('8,0');
    expect(formatGrade(RATING_MAX)).toBe('10,0');
  });

  test('takes a wider precision when a caller genuinely has one', () => {
    expect(formatGrade(8.72, 2)).toBe('8,72');
  });
});

describe('the unrated state', () => {
  /**
   * The slider does not open pre-filled. A thumb resting on a grade is an
   * opinion the app invented and the cook would have to correct, which is
   * the nag PD-008 forbids.
   */
  test('shows a dash rather than a grade before anyone has touched it', () => {
    expect(RATING_UNSET_LABEL).not.toMatch(/\d/u);
  });

  test('rests mid-track, since either end would read as a grade already given', () => {
    expect(RATING_UNSET_TRACK_FRACTION).toBeGreaterThan(0);
    expect(RATING_UNSET_TRACK_FRACTION).toBeLessThan(1);
  });
});

describe('describeRatingAnnouncement', () => {
  /**
   * The card morphs in place and then dismisses itself — there is no new
   * screen for a screen reader to pick up, so the consequence of the tap
   * has to be announced explicitly. Same reasoning as OutcomeCard's
   * existing "Gemaakt! Nog een keer?" announcement.
   */
  test('states the score against the scale for every whole grade on it', () => {
    for (let grade = RATING_MIN; grade <= RATING_MAX; grade += 1) {
      const announcement = describeRatingAnnouncement(grade);
      expect(announcement).toContain(formatGrade(grade));
      expect(announcement).toContain(String(RATING_MAX));
    }
  });

  /** The announcement is spoken Dutch, so the grade in it has to be written Dutch too. */
  test('speaks a half grade with a comma, never a point', () => {
    expect(describeRatingAnnouncement(7.5)).toContain('7,5');
    expect(describeRatingAnnouncement(7.5)).not.toContain('7.5');
  });

  test('tells the cook a high score means this meal comes back more often', () => {
    expect(describeRatingAnnouncement(RATING_POSITIVE_AT_OR_ABOVE)).toContain('vaker');
    expect(describeRatingAnnouncement(RATING_MAX)).toContain('vaker');
  });

  test('tells the cook a low score means this meal comes back less often', () => {
    expect(describeRatingAnnouncement(RATING_NEGATIVE_AT_OR_BELOW)).toContain('minder vaak');
    expect(describeRatingAnnouncement(RATING_MIN)).toContain('minder vaak');
  });

  /**
   * The middle band deliberately produces no scoring signal (rating.ts's
   * `toRepeatSignal` returns null there). Announcing "komt vaker terug"
   * for a shrug would be a lie about what Remy just recorded, so the
   * neutral phrasing has to be genuinely distinct from both others.
   */
  test('promises nothing at all for a middling score — it is recorded, never scored', () => {
    const announcement = describeRatingAnnouncement(MIDDLE_BAND_RATING);

    expect(MIDDLE_BAND_RATING).toBeLessThan(RATING_POSITIVE_AT_OR_ABOVE);
    expect(announcement).not.toContain('vaker');
    expect(announcement).not.toContain('minder vaak');
    expect(announcement.toLowerCase()).toContain('genoteerd');
  });
});

describe('rating copy', () => {
  /**
   * PD-002's optional decline reason is the precedent: the question is
   * asked once, plainly, and walking away is a first-class answer. Copy
   * that pleads ("nog even!", "help ons verbeteren") would turn an
   * optional question into the nag PD-003 exists to forbid.
   */
  test('asks once, in Dutch, without pleading for an answer', () => {
    expect(RATING_QUESTION).toBe('Hoe was het?');
    expect(RATING_SKIP_LABEL).toBe('Klaar');
  });

  test('labels the group as optional, so assistive tech says so before the chips are read', () => {
    expect(RATING_GROUP_ACCESSIBILITY_LABEL.toLowerCase()).toContain('optioneel');
  });

  test('anchors the scale with plain outcome words rather than adjectives about the food', () => {
    expect(RATING_ANCHOR_LOW).toBe('Nooit meer');
    expect(RATING_ANCHOR_HIGH).toBe('Graag weer');
  });
});

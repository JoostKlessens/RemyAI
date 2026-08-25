import { describe, expect, test } from 'vitest';
import {
  RATING_ANCHOR_HIGH,
  RATING_ANCHOR_LOW,
  RATING_GROUP_ACCESSIBILITY_LABEL,
  RATING_QUESTION,
  RATING_SKIP_LABEL,
  buildRatingOptions,
  describeRatingAnnouncement,
} from '@/components/ratingScaleCopy';
import {
  RATING_MAX,
  RATING_MIN,
  RATING_NEGATIVE_AT_OR_BELOW,
  RATING_POSITIVE_AT_OR_ABOVE,
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

describe('buildRatingOptions', () => {
  test('renders exactly one option per whole number on the scale', () => {
    expect(buildRatingOptions()).toHaveLength(RATING_MAX - RATING_MIN + 1);
  });

  test('runs from the scale minimum to the scale maximum, ascending and gapless', () => {
    const values = buildRatingOptions().map((option) => option.value);

    expect(values[0]).toBe(RATING_MIN);
    expect(values[values.length - 1]).toBe(RATING_MAX);
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBe((values[index - 1] ?? Number.NaN) + 1);
    }
  });

  /**
   * docs/DESIGN.md forbids emoji as a status indicator anywhere in the
   * product and keeps Feather icons sparse, so the scale is numbered
   * ("timecode burned into the frame"), never a row of stars or faces.
   * Asserting the label is the plain numeral is how that stays true — a
   * future "make it friendlier" edit fails here instead of shipping.
   */
  test('labels each option with its own plain numeral — never a star, never an emoji', () => {
    for (const option of buildRatingOptions()) {
      expect(option.label).toBe(String(option.value));
      expect(option.label).toMatch(/^\d+$/u);
    }
  });

  test('gives every option a spoken label that places it on the scale', () => {
    for (const option of buildRatingOptions()) {
      expect(option.accessibilityLabel).toContain(String(option.value));
      expect(option.accessibilityLabel).toContain(String(RATING_MAX));
    }
  });

  /**
   * The two ends carry the only words explaining what the numbers mean.
   * A screen-reader user never hears the anchor row (it is decorative
   * text beside the chips, hidden from assistive tech), so that meaning
   * has to travel on the end chips themselves or it is lost entirely.
   */
  test('spells out what the two ends of the scale mean, since the visual anchors are not read aloud', () => {
    const options = buildRatingOptions();
    const lowest = options[0];
    const highest = options[options.length - 1];

    expect(lowest?.accessibilityLabel.toLowerCase()).toContain(RATING_ANCHOR_LOW.toLowerCase());
    expect(highest?.accessibilityLabel.toLowerCase()).toContain(RATING_ANCHOR_HIGH.toLowerCase());
  });

  test('returns a fresh array each call, so a caller can never mutate the scale for everyone else', () => {
    expect(buildRatingOptions()).not.toBe(buildRatingOptions());
    expect(buildRatingOptions()).toEqual(buildRatingOptions());
  });
});

describe('describeRatingAnnouncement', () => {
  /**
   * The card morphs in place and then dismisses itself — there is no new
   * screen for a screen reader to pick up, so the consequence of the tap
   * has to be announced explicitly. Same reasoning as OutcomeCard's
   * existing "Gemaakt! Nog een keer?" announcement.
   */
  test('states the score against the scale for every point on it', () => {
    for (const option of buildRatingOptions()) {
      const announcement = describeRatingAnnouncement(option.value);
      expect(announcement).toContain(String(option.value));
      expect(announcement).toContain(String(RATING_MAX));
    }
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

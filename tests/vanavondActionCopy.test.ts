/**
 * The three words the Kiezen action row can say, and the one number it
 * reports.
 *
 * WHAT THESE TESTS ARE REALLY GUARDING is a shape, not a spelling. On
 * 7 September 2026 the row went from a stack of two full-width buttons to
 * TWO HALVES SIDE BY SIDE, and a half-width button is a different typographic
 * object from a full-width one: the two labels are read together, at the same
 * moment, at the same size, as a pair. `Ja` under `Iets anders` was fine
 * stacked and reads as a mistake in a pair — two letters against eleven, in
 * boxes of identical width. So the length relationship between the labels
 * stopped being taste and became a layout constraint, and a constraint that
 * lives only in somebody's head is one nobody can fail.
 *
 * The rejected alternative was asserting the strings literally and nothing
 * else — `expect(VANAVOND_ACCEPT_LABEL).toBe('Dit koken')`. That kind of test
 * fails on every deliberate change and on no accidental one, which is the
 * wrong way round. The assertions below are about the RELATIONSHIPS the row
 * depends on, so an edit that breaks the row fails here even when it never
 * touches a string this file happens to name.
 */

import { describe, expect, test } from 'vitest';
import {
  VANAVOND_ACCEPT_ACCESSIBILITY_LABEL,
  VANAVOND_ACCEPT_LABEL,
  VANAVOND_ALTERNATIVE_ACCESSIBILITY_LABEL,
  VANAVOND_ALTERNATIVE_LABEL,
  VANAVOND_CHOOSE_SELF_ACCESSIBILITY_LABEL,
  VANAVOND_CHOOSE_SELF_HINT,
  VANAVOND_CHOOSE_SELF_LABEL,
  VANAVOND_LABEL_LENGTH_TOLERANCE,
  describeAlternativesRemaining,
} from '@/components/vanavondActionCopy';

/** Whichever secondary label the row is showing, it sits beside the accept button. */
const SECONDARY_LABELS = [VANAVOND_ALTERNATIVE_LABEL, VANAVOND_CHOOSE_SELF_LABEL] as const;

const VISIBLE_LABELS = [VANAVOND_ACCEPT_LABEL, ...SECONDARY_LABELS] as const;

describe('the labels as a pair — the row is two halves now', () => {
  /**
   * The load-bearing one. Two boxes of exactly equal width filled with two
   * strings of wildly unequal length reads as a rendering bug rather than as
   * a choice — the short label floats in white space the long one fills.
   * `Ja` (2) against `Iets anders` (11) is that failure, and it is why the
   * owner's parenthetical permission to rename it is taken rather than
   * declined.
   */
  test('the accept label is close enough in length to sit beside either secondary label', () => {
    for (const secondary of SECONDARY_LABELS) {
      const difference = Math.abs(VANAVOND_ACCEPT_LABEL.length - secondary.length);
      expect(difference).toBeLessThanOrEqual(VANAVOND_LABEL_LENGTH_TOLERANCE);
    }
  });

  /**
   * The other half of the same decision, and the half that survives even if
   * the row is ever stacked again. `DecisionCard` no longer draws the
   * `KIEZEN` eyebrow, so nothing on the screen asks a question any more — and
   * a bare yes-word is an answer to a question that is not being asked. Both
   * buttons name an ACT now, which is what a row of two acts needs.
   */
  test('the accept label names an act rather than answering a question nobody asks', () => {
    const answerWords = ['ja', 'nee', 'jawel', 'oké', 'ok', 'yes'];
    expect(answerWords).not.toContain(VANAVOND_ACCEPT_LABEL.trim().toLowerCase());
  });

  test('every visible label is a real, distinct, single-line phrase', () => {
    for (const label of VISIBLE_LABELS) {
      expect(label.trim()).toBe(label);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toContain('\n');
    }
    expect(new Set(VISIBLE_LABELS).size).toBe(VISIBLE_LABELS.length);
  });
});

describe('what a screen reader is told', () => {
  /**
   * A button label has to fit in half of 353pt; a spoken label has no width
   * at all. Spending the spoken one on a repeat of the visible one throws
   * away the only place the row can say what the tap actually commits to.
   * Every sibling `*Copy.ts` in this directory makes the same trade.
   */
  test('each spoken label says more than the button face does', () => {
    const pairs = [
      [VANAVOND_ACCEPT_LABEL, VANAVOND_ACCEPT_ACCESSIBILITY_LABEL],
      [VANAVOND_ALTERNATIVE_LABEL, VANAVOND_ALTERNATIVE_ACCESSIBILITY_LABEL],
      [VANAVOND_CHOOSE_SELF_LABEL, VANAVOND_CHOOSE_SELF_ACCESSIBILITY_LABEL],
    ] as const;

    for (const [visible, spoken] of pairs) {
      expect(spoken).not.toBe(visible);
      expect(spoken.length).toBeGreaterThan(visible.length);
    }
  });

  /**
   * The accept button is the one irreversible tap on this screen — it writes
   * the decision row and navigates to Kookmodus. A screen-reader user gets no
   * accent stroke and no photo; the spoken label is the entire signal that
   * this is tonight being settled, so it has to name the evening.
   */
  test('the accept button says which evening it is settling', () => {
    expect(VANAVOND_ACCEPT_ACCESSIBILITY_LABEL.toLowerCase()).toContain('vanavond');
  });
});

describe('describeAlternativesRemaining — the swap budget PD-001 caps at two', () => {
  test('reports the number that is actually left', () => {
    expect(describeAlternativesRemaining(1)).toContain('1');
    expect(describeAlternativesRemaining(2)).toContain('2');
  });

  test('the two readings differ, so the hint is a count and not a decoration', () => {
    expect(describeAlternativesRemaining(1)).not.toBe(describeAlternativesRemaining(2));
  });

  /**
   * At zero the affordance is REPLACED by "Ik kies zelf" rather than
   * disabled, so a sentence counting down to nought would be spoken by a
   * button that no longer exists. `VANAVOND_CHOOSE_SELF_HINT` is what a spent
   * budget sounds like, and it is a different sentence on purpose: "nog 0
   * keer" describes a limit, "geen wissels meer" describes a state.
   */
  test('a spent budget is a different sentence, not this one counting down to zero', () => {
    for (const remaining of [1, 2] as const) {
      expect(describeAlternativesRemaining(remaining)).not.toBe(VANAVOND_CHOOSE_SELF_HINT);
    }
    expect(VANAVOND_CHOOSE_SELF_HINT).not.toMatch(/\d/u);
  });
});

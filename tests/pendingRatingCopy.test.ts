/**
 * The words on the delayed rating sheet (GAP-46).
 *
 * THE ONE THING MOST WORTH TESTING HERE IS AN ABSENCE. This sheet asks
 * about a cook that finished at least twelve hours ago, and
 * `selectPendingRating` hands back the OLDEST due one — so after a quiet
 * week it is not last night, and no string here may claim to know when it
 * was. That is the same ban `tests/sendRecipeSheetCopy.test.ts` enforces on
 * its own module, for the same reason, and it is the mistake this copy is
 * most likely to acquire later: "Hoe was je lasagne van gisteren?" reads
 * beautifully and would be a lie about somebody's own evening.
 */
import { describe, expect, test } from 'vitest';

import * as pendingCopy from '@/components/pendingRatingCopy';
import {
  PENDING_RATING_CONFIRM_LABEL,
  PENDING_RATING_REASON,
  PENDING_RATING_SKIP_LABEL,
  RATING_QUESTION,
  buildPendingRatingAccessibilityLabel,
  buildPendingRatingConfirmAccessibilityHint,
  buildPendingRatingConfirmAccessibilityLabel,
  buildPendingRatingTitle,
} from '@/components/pendingRatingCopy';
import { RATING_QUESTION as SCALE_QUESTION } from '@/components/ratingScaleCopy';

function everyExportedSentence(): readonly string[] {
  const exported: readonly unknown[] = Object.values(pendingCopy);
  return exported.filter((value): value is string => typeof value === 'string');
}

describe('the sheet never claims to know when the meal was cooked', () => {
  test('no exported sentence names a day or a recency', () => {
    const banned = ['gisteren', 'vandaag', 'vanavond', 'zojuist', 'laatst', 'vannacht', 'gisteravond'];
    for (const sentence of everyExportedSentence()) {
      for (const word of banned) {
        expect(sentence.toLowerCase()).not.toContain(word);
      }
    }
  });

  test('the title names the dish and nothing else', () => {
    expect(buildPendingRatingTitle('lasagne')).toBe('Je hebt lasagne gemaakt.');
  });
});

describe('one question, asked once', () => {
  test('the question is the scale’s own, not a second phrasing of it', () => {
    // Two wordings of one question is how a product starts sounding like
    // two products. This module re-exports rather than restates.
    expect(RATING_QUESTION).toBe(SCALE_QUESTION);
  });

  test('the title is a statement, so the sheet does not ask twice', () => {
    expect(buildPendingRatingTitle('soep')).not.toContain('?');
  });

  test('the accessible name carries both halves, in reading order', () => {
    expect(buildPendingRatingAccessibilityLabel('soep')).toBe(`Je hebt soep gemaakt. ${RATING_QUESTION}`);
  });
});

describe('the delay is explained rather than hidden', () => {
  test('the reason gives the owner’s own argument back to the reader', () => {
    expect(PENDING_RATING_REASON).toContain('gegeten');
  });
});

describe('skipping costs what answering costs (PD-008)', () => {
  test('the skip is a real label, not an apology or a dismissal glyph', () => {
    expect(PENDING_RATING_SKIP_LABEL).toBe('Niet nu');
  });

  /**
   * ⚠ THE DIFFERENCE FROM `CookSharingAskSheet`'s DECLINE, pinned so it
   * cannot be "improved" into a promise this feature does not keep. That
   * sheet asks once, ever, and says so. This one asks per cook: skipping
   * tonight says nothing about tomorrow, and the cook stays due.
   */
  test('the skip promises nothing about never being asked again', () => {
    expect(PENDING_RATING_SKIP_LABEL.toLowerCase()).not.toContain('nooit');
    expect(PENDING_RATING_SKIP_LABEL.toLowerCase()).not.toContain('niet opnieuw');
  });

  test('the confirm is one word and the same one the outcome card uses', () => {
    expect(PENDING_RATING_CONFIRM_LABEL).toBe('Klaar');
  });
});

describe('the confirm button says which of its two jobs is armed', () => {
  test('with no draft it announces closing without a grade', () => {
    expect(buildPendingRatingConfirmAccessibilityLabel(null)).toBe('Klaar, zonder beoordeling');
    expect(buildPendingRatingConfirmAccessibilityHint(false)).toBe('Sluit zonder een cijfer te geven');
  });

  test('with a draft it announces the number it will save', () => {
    expect(buildPendingRatingConfirmAccessibilityLabel('8,5')).toBe('Klaar, cijfer 8,5 opslaan');
    expect(buildPendingRatingConfirmAccessibilityHint(true)).toBe('Slaat het gekozen cijfer op en sluit');
  });
});

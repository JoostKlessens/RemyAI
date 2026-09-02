import { describe, expect, test } from 'vitest';
import { MAX_PASTED_RECIPE_TEXT_CHARS, readPastedText } from '@/domain/import/pastedTextLimits';

/** A short, ordinary paste — the shape of thing this route exists for. */
const A_REAL_PASTE = [
  'Ovenschotel met zoete aardappel',
  '2 zoete aardappels, 1 rode ui, 200 g feta, olijfolie, tijm',
  'Oven op 200 graden. Alles in blokjes, 30 minuten in de oven, feta erover.',
].join('\n');

function stringOfLength(length: number): string {
  return 'a'.repeat(length);
}

/**
 * The longest paste anybody sends on purpose: a chatty intro, thirty
 * ingredients, twenty steps and a note about the tin size. The cap must sit
 * comfortably ABOVE this, because every false positive here costs a real
 * person a real import.
 */
const LONGEST_LEGITIMATE_PASTE_CHARS = 10_000;

/**
 * The point at which one paste stops being a bounded cost. At roughly four
 * characters per token this is around 50,000 input tokens for a single
 * extraction — far past a per-request ceiling anybody would want to sign
 * for. The cap must sit well BELOW it.
 */
const CHARS_AT_WHICH_ONE_PASTE_IS_AN_INVOICE = 200_000;

describe('readPastedText — the two states the import pipeline would refuse anyway', () => {
  test('an untouched field is empty, so the screen has nothing to submit and nothing to say', () => {
    const submission = readPastedText('');

    expect(submission.readiness).toBe('empty');
  });

  /**
   * The posture the URL field has always taken, applied to the other route:
   * a field holding three newlines is a field nobody filled in. Sending it
   * would cost a round trip AND, on the far side, a model call, to be told
   * something this function already knows.
   */
  test('whitespace alone is empty rather than "ready but odd" — a blank paste never becomes a request', () => {
    const submission = readPastedText('   \n\t  \r\n ');

    expect(submission.readiness).toBe('empty');
    expect(submission.text).toBe('');
  });

  test('an ordinary recipe is ready to send', () => {
    const submission = readPastedText(A_REAL_PASTE);

    expect(submission.readiness).toBe('ready');
  });

  test('a paste one character past the cap is refused here, so the user never meets the cap as a status code', () => {
    const submission = readPastedText(stringOfLength(MAX_PASTED_RECIPE_TEXT_CHARS + 1));

    expect(submission.readiness).toBe('too_long');
  });

  test('a paste exactly at the cap is accepted — the boundary is inclusive, matching the function that enforces it', () => {
    const submission = readPastedText(stringOfLength(MAX_PASTED_RECIPE_TEXT_CHARS));

    expect(submission.readiness).toBe('ready');
  });
});

describe('readPastedText — the string that is measured is the string that is sent', () => {
  /**
   * The half of the agreement with `readImportRequest`
   * (supabase/functions/parse-recipe/importRequest.ts) that matters more
   * than the number itself, and the reason this function is shared rather
   * than only the cap: both ends trim first and count the TRIMMED string.
   * Two hand-written comparisons agreeing on 32,000 could still have
   * disagreed about whitespace, and that disagreement only ever shows up on
   * the one paste sitting exactly on the boundary.
   */
  test('surrounding whitespace is removed before the length is judged, so it can never push a paste over the cap', () => {
    const padding = ' '.repeat(500);

    const submission = readPastedText(`${padding}${stringOfLength(MAX_PASTED_RECIPE_TEXT_CHARS)}${padding}`);

    expect(submission.readiness).toBe('ready');
    expect(submission.text.length).toBe(MAX_PASTED_RECIPE_TEXT_CHARS);
  });

  test('the trimmed text comes back for the caller to post, so nothing re-derives it a second way', () => {
    const submission = readPastedText(`\n\n${A_REAL_PASTE}\n\n`);

    expect(submission.text).toBe(A_REAL_PASTE);
  });

  test('newlines INSIDE the paste are left exactly as they were — a recipe is lines, and the model reads them', () => {
    const submission = readPastedText(A_REAL_PASTE);

    expect(submission.text.split('\n')).toHaveLength(3);
  });

  test('an over-long paste still reports its text rather than hiding it — nothing about it is secret', () => {
    const submission = readPastedText(stringOfLength(MAX_PASTED_RECIPE_TEXT_CHARS + 10));

    expect(submission.text.length).toBe(MAX_PASTED_RECIPE_TEXT_CHARS + 10);
  });
});

describe('MAX_PASTED_RECIPE_TEXT_CHARS', () => {
  /**
   * There is nothing left to pin the digits against — the edge function
   * imports this very constant
   * (supabase/functions/parse-recipe/importRequest.ts), so the two ends can
   * no longer disagree and a test asserting `32_000` would only restate the
   * line above it. What is worth defending is the SHAPE of the number, which
   * is what the module's header actually argues: generous enough that nobody
   * legitimate reaches it, finite enough that nobody hostile picks it.
   */
  test('sits above the longest paste anybody sends on purpose, so a real recipe is never refused', () => {
    expect(MAX_PASTED_RECIPE_TEXT_CHARS).toBeGreaterThan(LONGEST_LEGITIMATE_PASTE_CHARS);
  });

  test('stays far below the length at which one extraction stops being a bounded bill', () => {
    expect(MAX_PASTED_RECIPE_TEXT_CHARS).toBeLessThan(CHARS_AT_WHICH_ONE_PASTE_IS_AN_INVOICE);
  });

  test('is a whole positive count of characters — the unit the model is billed in', () => {
    expect(Number.isInteger(MAX_PASTED_RECIPE_TEXT_CHARS)).toBe(true);
    expect(MAX_PASTED_RECIPE_TEXT_CHARS).toBeGreaterThan(0);
  });

  test('sits far above any realistic recipe, so nobody legitimate ever meets it', () => {
    expect(readPastedText(A_REAL_PASTE.repeat(20)).readiness).toBe('ready');
  });
});

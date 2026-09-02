import { describe, expect, test } from 'vitest';
import { MAX_PASTED_RECIPE_TEXT_CHARS, readPastedText } from '@/app/import/pastedTextLimit';

/** A short, ordinary paste — the shape of thing this route exists for. */
const A_REAL_PASTE = [
  'Ovenschotel met zoete aardappel',
  '2 zoete aardappels, 1 rode ui, 200 g feta, olijfolie, tijm',
  'Oven op 200 graden. Alles in blokjes, 30 minuten in de oven, feta erover.',
].join('\n');

function stringOfLength(length: number): string {
  return 'a'.repeat(length);
}

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
   * than the number itself: both ends trim first and count the TRIMMED
   * string. Measuring the raw field and sending the trimmed one would put
   * the two a whitespace run apart, which only ever shows up on the one
   * paste sitting exactly on the boundary.
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
   * Pinned to the value in supabase/functions/parse-recipe/importRequest.ts,
   * which is Deno and cannot be imported into this run. This assertion is
   * the only mechanical thing standing between the two copies: changing one
   * without the other fails here, which is the prompt to go and read the
   * obligation both files write down.
   */
  test('is the number the edge function enforces — the two copies of this cap must move together', () => {
    expect(MAX_PASTED_RECIPE_TEXT_CHARS).toBe(32_000);
  });

  test('sits far above any realistic recipe, so nobody legitimate ever meets it', () => {
    expect(readPastedText(A_REAL_PASTE.repeat(20)).readiness).toBe('ready');
  });
});

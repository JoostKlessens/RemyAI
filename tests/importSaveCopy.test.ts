/**
 * The words the import flow ends on now that it does not end on a question
 * (src/components/importSaveCopy.ts).
 *
 * WHY THESE STRINGS ARE HELD TO ANYTHING. The removed `SaveIntentSheet` did
 * two jobs, and only one of them was asking. The other was TELLING: its two
 * rows spelled out, in the household's own language, what each choice would
 * do — "kan vanavond verschijnen" and "komt vanzelf een keer voorbij". Take
 * the sheet away and the asking goes with it, but the telling has to land
 * somewhere or the flow ends in silence: a button, a screen change, and a
 * dish sitting in Mijn recepten marked "Ooit" for reasons nobody stated.
 *
 * So the assertions below are not spell-checks. Each one holds a promise the
 * removed sheet used to make out loud, and the invariant at the bottom holds
 * the one thing this copy must never do — claim the dish is planned for a
 * particular week, which is precisely what `IMPORT_DEFAULT_SAVE_INTENT` does
 * not write.
 */

import { describe, expect, test } from 'vitest';
import {
  IMPORT_SAVE_ACCESSIBILITY_LABEL,
  IMPORT_SAVE_BLOCKED_HINT,
  IMPORT_SAVE_DESTINATION_NOTE,
  IMPORT_SAVE_LABEL,
  IMPORT_SAVE_STRINGS,
  describeImportSavedAnnouncement,
} from '@/components/importSaveCopy';

describe('the button the import flow now ends on', () => {
  test('is named for the act, not for a step in a wizard', () => {
    // It used to read "Doorgaan", which was honest only because a sheet came
    // next. Nothing comes next now, so the label has to be the act itself.
    expect(IMPORT_SAVE_LABEL).toBe('Bewaren');
  });

  test('its spoken label names where the recipe lands', () => {
    expect(IMPORT_SAVE_ACCESSIBILITY_LABEL).toContain('Mijn recepten');
  });

  test('the blocked hint still names all three things a recipe needs', () => {
    expect(IMPORT_SAVE_BLOCKED_HINT).toContain('titel');
    expect(IMPORT_SAVE_BLOCKED_HINT).toContain('ingrediënt');
    expect(IMPORT_SAVE_BLOCKED_HINT).toContain('stap');
  });
});

describe('the line under the button', () => {
  /**
   * PD-004a's promise, kept in the household's own words. "komt vanzelf een
   * keer voorbij" is the removed `Ooit` row's explainer verbatim, on purpose:
   * the sheet is gone but the sentence it taught is the same sentence, so
   * nobody has to learn a second name for the same outcome.
   */
  test("repeats the promise the removed 'Ooit' row made", () => {
    expect(IMPORT_SAVE_DESTINATION_NOTE).toContain('komt vanzelf een keer voorbij');
  });

  test('names the surface where "deze week" can still be said', () => {
    expect(IMPORT_SAVE_DESTINATION_NOTE).toContain('deze week');
    expect(IMPORT_SAVE_DESTINATION_NOTE).toContain('Mijn recepten');
  });
});

describe('the announcement', () => {
  test('names the dish, because the screen it lands on is a grid of forty', () => {
    expect(describeImportSavedAnnouncement('Traybake kip')).toContain('Traybake kip');
  });

  test('says the recipe was kept, not that it was scheduled', () => {
    const announcement = describeImportSavedAnnouncement('Traybake kip');

    expect(announcement).toContain('bewaard');
    expect(announcement.toLowerCase()).not.toContain('deze week');
  });
});

/**
 * THE INVARIANT, across every string this module ships. An import writes
 * `IMPORT_DEFAULT_SAVE_INTENT` — `'someday'` — so nothing here may promise
 * tonight as an outcome of pressing the button. `IMPORT_SAVE_DESTINATION_NOTE`
 * is allowed to say "deze week" because there it names an act the household
 * has still to perform somewhere else; the test above pins that occurrence,
 * and the two below pin the words that would turn the note into a promise.
 */
describe('no string claims the dish is planned', () => {
  test('nothing offers tonight', () => {
    for (const value of IMPORT_SAVE_STRINGS) {
      expect(value.toLowerCase()).not.toContain('vanavond');
    }
  });

  test('nothing says the dish is on the shopping list', () => {
    for (const value of IMPORT_SAVE_STRINGS) {
      expect(value.toLowerCase()).not.toContain('boodschappen');
    }
  });
});

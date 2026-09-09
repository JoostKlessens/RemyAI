/**
 * The first test this component has ever had, and the reason it could not
 * have had one before: `DecisionFilterBar` is a `.tsx`, vitest runs in a
 * `node` environment with react-native stubbed (vitest.config.ts aliases the
 * package to tests/stubs/react-native.ts), and `include` never loads a `.tsx`
 * at all. Every Dutch word on Kiezen's filter bar was therefore a string
 * literal nothing could reach — five sibling surfaces in src/components/
 * already moved theirs into a `*Copy.ts` for exactly that reason, and this
 * file is the assertion half of the sixth.
 *
 * IT IMPORTS BOTH COPY MODULES ON PURPOSE. decisionFilterCopy.ts duplicates
 * two things libraryFilterCopy.ts already says — the tag eyebrow and the
 * counted badge — rather than importing them, and the argument for that
 * duplication is in decisionFilterCopy.ts's own header. A duplicate that
 * nothing compares is how two screens drift; the tests below compare them, so
 * drift is a red test rather than a silent divergence discovered on a device.
 */

import { describe, expect, test } from 'vitest';
import * as decisionCopy from '@/components/decisionFilterCopy';
import {
  DECISION_FILTER_MOODS_EYEBROW,
  DECISION_FILTER_TAGS_EYEBROW,
  DECISION_FILTER_TIME_EYEBROW,
  DECISION_FILTER_TOGGLE_LABEL,
  describeDecisionDishMoodChip,
  describeDecisionDishTagChip,
  describeDecisionFilters,
} from '@/components/decisionFilterCopy';
import {
  LIBRARY_FILTER_MOODS_EYEBROW,
  LIBRARY_FILTER_TAGS_EYEBROW,
  LIBRARY_FILTER_TIME_EYEBROW,
  describeLibraryFilters,
  describeDishMoodChip,
  describeDishTagChip,
} from '@/components/libraryFilterCopy';

describe('the word the owner asked for — "bij kiezen staat er nog wel \'waarmee\' ipv Ingredienten"', () => {
  test('the tag row says "Ingrediënten"', () => {
    expect(DECISION_FILTER_TAGS_EYEBROW).toBe('Ingrediënten');
  });

  test('it is the SAME word Mijn recepten uses — one vocabulary asked about in one way, in two places', () => {
    // Deliberately an equality assertion and not an import: a constant named
    // LIBRARY_* rendered on the decision screen would lie about where it
    // belongs. This is what keeps the duplicate honest.
    expect(DECISION_FILTER_TAGS_EYEBROW).toBe(LIBRARY_FILTER_TAGS_EYEBROW);
  });

  test('the mood eyebrow matches the library too — the same closed vocabulary, the same question', () => {
    expect(DECISION_FILTER_MOODS_EYEBROW).toBe(LIBRARY_FILTER_MOODS_EYEBROW);
  });

  test('the time question keeps this app’s one wording for it, even though neither bar draws it any more', () => {
    expect(DECISION_FILTER_TIME_EYEBROW).toBe(LIBRARY_FILTER_TIME_EYEBROW);
  });
});

describe('sentence case in source — the component applies textTransform, not the token', () => {
  test('every word this bar draws is written in sentence case', () => {
    // typeScale.label sets no textTransform (tokens.ts says so in as many
    // words); the component does. A constant typed in capitals would render
    // identically and read as a shout in every grep, diff and translation
    // pass — the recorded defect this module was written not to extend.
    for (const word of [
      DECISION_FILTER_TAGS_EYEBROW,
      DECISION_FILTER_MOODS_EYEBROW,
      DECISION_FILTER_TIME_EYEBROW,
      DECISION_FILTER_TOGGLE_LABEL,
    ]) {
      expect(word).not.toBe(word.toUpperCase());
    }
  });

  test('the three eyebrows and the opening are distinct — two controls reading the same is a control nobody can aim at', () => {
    const words = [
      DECISION_FILTER_TAGS_EYEBROW,
      DECISION_FILTER_MOODS_EYEBROW,
      DECISION_FILTER_TIME_EYEBROW,
      DECISION_FILTER_TOGGLE_LABEL,
    ];
    expect(new Set(words).size).toBe(words.length);
  });
});

describe('the "Filters" opening — the owner’s own word for the control he asked for', () => {
  test('says "Filters", which is what he typed', () => {
    // "een knopje bovenaan geklikt wordt met 'filters'". Not "Geavanceerd":
    // that is the library's word for a fold over two of its four axes, and
    // this fold holds all three of Kiezen's.
    expect(DECISION_FILTER_TOGGLE_LABEL).toBe('Filters');
    expect(describeDecisionFilters(0).label).toBe(DECISION_FILTER_TOGGLE_LABEL);
    expect(describeDecisionFilters(3).label).toBe(DECISION_FILTER_TOGGLE_LABEL);
  });

  test('the visible word never carries the number — the badge is a separate string a narrow row may drop', () => {
    expect(describeDecisionFilters(4).label).not.toMatch(/\d/);
  });
});

describe('the count on the shut control — the guard that makes hiding the row allowable at all', () => {
  test('says nothing when nothing is set', () => {
    const copy = describeDecisionFilters(0);
    expect(copy.activeBadge).toBeNull();
    expect(copy.accessibilityLabel).not.toMatch(/actief/);
  });

  test('COUNTS a filter that is set but out of sight', () => {
    const copy = describeDecisionFilters(2);
    expect(copy.activeBadge).toBe('2 filters actief');
    expect(copy.accessibilityLabel).toContain('2 filters actief');
  });

  test('one is singular — Dutch does not forgive "1 filters"', () => {
    expect(describeDecisionFilters(1).activeBadge).toBe('1 filter actief');
    expect(describeDecisionFilters(1).activeBadge).not.toMatch(/1 filters/);
  });

  test('a count below zero reads as nothing set, never as "-1 filters actief"', () => {
    expect(describeDecisionFilters(-1).activeBadge).toBeNull();
  });

  test('it is a count in WORDS, never a bare numeral — "2" alone could be counting the filters available', () => {
    expect(describeDecisionFilters(2).activeBadge).not.toBe('2');
    expect(describeDecisionFilters(2).activeBadge).toMatch(/filters/);
  });

  test('THE DRIFT GUARD: Kiezen and Mijn recepten count in exactly the same words', () => {
    // The one real defect risk in duplicating this module rather than
    // extracting it: Dutch singular/plural done differently in two places is
    // invisible until somebody reads both screens aloud. Comparing the two
    // implementations turns that into a failing test the moment either side
    // is edited.
    for (const count of [-1, 0, 1, 2, 3, 17]) {
      expect(describeDecisionFilters(count).activeBadge).toBe(describeLibraryFilters(count).activeBadge);
    }
  });
});

describe('the spoken label names what the fold hides', () => {
  test('all THREE hidden axes are in it — the time control included, which no screen reader can otherwise find', () => {
    const spoken = describeDecisionFilters(0).accessibilityLabel;
    expect(spoken).toContain(DECISION_FILTER_TIME_EYEBROW);
    expect(spoken).toContain(DECISION_FILTER_TAGS_EYEBROW);
    expect(spoken).toContain(DECISION_FILTER_MOODS_EYEBROW);
  });

  test('it is composed from the eyebrows themselves, so a fourth axis cannot leave it listing three', () => {
    // Same posture as describeLibraryFilters: prose naming the axes would be
    // a second place the contents of this fold are written down, and the one
    // no compiler watches. Asserting the ORDER is what proves composition:
    // hand-written prose would not have to agree with the row order.
    const spoken = describeDecisionFilters(0).accessibilityLabel;
    expect(spoken.indexOf(DECISION_FILTER_TAGS_EYEBROW)).toBeGreaterThan(spoken.indexOf(DECISION_FILTER_TIME_EYEBROW));
    expect(spoken.indexOf(DECISION_FILTER_MOODS_EYEBROW)).toBeGreaterThan(
      spoken.indexOf(DECISION_FILTER_TAGS_EYEBROW),
    );
  });

  test('it opens with the control’s own word, so the household hears what it tapped', () => {
    expect(describeDecisionFilters(0).accessibilityLabel.startsWith(DECISION_FILTER_TOGGLE_LABEL)).toBe(true);
  });
});

describe('chip labels spell out AND vs OR, in the library’s exact words', () => {
  test('the tag row says every choice must be met', () => {
    expect(describeDecisionDishTagChip('Pasta')).toBe('Pasta. Filtert op gerechten met alles wat je kiest.');
  });

  test('the mood row says any one choice is enough', () => {
    expect(describeDecisionDishMoodChip('Zomers')).toBe(
      'Zomers. Filtert op gerechten met een van de dingen die je hier kiest.',
    );
  });

  test('THE DRIFT GUARD: word for word what Mijn recepten says about the identical vocabularies', () => {
    for (const label of ['Pasta', 'Zomers', 'X']) {
      expect(describeDecisionDishTagChip(label)).toBe(describeDishTagChip(label));
      expect(describeDecisionDishMoodChip(label)).toBe(describeDishMoodChip(label));
    }
  });

  test('the two are worded differently — a screen-reader user cannot see the difference in a result set', () => {
    expect(describeDecisionDishTagChip('Pasta')).not.toBe(describeDecisionDishMoodChip('Pasta'));
    expect(describeDecisionDishTagChip('X')).toMatch(/alles wat je kiest/);
    expect(describeDecisionDishMoodChip('X')).toMatch(/een van de/);
  });
});

/**
 * ⚠ A `describe('"Wissen"')` BLOCK STOOD HERE — three tests pinning the reset
 * label, its "voor vanavond" spoken form, and its refusal to promise a search
 * box this screen does not have. The owner had the control removed on
 * 9 september 2026, its two constants went with it, and those assertions had
 * nothing left to assert.
 *
 * ONE ROW SURVIVES THE DELETION, and it is the useful half: this module must
 * not grow a reset back without somebody reading the note where the constants
 * used to be. The gesture is drawn by `NoCandidateState` now, on the one
 * state where it mattered — a narrowing that emptied the rotation.
 */
describe('the reset is gone and does not creep back', () => {
  test('no exported word is a bare "Wissen" — that control lives on NoCandidateState now', () => {
    const exported: readonly unknown[] = Object.values(decisionCopy);
    const sentences = exported.filter((value): value is string => typeof value === 'string');
    for (const sentence of sentences) {
      expect(sentence.toLowerCase()).not.toBe('wissen');
    }
  });
});

import { describe, expect, test } from 'vitest';
import {
  LIBRARY_FILTER_COURSES_EYEBROW,
  LIBRARY_FILTER_MOODS_EYEBROW,
  LIBRARY_FILTER_PLAN_EYEBROW,
  LIBRARY_FILTER_RESET_A11Y_LABEL,
  LIBRARY_FILTER_RESET_LABEL,
  LIBRARY_FILTER_TAGS_EYEBROW,
  LIBRARY_FILTER_TIME_EYEBROW,
  LIBRARY_SEARCH_PLACEHOLDER,
  LIBRARY_TIME_CAP_UNTIMED_NOTE,
  describeDishCourseChip,
  describeDishMoodChip,
  describeDishTagChip,
  describeSchedulingChip,
  describeTimeCapOption,
} from '@/components/libraryFilterCopy';
import { LIBRARY_TIME_CAP_OPTIONS } from '@/domain/recipeSearch';

const EXPLICIT_CAPS = LIBRARY_TIME_CAP_OPTIONS.filter((option): option is number => option !== null);

describe('describeTimeCapOption — the untimed-meals rule, said out loud', () => {
  test('EVERY explicit cap warns that undated dishes fall away', () => {
    for (const cap of EXPLICIT_CAPS) {
      expect(describeTimeCapOption(cap).accessibilityLabel).toContain(LIBRARY_TIME_CAP_UNTIMED_NOTE);
    }
  });

  test('says it in full, for the narrowest cap', () => {
    expect(describeTimeCapOption(20).accessibilityLabel).toBe('Maximaal 20 minuten. Gerechten zonder tijd vallen af.');
  });

  test('names the cap the household actually chose, not a hardcoded twenty', () => {
    expect(describeTimeCapOption(45).accessibilityLabel).toBe('Maximaal 45 minuten. Gerechten zonder tijd vallen af.');
  });

  test('"no cap" does NOT carry the warning — with nothing capped, nothing is dropped for lacking a duration', () => {
    const copy = describeTimeCapOption(null);
    expect(copy.accessibilityLabel).not.toContain(LIBRARY_TIME_CAP_UNTIMED_NOTE);
    expect(copy.accessibilityLabel).toBe('Alle kooktijden. Geen maximum.');
  });
});

describe('describeTimeCapOption — the visible label', () => {
  test('stays short, because the chip row wraps', () => {
    expect(describeTimeCapOption(null).label).toBe('Alles');
    expect(describeTimeCapOption(20).label).toBe('20 min');
    expect(describeTimeCapOption(30).label).toBe('30 min');
    expect(describeTimeCapOption(45).label).toBe('45 min');
  });

  test('never puts the warning on screen — that is the whole reason it lives in the spoken label', () => {
    for (const option of LIBRARY_TIME_CAP_OPTIONS) {
      expect(describeTimeCapOption(option).label).not.toContain(LIBRARY_TIME_CAP_UNTIMED_NOTE);
    }
  });

  test('gives every option a distinct label, so no two chips can read the same', () => {
    const labels = LIBRARY_TIME_CAP_OPTIONS.map((option) => describeTimeCapOption(option).label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('eyebrows', () => {
  test('the tag row keeps "Waarmee?" — it is NOT "Ingrediënten", and libraryFilterCopy.ts says why', () => {
    expect(LIBRARY_FILTER_TAGS_EYEBROW).toBe('Waarmee?');
  });

  test('every eyebrow is sentence case in source — the component applies textTransform, not the token', () => {
    for (const eyebrow of [
      LIBRARY_FILTER_TIME_EYEBROW,
      LIBRARY_FILTER_TAGS_EYEBROW,
      LIBRARY_FILTER_MOODS_EYEBROW,
      LIBRARY_FILTER_RESET_LABEL,
    ]) {
      expect(eyebrow).not.toBe(eyebrow.toUpperCase());
    }
  });

  test('"Wissen" tells a screen reader it clears BOTH halves, not just the typed text', () => {
    expect(LIBRARY_FILTER_RESET_A11Y_LABEL).toBe('Wis de zoekopdracht en alle filters');
  });

  test('the search field still says it searches on title, which the owner asked to leave alone', () => {
    expect(LIBRARY_SEARCH_PLACEHOLDER).toBe('Zoek op titel');
  });
});

describe('chip labels spell out AND vs OR', () => {
  test('the tag row says every choice must be met', () => {
    expect(describeDishTagChip('Pasta')).toBe('Pasta. Filtert op gerechten met alles wat je kiest.');
  });

  test('the mood row says any one choice is enough', () => {
    expect(describeDishMoodChip('Zomers')).toBe(
      'Zomers. Filtert op gerechten met een van de dingen die je hier kiest.',
    );
  });

  test('the two are worded differently — a screen-reader user cannot see the difference in a result set', () => {
    expect(describeDishTagChip('Pasta')).not.toBe(describeDishMoodChip('Pasta'));
  });

  test('the course row says any one choice is enough — a dish has exactly one course', () => {
    expect(describeDishCourseChip('Toetje')).toBe('Toetje. Filtert op gerechten met een van de gangen die je kiest.');
  });

  test('the plan row says the same, in the same grammar', () => {
    expect(describeSchedulingChip('Deze week')).toBe(
      'Deze week. Filtert op gerechten met een van de plannen die je kiest.',
    );
  });

  test('all four rows announce their own semantics, so no chip leaves AND-vs-OR to be inferred', () => {
    expect(describeDishTagChip('X')).toMatch(/alles wat je kiest/);
    for (const or of [describeDishMoodChip('X'), describeDishCourseChip('X'), describeSchedulingChip('X')]) {
      expect(or).toMatch(/een van de/);
    }
  });

  test('the course label does not explain the migration default to somebody looking for a starter', () => {
    // libraryFilterCopy.ts's own argument: it is true of one chip out of
    // four, and it describes a column rather than a dish.
    expect(describeDishCourseChip('Hoofdgerecht')).not.toMatch(/standaard|niemand|onbekend/i);
  });
});

describe('the two new eyebrows', () => {
  test('the plan axis asks when, which is the question the tile badge already answers', () => {
    expect(LIBRARY_FILTER_PLAN_EYEBROW).toBe('Wanneer?');
  });

  test('the course axis asks which course, not "welk gerecht" — that is the screen\'s own subject', () => {
    expect(LIBRARY_FILTER_COURSES_EYEBROW).toBe('Welke gang?');
    expect(LIBRARY_FILTER_COURSES_EYEBROW).not.toMatch(/gerecht/i);
  });

  test('both are sentence case in source, like the three before them', () => {
    for (const eyebrow of [LIBRARY_FILTER_PLAN_EYEBROW, LIBRARY_FILTER_COURSES_EYEBROW]) {
      expect(eyebrow).not.toBe(eyebrow.toUpperCase());
    }
  });

  test('all five are distinct — five rows that named one thing twice would be a control nobody can aim at', () => {
    const eyebrows = [
      LIBRARY_FILTER_TIME_EYEBROW,
      LIBRARY_FILTER_TAGS_EYEBROW,
      LIBRARY_FILTER_MOODS_EYEBROW,
      LIBRARY_FILTER_PLAN_EYEBROW,
      LIBRARY_FILTER_COURSES_EYEBROW,
    ];
    expect(new Set(eyebrows).size).toBe(eyebrows.length);
  });
});

/**
 * The words the shared time-cap control says.
 *
 * WHAT THESE TESTS ARE REALLY GUARDING is that there is ONE set of them.
 * Two screens render this control — Kiezen's filter bar and Mijn recepten's
 * — and the whole point of sharing the control is that a household learns
 * one question, not two phrasings of it. So the assertions below are mostly
 * identity checks against `libraryFilterCopy.ts`: not "does this say
 * 'Alles'", but "does this say the same thing the surface it replaces
 * said". A change that makes them drift fails here rather than in a
 * screenshot nobody takes.
 */

import { describe, expect, test } from 'vitest';
import {
  LIBRARY_FILTER_TIME_GROUP_LABEL,
  LIBRARY_TIME_CAP_UNTIMED_NOTE,
  describeTimeCapOption,
} from '@/components/libraryFilterCopy';
import { TIME_CAP_ACCESSIBILITY_LABEL, describeTimeCap, formatTimeCap } from '@/components/timeCapCopy';
import { NO_TIME_CAP, TIME_CAP_MAX_MINUTES, TIME_CAP_MIN_MINUTES, TIME_CAP_STOPS } from '@/domain/timeCap';

describe('the spoken name of the control', () => {
  test('is the one the library filter already used, not a second phrasing of it', () => {
    expect(TIME_CAP_ACCESSIBILITY_LABEL).toBe(LIBRARY_FILTER_TIME_GROUP_LABEL);
  });

  test('is a real sentence fragment rather than an empty string', () => {
    expect(TIME_CAP_ACCESSIBILITY_LABEL.trim().length).toBeGreaterThan(0);
  });
});

describe('formatTimeCap — what the control shows', () => {
  test('a cap reads as minutes', () => {
    expect(formatTimeCap(45)).toBe('45 min');
    expect(formatTimeCap(TIME_CAP_MIN_MINUTES)).toBe('5 min');
    expect(formatTimeCap(TIME_CAP_MAX_MINUTES)).toBe('120 min');
  });

  /**
   * "Geen limiet" sits at the wide END of the ladder (see timeCap.ts), so
   * the one thing that keeps it from reading as "the cap after 120" is
   * that it is drawn as WORDS. A number here would make the absence of a
   * maximum look like a rung on the same ladder as 20 minutes — exactly
   * what recipeSearch.ts's chip-order argument warns against.
   */
  test('"geen limiet" reads as words, never as a number', () => {
    const label = formatTimeCap(NO_TIME_CAP);
    expect(label).toBe(describeTimeCapOption(null).label);
    expect(label).not.toMatch(/\d/u);
  });

  test('every stop on the ladder has a distinct, non-empty label', () => {
    const labels = TIME_CAP_STOPS.map(formatTimeCap);
    for (const label of labels) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(labels).size).toBe(labels.length);
  });

  test('says the same thing the chip row it replaces said', () => {
    for (const stop of TIME_CAP_STOPS) {
      expect(formatTimeCap(stop)).toBe(describeTimeCapOption(stop).label);
    }
  });
});

describe('describeTimeCap — what a screen reader says', () => {
  /**
   * The asymmetry libraryFilterCopy.ts exists to state: an explicit cap
   * drops every meal whose duration nobody recorded (`isWithinMaxMinutes`),
   * and no cap drops nothing. A screen-reader user is precisely the person
   * who cannot infer that from watching tiles disappear.
   */
  test('a cap warns that untimed dishes fall away', () => {
    expect(describeTimeCap(30)).toContain(LIBRARY_TIME_CAP_UNTIMED_NOTE);
  });

  test('"geen limiet" carries no such warning, because nothing is dropped', () => {
    expect(describeTimeCap(NO_TIME_CAP)).not.toContain(LIBRARY_TIME_CAP_UNTIMED_NOTE);
  });

  test('every stop is spoken as a full sentence rather than as its visible label', () => {
    for (const stop of TIME_CAP_STOPS) {
      const spoken = describeTimeCap(stop);
      expect(spoken.trim().length).toBeGreaterThan(0);
      expect(spoken).toBe(describeTimeCapOption(stop).accessibilityLabel);
    }
  });

  test('says more than the visible label does — a picker reports its value, it does not repeat it', () => {
    expect(describeTimeCap(20).length).toBeGreaterThan(formatTimeCap(20).length);
  });
});

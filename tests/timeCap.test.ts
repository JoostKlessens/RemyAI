/**
 * The time-cap ladder — the arithmetic behind the owner's "een icoontje
 * met een klokje en dan 5min interval scrollen van hoe lang het recept
 * maximaal mag duren".
 *
 * WHAT THESE TESTS ARE FOR, beyond the obvious. Two screens now render
 * ONE control over this ladder (Kiezen's time filter and Mijn recepten's),
 * and the ladder is the only thing that guarantees they mean the same
 * thing by "45". So the assertions below are mostly about coherence —
 * every stop is on the step, the ends are where they say they are, and a
 * value that arrives from anywhere else lands on a stop rather than
 * between two — rather than about the specific numbers, in the same
 * posture tests/rating.test.ts takes toward the rating scale.
 *
 * THE ONE PLACE SPECIFIC NUMBERS ARE ASSERTED is the compatibility check:
 * every time value this app already writes (Household setup's 15/30/45,
 * DecisionFilterBar's and the library's 20/30/45) has to be a stop on this
 * ladder, or the new control cannot show a household the cap it already
 * has. That is a fact about the existing code, so it is checked against
 * the ladder rather than assumed.
 */

import { describe, expect, test } from 'vitest';
import {
  NO_TIME_CAP,
  TIME_CAP_MAX_MINUTES,
  TIME_CAP_MIN_MINUTES,
  TIME_CAP_STEP_MINUTES,
  TIME_CAP_STOPS,
  nudgeTimeCap,
  snapMinutesToTimeCapStep,
  timeCapAtStopIndex,
  timeCapStopIndex,
  timeCapToTrackFraction,
  trackFractionToTimeCap,
} from '@/domain/timeCap';

/** Every value any surface in this app writes into `maxMinutes` or `weeknightTimeBudgetMinutes` today. */
const EXISTING_TIME_VALUES = [15, 20, 30, 45];

describe('the ladder', () => {
  test('steps by five minutes, which is what the owner asked for', () => {
    expect(TIME_CAP_STEP_MINUTES).toBe(5);
  });

  test('runs from the minimum to the maximum and then ends on "geen limiet"', () => {
    expect(TIME_CAP_STOPS[0]).toBe(TIME_CAP_MIN_MINUTES);
    expect(TIME_CAP_STOPS[TIME_CAP_STOPS.length - 2]).toBe(TIME_CAP_MAX_MINUTES);
    expect(TIME_CAP_STOPS[TIME_CAP_STOPS.length - 1]).toBe(NO_TIME_CAP);
  });

  test('has exactly one "geen limiet" stop, and it is null', () => {
    expect(TIME_CAP_STOPS.filter((stop) => stop === null)).toHaveLength(1);
    expect(NO_TIME_CAP).toBeNull();
  });

  test('every numeric stop is a whole number of minutes on the step', () => {
    for (const stop of TIME_CAP_STOPS) {
      if (stop === null) {
        continue;
      }
      expect(Number.isInteger(stop)).toBe(true);
      expect(stop % TIME_CAP_STEP_MINUTES).toBe(0);
    }
  });

  test('rises without repeating itself', () => {
    const numeric = TIME_CAP_STOPS.filter((stop): stop is number => stop !== null);
    for (let index = 1; index < numeric.length; index += 1) {
      expect(numeric[index]).toBeGreaterThan(numeric[index - 1] as number);
    }
    expect(new Set(numeric).size).toBe(numeric.length);
  });

  test('the minimum is one step, so the floor is not a second arbitrary number', () => {
    expect(TIME_CAP_MIN_MINUTES).toBe(TIME_CAP_STEP_MINUTES);
  });

  test('reaches past the 45 the old chip rows stopped at — that is the whole point of the control', () => {
    expect(TIME_CAP_MAX_MINUTES).toBeGreaterThan(45);
  });

  test('carries every time value this app already writes', () => {
    for (const minutes of EXISTING_TIME_VALUES) {
      expect(TIME_CAP_STOPS).toContain(minutes);
    }
  });
});

describe('snapMinutesToTimeCapStep', () => {
  test('leaves a value already on the step alone', () => {
    expect(snapMinutesToTimeCapStep(30)).toBe(30);
    expect(snapMinutesToTimeCapStep(45)).toBe(45);
  });

  test('rounds to the nearest step rather than always down', () => {
    expect(snapMinutesToTimeCapStep(32)).toBe(30);
    expect(snapMinutesToTimeCapStep(33)).toBe(35);
  });

  test('rounds a half-step up, so dragging forwards never feels stuck', () => {
    expect(snapMinutesToTimeCapStep(32.5)).toBe(35);
  });

  test('clamps to the ends instead of leaving the ladder', () => {
    expect(snapMinutesToTimeCapStep(0)).toBe(TIME_CAP_MIN_MINUTES);
    expect(snapMinutesToTimeCapStep(-90)).toBe(TIME_CAP_MIN_MINUTES);
    expect(snapMinutesToTimeCapStep(10_000)).toBe(TIME_CAP_MAX_MINUTES);
  });

  test('always returns a value that is itself a stop', () => {
    for (const raw of [1, 7, 12.4, 47, 61, 118, 119.9]) {
      expect(TIME_CAP_STOPS).toContain(snapMinutesToTimeCapStep(raw));
    }
  });
});

describe('timeCapStopIndex', () => {
  test('puts "geen limiet" on the last stop', () => {
    expect(timeCapStopIndex(null)).toBe(TIME_CAP_STOPS.length - 1);
  });

  test('finds the stop a cap sits on', () => {
    expect(timeCapStopIndex(TIME_CAP_MIN_MINUTES)).toBe(0);
    expect(timeCapStopIndex(TIME_CAP_MAX_MINUTES)).toBe(TIME_CAP_STOPS.length - 2);
    expect(TIME_CAP_STOPS[timeCapStopIndex(30)]).toBe(30);
  });

  test('snaps a cap that is between two stops onto the nearer one', () => {
    expect(TIME_CAP_STOPS[timeCapStopIndex(37)]).toBe(35);
  });

  test('reads a cap wider than the ladder as "geen limiet", never as the maximum', () => {
    // DecisionFilterBar's own rule for a value its row cannot represent:
    // fall back to the widest state rather than invent a narrower one. A
    // control that silently reported a 180-minute cap as "120 min" would
    // be claiming the household asked for something it did not.
    expect(timeCapStopIndex(180)).toBe(TIME_CAP_STOPS.length - 1);
  });

  test('never returns an index outside the ladder', () => {
    for (const cap of [null, 0, 1, 5, 45, 120, 121, 99_999]) {
      const index = timeCapStopIndex(cap);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(TIME_CAP_STOPS.length);
    }
  });
});

describe('timeCapAtStopIndex', () => {
  test('is the inverse of timeCapStopIndex for every stop', () => {
    TIME_CAP_STOPS.forEach((stop, index) => {
      expect(timeCapAtStopIndex(index)).toBe(stop);
      expect(timeCapStopIndex(stop)).toBe(index);
    });
  });

  test('clamps an index off either end rather than returning undefined', () => {
    expect(timeCapAtStopIndex(-3)).toBe(TIME_CAP_STOPS[0]);
    expect(timeCapAtStopIndex(TIME_CAP_STOPS.length + 10)).toBe(NO_TIME_CAP);
  });

  test('rounds a fractional index', () => {
    expect(timeCapAtStopIndex(1.4)).toBe(TIME_CAP_STOPS[1]);
    expect(timeCapAtStopIndex(1.6)).toBe(TIME_CAP_STOPS[2]);
  });
});

describe('the track', () => {
  test('the narrowest cap sits at the start and "geen limiet" at the end', () => {
    expect(timeCapToTrackFraction(TIME_CAP_MIN_MINUTES)).toBe(0);
    expect(timeCapToTrackFraction(null)).toBe(1);
  });

  test('a wider cap always sits further along than a narrower one', () => {
    expect(timeCapToTrackFraction(45)).toBeGreaterThan(timeCapToTrackFraction(20));
    expect(timeCapToTrackFraction(null)).toBeGreaterThan(timeCapToTrackFraction(TIME_CAP_MAX_MINUTES));
  });

  test('a fraction round-trips back to the cap it came from', () => {
    for (const stop of TIME_CAP_STOPS) {
      expect(trackFractionToTimeCap(timeCapToTrackFraction(stop))).toBe(stop);
    }
  });

  test('a finger dragged past either end pins to that end rather than throwing', () => {
    expect(trackFractionToTimeCap(-0.4)).toBe(TIME_CAP_STOPS[0]);
    expect(trackFractionToTimeCap(1.9)).toBe(NO_TIME_CAP);
  });

  test('every fraction in range lands on a stop', () => {
    for (let step = 0; step <= 100; step += 1) {
      expect(TIME_CAP_STOPS).toContain(trackFractionToTimeCap(step / 100));
    }
  });
});

describe('nudgeTimeCap', () => {
  test('moves one stop at a time, which is one five-minute step', () => {
    expect(nudgeTimeCap(30, 1)).toBe(35);
    expect(nudgeTimeCap(30, -1)).toBe(25);
  });

  test('steps off the widest cap onto "geen limiet" and back', () => {
    expect(nudgeTimeCap(TIME_CAP_MAX_MINUTES, 1)).toBe(NO_TIME_CAP);
    expect(nudgeTimeCap(null, -1)).toBe(TIME_CAP_MAX_MINUTES);
  });

  test('pins at both ends instead of wrapping around', () => {
    expect(nudgeTimeCap(TIME_CAP_MIN_MINUTES, -1)).toBe(TIME_CAP_MIN_MINUTES);
    expect(nudgeTimeCap(null, 1)).toBe(NO_TIME_CAP);
  });

  test('crosses the whole ladder in a number of swipes a person would actually make', () => {
    // The accessibility cost, asserted rather than hoped for: VoiceOver and
    // TalkBack move an `adjustable` control one increment per swipe, and
    // RatingScale's own header calls ninety swipes "not an accessible
    // control, a technically-conformant one".
    let cap: number | null = TIME_CAP_MIN_MINUTES;
    let swipes = 0;
    while (cap !== NO_TIME_CAP && swipes < 500) {
      cap = nudgeTimeCap(cap, 1);
      swipes += 1;
    }
    expect(swipes).toBe(TIME_CAP_STOPS.length - 1);
    expect(swipes).toBeLessThanOrEqual(30);
  });
});

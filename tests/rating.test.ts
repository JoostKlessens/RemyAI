import { describe, expect, test } from 'vitest';
import {
  RATING_MAX,
  RATING_MIN,
  RATING_NEGATIVE_AT_OR_BELOW,
  RATING_POSITIVE_AT_OR_ABOVE,
  RATING_STEP,
  isValidRating,
  resolveRepeatSignal,
  toRepeatSignal,
} from '@/domain/rating';
import { makeCookEvent } from './fixtures';

describe('rating scale constants', () => {
  test('the scale is coherent: min < negative threshold < positive threshold <= max', () => {
    expect(RATING_MIN).toBeLessThan(RATING_NEGATIVE_AT_OR_BELOW);
    expect(RATING_NEGATIVE_AT_OR_BELOW).toBeLessThan(RATING_POSITIVE_AT_OR_ABOVE);
    expect(RATING_POSITIVE_AT_OR_ABOVE).toBeLessThanOrEqual(RATING_MAX);
  });

  /**
   * There must be at least one score that is neither positive nor
   * negative. Without a middle band every lukewarm meal is recorded as a
   * household favourite, which is the signal `HOUSEHOLD_FAVOURITE_BOOST`
   * in scoring.ts is built on.
   */
  test('leaves a neutral middle band between the two thresholds', () => {
    expect(RATING_POSITIVE_AT_OR_ABOVE - RATING_NEGATIVE_AT_OR_BELOW).toBeGreaterThan(1);
  });
});

describe('isValidRating', () => {
  test('accepts every whole number on the scale', () => {
    for (let score = RATING_MIN; score <= RATING_MAX; score += 1) {
      expect(isValidRating(score)).toBe(true);
    }
  });

  test('rejects values outside the scale', () => {
    expect(isValidRating(RATING_MIN - 1)).toBe(false);
    expect(isValidRating(RATING_MAX + 1)).toBe(false);
    expect(isValidRating(0)).toBe(false);
  });

  /** One decimal is the step, so a half grade is a real vote — "een 7,5" is how the grade is actually given. */
  test('accepts a value on the step', () => {
    expect(isValidRating(RATING_MIN + RATING_STEP)).toBe(true);
    expect(isValidRating(7.5)).toBe(true);
    expect(isValidRating(7.3)).toBe(true);
  });

  /**
   * 7.3 is not representable in binary floating point, so a naive
   * `value * 10 % 1 === 0` check rejects it. The pair above and below
   * guard that specific trap together: the legal value must pass and the
   * finer one must still fail.
   */
  test('rejects a value finer than the step, and non-finite values', () => {
    expect(isValidRating(7.55)).toBe(false);
    expect(isValidRating(RATING_MIN + RATING_STEP / 2)).toBe(false);
    expect(isValidRating(Number.NaN)).toBe(false);
    expect(isValidRating(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('toRepeatSignal — projecting a score onto the existing boolean', () => {
  test('a score at or above the positive threshold is a repeat', () => {
    expect(toRepeatSignal(RATING_POSITIVE_AT_OR_ABOVE)).toBe(true);
    expect(toRepeatSignal(RATING_MAX)).toBe(true);
  });

  test('a score at or below the negative threshold is not a repeat', () => {
    expect(toRepeatSignal(RATING_NEGATIVE_AT_OR_BELOW)).toBe(false);
    expect(toRepeatSignal(RATING_MIN)).toBe(false);
  });

  /**
   * The middle band maps to null, not to false. "It was fine" is not the
   * same claim as "never again", and scoring.ts treats null as no signal
   * rather than applying WOULD_NOT_REPEAT_PENALTY.
   */
  test('a middling score is no signal at all, not a negative one', () => {
    expect(toRepeatSignal(RATING_NEGATIVE_AT_OR_BELOW + 1)).toBeNull();
  });

  /**
   * Reachable when a stored score predates a change to the scale — a 7
   * written under a 1-10 scale, read back after a move to 1-5. Treated as
   * absent rather than clamped: clamping would turn someone's mediocre
   * score into a top one.
   */
  test('an off-scale score yields no signal rather than being clamped', () => {
    expect(toRepeatSignal(RATING_MAX + 1)).toBeNull();
    expect(toRepeatSignal(RATING_MIN - 1)).toBeNull();
  });
});

describe('resolveRepeatSignal — reading events written before ratings existed', () => {
  test('prefers the numeric rating when one was given', () => {
    const event = makeCookEvent({ rating: RATING_MAX, wouldRepeat: false });
    expect(resolveRepeatSignal(event)).toBe(true);
  });

  test('falls back to wouldRepeat for an event that predates ratings', () => {
    expect(resolveRepeatSignal(makeCookEvent({ wouldRepeat: true }))).toBe(true);
    expect(resolveRepeatSignal(makeCookEvent({ wouldRepeat: false }))).toBe(false);
  });

  /**
   * PD-006's posture applied to ratings: an unanswered question is
   * "unknown", never a neutral-but-recorded opinion. A meal nobody rated
   * must not be scored as though someone shrugged at it.
   */
  test('an unanswered event carries no signal', () => {
    expect(resolveRepeatSignal(makeCookEvent({ wouldRepeat: null }))).toBeNull();
  });

  test('an out-of-range rating is ignored rather than trusted', () => {
    const event = makeCookEvent({ rating: 99, wouldRepeat: true });
    expect(resolveRepeatSignal(event)).toBe(true);
  });
});

import { describe, expect, test } from 'vitest';
import {
  createCookTimer,
  formatCookTimer,
  isCookTimerFinished,
  pauseCookTimer,
  remainingSecondsAt,
  startCookTimer,
} from '@/domain/cookTimer';

/**
 * The bug these tests exist for: the timer used to count down by
 * decrementing a counter inside `setInterval`, which measures "how many
 * times a callback fired" rather than "how much time passed". A
 * backgrounded app stops firing that callback, so a twenty-minute timer
 * came back from a phone-lock with minutes still on it.
 *
 * Every test below passes an explicit `nowMs` and never reads the clock,
 * which is the whole reason this arithmetic was pulled out of the
 * component: remaining time is derived from a deadline, so the answer is
 * the same whether the app was awake for it or not.
 */

const MINUTE_MS = 60_000;
const T0 = 1_700_000_000_000;

describe('createCookTimer', () => {
  test('starts idle with the full duration remaining', () => {
    const timer = createCookTimer(5);

    expect(timer.status).toBe('idle');
    expect(remainingSecondsAt(timer, T0)).toBe(300);
  });

  test('rounds fractional minutes to whole seconds', () => {
    expect(remainingSecondsAt(createCookTimer(1.5), T0)).toBe(90);
  });

  test('an idle timer does not run down as time passes', () => {
    const timer = createCookTimer(5);

    expect(remainingSecondsAt(timer, T0 + 10 * MINUTE_MS)).toBe(300);
  });
});

describe('startCookTimer', () => {
  test('counts real elapsed time rather than ticks', () => {
    const running = startCookTimer(createCookTimer(5), T0);

    expect(remainingSecondsAt(running, T0)).toBe(300);
    expect(remainingSecondsAt(running, T0 + 1_000)).toBe(299);
    expect(remainingSecondsAt(running, T0 + 60_000)).toBe(240);
  });

  test('survives a gap in which nothing ticked at all', () => {
    // The phone was locked for eight of the twenty minutes.
    const running = startCookTimer(createCookTimer(20), T0);

    expect(remainingSecondsAt(running, T0 + 8 * MINUTE_MS)).toBe(12 * 60);
  });

  test('never reports negative time once the deadline passes', () => {
    const running = startCookTimer(createCookTimer(1), T0);

    expect(remainingSecondsAt(running, T0 + 10 * MINUTE_MS)).toBe(0);
  });

  test('shows the starting time for the whole of its first second', () => {
    const running = startCookTimer(createCookTimer(5), T0);

    expect(remainingSecondsAt(running, T0 + 1)).toBe(300);
    expect(remainingSecondsAt(running, T0 + 999)).toBe(300);
    expect(remainingSecondsAt(running, T0 + 1_000)).toBe(299);
  });

  test('returns a new object rather than mutating the idle timer', () => {
    const idle = createCookTimer(5);
    const running = startCookTimer(idle, T0);

    expect(running).not.toBe(idle);
    expect(idle.status).toBe('idle');
  });

  test('restarting an already-running timer leaves its deadline alone', () => {
    const running = startCookTimer(createCookTimer(5), T0);
    const again = startCookTimer(running, T0 + 60_000);

    expect(remainingSecondsAt(again, T0 + 60_000)).toBe(240);
  });
});

describe('pauseCookTimer', () => {
  test('keeps the time that was left at the moment of pausing', () => {
    const running = startCookTimer(createCookTimer(5), T0);
    const paused = pauseCookTimer(running, T0 + 60_000);

    expect(paused.status).toBe('paused');
    expect(remainingSecondsAt(paused, T0 + 60_000)).toBe(240);
  });

  test('a paused timer does not run down while paused', () => {
    const paused = pauseCookTimer(startCookTimer(createCookTimer(5), T0), T0 + 60_000);

    expect(remainingSecondsAt(paused, T0 + 10 * MINUTE_MS)).toBe(240);
  });

  test('resuming continues from where it was paused, not from the old deadline', () => {
    const paused = pauseCookTimer(startCookTimer(createCookTimer(5), T0), T0 + 60_000);
    const resumed = startCookTimer(paused, T0 + 10 * MINUTE_MS);

    expect(remainingSecondsAt(resumed, T0 + 10 * MINUTE_MS)).toBe(240);
    expect(remainingSecondsAt(resumed, T0 + 11 * MINUTE_MS)).toBe(180);
  });

  test('pausing after the deadline has passed leaves nothing on the clock', () => {
    const paused = pauseCookTimer(startCookTimer(createCookTimer(1), T0), T0 + 10 * MINUTE_MS);

    expect(remainingSecondsAt(paused, T0 + 10 * MINUTE_MS)).toBe(0);
  });

  test('pausing an idle timer changes nothing it had not already decided', () => {
    const idle = createCookTimer(5);
    const paused = pauseCookTimer(idle, T0 + MINUTE_MS);

    expect(remainingSecondsAt(paused, T0 + 10 * MINUTE_MS)).toBe(300);
  });
});

describe('isCookTimerFinished', () => {
  test('an idle timer is not finished, however long you wait', () => {
    expect(isCookTimerFinished(createCookTimer(5), T0 + 10 * MINUTE_MS)).toBe(false);
  });

  test('becomes true the instant the deadline is reached, with no tick required', () => {
    const running = startCookTimer(createCookTimer(1), T0);

    expect(isCookTimerFinished(running, T0 + 59_999)).toBe(false);
    expect(isCookTimerFinished(running, T0 + 60_000)).toBe(true);
  });

  test('a timer that ran out while the app was backgrounded is finished on return', () => {
    const running = startCookTimer(createCookTimer(3), T0);

    expect(isCookTimerFinished(running, T0 + 30 * MINUTE_MS)).toBe(true);
  });

  test('a paused timer with time left is not finished', () => {
    const paused = pauseCookTimer(startCookTimer(createCookTimer(5), T0), T0 + 60_000);

    expect(isCookTimerFinished(paused, T0 + 10 * MINUTE_MS)).toBe(false);
  });
});

describe('formatCookTimer', () => {
  test('pads both halves to two digits', () => {
    expect(formatCookTimer(0)).toBe('00:00');
    expect(formatCookTimer(9)).toBe('00:09');
    expect(formatCookTimer(70)).toBe('01:10');
    expect(formatCookTimer(600)).toBe('10:00');
  });

  test('does not roll over into hours, because a cook step is not measured in them', () => {
    expect(formatCookTimer(3_600)).toBe('60:00');
  });
});

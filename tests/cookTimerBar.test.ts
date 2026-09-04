import { describe, expect, test } from 'vitest';
import { selectCookTimerBar, type CookTimerBarStep } from '@/domain/cookTimerBar';
import { createCookTimer, startCookTimer, pauseCookTimer, type CookTimerState } from '@/domain/cookTimer';
import type { MealStepId } from '@/domain/types';

/**
 * The bar exists because a timer running on a step you have paged away
 * from was invisible AND silent (GAP-22). So the assertions that matter
 * are about which step the timer belongs to, not about the arithmetic —
 * tests/cookTimer.test.ts already owns the countdown.
 */

const NOW = 1_700_000_000_000;

const STEPS: readonly CookTimerBarStep[] = [
  { id: 'step-1' as MealStepId },
  { id: 'step-2' as MealStepId },
  { id: 'step-3' as MealStepId },
];

function running(minutes: number, startedAtMs = NOW): CookTimerState {
  return startCookTimer(createCookTimer(minutes), startedAtMs);
}

describe('there is nothing to show', () => {
  test('returns null when no timer has been started', () => {
    expect(selectCookTimerBar({ steps: STEPS, timers: {}, currentStepIndex: 0, nowMs: NOW })).toBeNull();
  });

  test('returns null when the only running timer belongs to the step being looked at', () => {
    // TimerDisplay is mounted for this step and is showing the countdown
    // full size. A bar as well would be the same clock twice, and would
    // give two components a claim on announcing it finished.
    const timers = { 'step-2': running(10) };
    expect(selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 1, nowMs: NOW })).toBeNull();
  });

  test('returns null for a paused timer on another step', () => {
    // Paused is a timer the cook stopped on purpose. It will not come back
    // and interrupt them, so it is not news worth a permanent strip.
    const timers = { 'step-1': pauseCookTimer(running(10), NOW + 60_000) };
    expect(selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 2, nowMs: NOW + 60_000 })).toBeNull();
  });

  test('returns null for an idle timer on another step', () => {
    const timers = { 'step-1': createCookTimer(10) };
    expect(selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 2, nowMs: NOW })).toBeNull();
  });
});

describe('a timer running on another step', () => {
  test('is reported, named by its one-based step number', () => {
    const timers = { 'step-1': running(10) };
    const bar = selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 2, nowMs: NOW });
    expect(bar).not.toBeNull();
    expect(bar?.stepId).toBe('step-1');
    // Zero-based for the screen to navigate with, one-based for the label:
    // the bar names a step the way the header does, not the way an array does.
    expect(bar?.stepIndex).toBe(0);
    expect(bar?.stepNumber).toBe(1);
  });

  test('reports remaining time derived from now, not from a tick count', () => {
    const timers = { 'step-1': running(10) };
    const bar = selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 2, nowMs: NOW + 4 * 60_000 });
    expect(bar?.remainingSeconds).toBe(6 * 60);
    expect(bar?.finished).toBe(false);
  });

  test('reports finished the moment the deadline passes, with no tick required', () => {
    // The phone-lock case: nothing ran while the screen was off, and the
    // timer is finished the instant anything asks again.
    const timers = { 'step-1': running(10) };
    const bar = selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 2, nowMs: NOW + 11 * 60_000 });
    expect(bar?.finished).toBe(true);
    expect(bar?.remainingSeconds).toBe(0);
  });
});

describe('when two timers compete for one bar', () => {
  test('a finished timer outranks a running one, whatever the step order', () => {
    // step-3 finished; step-1 still has time. The finished one is the only
    // one asking for something.
    const timers = {
      'step-1': running(30),
      'step-3': running(5),
    };
    const bar = selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 1, nowMs: NOW + 6 * 60_000 });
    expect(bar?.stepId).toBe('step-3');
    expect(bar?.finished).toBe(true);
  });

  test('among running timers, the earlier deadline wins', () => {
    const timers = {
      'step-1': running(30),
      'step-3': running(5),
    };
    const bar = selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 1, nowMs: NOW });
    expect(bar?.stepId).toBe('step-3');
  });

  test('among finished timers, the one waiting longest wins', () => {
    const timers = {
      'step-1': running(5),
      'step-3': running(8),
    };
    const bar = selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 1, nowMs: NOW + 10 * 60_000 });
    expect(bar?.stepId).toBe('step-1');
  });

  test('an exact tie breaks on step order, so the same kitchen always shows the same bar', () => {
    const timers = {
      'step-1': running(10),
      'step-3': running(10),
    };
    const bar = selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 1, nowMs: NOW });
    expect(bar?.stepId).toBe('step-1');
  });

  test('the current step is excluded even when its timer is the most urgent', () => {
    const timers = {
      'step-1': running(30),
      'step-2': running(1),
    };
    const bar = selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 1, nowMs: NOW });
    expect(bar?.stepId).toBe('step-1');
  });
});

describe('a timer keyed to a step that is not in the list', () => {
  test('is ignored rather than crashing the bar', () => {
    // Steps are re-read on every mount; a stale key is a real possibility
    // and must not be able to point the bar at a step that cannot be
    // navigated to.
    const timers = { 'step-99': running(10) };
    expect(selectCookTimerBar({ steps: STEPS, timers, currentStepIndex: 0, nowMs: NOW })).toBeNull();
  });
});

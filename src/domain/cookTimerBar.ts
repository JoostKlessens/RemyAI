/**
 * WHICH TIMER THE PERSISTENT BAR IN COOK MODE SHOWS, and whether there is
 * one at all.
 *
 * THE DEFECT THIS CLOSES (WS5 §4.3.2, GAP-22). Cook mode's timer state was
 * hoisted onto the screen so a countdown survives paging between steps —
 * that half landed. The visible half never did: `TimerDisplay` only renders
 * for the step you are looking at, so paging forward to a step with no time
 * of its own makes a running simmer disappear entirely. Worse than
 * invisible, it goes SILENT: the finish haptic and the "Timer klaar"
 * announcement live inside that component, so a timer that runs out while
 * the cook is reading ahead tells nobody. Reading ahead is the thing this
 * screen most wants to be safe, and it was the thing that broke the clock.
 *
 * WHY THE BAR ONLY EVER SHOWS AN *OFF-STEP* TIMER. The alternative — always
 * show the most urgent timer, including the current step's — puts two
 * countdowns for the same step on one screen, and gives two components a
 * claim on firing the same completion. One of them would have to be taught
 * to keep quiet, and "which one announced it" is exactly the class of bug
 * that only appears on a real device. Excluding the current step makes the
 * split structural: for any given timer, either `TimerDisplay` is mounted
 * for it or the bar is, never both.
 *
 * WHY PAUSED TIMERS ARE NOT SHOWN. A paused timer is one the cook stopped
 * on purpose. It will not come back and interrupt them, so it is not news —
 * and a bar that stays up for every timer ever touched becomes a permanent
 * fixture, which costs the fixed vertical strip WS5 §4.6 spends three
 * requirements protecting. An `idle` timer is likewise nothing: it is a
 * duration printed on a step nobody has started.
 *
 * PURE, AND THAT IS THE POINT. `now` is a parameter and never read from the
 * clock here, exactly as in cookTimer.ts, so the selection rule is provable
 * in tests/cookTimerBar.test.ts — in a repo where the screen holding it
 * cannot be imported by the test runner at all.
 */

import { isCookTimerFinished, remainingSecondsAt, type CookTimerState } from './cookTimer';
import type { MealStepId } from './types';

/** Only what the bar needs off a `MealStep`, so a test does not have to build a whole meal to ask one question. */
export interface CookTimerBarStep {
  readonly id: MealStepId;
}

export interface CookTimerBarInput {
  /** In cook order, which is the order `stepNumber` on the bar counts. */
  readonly steps: readonly CookTimerBarStep[];
  readonly timers: Readonly<Record<MealStepId, CookTimerState>>;
  /** Zero-based, matching the screen's own `stepIndex`. */
  readonly currentStepIndex: number;
  readonly nowMs: number;
}

export interface CookTimerBarModel {
  readonly stepId: MealStepId;
  /** Zero-based — what the screen sets `stepIndex` to when the bar is tapped. */
  readonly stepIndex: number;
  /** One-based, for "stap 2". The bar names a step the way the header does, not the way an array does. */
  readonly stepNumber: number;
  readonly remainingSeconds: number;
  /** Drives the whole visual swap: `accentMuted`/`accentOnMuted` while running, `positiveMuted`/`positive` once this is true. */
  readonly finished: boolean;
}

/**
 * ONE BAR, ONE TIMER, AND THE PRIORITY IS STATED RATHER THAN LEFT TO
 * ITERATION ORDER.
 *
 * 1. **A finished timer outranks a running one.** It is the only one asking
 *    for something: a running timer is information, a finished one is an
 *    interruption the cook asked for and has not yet been given.
 * 2. **Within either group, the earlier deadline wins** — for running
 *    timers that is the next thing to demand attention, and for finished
 *    ones it is the one that has been waiting longest.
 * 3. **Ties break on step order**, so the same kitchen state always
 *    produces the same bar. Two timers set to the same second is not an
 *    edge case worth a coin flip.
 *
 * Two concurrent timers are real cooking (rice and sauce) and this returns
 * one of them on purpose: a second bar needs a which-one-fired story and a
 * scheduling model, and WS5 §4.3.2 says ship one. The record this reads
 * already holds as many as the cook starts, so nothing here has to be
 * redesigned if that day comes — only this function.
 */
export function selectCookTimerBar(input: CookTimerBarInput): CookTimerBarModel | null {
  const { steps, timers, currentStepIndex, nowMs } = input;

  const candidates = steps
    .map((step, index) => ({ step, index }))
    .filter(({ index }) => index !== currentStepIndex)
    .map(({ step, index }) => {
      const timer = timers[step.id];
      if (timer === undefined || timer.status !== 'running') {
        // `running` is the only status the bar reports — see the file
        // header on paused and idle. A finished timer is still `running`
        // in the state machine: it holds a deadline that has passed, which
        // is precisely how a timer survives a locked phone.
        return null;
      }
      return {
        stepId: step.id,
        stepIndex: index,
        stepNumber: index + 1,
        remainingSeconds: remainingSecondsAt(timer, nowMs),
        finished: isCookTimerFinished(timer, nowMs),
        endsAtMs: timer.endsAtMs,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);

  // `reduce` rather than sort-and-take-first: the array is already known
  // to be non-empty or not, and reading index 0 off a sorted copy would
  // need either a `!` assertion or a second emptiness check the compiler
  // cannot connect to the first one (`noUncheckedIndexedAccess`).
  const best = candidates.reduce<(typeof candidates)[number] | null>(
    (winner, candidate) => (winner === null || outranks(candidate, winner) ? candidate : winner),
    null,
  );
  if (best === null) {
    return null;
  }

  return {
    stepId: best.stepId,
    stepIndex: best.stepIndex,
    stepNumber: best.stepNumber,
    remainingSeconds: best.remainingSeconds,
    finished: best.finished,
  };
}

/** The three-step priority from `selectCookTimerBar`'s doc comment, as one comparison. */
function outranks(
  candidate: { readonly finished: boolean; readonly endsAtMs: number; readonly stepIndex: number },
  winner: { readonly finished: boolean; readonly endsAtMs: number; readonly stepIndex: number },
): boolean {
  if (candidate.finished !== winner.finished) {
    return candidate.finished;
  }
  if (candidate.endsAtMs !== winner.endsAtMs) {
    return candidate.endsAtMs < winner.endsAtMs;
  }
  return candidate.stepIndex < winner.stepIndex;
}

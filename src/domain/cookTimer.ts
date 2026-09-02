/**
 * Cook Mode's countdown, as arithmetic rather than as a component.
 *
 * The bug this exists to kill: `TimerDisplay` used to hold
 * `remainingSeconds` in state and decrement it inside a `setInterval`.
 * That measures how many times a callback fired, which is not the same
 * thing as how much time passed — a phone that locks, or an OS that
 * throttles timers in the background, simply stops firing it. A cook who
 * locked their phone for eight minutes of a twenty-minute simmer came
 * back to a timer that still believed it had twenty minutes to go, and a
 * cooking timer that is wrong is worse than no timer at all.
 *
 * So a running timer stores a **deadline**, never a countdown, and
 * remaining time is derived from whatever `now` happens to be when
 * something asks. Ticking becomes a rendering concern: the interval in
 * the component exists only to re-ask the question once a second, and
 * missing a hundred of those ticks changes no answer.
 *
 * `now` is a parameter and is never read from the clock in here, which
 * is what makes this testable in a repo where no component can be. See
 * `tests/cookTimer.test.ts`.
 */

/**
 * A timer that has never been started is `idle` rather than `paused`,
 * because the two differ where it matters: an idle timer shows the
 * step's full duration and can never be "finished", whereas a paused one
 * holds whatever was left and may already have run out.
 */
export type CookTimerState =
  | { readonly status: 'idle'; readonly remainingMs: number }
  | { readonly status: 'running'; readonly endsAtMs: number }
  | { readonly status: 'paused'; readonly remainingMs: number };

const MS_PER_SECOND = 1_000;
const SECONDS_PER_MINUTE = 60;

export function createCookTimer(durationMinutes: number): CookTimerState {
  const remainingMs = Math.round(durationMinutes * SECONDS_PER_MINUTE) * MS_PER_SECOND;
  return { status: 'idle', remainingMs: Math.max(0, remainingMs) };
}

/**
 * Starting converts whatever is left into a deadline. Calling it on an
 * already-running timer is deliberately a no-op rather than a restart:
 * the component re-renders once a second, and a stray re-entry must
 * never quietly hand the cook back time they have already spent.
 */
export function startCookTimer(state: CookTimerState, nowMs: number): CookTimerState {
  if (state.status === 'running') {
    return state;
  }
  return { status: 'running', endsAtMs: nowMs + state.remainingMs };
}

export function pauseCookTimer(state: CookTimerState, nowMs: number): CookTimerState {
  if (state.status !== 'running') {
    return state;
  }
  return { status: 'paused', remainingMs: remainingMsAt(state, nowMs) };
}

/**
 * Rounded up, so a five-minute timer reads `05:00` for the whole of its
 * first second and only reaches `00:00` when the time is genuinely gone.
 * Rounding down would show `04:59` the instant it started.
 */
export function remainingSecondsAt(state: CookTimerState, nowMs: number): number {
  return Math.ceil(remainingMsAt(state, nowMs) / MS_PER_SECOND);
}

/**
 * True the moment the deadline passes, with no tick required — which is
 * what lets a timer that ran out during a phone-lock be finished the
 * instant the screen comes back, rather than having to catch up first.
 */
export function isCookTimerFinished(state: CookTimerState, nowMs: number): boolean {
  if (state.status === 'idle') {
    return false;
  }
  return remainingMsAt(state, nowMs) <= 0;
}

export function formatCookTimer(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE);
  const seconds = safeSeconds % SECONDS_PER_MINUTE;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function remainingMsAt(state: CookTimerState, nowMs: number): number {
  if (state.status === 'running') {
    return Math.max(0, state.endsAtMs - nowMs);
  }
  return state.remainingMs;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

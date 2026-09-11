import { describe, expect, test } from 'vitest';
import { CHECKPOINT_FILL_SCALE_FROM, resolveCheckpointFilled } from '@/components/importCheckpointPresentation';

/**
 * This file exists for one rule: THE LAST CHECKPOINT IS NEVER FILLED.
 *
 * It has already been lost once. `ImportCheckpointList.tsx`'s header records
 * that it used to be an `&&` inside the caller's `.map()` — "exactly the
 * sort of clause a later edit simplifies away without noticing what it was
 * for". Moving it into the component was safer but still unwatched, because
 * vitest runs node-only with react-native stubbed and nothing here renders a
 * `.tsx`. These assertions are the watch.
 *
 * What the rule protects: the screen's timers advance `filledCount` on a
 * fixed schedule (500 ms, 1400 ms) while the request is still in flight. If
 * a timer could light the final row, the interface would claim a step had
 * finished while it was still running — breaking the same "no spinner that
 * resolves into nothing" promise this flow makes everywhere else.
 */

describe('the last row is never filled, whatever filledCount says', () => {
  test('refuses the in-flight row even when the count reaches it', () => {
    // Three labels: rows 0 and 1 may fill, row 2 is the step in flight.
    expect(resolveCheckpointFilled(2, 3, 3)).toBe(false);
  });

  test('refuses the in-flight row even when the count runs past the end', () => {
    // A stale timer from an abandoned attempt is the realistic way this
    // arrives — the screen clears them, but the count is not the guard.
    expect(resolveCheckpointFilled(2, 3, 99)).toBe(false);
  });

  test('refuses the only row when there is exactly one', () => {
    // A single-step narration is all in flight and nothing else.
    expect(resolveCheckpointFilled(0, 1, 1)).toBe(false);
  });
});

describe('the leading rows fill in order', () => {
  test('nothing is filled before the first timer lands', () => {
    expect(resolveCheckpointFilled(0, 3, 0)).toBe(false);
    expect(resolveCheckpointFilled(1, 3, 0)).toBe(false);
  });

  test('one filled count lights the first row only', () => {
    expect(resolveCheckpointFilled(0, 3, 1)).toBe(true);
    expect(resolveCheckpointFilled(1, 3, 1)).toBe(false);
  });

  test('two filled counts light both leading rows', () => {
    expect(resolveCheckpointFilled(0, 3, 2)).toBe(true);
    expect(resolveCheckpointFilled(1, 3, 2)).toBe(true);
  });

  /**
   * The four-label narration (a post that also gets a creator lookup) has
   * three leading rows, but the screen only ever advances the count to two —
   * so the third leading row stays empty beside the in-flight one. That is
   * the honest picture and not a gap: nothing has measured that step.
   */
  test('a longer narration leaves un-narrated leading rows empty', () => {
    expect(resolveCheckpointFilled(2, 4, 2)).toBe(false);
    expect(resolveCheckpointFilled(3, 4, 2)).toBe(false);
  });
});

describe('the fill grows into place rather than arriving', () => {
  test('starts visibly large, so the eye reads one movement and not a flash', () => {
    expect(CHECKPOINT_FILL_SCALE_FROM).toBeGreaterThan(0);
    expect(CHECKPOINT_FILL_SCALE_FROM).toBeLessThan(1);
  });
});

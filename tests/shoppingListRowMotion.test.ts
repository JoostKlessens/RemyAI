import { describe, expect, test } from 'vitest';
import { CHECK_MARK_SCALE_FROM, ROW_PRESS_SCALE, shouldAnimateCheckMark } from '@/components/shoppingListRowMotion';

/**
 * The rule under test is a FlatList rule wearing an animation's clothes.
 *
 * `src/app/boodschappen.tsx` renders these rows in a `FlatList`, which
 * recycles them. Scroll a ticked row out of the window and back and it
 * mounts again with `checked: true`. Keyed off that prop alone, every
 * remount would replay the landing mark — so a long list would keep
 * announcing items as "just ticked" that were ticked minutes ago, and
 * scrolling would look like the app ticking things off by itself.
 *
 * The guard is that the row compares against what IT last drew. These tests
 * hold that comparison, because nothing renders the `.tsx` in this repo.
 */

describe('the mark lands only on the edge the shopper caused', () => {
  test('animates when an unchecked row becomes checked', () => {
    expect(shouldAnimateCheckMark(false, true, false)).toBe(true);
  });

  test('does not animate when a checked row re-renders as checked', () => {
    // This is the recycled row: same value in, same value out, nothing to
    // announce. It is also every unrelated parent re-render.
    expect(shouldAnimateCheckMark(true, true, false)).toBe(false);
  });

  test('does not animate on un-ticking', () => {
    // Taking something back is not a mark being set. Running the movement
    // backwards would give the undo the same weight as the act.
    expect(shouldAnimateCheckMark(true, false, false)).toBe(false);
  });

  test('does not animate when an unchecked row stays unchecked', () => {
    expect(shouldAnimateCheckMark(false, false, false)).toBe(false);
  });
});

describe('reduced motion removes the movement, not just its length', () => {
  /**
   * The call site pairs this `false` with `setValue` rather than a zero
   * duration, so no intermediate frame is ever constructed — the repo rule
   * from `resolveDuration`'s own header: instantly, not faster.
   */
  test('refuses the landing even on the edge that would otherwise animate', () => {
    expect(shouldAnimateCheckMark(false, true, true)).toBe(false);
  });

  test('stays refused for every other combination too', () => {
    expect(shouldAnimateCheckMark(true, true, true)).toBe(false);
    expect(shouldAnimateCheckMark(true, false, true)).toBe(false);
    expect(shouldAnimateCheckMark(false, false, true)).toBe(false);
  });
});

describe('the two scales say different things and must not converge', () => {
  /**
   * The press acknowledges a finger; the mark is a thing being set. If these
   * two ever became one number, the row would be saying the same thing twice
   * about two different events.
   */
  test('the press barely moves, because it fires twenty times a trip', () => {
    expect(ROW_PRESS_SCALE).toBeGreaterThan(0.9);
    expect(ROW_PRESS_SCALE).toBeLessThan(1);
  });

  test('the mark grows from clearly smaller, so it reads as landing', () => {
    expect(CHECK_MARK_SCALE_FROM).toBeGreaterThan(0);
    expect(CHECK_MARK_SCALE_FROM).toBeLessThan(ROW_PRESS_SCALE);
  });
});

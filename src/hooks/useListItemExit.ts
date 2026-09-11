/**
 * One item leaving one list, visibly.
 *
 * WHAT WAS BROKEN. Two screens remove a row after a confirmed, deliberate
 * act — `deze-week.tsx` takes a dish off the week, `(tabs)/recipes.tsx`
 * archives one — and in both the row was simply absent on the next render.
 * `deze-week.tsx`'s own comment records that its success path is silent on
 * purpose (no haptic, no banner; only failure speaks), which means the
 * disappearing row was the ONLY signal a sighted household got that the act
 * worked. A thing that vanishes between frames does not read as "done", it
 * reads as a glitch — and the two are indistinguishable in an app that is
 * also capable of failing.
 *
 * THIS IS WHERE `easingAccelerate` BELONGS. Together with the sheet exit it
 * is the token's first use in the repo: it means "things leaving", and until
 * this round nothing in this app animated something leaving.
 *
 * ⚠ THE VALUES LIVE IN A MAP OUTSIDE `renderItem`, AND THAT IS NOT AN
 * OPTIMISATION. `FlatList` recycles rows: a value created inside `renderItem`
 * would be re-created whenever a row scrolled out of the window and back, so
 * a half-finished exit could restart, and — worse — rows the household never
 * touched would animate simply because scrolling re-mounted them. Keyed by
 * id in a ref, an exit belongs to a meal rather than to whichever cell
 * happens to be drawing it.
 *
 * ⚠ AND THE CALLER'S REMOVAL RUNS IN THE CALLBACK, NOT BESIDE IT. Both
 * screens used to drop the item from state synchronously; if they still did,
 * this hook would be animating a row React had already unmounted, which is a
 * no-op with extra steps. `runExit` owns the ordering so neither call site
 * has to remember it.
 */

import { useCallback, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { motion, resolveDuration } from '@/theme/tokens';

export interface ListItemExit {
  /**
   * The item's presence: 1 while it is there, 0 once it has left. Build the
   * style from this — `opacity` alone where the act is reversible, `opacity`
   * plus a `scale` interpolation where it is not.
   */
  readonly valueFor: (id: string) => Animated.Value;
  /**
   * Play the exit for `id`, then run `after` — which is where the caller
   * drops the item from its own state.
   */
  readonly runExit: (id: string, after: () => void) => void;
}

export function useListItemExit(reduceMotionEnabled: boolean): ListItemExit {
  const values = useRef(new Map<string, Animated.Value>()).current;

  const valueFor = useCallback(
    (id: string): Animated.Value => {
      const existing = values.get(id);
      if (existing !== undefined) {
        return existing;
      }
      const created = new Animated.Value(1);
      values.set(id, created);
      return created;
    },
    [values],
  );

  const runExit = useCallback(
    (id: string, after: () => void): void => {
      if (reduceMotionEnabled) {
        // Instantly, not faster: no timing is constructed, so no frame of
        // the row at partial opacity is ever drawn. The ORDER survives even
        // though the movement does not — `after` still runs, and still runs
        // last, because the caller's state update is the real work.
        values.delete(id);
        after();
        return;
      }
      const value = valueFor(id);
      Animated.timing(value, {
        toValue: 0,
        duration: resolveDuration(motion.durationNormal, reduceMotionEnabled),
        easing: Easing.bezier(...motion.easingAccelerate),
        useNativeDriver: true,
      }).start(() => {
        // Dropped once it has served its purpose, so a household that
        // removes item after item does not accumulate one `Animated.Value`
        // per meal it has ever archived.
        values.delete(id);
        after();
      });
    },
    [values, valueFor, reduceMotionEnabled],
  );

  return { valueFor, runExit };
}

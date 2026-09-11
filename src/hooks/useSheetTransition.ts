/**
 * The one physical sheet, owned once instead of four times.
 *
 * WHAT WAS BROKEN, AND IT READ AS A CRASH RATHER THAN AS SPEED. All four
 * bottom sheets in this app (`SaveIntentSheet`, `SendRecipeSheet`,
 * `LibraryTileActionSheet`, `PortionScalingSheet`) set
 * `animationType="none"` on their `Modal` and animated the ENTRANCE by
 * hand — a considered 250 ms rise with a matching scrim fade. None of them
 * animated the exit. `visible` flipped to `false` and the sheet was simply
 * gone, in one frame. The motion research put it exactly: "a considered
 * 250 ms entrance with a one-frame exit reads as a bug, not as speed."
 *
 * WHY A HOOK AND NOT FOUR PATCHES. The same fix pasted four times is four
 * chances to drift, and the drift had already started: `SHEET_ENTRY_OFFSET
 * = 400` existed as three separate constants plus one inline literal, and
 * `PortionScalingSheet` — added last — copied the pattern rather than
 * finding it. One of those copies was already wrong in a way nobody could
 * see: `SendRecipeSheet` is 534 lines and can exceed 400 pt at large
 * Dynamic Type, at which point its "off-screen" start position is INSIDE
 * the screen and the top of the sheet visibly pops instead of sliding.
 * Measuring the panel removes that whole class of bug.
 *
 * THIS IS THE FIRST USE OF `easingAccelerate` IN THE REPO, AND THAT IS THE
 * POINT. The token has sat unused since the motion system was written; its
 * meaning is "things leaving", and until now nothing in this app ever
 * animated something leaving. An exit is precisely what it is for. Using
 * `easingDecelerate` here — the commonest motion mistake in mobile UI —
 * would make the sheet appear to ARRIVE at the bottom of the screen.
 *
 * ⚠ WHAT THIS HOOK DELIBERATELY DOES NOT DO: DRAG. Three of the four sheets
 * contain a `ScrollView`, and arbitrating a vertical drag against a
 * vertical scroll without `react-native-gesture-handler` (not installed,
 * and the motion research argued against adding it outside a proper `Sheet`
 * primitive) is the most bug-prone work in this area. It is also not what
 * was missing: a sheet that leaves visibly is CLEARER, a sheet you can drag
 * is merely nicer. The drag handles those sheets draw still do nothing, and
 * that stays an honest thing to fix later rather than a thing to fake now.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, type LayoutChangeEvent } from 'react-native';
import { motion, resolveDuration } from '@/theme/tokens';

/**
 * The distance a sheet travels when its real height is not known yet — the
 * value all four sheets used to hard-code. Kept only as the first-frame
 * fallback: `onSheetLayout` replaces it with the measured height before the
 * entrance runs, so a taller sheet never starts from inside the screen.
 */
export const SHEET_FALLBACK_TRAVEL = 400;

export interface SheetTransition {
  /**
   * What the `Modal`'s own `visible` should be, which is NOT the caller's
   * `visible`.
   *
   * ⚠ THIS INDIRECTION IS THE WHOLE MECHANISM, AND THE OBVIOUS SIMPLER
   * VERSION DOES NOT WORK. An exit that only ran when the user tapped the
   * scrim would miss the case that matters most: `useLibraryTileActions`
   * closes this sheet PROGRAMMATICALLY after a confirmed removal, by
   * dropping the meal it was opened for. That path never touches a
   * dismissal handler, so a handler-based exit would animate every close
   * except the one where something actually happened. Owning the mount
   * means the exit runs whatever caused `visible` to go false.
   */
  readonly mounted: boolean;
  /** Drives the panel's `transform: [{ translateY }]`. */
  readonly translateY: Animated.Value;
  /** Drives the scrim's `opacity`, in step with the panel. */
  readonly scrimOpacity: Animated.Value;
  /** Put on the panel's `onLayout`, so the travel distance is measured rather than guessed. */
  readonly onSheetLayout: (event: LayoutChangeEvent) => void;
}

export function useSheetTransition(visible: boolean, reduceMotionEnabled: boolean): SheetTransition {
  const travel = useRef(SHEET_FALLBACK_TRAVEL);
  const translateY = useRef(new Animated.Value(SHEET_FALLBACK_TRAVEL)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  const onSheetLayout = useCallback((event: LayoutChangeEvent): void => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      travel.current = height;
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      const duration = resolveDuration(motion.durationNormal, reduceMotionEnabled);
      // Reduced motion starts where it ends: the transform is skipped, not
      // shortened. `StepView.tsx` sets the precedent this mirrors.
      translateY.setValue(reduceMotionEnabled ? 0 : travel.current);
      scrimOpacity.setValue(reduceMotionEnabled ? 1 : 0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing: Easing.bezier(...motion.easingDecelerate),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, { toValue: 1, duration, useNativeDriver: true }),
      ]).start();
      return;
    }

    // Nothing to leave: this is the first render of a closed sheet, or a
    // second `visible: false` after the exit already finished.
    if (!mounted) {
      return;
    }

    if (reduceMotionEnabled) {
      // Instantly, not faster: no timing is constructed, so not one
      // intermediate frame is rendered.
      translateY.setValue(travel.current);
      scrimOpacity.setValue(0);
      setMounted(false);
      return;
    }

    let cancelled = false;
    const duration = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: travel.current,
        duration,
        easing: Easing.bezier(...motion.easingAccelerate),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, { toValue: 0, duration, useNativeDriver: true }),
    ]).start(() => {
      // Re-opening mid-exit re-runs this effect with `visible: true`, which
      // cancels this branch — without the guard the finished exit would then
      // unmount a sheet the user had just asked for again.
      if (!cancelled) {
        setMounted(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [visible, mounted, translateY, scrimOpacity, reduceMotionEnabled]);

  return { mounted, translateY, scrimOpacity, onSheetLayout };
}

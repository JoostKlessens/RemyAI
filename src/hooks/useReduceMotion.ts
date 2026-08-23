/**
 * Reads the OS "reduce motion" accessibility setting once per screen and
 * keeps it live if the user changes it while the screen is mounted.
 *
 * Pair the returned flag with `resolveDuration()` from `@/theme/tokens` at
 * every animation call site — reduced motion means state changes land
 * instantly, not just faster. See docs/DESIGN.md "Global rules".
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) {
        setReduceMotionEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => setReduceMotionEnabled(enabled),
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotionEnabled;
}

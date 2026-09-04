/**
 * The single 2px progress line used by Cook Mode's step counter
 * ("Stap 3/7"). Fills left-to-right with `accent`.
 *
 * IT FILLS RATHER THAN JUMPING, WHICH IT DID NOT USED TO. The rule was a
 * plain `width: '43%'` that snapped to its next value on the frame the
 * step changed — and a bar that teleports is read as a redrawn screen
 * rather than as progress through one. STYLING-PLAN.md records it as a
 * defect; this is the fix.
 *
 * SCALE, NOT WIDTH, and that is the whole reason this component now has a
 * hook in it. `width` is a layout property: animating it cannot use the
 * native driver, so every frame of a 250 ms fill goes through the JS
 * thread — on the one screen where the JS thread is also re-rendering a
 * countdown once a second. `scaleX` with `transformOrigin: 'left'` runs on
 * the compositor and is the pattern three other components in this app
 * already use for exactly this mark (DecisionCard's accept stroke,
 * SendRecipeSheet's commit, FriendProofCard's closed loop).
 *
 * UNDER REDUCE-MOTION IT STILL SNAPS, and that is correct rather than a
 * concession: `resolveDuration` collapses the fill to zero, so the bar
 * appears already at its new length. The information is identical; only
 * the travel is gone.
 */

import { useEffect, useRef, type JSX } from 'react';
import { Animated, Easing, StyleSheet, View, useColorScheme } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getColors, motion, resolveDuration } from '@/theme/tokens';

export interface ProgressRuleProps {
  /** 0..1 */
  readonly progress: number;
  readonly accessibilityLabel?: string;
}

export function ProgressRule(props: ProgressRuleProps): JSX.Element {
  const { progress, accessibilityLabel } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();
  const clamped = Math.max(0, Math.min(1, progress));

  /**
   * Seeded at the first value rather than at 0, so the rule does not play
   * a fill on arrival. An entrance animation on a progress bar claims the
   * cook has just travelled from zero to step 3, which they have not —
   * WS5 §3.3's "no haptic on any entrance" is the same rule in the other
   * medium, and it applies for the same reason.
   */
  const fill = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(fill, {
      toValue: clamped,
      duration: resolveDuration(motion.durationNormal, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingDecelerate),
      useNativeDriver: true,
    }).start();
  }, [clamped, fill, reduceMotionEnabled]);

  return (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Voortgang'}
      // Reports the REAL value, not the animated one: a screen reader must
      // hear where the cook is, not watch a bar catch up to it.
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      {/* Full width, scaled down — so `scaleX` maps directly to the
          fraction with no measurement pass, the same trick the three
          stroke components use. */}
      <Animated.View
        style={[styles.fill, { backgroundColor: colors.accent, transform: [{ scaleX: fill }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 2,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    width: '100%',
    transformOrigin: 'left',
  },
});

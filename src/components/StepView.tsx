/**
 * Cook Mode's single-step instruction display. Left-aligned (centered text
 * is harder to scan mid-step, per docs/DESIGN.md). Wrapped in a
 * `ScrollView` that stays flush at normal type sizes but is the one region
 * allowed to grow/scroll internally at 200% Dynamic Type, so the fixed-
 * height progress rule and nav buttons never get pushed off-screen.
 *
 * Step-to-step transition is a mild vertical slide (`durationNormal`,
 * `easingStandard`) — a directional cue, not a flashy transition, since
 * attention is on the stove. Reduced motion collapses it to an instant cut.
 */

import { useEffect, useRef, type JSX } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, useColorScheme } from 'react-native';
import { getColors, motion, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface StepViewProps {
  readonly instruction: string;
  /** Changes whenever the visible step changes, to retrigger the slide. */
  readonly stepKey: string;
  readonly reduceMotionEnabled: boolean;
}

export function StepView(props: StepViewProps): JSX.Element {
  const { instruction, stepKey, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(reduceMotionEnabled ? 0 : 16);

    const duration = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.bezier(...motion.easingStandard),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.bezier(...motion.easingStandard),
        useNativeDriver: true,
      }),
    ]).start();
    // stepKey intentionally drives this effect; instruction always changes alongside it.
  }, [stepKey, opacity, translateY, reduceMotionEnabled]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Animated.Text
        style={[
          typeScale.bodyLarge,
          styles.instruction,
          { color: colors.textPrimary, opacity, transform: [{ translateY }] },
        ]}
        accessibilityRole="text"
      >
        {instruction}
      </Animated.Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.space4,
    flexGrow: 1,
    justifyContent: 'center',
  },
  instruction: {
    textAlign: 'left',
  },
});

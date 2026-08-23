/**
 * Cook Mode's per-step countdown timer: `timerDisplay` (monospace,
 * tabular-nums, so digits never jitter the layout) plus a large circular
 * Start/Pause button. On reaching zero the display pulses once via
 * opacity (never scale — scale would jitter the digits) and fires a
 * success haptic; it never auto-advances the step, the cook confirms by
 * tapping "Volgende" themselves.
 */

import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Animated, PixelRatio, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface TimerDisplayProps {
  readonly durationMinutes: number;
  readonly reduceMotionEnabled: boolean;
}

const CIRCLE_SIZE = 56;
const TICK_MS = 1000;

export function TimerDisplay(props: TimerDisplayProps): JSX.Element {
  const { durationMinutes, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.round(durationMinutes * 60));
  const [isRunning, setIsRunning] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const hasPulsedForZero = useRef(false);
  // A5 (documented in tokens.ts alongside the Dynamic Type rules): the
  // "▶"/"❚❚" glyph is allowed to keep scaling with Dynamic Type (never
  // capped via maxFontSizeMultiplier, per docs/DESIGN.md and cook mode's
  // 200%-survival requirement) — instead the circle it sits inside grows
  // to match, so the glyph never bleeds past a fixed 56pt hit target.
  const circleSize = CIRCLE_SIZE * PixelRatio.getFontScale();

  useEffect(() => {
    setRemainingSeconds(Math.round(durationMinutes * 60));
    setIsRunning(false);
    hasPulsedForZero.current = false;
  }, [durationMinutes]);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) {
      return undefined;
    }
    const interval = setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isRunning, remainingSeconds]);

  useEffect(() => {
    if (remainingSeconds !== 0 || hasPulsedForZero.current) {
      return;
    }
    hasPulsedForZero.current = true;
    setIsRunning(false);

    const duration = resolveDuration(motion.durationSlow, reduceMotionEnabled);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      // Haptics unsupported on this device/simulator — the visual pulse still lands.
    });
    // A4: haptics can be (and often are) disabled system-wide, and the
    // opacity pulse is silent to a screen reader — without this, a blind
    // user has no signal the timer finished at all.
    AccessibilityInfo.announceForAccessibility('Timer klaar');
  }, [remainingSeconds, pulse, reduceMotionEnabled]);

  const toggleRunning = (): void => {
    if (remainingSeconds === 0) {
      return;
    }
    setIsRunning((current) => !current);
  };

  const isComplete = remainingSeconds === 0;
  const formatted = formatClock(remainingSeconds);

  return (
    <View style={styles.container}>
      <Animated.Text
        style={[typeScale.timerDisplay, { color: isComplete ? colors.positive : colors.textPrimary, opacity: pulse }]}
        accessibilityLabel={`Timer, ${formatted} resterend`}
      >
        {formatted}
      </Animated.Text>
      <Pressable
        onPress={toggleRunning}
        disabled={isComplete}
        accessibilityRole="button"
        accessibilityLabel={isRunning ? 'Pauzeer timer' : 'Start timer'}
        accessibilityState={{ disabled: isComplete }}
        style={[
          styles.circleButton,
          { width: circleSize, height: circleSize, backgroundColor: isComplete ? colors.positive : colors.accent },
        ]}
      >
        <Text style={[typeScale.title2, { color: isComplete ? colors.onPositive : colors.onAccent }]}>
          {isRunning ? '❚❚' : '▶'}
        </Text>
      </Pressable>
    </View>
  );
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space5,
    marginTop: spacing.space6,
  },
  circleButton: {
    // width/height are set inline per-render, scaled by
    // PixelRatio.getFontScale() — see the A5 comment above.
    borderRadius: radii.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

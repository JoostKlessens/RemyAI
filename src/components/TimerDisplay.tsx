/**
 * Cook Mode's per-step countdown timer: `timerDisplay` (monospace,
 * tabular-nums, so digits never jitter the layout) plus a large circular
 * Start/Pause button. On reaching zero the display pulses once via
 * opacity (never scale — scale would jitter the digits) and fires a
 * success haptic; it never auto-advances the step, the cook confirms by
 * tapping "Volgende" themselves.
 *
 * This component owns no time. It is *controlled*: the countdown lives
 * in `@/domain/cookTimer` as a deadline, and the screen holds one such
 * state per step id. Two bugs made that necessary. The timer used to
 * decrement a counter inside `setInterval`, so a backgrounded phone
 * silently stopped the clock and handed the cook back minutes they had
 * already spent. And the state lived here, in a component mounted as a
 * sibling of the current step — so reading one step ahead unmounted the
 * timer and threw a running simmer away. Both are properties of *where
 * the state lived*, which is why the fix moved it rather than patching
 * it in place.
 *
 * The interval below is therefore a rendering concern and nothing more:
 * it re-asks "what time is it" once a second, and missing a hundred of
 * those ticks changes no answer. `AppState` snaps the clock forward the
 * instant the app returns to the foreground, so a cook who unlocks their
 * phone sees the truth on that frame rather than up to a second later.
 */

import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import { hapticCompleted, hapticSmallCommit } from '@/lib/haptics';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import {
  formatCookTimer,
  isCookTimerFinished,
  pauseCookTimer,
  remainingSecondsAt,
  startCookTimer,
  type CookTimerState,
} from '@/domain/cookTimer';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface TimerDisplayProps {
  readonly state: CookTimerState;
  readonly onChangeState: (next: CookTimerState) => void;
  readonly reduceMotionEnabled: boolean;
}

const CIRCLE_SIZE = 56;
const TICK_MS = 1000;

export function TimerDisplay(props: TimerDisplayProps): JSX.Element {
  const { state, onChangeState, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [nowMs, setNowMs] = useState(() => Date.now());
  const pulse = useRef(new Animated.Value(1)).current;
  const hasPulsedForZero = useRef(false);
  // A5 (documented in tokens.ts alongside the Dynamic Type rules): the
  // "▶"/"❚❚" glyph is allowed to keep scaling with Dynamic Type (never
  // capped via maxFontSizeMultiplier, per docs/DESIGN.md and cook mode's
  // 200%-survival requirement) — instead the circle it sits inside grows
  // to match, so the glyph never bleeds past a fixed 56pt hit target.
  const circleSize = CIRCLE_SIZE * PixelRatio.getFontScale();

  const isComplete = isCookTimerFinished(state, nowMs);
  const isRunning = state.status === 'running';

  useEffect(() => {
    if (!isRunning || isComplete) {
      return undefined;
    }
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [isRunning, isComplete]);

  // Background timers are throttled, or suspended outright, so the
  // interval above cannot be trusted to have kept pace while the phone
  // was locked. Re-reading the clock on foreground is what turns
  // "eventually correct" into "correct on the frame the cook looks at".
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setNowMs(Date.now());
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isComplete) {
      // Reset rather than latch, so a restarted timer can announce again.
      hasPulsedForZero.current = false;
      return;
    }
    if (hasPulsedForZero.current) {
      return;
    }
    hasPulsedForZero.current = true;

    const duration = resolveDuration(motion.durationSlow, reduceMotionEnabled);
    Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();

    hapticCompleted();
    // A4: haptics can be (and often are) disabled system-wide, and the
    // opacity pulse is silent to a screen reader — without this, a blind
    // user has no signal the timer finished at all.
    AccessibilityInfo.announceForAccessibility('Timer klaar');
  }, [isComplete, pulse, reduceMotionEnabled]);

  const toggleRunning = (): void => {
    if (isComplete) {
      return;
    }
    if (!isRunning) {
      // WS5 §3.2 lists "a cook timer is started" and does NOT list pausing
      // it, and the asymmetry is the point rather than an omission: a
      // started timer is a small commitment that will come back and
      // interrupt you, while pausing is taking something back. The same
      // reasoning keeps `Niet koken` and every close control silent
      // (§3.3) — undoing must never feel like a penalty for having
      // started.
      hapticSmallCommit();
    }
    const now = Date.now();
    setNowMs(now);
    onChangeState(isRunning ? pauseCookTimer(state, now) : startCookTimer(state, now));
  };

  const formatted = formatCookTimer(remainingSecondsAt(state, nowMs));

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

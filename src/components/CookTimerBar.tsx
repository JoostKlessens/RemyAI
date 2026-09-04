/**
 * THE PERSISTENT TIMER BAR IN COOK MODE (WS5 §4.3.2, GAP-22).
 *
 * WHAT IT IS FOR, IN ONE SENTENCE: it is the reason reading ahead is safe.
 * Cook mode's timers were hoisted onto the screen so a simmer survives
 * paging between steps, but `TimerDisplay` only renders for the step you
 * are looking at — so a running clock on step 2 vanished the moment you
 * paged to step 3, and, because the finish haptic and the "Timer klaar"
 * announcement live inside that component, it also went silent. Half of a
 * repair shipped; this is the half that makes the other half visible.
 *
 * WHICH TIMER IT SHOWS IS NOT DECIDED HERE. `selectCookTimerBar`
 * (src/domain/cookTimerBar.ts) answers that, and answers it purely, so the
 * rule is provable in a test rather than trusted to a component the test
 * runner cannot import. This file renders what it is handed and owns two
 * things that genuinely are its own: the once-a-second tick, and the
 * completion nobody else is left to report.
 *
 * IT ADVANCES NOTHING. Tapping it goes back to the step the timer belongs
 * to, and that is the whole interaction. A control that could also stop,
 * restart or skip would be a second timer UI competing with `TimerDisplay`
 * for the same state — and the one thing a cook must be able to rely on is
 * that the clock they set is the clock that is running.
 *
 * FIXED HEIGHT, ALWAYS. docs/DESIGN.md §6 gives cook mode exactly one
 * region allowed to grow and scroll at 200% Dynamic Type — the instruction
 * — and WS5 §4.6 spends three requirements protecting that contract after
 * its own prototype broke it. A bar that grew with its content would eat
 * the instruction area from below on precisely the screen where the text
 * has to stay readable at 60-70 cm. So the row keeps its height and the
 * labels truncate instead, which is the one place in this app where
 * truncation is the right answer: "stap 2" is two words long.
 *
 * NO ENTRANCE ANIMATION ON THE NUMBERS, and only opacity on the bar. WS5
 * §1.3 forbids anything on a timer the user did not start; the countdown
 * changing once a second is not an event, it is a clock. The one moment
 * that IS an event — the deadline passing — gets the opacity pulse and the
 * colour swap, and nothing else in this component ever moves.
 *
 * IT FADES IN AND DOES NOT FADE OUT, and that asymmetry is deliberate
 * rather than unfinished. A bar appearing is news — a timer you started is
 * now running somewhere you cannot see. A bar leaving is not: it leaves
 * because you paged back to the step it belonged to, at which point the
 * full-size `TimerDisplay` is right there showing the same clock, and a
 * quarter-second of ghost bar underneath it is two timers on one screen
 * for no reason. So the caller unmounts this outright, which also lets the
 * row it sits in collapse to nothing when there is no timer to report.
 */

import { useEffect, useRef, type JSX } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
} from 'react-native';
import { formatCookTimer } from '@/domain/cookTimer';
import type { CookTimerBarModel } from '@/domain/cookTimerBar';
import { hapticCompleted, hapticValueMoved } from '@/lib/haptics';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface CookTimerBarProps {
  /** Null when no timer is running on another step — nothing renders at all. */
  readonly model: CookTimerBarModel | null;
  /** Takes the cook back to `model.stepIndex`. The only thing tapping this bar may do. */
  readonly onReturnToStep: (stepIndex: number) => void;
  readonly reduceMotionEnabled: boolean;
  /** Re-asks the clock. The screen owns `now`, so one answer serves the bar and every other reader of it. */
  readonly onTick: () => void;
}

/** Three, per WS5 §4.3.2. Enough to be unmissable across a kitchen, few enough not to read as an error state. */
const PULSE_COUNT = 3;
const TICK_MS = 1000;

export function CookTimerBar(props: CookTimerBarProps): JSX.Element | null {
  const { model, onReturnToStep, reduceMotionEnabled, onTick } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const pulse = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  /**
   * Which step's completion has already been announced. Keyed on the step
   * rather than being a plain boolean, because the bar can hand over from
   * one finished timer to the next without ever unmounting — a boolean
   * would latch on the first and swallow the second, which is the cook
   * missing a pan. This is `SendRecipeSheet`'s `hasCommitted` guard, in the
   * one shape that survives the value it is guarding changing.
   */
  const announcedStepId = useRef<string | null>(null);

  const isFinished = model?.finished ?? false;
  const stepId = model?.stepId ?? null;
  const stepNumber = model?.stepNumber ?? null;
  const isVisible = model !== null;

  // One interval for the bar's own clock, and it is not duplicating
  // `TimerDisplay`'s: that one is mounted only for the current step's
  // timer, and the entire premise of this component is a timer on a step
  // nobody is looking at — so on the screens where this bar matters, there
  // is no other interval running at all. It stops once finished, because
  // there is nothing left to recount.
  useEffect(() => {
    if (!isVisible || isFinished) {
      return undefined;
    }
    const interval = setInterval(onTick, TICK_MS);
    return () => clearInterval(interval);
  }, [isVisible, isFinished, onTick]);

  // Background timers are throttled or suspended outright, so the interval
  // above cannot be trusted to have kept pace while the phone was locked —
  // the same reasoning, and the same fix, as TimerDisplay's. It matters
  // more here: a cook who put the phone down for the whole of a simmer
  // should come back to a bar that is already green, not to one that has
  // to catch up first.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        onTick();
      }
    });
    return () => subscription.remove();
  }, [onTick]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    Animated.timing(entrance, {
      toValue: 1,
      duration: resolveDuration(motion.durationNormal, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingDecelerate),
      useNativeDriver: true,
    }).start();
  }, [isVisible, entrance, reduceMotionEnabled]);

  useEffect(() => {
    if (!isFinished || stepId === null) {
      // Reset rather than latch, so a restarted timer on the same step can
      // announce again — TimerDisplay's own guard works the same way.
      announcedStepId.current = null;
      return;
    }
    if (announcedStepId.current === stepId) {
      return;
    }
    announcedStepId.current = stepId;

    // THIS is the silence GAP-22 names. When a finished timer belongs to
    // the current step, TimerDisplay says all three of these things; when
    // it belongs to a step the cook paged away from, TimerDisplay is not
    // mounted and nothing said any of them. Same three signals, from the
    // component that is actually on screen.
    const duration = resolveDuration(motion.durationFast, reduceMotionEnabled);
    Animated.sequence(
      Array.from({ length: PULSE_COUNT }).flatMap(() => [
        Animated.timing(pulse, { toValue: 0.4, duration, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: true }),
      ]),
    ).start();
    hapticCompleted();
    // Opacity is silent to a screen reader and a haptic can be off
    // system-wide, so the spoken half is not optional. It names the step,
    // unlike TimerDisplay's bare "Timer klaar", because the whole premise
    // here is that the timer belongs somewhere the cook is not looking.
    AccessibilityInfo.announceForAccessibility(`Timer klaar voor stap ${stepNumber ?? ''}`.trim());
  }, [isFinished, stepId, stepNumber, pulse, reduceMotionEnabled]);

  if (model === null) {
    return null;
  }

  const formatted = formatCookTimer(model.remainingSeconds);
  const fill = model.finished ? colors.positiveMuted : colors.accentMuted;
  // The app's existing running-versus-completed distinction, not a new
  // one: `accentOnMuted` on `accentMuted` and `positive` on
  // `positiveMuted` are both already asserted in tests/contrast.test.ts,
  // so this bar introduces no unverified colour pairing.
  const ink = model.finished ? colors.positive : colors.accentOnMuted;

  return (
    <Animated.View style={{ opacity: Animated.multiply(entrance, pulse) }}>
      <Pressable
        onPress={() => {
          // WS5 §3.2: "the persistent timer bar is tapped back to its
          // step" — a value moved, and reversible in the plainest sense,
          // since the step you came from is one tap away in the nav row.
          hapticValueMoved();
          onReturnToStep(model.stepIndex);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          model.finished
            ? `Timer klaar voor stap ${model.stepNumber}. Ga terug naar die stap.`
            : `Timer loopt op stap ${model.stepNumber}, ${formatted} resterend. Ga terug naar die stap.`
        }
        style={[styles.bar, { backgroundColor: fill }]}
      >
        {/* Mono with tabular-nums, so the row does not twitch as the digits
            change — the same reason the full-size timer is set that way. */}
        <Text style={[typeScale.numeral, { color: ink }]} numberOfLines={1}>
          {formatted}
        </Text>
        {/* A timer with no referent is an alarm, not information: this
            label is what makes the number mean something. Truncates rather
            than wraps — see the file header on why this row's height is
            fixed. */}
        <Text style={[typeScale.caption, { color: ink }]} numberOfLines={1}>
          stap {model.stepNumber}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space3,
    paddingHorizontal: spacing.space4,
    // Exactly the app's minimum touch target and not a pixel more: this
    // strip is spent out of the instruction area's budget, on the one
    // screen docs/DESIGN.md §6 protects by name.
    height: spacing.touchTargetMin,
    borderRadius: radii.radiusSm,
  },
});

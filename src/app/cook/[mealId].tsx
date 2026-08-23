/**
 * Cook Mode — one step per screen, hands-off and glanceable. See
 * docs/DESIGN.md §4. Screen-awake is enabled for the lifetime of this
 * screen via `useKeepAwake()` (mount/unmount-scoped by the hook itself).
 *
 * PD-003's first earned outcome surface lives here: tapping "Klaar" on the
 * final step transitions in place to the `OutcomeCard` ("Gemaakt?") —
 * there is no separate outcome route, Cook Mode's own terminus *is* the
 * surface.
 *
 * Only `meal-1` (Kip kerrie met rijst) has step fixtures in
 * src/app/_fixtures.ts; any other mealId falls back to a deliberate empty
 * state rather than a crash or a blank screen.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { AccessibilityInfo, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMealById, getMealStepsById } from '@/app/_fixtures';
import { Button } from '@/components/Button';
import { OutcomeCard } from '@/components/OutcomeCard';
import { ProgressRule } from '@/components/ProgressRule';
import { StepView } from '@/components/StepView';
import { TimerDisplay } from '@/components/TimerDisplay';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getColors, spacing, typeScale } from '@/theme/tokens';

type CookPhase = 'steps' | 'outcome';

/**
 * docs/DESIGN.md §4: "Vorige (secondary) and Volgende (primary, accent)
 * full-width, inside the thumb zone, minimum 56pt tall — larger than the
 * base touchTargetMin, deliberately." No token in src/theme/tokens.ts
 * covers this specific measurement, so it is named here rather than left
 * as an inline magic number.
 */
const NAV_BUTTON_MIN_HEIGHT = 56;

export default function CookModeScreen(): JSX.Element {
  useKeepAwake();
  const router = useRouter();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();

  const meal = getMealById(mealId ?? '');
  const steps = getMealStepsById(mealId ?? '');
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<CookPhase>('steps');
  const currentStep = steps[stepIndex];

  // A1: announce each step change for screen-reader users. Placed before
  // any conditional return so hook order stays stable across renders
  // regardless of `steps.length` (Rules of Hooks) — the no-fixtures and
  // no-current-step cases are guarded internally instead.
  useEffect(() => {
    if (phase !== 'steps' || currentStep === undefined) {
      return;
    }
    AccessibilityInfo.announceForAccessibility(
      `Stap ${stepIndex + 1} van ${steps.length}: ${currentStep.instruction}`,
    );
  }, [stepIndex, phase, currentStep, steps.length]);

  if (steps.length === 0) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>
            Geen bereidingsstappen beschikbaar
          </Text>
          <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
            Deze demo bevat alleen stappen voor Kip kerrie met rijst.
          </Text>
          <Button
            label="Terug"
            variant="secondary"
            onPress={() => router.back()}
            accessibilityLabel="Terug naar Vanavond"
          />
        </View>
      </SafeAreaView>
    );
  }

  const isLastStep = stepIndex === steps.length - 1;
  const dishTitle = meal?.title ?? 'dit gerecht';

  const handleNext = (): void => {
    if (isLastStep) {
      setPhase('outcome');
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const handlePrevious = (): void => {
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  if (phase === 'outcome') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.outcomeWrap}>
          <OutcomeCard
            dishTitle={dishTitle}
            onCooked={() => {
              // Real app: INSERT cook_events { decisionId, mealId, cookedOn, wouldRepeat: null }.
            }}
            onRepeatAnswer={() => {
              // Real app: UPDATE the new cook_events row's would_repeat.
            }}
            onDismiss={() => router.back()}
            reduceMotionEnabled={reduceMotionEnabled}
          />
        </View>
      </SafeAreaView>
    );
  }

  // T3: stepIndex is clamped to [0, steps.length - 1] by handleNext/
  // handlePrevious above, so this should be unreachable at runtime — but
  // an explicit check (matching the steps.length === 0 empty-state
  // pattern earlier in this file) keeps the file free of a `!` assertion
  // on an array index the compiler can't otherwise prove non-empty.
  if (currentStep === undefined) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>Geen stap gevonden</Text>
          <Button
            label="Terug"
            variant="secondary"
            onPress={() => router.back()}
            accessibilityLabel="Terug naar Vanavond"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.progressBlock}>
        <Text style={[typeScale.numeral, styles.stepCounter, { color: colors.textMuted }]}>
          Stap {stepIndex + 1} / {steps.length}
        </Text>
        <ProgressRule
          progress={(stepIndex + 1) / steps.length}
          accessibilityLabel={`Stap ${stepIndex + 1} van ${steps.length}`}
        />
      </View>

      <View style={styles.stepBlock}>
        <StepView
          instruction={currentStep.instruction}
          stepKey={currentStep.id}
          reduceMotionEnabled={reduceMotionEnabled}
        />
        {currentStep.durationMinutes !== null ? (
          <TimerDisplay durationMinutes={currentStep.durationMinutes} reduceMotionEnabled={reduceMotionEnabled} />
        ) : null}
      </View>

      <View style={styles.navRow}>
        <View style={styles.navButton}>
          <Button
            label="Vorige"
            variant="secondary"
            onPress={handlePrevious}
            disabled={stepIndex === 0}
            minHeight={NAV_BUTTON_MIN_HEIGHT}
            accessibilityLabel="Vorige stap"
          />
        </View>
        <View style={styles.navButton}>
          <Button
            label={isLastStep ? 'Klaar' : 'Volgende'}
            variant={isLastStep ? 'positive' : 'primary'}
            onPress={handleNext}
            minHeight={NAV_BUTTON_MIN_HEIGHT}
            accessibilityLabel={isLastStep ? 'Klaar met koken' : 'Volgende stap'}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.space4,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
  },
  outcomeWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  progressBlock: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
  },
  stepCounter: {
    marginBottom: spacing.space2,
  },
  stepBlock: {
    flex: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.space3,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.space6,
    paddingTop: spacing.space3,
  },
  navButton: {
    flex: 1,
  },
});

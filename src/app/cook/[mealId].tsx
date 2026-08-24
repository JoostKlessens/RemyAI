/**
 * Cook Mode — one step per screen, hands-off and glanceable. See
 * docs/DESIGN.md §4. Screen-awake is enabled for the lifetime of this
 * screen via `useKeepAwake()` (mount/unmount-scoped by the hook itself).
 *
 * PD-003's first earned outcome surface lives here: tapping "Klaar" on the
 * final step transitions in place to the `OutcomeCard` ("Gemaakt?") —
 * there is no separate outcome route, Cook Mode's own terminus *is* the
 * surface. "Gemaakt?" -> "Ja" writes a real cook_events row through
 * RemyRepository; "Nog een keer?" fills in that row's wouldRepeat.
 *
 * Meal + steps load from RemyRepository, not fixtures — a meal with no
 * steps (a title-only seeded meal, or an imported recipe whose caption had
 * no clear step breakdown) is a real, common case now, not just a demo
 * limitation, so the empty state below describes it honestly.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { AccessibilityInfo, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { OutcomeCard } from '@/components/OutcomeCard';
import { ProgressRule } from '@/components/ProgressRule';
import { StepView } from '@/components/StepView';
import { TimerDisplay } from '@/components/TimerDisplay';
import type { CookEventId, DecisionId, HouseholdId, Meal, MealStep } from '@/domain/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { ensureSeeded, getAppRepository, todayIso } from '@/lib/repository';
import { getColors, spacing, typeScale } from '@/theme/tokens';

type CookPhase = 'steps' | 'outcome';
type LoadState = 'loading' | 'ready' | 'error';

/**
 * docs/DESIGN.md §4: "Vorige (secondary) and Volgende (primary, accent)
 * full-width, inside the thumb zone, minimum 56pt tall — larger than the
 * base touchTargetMin, deliberately." No token in src/theme/tokens.ts
 * covers this specific measurement, so it is named here rather than left
 * as an inline magic number.
 */
const NAV_BUTTON_MIN_HEIGHT = 56;

interface LoadedMealData {
  readonly meal: Meal | null;
  readonly steps: readonly MealStep[];
  readonly householdId: HouseholdId;
  /** Set only when today's decision (if any) offers exactly this meal — links a cook event back to the decision that led to it. */
  readonly decisionId: DecisionId | null;
}

async function loadMealData(mealId: string): Promise<LoadedMealData> {
  await ensureSeeded();
  const repository = getAppRepository();
  const [meal, steps, householdId] = await Promise.all([
    repository.getMeal(mealId),
    repository.getMealSteps(mealId),
    repository.getCurrentHouseholdId(),
  ]);
  const todaysDecision = await repository.getDecisionByDate(householdId, todayIso());
  const decisionId = todaysDecision !== null && todaysDecision.mealId === mealId ? todaysDecision.id : null;
  return { meal, steps, householdId, decisionId };
}

export default function CookModeScreen(): JSX.Element {
  useKeepAwake();
  const router = useRouter();
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [meal, setMeal] = useState<Meal | null>(null);
  const [steps, setSteps] = useState<readonly MealStep[]>([]);
  const [householdId, setHouseholdId] = useState<HouseholdId | null>(null);
  const [decisionId, setDecisionId] = useState<DecisionId | null>(null);
  const [cookEventId, setCookEventId] = useState<CookEventId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<CookPhase>('steps');
  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (mealId === undefined) {
      setLoadState('ready');
      return;
    }
    let cancelled = false;
    loadMealData(mealId)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setMeal(data.meal);
        setSteps(data.steps);
        setHouseholdId(data.householdId);
        setDecisionId(data.decisionId);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mealId]);

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

  const handleCooked = (cooked: boolean): void => {
    if (!cooked || householdId === null || meal === null) {
      return;
    }
    getAppRepository()
      .createCookEvent({ householdId, mealId: meal.id, decisionId, cookedOn: todayIso() })
      .then((cookEvent) => setCookEventId(cookEvent.id))
      .catch(() => {
        // See src/app/(tabs)/index.tsx's handleAccept comment: a failed
        // local write here isn't worth blocking the "Gemaakt!" moment for.
      });
  };

  const handleRepeat = (wouldRepeat: boolean): void => {
    if (cookEventId === null) {
      return;
    }
    void getAppRepository().setCookEventRepeat(cookEventId, wouldRepeat);
  };

  if (loadState === 'loading') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Laden…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === 'error') {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>
            Kon dit recept niet laden
          </Text>
          <Button label="Terug" variant="secondary" onPress={() => router.back()} accessibilityLabel="Terug naar Kiezen" />
        </View>
      </SafeAreaView>
    );
  }

  if (steps.length === 0) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[typeScale.title2, styles.emptyTitle, { color: colors.textPrimary }]}>
            Geen bereidingsstappen beschikbaar
          </Text>
          <Text style={[typeScale.bodySmall, styles.emptyBody, { color: colors.textMuted }]}>
            Voor dit gerecht zijn nog geen bereidingsstappen genoteerd.
          </Text>
          <Button
            label="Terug"
            variant="secondary"
            onPress={() => router.back()}
            accessibilityLabel="Terug naar Kiezen"
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
            onCooked={handleCooked}
            onRepeatAnswer={handleRepeat}
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
            accessibilityLabel="Terug naar Kiezen"
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

/**
 * Cook Mode — one step per screen, hands-off and glanceable. See
 * docs/DESIGN.md §4. Screen-awake is enabled for the lifetime of this
 * screen via `useKeepAwake()` (mount/unmount-scoped by the hook itself).
 *
 * PD-003's first earned outcome surface lives here: tapping "Klaar" on the
 * final step transitions in place to the `OutcomeCard` ("Gemaakt?") —
 * there is no separate outcome route, Cook Mode's own terminus *is* the
 * surface. "Gemaakt?" -> "Ja" writes a real cook_events row through
 * RemyRepository; the optional score that follows ("Hoe was het?") fills
 * in that row's `rating`, and the repository re-derives `wouldRepeat`
 * from it. Leaving without a score is a complete answer — nothing is
 * written, and nothing asks again.
 *
 * Meal + steps load from RemyRepository, not fixtures — a meal with no
 * steps (a title-only seeded meal, or an imported recipe whose caption had
 * no clear step breakdown) is a real, common case now, not just a demo
 * limitation, so the empty state below describes it honestly.
 *
 * That same outcome card is DESIGN-SOCIAL.md §3.1's first entry point into
 * Sturen, and this screen is one of its two hosts (Kiezen's overlay is the
 * other). It owns none of the work: `useOutcomeSend` holds the state and
 * `src/lib/sendRecipe.ts` makes the two repository calls, because a route
 * module cannot be imported by the test suite and wiring nothing can
 * assert on is exactly how §3.1's button spent a whole phase rendering
 * nowhere. Sending is NOT conditional on the cook event this screen just
 * wrote (PD-016) — proof is the tier you earn by cooking; a send is not.
 */

import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { AccessibilityInfo, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { OutcomeCard } from '@/components/OutcomeCard';
import { ProgressRule } from '@/components/ProgressRule';
import { SendRecipeSheet } from '@/components/SendRecipeSheet';
import { StepView } from '@/components/StepView';
import { TimerDisplay } from '@/components/TimerDisplay';
import type { CookEventId, DecisionId, HouseholdId, Meal, MealStep } from '@/domain/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { ensureSeeded, getAppRepository, todayIso } from '@/lib/repository';
import { useOutcomeSend } from '@/lib/useOutcomeSend';
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

  /**
   * DESIGN-SOCIAL.md §3.1's first entry point, on Cook Mode's own terminus
   * — the `Stuur door` the outcome card has always been able to draw and
   * has never been handed a handler for. Every repository call behind it
   * lives in src/lib/useOutcomeSend.ts and src/lib/sendRecipe.ts, for the
   * reason this file cannot host them: a route module is unimportable in
   * the test environment, so wiring written here is wiring nothing can
   * assert on — which is how the prop stayed unpassed for a whole phase.
   *
   * Called above every early return below (Rules of Hooks), and passed
   * null until the outcome phase so the friend read does not fire while
   * somebody is still on step 3 of 7. The meal's OWN id, not the route
   * param: a send names this household's `meals` row, and if the row did
   * not load there is nothing to send.
   *
   * NOT GATED ON THE COOK EVENT, deliberately (PD-016). The write above
   * may have failed and the affordance is offered regardless — a send is
   * "ik moest aan jou denken", not a reward for having finished.
   */
  const outcomeSend = useOutcomeSend(phase === 'outcome' ? (meal?.id ?? null) : null);

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

  /**
   * Fires only when a score was actually given — closing the card unrated
   * reports nothing, which is a legitimate end to the flow rather than an
   * abandoned one. The projection onto `wouldRepeat` happens inside the
   * repository, never here.
   */
  const handleRate = (rating: number): void => {
    if (cookEventId === null) {
      return;
    }
    void getAppRepository().setCookEventRating(cookEventId, rating);
  };

  /**
   * The public half of the same moment (`Meal.dishMoods`). Deliberately
   * gated on the MEAL rather than on `cookEventId`, unlike `handleRate`
   * directly above: a mood describes the dish, not this particular cook,
   * so it stays recordable even when the cook-event write failed — and it
   * lands on a different row, which is what keeps PD-019's two
   * instruments structurally apart rather than merely separate by
   * convention. Nothing here reads the grade.
   */
  const handleChooseMood = (mood: string): void => {
    if (meal === null) {
      return;
    }
    void getAppRepository().addMealDishMood(meal.id, mood);
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
            onRate={handleRate}
            onChooseMood={handleChooseMood}
            onSendRecipe={outcomeSend.onSendRecipe}
            onDismiss={() => router.back()}
            reduceMotionEnabled={reduceMotionEnabled}
          />
        </View>
        {/* Its own `Modal`, so it sits over the card rather than pushing
            it — and mounted unconditionally with `visible`, because the
            sheet owns its entry animation and a conditional mount would
            replay it from scratch on every render of this branch. */}
        <SendRecipeSheet
          visible={outcomeSend.sheetVisible}
          dishTitle={dishTitle}
          friends={outcomeSend.friends}
          note={outcomeSend.note}
          onChangeNote={outcomeSend.onChangeNote}
          onSend={outcomeSend.onSend}
          onRetryFriends={outcomeSend.onRetryFriends}
          onDismiss={outcomeSend.onDismiss}
          reduceMotionEnabled={reduceMotionEnabled}
        />
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

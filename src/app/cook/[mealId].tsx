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
 * RCP-01's portion panel hangs off this screen too, and deliberately NOT
 * as a phase. `CookPhase` stays `steps | outcome`: the ingredient list is
 * a reference surface a cook consults and dismisses, not a sixth thing to
 * walk through, and putting it in the union would either make "Stap 3 / 7"
 * lie or force a second counter beside it. It opens as a `Modal`
 * (`PortionScalingSheet`), from a control at the foot of the step block
 * rather than from the progress header — docs/DESIGN.md's one header rule
 * is "a name, then exactly one control of the screen's own", and this
 * screen already spends that one on `Stoppen`. The arithmetic is
 * src/domain/scaleRecipe.ts's, finished and tested; the Dutch is
 * src/components/portionScalingCopy.ts's, for the same reason the send
 * wiring lives in useOutcomeSend — a route module cannot be imported by
 * the test suite, so nothing written in this file can be asserted on.
 *
 * WHERE THE TWO SERVING COUNTS COME FROM. The baseline is `Meal.servings`,
 * already loaded here and, until now, read by nothing. The target is the
 * household's member count from `listMembers` — settings.tsx labels
 * exactly that number "Aantal eters", so this is not a new interpretation
 * of what a member is, it is the one the product already ships. There is
 * deliberately no portions input on this screen: scaleRecipe.ts's header
 * opens by saying the household "already told Remy once", and a text field
 * here would ask them again in the least convenient place in the app, with
 * wet hands.
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

import type { JSX } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { AccessibilityInfo, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { OutcomeCard } from '@/components/OutcomeCard';
import { PortionScalingSheet } from '@/components/PortionScalingSheet';
import {
  describePortionTriggerAccessibilityLabel,
  describePortionTriggerLabel,
} from '@/components/portionScalingCopy';
import { ProgressRule } from '@/components/ProgressRule';
import { SendRecipeSheet } from '@/components/SendRecipeSheet';
import { StepView } from '@/components/StepView';
import { TimerDisplay } from '@/components/TimerDisplay';
import { createCookTimer, type CookTimerState } from '@/domain/cookTimer';
import { scaleRecipe } from '@/domain/scaleRecipe';
import type { CookEventId, DecisionId, HouseholdId, Meal, MealIngredient, MealStep } from '@/domain/types';
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
  /**
   * RCP-01's input. Held as `MealIngredient` rather than converted to
   * `RawIngredientLine` on the way in, because no conversion is needed:
   * shopping/types.ts's `RawIngredientLine` doc comment says in as many
   * words that `MealIngredient` "already satisfies `RawIngredientLine`
   * with zero adapter code" and that a caller holding one "can pass either
   * straight through". src/app/boodschappen.tsx:132 does have a
   * `toRawIngredientLine` mapper, but it lives in a route module (so it is
   * unreachable from here without importing a screen from a screen) and,
   * by that same doc comment, it is a copy this codebase never needed.
   * Writing a second one here would be the drift scaleRecipe.ts's header
   * warns about, in miniature.
   */
  readonly ingredients: readonly MealIngredient[];
  readonly householdId: HouseholdId;
  /**
   * RCP-01's target serving count: how many people eat in this household.
   * A COUNT, not a stored field — there is no `size` on `Household`
   * (src/domain/types.ts), and settings.tsx renders this very number under
   * the heading "Aantal eters". `Member` carries no active/inactive/
   * pending flag to filter on either: `authUserId: null` explicitly means
   * a partner or child profile without an account of their own, who very
   * much still eats, and `removeMember` is a real delete, so there is no
   * soft-deleted row left in the table to exclude. Zero is therefore a
   * reachable value (remove the last member) and is passed through to
   * `scaleRecipe` unaltered rather than floored to some default — it
   * returns `cannot_scale`, which is the honest answer, and the panel has
   * a state that says so and points at Instellingen.
   */
  readonly householdSize: number;
  /** Set only when today's decision (if any) offers exactly this meal — links a cook event back to the decision that led to it. */
  readonly decisionId: DecisionId | null;
}

/**
 * The two RCP-01 reads join the existing `Promise.all` rather than being
 * fetched separately and tolerated on failure. They are reads of the same
 * local repository, through the same path as `getMealSteps` two lines up;
 * a fault that loses the ingredient rows loses the steps too, and a Cook
 * Mode that rendered its steps while silently dropping the portion panel
 * would be a half-loaded screen with nothing on it admitting so. Widening
 * the existing "Kon dit recept niet laden" state is the honest behaviour,
 * and it is a state this screen already draws and already offers `Terug`
 * from.
 */
async function loadMealData(mealId: string): Promise<LoadedMealData> {
  await ensureSeeded();
  const repository = getAppRepository();
  const [meal, steps, ingredients, householdId] = await Promise.all([
    repository.getMeal(mealId),
    repository.getMealSteps(mealId),
    repository.getMealIngredients(mealId),
    repository.getCurrentHouseholdId(),
  ]);
  // Both of these need `householdId`, so they wait for the batch above and
  // then run together rather than one after the other.
  const [todaysDecision, members] = await Promise.all([
    repository.getDecisionByDate(householdId, todayIso()),
    repository.listMembers(householdId),
  ]);
  const decisionId = todaysDecision !== null && todaysDecision.mealId === mealId ? todaysDecision.id : null;
  return { meal, steps, ingredients, householdId, householdSize: members.length, decisionId };
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
  const [ingredients, setIngredients] = useState<readonly MealIngredient[]>([]);
  const [householdSize, setHouseholdSize] = useState(0);
  const [householdId, setHouseholdId] = useState<HouseholdId | null>(null);
  const [decisionId, setDecisionId] = useState<DecisionId | null>(null);
  const [cookEventId, setCookEventId] = useState<CookEventId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<CookPhase>('steps');
  /**
   * One timer per step id, held here rather than inside `TimerDisplay`,
   * because that component unmounts the moment the cook reads ahead —
   * which used to throw a running simmer away. Keyed by step id and not
   * by index so it survives any future reordering. Updated immutably;
   * a step the cook never started simply has no entry.
   */
  const [timers, setTimers] = useState<Readonly<Record<string, CookTimerState>>>({});
  /**
   * RCP-01's panel is closed until asked for. Local to the steps phase and
   * never persisted: a cook who checked the ingredients on step 2 has not
   * expressed a preference about step 3, and a panel that reopened itself
   * would cover the instruction they came back for.
   */
  const [portionSheetVisible, setPortionSheetVisible] = useState(false);
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
        setIngredients(data.ingredients);
        setHouseholdSize(data.householdSize);
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

  /**
   * RCP-01, computed once per change of its three inputs rather than on
   * every render. The memo is not a micro-optimisation for the arithmetic
   * — `scaleRecipe` is pure and cheap — it is because this component
   * re-renders once a second for the whole of a running step timer
   * (`timers` lives here, see above), and re-deriving a fresh
   * `ScaleRecipeResult` object each tick would hand `PortionScalingSheet` a
   * new `result` prop 60 times a minute for data that did not change.
   *
   * `ingredients` is passed straight in as `RawIngredientLine[]` — see
   * `LoadedMealData.ingredients` for why no adapter exists or should.
   * `meal?.servings ?? null` is not a fallback dressed as one: `null` is
   * precisely what `scaleRecipe` wants for "this recipe never said", and a
   * meal row that failed to load is exactly as unknown as a recipe with no
   * serving count. Both land on `no_baseline_servings`, which is true in
   * both cases.
   *
   * Called above every early return below, per the Rules of Hooks, for the
   * same reason the step announcement and `useOutcomeSend` are.
   */
  const scaleResult = useMemo(
    () => scaleRecipe(ingredients, meal?.servings ?? null, householdSize),
    [ingredients, meal?.servings, householdSize],
  );

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
        {/* This screen is `presentation: 'fullScreenModal'` (src/app/_layout.tsx),
            and an iOS full-screen modal has no swipe-to-dismiss. Until this
            row existed, every `router.back()` in this file sat in a branch a
            cook never reaches — the error state, the no-steps state and the
            outcome phase — so opening a recipe from a library tile trapped you
            in the steps until you walked all the way to the last one. Rendered
            unconditionally rather than behind a prop, because a control that
            depends on a caller passing something is exactly how OutcomeCard's
            `onSendRecipe` shipped to nobody (handover §7). A counter plus
            exactly one control of the screen's own is docs/DESIGN.md's header
            rule, so this row obeys it rather than inventing a second one. */}
        <View style={styles.progressHeader}>
          <Text style={[typeScale.numeral, { color: colors.textMuted }]}>
            Stap {stepIndex + 1} / {steps.length}
          </Text>
          <Button
            label="Stoppen"
            variant="secondary"
            onPress={() => router.back()}
            minHeight={spacing.touchTargetMin}
            accessibilityLabel="Stoppen met koken"
            accessibilityHint="Sluit de kookmodus. Er wordt niets opgeslagen."
          />
        </View>
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
          <TimerDisplay
            state={timers[currentStep.id] ?? createCookTimer(currentStep.durationMinutes)}
            onChangeState={(next) => setTimers((current) => ({ ...current, [currentStep.id]: next }))}
            reduceMotionEnabled={reduceMotionEnabled}
          />
        ) : null}
        {/* RCP-01's door. It sits at the foot of the step block and not in
            the progress header, because docs/DESIGN.md's one header rule
            allows "a name, then exactly one control of the screen's own"
            and `Stoppen` already is that one. `secondary`, not `primary`:
            the loudest control on a cooking screen is the one that moves
            you to the next step, and an ingredient list is a thing you
            glance at, not the reason you are here.

            RENDERED UNCONDITIONALLY, including when the recipe cannot be
            scaled at all. Hiding it in that case would hide the very
            sentence that explains why — and a control that appears and
            disappears based on data the cook cannot see is exactly the
            failure the progress header's own comment records about
            `onSendRecipe`. Its label carries the household count only when
            there honestly is one; `describePortionTriggerLabel` owns that
            branch. */}
        <View style={styles.portionRow}>
          <Button
            label={describePortionTriggerLabel(scaleResult)}
            variant="secondary"
            onPress={() => setPortionSheetVisible(true)}
            minHeight={spacing.touchTargetMin}
            accessibilityLabel={describePortionTriggerAccessibilityLabel(scaleResult)}
            accessibilityHint="Opent de ingrediënten van dit gerecht."
          />
        </View>
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

      {/* Mounted unconditionally with `visible`, exactly as the outcome
          phase mounts `SendRecipeSheet`: the sheet owns its entry
          animation, and a conditional mount would replay it from scratch
          on every render of this branch — which, with a step timer
          running, is once a second. */}
      <PortionScalingSheet
        visible={portionSheetVisible}
        result={scaleResult}
        recipeServings={meal?.servings ?? null}
        householdSize={householdSize}
        onDismiss={() => setPortionSheetVisible(false)}
        reduceMotionEnabled={reduceMotionEnabled}
      />
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
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.space3,
    marginBottom: spacing.space2,
  },
  stepBlock: {
    flex: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  portionRow: {
    // Sits between the instruction area (which is the only region allowed
    // to grow and scroll at 200% Dynamic Type — docs/DESIGN.md §6) and the
    // nav row, and keeps its own fixed height like the nav row does, so
    // the growing region stays exactly one.
    paddingTop: spacing.space3,
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

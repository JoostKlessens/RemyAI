/**
 * Vanavond — the hero screen. One dish, one stated reason, three actions.
 * No list, no scroll, no browse affordance: this is the entire product
 * thesis. See docs/DESIGN.md §2 and docs/PRODUCT-DECISIONS.md.
 *
 * `DecisionResult` (src/domain/types.ts) is a discriminated union; every
 * branch below is switched on `kind`/`reason` explicitly so a blank
 * screen here is structurally impossible, not just unlikely.
 *
 * A small `__DEV__`-only scenario row at the top lets every state
 * (normal swap flow, each `no_candidate` reason, network error) be
 * exercised on device without a backend — it never renders in production
 * builds and does not affect the centered hero layout below it. Only
 * `devScenario === 'normal'` drives the real pipeline below; every other
 * scenario still renders from the fixture data, exactly as before.
 *
 * The "normal" path: load this household's real data through
 * `RemyRepository`, call the pure `decide()` engine (src/domain/decide.ts)
 * to get today's suggestion, and persist a real `decisions` row for it —
 * mirroring what the scheduled Edge Function will do once it exists (see
 * docs/ARCHITECTURE.md). "Iets anders" re-runs `decide()` with a growing
 * `excludedMealIds` list and updates that same row's current offer.
 * Accept/decline write real decision responses; the outcome overlay
 * (PD-003) reads/writes real cook_events.
 *
 * Known, documented limitation: this app doesn't persist
 * `decision_alternatives` (the swap history table) — see the top-level
 * report. A reload mid-swap-session resets `alternativesRemaining` back to
 * 2 even if the household had already swapped once before closing the
 * app; the persisted decision's CURRENT offer (mealId/reasonCode/
 * reasonText) is still correct, only the swap COUNT resets.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fixtureDecisionSession,
  fixtureNoCandidateAllExcluded,
  fixtureNoCandidateEmptyRotation,
  fixtureNoCandidateSwapsExhausted,
} from '@/app/_fixtures';
import { Button } from '@/components/Button';
import { DecisionCard } from '@/components/DecisionCard';
import { DeclineReasonRow } from '@/components/DeclineReasonRow';
import { NoCandidateState } from '@/components/NoCandidateState';
import { OutcomeCard } from '@/components/OutcomeCard';
import { VanavondActionRow } from '@/components/VanavondActionRow';
import { decide } from '@/domain/decide';
import type {
  CookEventId,
  Decision,
  DeclineReason,
  DecisionRequest,
  DecisionResult,
  HouseholdId,
  Meal,
  MealId,
} from '@/domain/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { daysAgoIso, ensureSeeded, getAppRepository, todayIso } from '@/lib/repository';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';
type VanavondView = 'decision' | 'declined';
type DevScenario = 'normal' | 'empty_rotation' | 'all_excluded' | 'swaps_exhausted' | 'error';

/** How far back "recent" decisions/cook history reach for novelty-tier classification — see novelty.ts. */
const RECENT_DECISIONS_LOOKBACK_DAYS = 60;

interface LiveSession {
  readonly householdId: HouseholdId;
  readonly requestBase: Omit<DecisionRequest, 'excludedMealIds'>;
  readonly decisionRow: Decision | null;
  readonly mealById: ReadonlyMap<MealId, Meal>;
}

async function loadLiveSession(): Promise<LiveSession> {
  await ensureSeeded();
  const repository = getAppRepository();
  const householdId = await repository.getCurrentHouseholdId();
  const targetDate = todayIso();

  const [household, members, restrictions, candidateMeals, recentCookEvents, thisWeekSaves, somedaySaves] =
    await Promise.all([
      repository.getHousehold(householdId),
      repository.listMembers(householdId),
      repository.listRestrictions(householdId),
      repository.listHouseholdMeals(householdId),
      repository.listCookEvents(householdId),
      repository.listPendingSaves(householdId, 'this_week'),
      repository.listPendingSaves(householdId, 'someday'),
    ]);
  if (household === null) {
    throw new Error('Household not found after seeding.');
  }
  const recentDecisions = await repository.listRecentDecisions(householdId, daysAgoIso(RECENT_DECISIONS_LOOKBACK_DAYS));

  const requestBase: Omit<DecisionRequest, 'excludedMealIds'> = {
    household,
    members,
    restrictions,
    candidateMeals,
    recentCookEvents,
    pendingThisWeekSaves: thisWeekSaves,
    pendingSomedaySaves: somedaySaves,
    recentDecisions,
    targetDate,
  };

  const existingDecision = await repository.getDecisionByDate(householdId, targetDate);
  const decisionRow = existingDecision ?? (await createTodayDecisionIfSuggested(repository, requestBase, householdId));

  return { householdId, requestBase, decisionRow, mealById: new Map(candidateMeals.map((meal) => [meal.id, meal])) };
}

async function createTodayDecisionIfSuggested(
  repository: ReturnType<typeof getAppRepository>,
  requestBase: Omit<DecisionRequest, 'excludedMealIds'>,
  householdId: HouseholdId,
): Promise<Decision | null> {
  const result = decide({ ...requestBase, excludedMealIds: [] });
  if (result.kind !== 'suggestion') {
    return null;
  }
  return repository.createDecision({
    householdId,
    decisionDate: requestBase.targetDate,
    mealId: result.mealId,
    initialMealId: result.mealId,
    reasonCode: result.reasonCode,
    reasonText: result.reasonText,
  });
}

function resolveCurrentResult(
  devScenario: DevScenario,
  sessionIndex: number,
  session: LiveSession | null,
  excludedMealIds: readonly MealId[],
): DecisionResult {
  switch (devScenario) {
    case 'empty_rotation':
      return fixtureNoCandidateEmptyRotation;
    case 'all_excluded':
      return fixtureNoCandidateAllExcluded;
    case 'swaps_exhausted':
      return fixtureNoCandidateSwapsExhausted;
    case 'error':
      // Rendering is short-circuited to ErrorView by `effectivePhase` below
      // whenever devScenario === 'error' — this branch is never actually
      // displayed, but must still return a value to keep the function total.
      return fixtureDecisionSession[sessionIndex] ?? fixtureDecisionSession[0];
    case 'normal':
      if (session === null) {
        return { kind: 'no_candidate', reason: 'empty_rotation' };
      }
      return decide({ ...session.requestBase, excludedMealIds });
    default: {
      const exhaustiveCheck: never = devScenario;
      throw new Error(`Unhandled DevScenario: ${String(exhaustiveCheck)}`);
    }
  }
}

export default function VanavondScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReduceMotion();

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [devScenario, setDevScenario] = useState<DevScenario>('normal');
  const [sessionIndex, setSessionIndex] = useState(0);
  const [session, setSession] = useState<LiveSession | null>(null);
  const [excludedMealIds, setExcludedMealIds] = useState<readonly MealId[]>([]);
  const [view, setView] = useState<VanavondView>('decision');
  const [declineReason, setDeclineReason] = useState<DeclineReason | null>(null);
  const [showOutcomeOverlay, setShowOutcomeOverlay] = useState(false);
  const [pendingOutcomeDecision, setPendingOutcomeDecision] = useState<Decision | null>(null);
  const [pendingOutcomeMeal, setPendingOutcomeMeal] = useState<Meal | null>(null);
  const [pendingCookEventId, setPendingCookEventId] = useState<CookEventId | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setPhase('loading');
    loadLiveSession()
      .then(async (nextSession) => {
        if (cancelled) {
          return;
        }
        setSession(nextSession);
        setExcludedMealIds([]);
        setView(nextSession.decisionRow?.status === 'skipped' ? 'declined' : 'decision');
        setDeclineReason(nextSession.decisionRow?.declineReason ?? null);

        const repository = getAppRepository();
        const outcomeDecision = await repository.getPendingOutcomeDecision(nextSession.householdId);
        if (cancelled) {
          return;
        }
        if (outcomeDecision !== null) {
          const outcomeMeal = await repository.getMeal(outcomeDecision.mealId);
          if (!cancelled && outcomeMeal !== null) {
            setPendingOutcomeDecision(outcomeDecision);
            setPendingOutcomeMeal(outcomeMeal);
            setShowOutcomeOverlay(true);
          }
        }
        if (!cancelled) {
          setPhase('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => load(), [load]);

  const currentResult = useMemo(
    () => resolveCurrentResult(devScenario, sessionIndex, session, excludedMealIds),
    [devScenario, sessionIndex, session, excludedMealIds],
  );
  const effectivePhase: ScreenPhase = devScenario === 'error' ? 'error' : phase;

  const getMealById = (mealId: MealId): Meal | undefined => session?.mealById.get(mealId);

  const handleAccept = (result: Extract<DecisionResult, { kind: 'suggestion' }>): void => {
    if (devScenario === 'normal' && session?.decisionRow) {
      // Fire-and-forget: cooking must never be blocked by a local
      // bookkeeping write. A failure here is extremely unlikely (this is
      // local storage, not a network call) and, if it happens, only means
      // this decision's status field goes stale — the meal itself is
      // unaffected, so it's not worth stalling navigation over.
      void getAppRepository().respondToDecision(session.decisionRow.id, { status: 'accepted' });
    }
    router.push(`/cook/${result.mealId}`);
  };

  const handleRequestAlternative = (): void => {
    if (devScenario !== 'normal') {
      setSessionIndex((current) => Math.min(current + 1, fixtureDecisionSession.length - 1));
      return;
    }
    if (session === null || currentResult.kind !== 'suggestion') {
      return;
    }
    const nextExcluded = [...excludedMealIds, currentResult.mealId];
    const nextResult = decide({ ...session.requestBase, excludedMealIds: nextExcluded });
    setExcludedMealIds(nextExcluded);
    if (nextResult.kind === 'suggestion' && session.decisionRow !== null) {
      const decisionId = session.decisionRow.id;
      getAppRepository()
        .updateDecisionOffer(decisionId, {
          mealId: nextResult.mealId,
          reasonCode: nextResult.reasonCode,
          reasonText: nextResult.reasonText,
        })
        .then((updated) => setSession((current) => (current === null ? current : { ...current, decisionRow: updated })))
        .catch(() => {
          // See handleAccept's comment: the in-memory currentResult is
          // already correct for this render; a failed persist just means a
          // reload would show the pre-swap offer instead.
        });
    }
  };

  const handleChooseSelf = (): void => {
    // The Feed was removed as a product surface; "Mijn recepten" is the
    // PD-001 escape hatch's new destination (see (tabs)/_layout.tsx).
    router.push('/recipes');
  };

  const handleDecline = (): void => {
    if (devScenario === 'normal' && session?.decisionRow) {
      const decisionId = session.decisionRow.id;
      getAppRepository()
        .respondToDecision(decisionId, { status: 'skipped' })
        .then((updated) => setSession((current) => (current === null ? current : { ...current, decisionRow: updated })))
        .catch(() => {});
    }
    setView('declined');
  };

  const handleSelectDeclineReason = (reason: DeclineReason): void => {
    setDeclineReason(reason);
    if (devScenario === 'normal' && session?.decisionRow) {
      const decisionId = session.decisionRow.id;
      getAppRepository()
        .setDecisionDeclineReason(decisionId, reason)
        .then((updated) => setSession((current) => (current === null ? current : { ...current, decisionRow: updated })))
        .catch(() => {});
    }
  };

  const handleNavigateOnboarding = (): void => {
    router.push('/onboarding/seed');
  };

  const handleRetry = (): void => {
    setDevScenario('normal');
    load();
  };

  const handleOutcomeCooked = (cooked: boolean): void => {
    if (!cooked || pendingOutcomeDecision === null || session === null) {
      return;
    }
    getAppRepository()
      .createCookEvent({
        householdId: session.householdId,
        mealId: pendingOutcomeDecision.mealId,
        decisionId: pendingOutcomeDecision.id,
        cookedOn: todayIso(),
      })
      .then((cookEvent) => setPendingCookEventId(cookEvent.id))
      .catch(() => {});
  };

  const handleOutcomeRepeat = (wouldRepeat: boolean): void => {
    if (pendingCookEventId === null) {
      return;
    }
    void getAppRepository().setCookEventRepeat(pendingCookEventId, wouldRepeat);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ ? <DevScenarioRow active={devScenario} onSelect={setDevScenario} /> : null}

      <View style={styles.content}>
        {effectivePhase === 'loading' ? <LoadingSkeleton /> : null}
        {effectivePhase === 'error' ? <ErrorView onRetry={handleRetry} /> : null}

        {effectivePhase === 'ready' && view === 'decision' ? (
          currentResult.kind === 'suggestion' ? (
            <SuggestionView
              result={currentResult}
              meal={getMealById(currentResult.mealId)}
              reduceMotionEnabled={reduceMotionEnabled}
              bottomInset={insets.bottom}
              onAccept={() => handleAccept(currentResult)}
              onRequestAlternative={handleRequestAlternative}
              onChooseSelf={handleChooseSelf}
              onDecline={handleDecline}
            />
          ) : (
            <View style={styles.heroBlock}>
              <NoCandidateState
                reason={currentResult.reason}
                onNavigateOnboarding={handleNavigateOnboarding}
                onOpenRecipes={handleChooseSelf}
                onDecline={handleDecline}
              />
            </View>
          )
        ) : null}

        {effectivePhase === 'ready' && view === 'declined' ? (
          <DeclinedView
            declineReason={declineReason}
            onSelectReason={handleSelectDeclineReason}
            reduceMotionEnabled={reduceMotionEnabled}
          />
        ) : null}
      </View>

      <Modal visible={showOutcomeOverlay && Boolean(pendingOutcomeMeal)} transparent animationType="fade">
        <View style={[styles.outcomeOverlay, { backgroundColor: colors.overlay, paddingBottom: insets.bottom }]}>
          {pendingOutcomeMeal ? (
            <OutcomeCard
              dishTitle={pendingOutcomeMeal.title}
              onCooked={handleOutcomeCooked}
              onRepeatAnswer={handleOutcomeRepeat}
              onDismiss={() => setShowOutcomeOverlay(false)}
              reduceMotionEnabled={reduceMotionEnabled}
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface SuggestionViewProps {
  readonly result: Extract<DecisionResult, { kind: 'suggestion' }>;
  readonly meal: Meal | undefined;
  readonly reduceMotionEnabled: boolean;
  readonly bottomInset: number;
  readonly onAccept: () => void;
  readonly onRequestAlternative: () => void;
  readonly onChooseSelf: () => void;
  readonly onDecline: () => void;
}

function SuggestionView(props: SuggestionViewProps): JSX.Element {
  const { result, meal, reduceMotionEnabled, bottomInset, onAccept, onRequestAlternative, onChooseSelf, onDecline } =
    props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <>
      <View style={styles.heroBlock}>
        <DecisionCard
          dishTitle={meal?.title ?? 'Onbekend gerecht'}
          reasonText={result.reasonText}
          estimatedMinutes={meal?.estimatedMinutes ?? null}
          servings={meal?.servings ?? null}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      </View>
      <View style={[styles.actionZone, { borderTopColor: colors.border, paddingBottom: spacing.space6 + bottomInset }]}>
        <VanavondActionRow
          alternativesRemaining={result.alternativesRemaining}
          onAccept={onAccept}
          onRequestAlternative={onRequestAlternative}
          onChooseSelf={onChooseSelf}
          onDecline={onDecline}
        />
      </View>
    </>
  );
}

function LoadingSkeleton(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.heroBlock}>
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>VANAVOND</Text>
      <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceSunken }]} />
    </View>
  );
}

function ErrorView(props: { readonly onRetry: () => void }): JSX.Element {
  const { onRetry } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.heroBlock}>
      <Text style={[typeScale.title2, styles.centeredTitle, { color: colors.textPrimary }]}>
        Kon geen suggestie ophalen
      </Text>
      <Text style={[typeScale.bodySmall, styles.centeredBody, { color: colors.textMuted }]}>
        Controleer je verbinding en probeer het opnieuw.
      </Text>
      <Button label="Opnieuw" variant="secondary" onPress={onRetry} accessibilityLabel="Probeer opnieuw een suggestie op te halen" />
    </View>
  );
}

interface DeclinedViewProps {
  readonly declineReason: DeclineReason | null;
  readonly onSelectReason: (reason: DeclineReason) => void;
  readonly reduceMotionEnabled: boolean;
}

function DeclinedView(props: DeclinedViewProps): JSX.Element {
  const { declineReason, onSelectReason, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.heroBlock}>
      <Text style={[typeScale.title2, styles.centeredTitle, { color: colors.textPrimary }]}>
        Niet gekookt vanavond. Genoteerd.
      </Text>
      <Text style={[typeScale.bodySmall, styles.centeredBody, { color: colors.textMuted }]}>
        Er komt vanavond geen nieuwe suggestie meer.
      </Text>
      <DeclineReasonRow
        selectedReason={declineReason}
        onSelectReason={onSelectReason}
        reduceMotionEnabled={reduceMotionEnabled}
      />
    </View>
  );
}

interface DevScenarioRowProps {
  readonly active: DevScenario;
  readonly onSelect: (scenario: DevScenario) => void;
}

const DEV_SCENARIOS: ReadonlyArray<{ value: DevScenario; label: string }> = [
  { value: 'normal', label: 'Normaal' },
  { value: 'empty_rotation', label: 'Lege rotatie' },
  { value: 'all_excluded', label: 'Alles uitgesloten' },
  { value: 'swaps_exhausted', label: 'Wissels op' },
  { value: 'error', label: 'Fout' },
];

function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { active, onSelect } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.devRow} accessibilityLabel="Ontwikkelaarsmodus: demoscenario kiezen">
      {DEV_SCENARIOS.map((scenario) => (
        <Pressable
          key={scenario.value}
          onPress={() => onSelect(scenario.value)}
          style={styles.devButton}
          accessibilityRole="button"
          accessibilityLabel={`Demoscenario: ${scenario.label}`}
        >
          <Text style={[typeScale.caption, { color: active === scenario.value ? colors.accent : colors.textMuted }]}>
            {scenario.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: spacing.space3,
  },
  skeletonBar: {
    alignSelf: 'center',
    width: '70%',
    height: typeScale.display.lineHeight,
    borderRadius: radii.radiusSm,
  },
  centeredTitle: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  centeredBody: {
    textAlign: 'center',
    marginBottom: spacing.space6,
  },
  actionZone: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space6,
    gap: spacing.space3,
  },
  outcomeOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
    gap: spacing.space3,
  },
  devButton: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
});

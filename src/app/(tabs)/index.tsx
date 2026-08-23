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
 * builds and does not affect the centered hero layout below it.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fixtureDecisionSession,
  fixtureNoCandidateAllExcluded,
  fixtureNoCandidateEmptyRotation,
  fixtureNoCandidateSwapsExhausted,
  fixturePendingOutcomeDecision,
  getMealById,
} from '@/app/_fixtures';
import { Button } from '@/components/Button';
import { DecisionCard } from '@/components/DecisionCard';
import { DeclineReasonRow } from '@/components/DeclineReasonRow';
import { NoCandidateState } from '@/components/NoCandidateState';
import { OutcomeCard } from '@/components/OutcomeCard';
import { VanavondActionRow } from '@/components/VanavondActionRow';
import type { DeclineReason, DecisionResult } from '@/domain/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

type ScreenPhase = 'loading' | 'error' | 'ready';
type VanavondView = 'decision' | 'declined';
type DevScenario = 'normal' | 'empty_rotation' | 'all_excluded' | 'swaps_exhausted' | 'error';

export default function VanavondScreen(): JSX.Element {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();
  const reduceMotionEnabled = useReduceMotion();

  const [phase, setPhase] = useState<ScreenPhase>('loading');
  const [devScenario, setDevScenario] = useState<DevScenario>('normal');
  const [sessionIndex, setSessionIndex] = useState(0);
  const [view, setView] = useState<VanavondView>('decision');
  const [declineReason, setDeclineReason] = useState<DeclineReason | null>(null);
  const [showOutcomeOverlay, setShowOutcomeOverlay] = useState(false);
  const hasCheckedOutcome = useRef(false);

  useEffect(() => {
    const delay = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    const timer = setTimeout(() => setPhase('ready'), delay);
    return () => clearTimeout(timer);
    // Runs once per mount; reduceMotionEnabled only affects the delay length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'ready' || hasCheckedOutcome.current) {
      return;
    }
    hasCheckedOutcome.current = true;
    // PD-003's second earned surface: "on next app open, if a decision was
    // accepted and no outcome was recorded." fixtureCookEvents is empty, so
    // this accepted decision has no matching outcome yet.
    if (fixturePendingOutcomeDecision && fixturePendingOutcomeDecision.status === 'accepted') {
      setShowOutcomeOverlay(true);
    }
  }, [phase]);

  const currentResult = resolveDevScenario(devScenario, sessionIndex);
  const pendingOutcomeMeal = fixturePendingOutcomeDecision
    ? getMealById(fixturePendingOutcomeDecision.mealId)
    : undefined;

  const handleAccept = (result: Extract<DecisionResult, { kind: 'suggestion' }>): void => {
    // Real app: PATCH decisions.status = 'accepted', responded_at = now().
    router.push(`/cook/${result.mealId}`);
  };

  const handleRequestAlternative = (): void => {
    setSessionIndex((current) => Math.min(current + 1, fixtureDecisionSession.length - 1));
  };

  const handleChooseSelf = (): void => {
    router.push('/feed');
  };

  const handleDecline = (): void => {
    // Real app: PATCH decisions.status = 'skipped', responded_at = now().
    setView('declined');
  };

  const handleNavigateOnboarding = (): void => {
    router.push('/onboarding/seed');
  };

  const handleRetry = (): void => {
    setDevScenario('normal');
    setPhase('loading');
    const delay = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    setTimeout(() => setPhase('ready'), delay);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ ? <DevScenarioRow active={devScenario} onSelect={setDevScenario} /> : null}

      <View style={styles.content}>
        {phase === 'loading' ? <LoadingSkeleton /> : null}
        {phase === 'error' ? <ErrorView onRetry={handleRetry} /> : null}

        {phase === 'ready' && view === 'decision' ? (
          currentResult.kind === 'suggestion' ? (
            <SuggestionView
              result={currentResult}
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
                onOpenFeed={handleChooseSelf}
                onDecline={handleDecline}
              />
            </View>
          )
        ) : null}

        {phase === 'ready' && view === 'declined' ? (
          <DeclinedView
            declineReason={declineReason}
            onSelectReason={setDeclineReason}
            reduceMotionEnabled={reduceMotionEnabled}
          />
        ) : null}
      </View>

      <Modal visible={showOutcomeOverlay && Boolean(pendingOutcomeMeal)} transparent animationType="fade">
        <View style={[styles.outcomeOverlay, { backgroundColor: colors.overlay, paddingBottom: insets.bottom }]}>
          {pendingOutcomeMeal ? (
            <OutcomeCard
              dishTitle={pendingOutcomeMeal.title}
              onCooked={() => {
                // Real app: INSERT cook_events { decisionId, mealId, cookedOn, wouldRepeat: null }.
              }}
              onRepeatAnswer={() => {
                // Real app: UPDATE the new cook_events row's would_repeat.
              }}
              onDismiss={() => setShowOutcomeOverlay(false)}
              reduceMotionEnabled={reduceMotionEnabled}
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function resolveDevScenario(scenario: DevScenario, sessionIndex: number): DecisionResult {
  switch (scenario) {
    case 'empty_rotation':
      return fixtureNoCandidateEmptyRotation;
    case 'all_excluded':
      return fixtureNoCandidateAllExcluded;
    case 'swaps_exhausted':
      return fixtureNoCandidateSwapsExhausted;
    case 'error':
    case 'normal':
    default:
      // T3: fixtureDecisionSession is typed as a non-empty tuple in
      // _fixtures.ts, so fixtureDecisionSession[0] is provably defined —
      // no non-null assertion needed.
      return fixtureDecisionSession[sessionIndex] ?? fixtureDecisionSession[0];
  }
}

interface SuggestionViewProps {
  readonly result: Extract<DecisionResult, { kind: 'suggestion' }>;
  readonly reduceMotionEnabled: boolean;
  readonly bottomInset: number;
  readonly onAccept: () => void;
  readonly onRequestAlternative: () => void;
  readonly onChooseSelf: () => void;
  readonly onDecline: () => void;
}

function SuggestionView(props: SuggestionViewProps): JSX.Element {
  const { result, reduceMotionEnabled, bottomInset, onAccept, onRequestAlternative, onChooseSelf, onDecline } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const meal = getMealById(result.mealId);

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

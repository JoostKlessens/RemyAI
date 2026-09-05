/**
 * Kiezen — the hero screen. One dish, one stated reason, three actions.
 * No list, no scroll, no browse affordance: this is the entire product
 * thesis. See docs/DESIGN.md §1 and docs/PRODUCT-DECISIONS.md.
 *
 * PD-009 adds one thing above the hero: `DecisionFilterBar`, where the
 * household can say "ik heb 20 minuten" or "iets met pasta" *before* Remy
 * picks. That is still one dish, one reason — it narrows the question
 * rather than handing it back, which is why it doesn't breach rule 1 (see
 * that component's header for the full argument). Its state lives here and
 * nowhere else: filters are never persisted, never written to the
 * decisions row, and reset on every reload, because they describe a mood
 * at 17:45, not a setting. `handleChangeFilters` also explains why
 * narrowing does NOT refund a spent swap.
 *
 * `DecisionResult` (src/domain/types.ts) is a discriminated union; every
 * branch below is switched on `kind`/`reason` explicitly so a blank
 * screen here is structurally impossible, not just unlikely. The
 * `empty_rotation` branch is the genuinely common first-run case now: a
 * fresh install seeds only a bare household (src/lib/repository/
 * seedData.ts), no curated starter meals, so a household that hasn't
 * pasted a single link yet reaches this branch honestly, not as an edge
 * case — see NoCandidateState's own header.
 *
 * A small `__DEV__`-only scenario row at the top lets every state
 * (normal swap flow, each `no_candidate` reason, network error) be
 * exercised on device without needing a real seeded household — it never
 * renders in production builds and does not affect the centered hero
 * layout below it. Only `devScenario === 'normal'` drives the real
 * pipeline below; every other scenario still renders from fixture data.
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
 * One read on that path is NOT local: `loadFriendProof`
 * (src/lib/friendProof.ts) asks the `shared_cooks` view which recipes this
 * household's friends have cooked, and the assembled result travels to
 * `decide()` as `friendProof`. That one map drives both halves of the
 * Kiezen social reason (DESIGN-SOCIAL.md §2.1) — the scoring boost and the
 * sentence naming the friend — and it is the only new input this screen
 * supplies. It cannot fail loudly: see that module's header for why
 * silence is the correct degradation, and for why it will stay silent
 * until auth, real cook events and imported `recipeId`s all exist. Nothing
 * about the layout changes; the reason block renders whatever `decide()`
 * put in `reasonText`, exactly as it always has.
 *
 * The outcome overlay makes a SECOND non-local read, only while it is up:
 * DESIGN-SOCIAL.md §3.1's first Sturen entry point must know whether any
 * accepted friend exists before `OutcomeCard` may draw its `Stuur door`.
 * That read, the send write and the sheet's whole state live in
 * `useOutcomeSend` (src/lib/useOutcomeSend.ts), outside this file because
 * a route module is unimportable in the test environment — which is
 * exactly how the prop went unpassed for a phase. It degrades the way
 * `loadFriendProof` does: silently, into no button, never into an error on
 * a card asking how dinner was.
 *
 * Known, documented limitation: this app doesn't persist
 * `decision_alternatives` (the swap history table) — see the top-level
 * report. A reload mid-swap-session resets `alternativesRemaining` back to
 * 2 even if the household had already swapped once before closing the
 * app; the persisted decision's CURRENT offer (mealId/reasonCode/
 * reasonText) is still correct, only the swap COUNT resets.
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fixtureDecisionSession,
  fixtureNoCandidateAllExcluded,
  fixtureNoCandidateEmptyRotation,
  fixtureNoCandidateFilteredOut,
  fixtureNoCandidateSwapsExhausted,
} from '@/app/_fixtures';
import { Button } from '@/components/Button';
import { DecisionCard } from '@/components/DecisionCard';
import { DecisionFilterBar } from '@/components/DecisionFilterBar';
import { DeclineReasonRow } from '@/components/DeclineReasonRow';
import { NoCandidateState } from '@/components/NoCandidateState';
import { OutcomeCard } from '@/components/OutcomeCard';
import { SendRecipeSheet } from '@/components/SendRecipeSheet';
import { VanavondActionRow } from '@/components/VanavondActionRow';
import { decide, type DecisionRequestWithProof } from '@/domain/decide';
import { collectAvailableDishMoods } from '@/domain/dishMoods';
import { NO_DECISION_FILTERS } from '@/domain/exclusions';
import type {
  CookEventId,
  Decision,
  DeclineReason,
  DecisionFilters,
  DecisionResult,
  HouseholdId,
  Meal,
  MealId,
} from '@/domain/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { loadFriendProof } from '@/lib/friendProof';
import { hapticRealCommit } from '@/lib/haptics';
import { daysAgoIso, ensureSeeded, getAppRepository, todayIso } from '@/lib/repository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';
import { useOutcomeSend } from '@/lib/useOutcomeSend';
import { getColors, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { DEV_SCENARIO_ROWS_VISIBLE } from '@/lib/devFlags';

type ScreenPhase = 'loading' | 'error' | 'ready';
type VanavondView = 'decision' | 'declined';
type DevScenario = 'normal' | 'empty_rotation' | 'all_excluded' | 'filtered_out' | 'swaps_exhausted' | 'error';

/** How far back "recent" decisions/cook history reach for novelty-tier classification — see novelty.ts. */
const RECENT_DECISIONS_LOOKBACK_DAYS = 60;

/**
 * How long "Ja" holds the screen before Kookmodus takes over.
 *
 * DecisionCard draws its accent stroke over `motion.durationFast`
 * (150ms), and this used to wait exactly `motion.durationFast` too — so
 * navigation landed on the very frame the stroke finished, and the one
 * gesture the whole screen is built around was never actually seen.
 * DecisionCard's own header says the stroke lands "before the screen
 * navigates to Kookmodus"; this is the number that makes that true.
 *
 * Deliberately not a `motion` token: it is not a duration anything
 * animates over, it is the beat after one. It still goes through
 * `resolveDuration`, so reduced motion navigates instantly rather than
 * merely sooner.
 */
const ACCEPT_STROKE_HOLD_MS = 180;

interface LiveSession {
  readonly householdId: HouseholdId;
  /**
   * PD-009: `filters` is omitted alongside `excludedMealIds` because both
   * change *within* a session without any reload. The loaded household data
   * is the stable part; what the user asks for tonight is not, and baking a
   * filter into `requestBase` would mean re-fetching the whole household to
   * un-tap a chip.
   */
  readonly requestBase: Omit<DecisionRequestWithProof, 'excludedMealIds' | 'filters'>;
  readonly decisionRow: Decision | null;
  readonly mealById: ReadonlyMap<MealId, Meal>;
  /**
   * Every dish category present on at least one candidate meal, so the
   * filter bar only offers narrowings that can actually return something —
   * see DecisionFilterBar's header.
   */
  readonly availableDishTags: readonly string[];
  readonly availableDishMoods: readonly string[];
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
  // In parallel: the last local read, and the one remote read this screen
  // makes. `loadFriendProof` never rejects (see its header) so it cannot
  // take the decision down with it, and it is handed the SUPABASE social
  // repository deliberately — cook proof is a cross-household fact living
  // in the `shared_cooks` view, and the local implementation answers `[]`
  // by design ("there is no friend's kitchen in here to read"). Ranglijst
  // already reaches for its own cross-household table this way while the
  // rest of the app is local-first; this is the same seam.
  const [recentDecisions, friendProof] = await Promise.all([
    repository.listRecentDecisions(householdId, daysAgoIso(RECENT_DECISIONS_LOOKBACK_DAYS)),
    loadFriendProof(createSupabaseSocialRepository(supabase), candidateMeals),
  ]);

  const requestBase: Omit<DecisionRequestWithProof, 'excludedMealIds' | 'filters'> = {
    household,
    members,
    restrictions,
    candidateMeals,
    recentCookEvents,
    pendingThisWeekSaves: thisWeekSaves,
    pendingSomedaySaves: somedaySaves,
    recentDecisions,
    targetDate,
    friendProof,
  };

  const existingDecision = await repository.getDecisionByDate(householdId, targetDate);
  const decisionRow = existingDecision ?? (await createTodayDecisionIfSuggested(repository, requestBase, householdId));

  return {
    householdId,
    requestBase,
    decisionRow,
    mealById: new Map(candidateMeals.map((meal) => [meal.id, meal])),
    availableDishTags: collectAvailableDishTags(candidateMeals),
    availableDishMoods: collectAvailableDishMoods(candidateMeals),
  };
}

/** Deduplicated union of every candidate meal's dish categories — order is irrelevant, DecisionFilterBar re-sorts. */
function collectAvailableDishTags(candidateMeals: readonly Meal[]): readonly string[] {
  const tags = new Set<string>();
  for (const meal of candidateMeals) {
    for (const tag of meal.dishTags) {
      tags.add(tag);
    }
  }
  return [...tags];
}

async function createTodayDecisionIfSuggested(
  repository: ReturnType<typeof getAppRepository>,
  requestBase: Omit<DecisionRequestWithProof, 'excludedMealIds' | 'filters'>,
  householdId: HouseholdId,
): Promise<Decision | null> {
  // PD-009, deliberately unfiltered: this is the household's offer *for the
  // day* — the row the scheduled Edge Function will eventually write at
  // 16:00, before anyone has touched a chip. Persisting a filtered offer
  // would freeze a passing mood ("iets met soep", tapped once) into the
  // permanent record of what Remy suggested, and would make the
  // accept-rate metric in plan §8 unreadable. Filters live only in this
  // screen's state and are applied on every subsequent `decide()` below.
  const result = decide({ ...requestBase, excludedMealIds: [], filters: NO_DECISION_FILTERS });
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
  filters: DecisionFilters,
): DecisionResult {
  switch (devScenario) {
    case 'empty_rotation':
      return fixtureNoCandidateEmptyRotation;
    case 'all_excluded':
      return fixtureNoCandidateAllExcluded;
    case 'filtered_out':
      return fixtureNoCandidateFilteredOut;
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
      return decide({ ...session.requestBase, excludedMealIds, filters });
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
  // PD-009. Session state, never persisted and never written to the
  // decision row — see `createTodayDecisionIfSuggested`.
  const [filters, setFilters] = useState<DecisionFilters>(NO_DECISION_FILTERS);
  const [view, setView] = useState<VanavondView>('decision');
  const [declineReason, setDeclineReason] = useState<DeclineReason | null>(null);
  const [showOutcomeOverlay, setShowOutcomeOverlay] = useState(false);
  const [pendingOutcomeDecision, setPendingOutcomeDecision] = useState<Decision | null>(null);
  const [pendingOutcomeMeal, setPendingOutcomeMeal] = useState<Meal | null>(null);
  const [pendingCookEventId, setPendingCookEventId] = useState<CookEventId | null>(null);
  // docs/DESIGN.md §1: "on Ja, a hairline accent stroke draws under the
  // dish name ... before navigating" — the grease-pencil circle landing.
  // Navigation is deliberately delayed by that same duration so the stroke
  // is actually visible; reduced motion collapses the delay to 0 via
  // resolveDuration, same as the stroke animation itself.
  const [isAccepting, setIsAccepting] = useState(false);

  /**
   * §3.1's first Sturen entry point, on the second of PD-003's two outcome
   * surfaces — see the file header for why none of its work is in here.
   * Null while the overlay is down, so the friend read fires only when a
   * card is actually up rather than for the whole life of a screen that
   * keeps its finished meal in state.
   */
  const outcomeSend = useOutcomeSend(showOutcomeOverlay ? (pendingOutcomeMeal?.id ?? null) : null);

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
        setFilters(NO_DECISION_FILTERS);
        setIsAccepting(false);
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
    () => resolveCurrentResult(devScenario, sessionIndex, session, excludedMealIds, filters),
    [devScenario, sessionIndex, session, excludedMealIds, filters],
  );
  const effectivePhase: ScreenPhase = devScenario === 'error' ? 'error' : phase;
  const isEmptyRotation = currentResult.kind === 'no_candidate' && currentResult.reason === 'empty_rotation';
  const showFilterBar = effectivePhase === 'ready' && view === 'decision' && !isEmptyRotation;

  const getMealById = (mealId: MealId): Meal | undefined => session?.mealById.get(mealId);

  const handleAccept = (result: Extract<DecisionResult, { kind: 'suggestion' }>): void => {
    if (isAccepting) {
      return;
    }
    setIsAccepting(true);
    // WS5 §3.2 calls this "the decision of the day", and it is one of the
    // three `Medium` events in the app. Fired here, with the stroke and
    // BEFORE the ACCEPT_STROKE_HOLD_MS wait, because the buzz reports the
    // tap that already happened — deferring it to the navigation would
    // land it on Kookmodus, describing a screen the user has left.
    //
    // Deliberately not mirrored on `Niet koken` or `Iets anders`.
    // docs/DESIGN.md §1 is where that parity lives — "'Niet koken' is
    // always legitimate, lowest visual weight, never a cancel action" —
    // and PD-008 leans on PD-002's optional decline reason as its own
    // precedent. A haptic on one answer and not the other undoes that in
    // a single line of code, so the buzz is spent on the branch that
    // STARTS something and the other two stay as legitimate and as quiet.
    //
    // (This cited §10 until it was checked. §10 is the rating slider; it
    // argues that SKIPPING a grade must cost what giving one costs, which
    // is a different parity about a different control.)
    hapticRealCommit();
    if (devScenario === 'normal' && session?.decisionRow) {
      // Fire-and-forget: cooking must never be blocked by a local
      // bookkeeping write. A failure here is extremely unlikely (this is
      // local storage, not a network call) and, if it happens, only means
      // this decision's status field goes stale — the meal itself is
      // unaffected, so it's not worth stalling navigation over.
      void getAppRepository().respondToDecision(session.decisionRow.id, { status: 'accepted' });
    }
    setTimeout(() => {
      router.push(`/cook/${result.mealId}`);
    }, resolveDuration(ACCEPT_STROKE_HOLD_MS, reduceMotionEnabled));
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
    const nextResult = decide({ ...session.requestBase, excludedMealIds: nextExcluded, filters });
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
    // Bibliotheek is the PD-001 escape hatch's destination (see
    // (tabs)/_layout.tsx) — browsing lives there, never on this screen.
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

  const handleOpenImport = (): void => {
    router.push('/import/paste');
  };

  /**
   * PD-009. Note what this deliberately does NOT do: reset
   * `excludedMealIds`. Changing a filter is not a swap, so it must not
   * refund one — otherwise PD-001's two-swap cap is bypassed by toggling a
   * chip on and off, which is the cheapest possible way to reintroduce
   * endless browsing on the one screen that exists to prevent it. The
   * already-offered meals stay excluded for the rest of the evening
   * regardless of how the pool is narrowed around them.
   */
  const handleChangeFilters = (nextFilters: DecisionFilters): void => {
    setFilters(nextFilters);
  };

  const handleClearFilters = (): void => {
    setFilters(NO_DECISION_FILTERS);
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

  /**
   * Fires only when a score was actually given — dismissing the card
   * unrated reports nothing, and that silence is a legitimate answer
   * (PD-002's optional decline reason, applied to the outcome loop).
   * `wouldRepeat` is re-derived from the score inside the repository, so
   * nothing here projects it.
   */
  const handleOutcomeRate = (rating: number): void => {
    if (pendingCookEventId === null) {
      return;
    }
    void getAppRepository().setCookEventRating(pendingCookEventId, rating);
  };

  /** The public half of the same moment, keyed on the MEAL rather than on
      `pendingCookEventId` like the grade above — see OutcomeCard's header. */
  const handleOutcomeMood = (mood: string): void => {
    if (pendingOutcomeMeal === null) {
      return;
    }
    void getAppRepository().addMealDishMood(pendingOutcomeMeal.id, mood);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {__DEV__ && DEV_SCENARIO_ROWS_VISIBLE ? <DevScenarioRow active={devScenario} onSelect={setDevScenario} /> : null}

      {/* PD-009. Above the hero rather than inside it, so "Iets anders"
          still cross-fades only the name/reason/meta block and the action
          row never moves (docs/DESIGN.md §1). Hidden for `empty_rotation`:
          offering to narrow a library that has nothing in it is noise, and
          that state's single job is to get the first link pasted. */}
      {showFilterBar ? (
        <DecisionFilterBar
          filters={filters}
          availableDishTags={session?.availableDishTags ?? []}
          availableDishMoods={session?.availableDishMoods ?? []}
          onChange={handleChangeFilters}
        />
      ) : null}

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
              accepted={isAccepting}
              onAccept={() => handleAccept(currentResult)}
              onRequestAlternative={handleRequestAlternative}
              onChooseSelf={handleChooseSelf}
              onDecline={handleDecline}
            />
          ) : (
            <View style={styles.heroBlock}>
              <NoCandidateState
                reason={currentResult.reason}
                onOpenImport={handleOpenImport}
                onOpenRecipes={handleChooseSelf}
                onClearFilters={handleClearFilters}
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

      {/* Stays mounted while the sheet is up even after the card has gone:
          §3.1's "the send opens while the card closes underneath" is one
          gesture away — tap a chip, then `Stuur door` during the hold —
          and without that term the dismissal would take the sheet with it
          mid-send. The sheet is NESTED rather than made a sibling, because
          two top-level modals fight over presentation. */}
      <Modal
        visible={(showOutcomeOverlay || outcomeSend.sheetVisible) && pendingOutcomeMeal !== null}
        transparent
        animationType="fade"
      >
        {pendingOutcomeMeal !== null ? (
          <>
            <View style={[styles.outcomeOverlay, { backgroundColor: colors.overlay, paddingBottom: insets.bottom }]}>
              {showOutcomeOverlay ? (
                <OutcomeCard
                  dishTitle={pendingOutcomeMeal.title}
                  onCooked={handleOutcomeCooked}
                  onRate={handleOutcomeRate}
                  onChooseMood={handleOutcomeMood}
                  onSendRecipe={outcomeSend.onSendRecipe}
                  onDismiss={() => setShowOutcomeOverlay(false)}
                  reduceMotionEnabled={reduceMotionEnabled}
                />
              ) : null}
            </View>
            <SendRecipeSheet
              visible={outcomeSend.sheetVisible}
              dishTitle={pendingOutcomeMeal.title}
              friends={outcomeSend.friends}
              note={outcomeSend.note}
              onChangeNote={outcomeSend.onChangeNote}
              onSend={outcomeSend.onSend}
              onRetryFriends={outcomeSend.onRetryFriends}
              onDismiss={outcomeSend.onDismiss}
              reduceMotionEnabled={reduceMotionEnabled}
            />
          </>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

interface SuggestionViewProps {
  readonly result: Extract<DecisionResult, { kind: 'suggestion' }>;
  readonly meal: Meal | undefined;
  readonly reduceMotionEnabled: boolean;
  readonly bottomInset: number;
  /** True the instant "Ja" is tapped, until navigation to Kookmodus — drives DecisionCard's accept stroke (docs/DESIGN.md §1). */
  readonly accepted: boolean;
  readonly onAccept: () => void;
  readonly onRequestAlternative: () => void;
  readonly onChooseSelf: () => void;
  readonly onDecline: () => void;
}

function SuggestionView(props: SuggestionViewProps): JSX.Element {
  const { result, meal, reduceMotionEnabled, bottomInset, accepted, onAccept, onRequestAlternative, onChooseSelf, onDecline } =
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
          accepted={accepted}
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
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>KIEZEN</Text>
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
  { value: 'filtered_out', label: 'Weggefilterd' },
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

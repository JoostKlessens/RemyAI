/**
 * Kiezen — the hero screen. One dish, two actions. No list, no scroll, no
 * browse affordance: this is the entire product thesis. See docs/DESIGN.md
 * §1 and docs/PRODUCT-DECISIONS.md.
 *
 * IT WAS "ONE DISH, ONE STATED REASON" UNTIL 6 SEPTEMBER 2026. The owner
 * removed the REDEN block — "De reden hierbij moet weg, dat is niet logisch,
 * ik wil liever dat je de 1 tot max 3 hoofdingredienten er staan en hoe lang
 * het duurt om te maken" — and asked for the dish's photo with it.
 * `DecisionCard`'s header holds the full argument, including the one it
 * overturns about photos on this screen. The reason itself did not die: it
 * is still composed by `decide()` and still written to the decisions row
 * below, which is what plan §8 reads.
 *
 * THE HOOFDINGREDIËNTEN CAME OFF AGAIN ON 7 SEPTEMBER 2026, one day after
 * they landed, and the owner's words are in DecisionCard's header along with
 * why they were never going to be right. What the card carries now is the
 * dish's name, its cook time, the still, and — only when a friend really
 * cooked this dish — PD-017's sentence.
 *
 * WHAT WENT WITH THEM, recorded here because the code is gone and the
 * measurement it rested on is worth keeping. This screen used to run a
 * SECOND, lazy read whose only consumer was that line: `getMealIngredients`
 * for the suggested meal alone, fired per offered dish rather than for the
 * whole library at session start, because `Meal` carries no ingredients and
 * local/meals.ts lists the entire ingredients table and filters it — the
 * cost backfillMirrorOutbox.ts's header priced at "a two-hundred-meal store
 * would parse the ingredients table four hundred times". Its answer was
 * keyed by meal id and checked against the dish actually on screen, because
 * "Iets anders" changes the dish while a read is in flight and three
 * plausible ingredients under the wrong dish name is the failure nobody can
 * see. If a surface ever wants those names again — a library tile is the
 * obvious candidate — that read is the shape to bring back, not a load-time
 * one.
 *
 * IT WAS THREE ACTIONS UNTIL "Niet koken" WAS REMOVED, and nothing
 * replaced it. The reason menu behind it (PD-002's optional afhalen /
 * restjes / uit-eten chips) bought nothing, and an evening you are not
 * cooking is an evening you close the app — so the button's whole effect
 * was to trade tonight's dish for a screen saying the refusal had been
 * noted. The rejected alternative was keeping the button and dropping
 * only the chips, which leaves a tertiary control whose destination is a
 * sentence. What remains is `Dit koken`, `Iets anders`, and — once the
 * two swaps are spent — `Ik kies zelf`. The first two sit SIDE BY SIDE
 * as of 7 September 2026 and the accept label read `Ja` until that same
 * day; both are argued in src/components/vanavondActionCopy.ts, and the
 * 64 pt that stacking cost went to DecisionCard's photo.
 *
 * THE COST, written here because it is invisible from the screen.
 * `handleDecline` was the ONLY writer of `status: 'skipped'` anywhere in
 * the app; the load-time read that restored a previously declined evening
 * went with it. A refused evening now stays `'pending'` forever, byte-
 * identical to an evening on which nobody opened the app at all, so plan
 * §8's acceptance rate can no longer read "offered and refused" apart
 * from "never seen" — only "offered and accepted" survives. Getting that
 * reading back needs a new writer, not this button back; the repository
 * seam still accepts `'skipped'` (RespondToDecisionInput) precisely so
 * such a writer has somewhere to land.
 *
 * PD-009 adds one thing above the hero: `DecisionFilterBar`, where the
 * household can say "ik heb 20 minuten" or "iets met pasta" *before* Remy
 * picks — since 6 September through `TimeCapPicker`'s clock and five-minute
 * ladder rather than four chips, the second half of the owner's instruction.
 * That is still one dish — it narrows the question
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
 * A small `__DEV__`-only scenario row at the top
 * (src/components/DevScenarioRow.tsx, which also owns the `DevScenario`
 * union) lets every state — normal swap flow, each `no_candidate` reason,
 * network error — be exercised on device without needing a real seeded
 * household. It never renders in production builds and does not affect the
 * centered hero layout below it. Only `devScenario === 'normal'` drives the
 * real pipeline below; every other scenario still renders from fixture data.
 *
 * The "normal" path: load this household's real data through
 * `RemyRepository`, call the pure `decide()` engine (src/domain/decide.ts)
 * to get today's suggestion, and persist a real `decisions` row for it —
 * mirroring what the scheduled Edge Function will do once it exists (see
 * docs/ARCHITECTURE.md). "Iets anders" re-runs `decide()` with a growing
 * `excludedMealIds` list and updates that same row's current offer.
 * Accept writes a real decision response — the only one left, see above;
 * the outcome overlay (PD-003) reads/writes real cook_events.
 *
 * One read on that path is NOT local: `loadFriendProof`
 * (src/lib/friendProof.ts) asks the `shared_cooks` view which recipes this
 * household's friends have cooked, and the assembled result travels to
 * `decide()` as `friendProof`. That one map drives both halves of the
 * Kiezen social reason (DESIGN-SOCIAL.md §2.1) — the scoring boost and the
 * sentence naming the friend — and it is the only new input this screen
 * supplies. It cannot fail loudly: see that module's header for why
 * silence is the correct degradation, and for why it will stay silent
 * until auth, real cook events and imported `recipeId`s all exist. It is
 * now the ONLY reason copy that can reach the screen at all: everything
 * `decide()` puts in `reasonText` goes to the decisions row, and only a
 * `friend_proof` naming a real person passes `buildFriendProofLine` onto the
 * card.
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
import { Modal, StyleSheet, View, useColorScheme } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fixtureDecisionSession,
  fixtureNoCandidateAllExcluded,
  fixtureNoCandidateEmptyRotation,
  fixtureNoCandidateFilteredOut,
  fixtureNoCandidateSwapsExhausted,
} from '@/fixtures/decisionFixtures';
import { DecisionCard } from '@/components/DecisionCard';
import { DecisionFilterBar } from '@/components/DecisionFilterBar';
import { FilterTrigger } from '@/components/FilterTrigger';
import { countDecisionFilters, describeDecisionFilters } from '@/components/decisionFilterCopy';
import { DecisionErrorState, DecisionLoadingSkeleton } from '@/components/DecisionScreenStates';
import { DevScenarioRow, type DevScenario } from '@/components/DevScenarioRow';
import { NoCandidateState } from '@/components/NoCandidateState';
import { OutcomeCard } from '@/components/OutcomeCard';
import { SendRecipeSheet } from '@/components/SendRecipeSheet';
import { VanavondActionRow } from '@/components/VanavondActionRow';
import { decide, type DecisionRequestWithProof } from '@/domain/decide';
import { NO_DECISION_FILTERS } from '@/domain/exclusions';
import { selectOfferableMeals } from '@/domain/offerablePool';
import { buildFriendProofLine } from '@/domain/reason';
import { collectSelectableDecisionDishMoods, collectSelectableDecisionDishTags } from '@/domain/recipeSearch';
import type {
  Decision,
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
import { getColors, resolveDuration, spacing } from '@/theme/tokens';
import { DEV_SCENARIO_ROWS_VISIBLE } from '@/lib/devFlags';

type ScreenPhase = 'loading' | 'error' | 'ready';

/** How far back "recent" decisions/cook history reach for novelty-tier classification — see novelty.ts. */
const RECENT_DECISIONS_LOOKBACK_DAYS = 60;

/**
 * How long "Dit koken" holds the screen before Kookmodus takes over.
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
   * The meals tonight's chips are allowed to describe: `selectOfferableMeals`
   * (src/domain/offerablePool.ts), the household's standing gates already
   * applied. THE POOL, NOT THE CHIPS — until 9 September 2026 this held two
   * arrays of tags and moods collected here, once, at load, and the bar
   * re-offered all of them after every tap (docs/LONGLIST.md GAP-33: choose
   * two chips no dish shares and the answer is `filtered_out` with nothing
   * saying which chip did it). The chips are now derived per render in
   * `VanavondScreen`, against the filters the household has set — session
   * state this loader cannot see, for the reason `requestBase` omits it.
   */
  readonly offerableMeals: readonly Meal[];
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
    // PD-009. The chips describe the meals that survive the household's
    // STANDING gates, not the whole library — `selectOfferableMeals` carries
    // the measurement and the claim it corrects. Run once, here, because
    // these gates depend on nothing a chip can change; the per-tap narrowing
    // over this pool is `VanavondScreen`'s. (A private copy of
    // `collectAvailableDishTags` stood below this function until GAP-33
    // closed; the domain's own is what the screen calls now.)
    offerableMeals: selectOfferableMeals(candidateMeals, household, members, restrictions),
  };
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
  const [showOutcomeOverlay, setShowOutcomeOverlay] = useState(false);
  const [pendingOutcomeDecision, setPendingOutcomeDecision] = useState<Decision | null>(null);
  const [pendingOutcomeMeal, setPendingOutcomeMeal] = useState<Meal | null>(null);
  /* ⚠ `pendingCookEventId` STOOD HERE AND IS GONE (GAP-46). It existed only
     so `handleOutcomeRate` could attach a grade to the cook it had just
     written; with the grade asked twelve hours later, the sheet resolves
     its own cook event from the repository and this screen has nothing left
     to remember. The `createCookEvent` write below is unchanged — it is
     what makes the cook exist, and its `created_at` is the clock the delay
     runs on. */
  // docs/DESIGN.md §1: "on Ja, a hairline accent stroke draws under the
  // dish name ... before navigating" — the grease-pencil circle landing.
  // Quoted as that document still words it. The button has read `Dit
  // koken` since 7 September 2026 (src/components/vanavondActionCopy.ts)
  // and DESIGN.md has not caught up; the stroke itself is unchanged.
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
  /**
   * GAP-33. The chip rows, re-derived against the filters the household has
   * already set — per render, not once at load, because the AND axis is what
   * makes a chip a dead end: with "pasta" chosen, every tag no pasta dish
   * carries is a control that can only ever answer `filtered_out`. Both
   * collectors union the selection back in, so the chip that undoes an
   * empty pool never leaves the screen. src/domain/recipeSearch.ts carries
   * the rule, and why this is not the library's collector reused.
   */
  const selectableChips = useMemo(
    () => ({
      dishTags: collectSelectableDecisionDishTags(session?.offerableMeals ?? [], filters),
      dishMoods: collectSelectableDecisionDishMoods(session?.offerableMeals ?? [], filters),
    }),
    [session, filters],
  );
  const effectivePhase: ScreenPhase = devScenario === 'error' ? 'error' : phase;
  const isEmptyRotation = currentResult.kind === 'no_candidate' && currentResult.reason === 'empty_rotation';
  const showFilterBar = effectivePhase === 'ready' && !isEmptyRotation;

  /**
   * The drawer's open state, lifted out of `DecisionFilterBar` when its
   * opening became a glyph above it. Never persisted: Kiezen opens on the
   * food, and a drawer that remembered being open would greet the household
   * with three rows of controls instead of a dish.
   */
  const [isFilterOpen, setFilterOpen] = useState(false);

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
      .catch(() => {});
  };

  /* ⚠ `handleOutcomeRate` STOOD HERE AND IS GONE (GAP-46). The outcome card
     no longer asks for a grade — `PendingRatingSheet` does, twelve hours
     after the cook finished — so this screen has no rating to write.

     WORTH KNOWING BEFORE SOMEBODY "RESTORES" IT: what stood here wrote ONLY
     the private `cook_events.rating`, with no `castPublicVote` beside it,
     while `cook/[mealId].tsx` wrote both. So a meal graded from this card
     never reached Ranglijst and the same meal graded from Kookmodus did —
     an asymmetry nobody had noticed and no test could see. One sheet asking
     the question means one answer to it, and `recordPendingRating` writes
     both rows wherever the cook began.

     `pendingCookEventId` went with it: nothing read it any more once the
     grade left, and the sheet finds its own cook event from the
     repository. */

  /** The mood, keyed on the MEAL — see OutcomeCard's header. */
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
          still cross-fades only the name/time/photo block and the action
          row does not move on a swap (docs/DESIGN.md §1). Hidden for `empty_rotation`:
          offering to narrow a library that has nothing in it is noise, and
          that state's single job is to get the first link pasted. */}
      {/* THE OPENING IS A GLYPH NOW, AND THE BAR IS ONLY WHAT IT OPENS. The
          owner: "ik wil dat we het filter icoontje net zo toepassen op de
          kiezen pagina als we bij trending hebben gedaan." What stood here
          was a full-width bar with a bottom rule whose SHUT state was still a
          44pt row reading `Filters` — on the one screen in this app whose
          whole thesis is that it shows you one dish and not a list. A band of
          chrome above that dish, on every visit, to offer a narrowing most
          visits never use.

          ⚠ THIS SCREEN HAS NO HEADER TO PUT THE GLYPH IN, unlike Trending,
          and that is deliberate rather than missing: Kiezen opens on the
          food. So `FilterTrigger` draws its own right-aligned row. It is the
          one way this differs from the screen it was copied from, and it
          follows from a difference that was already there. */}
      {showFilterBar ? (
        <FilterTrigger
          activeFilterCount={countDecisionFilters(filters)}
          isExpanded={isFilterOpen}
          onToggle={() => setFilterOpen((wasOpen) => !wasOpen)}
          accessibilityLabel={describeDecisionFilters(countDecisionFilters(filters)).accessibilityLabel}
        />
      ) : null}

      {showFilterBar && isFilterOpen ? (
        <DecisionFilterBar
          filters={filters}
          availableDishTags={selectableChips.dishTags}
          availableDishMoods={selectableChips.dishMoods}
          onChange={handleChangeFilters}
        />
      ) : null}

      <View style={styles.content}>
        {effectivePhase === 'loading' ? <DecisionLoadingSkeleton /> : null}
        {effectivePhase === 'error' ? <DecisionErrorState onRetry={handleRetry} /> : null}

        {effectivePhase === 'ready' ? (
          currentResult.kind === 'suggestion' ? (
            <SuggestionView
              result={currentResult}
              meal={getMealById(currentResult.mealId)}
              reduceMotionEnabled={reduceMotionEnabled}
              accepted={isAccepting}
              onAccept={() => handleAccept(currentResult)}
              onRequestAlternative={handleRequestAlternative}
              onChooseSelf={handleChooseSelf}
            />
          ) : (
            <View style={styles.heroBlock}>
              <NoCandidateState
                reason={currentResult.reason}
                onOpenImport={handleOpenImport}
                onOpenRecipes={handleChooseSelf}
                onClearFilters={handleClearFilters}
              />
            </View>
          )
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
        // Android's hardware back button. Until 7 September 2026 this was
        // the ONE `<Modal>` in the app without a handler for it — the other
        // five (CookSharingAskSheet, LibraryTileActionSheet,
        // PortionScalingSheet, SaveIntentSheet, SendRecipeSheet) all pass
        // one — so the outcome card was the single surface in Remy where
        // back did nothing. The owner asked for the general version: "ik zie
        // ook dat er nu geen terug naar vorige pagina knop is in elk menu,
        // dat lijkt me wel handig."
        //
        // It closes the CARD, and deliberately not `outcomeSend.onDismiss`:
        // that only sets `sheetVisible` false (src/lib/useOutcomeSend.ts),
        // so with the card up and the sheet down it would run, change
        // nothing visible, and leave back looking broken rather than
        // missing. This is the same call `OutcomeCard`'s own `onDismiss`
        // prop makes below, so the hardware button and the card's own
        // dismiss control are one behaviour instead of two.
        //
        // The send sheet needs nothing here: it is a NESTED `<Modal>`, so
        // while it is up Android delivers the press to it, and it already
        // maps that to `onDismiss` — sheet first, card second.
        onRequestClose={() => setShowOutcomeOverlay(false)}
      >
        {pendingOutcomeMeal !== null ? (
          <>
            <View style={[styles.outcomeOverlay, { backgroundColor: colors.overlay, paddingBottom: insets.bottom }]}>
              {showOutcomeOverlay ? (
                <OutcomeCard
                  dishTitle={pendingOutcomeMeal.title}
                  onCooked={handleOutcomeCooked}
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
  /** True the instant "Dit koken" is tapped, until navigation to Kookmodus — drives DecisionCard's accept stroke (docs/DESIGN.md §1). */
  readonly accepted: boolean;
  readonly onAccept: () => void;
  readonly onRequestAlternative: () => void;
  readonly onChooseSelf: () => void;
}

function SuggestionView(props: SuggestionViewProps): JSX.Element {
  const { result, meal, reduceMotionEnabled, accepted, onAccept, onRequestAlternative, onChooseSelf } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <>
      <View style={styles.heroBlock}>
        <DecisionCard
          dishTitle={meal?.title ?? 'Onbekend gerecht'}
          thumbnailUrl={meal?.thumbnailUrl ?? null}
          /* The REDEN block is gone (see DecisionCard's header). `reasonText`
             is still composed by `decide()` and still persisted on the
             decisions row above; what reaches the card is only the friend
             sentence, and only when a real friend cooked this dish. */
          friendLine={buildFriendProofLine(result.reasonCode, result.reasonText)}
          estimatedMinutes={meal?.estimatedMinutes ?? null}
          reduceMotionEnabled={reduceMotionEnabled}
          accepted={accepted}
        />
      </View>
      <View style={[styles.actionZone, { borderTopColor: colors.border }]}>
        <VanavondActionRow
          alternativesRemaining={result.alternativesRemaining}
          onAccept={onAccept}
          onRequestAlternative={onRequestAlternative}
          onChooseSelf={onChooseSelf}
        />
      </View>
    </>
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
  actionZone: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    // THE BUTTONS SIT AS LOW AS THIS SCREEN CAN PUT THEM, AND UNTIL
    // 7 SEPTEMBER 2026 THEY DID NOT. `content` fills the scene and
    // `heroBlock` takes every spare point above, so this zone is already
    // flush against the bottom of the tab scene; `space6` is the entire
    // distance between the buttons and the tab bar.
    //
    // It used to add `insets.bottom` on top of that, and that is what the
    // owner was looking at when he said "the yes and something else button
    // for selecting the recipe should move down". Kiezen is a TAB screen:
    // expo-router 57's BottomTabView renders the scene and the tab bar as
    // SIBLINGS in a column, and `getTabBarHeight` adds `insets.bottom` to
    // the bar's own height (build/react-navigation/bottom-tabs/views/). The
    // home indicator is therefore already cleared by the bar, and re-adding
    // the window inset here reserved the same ~34 pt a second time — a band
    // of empty background between the buttons and the tab bar, on every
    // phone that has an inset at all. The other three tab screens never did
    // this; only this one did, which is the shape of a copied line rather
    // than a decision.
    //
    // Honest limit: on a phone whose `insets.bottom` is 0 nothing moves,
    // because nothing was being reserved. The rejected alternative was
    // shrinking `space6` as well — that moves the row by a number nobody
    // can argue for and leaves the double count in place for the next
    // person to find.
    paddingBottom: spacing.space6,
    gap: spacing.space3,
  },
  outcomeOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
});

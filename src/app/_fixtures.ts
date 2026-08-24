/**
 * FIXTURE DATA — NOT REAL.
 *
 * Once every screen under src/app read through `RemyRepository` and a
 * fresh install genuinely starts empty (no curated starter set — see
 * docs/DESIGN.md's "the honest first-run state"), the only thing left
 * worth faking here is the `__DEV__`-only scenario row on Kiezen
 * (src/app/(tabs)/index.tsx), which lets every `DecisionResult` branch be
 * exercised on device without needing real seeded data. Household/member/
 * meal/save/cook-event fixtures used to live here too, feeding
 * `src/lib/repository/seedData.ts`'s fresh-install seed — that seed is now
 * genuinely empty (a bare default household only, see seedData.ts), so
 * those fixtures were deleted rather than left as dead exports.
 *
 * Nothing in src/domain or src/lib imports this file — fixtures flow one
 * direction, into screens only. Do not import Supabase or any I/O client
 * here; this module is pure data.
 */

import type { DecisionResult } from '@/domain/types';

// ---------------------------------------------------------------------------
// Kiezen decision session (dev-scenario row only)
//
// Simulates what src/domain/decide.ts would return across one evening's
// "Iets anders" taps: index 0 is the original offer (alternativesRemaining:
// 2), index 1 the first swap (1), index 2 the second and final swap (0).
// This is fixture sequencing only — no decision logic lives here, and the
// meal ids below don't need to resolve to a real stored meal (the dev row
// exists precisely to exercise the UI without a seeded household).
// ---------------------------------------------------------------------------

// T3: typed as a non-empty tuple (not `readonly DecisionResult[]`) so
// `fixtureDecisionSession[0]` is provably defined at the type level.
export const fixtureDecisionSession: readonly [DecisionResult, ...DecisionResult[]] = [
  {
    kind: 'suggestion',
    mealId: 'meal-1',
    reasonCode: 'not_recent',
    reasonText: 'Je at dit al 3 weken niet, en het past binnen 25 minuten.',
    alternativesRemaining: 2,
  },
  {
    kind: 'suggestion',
    mealId: 'meal-2',
    reasonCode: 'fits_time',
    reasonText: 'Snel klaar en alle ingrediënten heb je waarschijnlijk al in huis.',
    alternativesRemaining: 1,
  },
  {
    kind: 'suggestion',
    mealId: 'meal-4',
    reasonCode: 'household_favourite',
    reasonText: 'Dit kookt dit huishouden vaker dan gemiddeld.',
    alternativesRemaining: 0,
  },
];

/** Standalone `no_candidate` scenarios, one per reason, for demoing each state. */
export const fixtureNoCandidateEmptyRotation: DecisionResult = {
  kind: 'no_candidate',
  reason: 'empty_rotation',
};

export const fixtureNoCandidateAllExcluded: DecisionResult = {
  kind: 'no_candidate',
  reason: 'all_excluded',
};

export const fixtureNoCandidateSwapsExhausted: DecisionResult = {
  kind: 'no_candidate',
  reason: 'swaps_exhausted',
};

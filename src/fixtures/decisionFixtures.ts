/**
 * FIXTURE DATA — NOT REAL. Kiezen's `__DEV__` scenario row, and the
 * directory-level argument the other four fixture modules point back at.
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
 * WHY src/fixtures/ EXISTS, AND WHY THIS FILE IS NOT src/app/_fixtures.ts
 * ANY MORE. It sat directly under the routes directory, named
 * `_fixtures.ts`, on the belief that the leading underscore kept
 * expo-router away from it. It does not, and never did. expo-router builds
 * its route table from a `require.context` over the whole app root whose
 * only exclusions are `+api` and `+html` (expo-router/_ctx.js, SDK 57), so
 * EVERY `.ts`/`.tsx` file under src/app becomes a route node — and a route
 * node with no default export is a warning on every single launch:
 *
 *     WARN  Route "./_fixtures.ts" is missing the required default export.
 *
 * There were nine such files and therefore nine such warnings. Only
 * `_layout` is special to the router; the underscore is a naming
 * convention this codebase borrowed from Next.js-shaped tools and mistook
 * for a rule, and four separate headers argued from that mistake as
 * though it were checked. Leaving the routes directory is the only thing
 * that actually removes a module from the router's view.
 *
 * WHY ONE DIRECTORY RATHER THAN BESIDE EACH CONSUMER. The path is the
 * warning label. `@/fixtures/**` names everything in this app that is
 * invented, so `grep -rn "@/fixtures" src/` is a complete, one-command
 * answer to "what still depends on fake data?" — a question that could
 * not be answered at all while five fixture modules hid behind an
 * underscore in four different route folders. The rejected alternative
 * was co-locating each fixture with the screen family it serves
 * (src/components/friendFeedFixtures.ts and so on), which spreads the
 * fake data back out and puts data modules in a directory that is
 * otherwise presentation.
 *
 * THE ONE-DIRECTION RULE, RESTATED HONESTLY. This paragraph used to read
 * "Nothing in src/domain or src/lib imports this file — fixtures flow one
 * direction, into screens only." Half of that was true and half of it was
 * already false when it was written: `gekooktSource.ts` and
 * `trendingSource.ts` have imported fixtures the whole time, and only the
 * fact that they lived under src/app kept the sentence technically
 * standing. The honest rule is the narrower one, and it is checkable:
 * **src/domain imports nothing from here, ever** — the decision engine and
 * its pure logic must never be able to see invented data — and in src/lib
 * only the two source modules whose entire job is to choose between a
 * fixture and a repository. Both of those die the day their repositories
 * are complete, and these files die with them.
 *
 * Do not import Supabase or any I/O client here; this module is pure data.
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

/**
 * PD-009. Worth its own dev scenario rather than folding into
 * `fixtureNoCandidateAllExcluded` above: the two states look nearly
 * identical in a screenshot and differ in the things that matter (which
 * action is primary, and whether the copy points at the user's standing
 * settings or at a chip they can un-tap), so they need to be checkable
 * side by side on device.
 */
export const fixtureNoCandidateFilteredOut: DecisionResult = {
  kind: 'no_candidate',
  reason: 'filtered_out',
};

export const fixtureNoCandidateSwapsExhausted: DecisionResult = {
  kind: 'no_candidate',
  reason: 'swaps_exhausted',
};

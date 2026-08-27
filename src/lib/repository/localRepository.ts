/**
 * The local (AsyncStorage-backed, works on native + web) `RemyRepository`
 * implementation. Every method below is a one-line delegation to the
 * matching function in `local/*.ts`, which is where the actual query/
 * mutation logic — and its test coverage — lives. This file's only job is
 * to be the thing that satisfies the `RemyRepository` interface so a
 * future `supabaseRepository.ts` can be dropped in beside it unchanged.
 *
 * ============================================================================
 * THE WRITE-THROUGH MIRROR IS INJECTED, NEVER IMPORTED
 * ============================================================================
 *
 * Seven of the methods below announce what they wrote to a `MirrorJobSink`,
 * so src/lib/repository/mirror/** can put those rows in Postgres. The sink
 * is a PARAMETER with a no-op default, and that is the single most
 * important decision in this file.
 *
 * WHY NOT `import { mirrorWriteThrough }` HERE. It would need a Supabase
 * client, which means importing src/lib/supabase.ts — a module that THROWS
 * AT MODULE SCOPE when the env vars are absent and therefore cannot be
 * loaded under Vite at all. Every suite in tests/repository/** would stop
 * running, this file would stop being usable with no network, and the
 * offline path would depend on an online module. createRepository.ts is
 * where the Supabase client already legitimately lives, so that is where
 * the sink is bound.
 *
 * WHY THE SINK CANNOT BECOME A SECOND SOURCE OF TRUTH, structurally rather
 * than by convention. Three properties, each load-bearing:
 *   - It RETURNS `void`. There is no value for a repository method to read
 *     back, so nothing the mirror learns can reach the local store.
 *   - It is called AFTER the local write has resolved, and is handed the
 *     value that write already produced. It cannot alter what was stored,
 *     because storing has finished.
 *   - It has NO READ VERB. `(job) => void` cannot be asked a question. A
 *     second source of truth needs a way back in; there is none, and
 *     adding one would mean changing this type.
 * The default is a no-op, so a repository built with no sink at all is a
 * complete, working, offline repository — which is what every existing
 * test constructs, and what this file remains on its own.
 *
 * NOTHING BELOW AWAITS THE SINK, AND NOTHING BELOW LETS IT FAIL A WRITE.
 * The local write is the one that must succeed and it already has. A meal
 * job needs two further reads to assemble its ingredients and steps, so it
 * is built on a promise the method deliberately does not wait for; a sink
 * that throws is swallowed, because failing a save over a broken mirror
 * would be failing a save because a phone is in a lift.
 *
 * WHICH METHODS, AND THE ONE DELIBERATE ABSENCE. Meals (`createMeal`,
 * `setMealCookProofExclusion`, `addMealDishMood`), cook events
 * (`createCookEvent`, `setCookEventRepeat`, `setCookEventRating`) and
 * cook-sharing consent (`setHouseholdCookSharing`) — exactly the rows the
 * social surfaces read. NOT `updateHouseholdSettings`: consent was kept
 * out of that method on purpose (see `RemyRepository`'s comment on it) so
 * a stale settings spread cannot flip it as a side effect, and mirroring
 * both behind one job would reunite them at the seam instead. Saves,
 * decisions, members and restrictions stay local — nothing outside a
 * household reads them, and `member_restrictions` is GDPR Article 9 health
 * data whose blast radius is not worth widening.
 */

import type { KeyValueStore } from './keyValueStore';
import { createRepositoryTables } from './local/tables';
import {
  createMember,
  createRestriction,
  getCurrentHouseholdId,
  getHousehold,
  getHouseholdCookSharing,
  getHouseholdCookSharingAsked,
  listMembers,
  listRestrictions,
  markHouseholdCookSharingAsked,
  removeMember,
  removeRestriction,
  setHouseholdCookSharing,
  setMemberHealthDataConsent,
  updateHouseholdSettings,
} from './local/household';
import {
  addMealDishMood,
  createMeal,
  getMeal,
  getMealCookProofExclusion,
  getMealIngredients,
  getMealSteps,
  listHouseholdMeals,
  setMealCookProofExclusion,
} from './local/meals';
import { createSave, listPendingSaves, listSaves } from './local/saves';
import { createCookEvent, listCookEvents, setCookEventRating, setCookEventRepeat } from './local/cookEvents';
import {
  createDecision,
  getDecisionByDate,
  getPendingOutcomeDecision,
  listRecentDecisions,
  respondToDecision,
  setDecisionDeclineReason,
  updateDecisionOffer,
} from './local/decisions';
import { seedIfEmpty } from './local/seed';
import type { MirrorJob, MirrorMealJob } from './mirror/types';
import type { RemyRepository } from './types';
import type { CookEvent, HouseholdId, Meal } from '@/domain/types';

/**
 * The whole of the mirror's presence in this file: one function, one
 * argument, no return value. See the module header on why it is a
 * parameter and why nothing shaped like this can become a second source of
 * truth.
 *
 * A TYPE-ONLY import of `MirrorJob` rather than a locally re-declared
 * union: `import type` is erased at compile time, so this file still pulls
 * nothing from ./mirror at runtime, while a second copy of the job
 * vocabulary would be a second thing to keep in step with rows.ts.
 */
export type MirrorJobSink = (job: MirrorJob) => void;

/** The default. A repository with no mirror is a complete, offline repository. */
const NO_MIRROR: MirrorJobSink = () => {};

export function createLocalRepository(store: KeyValueStore, mirror: MirrorJobSink = NO_MIRROR): RemyRepository {
  const tables = createRepositoryTables(store);

  /**
   * Hand a finished job over, and absorb anything the sink does about it.
   * The local write has already committed by the time this runs, so there
   * is no outcome here that a caller could act on and none that may be
   * allowed to reach them.
   */
  function announce(job: MirrorJob): void {
    try {
      mirror(job);
    } catch {
      // A broken mirror is not a broken save.
    }
  }

  /**
   * A meal and its two child sets travel as ONE job — a meal missing its
   * ingredients is not a smaller recipe, it is a wrong one — which costs
   * the two reads below. They happen on a promise the caller never sees:
   * the repository method has already returned by the time this resolves.
   */
  async function collectMealJob(meal: Meal): Promise<MirrorMealJob> {
    const [ingredients, steps] = await Promise.all([
      getMealIngredients(tables, meal.id),
      getMealSteps(tables, meal.id),
    ]);
    return { kind: 'meal', meal, ingredients, steps };
  }

  /** Fire and forget, with both handlers — an escaped rejection here would be an unhandled one. */
  function announceMeal(meal: Meal): void {
    void collectMealJob(meal).then(announce, () => {});
  }

  function announceCookEvent(event: CookEvent): void {
    announce({ kind: 'cook_event', event });
  }

  function announceCookSharing(householdId: HouseholdId, shareCooksWithFriends: boolean): void {
    announce({ kind: 'household_settings', householdId, shareCooksWithFriends });
  }

  return {
    getCurrentHouseholdId: () => getCurrentHouseholdId(tables),
    getHousehold: (householdId) => getHousehold(tables, householdId),
    updateHouseholdSettings: (householdId, input) => updateHouseholdSettings(tables, householdId, input),
    getHouseholdCookSharing: (householdId) => getHouseholdCookSharing(tables, householdId),
    // Consent, and the ONLY method that mirrors it. `updateHouseholdSettings`
    // above deliberately does not — see the module header.
    setHouseholdCookSharing: async (householdId, shareCooksWithFriends) => {
      const household = await setHouseholdCookSharing(tables, householdId, shareCooksWithFriends);
      announceCookSharing(householdId, shareCooksWithFriends);
      return household;
    },
    getHouseholdCookSharingAsked: (householdId) => getHouseholdCookSharingAsked(tables, householdId),
    markHouseholdCookSharingAsked: (householdId) => markHouseholdCookSharingAsked(tables, householdId),

    listMembers: (householdId) => listMembers(tables, householdId),
    createMember: (input) => createMember(tables, input),
    removeMember: (memberId) => removeMember(tables, memberId),
    setMemberHealthDataConsent: (memberId, consentAt) => setMemberHealthDataConsent(tables, memberId, consentAt),

    listRestrictions: (householdId) => listRestrictions(tables, householdId),
    createRestriction: (input) => createRestriction(tables, input),
    removeRestriction: (restrictionId) => removeRestriction(tables, restrictionId),

    listHouseholdMeals: (householdId) => listHouseholdMeals(tables, householdId),
    getMeal: (mealId) => getMeal(tables, mealId),
    getMealIngredients: (mealId) => getMealIngredients(tables, mealId),
    getMealSteps: (mealId) => getMealSteps(tables, mealId),
    createMeal: async (input) => {
      const meal = await createMeal(tables, input);
      announceMeal(meal);
      return meal;
    },
    getMealCookProofExclusion: (mealId) => getMealCookProofExclusion(tables, mealId),
    setMealCookProofExclusion: async (mealId, excludedFromCookProof) => {
      const meal = await setMealCookProofExclusion(tables, mealId, excludedFromCookProof);
      announceMeal(meal);
      return meal;
    },
    addMealDishMood: async (mealId, mood) => {
      const meal = await addMealDishMood(tables, mealId, mood);
      announceMeal(meal);
      return meal;
    },

    listSaves: (householdId) => listSaves(tables, householdId),
    listPendingSaves: (householdId, intent) => listPendingSaves(tables, householdId, intent),
    createSave: (input) => createSave(tables, input),

    listCookEvents: (householdId) => listCookEvents(tables, householdId),
    createCookEvent: async (input) => {
      const event = await createCookEvent(tables, input);
      announceCookEvent(event);
      return event;
    },
    setCookEventRepeat: async (cookEventId, wouldRepeat) => {
      const event = await setCookEventRepeat(tables, cookEventId, wouldRepeat);
      announceCookEvent(event);
      return event;
    },
    setCookEventRating: async (cookEventId, rating) => {
      const event = await setCookEventRating(tables, cookEventId, rating);
      announceCookEvent(event);
      return event;
    },
    getPendingOutcomeDecision: (householdId) => getPendingOutcomeDecision(tables, householdId),

    listRecentDecisions: (householdId, sinceDate) => listRecentDecisions(tables, householdId, sinceDate),
    getDecisionByDate: (householdId, decisionDate) => getDecisionByDate(tables, householdId, decisionDate),
    createDecision: (input) => createDecision(tables, input),
    updateDecisionOffer: (decisionId, offer) => updateDecisionOffer(tables, decisionId, offer),
    respondToDecision: (decisionId, input) => respondToDecision(tables, decisionId, input),
    setDecisionDeclineReason: (decisionId, declineReason) =>
      setDecisionDeclineReason(tables, decisionId, declineReason),

    seedIfEmpty: () => seedIfEmpty(tables),
  };
}

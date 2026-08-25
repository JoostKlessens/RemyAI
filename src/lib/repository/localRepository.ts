/**
 * The local (AsyncStorage-backed, works on native + web) `RemyRepository`
 * implementation. Every method below is a one-line delegation to the
 * matching function in `local/*.ts`, which is where the actual query/
 * mutation logic — and its test coverage — lives. This file's only job is
 * to be the thing that satisfies the `RemyRepository` interface so a
 * future `supabaseRepository.ts` can be dropped in beside it unchanged.
 */

import type { KeyValueStore } from './keyValueStore';
import { createRepositoryTables } from './local/tables';
import {
  createMember,
  createRestriction,
  getCurrentHouseholdId,
  getHousehold,
  listMembers,
  listRestrictions,
  removeMember,
  removeRestriction,
  setMemberHealthDataConsent,
  updateHouseholdSettings,
} from './local/household';
import { createMeal, getMeal, getMealIngredients, getMealSteps, listHouseholdMeals } from './local/meals';
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
import type { RemyRepository } from './types';

export function createLocalRepository(store: KeyValueStore): RemyRepository {
  const tables = createRepositoryTables(store);

  return {
    getCurrentHouseholdId: () => getCurrentHouseholdId(tables),
    getHousehold: (householdId) => getHousehold(tables, householdId),
    updateHouseholdSettings: (householdId, input) => updateHouseholdSettings(tables, householdId, input),

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
    createMeal: (input) => createMeal(tables, input),

    listSaves: (householdId) => listSaves(tables, householdId),
    listPendingSaves: (householdId, intent) => listPendingSaves(tables, householdId, intent),
    createSave: (input) => createSave(tables, input),

    listCookEvents: (householdId) => listCookEvents(tables, householdId),
    createCookEvent: (input) => createCookEvent(tables, input),
    setCookEventRepeat: (cookEventId, wouldRepeat) => setCookEventRepeat(tables, cookEventId, wouldRepeat),
    setCookEventRating: (cookEventId, rating) => setCookEventRating(tables, cookEventId, rating),
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

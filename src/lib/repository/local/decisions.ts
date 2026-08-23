/**
 * Decision reads/writes — "decision responses" (accept/decline/swap) and
 * PD-003's outcome-pending lookup.
 *
 * `createDecision` is an upsert-by-date on purpose: (householdId,
 * decisionDate) is unique in supabase/migrations/0001_init.sql, and React
 * effects can double-invoke in development (StrictMode) — silently
 * returning the existing row instead of throwing or duplicating keeps
 * Vanavond's mount-time "create today's decision if none exists" logic
 * safe to call more than once.
 */

import type { Decision, DecisionId, DeclineReason, HouseholdId, IsoDateString } from '@/domain/types';
import type { CreateDecisionInput, RespondToDecisionInput } from '../types';
import { generateLocalId } from '../id';
import { nowIso } from '../clock';
import type { RepositoryTables } from './tables';

export async function listRecentDecisions(
  tables: RepositoryTables,
  householdId: HouseholdId,
  sinceDate: IsoDateString,
): Promise<readonly Decision[]> {
  const decisions = await tables.decisions.list();
  return decisions.filter((decision) => decision.householdId === householdId && decision.decisionDate >= sinceDate);
}

export async function getDecisionByDate(
  tables: RepositoryTables,
  householdId: HouseholdId,
  decisionDate: IsoDateString,
): Promise<Decision | null> {
  const decisions = await tables.decisions.list();
  return (
    decisions.find((decision) => decision.householdId === householdId && decision.decisionDate === decisionDate) ??
    null
  );
}

export async function createDecision(tables: RepositoryTables, input: CreateDecisionInput): Promise<Decision> {
  const existing = await getDecisionByDate(tables, input.householdId, input.decisionDate);
  if (existing !== null) {
    return existing;
  }

  const decision: Decision = {
    id: generateLocalId('decision'),
    householdId: input.householdId,
    decisionDate: input.decisionDate,
    mealId: input.mealId,
    initialMealId: input.initialMealId,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    status: 'pending',
    declineReason: null,
    createdAt: nowIso(),
    respondedAt: null,
  };

  const decisions = await tables.decisions.list();
  await tables.decisions.replaceAll([...decisions, decision]);
  return decision;
}

async function updateDecision(
  tables: RepositoryTables,
  decisionId: DecisionId,
  apply: (decision: Decision) => Decision,
): Promise<Decision> {
  const decisions = await tables.decisions.list();
  let updated: Decision | undefined;
  const next = decisions.map((decision) => {
    if (decision.id !== decisionId) {
      return decision;
    }
    updated = apply(decision);
    return updated;
  });
  if (updated === undefined) {
    throw new Error(`No decision found with id "${decisionId}".`);
  }
  await tables.decisions.replaceAll(next);
  return updated;
}

/**
 * "Iets anders" (PD-001 swap): advances the current offer without touching
 * initialMealId or status. reasonCode/reasonText are updated together with
 * mealId — this codebase doesn't persist decision_alternatives (see the
 * top-level report), so the main decisions row's reasonCode/reasonText is
 * this app's only record of "why the CURRENTLY offered meal was picked";
 * leaving it pointing at the pre-swap meal's reason would make a reloaded
 * decision describe the wrong dish.
 */
export async function updateDecisionOffer(
  tables: RepositoryTables,
  decisionId: DecisionId,
  offer: Pick<Decision, 'mealId' | 'reasonCode' | 'reasonText'>,
): Promise<Decision> {
  return updateDecision(tables, decisionId, (decision) => ({ ...decision, ...offer }));
}

export async function respondToDecision(
  tables: RepositoryTables,
  decisionId: DecisionId,
  input: RespondToDecisionInput,
): Promise<Decision> {
  return updateDecision(tables, decisionId, (decision) => ({
    ...decision,
    status: input.status,
    respondedAt: nowIso(),
  }));
}

export async function setDecisionDeclineReason(
  tables: RepositoryTables,
  decisionId: DecisionId,
  declineReason: DeclineReason,
): Promise<Decision> {
  return updateDecision(tables, decisionId, (decision) => ({ ...decision, declineReason }));
}

/** PD-003: the most recent accepted decision with no recorded outcome yet — a left join from decisions to cook_events on decisionId, same as the migration's own comment describes. */
export async function getPendingOutcomeDecision(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<Decision | null> {
  const [decisions, cookEvents] = await Promise.all([tables.decisions.list(), tables.cookEvents.list()]);
  const decidedDecisionIds = new Set(
    cookEvents.filter((event) => event.decisionId !== null).map((event) => event.decisionId),
  );
  const candidates = decisions
    .filter(
      (decision) =>
        decision.householdId === householdId && decision.status === 'accepted' && !decidedDecisionIds.has(decision.id),
    )
    .sort((a, b) => (a.decisionDate < b.decisionDate ? 1 : -1));
  return candidates[0] ?? null;
}

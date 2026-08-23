/**
 * Cook event reads/writes — the outcome loop (PD-003): "Gemaakt?" creates
 * the row, "Nog een keer?" fills in `wouldRepeat` on it.
 */

import type { CookEvent, CookEventId, HouseholdId } from '@/domain/types';
import type { CreateCookEventInput } from '../types';
import { generateLocalId } from '../id';
import { nowIso } from '../clock';
import type { RepositoryTables } from './tables';

export async function listCookEvents(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<readonly CookEvent[]> {
  const cookEvents = await tables.cookEvents.list();
  return cookEvents.filter((event) => event.householdId === householdId);
}

export async function createCookEvent(
  tables: RepositoryTables,
  input: CreateCookEventInput,
): Promise<CookEvent> {
  const cookEvent: CookEvent = {
    id: generateLocalId('cook-event'),
    householdId: input.householdId,
    mealId: input.mealId,
    decisionId: input.decisionId,
    cookedOn: input.cookedOn,
    wouldRepeat: null,
    createdAt: nowIso(),
  };

  const existing = await tables.cookEvents.list();
  await tables.cookEvents.replaceAll([...existing, cookEvent]);
  return cookEvent;
}

export async function setCookEventRepeat(
  tables: RepositoryTables,
  cookEventId: CookEventId,
  wouldRepeat: boolean,
): Promise<CookEvent> {
  const existing = await tables.cookEvents.list();
  let updated: CookEvent | undefined;
  const next = existing.map((event) => {
    if (event.id !== cookEventId) {
      return event;
    }
    updated = { ...event, wouldRepeat };
    return updated;
  });
  if (updated === undefined) {
    throw new Error(`No cook event found with id "${cookEventId}".`);
  }
  await tables.cookEvents.replaceAll(next);
  return updated;
}

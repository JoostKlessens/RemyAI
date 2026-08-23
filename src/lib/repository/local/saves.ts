/**
 * Save reads/writes.
 *
 * `listPendingSaves` is what feeds DecisionRequest.pendingThisWeekSaves /
 * pendingSomedaySaves (PD-004a) — see decisions.ts for the DecisionRequest
 * assembly. "Pending" here means "the meal hasn't been cooked since this
 * save was made": once cooked, the household got what it saved the meal
 * for, so continuing to boost its score forever would be wrong. This is a
 * deliberately simple rule — supabase/migrations/0001_init.sql has no
 * `resolved_at`/`served_at` column on `saves`, and adding proper swap/
 * decision-alternative history tracking is out of this task's scope (see
 * the top-level report).
 */

import type { HouseholdId, MealId, Save, SaveIntent } from '@/domain/types';
import type { CreateSaveInput } from '../types';
import { generateLocalId } from '../id';
import { nowIso } from '../clock';
import type { RepositoryTables } from './tables';

export async function listSaves(tables: RepositoryTables, householdId: HouseholdId): Promise<readonly Save[]> {
  const saves = await tables.saves.list();
  return saves.filter((save) => save.householdId === householdId);
}

async function hasBeenCookedSince(tables: RepositoryTables, mealId: MealId, savedAt: string): Promise<boolean> {
  const cookEvents = await tables.cookEvents.list();
  return cookEvents.some((event) => event.mealId === mealId && event.cookedOn >= savedAt.slice(0, 10));
}

export async function listPendingSaves(
  tables: RepositoryTables,
  householdId: HouseholdId,
  intent: SaveIntent,
): Promise<readonly Save[]> {
  const saves = await listSaves(tables, householdId);
  const candidates = saves.filter((save) => save.intent === intent);
  const pendingFlags = await Promise.all(
    candidates.map((save) => hasBeenCookedSince(tables, save.mealId, save.savedAt)),
  );
  return candidates.filter((_save, index) => !pendingFlags[index]);
}

export async function createSave(tables: RepositoryTables, input: CreateSaveInput): Promise<Save> {
  const save: Save = {
    id: generateLocalId('save'),
    householdId: input.householdId,
    memberId: input.memberId,
    mealId: input.mealId,
    intent: input.intent,
    sourceUrl: input.sourceUrl,
    savedAt: nowIso(),
  };

  const existing = await tables.saves.list();
  await tables.saves.replaceAll([...existing, save]);
  return save;
}

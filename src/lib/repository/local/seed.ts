/**
 * Populates every table from src/app/_fixtures.ts's demo data, but ONLY on
 * a genuinely fresh install (the `households` table is empty). Once a
 * household exists — whether from a prior seed or from real onboarding
 * writes in the future — this is a permanent no-op, so a returning user's
 * real saves/cook history are never clobbered by demo data on restart.
 */

import { buildSeedRows } from '../seedData';
import type { RepositoryTables } from './tables';

export async function seedIfEmpty(tables: RepositoryTables): Promise<void> {
  const existingHouseholds = await tables.households.list();
  if (existingHouseholds.length > 0) {
    return;
  }

  const seed = buildSeedRows();
  await Promise.all([
    tables.households.replaceAll(seed.households),
    tables.members.replaceAll(seed.members),
    tables.restrictions.replaceAll(seed.restrictions),
    tables.meals.replaceAll(seed.meals),
    tables.mealIngredients.replaceAll([]),
    tables.mealSteps.replaceAll(seed.mealSteps),
    tables.saves.replaceAll(seed.saves),
    tables.cookEvents.replaceAll(seed.cookEvents),
    tables.decisions.replaceAll(seed.decisions),
  ]);
}

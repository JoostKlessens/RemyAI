/**
 * Populates the `households` table with one default household, but ONLY on
 * a genuinely fresh install (the `households` table is empty) — see
 * seedData.ts for why that's the ONLY thing seeded: an honest empty first
 * run, per the founder's brief, not a curated starter set. Once a household
 * exists — whether from a prior seed or from real settings-screen writes —
 * this is a permanent no-op, so a returning user's real recipes/saves/cook
 * history are never clobbered on restart.
 */

import { buildSeedRows } from '../seedData';
import type { RepositoryTables } from './tables';

export async function seedIfEmpty(tables: RepositoryTables): Promise<void> {
  const existingHouseholds = await tables.households.list();
  if (existingHouseholds.length > 0) {
    return;
  }

  const seed = buildSeedRows();
  await tables.households.replaceAll(seed.households);
}

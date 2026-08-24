/**
 * Builds the row set `localRepository.ts`'s `seedIfEmpty()` writes on a
 * genuinely fresh install.
 *
 * The founder's brief is explicit: no curated starter set, no fixture
 * households, no spook recipes — a fresh install must be honestly empty.
 * The ONLY thing seeded is a single default household (so the decision
 * engine, settings screen, and repository always have exactly one
 * household to talk to — see localRepository.ts's own note on
 * `getCurrentHouseholdId` standing in for real auth) — no members, no
 * restrictions, no meals, no saves, no cook history. This used to build
 * everything from src/app/_fixtures.ts's demo data; that import is gone on
 * purpose, so a fresh install can never again accidentally ship a fake
 * household full of meals nobody added.
 */

import { generateLocalId } from './id';
import { nowIso } from './clock';
import type { Household } from '@/domain/types';

export interface SeedRows {
  readonly households: readonly Household[];
}

const DEFAULT_WEEKNIGHT_TIME_BUDGET_MINUTES = 30;

function buildDefaultHousehold(): Household {
  return {
    id: generateLocalId('household'),
    name: 'Mijn huishouden',
    timezone: 'Europe/Amsterdam',
    decisionPushTime: '16:00',
    weeknightTimeBudgetMinutes: DEFAULT_WEEKNIGHT_TIME_BUDGET_MINUTES,
    skillLevel: 'intermediate',
    createdAt: nowIso(),
  };
}

export function buildSeedRows(): SeedRows {
  return {
    households: [buildDefaultHousehold()],
  };
}

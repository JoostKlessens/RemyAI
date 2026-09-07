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

/**
 * THE ONE PLACE THAT WILL HAVE TO WRITE `shareCooksWithFriends: true`, and
 * it deliberately does not yet.
 *
 * Migration 0015 made cook sharing the default in Postgres — the owner's
 * instruction, verbatim: "it should be standard that you share it with
 * friends." The row below omits the field, so `getHouseholdCookSharing`
 * normalises it to `false`, and today that is RIGHT rather than an
 * oversight. Every household this app has is a local one, the local store
 * is the source of truth for everything the app writes, and a fresh
 * install reaches the on state the honest way: through the pre-checked
 * contextual ask (`CookSharingAskSheet`), which puts the disclosure on
 * screen before anything is shared. Seeding `true` here would turn sharing
 * on for a household that has been shown nothing, which is the exact move
 * 0015's own header refuses to make from a migration.
 *
 * IT STOPS BEING RIGHT THE MOMENT A LOCAL HOUSEHOLD IS CREATED ON THE
 * SERVER'S TERMS — when sync arrives and this row is meant to mirror a
 * Postgres row that took the 0015 default. This function is then where the
 * two defaults have to be reconciled, and the reconciliation is one line.
 *
 * Written down because a correct-by-accident default is the kind that
 * stops being correct silently: nothing else here names 0015, no test
 * asserts the omission, and the next reader has no way to tell a
 * deliberate absence from a forgotten field.
 */
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

/**
 * Household / members / restrictions reads.
 *
 * Read-only in this pass: no onboarding screen writes through the
 * repository yet (see the top-level report for why that's out of scope
 * here) — `seed.ts`'s `seedIfEmpty` is currently the only writer of these
 * three tables. `getCurrentHouseholdId` stands in for "the authenticated
 * user's household" until real auth exists: this on-device install always
 * has exactly one household, the seeded one.
 */

import type { Household, HouseholdId, Member, Restriction } from '@/domain/types';
import type { RepositoryTables } from './tables';

export async function getCurrentHouseholdId(tables: RepositoryTables): Promise<HouseholdId> {
  const households = await tables.households.list();
  const first = households[0];
  if (first === undefined) {
    throw new Error('No household exists yet — seedIfEmpty() should have run before this was called.');
  }
  return first.id;
}

export async function getHousehold(tables: RepositoryTables, householdId: HouseholdId): Promise<Household | null> {
  const households = await tables.households.list();
  return households.find((household) => household.id === householdId) ?? null;
}

export async function listMembers(tables: RepositoryTables, householdId: HouseholdId): Promise<readonly Member[]> {
  const members = await tables.members.list();
  return members.filter((member) => member.householdId === householdId);
}

export async function listRestrictions(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<readonly Restriction[]> {
  const [restrictions, members] = await Promise.all([tables.restrictions.list(), listMembers(tables, householdId)]);
  const memberIds = new Set(members.map((member) => member.id));
  return restrictions.filter((restriction) => memberIds.has(restriction.memberId));
}

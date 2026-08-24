/**
 * Household / members / restrictions reads AND writes.
 *
 * `getCurrentHouseholdId` stands in for "the authenticated user's
 * household" until real auth exists: this on-device install always has
 * exactly one household, the one `seedIfEmpty` created (see seedData.ts).
 *
 * The write methods below back the household settings screen
 * (src/app/settings.tsx) — the only place left, once onboarding is gone,
 * to enter the weeknight time budget and PD-006's household-level dislikes/
 * allergen restrictions. Without them, `src/domain/exclusions.ts` can never
 * exclude anything for a real household: it reads restrictions that
 * nothing ever wrote.
 */

import type {
  Household,
  HouseholdId,
  IsoDateTimeString,
  Member,
  MemberId,
  Restriction,
  RestrictionId,
} from '@/domain/types';
import type { CreateMemberInput, CreateRestrictionInput, UpdateHouseholdSettingsInput } from '../types';
import { generateLocalId } from '../id';
import { nowIso } from '../clock';
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

export async function updateHouseholdSettings(
  tables: RepositoryTables,
  householdId: HouseholdId,
  input: UpdateHouseholdSettingsInput,
): Promise<Household> {
  const households = await tables.households.list();
  let updated: Household | undefined;
  const next = households.map((household) => {
    if (household.id !== householdId) {
      return household;
    }
    updated = { ...household, weeknightTimeBudgetMinutes: input.weeknightTimeBudgetMinutes };
    return updated;
  });
  if (updated === undefined) {
    throw new Error(`No household found with id "${householdId}".`);
  }
  await tables.households.replaceAll(next);
  return updated;
}

export async function listMembers(tables: RepositoryTables, householdId: HouseholdId): Promise<readonly Member[]> {
  const members = await tables.members.list();
  return members.filter((member) => member.householdId === householdId);
}

export async function createMember(tables: RepositoryTables, input: CreateMemberInput): Promise<Member> {
  const member: Member = {
    id: generateLocalId('member'),
    householdId: input.householdId,
    displayName: input.displayName,
    authUserId: null,
    healthDataConsentAt: null,
    createdAt: nowIso(),
  };

  const existing = await tables.members.list();
  await tables.members.replaceAll([...existing, member]);
  return member;
}

/**
 * A real delete, matching PD-005's hard-deletability requirement: removing
 * a member also removes every restriction attached to them, since a
 * restriction with no owning member is meaningless (and would otherwise
 * linger as orphaned health data — see removeRestriction's own comment).
 */
export async function removeMember(tables: RepositoryTables, memberId: MemberId): Promise<void> {
  const [members, restrictions] = await Promise.all([tables.members.list(), tables.restrictions.list()]);
  await Promise.all([
    tables.members.replaceAll(members.filter((member) => member.id !== memberId)),
    tables.restrictions.replaceAll(restrictions.filter((restriction) => restriction.memberId !== memberId)),
  ]);
}

export async function setMemberHealthDataConsent(
  tables: RepositoryTables,
  memberId: MemberId,
  consentAt: IsoDateTimeString | null,
): Promise<Member> {
  const members = await tables.members.list();
  let updated: Member | undefined;
  const next = members.map((member) => {
    if (member.id !== memberId) {
      return member;
    }
    updated = { ...member, healthDataConsentAt: consentAt };
    return updated;
  });
  if (updated === undefined) {
    throw new Error(`No member found with id "${memberId}".`);
  }
  await tables.members.replaceAll(next);
  return updated;
}

export async function listRestrictions(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<readonly Restriction[]> {
  const [restrictions, members] = await Promise.all([tables.restrictions.list(), listMembers(tables, householdId)]);
  const memberIds = new Set(members.map((member) => member.id));
  return restrictions.filter((restriction) => memberIds.has(restriction.memberId));
}

export async function createRestriction(
  tables: RepositoryTables,
  input: CreateRestrictionInput,
): Promise<Restriction> {
  const restriction: Restriction = {
    id: generateLocalId('restriction'),
    memberId: input.memberId,
    type: input.type,
    excludesTag: input.excludesTag,
    notes: input.notes,
    createdAt: nowIso(),
  };

  const existing = await tables.restrictions.list();
  await tables.restrictions.replaceAll([...existing, restriction]);
  return restriction;
}

/** PD-005: a real delete, reachable from the settings screen, so a member can un-tag a dislike/allergen without leaving residual data behind. */
export async function removeRestriction(tables: RepositoryTables, restrictionId: RestrictionId): Promise<void> {
  const restrictions = await tables.restrictions.list();
  await tables.restrictions.replaceAll(restrictions.filter((restriction) => restriction.id !== restrictionId));
}

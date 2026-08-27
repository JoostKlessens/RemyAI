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
 *
 * `getHouseholdCookSharing` / `setHouseholdCookSharing` back the same
 * screen's second, unrelated switch: PD-010 / DESIGN-SOCIAL.md §5's
 * cook-proof opt-in (`households.share_cooks_with_friends`, 0009). They
 * are their own pair rather than another field on
 * `UpdateHouseholdSettingsInput` because consent has to be given
 * unbundled — see the interface comment on `setHouseholdCookSharing` in
 * ../types.ts for the full argument. Like the restrictions above, the
 * column shipped with nothing in TypeScript able to write it, which meant
 * the opt-in defaulted off with no way to ever turn it on.
 *
 * `getHouseholdCookSharingAsked` / `markHouseholdCookSharingAsked` are the
 * third pair, and they record something different from either of the two
 * above: not what the household ANSWERED, but that the question was PUT.
 * §5 offers the opt-in "once, contextually, when the household's first
 * friendship is accepted... the question is asked once, not campaigned",
 * and without a durable record of having asked, the one-time sheet
 * (src/components/CookSharingAskSheet.tsx) re-fires on every remount —
 * which is the campaign §5 rules out, arriving by accident. See
 * `LocallyStoredHousehold` directly below for where the fact is kept and
 * what has to happen to it when sync eventually arrives.
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

/**
 * The household row AS THIS LOCAL STORE HOLDS IT: a `Household`, plus one
 * field that has no Postgres column behind it.
 *
 * WHY THE FIELD IS NOT ON `Household` (src/domain/types.ts). That type
 * mirrors the `households` table 1:1 — every field on it names a column
 * some migration created, and `shareCooksWithFriends` says so in its own
 * comment. `cookSharingAskedAt` names nothing: there is no migration for
 * it, and there cannot usefully be one yet, because a column added today
 * could not be applied to the running database anyway. Declaring it on the
 * domain type would put a promise in the contract that the Supabase
 * implementation cannot keep, and the next reader would have no way to
 * tell which of the two backends actually answers it. Declaring it HERE
 * says exactly the true thing: this is a fact the on-device store knows
 * and the server does not.
 *
 * WHY IT IS DURABLE RATHER THAN COMPONENT STATE. "Have we asked?" is the
 * whole safety property of a one-time question. Held in a `useState` it
 * resets on every remount and the sheet re-fires; held in module scope it
 * resets on every app launch. It has to survive both, so it goes in the
 * same JSON blob the rest of the household lives in — `TableAccessor`
 * round-trips the row through `JSON.parse`/`JSON.stringify` and preserves
 * keys it was never told about, and every writer in this file rebuilds the
 * row by spreading it, so the field survives an unrelated settings save.
 *
 * WHY A NULLABLE TIMESTAMP AND NOT A BOOLEAN. Every other one-time event
 * in this schema is `*_at` — `Member.healthDataConsentAt`,
 * `Friendship.respondedAt`, `creators.opted_in_at` — and an optional
 * boolean would carry three states (`true` / `false` / absent) of which
 * two mean the same thing, which is the precise ambiguity
 * `shareCooksWithFriends`'s own comment complains about. `null` and absent
 * both read as "never asked" and collapse cleanly in the getter.
 *
 * WHAT HAPPENS WHEN SYNC ARRIVES. A migration adds
 * `households.cook_sharing_asked_at timestamptz` (nullable, no default —
 * "never asked" is the absence of a time, not `false`), this interface's
 * field moves onto `Household` beside `shareCooksWithFriends` with the
 * same "optional because legacy rows predate it" argument, and the
 * Supabase implementation answers the same two methods off the column.
 * The migration must NOT backfill: a household that this device already
 * asked has a local timestamp and a household that never was has none, and
 * the first sync should carry the local value up rather than have the
 * server invent one. Until then the fact is per-device, which is the one
 * honest limitation worth stating out loud — reinstalling the app can
 * re-open a question §5 says is asked once. That is acceptable today
 * because the local store IS the source of truth for everything this app
 * writes (meals never reach Postgres either), and unacceptable the moment
 * two devices share a household, which is the same moment the column
 * above has to exist.
 */
interface LocallyStoredHousehold extends Household {
  /** When §5's one-time cook-proof question was put to this household. Null/absent means never. */
  readonly cookSharingAskedAt?: IsoDateTimeString | null;
}

/**
 * `getHousehold` again, widened to the shape this store actually holds.
 *
 * Assignment rather than a cast: `Household` is assignable to
 * `LocallyStoredHousehold` because the extra field is optional, so the
 * compiler checks the widening instead of being told to trust it.
 */
async function findStoredHousehold(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<LocallyStoredHousehold | null> {
  const households: readonly LocallyStoredHousehold[] = await tables.households.list();
  return households.find((household) => household.id === householdId) ?? null;
}

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
  return updateHousehold(tables, householdId, (household) => ({
    ...household,
    weeknightTimeBudgetMinutes: input.weeknightTimeBudgetMinutes,
  }));
}

/**
 * PD-010 / DESIGN-SOCIAL.md §5 — the household's cook-proof opt-in, read
 * as a plain boolean.
 *
 * `?? false` is the whole implementation and it is not a defensive
 * flourish: `Household.shareCooksWithFriends` is optional because rows
 * written before 0009 carry no such key (see its comment in
 * src/domain/types.ts), and this is the single place that decides what a
 * missing key means. It means "never asked", which per §5 means "shares
 * nothing" — the same answer 0009's `default false` gives a row that
 * reaches Postgres.
 *
 * A missing HOUSEHOLD is a different thing entirely and gets a throw, not
 * a `false`. `getHousehold` above can return null because "does this
 * household exist" is a question a caller can act on; "has this household
 * consented" answered `false` for a household that does not exist is
 * indistinguishable from a deliberate opt-out, and consent is the last
 * thing that should ever be inferred from a typo.
 */
export async function getHouseholdCookSharing(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<boolean> {
  const household = await getHousehold(tables, householdId);
  if (household === null) {
    throw new Error(`No household found with id "${householdId}".`);
  }
  return household.shareCooksWithFriends ?? false;
}

/**
 * PD-010 / DESIGN-SOCIAL.md §5 — turns the cook-proof opt-in on or off.
 *
 * Writes this one field and copies the rest of the row through untouched,
 * which is what keeps revocation cheap and total: nothing else about the
 * household changes, and because proof is assembled per read on the
 * friend's device, `false` here removes the household's entire past cook
 * history from every friend surface at their next open. There is no
 * separate "delete my proof" step to forget, and nothing to reach into
 * anyone else's storage for.
 *
 * Deliberately does NOT touch any meal row. The per-meal exclusion
 * (local/meals.ts's `setMealCookProofExclusion`) is a separate answer to a
 * separate question, and 0009's column comment states it is "unaffected by
 * toggling" this one — so an excluded dish stays excluded across an off/on
 * cycle here. Clearing exclusions on revoke would look tidy and would mean
 * a household that opts back in silently starts sharing the one dish it
 * most wanted withheld.
 */
export async function setHouseholdCookSharing(
  tables: RepositoryTables,
  householdId: HouseholdId,
  shareCooksWithFriends: boolean,
): Promise<Household> {
  return updateHousehold(tables, householdId, (household) => ({ ...household, shareCooksWithFriends }));
}

/**
 * DESIGN-SOCIAL.md §5 — whether the one-time cook-proof question has
 * already been put to this household.
 *
 * A plain boolean out of a nullable timestamp, for exactly the reason
 * `getHouseholdCookSharing` above normalises its own field: the caller is
 * a `visible` prop on a sheet, and handing it `IsoDateTimeString | null |
 * undefined` would make three spellings of a two-state question that every
 * call site has to collapse identically. One of them getting it wrong is
 * not a rendering bug — it re-opens a question the product promised to ask
 * once.
 *
 * A missing HOUSEHOLD throws, the same as its sibling and for the same
 * reason: `false` here means "ask them", so answering a lookup failure
 * with `false` would present a consent sheet on top of a household nobody
 * could find, and would do it again on every read.
 */
export async function getHouseholdCookSharingAsked(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<boolean> {
  const household = await findStoredHousehold(tables, householdId);
  if (household === null) {
    throw new Error(`No household found with id "${householdId}".`);
  }
  return (household.cookSharingAskedAt ?? null) !== null;
}

/**
 * DESIGN-SOCIAL.md §5 — records that the question was put. One-way, and
 * idempotent.
 *
 * NO BOOLEAN PARAMETER, DELIBERATELY. The obvious symmetric shape,
 * `setHouseholdCookSharingAsked(id, boolean)`, offers a `false` that means
 * "un-ask", and there is no such act: §5's whole sentence is that the
 * question is asked once and not campaigned, so a caller that could clear
 * this flag could re-open it — by accident, from a stale object, or as a
 * tidy-up during some future reset. A verb with no argument cannot be
 * pointed the wrong way.
 *
 * IT WRITES NOTHING ABOUT THE ANSWER. Sharing is turned on, when it is
 * turned on, by `setHouseholdCookSharing` — a separate call the ask makes
 * FIRST, so a failure there leaves the question unanswered rather than
 * recorded-and-ignored. Declining writes only this: the flag is already
 * `false`, and a redundant `setHouseholdCookSharing(id, false)` would make
 * a decline indistinguishable from a revocation in any later audit.
 *
 * Returns `void` rather than the updated `Household`, unlike its two
 * siblings. They return the row because the field they wrote is visible on
 * it; this one's is not (see `LocallyStoredHousehold`), so handing back a
 * `Household` would be a row that provably does not show the change the
 * caller just made. Read it back through
 * `getHouseholdCookSharingAsked` instead.
 */
export async function markHouseholdCookSharingAsked(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<void> {
  // Also the unknown-id guard: this throws for a household that does not
  // exist, so the write below never silently no-ops on a bad id.
  if (await getHouseholdCookSharingAsked(tables, householdId)) {
    // Already asked. Re-stamping would move a timestamp that records the
    // FIRST asking, which is the only asking there is meant to be.
    return;
  }
  const askedAt = nowIso();
  await updateHousehold(tables, householdId, (household) => {
    const asked: LocallyStoredHousehold = { ...household, cookSharingAskedAt: askedAt };
    return asked;
  });
}

/**
 * Read-modify-write for exactly one household, shared by both setters
 * above so the "not found" contract and the immutable replace are stated
 * once — the same shape as local/cookEvents.ts's `updateCookEvent`, for
 * the same reason. `change` must return a new object: nothing here mutates
 * the row it is handed, and the surrounding array is rebuilt by `map`
 * rather than spliced in place.
 */
async function updateHousehold(
  tables: RepositoryTables,
  householdId: HouseholdId,
  change: (household: Household) => Household,
): Promise<Household> {
  const households = await tables.households.list();
  let updated: Household | undefined;
  const next = households.map((household) => {
    if (household.id !== householdId) {
      return household;
    }
    updated = change(household);
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

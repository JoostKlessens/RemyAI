/**
 * The two rows that have to exist in Postgres before ANY other row can:
 * this household, and this account's membership of it.
 *
 * WHY NOTHING WORKS WITHOUT THIS. `public.is_household_member(uuid)`
 * (0001, ~line 68) is the RLS predicate on almost every policy in the
 * database — meals, meal_ingredients, meal_steps, saves, cook_events,
 * vetoes, push_tokens, member_restrictions, and households' own SELECT and
 * UPDATE. It answers "does a `household_members` row exist with this
 * household_id and `auth.uid()`". Today nothing in this app has ever
 * written a `households` row: the user's `profiles` row is created at
 * /claim-handle (src/lib/auth.ts `createProfile`) and their household lives
 * only in AsyncStorage. So the predicate is false for every household id
 * the client holds, and every write the write-through mirror is about to
 * attempt is refused before it touches a table. This module is the
 * prerequisite, and it is the whole of it.
 *
 * THE CHICKEN AND EGG, AND HOW 0001 ALREADY SOLVED IT. A household with no
 * members is unreadable and unmembershippable by its own creator —
 * `is_household_member(id)` is false, so `households_select` hides the row
 * the user just wrote. The migration anticipates this and says so above
 * `households_insert`: "Any authenticated user may create a household
 * (onboarding, step A). There is deliberately no membership check here —
 * before this insert, the user is a member of nothing, so
 * is_household_member(id) would always be false." Its check is
 * `auth.uid() is not null` and nothing more. `household_members_insert`
 * closes the loop from the other side, and its own comment names this
 * exact case first: "Bootstrapping: a user just created a household (see
 * households_insert) and adds themselves as its first member
 * (auth_user_id = auth.uid())". So the sequence is fixed by the policies
 * rather than chosen here: insert the household blind, then insert the
 * membership naming yourself. No policy is changed, no migration is added,
 * and `is_household_member` is not touched — it is `language sql` so the
 * planner can inline it into all 47 policy expressions, and that is worth
 * more than any convenience this file could buy from rewriting it.
 *
 * THE CHEAP PATH IS THE SAME PREDICATE, READ INSTEAD OF WRITTEN. This runs
 * on every app start, so the common case must cost as little as possible —
 * and it costs exactly one round trip, because `households_select` is
 * `using (public.is_household_member(id))`. A row coming back from
 * `select id from households where id = :id` is therefore not merely
 * evidence that the household exists; it is proof that the predicate every
 * later write depends on is already true. One read answers both questions.
 * The inverse is what makes the write path unavoidable: an empty result
 * cannot distinguish "no such household" from "not yours", so at bootstrap
 * you cannot read your way to the answer — the write IS the probe.
 *
 * INSERT-ONLY, NEVER UPSERT, AND THAT IS STRUCTURAL. `upsert` with
 * `ignoreDuplicates` would fold the duplicate handling below into one call
 * and was rejected: this module would then hold a verb that can overwrite
 * an existing `households` row, and the row-mirroring module landing beside
 * it owns `name`, `timezone`, `decision_push_time`,
 * `weeknight_time_budget_minutes`, `skill_level` and
 * `share_cooks_with_friends`. Two writers for one set of columns, one of
 * them firing on every cold start with whatever the local store happened
 * to hold, is a race that silently reverts a settings change. `insert` +
 * "23505 means it is already there" cannot do that. Consequently this
 * module establishes EXISTENCE and never content: a household row it did
 * not create keeps every value it has.
 *
 * FAILURE IS REPORTED, NEVER THROWN, AND NEVER FLATTENED. Three outcomes
 * that look identical from a `catch` block mean completely different
 * things, and collapsing them into one falsy answer is a bug this repo has
 * already paid for once:
 *   - 42501, the RLS refusal. The database answered and said no. There is
 *     no session, or `auth.uid()` is not the `authUserId` the caller
 *     passed. Retrying on the next start changes nothing.
 *   - an empty error code. postgrest-js populates `code` only for upstream
 *     PostgREST/Postgres errors and leaves it blank for a client-side
 *     fetch failure, by documented intent. Blank therefore means nothing
 *     answered: offline, DNS, a proxy that ate the request. This one IS
 *     worth retrying, on the next start, for free.
 *   - any other SQLSTATE. The database answered and rejected the row —
 *     22P02 for an id that is not a uuid is the state the local-id-to-UUID
 *     work fails into. Reporting that as "unreachable" would hide a
 *     permanent, fixable fault behind an infinite retry.
 * So the result is a union carrying the reason, the step it happened at,
 * the SQLSTATE and the message. Nothing is logged from here — a library
 * that writes to the console decides for its caller what is worth saying.
 *
 * IT MUST NOT BLOCK THE UI, AND CANNOT. Every path returns; no path
 * throws, including a client that throws instead of answering. The app was
 * local-first before this module existed and stays exactly that: a cold
 * start with no connection gets one failed request and an `unreachable`
 * result, and every screen goes on reading and writing AsyncStorage as
 * though Postgres were not a thing. The caller is expected to `void` this
 * and never await it on a render path.
 *
 * WHAT THE CALLER PROVIDES AND WHY. The household id is a PARAMETER, not
 * something minted here: another hand owns id generation, and this module
 * must not care whether the id arrived from `generateLocalId` or from
 * `crypto.randomUUID`. The Supabase client is a parameter too, narrowed to
 * `Pick<SupabaseClient, 'from'>` for the reason `FriendProofSource` and
 * `SendAudienceSource` are narrowed: the `auth` namespace carries
 * `signOut`, `signInWithOtp` and the admin surface, and a bootstrap that
 * cannot reach them cannot ever be edited into signing somebody out on
 * launch. The auth user id is likewise passed in rather than read from
 * `client.auth.getUser()` — that read is what would have forced the wide
 * parameter — and the database remains the authority regardless: the
 * insert policy accepts the member row only on `auth_user_id = auth.uid()`,
 * so an id that disagrees with the session surfaces as 42501 rather than
 * as a wrong row.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HouseholdId } from '@/domain/types';

/**
 * The one client capability this module may use, and no others. See the
 * file header on why `auth` is deliberately out of reach.
 */
export type RemoteHouseholdClient = Pick<SupabaseClient, 'from'>;

export interface RemoteHouseholdInput {
  /**
   * The local household's id, verbatim. Must be a uuid for Postgres to
   * accept it; this module does not check that, because a client-side copy
   * of the column type is a second opinion that drifts — a non-uuid comes
   * back as 22P02 and is reported as `rejected`.
   */
  readonly householdId: HouseholdId;
  /** `households.name`, NOT NULL. Only ever written when the row is created — see the header. */
  readonly householdName: string;
  /**
   * `auth.users.id`, which is also `profiles.id` — the same value on both,
   * because 0007 keys the profile BY the auth user ("`id` is both the
   * primary key and the foreign key"). That identity is what lets
   * `household_members.auth_user_id` link a member to a profile without a
   * third identifier, and it is what 0009's `shared_cooks` joins a cook
   * proof to a name on.
   */
  readonly authUserId: string;
  /**
   * `household_members.display_name`, NOT NULL. The name this person is
   * called INSIDE the household, so the caller should pass the local
   * member row's display name — never a handle, never a placeholder, and
   * never an empty string, which the column would accept and every later
   * screen would render as a blank.
   */
  readonly memberDisplayName: string;
}

/** Which round trip a failure happened at. Diagnostic only — no caller branches on it. */
export type RemoteHouseholdStep = 'membership_probe' | 'household_insert' | 'member_insert';

export type RemoteHouseholdFailure =
  /** Postgres 42501 — a policy refused the row. No session, or a different `auth.uid()`. */
  | 'rls_refused'
  /** `unique (auth_user_id)` on household_members: this account already belongs to another household. */
  | 'foreign_household'
  /** The database answered and rejected the row for some other reason — a bad uuid, a constraint. */
  | 'rejected'
  /** Nothing answered. Offline, DNS, a timeout. The only one worth retrying as-is. */
  | 'unreachable';

export interface RemoteHouseholdRefusal {
  readonly kind: 'failed';
  readonly reason: RemoteHouseholdFailure;
  readonly step: RemoteHouseholdStep;
  /** The SQLSTATE, when the database answered. Null when nothing did — that null IS the distinction. */
  readonly code: string | null;
  readonly message: string;
}

/**
 * `already_present` and `created` are the same news for a caller — the
 * predicate holds — and differ only for a log. Branch with
 * `isHouseholdReady`, never on the kind, so a third success kind can never
 * silently mean "not ready" somewhere.
 */
export type EnsureRemoteHouseholdResult =
  | { readonly kind: 'already_present' }
  | { readonly kind: 'created' }
  | RemoteHouseholdRefusal;

const HOUSEHOLDS_TABLE = 'households';
const HOUSEHOLD_MEMBERS_TABLE = 'household_members';

/** Postgres RLS refusal: "new row violates row-level security policy". */
const RLS_VIOLATION = '42501';
/** Postgres unique violation — the household PK, or `unique (auth_user_id)` on a member row. */
const UNIQUE_VIOLATION = '23505';

/**
 * Whether every other Postgres write may now be attempted. One predicate,
 * stated once, so no caller re-derives it from a kind comparison.
 */
export function isHouseholdReady(result: EnsureRemoteHouseholdResult): boolean {
  return result.kind !== 'failed';
}

/**
 * Ensure this household and this account's membership of it exist in
 * Postgres. Idempotent, safe on every start, and never throws.
 *
 * Ordinary starts cost one read. A first start costs three round trips and
 * happens once per install.
 */
export async function ensureRemoteHousehold(
  client: RemoteHouseholdClient,
  input: RemoteHouseholdInput,
): Promise<EnsureRemoteHouseholdResult> {
  const probe = await probeMembership(client, input.householdId);
  if (probe.kind === 'member') {
    return { kind: 'already_present' };
  }
  if (probe.kind === 'failed') {
    return probe;
  }

  const household = await settle(() =>
    client.from(HOUSEHOLDS_TABLE).insert({ id: input.householdId, name: input.householdName }),
  );
  // A household row that is already there is the expected half-bootstrapped
  // state — an earlier run wrote it and then lost the connection before the
  // member row. It is not a reason to stop; the membership is the part that
  // is missing.
  if (household.error !== null && readErrorCode(household.error) !== UNIQUE_VIOLATION) {
    return refuse('household_insert', household.error);
  }

  const member = await settle(() =>
    client.from(HOUSEHOLD_MEMBERS_TABLE).insert({
      household_id: input.householdId,
      display_name: input.memberDisplayName,
      // The bootstrap clause: `household_members_insert` accepts this row
      // because it names the caller. Anything else here would need an
      // existing membership, which is the thing being created.
      auth_user_id: input.authUserId,
      // `health_data_consent_at` is deliberately absent, not null-written:
      // PD-005 makes it the gate on collecting Article 9 allergen data, and
      // signing in is not consenting to that. There is no role or
      // relationship column on this table (0001) to fill in either.
    }),
  );
  if (member.error === null) {
    return { kind: 'created' };
  }
  if (readErrorCode(member.error) !== UNIQUE_VIOLATION) {
    return refuse('member_insert', member.error);
  }

  return await resolveDuplicateMembership(client, input.householdId, member.error);
}

/**
 * A duplicate member row is two very different situations wearing the same
 * SQLSTATE, and only a second read can tell them apart.
 *
 * `household_members.auth_user_id` is UNIQUE across the WHOLE table, not
 * per household. So either another start won the race and the membership
 * this call wanted now exists — ordinary, and a success — or this account
 * already holds a member row in a DIFFERENT household, which is what
 * happens when a local household id changes underneath a signed-in user.
 * The probe distinguishes them the only way available: if the household is
 * now visible, the predicate holds; if it still is not, the existing row
 * points somewhere else and no amount of retrying will move it.
 *
 * Reporting that second case as success would be the worst outcome
 * available — every subsequent write would be refused by RLS, one row at a
 * time, with nothing to explain why.
 */
async function resolveDuplicateMembership(
  client: RemoteHouseholdClient,
  householdId: HouseholdId,
  error: unknown,
): Promise<EnsureRemoteHouseholdResult> {
  const recheck = await probeMembership(client, householdId);
  if (recheck.kind === 'member') {
    return { kind: 'created' };
  }
  if (recheck.kind === 'failed') {
    return recheck;
  }
  return {
    kind: 'failed',
    reason: 'foreign_household',
    step: 'member_insert',
    code: UNIQUE_VIOLATION,
    message: readErrorMessage(error),
  };
}

type ProbeOutcome = { readonly kind: 'member' } | { readonly kind: 'absent' } | RemoteHouseholdRefusal;

/**
 * "Is the predicate already true?" — asked of `households_select`, whose
 * `using` clause IS `is_household_member(id)`.
 *
 * `maybeSingle` because no row is the ordinary answer here rather than an
 * error, exactly as `useSession` reads `profiles`. The id goes into `.eq`
 * raw: PostgREST matches a quoted value literally, quotes included, so
 * pre-quoting it would silently match nothing while looking correct.
 */
async function probeMembership(client: RemoteHouseholdClient, householdId: HouseholdId): Promise<ProbeOutcome> {
  const outcome = await settle(() => client.from(HOUSEHOLDS_TABLE).select('id').eq('id', householdId).maybeSingle());
  if (outcome.error !== null) {
    return refuse('membership_probe', outcome.error);
  }
  return outcome.data === null || outcome.data === undefined ? { kind: 'absent' } : { kind: 'member' };
}

interface SettledQuery {
  readonly data: unknown;
  readonly error: unknown;
}

/**
 * One round trip, turned into a value whatever it does.
 *
 * supabase-js normally reports a fetch failure as `{ error }` rather than
 * by rejecting, but "normally" is not a guarantee this module can rely on
 * at startup: it is called behind a `void`, so a rejection that escapes is
 * an unhandled rejection in an app that was supposed to shrug and carry on
 * offline. A thrown value keeps its own code if it has one, so a
 * `throwOnError` client would still be classified correctly.
 */
async function settle(run: () => PromiseLike<SettledQuery>): Promise<SettledQuery> {
  try {
    const outcome = await run();
    return { data: outcome.data, error: outcome.error ?? null };
  } catch (thrown) {
    return { data: null, error: thrown };
  }
}

function refuse(step: RemoteHouseholdStep, error: unknown): RemoteHouseholdRefusal {
  const code = readErrorCode(error);
  return { kind: 'failed', reason: classifyFailure(code), step, code, message: readErrorMessage(error) };
}

/**
 * The SQLSTATE is the whole discriminator, and postgrest-js is explicit
 * about why it can be: "We don't populate code/hint for client-side network
 * errors since those fields are meant for upstream service errors
 * (PostgREST/PostgreSQL)". So a code means the database answered, and its
 * absence means nothing did.
 */
function classifyFailure(code: string | null): RemoteHouseholdFailure {
  if (code === null) {
    return 'unreachable';
  }
  return code === RLS_VIOLATION ? 'rls_refused' : 'rejected';
}

/** Empty is not a code — postgrest-js writes `''` for a client-side failure. Normalised to null. */
function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

function readErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { readonly message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return 'unknown error';
}

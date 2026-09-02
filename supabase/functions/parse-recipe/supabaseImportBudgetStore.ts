/**
 * IMP-06 / IMP-10 — the durable counter, over PostgREST.
 *
 * `importBudget.ts` beside this file declares `ImportBudgetStore` and argues
 * at length for why the enforcement could not exist until a table did. The
 * table is `public.import_attempts`
 * (supabase/migrations/0012_import_rate_limit.sql). This module is the only
 * thing that reads or writes it.
 *
 * ---
 *
 * THE DECISION THAT INTERFACE REFUSED TO INHERIT: A DATABASE ERROR REFUSES
 * THE IMPORT.
 *
 * canonicalRecipeStore.ts swallows every failure on purpose, and is right
 * to: a broken cache degrades to "do the work again", and the user still
 * gets their recipe. The same posture here would be a catastrophe wearing a
 * shrug. A limiter that degrades to "allow" is not a degraded limiter, it is
 * an absent one, and it is absent in precisely the direction of the bill —
 * during exactly the window somebody hammering this endpoint would notice.
 *
 * So this module FAILS CLOSED, and the cost is named rather than hidden: a
 * Postgres outage takes imports down with it. That is a smaller failure than
 * it first sounds, because this is the same database every import already
 * depends on — the canonical cache reads it, and the client writes the meal
 * into it the moment the user confirms. An import that "succeeded" against a
 * dead database was going to fail one screen later anyway; this way it fails
 * where the app can say something true about it.
 *
 * THE REFUSAL IS LOGGED APART FROM A REAL THROTTLE.
 * `IMPORT_BUDGET_UNAVAILABLE_LOG` is its own grep token, so an operator
 * counting refusals never mistakes an outage for abuse — the two look
 * identical to the user and mean opposite things to whoever is on call.
 * IMP-07's telemetry cannot make that distinction (its scope vocabulary
 * describes which LIMIT closed, and in this case none did), which is exactly
 * why the distinction lives in a log line instead of being forced into a
 * field that would then be lying.
 *
 * ---
 *
 * WHAT IS SENT AND WHAT IS NOT. The insert names a fingerprint, a household,
 * a platform and a cost. There is no URL, no caption, no text and no title
 * in this file, and the table has no column any of them could go in — see
 * 0012's header. The `select` on both reads asks for named columns and never
 * `*`, so a column added to that table later cannot silently start flowing
 * through here.
 *
 * The `.ts` extensions below are LOAD-BEARING — Deno resolves relative
 * specifiers literally, and nothing local catches a missing one; the deploy
 * does. See index.ts's header.
 */

import { readRequiredEnvVar } from './env.ts';
import { CALLER_RATE_WINDOW_MS, HOUSEHOLD_MODEL_WINDOW_MS } from '../../../src/domain/import/importBudgetPolicy.ts';
import type { ImportAttemptRecord, ImportCostClass } from '../../../src/domain/import/importBudgetPolicy.ts';
import type { ImportPlatform } from '../../../src/domain/import/types.ts';

const SUPABASE_URL = readRequiredEnvVar('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = readRequiredEnvVar('SUPABASE_SERVICE_ROLE_KEY');

/**
 * The salt that turns a client address into a pseudonym.
 *
 * REQUIRED, NOT OPTIONAL, AND THE THROW IS THE POINT. Without it the only
 * honest options are storing a raw IP — personal data under GDPR, in a table
 * whose entire design argument is that it holds none — or hashing without a
 * salt, which is the same thing with an extra step, since the IPv4 space is
 * small enough to enumerate in seconds. Booting without it would mean
 * quietly choosing one of those two.
 */
const CALLER_FINGERPRINT_SALT = readRequiredEnvVar('IMPORT_FINGERPRINT_SALT');

const ATTEMPTS_ENDPOINT = `${SUPABASE_URL}/rest/v1/import_attempts`;
const MEMBERS_ENDPOINT = `${SUPABASE_URL}/rest/v1/household_members`;

/** Its own grep token, for the reason in the file header. */
export const IMPORT_BUDGET_UNAVAILABLE_LOG = 'import_budget_unavailable';

/**
 * Thrown when the counter cannot be consulted, and caught at exactly one
 * place — the gate in index.ts, which turns it into a refusal.
 *
 * A THROWN ERROR RATHER THAN A NULL, because `null` already means something
 * else here and the two must never merge: an absent caller budget means
 * "there is no such budget", which `decideImportBudget` answers by refusing
 * an unidentified caller. "The database did not answer" is not that.
 * Returning null for both would make an outage indistinguishable from an
 * anonymous caller in the logs, and — far worse — would make any future
 * change to how the policy treats one of them silently change the other.
 */
export class ImportBudgetUnavailableError extends Error {
  constructor(operation: string, cause: unknown) {
    super(`import budget store failed during ${operation}`);
    this.name = 'ImportBudgetUnavailableError';
    console.error(`${IMPORT_BUDGET_UNAVAILABLE_LOG} operation=${operation}`, cause);
  }
}

function serviceRoleHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'content-type': 'application/json',
    ...extra,
  };
}

/**
 * A caller identifier, as the table's `caller_fingerprint`.
 *
 * TWO SHAPES, DELIBERATELY PREFIXED AND THEREFORE UNCOLLIDABLE. An
 * identified caller is `sub:` plus their auth subject — already a UUID this
 * project issued, so hashing it would buy nothing and cost the ability to
 * answer an erasure request. An unidentified one is `ip:` plus a salted
 * hash. Without the prefixes a user id and an address hash would share one
 * namespace, and a collision there would silently merge two callers'
 * budgets.
 */
export async function buildCallerFingerprint(callerId: string | null, clientAddress: string | null): Promise<string> {
  if (callerId !== null) {
    return `sub:${callerId}`;
  }
  if (clientAddress === null) {
    return 'ip:unknown';
  }
  return `ip:${await sha256Hex(`${CALLER_FINGERPRINT_SALT}:${clientAddress}`)}`;
}

/**
 * SHA-256 via WebCrypto, which both Deno and Node expose — no dependency,
 * and no hand-rolled hashing anywhere near a pseudonymisation boundary.
 */
async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The caller's address, as well as an edge function can honestly tell.
 *
 * `x-forwarded-for` is a list, and the FIRST entry is the client — the rest
 * are proxies. It is also client-settable, so this is a fingerprint input
 * and never an authorisation input; a caller who spoofs it gets a different
 * bucket, which is why the identified path above does not use it at all.
 * That asymmetry is the whole reason signed-in users are limited by `sub`.
 */
export function readClientAddress(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded === null) {
    return null;
  }
  const first = forwarded.split(',')[0]?.trim() ?? '';
  return first.length > 0 ? first : null;
}

/** One row as the policy wants it: a millisecond timestamp and a cost class. */
function toAttemptRecord(row: unknown): ImportAttemptRecord | null {
  if (typeof row !== 'object' || row === null) {
    return null;
  }
  const record = row as { attempted_at?: unknown; cost_units?: unknown };
  if (typeof record.attempted_at !== 'string') {
    return null;
  }
  const at = Date.parse(record.attempted_at);
  if (!Number.isFinite(at)) {
    return null;
  }
  // The policy's two-valued cost class, recovered from the integer column.
  // Anything above zero is billable; `cost_units` is an integer so that a
  // future route can cost more than one without a migration, and the policy
  // does not need to know that yet.
  const units = typeof record.cost_units === 'number' ? record.cost_units : 0;
  return { at, cost: units > 0 ? 'model' : 'free' };
}

async function readAttempts(
  filter: string,
  windowMs: number,
  operation: string,
): Promise<readonly ImportAttemptRecord[]> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const endpoint =
    `${ATTEMPTS_ENDPOINT}?select=attempted_at,cost_units&${filter}` +
    `&attempted_at=gte.${encodeURIComponent(since)}`;
  let response: Response;
  try {
    response = await fetch(endpoint, { headers: serviceRoleHeaders() });
  } catch (error) {
    throw new ImportBudgetUnavailableError(operation, error);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '<unreadable body>');
    throw new ImportBudgetUnavailableError(operation, `status=${response.status} body=${detail.slice(0, 600)}`);
  }
  const rows: unknown = await response.json().catch(() => null);
  if (!Array.isArray(rows)) {
    throw new ImportBudgetUnavailableError(operation, 'response body was not an array');
  }
  // A row this function cannot read is DROPPED rather than fatal: the policy
  // already fails open on an unreadable timestamp and argues for it there
  // (`isWithinWindow`), and one malformed row must not lock a household out
  // of a working feature. A whole unreadable RESPONSE is a different fact
  // and throws above.
  return rows.map(toAttemptRecord).filter((record): record is ImportAttemptRecord => record !== null);
}

/**
 * The caller's household, or null when they belong to none.
 *
 * A person is in at most one household in this schema (`auth_user_id` is
 * UNIQUE on `household_members`, 0001_init.sql), so `limit=1` is reading the
 * only row rather than picking one of several.
 */
async function readHouseholdId(callerId: string): Promise<string | null> {
  const endpoint = `${MEMBERS_ENDPOINT}?select=household_id&auth_user_id=eq.${encodeURIComponent(callerId)}&limit=1`;
  let response: Response;
  try {
    response = await fetch(endpoint, { headers: serviceRoleHeaders() });
  } catch (error) {
    throw new ImportBudgetUnavailableError('household lookup', error);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '<unreadable body>');
    throw new ImportBudgetUnavailableError('household lookup', `status=${response.status} body=${detail.slice(0, 600)}`);
  }
  const rows: unknown = await response.json().catch(() => null);
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  const first = rows[0] as { household_id?: unknown };
  return typeof first.household_id === 'string' ? first.household_id : null;
}

/**
 * Everything the gate needs about one caller, read in one place.
 *
 * NOT AN `ImportBudgetStore`, AND THE DIVERGENCE IS DELIBERATE. That
 * interface was declared in importBudget.ts before the table existed, and
 * 0012 gave the table a `platform` column its `recordImportAttempt` has no
 * parameter for — an attempt is countable whether or not it was cacheable,
 * and an operator asking "which route is being hammered" cannot be answered
 * without it. Rather than write rows with a missing route to satisfy a
 * signature, this module exposes the shape the schema actually has, and
 * importBudget.ts's interface is now the reasoning that produced this file
 * rather than a contract anything implements.
 *
 * THE HOUSEHOLD IS RESOLVED ONCE PER REQUEST. Both the ceiling read and the
 * insert need it, and looking it up twice would add a round trip to every
 * import to learn a fact that cannot change mid-request.
 */
export interface CallerBudgetContext {
  readonly fingerprint: string;
  readonly householdId: string | null;
  readonly callerAttempts: readonly ImportAttemptRecord[] | null;
  readonly householdAttempts: readonly ImportAttemptRecord[] | null;
}

/**
 * Reads both windows for one caller. Throws `ImportBudgetUnavailableError`
 * if the counter cannot be consulted — see the file header on why that
 * refuses the import rather than allowing it.
 */
export async function readCallerBudget(callerId: string | null, fingerprint: string): Promise<CallerBudgetContext> {
  // The null the policy turns into `unidentified_caller`. Returned for a
  // caller with no `sub` — which is what this project's own anon key is, and
  // is the hole 0012's header opens with. No query is run: there is no
  // budget to read, and the refusal does not depend on one.
  if (callerId === null) {
    return { fingerprint, householdId: null, callerAttempts: null, householdAttempts: null };
  }

  const householdId = await readHouseholdId(callerId);
  const callerAttempts = await readAttempts(
    `caller_fingerprint=eq.${encodeURIComponent(fingerprint)}`,
    CALLER_RATE_WINDOW_MS,
    'caller window read',
  );
  // `null` here is "this caller belongs to no household", which the policy
  // answers by letting the per-caller limit carry the request alone — NOT by
  // refusing. Distinct from the null above, and the two must never be
  // collapsed; see `ImportBudgetStore`'s doc comment in importBudget.ts.
  const householdAttempts =
    householdId === null
      ? null
      : await readAttempts(
          `household_id=eq.${encodeURIComponent(householdId)}`,
          HOUSEHOLD_MODEL_WINDOW_MS,
          'household window read',
        );

  return { fingerprint, householdId, callerAttempts, householdAttempts };
}

/**
 * Appends one finished attempt.
 *
 * IT NEVER THROWS TO THE CALLER. This is the one operation where failing
 * closed would be backwards: the import has already happened and the money
 * is already spent, so refusing the user their recipe over a failed INSERT
 * would punish them for our bookkeeping. An undercount is the accepted cost
 * and it is logged.
 */
export async function recordAttempt(params: {
  readonly fingerprint: string;
  readonly householdId: string | null;
  readonly platform: ImportPlatform;
  readonly cost: ImportCostClass;
}): Promise<void> {
  try {
    const response = await fetch(ATTEMPTS_ENDPOINT, {
      method: 'POST',
      headers: serviceRoleHeaders({ prefer: 'return=minimal' }),
      body: JSON.stringify({
        caller_fingerprint: params.fingerprint,
        household_id: params.householdId,
        platform: params.platform,
        cost_units: params.cost === 'model' ? 1 : 0,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '<unreadable body>');
      console.error(`parse-recipe: import attempt not recorded. status=${response.status} body=${detail.slice(0, 600)}`);
    }
  } catch (error) {
    console.error('parse-recipe: import attempt not recorded', error);
  }
}

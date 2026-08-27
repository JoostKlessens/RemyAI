/**
 * The wiring that makes Postgres reachable at all: the household bootstrap
 * on app start, and the mirror flush that follows it.
 *
 * WHY THIS MODULE EXISTS RATHER THAN AN EFFECT IN _layout.tsx, and it is
 * friendProof.ts's and sendRecipe.ts's lesson for the third time. A route
 * module under src/app cannot be imported by a test in this repo at all —
 * expo-router and react-native internals fail to parse under Vite — so
 * anything that DECIDES something has to live one file down, where
 * tests/householdSync.test.ts can reach it. What stays in _layout.tsx is
 * only what React owns: a component that calls `startHouseholdSync` from
 * an effect and returns null. This file holds the order, the
 * preconditions, the member choice, the guard and the retry.
 *
 * WHAT THE ORDER IS, AND WHY EVERY STEP OF IT IS FORCED.
 *
 *   1. The session must be RESOLVED and permitted. `useSession` settles a
 *      beat after mount, and `isResolving` is not "signed out" — starting
 *      on it would bootstrap with no `auth.uid()` and collect a 42501 for
 *      nothing. `canUseApp` is the same predicate AuthGate redirects on,
 *      read from the one place that owns it.
 *   2. `ensureSeeded()` must have run. Both reads below are AsyncStorage
 *      reads, and on a fresh install neither exists yet —
 *      `getCurrentHouseholdId` throws outright before the seed. It also
 *      renumbers legacy ids to uuids (see createRepository.ts), and a
 *      legacy id cannot be written to a Postgres `uuid` column at all, so
 *      bootstrapping ahead of it would fail with 22P02 permanently.
 *   3. The household and its members are read LOCALLY. The local store is
 *      the source of truth; this module never invents an id, a name or a
 *      person.
 *   4. `ensureRemoteHousehold` writes the two rows every RLS policy in the
 *      database depends on.
 *   5. ONLY THEN is the outbox flushed. `is_household_member()` is the
 *      predicate on almost every policy, so a flush attempted before the
 *      bootstrap lands is a backlog of refusals — each one counted as a
 *      failed attempt against a payload that was never wrong.
 *
 * NEVER A PLACEHOLDER FOR A PERSON. `household_members.display_name` is
 * NOT NULL and is what a friend sees beside a cook. If this household
 * cannot name anybody, the bootstrap does not happen — an "Onbekend" or an
 * empty string written once would be permanent, because
 * `ensureRemoteHousehold` is insert-only and never revisits a row it did
 * not create. `chooseBootstrapMember` is therefore allowed to return null,
 * and null is a `skipped` report rather than a fallback.
 *
 * THE GUARD LATCHES ON SUCCESS, NOT ON COMPLETION, AND THAT DISTINCTION IS
 * THE WHOLE OFFLINE CASE. A once-guard shaped exactly like `ensureSeeded`
 * — latch on the first call, never look again — would mean a cold start in
 * a basement leaves the household unbootstrapped and the outbox unflushed
 * until the process is killed. Which is to say: the guard would work
 * perfectly except in the one situation it exists for. So `inFlight`
 * prevents concurrency and `householdReady` prevents repetition, and a run
 * that ended `skipped` or `blocked` latches neither. Once the household IS
 * ready, a later start is a flush and not a second bootstrap — the probe
 * costs a round trip and there is no reason to spend it every time the app
 * comes back from the lock screen.
 *
 * "CONNECTIVITY RETURNED" IS SPELLED WITH `AppState`, DELIBERATELY. The
 * accurate signal is @react-native-community/netinfo, and it was rejected:
 * it is a native module, so adding it obliges everyone on the team to
 * rebuild the dev client — the same objection that killed `expo-crypto`
 * this week. Foreground is a proxy rather than the truth (a phone can come
 * back to the foreground still offline, and can regain signal while the
 * app is open and never fire), but a flush attempted with no connection
 * costs one failed request and leaves the backlog exactly as it was, so
 * the proxy is wrong only in the cheap direction. `AppState` is passed IN
 * rather than imported, which is what keeps this module free of
 * react-native and therefore testable.
 *
 * NOTHING HERE THROWS AND NOTHING HERE LOGS. Every path returns a report;
 * a local read that fails is `skipped`, a refused bootstrap is `blocked`.
 * The caller `void`s this from an effect, so a rejection that escaped
 * would be an unhandled rejection in an app that was supposed to shrug and
 * carry on offline. What to do with a report is the caller's decision, and
 * today the caller does nothing with it, which is the honest amount.
 */

import {
  ensureRemoteHousehold,
  isHouseholdReady,
  type EnsureRemoteHouseholdResult,
  type RemoteHouseholdClient,
} from './ensureRemoteHousehold';
import { flushMirrorOutbox, type MirrorFlushSummary, type MirrorOutbox } from './repository/mirror';
import type { MirrorClient } from './repository/mirror/types';
import type { RemyRepository } from './repository/types';
import type { Member } from '@/domain/types';

/**
 * One client for both halves. `RemoteHouseholdClient` and `MirrorClient`
 * are independently narrowed to `Pick<SupabaseClient, 'from'>` for the same
 * reason — neither may reach `auth` or `rpc` — and intersecting them here
 * states that this module needs no more than either of them does.
 */
export type HouseholdSyncClient = RemoteHouseholdClient & MirrorClient;

/**
 * The three local reads the bootstrap makes, and no others. A `Pick` for
 * `SendAudienceSource`'s reason: a module that establishes a household in
 * Postgres has no business writing a meal, and narrowing is what makes
 * that structural rather than observed.
 */
export type HouseholdSyncRepository = Pick<RemyRepository, 'getCurrentHouseholdId' | 'getHousehold' | 'listMembers'>;

export interface HouseholdSyncEnvironment {
  readonly repository: HouseholdSyncRepository;
  /** createRepository.ts's `ensureSeeded` — migrates legacy ids, then seeds. Idempotent. */
  readonly ensureSeeded: () => Promise<void>;
  readonly client: HouseholdSyncClient;
  readonly outbox: MirrorOutbox;
}

/**
 * What this module needs from `useSession`, restated as three plain values.
 *
 * NOT `SessionInfo` ITSELF, and that is the point: importing the hook's
 * type would pull @/hooks/useSession into this module's graph, which pulls
 * src/lib/supabase.ts, which throws at module scope with no env vars and
 * cannot be imported under Vite. The root layout maps its session onto
 * this shape in one line, and this module stays testable.
 */
export interface HouseholdSyncSession {
  /** True only until the first resolution settles. NOT the same thing as signed out. */
  readonly isResolving: boolean;
  /** `SessionCapability.canUseApp` — an account exists and its handle is claimed. */
  readonly canUseApp: boolean;
  /** `auth.users.id`. `household_members_insert` accepts the bootstrap row only on `auth_user_id = auth.uid()`. */
  readonly userId: string | null;
}

/** Why a run did nothing. Diagnostic — no caller branches on it today. */
export type HouseholdSyncSkip =
  /** The session has not settled. Not an error; the next start finds it resolved. */
  | 'session_unresolved'
  /** No account, no claimed handle, or no auth user id. AuthGate is already redirecting. */
  | 'no_account'
  /** The local store has no household row for the current id. Nothing to bootstrap under. */
  | 'no_household'
  /** Nobody in this household has a usable display name — see the header on why that is a refusal. */
  | 'no_member'
  /** An AsyncStorage read threw. Reported rather than propagated; the next start retries it. */
  | 'local_read_failed';

export type HouseholdSyncReport =
  | { readonly kind: 'skipped'; readonly reason: HouseholdSyncSkip }
  /**
   * The bootstrap was attempted and refused. Carries the whole
   * `EnsureRemoteHouseholdResult` rather than a narrowed refusal so that
   * `isHouseholdReady` stays the ONLY thing that reads a result's kind —
   * re-deriving readiness from a comparison here is exactly the drift that
   * function exists to prevent.
   */
  | { readonly kind: 'blocked'; readonly household: EnsureRemoteHouseholdResult }
  | {
      readonly kind: 'synced';
      readonly household: EnsureRemoteHouseholdResult;
      readonly flush: MirrorFlushSummary;
    };

/** A pass that did not happen. Same shape as a pass that found nothing, because it is the same news. */
const EMPTY_FLUSH: MirrorFlushSummary = { mirrored: 0, failed: 0, deferred: 0, parked: 0, failures: [] };

/**
 * Whether there is anything to attempt at all. Stated once so the runner
 * and the run cannot disagree about what "ready to bootstrap" means.
 */
export function isHouseholdSyncEligible(session: HouseholdSyncSession): boolean {
  return !session.isResolving && session.canUseApp && session.userId !== null;
}

/**
 * Whose name goes on this household's first `household_members` row.
 *
 * The account holder first — they are the one `auth.uid()` will match, and
 * naming them is the truthful answer. Otherwise the household's FIRST
 * member, which on a seeded install is a real person added during
 * onboarding with a real name; `Member.authUserId` is null for them
 * because they have no account of their own, which is ordinary and not a
 * reason to refuse.
 *
 * A blank name is skipped rather than written. The column would accept it,
 * `ensureRemoteHousehold` never revisits a row it created, and every
 * friend's screen would render an empty string where a cook's name goes.
 * Nobody nameable therefore returns null, and the caller reports that
 * rather than substituting anything.
 */
export function chooseBootstrapMember(members: readonly Member[], authUserId: string): Member | null {
  const nameable = members.filter((member) => member.displayName.trim().length > 0);
  return nameable.find((member) => member.authUserId === authUserId) ?? nameable[0] ?? null;
}

/**
 * One full pass: seed, read locally, bootstrap remotely, then flush.
 * Never throws — see the module header.
 */
export async function runHouseholdSync(
  environment: HouseholdSyncEnvironment,
  session: HouseholdSyncSession,
): Promise<HouseholdSyncReport> {
  if (session.isResolving) {
    return { kind: 'skipped', reason: 'session_unresolved' };
  }
  const authUserId = session.userId;
  if (!session.canUseApp || authUserId === null) {
    return { kind: 'skipped', reason: 'no_account' };
  }

  const local = await readLocalHousehold(environment);
  if (local.kind === 'failed') {
    return { kind: 'skipped', reason: local.reason };
  }

  const member = chooseBootstrapMember(local.members, authUserId);
  if (member === null) {
    return { kind: 'skipped', reason: 'no_member' };
  }

  const household = await ensureRemoteHousehold(environment.client, {
    householdId: local.householdId,
    householdName: local.name,
    authUserId,
    memberDisplayName: member.displayName,
  });

  // The one branch on a bootstrap result in this repo, and it goes through
  // `isHouseholdReady` rather than through a kind comparison.
  if (!isHouseholdReady(household)) {
    return { kind: 'blocked', household };
  }

  return { kind: 'synced', household, flush: await runMirrorFlush(environment) };
}

/**
 * Retry the backlog once. Separated from the bootstrap because a
 * foreground on an already-ready household is a flush and nothing more.
 *
 * `flushMirrorOutbox` reports failures rather than throwing them, so the
 * catch here is for the store itself going away underneath — which is not
 * news the caller can act on either.
 */
export async function runMirrorFlush(
  environment: Pick<HouseholdSyncEnvironment, 'client' | 'outbox'>,
): Promise<MirrorFlushSummary> {
  try {
    return await flushMirrorOutbox(environment.client, environment.outbox);
  } catch {
    return EMPTY_FLUSH;
  }
}

type LocalHousehold =
  | {
      readonly kind: 'read';
      readonly householdId: string;
      readonly name: string;
      readonly members: readonly Member[];
    }
  | { readonly kind: 'failed'; readonly reason: Extract<HouseholdSyncSkip, 'no_household' | 'local_read_failed'> };

/**
 * The local half, in the order the store requires: seed first (it both
 * migrates ids and creates the first household), then read.
 */
async function readLocalHousehold(environment: HouseholdSyncEnvironment): Promise<LocalHousehold> {
  try {
    await environment.ensureSeeded();
    const householdId = await environment.repository.getCurrentHouseholdId();
    const household = await environment.repository.getHousehold(householdId);
    if (household === null) {
      return { kind: 'failed', reason: 'no_household' };
    }
    const members = await environment.repository.listMembers(householdId);
    return { kind: 'read', householdId, name: household.name, members };
  } catch {
    // A failed seed or an unreadable store. The local app is what breaks
    // there, loudly, at its own call sites; there is nothing a background
    // bootstrap can usefully add to it.
    return { kind: 'failed', reason: 'local_read_failed' };
  }
}

// ---------------------------------------------------------------------------
// The guard, and the trigger
// ---------------------------------------------------------------------------

export interface HouseholdSyncRunner {
  /** Fire and forget. Returns immediately; never throws; safe to call on every render. */
  start(session: HouseholdSyncSession): void;
}

/**
 * A runner with its own state, so the guard is a value rather than a
 * module-level `let` nobody can construct twice. That is what lets
 * tests/householdSync.test.ts assert the retry behaviour on a fresh
 * instance per case; the app's single instance is created below.
 */
export function createHouseholdSyncRunner(environment: HouseholdSyncEnvironment): HouseholdSyncRunner {
  let inFlight = false;
  let householdReady = false;

  async function run(session: HouseholdSyncSession): Promise<void> {
    if (householdReady) {
      await runMirrorFlush(environment);
      return;
    }
    householdReady = (await runHouseholdSync(environment, session)).kind === 'synced';
  }

  return {
    start(session: HouseholdSyncSession): void {
      // The eligibility check comes BEFORE the latch on purpose: an
      // unresolved session that latched `inFlight` would never be retried.
      if (inFlight || !isHouseholdSyncEligible(session)) {
        return;
      }
      inFlight = true;
      const release = (): void => {
        inFlight = false;
      };
      // Both handlers, not a bare `void`. `run` is built out of functions
      // that report rather than throw, but a fire-and-forget promise whose
      // rejection escapes is an unhandled rejection — a crash caused by
      // being offline, which is the one thing this whole path exists to
      // avoid.
      void run(session).then(release, release);
    },
  };
}

let appRunner: HouseholdSyncRunner | null = null;

/**
 * The app's single runner, lazily created — the same shape
 * `getAppRepository` keeps, and for the same reason: one instance so the
 * guard means something, built on first use so importing this module costs
 * nothing.
 *
 * Safe to call from a render effect on every session change. It is never
 * awaited, never gates a screen, and every one of its failure modes is a
 * report nobody is obliged to read.
 */
export function startHouseholdSync(environment: HouseholdSyncEnvironment, session: HouseholdSyncSession): void {
  appRunner ??= createHouseholdSyncRunner(environment);
  appRunner.start(session);
}

/** One `remove`, which is all a `NativeEventSubscription` is used for here. */
export interface ForegroundSubscription {
  remove(): void;
}

/** react-native's `AppState`, narrowed to the one event this module listens for. */
export interface ForegroundSource {
  addEventListener(type: 'change', listener: (state: string) => void): ForegroundSubscription;
}

/**
 * "The app came back" — this repo's stand-in for "connectivity returned".
 * See the module header on why it is not netinfo.
 *
 * Only `active` fires the callback: `background` and `inactive` are the app
 * going away, and flushing on the way out is a request that will not
 * finish. Returns the unsubscribe so a `useEffect` can hand it straight
 * back.
 */
export function subscribeToForeground(appState: ForegroundSource, onForeground: () => void): () => void {
  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'active') {
      onForeground();
    }
  });
  return () => subscription.remove();
}

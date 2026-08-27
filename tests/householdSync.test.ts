/**
 * The wiring phase's own suite: the order in which a cold start reaches
 * Postgres, and the guarantee that nothing it does can stop the app.
 *
 * WHY THIS FILE EXISTS AT ALL, and it is the fourth time this session.
 * `Meal.recipeId` was written by nobody, `onSendRecipe` was passed by
 * nobody, `rateRecipe` was called by nobody, `useSession.refresh()` was
 * called by nobody — four consumers with no producer, every one of them
 * green in its own test file. `ensureRemoteHousehold` and the write-through
 * mirror landed in exactly that state: built, tested, and referenced only
 * by themselves. So the assertions below are deliberately about the SEAM
 * rather than about either module's internals — who calls whom, in what
 * order, and what happens when the network is not there.
 *
 * IT LIVES IN src/lib AND NOT IN src/app FOR THE USUAL REASON. The gate
 * mounts in src/app/_layout.tsx, and a route module cannot be imported
 * here at all (expo-router and react-native internals fail to parse under
 * Vite). Everything that decides something therefore lives in
 * src/lib/householdSync.ts, and _layout.tsx holds only the few lines React
 * owns — the same split friendProof.ts, sendRecipe.ts and claimProfile.ts
 * already keep.
 */

import { describe, expect, test, vi } from 'vitest';
import type { Household, Member } from '@/domain/types';
import { createInMemoryKeyValueStore } from '@/lib/repository/keyValueStore';
import { createMirrorOutbox, type MirrorOutbox } from '@/lib/repository/mirror';
import {
  chooseBootstrapMember,
  createHouseholdSyncRunner,
  isHouseholdSyncEligible,
  runHouseholdSync,
  runMirrorFlush,
  subscribeToForeground,
  type HouseholdSyncEnvironment,
  type HouseholdSyncSession,
} from '@/lib/householdSync';

// ---------------------------------------------------------------------------
// Fakes — as narrow as the parameters they satisfy, which is the point of
// every `Pick` in the two modules under test
// ---------------------------------------------------------------------------

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: HOUSEHOLD_ID,
    name: 'Thuis',
    timezone: 'Europe/Amsterdam',
    decisionPushTime: '16:00',
    weeknightTimeBudgetMinutes: 30,
    skillLevel: 'beginner',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'member-1',
    householdId: HOUSEHOLD_ID,
    displayName: 'Joost',
    authUserId: null,
    healthDataConsentAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

interface TableAnswer {
  readonly data?: unknown;
  readonly error: { readonly message: string; readonly code?: string } | null;
}

/** Every PostgREST verb ensureRemoteHousehold and the mirror reach for, chained and thenable. */
class FakeQuery implements PromiseLike<TableAnswer> {
  constructor(private readonly settle: () => TableAnswer) {}
  select(): this {
    return this;
  }
  insert(): this {
    return this;
  }
  upsert(): this {
    return this;
  }
  update(): this {
    return this;
  }
  delete(): this {
    return this;
  }
  eq(): this {
    return this;
  }
  not(): this {
    return this;
  }
  maybeSingle(): this {
    return this;
  }
  then<A, B>(
    onFulfilled?: ((value: TableAnswer) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.settle()).then(onFulfilled, onRejected);
  }
}

type SyncClient = HouseholdSyncEnvironment['client'];

/**
 * `perTable` decides each table's answer. The default carries one row,
 * which is both "this household is already yours" for the membership probe
 * and "the PATCH applied" for a consent mirror.
 */
function makeClient(perTable: Record<string, TableAnswer> = {}): { client: SyncClient; tables: string[] } {
  const tables: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      return new FakeQuery(() => perTable[table] ?? { data: [{ id: HOUSEHOLD_ID }], error: null });
    },
  };
  return { client: client as unknown as SyncClient, tables };
}

/**
 * Nothing answered. postgrest-js populates `code` only for upstream
 * PostgREST/Postgres errors, so a blank code IS the evidence for
 * `unreachable` — see ensureRemoteHousehold.ts's `classifyFailure`.
 */
const OFFLINE: TableAnswer = { data: null, error: { message: 'Network request failed' } };

interface EnvironmentOptions {
  readonly household?: Household | null;
  readonly members?: readonly Member[];
  readonly perTable?: Record<string, TableAnswer>;
  readonly outbox?: MirrorOutbox;
  readonly failLocalRead?: boolean;
}

function makeEnvironment(options: EnvironmentOptions = {}) {
  const order: string[] = [];
  const { client, tables } = makeClient(options.perTable);
  const outbox = options.outbox ?? createMirrorOutbox(createInMemoryKeyValueStore());

  const repository = {
    getCurrentHouseholdId: vi.fn(async () => {
      order.push('getCurrentHouseholdId');
      if (options.failLocalRead === true) {
        throw new Error('store unreadable');
      }
      return HOUSEHOLD_ID;
    }),
    getHousehold: vi.fn(async () => (options.household === undefined ? makeHousehold() : options.household)),
    listMembers: vi.fn(async () => options.members ?? [makeMember()]),
  };

  const ensureSeeded = vi.fn(async (): Promise<void> => {
    order.push('ensureSeeded');
  });

  const environment: HouseholdSyncEnvironment = { repository, ensureSeeded, client, outbox };
  return { environment, repository, ensureSeeded, order, tables, outbox };
}

const READY_SESSION: HouseholdSyncSession = { isResolving: false, canUseApp: true, userId: USER_ID };

/** Drains every pending microtask a fire-and-forget chain left behind. */
function settleAll(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// The preconditions, stated once
// ---------------------------------------------------------------------------

describe('isHouseholdSyncEligible', () => {
  test('an unresolved session is not a signed-out one, and starts nothing', () => {
    expect(isHouseholdSyncEligible({ isResolving: true, canUseApp: true, userId: USER_ID })).toBe(false);
  });

  test('an account that may not use the app yet starts nothing', () => {
    expect(isHouseholdSyncEligible({ isResolving: false, canUseApp: false, userId: USER_ID })).toBe(false);
  });

  /**
   * `household_members_insert` accepts the bootstrap row only on
   * `auth_user_id = auth.uid()`, so there is nothing to write without one.
   */
  test('no auth user id means there is no membership row to write', () => {
    expect(isHouseholdSyncEligible({ isResolving: false, canUseApp: true, userId: null })).toBe(false);
  });

  test('a resolved, permitted, identified session is the one case that proceeds', () => {
    expect(isHouseholdSyncEligible(READY_SESSION)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Who the membership row is written for
// ---------------------------------------------------------------------------

describe('chooseBootstrapMember', () => {
  test('the member holding this account is preferred over everyone else', () => {
    const mine = makeMember({ id: 'member-2', displayName: 'Sanne', authUserId: USER_ID });

    expect(chooseBootstrapMember([makeMember(), mine], USER_ID)?.id).toBe('member-2');
  });

  /**
   * A household seeded during onboarding has members with no account of
   * their own (`Member.authUserId` is null). The first of them is a real
   * person with a real name, which is what `household_members.display_name`
   * is for — a placeholder there is rendered on every friend's screen.
   */
  test('falls back to the first member rather than inventing a name', () => {
    expect(chooseBootstrapMember([makeMember({ displayName: 'Joost' })], USER_ID)?.displayName).toBe('Joost');
  });

  test('a blank display name is skipped — the column would accept it and every screen would render it empty', () => {
    const members = [makeMember({ id: 'blank', displayName: '   ' }), makeMember({ id: 'real' })];

    expect(chooseBootstrapMember(members, USER_ID)?.id).toBe('real');
  });

  test('nobody nameable means nobody is chosen', () => {
    expect(chooseBootstrapMember([], USER_ID)).toBeNull();
    expect(chooseBootstrapMember([makeMember({ displayName: '' })], USER_ID)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The run itself
// ---------------------------------------------------------------------------

describe('runHouseholdSync — the order a cold start reaches Postgres in', () => {
  test('an unresolved session touches nothing at all, local or remote', async () => {
    const { environment, ensureSeeded, tables } = makeEnvironment();

    const report = await runHouseholdSync(environment, { isResolving: true, canUseApp: true, userId: USER_ID });

    expect(report).toEqual({ kind: 'skipped', reason: 'session_unresolved' });
    expect(ensureSeeded).not.toHaveBeenCalled();
    expect(tables).toEqual([]);
  });

  test('a session that may not use the app is skipped without a round trip', async () => {
    const { environment, tables } = makeEnvironment();

    const report = await runHouseholdSync(environment, { isResolving: false, canUseApp: false, userId: USER_ID });

    expect(report).toEqual({ kind: 'skipped', reason: 'no_account' });
    expect(tables).toEqual([]);
  });

  /**
   * The household id and the member list are both AsyncStorage reads, and
   * on a fresh install neither exists until `seedIfEmpty` has run —
   * `getCurrentHouseholdId` throws outright before it.
   */
  test('seeds before it reads the household', async () => {
    const { environment, order } = makeEnvironment();

    await runHouseholdSync(environment, READY_SESSION);

    expect(order).toEqual(['ensureSeeded', 'getCurrentHouseholdId']);
  });

  test('a household the local store cannot name is not bootstrapped under a guess', async () => {
    const { environment, tables } = makeEnvironment({ household: null });

    const report = await runHouseholdSync(environment, READY_SESSION);

    expect(report).toEqual({ kind: 'skipped', reason: 'no_household' });
    expect(tables).toEqual([]);
  });

  test('a household with nobody nameable in it is not bootstrapped under a placeholder', async () => {
    const { environment, tables } = makeEnvironment({ members: [] });

    const report = await runHouseholdSync(environment, READY_SESSION);

    expect(report).toEqual({ kind: 'skipped', reason: 'no_member' });
    expect(tables).toEqual([]);
  });

  test('the household and its members are read for the id the local store names', async () => {
    const { environment, repository } = makeEnvironment({
      household: makeHousehold({ name: 'Huize Klessens' }),
      members: [makeMember({ displayName: 'Sanne', authUserId: USER_ID })],
    });

    await runHouseholdSync(environment, READY_SESSION);

    expect(repository.getHousehold).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(repository.listMembers).toHaveBeenCalledWith(HOUSEHOLD_ID);
  });

  test('a local store that throws is reported, never rethrown at the caller', async () => {
    const { environment } = makeEnvironment({ failLocalRead: true });

    await expect(runHouseholdSync(environment, READY_SESSION)).resolves.toEqual({
      kind: 'skipped',
      reason: 'local_read_failed',
    });
  });

  test('a ready household drains the backlog that was written while it was not', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue({ kind: 'household_settings', householdId: HOUSEHOLD_ID, shareCooksWithFriends: true });
    const { environment } = makeEnvironment({ outbox });

    const report = await runHouseholdSync(environment, READY_SESSION);

    expect(report.kind).toBe('synced');
    expect(report.kind === 'synced' ? report.flush.mirrored : 0).toBe(1);
    expect(await outbox.list()).toEqual([]);
  });

  /**
   * ORDERING IS REAL. `is_household_member()` is the RLS predicate on
   * almost every policy in the database, so a flush attempted before the
   * bootstrap lands is a backlog of refusals — every one of them counted
   * against a payload that was never wrong.
   */
  test('a refused bootstrap does not flush, because nothing would be accepted', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue({ kind: 'household_settings', householdId: HOUSEHOLD_ID, shareCooksWithFriends: true });
    const { environment } = makeEnvironment({ outbox, perTable: { households: OFFLINE } });

    const report = await runHouseholdSync(environment, READY_SESSION);

    expect(report.kind).toBe('blocked');
    expect(await outbox.list()).toHaveLength(1);
  });

  test('an offline cold start resolves rather than rejecting — nothing on a render path may throw', async () => {
    const { environment } = makeEnvironment({ perTable: { households: OFFLINE } });

    await expect(runHouseholdSync(environment, READY_SESSION)).resolves.toBeTruthy();
  });
});

describe('runMirrorFlush', () => {
  test('an outbox that cannot be read reports an empty pass instead of throwing', async () => {
    const { environment } = makeEnvironment({
      outbox: {
        list: async () => {
          throw new Error('storage gone');
        },
        enqueue: async () => {},
        settle: async () => {},
        recordFailure: async () => {},
      },
    });

    await expect(runMirrorFlush(environment)).resolves.toEqual({
      mirrored: 0,
      failed: 0,
      deferred: 0,
      parked: 0,
      failures: [],
    });
  });
});

// ---------------------------------------------------------------------------
// The once-guard, and the retry the once-guard must not prevent
// ---------------------------------------------------------------------------

describe('createHouseholdSyncRunner', () => {
  test('two starts in the same beat are one run — the shape ensureSeeded already keeps', async () => {
    const { environment, ensureSeeded } = makeEnvironment();
    const runner = createHouseholdSyncRunner(environment);

    runner.start(READY_SESSION);
    runner.start(READY_SESSION);
    await settleAll();

    expect(ensureSeeded).toHaveBeenCalledTimes(1);
  });

  test('an ineligible session never latches the guard — the app must still bootstrap once it resolves', async () => {
    const { environment, ensureSeeded } = makeEnvironment();
    const runner = createHouseholdSyncRunner(environment);

    runner.start({ isResolving: true, canUseApp: true, userId: USER_ID });
    await settleAll();
    expect(ensureSeeded).not.toHaveBeenCalled();

    runner.start(READY_SESSION);
    await settleAll();
    expect(ensureSeeded).toHaveBeenCalledTimes(1);
  });

  /**
   * The cold start with no connection. A guard that latched on ANY
   * completion would leave the household unbootstrapped and the outbox
   * unflushed until the process is killed — which is the whole of the
   * offline case, so it is precisely the case that must retry.
   */
  test('a blocked run is retried on the next start', async () => {
    const { environment, ensureSeeded } = makeEnvironment({ perTable: { households: OFFLINE } });
    const runner = createHouseholdSyncRunner(environment);

    runner.start(READY_SESSION);
    await settleAll();
    expect(ensureSeeded).toHaveBeenCalledTimes(1);

    runner.start(READY_SESSION);
    await settleAll();
    expect(ensureSeeded).toHaveBeenCalledTimes(2);
  });

  /**
   * Once the predicate holds it holds for the run, so a foreground is a
   * flush and not a second bootstrap. `ensureRemoteHousehold` costs a
   * round trip on the happy path and there is no reason to spend it every
   * time the app comes back from the lock screen.
   */
  test('once the household is ready a later start flushes without bootstrapping again', async () => {
    const { environment, ensureSeeded, tables } = makeEnvironment();
    const runner = createHouseholdSyncRunner(environment);

    runner.start(READY_SESSION);
    await settleAll();
    const afterBootstrap = tables.length;

    runner.start(READY_SESSION);
    await settleAll();

    expect(ensureSeeded).toHaveBeenCalledTimes(1);
    expect(tables.length).toBe(afterBootstrap);
  });
});

// ---------------------------------------------------------------------------
// "Connectivity returned", spelled with what is already installed
// ---------------------------------------------------------------------------

describe('subscribeToForeground', () => {
  function makeAppState() {
    const listeners: ((state: string) => void)[] = [];
    let removed = 0;
    return {
      appState: {
        addEventListener(_type: 'change', listener: (state: string) => void) {
          listeners.push(listener);
          return {
            remove(): void {
              removed += 1;
            },
          };
        },
      },
      emit: (state: string): void => listeners.forEach((listener) => listener(state)),
      removals: (): number => removed,
    };
  }

  test('coming back to the foreground is the trigger', () => {
    const { appState, emit } = makeAppState();
    const onForeground = vi.fn();

    subscribeToForeground(appState, onForeground);
    emit('active');

    expect(onForeground).toHaveBeenCalledTimes(1);
  });

  test('going away is not', () => {
    const { appState, emit } = makeAppState();
    const onForeground = vi.fn();

    subscribeToForeground(appState, onForeground);
    emit('background');
    emit('inactive');

    expect(onForeground).not.toHaveBeenCalled();
  });

  test('the returned function unsubscribes, so an unmounted gate stops listening', () => {
    const { appState, removals } = makeAppState();

    subscribeToForeground(appState, vi.fn())();

    expect(removals()).toBe(1);
  });
});

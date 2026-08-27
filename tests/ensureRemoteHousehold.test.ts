/**
 * The bootstrap that unblocks every other Postgres write
 * (src/lib/ensureRemoteHousehold.ts).
 *
 * WHAT IS ACTUALLY BEING GUARDED. `public.is_household_member(...)` is the
 * RLS predicate on almost every policy in 0001, so until a `households` row
 * AND a `household_members` row exist for the signed-in user, every insert
 * of a meal, an ingredient, a step or a cook event is refused — silently,
 * from the app's point of view, because nothing today ever noticed. A test
 * that only asserted "it calls insert" would have been green through the
 * whole bug; what these assert instead is the ORDER, the exact payload the
 * two policies accept, and — the part a previous bug in this repo came
 * from — that a policy refusal and a dead connection do not arrive as the
 * same answer.
 *
 * The client is faked rather than mocked, following
 * tests/repository/supabaseSocialRepository.test.ts: the surface used is
 * three chained builders deep and synchronous to construct, so a
 * hand-written stub is shorter than configuring a mock and shows the exact
 * query shape being asserted. The fake satisfies `RemoteHouseholdClient`,
 * which is the narrowing being demonstrated: a stub with a single `from`
 * is the whole parameter, so nothing in the module can reach `auth` and
 * sign anybody out.
 */

import { describe, expect, test } from 'vitest';
import {
  ensureRemoteHousehold,
  isHouseholdReady,
  type EnsureRemoteHouseholdResult,
  type RemoteHouseholdClient,
  type RemoteHouseholdInput,
} from '@/lib/ensureRemoteHousehold';

interface FakeResponse {
  readonly data: unknown;
  readonly error: { message: string; code?: string } | null;
}

interface Write {
  readonly table: string;
  readonly values: unknown;
}

/** PostgREST's shape: every filter returns the builder, and the builder itself is awaitable. */
class FakeQuery implements PromiseLike<FakeResponse> {
  constructor(
    private readonly table: string,
    private readonly settle: () => FakeResponse,
    private readonly log: string[],
    private readonly writes: Write[],
  ) {}

  select(columns?: string): this {
    this.log.push(`${this.table}.select(${columns ?? '*'})`);
    return this;
  }
  insert(values: unknown): this {
    this.log.push(`${this.table}.insert()`);
    this.writes.push({ table: this.table, values });
    return this;
  }
  eq(column: string, value: unknown): this {
    this.log.push(`${this.table}.eq(${column},${String(value)})`);
    return this;
  }
  maybeSingle(): Promise<FakeResponse> {
    this.log.push(`${this.table}.maybeSingle()`);
    return Promise.resolve(this.settle());
  }
  then<A, B>(
    onFulfilled?: ((value: FakeResponse) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.settle()).then(onFulfilled, onRejected);
  }
}

interface Fake {
  readonly client: RemoteHouseholdClient;
  readonly log: string[];
  readonly writes: Write[];
}

/** `responses` is consumed in order, so a test can hand one answer per round trip. */
function makeClient(responses: readonly FakeResponse[]): Fake {
  const queue = [...responses];
  const log: string[] = [];
  const writes: Write[] = [];
  const client = {
    from(table: string) {
      return new FakeQuery(table, () => queue.shift() ?? { data: null, error: null }, log, writes);
    },
  };
  return { client: client as unknown as RemoteHouseholdClient, log, writes };
}

/** A client that throws instead of answering — supabase-js is not required to be polite. */
function makeThrowingClient(thrown: unknown): RemoteHouseholdClient {
  return {
    from() {
      throw thrown;
    },
  } as unknown as RemoteHouseholdClient;
}

const NOT_FOUND: FakeResponse = { data: null, error: null };
const FOUND: FakeResponse = { data: { id: 'household-uuid' }, error: null };
const OK: FakeResponse = { data: null, error: null };

/** 42501 is what Postgres raises when a policy refuses a row — the database answered, and said no. */
const RLS_REFUSAL: FakeResponse = {
  data: null,
  error: { message: 'new row violates row-level security policy for table households', code: '42501' },
};

/** Unique violation. On household_members it means `unique (auth_user_id)` — this account is spoken for. */
const DUPLICATE: FakeResponse = {
  data: null,
  error: { message: 'duplicate key value violates unique constraint', code: '23505' },
};

/**
 * postgrest-js leaves `code` empty for a client-side failure on purpose —
 * "those fields are meant for upstream service errors" — which is the only
 * discriminator there is between "the database refused" and "nothing
 * answered".
 */
const OFFLINE: FakeResponse = {
  data: null,
  error: { message: 'TypeError: Failed to fetch', code: '' },
};

const INPUT: RemoteHouseholdInput = {
  householdId: 'household-uuid',
  householdName: 'Thuis',
  authUserId: 'auth-user-uuid',
  memberDisplayName: 'Joost',
};

function failureOf(result: EnsureRemoteHouseholdResult): Extract<EnsureRemoteHouseholdResult, { kind: 'failed' }> {
  if (result.kind !== 'failed') {
    throw new Error(`expected a failure, got ${result.kind}`);
  }
  return result;
}

describe('ensureRemoteHousehold', () => {
  test('a household the user is already a member of costs one read and no writes', async () => {
    // Arrange — households_select is `using (is_household_member(id))`, so a
    // row coming back IS the membership proof. There is nothing left to do.
    const fake = makeClient([FOUND]);

    // Act
    const result = await ensureRemoteHousehold(fake.client, INPUT);

    // Assert
    expect(result).toEqual({ kind: 'already_present' });
    expect(fake.writes).toEqual([]);
    expect(fake.log).toEqual(['households.select(id)', 'households.eq(id,household-uuid)', 'households.maybeSingle()']);
  });

  test('a first run writes the household, then the membership, in that order', async () => {
    const fake = makeClient([NOT_FOUND, OK, OK]);

    const result = await ensureRemoteHousehold(fake.client, INPUT);

    // The order is the bootstrap: households_insert accepts any
    // authenticated user (0001 removes the membership check there
    // precisely because it would always be false at this moment), and
    // household_members_insert then accepts the row on
    // `auth_user_id = auth.uid()`. Reversed, the member row has no
    // household to point at.
    expect(result).toEqual({ kind: 'created' });
    expect(fake.writes).toEqual([
      { table: 'households', values: { id: 'household-uuid', name: 'Thuis' } },
      {
        table: 'household_members',
        values: {
          household_id: 'household-uuid',
          display_name: 'Joost',
          auth_user_id: 'auth-user-uuid',
        },
      },
    ]);
  });

  test('the member row carries no consent, no role, and no invented columns', async () => {
    const fake = makeClient([NOT_FOUND, OK, OK]);

    await ensureRemoteHousehold(fake.client, INPUT);

    // PD-005: `health_data_consent_at` null means consent has NOT been
    // given, and signing in is not consenting to anything. There is also no
    // role/relationship column on household_members in 0001 — inventing one
    // here would fail the insert outright.
    const memberValues = fake.writes[1]?.values as Record<string, unknown>;
    expect(Object.keys(memberValues).sort()).toEqual(['auth_user_id', 'display_name', 'household_id']);
  });

  test('the household id reaches the filter raw, never quoted', async () => {
    const fake = makeClient([FOUND]);

    await ensureRemoteHousehold(fake.client, INPUT);

    // PostgREST matches a quoted value literally, quotes included, so
    // `.eq('id', '"x"')` finds nothing while looking perfectly correct.
    expect(fake.log).toContain('households.eq(id,household-uuid)');
    expect(fake.log.join('|')).not.toContain('"');
  });

  test('a household row that already exists is not an error — the membership still gets written', async () => {
    const fake = makeClient([NOT_FOUND, DUPLICATE, OK]);

    const result = await ensureRemoteHousehold(fake.client, INPUT);

    // The half-bootstrapped state: the household row landed on an earlier
    // run and the member row did not. Insert-only means the second run
    // repairs it instead of clobbering the settings on the existing row.
    expect(result).toEqual({ kind: 'created' });
    expect(fake.writes.map((write) => write.table)).toEqual(['households', 'household_members']);
  });

  test('an RLS refusal is reported as a refusal, with its code, and never as a network failure', async () => {
    const fake = makeClient([NOT_FOUND, OK, RLS_REFUSAL]);

    const failure = failureOf(await ensureRemoteHousehold(fake.client, INPUT));

    // 42501 means the session is not who the caller thinks it is — a
    // retry-forever loop would never fix it, and collapsing it into the
    // same answer as "no signal" is exactly the bug this distinction
    // exists to prevent.
    expect(failure.reason).toBe('rls_refused');
    expect(failure.step).toBe('member_insert');
    expect(failure.code).toBe('42501');
    expect(failure.message).toContain('row-level security');
  });

  test('a cold start with no connection reports unreachable and writes nothing', async () => {
    const fake = makeClient([OFFLINE]);

    const failure = failureOf(await ensureRemoteHousehold(fake.client, INPUT));

    expect(failure.reason).toBe('unreachable');
    expect(failure.step).toBe('membership_probe');
    expect(failure.code).toBeNull();
    expect(fake.writes).toEqual([]);
  });

  test('a thrown client is reported, not propagated', async () => {
    const result = await ensureRemoteHousehold(makeThrowingClient(new Error('Network request failed')), INPUT);

    // This runs at startup behind a `void`. A rejected promise there is an
    // unhandled rejection in an app that was supposed to keep working
    // offline.
    const failure = failureOf(result);
    expect(failure.reason).toBe('unreachable');
    expect(failure.message).toContain('Network request failed');
  });

  test('an account already tied to another household is named as such, not reported as success', async () => {
    // `household_members.auth_user_id` is UNIQUE across every household, so
    // a second membership for the same account is refused — and the probe
    // still cannot see this household, which is what proves the existing
    // row belongs to a different one.
    const fake = makeClient([NOT_FOUND, OK, DUPLICATE, NOT_FOUND]);

    const failure = failureOf(await ensureRemoteHousehold(fake.client, INPUT));

    expect(failure.reason).toBe('foreign_household');
    expect(failure.step).toBe('member_insert');
    expect(failure.code).toBe('23505');
  });

  test('a membership won by a concurrent start is a success, not a conflict', async () => {
    const fake = makeClient([NOT_FOUND, OK, DUPLICATE, FOUND]);

    const result = await ensureRemoteHousehold(fake.client, INPUT);

    // Two app starts racing is ordinary. The re-read is what separates it
    // from the case above: the household is now visible, so the predicate
    // every other write depends on is satisfied.
    expect(result).toEqual({ kind: 'created' });
  });

  test('a Postgres error that is neither a refusal nor a duplicate is kept distinct', async () => {
    const fake = makeClient([
      NOT_FOUND,
      { data: null, error: { message: 'invalid input syntax for type uuid', code: '22P02' } },
    ]);

    const failure = failureOf(await ensureRemoteHousehold(fake.client, INPUT));

    // The state the other agent's local-id-to-UUID work fails into. It is
    // neither a policy refusal nor a dead connection, and a caller told
    // "unreachable" would retry it every start forever.
    expect(failure.reason).toBe('rejected');
    expect(failure.step).toBe('household_insert');
    expect(failure.code).toBe('22P02');
  });

  test('readiness is one predicate, not a kind comparison spread over the callers', async () => {
    const ready = await ensureRemoteHousehold(makeClient([FOUND]).client, INPUT);
    const written = await ensureRemoteHousehold(makeClient([NOT_FOUND, OK, OK]).client, INPUT);
    const refused = await ensureRemoteHousehold(makeClient([RLS_REFUSAL]).client, INPUT);

    expect(isHouseholdReady(ready)).toBe(true);
    expect(isHouseholdReady(written)).toBe(true);
    expect(isHouseholdReady(refused)).toBe(false);
  });
});

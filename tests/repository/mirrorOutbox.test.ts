/**
 * The mirror's outbox: durability, coalescing, and the retry policy.
 *
 * WHAT THIS FILE IS GUARDING. Three properties, each of which has a
 * plausible-looking wrong implementation:
 *
 *   1. A write is never lost. The entry is durable BEFORE the request is
 *      attempted, so a process that dies mid-flight leaves the job behind
 *      rather than the silence of a promise nobody kept.
 *   2. The outbox stays small. Entries are keyed by row identity, so
 *      re-mirroring a row replaces its entry instead of appending. An
 *      append-only queue of every write a household ever made is a
 *      journal, and a journal is the first half of a sync engine.
 *   3. A failure that will never succeed is not retried forever. A
 *      constraint violation is parked, visibly, rather than spun on.
 *
 * WHAT IT IS NOT: a test of merge semantics, because there are none. The
 * mirror has one direction and one writer per row.
 */

import { describe, expect, test } from 'vitest';
import { createInMemoryKeyValueStore } from '@/lib/repository/keyValueStore';
import { MIRROR_OUTBOX_KEY, createMirrorOutbox, mirrorJobKey } from '@/lib/repository/mirror/outbox';
import { flushMirrorOutbox, hasPendingMealMirror, mirrorWriteThrough } from '@/lib/repository/mirror';
import type { MirrorClient, MirrorJob } from '@/lib/repository/mirror/types';
import type { CookEvent, Meal } from '@/domain/types';

interface FakeResponse {
  readonly data?: unknown;
  readonly error: { message: string; code?: string } | null;
}

class FakeQuery implements PromiseLike<FakeResponse> {
  constructor(private readonly settle: () => FakeResponse) {}
  upsert(): this {
    return this;
  }
  update(): this {
    return this;
  }
  select(): this {
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
  then<A, B>(
    onFulfilled?: ((value: FakeResponse) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.settle()).then(onFulfilled, onRejected);
  }
}

/**
 * `perTable` decides each table's answer, so a test can fail only `meals`.
 * The default answer carries one row, which is what the `households` PATCH
 * needs to consider itself applied.
 */
function makeClient(perTable: Record<string, FakeResponse> = {}): { client: MirrorClient; tables: string[] } {
  const tables: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      return new FakeQuery(() => perTable[table] ?? { data: [{ id: 'hh-1' }], error: null });
    },
  };
  return { client: client as unknown as MirrorClient, tables };
}

/** A client whose every request throws, the way a dead fetch does. */
function makeThrowingClient(): MirrorClient {
  return {
    from() {
      throw new Error('Network request failed');
    },
  } as unknown as MirrorClient;
}

const meal = (id = 'meal-1', title = 'Pasta pesto'): Meal => ({
  id,
  householdId: 'hh-1',
  title,
  source: 'saved',
  estimatedMinutes: 20,
  skillLevel: 'beginner',
  servings: 2,
  ingredientTags: [],
  allergenTagStatus: 'unknown',
  recipeId: 'recipe-1',
  dishTags: [],
  dishMoods: [],
  sourceUrl: null,
  sourcePlatform: null,
  thumbnailUrl: null,
  excludedFromCookProof: false,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const cookEvent = (id = 'ce-1', mealId = 'meal-1'): CookEvent => ({
  id,
  householdId: 'hh-1',
  mealId,
  decisionId: null,
  cookedOn: '2026-01-02',
  wouldRepeat: true,
  rating: 8.5,
  createdAt: '2026-01-02T18:00:00.000Z',
});

const mealJob = (m: Meal = meal()): MirrorJob => ({ kind: 'meal', meal: m, ingredients: [], steps: [] });
const cookEventJob = (event: CookEvent = cookEvent()): MirrorJob => ({ kind: 'cook_event', event });
const consentJob = (shareCooksWithFriends: boolean): MirrorJob => ({
  kind: 'household_settings',
  householdId: 'hh-1',
  shareCooksWithFriends,
});

describe('the outbox itself', () => {
  test('a job key names the row, so two jobs for the same row share one key', () => {
    expect(mirrorJobKey(mealJob())).toBe('meal:meal-1');
    expect(mirrorJobKey(mealJob(meal('meal-1', 'Pasta pesto, herzien')))).toBe('meal:meal-1');
    expect(mirrorJobKey(cookEventJob())).toBe('cook_event:ce-1');
  });

  /**
   * Coalescing, which is what keeps this an outbox rather than a journal.
   * Only the newest snapshot of a row is worth mirroring — this is not a
   * merge, because nothing is combined and nothing remote is consulted.
   */
  test('re-enqueuing the same row replaces its entry rather than appending', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob(meal('meal-1', 'Eerste titel')));
    await outbox.enqueue(mealJob(meal('meal-1', 'Tweede titel')));

    const entries = await outbox.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.job.kind === 'meal' && entries[0].job.meal.title).toBe('Tweede titel');
  });

  test('two different rows keep two entries', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob(meal('meal-1')));
    await outbox.enqueue(mealJob(meal('meal-2')));
    expect(await outbox.list()).toHaveLength(2);
  });

  /** Durable means durable: a fresh outbox over the same store sees the same backlog. */
  test('an entry survives a new outbox over the same store', async () => {
    const store = createInMemoryKeyValueStore();
    await createMirrorOutbox(store).enqueue(mealJob());

    expect(await createMirrorOutbox(store).list()).toHaveLength(1);
    expect(await store.getItem(MIRROR_OUTBOX_KEY)).not.toBeNull();
  });

  /** Corrupt storage degrades to an empty backlog, matching table.ts's stance on persisted data. */
  test('unparseable storage reads as an empty outbox rather than throwing', async () => {
    const store = createInMemoryKeyValueStore();
    await store.setItem(MIRROR_OUTBOX_KEY, 'not json');
    expect(await createMirrorOutbox(store).list()).toEqual([]);
  });

  test('recording a failure keeps the entry, counts the attempt, and remembers the kind', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob());
    await outbox.recordFailure('meal:meal-1', {
      kind: 'refused',
      operation: 'Mirroring a meal',
      code: '42501',
      message: 'no',
    });

    const [entry] = await outbox.list();
    expect(entry?.attempts).toBe(1);
    expect(entry?.lastFailure?.kind).toBe('refused');
    expect(entry?.lastFailure?.code).toBe('42501');
  });

  test('settling removes the entry', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob());
    await outbox.settle('meal:meal-1');
    expect(await outbox.list()).toEqual([]);
  });
});

describe('writing through', () => {
  /**
   * The order that makes "never lose a write" true: durable first,
   * attempted second. Asserted by watching the store from inside the
   * request — once everything has settled the backlog is empty either way,
   * so only the ordering can tell a correct implementation from one that
   * enqueues on failure.
   */
  test('the job is durable before the request is attempted', async () => {
    const store = createInMemoryKeyValueStore();
    let lastWritten: string | null = null;
    const watched = {
      getItem: (key: string) => store.getItem(key),
      setItem: async (key: string, value: string) => {
        lastWritten = value;
        await store.setItem(key, value);
      },
    };

    let backlogWhenAttempted: number | null = null;
    const client = {
      from() {
        if (backlogWhenAttempted === null) {
          backlogWhenAttempted = (JSON.parse(lastWritten ?? '[]') as unknown[]).length;
        }
        return new FakeQuery(() => ({ error: null }));
      },
    } as unknown as MirrorClient;

    await mirrorWriteThrough(client, createMirrorOutbox(watched), mealJob());
    expect(backlogWhenAttempted).toBe(1);
  });

  test('a successful mirror leaves the outbox empty', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    const outcome = await mirrorWriteThrough(makeClient().client, outbox, mealJob());

    expect(outcome.ok).toBe(true);
    expect(await outbox.list()).toEqual([]);
  });

  test('a failed mirror leaves the job in the outbox', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    const { client } = makeClient({ meals: { error: { code: '08006', message: 'down' } } });

    const outcome = await mirrorWriteThrough(client, outbox, mealJob());
    expect(outcome.ok).toBe(false);
    expect(await outbox.list()).toHaveLength(1);
  });

  /**
   * The local write already succeeded by the time this runs, so a mirror
   * that throws must not take the caller down with it. Callers are expected
   * to fire this and not await it; an unhandled rejection there would be a
   * crash caused by being offline.
   */
  test('a client that throws never propagates out of the write-through', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    const outcome = await mirrorWriteThrough(makeThrowingClient(), outbox, mealJob());

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.failure.kind).toBe('unreachable');
    expect(await outbox.list()).toHaveLength(1);
  });
});

describe('flushing the outbox', () => {
  /**
   * The completeness gate. A cook event is the ONLY door this module opens
   * onto a friend's screen (shared_cooks, 0009), and cook_events.meal_id is
   * a foreign key besides — so proof may not be written while the meal it
   * points at is still an unfinished mirror.
   */
  test('a cook event whose meal is still pending is deferred, not attempted', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob());
    await outbox.recordFailure('meal:meal-1', {
      kind: 'rejected',
      operation: 'Mirroring a meal',
      code: '23514',
      message: 'check',
    });
    await outbox.enqueue(cookEventJob());

    const { client, tables } = makeClient();
    const summary = await flushMirrorOutbox(client, outbox);

    expect(tables).not.toContain('cook_events');
    expect(summary.parked).toBe(1);
    expect(summary.deferred).toBe(1);
    expect(await outbox.list()).toHaveLength(2);
  });

  /** Once the meal lands in this same pass, its cook event becomes eligible immediately. */
  test('a meal is mirrored before its cook event, which then goes in the same pass', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(cookEventJob());
    await outbox.enqueue(mealJob());

    const { client, tables } = makeClient();
    const summary = await flushMirrorOutbox(client, outbox);

    expect(tables.indexOf('meals')).toBeLessThan(tables.indexOf('cook_events'));
    expect(summary.mirrored).toBe(2);
    expect(await outbox.list()).toEqual([]);
  });

  /**
   * A constraint violation means the payload is wrong, and no number of
   * retries changes a payload. It is parked — kept, countable, and visible
   * — rather than spun on.
   */
  test('a rejected entry is parked: retained, but never attempted again', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob());
    await outbox.recordFailure('meal:meal-1', {
      kind: 'rejected',
      operation: 'Mirroring a meal',
      code: '23503',
      message: 'fk',
    });

    const { client, tables } = makeClient();
    const summary = await flushMirrorOutbox(client, outbox);

    expect(tables).toEqual([]);
    expect(summary.parked).toBe(1);
    expect((await outbox.list())[0]?.attempts).toBe(1);
  });

  /** A refusal is retried: the household bootstrap or auth that RLS wants may simply not have landed yet. */
  test('a refused entry is retried on the next flush', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob());
    await outbox.recordFailure('meal:meal-1', {
      kind: 'refused',
      operation: 'Mirroring a meal',
      code: '42501',
      message: 'rls',
    });

    const { client, tables } = makeClient();
    const summary = await flushMirrorOutbox(client, outbox);

    expect(tables).toContain('meals');
    expect(summary.mirrored).toBe(1);
    expect(await outbox.list()).toEqual([]);
  });

  /** A flush that fails again reports the failure with its kind intact, not as a bare count. */
  test('a flush reports each failure with its kind rather than a bare count', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob());

    const { client } = makeClient({ meals: { error: { code: '42501', message: 'rls' } } });
    const summary = await flushMirrorOutbox(client, outbox);

    expect(summary.failed).toBe(1);
    expect(summary.failures.map((failure) => failure.kind)).toEqual(['refused']);
    expect((await outbox.list())[0]?.attempts).toBe(1);
  });

  test('an empty outbox flushes to zeroes without touching the client', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    const { client, tables } = makeClient();
    const summary = await flushMirrorOutbox(client, outbox);

    expect(summary).toEqual({ mirrored: 0, failed: 0, deferred: 0, parked: 0, failures: [] });
    expect(tables).toEqual([]);
  });
});

describe('cook-proof consent in the outbox', () => {
  test('a consent job is keyed on the household, so the latest answer is the queued one', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    expect(mirrorJobKey(consentJob(true))).toBe('household_settings:hh-1');

    await outbox.enqueue(consentJob(true));
    await outbox.enqueue(consentJob(false));

    const entries = await outbox.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.job.kind === 'household_settings' && entries[0].job.shareCooksWithFriends).toBe(false);
  });

  /**
   * A revoke is a promise already made to the user — "sharing has
   * stopped" — so it must not queue behind a library's worth of meals. It
   * is not more determined than an enable, which would be a different bug;
   * it is exactly as determined, and both go first.
   */
  test('consent is flushed before meals and cook events', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob());
    await outbox.enqueue(cookEventJob());
    await outbox.enqueue(consentJob(false));

    const { client, tables } = makeClient();
    const summary = await flushMirrorOutbox(client, outbox);

    expect(tables[0]).toBe('households');
    expect(summary.mirrored).toBe(3);
  });

  /** A failed revoke stays in the outbox and is retried exactly as a failed enable is. */
  test('a failed revoke and a failed enable are both retained and both retried', async () => {
    for (const value of [true, false]) {
      const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
      const down = makeClient({ households: { error: { message: 'fetch failed' } } });

      await mirrorWriteThrough(down.client, outbox, consentJob(value));
      expect(await outbox.list()).toHaveLength(1);

      const up = makeClient();
      expect((await flushMirrorOutbox(up.client, outbox)).mirrored).toBe(1);
      expect(await outbox.list()).toEqual([]);
    }
  });

  /** Consent does not gate on a meal, and no meal gates on consent — they are independent jobs. */
  test('consent flushes even while every meal in the outbox is parked', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(mealJob());
    await outbox.recordFailure('meal:meal-1', {
      kind: 'rejected',
      operation: 'Mirroring a meal',
      code: '23514',
      message: 'check',
    });
    await outbox.enqueue(consentJob(false));

    const { client, tables } = makeClient();
    const summary = await flushMirrorOutbox(client, outbox);

    expect(tables).toEqual(['households']);
    expect(summary.mirrored).toBe(1);
    expect(summary.parked).toBe(1);
  });
});

describe('the completeness marker', () => {
  /**
   * The one thing this module can honestly answer about a partial mirror:
   * whether a meal has an unfinished job. It is what gates cook proof
   * above, and what any surface that opens a door onto a meal — a directed
   * send — must consult before it does.
   */
  test('a meal with an unfinished job is pending, and stops being pending when it settles', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    expect(await hasPendingMealMirror(outbox, 'meal-1')).toBe(false);

    await outbox.enqueue(mealJob());
    expect(await hasPendingMealMirror(outbox, 'meal-1')).toBe(true);
    expect(await hasPendingMealMirror(outbox, 'meal-2')).toBe(false);

    await outbox.settle('meal:meal-1');
    expect(await hasPendingMealMirror(outbox, 'meal-1')).toBe(false);
  });

  /** A cook event queued for a meal says nothing about that meal's own completeness. */
  test('a pending cook event does not make its meal pending', async () => {
    const outbox = createMirrorOutbox(createInMemoryKeyValueStore());
    await outbox.enqueue(cookEventJob());
    expect(await hasPendingMealMirror(outbox, 'meal-1')).toBe(false);
  });
});

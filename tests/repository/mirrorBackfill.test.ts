/**
 * The one-time pass that puts a library written BEFORE the mirror existed
 * into the mirror's outbox — and the correctness bug that makes it
 * mandatory rather than nice to have.
 *
 * THE BUG, RESTATED SO THE ASSERTIONS BELOW READ AS EVIDENCE. W-16 wired
 * every local write to `MirrorJobSink`, so a meal created from now on is
 * enqueued and eventually reaches Postgres. A meal created BEFORE that
 * wiring has no outbox entry and nothing will ever make one. That is bad
 * twice over: the row never reaches Postgres at all, and
 * `hasPendingMealMirror` answers `false` for it — its own header says
 * `false` covers both "mirror landed" and "never enqueued" — so
 * src/lib/sendRecipe.ts opens a door onto a meal whose ingredients and
 * steps are not there. The friend gets an empty recipe. The gate test in
 * this file is that sentence turned into an assertion.
 *
 * THE THREE THINGS THIS SUITE IS REALLY GUARDING.
 *
 *   1. COVERAGE — every meal, every cook event, the household's consent,
 *      and NOTHING ELSE. Saves, decisions, members and restrictions are
 *      not the mirror's (mirror/types.ts says why, and
 *      `member_restrictions` is Article 9 health data), so enqueuing one
 *      would be a privacy change disguised as a backfill.
 *
 *   2. ORDER — after `migrateIdsToUuid`, never before. A job carrying a
 *      legacy id earns a 22P02, which mirror/rows.ts classifies as
 *      `rejected` and mirror/index.ts parks FOREVER. Both halves are
 *      tested: the behaviour (a legacy store yields no jobs and no
 *      completion mark) and the wiring (createRepository.ts's own chain).
 *
 *   3. IDEMPOTENCE — and specifically the trap. "Enqueue everything on
 *      every launch" fixes the bug above and creates a worse one: the
 *      outbox is never empty, so `hasPendingMealMirror` is permanently
 *      `true` and every send is blocked forever. So the second launch has
 *      to do NOTHING, including for a meal that has since been mirrored
 *      and settled off the outbox.
 */

import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createRepositoryTables } from '@/lib/repository/local/tables';
import { isUuid } from '@/lib/repository/id';
import { migrateIdsToUuid } from '@/lib/repository/migrateIdsToUuid';
import {
  MIRROR_BACKFILL_KEY,
  MIRROR_BACKFILL_VERSION,
  backfillMirrorOutbox,
  readMirrorBackfillVersion,
} from '@/lib/repository/backfillMirrorOutbox';
import { createMirrorOutbox, hasPendingMealMirror, mirrorJobKey } from '@/lib/repository/mirror';
import type { MirrorJob, MirrorMealJob } from '@/lib/repository/mirror/types';
import type { CookEvent, Household, Meal, MealIngredient, MealStep } from '@/domain/types';

// ---------------------------------------------------------------------------
// A device that predates the mirror
// ---------------------------------------------------------------------------

/**
 * Real uuids, because that is what a store looks like AFTER
 * `migrateIdsToUuid` has been over it — which is the only state the
 * backfill is ever supposed to see. tests/fixtures.ts's `'meal-1'` ids
 * would be indistinguishable from un-migrated legacy ids here, and that
 * distinction is the whole subject of the ordering section below.
 */
const ID = {
  household: '11111111-1111-4111-8111-111111111111',
  mealPasta: '22222222-2222-4222-8222-222222222222',
  mealSoup: '33333333-3333-4333-8333-333333333333',
  mealCurated: '44444444-4444-4444-8444-444444444444',
  ingredientPesto: '55555555-5555-4555-8555-555555555555',
  ingredientPasta: '66666666-6666-4666-8666-666666666666',
  stepBoil: '77777777-7777-4777-8777-777777777777',
  stepStir: '88888888-8888-4888-8888-888888888888',
  cookPasta: '99999999-9999-4999-8999-999999999999',
  cookSoup: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  member: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  save: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  decision: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  restriction: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
} as const;

const CREATED_AT = '2026-01-01T00:00:00.000Z';

function makeMeal(overrides: Partial<Meal> & Pick<Meal, 'id'>): Meal {
  return {
    householdId: ID.household,
    title: 'Pasta pesto',
    source: 'saved',
    estimatedMinutes: 20,
    skillLevel: 'beginner',
    servings: 4,
    ingredientTags: [],
    allergenTagStatus: 'verified',
    dishTags: ['pasta'],
    sourceUrl: null,
    sourcePlatform: null,
    thumbnailUrl: null,
    archivedAt: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makeCookEvent(overrides: Partial<CookEvent> & Pick<CookEvent, 'id' | 'mealId'>): CookEvent {
  return {
    householdId: ID.household,
    decisionId: null,
    cookedOn: '2026-01-02',
    wouldRepeat: true,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: ID.household,
    name: 'Thuis',
    timezone: 'Europe/Amsterdam',
    decisionPushTime: '16:00',
    weeknightTimeBudgetMinutes: 30,
    skillLevel: 'intermediate',
    createdAt: CREATED_AT,
    ...overrides,
  };
}

const INGREDIENTS: readonly MealIngredient[] = [
  // Deliberately stored out of order, so "the job carries them sorted" is
  // a claim about the backfill and not about the fixture.
  {
    id: ID.ingredientPasta,
    mealId: ID.mealPasta,
    name: '400 g penne',
    quantity: '400',
    unit: 'g',
    allergenTags: ['gluten'],
    sortOrder: 1,
  },
  {
    id: ID.ingredientPesto,
    mealId: ID.mealPasta,
    name: '1 pot pesto',
    quantity: null,
    unit: null,
    allergenTags: ['noten'],
    sortOrder: 0,
  },
];

const STEPS: readonly MealStep[] = [
  { id: ID.stepStir, mealId: ID.mealPasta, stepNumber: 2, instruction: 'Roer de pesto erdoor.', durationMinutes: null },
  { id: ID.stepBoil, mealId: ID.mealPasta, stepNumber: 1, instruction: 'Kook de pasta.', durationMinutes: 11 },
];

/**
 * A store as it sits on the owner's phone before this module ever runs:
 * real recipes, real cook history, a consent answer — and rows in four
 * tables the mirror does not carry, present precisely so their absence
 * from the outbox can be asserted rather than assumed.
 */
async function seedPreMirrorStore(
  store: KeyValueStore,
  options: { readonly shareCooksWithFriends?: boolean; readonly includeCurated?: boolean } = {},
): Promise<void> {
  const tables = createRepositoryTables(store);
  await tables.households.replaceAll([makeHousehold({ shareCooksWithFriends: options.shareCooksWithFriends })]);
  await tables.meals.replaceAll([
    makeMeal({ id: ID.mealPasta }),
    makeMeal({ id: ID.mealSoup, title: 'Tomatensoep', dishTags: ['soep'] }),
    ...(options.includeCurated === true
      ? [makeMeal({ id: ID.mealCurated, householdId: null, title: 'Curated risotto', source: 'seeded' })]
      : []),
  ]);
  await tables.mealIngredients.replaceAll(INGREDIENTS);
  await tables.mealSteps.replaceAll(STEPS);
  await tables.cookEvents.replaceAll([
    makeCookEvent({ id: ID.cookPasta, mealId: ID.mealPasta }),
    makeCookEvent({ id: ID.cookSoup, mealId: ID.mealSoup, wouldRepeat: null }),
  ]);
  // Not the mirror's, all four. See the file header.
  await tables.members.replaceAll([
    {
      id: ID.member,
      householdId: ID.household,
      displayName: 'Sanne',
      authUserId: null,
      healthDataConsentAt: CREATED_AT,
      createdAt: CREATED_AT,
    },
  ]);
  await tables.restrictions.replaceAll([
    {
      id: ID.restriction,
      memberId: ID.member,
      type: 'allergen',
      excludesTag: 'noten',
      notes: null,
      createdAt: CREATED_AT,
    },
  ]);
  await tables.saves.replaceAll([
    {
      id: ID.save,
      householdId: ID.household,
      memberId: ID.member,
      mealId: ID.mealPasta,
      intent: 'this_week',
      sourceUrl: null,
      savedAt: CREATED_AT,
    },
  ]);
  await tables.decisions.replaceAll([
    {
      id: ID.decision,
      householdId: ID.household,
      decisionDate: '2026-01-02',
      mealId: ID.mealPasta,
      initialMealId: ID.mealPasta,
      reasonCode: 'not_recent',
      reasonText: 'Al even niet gemaakt.',
      status: 'accepted',
      createdAt: CREATED_AT,
      respondedAt: CREATED_AT,
    },
  ]);
}

async function outboxJobs(store: KeyValueStore): Promise<readonly MirrorJob[]> {
  return (await createMirrorOutbox(store).list()).map((entry) => entry.job);
}

async function outboxKeys(store: KeyValueStore): Promise<readonly string[]> {
  return (await createMirrorOutbox(store).list()).map((entry) => entry.key).sort();
}

function mealJob(jobs: readonly MirrorJob[], mealId: string): MirrorMealJob {
  const found = jobs.find((job): job is MirrorMealJob => job.kind === 'meal' && job.meal.id === mealId);
  if (found === undefined) {
    throw new Error(`No meal job for ${mealId} in the outbox.`);
  }
  return found;
}

/** Counts writes, so "a second launch does nothing" can be asserted rather than described. */
function countingStore(inner: KeyValueStore): { readonly store: KeyValueStore; readonly writes: () => number } {
  let writes = 0;
  return {
    store: {
      getItem: (key) => inner.getItem(key),
      setItem: async (key, value) => {
        writes += 1;
        await inner.setItem(key, value);
      },
    },
    writes: () => writes,
  };
}

/** A store whose writes to one key always fail — a phone that ran out of room mid-pass. */
function storeFailingWritesTo(inner: KeyValueStore, failingKey: string): KeyValueStore {
  return {
    getItem: (key) => inner.getItem(key),
    setItem: async (key, value) => {
      if (key === failingKey) {
        throw new Error(`storage refused ${key}`);
      }
      await inner.setItem(key, value);
    },
  };
}

// ---------------------------------------------------------------------------
// Coverage: exactly what the mirror mirrors
// ---------------------------------------------------------------------------

describe('backfillMirrorOutbox — what a pre-existing library gets', () => {
  test('every stored meal is enqueued, carrying its ingredients and steps in order', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);

    const result = await backfillMirrorOutbox(store);

    expect(result.meals).toBe(2);
    const jobs = await outboxJobs(store);
    const pasta = mealJob(jobs, ID.mealPasta);
    expect(pasta.meal.title).toBe('Pasta pesto');
    expect(pasta.ingredients.map((ingredient) => ingredient.id)).toEqual([ID.ingredientPesto, ID.ingredientPasta]);
    expect(pasta.steps.map((step) => step.id)).toEqual([ID.stepBoil, ID.stepStir]);
  });

  test("a meal with no children carries empty child sets, not another meal's", async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);

    await backfillMirrorOutbox(store);

    const soup = mealJob(await outboxJobs(store), ID.mealSoup);
    expect(soup.ingredients).toEqual([]);
    expect(soup.steps).toEqual([]);
  });

  test('every stored cook event is enqueued', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);

    const result = await backfillMirrorOutbox(store);

    expect(result.cookEvents).toBe(2);
    expect((await outboxJobs(store)).filter((job) => job.kind === 'cook_event')).toHaveLength(2);
  });

  test("the household's cook-sharing consent is enqueued as a household_settings job", async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store, { shareCooksWithFriends: true });

    const result = await backfillMirrorOutbox(store);

    expect(result.householdSettings).toBe(1);
    expect((await outboxJobs(store)).filter((job) => job.kind === 'household_settings')).toEqual([
      { kind: 'household_settings', householdId: ID.household, shareCooksWithFriends: true },
    ]);
  });

  test('a household that was never asked mirrors false, never an invented yes', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);

    await backfillMirrorOutbox(store);

    expect((await outboxJobs(store)).filter((job) => job.kind === 'household_settings')).toEqual([
      { kind: 'household_settings', householdId: ID.household, shareCooksWithFriends: false },
    ]);
  });

  test('saves, decisions, members and restrictions are not enqueued — the mirror does not carry them', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);

    await backfillMirrorOutbox(store);

    expect(await outboxKeys(store)).toEqual(
      [
        `meal:${ID.mealPasta}`,
        `meal:${ID.mealSoup}`,
        `cook_event:${ID.cookPasta}`,
        `cook_event:${ID.cookSoup}`,
        `household_settings:${ID.household}`,
      ].sort(),
    );
  });

  test('an empty store enqueues nothing and still records itself as done', async () => {
    const store = createInMemoryKeyValueStore();

    const result = await backfillMirrorOutbox(store);

    expect(result.meals + result.cookEvents + result.householdSettings).toBe(0);
    expect(result.completed).toBe(true);
    expect(await readMirrorBackfillVersion(store)).toBe(MIRROR_BACKFILL_VERSION);
  });
});

// ---------------------------------------------------------------------------
// The bug this exists for
// ---------------------------------------------------------------------------

describe('the send gate', () => {
  test('a pre-existing meal passes the gate before the backfill — the bug — and is blocked after it', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);
    const outbox = createMirrorOutbox(store);

    // The bug, stated as an assertion: nothing is queued, so the gate says
    // "nothing pending" and sendRecipe.ts opens a door onto a meal with no
    // rows in Postgres.
    expect(await hasPendingMealMirror(outbox, ID.mealPasta)).toBe(false);

    await backfillMirrorOutbox(store);

    expect(await hasPendingMealMirror(outbox, ID.mealPasta)).toBe(true);
    expect(await hasPendingMealMirror(outbox, ID.mealSoup)).toBe(true);
  });

  test('the gate reopens only once the mirror actually lands', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);
    const outbox = createMirrorOutbox(store);
    await backfillMirrorOutbox(store);

    await outbox.settle(`meal:${ID.mealPasta}`);

    expect(await hasPendingMealMirror(outbox, ID.mealPasta)).toBe(false);
    expect(await hasPendingMealMirror(outbox, ID.mealSoup)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Idempotence, and the trap
// ---------------------------------------------------------------------------

describe('running it a second time', () => {
  test('a second launch enqueues nothing and writes nothing at all', async () => {
    const inner = createInMemoryKeyValueStore();
    await seedPreMirrorStore(inner);
    await backfillMirrorOutbox(inner);
    const counted = countingStore(inner);

    const result = await backfillMirrorOutbox(counted.store);

    expect(counted.writes()).toBe(0);
    expect(result.meals + result.cookEvents + result.householdSettings).toBe(0);
    expect(result.completed).toBe(true);
  });

  test('a meal that was mirrored and settled off the outbox is NOT resurrected', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);
    const outbox = createMirrorOutbox(store);
    await backfillMirrorOutbox(store);

    // The flush drains the whole backlog, exactly as it would on a phone
    // with a connection.
    for (const entry of await outbox.list()) {
      await outbox.settle(entry.key);
    }
    await backfillMirrorOutbox(store);

    expect(await outbox.list()).toEqual([]);
    expect(await hasPendingMealMirror(outbox, ID.mealPasta)).toBe(false);
  });

  test('an entry a live write already queued is replaced, never duplicated', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);
    const outbox = createMirrorOutbox(store);
    const job: MirrorJob = { kind: 'meal', meal: makeMeal({ id: ID.mealPasta }), ingredients: [], steps: [] };
    await outbox.enqueue(job);

    await backfillMirrorOutbox(store);

    expect((await outbox.list()).filter((entry) => entry.key === mirrorJobKey(job))).toHaveLength(1);
    // And it is the backfill's fuller snapshot that survived, not the
    // childless one the live write left behind.
    expect(mealJob(await outboxJobs(store), ID.mealPasta).ingredients).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Order against migrateIdsToUuid
// ---------------------------------------------------------------------------

describe('ordering: after the id migration, never before', () => {
  const LEGACY = {
    household: 'household-lz8k2p-1-a9f2c1',
    meal: 'meal-lz8k2p-5-a9f2c5',
    cookEvent: 'cook-event-lz8k2p-d-a9f2c13',
  } as const;

  async function seedLegacyIdStore(store: KeyValueStore): Promise<void> {
    const tables = createRepositoryTables(store);
    await tables.households.replaceAll([makeHousehold({ id: LEGACY.household })]);
    await tables.meals.replaceAll([makeMeal({ id: LEGACY.meal, householdId: LEGACY.household })]);
    await tables.cookEvents.replaceAll([
      makeCookEvent({ id: LEGACY.cookEvent, mealId: LEGACY.meal, householdId: LEGACY.household }),
    ]);
  }

  test('run against un-migrated rows it enqueues nothing — a legacy id would be parked forever', async () => {
    const store = createInMemoryKeyValueStore();
    await seedLegacyIdStore(store);

    const result = await backfillMirrorOutbox(store);

    expect(await outboxKeys(store)).toEqual([]);
    expect(result.deferred).toBe(3);
  });

  test('and refuses to record itself as done, so the next launch finishes the job', async () => {
    const store = createInMemoryKeyValueStore();
    await seedLegacyIdStore(store);

    const first = await backfillMirrorOutbox(store);

    expect(first.completed).toBe(false);
    expect(await readMirrorBackfillVersion(store)).toBe(0);

    await migrateIdsToUuid(store);
    const second = await backfillMirrorOutbox(store);

    expect(second.completed).toBe(true);
    expect(second.meals).toBe(1);
    expect(second.cookEvents).toBe(1);
    expect(second.householdSettings).toBe(1);
  });

  test('in the right order, every id that reaches the outbox is a uuid Postgres can parse', async () => {
    const store = createInMemoryKeyValueStore();
    await seedLegacyIdStore(store);

    await migrateIdsToUuid(store);
    await backfillMirrorOutbox(store);

    const jobs = await outboxJobs(store);
    expect(jobs).toHaveLength(3);
    for (const job of jobs) {
      if (job.kind === 'meal') {
        expect(isUuid(job.meal.id)).toBe(true);
        expect(isUuid(job.meal.householdId)).toBe(true);
      } else if (job.kind === 'cook_event') {
        expect(isUuid(job.event.id)).toBe(true);
        expect(isUuid(job.event.mealId)).toBe(true);
      } else {
        expect(isUuid(job.householdId)).toBe(true);
      }
    }
  });

  /**
   * The wiring itself, read as TEXT rather than imported.
   * createRepository.ts pulls src/lib/supabase.ts, which throws at module
   * scope without EXPO_PUBLIC_SUPABASE_*, so no test may import it — its
   * own header says so. The order of those two calls is the difference
   * between a working backfill and an outbox full of permanently parked
   * entries, which is far too load-bearing to leave with no test at all,
   * and the source text is the only evidence reachable from here.
   */
  test('createRepository.ts calls the migration before the backfill', () => {
    const source = readFileSync(path.resolve(__dirname, '../../src/lib/repository/createRepository.ts'), 'utf8');
    const migrationAt = source.indexOf('migrateIdsToUuid(');
    const backfillAt = source.indexOf('backfillMirrorOutbox(');

    expect(migrationAt).toBeGreaterThan(-1);
    expect(backfillAt).toBeGreaterThan(-1);
    expect(migrationAt).toBeLessThan(backfillAt);
  });
});

// ---------------------------------------------------------------------------
// Rows the mirror can never accept
// ---------------------------------------------------------------------------

describe('rows no retry could ever land', () => {
  test('a curated meal is left out — rows.ts refuses it, and a parked entry would block its send forever', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store, { includeCurated: true });

    const result = await backfillMirrorOutbox(store);

    expect(await outboxKeys(store)).not.toContain(`meal:${ID.mealCurated}`);
    expect(result.meals).toBe(2);
    expect(result.excluded).toBe(1);
  });

  test('and being left out does not keep the pass from completing — no later run could fix it', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store, { includeCurated: true });

    const result = await backfillMirrorOutbox(store);

    expect(result.completed).toBe(true);
    expect(await readMirrorBackfillVersion(store)).toBe(MIRROR_BACKFILL_VERSION);
  });
});

// ---------------------------------------------------------------------------
// The marker
// ---------------------------------------------------------------------------

describe('the completion marker', () => {
  test('is written LAST: a pass whose enqueues fail records nothing', async () => {
    const inner = createInMemoryKeyValueStore();
    await seedPreMirrorStore(inner);
    const store = storeFailingWritesTo(inner, 'remy:mirror_outbox');

    await expect(backfillMirrorOutbox(store)).rejects.toThrow();

    expect(await readMirrorBackfillVersion(inner)).toBe(0);
  });

  test('and the next launch, on a store that can be written, finishes the job', async () => {
    const inner = createInMemoryKeyValueStore();
    await seedPreMirrorStore(inner);
    await backfillMirrorOutbox(storeFailingWritesTo(inner, 'remy:mirror_outbox')).catch(() => undefined);

    const result = await backfillMirrorOutbox(inner);

    expect(result.completed).toBe(true);
    expect(result.meals).toBe(2);
  });

  test('a corrupt marker value means "never run" — re-running is safe, skipping is not', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);
    await store.setItem(MIRROR_BACKFILL_KEY, 'nonsense');

    expect(await readMirrorBackfillVersion(store)).toBe(0);
    const result = await backfillMirrorOutbox(store);

    expect(result.meals).toBe(2);
  });

  test('a marker from a future build is left alone and its work is not redone', async () => {
    const store = createInMemoryKeyValueStore();
    await seedPreMirrorStore(store);
    await store.setItem(MIRROR_BACKFILL_KEY, String(MIRROR_BACKFILL_VERSION + 1));

    const result = await backfillMirrorOutbox(store);

    expect(result.completed).toBe(true);
    expect(await outboxKeys(store)).toEqual([]);
    expect(await store.getItem(MIRROR_BACKFILL_KEY)).toBe(String(MIRROR_BACKFILL_VERSION + 1));
  });
});

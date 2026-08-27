import { beforeEach, describe, expect, test } from 'vitest';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createRepositoryTables } from '@/lib/repository/local/tables';
import { generateLocalId, generateUuid, isUuid } from '@/lib/repository/id';
import {
  LOCAL_ID_TABLES,
  SCHEMA_VERSION_KEY,
  STORE_SCHEMA_VERSION,
  TABLES_WITHOUT_LOCAL_IDS,
  migrateIdsToUuid,
  readStoreSchemaVersion,
} from '@/lib/repository/migrateIdsToUuid';
import {
  ALL_KEYS,
  FOREIGN,
  dumpStore,
  findBy,
  findDanglingReferences,
  legacyId,
  nonUuidIds,
  rowsOf,
  seedLegacyStore,
} from './idMigrationFixtures';

/**
 * The migration's whole promise is "renumber and MEAN it": every id becomes
 * a real uuid AND every reference still points at the same logical row.
 * A test suite that only checked the first half would pass while every
 * cook event, save and decision quietly pointed at a meal that no longer
 * exists — the exact failure this file exists to make impossible.
 *
 * So the assertions here are built on two independent legs:
 *
 * 1. A structural leg (`findDanglingReferences`, idMigrationFixtures.ts)
 *    that walks the WHOLE migrated store and reports any local-id
 *    reference with no row to resolve to. It knows nothing about which
 *    rows the fixture happens to contain; it would catch an orphan in a
 *    table this file never mentions by name. Its own teeth are proven by a
 *    negative-control test below, because an integrity checker nobody has
 *    ever seen fail is indistinguishable from `expect(true).toBe(true)`.
 *
 * 2. An identity leg that re-finds every row by a NATURAL key (a title, a
 *    display name, a date — never an id) and asserts the migrated
 *    references point at the row they pointed at before. Dangling-free is
 *    not enough: a remap that sent every cook event to the wrong meal
 *    would be perfectly non-dangling and completely wrong.
 */

// ---------------------------------------------------------------------------
// generateLocalId
// ---------------------------------------------------------------------------

describe('generateLocalId — real uuids', () => {
  test('mints an RFC 4122 uuid, not a prefixed local id', () => {
    const id = generateLocalId('meal');

    expect(isUuid(id)).toBe(true);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('the prefix never reaches the stored value — a uuid column cannot hold "meal-<uuid>"', () => {
    expect(generateLocalId('meal')).not.toContain('meal');
    expect(generateLocalId('cook-event')).not.toContain('cook');
    expect(generateLocalId('household')).not.toContain('household');
  });

  test('two thousand mints collide zero times', () => {
    const ids = Array.from({ length: 2000 }, () => generateLocalId('meal'));

    expect(new Set(ids).size).toBe(2000);
  });

  test('generateUuid is the same primitive under an honest name', () => {
    expect(isUuid(generateUuid())).toBe(true);
  });
});

describe('isUuid', () => {
  test('accepts canonical lowercase and uppercase uuids', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('11111111-1111-4111-8111-111111111111'.toUpperCase())).toBe(true);
  });

  test('rejects the old local-id format and other near-misses', () => {
    expect(isUuid('meal-lz8k2p-3-a9f2c1')).toBe(false);
    expect(isUuid('meal-11111111-1111-4111-8111-111111111111')).toBe(false);
    expect(isUuid('11111111-1111-4111-8111-11111111111')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The migration
// ---------------------------------------------------------------------------

describe('migrateIdsToUuid — renumber and carry along', () => {
  let store: KeyValueStore;

  beforeEach(async () => {
    store = createInMemoryKeyValueStore();
    await seedLegacyStore(store);
  });

  test('every id in the store is a uuid afterwards', async () => {
    await migrateIdsToUuid(store);

    expect(nonUuidIds(await dumpStore(store))).toEqual([]);
  });

  test('no row is dropped from any table', async () => {
    const before = await dumpStore(store);
    await migrateIdsToUuid(store);
    const after = await dumpStore(store);

    for (const key of ALL_KEYS) {
      expect(rowsOf(after, key)).toHaveLength(rowsOf(before, key).length);
    }
  });

  /**
   * THE ORPHAN TEST. A remap that renumbered `remy:meals` and left
   * `remy:cook_events.mealId` untouched passes every "looks like a uuid"
   * assertion above and fails here, which is the only reason this file is
   * worth its length.
   */
  test('no reference anywhere in the store dangles', async () => {
    await migrateIdsToUuid(store);

    expect(findDanglingReferences(await dumpStore(store))).toEqual([]);
  });

  test('the dangling-reference checker actually has teeth', async () => {
    await migrateIdsToUuid(store);
    const dump = await dumpStore(store);
    const orphaned = {
      ...dump,
      'remy:cook_events': rowsOf(dump, 'remy:cook_events').map((row) => ({ ...row, mealId: generateUuid() })),
    };

    expect(findDanglingReferences(orphaned)).toHaveLength(2);
  });

  test('every reference resolves to the SAME logical row it pointed at before', async () => {
    await migrateIdsToUuid(store);
    const dump = await dumpStore(store);

    // Re-found by natural keys only — never by an id, which is the thing
    // under test.
    const household = findBy(dump, 'remy:households', 'name', 'Mijn huishouden');
    const sanne = findBy(dump, 'remy:household_members', 'displayName', 'Sanne');
    const joris = findBy(dump, 'remy:household_members', 'displayName', 'Joris');
    const pasta = findBy(dump, 'remy:meals', 'title', 'Pasta pesto');
    const curated = findBy(dump, 'remy:meals', 'title', 'Curated stamppot');
    const restriction = findBy(dump, 'remy:member_restrictions', 'excludesTag', 'noten');
    const decision = findBy(dump, 'remy:decisions', 'decisionDate', '2026-08-10');
    const cookedPasta = findBy(dump, 'remy:cook_events', 'cookedOn', '2026-08-10');
    const cookedCurated = findBy(dump, 'remy:cook_events', 'cookedOn', '2026-08-12');
    const thisWeek = findBy(dump, 'remy:saves', 'intent', 'this_week');
    const someday = findBy(dump, 'remy:saves', 'intent', 'someday');
    const share = findBy(dump, 'remy:recipe_shares', 'sentAt', '2026-08-11T12:00:00.000Z');

    expect(sanne['householdId']).toBe(household['id']);
    expect(joris['householdId']).toBe(household['id']);
    expect(restriction['memberId']).toBe(sanne['id']);
    expect(pasta['householdId']).toBe(household['id']);
    // A curated meal belongs to no household and must still belong to none.
    expect(curated['householdId']).toBeNull();

    const ingredientMealIds = rowsOf(dump, 'remy:meal_ingredients').map((row) => row['mealId']);
    expect(ingredientMealIds).toEqual([pasta['id'], pasta['id']]);
    expect(rowsOf(dump, 'remy:meal_steps')[0]?.['mealId']).toBe(pasta['id']);

    expect(thisWeek['mealId']).toBe(pasta['id']);
    expect(thisWeek['memberId']).toBe(sanne['id']);
    expect(someday['mealId']).toBe(curated['id']);
    expect(someday['memberId']).toBeNull();

    // The two meal references on a decision row are different rows and
    // must stay different rows.
    expect(decision['mealId']).toBe(curated['id']);
    expect(decision['initialMealId']).toBe(pasta['id']);
    expect(decision['mealId']).not.toBe(decision['initialMealId']);

    expect(cookedPasta['mealId']).toBe(pasta['id']);
    expect(cookedPasta['decisionId']).toBe(decision['id']);
    expect(cookedCurated['mealId']).toBe(curated['id']);
    expect(cookedCurated['decisionId']).toBeNull();

    expect(share['mealId']).toBe(pasta['id']);
  });

  test('two different rows never collapse onto one uuid', async () => {
    await migrateIdsToUuid(store);
    const dump = await dumpStore(store);

    const allOwnIds = ALL_KEYS.flatMap((key) => rowsOf(dump, key).map((row) => row['id']));
    expect(new Set(allOwnIds).size).toBe(allOwnIds.length);
  });

  test('every non-id field survives untouched, including keys with no Postgres column', async () => {
    await migrateIdsToUuid(store);
    const dump = await dumpStore(store);

    const household = findBy(dump, 'remy:households', 'name', 'Mijn huishouden');
    expect(household['cookSharingAskedAt']).toBe('2026-08-01T10:00:00.000Z');
    expect(household['shareCooksWithFriends']).toBe(true);
    expect(household['weeknightTimeBudgetMinutes']).toBe(30);

    const pasta = findBy(dump, 'remy:meals', 'title', 'Pasta pesto');
    expect(pasta['ingredientTags']).toEqual(['noten']);
    expect(pasta['dishTags']).toEqual(['pasta']);
    expect(pasta['dishMoods']).toEqual(['zomers']);
    expect(pasta['allergenTagStatus']).toBe('verified');
    expect(pasta['excludedFromCookProof']).toBe(false);

    const curated = findBy(dump, 'remy:meals', 'title', 'Curated stamppot');
    // Absent optional keys must stay absent, not be invented as null.
    expect('dishMoods' in curated).toBe(false);
    expect('recipeId' in curated).toBe(false);

    const cookedPasta = findBy(dump, 'remy:cook_events', 'cookedOn', '2026-08-10');
    expect(cookedPasta['rating']).toBe(5);
    expect(cookedPasta['wouldRepeat']).toBe(true);
  });

  test('ids owned by somebody else are never renumbered', async () => {
    await migrateIdsToUuid(store);
    const dump = await dumpStore(store);

    // A canonical `recipes` row lives only in Postgres. Renumbering it
    // would silently unhook cook proof from every friend's copy.
    expect(findBy(dump, 'remy:meals', 'title', 'Pasta pesto')['recipeId']).toBe(FOREIGN.canonicalRecipe);
    expect(rowsOf(dump, 'remy:recipe_ratings')[0]?.['recipeId']).toBe(FOREIGN.canonicalRecipe);

    // `auth.users.id` — this app does not get to rename an account.
    expect(findBy(dump, 'remy:household_members', 'displayName', 'Sanne')['authUserId']).toBe(FOREIGN.authUser);

    // A profile IS an auth user's public face; its id is supplied, never minted here.
    expect(rowsOf(dump, 'remy:profiles').map((row) => row['id'])).toEqual([
      FOREIGN.profileSelf,
      FOREIGN.profileFriend,
    ]);
    const friendship = rowsOf(dump, 'remy:friendships')[0];
    expect(friendship?.['requesterId']).toBe(FOREIGN.profileSelf);
    expect(friendship?.['addresseeId']).toBe(FOREIGN.profileFriend);
    expect(rowsOf(dump, 'remy:recipe_ratings')[0]?.['raterProfileId']).toBe(FOREIGN.profileSelf);
  });

  test("locally-minted social row ids ARE renumbered — they are this device's rows", async () => {
    await migrateIdsToUuid(store);
    const dump = await dumpStore(store);

    expect(isUuid(rowsOf(dump, 'remy:friendships')[0]?.['id'])).toBe(true);
    expect(isUuid(rowsOf(dump, 'remy:recipe_ratings')[0]?.['id'])).toBe(true);
    expect(isUuid(rowsOf(dump, 'remy:recipe_shares')[0]?.['id'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Idempotence and partial application
// ---------------------------------------------------------------------------

describe('migrateIdsToUuid — running it again', () => {
  test('a second run changes nothing at all', async () => {
    const store = createInMemoryKeyValueStore();
    await seedLegacyStore(store);

    await migrateIdsToUuid(store);
    const afterFirst = await dumpStore(store);
    const result = await migrateIdsToUuid(store);
    const afterSecond = await dumpStore(store);

    expect(afterSecond).toEqual(afterFirst);
    expect(result.remappedRowCount).toBe(0);
    expect(result.rewrittenTables).toEqual([]);
  });

  test('a second run performs no writes whatsoever', async () => {
    const store = createInMemoryKeyValueStore();
    await seedLegacyStore(store);
    await migrateIdsToUuid(store);

    const writes: string[] = [];
    const watched: KeyValueStore = {
      getItem: (key) => store.getItem(key),
      setItem: async (key, value) => {
        writes.push(key);
        await store.setItem(key, value);
      },
    };
    await migrateIdsToUuid(watched);

    expect(writes).toEqual([]);
  });

  test('a row that already carries a uuid is left byte-identical', async () => {
    const store = createInMemoryKeyValueStore();
    const alreadyMigrated = generateUuid();
    await store.setItem(
      'remy:meals',
      JSON.stringify([
        { id: alreadyMigrated, householdId: null, title: 'Al gemigreerd', createdAt: '2026-08-01T10:00:00.000Z' },
        { id: legacyId('meal', 99), householdId: null, title: 'Nog niet', createdAt: '2026-08-01T10:00:00.000Z' },
      ]),
    );

    await migrateIdsToUuid(store);
    const dump = await dumpStore(store);

    expect(findBy(dump, 'remy:meals', 'title', 'Al gemigreerd')['id']).toBe(alreadyMigrated);
    expect(isUuid(findBy(dump, 'remy:meals', 'title', 'Nog niet')['id'])).toBe(true);
  });

  /**
   * The crash case, and the reason the new id is DERIVED from the old one
   * rather than freshly minted. A store where `remy:meals` was rewritten
   * and `remy:cook_events` was not is exactly what a process kill between
   * two `setItem` calls leaves behind. Re-running must finish the job and
   * land the cook event on the same meal — which is only possible if the
   * second run computes the same uuid for `meal-...` that the first one
   * did, with no journal to consult.
   */
  test('a run interrupted between two tables is completed correctly by the next run', async () => {
    const store = createInMemoryKeyValueStore();
    await seedLegacyStore(store);

    let writesLeft = 2;
    const flaky: KeyValueStore = {
      getItem: (key) => store.getItem(key),
      setItem: async (key, value) => {
        if (writesLeft === 0) {
          throw new Error('simulated process kill');
        }
        writesLeft -= 1;
        await store.setItem(key, value);
      },
    };

    await expect(migrateIdsToUuid(flaky)).rejects.toThrow('simulated process kill');

    // Half the store is renumbered and half is not — the worst possible
    // moment to be interrupted.
    const halfway = await dumpStore(store);
    expect(nonUuidIds(halfway).length).toBeGreaterThan(0);

    await migrateIdsToUuid(store);
    const finished = await dumpStore(store);

    expect(nonUuidIds(finished)).toEqual([]);
    expect(findDanglingReferences(finished)).toEqual([]);
    const pasta = findBy(finished, 'remy:meals', 'title', 'Pasta pesto');
    expect(findBy(finished, 'remy:cook_events', 'cookedOn', '2026-08-10')['mealId']).toBe(pasta['id']);
    expect(findBy(finished, 'remy:saves', 'intent', 'this_week')['mealId']).toBe(pasta['id']);
  });

  test('the same legacy id always derives the same uuid, in any store', async () => {
    const storeA = createInMemoryKeyValueStore();
    const storeB = createInMemoryKeyValueStore();
    await seedLegacyStore(storeA);
    await seedLegacyStore(storeB);

    await migrateIdsToUuid(storeA);
    await migrateIdsToUuid(storeB);

    expect(await dumpStore(storeA)).toEqual(await dumpStore(storeB));
  });
});

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

describe('migrateIdsToUuid — stored schema version', () => {
  test('an untouched store reads as version 0 and is stamped after migrating', async () => {
    const store = createInMemoryKeyValueStore();
    await seedLegacyStore(store);

    expect(await readStoreSchemaVersion(store)).toBe(0);
    await migrateIdsToUuid(store);
    expect(await readStoreSchemaVersion(store)).toBe(STORE_SCHEMA_VERSION);
  });

  test('a fresh, empty store is stamped too — it was born migrated', async () => {
    const store = createInMemoryKeyValueStore();

    await migrateIdsToUuid(store);

    expect(await readStoreSchemaVersion(store)).toBe(STORE_SCHEMA_VERSION);
    // Nothing was invented: an absent table stays absent rather than
    // becoming an empty array.
    expect(await store.getItem('remy:meals')).toBeNull();
  });

  /**
   * The version stamp is a RECORD, never the gate. A flag can be written
   * by a build whose table writes then failed; the shape of the data
   * cannot lie about itself.
   */
  test('a store that claims to be migrated but is not is migrated anyway', async () => {
    const store = createInMemoryKeyValueStore();
    await seedLegacyStore(store);
    await store.setItem(SCHEMA_VERSION_KEY, String(STORE_SCHEMA_VERSION));

    await migrateIdsToUuid(store);
    const dump = await dumpStore(store);

    expect(nonUuidIds(dump)).toEqual([]);
    expect(findDanglingReferences(dump)).toEqual([]);
  });

  test('a corrupt version stamp reads as 0 rather than throwing', async () => {
    const store = createInMemoryKeyValueStore();
    await store.setItem(SCHEMA_VERSION_KEY, 'niet een getal');

    expect(await readStoreSchemaVersion(store)).toBe(0);
  });

  test('a newer stamp from a future build is never written backwards', async () => {
    const store = createInMemoryKeyValueStore();
    await store.setItem(SCHEMA_VERSION_KEY, String(STORE_SCHEMA_VERSION + 5));

    await migrateIdsToUuid(store);

    expect(await readStoreSchemaVersion(store)).toBe(STORE_SCHEMA_VERSION + 5);
  });
});

// ---------------------------------------------------------------------------
// Damaged storage
// ---------------------------------------------------------------------------

describe('migrateIdsToUuid — data it cannot trust', () => {
  test('a table holding unparseable JSON is left exactly as it is', async () => {
    const store = createInMemoryKeyValueStore();
    await store.setItem('remy:meals', '{ this is not json');

    await migrateIdsToUuid(store);

    expect(await store.getItem('remy:meals')).toBe('{ this is not json');
  });

  test('a table holding something other than an array of rows is left alone', async () => {
    const store = createInMemoryKeyValueStore();
    await store.setItem('remy:saves', JSON.stringify({ not: 'an array' }));

    await migrateIdsToUuid(store);

    expect(await store.getItem('remy:saves')).toBe(JSON.stringify({ not: 'an array' }));
  });

  test('a row whose id is not a string is left alone rather than crashing the launch', async () => {
    const store = createInMemoryKeyValueStore();
    await store.setItem('remy:meals', JSON.stringify([{ id: 42, title: 'Kapot' }]));

    await migrateIdsToUuid(store);

    expect(JSON.parse((await store.getItem('remy:meals')) ?? '[]')).toEqual([{ id: 42, title: 'Kapot' }]);
  });
});

// ---------------------------------------------------------------------------
// Coverage of the table graph
// ---------------------------------------------------------------------------

describe('migrateIdsToUuid — table coverage', () => {
  /**
   * The drift guard. `createRepositoryTables` is asked, at runtime, which
   * storage keys it actually uses; a tenth table added there must appear
   * in this migration's graph or be named as deliberately id-free. Without
   * this, a future table would migrate cleanly right up until the day
   * somebody notices its ids never became uuids.
   */
  test('every table createRepositoryTables writes is covered by the migration graph', async () => {
    const touched: string[] = [];
    const spy: KeyValueStore = {
      getItem: async () => null,
      setItem: async (key) => {
        touched.push(key);
      },
    };
    const tables = createRepositoryTables(spy);
    for (const accessor of Object.values(tables)) {
      await accessor.replaceAll([]);
    }

    const covered = new Set<string>([
      ...LOCAL_ID_TABLES.map((table) => table.key),
      ...TABLES_WITHOUT_LOCAL_IDS,
    ]);
    expect(touched.filter((key) => !covered.has(key))).toEqual([]);
    expect(touched.length).toBeGreaterThan(0);
  });

  test('the graph names every key the fixture seeds, and invents none', () => {
    const covered = [...LOCAL_ID_TABLES.map((table) => table.key), ...TABLES_WITHOUT_LOCAL_IDS].sort();

    expect(covered).toEqual([...ALL_KEYS].sort());
  });

  test('every table in the graph remaps at least its own id', () => {
    for (const table of LOCAL_ID_TABLES) {
      expect(table.idFields).toContain('id');
    }
  });
});

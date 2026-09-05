import { isUuid } from '@/lib/repository/id';
import type { KeyValueStore } from '@/lib/repository/keyValueStore';

/**
 * The legacy-store fixture and the reference-integrity checkers that
 * tests/repository/idMigration.test.ts asserts against.
 *
 * SPLIT OUT rather than left inline for the reason every `fixtures.ts` in
 * tests/** is: a store shaped like a real device — thirteen tables, every
 * relationship between them, both nullable references, one row per
 * interesting edge case — is four hundred lines of DATA, and reading the
 * assertions is much easier when four hundred lines of `{ id: ..., title:
 * ... }` are not sitting between them.
 *
 * The checkers below travel with the fixture because they describe the
 * same thing from the other side: `REFERENCES` is the foreign-key graph of
 * exactly these tables. It is deliberately NOT imported from
 * migrateIdsToUuid.ts's own `LOCAL_ID_TABLES` — see its comment.
 */

// ---------------------------------------------------------------------------
// Legacy fixture — the OLD id format, across every related table.
// ---------------------------------------------------------------------------

/** The exact shape `generateLocalId` used to mint: `<prefix>-<base36 time>-<base36 counter>-<random>`. */
export function legacyId(prefix: string, counter: number): string {
  return `${prefix}-lz8k2p-${counter.toString(36)}-a9f2c${counter}`;
}

const LEGACY = {
  household: legacyId('household', 1),
  memberSanne: legacyId('member', 2),
  memberJoris: legacyId('member', 3),
  restriction: legacyId('restriction', 4),
  mealPasta: legacyId('meal', 5),
  mealCurated: legacyId('meal', 6),
  ingredientPesto: legacyId('meal-ingredient', 7),
  ingredientPasta: legacyId('meal-ingredient', 8),
  step: legacyId('meal-step', 9),
  saveThisWeek: legacyId('save', 10),
  saveSomeday: legacyId('save', 11),
  decision: legacyId('decision', 12),
  cookEventPasta: legacyId('cook-event', 13),
  cookEventCurated: legacyId('cook-event', 14),
  friendship: legacyId('friendship', 15),
  recipeRating: legacyId('recipe-rating', 16),
  recipeShare: legacyId('recipe-share', 17),
} as const;

/**
 * Ids that belong to somebody else's identity space and must survive the
 * migration BYTE-IDENTICAL: an auth user, a canonical `recipes` row, a
 * social profile. They already are uuids in real data, which is exactly
 * why remapping them would be silent corruption rather than a visible
 * crash — the join to the server would simply stop matching.
 */
export const FOREIGN = {
  authUser: '11111111-1111-4111-8111-111111111111',
  canonicalRecipe: '22222222-2222-4222-8222-222222222222',
  profileSelf: '33333333-3333-4333-8333-333333333333',
  profileFriend: '44444444-4444-4444-8444-444444444444',
} as const;

export type Row = Record<string, unknown>;

function legacyStoreContents(): Readonly<Record<string, readonly Row[]>> {
  return {
    'remy:households': [
      {
        id: LEGACY.household,
        name: 'Mijn huishouden',
        timezone: 'Europe/Amsterdam',
        decisionPushTime: '16:00',
        weeknightTimeBudgetMinutes: 30,
        skillLevel: 'intermediate',
        shareCooksWithFriends: true,
        // No Postgres column behind this one — it is local/household.ts's
        // `LocallyStoredHousehold` extension. It is in the fixture because
        // a migration that rebuilds rows field by field would silently
        // drop it, and the owner's device has one.
        cookSharingAskedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    ],
    'remy:household_members': [
      {
        id: LEGACY.memberSanne,
        householdId: LEGACY.household,
        displayName: 'Sanne',
        authUserId: FOREIGN.authUser,
        healthDataConsentAt: '2026-07-02T10:00:00.000Z',
        createdAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: LEGACY.memberJoris,
        householdId: LEGACY.household,
        displayName: 'Joris',
        authUserId: null,
        healthDataConsentAt: null,
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    ],
    'remy:member_restrictions': [
      {
        id: LEGACY.restriction,
        memberId: LEGACY.memberSanne,
        type: 'allergen',
        excludesTag: 'noten',
        notes: null,
        createdAt: '2026-07-02T10:00:00.000Z',
      },
    ],
    'remy:meals': [
      {
        id: LEGACY.mealPasta,
        householdId: LEGACY.household,
        title: 'Pasta pesto',
        source: 'saved',
        estimatedMinutes: 20,
        skillLevel: 'beginner',
        servings: 4,
        ingredientTags: ['noten'],
        allergenTagStatus: 'verified',
        recipeId: FOREIGN.canonicalRecipe,
        dishTags: ['pasta'],
        dishMoods: ['zomers'],
        sourceUrl: 'https://www.tiktok.com/@x/video/1',
        sourcePlatform: 'tiktok',
        thumbnailUrl: null,
        excludedFromCookProof: false,
        archivedAt: null,
        createdAt: '2026-07-03T10:00:00.000Z',
      },
      {
        id: LEGACY.mealCurated,
        // Curated meals belong to no household. `null` must stay `null`:
        // a migration that treated every id field as a string would turn
        // this into a uuid and make a world-readable meal private.
        householdId: null,
        title: 'Curated stamppot',
        source: 'curated',
        estimatedMinutes: 40,
        skillLevel: 'beginner',
        servings: 4,
        ingredientTags: [],
        dishTags: [],
        sourceUrl: null,
        sourcePlatform: null,
        thumbnailUrl: null,
        archivedAt: null,
        createdAt: '2026-07-03T10:00:00.000Z',
      },
    ],
    'remy:meal_ingredients': [
      {
        id: LEGACY.ingredientPesto,
        mealId: LEGACY.mealPasta,
        name: 'pesto',
        quantity: '1',
        unit: 'pot',
        allergenTags: [],
        sortOrder: 0,
      },
      {
        id: LEGACY.ingredientPasta,
        mealId: LEGACY.mealPasta,
        name: 'pasta',
        quantity: '400',
        unit: 'g',
        allergenTags: [],
        sortOrder: 1,
      },
    ],
    'remy:meal_steps': [
      {
        id: LEGACY.step,
        mealId: LEGACY.mealPasta,
        stepNumber: 1,
        instruction: 'Kook de pasta.',
        durationMinutes: 10,
      },
    ],
    'remy:saves': [
      {
        id: LEGACY.saveThisWeek,
        householdId: LEGACY.household,
        memberId: LEGACY.memberSanne,
        mealId: LEGACY.mealPasta,
        intent: 'this_week',
        sourceUrl: null,
        savedAt: '2026-08-01T10:00:00.000Z',
      },
      {
        id: LEGACY.saveSomeday,
        householdId: LEGACY.household,
        // Nullable reference: a save made by the household, not a member.
        memberId: null,
        mealId: LEGACY.mealCurated,
        intent: 'someday',
        sourceUrl: null,
        savedAt: '2026-08-02T10:00:00.000Z',
      },
    ],
    'remy:decisions': [
      {
        id: LEGACY.decision,
        householdId: LEGACY.household,
        decisionDate: '2026-08-10',
        // Two DIFFERENT meal references on one row, which is the whole
        // point of `initialMealId`: a remap that collapsed them would
        // destroy Plan §8's "accepted the FIRST suggestion" measurement.
        mealId: LEGACY.mealCurated,
        initialMealId: LEGACY.mealPasta,
        reasonCode: 'quick_weeknight',
        reasonText: 'Snel op een doordeweekse avond.',
        status: 'accepted',
        createdAt: '2026-08-10T14:00:00.000Z',
        respondedAt: '2026-08-10T16:00:00.000Z',
      },
    ],
    'remy:cook_events': [
      {
        id: LEGACY.cookEventPasta,
        householdId: LEGACY.household,
        mealId: LEGACY.mealPasta,
        decisionId: LEGACY.decision,
        cookedOn: '2026-08-10',
        wouldRepeat: true,
        rating: 5,
        createdAt: '2026-08-10T19:00:00.000Z',
      },
      {
        id: LEGACY.cookEventCurated,
        householdId: LEGACY.household,
        mealId: LEGACY.mealCurated,
        // Nullable reference: logged outside the decision flow.
        decisionId: null,
        cookedOn: '2026-08-12',
        wouldRepeat: null,
        rating: null,
        createdAt: '2026-08-12T19:00:00.000Z',
      },
    ],
    'remy:profiles': [
      {
        id: FOREIGN.profileSelf,
        handle: 'sanne',
        displayName: 'Sanne',
        avatarUrl: null,
        createdAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: FOREIGN.profileFriend,
        handle: 'joris',
        displayName: 'Joris',
        avatarUrl: null,
        createdAt: '2026-07-01T10:00:00.000Z',
      },
    ],
    'remy:friendships': [
      {
        id: LEGACY.friendship,
        requesterId: FOREIGN.profileSelf,
        addresseeId: FOREIGN.profileFriend,
        status: 'accepted',
        blockedBy: null,
        createdAt: '2026-07-05T10:00:00.000Z',
        respondedAt: '2026-07-05T11:00:00.000Z',
      },
    ],
    'remy:recipe_ratings': [
      {
        id: LEGACY.recipeRating,
        recipeId: FOREIGN.canonicalRecipe,
        raterProfileId: FOREIGN.profileSelf,
        rating: 5,
        ratedAt: '2026-08-11T10:00:00.000Z',
      },
    ],
    'remy:recipe_shares': [
      {
        id: LEGACY.recipeShare,
        // The one social row that references a LOCAL meal. If the
        // migration skipped `remy:recipe_shares` because "social is
        // somebody else's directory", every directed send would point at
        // a meal id that no longer exists.
        mealId: LEGACY.mealPasta,
        senderProfileId: FOREIGN.profileSelf,
        recipientProfileId: FOREIGN.profileFriend,
        sentAt: '2026-08-11T12:00:00.000Z',
        seenAt: null,
        withdrawnAt: null,
      },
    ],
  };
}

export async function seedLegacyStore(store: KeyValueStore): Promise<void> {
  const contents = legacyStoreContents();
  for (const [key, rows] of Object.entries(contents)) {
    await store.setItem(key, JSON.stringify(rows));
  }
}

// ---------------------------------------------------------------------------
// Reading the store back out
// ---------------------------------------------------------------------------

export const ALL_KEYS: readonly string[] = Object.keys(legacyStoreContents());

export async function dumpStore(store: KeyValueStore): Promise<Record<string, readonly Row[]>> {
  const entries = await Promise.all(
    ALL_KEYS.map(async (key): Promise<readonly [string, readonly Row[]]> => {
      const raw = await store.getItem(key);
      return [key, raw === null ? [] : (JSON.parse(raw) as readonly Row[])];
    }),
  );
  return Object.fromEntries(entries);
}

export function rowsOf(dump: Record<string, readonly Row[]>, key: string): readonly Row[] {
  return dump[key] ?? [];
}

export function findBy(dump: Record<string, readonly Row[]>, key: string, field: string, value: unknown): Row {
  const found = rowsOf(dump, key).find((row) => row[field] === value);
  if (found === undefined) {
    throw new Error(`No row in ${key} with ${field} === ${JSON.stringify(value)} — the migration dropped it.`);
  }
  return found;
}

/**
 * Every local-id reference in the store, paired with the table whose `id`
 * column it must resolve into. Spelled out here INDEPENDENTLY of the
 * migration's own table graph on purpose: importing that graph would make
 * this checker agree with the code under test by construction, and a
 * reference the graph forgot would be a reference this checker also
 * forgot to look for.
 */
const REFERENCES: readonly { readonly from: string; readonly field: string; readonly to: string }[] = [
  { from: 'remy:household_members', field: 'householdId', to: 'remy:households' },
  { from: 'remy:member_restrictions', field: 'memberId', to: 'remy:household_members' },
  { from: 'remy:meals', field: 'householdId', to: 'remy:households' },
  { from: 'remy:meal_ingredients', field: 'mealId', to: 'remy:meals' },
  { from: 'remy:meal_steps', field: 'mealId', to: 'remy:meals' },
  { from: 'remy:saves', field: 'householdId', to: 'remy:households' },
  { from: 'remy:saves', field: 'memberId', to: 'remy:household_members' },
  { from: 'remy:saves', field: 'mealId', to: 'remy:meals' },
  { from: 'remy:cook_events', field: 'householdId', to: 'remy:households' },
  { from: 'remy:cook_events', field: 'mealId', to: 'remy:meals' },
  { from: 'remy:cook_events', field: 'decisionId', to: 'remy:decisions' },
  { from: 'remy:decisions', field: 'householdId', to: 'remy:households' },
  { from: 'remy:decisions', field: 'mealId', to: 'remy:meals' },
  { from: 'remy:decisions', field: 'initialMealId', to: 'remy:meals' },
  { from: 'remy:recipe_shares', field: 'mealId', to: 'remy:meals' },
];

/**
 * Returns a human-readable line per reference that resolves to nothing.
 * `null` references are legal (a curated meal has no household, a save has
 * no member) and are skipped; anything else must find its row.
 */
export function findDanglingReferences(dump: Record<string, readonly Row[]>): readonly string[] {
  return REFERENCES.flatMap(({ from, field, to }) => {
    const targetIds = new Set(rowsOf(dump, to).map((row) => row['id']));
    return rowsOf(dump, from)
      .filter((row) => row[field] !== null && row[field] !== undefined && !targetIds.has(row[field]))
      .map((row) => `${from}.${field} = ${String(row[field])} has no row in ${to}`);
  });
}

/** Every field anywhere in the store that must hold a uuid after migration. */
export function nonUuidIds(dump: Record<string, readonly Row[]>): readonly string[] {
  const ownIds = ALL_KEYS.flatMap((key) =>
    rowsOf(dump, key).map((row) => ({ where: `${key}.id`, value: row['id'] })),
  );
  const references = REFERENCES.flatMap(({ from, field }) =>
    rowsOf(dump, from).map((row) => ({ where: `${from}.${field}`, value: row[field] })),
  );
  return [...ownIds, ...references]
    .filter(({ value }) => value !== null && value !== undefined && !isUuid(value))
    .map(({ where, value }) => `${where} = ${String(value)}`);
}


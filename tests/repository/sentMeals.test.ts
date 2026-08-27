/**
 * `listMealsSentToMe` — the one read that opens a friend's kitchen, and
 * the only one in this codebase that crosses a household boundary into a
 * private `meals` row.
 *
 * WHAT THESE TESTS ARE ACTUALLY GUARDING. Not "does it return rows" —
 * that is the least interesting property it has. The load-bearing claim is
 * that the method has nowhere to put an arbitrary meal id: its only
 * argument is the READER, and every id it queries is derived from a live
 * `recipe_shares` row addressed to that reader. So the assertions below
 * are mostly about what does NOT come back — a withdrawn send's meal,
 * somebody else's send, a household id, an allergen verdict earned in
 * another kitchen.
 *
 * Both backends are exercised in one file on purpose. The gate is the same
 * sentence in both ("only meals with a live send to this reader"), enforced
 * by `has_active_send_to_me` in Postgres and by the identical filter written
 * out by hand on device, and a seam bug is precisely the case where the two
 * stop agreeing. Splitting them across two files would let one drift.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createTableAccessor } from '@/lib/repository/table';
import { createLocalSocialRepository } from '@/lib/repository/social/localSocialRepository';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import type { RemySocialRepository } from '@/lib/repository/social/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PROFILE_A, PROFILE_B, PROFILE_C } from '../social/fixtures';

// ---------------------------------------------------------------------------
// The local store
// ---------------------------------------------------------------------------

let store: KeyValueStore;
let repository: RemySocialRepository;

/**
 * Rows written straight into the tables `localRepository.ts` owns, rather
 * than through it. That is the honest way to stage this: the meal being
 * read belongs to somebody else's household, so there is no write path in
 * the reader's own repository that could have produced it.
 */
async function seedMeal(overrides: Record<string, unknown> = {}): Promise<void> {
  await createTableAccessor<Record<string, unknown>>(store, 'remy:meals').replaceAll([
    {
      id: 'meal-1',
      householdId: 'household-sanne',
      title: 'Romige pasta pesto',
      source: 'saved',
      estimatedMinutes: 20,
      skillLevel: 'beginner',
      servings: 2,
      ingredientTags: ['noten'],
      allergenTagStatus: 'verified',
      recipeId: 'recipe-1',
      dishTags: ['pasta'],
      sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
      sourcePlatform: 'tiktok',
      thumbnailUrl: 'https://cdn.test/pesto.jpg',
      archivedAt: null,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
      ...overrides,
    },
  ]);
  await createTableAccessor<Record<string, unknown>>(store, 'remy:meal_ingredients').replaceAll([
    {
      id: 'mi-2',
      mealId: 'meal-1',
      name: 'pijnboompitten',
      quantity: '30',
      unit: 'g',
      allergenTags: ['noten'],
      sortOrder: 1,
    },
    { id: 'mi-1', mealId: 'meal-1', name: 'tagliatelle', quantity: '250', unit: 'g', allergenTags: [], sortOrder: 0 },
  ]);
}

async function seedFriendship(): Promise<void> {
  await repository.upsertProfile({ id: PROFILE_A, handle: 'sanne', displayName: 'Sanne', avatarUrl: null });
  await repository.upsertProfile({ id: PROFILE_B, handle: 'joost', displayName: 'Joost', avatarUrl: null });
  await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
  await repository.actOnFriendship(PROFILE_B, PROFILE_A, 'accept');
}

beforeEach(async () => {
  store = createInMemoryKeyValueStore();
  repository = createLocalSocialRepository(store);
  await seedFriendship();
});

describe('the local store', () => {
  test('a meal nobody sent you is not readable, however plainly it sits in the store', async () => {
    await seedMeal();
    expect(await repository.listMealsSentToMe(PROFILE_B)).toEqual([]);
  });

  test('a live send makes exactly its own meal readable, ingredients in recipe order', async () => {
    await seedMeal();
    await repository.sendRecipe({
      mealId: 'meal-1',
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: 'echt 20 min, beloofd',
    });

    const sent = await repository.listMealsSentToMe(PROFILE_B);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.mealId).toBe('meal-1');
    expect(sent[0]?.senderProfileId).toBe(PROFILE_A);
    expect(sent[0]?.title).toBe('Romige pasta pesto');
    expect(sent[0]?.estimatedMinutes).toBe(20);
    expect(sent[0]?.servings).toBe(2);
    expect(sent[0]?.recipeId).toBe('recipe-1');
    expect(sent[0]?.ingredients.map((ingredient) => ingredient.name)).toEqual(['tagliatelle', 'pijnboompitten']);
  });

  /**
   * PD-007a needs the presence claim and PD-010 forbids the absence one.
   * `ingredientTags` travels so a collision can still be labelled on a
   * friend's dish; `allergenTagStatus` deliberately does not, because a
   * `'verified'` earned in Sanne's kitchen is not a claim about this
   * household's peanut-allergic child.
   */
  test('carries the allergen tags but never the allergen verdict, nor the household', async () => {
    await seedMeal();
    await repository.sendRecipe({
      mealId: 'meal-1',
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: null,
    });

    const [sent] = await repository.listMealsSentToMe(PROFILE_B);
    expect(sent?.ingredientTags).toEqual(['noten']);
    expect(Object.keys(sent ?? {}).sort()).toEqual(
      [
        'estimatedMinutes',
        'ingredientTags',
        'ingredients',
        'mealId',
        'recipeId',
        'senderProfileId',
        'servings',
        'shareId',
        'sourceUrl',
        'thumbnailUrl',
        'title',
      ].sort(),
    );
  });

  test('a withdrawn send takes its meal back out of reach', async () => {
    await seedMeal();
    await repository.sendRecipe({
      mealId: 'meal-1',
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: null,
    });
    await repository.withdrawSend(PROFILE_A, 'meal-1', PROFILE_B);

    expect(await repository.listMealsSentToMe(PROFILE_B)).toEqual([]);
  });

  test('a send addressed to somebody else is not readable by a third party', async () => {
    await seedMeal();
    await repository.sendRecipe({
      mealId: 'meal-1',
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: null,
    });

    expect(await repository.listMealsSentToMe(PROFILE_C)).toEqual([]);
  });

  /** Fail closed: half a card is a promise the tap cannot keep. */
  test('a send whose meal row is missing is dropped rather than half-built', async () => {
    await repository.sendRecipe({
      mealId: 'meal-1',
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: null,
    });

    expect(await repository.listMealsSentToMe(PROFILE_B)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The Postgres backend
// ---------------------------------------------------------------------------

interface FakeResponse {
  readonly data: unknown;
  readonly error: { message: string; code?: string } | null;
}

/** PostgREST's shape, as tests/repository/supabaseSocialRepository.test.ts models it: every filter returns the builder. */
class FakeQuery implements PromiseLike<FakeResponse> {
  constructor(
    private readonly settle: () => FakeResponse,
    private readonly log: string[],
  ) {}

  select(columns?: string): this {
    this.log.push(`select(${columns ?? '*'})`);
    return this;
  }
  eq(column: string, value: unknown): this {
    this.log.push(`eq(${column},${String(value)})`);
    return this;
  }
  is(column: string, value: unknown): this {
    this.log.push(`is(${column},${String(value)})`);
    return this;
  }
  in(column: string, values: readonly unknown[]): this {
    this.log.push(`in(${column},[${values.join(',')}])`);
    return this;
  }
  then<A, B>(
    onFulfilled?: ((value: FakeResponse) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.settle()).then(onFulfilled, onRejected);
  }
}

interface Fake {
  readonly client: SupabaseClient;
  readonly tables: string[];
  readonly log: string[];
}

function makeClient(responses: readonly FakeResponse[]): Fake {
  const queue = [...responses];
  const tables: string[] = [];
  const log: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      return new FakeQuery(() => queue.shift() ?? { data: [], error: null }, log);
    },
  };
  return { client: client as unknown as SupabaseClient, tables, log };
}

const ok = (data: unknown): FakeResponse => ({ data, error: null });

const shareRow = { id: 'share-1', meal_id: 'meal-1', sender_profile_id: 'p-sanne' };

const mealRow = {
  id: 'meal-1',
  title: 'Romige pasta pesto',
  estimated_minutes: 20,
  servings: 2,
  ingredient_tags: ['noten'],
  source_url: 'https://www.tiktok.com/@kokenmetkees/video/1',
  thumbnail_url: 'https://cdn.test/pesto.jpg',
  recipe_id: 'recipe-1',
};

const ingredientRows = [
  { meal_id: 'meal-1', name: 'pijnboompitten', quantity: '30', unit: 'g', sort_order: 1 },
  { meal_id: 'meal-1', name: 'tagliatelle', quantity: '250', unit: 'g', sort_order: 0 },
];

describe('the Postgres backend', () => {
  test('derives every meal id from the reader own live sends, never from an argument', async () => {
    const fake = makeClient([ok([shareRow]), ok([mealRow]), ok(ingredientRows)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.listMealsSentToMe('p-joost');

    expect(fake.tables).toEqual(['recipe_shares', 'meals', 'meal_ingredients']);
    expect(fake.log).toContain('eq(recipient_profile_id,p-joost)');
    expect(fake.log).toContain('in(id,[meal-1])');
    expect(fake.log).toContain('in(meal_id,[meal-1])');
  });

  /** `eq(col, null)` is not a null test in PostgREST and would match no row at all. */
  test('filters withdrawn sends out with a null test', async () => {
    const fake = makeClient([ok([shareRow]), ok([mealRow]), ok(ingredientRows)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.listMealsSentToMe('p-joost');
    expect(fake.log).toContain('is(withdrawn_at,null)');
    expect(fake.log.some((entry) => entry.startsWith('eq(withdrawn_at'))).toBe(false);
  });

  /** The projection is the privacy model written as a column list. */
  test('never asks for the household id or the allergen verdict', async () => {
    const fake = makeClient([ok([shareRow]), ok([mealRow]), ok(ingredientRows)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.listMealsSentToMe('p-joost');
    const mealSelect = fake.log.find((entry) => entry.startsWith('select(') && entry.includes('estimated_minutes'));
    expect(mealSelect).toBeDefined();
    expect(mealSelect).not.toContain('household_id');
    expect(mealSelect).not.toContain('allergen_tag_status');
  });

  test('maps every snake_case column onto its domain name and sorts ingredients by recipe order', async () => {
    const fake = makeClient([ok([shareRow]), ok([mealRow]), ok(ingredientRows)]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.listMealsSentToMe('p-joost')).toEqual([
      {
        shareId: 'share-1',
        mealId: 'meal-1',
        senderProfileId: 'p-sanne',
        title: 'Romige pasta pesto',
        thumbnailUrl: 'https://cdn.test/pesto.jpg',
        estimatedMinutes: 20,
        servings: 2,
        ingredientTags: ['noten'],
        sourceUrl: 'https://www.tiktok.com/@kokenmetkees/video/1',
        recipeId: 'recipe-1',
        ingredients: [
          { name: 'tagliatelle', quantity: '250', unit: 'g', sortOrder: 0 },
          { name: 'pijnboompitten', quantity: '30', unit: 'g', sortOrder: 1 },
        ],
      },
    ]);
  });

  /** RLS refusing the meal is the expected shape of an expired send, not an error to surface. */
  test('drops a send whose meal RLS did not return', async () => {
    const fake = makeClient([ok([shareRow]), ok([]), ok([])]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.listMealsSentToMe('p-joost')).toEqual([]);
  });

  /** `in.()` with an empty list is a PostgREST syntax error, not an empty result. */
  test('asks nothing further when no send is waiting', async () => {
    const fake = makeClient([ok([])]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.listMealsSentToMe('p-joost')).toEqual([]);
    expect(fake.tables).toEqual(['recipe_shares']);
  });

  test('keeps the Postgres code in the message when the read is refused', async () => {
    const fake = makeClient([{ data: null, error: { message: 'permission denied', code: '42501' } }]);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(repository.listMealsSentToMe('p-joost')).rejects.toThrow(/42501/);
  });
});

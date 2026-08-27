/**
 * The Supabase backend's translation layer.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT TEST: the rules. Who may accept a
 * friendship, what a storable handle is, which grades are on the scale —
 * all of that lives in src/domain/social/** and is already covered there
 * and in localSocialRepository.test.ts. Both backends call the identical
 * functions, which is the whole point of the seam, so re-asserting them
 * here would test the domain twice and the thing that can actually break
 * not at all.
 *
 * WHAT IT DOES TEST: the boundary. Column names, timestamp format, numeric
 * coercion, paging, and turning a Postgres error code into something a
 * person can act on. Every bug this layer can have is of the form "the row
 * said one thing and the domain heard another", and none of them surface
 * as a type error — `rating: '7.5'` is a perfectly good string.
 *
 * The client is faked rather than mocked with a library: the surface used
 * is four chained builders deep and entirely synchronous to construct, so
 * a hand-written stub is shorter than configuring a mock and shows the
 * exact query shape being asserted.
 */

import { describe, expect, test } from 'vitest';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { BOARD_RATING_ROW_CEILING, SEND_NOTE_MAX_LENGTH } from '@/lib/repository/social/types';
import type { SupabaseClient } from '@supabase/supabase-js';

interface FakeResponse {
  readonly data: unknown;
  readonly error: { message: string; code?: string } | null;
}

/** PostgREST's shape: every filter returns the builder, and the builder itself is awaitable. */
class FakeQuery implements PromiseLike<FakeResponse> {
  constructor(
    private readonly settle: () => FakeResponse,
    private readonly log: string[],
  ) {}

  select(columns?: string): this {
    this.log.push(`select(${columns ?? '*'})`);
    return this;
  }
  upsert(values: unknown, options?: unknown): this {
    this.log.push(`upsert(${JSON.stringify(values)},${JSON.stringify(options ?? {})})`);
    return this;
  }
  update(values: unknown): this {
    this.log.push(`update(${JSON.stringify(values)})`);
    return this;
  }
  delete(): this {
    this.log.push('delete()');
    return this;
  }
  eq(column: string, value: unknown): this {
    this.log.push(`eq(${column},${String(value)})`);
    return this;
  }
  /** PostgREST's null test. `eq(col, null)` is a different filter and matches no null row. */
  is(column: string, value: unknown): this {
    this.log.push(`is(${column},${String(value)})`);
    return this;
  }
  or(filter: string): this {
    this.log.push(`or(${filter})`);
    return this;
  }
  in(column: string, values: readonly unknown[]): this {
    this.log.push(`in(${column},[${values.join(',')}])`);
    return this;
  }
  order(column: string): this {
    this.log.push(`order(${column})`);
    return this;
  }
  range(from: number, to: number): this {
    this.log.push(`range(${from},${to})`);
    return this;
  }
  maybeSingle(): Promise<FakeResponse> {
    return Promise.resolve(this.settle());
  }
  single(): Promise<FakeResponse> {
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
  readonly client: SupabaseClient;
  readonly tables: string[];
  readonly log: string[];
}

/** `responses` is consumed in order, so a paging test can hand over one page per call. */
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

/** Deliberately the offset form PostgREST returns, not the "Z" form the domain uses. */
const PG_TIME = '2026-01-01T00:00:00+00:00';
const DOMAIN_TIME = '2026-01-01T00:00:00.000Z';

const ratingRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'rr-1',
  recipe_id: 'r-1',
  rater_profile_id: 'p-1',
  rating: '7.5',
  rated_at: PG_TIME,
  ...overrides,
});

describe('reading ratings', () => {
  /**
   * PostgREST is entitled to serialise a numeric as a JSON string to keep
   * precision. A string survives every type check in this file and then
   * corrupts the average, so this is the single most valuable assertion
   * here.
   */
  test('a numeric arriving as a string becomes a real number', async () => {
    const fake = makeClient([ok([ratingRow({ rating: '7.5' })])]);
    const repository = createSupabaseSocialRepository(fake.client);

    const ratings = await repository.listRecipeRatings('r-1');
    expect(ratings[0]?.rating).toBe(7.5);
    expect(typeof ratings[0]?.rating).toBe('number');
  });

  /**
   * ratings.ts resolves a duplicate rater by comparing these strings
   * lexically, and says it is only safe because the format is fixed-width.
   * An offset-form timestamp in that comparison makes "most recent vote
   * wins" quietly wrong.
   */
  test('a Postgres timestamp is normalized to the fixed-width UTC form', async () => {
    const fake = makeClient([ok([ratingRow()])]);
    const repository = createSupabaseSocialRepository(fake.client);

    const ratings = await repository.listRecipeRatings('r-1');
    expect(ratings[0]?.ratedAt).toBe(DOMAIN_TIME);
  });

  test('maps every snake_case column onto its domain name', async () => {
    const fake = makeClient([ok([ratingRow()])]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.listRecipeRatings('r-1')).toEqual([
      { id: 'rr-1', recipeId: 'r-1', raterProfileId: 'p-1', rating: 7.5, ratedAt: DOMAIN_TIME },
    ]);
  });

  /** Same stance ratings.ts takes on stored data that violates the scale: drop it, never repair it. */
  test('a row off the scale is dropped rather than clamped into range', async () => {
    const fake = makeClient([ok([ratingRow({ id: 'good' }), ratingRow({ id: 'bad', rating: '11' })])]);
    const repository = createSupabaseSocialRepository(fake.client);

    const ratings = await repository.listRecipeRatings('r-1');
    expect(ratings.map((rating) => rating.id)).toEqual(['good']);
  });

  /** 0008 allows one decimal; a value finer than the step is data this client cannot honestly read. */
  test('a row finer than the step is dropped too', async () => {
    const fake = makeClient([ok([ratingRow({ rating: '7.55' })])]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.listRecipeRatings('r-1')).toEqual([]);
  });
});

describe('writing a rating', () => {
  test('refuses an off-scale grade before it reaches the network', async () => {
    const fake = makeClient([]);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(repository.rateRecipe({ recipeId: 'r-1', raterProfileId: 'p-1', rating: 11 })).rejects.toThrow(
      /off the scale/i,
    );
    expect(fake.tables).toEqual([]);
  });

  test('refuses a grade finer than one decimal', async () => {
    const fake = makeClient([]);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(repository.rateRecipe({ recipeId: 'r-1', raterProfileId: 'p-1', rating: 7.55 })).rejects.toThrow(
      /off the scale/i,
    );
  });

  /** The unique index is the conflict target, so changing your mind replaces the vote instead of adding one. */
  test('upserts on the (recipe, rater) pair', async () => {
    const fake = makeClient([ok(ratingRow())]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.rateRecipe({ recipeId: 'r-1', raterProfileId: 'p-1', rating: 7.5 });
    expect(fake.log.join(' ')).toContain('recipe_id,rater_profile_id');
  });
});

describe('reading the whole table for the board', () => {
  const page = (size: number, offset: number) =>
    ok(Array.from({ length: size }, (_unused, index) => ratingRow({ id: `rr-${offset + index}` })));

  test('stops as soon as a page comes back short', async () => {
    const fake = makeClient([page(1000, 0), page(3, 1000)]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.listAllRecipeRatings()).toHaveLength(1003);
    expect(fake.tables).toEqual(['recipe_ratings', 'recipe_ratings']);
  });

  /** Unordered paging can overlap or skip rows as the table changes underneath the reads. */
  test('orders by primary key so paging is stable', async () => {
    const fake = makeClient([page(2, 0)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.listAllRecipeRatings();
    expect(fake.log.join(' ')).toContain('order(id)');
  });

  /**
   * The board would otherwise rank a subset while presenting itself as the
   * world — the exact failure leaderboard.ts warns about. A loud error
   * naming the fix is worth more than a board that is quietly wrong.
   */
  test('throws past the ceiling rather than ranking what it managed to fetch', async () => {
    const pages = Array.from({ length: BOARD_RATING_ROW_CEILING / 1000 }, (_unused, index) => page(1000, index * 1000));
    const fake = makeClient(pages);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(repository.listAllRecipeRatings()).rejects.toThrow(/move the per-recipe aggregate into SQL/i);
  });
});

describe('reading canonical recipes', () => {
  /** `in.()` with an empty list is a PostgREST syntax error, not an empty result. */
  test('an empty id list is answered without a query', async () => {
    const fake = makeClient([]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.listCanonicalRecipes([])).toEqual([]);
    expect(fake.tables).toEqual([]);
  });

  test('maps a recipe row onto the display summary', async () => {
    const fake = makeClient([
      ok([{ id: 'r-1', title: 'Ramen', platform: 'tiktok', author_name: 'noedelnoah', thumbnail_url: null }]),
    ]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.listCanonicalRecipes(['r-1'])).toEqual([
      { recipeId: 'r-1', title: 'Ramen', platform: 'tiktok', authorName: 'noedelnoah', thumbnailUrl: null },
    ]);
  });
});

const shareRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'rs-1',
  meal_id: 'm-1',
  sender_profile_id: 'p-1',
  recipient_profile_id: 'p-2',
  note: 'Dit is echt jouw ding.',
  created_at: PG_TIME,
  seen_at: null,
  withdrawn_at: null,
  ...overrides,
});

const SEND = { mealId: 'm-1', senderProfileId: 'p-1', recipientProfileId: 'p-2', note: 'Dit is echt jouw ding.' };

describe('directed sends', () => {
  test('maps every column onto its domain name and normalizes the timestamp', async () => {
    const fake = makeClient([ok(shareRow())]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.sendRecipe(SEND)).toEqual({
      id: 'rs-1',
      mealId: 'm-1',
      senderProfileId: 'p-1',
      recipientProfileId: 'p-2',
      note: 'Dit is echt jouw ding.',
      sentAt: DOMAIN_TIME,
    });
    expect(fake.tables).toEqual(['recipe_shares']);
  });

  /**
   * The row the sender gets back carries `seen_at`, because RLS lets both
   * parties read it. Putting it on the returned shape would make the one
   * method every send goes through a read receipt (DESIGN-SOCIAL.md §8).
   */
  test('a send never hands the sender the recipient’s seen state', async () => {
    const fake = makeClient([ok(shareRow({ seen_at: PG_TIME }))]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect('seen' in (await repository.sendRecipe(SEND))).toBe(false);
  });

  /** `unique (meal_id, recipient_profile_id)` is the conflict target: the same dish to the same person is one offer. */
  test('upserts on the (meal, recipient) pair rather than inserting a second card', async () => {
    const fake = makeClient([ok(shareRow())]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.sendRecipe(SEND);
    expect(fake.log.join(' ')).toContain('meal_id,recipient_profile_id');
  });

  /** Otherwise withdraw-and-resend would make a read card unread — a bell the sender could ring at will. */
  test('a send writes no seen_at, so re-sending cannot reset the reader state', async () => {
    const fake = makeClient([ok(shareRow())]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.sendRecipe(SEND);
    expect(fake.log.join(' ')).not.toContain('seen_at');
  });

  /** A re-send after "Stop delen" has to revive the row it lands on, or the card stays hidden. */
  test('a send clears any earlier withdrawal', async () => {
    const fake = makeClient([ok(shareRow())]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.sendRecipe(SEND);
    expect(fake.log.join(' ')).toContain('"withdrawn_at":null');
  });

  test('refuses a note past the cap before it reaches the network', async () => {
    const fake = makeClient([]);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(repository.sendRecipe({ ...SEND, note: 'a'.repeat(SEND_NOTE_MAX_LENGTH + 1) })).rejects.toThrow(/140/);
    expect(fake.tables).toEqual([]);
  });

  test('refuses a send to yourself before it reaches the network', async () => {
    const fake = makeClient([]);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(repository.sendRecipe({ ...SEND, recipientProfileId: 'p-1' })).rejects.toThrow(/yourself/i);
    expect(fake.tables).toEqual([]);
  });

  /** The recipient-facing index is `where withdrawn_at is null`: absence from the list IS withdrawal. */
  test('withdrawal is an update on the row, never a delete', async () => {
    const fake = makeClient([ok(null)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.withdrawSend('p-1', 'm-1', 'p-2');
    const log = fake.log.join(' ');
    expect(log).toContain('update(');
    expect(log).toContain('withdrawn_at');
    expect(log).not.toContain('delete()');
  });

  test('withdrawal is scoped to the sender’s own send', async () => {
    const fake = makeClient([ok(null)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.withdrawSend('p-1', 'm-1', 'p-2');
    const log = fake.log.join(' ');
    expect(log).toContain('eq(sender_profile_id,p-1)');
    expect(log).toContain('eq(meal_id,m-1)');
    expect(log).toContain('eq(recipient_profile_id,p-2)');
  });

  /** Withdrawing twice must not overwrite the first withdrawal's time — it is the auditable one. */
  test('withdrawal touches only a live row', async () => {
    const fake = makeClient([ok(null)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.withdrawSend('p-1', 'm-1', 'p-2');
    expect(fake.log.join(' ')).toContain('is(withdrawn_at,null)');
  });

  /** Idempotence lives in the filter: a second call finds nothing left to stamp. */
  test('marking seen stamps only the sends that are still unseen', async () => {
    const fake = makeClient([ok(null)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.markSendsSeen('p-2');
    const log = fake.log.join(' ');
    expect(log).toContain('update(');
    expect(log).toContain('eq(recipient_profile_id,p-2)');
    expect(log).toContain('is(seen_at,null)');
  });

  /** "Seen" against a card the recipient was never shown is a false entry in the one attention column there is. */
  test('marking seen leaves withdrawn sends alone', async () => {
    const fake = makeClient([ok(null)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.markSendsSeen('p-2');
    expect(fake.log.join(' ')).toContain('is(withdrawn_at,null)');
  });

  /**
   * §3.2: "no per-card read tracking, because per-card tracking is the
   * first brick of a read-receipt system". The query cannot name one send
   * because the signature has nowhere to put its id.
   */
  test('marking seen names no single send', async () => {
    const fake = makeClient([ok(null)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.markSendsSeen('p-2');
    expect(fake.log.join(' ')).not.toContain('eq(id,');
  });

  test('the recipient list drops withdrawn sends at the query, not in memory', async () => {
    const fake = makeClient([ok([shareRow()])]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.listSendsToMe('p-2');
    const log = fake.log.join(' ');
    expect(log).toContain('eq(recipient_profile_id,p-2)');
    expect(log).toContain('is(withdrawn_at,null)');
  });

  test('a stamped seen_at reads as seen, and a null one as unseen', async () => {
    const fake = makeClient([ok([shareRow({ id: 'unseen' }), shareRow({ id: 'seen', seen_at: PG_TIME })])]);
    const repository = createSupabaseSocialRepository(fake.client);

    const waiting = await repository.listSendsToMe('p-2');
    expect(waiting.map((send) => [send.id, send.seen])).toEqual([
      ['unseen', false],
      ['seen', true],
    ]);
  });

  test('a missing note stays null rather than becoming an empty line', async () => {
    const fake = makeClient([ok([shareRow({ note: null })])]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect((await repository.listSendsToMe('p-2'))[0]?.note).toBeNull();
  });

  /** An RLS refusal — a recipient who is not a friend, a meal that is not yours — has to stay legible. */
  test('a database error keeps its Postgres code', async () => {
    const fake = makeClient([{ data: null, error: { message: 'permission denied', code: '42501' } }]);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(repository.sendRecipe(SEND)).rejects.toThrow(/42501/);
  });
});

describe('profiles', () => {
  test('normalizes a handle before looking it up, so casing cannot miss the row', async () => {
    const fake = makeClient([ok(null)]);
    const repository = createSupabaseSocialRepository(fake.client);

    await repository.findProfileByHandle('  JOOST  ');
    expect(fake.log.join(' ')).toContain('eq(handle,joost)');
  });

  /** An unstorable handle matches nothing by definition; asking Postgres about it is a wasted round trip. */
  test('an unstorable handle is answered without a query', async () => {
    const fake = makeClient([]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.findProfileByHandle('!!')).toBeNull();
    expect(fake.tables).toEqual([]);
  });

  /**
   * On this table a unique violation can only be the handle — the primary
   * key is the caller's own auth id. It is also the one error on this path
   * a person can act on, so it must not arrive as a generic failure.
   */
  test('a unique violation is reported as a taken handle, not a database error', async () => {
    const fake = makeClient([{ data: null, error: { message: 'duplicate key', code: '23505' } }]);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(
      repository.upsertProfile({ id: 'p-1', handle: 'joost', displayName: 'Joost', avatarUrl: null }),
    ).rejects.toThrow(/already taken/i);
  });

  /** Any other failure keeps its Postgres code: it is what tells an RLS refusal apart from everything else. */
  test('another database error keeps its code in the message', async () => {
    const fake = makeClient([{ data: null, error: { message: 'permission denied', code: '42501' } }]);
    const repository = createSupabaseSocialRepository(fake.client);

    await expect(
      repository.upsertProfile({ id: 'p-1', handle: 'joost', displayName: 'Joost', avatarUrl: null }),
    ).rejects.toThrow(/42501/);
  });

  test('maps a profile row onto the domain shape', async () => {
    const fake = makeClient([
      ok({ id: 'p-1', handle: 'joost', display_name: 'Joost', avatar_url: null, created_at: PG_TIME }),
    ]);
    const repository = createSupabaseSocialRepository(fake.client);

    expect(await repository.getProfile('p-1')).toEqual({
      id: 'p-1',
      handle: 'joost',
      displayName: 'Joost',
      avatarUrl: null,
      createdAt: DOMAIN_TIME,
    });
  });
});

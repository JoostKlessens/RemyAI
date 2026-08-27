/**
 * The write-through mirror's Postgres boundary.
 *
 * WHAT THIS FILE TESTS: the column lists, the request ORDER, the
 * idempotency strategy per table, and the classification of a failure.
 * Every bug this layer can have is of the form "the row we sent did not
 * say what the migration expects" or "we retried something that will never
 * succeed", and none of them surface as a type error — `decision_id` is a
 * perfectly good string right up until Postgres rejects the foreign key.
 *
 * WHAT IT DELIBERATELY DOES NOT TEST: whether the local write happened.
 * That is localRepository's business and is covered in
 * tests/repository/localRepository.test.ts. The mirror is a second,
 * subordinate write path; it may not have opinions about the first.
 *
 * The client is faked rather than mocked with a library, matching
 * tests/repository/supabaseSocialRepository.test.ts: the surface used here
 * is several chained builders deep and entirely synchronous to construct,
 * so a hand-written stub is shorter than configuring a mock and shows the
 * exact query shape being asserted.
 */

import { describe, expect, test } from 'vitest';
import {
  mirrorCookEvent,
  mirrorHouseholdSettings,
  mirrorMeal,
  runMirrorJob,
} from '@/lib/repository/mirror/mirrorWrites';
import { classifyMirrorError } from '@/lib/repository/mirror/rows';
import type { MirrorClient } from '@/lib/repository/mirror/types';
import type { CookEvent, Meal, MealIngredient, MealStep } from '@/domain/types';

interface FakeResponse {
  /** Only the household PATCH reads this: it asks which rows it actually touched. */
  readonly data?: unknown;
  readonly error: { message: string; code?: string } | null;
}

/** PostgREST's shape: every filter returns the builder, and the builder itself is awaitable. */
class FakeQuery implements PromiseLike<FakeResponse> {
  constructor(
    private readonly settle: () => FakeResponse,
    private readonly log: string[],
  ) {}

  upsert(values: unknown, options?: unknown): this {
    this.log.push(`upsert(${JSON.stringify(values)},${JSON.stringify(options ?? {})})`);
    return this;
  }
  update(values: unknown): this {
    this.log.push(`update(${JSON.stringify(values)})`);
    return this;
  }
  select(columns?: string): this {
    this.log.push(`select(${columns ?? '*'})`);
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
  not(column: string, operator: string, value: unknown): this {
    this.log.push(`not(${column},${operator},${String(value)})`);
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
  readonly client: MirrorClient;
  readonly tables: string[];
  readonly log: string[];
}

/** `responses` is consumed in order, so a test can fail the second request and leave the first fine. */
function makeClient(responses: readonly FakeResponse[] = []): Fake {
  const queue = [...responses];
  const tables: string[] = [];
  const log: string[] = [];
  const client = {
    from(table: string) {
      tables.push(table);
      log.push(`from(${table})`);
      return new FakeQuery(() => queue.shift() ?? { error: null }, log);
    },
  };
  return { client: client as unknown as MirrorClient, tables, log };
}

const ok: FakeResponse = { error: null };
const failWith = (code: string, message = 'nope'): FakeResponse => ({ error: { code, message } });

/**
 * The log lines belonging to one table's requests. Bounded at both ends —
 * an unbounded slice from `from(meal_ingredients)` runs on into the step
 * requests and quietly credits them to the ingredients.
 */
function logFor(log: readonly string[], table: string): readonly string[] {
  const start = log.indexOf(`from(${table})`);
  if (start === -1) {
    return [];
  }
  const rest = log.slice(start + 1);
  const end = rest.findIndex((entry) => entry.startsWith('from(') && entry !== `from(${table})`);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Pulls the payload back out of a logged `upsert(...)` line. */
function payloadOf(log: readonly string[], marker: string): Record<string, unknown> {
  const entry = log.find((line) => line.startsWith('upsert(') && line.includes(marker));
  if (entry === undefined) {
    throw new Error(`No upsert carrying ${marker} was logged.`);
  }
  return JSON.parse(entry.slice('upsert('.length, entry.lastIndexOf(',{'))) as Record<string, unknown>;
}

const meal = (overrides: Partial<Meal> = {}): Meal => ({
  id: 'meal-1',
  householdId: 'hh-1',
  title: 'Pasta pesto',
  source: 'saved',
  estimatedMinutes: 20,
  skillLevel: 'beginner',
  servings: 2,
  ingredientTags: ['noten'],
  allergenTagStatus: 'verified',
  recipeId: 'recipe-1',
  dishTags: ['pasta'],
  dishMoods: ['zomers'],
  sourceUrl: 'https://www.tiktok.com/@x/video/1',
  sourcePlatform: 'tiktok',
  thumbnailUrl: 'https://cdn.example/thumb.jpg',
  excludedFromCookProof: false,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const ingredient = (overrides: Partial<MealIngredient> = {}): MealIngredient => ({
  id: 'ing-1',
  mealId: 'meal-1',
  name: 'Pasta',
  quantity: '200',
  unit: 'g',
  allergenTags: [],
  sortOrder: 0,
  ...overrides,
});

const step = (overrides: Partial<MealStep> = {}): MealStep => ({
  id: 'step-1',
  mealId: 'meal-1',
  stepNumber: 1,
  instruction: 'Kook de pasta',
  durationMinutes: 10,
  ...overrides,
});

const cookEvent = (overrides: Partial<CookEvent> = {}): CookEvent => ({
  id: 'ce-1',
  householdId: 'hh-1',
  mealId: 'meal-1',
  decisionId: 'dec-1',
  cookedOn: '2026-01-02',
  wouldRepeat: true,
  rating: 8.5,
  createdAt: '2026-01-02T18:00:00.000Z',
  ...overrides,
});

const mealJob = (
  m: Meal = meal(),
  ingredients: readonly MealIngredient[] = [ingredient()],
  steps: readonly MealStep[] = [step()],
) => ({ kind: 'meal', meal: m, ingredients, steps }) as const;

describe('mirroring a meal', () => {
  /**
   * The column list, read from 0001 + 0003 + 0004 + 0006 + 0009 + 0010 and
   * not from src/domain/types.ts. `recipe_id` is the one whose absence made
   * cook proof unreachable; `visibility` is the one whose ABSENCE here is
   * load-bearing (see mirrorWrites.ts's header).
   */
  test('writes exactly the mirrored columns, and never visibility or metadata', async () => {
    const fake = makeClient();
    await mirrorMeal(fake.client, mealJob());

    const payload = payloadOf(fake.log, '"title"');

    expect(Object.keys(payload).sort()).toEqual(
      [
        'allergen_tag_status',
        'archived_at',
        'created_at',
        'dish_moods',
        'dish_tags',
        'estimated_minutes',
        'excluded_from_cook_proof',
        'household_id',
        'id',
        'ingredient_tags',
        'recipe_id',
        'servings',
        'skill_level',
        'source',
        'source_platform',
        'source_url',
        'thumbnail_url',
        'title',
      ].sort(),
    );
    expect(payload.recipe_id).toBe('recipe-1');
    expect(payload.dish_moods).toEqual(['zomers']);
    expect(payload.excluded_from_cook_proof).toBe(false);
    expect(payload).not.toHaveProperty('visibility');
    expect(payload).not.toHaveProperty('metadata');
    expect(payload).not.toHaveProperty('updated_at');
  });

  /** The four optional fields land as the column defaults the migrations declare, never as undefined. */
  test('an optional field absent on the local row lands as its column default', async () => {
    const fake = makeClient();
    await mirrorMeal(
      fake.client,
      mealJob(
        meal({
          allergenTagStatus: undefined,
          recipeId: undefined,
          dishMoods: undefined,
          excludedFromCookProof: undefined,
        }),
      ),
    );

    const payload = payloadOf(fake.log, '"title"');
    expect(payload.allergen_tag_status).toBe('unknown');
    expect(payload.recipe_id).toBeNull();
    expect(payload.dish_moods).toEqual([]);
    expect(payload.excluded_from_cook_proof).toBe(false);
  });

  /**
   * 0001's meals_insert policy requires household_id is not null. A curated
   * meal is not this household's row to mirror, so it is refused HERE with
   * a sentence rather than by Postgres with a 42501 after a round trip.
   */
  test('a curated meal (no household) is rejected without any request', async () => {
    const fake = makeClient();
    const outcome = await mirrorMeal(fake.client, mealJob(meal({ householdId: null })));

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.failure.kind).toBe('rejected');
    expect(fake.tables).toEqual([]);
  });

  /** Parent first: meal_ingredients.meal_id and meal_steps.meal_id are FKs to meals.id. */
  test('the parent row is written before either child table', async () => {
    const fake = makeClient();
    await mirrorMeal(fake.client, mealJob());
    expect(fake.tables[0]).toBe('meals');
  });

  /**
   * Ingredients: upsert the new set, THEN delete whatever is left over.
   * That ordering is the whole point — the reverse leaves a window in which
   * the meal has no ingredients at all, which is precisely the partial
   * mirror a friend must never be able to read as a recipe.
   */
  test('ingredients are upserted before the stale remainder is deleted', async () => {
    const fake = makeClient();
    await mirrorMeal(fake.client, mealJob(meal(), [ingredient(), ingredient({ id: 'ing-2', sortOrder: 1 })]));

    const ingredientLog = logFor(fake.log, 'meal_ingredients');
    expect(ingredientLog[0]?.startsWith('upsert(')).toBe(true);
    expect(ingredientLog).toContain('delete()');
    expect(ingredientLog.indexOf('delete()')).toBeGreaterThan(0);
    expect(ingredientLog).toContain('eq(meal_id,meal-1)');
    expect(ingredientLog).toContain('not(id,in,(ing-1,ing-2))');
  });

  /** PostgREST rejects an empty `in` list, so "no ingredients" is a plain delete-by-meal. */
  test('a meal with no ingredients deletes them all without an empty in-list', async () => {
    const fake = makeClient();
    await mirrorMeal(fake.client, mealJob(meal(), [], [step()]));

    const ingredientLog = logFor(fake.log, 'meal_ingredients');
    expect(ingredientLog.some((entry) => entry.startsWith('upsert('))).toBe(false);
    expect(ingredientLog).toContain('delete()');
    expect(ingredientLog.some((entry) => entry.startsWith('not('))).toBe(false);
  });

  /**
   * Steps take the OPPOSITE order, and the reason is a constraint rather
   * than a preference: 0001 declares `unique (meal_id, step_number)`, so a
   * step that moved into a number another row still holds collides. The
   * departing rows have to go first for a renumber to land at all.
   */
  test('stale steps are deleted before the new set is upserted', async () => {
    const fake = makeClient();
    await mirrorMeal(fake.client, mealJob());

    const stepLog = logFor(fake.log, 'meal_steps');
    expect(stepLog.indexOf('delete()')).toBeLessThan(stepLog.findIndex((entry) => entry.startsWith('upsert(')));
    expect(stepLog).toContain('not(id,in,(step-1))');
  });

  /**
   * Idempotency, asserted the only way that means anything here: the second
   * mirror of an unchanged meal issues byte-identical requests. Upsert makes
   * them no-ops; an insert would have thrown 23505 on this second pass.
   */
  test('mirroring the same meal twice issues identical requests', async () => {
    const first = makeClient();
    const second = makeClient();
    await mirrorMeal(first.client, mealJob());
    await mirrorMeal(second.client, mealJob());
    expect(second.log).toEqual(first.log);
  });

  /** A child write that fails must fail the whole job, so the outbox keeps it and replays from the top. */
  test('a failed ingredient write fails the whole job and never reaches the steps', async () => {
    const fake = makeClient([ok, failWith('08006', 'connection failure')]);
    const outcome = await mirrorMeal(fake.client, mealJob());

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.failure.kind).toBe('unreachable');
    expect(fake.tables).not.toContain('meal_steps');
  });

  /**
   * The `in` filter is built by string concatenation because PostgREST's
   * list syntax leaves no alternative. An id carrying a comma would
   * silently become two filter values, so it is refused instead — the same
   * class of bug as quoting a filter value, caught before it is sent.
   */
  test('an id that would change the meaning of an in-filter is rejected before any request', async () => {
    const fake = makeClient();
    const outcome = await mirrorMeal(fake.client, mealJob(meal(), [ingredient({ id: 'ing,1' })]));

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.failure.kind).toBe('rejected');
    expect(fake.tables).toEqual([]);
  });
});

describe('mirroring a cook event', () => {
  /**
   * decision_id is ALWAYS null. `decisions` is deliberately not mirrored
   * (it stays local), so a local decision id here is a foreign key to a row
   * Postgres does not have — a guaranteed 23503 on every cook event this
   * household ever records.
   */
  test('writes the mirrored columns and always nulls decision_id', async () => {
    const fake = makeClient();
    await mirrorCookEvent(fake.client, { kind: 'cook_event', event: cookEvent() });

    const payload = payloadOf(fake.log, '"cooked_on"');

    expect(Object.keys(payload).sort()).toEqual(
      ['cooked_on', 'created_at', 'decision_id', 'household_id', 'id', 'meal_id', 'rating', 'would_repeat'].sort(),
    );
    expect(payload.decision_id).toBeNull();
    expect(payload.rating).toBe(8.5);
    expect(typeof payload.rating).toBe('number');
    expect(fake.tables).toEqual(['cook_events']);
  });

  /** Null is a first-class answer on this column (0005): the question was skipped, not lost. */
  test('an unrated cook event mirrors a null rating rather than a midpoint', async () => {
    const fake = makeClient();
    await mirrorCookEvent(fake.client, {
      kind: 'cook_event',
      event: cookEvent({ rating: undefined, wouldRepeat: null }),
    });

    const payload = payloadOf(fake.log, '"cooked_on"');
    expect(payload.rating).toBeNull();
    expect(payload.would_repeat).toBeNull();
  });

  /**
   * 0008's CHECK is `rating >= 1 and rating <= 10 and rating = round(rating, 1)`.
   * An off-scale grade is refused here rather than clamped, matching
   * setCookEventRating's own refusal — and rather than being sent to earn a
   * 23514 the outbox would then have to park.
   */
  test('an off-scale rating is rejected without any request', async () => {
    const fake = makeClient();
    const outcome = await mirrorCookEvent(fake.client, { kind: 'cook_event', event: cookEvent({ rating: 11 }) });

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.failure.kind).toBe('rejected');
    expect(fake.tables).toEqual([]);
  });

  /**
   * PostgREST may serialise a numeric as JSON text, and a rating that
   * arrived that way through any path would flow through arithmetic without
   * complaining. It is coerced and re-validated before it is sent.
   */
  test('a rating that arrived as text is coerced to a number before it is sent', async () => {
    const fake = makeClient();
    await mirrorCookEvent(fake.client, {
      kind: 'cook_event',
      event: cookEvent({ rating: '7.5' as unknown as number }),
    });

    const payload = payloadOf(fake.log, '"cooked_on"');
    expect(payload.rating).toBe(7.5);
    expect(typeof payload.rating).toBe('number');
  });

  /** A cook event has no children, so a second mirror is a single idempotent upsert. */
  test('mirroring the same cook event twice issues identical requests', async () => {
    const first = makeClient();
    const second = makeClient();
    await runMirrorJob(first.client, { kind: 'cook_event', event: cookEvent() });
    await runMirrorJob(second.client, { kind: 'cook_event', event: cookEvent() });
    expect(second.log).toEqual(first.log);
  });
});

describe("mirroring a household's cook-proof consent", () => {
  const settingsJob = (shareCooksWithFriends: boolean) =>
    ({ kind: 'household_settings', householdId: 'hh-1', shareCooksWithFriends }) as const;

  /** One touched row is the only evidence a PATCH gives that it did anything. */
  const touched: FakeResponse = { data: [{ id: 'hh-1' }], error: null };

  /**
   * THE STRUCTURAL GUARANTEE. ensureRemoteHousehold.ts owns whether a
   * `households` row exists; this module owns what is in it. A PATCH cannot
   * create a row, so the two writers cannot revert each other — and this
   * asserts the verb, not merely the intention.
   */
  test('uses update, never upsert or insert, and patches exactly one column', async () => {
    const fake = makeClient([touched]);
    await mirrorHouseholdSettings(fake.client, settingsJob(true));

    expect(fake.tables).toEqual(['households']);
    expect(fake.log.some((entry) => entry.startsWith('upsert('))).toBe(false);
    expect(fake.log).toContain('update({"share_cooks_with_friends":true})');
    expect(fake.log).toContain('eq(id,hh-1)');
  });

  /** Revoking is the same job with the other value — same verb, same key, same retry. */
  test('a revoke is written the same way an enable is', async () => {
    const enable = makeClient([touched]);
    const revoke = makeClient([touched]);
    await mirrorHouseholdSettings(enable.client, settingsJob(true));
    await mirrorHouseholdSettings(revoke.client, settingsJob(false));

    expect(revoke.log).toEqual(enable.log.map((entry) => entry.replace(':true', ':false')));
  });

  /**
   * A PostgREST PATCH that matches no row succeeds with 204 and an empty
   * body — RLS filters an UPDATE rather than erroring on it. Silence there
   * would mean a household is told sharing changed when nothing changed,
   * so the affected rows are asked for and an empty answer is a REFUSAL:
   * retryable, because the membership row the policy wants may still be
   * on its way.
   */
  test('a patch that touched no row is a refusal, not a success', async () => {
    const fake = makeClient([{ data: [], error: null }]);
    const outcome = await mirrorHouseholdSettings(fake.client, settingsJob(false));

    expect(fake.log).toContain('select(id)');
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.failure.kind).toBe('refused');
  });

  test('a patch that touched its row succeeds', async () => {
    const fake = makeClient([touched]);
    expect((await mirrorHouseholdSettings(fake.client, settingsJob(true))).ok).toBe(true);
  });

  test('an RLS refusal on the patch stays a refusal', async () => {
    const fake = makeClient([failWith('42501', 'row-level security')]);
    const outcome = await mirrorHouseholdSettings(fake.client, settingsJob(true));
    expect(outcome.ok === false && outcome.failure.kind).toBe('refused');
  });

  /** Consent must not be inferred from a truthy value that predates the column. */
  test('a non-boolean consent value is coerced rather than trusted', async () => {
    const fake = makeClient([touched]);
    await mirrorHouseholdSettings(fake.client, {
      kind: 'household_settings',
      householdId: 'hh-1',
      shareCooksWithFriends: 'ja' as unknown as boolean,
    });
    expect(fake.log).toContain('update({"share_cooks_with_friends":false})');
  });

  test('mirroring the same consent twice issues identical requests', async () => {
    const first = makeClient([touched]);
    const second = makeClient([touched]);
    await runMirrorJob(first.client, settingsJob(true));
    await runMirrorJob(second.client, settingsJob(true));
    expect(second.log).toEqual(first.log);
  });
});

describe('classifying a failure', () => {
  /**
   * The bug this repo already had once: an RLS refusal and a dead network
   * collapsed into one indistinguishable null. They are different facts
   * with different remedies, so they get different kinds.
   */
  test('42501 is a refusal, not a network failure', () => {
    const failure = classifyMirrorError('Mirroring a meal', {
      code: '42501',
      message: 'new row violates row-level security policy',
    });
    expect(failure.kind).toBe('refused');
    expect(failure.code).toBe('42501');
    expect(failure.message).toContain('row-level security');
  });

  test('an error with no code at all is unreachable', () => {
    expect(classifyMirrorError('Mirroring a meal', { message: 'TypeError: Failed to fetch' }).kind).toBe('unreachable');
  });

  /** SQLSTATE class 08 is literally "connection exception" — the server said so, but it is still transport. */
  test('a class-08 SQLSTATE is unreachable', () => {
    expect(classifyMirrorError('Mirroring a meal', { code: '08006', message: 'connection failure' }).kind).toBe(
      'unreachable',
    );
  });

  /** A constraint violation is the payload being wrong. Retrying it forever is a hot loop, not durability. */
  test('a constraint violation is rejected, and is a different kind from a refusal', () => {
    expect(classifyMirrorError('Mirroring a cook event', { code: '23503', message: 'fk' }).kind).toBe('rejected');
    expect(classifyMirrorError('Mirroring a meal', { code: '23505', message: 'dup' }).kind).toBe('rejected');
    expect(classifyMirrorError('Mirroring a meal', { code: '23514', message: 'check' }).kind).toBe('rejected');
  });

  /** PostgREST's own expired-JWT code means "not allowed yet", which is the same remedy as an RLS refusal. */
  test('an expired token is a refusal', () => {
    expect(classifyMirrorError('Mirroring a meal', { code: 'PGRST301', message: 'JWT expired' }).kind).toBe('refused');
  });

  /** The operation name survives into the failure, so a log line names the step that failed. */
  test('the failure names the operation it came from', () => {
    expect(classifyMirrorError('Mirroring a meal', { code: '42501', message: 'no' }).operation).toBe('Mirroring a meal');
  });
});

/**
 * The seam between the local repository and the write-through mirror:
 * which local writes announce themselves, which deliberately do not, and
 * the proof that none of it can hurt a local write.
 *
 * WHY AN INJECTED CALLBACK AND NOT AN IMPORT. localRepository.ts is pure
 * and local, and every suite in this directory runs it with no network and
 * no Supabase client. Importing the mirror there would drag
 * src/lib/supabase.ts — which THROWS AT MODULE SCOPE when the env vars are
 * absent, and therefore cannot be imported under Vite at all — into every
 * repository test, and would make the offline path depend on an online
 * module. So the repository takes a `MirrorJobSink`, a plain
 * `(job) => void`, and createRepository.ts is the one place that binds it
 * to Supabase. The sink below is `vi.fn()`, which is the whole fake.
 *
 * WHAT THE SINK STRUCTURALLY CANNOT BECOME. It returns `void`, so nothing
 * it produces can be read back into a repository method; it is handed the
 * value the local write has ALREADY committed, so it cannot alter what was
 * stored; and it has no read verb, so it cannot answer a question. A
 * second source of truth needs a way back in, and there is none.
 *
 * THE ONE ABSENCE THAT IS LOAD-BEARING: `updateHouseholdSettings` emits
 * NOTHING. `setHouseholdCookSharing` was deliberately kept out of it (see
 * RemyRepository's comment on that method) so a stale settings spread
 * cannot flip consent as a side effect. Reuniting the two behind one job
 * would undo that at the mirror instead, which is why the absence is
 * asserted rather than assumed.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalRepository, type MirrorJobSink } from '@/lib/repository/localRepository';
import type { MirrorJob, MirrorMealJob } from '@/lib/repository/mirror/types';
import type { CreateMealInput, RemyRepository } from '@/lib/repository/types';

const HOUSEHOLD_ID = 'household-1';

function makeCreateMealInput(overrides: Partial<CreateMealInput> = {}): CreateMealInput {
  return {
    householdId: HOUSEHOLD_ID,
    title: 'Test gerecht',
    source: 'saved',
    estimatedMinutes: 20,
    skillLevel: null,
    servings: 4,
    ingredientTags: [],
    dishTags: ['kip'],
    allergenTagStatus: 'unknown',
    sourceUrl: null,
    sourcePlatform: null,
    thumbnailUrl: null,
    ingredients: [
      { name: '400 g kipfilet', quantity: null, unit: null, sortOrder: 0 },
      { name: '1 citroen', quantity: null, unit: null, sortOrder: 1 },
    ],
    steps: [{ stepNumber: 1, instruction: 'Bak de kip.', durationMinutes: null }],
    ...overrides,
  };
}

/** The mirror is fire-and-forget, so a meal job lands a microtask after the write returns. */
function settleAll(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('localRepository — what announces itself to the mirror', () => {
  let store: KeyValueStore;
  let mirror: ReturnType<typeof vi.fn>;
  let repository: RemyRepository;
  let householdId: string;

  beforeEach(async () => {
    store = createInMemoryKeyValueStore();
    mirror = vi.fn();
    repository = createLocalRepository(store, mirror as unknown as MirrorJobSink);
    await repository.seedIfEmpty();
    householdId = await repository.getCurrentHouseholdId();
    mirror.mockClear();
  });

  function jobs(): MirrorJob[] {
    return mirror.mock.calls.map((call) => call[0] as MirrorJob);
  }

  function mealJob(): MirrorMealJob | undefined {
    return jobs().find((candidate): candidate is MirrorMealJob => candidate.kind === 'meal');
  }

  test('a created meal travels as ONE job carrying its ingredients and steps', async () => {
    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));
    await settleAll();

    expect(mealJob()?.meal.id).toBe(meal.id);
    expect(mealJob()?.ingredients.map((ingredient) => ingredient.name)).toEqual(['400 g kipfilet', '1 citroen']);
    expect(mealJob()?.steps.map((step) => step.instruction)).toEqual(['Bak de kip.']);
  });

  /**
   * PD-010 §3.5's "Deel deze niet". The flag decides whether this meal's
   * cook proof reaches a friend at all, so a local-only flip is a promise
   * the database never hears about.
   */
  test('a cook-proof exclusion re-mirrors the meal it is about', async () => {
    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));
    await settleAll();
    mirror.mockClear();

    await repository.setMealCookProofExclusion(meal.id, true);
    await settleAll();

    expect(mealJob()?.meal.id).toBe(meal.id);
    expect(mealJob()?.meal.excludedFromCookProof).toBe(true);
  });

  test('a dish mood re-mirrors the meal, because 0010 reads that column across households', async () => {
    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));
    await settleAll();
    mirror.mockClear();

    await repository.addMealDishMood(meal.id, 'soul-food');
    await settleAll();

    expect(mealJob()?.meal.id).toBe(meal.id);
  });

  test('a cook event, a repeat and a rating each announce a cook_event job', async () => {
    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));
    await settleAll();
    mirror.mockClear();

    const event = await repository.createCookEvent({
      householdId,
      mealId: meal.id,
      decisionId: null,
      cookedOn: '2026-08-26',
    });
    await repository.setCookEventRepeat(event.id, true);
    await repository.setCookEventRating(event.id, 4);
    await settleAll();

    expect(jobs().filter((job) => job.kind === 'cook_event')).toHaveLength(3);
  });

  test('cook-sharing consent announces a household_settings job', async () => {
    await repository.setHouseholdCookSharing(householdId, true);
    await settleAll();

    expect(jobs()).toEqual([{ kind: 'household_settings', householdId, shareCooksWithFriends: true }]);
  });

  /**
   * A revoke is a promise already made to the user — "sharing has
   * stopped" — and it must reach Postgres by the same route an enable
   * does. The mirror deliberately does not branch on the value; this is
   * the assertion that the WIRING does not either.
   */
  test('a revoke announces itself exactly as an enable does', async () => {
    await repository.setHouseholdCookSharing(householdId, true);
    await settleAll();
    mirror.mockClear();

    await repository.setHouseholdCookSharing(householdId, false);
    await settleAll();

    expect(jobs()).toEqual([{ kind: 'household_settings', householdId, shareCooksWithFriends: false }]);
  });

  /**
   * THE SEPARATION `RemyRepository` DEFENDS. `updateHouseholdSettings`
   * takes a spread of settings; if it also mirrored consent, a settings
   * save carrying a stale `shareCooksWithFriends` would flip somebody's
   * privacy decision as a side effect. It is kept out of the mirror for
   * the same reason it is kept out of `setHouseholdCookSharing`.
   */
  test('updateHouseholdSettings mirrors NOTHING — consent never rides along with a settings spread', async () => {
    await repository.updateHouseholdSettings(householdId, { weeknightTimeBudgetMinutes: 45 });
    await settleAll();

    expect(mirror).not.toHaveBeenCalled();
  });

  test('reads announce nothing at all', async () => {
    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));
    await settleAll();
    mirror.mockClear();

    await repository.getMeal(meal.id);
    await repository.listHouseholdMeals(householdId);
    await repository.getMealIngredients(meal.id);
    await repository.listCookEvents(householdId);
    await repository.getHouseholdCookSharing(householdId);
    await settleAll();

    expect(mirror).not.toHaveBeenCalled();
  });

  /**
   * Saves, decisions, members and restrictions stay local: nothing outside
   * a household reads them, and `member_restrictions` in particular is
   * GDPR Article 9 health data whose blast radius is not worth widening
   * for a feature that does not want it.
   */
  test('the tables the mirror deliberately does not carry announce nothing', async () => {
    const member = await repository.createMember({ householdId, displayName: 'Sanne' });
    await repository.createRestriction({
      memberId: member.id,
      type: 'dislike',
      excludesTag: 'koriander',
      notes: null,
    });
    await settleAll();

    expect(mirror).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// The app must remain fully usable offline
// ---------------------------------------------------------------------------

describe('localRepository — the mirror can never hurt a local write', () => {
  test('a repository built with no sink at all works exactly as before', async () => {
    const repository = createLocalRepository(createInMemoryKeyValueStore());
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));

    expect((await repository.getMeal(meal.id))?.title).toBe('Test gerecht');
  });

  /**
   * A sink that throws is a sink that is broken, and the local write has
   * already committed by the time it is called. Rethrowing would fail a
   * save because a phone is in a lift.
   */
  test('a sink that throws does not fail the write, and the row is still there', async () => {
    const repository = createLocalRepository(createInMemoryKeyValueStore(), () => {
      throw new Error('mirror exploded');
    });
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    const meal = await repository.createMeal(makeCreateMealInput({ householdId }));
    await repository.setHouseholdCookSharing(householdId, true);
    await settleAll();

    expect((await repository.getMeal(meal.id))?.id).toBe(meal.id);
    expect(await repository.getHouseholdCookSharing(householdId)).toBe(true);
  });

  /**
   * The local write is the one that must succeed, and it already has by
   * the time the mirror is consulted. A repository that awaited the sink
   * would make every save as slow as the network and would fail a save
   * because a phone is in a lift.
   */
  test('createMeal resolves before its meal job has been assembled', async () => {
    const seen: MirrorJob[] = [];
    const repository = createLocalRepository(createInMemoryKeyValueStore(), (job) => seen.push(job));
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    await repository.createMeal(makeCreateMealInput({ householdId }));
    expect(seen).toEqual([]);

    await settleAll();
    expect(seen).toHaveLength(1);
  });
});

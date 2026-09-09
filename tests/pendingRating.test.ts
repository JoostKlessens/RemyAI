/**
 * The wiring between `cookRating.ts`'s twelve-hour rule and the sheet that
 * finally asks the question (GAP-46).
 *
 * WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY LEAVES ALONE.
 * `tests/cookRating.test.ts` already owns the RULE — when a cook is due,
 * which of several is picked, how an unreadable timestamp fails closed.
 * Re-asserting any of that here would be a second definition of the same
 * thing, free to drift. What is tested here is everything the rule cannot
 * see: the two repository reads, the resolution to a dish with a NAME, the
 * failure postures, and the two writes on the way back.
 *
 * THE REPOSITORY IS A HAND-BUILT STUB, not a mock library. Only four
 * methods are ever called, and a stub that implements exactly those makes
 * a fifth call fail loudly instead of quietly returning undefined.
 */
import { describe, expect, test, vi } from 'vitest';

import { RATING_DELAY_HOURS } from '@/domain/cookRating';
import type { PublicVoteSink } from '@/domain/social/publicVote';
import type { CookEvent, Meal } from '@/domain/types';
import { recordPendingRating, resolvePendingRating } from '@/lib/pendingRating';
import type { RemyRepository } from '@/lib/repository/types';

const HOUSEHOLD = 'household-1';
const NOW = Date.parse('2026-09-09T08:00:00.000Z');
const HOUR = 3_600_000;

/** Finished long enough ago to be due: thirteen hours, one past the floor of twelve. */
const THIRTEEN_HOURS_AGO = new Date(NOW - 13 * HOUR).toISOString();
/** Finished two hours ago — cooked, but nobody has eaten it yet. */
const TWO_HOURS_AGO = new Date(NOW - 2 * HOUR).toISOString();

function cookEvent(overrides: Partial<CookEvent> = {}): CookEvent {
  return {
    id: 'cook-1',
    householdId: HOUSEHOLD,
    mealId: 'meal-1',
    decisionId: null,
    cookedOn: '2026-09-08',
    wouldRepeat: null,
    rating: null,
    createdAt: THIRTEEN_HOURS_AGO,
    ...overrides,
  } as CookEvent;
}

function meal(overrides: Partial<Meal> = {}): Meal {
  return { id: 'meal-1', title: 'Lasagne', recipeId: 'recipe-1', ...overrides } as Meal;
}

function repositoryWith(options: {
  readonly cookEvents?: readonly CookEvent[];
  readonly meals?: readonly Meal[];
  readonly householdIdRejects?: boolean;
  readonly cookEventsReject?: boolean;
  readonly setRating?: RemyRepository['setCookEventRating'];
}): RemyRepository {
  return {
    getCurrentHouseholdId: options.householdIdRejects
      ? () => Promise.reject(new Error('not seeded'))
      : () => Promise.resolve(HOUSEHOLD),
    listCookEvents: options.cookEventsReject
      ? () => Promise.reject(new Error('offline'))
      : () => Promise.resolve(options.cookEvents ?? []),
    listHouseholdMeals: () => Promise.resolve(options.meals ?? []),
    setCookEventRating: options.setRating ?? (() => Promise.resolve(cookEvent())),
  } as unknown as RemyRepository;
}

describe('resolving what to ask about', () => {
  test('a cook that finished thirteen hours ago is asked about, by name', async () => {
    const resolved = await resolvePendingRating(
      repositoryWith({ cookEvents: [cookEvent()], meals: [meal()] }),
      NOW,
    );
    expect(resolved).toEqual({
      cookEventId: 'cook-1',
      mealId: 'meal-1',
      mealTitle: 'Lasagne',
      recipeId: 'recipe-1',
    });
  });

  test('a cook that finished two hours ago is not asked about — the whole point of the delay', async () => {
    const resolved = await resolvePendingRating(
      repositoryWith({ cookEvents: [cookEvent({ createdAt: TWO_HOURS_AGO })], meals: [meal()] }),
      NOW,
    );
    expect(resolved).toBeNull();
  });

  test('nothing cooked at all asks nothing', async () => {
    expect(await resolvePendingRating(repositoryWith({}), NOW)).toBeNull();
  });

  /**
   * THE BRANCH THAT IS NOT DEFENSIVE. `listHouseholdMeals` filters
   * `archivedAt === null`, so a dish archived between the cook and the
   * twelfth hour is genuinely gone — and "Je hebt … gemaakt" about a recipe
   * somebody deleted is worse than silence.
   */
  test('a cook whose meal was archived in the meantime is not asked about', async () => {
    const resolved = await resolvePendingRating(repositoryWith({ cookEvents: [cookEvent()], meals: [] }), NOW);
    expect(resolved).toBeNull();
  });

  test('a hand-typed dish still gets asked about, with a null recipeId', async () => {
    // It has no canonical recipe, so it can never cast a public vote — but
    // the household's own grade is exactly as real, and PD-008's private
    // column is what the decision engine reads.
    const resolved = await resolvePendingRating(
      repositoryWith({ cookEvents: [cookEvent()], meals: [meal({ recipeId: undefined })] }),
      NOW,
    );
    expect(resolved?.recipeId).toBeNull();
  });

  test('a fresh install that has not seeded yet asks nothing instead of throwing', async () => {
    // `getCurrentHouseholdId` really does throw before `ensureSeeded` runs.
    // Opening the app must not depend on winning that race.
    await expect(resolvePendingRating(repositoryWith({ householdIdRejects: true }), NOW)).resolves.toBeNull();
  });

  test('a failed read asks nothing instead of throwing — local-first, so no launch depends on it', async () => {
    await expect(resolvePendingRating(repositoryWith({ cookEventsReject: true }), NOW)).resolves.toBeNull();
  });

  test('the boundary is the constant, not a number retyped here', async () => {
    // Pinned against RATING_DELAY_HOURS itself, so moving the constant moves
    // this test with it rather than leaving a stale 12 behind.
    const exactlyDue = new Date(NOW - RATING_DELAY_HOURS * HOUR).toISOString();
    const resolved = await resolvePendingRating(
      repositoryWith({ cookEvents: [cookEvent({ createdAt: exactlyDue })], meals: [meal()] }),
      NOW,
    );
    expect(resolved).not.toBeNull();
  });
});

describe('recording the answer', () => {
  function sinkSpy(outcome: 'ok' | 'throws' = 'ok'): { sink: PublicVoteSink; calls: unknown[] } {
    const calls: unknown[] = [];
    const sink = {
      rateRecipe: (input: unknown) => {
        calls.push(input);
        return outcome === 'throws' ? Promise.reject(new Error('offline')) : Promise.resolve();
      },
    } as unknown as PublicVoteSink;
    return { sink, calls };
  }

  const PROMPT = {
    cookEventId: 'cook-1',
    mealId: 'meal-1',
    mealTitle: 'Lasagne',
    recipeId: 'recipe-1',
  } as const;

  test('one gesture writes both rows, and the scale crosses unconverted', async () => {
    const setRating = vi.fn(() => Promise.resolve(cookEvent()));
    const { sink, calls } = sinkSpy();
    const outcome = await recordPendingRating(
      repositoryWith({ setRating: setRating as unknown as RemyRepository['setCookEventRating'] }),
      sink,
      PROMPT,
      'profile-1',
      8.5,
    );
    expect(setRating).toHaveBeenCalledWith('cook-1', 8.5);
    expect(calls).toEqual([{ recipeId: 'recipe-1', raterProfileId: 'profile-1', rating: 8.5 }]);
    expect(outcome).toBe('cast');
  });

  test('a hand-typed dish records the private grade and skips the public vote', async () => {
    const setRating = vi.fn(() => Promise.resolve(cookEvent()));
    const { sink, calls } = sinkSpy();
    const outcome = await recordPendingRating(
      repositoryWith({ setRating: setRating as unknown as RemyRepository['setCookEventRating'] }),
      sink,
      { ...PROMPT, recipeId: null },
      'profile-1',
      7,
    );
    expect(setRating).toHaveBeenCalledWith('cook-1', 7);
    expect(calls).toEqual([]);
    expect(outcome).toBe('skipped');
  });

  test('a signed-out rater records the private grade and skips the public vote', async () => {
    const { sink, calls } = sinkSpy();
    const outcome = await recordPendingRating(repositoryWith({}), sink, PROMPT, null, 7);
    expect(calls).toEqual([]);
    expect(outcome).toBe('skipped');
  });

  /**
   * The property the old `handleRate` protected and this one inherits:
   * somebody has just said how dinner was, and a leaderboard that could not
   * be updated is not their problem.
   */
  test('a failed public vote does not fail the private one', async () => {
    const setRating = vi.fn(() => Promise.resolve(cookEvent()));
    const { sink } = sinkSpy('throws');
    const outcome = await recordPendingRating(
      repositoryWith({ setRating: setRating as unknown as RemyRepository['setCookEventRating'] }),
      sink,
      PROMPT,
      'profile-1',
      9,
    );
    expect(setRating).toHaveBeenCalledWith('cook-1', 9);
    expect(outcome).toBe('failed');
  });
});

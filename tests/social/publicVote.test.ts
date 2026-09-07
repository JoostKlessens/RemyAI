/**
 * The public vote a cook now casts (src/domain/social/publicVote.ts).
 *
 * WHY THIS SUITE EXISTS. `rateRecipe` shipped with a repository method, two
 * backends, a unique constraint and a full test file of its own — and ZERO
 * production callers. Ranglijst was therefore empty for a reason nobody had
 * written down: not policy, not an absent opt-in, a missing writer. This
 * module is that writer, and this file is the thing that will notice if it
 * ever stops being called for a reason as quiet as the first one.
 *
 * THE TWO SCALES ARE THE SAME SCALE, AND THAT IS CHECKED HERE RATHER THAN
 * ASSUMED. `cook_events.rating` and `recipe_ratings.rating` are both
 * `numeric(4,2)` with `check (rating >= 1 and rating <= 10 and rating =
 * round(rating, 1))` — migration 0008 writes the identical constraint
 * twice, once per table — so a grade crosses from the private instrument to
 * the public one unconverted. The assertion below is `isValidRating`, the
 * one function that owns that scale, so if the scales ever diverge this
 * module stops compiling against a single predicate rather than silently
 * shipping a converted number.
 *
 * WHAT IT MUST NOT DO IS THE OTHER HALF OF THE SUITE: a public vote that
 * fails must never take the private write down with it. They are different
 * instruments with different importance — the private grade is the decision
 * engine's input and the reason the household cooked at all, and the public
 * vote is a nice-to-have for a leaderboard.
 */

import { describe, expect, test, vi } from 'vitest';
import { RATING_MAX, RATING_MIN } from '@/domain/rating';
import { castPublicVote, planPublicVote, type PublicVoteSink } from '@/domain/social/publicVote';
import type { RateRecipeInput } from '@/lib/repository/social/types';
import { PROFILE_A, makeRecipeRating } from './fixtures';

const ME = PROFILE_A;
const RECIPE = 'recipe-1';

/** One method wide, which is exactly what `PublicVoteSink` narrows the repository to. */
function makeSink(behaviour: 'ok' | 'throws' = 'ok'): PublicVoteSink & { readonly rateRecipe: ReturnType<typeof vi.fn> } {
  const rateRecipe = vi.fn(async (input: RateRecipeInput) => {
    if (behaviour === 'throws') {
      throw new Error('RLS refused this vote.');
    }
    return makeRecipeRating({ recipeId: input.recipeId, raterProfileId: input.raterProfileId, rating: input.rating });
  });
  return { rateRecipe };
}

describe('planPublicVote: when a cook becomes a vote, and when it quietly does not', () => {
  test('a graded cook on a canonical recipe, by a signed-in profile, becomes one vote', () => {
    expect(planPublicVote({ recipeId: RECIPE, raterProfileId: ME, rating: 8.5 })).toEqual({
      kind: 'vote',
      input: { recipeId: RECIPE, raterProfileId: ME, rating: 8.5 },
    });
  });

  test('the grade crosses unconverted — the two columns hold the same scale (0008)', () => {
    for (const rating of [RATING_MIN, 4, 7.3, 8, RATING_MAX]) {
      const plan = planPublicVote({ recipeId: RECIPE, raterProfileId: ME, rating });
      expect(plan.kind).toBe('vote');
      expect(plan.kind === 'vote' ? plan.input.rating : null).toBe(rating);
    }
  });

  test('a hand-entered meal has no canonical recipe to rank, and that is not an error', () => {
    expect(planPublicVote({ recipeId: null, raterProfileId: ME, rating: 8.5 })).toEqual({
      kind: 'skip',
      reason: 'no-canonical-recipe',
    });
    expect(planPublicVote({ recipeId: undefined, raterProfileId: ME, rating: 8.5 }).kind).toBe('skip');
    expect(planPublicVote({ recipeId: '', raterProfileId: ME, rating: 8.5 })).toEqual({
      kind: 'skip',
      reason: 'no-canonical-recipe',
    });
  });

  test('no resolved profile means no vote — a public vote is cast by somebody or by nobody', () => {
    expect(planPublicVote({ recipeId: RECIPE, raterProfileId: null, rating: 8.5 })).toEqual({
      kind: 'skip',
      reason: 'no-profile',
    });
  });

  test('an off-scale or over-precise grade is refused here, before the write, never rounded', () => {
    for (const rating of [0, 10.5, 7.55, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(planPublicVote({ recipeId: RECIPE, raterProfileId: ME, rating })).toEqual({
        kind: 'skip',
        reason: 'off-scale',
      });
    }
  });

  test('the missing canonical recipe is reported before the scale, so the common case is never dressed as a bug', () => {
    expect(planPublicVote({ recipeId: null, raterProfileId: null, rating: 99 })).toEqual({
      kind: 'skip',
      reason: 'no-canonical-recipe',
    });
  });
});

describe('castPublicVote: one write, reported rather than thrown', () => {
  test('writes exactly one vote and says it was cast', async () => {
    const sink = makeSink();
    await expect(castPublicVote(sink, { recipeId: RECIPE, raterProfileId: ME, rating: 8.5 })).resolves.toBe('cast');
    expect(sink.rateRecipe).toHaveBeenCalledTimes(1);
    expect(sink.rateRecipe).toHaveBeenCalledWith({ recipeId: RECIPE, raterProfileId: ME, rating: 8.5 });
  });

  test('a meal with no canonical recipe writes nothing at all, and does not reject', async () => {
    const sink = makeSink();
    await expect(castPublicVote(sink, { recipeId: null, raterProfileId: ME, rating: 8.5 })).resolves.toBe('skipped');
    expect(sink.rateRecipe).not.toHaveBeenCalled();
  });

  test('a failed vote reports `failed` rather than throwing — the cook must not fail over a leaderboard', async () => {
    const sink = makeSink('throws');
    await expect(castPublicVote(sink, { recipeId: RECIPE, raterProfileId: ME, rating: 8.5 })).resolves.toBe('failed');
    expect(sink.rateRecipe).toHaveBeenCalledTimes(1);
  });

  test('never rejects, whatever it is handed — every caller sits beside a private write it must not disturb', async () => {
    const sink = makeSink('throws');
    const outcomes = await Promise.all([
      castPublicVote(sink, { recipeId: RECIPE, raterProfileId: ME, rating: 8.5 }),
      castPublicVote(sink, { recipeId: null, raterProfileId: ME, rating: 8.5 }),
      castPublicVote(sink, { recipeId: RECIPE, raterProfileId: null, rating: 8.5 }),
      castPublicVote(sink, { recipeId: RECIPE, raterProfileId: ME, rating: 7.55 }),
    ]);
    expect(outcomes).toEqual(['failed', 'skipped', 'skipped', 'skipped']);
  });
});

/**
 * The global board (PD-014, Fase 6): every canonical recipe, ordered by
 * what everybody who cooked it thought of it.
 *
 * WHAT THIS RANKS, AND WHY THAT DISTINCTION IS THE WHOLE SAFETY ARGUMENT.
 * Rows in `recipes` — canonical extractions of publicly-posted creator
 * content — and never a household's own `meals` row. That is not a detail.
 * `meals.visibility` is where PD-010 is enforced, it defaults to 'private',
 * and it has deliberately no 'public' member; a board built over meals
 * would be exactly the "put it in front of strangers" decision
 * src/domain/social/types.ts refuses to let arrive as an unused enum
 * member. Nothing here reads a meal, a household, or a member. The board
 * exposes no household data at all, which is why it needed a product
 * argument (PD-014) rather than a privacy one.
 *
 * WHY THE AGGREGATE IS STILL CLIENT-SIDE. `recipe_ratings` and `recipes`
 * are both readable by any authenticated user (0006 and 0007), so a caller
 * genuinely holds every row that counts and no definer-rights function is
 * needed to see across households. 0007_social.sql explicitly rejected a
 * friends-only SELECT plus an aggregate view, for the reason that governs
 * this file too: half an aggregate in SQL and half in the app gives the
 * score two definitions, and the one a person sees is whichever ran last.
 * If that policy ever narrows, this module starts ranking a subset while
 * claiming to rank the world — so narrowing it means moving the aggregate
 * server-side in the same change, not afterwards.
 *
 * WHY THERE IS NO SECOND COPY OF THE ARITHMETIC. Deduplicating a repeated
 * rater, dropping an off-scale vote, and refusing to invent a zero for an
 * unrated recipe are all decided once, in ./ratings.ts. This file consumes
 * `RecipeRatingSummary` and never a raw row, so those rules cannot drift
 * apart from the board that depends on them.
 *
 * Pure, no I/O.
 */

import type { RecipeRatingSummary } from './ratings';
import { summarizeRecipeRatingsByRecipe } from './ratings';
import type { RecipeId, RecipeRating } from './types';

/**
 * Below this many counted votes a recipe is not ranked at all.
 *
 * The shrinkage below already stops one enthusiast from topping the board,
 * so this floor answers a different question: whether a recipe two people
 * have tried belongs on a page that presents itself as a verdict. It does
 * not. "Best beoordeeld" with a sample of two is a claim the data cannot
 * support, and a reader has no way to see that from a position in a list.
 *
 * Rejected: no floor at all, letting shrinkage handle everything. It ranks
 * correctly and still reads as a lie — a recipe sitting at #40 looks
 * judged, not unmeasured.
 */
export const LEADERBOARD_MIN_VOTES = 3;

/**
 * How much the population's opinion counts for while a recipe's own is
 * still thin — read it as "the number of votes at which a recipe starts
 * speaking for itself". At exactly this many votes, its own average and
 * the prior carry equal weight; well above it, the prior stops mattering.
 *
 * Deliberately larger than LEADERBOARD_MIN_VOTES: a recipe that has only
 * just cleared the floor should still be visibly held back, or the floor
 * would just relocate the problem to the first recipe above it.
 */
export const LEADERBOARD_PRIOR_VOTES = 5;

/**
 * One row of the board.
 *
 * `score` orders the board and is never shown. `average` is what a reader
 * sees. Keeping both is the point: a recipe rated 5,5,5 genuinely has an
 * average of 5, and printing the shrunk 3.9 next to it would be answering
 * a question nobody asked ("why does my perfect recipe show 3.9?"). The
 * honest mean is displayed; the score that knows better does the sorting.
 *
 * `rank` is competition ranking on `score` — an exact tie shares a rank
 * and the next recipe skips one (1, 1, 3). Two recipes the arithmetic
 * cannot separate are not first and second, and saying so would invent a
 * difference the data does not contain.
 */
export interface LeaderboardEntry {
  readonly recipeId: RecipeId;
  readonly rank: number;
  /** Bayesian, orders the board, never rendered. */
  readonly score: number;
  /** The unrounded mean of the counted votes — what the board displays. */
  readonly average: number;
  readonly count: number;
}

/**
 * The level the whole population rates at, weighted by vote.
 *
 * WHY NOT THE MIDPOINT OF THE SCALE. Shrinking toward 3 would be the
 * textbook default and it is wrong here specifically: PD-008 gives the
 * middle band the meaning "deliberately produces no signal", so using it
 * as the prior would pull every thinly-rated recipe toward an opinion
 * nobody expressed. The population's actual level is a real opinion, held
 * by real raters.
 *
 * WHY WEIGHTED BY VOTE AND NOT BY RECIPE. A mean of recipe means lets a
 * recipe with one vote move the prior as hard as one with two hundred,
 * which is the exact failure the shrinkage exists to prevent — reintroduced
 * one level up.
 *
 * Null, never 0, when nothing has been rated: there is no prior to shrink
 * toward, and 0 is both outside the scale and a number people read as a
 * verdict. Same refusal to fabricate a shrug that `average` makes.
 */
export function populationMean(summaries: Iterable<RecipeRatingSummary>): number | null {
  let votes = 0;
  let total = 0;
  for (const summary of summaries) {
    if (summary.average === null || summary.count === 0) {
      continue;
    }
    votes += summary.count;
    total += summary.average * summary.count;
  }
  return votes === 0 ? null : total / votes;
}

/**
 * The Bayesian estimate: the recipe's own average and the population's,
 * weighted by how much evidence each one rests on.
 *
 *     (v * R + m * C) / (v + m)
 *
 * with `v` the recipe's votes, `R` its average, `m` LEADERBOARD_PRIOR_VOTES
 * and `C` the population mean. At v = 0 it is exactly C; as v grows it
 * converges on R. Nothing here is tuned per call site — both constants are
 * stated once, above, the way PD-008 requires of the scale itself.
 */
function bayesianScore(average: number, count: number, prior: number): number {
  return (count * average + LEADERBOARD_PRIOR_VOTES * prior) / (count + LEADERBOARD_PRIOR_VOTES);
}

/**
 * Orders summaries into a board.
 *
 * The prior is computed over EVERY summary, including the ones the floor
 * excludes. A recipe with two votes still says something true about the
 * population's general level, and dropping it would make the prior lurch
 * whenever LEADERBOARD_MIN_VOTES is retuned — a constant about presentation
 * silently changing the arithmetic.
 *
 * The comparator is total, so the board cannot reshuffle between two reads
 * of the same data: score descending, then sample size descending (more
 * evidence first when the score cannot separate them), then recipe id
 * ascending as a last resort that always decides.
 */
export function rankRecipes(summaries: Iterable<RecipeRatingSummary>): readonly LeaderboardEntry[] {
  const all = [...summaries];
  const prior = populationMean(all);
  if (prior === null) {
    return [];
  }

  const scored = all
    .filter(
      (summary): summary is RecipeRatingSummary & { readonly average: number } =>
        summary.average !== null && summary.count >= LEADERBOARD_MIN_VOTES,
    )
    .map((summary) => ({
      recipeId: summary.recipeId,
      average: summary.average,
      count: summary.count,
      score: bayesianScore(summary.average, summary.count, prior),
    }))
    .sort(
      (left, right) =>
        right.score - left.score || right.count - left.count || (left.recipeId < right.recipeId ? -1 : 1),
    );

  // Competition ranking: an entry's rank is one more than the number of
  // entries that genuinely beat it, so equals share a rank and the next
  // one skips. Reading it off the previous row keeps that true in one pass.
  const board: LeaderboardEntry[] = [];
  scored.forEach((entry, index) => {
    const previous = board[index - 1];
    const rank = previous !== undefined && previous.score === entry.score ? previous.rank : index + 1;
    board.push({ ...entry, rank });
  });
  return board;
}

/**
 * The board straight from rating rows — what a screen actually calls.
 *
 * Deliberately a composition of the two functions above rather than a
 * third implementation: `summarizeRecipeRatingsByRecipe` owns dedup and
 * validity, `rankRecipes` owns the ordering, and this owes both of them
 * everything. A test asserts the two paths agree, so neither can quietly
 * become a second definition of the score.
 */
export function buildLeaderboard(ratings: readonly RecipeRating[]): readonly LeaderboardEntry[] {
  return rankRecipes(summarizeRecipeRatingsByRecipe(ratings).values());
}

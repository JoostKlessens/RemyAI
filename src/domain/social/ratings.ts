/**
 * Turning a pile of `recipe_ratings` rows into the one score a recipe has.
 *
 * WHY THE AGGREGATION IS HERE AND NOT AN SQL VIEW. A view would be shorter
 * and the database would keep it consistent for free, and it was the first
 * design. Rejected for two reasons. First, every rule below is a product
 * decision rather than arithmetic: an off-scale score is dropped rather
 * than clamped, a duplicate rater collapses to their latest vote, and a
 * recipe with no valid votes has `average: null` rather than 0. Those
 * belong where they can be read and tested next to the scale they depend
 * on — src/domain/rating.ts — not split between a view definition and
 * whatever the client does with the numbers afterwards. Second, half an
 * aggregate in SQL and half in the app gives the score two definitions,
 * and the one a person sees would be whichever ran last. Same reasoning
 * 0005_cook_event_rating.sql gives for keeping `would_repeat` a projection
 * the client computes rather than a generated column.
 *
 * WHY AGGREGATING CLIENT-SIDE IS SOUND HERE. `recipe_ratings` is readable
 * by any authenticated user (see the policy in
 * supabase/migrations/0007_social.sql and the note there on why), so the
 * caller genuinely holds every row that counts. If that policy ever
 * narrows, this function starts summarising a subset and quietly reports a
 * partial score as the whole one — so narrowing it means adding a
 * definer-side aggregate in the same change, not just editing the policy.
 *
 * THE SCALE IS NOT RESTATED HERE. `RATING_MIN`, `RATING_MAX` and
 * `isValidRating` come from rating.ts, which PD-008 names as the single
 * place the scale is written down. That claim was tested for real when the
 * scale moved from 1-5 whole numbers to the Dutch 1,0-10,0 report card:
 * this file needed one edit, to how `distribution` buckets, and it needed
 * that only because a one-decimal scale has 91 expressible values and a
 * histogram cannot have 91 bars.
 *
 * Pure, no I/O.
 */

import { RATING_MAX, RATING_MIN, isValidRating } from '../rating';
import type { RecipeId, RecipeRating } from './types';

/**
 * The whole grade `distribution[0]` counts. Exported because a caller
 * rendering a histogram has to label its buckets, and deriving a label
 * from an index requires knowing where the index starts — a hardcoded
 * `+ 1` at the call site is exactly the drift PD-008 forbids.
 */
export const RATING_DISTRIBUTION_BASE = RATING_MIN;

const SCALE_LENGTH = RATING_MAX - RATING_MIN + 1;

/**
 * One recipe's score, across every household that imported it.
 *
 * `average` is null, never 0, when nothing counts: an unrated recipe has
 * no opinion attached, and 0 is both a number people read as a verdict and
 * a value outside the scale. The same refusal to fabricate a shrug that
 * 0005_cook_event_rating.sql makes when it declines to default
 * `cook_events.rating` to a midpoint.
 *
 * `average` is deliberately unrounded. Rounding is presentation: a card
 * showing one decimal and a sort comparing full precision must never
 * disagree, and the only way to guarantee that is for the domain to hand
 * over the real number.
 */
export interface RecipeRatingSummary {
  readonly recipeId: RecipeId;
  /** Distinct raters whose vote counted. Always equal to the sum of `distribution`. */
  readonly count: number;
  readonly average: number | null;
  /**
   * Votes per WHOLE grade; index = round(score) - RATING_DISTRIBUTION_BASE.
   * Always one bucket per whole grade, so an unvoted grade reads as 0
   * rather than as absent, and the buckets always sum to `count`.
   *
   * Bucketed by whole grade rather than by distinct value because the
   * scale carries one decimal: a bucket per expressible value would be 91
   * of them, which is not a histogram anybody can read. Rounding to
   * nearest is the honest reduction — a 7.5 is counted as an eight, the
   * way it would be read aloud — and it is a reduction, so the precise
   * figure stays in `average` where nothing is lost.
   */
  readonly distribution: readonly number[];
}

/** What a recipe nobody has rated looks like. Not an error state — most recipes are here. */
export function emptyRecipeRatingSummary(recipeId: RecipeId): RecipeRatingSummary {
  return {
    recipeId,
    count: 0,
    average: null,
    distribution: Array.from({ length: SCALE_LENGTH }, () => 0),
  };
}

/**
 * Collapses the rows for one recipe to at most one per rater, mirroring
 * `unique (recipe_id, rater_profile_id)` in 0007_social.sql.
 *
 * The database cannot hand us a duplicate, so this only fires on a client
 * that merged two pages or two caches. It still matters: without it, one
 * person refreshing at the wrong moment counts twice and moves a score
 * everybody sees. The latest `ratedAt` wins, because that is the opinion
 * the person most recently expressed — comparing the ISO strings directly
 * is safe, since the fixed-width UTC format this codebase stores sorts
 * chronologically as text. A tie keeps whichever row was seen first, and
 * the outcome stays order-independent regardless, because a tie can only
 * arise between rows the rule cannot tell apart.
 *
 * Off-scale scores are dropped before deduplication runs, so an unreadable
 * newer row can never displace a valid older one. Dropping the vote is
 * honest; clamping it to the nearest legal value would put an opinion in
 * someone's mouth.
 */
function latestValidVotePerRater(recipeId: RecipeId, ratings: readonly RecipeRating[]): readonly RecipeRating[] {
  const byRater = new Map<string, RecipeRating>();
  for (const rating of ratings) {
    if (rating.recipeId !== recipeId || !isValidRating(rating.rating)) {
      continue;
    }
    const held = byRater.get(rating.raterProfileId);
    if (held === undefined || rating.ratedAt > held.ratedAt) {
      byRater.set(rating.raterProfileId, rating);
    }
  }
  return [...byRater.values()];
}

/**
 * The score for one recipe, computed from whatever rows the caller holds.
 * Rows belonging to other recipes are ignored rather than rejected: the
 * natural caller has a page of ratings covering several recipes and should
 * not have to pre-filter it.
 */
export function summarizeRecipeRatings(recipeId: RecipeId, ratings: readonly RecipeRating[]): RecipeRatingSummary {
  const votes = latestValidVotePerRater(recipeId, ratings);
  if (votes.length === 0) {
    return emptyRecipeRatingSummary(recipeId);
  }

  const total = votes.reduce((sum, vote) => sum + vote.rating, 0);
  const distribution = Array.from(
    { length: SCALE_LENGTH },
    (_unused, index) => votes.filter((vote) => Math.round(vote.rating) === index + RATING_DISTRIBUTION_BASE).length,
  );

  return {
    recipeId,
    count: votes.length,
    average: total / votes.length,
    distribution,
  };
}

/**
 * Every recipe present in one list, summarised in a single pass over the
 * distinct recipe ids — what a list screen needs, instead of N calls to
 * the single-recipe function each re-scanning the whole array.
 *
 * A recipe whose only rows were off-scale is absent from the map rather
 * than present with an empty summary. Absent is the truthful answer:
 * nothing countable was said about it, which is the same state as never
 * having been rated, and a caller reaching for a missing key should fall
 * back to `emptyRecipeRatingSummary` itself rather than receive a summary
 * this function invented.
 */
export function summarizeRecipeRatingsByRecipe(
  ratings: readonly RecipeRating[],
): ReadonlyMap<RecipeId, RecipeRatingSummary> {
  const summaries = new Map<RecipeId, RecipeRatingSummary>();
  for (const recipeId of new Set(ratings.map((rating) => rating.recipeId))) {
    const summary = summarizeRecipeRatings(recipeId, ratings);
    if (summary.count > 0) {
      summaries.set(recipeId, summary);
    }
  }
  return summaries;
}

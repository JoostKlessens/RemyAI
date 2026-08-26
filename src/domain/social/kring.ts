/**
 * De kring — what the people you know think (docs/DESIGN-SOCIAL.md §2.2).
 *
 * A DIFFERENT LIST ANSWERING A DIFFERENT QUESTION, NOT A FILTER ON THE
 * BOARD. Ranglijst answers "wat is hier echt goed?" — the population's
 * verdict — and stays global and identical for every reader, which is
 * PD-014's sixth condition. This answers "wat vindt mijn kring goed?".
 * An earlier draft made it a toggle on the board instead; that was wrong
 * because it mutated the protected object, re-ordering the one list whose
 * entire meaning is that everybody sees the same thing. Leaving the board
 * alone needs no excuse, so this file exists and `leaderboard.ts` is
 * untouched.
 *
 * WHY IT IS A SEPARATE FILE AND NOT A MODE OF leaderboard.ts. The board's
 * devices exist to tame anonymous strangers, and none of them survives
 * contact with five named people:
 *
 *   - **Floor of one vote.** The board's floor keeps anonymous noise off
 *     a page that presents itself as a verdict. A friend's single vote is
 *     not anonymous noise — you know exactly whose opinion it is, which
 *     is the entire evidentiary point of this list. With four friends
 *     almost nothing would ever clear LEADERBOARD_MIN_VOTES.
 *   - **No shrinkage.** Shrinking toward a population mean is a device
 *     for thin evidence from unknown voters. With named voters the honest
 *     number is what they actually said.
 *   - **One decimal, not two.** Two decimals on a handful of known votes
 *     is false precision wearing the board's clothes.
 *
 * Several rules here are the exact inverse of a rule in leaderboard.ts.
 * That is deliberate, and it is why the two live apart: a shared file
 * would invite a shared constant, and a shared constant would quietly
 * make one list behave like the other.
 *
 * WHAT IT DOES NOT RE-IMPLEMENT. Deduplicating a repeated voter, dropping
 * an off-scale vote, and the plain average itself all come from
 * ./ratings.ts, which owns them. This module consumes summaries and never
 * raw rows, so "whose votes counted" and "what they averaged" cannot
 * drift apart from each other.
 *
 * Pure, no I/O.
 */

import { summarizeRecipeRatingsByRecipe } from './ratings';
import type { ProfileId, RecipeId, RecipeRating } from './types';

/**
 * One vote is enough to be ranked.
 *
 * Deliberately not LEADERBOARD_MIN_VOTES, and deliberately not imported
 * from there — the two numbers answer different questions and a shared
 * constant would tie them together for no reason but tidiness. See the
 * header for the argument; `tests/social/kring.test.ts` asserts this stays
 * strictly below the board's floor, so the two cannot converge unnoticed.
 */
export const KRING_MIN_VOTES = 1;

/** One decimal. The board carries two; see the header for why that is wrong here. */
export const KRING_DECIMALS = 1;

/**
 * One row of the circle's list.
 *
 * `average` is the plain mean of the friends who voted, rounded once, and
 * it both orders the list and is the number shown. There is no second,
 * unrounded score behind it as there is on the board, because there is no
 * shrinkage to hide: the figure a reader sees is the figure the voters
 * produced.
 *
 * `voterProfileIds` are ids and not names — resolving a name is I/O, and
 * this module does none. The screen turns them into "Sanne en Joris".
 */
export interface KringEntry {
  readonly recipeId: RecipeId;
  readonly rank: number;
  /** Plain mean of the circle's votes, rounded to KRING_DECIMALS. Orders the list AND is displayed. */
  readonly average: number;
  readonly count: number;
  /** Whose votes counted, in no meaningful order. */
  readonly voterProfileIds: readonly ProfileId[];
}

function roundAverage(average: number): number {
  return Number(average.toFixed(KRING_DECIMALS));
}

/**
 * The circle's list, from votes the caller has already narrowed to
 * accepted friends.
 *
 * SCOPING IS THE CALLER'S JOB, AND SAYING SO MATTERS. This function has
 * no idea who your friends are; it ranks exactly the votes it is handed.
 * Passing it every vote in the database would silently produce a second
 * global board with none of the board's protections — no floor worth the
 * name, no shrinkage — which is the one way this file could do real
 * damage. The friend filter belongs in the query, where the friendship
 * rows are.
 *
 * `recipeTitles` is used for one thing only: breaking a tie that the
 * average and the vote count cannot. The board falls back to the recipe
 * id, which is opaque; this list shows dish names, so it falls back to
 * something the reader can actually see — otherwise two identical-looking
 * rows sit in an order nothing on screen explains. A recipe with no known
 * title falls back to its id, so a missing title cannot destabilise the
 * order or drop a row.
 *
 * The list is never padded. A recipe nobody in the circle voted on is
 * absent, not present with a zero — blending in global rows to make a
 * thin list look fuller would rebuild the refused "Ontdekken" surface out
 * of spare parts.
 */
export function rankKring(
  votes: readonly RecipeRating[],
  recipeTitles: ReadonlyMap<RecipeId, string>,
): readonly KringEntry[] {
  const sortKey = (recipeId: RecipeId): string => recipeTitles.get(recipeId) ?? recipeId;

  const scored = [...summarizeRecipeRatingsByRecipe(votes).values()]
    .filter((summary) => summary.average !== null && summary.count >= KRING_MIN_VOTES)
    .map((summary) => ({
      recipeId: summary.recipeId,
      average: roundAverage(summary.average as number),
      count: summary.count,
      voterProfileIds: summary.raterProfileIds,
    }))
    .sort(
      (left, right) =>
        right.average - left.average ||
        right.count - left.count ||
        sortKey(left.recipeId).localeCompare(sortKey(right.recipeId), 'nl'),
    );

  // Competition ranking on the rounded average — two recipes showing a
  // reader the identical number are not first and second, and saying so
  // would invent a difference nobody can see. Same rule the board uses,
  // for the same reason, on a different number.
  const entries: KringEntry[] = [];
  scored.forEach((entry, index) => {
    const previous = entries[index - 1];
    const rank = previous !== undefined && previous.average === entry.average ? previous.rank : index + 1;
    entries.push({ ...entry, rank });
  });
  return entries;
}

/**
 * Cook proof, assembled: who cooked what, and what they thought of it
 * (docs/DESIGN-SOCIAL.md §1, §2.1).
 *
 * This turns the `shared_cooks` view's flat (friend, recipe) rows into
 * what every proof surface actually needs — per recipe, the friends who
 * made it and the grade they gave it. Kiezen's reason is the first
 * consumer; Bevestigen's footnote is the second.
 *
 * THE GRADE IS AVERAGED OVER THE FRIENDS BEING NAMED, not over every
 * friend who ever voted. The copy reads "Sanne en Joris hebben dit ook
 * gemaakt en gaven het gemiddeld een 8,4" — *gaven het*, they gave it. A
 * number drawn from a wider pool than the names beside it would be a
 * quiet lie inside a sentence that reads as precise, and it is the kind
 * nobody catches, because both halves look correct on their own.
 *
 * IT IS A PUBLIC VOTE, ALWAYS. The grade comes from `recipe_ratings`,
 * cast knowing it is public, and never from `cook_events.rating`, which
 * is the decision engine's private input. That split is what makes
 * printing a friend's number safe at all: a grade the proud friend can
 * see is a grade that gets inflated, and an inflated grade feeding the
 * engine corrupts every later suggestion. `shared_cooks` cannot carry the
 * private column even by accident — it is absent from the view — and this
 * module never sees a cook event.
 *
 * Pure, no I/O.
 */

import type { FriendProofContext } from '../reason';
import { summarizeRecipeRatings } from './ratings';
import type { ProfileId, RecipeId, RecipeRating } from './types';

/**
 * How many decimals a proof grade carries.
 *
 * One, matching a single vote. The board writes two because it averages
 * hundreds of votes, where the extra digit is real information; here it
 * would be noise dressed as precision.
 */
const PROOF_GRADE_DECIMALS = 1;

/** A friend, and a canonical recipe they cooked. Mirrors one row of the `shared_cooks` view (0009). */
export interface FriendCookFact {
  readonly profileId: ProfileId;
  readonly recipeId: RecipeId;
}

/**
 * Groups cook facts per recipe and attaches the names and the grade.
 *
 * A FRIEND WITH NO KNOWN NAME IS DROPPED, never rendered as a
 * placeholder. The persuasive thing about this reason is the name —
 * DESIGN-SOCIAL.md §2.1 bans a count without one, because an anonymous
 * count is a stranger-aggregate wearing a friendly tone. "Iemand heeft
 * dit gemaakt" is that same aggregate with one fewer person in it, so a
 * recipe whose every cook is unnameable produces no entry at all rather
 * than a vague one. In practice this only fires when a profile row
 * failed to load.
 *
 * NAMES ARE SORTED, and that is load-bearing rather than tidy. The view
 * returns rows in no guaranteed order, and a reason line reading "Sanne
 * en Joris" on one render and "Joris en Sanne" on the next looks like the
 * app changed its mind about something. Sorted with Dutch collation, so
 * accented names land where a Dutch reader expects them.
 */
export function assembleFriendProof(
  cooks: readonly FriendCookFact[],
  displayNamesByProfile: ReadonlyMap<ProfileId, string>,
  friendRatings: readonly RecipeRating[],
): ReadonlyMap<RecipeId, FriendProofContext> {
  const cooksByRecipe = new Map<RecipeId, Set<ProfileId>>();
  for (const cook of cooks) {
    const existing = cooksByRecipe.get(cook.recipeId);
    if (existing === undefined) {
      cooksByRecipe.set(cook.recipeId, new Set([cook.profileId]));
    } else {
      existing.add(cook.profileId);
    }
  }

  const proof = new Map<RecipeId, FriendProofContext>();
  for (const [recipeId, profileIds] of cooksByRecipe) {
    const friendNames = [...profileIds]
      .map((profileId) => displayNamesByProfile.get(profileId))
      .filter((name): name is string => name !== undefined && name.trim().length > 0)
      .sort((left, right) => left.localeCompare(right, 'nl'));

    if (friendNames.length === 0) {
      continue;
    }

    proof.set(recipeId, { friendNames, grade: gradeFromCooks(recipeId, profileIds, friendRatings) });
  }
  return proof;
}

/**
 * The average of the votes cast by the friends who cooked it — nobody
 * else's.
 *
 * Filtered first and summarised second, rather than summarising
 * everything and subtracting: `summarizeRecipeRatings` owns deduplication
 * (one vote per rater, latest wins) and validity (an off-scale row is
 * dropped, never repaired), and running it over exactly the rows that
 * count is the only way to get those rules applied to the right subset.
 * A summary of the whole recipe cannot be narrowed afterwards, because it
 * reports an average and not the individual votes behind it.
 *
 * Null when none of them voted publicly, which is the common case and
 * reads perfectly well without a number ("Sanne heeft dit ook gemaakt.").
 * A recipe rated by other friends who did NOT cook it still returns null
 * here, deliberately: those people are not named in the sentence, so
 * their opinion has no business being the number in it.
 */
function gradeFromCooks(
  recipeId: RecipeId,
  cookProfileIds: ReadonlySet<ProfileId>,
  friendRatings: readonly RecipeRating[],
): number | null {
  const fromTheCooks = friendRatings.filter(
    (rating) => rating.recipeId === recipeId && cookProfileIds.has(rating.raterProfileId),
  );
  const summary = summarizeRecipeRatings(recipeId, fromTheCooks);
  return summary.average === null ? null : Number(summary.average.toFixed(PROOF_GRADE_DECIMALS));
}

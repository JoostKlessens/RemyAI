/**
 * A cook becomes a public vote — the second half of the outcome moment
 * (PD-014, PD-019, DESIGN-SOCIAL.md §1).
 *
 * WHY THIS MODULE EXISTS, AND IT IS NOT THE REASON ANYBODY ASSUMED.
 * `recipe_ratings` has had a table since 0007, a scale since 0008, two
 * repository backends, an aggregate (./ratings.ts), a global board
 * (./leaderboard.ts) and a friend-scoped list (./kring.ts) — and
 * `rateRecipe` had ZERO production callers. Ranglijst was empty because
 * nothing in the app had ever written a row into it, not because a policy
 * withheld one. This module is the missing writer.
 *
 * ONE GESTURE, TWO INSTRUMENTS, AND THEY STAY TWO (PD-019). The grade the
 * cook gives on `OutcomeCard` still writes `cook_events.rating` — the
 * household's private engine input, which never crosses a household
 * boundary — and now ALSO writes one `recipe_ratings` row, the public vote
 * the whole social layer already reads. Nothing here reads the private
 * column and nothing here derives one number from the other: the caller
 * hands the same value to two independent writes, which is what keeps the
 * two instruments structurally apart rather than apart by convention.
 *
 * The owner's instruction that reversed the old rule, verbatim: "the
 * rating should also be represented in the global ranking of a recipe."
 *
 * ============================================================================
 * THE TWO SCALES ARE THE SAME SCALE — CHECKED, NOT ASSUMED
 * ============================================================================
 *
 * It would be entirely reasonable for these two columns to disagree, and a
 * silent conversion between them is the kind of bug that reads as correct
 * forever. They do not disagree: 0008 writes the identical constraint
 * twice, once per table —
 *
 *     check (rating >= 1 and rating <= 10 and rating = round(rating, 1))
 *
 * — on `cook_events.rating` and on `recipe_ratings.rating`, both
 * `numeric(4,2)`. So a grade crosses unconverted, and the only validation
 * this module does is `isValidRating` from ../rating.ts, the one function
 * that owns the scale for both. If the two ever diverge, the fix is a
 * conversion HERE with the divergence named, never a rounding rule invented
 * at a call site.
 *
 * ============================================================================
 * WHY IT REFUSES RATHER THAN REPAIRS
 * ============================================================================
 *
 * An off-scale or over-precise grade is skipped, not rounded into range.
 * That is the stance the whole codebase already takes on this exact value:
 * `rateRecipe` in both backends rejects rather than clamps, ./ratings.ts
 * drops an off-scale stored row rather than repairing it, and 0008 chose
 * `numeric(4,2)` over `numeric(3,1)` specifically so that a 7,55 is a loud
 * constraint violation instead of a quiet 7,6. Snapping a grade to the
 * nearest legal one would put an opinion in a person's mouth and then
 * publish it under their name.
 *
 * Checking it here as well as at the repository is not a second copy of the
 * rule — it is the same `isValidRating`, called earlier — and it buys the
 * distinction the caller actually needs: "we chose not to vote" is a
 * different outcome from "the write failed", and a caller that could not
 * tell them apart would have to treat a hand-typed dish as an error.
 *
 * ============================================================================
 * WHAT `castPublicVote` DELIBERATELY DOES NOT DO
 * ============================================================================
 *
 * IT NEVER THROWS. Every caller sits immediately beside the private write,
 * and the two are not equally important: the private grade is what the
 * decision engine runs on and the reason the household opened the app,
 * while the public vote decorates a leaderboard. A rejection propagating
 * out of here would make the cook's own moment fail over somebody else's
 * ranking. So a failure is REPORTED — `'failed'`, a value the caller has to
 * receive and can log, announce or ignore on the record — rather than
 * swallowed inside an empty `.catch`. Same shape, and the same argument, as
 * `sendRecipeToFriend` in src/lib/sendRecipe.ts.
 *
 * IT NEVER READS BACK. `rateRecipe` upserts on (recipe, rater) and returns
 * the row it wrote, so a re-read would answer no question — and a second
 * vote on the same recipe replaces the first rather than adding one, which
 * is the `unique (recipe_id, rater_profile_id)` constraint doing its job.
 * Changing your mind about a dish you cooked twice is one opinion, not two.
 *
 * IT DOES NOT CONSULT THE PER-DISH EXCLUSION, AND THAT IS A DECISION WITH A
 * KNOWN COST. `meals.excluded_from_cook_proof` ("Deel deze niet") silences
 * cook proof for one meal; PD-015 and §5 both state in as many words that
 * the exclusion "governs cook proof, never public votes", because a
 * `recipe_ratings` vote is world-readable by design and is withdrawn by
 * deleting the vote, a different instrument. The board is an anonymous
 * average and a number in it names nobody. De kring (./kring.ts) DOES name
 * voters, and it cannot be narrowed here even if we wanted to: a vote row
 * carries (recipe, rater) and no link whatsoever to the meal that produced
 * it, so there is nothing to join an exclusion to. Recorded rather than
 * quietly worked around — inventing that link is a schema decision, not a
 * module decision.
 *
 * The planner is pure. `castPublicVote` performs no I/O of its own: it
 * calls one injected write and reports, which is what makes both halves
 * testable without a database.
 */

import { isValidRating } from '../rating';
import type { ProfileId, RecipeId } from './types';
import type { RateRecipeInput, RemySocialRepository } from '../../lib/repository/social/types';

/**
 * Everything the decision needs, in the shape a screen actually holds it.
 *
 * `recipeId` is `RecipeId | null | undefined` rather than a plain id
 * because that is exactly what `Meal.recipeId` is (src/domain/types.ts):
 * null for the seeded, curated and hand-entered majority, and absent
 * altogether on meal rows written before 0006 added the column. Making the
 * caller normalise three spellings of "no canonical recipe" before it may
 * ask this question is how one of the three gets normalised wrong.
 *
 * `raterProfileId` is nullable for a different reason: `useSession` reports
 * `null` while the session is still resolving, and PD-012 means a signed-out
 * user never reaches a cook screen at all. So null here means "not yet",
 * not "signed out", and the honest response to "not yet" is to write
 * nothing rather than to write a vote with no author.
 */
export interface PublicVoteRequest {
  /** The canonical `recipes` row (0006) this meal was copied from, or null/absent when there is none. */
  readonly recipeId: RecipeId | null | undefined;
  /** `profiles.id`, which IS `auth.users.id`. Null while the session is still resolving. */
  readonly raterProfileId: ProfileId | null;
  /** The grade as given, on src/domain/rating.ts's scale. Never pre-rounded by the caller. */
  readonly rating: number;
}

/**
 * Why no vote was cast. All three are ordinary, and none is an error the
 * user should ever be told about.
 *
 * `no-canonical-recipe` is by far the most common: most meals in this
 * product are seeded, curated or typed in by hand, and they exist in
 * exactly one household. There is no shared object for a vote to be about,
 * which is the same reason `shared_cooks` (0009) filters on
 * `m.recipe_id is not null`.
 */
export type PublicVoteSkipReason = 'no-canonical-recipe' | 'no-profile' | 'off-scale';

export type PublicVotePlan =
  | { readonly kind: 'vote'; readonly input: RateRecipeInput }
  | { readonly kind: 'skip'; readonly reason: PublicVoteSkipReason };

/**
 * Whether this cook produces a public vote, and what it says.
 *
 * THE ORDER OF THE THREE CHECKS IS THE MESSAGE. "No canonical recipe" is
 * asked first because it is the common, blameless case — a hand-entered
 * dish — and reporting a missing session or an odd grade ahead of it would
 * dress the ordinary path as a fault for anybody reading the outcome. The
 * scale is checked last, because it is the only one of the three that would
 * indicate a bug rather than a shape of data this product ships by design.
 *
 * An empty-string recipe id counts as absent. It is not a shape any writer
 * in this codebase produces, but `RecipeId` is a bare `string` alias (see
 * ./types.ts on why no id alias assumes a uuid), so `''` is expressible —
 * and a foreign key insert of `''` fails at the database as an opaque
 * error rather than here as a stated skip.
 */
export function planPublicVote(request: PublicVoteRequest): PublicVotePlan {
  const { recipeId, raterProfileId, rating } = request;
  if (recipeId === null || recipeId === undefined || recipeId === '') {
    return { kind: 'skip', reason: 'no-canonical-recipe' };
  }
  if (raterProfileId === null) {
    return { kind: 'skip', reason: 'no-profile' };
  }
  if (!isValidRating(rating)) {
    return { kind: 'skip', reason: 'off-scale' };
  }
  return { kind: 'vote', input: { recipeId, raterProfileId, rating } };
}

/**
 * The one write this path may perform, narrowed to a single method.
 *
 * A `Pick` rather than the whole repository, matching `SendRecipeSink` and
 * `FriendProofSource`: from here it is not possible to read a friendship,
 * list somebody's sends, or reach `removeRecipeRating` — so "casting a vote
 * cannot become anything else" is structural rather than observed. The real
 * repository satisfies it without knowing about it; a test fake is one
 * function rather than seventeen.
 */
export type PublicVoteSink = Pick<RemySocialRepository, 'rateRecipe'>;

/** `cast` — one row written. `skipped` — nothing to vote on, and no error. `failed` — the write was refused or unreachable. */
export type PublicVoteOutcome = 'cast' | 'skipped' | 'failed';

/**
 * Casts the vote, or reports precisely why it did not.
 *
 * NEVER REJECTS, WHATEVER IT IS HANDED. See the file header: this always
 * runs beside the private `cook_events.rating` write, and a public vote is
 * not worth failing a cook over. The failure is returned rather than
 * swallowed, so the call site has to receive it — which is the difference
 * between handling an error quietly and dropping it.
 */
export async function castPublicVote(sink: PublicVoteSink, request: PublicVoteRequest): Promise<PublicVoteOutcome> {
  const plan = planPublicVote(request);
  if (plan.kind === 'skip') {
    return 'skipped';
  }
  try {
    await sink.rateRecipe(plan.input);
    return 'cast';
  } catch {
    return 'failed';
  }
}

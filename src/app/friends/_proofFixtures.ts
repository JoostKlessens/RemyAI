/**
 * The ambient cook-proof half of the `__DEV__` scenarios — the OTHER card
 * kind Gekookt holds (PD-015, docs/DESIGN.md §8).
 *
 * CARVED OUT OF `_fixtures.ts`, VERBATIM, when that file passed the
 * 800-line ceiling. It stayed a sibling rather than being folded into
 * `_gekooktSource.ts` because it is DATA, not a read, and because it
 * derives every value from `_fixtures.ts` — one demo describes one circle,
 * and the pesto must not end up called one thing in Gekookt and another in
 * Kring.
 *
 * The dependency runs one way only: this file imports from `_fixtures.ts`
 * and `_fixtures.ts` knows nothing about it, so there is no cycle to
 * reason about. `_gekooktSource.ts` imports `getProofFixture` from here
 * directly for the same reason — a re-export through `_fixtures.ts` would
 * create one.
 */

import {
  FIXTURE_INGREDIENTS,
  FIXTURE_KRING_VOTES,
  FIXTURE_MEALS,
  FIXTURE_VOTER_NAMES,
  type FriendFeedScenario,
} from './_fixtures';
import type { FriendProofFeedRequest, ProofRecipe } from '@/components/friendProofPresentation';
import type { CreatorPlatform } from '@/domain/feed/types';
import type { FriendCookFact } from '@/domain/social/proof';
import type { RecipeId } from '@/domain/social/types';
import type { MealId } from '@/domain/types';

// ---------------------------------------------------------------------------
// Ambient cook proof — the OTHER card kind Gekookt holds (PD-015)
// ---------------------------------------------------------------------------

/**
 * A canonical recipe as a PROOF card renders it, derived from the meal of
 * the same dish — `makeKringRecipe`'s sibling, and derived for the same
 * reason: three views of one circle must not disagree about what the pesto
 * is called.
 *
 * `estimatedMinutes` and `ingredients` DO come from the meal here, where
 * `CanonicalRecipeSummary` carries neither in production. That is a
 * fixture affording the design work a real `recipes` row would also
 * afford — 0006's `recipes` and `recipe_ingredients` hold both columns;
 * it is the list-shaped repository read that trims them, not the schema.
 * See the Vrienden screen's header for what live proof therefore renders
 * without.
 */
function makeProofRecipe(
  recipeId: RecipeId,
  mealId: MealId,
  creatorHandle: string,
  creatorPlatform: CreatorPlatform,
): ProofRecipe {
  const meal = FIXTURE_MEALS.find((candidate) => candidate.id === mealId);
  if (meal === undefined) {
    throw new Error(`Proof fixture references an unknown meal: ${mealId}`);
  }
  return {
    recipeId,
    title: meal.title,
    creatorHandle,
    creatorPlatform,
    thumbnailUrl: meal.thumbnailUrl,
    estimatedMinutes: meal.estimatedMinutes,
    ingredients: FIXTURE_INGREDIENTS.get(mealId) ?? [],
  };
}

const FIXTURE_PROOF_RECIPES: readonly ProofRecipe[] = [
  makeProofRecipe('recipe-friend-traybake', 'meal-friend-traybake', 'kokenmetkees', 'tiktok'),
  makeProofRecipe('recipe-friend-ramen', 'meal-friend-ramen', 'kokenmetkees', 'tiktok'),
];

/**
 * Who cooked what — `shared_cooks` rows, verbatim in shape.
 *
 * TWO COOKS ON ONE DISH AND ONE ON ANOTHER, so the demo shows both
 * eyebrows the card can produce: "Sanne en Joris maakten dit" and "Sanne
 * maakte dit". Dutch agreement is the thing most likely to be got wrong
 * in a rewrite and the thing least likely to be noticed in a screenshot
 * of a single card.
 *
 * NO TIMESTAMP, because the view carries none: proof is "Sanne maakte
 * dit", never "gisteren". And no rating — `cook_events.rating` is the
 * decision engine's private input and never crosses a household boundary,
 * so the grade a proof card shows comes from the PUBLIC votes in
 * `FIXTURE_KRING_VOTES` instead, which is exactly the join the real
 * `assembleFriendProof` performs.
 */
const FIXTURE_COOKS: readonly FriendCookFact[] = [
  { profileId: 'profile-sanne', recipeId: 'recipe-friend-traybake' },
  { profileId: 'profile-joris', recipeId: 'recipe-friend-traybake' },
  { profileId: 'profile-sanne', recipeId: 'recipe-friend-ramen' },
];

/**
 * PD-020.2's closed loop: the one cook that happened because THIS
 * household sent the dish over.
 *
 * One, and only on the dish two people cooked — which is the interesting
 * case rather than the tidy one. `assembleFriendProofCards` runs the
 * grouping twice and lets the dressed pass win, so this card reads "Sanne
 * maakte jouw recept" and NOT "Sanne en Joris maakten jouw recept": Joris
 * found the dish himself and crediting your send with his dinner would be
 * false. Under-naming on a dress that is read once is the cheaper error,
 * and a fixture is where that behaviour should be visible.
 */
const FIXTURE_CLOSED_LOOP_COOKS: readonly FriendCookFact[] = [
  { profileId: 'profile-sanne', recipeId: 'recipe-friend-traybake' },
];

/**
 * The proof half of one scenario — the ambient tier, beside the directed
 * sends `getFriendFeedFixture` produces.
 *
 * `collidingTagsByRecipeId` IS ALWAYS EMPTY, and that is PD-006 rather
 * than an omission. A canonical `recipes` row carries no allergen tags —
 * tagging is something a household does to its own copy on Bevestigen —
 * so no collision chip can appear on a proof card, in the fixture or in
 * production. Its absence says nothing whatsoever about the dish and must
 * never be styled or read as reassurance. Note the deliberate asymmetry
 * with the send half, where the chip DOES fire: a send hands you the
 * sender's own meal, tags included.
 *
 * `leeg` yields no cooks, so the empty state stays reachable with both
 * card kinds wired.
 */
export function getProofFixture(scenario: FriendFeedScenario): FriendProofFeedRequest {
  return {
    cooks: scenario === 'leeg' ? [] : FIXTURE_COOKS,
    closedLoopCooks: scenario === 'leeg' ? [] : FIXTURE_CLOSED_LOOP_COOKS,
    displayNamesByProfile: FIXTURE_VOTER_NAMES,
    friendRatings: FIXTURE_KRING_VOTES,
    recipes: FIXTURE_PROOF_RECIPES,
    collidingTagsByRecipeId: new Map(),
  };
}

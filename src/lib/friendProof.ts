/**
 * Cook proof, fetched: the impure shell around `assembleFriendProof`
 * (docs/DESIGN-SOCIAL.md §2.1).
 *
 * This module performs reads and nothing else. Every judgement about what
 * the rows mean — who may be named, whose votes make the number, which
 * recipes survive with no nameable cook — lives in the pure, tested
 * `assembleFriendProof` (src/domain/social/proof.ts). Same split as
 * `importRecipe.ts` beside it: a shell that fetches, a domain module that
 * decides.
 *
 * WHY IT IS NOT INSIDE THE SCREENS THAT CALL IT. Two reasons, and the
 * second is the load-bearing one. (tabs)/index.tsx was already near this
 * repo's file-size ceiling. More importantly, a route module cannot be
 * imported in the test environment at all — it drags expo-router and
 * react-native internals through Vite and fails to parse — so a
 * fetch-and-assemble step written inside it is a step nothing can assert
 * on. The wiring performed here is exactly the wiring that was missing for
 * three migrations while FRIEND_PROOF_BOOST sat unreachable behind a
 * defaulted parameter and its own weight tests stayed green; putting it
 * somewhere untestable is how that happens a second time. It happened a
 * second time regardless — import/confirm.tsx grew its own private copy
 * of these three reads — which is the whole reason the entry point below
 * is now split in two.
 *
 * TWO ENTRY POINTS, ONE READ PATH, AND WHY THE SPLIT IS ON THE KEY RATHER
 * THAN ON THE SURFACE. `loadFriendProofForRecipes` is the real one and it
 * is keyed on canonical recipe ids, which is what proof is actually about:
 * `assembleFriendProof` already returns a map keyed that way, and
 * `shared_cooks` (0009) joins on nothing else. `loadFriendProof` is a thin
 * narrowing wrapper for callers holding a household's `Meal[]` — Kiezen,
 * whose candidate set IS the library.
 *
 * Bevestigen is why the recipe-id-keyed one has to exist rather than being
 * an ergonomic extra. It is the single surface where the meal does not
 * exist yet: the whole question on that screen is whether to create it.
 * Satisfying a `Meal[]` signature there would mean fabricating a `Meal` to
 * carry one field — a fake domain object built to please a parameter,
 * which is worse than the duplication it removes. The rejected alternative
 * was widening the shared parameter to
 * `readonly (Meal | { readonly recipeId: RecipeId })[]`; a union that
 * exists so one caller can pass half an object is the same fabrication
 * with extra steps, and it hides the narrowing rule in a signature where
 * no test can reach it.
 *
 * IT WILL RETURN AN EMPTY MAP FOR A WHILE, AND THAT IS THE EXPECTED STATE.
 * Three things must land before a sentence can appear, none of them here:
 * there is no auth yet, so `shared_cooks` (0009) — which gates itself on
 * `auth.uid()` and `is_friend_of` inside the view body — has nobody to
 * answer for; this household's cook events live on the device and never
 * reach `cook_events`, so nothing of ours becomes anybody else's proof
 * either; and a meal joins a friend's cook only through `Meal.recipeId`,
 * which only the import path populates. What this buys is that when they
 * land, the Kiezen reason appears without anyone editing a screen.
 */

import type { FriendProofContext } from '@/domain/reason';
import { assembleFriendProof } from '@/domain/social/proof';
import type { Profile, ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';
import type { Meal } from '@/domain/types';
import type { RemySocialRepository } from './repository/social/types';

/**
 * The three reads cook proof is allowed to make, and no others.
 *
 * A `Pick` rather than the whole repository, deliberately. Proof is
 * ambient and unaddressed — it falls out of cooking nobody performed for
 * an audience — and the send tier next door is its opposite on every axis.
 * Narrowing the parameter is what stops a later edit here from quietly
 * reaching for `listSendsToMe` or `markSendsSeen` and turning a decoration
 * on the decision screen into something that mutates a reader's state. The
 * real repository satisfies this structurally; a test fake is three
 * functions rather than seventeen.
 */
export type FriendProofSource = Pick<
  RemySocialRepository,
  'listFriendCookedRecipes' | 'getProfile' | 'listRecipeRatings'
>;

/**
 * Per canonical recipe, the friends who cooked it and the grade they
 * publicly gave it — the map `decide()` takes as `friendProof`, and the
 * map Bevestigen looks a single entry up in.
 *
 * NARROWED BEFORE ANYTHING ELSE IS FETCHED, AND THE CALLER OWNS THE
 * NARROWING. Only a recipe the caller named can appear in the answer, so
 * the profile and rating reads are bounded by that set rather than by how
 * much the circle cooks. Kiezen names its whole library; Bevestigen names
 * the one recipe being imported, which is why that screen pays two reads
 * and not the library's worth. An empty set costs zero queries — for
 * Kiezen that is a household with no imported meals at all, which is
 * today's normal.
 *
 * FAILURE IS SILENCE, AND THAT IS A DECISION RATHER THAN A SWALLOWED
 * ERROR. Every read can fail honestly: no session, no network, 0009 not
 * yet applied. None of those is a reason to tell somebody there is no
 * dinner. Proof decorates a suggestion; it never produces one, so an empty
 * map degrades Kiezen to exactly its pre-social behaviour — a true,
 * complete answer — where propagating the error would blank the hero over
 * a friend's grade. The rejected alternative is rethrowing and letting the
 * screen decide: the screen's only vocabulary for a failed load is "Kon
 * geen suggestie ophalen", which would be a false statement about a
 * suggestion it can still make perfectly well. Bevestigen wants the same
 * silence for a reason of its own — §2.3: an empty answer there would
 * read as a verdict on the recipe, which is not a thing we know — so the
 * two surfaces share the degradation as well as the reads.
 */
export async function loadFriendProofForRecipes(
  social: FriendProofSource,
  recipeIds: Iterable<RecipeId>,
): Promise<ReadonlyMap<RecipeId, FriendProofContext>> {
  const wanted = new Set(recipeIds);
  if (wanted.size === 0) {
    return new Map();
  }

  try {
    const cooks = (await social.listFriendCookedRecipes()).filter((cook) => wanted.has(cook.recipeId));
    if (cooks.length === 0) {
      return new Map();
    }

    const [displayNamesByProfile, ratings] = await Promise.all([
      resolveDisplayNames(
        social,
        cooks.map((cook) => cook.profileId),
      ),
      listRatingsForCookedRecipes(
        social,
        cooks.map((cook) => cook.recipeId),
      ),
    ]);
    return assembleFriendProof(cooks, displayNamesByProfile, ratings);
  } catch {
    return new Map();
  }
}

/**
 * The same read, for a caller holding meals rather than recipe ids —
 * Kiezen, whose candidate set IS this household's library.
 *
 * A MEAL WITH NO `recipeId` IS DROPPED, NOT DEFAULTED. Proof is keyed on
 * the canonical `recipes` row, so a meal that predates W-01b (or came out
 * of a failed canonical write) is a copy of nothing: there is no id a
 * friend's cook could ever be joined to it on. Dropping it here is what
 * makes a library of such meals cost zero queries rather than one wasted
 * `shared_cooks` read per Kiezen.
 */
export async function loadFriendProof(
  social: FriendProofSource,
  candidateMeals: readonly Meal[],
): Promise<ReadonlyMap<RecipeId, FriendProofContext>> {
  return loadFriendProofForRecipes(
    social,
    candidateMeals
      .map((meal) => meal.recipeId ?? null)
      .filter((recipeId): recipeId is RecipeId => recipeId !== null),
  );
}

/**
 * The names the reason line will print, one profile at a time.
 *
 * A PROFILE THAT DOES NOT RESOLVE IS SIMPLY ABSENT, never a placeholder.
 * `assembleFriendProof` drops an unnameable cook, and drops the recipe
 * entirely when every cook of it is unnameable, because §2.1 bans a count
 * without a name — an anonymous count is a stranger-aggregate wearing a
 * friendly tone. So a missing profile costs that friend's mention and, at
 * worst, the whole sentence; it never becomes "Iemand uit je kring heeft
 * dit ook gemaakt." on a real screen. Deduplicated first: one friend who
 * cooked four of your recipes is one lookup.
 */
async function resolveDisplayNames(
  social: FriendProofSource,
  profileIds: readonly ProfileId[],
): Promise<ReadonlyMap<ProfileId, string>> {
  const profiles = await Promise.all([...new Set(profileIds)].map((id) => social.getProfile(id)));
  return new Map(
    profiles
      .filter((profile): profile is Profile => profile !== null)
      .map((profile) => [profile.id, profile.displayName]),
  );
}

/**
 * The public votes on the recipes friends cooked — `recipe_ratings`, and
 * never `cook_events.rating`. That split is what makes printing a friend's
 * number safe at all (DESIGN-SOCIAL.md §6.5), and here it is structural
 * rather than observed: this module has no path to a private grade, and
 * `shared_cooks` does not carry the column.
 *
 * WHOLE RECIPES ARE FETCHED, STRANGERS' VOTES INCLUDED, AND THAT IS SAFE.
 * `assembleFriendProof` averages only the votes cast by the friends it is
 * about to name — a number drawn from a wider pool than the names beside
 * it would be a quiet lie inside a sentence that reads as precise, and
 * proof.ts owns that rule. Filtering here as well would be a second copy
 * of it, in the file least likely to be updated when it changes.
 */
async function listRatingsForCookedRecipes(
  social: FriendProofSource,
  recipeIds: readonly RecipeId[],
): Promise<readonly RecipeRating[]> {
  const perRecipe = await Promise.all(
    [...new Set(recipeIds)].map((recipeId) => social.listRecipeRatings(recipeId)),
  );
  return perRecipe.flat();
}

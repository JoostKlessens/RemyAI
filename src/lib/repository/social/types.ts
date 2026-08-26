/**
 * `RemySocialRepository` — a SECOND persistence seam, deliberately not
 * extra methods on `RemyRepository`.
 *
 * WHY IT IS SEPARATE. Every method on `RemyRepository` (../types.ts) is
 * scoped by `householdId`, because everything it touches is: a meal, a
 * save, a decision and a cook event each belong to exactly one household,
 * and RLS enforces that with `is_household_member`. Nothing here does. A
 * profile exists outside any household, a friendship joins two people who
 * are usually in different ones, and a recipe rating is explicitly
 * cross-household — it is the one number that counts every household's
 * copy of a recipe at once. Folding these in would mean either a
 * `householdId` parameter that is ignored (a lie in the signature) or two
 * conventions inside one interface. Two interfaces cost one import; a
 * muddled one costs every future reader.
 *
 * NOT WIRED IN. This is deliberately absent from ../index.ts, the barrel
 * screens import. Fase 5a is the data foundation only: there is no auth
 * yet, so there is no `auth.uid()` for any of this to be about, and a seam
 * exported before it can be used correctly is a seam somebody uses
 * incorrectly. The barrel export belongs in the same step as the auth
 * wiring.
 *
 * WHAT THE IMPLEMENTATION OWES. A local store has no constraints to lean
 * on, so it has to keep the schema's promises itself: a unique handle, one
 * row per unordered pair of profiles, one rating per (recipe, rater), and
 * no illegal friendship transition. Those rules live in
 * src/domain/social/** and are called from the implementation — never
 * re-derived inside it, so the Supabase implementation that eventually
 * replaces it calls the identical functions.
 */

import type { CreatorPlatform } from '@/domain/feed/types';
import type { Friendship, FriendshipAction, Profile, ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';

export interface UpsertProfileInput {
  /** Equal to `auth.users.id`. Supplied by the caller, never generated here — a profile is an existing account's public face, not a new row's identity. */
  readonly id: ProfileId;
  /** Raw as typed; the implementation normalizes it through `parseHandle` and rejects what cannot be stored. */
  readonly handle: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
}

export interface RateRecipeInput {
  /** The canonical `recipes` row (0006), never a household's `meals` row — see `RecipeRating` for why that distinction is the whole point. */
  readonly recipeId: RecipeId;
  readonly raterProfileId: ProfileId;
  /** On src/domain/rating.ts's scale. An off-scale score is rejected, never clamped. */
  readonly rating: number;
}

/**
 * A canonical `recipes` row (0006), reduced to what a list screen renders.
 *
 * Deliberately not the whole recipe: the global board shows a name, a face
 * and a grade, and dragging ingredients and steps into a list query would
 * make every row carry a recipe nobody asked to read.
 *
 * NOTE WHAT IS ABSENT: allergen tags. A canonical recipe has none, and that
 * is PD-006 rather than an oversight — tagging is something a household
 * does to its own copy on Bevestigen, and an untagged recipe is UNKNOWN,
 * never "safe". Consequence for the board: it cannot show a PD-007a
 * collision chip against canonical data, and the absence of a chip there
 * must never be styled or read as reassurance.
 */
export interface CanonicalRecipeSummary {
  readonly recipeId: RecipeId;
  readonly title: string;
  readonly platform: CreatorPlatform;
  /** `recipes.author_name` — the creator's handle as the platform reported it. Null when oEmbed gave none. */
  readonly authorName: string | null;
  readonly thumbnailUrl: string | null;
}

/**
 * The ceiling on a whole-table rating read, above which the board stops
 * being able to tell the truth.
 *
 * The aggregate is client-side on purpose (src/domain/social/leaderboard.ts
 * explains why), which for one recipe means a handful of rows. A GLOBAL
 * board means every rating row in the database. That is fine at launch
 * scale and not fine indefinitely.
 *
 * When this is exceeded the implementation THROWS rather than returning
 * what it managed to fetch. A partial read would silently rank a subset
 * while presenting itself as the world — the precise failure leaderboard.ts
 * warns about — and a loud error naming the fix is worth far more than a
 * board that is quietly wrong. The fix is a SQL aggregate returning
 * per-recipe (count, avg), which the table's own unique and CHECK
 * constraints make provably identical to what `summarizeRecipeRatingsByRecipe`
 * computes, with `rankRecipes` still owning the prior, shrinkage and floor.
 */
export const BOARD_RATING_ROW_CEILING = 50_000;

export interface RemySocialRepository {
  getProfile(profileId: ProfileId): Promise<Profile | null>;
  /** Handle lookup is how one person finds another, so it takes whatever was typed and normalizes before matching. */
  findProfileByHandle(rawHandle: string): Promise<Profile | null>;
  /** Create-or-update by `id`. Rejects an unstorable handle, and one already held by a different profile. */
  upsertProfile(input: UpsertProfileInput): Promise<Profile>;

  /** Every row this profile is a party to, whatever its status — pending requests in both directions included. */
  listFriendships(profileId: ProfileId): Promise<readonly Friendship[]>;
  /** The single row for an unordered pair, direction-independent, or null. */
  getFriendshipBetween(profileA: ProfileId, profileB: ProfileId): Promise<Friendship | null>;
  /**
   * The one write path for a friendship. Runs the action through
   * `applyFriendshipAction` (src/domain/social/friendship.ts) and rejects
   * an illegal move rather than silently doing nothing — a UI that offered
   * a button it should not have needs to hear about it.
   */
  actOnFriendship(actorProfileId: ProfileId, otherProfileId: ProfileId, action: FriendshipAction): Promise<Friendship>;
  /**
   * Unfriend, withdraw your own request, or unblock: all the same delete,
   * because no status usefully records "we used to be friends" and any
   * lingering row blocks the pair from ever being re-requested. A blocked
   * row may only be removed by the party that blocked — otherwise the
   * blocked person deletes their own block and walks straight back in.
   * Removing a pair that has no row is a no-op.
   */
  removeFriendship(actorProfileId: ProfileId, otherProfileId: ProfileId): Promise<void>;

  /** Every rating for one canonical recipe, from every household — what src/domain/social/ratings.ts aggregates. */
  listRecipeRatings(recipeId: RecipeId): Promise<readonly RecipeRating[]>;
  /** Upsert by (recipe, rater): changing your mind replaces your vote, it never adds a second one. */
  rateRecipe(input: RateRecipeInput): Promise<RecipeRating>;
  /** Withdrawing a vote is a real delete — an unrated recipe and a withdrawn rating must be indistinguishable. */
  removeRecipeRating(recipeId: RecipeId, raterProfileId: ProfileId): Promise<void>;

  /**
   * Every rating in the system, for the global board (PD-014).
   *
   * Unbounded by nature — a board that ranks the world has to see the
   * world — so the implementation reads to BOARD_RATING_ROW_CEILING and
   * throws beyond it rather than returning a subset it would then rank as
   * though it were everything.
   */
  listAllRecipeRatings(): Promise<readonly RecipeRating[]>;

  /**
   * Display data for canonical recipes, by id. Ids not found are simply
   * absent from the result rather than an error: a rating can outlive the
   * recipe it points at only if something has gone wrong upstream, and the
   * board's job in that case is to drop the row, not to fail the screen.
   */
  listCanonicalRecipes(recipeIds: readonly RecipeId[]): Promise<readonly CanonicalRecipeSummary[]>;
}

/**
 * Social domain types (Fase 5a — profiles, friendships, recipe ratings,
 * and PD-010's `meals.visibility`).
 *
 * Deliberately a separate file from src/domain/types.ts rather than an
 * addition to it, for the same reason src/domain/feed/types.ts is: that
 * file is the frozen contract every other consumer of the domain layer
 * builds against, and neither the decision engine nor the Vanavond screens
 * have any dependency on the social vocabulary. Field names mirror the
 * snake_case columns of supabase/migrations/0007_social.sql 1:1 in
 * camelCase, following the same convention as both of those files.
 *
 * Every field is `readonly`; nothing here is ever mutated in place.
 *
 * ---
 *
 * WHY A PROFILE EXISTS AT ALL, GIVEN household_members ALREADY HAS A NAME.
 * `household_members.display_name` (0001_init.sql) is household-scoped and
 * cannot serve as an identity: it exists per household, it can be written
 * by any member of that household, and a row can exist with no
 * `auth_user_id` at all (onboarding lets you name a partner or child who
 * has never signed up). A friendship is between two *people*, has to be
 * addressable from outside any household, and must survive its owner
 * leaving or joining one. That is a different thing, so it is a different
 * table and a different type.
 *
 * ---
 *
 * WHY `MealVisibility` LIVES HERE AND NOT ON `Meal`. PD-010's column is
 * `meals.visibility`, so the obvious move is a `visibility` field on
 * `Meal` in src/domain/types.ts. It is deliberately not done yet: `Meal`
 * is constructed in seed data, in the local repository, in screens and in
 * a dozen test fixtures, and a required new field is an edit to every one
 * of those — including files this phase must not touch. The column
 * defaults to 'private' in SQL and `resolveMealVisibility` (visibility.ts)
 * reads a missing value as 'private', so nothing is lost by waiting: the
 * field joins `Meal` in the step that actually renders or writes it.
 */

import type { IsoDateTimeString, MealId } from '../types';

/**
 * A person, not a household member. Equal to `auth.users.id` by
 * construction — `profiles.id` is both the primary key and the foreign key
 * to the auth table, so there is never a second id to map between.
 */
export type ProfileId = string;

export type FriendshipId = string;

/**
 * A canonical recipe (supabase/migrations/0006_canonical_recipes.sql), NOT
 * a household's own `meals` row. Ratings key on this — see RecipeRating.
 */
export type RecipeId = string;

export type RecipeRatingId = string;

/**
 * An identity that exists outside any household: how a friend finds you,
 * and what a shared recipe is attributed to.
 *
 * `handle` is stored already normalized (lowercase, no leading '@') — see
 * handle.ts, which owns that rule and mirrors the CHECK constraint in
 * 0007_social.sql. Uniqueness on a handle is only meaningful if the stored
 * form is canonical: a case-sensitive unique index would happily hold both
 * "joost" and "Joost", which is an impersonation vector, not a feature.
 */
export interface Profile {
  readonly id: ProfileId;
  readonly handle: string;
  readonly displayName: string;
  /** Remote URL, never a re-hosted copy — same discipline as `meals.thumbnail_url` (0003). Null is a normal state; the UI falls back to a monogram. */
  readonly avatarUrl: string | null;
  readonly createdAt: IsoDateTimeString;
}

/**
 * The lifecycle of one relationship between two profiles. `declined` is
 * deliberately not terminal (a pair can be re-requested) and `blocked`
 * deliberately is — see friendship.ts's transition table for the full
 * argument and for who may perform which move.
 */
export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

/** Which side of a friendship row a given profile sits on. */
export type FriendshipRole = 'requester' | 'addressee';

/** What someone can do to a friendship. Removing one is a DELETE, not an action here — see friendship.ts. */
export type FriendshipAction = 'request' | 'accept' | 'decline' | 'block';

/**
 * One row per unordered pair of profiles, ever. The database enforces that
 * with a unique constraint on the *ordered* pair (least/greatest of the
 * two ids), so A→B and B→A cannot both exist; `friendshipPairKey` in
 * friendship.ts computes the same key on this side.
 */
export interface Friendship {
  readonly id: FriendshipId;
  /** Who asked. Immutable once the row exists — a trigger in 0007_social.sql enforces that, because swapping the two sides would let a requester become the addressee and accept their own request. */
  readonly requesterId: ProfileId;
  readonly addresseeId: ProfileId;
  readonly status: FriendshipStatus;
  /**
   * Which of the two parties blocked, set exactly when `status` is
   * 'blocked'. Without it a block is unenforceable: either party may
   * delete the row, so the blocked person could remove their own block and
   * walk straight back in. Unblocking is the blocker deleting the row.
   */
  readonly blockedBy: ProfileId | null;
  readonly createdAt: IsoDateTimeString;
  /** When the addressee answered. Null while the request is still open. */
  readonly respondedAt: IsoDateTimeString | null;
}

/**
 * One person's score for one canonical recipe.
 *
 * KEYED ON THE RECIPE, NOT ON A MEAL, AND THAT IS THE ENTIRE POINT.
 * Twenty households importing the same TikTok hold twenty private `meals`
 * rows (0006's header explains why those must stay private and separate),
 * but they are all copies of ONE `recipes` row. Rating the meal would
 * fragment the score twenty ways and make "is this recipe any good?"
 * unanswerable — which is exactly the problem Fase 1b's canonical table
 * was built to remove. One vote per person per recipe, enforced by
 * `unique (recipe_id, rater_profile_id)`.
 *
 * `rating` is on the scale src/domain/rating.ts owns — the same scale
 * `cook_events.rating` (0005) uses, stated in that one file rather than
 * duplicated here.
 */
export interface RecipeRating {
  readonly id: RecipeRatingId;
  readonly recipeId: RecipeId;
  readonly raterProfileId: ProfileId;
  readonly rating: number;
  readonly ratedAt: IsoDateTimeString;
}

/**
 * PD-010 point 3: "`meals.visibility` governs, defaulting to `private`.
 * Sharing is an act, never a default."
 *
 * There is deliberately no 'public' member. Showing a household's recipe
 * to a friend is already the rebroadcast rung of the exposure ladder in
 * research/13-legal-tos.md; a value that put it in front of strangers
 * would be a different product decision, and it should have to be argued
 * for rather than arrive as an unused enum member somebody later switches
 * on.
 */
export type MealVisibility = 'private' | 'friends';

/**
 * The minimum a caller needs in order to decide whether a meal may be
 * shown on the friend surface. Deliberately not `Meal`: this mirrors the
 * `is_meal_shared_with_me` SQL predicate, which reaches through
 * household_members to the accounts behind a household, and `Meal` carries
 * no such link (nor should it — a meal knows its household, not its
 * household's logins).
 */
export interface SharedMeal {
  readonly mealId: MealId;
  readonly visibility: MealVisibility;
  /**
   * The profiles behind the owning household — its members with a linked
   * account. Empty is a real state (a household nobody has signed in for),
   * and it means the meal is shared with nobody, however it is flagged.
   */
  readonly ownerProfileIds: readonly ProfileId[];
  /** Archiving takes a meal off the friend surface too — mirrors `m.archived_at is null` in the SQL predicate. */
  readonly archivedAt: IsoDateTimeString | null;
}

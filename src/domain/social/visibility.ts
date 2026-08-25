/**
 * PD-010's `meals.visibility`, on the application side: what an unknown
 * stored value means, and who a friends-visible meal is actually visible
 * to.
 *
 * WHY THIS DUPLICATES AN RLS RULE ON PURPOSE. The `is_meal_shared_with_me`
 * predicate in supabase/migrations/0007_social.sql is the enforcement; the
 * mirror below is defence in depth, exactly the argument
 * src/domain/feed/eligibility.ts makes for re-checking creator consent
 * that `feed_items_select` already guarantees. RLS protects a direct
 * query. It does nothing for a payload already sitting in application
 * memory — a stale cache, a batch export, a fixture, a future caller that
 * joins the tables itself — and the failure mode here is showing one
 * household's dinner to someone who is not their friend. "The database
 * would have blocked this" must never be the only thing in the way.
 *
 * THE DEFAULT IS THE DECISION. PD-010 point 3: "`meals.visibility`
 * governs, defaulting to `private`. Sharing is an act, never a default."
 * That is why `resolveMealVisibility` reads anything it does not recognise
 * — a missing column on a row written before this migration, a value from
 * a newer client, a corrupted string — as 'private'. Failing closed costs
 * a meal not appearing on a friend's feed, which the owner fixes in one
 * tap. Failing open publishes something nobody agreed to publish, which
 * nobody can take back. The same asymmetry PD-006 reasons from when it
 * refuses to read an untagged meal as a safe one.
 *
 * Pure, no I/O.
 */

import { areFriends } from './friendship';
import type { Friendship, MealVisibility, ProfileId, SharedMeal } from './types';

/** Mirrors the column default in 0007_social.sql. Stated once, here, so the two cannot drift. */
export const DEFAULT_MEAL_VISIBILITY: MealVisibility = 'private';

const MEAL_VISIBILITIES: readonly MealVisibility[] = ['private', 'friends'];

/**
 * Narrows an untrusted stored value to the vocabulary, falling back to
 * 'private' for everything else — see the header on why that fallback is
 * the whole point rather than defensive noise. `unknown` rather than
 * `string | undefined` because the callers are row readers, and a row is
 * untrusted input like any other (the posture
 * src/domain/import/canonicalRecipe.ts takes toward a stored recipe).
 */
export function resolveMealVisibility(raw: unknown): MealVisibility {
  return MEAL_VISIBILITIES.find((visibility) => visibility === raw) ?? DEFAULT_MEAL_VISIBILITY;
}

/** Reads as a question rather than a string comparison at call sites, and keeps the literal in one place. */
export function isSharedWithFriends(visibility: MealVisibility): boolean {
  return visibility === 'friends';
}

/**
 * Whether `viewerProfileId` may see this meal on the FRIEND surface — the
 * in-memory counterpart of `is_meal_shared_with_me`.
 *
 * Three conditions, all of them also in the SQL predicate: the meal is
 * flagged 'friends', it is not archived (archiving pulls a meal off this
 * surface as well as out of the household's own list), and the viewer is
 * an accepted friend of at least one member of the owning household who
 * has a linked account.
 *
 * An owner asking about their own meal gets `false`, and that is correct
 * rather than a quirk: their access comes from household membership
 * (`is_household_member`, 0001_init.sql), a different policy answering a
 * different question. Keeping this function narrow is what stops "may a
 * friend see this" from quietly becoming "may anyone see this".
 *
 * NOT COVERED HERE, AND NOT AN OVERSIGHT: PD-010 point 4, the creator
 * opt-out. A withdrawn creator has to leave this surface too, and the
 * migration's predicate does check it — but doing so needs the meal's
 * canonical recipe and the `creators` table, neither of which belongs in
 * `SharedMeal`. Widening this shape to carry them would make every caller
 * fetch two more relations to ask a question the database already answers.
 * The honest boundary: this mirror covers the friendship half, and a
 * caller assembling a friend feed from raw rows applies
 * src/domain/feed/eligibility.ts's `isCreatorConsented` alongside it.
 */
export function isMealSharedWithFriend(
  meal: SharedMeal,
  viewerProfileId: ProfileId,
  friendships: readonly Friendship[],
): boolean {
  if (!isSharedWithFriends(meal.visibility) || meal.archivedAt !== null) {
    return false;
  }
  return meal.ownerProfileIds.some((ownerProfileId) => areFriends(ownerProfileId, viewerProfileId, friendships));
}

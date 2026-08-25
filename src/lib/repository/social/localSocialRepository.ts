/**
 * The on-device implementation of `RemySocialRepository`, over the same
 * KeyValueStore/TableAccessor primitives `localRepository.ts` uses.
 *
 * WHAT THIS FILE IS ACTUALLY FOR. Not to ship a social feature — there is
 * no auth and no UI yet. It exists so the interface is proven executable
 * before anything depends on it, and so every schema promise a local store
 * cannot inherit from Postgres has exactly one place that keeps it: a
 * unique handle, one row per unordered pair, one rating per (recipe,
 * rater), and no illegal friendship transition.
 *
 * EVERY RULE IS IMPORTED, NONE IS RE-DERIVED. The transition table comes
 * from src/domain/social/friendship.ts, the handle rules from handle.ts,
 * the rating scale from src/domain/rating.ts. That is what makes the
 * eventual `supabaseSocialRepository.ts` a rewrite of the I/O only: it
 * calls the same functions, so the two backends cannot disagree about what
 * is allowed. Re-implementing "only the addressee may accept" inline here
 * would be a second copy of a security rule, which is precisely what the
 * domain module exists to prevent.
 *
 * ORDER OF OPERATIONS, DELIBERATE. Every mutation validates first and
 * writes once at the end. A half-applied change on a store with no
 * transaction is worse than a rejected one.
 */

import { isValidRating } from '@/domain/rating';
import { applyFriendshipAction, friendshipPairKey, friendshipRoleOf } from '@/domain/social/friendship';
import { parseHandle } from '@/domain/social/handle';
import type {
  Friendship,
  FriendshipAction,
  FriendshipRole,
  FriendshipStatus,
  Profile,
  ProfileId,
  RecipeId,
  RecipeRating,
} from '@/domain/social/types';
import { nowIso } from '../clock';
import { generateLocalId } from '../id';
import type { KeyValueStore } from '../keyValueStore';
import { createTableAccessor, type TableAccessor } from '../table';
import type { RateRecipeInput, RemySocialRepository, UpsertProfileInput } from './types';

interface SocialTables {
  readonly profiles: TableAccessor<Profile>;
  readonly friendships: TableAccessor<Friendship>;
  readonly recipeRatings: TableAccessor<RecipeRating>;
}

/** One key per table, named after 0007_social.sql and `remy:`-prefixed exactly like local/tables.ts. */
function createSocialTables(store: KeyValueStore): SocialTables {
  return {
    profiles: createTableAccessor<Profile>(store, 'remy:profiles'),
    friendships: createTableAccessor<Friendship>(store, 'remy:friendships'),
    recipeRatings: createTableAccessor<RecipeRating>(store, 'remy:recipe_ratings'),
  };
}

/** Matches `friendshipPairKey`'s comparison rule, so lookups and stored ids never disagree about case. */
function sameProfile(left: ProfileId, right: ProfileId): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function findPairRow(friendships: readonly Friendship[], profileA: ProfileId, profileB: ProfileId): Friendship | null {
  const wanted = friendshipPairKey(profileA, profileB);
  if (wanted === null) {
    return null;
  }
  return (
    friendships.find((friendship) => {
      const key = friendshipPairKey(friendship.requesterId, friendship.addresseeId);
      return key !== null && key.low === wanted.low && key.high === wanted.high;
    }) ?? null
  );
}

/**
 * The role the actor holds on the row being acted upon. For a pair with no
 * row yet the actor is the requester by definition — they are the one
 * asking.
 */
function actorRole(existing: Friendship | null, actorProfileId: ProfileId): FriendshipRole {
  if (existing === null) {
    return 'requester';
  }
  return friendshipRoleOf(existing, actorProfileId) ?? 'requester';
}

/**
 * The row a legal action produces.
 *
 * The two sides swap on a re-request out of 'declined': whoever is asking
 * now becomes the requester, or the original addressee could re-open the
 * pair and then "accept" a request nobody made. The unordered pair is
 * unchanged, which is the property the migration's trigger actually
 * guards. `blockedBy` is set only alongside 'blocked' and cleared
 * otherwise, mirroring that column's CHECK constraint.
 */
function nextFriendship(
  existing: Friendship | null,
  actorProfileId: ProfileId,
  otherProfileId: ProfileId,
  status: FriendshipStatus,
): Friendship {
  const timestamp = nowIso();
  const opening = status === 'pending';
  const requesterId = existing === null || opening ? actorProfileId : existing.requesterId;
  const addresseeId = existing === null || opening ? otherProfileId : existing.addresseeId;

  return {
    id: existing?.id ?? generateLocalId('friendship'),
    requesterId,
    addresseeId,
    status,
    blockedBy: status === 'blocked' ? actorProfileId : null,
    createdAt: existing?.createdAt ?? timestamp,
    // A pending row is an unanswered question, so it carries no answer
    // time — including a re-request, which resets the clock rather than
    // keeping the answer to the request it replaces.
    respondedAt: opening ? null : timestamp,
  };
}

function replaceOrAppend<T extends { readonly id: string }>(rows: readonly T[], row: T): readonly T[] {
  return rows.some((existing) => existing.id === row.id)
    ? rows.map((existing) => (existing.id === row.id ? row : existing))
    : [...rows, row];
}

export function createLocalSocialRepository(store: KeyValueStore): RemySocialRepository {
  const tables = createSocialTables(store);

  async function getProfile(profileId: ProfileId): Promise<Profile | null> {
    const profiles = await tables.profiles.list();
    return profiles.find((profile) => sameProfile(profile.id, profileId)) ?? null;
  }

  async function getFriendshipBetween(profileA: ProfileId, profileB: ProfileId): Promise<Friendship | null> {
    return findPairRow(await tables.friendships.list(), profileA, profileB);
  }

  return {
    getProfile,
    getFriendshipBetween,

    async findProfileByHandle(rawHandle: string): Promise<Profile | null> {
      // Normalized before matching, not after: the stored form is already
      // canonical, so '@SANNE' has to be brought to the same spelling to
      // stand any chance of matching it.
      const handle = parseHandle(rawHandle);
      if (handle === null) {
        return null;
      }
      const profiles = await tables.profiles.list();
      return profiles.find((profile) => profile.handle === handle) ?? null;
    },

    async upsertProfile(input: UpsertProfileInput): Promise<Profile> {
      const handle = parseHandle(input.handle);
      if (handle === null) {
        throw new Error(`"${input.handle}" is not a storable handle — see src/domain/social/handle.ts.`);
      }

      const profiles = await tables.profiles.list();
      // The unique index, enforced by hand because a KeyValueStore has
      // none. Compared against the normalized form, so "JOOST" cannot slip
      // past "joost" — the impersonation case handle.ts exists to close.
      const clash = profiles.find((profile) => profile.handle === handle && !sameProfile(profile.id, input.id));
      if (clash !== undefined) {
        throw new Error(`Handle "${handle}" is already taken.`);
      }

      const existing = profiles.find((profile) => sameProfile(profile.id, input.id));
      const profile: Profile = {
        id: input.id,
        handle,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        createdAt: existing?.createdAt ?? nowIso(),
      };
      await tables.profiles.replaceAll(replaceOrAppend(profiles, profile));
      return profile;
    },

    async listFriendships(profileId: ProfileId): Promise<readonly Friendship[]> {
      const friendships = await tables.friendships.list();
      return friendships.filter(
        (friendship) => sameProfile(friendship.requesterId, profileId) || sameProfile(friendship.addresseeId, profileId),
      );
    },

    async actOnFriendship(
      actorProfileId: ProfileId,
      otherProfileId: ProfileId,
      action: FriendshipAction,
    ): Promise<Friendship> {
      if (friendshipPairKey(actorProfileId, otherProfileId) === null) {
        throw new Error('A friendship needs two different profiles — the same profile twice is not a pair.');
      }

      const friendships = await tables.friendships.list();
      const existing = findPairRow(friendships, actorProfileId, otherProfileId);
      const result = applyFriendshipAction({
        from: existing?.status ?? null,
        action,
        actor: actorRole(existing, actorProfileId),
      });
      if (!result.ok) {
        // The domain's reason code travels verbatim into the message: the
        // UI maps it to Dutch copy, and whoever reads a log wants the same
        // word the transition table uses.
        throw new Error(`Cannot ${action} this friendship: ${result.reason}.`);
      }

      const friendship = nextFriendship(existing, actorProfileId, otherProfileId, result.status);
      await tables.friendships.replaceAll(replaceOrAppend(friendships, friendship));
      return friendship;
    },

    async removeFriendship(actorProfileId: ProfileId, otherProfileId: ProfileId): Promise<void> {
      const friendships = await tables.friendships.list();
      const existing = findPairRow(friendships, actorProfileId, otherProfileId);
      if (existing === null) {
        // Already gone. Mirrors a DELETE that matches no row: nothing to
        // do, and nothing worth an error either.
        return;
      }
      // Mirrors the delete policy in 0007_social.sql. Without it a block
      // is theatre — the blocked party removes the row and asks again.
      const blockedByActor = existing.blockedBy !== null && sameProfile(existing.blockedBy, actorProfileId);
      if (existing.status === 'blocked' && !blockedByActor) {
        throw new Error('Only the profile that blocked can remove a blocked friendship.');
      }
      await tables.friendships.replaceAll(friendships.filter((friendship) => friendship.id !== existing.id));
    },

    async listRecipeRatings(recipeId: RecipeId): Promise<readonly RecipeRating[]> {
      const ratings = await tables.recipeRatings.list();
      return ratings.filter((rating) => rating.recipeId === recipeId);
    },

    async rateRecipe(input: RateRecipeInput): Promise<RecipeRating> {
      // Rejected, never clamped: the same stance `setCookEventRating`
      // takes, and the reason ratings.ts drops an off-scale stored row
      // rather than rounding it into range.
      if (!isValidRating(input.rating)) {
        throw new Error(`Rating ${input.rating} is off the scale owned by src/domain/rating.ts.`);
      }

      const ratings = await tables.recipeRatings.list();
      // `unique (recipe_id, rater_profile_id)`, enforced here: changing
      // your mind replaces your vote, it never adds a second one.
      const existing = ratings.find(
        (rating) => rating.recipeId === input.recipeId && sameProfile(rating.raterProfileId, input.raterProfileId),
      );
      const rating: RecipeRating = {
        id: existing?.id ?? generateLocalId('recipe-rating'),
        recipeId: input.recipeId,
        raterProfileId: input.raterProfileId,
        rating: input.rating,
        // Refreshed on a re-rate, because `latestValidVotePerRater` in
        // ratings.ts resolves duplicates by this field and the newest
        // opinion has to look newest.
        ratedAt: nowIso(),
      };
      await tables.recipeRatings.replaceAll(replaceOrAppend(ratings, rating));
      return rating;
    },

    async removeRecipeRating(recipeId: RecipeId, raterProfileId: ProfileId): Promise<void> {
      const ratings = await tables.recipeRatings.list();
      await tables.recipeRatings.replaceAll(
        ratings.filter((rating) => !(rating.recipeId === recipeId && sameProfile(rating.raterProfileId, raterProfileId))),
      );
    },
  };
}

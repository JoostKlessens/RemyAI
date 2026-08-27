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
import {
  applyFriendshipAction,
  areFriends,
  friendshipPairKey,
  nextFriendshipFields,
  resolveActorRole,
} from '@/domain/social/friendship';
import { parseHandle } from '@/domain/social/handle';
import type {
  Friendship,
  FriendshipAction,
  FriendshipStatus,
  Profile,
  ProfileId,
  RecipeId,
  RecipeRating,
} from '@/domain/social/types';
import type { IsoDateTimeString, Meal, MealId, MealIngredient } from '@/domain/types';
import { nowIso } from '../clock';
import { generateLocalId } from '../id';
import type { KeyValueStore } from '../keyValueStore';
import { createTableAccessor, type TableAccessor } from '../table';
import {
  normalizeSendNote,
  type CanonicalRecipeSummary,
  type FriendCook,
  type IncomingSend,
  type RateRecipeInput,
  type RecipeShare,
  type RemySocialRepository,
  type SendRecipeInput,
  type SentMeal,
  type UpsertProfileInput,
} from './types';

/**
 * A `recipe_shares` row as it is STORED, deliberately wider than either
 * shape the interface hands out.
 *
 * `seenAt` and `withdrawnAt` are the two columns 0009 keeps and this seam
 * refuses to publish as they are: the first is narrowed to a boolean and
 * given only to the recipient (`IncomingSend`), the second never leaves
 * this file at all — it is expressed as a row's absence from
 * `listSendsToMe`. Storing timestamps rather than booleans is not
 * ceremony: `withdrawnAt` is what makes a withdrawal auditable, and
 * `seenAt` being null-or-not is what makes marking seen idempotent
 * without a second flag to keep in step with it.
 */
interface StoredRecipeShare extends RecipeShare {
  readonly seenAt: IsoDateTimeString | null;
  readonly withdrawnAt: IsoDateTimeString | null;
}

interface SocialTables {
  readonly profiles: TableAccessor<Profile>;
  readonly friendships: TableAccessor<Friendship>;
  readonly recipeRatings: TableAccessor<RecipeRating>;
  readonly recipeShares: TableAccessor<StoredRecipeShare>;
  /**
   * READ-ONLY, AND OWNED BY THE OTHER REPOSITORY. These two are
   * localRepository.ts's tables (src/lib/repository/local/tables.ts), and
   * nothing in this file ever writes to them.
   *
   * They are reachable at all because both repositories are built over the
   * same `KeyValueStore`, which is the local analogue of both backends
   * living in one Postgres. `listMealsSentToMe` is the one method here
   * that has to cross that line, for the reason its interface comment
   * gives: the permission is a fact about a `recipe_shares` row, and this
   * is the seam that owns `recipe_shares`. Postgres solves the identical
   * problem the identical way — `meals` and `meal_ingredients` gain an
   * ADDITIONAL select policy gated on `has_active_send_to_me` (0009)
   * rather than the social tables growing a copy of the meal.
   *
   * KNOWN DUPLICATION, stated rather than hidden: the two key strings are
   * spelled here and in local/tables.ts. Importing that module would drag
   * a nine-table constructor and its whole type graph in to read two keys,
   * so the smaller wrong is two string literals with this comment pointing
   * at the other copy.
   */
  readonly meals: TableAccessor<Meal>;
  readonly mealIngredients: TableAccessor<MealIngredient>;
}

/** One key per table, named after 0007_social.sql and 0009_cook_proof_and_sends.sql, `remy:`-prefixed exactly like local/tables.ts. */
function createSocialTables(store: KeyValueStore): SocialTables {
  return {
    profiles: createTableAccessor<Profile>(store, 'remy:profiles'),
    friendships: createTableAccessor<Friendship>(store, 'remy:friendships'),
    recipeRatings: createTableAccessor<RecipeRating>(store, 'remy:recipe_ratings'),
    recipeShares: createTableAccessor<StoredRecipeShare>(store, 'remy:recipe_shares'),
    meals: createTableAccessor<Meal>(store, 'remy:meals'),
    mealIngredients: createTableAccessor<MealIngredient>(store, 'remy:meal_ingredients'),
  };
}

/**
 * A stored meal, reduced to what a send card may see.
 *
 * Written out field by field rather than spread-and-delete, for exactly
 * the reason `toRecipeShare` above is: a spread would carry
 * `householdId`, `allergenTagStatus` and the sender's own housekeeping
 * along at runtime under a type that says they are absent. `SentMeal`'s
 * header explains why each of those must not travel; this function is
 * where that stops being a comment.
 */
function toSentMeal(share: StoredRecipeShare, meal: Meal, ingredients: readonly MealIngredient[]): SentMeal {
  return {
    shareId: share.id,
    mealId: meal.id,
    senderProfileId: share.senderProfileId,
    title: meal.title,
    thumbnailUrl: meal.thumbnailUrl,
    estimatedMinutes: meal.estimatedMinutes,
    servings: meal.servings,
    // `?? []` because table.ts deliberately does not validate row shapes:
    // a meal written before this column existed comes back without the
    // key, and an `undefined` here would crash the first `.some()` in the
    // collision lookup. Same stance `toMealRow` takes on `dishTags`.
    ingredientTags: meal.ingredientTags ?? [],
    sourceUrl: meal.sourceUrl,
    recipeId: meal.recipeId ?? null,
    ingredients: [...ingredients]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        sortOrder: ingredient.sortOrder,
      })),
  };
}

/**
 * Projections written out field by field rather than by spreading the
 * stored row and deleting what must not travel.
 *
 * A spread would carry `seenAt` and `withdrawnAt` along at runtime under
 * a type that says they are absent — invisible in review, and exactly the
 * accident `RecipeShare` exists to prevent, because the row `sendRecipe`
 * returns goes to the SENDER.
 */
function toRecipeShare(row: StoredRecipeShare): RecipeShare {
  return {
    id: row.id,
    mealId: row.mealId,
    senderProfileId: row.senderProfileId,
    recipientProfileId: row.recipientProfileId,
    note: row.note,
    sentAt: row.sentAt,
  };
}

function toIncomingSend(row: StoredRecipeShare): IncomingSend {
  return { ...toRecipeShare(row), seen: row.seenAt !== null };
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
 * `unique (meal_id, recipient_profile_id)`: one send per dish per
 * recipient, whoever sent it. The sender is deliberately NOT part of the
 * match — two flatmates share a household and therefore share the meal
 * row, and the schema says the second of them to send it is amending the
 * same offer rather than opening a second card in the friend's list.
 */
function isSameSend(row: StoredRecipeShare, mealId: MealId, recipientProfileId: ProfileId): boolean {
  return row.mealId === mealId && sameProfile(row.recipientProfileId, recipientProfileId);
}

/**
 * The role the actor holds on the row being acted upon. For a pair with no
 * row yet the actor is the requester by definition — they are the one
 * asking.
 */


/**
 * The row a legal action produces: the domain decides every field that is
 * a rule, this adds only the two a local store owns — an id it mints and a
 * creation time it stamps. Postgres defaults both, which is exactly why
 * they are not in `nextFriendshipFields`.
 */
function nextFriendship(
  existing: Friendship | null,
  actorProfileId: ProfileId,
  otherProfileId: ProfileId,
  status: FriendshipStatus,
): Friendship {
  const timestamp = nowIso();
  return {
    id: existing?.id ?? generateLocalId('friendship'),
    createdAt: existing?.createdAt ?? timestamp,
    ...nextFriendshipFields(existing, actorProfileId, otherProfileId, status, timestamp),
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
        actor: resolveActorRole(existing, actorProfileId),
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

    async listAllRecipeRatings(): Promise<readonly RecipeRating[]> {
      // No ceiling check here, unlike the Supabase implementation. This
      // store holds one device's rows, and a device that has accumulated
      // fifty thousand ratings locally has a different problem than a
      // board that cannot be computed.
      return tables.recipeRatings.list();
    },

    async listFriendCookedRecipes(): Promise<readonly FriendCook[]> {
      // Cook proof is a cross-household fact, and this store holds one
      // device's rows. There is no friend's kitchen in here to read, and
      // inventing one would make a local test pass for a reason the real
      // backend cannot reproduce. Empty is the honest answer, the same
      // one `listCanonicalRecipes` gives below.
      return [];
    },

    async sendRecipe(input: SendRecipeInput): Promise<RecipeShare> {
      // `check (sender_profile_id <> recipient_profile_id)`, kept by hand
      // because a KeyValueStore has no CHECKs. Sending a dish to yourself
      // is not a share; it is a note to self this product does not sell.
      if (sameProfile(input.senderProfileId, input.recipientProfileId)) {
        throw new Error('Sending a dish to yourself is not a share.');
      }
      // Rejected, never truncated — normalizeSendNote owns that stance and
      // the Supabase backend calls the identical function.
      const note = normalizeSendNote(input.note);

      // The ONE clause of 0009's insert policy this store can honestly
      // establish. Of the three, "the sender is you" needs an auth.uid()
      // that does not exist on a device, and "the meal is yours" needs
      // the meals table, which lives in the other repository entirely —
      // both are the database's alone. Friendship is not: the rows are
      // right here, so leaving it out would let a local test pass a flow
      // that RLS refuses in production, which is the precise seam bug
      // having two backends is supposed to catch. `areFriends` is the
      // in-memory counterpart of `is_friend_of`, imported rather than
      // re-derived, exactly like every other rule in this file.
      const friendships = await tables.friendships.list();
      if (!areFriends(input.senderProfileId, input.recipientProfileId, friendships)) {
        throw new Error('A send only reaches a mutually accepted friend.');
      }

      const shares = await tables.recipeShares.list();
      const existing = shares.find((share) => isSameSend(share, input.mealId, input.recipientProfileId));
      const share: StoredRecipeShare = {
        id: existing?.id ?? generateLocalId('recipe-share'),
        mealId: input.mealId,
        senderProfileId: input.senderProfileId,
        recipientProfileId: input.recipientProfileId,
        note,
        // Not refreshed on a re-send, unlike `rateRecipe`'s `ratedAt`.
        // That column is refreshed because ratings.ts resolves a duplicate
        // rater by comparing it; nothing reads this one to break a tie
        // between two versions of the same offer, and moving it would be
        // the first half of a recency order §3.2 does not want.
        sentAt: existing?.sentAt ?? nowIso(),
        // Carried over deliberately: a re-send must not make a card the
        // recipient has already read unread again, or withdraw-and-resend
        // becomes a bell the sender can ring at will (§3.2, "no loop to
        // run"). See `sendRecipe` in ./types.ts.
        seenAt: existing?.seenAt ?? null,
        // Revives a withdrawn row, which is the whole reason withdrawal
        // keeps it.
        withdrawnAt: null,
      };
      await tables.recipeShares.replaceAll(replaceOrAppend(shares, share));
      return toRecipeShare(share);
    },

    async withdrawSend(senderProfileId: ProfileId, mealId: MealId, recipientProfileId: ProfileId): Promise<void> {
      const shares = await tables.recipeShares.list();
      // Matched on all three, and on the row still being live, so that
      // this mirrors the filtered UPDATE the Supabase backend issues: a
      // recipient cannot withdraw what was aimed at them, and a second
      // withdrawal finds nothing to write and therefore leaves the first
      // one's timestamp — the auditable one — alone.
      const existing = shares.find(
        (share) =>
          isSameSend(share, mealId, recipientProfileId) &&
          sameProfile(share.senderProfileId, senderProfileId) &&
          share.withdrawnAt === null,
      );
      if (existing === undefined) {
        return;
      }
      // A soft delete, and the only one in this file. `removeRecipeRating`
      // below is a real delete because a withdrawn vote must be
      // indistinguishable from no vote; here the row is what a later
      // re-send lands on, and 0009's recipient-facing index is literally
      // `where withdrawn_at is null` — absence from that index IS
      // withdrawal.
      await tables.recipeShares.replaceAll(replaceOrAppend(shares, { ...existing, withdrawnAt: nowIso() }));
    },

    async markSendsSeen(recipientProfileId: ProfileId): Promise<void> {
      const shares = await tables.recipeShares.list();
      const seenAt = nowIso();
      // Stamps exactly the rows `listSendsToMe` would have returned, and
      // only the ones not stamped already. Both halves matter: skipping
      // withdrawn rows keeps "seen" from recording attention to a card
      // that was never shown, and skipping stamped ones is what makes a
      // second call a no-op rather than a rewrite.
      await tables.recipeShares.replaceAll(
        shares.map((share) =>
          sameProfile(share.recipientProfileId, recipientProfileId) &&
          share.seenAt === null &&
          share.withdrawnAt === null
            ? { ...share, seenAt }
            : share,
        ),
      );
    },

    async listSendsToMe(recipientProfileId: ProfileId): Promise<readonly IncomingSend[]> {
      const shares = await tables.recipeShares.list();
      // Withdrawn rows are filtered out rather than flagged, matching the
      // partial index they are excluded from server-side. In store order,
      // which is insertion order: §3.2 owns the ordering and has inputs
      // this layer does not.
      return shares
        .filter((share) => sameProfile(share.recipientProfileId, recipientProfileId) && share.withdrawnAt === null)
        .map(toIncomingSend);
    },

    async listMealsSentToMe(recipientProfileId: ProfileId): Promise<readonly SentMeal[]> {
      // THE SHARES ARE READ FIRST AND ARE THE ONLY SOURCE OF MEAL IDS.
      // Not an optimisation and not an ordering preference: it is the
      // whole permission model expressed as control flow. Nothing below
      // ever asks for a meal by an id that did not come out of a live row
      // addressed to this reader, so widening the result would require
      // widening this filter, which is one line and in plain sight.
      // Postgres reaches the same guarantee from the other side, with
      // `has_active_send_to_me(id)` asked per meal row; the two meet in
      // the middle and agree.
      const shares = await tables.recipeShares.list();
      const live = shares.filter(
        (share) => sameProfile(share.recipientProfileId, recipientProfileId) && share.withdrawnAt === null,
      );
      if (live.length === 0) {
        // Nothing to look up, and — unlike the Supabase backend, where an
        // empty `in.()` is a syntax error — nothing that would break if it
        // ran anyway. Returning here keeps the two implementations reading
        // the same shape rather than only behaving the same.
        return [];
      }

      const [meals, ingredients] = await Promise.all([tables.meals.list(), tables.mealIngredients.list()]);
      const mealsById = new Map(meals.map((meal) => [meal.id, meal]));

      return live.flatMap((share): readonly SentMeal[] => {
        const meal = mealsById.get(share.mealId);
        if (meal === undefined) {
          // A share pointing at a meal this device does not hold, which is
          // the ORDINARY case here and not a corruption: the meal belongs
          // to the sender's household and a device holds one household.
          // Dropped rather than half-built, matching what RLS declining
          // the row produces server-side — PD-010 promises a card that
          // opens a full recipe, so there is nothing lesser to render.
          return [];
        }
        return [toSentMeal(share, meal, ingredients.filter((ingredient) => ingredient.mealId === meal.id))];
      });
    },

    async listCanonicalRecipes(recipeIds: readonly RecipeId[]): Promise<readonly CanonicalRecipeSummary[]> {
      // Canonical recipes live only in Postgres — `recipes` (0006) is
      // written by the parse-recipe edge function with the service role
      // and has no local mirror, deliberately: it is shared data whose
      // whole value is that it crosses household boundaries, and a
      // device-local copy of it would be a cache nobody invalidates.
      //
      // Empty, not throwing. A caller that gets no display data drops the
      // rows rather than failing, which is exactly the degradation the
      // board wants from a store that structurally cannot answer.
      void recipeIds;
      return [];
    },
  };
}

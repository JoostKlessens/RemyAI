/**
 * `RemySocialRepository` over Postgres — the backend the local store was
 * written to be replaced by.
 *
 * WHAT THIS FILE IS ALLOWED TO CONTAIN: I/O. Nothing else.
 * localSocialRepository.ts states the contract both implementations sign:
 * "every rule is imported, none is re-derived... that is what makes the
 * eventual supabaseSocialRepository.ts a rewrite of the I/O only: it calls
 * the same functions, so the two backends cannot disagree about what is
 * allowed." So `parseHandle`, `applyFriendshipAction` and `isValidRating`
 * are called here exactly as they are called there. A rule re-expressed as
 * a `.eq()` filter or an inline `if` would be a second copy of a security
 * decision, and the two copies would drift.
 *
 * WHY THE CLIENT STILL CHECKS WHAT THE DATABASE ALREADY ENFORCES. Postgres
 * has the real guarantees: RLS on every table, `guard_friendship_transition`
 * on friendships, `unique (recipe_id, rater_profile_id)`, and 0008's range
 * and step CHECKs. The client-side checks are not a second line of defence
 * pretending to be the first — they exist so an illegal action fails with
 * a sentence a developer can read, at the call site, instead of as a
 * Postgres error code after a round trip. Where they disagree, the
 * database wins, because the database is the one an attacker cannot skip.
 *
 * TIMESTAMPS ARE NORMALIZED, AND THAT IS LOAD-BEARING. PostgREST returns
 * `timestamptz` as ISO-8601 with a numeric offset ("+00:00"), while this
 * codebase's IsoDateTimeString is fixed-width UTC with milliseconds and a
 * "Z". src/domain/social/ratings.ts resolves a duplicate rater by
 * comparing those strings directly — it says so, and it is only safe
 * because the format is fixed-width. Two formats in one comparison would
 * make "most recent vote wins" quietly wrong, so every timestamp crossing
 * this boundary goes through `toIsoDateTime`.
 *
 * NUMERICS ARRIVE AS TEXT, SOMETIMES. `recipe_ratings.rating` is
 * numeric(4,2) since 0008, and PostgREST is entitled to serialise a
 * numeric as a JSON string to preserve precision. A string flows through
 * arithmetic in JavaScript without complaining and comes out wrong, so
 * every rating is coerced with Number() and then put through
 * `isValidRating` — the same gate the local store uses. A row that fails
 * it is dropped rather than repaired, matching ratings.ts's stance on
 * stored data that predates or violates the scale.
 */

import { isValidRating } from '@/domain/rating';
import {
  applyFriendshipAction,
  friendshipPairKey,
  nextFriendshipFields,
  resolveActorRole,
} from '@/domain/social/friendship';
import { parseHandle } from '@/domain/social/handle';
import type { CreatorPlatform } from '@/domain/feed/types';
import type {
  Friendship,
  FriendshipAction,
  FriendshipStatus,
  Profile,
  ProfileId,
  RecipeId,
  RecipeRating,
} from '@/domain/social/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BOARD_RATING_ROW_CEILING,
  type CanonicalRecipeSummary,
  type RateRecipeInput,
  type RemySocialRepository,
  type UpsertProfileInput,
} from './types';

/** How many rows one PostgREST page asks for. Supabase caps a single response well below the ceiling, so a whole-table read has to page. */
const PAGE_SIZE = 1000;

/**
 * Postgres row shapes, written out rather than inferred. `supabase.ts`
 * deliberately leaves the client untyped until `supabase gen types` is
 * run, so these are the only description of the columns this file touches
 * — and being explicit means a column rename fails in review rather than
 * becoming `undefined` at runtime.
 */
interface ProfileRow {
  readonly id: string;
  readonly handle: string;
  readonly display_name: string;
  readonly avatar_url: string | null;
  readonly created_at: string;
}

interface FriendshipRow {
  readonly id: string;
  readonly requester_id: string;
  readonly addressee_id: string;
  readonly status: string;
  readonly blocked_by: string | null;
  readonly created_at: string;
  readonly responded_at: string | null;
}

interface RecipeRatingRow {
  readonly id: string;
  readonly recipe_id: string;
  readonly rater_profile_id: string;
  readonly rating: number | string;
  readonly rated_at: string;
}

interface RecipeRow {
  readonly id: string;
  readonly title: string;
  readonly platform: string;
  readonly author_name: string | null;
  readonly thumbnail_url: string | null;
}

/**
 * Postgres time to this codebase's fixed-width UTC string. See the header:
 * ratings.ts compares these lexically, so the format cannot vary.
 */
function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    createdAt: toIsoDateTime(row.created_at),
  };
}

function toFriendship(row: FriendshipRow): Friendship {
  return {
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    // The CHECK in 0007 constrains this column to the same set the domain
    // type names, so the cast asserts a guarantee the database already
    // keeps rather than hoping about a free-text field.
    status: row.status as FriendshipStatus,
    blockedBy: row.blocked_by,
    createdAt: toIsoDateTime(row.created_at),
    respondedAt: row.responded_at === null ? null : toIsoDateTime(row.responded_at),
  };
}

/** Null for a row this scale cannot read, so the caller drops it rather than ranking a repaired number. */
function toRecipeRating(row: RecipeRatingRow): RecipeRating | null {
  const rating = Number(row.rating);
  if (!isValidRating(rating)) {
    return null;
  }
  return {
    id: row.id,
    recipeId: row.recipe_id,
    raterProfileId: row.rater_profile_id,
    rating,
    ratedAt: toIsoDateTime(row.rated_at),
  };
}

function toCanonicalRecipe(row: RecipeRow): CanonicalRecipeSummary {
  return {
    recipeId: row.id,
    title: row.title,
    // Same argument as `status` above: 0006 CHECKs this column to exactly
    // these two values.
    platform: row.platform as CreatorPlatform,
    authorName: row.author_name,
    thumbnailUrl: row.thumbnail_url,
  };
}

/**
 * Turns a PostgREST error into something readable, keeping the Postgres
 * code — the code is what distinguishes "you are not allowed" (RLS) from
 * "that already exists" (unique violation), and a message that swallows it
 * makes both look like one generic failure.
 */
function fail(operation: string, error: { message: string; code?: string } | null): never {
  const code = error?.code === undefined ? '' : ` [${error.code}]`;
  throw new Error(`${operation} failed${code}: ${error?.message ?? 'unknown error'}`);
}

export function createSupabaseSocialRepository(client: SupabaseClient): RemySocialRepository {
  return {
    async getProfile(profileId: ProfileId): Promise<Profile | null> {
      const { data, error } = await client.from('profiles').select('*').eq('id', profileId).maybeSingle();
      if (error) {
        fail('Reading a profile', error);
      }
      return data === null ? null : toProfile(data as ProfileRow);
    },

    async findProfileByHandle(rawHandle: string): Promise<Profile | null> {
      // Normalized through the domain before it reaches the query, so
      // "  Joost " and "joost" find the same row. Never a `like` or an
      // `ilike`: the handle column is unique on its exact value, and a
      // pattern match here would turn an identity lookup into a search.
      const handle = parseHandle(rawHandle);
      if (handle === null) {
        return null;
      }
      const { data, error } = await client.from('profiles').select('*').eq('handle', handle).maybeSingle();
      if (error) {
        fail('Looking up a handle', error);
      }
      return data === null ? null : toProfile(data as ProfileRow);
    },

    async upsertProfile(input: UpsertProfileInput): Promise<Profile> {
      const handle = parseHandle(input.handle);
      if (handle === null) {
        throw new Error(`"${input.handle}" is not a storable handle — see src/domain/social/handle.ts.`);
      }

      const { data, error } = await client
        .from('profiles')
        .upsert(
          {
            id: input.id,
            handle,
            display_name: input.displayName,
            avatar_url: input.avatarUrl,
          },
          { onConflict: 'id' },
        )
        .select()
        .single();

      if (error) {
        // 23505 is unique_violation, and on this table it can only be the
        // handle — the primary key is the caller's own auth id. Saying so
        // matters: a taken handle is the one error on this path a person
        // can actually act on, and the sign-in copy depends on telling it
        // apart from a generic failure (PD-013).
        if (error.code === '23505') {
          throw new Error(`Handle "${handle}" is already taken.`);
        }
        fail('Saving a profile', error);
      }
      return toProfile(data as ProfileRow);
    },

    async listFriendships(profileId: ProfileId): Promise<readonly Friendship[]> {
      const { data, error } = await client
        .from('friendships')
        .select('*')
        .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`);
      if (error) {
        fail('Listing friendships', error);
      }
      return ((data ?? []) as FriendshipRow[]).map(toFriendship);
    },

    async getFriendshipBetween(profileA: ProfileId, profileB: ProfileId): Promise<Friendship | null> {
      // Queried against the generated `profile_low`/`profile_high` columns
      // rather than as a two-way OR of requester/addressee. 0007 generates
      // them precisely so an unordered pair has one canonical form, and
      // using it means this cannot miss the row by asking in the wrong
      // direction.
      const low = profileA < profileB ? profileA : profileB;
      const high = profileA < profileB ? profileB : profileA;
      const { data, error } = await client
        .from('friendships')
        .select('*')
        .eq('profile_low', low)
        .eq('profile_high', high)
        .maybeSingle();
      if (error) {
        fail('Reading a friendship', error);
      }
      return data === null ? null : toFriendship(data as FriendshipRow);
    },

    async actOnFriendship(
      actorProfileId: ProfileId,
      otherProfileId: ProfileId,
      action: FriendshipAction,
    ): Promise<Friendship> {
      if (friendshipPairKey(actorProfileId, otherProfileId) === null) {
        throw new Error('A friendship needs two different profiles — the same profile twice is not a pair.');
      }

      const current = await this.getFriendshipBetween(actorProfileId, otherProfileId);
      // The transition table is the domain's, and `guard_friendship_transition`
      // in 0007 enforces the identical rules server-side. Running it here
      // first turns an illegal move into a readable sentence instead of a
      // trigger exception, and costs one already-fetched row.
      const result = applyFriendshipAction({
        from: current?.status ?? null,
        action,
        actor: resolveActorRole(current, actorProfileId),
      });
      if (!result.ok) {
        // The domain's reason code travels verbatim into the message, the
        // same as in the local store: the UI maps it to Dutch copy, and
        // whoever reads a log wants the word the transition table uses.
        throw new Error(`Cannot ${action} this friendship: ${result.reason}.`);
      }

      const fields = nextFriendshipFields(current, actorProfileId, otherProfileId, result.status, new Date().toISOString());
      // `id` is sent only when a row already exists. On a new pair it is
      // omitted so `gen_random_uuid()` supplies it — the client has no
      // business minting a key the database already defaults, and
      // `created_at` is left alone for the same reason.
      const { data, error } = await client
        .from('friendships')
        .upsert(
          {
            ...(current === null ? {} : { id: current.id }),
            requester_id: fields.requesterId,
            addressee_id: fields.addresseeId,
            status: fields.status,
            blocked_by: fields.blockedBy,
            responded_at: fields.respondedAt,
          },
          { onConflict: 'id' },
        )
        .select()
        .single();

      if (error) {
        fail(`Recording "${action}" on a friendship`, error);
      }
      return toFriendship(data as FriendshipRow);
    },

    async removeFriendship(actorProfileId: ProfileId, otherProfileId: ProfileId): Promise<void> {
      const current = await this.getFriendshipBetween(actorProfileId, otherProfileId);
      if (current === null) {
        // Removing a pair that has no row is a no-op, matching the local
        // store: "we were never friends" and "we are no longer friends"
        // are the same end state.
        return;
      }
      if (current.status === 'blocked' && current.blockedBy !== actorProfileId) {
        throw new Error('Only the profile that blocked can remove a blocked friendship.');
      }

      const { error } = await client.from('friendships').delete().eq('id', current.id);
      if (error) {
        fail('Removing a friendship', error);
      }
    },

    async listRecipeRatings(recipeId: RecipeId): Promise<readonly RecipeRating[]> {
      const { data, error } = await client.from('recipe_ratings').select('*').eq('recipe_id', recipeId);
      if (error) {
        fail('Listing ratings for a recipe', error);
      }
      return ((data ?? []) as RecipeRatingRow[])
        .map(toRecipeRating)
        .filter((rating): rating is RecipeRating => rating !== null);
    },

    async rateRecipe(input: RateRecipeInput): Promise<RecipeRating> {
      if (!isValidRating(input.rating)) {
        throw new Error(`Rating ${input.rating} is off the scale owned by src/domain/rating.ts.`);
      }

      // `unique (recipe_id, rater_profile_id)` is the conflict target, so
      // changing your mind replaces your vote rather than adding a second.
      // `rated_at` is written explicitly on every upsert: ratings.ts
      // resolves duplicates by that column, and the newest opinion has to
      // look newest even though the row itself is being reused.
      const { data, error } = await client
        .from('recipe_ratings')
        .upsert(
          {
            recipe_id: input.recipeId,
            rater_profile_id: input.raterProfileId,
            rating: input.rating,
            rated_at: new Date().toISOString(),
          },
          { onConflict: 'recipe_id,rater_profile_id' },
        )
        .select()
        .single();

      if (error) {
        fail('Recording a rating', error);
      }

      const rating = toRecipeRating(data as RecipeRatingRow);
      if (rating === null) {
        // The row came back unreadable on the scale we just wrote it to,
        // which means client and database disagree about the scale — a
        // deploy skew worth surfacing rather than swallowing.
        throw new Error('The database returned a rating this scale cannot read — check that 0008 has been applied.');
      }
      return rating;
    },

    async removeRecipeRating(recipeId: RecipeId, raterProfileId: ProfileId): Promise<void> {
      const { error } = await client
        .from('recipe_ratings')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('rater_profile_id', raterProfileId);
      if (error) {
        fail('Withdrawing a rating', error);
      }
    },

    async listAllRecipeRatings(): Promise<readonly RecipeRating[]> {
      const rows: RecipeRatingRow[] = [];

      // Paged rather than one unbounded select: PostgREST caps a response
      // well below the ceiling, and a silently truncated first page is
      // exactly the partial read that would make the board rank a subset
      // while presenting itself as the world.
      for (let from = 0; from < BOARD_RATING_ROW_CEILING; from += PAGE_SIZE) {
        const { data, error } = await client
          .from('recipe_ratings')
          .select('*')
          // Ordered by primary key so paging is stable. Without it two
          // pages can overlap or skip rows as the table changes underneath
          // the reads, which would double-count a vote or lose one.
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          fail('Reading ratings for the board', error);
        }

        const page = (data ?? []) as RecipeRatingRow[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) {
          return rows.map(toRecipeRating).filter((rating): rating is RecipeRating => rating !== null);
        }
      }

      // See BOARD_RATING_ROW_CEILING: refusing loudly beats ranking a
      // subset as though it were everything.
      throw new Error(
        `The board tried to read more than ${BOARD_RATING_ROW_CEILING} ratings. ` +
          'Client-side aggregation has outgrown the data; move the per-recipe aggregate into SQL ' +
          '(see the note on BOARD_RATING_ROW_CEILING in src/lib/repository/social/types.ts).',
      );
    },

    async listCanonicalRecipes(recipeIds: readonly RecipeId[]): Promise<readonly CanonicalRecipeSummary[]> {
      if (recipeIds.length === 0) {
        // `in.()` with an empty list is a syntax error in PostgREST rather
        // than an empty result, so the empty case is answered here instead
        // of by a query that would fail.
        return [];
      }

      const { data, error } = await client
        .from('recipes')
        .select('id, title, platform, author_name, thumbnail_url')
        .in('id', [...recipeIds]);

      if (error) {
        fail('Reading canonical recipes', error);
      }
      return ((data ?? []) as RecipeRow[]).map(toCanonicalRecipe);
    },
  };
}

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
import type { Friendship, FriendshipAction, Profile, ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';
import type { MealId } from '@/domain/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BOARD_RATING_ROW_CEILING,
  normalizeSendNote,
  type FriendCook,
  type IncomingSend,
  type CanonicalRecipe,
  type CanonicalRecipeSummary,
  type RateRecipeInput,
  type RecipeShare,
  type RemySocialRepository,
  type SendRecipeInput,
  type SentMeal,
  type UpsertProfileInput,
} from './types';
// The Postgres/domain boundary: row shapes, converters, and `fail`. Split
// out when this file passed 800 lines; see that module's header on why the
// seam sits exactly there.
import {
  CANONICAL_RECIPE_COLUMNS,
  CANONICAL_RECIPE_INGREDIENT_COLUMNS,
  CANONICAL_RECIPE_STEP_COLUMNS,
  SENT_MEAL_COLUMNS,
  SENT_MEAL_INGREDIENT_COLUMNS,
  SENT_MEAL_STEP_COLUMNS,
  fail,
  toCanonicalRecipe,
  toCanonicalRecipeDetail,
  type CanonicalRecipeDetailRow,
  type RecipeIngredientRow,
  type RecipeStepRow,
  toFriendship,
  toIncomingSend,
  toProfile,
  toRecipeRating,
  toRecipeShare,
  toSentMeal,
  toSuggestedFriend,
  type FriendshipRow,
  type ProfileRow,
  type RecipeRatingRow,
  type RecipeRow,
  type RecipeShareRow,
  type SentMealIngredientRow,
  type SentMealRow,
  type SentMealStepRow,
  type SentShareRow,
  type SharedCookRow,
  // The wire shape and the domain shape share a name across the seam;
  // both are aliased here so a reader of `listSuggestedFriends` can see
  // which side of the wire each one is on.
  type SuggestedFriendRow as SuggestedFriendRpcRow,
} from './supabaseRowMapping';
import type { SuggestedFriendRow as DomainSuggestedFriendRow } from '@/domain/social/friendSuggestions';
// PD-024's directed graph over Postgres. Split out for the reason the
// row-mapping module above was: this file was 747 lines and `follows` plus
// `blocks` is two hundred more. See that file's header on why the seam sits
// exactly there, and on why both backends split in the same place.
import { createSupabaseFollowGraph } from './supabaseFollowGraph';

/** How many rows one PostgREST page asks for. Supabase caps a single response well below the ceiling, so a whole-table read has to page. */
const PAGE_SIZE = 1000;


export function createSupabaseSocialRepository(client: SupabaseClient): RemySocialRepository {
  /**
   * A whole-relation read of rating rows, paged, shared by the board's
   * `listAllRecipeRatings` and the kring's `listNamableRecipeVotes`.
   *
   * PAGED RATHER THAN ONE UNBOUNDED SELECT: PostgREST caps a single
   * response well below `BOARD_RATING_ROW_CEILING`, and a silently
   * truncated first page is exactly the partial read that would make a
   * ranking present a subset as though it were the world.
   *
   * PARAMETERISED BY RELATION, not copied per caller. `namable_recipe_votes`
   * is a view over `recipe_ratings` selecting the identical columns, so
   * the two reads differ in nothing but which rows come back — and a
   * second hand-written copy of this loop would be a second chance to get
   * the termination condition wrong, on a read whose failure mode is
   * invisible.
   *
   * `operation` is a parameter so the two callers fail with their own
   * sentence. A shared "Reading ratings" would put the board's wording on
   * the kring's failure, which is the sort of small lie that costs an hour
   * of looking in the wrong screen.
   */
  async function readEveryRating(relation: string, operation: string): Promise<readonly RecipeRating[]> {
    const rows: RecipeRatingRow[] = [];

    for (let from = 0; from < BOARD_RATING_ROW_CEILING; from += PAGE_SIZE) {
      const { data, error } = await client
        .from(relation)
        .select('*')
        // Ordered by primary key so paging is stable. Without it two
        // pages can overlap or skip rows as the relation changes
        // underneath the reads, which would double-count a vote or lose
        // one.
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        fail(operation, error);
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
      `A ranking tried to read more than ${BOARD_RATING_ROW_CEILING} ratings from "${relation}". ` +
        'Client-side aggregation has outgrown the data; move the per-recipe aggregate into SQL ' +
        '(see the note on BOARD_RATING_ROW_CEILING in src/lib/repository/social/types.ts).',
    );
  }

  return {
    // PD-024's directed graph, spread in from ./supabaseFollowGraph — seven
    // methods that are one subject with one set of rules, and the file this
    // one would otherwise be. `RemyFollowGraphRepository` names the same
    // split on the type side, so callers still see one object and one
    // implementation per backend. `localSocialRepository` spreads its own
    // half in at the identical point, which is what lets the two backends
    // be read against each other.
    ...createSupabaseFollowGraph(client),

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
      const row = {
        requester_id: fields.requesterId,
        addressee_id: fields.addresseeId,
        status: fields.status,
        blocked_by: fields.blockedBy,
        responded_at: fields.respondedAt,
      };

      // TWO STATEMENTS AND NOT ONE UPSERT, and the reason is a policy
      // rather than a preference. `.upsert(row, { onConflict: 'id' })`
      // travels as `INSERT ... ON CONFLICT (id) DO UPDATE`, and for that
      // statement form Postgres checks the INSERT policy's WITH CHECK
      // against the new row even when the conflict sends it down the UPDATE
      // branch. `friendships_insert` (0007) admits exactly two shapes — a
      // `pending` row whose requester is me, or a `blocked` row whose
      // blocker is me — so every transition on an EXISTING row was refused
      // with 42501: accepting (which writes `accepted` with the OTHER party
      // as requester), declining, re-asking, and blocking someone a row
      // already existed for. Measured against a live stack with a real
      // session on 8 September 2026: the upsert answers HTTP 403, the same
      // transition as a plain PATCH answers HTTP 200, and
      // `guard_friendship_transition` lets it through — the trigger was
      // never the refuser. A NEW request kept working, because that really
      // is an INSERT of a pending row with the caller as requester, which
      // is exactly the half of this screen the owner could still use.
      //
      // THE OTHER REPAIR WAS REJECTED ON PURPOSE. Widening
      // `friendships_insert` to `requester_id = auth.uid() or addressee_id
      // = auth.uid()` also makes the upsert succeed — verified — and it
      // would trade a security property for a code path: 0007 says a row
      // may only come INTO EXISTENCE as an open request from me or a block
      // by me, and that is the sentence the whole table leans on. One code
      // path was the upsert's only argument, and the price of it was that
      // the path taken most often had never worked once.
      //
      // `id` IS IN NEITHER PAYLOAD. The update addresses the row through
      // `.eq('id', …)` and the insert lets `gen_random_uuid()` supply one:
      // the client has no business minting a key the database already
      // defaults, and `created_at` is left alone for the same reason.
      //
      // BOTH SIDES OF THE PAIR ARE WRITTEN ON THE UPDATE TOO, which looks
      // redundant on an accept and is not. Re-asking after a `declined`
      // swaps requester and addressee (`nextFriendshipFields` returns the
      // actor as requester whenever the new status is `pending`), and
      // `guard_friendship_transition` guards the PAIR rather than the two
      // columns separately — so omitting them would drop that swap with no
      // error anywhere, which is the quietest way this could break.
      const { data, error } =
        current === null
          ? await client.from('friendships').insert(row).select().single()
          : await client.from('friendships').update(row).eq('id', current.id).select().single();

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

    /**
     * Every vote, for the board's anonymous average.
     *
     * Complete on purpose, and it stays complete now that a vote can be
     * cast by cooking: the board prints a number and never a name, so a
     * dish its household asked to keep quiet is still evidence about the
     * RECIPE. Hide the name, keep the number.
     */
    async listAllRecipeRatings(): Promise<readonly RecipeRating[]> {
      return readEveryRating('recipe_ratings', 'Reading ratings for the board');
    },

    /**
     * The kring's source: the same read, one relation over.
     *
     * `namable_recipe_votes` (0016) is a VIEW over `recipe_ratings` that
     * drops every vote whose household marked that dish "deel deze niet",
     * and it selects the identical five columns — so PostgREST cannot tell
     * the difference, which is why this shares `readEveryRating` instead
     * of growing a second paging loop. Two copies of that loop would be
     * two chances to get the `page.length < PAGE_SIZE` termination wrong,
     * on reads whose failure mode is a silently truncated ranking that
     * still presents itself as complete.
     *
     * The ceiling applies here too, and that is not an oversight: this
     * list is a subset of the board's, so anything that fits under the
     * ceiling there fits here, and a view somehow returning more would be
     * exactly the surprise worth throwing on.
     */
    async listNamableRecipeVotes(): Promise<readonly RecipeRating[]> {
      return readEveryRating('namable_recipe_votes', 'Reading votes that may be named');
    },

    async listFriendCookedRecipes(): Promise<readonly FriendCook[]> {
      // No filter and no graph clause, deliberately: `shared_cooks` gates
      // itself inside the view body, so the rows this returns are already
      // scoped to whoever the caller is allowed to see. Adding a WHERE here
      // would be a second copy of a permission rule — and the copy that is
      // easiest to get wrong.
      //
      // ⚠ WHICH PREDICATE THAT IS CHANGES WITH MIGRATION 0022, WHICH IS
      // WRITTEN AND NOT YET RUN. Until it does, the view gates on
      // `is_friend_of` (0009:155) and this is the reader's MUTUAL friends.
      // After it, `i_follow` — the people the reader follows, who need not
      // follow back. This line needs no edit either way, which is the
      // point of not copying the rule; the comment is dated so the next
      // reader knows which world they are in.
      //
      // ⚠ AND THIS METHOD HAS TWO CALLERS, NOT ONE. `gekooktSource.ts`
      // builds Ontdek's proof cards from it, and `friendProof.ts` feeds
      // `FRIEND_PROOF_BOOST` into Kiezen's decision engine. So 0022
      // widens BOTH — see that migration's header.
      const { data, error } = await client.from('shared_cooks').select('profile_id, recipe_id');
      if (error) {
        fail('Reading cook proof', error);
      }
      return ((data ?? []) as SharedCookRow[]).map((row) => ({
        profileId: row.profile_id,
        recipeId: row.recipe_id,
      }));
    },

    async listSuggestedFriends(maxRows: number): Promise<readonly DomainSuggestedFriendRow[]> {
      // AN RPC AND NOT A SELECT, because there is no relation to select
      // from: `friendships_select` (0007) hides every row the caller is
      // not a party to, so the second hop only exists inside a
      // `security definer` function. See 0019's header.
      //
      // NO `.order()` AND NO `.range()`. The function orders and caps on
      // its own side — a client-side order on an RPC result would be a
      // second ranking over the same rows, and `selectFriendSuggestions`
      // is documented as preserving the order it receives.
      const { data, error } = await client.rpc('suggested_friends', { max_rows: maxRows });
      if (error) {
        fail('Reading friend suggestions', error);
      }
      return ((data ?? []) as SuggestedFriendRpcRow[]).map(toSuggestedFriend);
    },

    async sendRecipe(input: SendRecipeInput): Promise<RecipeShare> {
      // Both of these mirror CHECKs the database also keeps, and both are
      // here for the reason the header gives: a readable sentence at the
      // call site beats a constraint-violation code after a round trip.
      // Note the two clauses that are NOT here — the recipient being a
      // friend and the meal being your household's. Those are permission
      // rules, RLS refuses the write outright, and a pre-flight copy of a
      // permission rule is the copy that drifts. There is deliberately no
      // cook check of any kind either; 0009's header explains why the
      // gate was removed.
      if (input.senderProfileId === input.recipientProfileId) {
        throw new Error('Sending a dish to yourself is not a share.');
      }
      const note = normalizeSendNote(input.note);

      // `unique (meal_id, recipient_profile_id)` is the conflict target,
      // exactly as (recipe, rater) is for a rating: re-sending the same
      // dish to the same person amends the one offer rather than adding a
      // second card.
      //
      // WHAT IS ABSENT FROM THE PAYLOAD IS LOAD-BEARING. PostgREST's
      // merge updates only the columns present, so leaving out `seen_at`
      // is what keeps a re-send from marking a read card unread — the
      // withdraw-and-resend bell §3.2 refuses. `created_at` is left out
      // for the same mechanical reason plus one of its own: the database
      // defaults it on insert, and a client has no business minting a
      // timestamp the server already owns. `withdrawn_at` IS sent, as
      // null, because reviving a withdrawn row is the point of having
      // kept it.
      const { data, error } = await client
        .from('recipe_shares')
        .upsert(
          {
            meal_id: input.mealId,
            sender_profile_id: input.senderProfileId,
            recipient_profile_id: input.recipientProfileId,
            note,
            withdrawn_at: null,
          },
          { onConflict: 'meal_id,recipient_profile_id' },
        )
        .select()
        .single();

      if (error) {
        // No special-casing of 23505 here, unlike `upsertProfile`: the
        // unique key IS the conflict target, so a duplicate is resolved
        // by the merge rather than raised. What does arrive is 42501 when
        // RLS refuses — not a friend, not your meal — and `fail` keeps
        // that code, because it is the only thing that distinguishes the
        // two.
        fail('Sending a recipe', error);
      }
      return toRecipeShare(data as RecipeShareRow);
    },

    async withdrawSend(senderProfileId: ProfileId, mealId: MealId, recipientProfileId: ProfileId): Promise<void> {
      // AN UPDATE, NOT A DELETE, and 0009 makes that a schema fact rather
      // than a preference: the recipient-facing index is `where
      // withdrawn_at is null`, so the row's disappearance from that index
      // is what withdrawal means. Contrast `removeRecipeRating` above,
      // which really does DELETE — a withdrawn vote has to be
      // indistinguishable from no vote, while a withdrawn send has to
      // stay auditable and has to be the row a later re-send lands on.
      //
      // Three filters and a null test, each doing a job: `sender_profile_id`
      // is the application half of 0009's update policy (Postgres admits
      // both parties there because it cannot split the policy per column,
      // and says the application decides which side writes which) — a
      // recipient must not be able to un-send somebody else's gesture.
      // `is('withdrawn_at', null)` makes a second withdrawal match
      // nothing, so the first one's timestamp survives.
      const { error } = await client
        .from('recipe_shares')
        .update({ withdrawn_at: new Date().toISOString() })
        .eq('meal_id', mealId)
        .eq('recipient_profile_id', recipientProfileId)
        .eq('sender_profile_id', senderProfileId)
        .is('withdrawn_at', null);

      if (error) {
        fail('Withdrawing a send', error);
      }
    },

    async markSendsSeen(recipientProfileId: ProfileId): Promise<void> {
      // No share id anywhere in this statement, because there is none in
      // the signature to put here. §3.2: "no per-card read tracking,
      // because per-card tracking is the first brick of a read-receipt
      // system."
      //
      // `is('seen_at', null)` is where idempotence lives — a second call
      // matches no row and rewrites no stamp. `is('withdrawn_at', null)`
      // keeps the statement to exactly the rows `listSendsToMe` would
      // have returned: recording that somebody saw a card that was pulled
      // before they could is a false entry in the one column this system
      // keeps about their attention.
      const { error } = await client
        .from('recipe_shares')
        .update({ seen_at: new Date().toISOString() })
        .eq('recipient_profile_id', recipientProfileId)
        .is('seen_at', null)
        .is('withdrawn_at', null);

      if (error) {
        fail('Marking sends as seen', error);
      }
    },

    async listSendsToMe(recipientProfileId: ProfileId): Promise<readonly IncomingSend[]> {
      // `.is('withdrawn_at', null)`, never `.eq('withdrawn_at', null)` —
      // PostgREST's `eq` against null is not a null test and matches
      // nothing, which here would empty the Vrienden tab while every
      // other sign said the query had worked.
      //
      // The recipient filter is scoping, not permission: 0009's select
      // policy already limits this table to the two parties, so RLS is
      // what makes the answer safe and this is what makes it the right
      // answer. No `.order()` — see the interface: §3.2 owns the ordering
      // and has inputs this layer does not.
      const { data, error } = await client
        .from('recipe_shares')
        .select('*')
        .eq('recipient_profile_id', recipientProfileId)
        .is('withdrawn_at', null);

      if (error) {
        fail('Reading the sends waiting for you', error);
      }
      return ((data ?? []) as RecipeShareRow[]).map(toIncomingSend);
    },

    async listMealsSentToMe(recipientProfileId: ProfileId): Promise<readonly SentMeal[]> {
      // THREE READS, IN THIS ORDER, AND THE ORDER IS THE PERMISSION MODEL.
      // The first one is the only place a meal id can enter this method:
      // it comes out of a live `recipe_shares` row addressed to the
      // reader, never out of an argument, because the signature has none
      // to offer. Everything after it is `in (<those ids>)`.
      //
      // Note what the `in` filters are NOT doing. They are not the
      // permission — `has_active_send_to_me` in 0009's added select
      // policies is, and it is asked per row, so a meal id smuggled into
      // that list would still come back empty. They are the SCOPING, the
      // same division of labour `listSendsToMe` explains. The reason to
      // get the client-side half right anyway is that the same code runs
      // against the local store, where there is no RLS to fall back on.
      const { data: shareData, error: shareError } = await client
        .from('recipe_shares')
        .select('id, meal_id, sender_profile_id')
        .eq('recipient_profile_id', recipientProfileId)
        // `.is`, never `.eq(col, null)` — the latter is not a null test and
        // would return nothing at all while every other sign said the query
        // had worked. Same trap `listSendsToMe` documents.
        .is('withdrawn_at', null);

      if (shareError) {
        fail('Reading the dishes sent to you', shareError);
      }

      const shares = (shareData ?? []) as SentShareRow[];
      if (shares.length === 0) {
        // Answered here rather than by a query, because `in.()` with an
        // empty list is a PostgREST syntax error rather than an empty
        // result — the same edge `listCanonicalRecipes` below guards.
        return [];
      }

      const mealIds = [...new Set(shares.map((share) => share.meal_id))];
      const [mealResult, ingredientResult, stepResult] = await Promise.all([
        client.from('meals').select(SENT_MEAL_COLUMNS).in('id', mealIds),
        client.from('meal_ingredients').select(SENT_MEAL_INGREDIENT_COLUMNS).in('meal_id', mealIds),
        // Reads under `meal_steps_select_sent_to_me` (0009) exactly as the
        // ingredients read above reads under its own added policy — see
        // `SentMealStep`'s header (./types.ts) on why a step may cross
        // this boundary at all.
        client.from('meal_steps').select(SENT_MEAL_STEP_COLUMNS).in('meal_id', mealIds),
      ]);

      if (mealResult.error) {
        fail('Reading a dish somebody sent you', mealResult.error);
      }
      if (ingredientResult.error) {
        fail('Reading the ingredients of a dish somebody sent you', ingredientResult.error);
      }
      if (stepResult.error) {
        fail('Reading the steps of a dish somebody sent you', stepResult.error);
      }

      const mealsById = new Map((mealResult.data as SentMealRow[] | null ?? []).map((meal) => [meal.id, meal]));
      const ingredientRows = (ingredientResult.data as SentMealIngredientRow[] | null) ?? [];
      const stepRows = (stepResult.data as SentMealStepRow[] | null) ?? [];

      return shares.flatMap((share): readonly SentMeal[] => {
        const meal = mealsById.get(share.meal_id);
        if (meal === undefined) {
          // RLS declined the meal, or it was deleted underneath the share
          // — a race with a withdrawal is the realistic case. Dropped
          // rather than half-built: PD-010 promises a card that opens a
          // FULL recipe, so a partial one is a broken promise, not a
          // lesser card.
          return [];
        }
        return [
          toSentMeal(
            share,
            meal,
            ingredientRows.filter((row) => row.meal_id === meal.id),
            stepRows.filter((row) => row.meal_id === meal.id),
          ),
        ];
      });
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
        // `dish_tags` and `estimated_minutes` joined this projection on
        // 8 September 2026, for Trending's filter. They widen a projection
        // INSIDE a row this client can already read — 0006 grants SELECT on
        // `recipes` to every authenticated reader, and PD-014 rests its whole
        // safety argument on exactly that — so nothing new is exposed.
        .select('id, title, platform, author_name, thumbnail_url, dish_tags, estimated_minutes')
        .in('id', [...recipeIds]);

      if (error) {
        fail('Reading canonical recipes', error);
      }
      return ((data ?? []) as RecipeRow[]).map(toCanonicalRecipe);
    },

    async getCanonicalRecipe(recipeId: RecipeId): Promise<CanonicalRecipe | null> {
      // THE ROW FIRST, THE CHILDREN ONLY IF IT EXISTS. A missing recipe is
      // an ordinary answer (withdrawn, or deleted under a share), and two
      // reads about a row that is not there would be two round trips spent
      // learning nothing. `maybeSingle`, never `single`: an absent row is
      // null here, not an error.
      const { data, error } = await client
        .from('recipes')
        .select(CANONICAL_RECIPE_COLUMNS)
        .eq('id', recipeId)
        .maybeSingle();

      if (error) {
        fail('Reading a canonical recipe', error);
      }
      if (data === null) {
        return null;
      }

      // Both child tables are readable through `can_read_recipe` (0006),
      // which asks only that the parent exist and the caller be signed in —
      // the parent just answered, so these cannot be refused for a reason
      // the first read would not already have hit.
      const [ingredientResult, stepResult] = await Promise.all([
        client.from('recipe_ingredients').select(CANONICAL_RECIPE_INGREDIENT_COLUMNS).eq('recipe_id', recipeId),
        client.from('recipe_steps').select(CANONICAL_RECIPE_STEP_COLUMNS).eq('recipe_id', recipeId),
      ]);

      if (ingredientResult.error) {
        fail('Reading the ingredients of a canonical recipe', ingredientResult.error);
      }
      if (stepResult.error) {
        fail('Reading the steps of a canonical recipe', stepResult.error);
      }

      return toCanonicalRecipeDetail(
        data as CanonicalRecipeDetailRow,
        (ingredientResult.data as RecipeIngredientRow[] | null) ?? [],
        (stepResult.data as RecipeStepRow[] | null) ?? [],
      );
    },
  };
}

/**
 * The Supabase backend's half of PD-024's directed graph — the seven
 * methods of `RemyFollowGraphRepository` over `follows` and `blocks`
 * (supabase/migrations/0021_directed_graph.sql).
 *
 * WHY IT IS ITS OWN FILE. `supabaseSocialRepository.ts` stood at 747 lines
 * before this arrived and these seven methods are two hundred more; the
 * ceiling is 800, seven files in `src/` are already over it, and adding an
 * eighth quietly is exactly what ONTDEK-PLAN.md §1.5 refuses. But the
 * arithmetic is the smaller half of the argument: `localFollowGraph.ts`
 * splits the local backend on this same seam, and splitting BOTH backends
 * in the same place is what keeps them comparable. Two files with the same
 * shape can be read side by side; one file against half of another cannot,
 * and "observationally identical" is a claim somebody has to be able to
 * check by eye.
 *
 * IT IS I/O AND NOTHING ELSE, which is `supabaseSocialRepository.ts`'s rule
 * inherited whole rather than a new one: `applyFollowAction`,
 * `nextFollowFields`, `resolveFollowActorRole` and `isBlockStanding` are
 * called here exactly as `localFollowGraph.ts` calls them. A rule
 * re-expressed as a `.eq()` filter or an inline `if` would be a second copy
 * of a security decision, and the two copies would drift. What this file
 * decides is which STATEMENT goes over the wire, and nothing else.
 *
 * ============================================================================
 * ⚠ THE STATEMENT SHAPE IS A POLICY QUESTION HERE, NOT A STYLE ONE
 * ============================================================================
 *
 * `actOnFollow` and `blockProfile` both send an INSERT or an UPDATE and
 * never an upsert, and that is the finding `actOnFriendship` paid for in
 * production rather than a preference carried across for symmetry.
 * `.upsert(row, …)` travels as `INSERT ... ON CONFLICT DO UPDATE`, and for
 * that statement form Postgres checks the INSERT policy's WITH CHECK
 * against the new row EVEN WHEN the conflict takes the update branch. Both
 * insert policies in 0021 admit exactly one shape and no other:
 *
 *   `follows_insert` — `follower_id = auth.uid() AND status = 'pending'`
 *      plus the block anti-join. An upsert would therefore refuse every
 *      accept and every decline with 42501: those write a status the policy
 *      does not admit, and they are made by the FOLLOWEE, who is not
 *      `follower_id`. That is the entire answering half of this screen,
 *      refused by the statement form alone — the same way every answer to
 *      somebody else's friend request was refused for months.
 *   `blocks_insert` — `blocker_id = auth.uid() AND lifted_at is null`. A
 *      re-block does satisfy that today, so this one is defence rather than
 *      a measured failure; it is written the same way so the two paths
 *      cannot diverge the next time a policy is tightened.
 *
 * Neither payload carries `id`, and neither carries a timestamp the
 * database defaults (`follows.created_at`, `blocks.blocked_at` ON INSERT).
 * The client has no business minting a key or a clock reading Postgres
 * already owns — `actOnFriendship` states the same rule at its own write.
 *
 * ============================================================================
 * WHAT IS DELIBERATELY NOT FILTERED, IN TWO PLACES
 * ============================================================================
 *
 * `listFollows` returns every status in both directions, and `listBlocks`
 * returns lifted rows as well as standing ones. Both are contract rather
 * than laziness and ./followGraph carries the full argument for each: a
 * pending request you cannot see is one you can neither answer nor
 * withdraw, and a lifted block still invalidates every follow accepted
 * before it, so a caller handed only the standing ones would silently
 * restore consents nobody re-granted. Filtering either here would also put
 * a second definition of "counts" next to `follow.ts`'s, and the two would
 * eventually disagree.
 */

import {
  applyFollowAction,
  isBlockStanding,
  nextFollowFields,
  resolveFollowActorRole,
} from '@/domain/social/follow';
import type { Block, Follow, FollowAction, ProfileId } from '@/domain/social/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemyFollowGraphRepository } from './followGraph';
import { fail, toBlock, toFollow, type BlockRow, type FollowRow } from './supabaseRowMapping';

/**
 * Every column of `follows`, spelled out for the reason `SENT_MEAL_COLUMNS`
 * is spelled out: a `*` projection is as wide as the table happens to be
 * today, and the day somebody adds a column to this one is the day a `*`
 * starts carrying it into the domain unasked.
 */
const FOLLOW_COLUMNS = 'id, follower_id, followee_id, status, created_at, responded_at';

const BLOCK_COLUMNS = 'id, blocker_id, blocked_id, blocked_at, lifted_at';

/**
 * The one client-side comparison in this file, and it exists so both
 * backends refuse the same input with the same sentence —
 * `localFollowGraph.ts`'s `sameProfile` normalizes exactly this way.
 *
 * ⚠ THE QUERIES BELOW DO NOT NORMALIZE, and that asymmetry is intended. A
 * `.eq()` against a `uuid` column has to carry the id the caller actually
 * holds; Postgres owns what equals what on that column, and a client
 * quietly rewriting an id before asking for it would be this file deciding
 * something. Normalizing the guard is a readable refusal at the call site;
 * normalizing a query would be a lookup that finds a row the database says
 * is a different one.
 */
function sameProfile(left: ProfileId, right: ProfileId): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function createSupabaseFollowGraph(client: SupabaseClient): RemyFollowGraphRepository {
  /**
   * The row for ONE DIRECTION — `getFollowBetween`, and the probe
   * `actOnFollow` runs twice. One function rather than two so there is a
   * single definition of "the row from A to B": the direction is the entire
   * difference between this graph and `friendships`, and it is not a thing
   * to spell out in two places.
   *
   * `unique (follower_id, followee_id)` is what makes `maybeSingle` safe —
   * the pair matches one row or none, never two. `maybeSingle` and never
   * `single`, because "no row" is the ordinary answer here rather than an
   * error.
   */
  async function readDirectedFollow(
    followerProfileId: ProfileId,
    followeeProfileId: ProfileId,
  ): Promise<Follow | null> {
    const { data, error } = await client
      .from('follows')
      .select(FOLLOW_COLUMNS)
      .eq('follower_id', followerProfileId)
      .eq('followee_id', followeeProfileId)
      .maybeSingle();
    if (error) {
      fail('Reading a follow', error);
    }
    return data === null ? null : toFollow(data as FollowRow);
  }

  /**
   * Every block this profile is a party to, in either direction, standing
   * or lifted — the read behind `listBlocks` and behind `actOnFollow`'s
   * `isBlocked`.
   *
   * NO `is('lifted_at', null)` FILTER, not even for the `isBlocked` caller,
   * because narrowing the read would move the rule into the query.
   * `isBlockStanding` is the domain's answer to "does a block stand between
   * these two", `follow.ts` states why that answer is
   * direction-insensitive, and it takes rows. A `.is()` here would be a
   * filter that agrees with that function today and is nobody's job to keep
   * agreeing with it tomorrow.
   */
  async function readBlocksFor(profileId: ProfileId): Promise<readonly Block[]> {
    const { data, error } = await client
      .from('blocks')
      .select(BLOCK_COLUMNS)
      .or(`blocker_id.eq.${profileId},blocked_id.eq.${profileId}`);
    if (error) {
      fail('Listing blocks', error);
    }
    return ((data ?? []) as BlockRow[]).map(toBlock);
  }

  /** A block row for one ORDERED pair, standing or lifted — `unique (blocker_id, blocked_id)` makes this at most one row. */
  async function readBlockRow(blockerProfileId: ProfileId, blockedProfileId: ProfileId): Promise<Block | null> {
    const { data, error } = await client
      .from('blocks')
      .select(BLOCK_COLUMNS)
      .eq('blocker_id', blockerProfileId)
      .eq('blocked_id', blockedProfileId)
      .maybeSingle();
    if (error) {
      fail('Reading a block', error);
    }
    return data === null ? null : toBlock(data as BlockRow);
  }

  return {
    async listFollows(profileId: ProfileId): Promise<readonly Follow[]> {
      // Both directions in one OR, the shape `listFriendships` uses.
      // `follows_select` (0021) already narrows to the rows the caller is a
      // party to, so this filter is not the permission — it is the reader
      // saying which of their own rows they want, which is all of them.
      const { data, error } = await client
        .from('follows')
        .select(FOLLOW_COLUMNS)
        .or(`follower_id.eq.${profileId},followee_id.eq.${profileId}`);
      if (error) {
        fail('Listing follows', error);
      }
      return ((data ?? []) as FollowRow[]).map(toFollow);
    },

    async getFollowBetween(followerProfileId: ProfileId, followeeProfileId: ProfileId): Promise<Follow | null> {
      return readDirectedFollow(followerProfileId, followeeProfileId);
    },

    async actOnFollow(
      actorProfileId: ProfileId,
      otherProfileId: ProfileId,
      action: FollowAction,
    ): Promise<Follow> {
      if (sameProfile(actorProfileId, otherProfileId)) {
        throw new Error('A follow needs two different profiles — the same profile twice is not a relationship.');
      }

      // ⚠ BOTH ORIENTATIONS ARE FETCHED, AND THAT IS THE HEART OF THIS
      // METHOD. The direction is the ROW's and never the actor's: on
      // `accept` and `decline` the actor is the FOLLOWEE of a row somebody
      // else opened, so a single (actor -> other) probe would find nothing
      // and turn every answer into a fresh request pointing the wrong way.
      // `resolveFollowActorRole` says which side the actor is on once the
      // row is in hand.
      //
      // ⚠ WHICH ROW THIS ACTS ON IS DECIDED BY THE ACTION, NOT BY A
      // FALLBACK. ~~The actor's own direction wins when both rows exist.~~
      // That tie-break was wrong, and `localFollowGraph.ts` carried the
      // identical defect — one design, two copies of it.
      //
      // `own ?? other` is right for `accept` and `decline`, where the actor
      // is the FOLLOWEE of a row somebody else opened. Applied to `request`
      // it is wrong: a request names a direction that has NO row yet, so
      // with any row standing the other way the fallback handed the
      // transition table that row and the move came back refused —
      // `already_following` from accepted, `already_pending` from pending.
      // A second row for a pair could therefore never be created through
      // this path, which is the entire thing migration 0021 exists to
      // enable and the owner's own sentence: *"als je wil terugvolgen"*.
      //
      // Stated positively: a REQUEST is about the row I would own, full
      // stop. An ANSWER is about the row pointing at me, and there the
      // fallback stays: without it, a follower tapping accept on their OWN
      // request would find nothing and be told `no_pending_request`, when
      // the transition table has a sharper and truer answer ready —
      // `not_followee`, the one rule 0021's trigger also enforces
      // server-side.
      //
      // BOTH DIRECTIONS ARE STILL READ, and that is deliberate rather than
      // leftover: the two reads are parallel and free, and keeping them
      // means this method can say WHICH row it chose in one expression
      // instead of branching its I/O on its argument. Three reads in
      // parallel rather than in sequence for the same reason — none of them
      // informs another, and `actOnFollow` sits behind a button.
      const [ownDirection, otherDirection, blocks] = await Promise.all([
        readDirectedFollow(actorProfileId, otherProfileId),
        readDirectedFollow(otherProfileId, actorProfileId),
        readBlocksFor(actorProfileId),
      ]);
      const existing = action === 'request' ? ownDirection : (otherDirection ?? ownDirection);

      // The transition table is the domain's, and 0021's trigger plus
      // `follows_insert` enforce the security-critical half of it
      // server-side. Running it here first turns an illegal move into a
      // readable sentence instead of a trigger exception after a round
      // trip, and costs rows that were fetched anyway.
      //
      // `isBlocked` asks the DOMAIN about the rows, never the query about
      // the pair: a block STANDING in either direction refuses every move,
      // and a LIFTED one refuses none — it refuses an old ACCEPTANCE, which
      // is `followSurvivesBlocks`'s question and a different one.
      // `blocks_select` lets the actor read every row they are a party to,
      // the ones where the other person is the blocker included, so this
      // list is complete for this pair.
      const result = applyFollowAction({
        from: existing?.status ?? null,
        action,
        actor: resolveFollowActorRole(existing, actorProfileId),
        isBlocked: isBlockStanding(blocks, actorProfileId, otherProfileId),
      });
      if (!result.ok) {
        // The domain's reason code travels verbatim into the message, as it
        // does in `actOnFriendship` and in the local store: the UI maps it
        // to Dutch copy, and whoever reads a log wants the same word the
        // transition table uses.
        throw new Error(`Cannot ${action} this follow: ${result.reason}.`);
      }

      const fields = nextFollowFields(
        existing,
        actorProfileId,
        otherProfileId,
        result.status,
        new Date().toISOString(),
      );
      const row = {
        follower_id: fields.followerId,
        followee_id: fields.followeeId,
        status: fields.status,
        responded_at: fields.respondedAt,
      };

      // BOTH SIDES ARE WRITTEN ON THE UPDATE TOO, and unlike
      // `actOnFriendship` that is NOT because they can move — here they
      // never can. `nextFollowFields` returns the existing row's sides
      // unchanged on every transition (⚠ it says so: "THE SIDES NEVER
      // SWAP"), and 0021's trigger raises on any change to either column.
      // Restating them is therefore an assertion that they did not move: if
      // some future edit to the domain ever swapped them, this fails loudly
      // at the trigger instead of writing a status onto a row that now
      // points the other way.
      const { data, error } =
        existing === null
          ? await client.from('follows').insert(row).select(FOLLOW_COLUMNS).single()
          : await client.from('follows').update(row).eq('id', existing.id).select(FOLLOW_COLUMNS).single();

      if (error) {
        fail(`Recording "${action}" on a follow`, error);
      }
      return toFollow(data as FollowRow);
    },

    async removeFollow(followerProfileId: ProfileId, followeeProfileId: ProfileId): Promise<void> {
      // ONE STATEMENT AND NO PRE-READ, which is where this parts company
      // with `removeFriendship`. That method reads first because it has a
      // decision to make — only the blocker may remove a blocked row — and
      // 0021 deleted that decision along with `friendships.blocked_by`: a
      // block is not in this table, so there is no exception left to carve
      // and BOTH parties may end a follow. The follower unfollows or
      // withdraws, the followee removes a follower, and `follows_delete`
      // names both. With nothing left to decide, a read would only be a
      // round trip spent re-learning what the DELETE is about to find out.
      //
      // Direction-sensitive, and the two `.eq()`s are what make it so: this
      // removes the row FROM follower TO followee and never the one
      // pointing back, which on a mutual follow is somebody else's row.
      // A DELETE that matches nothing is already the no-op the contract
      // asks for — "we never followed" and "we no longer follow" are the
      // same end state.
      const { error } = await client
        .from('follows')
        .delete()
        .eq('follower_id', followerProfileId)
        .eq('followee_id', followeeProfileId);
      if (error) {
        fail('Removing a follow', error);
      }
    },

    async listBlocks(profileId: ProfileId): Promise<readonly Block[]> {
      return readBlocksFor(profileId);
    },

    async blockProfile(blockerProfileId: ProfileId, blockedProfileId: ProfileId): Promise<Block> {
      if (sameProfile(blockerProfileId, blockedProfileId)) {
        throw new Error('A profile cannot block itself.');
      }

      const existing = await readBlockRow(blockerProfileId, blockedProfileId);
      // IDEMPOTENT ON A STANDING BLOCK, and answered with no statement at
      // all. There is genuinely nothing for a re-block to change: a
      // standing block already refuses every move, and no acceptance can
      // land while it stands, so moving `blocked_at` forward could not
      // invalidate anything it has not invalidated already. What a needless
      // UPDATE would do is rewrite the date on a decision nobody touched.
      if (existing !== null && existing.liftedAt === null) {
        return existing;
      }

      // A RE-BLOCK AFTER A LIFT MOVES `blocked_at` FORWARD, and that is the
      // mechanism rather than bookkeeping: `followSurvivesBlocks` here and
      // `follow_survives_blocks(...)` in 0021 both compare a follow's
      // `responded_at` against this column, so a re-block that kept the old
      // date would leave an acceptance given between the lift and the
      // re-block counting for ever.
      //
      // ⚠ THE TIMESTAMP IS THE CLIENT'S CLOCK, and `guard_block_transition`
      // refuses a backwards move. A client running behind the row's own
      // `blocked_at` therefore fails loudly with the trigger's sentence,
      // which is the right direction to fail in: the alternative is a block
      // that reaches back past an acceptance it should have invalidated.
      const stamped = { blocked_at: new Date().toISOString(), lifted_at: null };
      const { data, error } =
        existing === null
          ? // `blocked_at` is absent from the INSERT on purpose — the column
            // defaults to `now()` in 0021, server-side, and an insert is the
            // one path where the database can supply it. `lifted_at` is
            // absent for the same reason, and its own default is what
            // satisfies `blocks_insert`'s `lifted_at is null`.
            await client
              .from('blocks')
              .insert({ blocker_id: blockerProfileId, blocked_id: blockedProfileId })
              .select(BLOCK_COLUMNS)
              .single()
          : await client.from('blocks').update(stamped).eq('id', existing.id).select(BLOCK_COLUMNS).single();

      if (error) {
        fail('Blocking a profile', error);
      }
      return toBlock(data as BlockRow);
    },

    async liftBlock(blockerProfileId: ProfileId, blockedProfileId: ProfileId): Promise<void> {
      // AN UPDATE, NEVER A DELETE, and 0021 makes that a schema fact rather
      // than a preference: there is no delete policy on `blocks` at all.
      // Removing the row would take `blocked_at` with it, and `blocked_at`
      // is exactly what keeps a follow accepted before the block from
      // springing back to life the moment it is lifted. Lifting restores
      // the ability to ASK and never the answer somebody already gave.
      //
      // ONE STATEMENT, no pre-read, in `withdrawSend`'s shape and for its
      // reason: `is('lifted_at', null)` makes a second lift match nothing,
      // so the first one's timestamp survives, and a pair with no row
      // matches nothing either. Both of the local store's early returns are
      // therefore this one filter, expressed where the row is.
      //
      // `blocker_id` is named as a filter and not left to the policy, even
      // though `blocks_update` says the same thing. That is not a
      // duplicated permission but the ORDERED PAIR being addressed: the
      // (blocker -> blocked) row is a different row from (blocked ->
      // blocker), and only the first one is this caller's to lift.
      const { error } = await client
        .from('blocks')
        .update({ lifted_at: new Date().toISOString() })
        .eq('blocker_id', blockerProfileId)
        .eq('blocked_id', blockedProfileId)
        .is('lifted_at', null);
      if (error) {
        fail('Lifting a block', error);
      }
    },
  };
}

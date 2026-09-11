/**
 * The local backend's half of PD-024's directed graph — the in-memory twin
 * of what `supabase/migrations/0021_directed_graph.sql` enforces in
 * Postgres.
 *
 * WHY IT IS ITS OWN FILE. `localSocialRepository.ts` was 733 lines before
 * this arrived and this is a hundred and eighty more; the ceiling is 800
 * and seven files in `src/` are already over it. The seam is real rather
 * than arithmetic: `follows` and `blocks` are one subject with one set of
 * rules, and `RemyFollowGraphRepository` (./followGraph) already names it.
 * That interface is what this factory returns, so the split on the
 * implementation side and the split on the type side are the same split.
 *
 * IT DECIDES NOTHING. Every rule lives in `src/domain/social/follow.ts` —
 * which move is legal, who may make it, what the resulting row holds — and
 * this file mints an id, stamps a time, and writes. That is the same
 * division `localSocialRepository` keeps for friendships, and it is the
 * reason `npm test` can enumerate the whole transition table without a
 * database.
 *
 * TWO ACCESSORS AND NOT THE WHOLE TABLE SET, deliberately narrowed the way
 * `RecipeCopySink` and `SendAudienceSource` are: a question about who
 * follows whom can never grow into a read of somebody's meals.
 */

import {
  applyFollowAction,
  nextFollowFields,
  resolveFollowActorRole,
} from '@/domain/social/follow';
import type { Block, Follow, FollowAction, FollowStatus, ProfileId } from '@/domain/social/types';
import { nowIso } from '../clock';
import { generateLocalId } from '../id';
import type { TableAccessor } from '../table';
import type { RemyFollowGraphRepository } from './followGraph';

/** The two tables this factory owns, and no others — see the file header. */
export interface FollowGraphTables {
  readonly follows: TableAccessor<Follow>;
  readonly blocks: TableAccessor<Block>;
}

/** Matches `friendshipPairKey`'s comparison rule, so lookups and stored ids never disagree about case. */
function sameProfile(left: ProfileId, right: ProfileId): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function replaceOrAppend<T extends { readonly id: string }>(rows: readonly T[], row: T): readonly T[] {
  const index = rows.findIndex((candidate) => candidate.id === row.id);
  if (index === -1) {
    return [...rows, row];
  }
  return [...rows.slice(0, index), row, ...rows.slice(index + 1)];
}

/**
 * The row a legal follow action produces: the domain decides every field
 * that is a rule, this adds only the two a local store owns — an id it
 * mints and a creation time it stamps. Postgres defaults both, which is
 * exactly why they are not in `nextFollowFields`.
 */
function nextFollow(
  existing: Follow | null,
  actorProfileId: ProfileId,
  otherProfileId: ProfileId,
  status: FollowStatus,
): Follow {
  const timestamp = nowIso();
  return {
    id: existing?.id ?? generateLocalId('follow'),
    createdAt: existing?.createdAt ?? timestamp,
    ...nextFollowFields(existing, actorProfileId, otherProfileId, status, timestamp),
  };
}

/**
 * The row for ONE DIRECTION. Direction-sensitive, unlike `findPairRow` in
 * `localSocialRepository` — which is the entire difference between the two
 * graphs, and the reason this is a second function rather than a parameter
 * on that one.
 */
function findDirectedRow(
  follows: readonly Follow[],
  followerProfileId: ProfileId,
  followeeProfileId: ProfileId,
): Follow | null {
  return (
    follows.find(
      (follow) =>
        sameProfile(follow.followerId, followerProfileId) && sameProfile(follow.followeeId, followeeProfileId),
    ) ?? null
  );
}

/** A block row for one ORDERED pair, standing or lifted — `blocks` is unique on (blocker, blocked). */
function findBlockRow(
  blocks: readonly Block[],
  blockerProfileId: ProfileId,
  blockedProfileId: ProfileId,
): Block | null {
  return (
    blocks.find(
      (block) => sameProfile(block.blockerId, blockerProfileId) && sameProfile(block.blockedId, blockedProfileId),
    ) ?? null
  );
}

/**
 * Mirrors 0021's `follows_insert` block anti-join and `applyFollowAction`'s
 * `isBlocked` field: a block STANDING in either direction refuses every
 * move.
 *
 * Lifted rows do not refuse a MOVE — they refuse an old ACCEPTANCE, which
 * is `followSurvivesBlocks`'s job and a different question. Conflating the
 * two would mean a lifted block permanently prevented asking again, which
 * is not what lifting one means.
 */
function isBlockedEitherWay(blocks: readonly Block[], profileA: ProfileId, profileB: ProfileId): boolean {
  return blocks.some(
    (block) =>
      block.liftedAt === null &&
      ((sameProfile(block.blockerId, profileA) && sameProfile(block.blockedId, profileB)) ||
        (sameProfile(block.blockerId, profileB) && sameProfile(block.blockedId, profileA))),
  );
}

export function createLocalFollowGraph(tables: FollowGraphTables): RemyFollowGraphRepository {
  return {
    async listFollows(profileId: ProfileId): Promise<readonly Follow[]> {
      const follows = await tables.follows.list();
      return follows.filter(
        (follow) => sameProfile(follow.followerId, profileId) || sameProfile(follow.followeeId, profileId),
      );
    },

    async getFollowBetween(
      followerProfileId: ProfileId,
      followeeProfileId: ProfileId,
    ): Promise<Follow | null> {
      return findDirectedRow(await tables.follows.list(), followerProfileId, followeeProfileId);
    },

    async actOnFollow(
      actorProfileId: ProfileId,
      otherProfileId: ProfileId,
      action: FollowAction,
    ): Promise<Follow> {
      if (sameProfile(actorProfileId, otherProfileId)) {
        throw new Error('A follow needs two different profiles — the same profile twice is not a relationship.');
      }

      const [follows, blocks] = await Promise.all([tables.follows.list(), tables.blocks.list()]);
      // ⚠ WHICH ROW THIS ACTS ON IS DECIDED BY THE ACTION, NOT BY A
      // FALLBACK, and getting that wrong made following back impossible.
      //
      // The bug this replaces: `own ?? other`. That fallback is right for
      // `accept` and `decline`, where the actor is the FOLLOWEE of a row
      // somebody else opened — but it was applied to `request` too, and
      // there it is wrong. A request names a direction that has NO row yet.
      // With any row standing in the other direction, the fallback handed
      // the transition table that row and the move came back refused:
      // `already_following` from accepted, `already_pending` from pending.
      // So a second row for a pair could never be created through this
      // path at all — and two rows per pair is the entire thing migration
      // 0021 exists to enable, the thing `collectMutualFollowIds`,
      // `partitionFollows`' following/followers split and `is_friend_of`'s
      // rewritten body all rest on, and the owner's own sentence: *"als je
      // wil terugvolgen"*.
      //
      // Found by tests/repository/localFollowGraph.test.ts before either
      // backend shipped, which is the reason that file seeds its rows
      // through the table accessor rather than through this method.
      //
      // Stated positively: a REQUEST is about the row I would own, full
      // stop — no fallback, because there is no other row it could mean.
      // An ANSWER is about the row pointing at me, and there the fallback
      // stays, for one specific reason: without it, a follower tapping
      // accept on their OWN request would find nothing and be told
      // `no_pending_request`, when the transition table has a sharper and
      // truer answer ready — `not_followee`, the one rule 0021's trigger
      // also enforces server-side. Handing the table the row it can
      // actually judge is what keeps that branch reachable instead of
      // dead.
      const existing =
        action === 'request'
          ? findDirectedRow(follows, actorProfileId, otherProfileId)
          : findDirectedRow(follows, otherProfileId, actorProfileId) ??
            findDirectedRow(follows, actorProfileId, otherProfileId);

      const result = applyFollowAction({
        from: existing?.status ?? null,
        action,
        actor: resolveFollowActorRole(existing, actorProfileId),
        isBlocked: isBlockedEitherWay(blocks, actorProfileId, otherProfileId),
      });
      if (!result.ok) {
        // The domain's reason code travels verbatim into the message, for
        // `actOnFriendship`'s reason: the UI maps it to Dutch copy, and
        // whoever reads a log wants the same word the transition table
        // uses.
        throw new Error(`Cannot ${action} this follow: ${result.reason}.`);
      }

      const follow = nextFollow(existing, actorProfileId, otherProfileId, result.status);
      await tables.follows.replaceAll(replaceOrAppend(follows, follow));
      return follow;
    },

    async removeFollow(followerProfileId: ProfileId, followeeProfileId: ProfileId): Promise<void> {
      const follows = await tables.follows.list();
      const existing = findDirectedRow(follows, followerProfileId, followeeProfileId);
      if (existing === null) {
        // Already gone. Mirrors a DELETE that matches no row: nothing to
        // do, and nothing worth an error either.
        return;
      }
      // NO BLOCKER CHECK, and its absence is the point. `removeFriendship`
      // needed one because a blocked row lived in that table and the
      // blocked party could delete it; 0021 moved blocks out precisely so
      // this method has no exception to carve. Both parties may end a
      // follow — the follower unfollows, the followee removes a follower.
      await tables.follows.replaceAll(follows.filter((follow) => follow.id !== existing.id));
    },

    async listBlocks(profileId: ProfileId): Promise<readonly Block[]> {
      const blocks = await tables.blocks.list();
      // Lifted rows are returned too: a lifted block still invalidates any
      // follow accepted before it, so filtering them here would silently
      // restore consents nobody re-granted.
      return blocks.filter(
        (block) => sameProfile(block.blockerId, profileId) || sameProfile(block.blockedId, profileId),
      );
    },

    async blockProfile(blockerProfileId: ProfileId, blockedProfileId: ProfileId): Promise<Block> {
      if (sameProfile(blockerProfileId, blockedProfileId)) {
        throw new Error('A profile cannot block itself.');
      }
      const blocks = await tables.blocks.list();
      const existing = findBlockRow(blocks, blockerProfileId, blockedProfileId);
      // Idempotent on a standing block, and a re-block after a lift moves
      // `blockedAt` FORWARD — which is what makes an acceptance from
      // before it stop counting again. 0021's trigger refuses a backwards
      // move for the same reason.
      if (existing !== null && existing.liftedAt === null) {
        return existing;
      }
      const block: Block = {
        id: existing?.id ?? generateLocalId('block'),
        blockerId: blockerProfileId,
        blockedId: blockedProfileId,
        blockedAt: nowIso(),
        liftedAt: null,
      };
      await tables.blocks.replaceAll(replaceOrAppend(blocks, block));
      return block;
    },

    async liftBlock(blockerProfileId: ProfileId, blockedProfileId: ProfileId): Promise<void> {
      const blocks = await tables.blocks.list();
      const existing = findBlockRow(blocks, blockerProfileId, blockedProfileId);
      if (existing === null || existing.liftedAt !== null) {
        return;
      }
      // Stamped, never removed. `blockedAt` has to survive: lifting
      // restores the ability to ASK and never the answer somebody already
      // gave, and that comparison is the whole mechanism.
      await tables.blocks.replaceAll(replaceOrAppend(blocks, { ...existing, liftedAt: nowIso() }));
    },
  };
}

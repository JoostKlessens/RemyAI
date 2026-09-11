/**
 * The repository seam for the DIRECTED graph — follows and blocks
 * (PD-024, supabase/migrations/0021_directed_graph.sql).
 *
 * WHY IT IS ITS OWN FILE AND NOT MORE LINES ON `RemySocialRepository`.
 * `social/types.ts` was 745 lines before this arrived and this is eighty
 * more; the ceiling is 800, seven files in `src/` are already over it, and
 * ONTDEK-PLAN.md §1.5 is explicit that adding an eighth is not a thing to
 * do quietly. Splitting on a real seam is better than splitting on a line
 * count, and there is a real one here: this is the graph, everything left
 * behind is what hangs off it.
 *
 * `RemySocialRepository extends` this, so callers still see one object and
 * one implementation per backend. The interface split is a reading aid and
 * a file-size answer, never a second repository to obtain.
 *
 * ============================================================================
 * ⚠ THIS IS THE TRUTH; `Friendship` IS THE FROZEN COPY
 * ============================================================================
 *
 * From migration 0021 onwards `follows` is the graph, and
 * `is_friend_of` — the second RLS predicate of this whole product — is
 * DERIVED from it: two accepted rows, one each way, with no block between
 * them since. The four `Friendship` methods on `RemySocialRepository` read
 * a table that stopped being the truth the moment 0021 ran. They survive
 * because the table survives, and the table survives because 0021 touches
 * live data and it is the only way back. Whoever drops `friendships` drops
 * those four with it.
 *
 * ============================================================================
 * WHY THERE IS NO `listFriendsOf`-STYLE CONVENIENCE HERE
 * ============================================================================
 *
 * "Who am I connected to" used to have one answer and now has three — I
 * follow them, they follow me, mutual — and which one a surface wants is a
 * decision somebody made about that surface (ONTDEK-PLAN.md O-11b's
 * table: the feed takes "ik volg hen", every send path takes "wederzijds").
 * So this seam returns ROWS, and `src/domain/social/follow.ts` answers the
 * question by name, once per meaning. A method called `listFriends` would
 * put that decision back inside a fetch, where no test can reach it — the
 * exact hole `collectAcceptedFriendIds` was extracted to close.
 */

import type { Block, Follow, FollowAction, ProfileId } from '@/domain/social/types';

export interface RemyFollowGraphRepository {
  /**
   * Every follow row this profile is a party to, in either direction and
   * whatever its status — pending requests both ways included, because you
   * cannot answer a request you cannot see, nor withdraw one.
   *
   * UNFILTERED BY BLOCKS ON PURPOSE. `follow.ts`'s collectors take the
   * blocks alongside the rows and apply them; filtering here as well would
   * be a second definition of "counts", and the two would eventually
   * disagree. Read it with `listBlocks` and hand both to the domain.
   */
  listFollows(profileId: ProfileId): Promise<readonly Follow[]>;
  /** The row for ONE DIRECTION, or null. Direction-sensitive, unlike `getFriendshipBetween` — that is the whole difference between the two graphs. */
  getFollowBetween(followerProfileId: ProfileId, followeeProfileId: ProfileId): Promise<Follow | null>;
  /**
   * The one write path for a follow. Runs the action through
   * `applyFollowAction` (src/domain/social/follow.ts) and rejects an
   * illegal move rather than silently doing nothing — a UI that offered a
   * button it should not have needs to hear about it.
   *
   * ⚠ THE PAIR IS ORDERED HERE. `actorProfileId` is not automatically the
   * follower: on `accept` and `decline` the actor is the FOLLOWEE of a row
   * that already exists. The direction comes from the existing row, or from
   * (actor -> other) when there is none, exactly as `nextFollowFields`
   * decides it.
   */
  actOnFollow(actorProfileId: ProfileId, otherProfileId: ProfileId, action: FollowAction): Promise<Follow>;
  /**
   * Unfollow, withdraw your own request, or remove a follower — all the
   * same delete, and BOTH parties may perform it on a row they are in.
   *
   * That is a real widening from `removeFriendship`, which had to refuse
   * the blocked party. There is no exception left to carve: a block is not
   * in this table (see `blockProfile`).
   *
   * Direction-sensitive: it removes the row FROM follower TO followee and
   * never the one pointing back. Removing a pair that has no row is a
   * no-op, mirroring a DELETE that matches nothing.
   */
  removeFollow(followerProfileId: ProfileId, followeeProfileId: ProfileId): Promise<void>;

  /**
   * Every block this profile is a party to, standing or lifted.
   *
   * ⚠ LIFTED ROWS ARE RETURNED, and that is not laziness. A lifted block
   * still invalidates any follow accepted before it — see
   * `followSurvivesBlocks` — so a caller handed only the standing ones
   * would silently restore consents that were never re-granted.
   */
  listBlocks(profileId: ProfileId): Promise<readonly Block[]>;
  /**
   * Block somebody, or re-block somebody previously lifted. Idempotent on
   * a standing block.
   *
   * A block needs no relationship to exist first — blocking somebody who
   * never asked is ordinary, and 0021 made that cheaper than it was, since
   * it no longer means manufacturing a friendship row to hang a flag on.
   */
  blockProfile(blockerProfileId: ProfileId, blockedProfileId: ProfileId): Promise<Block>;
  /**
   * "Deblokkeren". Sets `liftedAt` and NEVER removes the row, because
   * `blockedAt` has to survive: lifting restores the ability to ask and
   * never the answer somebody already gave. Only the blocker may.
   */
  liftBlock(blockerProfileId: ProfileId, blockedProfileId: ProfileId): Promise<void>;
}

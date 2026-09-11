/**
 * The directed graph: which moves are legal on a follow, who may make
 * them, and the three different questions a caller can now ask about two
 * people (PD-024, supabase/migrations/0021_directed_graph.sql).
 *
 * WHY THIS IS A DOMAIN MODULE AND NOT A REPOSITORY METHOD, in
 * friendship.ts's words because the argument is unchanged: "May Joost
 * accept this?" is a rule, not a write. Put it inside the function that
 * performs the UPDATE and it exists once per backend, and the copies
 * drift. Put it here and every write path asks the same function, `npm
 * test` can enumerate the whole table without a database, and the
 * migration's trigger only has to defend the rules whose failure is a
 * privacy breach rather than restate all of them.
 *
 * ============================================================================
 * WHAT CHANGED FROM friendship.ts, AND WHY IT IS A NEW FILE
 * ============================================================================
 *
 * `friendships` holds ONE ROW PER UNORDERED PAIR — its own header says the
 * table is "built around" that unique constraint. Following back is a
 * SECOND DIRECTED ROW for the same two people, so the constraint the old
 * table is built around is exactly the one a follow model has to drop.
 * That is a rewrite wearing the old name, which is why `follows` is its own
 * table and this is its own module.
 *
 * Three concrete differences, each of which would be a bug if copied over:
 *
 *   1. NO PAIR KEY. `friendshipPairKey` exists because the database files a
 *      pair under `least`/`greatest` and the client has to look it up under
 *      the identical key. A directed row is filed under (follower,
 *      followee) in that order, so there is nothing to canonicalise and no
 *      lowercase-ordering subtlety to get wrong. The whole ordered-pair
 *      argument in friendship.ts's header does not apply here.
 *   2. NO SIDE SWAP ON A RE-REQUEST. There, a re-request out of 'declined'
 *      legitimately swaps requester and addressee, because whoever is
 *      asking now is the requester. Here the row IS the direction: a swap
 *      would turn "I asked to follow you" into "you asked to follow me",
 *      which is the escalation 0021's trigger refuses outright.
 *   3. NO 'blocked' STATUS. A block is `Block`, a separate object owned by
 *      the blocker. See `FollowStatus` in ./types for why a directed row
 *      cannot carry one.
 *
 * ============================================================================
 * THE TRANSITION TABLE, AND THE THREE DECISIONS INSIDE IT
 * ============================================================================
 *
 *   1. Only the followee may accept or decline. A follower accepting their
 *      own request would hand themselves the per-person consent this whole
 *      decision rests on, with nobody having agreed to anything. This is
 *      the rule 0021's trigger also enforces, because a rule that lives
 *      only in the client is a rule anyone holding a REST token can skip.
 *   2. `declined` is not terminal — a re-request is legal, by the follower.
 *      ⚠ THE REASON IS NOT friendship.ts's REASON, and copying that one
 *      across would be copying an argument that no longer holds. There, a
 *      declined row WAS the unordered pair, so leaving it terminal made one
 *      "no" permanent for both people forever. Here the follower owns their
 *      own row and may remove it, so a declined follow is never a tombstone
 *      on anybody's ability to ask. What makes it legal instead is that
 *      refusing it would buy nothing: the follower can drop the row and
 *      insert a fresh one, reaching an indistinguishable state, so a
 *      terminal 'declined' would cost a statement and prevent nothing.
 *      friendship.ts already wrote the honest version — "whether asking
 *      again is welcome is a rate-limiting question for a later phase, not
 *      a reason to make one 'no' permanent for both people" — and the
 *      person asked now holds two stronger instruments: decline again, or
 *      block, which 0021 makes genuinely enforceable for the first time.
 *      The co-diner link (ONTDEK-PLAN.md O-5c) answers this the OTHER way
 *      and must keep doing so: there a decline refuses to have your own
 *      NAME published on somebody else's dish, and asking again is
 *      campaigning over a person's identity, which DESIGN-SOCIAL.md §5
 *      refuses by name.
 *   3. Ending a follow is a DELETE, not an action here — and BOTH parties
 *      may perform it. The follower unfollows or withdraws; the followee
 *      removes a follower, which has to exist because accepting is a
 *      consent and a consent you cannot withdraw is not one. That is the
 *      per-person twin of §5's global switch being revocable.
 *
 * Pure, no I/O.
 */

import type { IsoDateTimeString } from '../types';
import type { Block, Follow, FollowAction, FollowRole, FollowStatus, ProfileId } from './types';

/**
 * Why a move can be refused. A closed vocabulary rather than a message
 * string, so the UI owns the Dutch copy and this module owns the rule —
 * the same split `FriendshipRejection` and `NoCandidateReason` use.
 *
 * `blocked` is here even though it is not a `FollowStatus`: a block is a
 * fact about the pair that refuses the move, and the caller has to be able
 * to distinguish it in order to render the sentence
 * `describeAddFriendOutcome` already carries — one deliberately
 * indistinguishable from an ordinary "not now".
 */
export type FollowRejection =
  | 'already_pending'
  | 'already_following'
  | 'blocked'
  | 'not_followee'
  | 'no_pending_request';

/**
 * `from: null` means no row exists for this direction yet. `actor` is the
 * role the acting profile holds on the existing row; for `from: null` it is
 * ignored, because whoever opens a direction is its follower by definition.
 *
 * `isBlocked` is a fact about the PAIR rather than about the row, which is
 * why it is a separate field and not a fifth status: it can be true with no
 * follow row at all, and it refuses every action regardless of state.
 */
export interface FollowTransition {
  readonly from: FollowStatus | null;
  readonly action: FollowAction;
  readonly actor: FollowRole;
  /** True when a block stands in EITHER direction — see `isBlockStanding`. */
  readonly isBlocked: boolean;
}

export type FollowTransitionResult =
  | { readonly ok: true; readonly status: FollowStatus }
  | { readonly ok: false; readonly reason: FollowRejection };

function reject(reason: FollowRejection): FollowTransitionResult {
  return { ok: false, reason };
}

function settle(status: FollowStatus): FollowTransitionResult {
  return { ok: true, status };
}

/** Nothing yet in this direction: you may ask, and that is all. */
function fromNoRow(action: FollowAction): FollowTransitionResult {
  switch (action) {
    case 'request':
      return settle('pending');
    case 'accept':
    case 'decline':
      return reject('no_pending_request');
  }
}

function fromPending(action: FollowAction, actor: FollowRole): FollowTransitionResult {
  switch (action) {
    case 'request':
      return reject('already_pending');
    // Decision 1, and the rule 0021's trigger repeats: answering is the
    // followee's move alone. A follower who wants out removes the row.
    case 'accept':
      return actor === 'followee' ? settle('accepted') : reject('not_followee');
    case 'decline':
      return actor === 'followee' ? settle('declined') : reject('not_followee');
  }
}

function fromAccepted(action: FollowAction): FollowTransitionResult {
  switch (action) {
    // Unfollowing and removing a follower are both a DELETE (decision 3) —
    // deliberately not reachable through 'decline', which would leave a
    // declined row standing between two people who may want each other back
    // tomorrow, and would let the FOLLOWER reach a state only the followee
    // may set.
    case 'request':
    case 'accept':
    case 'decline':
      return reject('already_following');
  }
}

function fromDeclined(action: FollowAction, actor: FollowRole): FollowTransitionResult {
  switch (action) {
    // Decision 2. By the follower only: otherwise the person who declined
    // re-opens the row and then "accepts" a request nobody made.
    //
    // ⚠ THE `followee` HALF IS BELT AND BRACES AND NO LONGER THE MECHANISM.
    // Both repository backends address a `request` to the row the ACTOR
    // WOULD OWN and never to the one pointing back, so the actor reaching
    // this branch is always the follower and the escalation above is
    // impossible by construction. It stays because `applyFollowAction` is
    // a table, not a method: `isLegalFollowTransition` is also asked by UI
    // code to enable or disable a control, on a row that caller looked up
    // itself, and a guard that only holds while every caller looks rows up
    // correctly is not a guard.
    //
    // DO NOT READ THIS AS "THE FOLLOWEE MAY NEVER ASK AGAIN". They may —
    // by opening THEIR OWN direction, which is a different row and an
    // ordinary request. Declining somebody must never bar you from
    // following them, and a directed graph is what makes those two things
    // separable at all. tests/repository/localFollowGraph.test.ts pins it.
    case 'request':
      return actor === 'follower' ? settle('pending') : reject('no_pending_request');
    case 'accept':
    case 'decline':
      return reject('no_pending_request');
  }
}

/**
 * Whether a move is legal, and which state it lands in.
 *
 * Every combination of state, action and actor is answered — no
 * fall-through, and no thrown error for an unexpected input, because a
 * caller acting on a stale row (they tapped Accept while the other person
 * was blocking them) is an ordinary race, not a programming mistake.
 *
 * A STANDING BLOCK REFUSES EVERYTHING, checked before the state, and that
 * order is the point: a block is not one more state to fall through to but
 * a fact that overrides the row entirely. It also has to be answerable with
 * no row at all — blocking somebody who never asked is ordinary.
 */
export function applyFollowAction(transition: FollowTransition): FollowTransitionResult {
  const { from, action, actor, isBlocked } = transition;
  if (isBlocked) {
    return reject('blocked');
  }
  switch (from) {
    case null:
      return fromNoRow(action);
    case 'pending':
      return fromPending(action, actor);
    case 'accepted':
      return fromAccepted(action);
    case 'declined':
      return fromDeclined(action, actor);
  }
}

/** The same table read as a yes/no, for callers that only need to enable or disable a control. */
export function isLegalFollowTransition(transition: FollowTransition): boolean {
  return applyFollowAction(transition).ok;
}

/**
 * Lowercased and trimmed so comparison matches Postgres's view of a uuid.
 *
 * ⚠ CANONICALISED WHERE `collectAcceptedFriendIds` COMPARES RAW, and the
 * difference is deliberate rather than inconsistent. That function
 * documents its raw comparison honestly: every one of its callers feeds it
 * rows straight out of Postgres beside an `auth.uid()` rendered by the same
 * rules, so there is no case to normalise. These readers are reached from
 * screens whose identity may equally have come out of a LOCAL store, and
 * `sendRecipe.ts` already had to write its own `otherSideOf` to get this
 * right — its header spells out the cost of getting it wrong: "a single
 * upper-cased uuid there does not merely miss a friend — it makes the
 * reader their OWN friend, offers them their own dishes, and sends them a
 * recipe they already have." Canonicalising once here is what lets that
 * second implementation go away instead of being copied a third time.
 */
function canonicalProfileId(profileId: ProfileId): string {
  return profileId.trim().toLowerCase();
}

/** Which side of a directed row a profile sits on, or null when it is not a party to it. */
export function followRoleOf(follow: Follow, profileId: ProfileId): FollowRole | null {
  const candidate = canonicalProfileId(profileId);
  if (canonicalProfileId(follow.followerId) === candidate) {
    return 'follower';
  }
  if (canonicalProfileId(follow.followeeId) === candidate) {
    return 'followee';
  }
  return null;
}

/**
 * Which side the actor is on, defaulting to 'follower' when no row exists —
 * because the only legal action from nothing is opening a request, and the
 * person opening it is by definition the follower.
 */
export function resolveFollowActorRole(existing: Follow | null, actorProfileId: ProfileId): FollowRole {
  if (existing === null) {
    return 'follower';
  }
  return followRoleOf(existing, actorProfileId) ?? 'follower';
}

/**
 * Every field of the row a legal action produces, except the two a storage
 * backend owns: `id` and `createdAt`.
 *
 * WHY THOSE TWO ARE EXCLUDED, in friendship.ts's words: a local store mints
 * both itself; Postgres defaults both, and having the client supply them
 * would either fight the default or hand the database a value it did not
 * choose.
 *
 * ⚠ THE SIDES NEVER SWAP, unlike `nextFriendshipFields`. That function
 * swaps requester and addressee when a declined pair re-opens, because the
 * pair is unordered and whoever asks now is the requester. Here the
 * direction IS the row, so a re-request keeps both sides exactly where they
 * were — and 0021's trigger raises if either moves.
 *
 * A pending row carries no `respondedAt`: it is an unanswered question,
 * including a re-request, which resets the clock rather than keeping the
 * answer to the request it replaces. ⚠ That reset is load-bearing rather
 * than tidy — `respondedAt` is what `followSurvivesBlocks` compares against
 * a block's `blockedAt`, so a re-request that kept a stale acceptance date
 * would carry consent across a block it must not survive.
 */
export interface FollowFields {
  readonly followerId: ProfileId;
  readonly followeeId: ProfileId;
  readonly status: FollowStatus;
  readonly respondedAt: IsoDateTimeString | null;
}

export function nextFollowFields(
  existing: Follow | null,
  actorProfileId: ProfileId,
  otherProfileId: ProfileId,
  status: FollowStatus,
  now: IsoDateTimeString,
): FollowFields {
  const opening = status === 'pending';
  return {
    followerId: existing?.followerId ?? actorProfileId,
    followeeId: existing?.followeeId ?? otherProfileId,
    status,
    respondedAt: opening ? null : now,
  };
}

/**
 * Whether a block currently stands between two people, in EITHER direction.
 *
 * Direction-insensitive on purpose, and it is the one place in this module
 * that is. A block is one person's statement, but its EFFECT is mutual:
 * DESIGN-SOCIAL.md §8 refuses chat and read receipts precisely so that a
 * refusal cannot be turned into a channel, and a block that stopped them
 * seeing you while still feeding you their cooking would be exactly that
 * asymmetry.
 */
export function isBlockStanding(blocks: readonly Block[], profileA: ProfileId, profileB: ProfileId): boolean {
  return blocks.some(
    (block) =>
      block.liftedAt === null &&
      ((block.blockerId === profileA && block.blockedId === profileB) ||
        (block.blockerId === profileB && block.blockedId === profileA)),
  );
}

/**
 * Whether an accepted follow still counts, given the blocks between its two
 * parties — the in-memory counterpart of 0021's
 * `follow_survives_blocks(...)` SQL function, and it must stay in lockstep
 * with it.
 *
 * TWO SEPARATE CHECKS, and they are not the same check:
 *
 *   1. No block is standing between the two, in either direction.
 *   2. The ACCEPTANCE POSTDATES the most recent block, in either direction.
 *      This is the half that makes lifting a block safe. Without it,
 *      unblocking would hand back an accepted follow — a per-person consent
 *      — that nobody re-granted; with it, lifting restores the ability to
 *      ASK and never the answer somebody already gave.
 *
 * `respondedAt` and not `createdAt`, for the reason `Follow` states at that
 * field: `createdAt` is when the request was made, `respondedAt` is when
 * consent was given. A request sent before a block and accepted after it is
 * a fresh answer to an old question, and it counts.
 *
 * A null `respondedAt` never survives a block. It does not need to be
 * reachable — a row with no answer is not 'accepted' — and treating an
 * absent consent date as "recent enough" is the fail-open direction.
 */
export function followSurvivesBlocks(follow: Follow, blocks: readonly Block[]): boolean {
  const between = blocks.filter(
    (block) =>
      (block.blockerId === follow.followerId && block.blockedId === follow.followeeId) ||
      (block.blockerId === follow.followeeId && block.blockedId === follow.followerId),
  );
  return between.every((block) => {
    if (block.liftedAt === null) {
      return false;
    }
    return follow.respondedAt !== null && follow.respondedAt >= block.blockedAt;
  });
}

/**
 * ============================================================================
 * THE THREE QUESTIONS, WHICH USED TO BE ONE
 * ============================================================================
 *
 * `collectAcceptedFriendIds` (friendship.ts) answered "who am I connected
 * to", and there was only ever one answer because a friendship was
 * symmetric. A directed graph splits that into three, and ONTDEK-PLAN.md
 * O-11b's table says which surface takes which — this is why each of the
 * three below exists as a NAMED function rather than as a parameter on one:
 * a boolean argument called `mutual` at a call site is a decision nobody
 * can find later, and each of these three is a decision somebody made about
 * a specific surface.
 *
 *   collectFollowedIds  — "ik volg hen".   The FEED (proof cards, the kring
 *                         narrowing). Asymmetry belongs here or nowhere:
 *                         this is the thing following was built for.
 *   collectFollowerIds  — "zij volgen mij". Nothing reads it yet. It exists
 *                         because the pending-request line needs its
 *                         pending twin, and because a reader asking "who
 *                         can see my cooking" deserves a function rather
 *                         than an inverted filter written inline.
 *   collectMutualFollowIds — "wederzijds". SENDS (recipe_shares_insert,
 *                         can_read_shared_meal, the send audience). A send
 *                         is a message to one person, and one-way would
 *                         make it unsolicited post — DESIGN-SOCIAL.md §8's
 *                         "no chat" wall gets thin fast. This is exactly
 *                         what `is_friend_of` now computes in SQL.
 *
 * ONLY 'accepted' COUNTS in all three, for `areFriends`'s reasons exactly:
 * pending is a question nobody answered and declined is a no. A set built
 * from any wider status would hand a stranger the list that gates sending.
 *
 * BLOCKS ARE APPLIED HERE AND NOT LEFT TO THE CALLER. Every one of the
 * three takes the reader's blocks and runs `followSurvivesBlocks` over each
 * row. Making that the caller's job is how one of six call sites forgets.
 *
 * THEY TRUST THEIR INPUT TO BE THE READER'S OWN ROWS, and do not verify it
 * — `listFollows(profileId)` returns exactly those. friendship.ts's header
 * carries the full argument for why a party check here was rejected: it
 * would be a second, weaker copy of the narrowing RLS already performs, and
 * it would quietly absorb a caller passing the wrong list rather than
 * letting that fail somewhere visible.
 */
function collectDirectedIds(
  follows: readonly Follow[],
  blocks: readonly Block[],
  profileId: ProfileId,
  side: FollowRole,
): ReadonlySet<ProfileId> {
  const ids = new Set<ProfileId>();
  for (const follow of follows) {
    if (follow.status !== 'accepted') {
      continue;
    }
    // Which side the reader is on is asked through `followRoleOf` rather
    // than compared here, so the canonicalisation lives in one function.
    if (followRoleOf(follow, profileId) !== side) {
      continue;
    }
    const other = side === 'follower' ? follow.followeeId : follow.followerId;
    // The self-guard is not defensive padding: 0021's CHECK refuses a
    // self-row, but if one ever existed the reader would be their own
    // follower — their own dishes in their own feed, themselves offered as
    // a send target.
    if (followRoleOf(follow, other) === side) {
      continue;
    }
    if (!followSurvivesBlocks(follow, blocks)) {
      continue;
    }
    ids.add(other);
  }
  return ids;
}

/** "Ik volg hen" — whose cooking this profile has been granted sight of. */
export function collectFollowedIds(
  follows: readonly Follow[],
  blocks: readonly Block[],
  profileId: ProfileId,
): ReadonlySet<ProfileId> {
  return collectDirectedIds(follows, blocks, profileId, 'follower');
}

/** "Zij volgen mij" — who this profile has granted sight of their own cooking. */
export function collectFollowerIds(
  follows: readonly Follow[],
  blocks: readonly Block[],
  profileId: ProfileId,
): ReadonlySet<ProfileId> {
  return collectDirectedIds(follows, blocks, profileId, 'followee');
}

/**
 * "Wederzijds" — the DERIVED friendship, and the exact client-side twin of
 * what `is_friend_of` computes in SQL after migration 0021.
 *
 * The intersection of the two sets above rather than a third pass over the
 * rows, so there is one definition of "accepted and unblocked" and this
 * cannot drift from the other two.
 */
export function collectMutualFollowIds(
  follows: readonly Follow[],
  blocks: readonly Block[],
  profileId: ProfileId,
): ReadonlySet<ProfileId> {
  const followed = collectFollowedIds(follows, blocks, profileId);
  const followers = collectFollowerIds(follows, blocks, profileId);
  const mutual = new Set<ProfileId>();
  for (const id of followed) {
    if (followers.has(id)) {
      mutual.add(id);
    }
  }
  return mutual;
}

/** Whether two profiles are mutually connected — `areFriends`'s successor, and `is_friend_of`'s meaning. */
export function areMutualFollows(
  profileA: ProfileId,
  profileB: ProfileId,
  follows: readonly Follow[],
  blocks: readonly Block[],
): boolean {
  const a = canonicalProfileId(profileA);
  const b = canonicalProfileId(profileB);
  if (a === b || a.length === 0 || b.length === 0) {
    return false;
  }
  // The set holds ids as stored; the membership question is asked in the
  // canonical form, so a caller holding a differently-cased id still gets
  // the right answer.
  return [...collectMutualFollowIds(follows, blocks, profileA)].some((id) => canonicalProfileId(id) === b);
}

/**
 * What the screen draws, split out of one list of rows.
 *
 * The directed successor of `partitionFriendships`, and the split is
 * genuinely different rather than renamed: a friendship produced two
 * buckets (incoming requests, outgoing requests, plus accepted friends),
 * and a directed graph produces four, because "accepted" is now two facts
 * that can exist apart.
 *
 * DECLINED ROWS GO NOWHERE, exactly as they did before, and for the reason
 * `partitionFriendships` states: a declined row is re-requestable, so it is
 * indistinguishable from no row at all, and listing it would show a "no"
 * back to the person who gave it, forever.
 *
 * ⚠ NOTHING HERE IS ORDERED. Input order is preserved deliberately, in
 * `partitionFriendships`'s words: "ordering these by anything would mean
 * ordering them by `createdAt`, which is the recency this product keeps off
 * every social surface. Two open requests are two facts, and neither is
 * more urgent than the other."
 *
 * ⚠ AND NOTHING HERE IS COUNTED INTO A SCORE. `following` and `followers`
 * are lists the reader can act on, never numbers rendered at anybody. §8's
 * "no trophy shelf" and PD-024 both say it: a follow is a gate, never a
 * score on a person. A follower COUNT on a profile is the single most
 * obvious next thing to build out of this shape, and it is refused.
 */
export interface FollowPartition {
  /** Requests waiting for THIS profile to answer — the only bucket that is post. */
  readonly incomingRequests: readonly Follow[];
  /** Requests this profile has made and nobody has answered yet. */
  readonly outgoingRequests: readonly Follow[];
  /** Accepted, this profile is the follower. */
  readonly following: readonly Follow[];
  /** Accepted, this profile is the followee. */
  readonly followers: readonly Follow[];
}

export function partitionFollows(
  follows: readonly Follow[],
  blocks: readonly Block[],
  profileId: ProfileId,
): FollowPartition {
  const incomingRequests: Follow[] = [];
  const outgoingRequests: Follow[] = [];
  const following: Follow[] = [];
  const followers: Follow[] = [];

  for (const follow of follows) {
    const role = followRoleOf(follow, profileId);
    if (role === null || follow.followerId === follow.followeeId) {
      continue;
    }
    // A blocked pair appears in no bucket, in either direction — the same
    // rule `partitionFriendships` applies, and for its reason: "a row that
    // appears for one party and not the other is how the blocked person
    // works out what happened."
    if (isBlockStanding(blocks, follow.followerId, follow.followeeId)) {
      continue;
    }
    if (follow.status === 'pending') {
      (role === 'followee' ? incomingRequests : outgoingRequests).push(follow);
      continue;
    }
    if (follow.status === 'accepted' && followSurvivesBlocks(follow, blocks)) {
      (role === 'follower' ? following : followers).push(follow);
    }
  }

  return { incomingRequests, outgoingRequests, following, followers };
}

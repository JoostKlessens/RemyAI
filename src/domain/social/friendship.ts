/**
 * Friendships: the ordered-pair key the database is unique on, and the
 * table of which moves are legal from which state, by whom.
 *
 * WHY THIS IS A DOMAIN MODULE AND NOT A REPOSITORY METHOD. "May Joost
 * accept this?" is a rule, not a write. Put it inside the function that
 * performs the UPDATE and it exists once per backend — once in the local
 * store, again in the Supabase client, again in whatever admin path
 * appears later — and the copies drift. Put it here and every write path
 * asks the same function, `npm test` can enumerate the whole table without
 * a database, and the migration's trigger only has to defend the one rule
 * whose failure is a privacy breach rather than restate all of them. Same
 * argument src/domain/import/canonicalRecipe.ts makes for keeping the row
 * mapping out of the edge function.
 *
 * ---
 *
 * THE ORDERED PAIR. A friendship is between two people, not from one to
 * the other, so the database holds at most one row per unordered pair —
 * enforced by a unique constraint on generated `least`/`greatest` columns
 * in supabase/migrations/0007_social.sql. `friendshipPairKey` computes the
 * identical key here, because that key is what a caller looks a pair up
 * by; if the two sides disagreed on ordering, the client would search for
 * a row under a key the database filed elsewhere and then insert a
 * duplicate the constraint cannot catch.
 *
 * Agreement rests on one detail. Postgres compares a uuid by its sixteen
 * bytes and renders it as lowercase hex, and lexicographic comparison of
 * that canonical rendering IS byte comparison — hex digits ascend in ASCII
 * in the same order as their values, and the dashes sit at identical
 * positions in both operands. So a plain string `<` matches Postgres
 * exactly, as long as case never enters it. ASCII puts every uppercase
 * letter before every lowercase one, so one upper-cased id in the
 * comparison flips the ordering and produces precisely the duplicate the
 * constraint exists to prevent. The lowercasing below is therefore
 * load-bearing, not cosmetic.
 *
 * ---
 *
 * THE TRANSITION TABLE, AND THE FOUR DECISIONS INSIDE IT.
 *
 *   1. Only the addressee may accept. A requester accepting their own
 *      request would hand themselves read access to the other side's
 *      shared meals (PD-010) with nobody having agreed to anything. This
 *      is the one rule the migration also enforces with a trigger, because
 *      a rule that lives only in the client is a rule anyone holding a
 *      REST token can skip.
 *   2. `declined` is not terminal. The unique pair means the declined row
 *      IS the pair — leaving it as a tombstone would make one "no"
 *      permanent for both people forever. Either side may re-request from
 *      there. It is a re-*request*, never a late accept: the earlier
 *      intent expired with the decline and has to be renewed.
 *   3. `blocked` is terminal, and the way out is deleting the row, not a
 *      transition. `Friendship.blockedBy` records which party blocked, so
 *      the delete policy can let the blocker undo it while refusing the
 *      blocked person the same move. An 'unblock' action would be a
 *      transition either party could perform, which is not a block.
 *   4. Removing a friendship is a DELETE, not an action here. No status
 *      means "we used to be friends" in a way worth keeping, and a
 *      lingering row of any status blocks the pair from ever being
 *      re-requested. Unfriending, withdrawing your own request and
 *      unblocking are therefore all the same operation on the row.
 *
 * Pure, no I/O.
 */

import type { Friendship, FriendshipAction, FriendshipRole, FriendshipStatus, ProfileId } from './types';

/** The two ids in the order the database files them: `low` is `least(...)`, `high` is `greatest(...)`. */
export interface FriendshipPairKey {
  readonly low: ProfileId;
  readonly high: ProfileId;
}

/**
 * Why a move can be refused. A closed vocabulary rather than a message
 * string, so the UI owns the Dutch copy and this module owns the rule —
 * the same split `NoCandidateReason` uses in the decision engine.
 */
export type FriendshipRejection =
  | 'already_pending'
  | 'already_friends'
  | 'blocked'
  | 'not_addressee'
  | 'no_pending_request';

/**
 * `from: null` means no row exists for this pair yet. `actor` is the role
 * the acting profile holds on the existing row; for `from: null` it is
 * ignored, because whoever opens a pair becomes its requester by
 * definition.
 */
export interface FriendshipTransition {
  readonly from: FriendshipStatus | null;
  readonly action: FriendshipAction;
  readonly actor: FriendshipRole;
}

export type FriendshipTransitionResult =
  | { readonly ok: true; readonly status: FriendshipStatus }
  | { readonly ok: false; readonly reason: FriendshipRejection };

/** Lowercased so comparison and equality match Postgres's view of a uuid — see the header. */
function canonicalProfileId(profileId: ProfileId): string {
  return profileId.trim().toLowerCase();
}

/**
 * The pair key for two profiles, or null when they cannot form a pair at
 * all: the same person twice (the CHECK in 0007_social.sql refuses it too
 * — a friendship with yourself is not a degenerate case worth supporting,
 * it is a bug upstream), or a blank id, which would key a pair on an empty
 * string and silently collide with every other blank one.
 */
export function friendshipPairKey(profileA: ProfileId, profileB: ProfileId): FriendshipPairKey | null {
  const left = canonicalProfileId(profileA);
  const right = canonicalProfileId(profileB);
  if (left.length === 0 || right.length === 0 || left === right) {
    return null;
  }
  return left < right ? { low: left, high: right } : { low: right, high: left };
}

/** Which side of the row a profile sits on, or null when it is not a party to it. */
export function friendshipRoleOf(friendship: Friendship, profileId: ProfileId): FriendshipRole | null {
  const candidate = canonicalProfileId(profileId);
  if (canonicalProfileId(friendship.requesterId) === candidate) {
    return 'requester';
  }
  if (canonicalProfileId(friendship.addresseeId) === candidate) {
    return 'addressee';
  }
  return null;
}

function reject(reason: FriendshipRejection): FriendshipTransitionResult {
  return { ok: false, reason };
}

function settle(status: FriendshipStatus): FriendshipTransitionResult {
  return { ok: true, status };
}

/** No relationship yet: you may ask, or pre-emptively block someone who has not asked you. */
function fromNoRow(action: FriendshipAction): FriendshipTransitionResult {
  switch (action) {
    case 'request':
      return settle('pending');
    case 'block':
      return settle('blocked');
    case 'accept':
    case 'decline':
      return reject('no_pending_request');
  }
}

function fromPending(action: FriendshipAction, actor: FriendshipRole): FriendshipTransitionResult {
  switch (action) {
    case 'request':
      return reject('already_pending');
    // Decision 1 in the header, and the rule the migration's trigger
    // repeats: answering a request is the addressee's move alone. A
    // requester who wants out deletes the row instead.
    case 'accept':
      return actor === 'addressee' ? settle('accepted') : reject('not_addressee');
    case 'decline':
      return actor === 'addressee' ? settle('declined') : reject('not_addressee');
    case 'block':
      return settle('blocked');
  }
}

function fromAccepted(action: FriendshipAction): FriendshipTransitionResult {
  switch (action) {
    case 'block':
      return settle('blocked');
    // Unfriending is a DELETE (decision 4) — deliberately not reachable
    // through 'decline', which would leave a declined row standing between
    // two people who may want to add each other again tomorrow.
    case 'request':
    case 'accept':
    case 'decline':
      return reject('already_friends');
  }
}

function fromDeclined(action: FriendshipAction): FriendshipTransitionResult {
  switch (action) {
    // Decision 2: either side may re-open the pair. Whether asking again
    // is welcome is a rate-limiting question for a later phase, not a
    // reason to make one "no" permanent for both people.
    case 'request':
      return settle('pending');
    case 'block':
      return settle('blocked');
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
 */
export function applyFriendshipAction(transition: FriendshipTransition): FriendshipTransitionResult {
  const { from, action, actor } = transition;
  switch (from) {
    case null:
      return fromNoRow(action);
    case 'pending':
      return fromPending(action, actor);
    case 'accepted':
      return fromAccepted(action);
    case 'declined':
      return fromDeclined(action);
    // Decision 3: terminal. Not even a second block, so a blocked person
    // cannot overwrite `blockedBy` with their own id and then unblock
    // themselves through the delete policy.
    case 'blocked':
      return reject('blocked');
  }
}

/** The same table read as a yes/no, for callers that only need to enable or disable a control. */
export function isLegalFriendshipTransition(transition: FriendshipTransition): boolean {
  return applyFriendshipAction(transition).ok;
}

/**
 * Whether two profiles are currently friends — the in-memory counterpart
 * of the `is_friend_of` SQL predicate, and what visibility.ts's shared-meal
 * check is built on.
 *
 * Only 'accepted' counts. Pending is a question nobody has answered,
 * declined is a no, and blocked is an emphatic one; treating any of them
 * as a friendship would open the shared-meal surface to someone who never
 * got in. Direction is irrelevant, so the pair key does the matching
 * rather than a two-way `or` that a future edit could get half right.
 */
export function areFriends(
  profileA: ProfileId,
  profileB: ProfileId,
  friendships: readonly Friendship[],
): boolean {
  const wanted = friendshipPairKey(profileA, profileB);
  if (wanted === null) {
    return false;
  }
  return friendships.some((friendship) => {
    if (friendship.status !== 'accepted') {
      return false;
    }
    const key = friendshipPairKey(friendship.requesterId, friendship.addresseeId);
    return key !== null && key.low === wanted.low && key.high === wanted.high;
  });
}

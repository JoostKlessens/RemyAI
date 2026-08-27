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

import type { IsoDateTimeString } from '../types';
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

/**
 * Which side of a pair the actor is on, defaulting to 'requester' when no
 * row exists yet — because the only legal action from nothing is opening a
 * request, and the person opening it is by definition the requester.
 *
 * Extracted here rather than kept private to a repository: both backends
 * need it, and a second copy is a second place the default could drift.
 */
export function resolveActorRole(existing: Friendship | null, actorProfileId: ProfileId): FriendshipRole {
  if (existing === null) {
    return 'requester';
  }
  return friendshipRoleOf(existing, actorProfileId) ?? 'requester';
}

/**
 * Every field of the row a legal action produces, except the two a storage
 * backend owns: `id` and `createdAt`.
 *
 * WHY THOSE TWO ARE EXCLUDED. A local store mints an id and a timestamp
 * itself; Postgres defaults both (`gen_random_uuid()`, `now()`), and having
 * the client supply them would either fight the default or hand the
 * database a value it did not choose. Everything else here is a product
 * rule and must be identical in both backends, which is why it lives in
 * the domain and not in either repository.
 *
 * THE SIDES SWAP ON A RE-REQUEST. When the status opens to 'pending',
 * whoever is asking now becomes the requester — otherwise the original
 * addressee could re-open a declined pair and then "accept" a request
 * nobody made. That is the rule this function exists to state once.
 *
 * A pending row carries no `respondedAt`: it is an unanswered question,
 * including a re-request, which resets the clock rather than keeping the
 * answer to the request it replaces.
 */
export interface FriendshipFields {
  readonly requesterId: ProfileId;
  readonly addresseeId: ProfileId;
  readonly status: FriendshipStatus;
  readonly blockedBy: ProfileId | null;
  readonly respondedAt: IsoDateTimeString | null;
}

export function nextFriendshipFields(
  existing: Friendship | null,
  actorProfileId: ProfileId,
  otherProfileId: ProfileId,
  status: FriendshipStatus,
  now: IsoDateTimeString,
): FriendshipFields {
  const opening = status === 'pending';
  return {
    requesterId: existing === null || opening ? actorProfileId : existing.requesterId,
    addresseeId: existing === null || opening ? otherProfileId : existing.addresseeId,
    status,
    blockedBy: status === 'blocked' ? actorProfileId : null,
    respondedAt: opening ? null : now,
  };
}

/**
 * Everyone this profile is mutually accepted friends with, as a set of ids.
 *
 * WHY IT LIVES HERE AND NOT BESIDE ITS CALLERS. Three surfaces need the
 * same answer — Bibliotheek's send list, Gekookt's kring narrowing, and
 * the Vrienden tab — and all three are route modules, whose only export is
 * a screen component. There was nothing to import from any of them, so the
 * twelve lines were copied instead, verbatim, twice. Two copies of a
 * predicate that decides who may see a household's dishes is exactly the
 * drift `areFriends` above exists to prevent, and the copies were
 * unreachable from `npm test` for the same reason they were copies: a
 * route module cannot be imported by a test at all. The duplication was
 * the visible symptom; the missing coverage was the defect.
 *
 * ONLY 'accepted' COUNTS, for `areFriends`'s reasons exactly: pending is a
 * question nobody answered, declined is a no, blocked is an emphatic one.
 * A set built from any wider status would hand a stranger the friend list
 * that gates sending and the kring's vote narrowing in one step.
 *
 * THE SELF-GUARD IS NOT DEFENSIVE PADDING. 0007_social.sql's CHECK refuses
 * a self-pair and `friendshipPairKey` returns null for one, so a row whose
 * two sides are the same person should not exist — but if one ever did,
 * the `other` computed below would be the reader's own id, and every
 * caller would then treat the reader as their own friend: their own dishes
 * would appear in their kring and they would be offered to themselves as a
 * send target. Dropping it costs nothing and removes that class of bug.
 *
 * IT TRUSTS ITS INPUT TO BE THE READER'S OWN ROWS, and does not verify
 * it. `listFriendships(profileId)` returns exactly those, which is what
 * all three callers pass; handed somebody else's accepted pair it would
 * report that pair's REQUESTER as a friend, because `other` falls through
 * to `requesterId` when the reader is neither side. A party check here was
 * rejected: it would be a second, weaker copy of the narrowing RLS already
 * performs on the read, and it would quietly absorb a caller passing the
 * wrong list rather than letting that fail somewhere visible. The
 * behaviour is pinned in tests/social/friendship.test.ts so the assumption
 * is findable rather than folklore.
 *
 * IDS ARE COMPARED RAW, DELIBERATELY NOT CANONICALISED the way
 * `friendshipRoleOf` above does it. Every caller feeds this rows straight
 * out of Postgres, where a uuid renders lowercase, alongside a `profileId`
 * that is the session's `auth.uid()` — rendered by the same rules. There
 * is no case to normalise away, and lowercasing here would only look like
 * the ordered-pair rule (which genuinely needs it, because it compares two
 * ids for ORDER against a generated column) applied where it is not.
 * Moved verbatim from the two call sites so the move changes nothing.
 */
export function collectAcceptedFriendIds(
  friendships: readonly Friendship[],
  profileId: ProfileId,
): ReadonlySet<ProfileId> {
  const friendIds = new Set<ProfileId>();
  for (const friendship of friendships) {
    if (friendship.status !== 'accepted') {
      continue;
    }
    const other = friendship.requesterId === profileId ? friendship.addresseeId : friendship.requesterId;
    if (other !== profileId) {
      friendIds.add(other);
    }
  }
  return friendIds;
}

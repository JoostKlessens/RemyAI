import { describe, expect, test } from 'vitest';
import {
  applyFriendshipAction,
  areFriends,
  friendshipPairKey,
  friendshipRoleOf,
  isLegalFriendshipTransition,
  nextFriendshipFields,
  resolveActorRole,
} from '@/domain/social/friendship';
import type { FriendshipAction, FriendshipStatus } from '@/domain/social/types';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeFriendship } from './fixtures';

describe('friendshipPairKey — the ordered pair the unique constraint is built on', () => {
  test('produces the same key whichever way round the two profiles are given', () => {
    expect(friendshipPairKey(PROFILE_A, PROFILE_B)).toEqual(friendshipPairKey(PROFILE_B, PROFILE_A));
  });

  test('puts the lower id first, so low/high match Postgres least()/greatest()', () => {
    const key = friendshipPairKey(PROFILE_B, PROFILE_A);
    expect(key).not.toBeNull();
    expect(key?.low).toBe(PROFILE_A);
    expect(key?.high).toBe(PROFILE_B);
  });

  /**
   * Postgres compares uuids by their bytes and renders them lowercase.
   * ASCII puts every uppercase letter before every lowercase one, so a
   * case-carrying comparison here would order a pair differently from the
   * generated columns in 0007_social.sql and produce a second row for a
   * pair the database believes it already holds.
   */
  test('orders case-insensitively, matching how Postgres compares a uuid', () => {
    const key = friendshipPairKey(PROFILE_B.toUpperCase(), PROFILE_A);
    expect(key?.low).toBe(PROFILE_A);
    expect(key?.high).toBe(PROFILE_B);
  });

  test('rejects a self-pair rather than inventing a friendship with yourself', () => {
    expect(friendshipPairKey(PROFILE_A, PROFILE_A)).toBeNull();
    expect(friendshipPairKey(PROFILE_A, PROFILE_A.toUpperCase())).toBeNull();
  });

  test('rejects a blank id rather than keying a pair on an empty string', () => {
    expect(friendshipPairKey('', PROFILE_A)).toBeNull();
    expect(friendshipPairKey(PROFILE_A, '   ')).toBeNull();
  });
});

describe('friendshipRoleOf', () => {
  test('names which side of the row a profile sits on', () => {
    const friendship = makeFriendship({ requesterId: PROFILE_A, addresseeId: PROFILE_B });
    expect(friendshipRoleOf(friendship, PROFILE_A)).toBe('requester');
    expect(friendshipRoleOf(friendship, PROFILE_B)).toBe('addressee');
  });

  test('returns null for a profile that is not a party to the row', () => {
    expect(friendshipRoleOf(makeFriendship(), PROFILE_C)).toBeNull();
  });

  test('matches case-insensitively, the same rule friendshipPairKey uses', () => {
    expect(friendshipRoleOf(makeFriendship(), PROFILE_A.toUpperCase())).toBe('requester');
  });
});

describe('applyFriendshipAction — from no relationship at all', () => {
  test('a request opens a pending row', () => {
    expect(applyFriendshipAction({ from: null, action: 'request', actor: 'requester' })).toEqual({
      ok: true,
      status: 'pending',
    });
  });

  test('a pre-emptive block is legal without any prior relationship', () => {
    expect(applyFriendshipAction({ from: null, action: 'block', actor: 'requester' })).toEqual({
      ok: true,
      status: 'blocked',
    });
  });

  test('there is nothing to accept or decline', () => {
    expect(applyFriendshipAction({ from: null, action: 'accept', actor: 'addressee' })).toEqual({
      ok: false,
      reason: 'no_pending_request',
    });
    expect(applyFriendshipAction({ from: null, action: 'decline', actor: 'addressee' })).toEqual({
      ok: false,
      reason: 'no_pending_request',
    });
  });
});

describe('applyFriendshipAction — from pending', () => {
  test('the addressee may accept', () => {
    expect(applyFriendshipAction({ from: 'pending', action: 'accept', actor: 'addressee' })).toEqual({
      ok: true,
      status: 'accepted',
    });
  });

  /**
   * The one rule the migration also enforces with a trigger: accepting
   * your own request would hand you read access to the other side's
   * shared meals without them ever agreeing to anything.
   */
  test('the requester may NOT accept their own request', () => {
    expect(applyFriendshipAction({ from: 'pending', action: 'accept', actor: 'requester' })).toEqual({
      ok: false,
      reason: 'not_addressee',
    });
  });

  test('only the addressee may decline — a requester withdrawing is a delete, not a decline', () => {
    expect(applyFriendshipAction({ from: 'pending', action: 'decline', actor: 'addressee' })).toEqual({
      ok: true,
      status: 'declined',
    });
    expect(applyFriendshipAction({ from: 'pending', action: 'decline', actor: 'requester' })).toEqual({
      ok: false,
      reason: 'not_addressee',
    });
  });

  test('either party may block a pending request', () => {
    expect(applyFriendshipAction({ from: 'pending', action: 'block', actor: 'requester' })).toEqual({
      ok: true,
      status: 'blocked',
    });
    expect(applyFriendshipAction({ from: 'pending', action: 'block', actor: 'addressee' })).toEqual({
      ok: true,
      status: 'blocked',
    });
  });

  test('re-requesting while a request is already open is rejected', () => {
    expect(applyFriendshipAction({ from: 'pending', action: 'request', actor: 'requester' })).toEqual({
      ok: false,
      reason: 'already_pending',
    });
  });
});

describe('applyFriendshipAction — from accepted', () => {
  test.each<FriendshipAction>(['request', 'accept', 'decline'])(
    '%s is rejected because the two are already friends',
    (action) => {
      expect(applyFriendshipAction({ from: 'accepted', action, actor: 'addressee' })).toEqual({
        ok: false,
        reason: 'already_friends',
      });
    },
  );

  test('either party may block an existing friendship', () => {
    expect(applyFriendshipAction({ from: 'accepted', action: 'block', actor: 'requester' })).toEqual({
      ok: true,
      status: 'blocked',
    });
  });
});

describe('applyFriendshipAction — from declined', () => {
  /** A decline is not a tombstone: the unique ordered pair makes this row the only way back. */
  test('either party may re-open the pair with a fresh request', () => {
    expect(applyFriendshipAction({ from: 'declined', action: 'request', actor: 'requester' })).toEqual({
      ok: true,
      status: 'pending',
    });
    expect(applyFriendshipAction({ from: 'declined', action: 'request', actor: 'addressee' })).toEqual({
      ok: true,
      status: 'pending',
    });
  });

  test('a declined request cannot be accepted later — the intent has to be renewed', () => {
    expect(applyFriendshipAction({ from: 'declined', action: 'accept', actor: 'addressee' })).toEqual({
      ok: false,
      reason: 'no_pending_request',
    });
  });

  test('declining an already-declined pair is rejected rather than treated as a silent no-op', () => {
    expect(applyFriendshipAction({ from: 'declined', action: 'decline', actor: 'addressee' })).toEqual({
      ok: false,
      reason: 'no_pending_request',
    });
  });

  test('blocking a declined pair is legal', () => {
    expect(applyFriendshipAction({ from: 'declined', action: 'block', actor: 'addressee' })).toEqual({
      ok: true,
      status: 'blocked',
    });
  });
});

describe('applyFriendshipAction — from blocked', () => {
  test.each<FriendshipAction>(['request', 'accept', 'decline', 'block'])(
    'blocked is terminal: %s is rejected for either party',
    (action) => {
      expect(applyFriendshipAction({ from: 'blocked', action, actor: 'requester' })).toEqual({
        ok: false,
        reason: 'blocked',
      });
      expect(applyFriendshipAction({ from: 'blocked', action, actor: 'addressee' })).toEqual({
        ok: false,
        reason: 'blocked',
      });
    },
  );
});

describe('the transition table as a whole', () => {
  const statuses: readonly (FriendshipStatus | null)[] = [null, 'pending', 'accepted', 'declined', 'blocked'];
  const actions: readonly FriendshipAction[] = ['request', 'accept', 'decline', 'block'];
  const actors = ['requester', 'addressee'] as const;

  test('every combination is answered — nothing falls through undefined', () => {
    for (const from of statuses) {
      for (const action of actions) {
        for (const actor of actors) {
          expect(typeof applyFriendshipAction({ from, action, actor }).ok).toBe('boolean');
        }
      }
    }
  });

  test('isLegalFriendshipTransition agrees with applyFriendshipAction everywhere', () => {
    for (const from of statuses) {
      for (const action of actions) {
        for (const actor of actors) {
          const transition = { from, action, actor };
          expect(isLegalFriendshipTransition(transition)).toBe(applyFriendshipAction(transition).ok);
        }
      }
    }
  });

  test('no legal transition ever produces a status outside the stored vocabulary', () => {
    const allowed: readonly FriendshipStatus[] = ['pending', 'accepted', 'declined', 'blocked'];
    for (const from of statuses) {
      for (const action of actions) {
        for (const actor of actors) {
          const result = applyFriendshipAction({ from, action, actor });
          if (result.ok) {
            expect(allowed).toContain(result.status);
          }
        }
      }
    }
  });
});

describe('areFriends', () => {
  test('true only for an accepted row, whichever way round the pair is asked', () => {
    const friendships = [makeFriendship({ status: 'accepted' })];
    expect(areFriends(PROFILE_A, PROFILE_B, friendships)).toBe(true);
    expect(areFriends(PROFILE_B, PROFILE_A, friendships)).toBe(true);
  });

  test.each<FriendshipStatus>(['pending', 'declined', 'blocked'])('false while the row is %s', (status) => {
    expect(areFriends(PROFILE_A, PROFILE_B, [makeFriendship({ status })])).toBe(false);
  });

  test('false when no row connects the two profiles', () => {
    expect(areFriends(PROFILE_A, PROFILE_C, [makeFriendship()])).toBe(false);
  });

  test('nobody is their own friend', () => {
    expect(areFriends(PROFILE_A, PROFILE_A, [makeFriendship({ addresseeId: PROFILE_A })])).toBe(false);
  });

  test('an empty friendship list is not an error', () => {
    expect(areFriends(PROFILE_A, PROFILE_B, [])).toBe(false);
  });
});

/**
 * These two moved out of localSocialRepository.ts when the Supabase
 * backend arrived, because both implementations need them and a private
 * copy in each is two places one rule could drift. They carry no id and no
 * createdAt on purpose: a local store mints those, Postgres defaults them,
 * and neither is a product decision.
 */
describe('resolveActorRole', () => {
  test('the actor opening a pair that has no row is the requester', () => {
    expect(resolveActorRole(null, PROFILE_A)).toBe('requester');
  });

  test('reads the actor off an existing row', () => {
    const friendship = makeFriendship({ requesterId: PROFILE_A, addresseeId: PROFILE_B });
    expect(resolveActorRole(friendship, PROFILE_A)).toBe('requester');
    expect(resolveActorRole(friendship, PROFILE_B)).toBe('addressee');
  });

  /** A stranger is not silently treated as the addressee — the transition table would then let them accept. */
  test('falls back to requester for a profile that is not in the pair', () => {
    const friendship = makeFriendship({ requesterId: PROFILE_A, addresseeId: PROFILE_B });
    expect(resolveActorRole(friendship, PROFILE_C)).toBe('requester');
  });
});

describe('nextFriendshipFields', () => {
  const NOW = '2026-03-01T12:00:00.000Z';

  test('a brand-new pending row puts the actor on the requesting side', () => {
    const fields = nextFriendshipFields(null, PROFILE_A, PROFILE_B, 'pending', NOW);
    expect(fields.requesterId).toBe(PROFILE_A);
    expect(fields.addresseeId).toBe(PROFILE_B);
  });

  /**
   * The rule this function exists to state once: whoever re-opens a
   * declined pair becomes the requester. Without the swap the original
   * addressee could re-open and then "accept" a request nobody made.
   */
  test('re-requesting swaps the sides so the asker is the requester', () => {
    const declined = makeFriendship({ requesterId: PROFILE_A, addresseeId: PROFILE_B, status: 'declined' });
    const fields = nextFriendshipFields(declined, PROFILE_B, PROFILE_A, 'pending', NOW);
    expect(fields.requesterId).toBe(PROFILE_B);
    expect(fields.addresseeId).toBe(PROFILE_A);
  });

  test('answering an existing request leaves the sides exactly as they were', () => {
    const pending = makeFriendship({ requesterId: PROFILE_A, addresseeId: PROFILE_B, status: 'pending' });
    const fields = nextFriendshipFields(pending, PROFILE_B, PROFILE_A, 'accepted', NOW);
    expect(fields.requesterId).toBe(PROFILE_A);
    expect(fields.addresseeId).toBe(PROFILE_B);
  });

  /** A pending row is an unanswered question, including a re-request — it resets the clock rather than keeping the previous answer. */
  test('a pending row carries no answer time', () => {
    expect(nextFriendshipFields(null, PROFILE_A, PROFILE_B, 'pending', NOW).respondedAt).toBeNull();
  });

  test('any settled status stamps the moment it was settled', () => {
    const pending = makeFriendship({ status: 'pending' });
    expect(nextFriendshipFields(pending, PROFILE_B, PROFILE_A, 'accepted', NOW).respondedAt).toBe(NOW);
    expect(nextFriendshipFields(pending, PROFILE_B, PROFILE_A, 'declined', NOW).respondedAt).toBe(NOW);
  });

  /** Mirrors the delete policy in 0007: only the blocker may lift a block, so the row has to record who it was. */
  test('blocking records who blocked, and nothing else ever does', () => {
    const accepted = makeFriendship({ status: 'accepted' });
    expect(nextFriendshipFields(accepted, PROFILE_B, PROFILE_A, 'blocked', NOW).blockedBy).toBe(PROFILE_B);
    expect(nextFriendshipFields(accepted, PROFILE_B, PROFILE_A, 'accepted', NOW).blockedBy).toBeNull();
  });

  /** Unblocking must clear the marker, or the pair stays blocked in every check that reads it. */
  test('leaving blocked clears the blocker', () => {
    const blocked = makeFriendship({ status: 'blocked', blockedBy: PROFILE_B });
    expect(nextFriendshipFields(blocked, PROFILE_B, PROFILE_A, 'declined', NOW).blockedBy).toBeNull();
  });
});

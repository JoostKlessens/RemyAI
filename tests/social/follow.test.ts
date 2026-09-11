/**
 * The directed graph's rules (PD-024, migration 0021).
 *
 * ⚠ ONTDEK-PLAN.md's fase 1 risk 2 names this file: "`is_friend_of` is het
 * tweede RLS-predikaat van het hele product. Een fout in zijn body is geen
 * bug maar een lek, over vier objecten tegelijk. Deze herschrijving verdient
 * de zwaarste test van het hele plan, en die test hoort te bewijzen dat een
 * EENZIJDIGE follow géén van de vier objecten opent."
 *
 * The SQL body cannot be executed here — vitest runs node-only, with no
 * database — so what is proven below is the CLIENT twin of that predicate,
 * `collectMutualFollowIds`, plus the transition table that decides which
 * rows can come to exist in the first place. Those two together are what a
 * one-way follow has to get past to reach anything, and the module boundary
 * is deliberate: the SQL and this file compute the identical rule, so an
 * asymmetry proven here is an asymmetry the schema must also hold, and the
 * day they disagree one of them is wrong in a findable place.
 *
 * THE INVARIANT THIS FILE EXISTS FOR, stated once: a follow in ONE
 * direction grants NOTHING that a mutual pair grants. Every `describe`
 * below is a way of trying to break that.
 */

import { describe, expect, test } from 'vitest';
import {
  applyFollowAction,
  areMutualFollows,
  collectFollowedIds,
  collectFollowerIds,
  collectMutualFollowIds,
  followRoleOf,
  followSurvivesBlocks,
  isBlockStanding,
  isLegalFollowTransition,
  nextFollowFields,
  partitionFollows,
  resolveFollowActorRole,
} from '@/domain/social/follow';
import type { Block, Follow, FollowAction, FollowRole, FollowStatus } from '@/domain/social/types';

const ME = 'profile-me';
const SANNE = 'profile-sanne';
const JORIS = 'profile-joris';

const T0 = '2026-06-01T10:00:00.000Z';
const T1 = '2026-07-01T10:00:00.000Z';
const T2 = '2026-08-01T10:00:00.000Z';

function makeFollow(overrides: Partial<Follow> = {}): Follow {
  return {
    id: 'follow-1',
    followerId: ME,
    followeeId: SANNE,
    status: 'accepted',
    createdAt: T0,
    respondedAt: T0,
    ...overrides,
  };
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    blockerId: SANNE,
    blockedId: ME,
    blockedAt: T1,
    liftedAt: null,
    ...overrides,
  };
}

/** Both directions accepted — the derived friendship. */
function mutualPair(a: string, b: string, respondedAt: string = T0): readonly Follow[] {
  return [
    makeFollow({ id: 'f-out', followerId: a, followeeId: b, respondedAt }),
    makeFollow({ id: 'f-in', followerId: b, followeeId: a, respondedAt }),
  ];
}

const ALL_STATUSES: readonly (FollowStatus | null)[] = [null, 'pending', 'accepted', 'declined'];
const ALL_ACTIONS: readonly FollowAction[] = ['request', 'accept', 'decline'];
const ALL_ROLES: readonly FollowRole[] = ['follower', 'followee'];

describe('THE INVARIANT — a one-way follow opens nothing', () => {
  test('following somebody who has not followed back makes you nobody\'s friend', () => {
    const oneWay = [makeFollow({ followerId: ME, followeeId: SANNE })];
    expect(collectFollowedIds(oneWay, [], ME)).toEqual(new Set([SANNE]));
    expect(collectMutualFollowIds(oneWay, [], ME)).toEqual(new Set());
    expect(areMutualFollows(ME, SANNE, oneWay, [])).toBe(false);
  });

  test('being followed by somebody you have not followed back is equally nothing', () => {
    const oneWay = [makeFollow({ followerId: SANNE, followeeId: ME })];
    expect(collectFollowerIds(oneWay, [], ME)).toEqual(new Set([SANNE]));
    expect(collectMutualFollowIds(oneWay, [], ME)).toEqual(new Set());
    expect(areMutualFollows(ME, SANNE, oneWay, [])).toBe(false);
  });

  test('both directions accepted is the friendship, and only then', () => {
    expect(collectMutualFollowIds(mutualPair(ME, SANNE), [], ME)).toEqual(new Set([SANNE]));
    expect(areMutualFollows(ME, SANNE, mutualPair(ME, SANNE), [])).toBe(true);
  });

  test('a pending second direction is NOT a friendship — an unanswered question grants nothing', () => {
    const half = [
      makeFollow({ id: 'f-out', followerId: ME, followeeId: SANNE, status: 'accepted' }),
      makeFollow({ id: 'f-in', followerId: SANNE, followeeId: ME, status: 'pending', respondedAt: null }),
    ];
    expect(collectMutualFollowIds(half, [], ME)).toEqual(new Set());
  });

  test('a declined second direction is NOT a friendship', () => {
    const half = [
      makeFollow({ id: 'f-out', followerId: ME, followeeId: SANNE, status: 'accepted' }),
      makeFollow({ id: 'f-in', followerId: SANNE, followeeId: ME, status: 'declined' }),
    ];
    expect(collectMutualFollowIds(half, [], ME)).toEqual(new Set());
  });

  test('two one-way follows between DIFFERENT people never combine into a friendship', () => {
    // The shape a naive implementation gets wrong: it sees one row where
    // the reader is the follower and one where they are the followee, and
    // concludes "mutual" without checking they are about the same person.
    const crossed = [
      makeFollow({ id: 'f-1', followerId: ME, followeeId: SANNE }),
      makeFollow({ id: 'f-2', followerId: JORIS, followeeId: ME }),
    ];
    expect(collectMutualFollowIds(crossed, [], ME)).toEqual(new Set());
  });

  test('no status other than accepted ever reaches any of the three sets', () => {
    for (const status of ['pending', 'declined'] as const) {
      const rows = [
        makeFollow({ id: 'f-out', followerId: ME, followeeId: SANNE, status }),
        makeFollow({ id: 'f-in', followerId: SANNE, followeeId: ME, status }),
      ];
      expect(collectFollowedIds(rows, [], ME)).toEqual(new Set());
      expect(collectFollowerIds(rows, [], ME)).toEqual(new Set());
      expect(collectMutualFollowIds(rows, [], ME)).toEqual(new Set());
    }
  });

  test('a self-row is refused by every reader, even though the schema refuses it first', () => {
    const self = [makeFollow({ followerId: ME, followeeId: ME })];
    expect(collectFollowedIds(self, [], ME)).toEqual(new Set());
    expect(collectFollowerIds(self, [], ME)).toEqual(new Set());
    expect(areMutualFollows(ME, ME, self, [])).toBe(false);
  });
});

describe('the consent boundary PD-024 binds the migration to', () => {
  test('one accepted friendship, migrated to two accepted follows, exposes exactly what it did', () => {
    // PD-024's first build rule, expressed against the client twin of
    // `is_friend_of`: the pair that was friends before is friends after,
    // and nobody else becomes anything.
    const migrated = mutualPair(ME, SANNE, T0);
    expect(areMutualFollows(ME, SANNE, migrated, [])).toBe(true);
    expect(areMutualFollows(ME, JORIS, migrated, [])).toBe(false);
    expect(collectMutualFollowIds(migrated, [], ME)).toEqual(new Set([SANNE]));
  });

  test('a migrated pending friendship grants nothing on either side', () => {
    const migrated = [
      makeFollow({ followerId: SANNE, followeeId: ME, status: 'pending', respondedAt: null }),
    ];
    expect(collectMutualFollowIds(migrated, [], ME)).toEqual(new Set());
    expect(collectFollowerIds(migrated, [], ME)).toEqual(new Set());
  });
});

describe('blocks — the object that had to exist before the graph could be directed', () => {
  test('a standing block makes an accepted mutual pair count for nothing', () => {
    const blocks = [makeBlock({ blockerId: SANNE, blockedId: ME, blockedAt: T1 })];
    expect(collectMutualFollowIds(mutualPair(ME, SANNE, T0), blocks, ME)).toEqual(new Set());
  });

  test('it does not matter WHO blocked — the effect is mutual', () => {
    const iBlocked = [makeBlock({ blockerId: ME, blockedId: SANNE, blockedAt: T1 })];
    expect(collectFollowedIds(mutualPair(ME, SANNE, T0), iBlocked, ME)).toEqual(new Set());
    expect(collectFollowerIds(mutualPair(ME, SANNE, T0), iBlocked, ME)).toEqual(new Set());
  });

  test('a block between two OTHER people changes nothing for me', () => {
    const elsewhere = [makeBlock({ blockerId: SANNE, blockedId: JORIS, blockedAt: T1 })];
    expect(collectMutualFollowIds(mutualPair(ME, SANNE, T0), elsewhere, ME)).toEqual(new Set([SANNE]));
  });

  test('LIFTING A BLOCK DOES NOT RESTORE A CONSENT GRANTED BEFORE IT', () => {
    // The whole reason `blocks` keeps its row instead of being removed. The
    // follow was accepted at T0, blocked at T1, lifted at T2 — and it stays
    // dead, because lifting restores the ability to ASK and never the
    // answer somebody already gave.
    const lifted = [makeBlock({ blockerId: SANNE, blockedId: ME, blockedAt: T1, liftedAt: T2 })];
    expect(collectMutualFollowIds(mutualPair(ME, SANNE, T0), lifted, ME)).toEqual(new Set());
  });

  test('a follow ACCEPTED AFTER the block was lifted counts again', () => {
    const lifted = [makeBlock({ blockerId: SANNE, blockedId: ME, blockedAt: T1, liftedAt: T2 })];
    const reAsked = mutualPair(ME, SANNE, '2026-09-01T10:00:00.000Z');
    expect(collectMutualFollowIds(reAsked, lifted, ME)).toEqual(new Set([SANNE]));
  });

  test('an acceptance with no respondedAt never survives a block — the fail-closed direction', () => {
    const lifted = [makeBlock({ blockerId: SANNE, blockedId: ME, blockedAt: T1, liftedAt: T2 })];
    const undated = makeFollow({ respondedAt: null });
    expect(followSurvivesBlocks(undated, lifted)).toBe(false);
  });

  test('followSurvivesBlocks is true when there is no block at all', () => {
    expect(followSurvivesBlocks(makeFollow(), [])).toBe(true);
  });

  test('isBlockStanding reads both directions and ignores lifted rows', () => {
    expect(isBlockStanding([makeBlock({ blockerId: SANNE, blockedId: ME })], ME, SANNE)).toBe(true);
    expect(isBlockStanding([makeBlock({ blockerId: ME, blockedId: SANNE })], ME, SANNE)).toBe(true);
    expect(isBlockStanding([makeBlock({ liftedAt: T2 })], ME, SANNE)).toBe(false);
    expect(isBlockStanding([makeBlock({ blockerId: SANNE, blockedId: JORIS })], ME, SANNE)).toBe(false);
  });
});

describe('the transition table — every state, action and actor is answered', () => {
  test('no combination falls through, and none throws', () => {
    // The sweep. `applyFollowAction` has no default branch, so the compiler
    // catches a new status or action; this catches somebody adding one and
    // silencing the compiler with a `default`.
    for (const from of ALL_STATUSES) {
      for (const action of ALL_ACTIONS) {
        for (const actor of ALL_ROLES) {
          for (const isBlocked of [true, false]) {
            const result = applyFollowAction({ from, action, actor, isBlocked });
            expect(typeof result.ok).toBe('boolean');
          }
        }
      }
    }
  });

  test('A STANDING BLOCK REFUSES EVERY MOVE, from every state, by either party', () => {
    for (const from of ALL_STATUSES) {
      for (const action of ALL_ACTIONS) {
        for (const actor of ALL_ROLES) {
          expect(applyFollowAction({ from, action, actor, isBlocked: true })).toEqual({
            ok: false,
            reason: 'blocked',
          });
        }
      }
    }
  });

  test('from nothing: you may ask, and answering something that was never asked is refused', () => {
    expect(applyFollowAction({ from: null, action: 'request', actor: 'follower', isBlocked: false })).toEqual({
      ok: true,
      status: 'pending',
    });
    for (const action of ['accept', 'decline'] as const) {
      expect(applyFollowAction({ from: null, action, actor: 'followee', isBlocked: false })).toEqual({
        ok: false,
        reason: 'no_pending_request',
      });
    }
  });

  test('ONLY THE FOLLOWEE MAY ACCEPT — the rule whose failure is a lek, not a bug', () => {
    expect(applyFollowAction({ from: 'pending', action: 'accept', actor: 'followee', isBlocked: false })).toEqual({
      ok: true,
      status: 'accepted',
    });
    expect(applyFollowAction({ from: 'pending', action: 'accept', actor: 'follower', isBlocked: false })).toEqual({
      ok: false,
      reason: 'not_followee',
    });
  });

  test('only the followee may decline', () => {
    expect(applyFollowAction({ from: 'pending', action: 'decline', actor: 'followee', isBlocked: false })).toEqual({
      ok: true,
      status: 'declined',
    });
    expect(applyFollowAction({ from: 'pending', action: 'decline', actor: 'follower', isBlocked: false })).toEqual({
      ok: false,
      reason: 'not_followee',
    });
  });

  test('asking again while a request is open is refused, from either side', () => {
    for (const actor of ALL_ROLES) {
      expect(applyFollowAction({ from: 'pending', action: 'request', actor, isBlocked: false })).toEqual({
        ok: false,
        reason: 'already_pending',
      });
    }
  });

  test('an accepted follow accepts no further move — ending one is a delete, not a transition', () => {
    for (const action of ALL_ACTIONS) {
      for (const actor of ALL_ROLES) {
        expect(applyFollowAction({ from: 'accepted', action, actor, isBlocked: false })).toEqual({
          ok: false,
          reason: 'already_following',
        });
      }
    }
  });

  test('a declined row may be re-requested BY THE FOLLOWER and by nobody else', () => {
    expect(applyFollowAction({ from: 'declined', action: 'request', actor: 'follower', isBlocked: false })).toEqual({
      ok: true,
      status: 'pending',
    });
    // The escalation this refuses: the person who declined re-opens the row
    // and then "accepts" a request nobody made.
    expect(applyFollowAction({ from: 'declined', action: 'request', actor: 'followee', isBlocked: false })).toEqual({
      ok: false,
      reason: 'no_pending_request',
    });
  });

  test('a declined row cannot be accepted late — the earlier intent expired with the decline', () => {
    for (const actor of ALL_ROLES) {
      expect(applyFollowAction({ from: 'declined', action: 'accept', actor, isBlocked: false })).toEqual({
        ok: false,
        reason: 'no_pending_request',
      });
    }
  });

  test('isLegalFollowTransition agrees with applyFollowAction on every combination', () => {
    for (const from of ALL_STATUSES) {
      for (const action of ALL_ACTIONS) {
        for (const actor of ALL_ROLES) {
          for (const isBlocked of [true, false]) {
            const transition = { from, action, actor, isBlocked };
            expect(isLegalFollowTransition(transition)).toBe(applyFollowAction(transition).ok);
          }
        }
      }
    }
  });
});

describe('nextFollowFields — the row a legal move produces', () => {
  test('opening a direction names the actor as follower and the other as followee', () => {
    expect(nextFollowFields(null, ME, SANNE, 'pending', T2)).toEqual({
      followerId: ME,
      followeeId: SANNE,
      status: 'pending',
      respondedAt: null,
    });
  });

  test('THE SIDES NEVER SWAP on a re-request — unlike nextFriendshipFields', () => {
    // friendship.ts swaps requester and addressee when a declined pair
    // re-opens, because the pair is unordered. Here the direction IS the
    // row: a swap would turn "I asked to follow you" into "you asked to
    // follow me", which 0021's trigger raises on.
    const declined = makeFollow({ followerId: ME, followeeId: SANNE, status: 'declined', respondedAt: T1 });
    expect(nextFollowFields(declined, ME, SANNE, 'pending', T2)).toEqual({
      followerId: ME,
      followeeId: SANNE,
      status: 'pending',
      respondedAt: null,
    });
  });

  test('a re-request RESETS respondedAt, which is what stops consent crossing a block', () => {
    const declined = makeFollow({ status: 'declined', respondedAt: T0 });
    expect(nextFollowFields(declined, ME, SANNE, 'pending', T2).respondedAt).toBeNull();
  });

  test('answering stamps respondedAt with the moment consent was given', () => {
    const pending = makeFollow({ status: 'pending', respondedAt: null });
    expect(nextFollowFields(pending, SANNE, ME, 'accepted', T2).respondedAt).toBe(T2);
    expect(nextFollowFields(pending, SANNE, ME, 'declined', T2).respondedAt).toBe(T2);
  });

  test('an existing row keeps its own direction whichever party acts', () => {
    const pending = makeFollow({ followerId: ME, followeeId: SANNE, status: 'pending', respondedAt: null });
    // Sanne is the one accepting, and the row still points ME -> SANNE.
    const fields = nextFollowFields(pending, SANNE, ME, 'accepted', T2);
    expect(fields.followerId).toBe(ME);
    expect(fields.followeeId).toBe(SANNE);
  });
});

describe('roles', () => {
  test('followRoleOf names the side, or null for somebody who is not a party', () => {
    const follow = makeFollow({ followerId: ME, followeeId: SANNE });
    expect(followRoleOf(follow, ME)).toBe('follower');
    expect(followRoleOf(follow, SANNE)).toBe('followee');
    expect(followRoleOf(follow, JORIS)).toBeNull();
  });

  test('with no row the actor is the follower, because asking is the only move from nothing', () => {
    expect(resolveFollowActorRole(null, ME)).toBe('follower');
  });

  test('a non-party falls back to follower rather than throwing', () => {
    expect(resolveFollowActorRole(makeFollow(), JORIS)).toBe('follower');
  });
});

describe('partitionFollows — what the screen draws', () => {
  const rows: readonly Follow[] = [
    makeFollow({ id: 'in-pending', followerId: SANNE, followeeId: ME, status: 'pending', respondedAt: null }),
    makeFollow({ id: 'out-pending', followerId: ME, followeeId: JORIS, status: 'pending', respondedAt: null }),
    makeFollow({ id: 'following', followerId: ME, followeeId: SANNE, status: 'accepted' }),
    makeFollow({ id: 'follower', followerId: JORIS, followeeId: ME, status: 'accepted' }),
    makeFollow({ id: 'declined', followerId: ME, followeeId: 'profile-x', status: 'declined' }),
    makeFollow({ id: 'not-mine', followerId: SANNE, followeeId: JORIS, status: 'accepted' }),
  ];

  test('four buckets, and a declined row appears in none of them', () => {
    const partition = partitionFollows(rows, [], ME);
    expect(partition.incomingRequests.map((f) => f.id)).toEqual(['in-pending']);
    expect(partition.outgoingRequests.map((f) => f.id)).toEqual(['out-pending']);
    expect(partition.following.map((f) => f.id)).toEqual(['following']);
    expect(partition.followers.map((f) => f.id)).toEqual(['follower']);
  });

  test('a row the reader is not a party to is dropped rather than mis-filed', () => {
    const partition = partitionFollows(rows, [], ME);
    const everyId = [
      ...partition.incomingRequests,
      ...partition.outgoingRequests,
      ...partition.following,
      ...partition.followers,
    ].map((f) => f.id);
    expect(everyId).not.toContain('not-mine');
  });

  test('a blocked pair appears in NO bucket, in either direction', () => {
    // partitionFriendships's rule, carried across: "a row that appears for
    // one party and not the other is how the blocked person works out what
    // happened."
    const blocks = [makeBlock({ blockerId: ME, blockedId: SANNE, blockedAt: T1 })];
    const partition = partitionFollows(rows, blocks, ME);
    expect(partition.incomingRequests).toEqual([]);
    expect(partition.following).toEqual([]);
    // Joris is untouched by a block against Sanne.
    expect(partition.outgoingRequests.map((f) => f.id)).toEqual(['out-pending']);
    expect(partition.followers.map((f) => f.id)).toEqual(['follower']);
  });

  test('input order is preserved — nothing here is ordered by recency', () => {
    const twoIncoming: readonly Follow[] = [
      makeFollow({ id: 'second', followerId: JORIS, followeeId: ME, status: 'pending', respondedAt: null, createdAt: T2 }),
      makeFollow({ id: 'first', followerId: SANNE, followeeId: ME, status: 'pending', respondedAt: null, createdAt: T0 }),
    ];
    expect(partitionFollows(twoIncoming, [], ME).incomingRequests.map((f) => f.id)).toEqual(['second', 'first']);
  });

  test('an accepted follow that did not survive a lifted block is not listed as following', () => {
    const lifted = [makeBlock({ blockerId: SANNE, blockedId: ME, blockedAt: T1, liftedAt: T2 })];
    expect(partitionFollows(rows, lifted, ME).following).toEqual([]);
  });
});

describe('case, because these readers are reached from a local store too', () => {
  const UPPER = ME.toUpperCase();

  test('a differently-cased id still finds the same relationship', () => {
    // sendRecipe.ts's `otherSideOf` was written because getting this wrong
    // "does not merely miss a friend — it makes the reader their OWN
    // friend, offers them their own dishes, and sends them a recipe they
    // already have". Canonicalising in `followRoleOf` is what lets that
    // second implementation go away rather than being copied again.
    const rows = mutualPair(ME, SANNE);
    expect(collectMutualFollowIds(rows, [], UPPER)).toEqual(new Set([SANNE]));
    expect(areMutualFollows(UPPER, SANNE, rows, [])).toBe(true);
  });

  test('a row whose two sides differ only in case is a self-row and counts for nobody', () => {
    const self = [makeFollow({ followerId: ME, followeeId: UPPER })];
    expect(collectFollowedIds(self, [], ME)).toEqual(new Set());
    expect(collectFollowerIds(self, [], ME)).toEqual(new Set());
  });

  test('followRoleOf canonicalises both sides', () => {
    expect(followRoleOf(makeFollow({ followerId: ME, followeeId: SANNE }), UPPER)).toBe('follower');
    expect(followRoleOf(makeFollow({ followerId: SANNE, followeeId: ME }), UPPER)).toBe('followee');
  });

  test('a blank id is nobody', () => {
    expect(areMutualFollows('', SANNE, mutualPair(ME, SANNE), [])).toBe(false);
  });
});

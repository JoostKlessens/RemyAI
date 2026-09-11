import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { collectMutualFollowIds } from '@/domain/social/follow';
import type { Follow } from '@/domain/social/types';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalSocialRepository } from '@/lib/repository/social/localSocialRepository';
import type { RemySocialRepository } from '@/lib/repository/social/types';
import { createTableAccessor, type TableAccessor } from '@/lib/repository/table';
import { PROFILE_A, PROFILE_B, PROFILE_C } from '../social/fixtures';

/**
 * The STORAGE half of PD-024's directed graph — `createLocalFollowGraph`
 * (src/lib/repository/social/localFollowGraph.ts), reached the only way the
 * app ever reaches it: through `createLocalSocialRepository`, which spreads
 * it in. Testing the factory directly would prove the factory works and
 * prove nothing about the object a screen actually holds — and the spread is
 * itself forgettable: one missing `...` and every method below is undefined
 * at runtime while `tsc` stays green, because `RemySocialRepository extends
 * RemyFollowGraphRepository` describes the type and not the assembly.
 *
 * ===========================================================================
 * WHAT THIS FILE IS ABOUT, AND WHAT IT DELIBERATELY LEAVES ALONE
 * ===========================================================================
 *
 * tests/social/follow.test.ts already enumerates the whole transition table,
 * every collector and every block predicate over hand-built rows. None of
 * that is repeated here, and repeating it would be worse than redundant: two
 * copies of one table drift, and the copy nobody thinks of as authoritative
 * is the one that gets edited to match a bug.
 *
 * What is left is the part a pure test cannot see, and the part a local
 * store has no database constraints to lean on for:
 *
 *   1. THE ROW LANDS — a legal move is not merely permitted but written,
 *      with the two fields the domain deliberately does not own (`id`,
 *      `createdAt`) supplied by the store.
 *   2. THE ROW STAYS PUT — an illegal move leaves the stored row exactly as
 *      it was; a refusal that half-wrote first is worse than no refusal.
 *   3. THE DIRECTION SURVIVES THE ROUND TRIP. `follows` is the first table
 *      here where (A, B) and (B, A) are two different facts, and most of
 *      what follows is a way of checking the store never confuses them.
 *   4. WHAT COMES BACK OUT IS WHAT THE INTERFACE PROMISED — including the
 *      promises that look like oversights, above all `listBlocks` returning
 *      rows that have been lifted.
 *
 * WHY THE CLOCK IS FROZEN, and why that is not optional here:
 * `followSurvivesBlocks` compares a follow's `respondedAt` against a block's
 * `blockedAt` with `>=`. Both are stamped by `nowIso()` at millisecond
 * resolution, and an accept followed by a block inside one test runs
 * comfortably inside one millisecond — so on a real clock the acceptance and
 * the block that must invalidate it would routinely carry the IDENTICAL
 * timestamp, `>=` would hold, and the single most important assertion in
 * this file would pass for a reason unrelated to the code being right.
 * `vi.setSystemTime` makes the ordering an input instead of a race. Only
 * `Date` is faked, because nothing here schedules a timer and a fake
 * `setTimeout` is a way for an unrelated await to hang.
 *
 * ===========================================================================
 * ⚠ WHY SOME ROWS ARE SEEDED INSTEAD OF WRITTEN — A DEFECT, NOT A SHORTCUT
 * ===========================================================================
 *
 * `actOnFollow` resolves the row it is about as
 * `findDirectedRow(actor, other) ?? findDirectedRow(other, actor)`. The
 * fallback is right and necessary for `accept` and `decline`, where the
 * actor is the FOLLOWEE of a row somebody else opened. It is applied to
 * `request` as well, and there it is wrong: a `request` names a direction
 * that has no row yet, so the fallback hands the transition table the row
 * pointing the OTHER way and the move is judged against a relationship the
 * caller did not ask about.
 *
 * So following back — "als je wil terugvolgen", the owner's own sentence,
 * ONTDEK-PLAN.md line 1376's "optioneel terugvolgen" — is unreachable: once
 * ik->sanne holds any row at all, `actOnFollow(sanne, ik, 'request')` finds
 * that row and is refused `already_following` (from accepted) or
 * `already_pending` (from pending). A SECOND ROW FOR A PAIR THEREFORE CANNOT
 * BE CREATED THROUGH THE WRITE PATH — the shape the entire migration exists
 * to make possible, and which `collectMutualFollowIds`, `partitionFollows`'s
 * separate `following`/`followers` buckets and `is_friend_of`'s rewritten
 * body all require. src/lib/repository/social/supabaseFollowGraph.ts
 * resolves `existing` the same way, so this is one defect in a shared
 * design, not a local slip.
 *
 * It is recorded and NOT repaired here: the fix is production code, and a
 * test that quietly patched the thing it measures would be the worst place
 * to put it. `following back opens a SECOND row` below states the promise
 * and is marked `test.fails`, so it stays honest today and turns red — in
 * the right file — the day the write path is fixed and nobody comes back
 * here. Everywhere else a second direction is needed the row is seeded
 * straight into `remy:follows`, which is exactly what 0021's own data
 * migration does when it turns one accepted friendship into two follows.
 */

let store: KeyValueStore;
let repository: RemySocialRepository;
/** The key `createLocalSocialRepository` builds its own accessor over — used only to seed the rows the write path cannot reach (header). */
let followRows: TableAccessor<Follow>;

/**
 * Moments a day apart, so every ordering this file depends on is visible in
 * the constant names rather than in an execution order a reader has to
 * reconstruct. A day is not realistic and is not meant to be — it is the
 * smallest gap that makes an accidental millisecond collision impossible.
 */
const T_REQUEST = '2026-06-01T10:00:00.000Z';
const T_ACCEPT = '2026-06-02T10:00:00.000Z';
const T_BLOCK = '2026-06-03T10:00:00.000Z';
const T_LIFT = '2026-06-04T10:00:00.000Z';
const T_AGAIN = '2026-06-05T10:00:00.000Z';
const T_RE_BLOCK = '2026-06-06T10:00:00.000Z';
const T_RE_LIFT = '2026-06-07T10:00:00.000Z';

/**
 * Nothing in `localFollowGraph.ts` consults `profiles`, so these rows change
 * no outcome below. They are written anyway because 0021 gives both tables a
 * foreign key to `profiles`, and to keep the fixtures reading as three
 * people — tests/social/fixtures.ts spells its ids as uuids for that reason.
 */
async function seedProfiles(): Promise<void> {
  await repository.upsertProfile({ id: PROFILE_A, handle: 'joost', displayName: 'Joost', avatarUrl: null });
  await repository.upsertProfile({ id: PROFILE_B, handle: 'sanne', displayName: 'Sanne', avatarUrl: null });
  await repository.upsertProfile({ id: PROFILE_C, handle: 'joris', displayName: 'Joris', avatarUrl: null });
}

beforeEach(async () => {
  // Only `Date` — see the header on why a faked `setTimeout` is a liability
  // in an all-async suite that schedules nothing.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(T_REQUEST));
  store = createInMemoryKeyValueStore();
  repository = createLocalSocialRepository(store);
  followRows = createTableAccessor<Follow>(store, 'remy:follows');
  await seedProfiles();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Runs one repository call at a named moment, so ordering is stated rather than implied. */
async function at<T>(moment: string, act: () => Promise<T>): Promise<T> {
  vi.setSystemTime(new Date(moment));
  return act();
}

/** Appends a row directly — see the header: this is how a second direction comes into existence at all. */
async function seedFollow(overrides: Partial<Follow> & Pick<Follow, 'followerId' | 'followeeId'>): Promise<Follow> {
  const existing = await followRows.list();
  const row: Follow = {
    id: `seeded-follow-${existing.length + 1}`,
    status: 'accepted',
    createdAt: T_REQUEST,
    respondedAt: T_ACCEPT,
    ...overrides,
  };
  await followRows.replaceAll([...existing, row]);
  return row;
}

/**
 * The derived friendship, assembled the only way it currently can be: the
 * A->B half through the real write path, the B->A half seeded because the
 * write path refuses to open it (header, defect note). `respondedAt` is the
 * parameter because it is the one variable every block test turns on.
 */
async function grantMutualPair(respondedAt: string): Promise<void> {
  await at(respondedAt, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
  await at(respondedAt, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));
  await seedFollow({
    followerId: PROFILE_B,
    followeeId: PROFILE_A,
    status: 'accepted',
    createdAt: respondedAt,
    respondedAt,
  });
}

/**
 * "Wederzijds", asked exactly the way `followGraph.ts` tells a caller to ask
 * it: both reads from the repository, the answer from the domain. That
 * combination is the point of the assertion rather than a detail of it — a
 * `listFollows` that filtered blocks itself, or a `listBlocks` that dropped
 * lifted rows, would each break this while looking correct alone.
 */
async function readMutualFollowIds(profileId: string): Promise<ReadonlySet<string>> {
  const [follows, blocks] = await Promise.all([repository.listFollows(profileId), repository.listBlocks(profileId)]);
  return collectMutualFollowIds(follows, blocks, profileId);
}

describe('actOnFollow — opening a direction', () => {
  test('a request writes one pending row with the actor as its follower', async () => {
    const follow = await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    expect(follow.status).toBe('pending');
    expect(follow.followerId).toBe(PROFILE_A);
    expect(follow.followeeId).toBe(PROFILE_B);
    expect(follow.respondedAt).toBeNull();
    expect(follow.createdAt).toBe(T_REQUEST);
    expect(follow.id).not.toBe('');
  });

  test('the row the caller is handed is the row that was stored', async () => {
    const returned = await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    expect(await repository.getFollowBetween(PROFILE_A, PROFILE_B)).toEqual(returned);
  });

  test('asking twice in the same direction adds no second row', async () => {
    await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'request')).rejects.toThrow(/already_pending/);
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(1);
  });
});

describe('actOnFollow — the direction belongs to the row, never to the actor', () => {
  test('the followee accepts, and the answer is stamped with the moment consent was given', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));

    const accepted = await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));

    expect(accepted.status).toBe('accepted');
    expect(accepted.respondedAt).toBe(T_ACCEPT);
  });

  /**
   * The trap the interface warns about in capitals: the actor of an `accept`
   * is the FOLLOWEE, so an implementation that trusted the argument order
   * would mint a fresh sanne->ik row and leave the real request unanswered.
   */
  test('accepting answers the EXISTING row and never mints a second one pointing back', async () => {
    const opened = await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    const accepted = await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));

    expect(accepted.id).toBe(opened.id);
    expect(accepted.followerId).toBe(PROFILE_A);
    expect(accepted.followeeId).toBe(PROFILE_B);
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(1);
    expect(await repository.getFollowBetween(PROFILE_B, PROFILE_A)).toBeNull();
  });

  /** The same trap with the pair written the other way round, so neither orientation is merely lucky. */
  test('it holds with the roles reversed — the followee answering does not become the follower', async () => {
    const opened = await repository.actOnFollow(PROFILE_B, PROFILE_A, 'request');

    const accepted = await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'accept'));

    expect(accepted.id).toBe(opened.id);
    expect(accepted.followerId).toBe(PROFILE_B);
    expect(accepted.followeeId).toBe(PROFILE_A);
    expect(await repository.getFollowBetween(PROFILE_A, PROFILE_B)).toBeNull();
    expect(await repository.listFollows(PROFILE_B)).toHaveLength(1);
  });

  test('declining answers the same existing row, still pointing the way it was opened', async () => {
    const opened = await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    const declined = await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'decline'));

    expect(declined.id).toBe(opened.id);
    expect(declined.status).toBe('declined');
    expect(declined.followerId).toBe(PROFILE_A);
    expect(declined.respondedAt).toBe(T_ACCEPT);
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(1);
  });

  test('the creation time survives the answer — only respondedAt is written', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));

    const accepted = await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));

    expect(accepted.createdAt).toBe(T_REQUEST);
  });

  test('a follower accepting their own request is refused, and the stored row does not move', async () => {
    await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'accept')).rejects.toThrow(/not_followee/);
    expect((await repository.getFollowBetween(PROFILE_A, PROFILE_B))?.status).toBe('pending');
  });

  test('a follower declining their own request is refused the same way', async () => {
    await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'decline')).rejects.toThrow(/not_followee/);
    expect((await repository.getFollowBetween(PROFILE_A, PROFILE_B))?.status).toBe('pending');
  });
});

describe('actOnFollow — re-opening a direction that was declined', () => {
  beforeEach(async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
    await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'decline'));
  });

  test('the follower may ask again, on the same row, with respondedAt put back to null', async () => {
    const reopened = await at(T_AGAIN, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));

    expect(reopened.status).toBe('pending');
    expect(reopened.respondedAt).toBeNull();
    expect(reopened.followerId).toBe(PROFILE_A);
    expect(reopened.followeeId).toBe(PROFILE_B);
    expect(reopened.createdAt).toBe(T_REQUEST);
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(1);
  });

  /**
   * ⚠ THIS TEST ASSERTED THE OPPOSITE UNTIL THE WRITE PATH WAS FIXED, and
   * the old expectation was a symmetric-graph assumption wearing directed
   * clothes. It read: the followee who declined cannot re-open the row.
   *
   * They cannot, and that half still holds — A->B stays declined and B
   * never touches it. But B asking to follow A is not re-opening anything:
   * it is B's OWN direction, a row that did not exist, which A must accept
   * in turn. Refusing it would mean that declining somebody's request
   * permanently barred you from ever following them back, which is not a
   * rule anybody chose and is the exact asymmetry migration 0021 exists to
   * make expressible.
   *
   * The escalation the domain's `fromDeclined(request, followee)` branch
   * guards — the person who declined re-opening the row and then
   * "accepting" a request nobody made — is now impossible by construction
   * rather than by refusal: a `request` only ever addresses the row the
   * actor would own. That branch stays in `follow.ts` as belt and braces
   * for callers that look a row up differently, and is covered in
   * tests/social/follow.test.ts.
   */
  test('the followee who declined may still open their OWN direction, and the declined row does not move', async () => {
    const back = await at(T_AGAIN, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'request'));

    expect(back.followerId).toBe(PROFILE_B);
    expect(back.followeeId).toBe(PROFILE_A);
    expect(back.status).toBe('pending');
    expect(back.respondedAt).toBeNull();

    // A's own request is untouched: still declined, still A's row.
    expect((await repository.getFollowBetween(PROFILE_A, PROFILE_B))?.status).toBe('declined');
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(2);
  });

  test('a declined row cannot be accepted late', async () => {
    await expect(repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept')).rejects.toThrow(/no_pending_request/);
    expect((await repository.getFollowBetween(PROFILE_A, PROFILE_B))?.status).toBe('declined');
  });
});

describe('the second row — two rows per pair is the whole reason friendships could not be extended', () => {
  /**
   * ⚠ THIS TEST WAS WRITTEN AS `test.fails` AND IS NOW A PLAIN ONE, because
   * it found a real defect and the defect is fixed. It is the reason this
   * file exists.
   *
   * What it caught: `actOnFollow` resolved the row it acts on as "my
   * direction, else theirs". That fallback is right for `accept` and
   * `decline`, where the actor is the followee of a row somebody else
   * opened — and wrong for `request`, which names a direction that has no
   * row yet. With any row standing the other way, the fallback handed the
   * transition table that row and the move came back refused. A second row
   * for a pair could therefore never be created through the write path:
   * following back was impossible, which is the entire thing migration 0021
   * exists to enable and the owner's own sentence, *"als je wil
   * terugvolgen"*. BOTH backends carried it — one design, two copies — and
   * both now decide by the ACTION instead: a request is about the row I
   * would own, an answer is about the row pointing at me.
   */
  test('following back opens a SECOND row with its own status', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
    await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));

    const back = await at(T_AGAIN, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'request'));

    expect(back.followerId).toBe(PROFILE_B);
    expect(back.followeeId).toBe(PROFILE_A);
    expect(back.status).toBe('pending');
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(2);
  });

  /**
   * The storage layer's half of the same promise, which DOES hold: given two
   * rows, nothing collapses, merges or overwrites them. Worth pinning apart,
   * because it is what makes the defect above a bug in one method rather
   * than in the table shape.
   */
  test('two rows for one pair are stored and read back as two independent facts', async () => {
    await seedFollow({ followerId: PROFILE_A, followeeId: PROFILE_B, status: 'accepted' });
    await seedFollow({ followerId: PROFILE_B, followeeId: PROFILE_A, status: 'pending', respondedAt: null });

    const forward = await repository.getFollowBetween(PROFILE_A, PROFILE_B);
    const backward = await repository.getFollowBetween(PROFILE_B, PROFILE_A);

    expect(forward?.status).toBe('accepted');
    expect(backward?.status).toBe('pending');
    expect(forward?.id).not.toBe(backward?.id);
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(2);
  });
});

describe('removeFollow — one direction, and no actor at all', () => {
  test('it removes the named direction and leaves the one pointing back standing', async () => {
    await seedFollow({ followerId: PROFILE_A, followeeId: PROFILE_B });
    await seedFollow({ followerId: PROFILE_B, followeeId: PROFILE_A });

    await repository.removeFollow(PROFILE_A, PROFILE_B);

    expect(await repository.getFollowBetween(PROFILE_A, PROFILE_B)).toBeNull();
    expect(await repository.getFollowBetween(PROFILE_B, PROFILE_A)).not.toBeNull();
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(1);
  });

  test('asking for the reverse of an existing row removes nothing', async () => {
    await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    await repository.removeFollow(PROFILE_B, PROFILE_A);

    expect(await repository.getFollowBetween(PROFILE_A, PROFILE_B)).not.toBeNull();
  });

  /**
   * `removeFollow` takes no actor, and that absence IS the widening the
   * interface describes: unfollowing and removing a follower are the same
   * delete reached from two sides, so a mutual pair ends as two calls.
   */
  test('a mutual pair ends as two separate deletes, one per direction', async () => {
    await grantMutualPair(T_ACCEPT);

    await repository.removeFollow(PROFILE_A, PROFILE_B);
    await repository.removeFollow(PROFILE_B, PROFILE_A);

    expect(await repository.listFollows(PROFILE_A)).toHaveLength(0);
    expect(await repository.listFollows(PROFILE_B)).toHaveLength(0);
  });

  /**
   * The exception `removeFriendship` had to carve — "only the blocker may
   * remove a block", tests/repository/localSocialRepository.test.ts — has no
   * counterpart here, and its absence is deliberate: a block is not in this
   * table any more, so there is no row whose deletion could undo one.
   */
  test('a standing block does not refuse the delete, because the block is not in this table', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
    await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    await expect(repository.removeFollow(PROFILE_A, PROFILE_B)).resolves.toBeUndefined();

    expect(await repository.getFollowBetween(PROFILE_A, PROFILE_B)).toBeNull();
    expect(await repository.listBlocks(PROFILE_A)).toHaveLength(1);
  });

  test('removing a direction that has no row is a no-op rather than an error', async () => {
    await expect(repository.removeFollow(PROFILE_A, PROFILE_C)).resolves.toBeUndefined();
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(0);
  });

  test('removing one pair leaves every other pair alone', async () => {
    await seedFollow({ followerId: PROFILE_A, followeeId: PROFILE_B });
    await seedFollow({ followerId: PROFILE_A, followeeId: PROFILE_C });

    await repository.removeFollow(PROFILE_A, PROFILE_B);

    expect(await repository.listFollows(PROFILE_A)).toHaveLength(1);
    expect(await repository.getFollowBetween(PROFILE_A, PROFILE_C)).not.toBeNull();
  });
});

describe('blockProfile — a standing row, written without needing a relationship first', () => {
  test('a block is written standing, stamped with the moment it was made', async () => {
    const block = await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    expect(block.blockerId).toBe(PROFILE_A);
    expect(block.blockedId).toBe(PROFILE_B);
    expect(block.blockedAt).toBe(T_BLOCK);
    expect(block.liftedAt).toBeNull();
  });

  test('blocking somebody who never asked needs no follow row to hang the flag on', async () => {
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(0);

    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    expect(await repository.listBlocks(PROFILE_A)).toHaveLength(1);
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(0);
  });

  test('blocking again while the block stands returns the same row and writes no second one', async () => {
    const first = await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    const second = await at(T_AGAIN, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    expect(second.id).toBe(first.id);
    expect(second.blockedAt).toBe(T_BLOCK);
    expect(await repository.listBlocks(PROFILE_A)).toHaveLength(1);
  });

  test('both people blocking each other is two statements, stored separately', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));
    await at(T_AGAIN, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    const blocks = await repository.listBlocks(PROFILE_A);

    expect(blocks).toHaveLength(2);
    expect([...blocks].map((block) => block.blockerId).sort()).toEqual([PROFILE_A, PROFILE_B].sort());
  });

  test('a profile cannot block itself', async () => {
    await expect(repository.blockProfile(PROFILE_A, PROFILE_A)).rejects.toThrow(/cannot block itself/i);
    expect(await repository.listBlocks(PROFILE_A)).toHaveLength(0);
  });
});

describe('liftBlock — the row that is stamped and never removed', () => {
  test('lifting stamps liftedAt and keeps the row, which listBlocks goes on returning', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    await at(T_LIFT, () => repository.liftBlock(PROFILE_A, PROFILE_B));

    const blocks = await repository.listBlocks(PROFILE_A);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.liftedAt).toBe(T_LIFT);
    // `blockedAt` is the half that has to survive: it is what every later
    // acceptance is measured against.
    expect(blocks[0]?.blockedAt).toBe(T_BLOCK);
  });

  test('lifting an already lifted block leaves the first lift standing', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));
    await at(T_LIFT, () => repository.liftBlock(PROFILE_A, PROFILE_B));

    await at(T_AGAIN, () => repository.liftBlock(PROFILE_A, PROFILE_B));

    expect((await repository.listBlocks(PROFILE_A))[0]?.liftedAt).toBe(T_LIFT);
  });

  /**
   * "Only the blocker may" is spelled as an ORDERED PAIR rather than as a
   * permission check, and this is what that buys: the blocked party naming
   * themselves first addresses a row that does not exist.
   */
  test('the blocked party asking for a lift finds no row of their own, and the block still stands', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    await expect(at(T_LIFT, () => repository.liftBlock(PROFILE_B, PROFILE_A))).resolves.toBeUndefined();

    const blocks = await repository.listBlocks(PROFILE_A);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.liftedAt).toBeNull();
  });

  test('lifting a pair that was never blocked is a no-op rather than an error', async () => {
    await expect(repository.liftBlock(PROFILE_A, PROFILE_C)).resolves.toBeUndefined();
    expect(await repository.listBlocks(PROFILE_A)).toHaveLength(0);
  });

  test('re-blocking after a lift moves blockedAt FORWARD on the same row and clears the lift', async () => {
    const first = await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));
    await at(T_LIFT, () => repository.liftBlock(PROFILE_A, PROFILE_B));

    const again = await at(T_RE_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    expect(again.id).toBe(first.id);
    expect(again.blockedAt).toBe(T_RE_BLOCK);
    expect(again.liftedAt).toBeNull();
    expect(await repository.listBlocks(PROFILE_A)).toHaveLength(1);
  });
});

describe('a standing block refuses every move, from every state, by either party', () => {
  test('from nothing: a blocked pair cannot even ask, and no row is left behind', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'request')).rejects.toThrow(/blocked/);
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(0);
  });

  test('from pending: neither the follower nor the followee can move, and the row stays pending', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'request')).rejects.toThrow(/blocked/);
    await expect(repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept')).rejects.toThrow(/blocked/);
    await expect(repository.actOnFollow(PROFILE_B, PROFILE_A, 'decline')).rejects.toThrow(/blocked/);
    expect((await repository.getFollowBetween(PROFILE_A, PROFILE_B))?.status).toBe('pending');
  });

  test('from accepted: the row is frozen, and it does not matter which side put the block up', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
    await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));
    // The FOLLOWER blocks here, the mirror of the pending case above.
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'request')).rejects.toThrow(/blocked/);
    await expect(repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept')).rejects.toThrow(/blocked/);
    expect((await repository.getFollowBetween(PROFILE_A, PROFILE_B))?.status).toBe('accepted');
  });

  test('from declined: the follower cannot re-open the row while a block stands', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
    await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'decline'));
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'request')).rejects.toThrow(/blocked/);
    expect((await repository.getFollowBetween(PROFILE_A, PROFILE_B))?.status).toBe('declined');
  });

  /**
   * The block is consulted BEFORE the state, and the reason code proves it:
   * the identical call on the identical row reports `already_following`
   * without a block and `blocked` with one. An implementation that fell
   * through the state machine first would still refuse the move — and hand
   * the UI the wrong word for the sentence it has to render.
   */
  test('the refusal names `blocked` rather than whatever state the row happens to be in', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
    await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'request')).rejects.toThrow(/already_following/);

    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    await expect(repository.actOnFollow(PROFILE_A, PROFILE_B, 'request')).rejects.toThrow(/blocked/);
  });

  test('a lifted block refuses no move — lifting restores the ability to ask', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));
    await at(T_LIFT, () => repository.liftBlock(PROFILE_B, PROFILE_A));

    const follow = await at(T_AGAIN, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));

    expect(follow.status).toBe('pending');
  });

  test('a block between two other people refuses nothing between these two', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_C));

    const follow = await at(T_AGAIN, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));

    expect(follow.status).toBe('pending');
  });
});

/**
 * THE POINT OF THE WHOLE TABLE, ASKED THROUGH THE STORE.
 *
 * tests/social/follow.test.ts proves `followSurvivesBlocks` gets this right
 * over hand-built rows. What only a stored round trip can show is that
 * `listFollows` and `listBlocks` between them hand the domain everything it
 * needs to reach the same answer — including the lifted block row, the one
 * piece a tidy-minded implementation would be most tempted to filter out,
 * and whose absence would silently restore a consent nobody re-granted.
 */
describe('lifting a block, and the consent it deliberately does not restore', () => {
  test('a mutual pair with no block between them is mutual', async () => {
    await grantMutualPair(T_ACCEPT);

    expect(await readMutualFollowIds(PROFILE_A)).toEqual(new Set([PROFILE_B]));
    expect(await readMutualFollowIds(PROFILE_B)).toEqual(new Set([PROFILE_A]));
  });

  test('a standing block makes the same pair count for nothing, in both directions', async () => {
    await grantMutualPair(T_ACCEPT);

    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    expect(await readMutualFollowIds(PROFILE_A)).toEqual(new Set());
    expect(await readMutualFollowIds(PROFILE_B)).toEqual(new Set());
  });

  test('AN ACCEPTANCE FROM BEFORE THE BLOCK STAYS DEAD AFTER THE LIFT', async () => {
    await grantMutualPair(T_ACCEPT);
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    await at(T_LIFT, () => repository.liftBlock(PROFILE_B, PROFILE_A));

    // The lifted row is still there to be read — that is the mechanism, and
    // if this assertion ever fails the ones below it start passing for the
    // worst possible reason.
    const blocks = await repository.listBlocks(PROFILE_A);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.liftedAt).toBe(T_LIFT);
    // Both follow rows survive the lift untouched; nothing rewrote them.
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(2);
    // And they count for nothing, because the consent predates the block.
    expect(await readMutualFollowIds(PROFILE_A)).toEqual(new Set());
    expect(await readMutualFollowIds(PROFILE_B)).toEqual(new Set());
  });

  test('an acceptance granted AFTER the lift counts, on the very same block history', async () => {
    await grantMutualPair(T_ACCEPT);
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));
    await at(T_LIFT, () => repository.liftBlock(PROFILE_B, PROFILE_A));
    expect(await readMutualFollowIds(PROFILE_A)).toEqual(new Set());

    // Asked again and answered again, through the write path, after the lift.
    await repository.removeFollow(PROFILE_A, PROFILE_B);
    await repository.removeFollow(PROFILE_B, PROFILE_A);
    await grantMutualPair(T_AGAIN);

    expect(await readMutualFollowIds(PROFILE_A)).toEqual(new Set([PROFILE_B]));
    // The lifted block has not gone anywhere; it simply no longer postdates
    // the answer it once invalidated.
    expect(await repository.listBlocks(PROFILE_A)).toHaveLength(1);
  });

  test('a re-block reaches past a consent that was granted after the earlier lift', async () => {
    await grantMutualPair(T_AGAIN);

    await at(T_RE_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));
    await at(T_RE_LIFT, () => repository.liftBlock(PROFILE_B, PROFILE_A));

    // `blockedAt` moved forward to T_RE_BLOCK, which is later than the
    // acceptance at T_AGAIN — so the consent is dead again, and the pair has
    // to be re-granted a second time.
    expect(await readMutualFollowIds(PROFILE_A)).toEqual(new Set());
  });
});

describe('listFollows, listBlocks and getFollowBetween — what comes back out', () => {
  test('listFollows returns every row this profile is a party to, in both directions and every status', async () => {
    await seedFollow({ followerId: PROFILE_A, followeeId: PROFILE_B, status: 'pending', respondedAt: null });
    await seedFollow({ followerId: PROFILE_B, followeeId: PROFILE_A, status: 'accepted' });
    await seedFollow({ followerId: PROFILE_A, followeeId: PROFILE_C, status: 'declined' });
    await seedFollow({ followerId: PROFILE_B, followeeId: PROFILE_C, status: 'accepted' });

    const mine = await repository.listFollows(PROFILE_A);

    expect(mine).toHaveLength(3);
    expect([...mine].map((follow) => follow.status).sort()).toEqual(['accepted', 'declined', 'pending']);
  });

  /**
   * `listFollows` filters by party and by NOTHING ELSE — no block filtering,
   * so that "counts" has one definition and it lives in the domain. A row
   * hidden here would be a second, invisible definition.
   */
  test('listFollows hides nothing behind a standing block', async () => {
    await grantMutualPair(T_ACCEPT);

    await at(T_BLOCK, () => repository.blockProfile(PROFILE_B, PROFILE_A));

    expect(await repository.listFollows(PROFILE_A)).toHaveLength(2);
  });

  test('listFollows returns nothing for a profile that is in no row', async () => {
    await seedFollow({ followerId: PROFILE_A, followeeId: PROFILE_B });

    expect(await repository.listFollows(PROFILE_C)).toHaveLength(0);
  });

  test('listBlocks returns blocks in both directions, lifted ones included', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_C, PROFILE_A));
    await at(T_LIFT, () => repository.liftBlock(PROFILE_A, PROFILE_B));

    const blocks = await repository.listBlocks(PROFILE_A);

    expect(blocks).toHaveLength(2);
    expect(blocks.filter((block) => block.liftedAt !== null)).toHaveLength(1);
  });

  test('listBlocks returns nothing for a profile that is in no block', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));

    expect(await repository.listBlocks(PROFILE_C)).toHaveLength(0);
  });

  test('getFollowBetween answers for one direction and null for the way round with no row', async () => {
    await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    expect((await repository.getFollowBetween(PROFILE_A, PROFILE_B))?.followerId).toBe(PROFILE_A);
    expect(await repository.getFollowBetween(PROFILE_B, PROFILE_A)).toBeNull();
  });

  test('getFollowBetween returns null for a pair with no row at all rather than throwing', async () => {
    expect(await repository.getFollowBetween(PROFILE_A, PROFILE_C)).toBeNull();
  });
});

describe('the pair itself', () => {
  test('a follow from a profile to itself is refused, and nothing is written', async () => {
    await expect(repository.actOnFollow(PROFILE_A, PROFILE_A, 'request')).rejects.toThrow(/different profiles/i);
    expect(await repository.listFollows(PROFILE_A)).toHaveLength(0);
  });

  /**
   * `sameProfile` trims and lowercases, matching `friendshipPairKey`'s rule.
   * Worth one assertion because these methods are reached from screens whose
   * identity may have come out of a local store rather than out of Postgres
   * — `follow.ts`'s header spells out what a single upper-cased uuid costs.
   */
  test('a differently cased or padded id still addresses the same row', async () => {
    const opened = await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    const found = await repository.getFollowBetween(`  ${PROFILE_A.toUpperCase()} `, PROFILE_B);

    expect(found?.id).toBe(opened.id);
  });
});

describe('the rows actually land in the store', () => {
  /**
   * Every test above reads through the same repository instance that wrote,
   * so an implementation that kept its rows in a closure and never called
   * `replaceAll` would pass all of them. These three read through a SECOND
   * repository over the same `KeyValueStore` — the app's restart, in a line.
   */
  test('a follow written by one repository is read back by another over the same store', async () => {
    await at(T_REQUEST, () => repository.actOnFollow(PROFILE_A, PROFILE_B, 'request'));
    await at(T_ACCEPT, () => repository.actOnFollow(PROFILE_B, PROFILE_A, 'accept'));

    const reopened = createLocalSocialRepository(store);

    const follow = await reopened.getFollowBetween(PROFILE_A, PROFILE_B);
    expect(follow?.status).toBe('accepted');
    expect(follow?.respondedAt).toBe(T_ACCEPT);
  });

  test('a block and its lift survive the same way, as one row', async () => {
    await at(T_BLOCK, () => repository.blockProfile(PROFILE_A, PROFILE_B));
    await at(T_LIFT, () => repository.liftBlock(PROFILE_A, PROFILE_B));

    const reopened = createLocalSocialRepository(store);

    const blocks = await reopened.listBlocks(PROFILE_A);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.blockedAt).toBe(T_BLOCK);
    expect(blocks[0]?.liftedAt).toBe(T_LIFT);
  });

  test('a removed follow is gone from the store and not merely from the returned list', async () => {
    await repository.actOnFollow(PROFILE_A, PROFILE_B, 'request');

    await repository.removeFollow(PROFILE_A, PROFILE_B);

    expect(await createLocalSocialRepository(store).listFollows(PROFILE_A)).toHaveLength(0);
  });
});

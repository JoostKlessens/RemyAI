/**
 * What "Vriend toevoegen" draws (src/components/addFriendLists.ts): the read,
 * the four buckets, each section's one-line state, and the message tone.
 *
 * WHY THESE ASSERTIONS EXIST NOW AND DID NOT BEFORE. Every decision covered
 * here used to live inside `src/app/friends/add.tsx`, and a route module
 * cannot be imported by vitest at all — expo-router drags react-native's
 * package internals through Vite's SSR graph and the import dies with a
 * SyntaxError. So the whole of it was untested, not by choice but by
 * location. PD-024 pushed that file past the 800-line ceiling, the
 * composition was lifted out to get back under it, and this file is what
 * that move bought.
 *
 * ============================================================================
 * THE FOUR THINGS THAT WOULD BE SILENT IF THEY BROKE
 * ============================================================================
 *
 *   1. ⚠ THE DIRECTION OF AN ACCEPTED ROW. `following` is where the reader
 *      is the FOLLOWER; `followers` is where they are the FOLLOWEE. Swap the
 *      two and every reader is told the exact opposite of the truth about
 *      who can see their cooking — in both lists at once, with no error
 *      anywhere and nothing missing from the screen. There is no cheaper way
 *      to catch that than naming both sentences.
 *   2. ⚠ THE BLOCKS REACHING THE PARTITION. `listFollows` is deliberately
 *      unfiltered by blocks, so a read that forgets `listBlocks` lists a
 *      blocked pair — and a row that appears for one party and not the other
 *      is exactly how a blocked person works out what happened.
 *   3. ROWS SURVIVING A FAILED REFRESH. This screen re-reads after every
 *      accept and every decline, so "the error state blanks the list" would
 *      wipe the rows at the exact moment the reader is looking for the
 *      result of their own tap.
 *   4. THE PROFILE READS BEING DEDUPLICATED. After PD-024 a mutual pair
 *      names the same person twice, so a missing `Set` is a doubled network
 *      read on the most ordinary relationship there is.
 */

import { describe, expect, test } from 'vitest';
import { ADD_FRIEND_LOADING, ADD_FRIEND_LOAD_FAILED } from '@/components/addFriendCopy';
import {
  INITIAL_ADD_FRIEND_STATE,
  NO_ADD_FRIEND_LISTS,
  collectFollowPartyIds,
  describeFollowLists,
  describeSectionState,
  readFollowLists,
  toneColor,
} from '@/components/addFriendLists';
import { partitionFollows } from '@/domain/social/follow';
import type { Block, Follow, FollowStatus, Profile, ProfileId } from '@/domain/social/types';
import type { RemySocialRepository } from '@/lib/repository/social/types';
import { getColors } from '@/theme/tokens';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeProfile } from './social/fixtures';

const ME = PROFILE_A;
const SANNE = PROFILE_B;
const PIETER = PROFILE_C;

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-02T00:00:00.000Z';

function follow(id: string, followerId: ProfileId, followeeId: ProfileId, status: FollowStatus): Follow {
  return { id, followerId, followeeId, status, createdAt: T0, respondedAt: status === 'pending' ? null : T1 };
}

function standingBlock(blockerId: ProfileId, blockedId: ProfileId): Block {
  return { id: `block-${blockerId}`, blockerId, blockedId, blockedAt: T1, liftedAt: null };
}

const NAMES: ReadonlyMap<ProfileId, Profile> = new Map([
  [SANNE, makeProfile({ id: SANNE, handle: 'sanne', displayName: 'Sanne' })],
  [PIETER, makeProfile({ id: PIETER, handle: 'pieter', displayName: 'Pieter' })],
]);

/** Both directions accepted — the derived friendship, and the case that names one person twice. */
const MUTUAL_WITH_SANNE: readonly Follow[] = [
  follow('f-out', ME, SANNE, 'accepted'),
  follow('f-in', SANNE, ME, 'accepted'),
];

/**
 * A repository with the three methods this module actually calls, cast the
 * way tests/pendingRating.test.ts already casts one: the interface is large,
 * the surface used here is three methods, and stubbing the rest would be
 * noise that says nothing about the behaviour under test.
 */
function stubRepository(options: {
  readonly follows: readonly Follow[];
  readonly blocks: readonly Block[];
  readonly profiles?: ReadonlyMap<ProfileId, Profile>;
  readonly onGetProfile?: (profileId: ProfileId) => void;
}): RemySocialRepository {
  const profiles = options.profiles ?? NAMES;
  return {
    listFollows: async (): Promise<readonly Follow[]> => options.follows,
    listBlocks: async (): Promise<readonly Block[]> => options.blocks,
    getProfile: async (profileId: ProfileId): Promise<Profile | null> => {
      options.onGetProfile?.(profileId);
      return profiles.get(profileId) ?? null;
    },
  } as unknown as RemySocialRepository;
}

// ---------------------------------------------------------------------------
// Which profiles a screen has to look up
// ---------------------------------------------------------------------------

describe('the profiles named by the four buckets', () => {
  /**
   * The case PD-024 made ordinary rather than defensive: a mutual pair is
   * one person in two buckets, so without the `Set` every fully
   * reciprocated relationship costs two reads of one row.
   */
  test('a mutual pair names one person, once', () => {
    const partition = partitionFollows(MUTUAL_WITH_SANNE, [], ME);

    expect(partition.following).toHaveLength(1);
    expect(partition.followers).toHaveLength(1);
    expect(collectFollowPartyIds(partition, ME)).toEqual([SANNE]);
  });

  test('every bucket contributes its other party', () => {
    const rows: readonly Follow[] = [follow('in', SANNE, ME, 'pending'), follow('out', ME, PIETER, 'pending')];
    const named = [...collectFollowPartyIds(partitionFollows(rows, [], ME), ME)].sort();

    expect(named).toEqual([SANNE, PIETER].sort());
  });

  test('nothing is named when there is nothing to draw', () => {
    expect(collectFollowPartyIds(partitionFollows([], [], ME), ME)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ⚠ Which bucket, and which way round
// ---------------------------------------------------------------------------

describe('the four buckets, dressed', () => {
  test('a request pointing at me is incoming and a request I opened is outgoing', () => {
    const rows: readonly Follow[] = [follow('in', SANNE, ME, 'pending'), follow('out', ME, PIETER, 'pending')];
    const lists = describeFollowLists(partitionFollows(rows, [], ME), ME, NAMES);

    expect(lists.incoming.map((row) => row.profileId)).toEqual([SANNE]);
    expect(lists.outgoing.map((row) => row.profileId)).toEqual([PIETER]);
  });

  /**
   * ⚠ THE ONE THAT MATTERS MOST. An accepted row where I am the follower is
   * "ik volg hen"; where I am the followee it is "zij volgen mij", and that
   * second list is the people who can see what this household cooks. Both
   * the bucket AND the sentence are asserted, because a swap would move the
   * row and rewrite the sentence together and look entirely consistent.
   */
  test('an accepted row lands in the bucket its direction says, and says so', () => {
    const iFollowPieter = follow('mine', ME, PIETER, 'accepted');
    const sanneFollowsMe = follow('theirs', SANNE, ME, 'accepted');
    const lists = describeFollowLists(partitionFollows([iFollowPieter, sanneFollowsMe], [], ME), ME, NAMES);

    expect(lists.following.map((row) => row.profileId)).toEqual([PIETER]);
    expect(lists.following[0]?.accessibilityLabel).toBe('Jij volgt Pieter, @pieter.');
    expect(lists.followers.map((row) => row.profileId)).toEqual([SANNE]);
    expect(lists.followers[0]?.accessibilityLabel).toBe('Sanne, @sanne volgt jou.');
  });

  /**
   * ⚠ AND THE MUTUAL PAIR APPEARS IN BOTH, WHICH IS THE DECISION RATHER
   * THAN AN ARTEFACT. It is two separately revocable grants — one received,
   * one given — and showing only the intersection under one "VRIENDEN"
   * heading would hide every one-way row, including the grants the reader
   * made themselves. See addFriendLists.ts's header for the full argument.
   */
  test('a reciprocated pair is listed once in each direction', () => {
    const lists = describeFollowLists(partitionFollows(MUTUAL_WITH_SANNE, [], ME), ME, NAMES);

    expect(lists.following.map((row) => row.profileId)).toEqual([SANNE]);
    expect(lists.followers.map((row) => row.profileId)).toEqual([SANNE]);
  });

  /**
   * An incoming request you can never answer is worse than one whose name
   * did not load, so an unresolved profile keeps its row and its buttons.
   */
  test('a profile that did not resolve still yields an answerable row', () => {
    const lists = describeFollowLists(partitionFollows([follow('in', SANNE, ME, 'pending')], [], ME), ME, new Map());

    expect(lists.incoming).toHaveLength(1);
    expect(lists.incoming[0]?.profileId).toBe(SANNE);
    expect(lists.incoming[0]?.acceptAccessibilityLabel).toContain('Naam onbekend');
  });

  test('an empty graph draws four empty lists', () => {
    expect(describeFollowLists(partitionFollows([], [], ME), ME, NAMES)).toEqual(NO_ADD_FRIEND_LISTS);
  });
});

// ---------------------------------------------------------------------------
// The read itself
// ---------------------------------------------------------------------------

describe('reading the screen out of a repository', () => {
  test('both lists reach the partition and become rows', async () => {
    const lists = await readFollowLists(stubRepository({ follows: MUTUAL_WITH_SANNE, blocks: [] }), ME);

    expect(lists.following.map((row) => row.displayName)).toEqual(['Sanne']);
    expect(lists.followers.map((row) => row.displayName)).toEqual(['Sanne']);
  });

  /**
   * ⚠ THE LEAK THIS READ EXISTS TO PREVENT. `listFollows` returns its rows
   * regardless of blocks — followGraph.ts is explicit that filtering there
   * would be a second definition of "counts" — so the blocks have to travel
   * with them. A blocked pair belongs in NONE of the four buckets, in either
   * direction, because a row that appears for one party and not the other is
   * how the blocked person works out what happened.
   */
  test('a blocked pair appears in none of the four buckets', async () => {
    const lists = await readFollowLists(
      stubRepository({
        follows: [...MUTUAL_WITH_SANNE, follow('pending-pieter', PIETER, ME, 'pending')],
        blocks: [standingBlock(SANNE, ME)],
      }),
      ME,
    );

    expect(lists.following).toEqual([]);
    expect(lists.followers).toEqual([]);
    // The unblocked person is untouched, which is what makes the assertion
    // above a filter rather than a read that simply failed.
    expect(lists.incoming.map((row) => row.profileId)).toEqual([PIETER]);
  });

  /** The block stands whichever side made it — `isBlockStanding` is direction-insensitive. */
  test('it makes no difference which side blocked', async () => {
    const lists = await readFollowLists(
      stubRepository({ follows: MUTUAL_WITH_SANNE, blocks: [standingBlock(ME, SANNE)] }),
      ME,
    );

    expect(lists.following).toEqual([]);
    expect(lists.followers).toEqual([]);
  });

  test('a person in two buckets is read once', async () => {
    const asked: ProfileId[] = [];
    await readFollowLists(
      stubRepository({ follows: MUTUAL_WITH_SANNE, blocks: [], onGetProfile: (id) => asked.push(id) }),
      ME,
    );

    expect(asked).toEqual([SANNE]);
  });
});

// ---------------------------------------------------------------------------
// What a section draws instead of its rows
// ---------------------------------------------------------------------------

describe('a section draws rows, or one line', () => {
  /**
   * ⚠ ROWS BEAT EVERY OTHER STATE, and this is the rule the whole function
   * exists for. This screen re-reads after every accept and every decline,
   * so blanking a list on a failed refresh would wipe the rows at the exact
   * moment the reader is looking for the result of their own tap.
   */
  test('rows survive a failed refresh, and a slow one', () => {
    for (const status of ['error', 'loading'] as const) {
      expect(describeSectionState({ rowCount: 2, status, message: 'PGRST301', emptyText: 'leeg' })).toEqual({
        kind: 'rows',
      });
    }
  });

  test('an empty section says it is still looking before it says it failed', () => {
    expect(describeSectionState({ rowCount: 0, status: 'loading', message: 'boom', emptyText: 'leeg' })).toEqual({
      kind: 'note',
      text: ADD_FRIEND_LOADING,
      detail: null,
    });
  });

  /**
   * The repository's own message is carried through, because that code is
   * what tells an RLS refusal from a network failure — the one detail worth
   * having on screen when a read fails.
   */
  test('a failed read names the failure and keeps the repository’s code', () => {
    expect(describeSectionState({ rowCount: 0, status: 'error', message: 'PGRST301', emptyText: 'leeg' })).toEqual({
      kind: 'note',
      text: ADD_FRIEND_LOAD_FAILED,
      detail: 'PGRST301',
    });
  });

  test('an empty section that read fine says its own empty line', () => {
    expect(describeSectionState({ rowCount: 0, status: 'ready', message: null, emptyText: 'leeg' })).toEqual({
      kind: 'note',
      text: 'leeg',
      detail: null,
    });
  });
});

// ---------------------------------------------------------------------------
// The one message under the input
// ---------------------------------------------------------------------------

describe('the message tone', () => {
  /**
   * `ok` and `notice` are deliberately close in weight — this product does
   * not celebrate, and a sent request is a fact rather than an achievement —
   * but they are not the SAME token, and only `error` may reach `danger`. A
   * tone collapsing onto `danger` would dress an ordinary "not now",
   * including the block refusal, as a failure.
   */
  test('each tone has its own token and only error is danger', () => {
    const colors = getColors('light');

    expect(toneColor('ok', colors)).toBe(colors.accent);
    expect(toneColor('notice', colors)).toBe(colors.textSecondary);
    expect(toneColor('error', colors)).toBe(colors.danger);
    expect(toneColor('notice', colors)).not.toBe(colors.danger);
  });

  test('it reads the palette it is given rather than one of its own', () => {
    expect(toneColor('ok', getColors('dark'))).toBe(getColors('dark').accent);
  });
});

// ---------------------------------------------------------------------------
// Where the screen starts
// ---------------------------------------------------------------------------

describe('the initial state', () => {
  /**
   * Loading and not ready, so the first frame says "even kijken" rather than
   * announcing four empty lists the read has not answered for yet — the
   * difference between "nobody follows you" and "we have not looked".
   */
  test('starts loading, with nothing claimed about the graph', () => {
    expect(INITIAL_ADD_FRIEND_STATE.status).toBe('loading');
    expect(INITIAL_ADD_FRIEND_STATE.message).toBeNull();
    expect(INITIAL_ADD_FRIEND_STATE.incoming).toEqual([]);
    expect(INITIAL_ADD_FRIEND_STATE.outgoing).toEqual([]);
    expect(INITIAL_ADD_FRIEND_STATE.following).toEqual([]);
    expect(INITIAL_ADD_FRIEND_STATE.followers).toEqual([]);
  });
});

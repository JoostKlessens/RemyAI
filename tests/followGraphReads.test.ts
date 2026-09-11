/**
 * The three client readings of the directed graph, one per surface
 * (src/lib/followGraphReads.ts, PD-024, ONTDEK-PLAN.md O-11b).
 *
 * WHY THIS SUITE EXISTS, and it is tests/sendRecipe.test.ts's lesson
 * repeated on the migration that needed it most. PD-024 turned one question
 * — "who am I connected to" — into three, and each client surface had to
 * pick one. The three that had to pick were `gekooktSource.ts` (the feed),
 * `friendSuggestionSource.ts` (the waiting-requests line) and
 * `useLibrarySendSheet.ts` (the Bibliotheek send sheet), and NOT ONE OF
 * THEM COULD BE IMPORTED BY A TEST: each builds its own
 * `createSupabaseSocialRepository(supabase)`, and `src/lib/supabase.ts`
 * throws at module load without `EXPO_PUBLIC_SUPABASE_URL`, so collection
 * fails before a single assertion runs. The reads therefore moved to a
 * module that takes an injected source, and this file is the reason that
 * move was worth making.
 *
 * WHAT IT ACTUALLY GUARDS IS THE ASYMMETRY. `tests/social/follow.test.ts`
 * already holds the collectors themselves to the transition table, the
 * block rules and the "only accepted counts" invariant, and none of that is
 * restated here. What no test could ask before is the question that
 * actually breaks a product: DID THIS SURFACE TAKE THE RIGHT ONE OF THE
 * THREE? Every describe below therefore fixes one surface to one row of
 * O-11b's table, from both sides — what its reading lets in, and what the
 * readings it did NOT take would have let in instead.
 *
 * The fake is two methods wide, which is exactly what `FollowGraphSource`
 * narrows the repository to. Reaching past it would not compile — this
 * module can no more write a follow than it can read what anybody sent you.
 */

import { describe, expect, test, vi } from 'vitest';
import type { Block, Follow, ProfileId } from '@/domain/social/types';
import {
  countIncomingFollowRequests,
  loadFollowedIds,
  loadMutualFollowIds,
  type FollowGraphSource,
} from '@/lib/followGraphReads';
import { PROFILE_A, PROFILE_B, PROFILE_C } from './social/fixtures';

const ME = PROFILE_A;
const SANNE = PROFILE_B;
const JORIS = PROFILE_C;

const ACCEPTED_AT = '2026-06-01T10:00:00.000Z';
const BLOCKED_AT = '2026-07-01T10:00:00.000Z';
const LIFTED_AT = '2026-08-01T10:00:00.000Z';

/**
 * One DIRECTED row. PD-024's graph holds up to two per pair, which is the
 * whole reason a one-way row is its own test on every surface below.
 */
function makeFollow(overrides: Partial<Follow> = {}): Follow {
  return {
    id: 'follow-1',
    followerId: ME,
    followeeId: SANNE,
    status: 'accepted',
    createdAt: '2026-05-01T10:00:00.000Z',
    respondedAt: ACCEPTED_AT,
    ...overrides,
  };
}

/** `a` follows `b`, accepted. The single row that makes the three readings differ. */
function follows(a: ProfileId, b: ProfileId, overrides: Partial<Follow> = {}): Follow {
  return makeFollow({ id: `${a}->${b}`, followerId: a, followeeId: b, ...overrides });
}

/** An open, unanswered request from `a` to follow `b`. */
function requests(a: ProfileId, b: ProfileId): Follow {
  return follows(a, b, { status: 'pending', respondedAt: null });
}

/** Both directions accepted — what `is_friend_of` means since migration 0021. */
function mutual(a: ProfileId, b: ProfileId): readonly Follow[] {
  return [follows(a, b), follows(b, a)];
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'block-1',
    blockerId: SANNE,
    blockedId: ME,
    blockedAt: BLOCKED_AT,
    liftedAt: null,
    ...overrides,
  };
}

interface GraphOptions {
  readonly follows?: readonly Follow[];
  readonly blocks?: readonly Block[];
  readonly failFollows?: boolean;
  readonly failBlocks?: boolean;
}

function makeSource(options: GraphOptions = {}) {
  return {
    listFollows: vi.fn(async (): Promise<readonly Follow[]> => {
      if (options.failFollows === true) {
        throw new Error('no session');
      }
      return options.follows ?? [];
    }),
    listBlocks: vi.fn(async (): Promise<readonly Block[]> => {
      if (options.failBlocks === true) {
        throw new Error('no session');
      }
      return options.blocks ?? [];
    }),
  } satisfies FollowGraphSource;
}

/** Sets compare badly in an expectation; every assertion below is about membership. */
function ids(set: ReadonlySet<ProfileId>): readonly ProfileId[] {
  return [...set].sort();
}

// ---------------------------------------------------------------------------
// Surface 1 — the Vrienden feed: "ik volg hen"
// ---------------------------------------------------------------------------

/**
 * `gekooktSource.ts`'s narrowing. O-11b: *"Dat ís de feed. Asymmetrie hoort
 * hier of nergens."* This is the tab the follow model was built for, and
 * the one place where taking the mutual reading would have made PD-024 buy
 * a second table for no change in behaviour at all.
 */
describe('loadFollowedIds — the feed reads "ik volg hen"', () => {
  test('⚠ A ONE-WAY FOLLOW I MADE COUNTS, which is the entire point of the migration', async () => {
    const source = makeSource({ follows: [follows(ME, SANNE)] });

    expect(ids(await loadFollowedIds(source, ME))).toEqual([SANNE]);
  });

  test('⚠ AND A ONE-WAY FOLLOW POINTING AT ME DOES NOT — being followed is not seeing', async () => {
    // The half that would be a leak rather than a miss: somebody following
    // me does not put their cooking in my feed, because I never asked to
    // see it. `collectFollowerIds` is the reading that answers that
    // question, and this surface is deliberately not it.
    const source = makeSource({ follows: [follows(SANNE, ME)] });

    expect(ids(await loadFollowedIds(source, ME))).toEqual([]);
  });

  test('a mutual pair is in the feed too — asymmetry widens the set, it does not replace it', async () => {
    const source = makeSource({ follows: [...mutual(ME, SANNE), follows(ME, JORIS)] });

    expect(ids(await loadFollowedIds(source, ME))).toEqual([SANNE, JORIS].sort());
  });

  test('a standing block empties it, whoever made the block', async () => {
    const source = makeSource({
      follows: [follows(ME, SANNE)],
      blocks: [makeBlock({ blockerId: SANNE, blockedId: ME })],
    });

    expect(ids(await loadFollowedIds(source, ME))).toEqual([]);
  });

  test('a LIFTED block still empties it, because the acceptance predates the block', async () => {
    // The mechanism `blocks` keeps its row for: lifting restores the
    // ability to ask, never the answer somebody already gave. A feed that
    // repopulated itself on an unblock would be republishing a consent
    // nobody re-granted.
    const source = makeSource({
      follows: [follows(ME, SANNE)],
      blocks: [makeBlock({ liftedAt: LIFTED_AT })],
    });

    expect(ids(await loadFollowedIds(source, ME))).toEqual([]);
  });

  test('a pending follow is not a feed — an unanswered request grants no sight', async () => {
    const source = makeSource({ follows: [requests(ME, SANNE)] });

    expect(ids(await loadFollowedIds(source, ME))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Surface 2 — the Bibliotheek send sheet: "wederzijds"
// ---------------------------------------------------------------------------

/**
 * `useLibrarySendSheet.ts`'s audience, and the sharpest line PD-024 draws.
 * O-11b: *"Een send is een bericht aan één persoon. Eenrichtingsverkeer
 * maakt er ongevraagde post van, en §8's 'no chat'-muur wordt dan dun."*
 * `recipe_shares_insert` (0009:229) makes the same call server-side through
 * `is_friend_of`, which since migration 0021 means exactly this.
 */
describe('loadMutualFollowIds — the send sheet reads "wederzijds"', () => {
  test('names everyone connected in BOTH directions', async () => {
    const source = makeSource({ follows: mutual(ME, SANNE) });

    expect(ids(await loadMutualFollowIds(source, ME))).toEqual([SANNE]);
  });

  test('⚠ A ONE-WAY FOLLOW IS NOT AN AUDIENCE, in either direction', async () => {
    // The asymmetry this surface refuses, on rows identical to the feed's
    // first two tests. Somebody who merely followed me must not be offered
    // a card in my sheet, and somebody I follow has not agreed to hear
    // from me.
    const iFollowThem = makeSource({ follows: [follows(ME, SANNE)] });
    expect(ids(await loadMutualFollowIds(iFollowThem, ME))).toEqual([]);

    const theyFollowMe = makeSource({ follows: [follows(SANNE, ME)] });
    expect(ids(await loadMutualFollowIds(theyFollowMe, ME))).toEqual([]);
  });

  test('an accepted half plus a pending half is still not an audience', async () => {
    const source = makeSource({ follows: [follows(ME, SANNE), requests(SANNE, ME)] });

    expect(ids(await loadMutualFollowIds(source, ME))).toEqual([]);
  });

  test('a standing block empties it even when both directions are accepted', async () => {
    const source = makeSource({ follows: mutual(ME, SANNE), blocks: [makeBlock()] });

    expect(ids(await loadMutualFollowIds(source, ME))).toEqual([]);
  });

  test('a lifted block revives nothing — both acceptances predate it', async () => {
    const source = makeSource({
      follows: mutual(ME, SANNE),
      blocks: [makeBlock({ liftedAt: LIFTED_AT })],
    });

    expect(ids(await loadMutualFollowIds(source, ME))).toEqual([]);
  });

  test('a follow accepted AFTER the block was lifted counts again', async () => {
    // Lifting restores the ability to ask; this is somebody having asked
    // again and been answered again, which is a fresh consent rather than
    // an old one springing back.
    const source = makeSource({
      follows: mutual(ME, SANNE).map((follow) => ({ ...follow, respondedAt: '2026-09-01T10:00:00.000Z' })),
      blocks: [makeBlock({ liftedAt: LIFTED_AT })],
    });

    expect(ids(await loadMutualFollowIds(source, ME))).toEqual([SANNE]);
  });
});

// ---------------------------------------------------------------------------
// Surface 3 — the waiting-requests line: the pending twin of "zij volgen mij"
// ---------------------------------------------------------------------------

/**
 * `friendSuggestionSource.ts`'s count, behind `PendingRequestsLine`. It is
 * the one surface whose reading is NONE of the three collectors, because
 * all three keep only 'accepted' rows and this one is entirely about the
 * rows they discard. O-11b lists this file among those that *"volgen wat
 * hun bron doet"*, and its source is `follows` in every status.
 */
describe('countIncomingFollowRequests — the line counts the pending twin of "zij volgen mij"', () => {
  test('⚠ A REQUEST POINTING AT ME COUNTS, and one I made myself does not', async () => {
    // The asymmetry on this surface, and the failure it prevents is
    // concrete: a count that folded the two together would send somebody to
    // `/friends/add` to answer a question they themselves asked.
    const incoming = makeSource({ follows: [requests(SANNE, ME)] });
    expect(await countIncomingFollowRequests(incoming, ME)).toBe(1);

    const outgoing = makeSource({ follows: [requests(ME, SANNE)] });
    expect(await countIncomingFollowRequests(outgoing, ME)).toBe(0);
  });

  test('an accepted follow is not a request — it is already answered', async () => {
    const source = makeSource({ follows: [...mutual(ME, SANNE), follows(JORIS, ME)] });

    expect(await countIncomingFollowRequests(source, ME)).toBe(0);
  });

  test('a declined row is not a request either, and is never shown back to whoever declined it', async () => {
    const source = makeSource({ follows: [follows(SANNE, ME, { status: 'declined' })] });

    expect(await countIncomingFollowRequests(source, ME)).toBe(0);
  });

  test('two open requests are two, and a row between other people is none of mine', async () => {
    const source = makeSource({
      follows: [requests(SANNE, ME), requests(JORIS, ME), requests(SANNE, JORIS)],
    });

    expect(await countIncomingFollowRequests(source, ME)).toBe(2);
  });

  /**
   * ⚠ THE RULE THE OLD TWO-COMPARISON FILTER COULD NOT HAVE HAD.
   * `blocked_by` lived on the friendship row, so a filter over friendships
   * saw it for free; a block is now its OWN object and a filter over
   * `follows` alone cannot see one at all. A line at the top of the tab
   * counting a request from somebody you blocked leads to a screen that
   * will not show it.
   */
  test('a standing block takes the request out of the count', async () => {
    const source = makeSource({
      follows: [requests(SANNE, ME)],
      blocks: [makeBlock({ blockerId: ME, blockedId: SANNE })],
    });

    expect(await countIncomingFollowRequests(source, ME)).toBe(0);
  });

  test('a LIFTED block leaves it counted, because lifting restores the ability to ask', async () => {
    // Deliberately the opposite answer from the two accepted readings
    // above, and the difference is the whole design of `blocks`: a lift
    // never restores an ANSWER, and always restores the QUESTION.
    const source = makeSource({
      follows: [requests(SANNE, ME)],
      blocks: [makeBlock({ blockerId: ME, blockedId: SANNE, liftedAt: LIFTED_AT })],
    });

    expect(await countIncomingFollowRequests(source, ME)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// O-11b's table, read as one assertion
// ---------------------------------------------------------------------------

/**
 * The three surfaces on ONE graph, which is the only way to see that they
 * genuinely disagree. Every test above could pass with all three functions
 * wired to the same collector as long as each suite's fixtures differed;
 * these two cannot.
 */
describe('the three readings are three different answers', () => {
  /** I follow Sanne and she has not followed back; Joris and I follow each other. */
  function makeMixedGraph(): FollowGraphSource {
    return makeSource({ follows: [follows(ME, SANNE), ...mutual(ME, JORIS)] });
  }

  test('one graph, three answers: the feed sees two, a send reaches one, nothing is waiting', async () => {
    const graph = makeMixedGraph();

    expect(ids(await loadFollowedIds(graph, ME))).toEqual([SANNE, JORIS].sort());
    expect(ids(await loadMutualFollowIds(graph, ME))).toEqual([JORIS]);
    expect(await countIncomingFollowRequests(graph, ME)).toBe(0);
  });

  test('the send audience is a strict subset of the feed, never the other way round', async () => {
    const graph = makeMixedGraph();
    const followed = await loadFollowedIds(graph, ME);
    const mutuals = await loadMutualFollowIds(graph, ME);

    for (const id of mutuals) {
      expect(followed.has(id)).toBe(true);
    }
    expect(mutuals.size).toBeLessThan(followed.size);
  });
});

// ---------------------------------------------------------------------------
// The pairing this module exists to hold in one place
// ---------------------------------------------------------------------------

/**
 * `listFollows` is deliberately unfiltered by blocks and `listBlocks`
 * deliberately returns LIFTED rows, so the two are only correct together.
 * Pairing them by hand at three call sites is three chances to pass an
 * empty array for the second — a mistake that fails OPEN, silently, in the
 * direction of showing a blocked person's cooking.
 */
describe('every reading takes both halves of the graph, for the reader', () => {
  test('all three ask for follows AND blocks, and ask for this profile', async () => {
    for (const read of [loadFollowedIds, loadMutualFollowIds, countIncomingFollowRequests]) {
      const source = makeSource();

      await read(source, ME);

      expect(source.listFollows).toHaveBeenCalledWith(ME);
      expect(source.listBlocks).toHaveBeenCalledWith(ME);
    }
  });

  /**
   * NOTHING HERE CATCHES, and that is the decision the module header
   * states: the three surfaces answer a failed read differently — the feed
   * lets it reach an error state, the send sheet turns it into a retryable
   * `load-failed`, and the outcome card swallows it. Flattening all three
   * into "no friends" here would be a lie on every one of them, and the
   * send sheet's lie would be the worst: "Nog geen vrienden om naar te
   * sturen." on a read that simply failed.
   */
  test('a failed read is raised, never turned into an empty answer', async () => {
    await expect(loadFollowedIds(makeSource({ failFollows: true }), ME)).rejects.toThrow();
    await expect(loadMutualFollowIds(makeSource({ failBlocks: true }), ME)).rejects.toThrow();
    await expect(countIncomingFollowRequests(makeSource({ failFollows: true }), ME)).rejects.toThrow();
  });
});

/**
 * What "Vriend toevoegen" actually draws: which rows end up in which
 * section, which single line a section shows instead of its rows, and which
 * token the one message under the input is drawn in.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS, AND WHY IT IS NOT MORE LINES ON addFriendCopy.ts
 * ============================================================================
 *
 * `src/app/friends/add.tsx` was 814 lines before PD-024 reached it — already
 * over this codebase's 800-line ceiling, and one of the seven files
 * ONTDEK-PLAN.md §1.5 names. The directed graph could only add to it: one
 * list became two, a second repository read arrived beside the first, and
 * the header had to explain all of it. So something had to leave the route
 * module, and the only question was what.
 *
 * COMPOSITION LEFT; RENDERING STAYED. Everything here is a decision — which
 * bucket a row belongs to, whose name a row carries, whether a section draws
 * rows or a note — and not one line of it is JSX. That matters more here
 * than the file size does, because a route module CANNOT BE IMPORTED BY A
 * TEST AT ALL: expo-router drags react-native's package internals through
 * Vite's SSR graph and the import dies with a SyntaxError before anything
 * runs. Every decision that stays in add.tsx is a decision nothing can
 * assert. `gekooktPresentation.ts` was cut out of the Vrienden tab on
 * exactly this argument, and `lib/liveSession.ts` out of the cook screen
 * before it.
 *
 * IT IS A SIBLING OF addFriendCopy.ts RATHER THAN PART OF IT because that
 * file is at its own ceiling, and because the two have different readers:
 * this is the bucket rule, that is the Dutch. The one-way dependency — this
 * imports that, never the reverse — keeps the seam honest.
 *
 * ============================================================================
 * ⚠ FOUR BUCKETS WHERE THERE WERE THREE, AND THE SCREEN SHOWS ALL FOUR
 * ============================================================================
 *
 * `partitionFriendships` returned incoming, outgoing and accepted.
 * `partitionFollows` returns incomingRequests, outgoingRequests, following
 * and followers, because "accepted" stopped being one fact: after PD-024 a
 * person can be somebody you follow, somebody who follows you, or both, and
 * the three are genuinely different situations.
 *
 * ALL FOUR ARE RENDERED, in three sections: the two request buckets share
 * `VOLGVERZOEKEN` as they always did, and the two accepted buckets get one
 * labelled section each (`JIJ VOLGT`, `VOLGEN JOU`). The alternative that
 * had to be refused is showing only the MUTUAL ones under the old
 * `VRIENDEN` heading — the cheap change, and the wrong one, for three
 * reasons of which the last is the serious one:
 *
 *   1. It would hide the asymmetry PD-024 exists to create. The owner asked
 *      for one-way following on purpose; a screen that only ever shows the
 *      wederzijdse pairs shows a graph in which his feature does not exist.
 *   2. It would make accepting a request LOOK LIKE A FAILED TAP again. The
 *      `VRIENDEN` list was put on this screen for precisely that reason —
 *      "an accept that leaves no trace reads as a failed tap" — and an
 *      accept now creates a ONE-WAY row, so a mutual-only list would
 *      swallow every accept the reader makes until the other person happens
 *      to follow back, which may be never.
 *   3. ⚠ IT WOULD HIDE WHO CAN SEE YOUR COOKING. `followers` is the list of
 *      people this household has granted §5's disclosure to, one accepted
 *      request at a time. DESIGN-SOCIAL.md §5 makes that consent revocable
 *      by design, and a per-person grant the giver cannot SEE is a consent
 *      with no way back. Mutual-only would show the reader a shorter list
 *      than the truth, which is the one direction this product may never
 *      round in.
 *
 * A MUTUAL PAIR APPEARS IN BOTH LISTS, ONCE EACH, AND THAT IS NOT A BUG. It
 * is two grants — one the reader received, one the reader gave — and they
 * are separately revocable, so collapsing them into a single "vriend" row
 * would re-invent exactly the word PD-024 took away. The rejected tidier
 * shape was three lists (mutual, follow-only, follower-only); rejected
 * because a reader would then have to reverse-engineer the membership rule
 * of each before they could read any of them, and because "wie ziet mijn
 * eten" would stop being answerable by reading one list top to bottom.
 *
 * ⚠ NEITHER LIST IS COUNTED AT ANYBODY. `partitionFollows`'s header refuses
 * a follower count in the domain and addFriendCopy.ts refuses it in the
 * words; this module is the third place it would be easy to add one, and it
 * is refused here too. The only number taken out of these lists is
 * `followers.length`, which feeds §5's one-time ask and is never rendered.
 *
 * ============================================================================
 * WHAT IS NOT DECIDED HERE
 * ============================================================================
 *
 * Blocks and declined rows. Both are already gone by the time a
 * `FollowPartition` exists: `partitionFollows` drops a declined row because
 * it is re-requestable and therefore indistinguishable from no row at all,
 * and it drops a blocked pair in BOTH directions because "a row that appears
 * for one party and not the other is how the blocked person works out what
 * happened." Re-filtering here would be a second copy of a privacy rule, and
 * the second copy is the one that drifts.
 *
 * ============================================================================
 * WHY THE READ IS HERE TOO, WHEN EVERYTHING ELSE IN THIS FILE IS PURE
 * ============================================================================
 *
 * `readFollowLists` performs I/O, and it is the one function here that does.
 * It takes its repository AS AN ARGUMENT and never obtains one, which is the
 * whole difference: acquiring a backend needs a live session and belongs to
 * the screen, but the SHAPE of the read — two lists fetched in parallel,
 * partitioned, then one deduplicated round of profile reads over the result
 * — is a sequence with three ways to be wrong, and none of them is visible
 * in a route module that no test can import.
 *
 * The three, stated so the test has something to aim at: the two reads must
 * go out TOGETHER (a waterfall doubles the wait on the one screen whose
 * whole job is a round trip); `listFollows` and `listBlocks` must BOTH reach
 * the partition, because follow.ts deliberately leaves block-filtering to
 * its callers and a caller that forgets it lists a blocked pair; and the
 * profile reads must be deduplicated, because after PD-024 a mutual pair
 * names the same person twice.
 */

import { followRoleOf, type FollowPartition, partitionFollows } from '@/domain/social/follow';
import type { Follow, Profile, ProfileId } from '@/domain/social/types';
import type { RemySocialRepository } from '@/lib/repository/social/types';
import type { ColorTokens } from '@/theme/tokens';
import {
  ADD_FRIEND_LOADING,
  ADD_FRIEND_LOAD_FAILED,
  describeFollowParty,
  describeIncomingRequest,
  describeOutgoingRequest,
  type AcceptedFollowRow,
  type AddFriendTone,
  type IncomingRequestRow,
  type OutgoingRequestRow,
} from './addFriendCopy';

/**
 * The three states a read can be in. `ready` is not "has rows" — an empty
 * ready section says so in words, and that is a different sentence from
 * "still looking".
 */
export type AddFriendListStatus = 'loading' | 'ready' | 'error';

/** The four buckets, dressed. One array per list the screen draws. */
export interface AddFriendLists {
  /** Pending, pointing AT the reader. The only rows on this screen with buttons. */
  readonly incoming: readonly IncomingRequestRow[];
  /** Pending, opened BY the reader. A `wacht` state and nothing else. */
  readonly outgoing: readonly OutgoingRequestRow[];
  /** Accepted, the reader is the follower — "ik volg hen". */
  readonly following: readonly AcceptedFollowRow[];
  /** Accepted, the reader is the followee — "zij volgen mij", and therefore who can see this household's cooking. */
  readonly followers: readonly AcceptedFollowRow[];
}

export const NO_ADD_FRIEND_LISTS: AddFriendLists = { incoming: [], outgoing: [], following: [], followers: [] };

/**
 * The other person on a row the reader is party to, or null when they are
 * not party to it at all.
 *
 * ASKED THROUGH `followRoleOf` RATHER THAN COMPARED HERE, so the id
 * canonicalisation lives in exactly one function — follow.ts's, which
 * lowercases and trims because these screens' identities may have come out
 * of a LOCAL store rather than straight from Postgres. `sendRecipe.ts` had
 * to write its own `otherSideOf` before that canonicalisation existed, and
 * spells out the cost of getting it wrong: "a single upper-cased uuid there
 * does not merely miss a friend — it makes the reader their OWN friend."
 *
 * Null is unreachable from a `FollowPartition`, which only ever holds rows
 * the reader is on. It is answered rather than thrown anyway, because a
 * caller handing over somebody else's rows is bad input and not a crash.
 */
function otherPartyOf(follow: Follow, myProfileId: ProfileId): ProfileId | null {
  const role = followRoleOf(follow, myProfileId);
  if (role === null) {
    return null;
  }
  return role === 'follower' ? follow.followeeId : follow.followerId;
}

function otherPartyIds(follows: readonly Follow[], myProfileId: ProfileId): readonly ProfileId[] {
  return follows.flatMap((follow) => {
    const other = otherPartyOf(follow, myProfileId);
    return other === null ? [] : [other];
  });
}

/**
 * Every profile the four buckets name, deduplicated — the input to the
 * screen's one round of `getProfile` reads.
 *
 * DEDUPLICATED HERE AND NOT AT THE CALL SITE, because after PD-024 a
 * duplicate is the NORMAL case rather than a defensive afterthought: a
 * mutual pair puts the same person in `following` and in `followers`, so
 * every fully reciprocated relationship would otherwise cost two network
 * reads of one row.
 *
 * ORDER IS INPUT ORDER, like everything else on this screen. See
 * `partitionFollows`: "ordering these by anything would mean ordering them
 * by `createdAt`, which is the recency this product keeps off every social
 * surface."
 */
export function collectFollowPartyIds(partition: FollowPartition, myProfileId: ProfileId): readonly ProfileId[] {
  return [
    ...new Set([
      ...otherPartyIds(partition.incomingRequests, myProfileId),
      ...otherPartyIds(partition.outgoingRequests, myProfileId),
      ...otherPartyIds(partition.following, myProfileId),
      ...otherPartyIds(partition.followers, myProfileId),
    ]),
  ];
}

/**
 * The four buckets with names on them.
 *
 * A PROFILE THAT FAILED TO RESOLVE IS ABSENT FROM THE MAP AND ITS ROW STILL
 * RENDERS, through `describeParty`'s fallback. That is the decision this
 * screen has always made, and it matters most on the incoming bucket: an
 * incoming request you can never answer is worse than one whose name did
 * not load.
 *
 * ⚠ THE ROLE PASSED TO `describeFollowParty` IS THE READER'S OWN SIDE, and
 * the two literals below are the only place it is stated. `following` holds
 * rows where the reader is the FOLLOWER and `followers` holds rows where the
 * reader is the FOLLOWEE — that is `partitionFollows`'s definition rather
 * than an inference here — so the sentences come out as "Jij volgt X" and "X
 * volgt jou" respectively. Swapping them would tell every reader the exact
 * opposite of the truth about who can see their cooking, in both lists at
 * once and without a single error anywhere, which is why both directions are
 * pinned by name in tests/addFriendLists.test.ts.
 */
export function describeFollowLists(
  partition: FollowPartition,
  myProfileId: ProfileId,
  profileById: ReadonlyMap<ProfileId, Profile>,
): AddFriendLists {
  const nameOf = (profileId: ProfileId): Profile | null => profileById.get(profileId) ?? null;
  const idsOf = (follows: readonly Follow[]): readonly ProfileId[] => otherPartyIds(follows, myProfileId);

  return {
    incoming: idsOf(partition.incomingRequests).map((id) => describeIncomingRequest(id, nameOf(id))),
    outgoing: idsOf(partition.outgoingRequests).map((id) => describeOutgoingRequest(id, nameOf(id))),
    following: idsOf(partition.following).map((id) => describeFollowParty(id, nameOf(id), 'follower')),
    followers: idsOf(partition.followers).map((id) => describeFollowParty(id, nameOf(id), 'followee')),
  };
}

/**
 * Names for every profile the four buckets mention, in one round of reads.
 *
 * A profile that fails to resolve is simply absent from the map, and
 * `describeFollowLists` renders its row without a name rather than dropping
 * it. `Promise.all` over `getProfile` rather than one batched call because
 * that is the only read the repository seam offers; the deduplication above
 * is what keeps the count honest.
 */
async function readProfiles(
  repository: RemySocialRepository,
  profileIds: readonly ProfileId[],
): Promise<ReadonlyMap<ProfileId, Profile>> {
  const profiles = await Promise.all(profileIds.map((profileId) => repository.getProfile(profileId)));
  return new Map(profiles.flatMap((profile) => (profile === null ? [] : [[profile.id, profile] as const])));
}

/**
 * Everything the screen needs in order to draw, out of a repository it was
 * handed.
 *
 * ⚠ `listFollows` AND `listBlocks` GO OUT TOGETHER AND BOTH REACH THE
 * PARTITION. Together because they are independent and this is the screen
 * whose entire job is one round trip. Both because `listFollows` is
 * deliberately UNFILTERED by blocks — followGraph.ts's own words: "filtering
 * here as well would be a second definition of 'counts', and the two would
 * eventually disagree. Read it with `listBlocks` and hand both to the
 * domain." A caller who reads only the follows gets a blocked pair in a
 * list, which is the one leak `partitionFollows` was written to prevent.
 *
 * THE PROFILE READS COME SECOND AND CANNOT BE PARALLELISED WITH THE FIRST
 * PAIR: which profiles to read is the answer to the partition. That is one
 * genuine waterfall step and it is unavoidable without a join the repository
 * seam does not offer.
 */
export async function readFollowLists(
  repository: RemySocialRepository,
  profileId: ProfileId,
): Promise<AddFriendLists> {
  const [follows, blocks] = await Promise.all([repository.listFollows(profileId), repository.listBlocks(profileId)]);
  const partition = partitionFollows(follows, blocks, profileId);
  const profileById = await readProfiles(repository, collectFollowPartyIds(partition, profileId));
  return describeFollowLists(partition, profileId, profileById);
}

/**
 * Either "draw your rows" or "draw this one line instead".
 *
 * A discriminated union rather than a nullable string, so a section cannot
 * render a note AND its rows, and cannot forget the `detail` carrying the
 * repository's own Postgres code after a failed read — the one thing that
 * tells an RLS refusal from a network failure.
 */
export type SectionContent =
  | { readonly kind: 'rows' }
  | { readonly kind: 'note'; readonly text: string; readonly detail: string | null };

export interface SectionStateInput {
  readonly rowCount: number;
  readonly status: AddFriendListStatus;
  /** The repository's message after a failed read; null otherwise. */
  readonly message: string | null;
  /** What this particular section says when it is genuinely empty — the one thing that differs between the three. */
  readonly emptyText: string;
}

/**
 * Which of the two a section draws.
 *
 * ⚠ ROWS BEAT EVERY OTHER STATE, and that ordering is the whole rule rather
 * than an optimisation. A refresh that fails must leave the rows the reader
 * was already looking at exactly where they were — Vrienden's and
 * Ranglijst's rule — and it bites hardest here, because THIS screen re-reads
 * after every accept and every decline. Checking `status` first would blank
 * a list the reader had just acted on, at the exact moment they are looking
 * for the result of their own tap.
 *
 * LOADING BEFORE ERROR, for the empty case: a retry in flight is not a
 * failure even when the attempt before it was one, and `load` sets `status`
 * back to 'loading' before it re-reads.
 *
 * THE THREE SECTIONS DIFFER ONLY IN `emptyText`. The loading and failure
 * lines are shared on purpose — three ways of saying "still looking" would
 * be three strings to keep in step, and the reader learns nothing from being
 * told WHICH list failed when all three came out of one read.
 */
export function describeSectionState(input: SectionStateInput): SectionContent {
  if (input.rowCount > 0) {
    return { kind: 'rows' };
  }
  if (input.status === 'loading') {
    return { kind: 'note', text: ADD_FRIEND_LOADING, detail: null };
  }
  if (input.status === 'error') {
    return { kind: 'note', text: ADD_FRIEND_LOAD_FAILED, detail: input.message };
  }
  return { kind: 'note', text: input.emptyText, detail: null };
}

/**
 * The screen's whole read state: the four lists, plus how the read that
 * produced them ended.
 *
 * ⚠ THE LISTS SURVIVE AN ERROR, which is why `status` sits BESIDE them
 * rather than wrapping them in a union. A failed refresh must not blank rows
 * the reader was already looking at — see `describeSectionState`, which is
 * where that rule is actually applied — and a
 * `{ status: 'error' } | { status: 'ready'; lists }` shape would make
 * keeping them impossible to express.
 */
export interface AddFriendState extends AddFriendLists {
  readonly status: AddFriendListStatus;
  /** The repository puts the Postgres code in here, and that code is what tells an RLS refusal from a network failure. */
  readonly message: string | null;
}

export const INITIAL_ADD_FRIEND_STATE: AddFriendState = { ...NO_ADD_FRIEND_LISTS, status: 'loading', message: null };

/**
 * Which token the one message under the input is drawn in.
 *
 * `ok` and `notice` are deliberately close in weight: this product does not
 * celebrate, and a sent request is a fact rather than an achievement. All
 * three tokens are guarded as text on the neutral surfaces by
 * tests/contrast.test.ts.
 *
 * ⚠ IT LIVES HERE AGAINST AN EARLIER NOTE THAT SAID IT SHOULD NOT. The
 * `AddFriendTone` type still carries that note's reasoning — a tone rather
 * than a colour, "because `no-color-literals` is an error rule and every
 * token lookup belongs in the screen" — and the first half of that is
 * untouched: nothing here is a colour literal, the palette arrives as
 * `ColorTokens` and one of its own members comes back. What changed is the
 * second half. The screen was over its ceiling, and "in the screen" also
 * means "where no test can reach it": a route module cannot be imported by
 * vitest, so the mapping had no assertion of any kind. It has one now.
 */
export function toneColor(tone: AddFriendTone, colors: ColorTokens): string {
  switch (tone) {
    case 'ok':
      return colors.accent;
    case 'notice':
      return colors.textSecondary;
    case 'error':
      return colors.danger;
    default: {
      const exhaustiveCheck: never = tone;
      throw new Error(`Unhandled AddFriendTone: ${String(exhaustiveCheck)}`);
    }
  }
}

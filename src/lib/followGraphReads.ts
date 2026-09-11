/**
 * The directed graph, fetched — one function per MEANING, so that a client
 * surface can pick its row out of ONTDEK-PLAN.md O-11b's table and a test
 * can hold it to that row (PD-024,
 * supabase/migrations/0021_directed_graph.sql).
 *
 * ============================================================================
 * WHY THIS FILE EXISTS, AND IT IS A MEASUREMENT RATHER THAN A PREFERENCE
 * ============================================================================
 *
 * Three surfaces used to narrow with one line —
 * `collectAcceptedFriendIds(await repository.listFriendships(profileId),
 * profileId)` — and PD-024 splits that one line into three different
 * answers. Which answer a surface gets is the most consequential decision
 * in this migration: get it wrong on the send audience and somebody who
 * merely followed you can put a card in your list; get it wrong on the feed
 * and following stops meaning anything at all.
 *
 * NONE OF THE THREE COULD BE ASSERTED ON WHERE IT STOOD. `gekooktSource.ts`,
 * `friendSuggestionSource.ts` and `useLibrarySendSheet.ts` each build their
 * own `createSupabaseSocialRepository(supabase)`, and `src/lib/supabase.ts`
 * THROWS AT MODULE LOAD when `EXPO_PUBLIC_SUPABASE_URL` is absent. That is
 * not a theory — importing `@/lib/gekooktSource` from a vitest file fails
 * during collection, before a single test runs:
 *
 *     Error: Remy cannot start: missing required environment variable
 *            "EXPO_PUBLIC_SUPABASE_URL".
 *       ❯ src/lib/supabase.ts:31:21
 *
 * So the decision sat behind an import no test can follow. That is the same
 * hole `sendRecipe.ts` and `friendProof.ts` were each carved out to close —
 * "a module that fetches, beside modules that decide" — and it is the hole
 * that let `FRIEND_PROOF_BOOST` sit unwired for three migrations with its
 * own tests green. This file is where the three decisions moved so that
 * they are reachable.
 *
 * ============================================================================
 * ⚠ THIS IS NOT THE `listFriends` CONVENIENCE `followGraph.ts` REFUSES
 * ============================================================================
 *
 * That refusal has to be answered rather than stepped around, because it is
 * about very nearly this shape. `RemyFollowGraphRepository`'s header says:
 * *"a method called `listFriends` would put that decision back inside a
 * fetch, where no test can reach it — the exact hole
 * `collectAcceptedFriendIds` was extracted to close."*
 *
 * Every clause of that still holds, and none of it lands here:
 *
 *   1. THERE IS NO `listFriends`, and there is no parameter that would make
 *      one. Three exported functions, one per meaning, each named after the
 *      collector it runs, so a call site reads as the decision it made. A
 *      boolean argument called `mutual` is the thing being refused, and
 *      nothing below takes one.
 *   2. IT IS NOT A REPOSITORY METHOD. A repository method exists once per
 *      backend and is reached through a client nothing in vitest can build;
 *      these take an injected `FollowGraphSource`, which a fake satisfies
 *      in two functions. "Where no test can reach it" is the property being
 *      repaired here, not the one being introduced.
 *   3. THE MEANING IS STILL `follow.ts`'s. Nothing below decides who
 *      counts. Each function forwards to the collector of the same name and
 *      adds no status, no filter and no ordering of its own.
 *
 * WHAT IS GENUINELY SHARED IS THE PAIRING, AND THAT IS THE PART WORTH
 * HOLDING IN ONE PLACE. Every collector in `follow.ts` takes blocks
 * alongside rows; `listFollows` is deliberately unfiltered by blocks and
 * `listBlocks` deliberately returns LIFTED rows, because a lifted block
 * still invalidates a consent granted before it. Two reads that must always
 * be taken together, paired by hand at three call sites, is three chances
 * to pass an empty array for the second one — and that mistake fails OPEN,
 * silently, in the direction of showing a blocked person's cooking.
 *
 * ============================================================================
 * WHAT THIS FILE DOES NOT DO
 * ============================================================================
 *
 * IT NEVER CHOOSES WHICH READING A SURFACE GETS. It offers three; the
 * surface picks one and states why at the call site, naming its row of
 * O-11b's table. A default here would be the decision going quiet again,
 * one layer further down.
 *
 * IT NEVER CATCHES. A failed graph read means different things on different
 * surfaces and the three answer it differently — the feed lets it reach the
 * screen's error state, the Bibliotheek sheet turns it into a retryable
 * `load-failed`, and the outcome card swallows it because an absent button
 * is honest there. Catching here would flatten all three into "no friends",
 * which is the one answer that is a lie on every one of them.
 *
 * IT NEVER RESOLVES A NAME. These return ids. Turning an id into a `Profile`
 * is `getProfile`, and the rule about what to do with one that will not
 * resolve belongs to the surface that renders it — Bibliotheek drops an
 * unnameable friend rather than offering a blank row beside `Stuur`, and
 * `assembleFriendProof` makes the same refusal about an unnameable cook.
 *
 * ⚠ ONE CALLER IS DELIBERATELY NOT ROUTED THROUGH HERE. `loadSendAudience`
 * (src/lib/sendRecipe.ts) pairs the same two reads itself. It predates this
 * file and it answers a failed read with SILENCE — a decision its own
 * header argues at length, because the surface it decorates is the outcome
 * card, where an absent button is indistinguishable from "you have no
 * friends yet". Whoever owns both files next may collapse the pairing; what
 * must not be collapsed with it is that failure contract.
 */

import { collectFollowedIds, collectMutualFollowIds, partitionFollows } from '@/domain/social/follow';
import type { Block, Follow, ProfileId } from '@/domain/social/types';
import type { RemySocialRepository } from './repository/social/types';

/**
 * The two reads, and no others.
 *
 * A `Pick` for `FriendProofSource`'s and `SendAudienceSource`'s reason: a
 * question about who you are connected to can never grow into a write, nor
 * into a read of what anybody sent you. `listSendsToMe`, `markSendsSeen`
 * and `actOnFollow` are not reachable from here, so those refusals are
 * structural rather than observed. The real repository satisfies it
 * structurally; a test fake is two functions rather than seventeen.
 */
export type FollowGraphSource = Pick<RemySocialRepository, 'listFollows' | 'listBlocks'>;

/** The reader's own rows, as `follow.ts`'s collectors want them: together. */
interface FollowGraph {
  readonly follows: readonly Follow[];
  readonly blocks: readonly Block[];
}

/**
 * Both halves, in parallel, because neither depends on the other and a
 * waterfall here would cost a round trip on the first paint of two tabs.
 *
 * NO NARROWING, NO SORTING, NO DEDUPLICATION. Whatever RLS returned is what
 * the collectors are handed — they trust their input to be the reader's own
 * rows, and `listFollows(profileId)` returns exactly those. A party check
 * here would be a second, weaker copy of the narrowing RLS already performs.
 */
async function readFollowGraph(source: FollowGraphSource, profileId: ProfileId): Promise<FollowGraph> {
  const [follows, blocks] = await Promise.all([source.listFollows(profileId), source.listBlocks(profileId)]);
  return { follows, blocks };
}

/**
 * "Ik volg hen" — whose cooking this profile has been granted sight of.
 *
 * O-11b's table gives this reading to `shared_cooks` (proof) and to the
 * kring's narrowing, with one line of justification that covers both: *"Dat
 * ís de feed. Asymmetrie hoort hier of nergens."* `trendingSource.ts`
 * already reads it for the kring; `gekooktSource.ts` reads it for the feed.
 *
 * ⚠ NOT MUTUAL, AND THE DIFFERENCE IS THE WHOLE FEATURE. If the feed showed
 * only people who follow you back, following would grant nothing friendship
 * did not already grant, and PD-024 would have bought a second table for no
 * change in behaviour. What makes the asymmetry safe is O-11c's consent:
 * the person you follow ACCEPTED, per person, which is a stronger gate than
 * §5's global switch — and §5's switch still sits above it, so an accepted
 * follower of a household that shares nothing still sees nothing.
 */
export async function loadFollowedIds(
  source: FollowGraphSource,
  profileId: ProfileId,
): Promise<ReadonlySet<ProfileId>> {
  const { follows, blocks } = await readFollowGraph(source, profileId);
  return collectFollowedIds(follows, blocks, profileId);
}

/**
 * "Wederzijds" — the derived friendship, and exactly what `is_friend_of`
 * computes in SQL after migration 0021.
 *
 * O-11b's table gives this reading to every send path —
 * `recipe_shares_insert`, `can_read_shared_meal`, and both send audiences:
 * *"Een send is een bericht aan één persoon. Eenrichtingsverkeer maakt er
 * ongevraagde post van, en §8's 'no chat'-muur wordt dan dun."*
 *
 * ⚠ IT IS NOT A PRE-FLIGHT PERMISSION CHECK AND MUST NEVER BE READ AS ONE.
 * `recipe_shares_insert` (0009) enforces the same rule on the write through
 * `is_friend_of`, and a client-side copy of a permission rule is the copy
 * that drifts. This answers "who do I know"; a refusal surfaces as a failed
 * send, on the row that asked for it. The two agreeing is the point — the
 * client offers only what the server would accept, rather than deciding it.
 */
export async function loadMutualFollowIds(
  source: FollowGraphSource,
  profileId: ProfileId,
): Promise<ReadonlySet<ProfileId>> {
  const { follows, blocks } = await readFollowGraph(source, profileId);
  return collectMutualFollowIds(follows, blocks, profileId);
}

/**
 * How many follow requests are waiting for THIS profile to answer — the
 * number behind `PendingRequestsLine`.
 *
 * THE PENDING TWIN OF `collectFollowerIds`, which is the reading it takes:
 * a row pointing AT you, unanswered. `follow.ts` predicted this caller in
 * as many words — *"it exists because the pending-request line needs its
 * pending twin"* — and `partitionFollows` is where that twin actually
 * lives, because a count is one bucket of the same split the screen draws.
 *
 * IT COUNTS INCOMING ONLY, a rule it inherits unchanged from the symmetric
 * graph: an outgoing request is not waiting for YOU, and a count that
 * folded the two together would send somebody to `/friends/add` to answer a
 * question they themselves asked.
 *
 * ⚠ IT IS A COUNT OF POST AND NEVER A COUNT OF PEOPLE. §8's "no trophy
 * shelf" and `partitionFollows`'s own header both refuse a follower tally
 * rendered at anybody, and this function is the nearest thing in the
 * codebase to one. What keeps it legitimate is that every row it counts is
 * a QUESTION the reader can answer and make go away; a number that only
 * goes up would be the thing being refused.
 *
 * `partitionFollows` RATHER THAN A FILTER WRITTEN HERE, so the blocked-pair
 * rule has one implementation. A blocked pair appears in no bucket, in
 * either direction — counting a request from somebody you blocked would put
 * a line at the top of the tab that leads to an answer you already gave.
 */
export async function countIncomingFollowRequests(source: FollowGraphSource, profileId: ProfileId): Promise<number> {
  const { follows, blocks } = await readFollowGraph(source, profileId);
  return partitionFollows(follows, blocks, profileId).incomingRequests.length;
}

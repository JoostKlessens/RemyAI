/**
 * What the Vrienden tab reads for "Misschien ken je", and the one write
 * that block can make.
 *
 * WHY IT IS NOT IN gekooktSource.ts, WHICH THE SAME SCREEN ALSO READS.
 * That module answers one question — what is in the feed — and answers it
 * with a single `loadLiveFriends` whose four reads are deliberately
 * sequenced so that ~~no accepted friends~~ FOLLOWING NOBODY means nothing
 * else is fetched. Suggestions run on the OPPOSITE precondition: they
 * matter most when there is nobody yet, which is exactly the case that read
 * short-circuits. Folding them in would mean either breaking that
 * short-circuit or hanging a second, differently-gated read off a function
 * whose header promises one behaviour.
 *
 * THE TWO READS ARE ALSO ALLOWED TO FAIL SEPARATELY, which is the reason
 * that matters at runtime. A failed suggestion read must not blank a feed
 * that loaded, and a failed feed read must not hide suggestions that would
 * have told a new user what to do next. Two functions, two `try`s in the
 * screen, two independent pieces of state.
 *
 * HOW MANY ROWS ARE ASKED FOR, AND WHY IT IS MORE THAN ARE SHOWN.
 * `SUGGESTION_FETCH_LIMIT` is four times `MAX_VISIBLE_SUGGESTIONS`, so that
 * dismissing or adding the visible three reveals real rows rather than an
 * empty section — and so `selectFriendSuggestions` has something left to
 * pick from after it drops the reasonless ones. 0019 clamps anything above
 * 50 on its own side, so this number cannot be turned into a dump by
 * editing this line.
 */

import { selectFriendSuggestions, type FriendSuggestion } from '@/domain/social/friendSuggestions';
import type { ProfileId } from '@/domain/social/types';
import { countIncomingFollowRequests } from '@/lib/followGraphReads';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';

/** See the header. Four pages of three, capped again by 0019 at 50. */
export const SUGGESTION_FETCH_LIMIT = 12;

/**
 * The suggestions this reader should see, already dropped, de-duplicated
 * and capped by the domain.
 *
 * `hiddenProfileIds` is the screen's optimistic set — everyone it has just
 * sent a request to and not yet re-read. It is applied HERE rather than in
 * the render so that "who is hidden" has one definition with a test behind
 * it (see `selectFriendSuggestions`).
 */
export async function loadFriendSuggestions(
  hiddenProfileIds: ReadonlySet<ProfileId>,
): Promise<readonly FriendSuggestion[]> {
  const rows = await createSupabaseSocialRepository(supabase).listSuggestedFriends(SUGGESTION_FETCH_LIMIT);
  return selectFriendSuggestions(rows, hiddenProfileIds);
}

/**
 * How many requests are waiting for an answer — the number behind the line
 * at the top of the tab.
 *
 * IT COUNTS INCOMING ONLY. An outgoing request is not waiting for YOU, and
 * a count that folded the two together would send somebody to
 * `/friends/add` to answer a question they themselves asked.
 *
 * ~~IT REUSES `collectAcceptedFriendIds`' SOURCE AND NOT ITS RULE.
 * `listFriendships` returns every row this reader is a party to, in every
 * status; the accepted ones are the feed's business and the pending
 * addressee-side ones are this function's. Counting them here rather than
 * exporting a fifth thing from friendship.ts is the smaller seam — the
 * predicate is two comparisons and it has exactly one caller.~~
 *
 * ============================================================================
 * ⚠ WHICH OF THE THREE DIRECTED READINGS THIS TOOK, AND WHY IT IS NONE OF
 *   THEM (PD-024, ONTDEK-PLAN.md O-11b)
 * ============================================================================
 *
 * The struck-out paragraph above is still the best description of what this
 * function did, and it is exactly why the answer is not one of the three
 * collectors. `collectFollowedIds`, `collectFollowerIds` and
 * `collectMutualFollowIds` all keep ONLY 'accepted' rows — deliberately,
 * for `areFriends`' reason: pending is a question nobody answered, and a
 * set built from anything wider would hand a stranger the list that gates
 * sending. This function's whole subject is the rows they throw away.
 *
 * O-11b's table lists this file among the four that *"volgen wat hun bron
 * doet"*, and its source is `follows` in every status — the same source
 * `listFriendships` was, one table over. So the rule is carried across
 * unchanged and only its vocabulary moves: a row whose status is 'pending'
 * and on which I am the ~~addressee~~ FOLLOWEE.
 *
 * THAT IS THE PENDING TWIN OF "ZIJ VOLGEN MIJ", which is the reading this
 * surface gets. `follow.ts` says so from the other side, about
 * `collectFollowerIds`: *"it exists because the pending-request line needs
 * its pending twin"*. Neither of the other two readings could be right
 * here — "ik volg hen" is the feed's outgoing question, and "wederzijds" is
 * the send audience; a request that is already mutual is not a request.
 *
 * `partitionFollows` RATHER THAN A TWO-COMPARISON FILTER WRITTEN HERE, and
 * that is the one thing the migration genuinely changed about this line. A
 * `blocked_by` flag lived on the friendship row, so the old filter could
 * not miss it; a block is now its OWN object, and a filter over `follows`
 * alone cannot see it at all. Counting a request from somebody who blocked
 * you — or whom you blocked — would put a line at the top of the tab
 * leading to a request `/friends/add` refuses to show. The fetch and the
 * bucket both live in `countIncomingFollowRequests` (followGraphReads.ts),
 * where a test can reach them; this file could not be imported by one.
 *
 * ⚠ THE NAME MOVED WITH THE MEANING, and the old one is recorded here
 * because it was not merely dated — it became FALSE. ~~`countIncomingFriend`
 * `Requests`~~ described a symmetric graph, where answering the request made
 * you friends. What waits now is a VOLGVERZOEK: accepting it lets that
 * person see your cooking, and whether you follow back is a separate
 * decision you may never take. O-11b priced this in — *"elk woord 'vriend'
 * in de copy wordt dubbelzinnig"* — and the sentence this number is rendered
 * into moved first (`friendSuggestionCopy.ts` says "volgverzoek", and states
 * at length why). An identifier that still said "friend" beside copy that
 * says "volg" is the drift this repo spends its comments preventing.
 */
export async function countIncomingFollowRequestsForProfile(profileId: ProfileId): Promise<number> {
  return countIncomingFollowRequests(createSupabaseSocialRepository(supabase), profileId);
}

/**
 * Ask one suggested person to be a friend.
 *
 * NO `planFriendRequest` HERE, AND THAT IS THE POINT OF THE DIFFERENCE
 * WITH `/friends/add`. That screen classifies before writing because a
 * person typed a handle and could have typed anything — their own, a
 * friend's, somebody who blocked them — and each of those deserves its own
 * sentence. A suggestion cannot be any of them: 0019 excludes the caller
 * and ~~every profile they already hold a `friendships` row with, in any
 * status~~ — ⚠ migration 0021 rewrote `suggested_friends()` by hand and
 * that clause is now DIRECTED: it excludes every profile this caller has an
 * OUTGOING `follows` row to, in any status, plus anyone either party has
 * blocked, standing or lifted. The change was deliberate and its reason is
 * in 0021: the symmetric rule would have dropped somebody out of my
 * suggestions the moment THEY followed ME, removing exactly the person I am
 * most likely to want to follow back. So the only outcomes left are still
 * "it worked" and "the write failed", and a classification step would still
 * be a round trip spent re-deriving something the row's existence already
 * proved.
 *
 * ⚠ THE WRITE BELOW STILL GOES TO THE FROZEN TABLE, AND THIS CHANGE
 * DELIBERATELY LEFT IT THERE. `actOnFriendship` writes `friendships`, which
 * from 0021 onward is a pre-migration copy nothing reads — so a request
 * made here lands where `suggested_friends()` no longer looks, and where
 * the count above no longer looks either. That is a real gap and it is
 * named rather than quietly half-fixed: the other half of it is
 * `/friends/add.tsx`, which owns the classify-accept-decline flow and is
 * being migrated by another hand this session. Moving only this line would
 * leave two request paths writing two different tables, which is worse than
 * one path being behind. The fix is `actOnFollow`, in the change that moves
 * `/friends/add` with it.
 *
 * (!) THE RACE IS REAL AND IS ANSWERED BY FAILING, NOT BY GUESSING. If the
 * other person sends a request between the read and this tap, the insert
 * hits 0007's unique pair constraint and throws. The screen says the write
 * failed, and the next read no longer offers them — which is honest. What
 * it must never do is swallow that error as success, because then the row
 * disappears and no friendship exists.
 */
export async function requestFriendship(myProfileId: ProfileId, otherProfileId: ProfileId): Promise<void> {
  await createSupabaseSocialRepository(supabase).actOnFriendship(myProfileId, otherProfileId, 'request');
}

/**
 * What the Vrienden tab reads for "Misschien ken je", and the one write
 * that block can make.
 *
 * WHY IT IS NOT IN gekooktSource.ts, WHICH THE SAME SCREEN ALSO READS.
 * That module answers one question — what is in the feed — and answers it
 * with a single `loadLiveFriends` whose four reads are deliberately
 * sequenced so that no accepted friends means nothing else is fetched.
 * Suggestions run on the OPPOSITE precondition: they matter most when
 * there are no friends yet, which is exactly the case that read
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
 * IT REUSES `collectAcceptedFriendIds`' SOURCE AND NOT ITS RULE.
 * `listFriendships` returns every row this reader is a party to, in every
 * status; the accepted ones are the feed's business and the pending
 * addressee-side ones are this function's. Counting them here rather than
 * exporting a fifth thing from friendship.ts is the smaller seam — the
 * predicate is two comparisons and it has exactly one caller.
 */
export async function countIncomingFriendRequests(profileId: ProfileId): Promise<number> {
  const friendships = await createSupabaseSocialRepository(supabase).listFriendships(profileId);
  return friendships.filter(
    (friendship) => friendship.status === 'pending' && friendship.addresseeId === profileId,
  ).length;
}

/**
 * Ask one suggested person to be a friend.
 *
 * NO `planFriendRequest` HERE, AND THAT IS THE POINT OF THE DIFFERENCE
 * WITH `/friends/add`. That screen classifies before writing because a
 * person typed a handle and could have typed anything — their own, a
 * friend's, somebody who blocked them — and each of those deserves its own
 * sentence. A suggestion cannot be any of them: 0019 excludes the caller
 * and every profile they already hold a `friendships` row with, in any
 * status. So the only outcomes left are "it worked" and "the write
 * failed", and a classification step would be a round trip spent
 * re-deriving something the row's existence already proved.
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

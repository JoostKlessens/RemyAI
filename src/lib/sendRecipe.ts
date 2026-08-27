/**
 * The two repository calls behind DESIGN-SOCIAL.md §3.1's FIRST entry
 * point — the `Stuur door` on `OutcomeCard`, the moment after a grade
 * commits.
 *
 * WHY THIS MODULE EXISTS AT ALL, and it is friendProof.ts's lesson
 * repeated one feature later. `OutcomeCard` has carried an `onSendRecipe`
 * prop, a Dutch label, an accessibility label and a styled tertiary button
 * for a whole phase, and NO CALL SITE EVER PASSED THE PROP — so §3.1's
 * first entry point rendered nothing at all while every copy test around
 * it stayed green. Those tests asked "does the button read well?"; none
 * could ask "does anybody hand it a handler?", because both call sites are
 * route modules (src/app/(tabs)/index.tsx and src/app/cook/[mealId].tsx)
 * and a route module cannot be imported in this test environment —
 * expo-router and react-native internals fail to parse under Vite. The
 * wiring therefore lives here, where tests/sendRecipe.test.ts can reach
 * it, exactly as the cook-proof reads live in friendProof.ts.
 *
 * IT IS A SHELL, AND EVERY JUDGEMENT IT MAKES BELONGS TO SOMEBODY ELSE.
 * `friendshipRoleOf` decides who counts as the other side of a row,
 * `normalizeSendNote` decides what a storable note is, `describeSendRow`
 * and `describeSendAnnouncement` decide what is said. Same split
 * importRecipe.ts and friendProof.ts keep: a module that fetches, beside
 * modules that decide. What is new here is only the composition — and the
 * composition is the part that was missing.
 *
 * WHY NOT REUSE `loadSendFriends` IN src/app/(tabs)/recipes.tsx. Because
 * it lives in a route module, which is the whole problem restated: it
 * cannot be imported, cannot be asserted on, and would have to be
 * duplicated to be used from a second screen. Bibliotheek keeps its own
 * copy for now because that file belongs to another hand this session;
 * when one hand owns both, that function is deleted and its screen calls
 * `loadSendAudience`. What must not happen is a THIRD copy appearing on
 * Kiezen and Kookmodus, which is precisely what this module prevents.
 *
 * NO COOK GATE ANYWHERE BELOW, AND NONE MAY BE ADDED (PD-016). The gate
 * was decided, built and then deliberately reversed: proof is the tier you
 * earn by cooking; a send is "ik moest aan jou denken". Nothing here takes
 * a cook event, and the outcome card offering the button in its follow-up
 * phase is a claim about when a dish is freshest in mind, never about
 * entitlement.
 *
 * NO READ RECEIPT AND NO SEND HISTORY (§8). `sendRecipeToFriend` writes
 * and reports; it never reads back. A re-read would answer no question
 * `sendRecipe` has not already answered by returning the row it upserted,
 * and it would be the first step toward a sender-side record of what you
 * sent whom — which §3.5 has not asked for and this product refuses. For
 * the same reason nothing here counts sends, times them, or knows that a
 * send happened before: `describeSendOutcomeAnnouncement` takes an outcome
 * and a name, so there is nothing a second, louder sentence could be built
 * from even by accident.
 */

import {
  SEND_FAILED_ANNOUNCEMENT,
  describeSendAnnouncement,
  type SendFriendIdentity,
  type SendRowStatus,
} from '@/components/sendRecipeSheetCopy';
import { friendshipRoleOf } from '@/domain/social/friendship';
import type { Friendship, Profile, ProfileId } from '@/domain/social/types';
import type { MealId } from '@/domain/types';
import { hasPendingMealMirror, type MirrorOutbox } from './repository/mirror';
import type { RemySocialRepository, SendRecipeInput } from './repository/social/types';

// ---------------------------------------------------------------------------
// The read: who the card may offer to send to
// ---------------------------------------------------------------------------

/**
 * The two reads the outcome card's send affordance is allowed to make, and
 * no others.
 *
 * A `Pick` rather than the whole repository, for `FriendProofSource`'s
 * reason read from the other side. That one is narrowed so a decoration on
 * the decision screen can never grow into a write; this one is narrowed so
 * a question about who your friends are can never grow into a read of what
 * anybody sent you — `listSendsToMe` and `markSendsSeen` are not reachable
 * from here, so the read-receipt refusal is structural rather than
 * observed. The real repository satisfies it structurally; a test fake is
 * two functions rather than seventeen.
 */
export type SendAudienceSource = Pick<RemySocialRepository, 'listFriendships' | 'getProfile'>;

/**
 * The other person named by a row, or null when the row names nobody but
 * the reader.
 *
 * BUILT ON `friendshipRoleOf` RATHER THAN ON A RAW `===`, which is the one
 * place this differs from `collectAcceptedFriendIds` next door. That
 * function documents its raw comparison honestly: its callers feed it rows
 * straight out of Postgres beside an `auth.uid()` rendered by the same
 * rules, so there is no case to normalise. This one is reached from two
 * screens whose identity may equally have come out of a local store, and a
 * single upper-cased uuid there does not merely miss a friend — it makes
 * the reader their OWN friend, offers them their own dishes, and sends
 * them a recipe they already have. `friendshipRoleOf` is what canonicalises
 * the comparison, and it is not re-implemented here: a second lowercasing
 * rule is exactly the drift src/domain/social/friendship.ts exists to
 * prevent.
 *
 * The self-pair check is phrased as "which role does the other id occupy?"
 * rather than as an id comparison for the same reason — asking
 * `friendshipRoleOf` twice keeps the canonicalisation in one function.
 */
function otherSideOf(friendship: Friendship, profileId: ProfileId): ProfileId | null {
  const role = friendshipRoleOf(friendship, profileId);
  if (role === null) {
    return null;
  }
  const other = role === 'requester' ? friendship.addresseeId : friendship.requesterId;
  // A row naming the same person on both sides would otherwise report the
  // reader as their own friend.
  return friendshipRoleOf(friendship, other) === role ? null : other;
}

/**
 * Every mutually accepted friend, named — the read §3.1 gates the button
 * on ("only when ≥1 accepted friend exists").
 *
 * NO PRE-FLIGHT PERMISSION CHECK, HERE OR BELOW IT. `recipe_shares` carries
 * a three-clause insert policy — the sender is you, the recipient is a
 * friend, the meal is your household's — and RLS enforces every one of
 * them on the write. A client-side copy of a permission rule is the copy
 * that drifts. This answers "who do I know", never "who may I write to";
 * a refusal surfaces as a failed send, on the row that asked for it.
 *
 * NO IDENTITY MEANS NO QUERY, not an empty answer computed the long way.
 * A null id is not a signed-out branch — PD-012 means the root layout
 * answers that before either screen renders — it means the session has not
 * resolved yet. Reading without one would ask the database a question with
 * no `auth.uid()` behind it, so the button simply is not offered for that
 * beat.
 *
 * FAILURE IS SILENCE, AND THAT IS A DECISION RATHER THAN A SWALLOWED
 * ERROR — friendProof.ts's argument, in a place where it is if anything
 * more clear-cut. The surface this decorates is the outcome card: somebody
 * has just said they cooked something and is being asked how it was. A
 * failed friendship read is no reason to put an error on that card, and
 * there is nothing to retry into — an absent button is indistinguishable
 * from the ordinary "you have no friends yet" state, which is honest.
 * Propagating would mean the card rendering a failure about a question
 * nobody asked it.
 *
 * A FRIEND WHOSE PROFILE WILL NOT RESOLVE IS DROPPED, NEVER LISTED
 * NAMELESS. A blank name beside a `Stuur` action is a tap nobody should be
 * invited to take, and it is the same refusal `assembleFriendProof` makes
 * about an unnameable cook. Deduplicated first: one friend named by two
 * rows is one lookup.
 *
 * DELIBERATELY UNORDERED. `reduceSendSheet`'s `load-succeeded` runs every
 * list through `orderSendFriends` on the way in, so no screen can render
 * one unsorted; sorting here as well would be a second copy of §4.1's
 * ordering in the file least likely to be updated when the send tally
 * finally lands.
 */
export async function loadSendAudience(
  source: SendAudienceSource,
  profileId: ProfileId | null,
): Promise<readonly SendFriendIdentity[]> {
  if (profileId === null) {
    return [];
  }

  try {
    const friendships = await source.listFriendships(profileId);
    const friendIds = new Set<ProfileId>();
    for (const friendship of friendships) {
      if (friendship.status !== 'accepted') {
        continue;
      }
      const other = otherSideOf(friendship, profileId);
      if (other !== null) {
        friendIds.add(other);
      }
    }
    if (friendIds.size === 0) {
      return [];
    }

    const profiles = await Promise.all([...friendIds].map((friendId) => source.getProfile(friendId)));
    return profiles.flatMap((profile: Profile | null) =>
      profile === null ? [] : [{ profileId: profile.id, displayName: profile.displayName, handle: profile.handle }],
    );
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// The write: one row, one send
// ---------------------------------------------------------------------------

/** The one write this entry point may perform. Narrowed for `SendAudienceSource`'s reason. */
export type SendRecipeSink = Pick<RemySocialRepository, 'sendRecipe'>;

/**
 * The write-through mirror's backlog, consulted before the door opens.
 * The whole `MirrorOutbox` rather than a `Pick` only because
 * `hasPendingMealMirror` asks for it; nothing below enqueues, settles or
 * records anything, and there is no reason it ever should.
 */
export type PendingMealMirror = MirrorOutbox;

/**
 * What a row is about to draw. Two of `SendRowStatus`'s four, because the
 * other two are states the screen owns rather than answers a write can
 * give: `idle` precedes it and `sending` is the screen's own optimism.
 */
export type SendOutcome = Extract<SendRowStatus, 'sent' | 'failed'>;

/**
 * One send, reported rather than thrown.
 *
 * A refusal here is ordinary — no session, no network, an RLS clause the
 * client deliberately does not pre-check — and the row that asked for it
 * is the only place it means anything. Throwing at the screen would make
 * every caller write the same try/catch, and the one that forgot would
 * take the outcome card down over a friend's send.
 *
 * THE NOTE GOES IN RAW: not trimmed, not measured, not cut.
 * `normalizeSendNote` owns all three at the write seam, and it REJECTS an
 * over-long note rather than shortening it — "publishing words the sender
 * did not choose, in their name, on somebody else's screen". Anything
 * measured here would be a second implementation of a rule whose whole
 * point is that there is one.
 *
 * IT NEVER READS BACK. `sendRecipe` upserts on (meal, recipient) and
 * returns the row it wrote, so there is no second question — and a re-read
 * would be the first step toward the sender-side history §3.5 has not
 * asked for. Which also settles the re-send: the amended offer keeps its
 * `sentAt` and the recipient's state is untouched, so a second send is
 * indistinguishable from a first from where this function stands, and
 * nothing downstream can learn otherwise.
 *
 * ============================================================================
 * THE ONE PRE-FLIGHT CHECK, AND WHY IT IS NOT THE PERMISSION CHECK ABOVE
 * ============================================================================
 *
 * A send is the ONLY act in this app that grants somebody outside the
 * household a read of a meal's ingredients: `meal_ingredients_select_sent_to_me`
 * (0009) turns on the instant the `recipe_shares` row exists. Meanwhile the
 * write-through mirror needs four requests to put a meal in Postgres —
 * parent, then ingredients, then steps — and between the local write and
 * the last of them the recipe is present and EMPTY. Sending in that window
 * does not show a friend a smaller recipe; it shows them a wrong one, with
 * this household's name on it.
 *
 * So `hasPendingMealMirror` is consulted first. This is not a second copy
 * of an RLS rule — `loadSendAudience`'s header refuses those, and rightly:
 * a client-side copy of a permission is the copy that drifts. It is a
 * question only the client can answer, because the outbox is the thing
 * that created the incompleteness and is the only thing that knows about
 * it. Durable across restarts, because it is stored.
 *
 * IT FAILS CLOSED. An outbox that cannot be read cannot say the mirror
 * landed, and the two errors are not equally bad: a send that does not
 * happen is a tap the user repeats a moment later, and a send that happens
 * too early is a friend looking at a blank recipe.
 *
 * AND IT REPORTS `failed`, NOT A THIRD STATUS. §4.1 makes the row its own
 * retry, so the same tap works the moment the mirror lands — usually
 * seconds. A new status would mean new copy on a sheet whose vocabulary is
 * swept by tests/sendRecipeSheetCopy.test.ts, for a state that resolves
 * itself.
 */
export async function sendRecipeToFriend(
  sink: SendRecipeSink,
  outbox: PendingMealMirror,
  input: SendRecipeInput,
): Promise<SendOutcome> {
  if (await isMirrorUnfinished(outbox, input.mealId)) {
    return 'failed';
  }
  try {
    await sink.sendRecipe(input);
    return 'sent';
  } catch {
    return 'failed';
  }
}

/**
 * "Has this meal's mirror not landed yet?", with an unreadable outbox
 * counted as "not landed" — see the fail-closed note above.
 *
 * `hasPendingMealMirror` answers honestly about incompleteness it created,
 * and its own header is explicit that `false` does NOT prove a meal ever
 * reached Postgres: a meal that was never enqueued also answers `false`.
 * That holds for anything written since the mirror was wired, which is
 * every meal this app will create from now on.
 */
async function isMirrorUnfinished(outbox: PendingMealMirror, mealId: MealId): Promise<boolean> {
  try {
    return await hasPendingMealMirror(outbox, mealId);
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// What is said out loud
// ---------------------------------------------------------------------------

/**
 * The spoken half of a commit, for a screen reader that cannot see the
 * accent stroke draw.
 *
 * BOTH SENTENCES ARE IMPORTED, NEVER WRITTEN HERE. They already exist on
 * the sheet (sendRecipeSheetCopy.ts), and the vocabulary sweeps in
 * tests/sendRecipeSheetCopy.test.ts hold them to §8's refusals. A second
 * "Verstuurd naar Sanne." phrased slightly differently for the outcome
 * card would be one sentence nobody swept, on the newer of two surfaces.
 *
 * There is no third branch and no room for one: the parameters are an
 * outcome and a name, so a re-send cannot be announced more loudly than a
 * first send even by accident.
 */
export function describeSendOutcomeAnnouncement(outcome: SendOutcome, displayName: string): string {
  return outcome === 'sent' ? describeSendAnnouncement(displayName) : SEND_FAILED_ANNOUNCEMENT;
}

/**
 * Whether a tap on this row may start a write.
 *
 * `failed` is sendable because the row IS its own retry (§4.1), exactly as
 * `reduceSendSheet` accepts `send-started` from both states. Stated once
 * here so a screen cannot disagree with the reducer: a write fired against
 * a transition the reducer would ignore is a request nothing on screen
 * would ever account for.
 */
export function isSendableRowStatus(status: SendRowStatus): boolean {
  return status === 'idle' || status === 'failed';
}

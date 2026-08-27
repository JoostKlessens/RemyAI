/**
 * Copy and the two pure rules behind "Vriend toevoegen" — the handle
 * exchange (src/app/friends/add.tsx), DESIGN-SOCIAL.md §4.4, plus the
 * predicate that gates §5's one-time cook-proof ask.
 *
 * WHY A MODULE OF ITS OWN, the libraryTileActionCopy.ts / cookSharingCopy.ts
 * argument with one extra clause. The usual half: vitest runs in `node` with
 * react-native stubbed (tests/stubs/react-native.ts), so a sentence written
 * inside a `.tsx` is a sentence nothing can assert. The extra half is
 * sharper here — the screen is a ROUTE module, and a route module cannot be
 * imported by a test at all, because expo-router pulls react-native's
 * package internals through Vite's SSR graph and the import dies with a
 * SyntaxError before a single string is read. So for this screen the choice
 * is not "tested here or tested there"; it is "tested here or not at all".
 * `friendProof.ts` exists for exactly the same reason and says so.
 *
 * ---
 *
 * WHY THE ROUTE PATH LIVES IN A COPY MODULE. `ADD_FRIEND_ROUTE` is not
 * copy, and it is here anyway, because TWO surfaces navigate to this screen
 * — the Vrienden tab's header action (§4.2) and the Sturen sheet's empty
 * state (§4.1) — and neither can import the other. A string literal in both
 * would be two places for a rename to go half-done, and the failure mode is
 * silent: expo-router answers an unknown path with a blank screen rather
 * than an error, so the entry point that was missed would look merely
 * broken rather than wrong. One constant, one test pinning it, both callers
 * importing it. The rejected alternative was a `routes.ts` module holding
 * every path in the app; rejected as speculative — no other route in this
 * codebase has two independent callers, so there is nothing yet for such a
 * module to hold but this one line.
 *
 * ---
 *
 * WHAT THIS SCREEN REFUSES TO BE, recorded here because the refusals are
 * absences and an absence is only enforceable if something sweeps the
 * strings (tests/addFriendCopy.test.ts does, over every export AND every
 * rendered outcome):
 *
 *   - NO CONTACT-BOOK UPLOAD. §4.4 and §7 both state it, and §7 states it
 *     as a standing refusal rather than a backlog item: uploading an
 *     address book discloses every person in it, none of whom agreed to
 *     anything. This is not "not built yet".
 *   - NO SEARCH BY NAME. A name search over `profiles` is an enumeration
 *     endpoint for the whole user table, and `profiles_select` grants every
 *     authenticated reader every row — the only thing keeping that from
 *     being a directory is that the client offers no way to ask.
 *   - NO SUGGESTIONS, and no friends-of-friends. `friendships_select`
 *     deliberately lets nobody read a pair they are not party to
 *     (0007_social.sql's "no policy lets C read the A-B row"), so a
 *     suggestion engine would need a definer-rights function written
 *     specifically to defeat that.
 *   - NO RED BADGES. §4.4: "an open request is a fact, not an alarm."
 *
 * WHAT IS DELIBERATELY OUT OF SCOPE, so its absence is not read as an
 * oversight. `removeFriendship` covers withdraw, unfriend and unblock, and
 * §4.4 additionally sketches blocking as "a quiet tertiary behind a
 * confirm". None of the three is here. The screen this module dresses
 * covers exactly the loop that makes a friendship exist — look someone up,
 * ask, answer an ask — because that loop is the one thing the app has no
 * way to do at all today. An unfriend control has a working alternative
 * (do nothing) in a way that "acquire a friend" does not. When they land,
 * they land as their own labels beside these, and `describeAddFriendOutcome`
 * gains no new members: removal is not an outcome of a request.
 *
 * ---
 *
 * THE TRANSITION TABLE IS ASKED, NEVER RESTATED. `planFriendRequest` calls
 * `applyFriendshipAction` and translates its answer into Dutch. It exists
 * because the repository's `actOnFriendship` REJECTS an illegal move rather
 * than silently doing nothing, and an `Error` from a rejected write is not
 * a sentence anybody can act on — "je verzoek staat al open" and "die
 * persoon heeft JOU al gevraagd" are the same `already_pending` rejection
 * and want completely different screens. So this module classifies first
 * and writes second. What it must never do is decide legality itself:
 * src/domain/social/friendship.ts's header is explicit that a second copy
 * of that table is the thing the domain module exists to prevent, and the
 * test proves the two agree on every state and both roles.
 */

import { applyFriendshipAction, resolveActorRole } from '@/domain/social/friendship';
import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH, normalizeHandle } from '@/domain/social/handle';
import type { Friendship, FriendshipId, Profile, ProfileId } from '@/domain/social/types';

// ---------------------------------------------------------------------------
// Where the screen lives, and how the two entry points name it
// ---------------------------------------------------------------------------

/** See the header: one constant, because two independent surfaces push it. */
export const ADD_FRIEND_ROUTE = '/friends/add';

/**
 * §4.1 and §4.2 use the same three words for the same door, so it is one
 * string. §4.2's header action draws a `+` before it; that glyph is chrome
 * the tab owns, not part of the name, and folding it in here would put a
 * plus sign inside the Sturen sheet's button too.
 */
export const ADD_FRIEND_ENTRY_LABEL = 'Vriend toevoegen';

export const ADD_FRIEND_ENTRY_ACCESSIBILITY_LABEL = 'Vriend toevoegen met een gebruikersnaam';

// ---------------------------------------------------------------------------
// The screen's own chrome
// ---------------------------------------------------------------------------

/** §4.4's `title2`. The screen is titled for the subject; the act is the primary button. */
export const ADD_FRIEND_TITLE = 'Vrienden';

export const ADD_FRIEND_BACK_LABEL = 'Terug';

/**
 * States the mechanism before offering it, so nobody hunts for a search
 * field that does not exist. The second sentence is load-bearing: it says
 * the limit is the design rather than a missing feature, which is what
 * §4.4's "deliberately small" means on screen.
 */
export const ADD_FRIEND_INTRO =
  'Je voegt iemand toe met de gebruikersnaam die je van elkaar kent. Meer manieren zijn er niet.';

// ---------------------------------------------------------------------------
// Your own handle — §4.4 puts it first, and large
// ---------------------------------------------------------------------------

export const OWN_HANDLE_EYEBROW = 'JOUW NAAM';

/** §4.4 verbatim. */
export const OWN_HANDLE_EXPLAINER = 'Zo vinden vrienden jou.';

/**
 * The session resolves a beat after mount, and a handle rendered as a bare
 * '@' would read as a broken account rather than a pending read.
 */
export const OWN_HANDLE_UNAVAILABLE = 'Je eigen gebruikersnaam is nog niet opgehaald.';

// ---------------------------------------------------------------------------
// The one input
// ---------------------------------------------------------------------------

/** §4.4 verbatim, including the '@' — it teaches the shape of the thing being asked for. */
export const HANDLE_INPUT_PLACEHOLDER = '@handle van een vriend';

export const HANDLE_INPUT_ACCESSIBILITY_LABEL = 'Gebruikersnaam van een vriend';

/**
 * The same rule claim-handle.tsx states, in the same words, because it IS
 * the same rule — `parseHandle` mirrors 0007_social.sql's CHECK and both
 * screens are held to it. Built from the two constants rather than written
 * out, so the bounds are stated exactly once on this side.
 */
export const HANDLE_INPUT_ACCESSIBILITY_HINT = `Kleine letters, cijfers en liggend streepje, ${HANDLE_MIN_LENGTH} tot ${HANDLE_MAX_LENGTH} tekens.`;

/**
 * §4.4 verbatim: the primary under the input.
 *
 * There is deliberately no in-flight LABEL beside it, unlike the Sturen
 * sheet's `Versturen…`. That sheet swaps a row's text because the row is
 * the control and there is nowhere else for the state to live; here the
 * control is a `Button`, whose `loading` prop already replaces the label
 * with a spinner and sets `accessibilityState.busy`. A second, unused
 * constant would be a string nothing renders and the next reader would
 * have to prove that about.
 */
export const SEND_REQUEST_LABEL = 'Verstuur verzoek';

/**
 * A handle drawn the way people write one, from whatever was typed.
 * Normalized first, so a message names the spelling that will actually be
 * stored rather than the one that was typed at it.
 */
export function formatHandle(rawHandle: string): string {
  return `@${normalizeHandle(rawHandle)}`;
}

// ---------------------------------------------------------------------------
// The lists
// ---------------------------------------------------------------------------

export const REQUESTS_SECTION_LABEL = 'VERZOEKEN';

/** A fact, in the register §4.4 asks for: no badge, no zero, no hedge implying more is coming. */
export const REQUESTS_EMPTY = 'Er staan geen verzoeken open.';

/** §4.4 verbatim: secondary. */
export const ACCEPT_REQUEST_LABEL = 'Accepteren';

/** §4.4 verbatim: tertiary. Weigeren is an ordinary answer and is not dressed as the loud one. */
export const DECLINE_REQUEST_LABEL = 'Weigeren';

/**
 * §4.4: an outgoing request renders "as a mono `wacht` state". A state word
 * and not a button — there is no withdraw control here (see the header on
 * scope), and a word that looked tappable would be worse than one that does
 * not.
 */
export const OUTGOING_REQUEST_STATUS = 'wacht';

export const FRIENDS_SECTION_LABEL = 'VRIENDEN';

export const FRIENDS_EMPTY = 'Je hebt nog geen vrienden toegevoegd.';

export const ADD_FRIEND_LOADING = 'Even kijken...';

/** Names what failed rather than "er ging iets mis", matching Vrienden's and Ranglijst's error lines. */
export const ADD_FRIEND_LOAD_FAILED = 'Je vrienden en verzoeken konden niet geladen worden.';

/**
 * The one failure §5's ask can produce that the person must hear about.
 *
 * `setHouseholdCookSharing` runs before `markHouseholdCookSharingAsked` so
 * that a failed enable leaves the question unanswered rather than
 * recorded-and-lost — but the sheet is already down by then, and it is not
 * coming back (§5 asks once). Somebody who has just consented and whose
 * consent did not land needs to be told, and told where the switch is,
 * because the alternative is a household that believes it is sharing and
 * is not. It names Instellingen rather than offering a retry: the settings
 * section is where the full disclosure lives, and re-consenting under four
 * paragraphs is better than re-consenting under an error line.
 */
export const COOK_SHARING_ASK_FAILED = 'Delen aanzetten lukte niet. Je kunt het in Instellingen alsnog doen.';

/**
 * Shown in place of a name when `getProfile` came back null.
 *
 * That is a deleted account racing the read rather than a permission —
 * `profiles_select` grants every authenticated reader every row — so it is
 * rare, and it is not an error state for the screen. The row keeps its
 * buttons: an incoming request you can never answer is worse than one whose
 * name did not load.
 */
export const PARTY_NAME_UNAVAILABLE = 'Naam onbekend';

// ---------------------------------------------------------------------------
// What a request attempt can end in
// ---------------------------------------------------------------------------

/**
 * Every way "Verstuur verzoek" can end, as a closed vocabulary rather than
 * a message string — the same split `FriendshipRejection` and
 * `NoCandidateReason` use, and for the same reason: the rule belongs to the
 * domain, the Dutch belongs here.
 */
export type AddFriendOutcome =
  /** `parseHandle` refused what was typed; 0007_social.sql's CHECK would have too. */
  | 'invalid-handle'
  | 'not-found'
  /** The handle resolved to the reader. Not an error worth a red line. */
  | 'self'
  | 'sent'
  /** A pending row this reader opened. */
  | 'awaiting-them'
  /** A pending row addressed to this reader — there is an Accepteren waiting further down. */
  | 'awaiting-you'
  | 'already-friends'
  | 'blocked'
  /** The read or the write threw. Nothing was written. */
  | 'failed';

/**
 * How loudly a message is drawn. A tone rather than a colour, because
 * `no-color-literals` is an error rule and every token lookup belongs in
 * the screen — and because "this is a refusal, not a failure" is a
 * judgement about the sentence, which is what this module owns.
 */
export type AddFriendTone = 'ok' | 'notice' | 'error';

export interface AddFriendMessage {
  readonly tone: AddFriendTone;
  readonly text: string;
}

/**
 * The sentence for each outcome.
 *
 * TWO THINGS ARE NEVER SAID HERE, and both are privacy rather than
 * politeness:
 *
 *   1. A BLOCK NAMES NO REASON AND NO PARTY. Telling a blocked person they
 *      were blocked hands them a fact the blocker never agreed to share,
 *      and 0007_social.sql goes to some length to make the row itself
 *      unreadable by third parties. So the refusal reads exactly like an
 *      ordinary "not now" — indistinguishable on purpose, in both
 *      directions, because a message that differed for the blocker would
 *      let the blocked person learn the difference by comparing notes.
 *   2. NOTHING IS DATED. Neither an open request nor a refusal carries a
 *      timestamp, here or on the rows below. A request that visibly ages is
 *      a reason to come back and check it.
 *
 * `not-found` deliberately blames nobody: a handle that resolves to nothing
 * is far more often a mis-remembered name than a typo, and "controleer je
 * invoer" would send the reader to fix the one thing they may well have
 * typed correctly.
 */
export function describeAddFriendOutcome(outcome: AddFriendOutcome, rawHandle: string): AddFriendMessage {
  const handleLabel = formatHandle(rawHandle);

  switch (outcome) {
    case 'invalid-handle':
      return {
        tone: 'notice',
        text: `Gebruik ${HANDLE_MIN_LENGTH} tot ${HANDLE_MAX_LENGTH} tekens: kleine letters, cijfers en _.`,
      };
    case 'not-found':
      return { tone: 'notice', text: `Niemand gevonden met ${handleLabel}. Vraag de gebruikersnaam nog eens na.` };
    case 'self':
      return { tone: 'notice', text: 'Dat ben je zelf.' };
    case 'sent':
      return { tone: 'ok', text: `Verzoek verstuurd naar ${handleLabel}.` };
    case 'awaiting-them':
      return { tone: 'notice', text: `Je verzoek aan ${handleLabel} staat al open.` };
    case 'awaiting-you':
      return {
        tone: 'notice',
        text: `${handleLabel} heeft jou al een verzoek gestuurd. Je kunt het hieronder accepteren.`,
      };
    case 'already-friends':
      return { tone: 'notice', text: `Je bent al bevriend met ${handleLabel}.` };
    case 'blocked':
      // See this function's header: quiet, and identical in both directions.
      return { tone: 'notice', text: `Je kunt ${handleLabel} nu geen verzoek sturen.` };
    case 'failed':
      // States the rollback, not just the failure — the same shape as
      // SEND_ROW_FAILED_NOTE and COOK_PROOF_WRITE_FAILED_NOTE.
      return { tone: 'error', text: 'Er ging iets mis. Er is niets verstuurd. Probeer het nog eens.' };
    default: {
      const exhaustiveCheck: never = outcome;
      throw new Error(`Unhandled AddFriendOutcome: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// May this request be sent?
// ---------------------------------------------------------------------------

/**
 * Either "write it" or "do not, and here is what to say instead".
 *
 * A discriminated union rather than a bare outcome, so the screen's call
 * site cannot perform a write for a member that describes a refusal.
 */
export type FriendRequestPlan =
  | { readonly action: 'request' }
  | { readonly action: 'none'; readonly outcome: AddFriendOutcome };

const SEND_IT: FriendRequestPlan = { action: 'request' };

/**
 * Whether a request may be opened against an existing row, and what to say
 * when it may not.
 *
 * ASKS `applyFriendshipAction`; DOES NOT RESTATE IT. See this module's
 * header, and friendship.ts's, on why that matters more than the four lines
 * it saves.
 *
 * THE ONE THING THIS FUNCTION ADDS IS DIRECTION. `already_pending` is a
 * single rejection covering two situations that could not be more different
 * to the person reading: their own request is simply open, or somebody has
 * asked THEM and there is an `Accepteren` waiting a few rows down. The
 * rejection has no room for that distinction and should not — it is a rule
 * about the row, not about the screen — so the role, which the domain
 * already computes, is what splits it here.
 *
 * `not_addressee` and `no_pending_request` cannot arise from a 'request'
 * action (read fromNoRow / fromPending / fromAccepted / fromDeclined: every
 * one answers 'request' with pending, already_pending or already_friends).
 * They are mapped to 'failed' rather than left to fall through, because a
 * total function with one unreachable-but-honest arm is better than a
 * switch that throws on a state a future edit to the domain could make
 * reachable.
 */
export function planFriendRequest(existing: Friendship | null, myProfileId: ProfileId): FriendRequestPlan {
  const actor = resolveActorRole(existing, myProfileId);
  const result = applyFriendshipAction({
    from: existing === null ? null : existing.status,
    action: 'request',
    actor,
  });

  if (result.ok) {
    return SEND_IT;
  }

  switch (result.reason) {
    case 'already_friends':
      return { action: 'none', outcome: 'already-friends' };
    case 'blocked':
      return { action: 'none', outcome: 'blocked' };
    case 'already_pending':
      return { action: 'none', outcome: actor === 'addressee' ? 'awaiting-you' : 'awaiting-them' };
    case 'not_addressee':
    case 'no_pending_request':
      return { action: 'none', outcome: 'failed' };
    default: {
      const exhaustiveCheck: never = result.reason;
      throw new Error(`Unhandled FriendshipRejection: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// The three lists §4.4 renders
// ---------------------------------------------------------------------------

/** A row before it has a name: the pair it came from, and the other person in it. */
export interface FriendshipPair {
  readonly friendshipId: FriendshipId;
  readonly profileId: ProfileId;
}

export interface AddFriendLists {
  /** Pending, addressed to the reader. The only rows on this screen with buttons. */
  readonly incoming: readonly FriendshipPair[];
  /** Pending, opened by the reader. A `wacht` state and nothing else. */
  readonly outgoing: readonly FriendshipPair[];
  readonly accepted: readonly FriendshipPair[];
}

/**
 * Splits `listFriendships`'s output into what §4.4 draws.
 *
 * DECLINED AND BLOCKED ROWS GO NOWHERE, and that is two separate decisions
 * that happen to have the same effect. A declined pair is re-requestable
 * from either side (friendship.ts's decision 2), so it is indistinguishable
 * from no row at all and listing it would show a "no" back to the person
 * who gave it, forever. A blocked pair must not be listed anywhere, because
 * a row that appears for one party and not the other is how the blocked
 * person works out what happened.
 *
 * INPUT ORDER IS PRESERVED, deliberately. Ordering these by anything would
 * mean ordering them by `createdAt`, which is the recency this product
 * keeps off every social surface. Two open requests are two facts, and
 * neither is more urgent than the other.
 *
 * THE SELF-GUARD IS NOT DEFENSIVE PADDING, for the reason
 * `collectAcceptedFriendIds` gives at length: 0007_social.sql's CHECK
 * refuses a self-pair, but if one ever existed the reader would appear in
 * their own friend list and be offered to themselves.
 *
 * IT TRUSTS ITS INPUT TO BE THE READER'S OWN ROWS. `listFriendships(me)`
 * returns exactly those and RLS narrows the read to them anyway; a row the
 * reader is not party to is skipped rather than mis-filed, which is the
 * honest handling of input that should not exist.
 */
export function partitionFriendships(friendships: readonly Friendship[], myProfileId: ProfileId): AddFriendLists {
  const incoming: FriendshipPair[] = [];
  const outgoing: FriendshipPair[] = [];
  const accepted: FriendshipPair[] = [];

  for (const friendship of friendships) {
    const isRequester = friendship.requesterId === myProfileId;
    const isAddressee = friendship.addresseeId === myProfileId;
    // Both true is a self-pair; both false is somebody else's row.
    if (isRequester === isAddressee) {
      continue;
    }

    const pair: FriendshipPair = {
      friendshipId: friendship.id,
      profileId: isRequester ? friendship.addresseeId : friendship.requesterId,
    };

    if (friendship.status === 'accepted') {
      accepted.push(pair);
    } else if (friendship.status === 'pending') {
      (isAddressee ? incoming : outgoing).push(pair);
    }
  }

  return { incoming, outgoing, accepted };
}

// ---------------------------------------------------------------------------
// One row, with a name on it
// ---------------------------------------------------------------------------

export interface FriendPartyModel {
  readonly profileId: ProfileId;
  readonly displayName: string;
  /** `@sanne`, or empty when the profile could not be read — see PARTY_NAME_UNAVAILABLE. */
  readonly handleLabel: string;
}

/**
 * A profile as a row names it, or the honest fallback when the read came
 * back null. Takes the id separately because that is the one fact a null
 * profile cannot supply, and every row still needs a key and a write target.
 */
export function describeParty(profileId: ProfileId, profile: Profile | null): FriendPartyModel {
  if (profile === null) {
    return { profileId, displayName: PARTY_NAME_UNAVAILABLE, handleLabel: '' };
  }
  return { profileId, displayName: profile.displayName, handleLabel: `@${profile.handle}` };
}

/** "Sanne, @sanne", or just the name when there is no handle to add. */
function speakParty(party: FriendPartyModel): string {
  return party.handleLabel.length === 0 ? party.displayName : `${party.displayName}, ${party.handleLabel}`;
}

export interface IncomingRequestRow extends FriendPartyModel {
  readonly accessibilityLabel: string;
  /**
   * The two answers get their OWN labels rather than sharing the row's, for
   * LibraryTileActionSheet's reason: a screen reader that folds a row and
   * its buttons into one label leaves the listener unable to tell which
   * control they are on — and here the two controls are "yes" and "no" to
   * the same person.
   */
  readonly acceptAccessibilityLabel: string;
  readonly declineAccessibilityLabel: string;
}

export function describeIncomingRequest(profileId: ProfileId, profile: Profile | null): IncomingRequestRow {
  const party = describeParty(profileId, profile);
  const who = speakParty(party);

  return {
    ...party,
    accessibilityLabel: `Verzoek van ${who}.`,
    acceptAccessibilityLabel: `${ACCEPT_REQUEST_LABEL}: ${who}`,
    declineAccessibilityLabel: `${DECLINE_REQUEST_LABEL}: ${who}`,
  };
}

export interface OutgoingRequestRow extends FriendPartyModel {
  /** The mono word §4.4 asks for. Rendered, not spoken — the label below says it in full. */
  readonly statusLabel: string;
  readonly accessibilityLabel: string;
}

export function describeOutgoingRequest(profileId: ProfileId, profile: Profile | null): OutgoingRequestRow {
  const party = describeParty(profileId, profile);

  return {
    ...party,
    statusLabel: OUTGOING_REQUEST_STATUS,
    // Spoken as a state, with no verb a listener could mistake for a
    // control: there is nothing to tap on this row.
    accessibilityLabel: `Verzoek aan ${speakParty(party)}: ${OUTGOING_REQUEST_STATUS} op antwoord.`,
  };
}

export interface AcceptedFriendRow extends FriendPartyModel {
  readonly accessibilityLabel: string;
}

/**
 * Just the person. No count of what they sent, no note of when the
 * friendship started, and no indication of whether they share their
 * cooking — the last of those would leak another household's §5 answer to a
 * surface that has no business holding it.
 */
export function describeAcceptedFriend(profileId: ProfileId, profile: Profile | null): AcceptedFriendRow {
  const party = describeParty(profileId, profile);

  return { ...party, accessibilityLabel: speakParty(party) };
}

// ---------------------------------------------------------------------------
// §5's one-time ask
// ---------------------------------------------------------------------------

export interface CookSharingAskInput {
  /**
   * Accepted friendships AFTER the accept that just landed, read back
   * rather than counted forward — see `shouldAskCookSharing`.
   */
  readonly acceptedFriendCount: number;
  /** `getHouseholdCookSharingAsked`. Durable household state, never a render-time guess. */
  readonly alreadyAsked: boolean;
}

/**
 * Whether accepting a request should raise `CookSharingAskSheet`.
 *
 * §5: the cook-proof opt-in is "offered once, contextually, when the
 * household's first friendship is accepted... Declining there is final
 * until the person goes to settings themselves — the question is asked
 * once, not campaigned."
 *
 * TWO GUARDS, AND THEY ARE INDEPENDENT ON PURPOSE. `alreadyAsked` is the
 * durable one and the one that survives an app restart; it is what
 * `markHouseholdCookSharingAsked` writes, and that method has no un-ask
 * counterpart precisely so this can never be reopened. The count is the one
 * that holds INSIDE a single session, in the window where the mark write is
 * still in flight or has failed: the second accept is not a first
 * friendship, so it cannot re-raise the sheet even if the flag never
 * landed. Either guard alone would leave a hole; together the question
 * cannot be put twice.
 *
 * IT IS `=== 1`, NOT `<= 1`. Zero means the accept did not actually take —
 * a race, a rejected write — and asking a household to disclose their
 * cooking on the strength of a friendship that does not exist is exactly
 * the consent-by-accident PD-005 exists to prevent.
 *
 * THE COUNT IS READ BACK, NOT INCREMENTED. The screen re-reads
 * `listFriendships` after the accept (it has to, to redraw the rows) and
 * counts the accepted ones from that. A count carried forward from the
 * snapshot the screen was holding would be one stale read away from calling
 * somebody's fourth friendship their first.
 */
export function shouldAskCookSharing(input: CookSharingAskInput): boolean {
  return input.acceptedFriendCount === 1 && !input.alreadyAsked;
}

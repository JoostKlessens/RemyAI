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
 * ⚠ THIS MODULE GAINED A SIBLING ON 11 SEPTEMBER 2026:
 * `addFriendLists.ts`, which holds the COMPOSITION (which rows there are,
 * and which note a section draws) while this file holds the WORDS (what one
 * row says, and whether a request may be opened at all). The seam had to be
 * cut because the screen was already over the 800-line ceiling and the
 * directed graph only added to it; it was cut HERE rather than anywhere
 * else because the two halves have genuinely different readers — somebody
 * changing a sentence never needs the bucket rule, and somebody changing
 * the bucket rule never needs the Dutch.
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
 * ============================================================================
 * ⚠ THE GRAPH BECAME DIRECTED, AND THE WORDS WENT FALSE WITH IT — PD-024
 * ============================================================================
 *
 * Until migration 0021 every sentence here described a SYMMETRIC graph: one
 * `friendships` row per unordered pair, one answer, and accepting it made
 * two people friends. PD-024 replaced that with `follows` — one row per
 * ORDERED pair, with an approval step — at the owner's request: *"Ik wil dat
 * je een persoon kan volgen en een melding krijgt als iemand dat wil, dan
 * kan je het accepteren en als je wil terugvolgen."*
 *
 * WHAT THAT DOES TO THE COPY, and it is not a rename. Accepting a request no
 * longer makes anybody friends. It grants ONE person sight of your cooking,
 * and whether you follow them back is a separate decision you may never
 * take. A sentence that still said "vriendschapsverzoek" would promise a
 * mutual relationship in exchange for a one-way grant — and that is the
 * single most consequential thing this module could get wrong, because the
 * reader is being asked for a consent and has to know what they are
 * consenting to. `formatPendingRequests` in friendSuggestionCopy.ts moved to
 * "volgverzoek" on 10 September for that reason; every word below matches
 * it, on purpose, because two surfaces naming one act differently is how a
 * reader concludes they are two acts.
 *
 * WHICH WORDS CHANGED, AND WHICH DELIBERATELY DID NOT. The rule applied
 * throughout: a string that names the ACT changes, a string that names the
 * DESTINATION does not.
 *
 *   - CHANGED, because they name the act: ~~`Verstuur verzoek`~~ →
 *     `Verstuur volgverzoek`; ~~`VERZOEKEN`~~ → `VOLGVERZOEKEN`; every
 *     sentence `describeAddFriendOutcome` produces; both request rows'
 *     accessibility labels.
 *   - UNCHANGED, because they name the destination: `ADD_FRIEND_ROUTE`,
 *     `ADD_FRIEND_ENTRY_LABEL` ('Vriend toevoegen') and `ADD_FRIEND_TITLE`
 *     ('Vrienden'). The Sturen sheet's empty state pushes this screen
 *     because a send needs a MUTUAL pair (ONTDEK-PLAN.md O-11b:
 *     `recipe_shares_insert` becomes "wederzijds"), so "Vriend toevoegen"
 *     is still exactly what that reader came to do. And the title may not
 *     disagree with the tab it belongs to: renaming the Vrienden TAB is
 *     O-1, O-1 is still open, and one screen renaming itself first would be
 *     the drift rather than the fix.
 *   - UNCHANGED, because it is not about the graph at all:
 *     `OWN_HANDLE_EXPLAINER` ('Zo vinden vrienden jou.') — "vrienden" there
 *     means the people who know you, not a row in a table.
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
 *     being a directory is that the client offers no way to ask. ⚠ THE
 *     DIRECTED GRAPH DOES NOT SOFTEN THIS. `findProfileByHandle` still does
 *     `.eq` and never `ilike`; whether a people-search ever lands is O-4,
 *     it belongs to fase 6, and it is not this change.
 *   - NO SUGGESTIONS, and no friends-of-friends. `friendships_select`
 *     deliberately lets nobody read a pair they are not party to
 *     (0007_social.sql's "no policy lets C read the A-B row"), so a
 *     suggestion engine would need a definer-rights function written
 *     specifically to defeat that.
 *   - NO RED BADGES. §4.4: "an open request is a fact, not an alarm."
 *   - ⚠ NO FOLLOWER COUNT, which is the new one, and the one a directed
 *     graph makes tempting for the first time. `partitionFollows`'s header
 *     refuses it in the domain and this module refuses it in the words: the
 *     two lists below are people the reader can act on, never a number
 *     rendered at anybody. §8's "no trophy shelf" and PD-024 agree — a
 *     follow is a gate, never a score on a person.
 *
 * WHAT IS DELIBERATELY OUT OF SCOPE, so its absence is not read as an
 * oversight. `removeFollow` covers unfollow, withdraw and remove-a-follower,
 * `blockProfile` / `liftBlock` cover blocking, and §4.4 additionally
 * sketches blocking as "a quiet tertiary behind a confirm". None of them is
 * here. The screen this module dresses covers exactly the loop that makes a
 * follow exist — look someone up, ask, answer an ask — because that loop is
 * the one thing the app has no way to do at all today. An unfollow control
 * has a working alternative (do nothing) in a way that "acquire a follow"
 * does not. When they land, they land as their own labels beside these, and
 * `describeAddFriendOutcome` gains no new members: removal is not an
 * outcome of a request.
 *
 * ---
 *
 * THE TRANSITION TABLE IS ASKED, NEVER RESTATED. `planFollowRequest` calls
 * `applyFollowAction` and translates its answer into Dutch. It exists
 * because the repository's `actOnFollow` REJECTS an illegal move rather
 * than silently doing nothing, and an `Error` from a rejected write is not
 * a sentence anybody can act on. So this module classifies first and writes
 * second. What it must never do is decide legality itself:
 * src/domain/social/follow.ts's header is explicit that a second copy of
 * that table is the thing the domain module exists to prevent, and the test
 * proves the two agree on every state.
 */

import { applyFollowAction, isBlockStanding, resolveFollowActorRole } from '@/domain/social/follow';
import { HANDLE_MAX_LENGTH, HANDLE_MIN_LENGTH, normalizeHandle } from '@/domain/social/handle';
import type { Block, Follow, FollowRole, Profile, ProfileId } from '@/domain/social/types';

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
 *
 * ⚠ IT STILL SAYS "VRIEND" AFTER PD-024, ON PURPOSE — see the header's
 * act-versus-destination rule. The Sturen sheet pushes this screen because
 * a send needs a mutual pair, and that is what this word names.
 */
export const ADD_FRIEND_ENTRY_LABEL = 'Vriend toevoegen';

export const ADD_FRIEND_ENTRY_ACCESSIBILITY_LABEL = 'Vriend toevoegen met een gebruikersnaam';

// ---------------------------------------------------------------------------
// The screen's own chrome
// ---------------------------------------------------------------------------

/** §4.4's `title2`. The screen is titled for the subject; the act is the primary button. */
export const ADD_FRIEND_TITLE = 'Vrienden';

/* `ADD_FRIEND_BACK_LABEL` ('Terug') was removed on 9 September 2026 — the
   control is a `BackButton` arrow now. This screen's header used to record
   that its back word disagreed with eight other screens, and that reconciling
   them was "a decision about every back-word in the app across three copy
   modules" it declined to make. This is that decision, taken the cheap way:
   no word, nothing left to disagree about. */

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

/** §4.4 verbatim. See the header on why the word "vrienden" survives here. */
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
 * The primary under the input.
 *
 * ⚠ ~~`Verstuur verzoek`~~, §4.4 VERBATIM, UNTIL PD-024 MADE IT AMBIGUOUS.
 * This is the button that performs the act, so it is the one string on the
 * screen that has to name the act exactly. "Verzoek" was unambiguous while
 * there was only one kind of request; now there are two shapes it could
 * have — the one-way grant this button actually sends, and the mutual
 * relationship the reader may well believe they are asking for. The word is
 * the whole difference between those two, and the reader cannot get it from
 * anywhere else on the screen.
 *
 * There is deliberately no in-flight LABEL beside it, unlike the Sturen
 * sheet's `Versturen…`. That sheet swaps a row's text because the row is
 * the control and there is nowhere else for the state to live; here the
 * control is a `Button`, whose `loading` prop already replaces the label
 * with a spinner and sets `accessibilityState.busy`. A second, unused
 * constant would be a string nothing renders and the next reader would
 * have to prove that about.
 */
export const SEND_REQUEST_LABEL = 'Verstuur volgverzoek';

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

export const REQUESTS_SECTION_LABEL = 'VOLGVERZOEKEN';

/** A fact, in the register §4.4 asks for: no badge, no zero, no hedge implying more is coming. */
export const REQUESTS_EMPTY = 'Er staan geen volgverzoeken open.';

/**
 * ⚠ THE MOST IMPORTANT SENTENCE ON THIS SCREEN, AND IT IS NEW.
 *
 * `Accepteren` used to answer "will you be my friend", and a reader who
 * pressed it knew what they were agreeing to because the word said so.
 * After PD-024 it answers something narrower and stranger: it lets ONE
 * named person see what this household cooks (§5's disclosure, now granted
 * per person), and it creates nothing whatsoever in the other direction.
 * Neither half of that is guessable from a button labelled `Accepteren`,
 * and a consent the giver has to guess at is not a consent.
 *
 * So the section states both halves before the buttons do anything: what
 * the reader is handing over, and what they are NOT being signed up for.
 * The second clause is not padding — "als je wil terugvolgen" is the exact
 * freedom the owner asked for, and a reader who thinks accepting obliges
 * them to follow back will decline requests they would have accepted.
 *
 * DRAWN ONLY WHEN THERE IS SOMETHING TO ANSWER. An explainer over an empty
 * list is furniture, and §4.4's register is terse.
 *
 * IT NAMES NO CONSEQUENCE IT CANNOT KEEP. Not "ze kunnen je recepten
 * sturen" — a send needs a mutual pair, which this accept does not create —
 * and no promise about what following back would do, because that is a
 * second decision and it gets its own moment.
 */
export const REQUESTS_EXPLAINER = 'Wie je accepteert, ziet wat jij kookt. Of jij hen terugvolgt, kies je zelf.';

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

/* ~~`FRIENDS_SECTION_LABEL` ('VRIENDEN') and `FRIENDS_EMPTY` ('Je hebt nog
   geen vrienden toegevoegd.')~~ were removed on 11 September 2026, and they
   did not become two new names for one list — they became TWO LISTS,
   because the fact they described split in half.

   An accepted follow is now either "ik volg hen" or "zij volgen mij", and a
   person can be one without the other indefinitely. A single section headed
   VRIENDEN would have had to pick one of three readings: the intersection
   (which hides every one-way row, including the grants the reader
   themselves just made), the union (which calls two different facts by one
   name and leaves nobody able to tell which they are looking at), or a
   silent preference for one side. All three are the same mistake — they put
   a distinction the reader has to act on behind a word they cannot see
   through. Two labelled lists state the two facts and let the asymmetry be
   read straight off the screen, which is the entire thing PD-024
   introduced. `describeFollowLists` in addFriendLists.ts carries why a
   mutual pair appears in both. */

/** "Ik volg hen" — whose cooking this reader has been granted sight of. */
export const FOLLOWING_SECTION_LABEL = 'JIJ VOLGT';

export const FOLLOWING_EMPTY = 'Je volgt nog niemand.';

/**
 * "Zij volgen mij" — and this is the list that has to exist.
 *
 * These are the people who can see what this household cooks, one accepted
 * request at a time. §5's switch is revocable by design; a per-person grant
 * the giver cannot even SEE would be a consent with no way back, which is
 * the one shape DESIGN-SOCIAL.md §5 refuses outright. The list is also the
 * precondition for the remove-a-follower control that belongs beside it —
 * `removeFollow` already permits it from this side — and shipping the list
 * first is honest in a way that shipping the control without the list would
 * not have been.
 */
export const FOLLOWERS_SECTION_LABEL = 'VOLGEN JOU';

export const FOLLOWERS_EMPTY = 'Nog niemand volgt jou.';

export const ADD_FRIEND_LOADING = 'Even kijken...';

/** Names what failed rather than "er ging iets mis", matching Vrienden's and Ranglijst's error lines. */
export const ADD_FRIEND_LOAD_FAILED = 'Je volgverzoeken en volglijsten konden niet geladen worden.';

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
 * Every way "Verstuur volgverzoek" can end, as a closed vocabulary rather
 * than a message string — the same split `FollowRejection` and
 * `NoCandidateReason` use, and for the same reason: the rule belongs to the
 * domain, the Dutch belongs here.
 *
 * ⚠ ~~`'awaiting-you'`~~ WAS REMOVED ON 11 SEPTEMBER 2026, AND THAT WAS NOT
 * TIDYING — THE SITUATION IT DESCRIBED STOPPED BEING A REFUSAL. It meant
 * "that person has already asked YOU, so your own request cannot be filed",
 * which was true of a graph with one row per unordered pair: their pending
 * row WAS the pair, and there was nowhere to put a second ask.
 *
 * A directed graph has somewhere to put it. `getFollowBetween(me, them)`
 * reads the row pointing FROM me; a request they sent me is a different row
 * entirely; and asking to follow somebody who has asked to follow you is
 * both legal and exactly what the owner described — *"en als je wil
 * terugvolgen"*. So the old outcome could now only ever fire by refusing a
 * move the domain permits. It is gone rather than reworded, and
 * `already_pending` consequently has ONE meaning here: your own request is
 * open.
 *
 * WHAT THE READER LOSES, stated rather than glossed: the old sentence also
 * POINTED at the `Accepteren` further down the page, and nothing says that
 * any more. It is an acceptable loss because the row it pointed at is on
 * this same screen, under its own section header, with its own two buttons
 * — and because the alternative was a second round-trip
 * (`getFollowBetween(them, me)`) to decorate a request that succeeded
 * anyway.
 *
 * ⚠ ~~`'already-friends'`~~ BECAME `'already-following'` IN THE SAME PASS,
 * and for the reason the header gives at length: the accepted row points
 * one way, so "jullie zijn al vrienden" would claim a second row this
 * outcome never read.
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
  /** This reader already follows them — the accepted row points from me. */
  | 'already-following'
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
 *      ⚠ MIGRATION 0021 RAISED THE STAKES RATHER THAN LOWERING THEM. A
 *      block is now its own object with its own `blockedAt`; it refuses
 *      every move before the row is even consulted, because
 *      `applyFollowAction` checks `isBlocked` FIRST; and `isBlockStanding`
 *      is deliberately direction-insensitive. So the blocker and the
 *      blocked reach this exact sentence down the exact same path, which is
 *      what makes "in both directions" a property of the code rather than
 *      an intention about it.
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
      return { tone: 'ok', text: `Volgverzoek verstuurd naar ${handleLabel}.` };
    case 'awaiting-them':
      return { tone: 'notice', text: `Je volgverzoek aan ${handleLabel} staat al open.` };
    case 'already-following':
      // "Je volgt hen al" and not "jullie zijn al vrienden": the accepted
      // row points one way, and whether they follow back is a fact this
      // sentence never read and must not claim.
      return { tone: 'notice', text: `Je volgt ${handleLabel} al.` };
    case 'blocked':
      // See this function's header: quiet, and identical in both directions.
      return { tone: 'notice', text: `Je kunt ${handleLabel} nu geen volgverzoek sturen.` };
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
export type FollowRequestPlan =
  | { readonly action: 'request' }
  | { readonly action: 'none'; readonly outcome: AddFriendOutcome };

const SEND_IT: FollowRequestPlan = { action: 'request' };

/**
 * Whether a follow request may be opened against an existing row, and what
 * to say when it may not.
 *
 * ASKS `applyFollowAction`; DOES NOT RESTATE IT. See this module's header,
 * and follow.ts's, on why that matters more than the four lines it saves.
 *
 * ⚠ IT TAKES THE BLOCKS RATHER THAN A BOOLEAN, which is the decision
 * follow.ts's collectors made for the reason they state: "making that the
 * caller's job is how one of six call sites forgets." `isBlockStanding` is
 * asked here, once, so the screen hands over rows and never a verdict — and
 * so the direction-insensitivity that makes the refusal identical for
 * blocker and blocked is exercised by this module's own test rather than
 * assumed on the screen's behalf.
 *
 * ⚠ `existing` IS THE ROW POINTING FROM THE READER, and the caller must
 * read it with `getFollowBetween(me, them)` in that order. A row pointing
 * the other way is a request THEY sent; it is not this plan's business, and
 * feeding it in here would classify their ask as the reader's own.
 *
 * `not_followee` and `no_pending_request` cannot arise from a 'request'
 * action on a row the reader follows from: `resolveFollowActorRole` answers
 * 'follower' for every such row and for null, and both `fromNoRow` and
 * `fromDeclined` settle a follower's 'request'. They are mapped to 'failed'
 * rather than left to fall through, because a total function with one
 * unreachable-but-honest arm is better than a switch that throws on a state
 * a future edit to the domain could make reachable.
 */
export function planFollowRequest(
  existing: Follow | null,
  blocks: readonly Block[],
  myProfileId: ProfileId,
  otherProfileId: ProfileId,
): FollowRequestPlan {
  const result = applyFollowAction({
    from: existing === null ? null : existing.status,
    action: 'request',
    actor: resolveFollowActorRole(existing, myProfileId),
    isBlocked: isBlockStanding(blocks, myProfileId, otherProfileId),
  });

  if (result.ok) {
    return SEND_IT;
  }

  switch (result.reason) {
    case 'already_following':
      return { action: 'none', outcome: 'already-following' };
    case 'blocked':
      return { action: 'none', outcome: 'blocked' };
    case 'already_pending':
      // One meaning only since PD-024 — see `AddFriendOutcome` on the
      // removal of 'awaiting-you'.
      return { action: 'none', outcome: 'awaiting-them' };
    case 'not_followee':
    case 'no_pending_request':
      return { action: 'none', outcome: 'failed' };
    default: {
      const exhaustiveCheck: never = result.reason;
      throw new Error(`Unhandled FollowRejection: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
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
    // ~~"Verzoek van"~~: a listener hears this row on its own, with the
    // section header long behind them, so the kind of request has to be on
    // the row rather than only over it.
    accessibilityLabel: `Volgverzoek van ${who}.`,
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
    accessibilityLabel: `Volgverzoek aan ${speakParty(party)}: ${OUTGOING_REQUEST_STATUS} op antwoord.`,
  };
}

export interface AcceptedFollowRow extends FriendPartyModel {
  readonly accessibilityLabel: string;
}

/**
 * An accepted follow, from whichever side of it the reader holds.
 *
 * ONE FUNCTION WITH A `FollowRole` RATHER THAN TWO NAMED ONES, against the
 * habit of the three describers above. The row is identical in both lists —
 * the same name, the same handle, the same absence of everything else — and
 * only the direction of one sentence differs, so two functions would be one
 * shared body under two headers. The parameter is the domain's own
 * `FollowRole` and not a boolean, for follow.ts's stated reason: "a boolean
 * argument called `mutual` at a call site is a decision nobody can find
 * later."
 *
 * ⚠ `myRole` IS THE READER'S SIDE OF THE ROW, not the other person's, and
 * the two are exact inverses — reading it backwards would tell every reader
 * the opposite of the truth about who can see their cooking, silently, in
 * both lists at once. `partitionFollows` computes the side with
 * `followRoleOf` and `describeFollowLists` hands that answer straight
 * through rather than re-deriving it; the tests pin both directions.
 *
 * THE SENTENCE SAYS WHAT THE ROW IS AND NOT WHAT IT UNLOCKS. A follower row
 * does not add "ze zien wat je kookt": that claim belongs to
 * `REQUESTS_EXPLAINER`, at the moment the reader actually grants it, and
 * repeating it down a list would turn a list into a warning — which is
 * §4.4's "a fact, not an alarm" broken from the other end.
 *
 * JUST THE PERSON, OTHERWISE. No count of what they sent, no note of when
 * anything started, and nothing about whether THEY share their cooking —
 * that last would leak another household's §5 answer onto a surface with no
 * business holding it.
 */
export function describeFollowParty(
  profileId: ProfileId,
  profile: Profile | null,
  myRole: FollowRole,
): AcceptedFollowRow {
  const party = describeParty(profileId, profile);
  const who = speakParty(party);

  return {
    ...party,
    accessibilityLabel: myRole === 'follower' ? `Jij volgt ${who}.` : `${who} volgt jou.`,
  };
}

// ---------------------------------------------------------------------------
// §5's one-time ask
// ---------------------------------------------------------------------------

export interface CookSharingAskInput {
  /**
   * People who can see this household's cooking AFTER the accept that just
   * landed, read back rather than counted forward — see
   * `shouldAskCookSharing`.
   *
   * ⚠ ~~`acceptedFriendCount`~~ BECAME `followerCount` ON 11 SEPTEMBER
   * 2026, and the rename is the substance rather than cosmetics. §5's
   * switch discloses what this household cooks, and after PD-024 the people
   * it discloses it TO are precisely the accepted FOLLOWERS — "zij volgen
   * mij" — and not the people this reader has chosen to follow. Counting
   * the wrong side would raise a consent sheet about an audience that does
   * not exist: a household following nine cooks with no followers of its
   * own would be asked to disclose to nobody, and one with nine followers
   * and no follows would never be asked at all.
   */
  readonly followerCount: number;
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
 * `alreadyAsked` IS THE GUARD THAT ENFORCES "ONCE". It is the durable one,
 * it survives an app restart, it is what `markHouseholdCookSharingAsked`
 * writes, and that method has no un-ask counterpart precisely so this can
 * never be reopened.
 *
 * IT IS `>= 1`, AND IT USED TO BE `=== 1`. That is the one thing here the
 * owner's reversal changed, and it closes a hole that only became visible
 * once sharing became the standard.
 *
 * Under `=== 1`, a household that ALREADY had two or more accepted friends
 * could never be asked contextually at all — their first friendship was in
 * the past, and nothing would ever raise the sheet again, so Instellingen
 * was their only route. While sharing was off by default that was the safe
 * direction and cost them nothing they had asked for. With sharing
 * standard (migration 0015) it inverts: the households most likely to want
 * it are exactly the ones who already have friends, and they would be the
 * only ones never offered the state the product now calls normal.
 *
 * WHAT BROADENING IT GIVES UP, stated rather than glossed: the SECOND,
 * belt-and-braces guard, which used to cover the window where the mark
 * write is in flight or has failed. Two things still cover that window.
 * `add.tsx`'s `askRef` is set synchronously when the sheet goes up and
 * cleared synchronously in the first line of the answer handler, which no
 * React batching can defeat — so the sheet cannot be raised twice in one
 * session. And across sessions, the only case that re-asks is one where
 * the answer was never recorded at all, which is a question that genuinely
 * was not answered rather than a campaign.
 *
 * ZERO STILL ASKS NOTHING, which is why this is `>= 1` and not "any
 * number". Zero means the accept did not actually take — a race, a
 * rejected write — and asking a household to disclose their cooking on the
 * strength of a grant that does not exist is exactly the
 * consent-by-accident PD-005 exists to prevent.
 *
 * THE COUNT IS READ BACK, NOT INCREMENTED. The screen re-reads `listFollows`
 * after the accept (it has to, to redraw the rows) and counts its followers
 * out of that. A count carried forward from the snapshot the screen was
 * holding would be one stale read away from claiming a grant that never
 * landed.
 */
export function shouldAskCookSharing(input: CookSharingAskInput): boolean {
  return input.followerCount >= 1 && !input.alreadyAsked;
}

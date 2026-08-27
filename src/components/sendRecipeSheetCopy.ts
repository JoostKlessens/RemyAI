/**
 * Copy, note arithmetic and per-friend state for the Sturen sheet
 * (src/components/SendRecipeSheet.tsx) — DESIGN-SOCIAL.md §3.1 and §4.1,
 * PD-015's second tier, PD-016's reversal.
 *
 * WHY A MODULE OF ITS OWN, the libraryTileActionCopy.ts argument again:
 * vitest runs in `node` with react-native stubbed (tests/stubs/
 * react-native.ts), so a sentence written inside a `.tsx` is a sentence
 * nothing can assert. It matters more here than on the exclusion row,
 * because this surface is defined as much by what it must NEVER say as by
 * what it says — no read receipt, no cook gate, no re-send celebration, no
 * recency and no counts — and an absence is only enforceable if something
 * sweeps the strings. tests/sendRecipeSheetCopy.test.ts does exactly that,
 * over every export, so a constant added later is covered without anybody
 * remembering to extend a list.
 *
 * `SEND_NOTE_MAX_LENGTH` IS IMPORTED, NEVER RESTATED. It lives on
 * `RemySocialRepository`'s own types module beside `normalizeSendNote`,
 * whose header says in as many words: "What must never happen is a second
 * copy appearing next to this one — one function, wherever it sits." That
 * header also asks for both to move to src/domain/social/ the moment this
 * sheet counts characters as they are typed, which is now. They have NOT
 * been moved, and the reason is ownership rather than disagreement:
 * src/lib/repository/** is another agent's file this session. The move is
 * mechanical when one hand owns both — this module then re-points one
 * import and nothing else changes.
 *
 * THE COUNTER COUNTS CODE POINTS, and it counts the TRIMMED note.
 * `char_length` in 0009's CHECK counts code points, and JavaScript's
 * `.length` counts UTF-16 units, so a counter built on `.length` would
 * refuse 140 emoji that Postgres accepts happily — and the person retyping
 * would have no way to learn which of the two rules they had broken.
 * Trimming is the same argument from the other end: `normalizeSendNote`
 * trims before it measures, so counting the raw string would block a note
 * the write path accepts. The visible cost is that a trailing space does
 * not advance the counter, which is the smaller of the two lies.
 *
 * WHAT IS DELIBERATELY ABSENT, each one a decision rather than an omission:
 *
 *   - NO `seen`, NO "gezien", NO DELIVERY STATE. §8's read-receipt refusal,
 *     which `RecipeShare` already expresses as a type by having no `seen`
 *     field. This module never receives reader state, so there is nowhere
 *     for one to enter even by accident.
 *   - NO COOK INPUT. PD-016 reversed the cook gate after it had been built.
 *     `describeSendRow` takes a friend and a note, and nothing else: a row
 *     is sendable because the dish is in your library, full stop.
 *   - NO SEND TALLY. §4.1 wants friends ordered most-sent-to first, ties
 *     alphabetical. `RemySocialRepository` has no sender-side list (its own
 *     header calls that counterpart deliberately absent), so the tie-break
 *     is the whole rule today. The rejected alternative was a local
 *     per-friend send count on the device: it would be a count of how often
 *     you have sent something, which is the one number this design refuses
 *     to keep, and it would be wrong on a second device anyway. When the
 *     sender-side read lands, `orderSendFriends` is the one function that
 *     changes.
 *   - NO TRUNCATION HELPER. An over-long note is reported, never cut. See
 *     `normalizeSendNote`: "publishing words the sender did not choose, in
 *     their name, on somebody else's screen".
 */

import type { ProfileId } from '@/domain/social/types';
import { SEND_NOTE_MAX_LENGTH } from '@/lib/repository/social/types';

// ---------------------------------------------------------------------------
// The entry points into the sheet
// ---------------------------------------------------------------------------

/**
 * §3.1's first entry point: OutcomeCard's follow-up phase "gains one
 * tertiary `Stuur door` beside the existing exit".
 *
 * WHY IT SITS IN THIS MODULE RATHER THAN ratingScaleCopy.ts. It is a
 * sentence about sending, not about rating, and the vocabulary scans in
 * tests/sendRecipeSheetCopy.test.ts sweep every export here — so this
 * label is held to the same four refusals as the sheet it opens. Dropped
 * into the rating module it would be the one send string nothing checks.
 *
 * "Door" rather than a bare "Stuur": at this moment the dish is the one
 * you have just finished, and passing it on is what the word carries.
 */
export const OUTCOME_SEND_LABEL = 'Stuur door';

export const OUTCOME_SEND_ACCESSIBILITY_LABEL = 'Stuur dit gerecht door naar een vriend';

// ---------------------------------------------------------------------------
// The sheet's own chrome
// ---------------------------------------------------------------------------

/** §4.1's `title3`. The sheet is named for the act; the dish is the line under it. */
export const SEND_SHEET_TITLE = 'Sturen';

/** Scrim tap target, matching SaveIntentSheet's "Sluit het bewaarmenu". */
export const SEND_SHEET_DISMISS_LABEL = 'Sluit het stuurmenu';

/**
 * §4.1's tertiary at the foot. It closes the sheet and nothing else —
 * there is no aggregate send button, because per-row commit is what makes
 * sending to one person cost one tap.
 */
export const SEND_SHEET_DONE_LABEL = 'Klaar';

// ---------------------------------------------------------------------------
// The note
// ---------------------------------------------------------------------------

/** §4.1 verbatim. The parenthesis is the whole permission: a note is optional and nothing waits on it. */
export const SEND_NOTE_PLACEHOLDER = 'Schrijf er iets bij (mag)';

export const SEND_NOTE_ACCESSIBILITY_LABEL = 'Briefje bij dit gerecht';

export const SEND_NOTE_ACCESSIBILITY_HINT = `Optioneel, hooguit ${SEND_NOTE_MAX_LENGTH} tekens.`;

export interface SendNoteState {
  /** Code points in the trimmed note — the same unit 0009's CHECK uses. */
  readonly characterCount: number;
  /** False for an empty or whitespace-only note, which `normalizeSendNote` stores as null. */
  readonly hasNote: boolean;
  readonly isOverLimit: boolean;
  /** Zero unless over. How much has to come off, in the unit the counter shows. */
  readonly overBy: number;
  /** `12/140`, in mono — the one numeral on this sheet. */
  readonly counterLabel: string;
  /** The counter spelled out; a screen reader reading "slash" adds nothing. */
  readonly counterAccessibilityLabel: string;
  /** Rendered in `danger` under the field while the note is too long; null otherwise. */
  readonly errorNote: string | null;
}

function describeOverBy(overBy: number): string {
  const unit = overBy === 1 ? 'teken' : 'tekens';
  // States the refusal, not just the overage: a bare counter reads like a
  // budget the app might spend on your behalf by cutting the tail off.
  return `Dit briefje is ${overBy} ${unit} te lang. We korten niets in. Haal er zelf iets af.`;
}

export function describeSendNote(rawNote: string): SendNoteState {
  const note = rawNote.trim();
  const characterCount = [...note].length;
  const overBy = Math.max(0, characterCount - SEND_NOTE_MAX_LENGTH);

  return {
    characterCount,
    hasNote: characterCount > 0,
    isOverLimit: overBy > 0,
    overBy,
    counterLabel: `${characterCount}/${SEND_NOTE_MAX_LENGTH}`,
    counterAccessibilityLabel: `${characterCount} van ${SEND_NOTE_MAX_LENGTH} tekens`,
    errorNote: overBy > 0 ? describeOverBy(overBy) : null,
  };
}

// ---------------------------------------------------------------------------
// The friend list, and the states it can be in
// ---------------------------------------------------------------------------

export const SEND_FRIENDS_LOADING_LABEL = 'Vrienden worden opgehaald…';

/** Names what failed rather than "er ging iets mis", matching Vrienden's own error line. */
export const SEND_FRIENDS_UNAVAILABLE_LABEL = 'De vriendenlijst kon niet geladen worden.';

export const SEND_FRIENDS_RETRY_LABEL = 'Opnieuw proberen';

/** §4.1 verbatim. */
export const SEND_NO_FRIENDS_TITLE = 'Nog geen vrienden om naar te sturen.';

/**
 * §4.1 pairs that sentence with a secondary `Vriend toevoegen` button
 * pointing at §4.4.
 *
 * THIS LINE USED TO STATE A LIMITATION, AND THE LIMITATION IS GONE. The
 * previous text was "Een vriend toevoegen kan nog niet in de app. Zodra dat
 * kan, staan ze hier..." — written that way on purpose, because §4.4's
 * screen did not exist and a control that navigates nowhere is worse than
 * an honest sentence. `/friends/add` (src/app/friends/add.tsx) is now that
 * screen, the button beside this sentence reaches it, and so the old
 * wording had become the one thing copy may never be: false. A sentence
 * describing a missing feature has to be rewritten in the same change that
 * supplies it, or it quietly teaches people the app cannot do something it
 * can.
 *
 * IT NAMES THE MECHANISM RATHER THAN THE BUTTON. "Tik op de knop hieronder"
 * would be an instruction that breaks the moment the button moves; naming
 * the handle exchange says the same thing and is also the honest summary of
 * §4.4's refusals — a gebruikersnaam you already know is the only way in,
 * because there is no search, no contact upload and no suggestion anywhere
 * behind it.
 */
export const SEND_NO_FRIENDS_BODY =
  'Voeg eerst iemand toe met de gebruikersnaam die je van elkaar kent. Daarna staat diegene hier. Dan kun je dit gerecht sturen.';

// ---------------------------------------------------------------------------
// One row, one friend
// ---------------------------------------------------------------------------

/** §4.1 verbatim: "a mono `Stuur` action at the row's end". */
export const SEND_ROW_ACTION_LABEL = 'Stuur';

/** In flight. Not a spinner: a one-tap write behind a spinner reads as a transaction. */
export const SEND_ROW_SENDING_LABEL = 'Versturen…';

/** §4.1 verbatim: "committed: mono, textMuted". The label swap plus the accent stroke IS the confirmation. */
export const SEND_ROW_SENT_LABEL = 'Verstuurd';

export const SEND_ROW_RETRY_LABEL = 'Opnieuw';

/** States the rollback, not just the failure — nobody was sent anything. */
export const SEND_ROW_FAILED_NOTE = 'Niet gelukt. Er is niets verstuurd. Probeer het nog eens.';

export const SEND_FAILED_ANNOUNCEMENT = 'Niet gelukt. Er is niets verstuurd.';

/**
 * The commit, spoken. The sheet stays open on purpose (§4.1: "the row
 * stays put so a second friend can be tapped"), so there is no new surface
 * a screen reader would land on and read — this sentence is the only
 * confirmation that exists for anyone who cannot see the stroke draw.
 *
 * Identical on a re-send, deliberately. `sendRecipe` upserts on (meal,
 * recipient) and moves neither `sentAt` nor the recipient's seen state, so
 * a second send is an amendment to one offer. Saying anything louder the
 * second time would advertise a bell the sender cannot ring.
 */
export function describeSendAnnouncement(displayName: string): string {
  return `Verstuurd naar ${displayName}.`;
}

export type SendRowStatus = 'idle' | 'sending' | 'sent' | 'failed';

/** A friend as the sheet needs them: who they are, and how to name them. */
export interface SendFriendIdentity {
  readonly profileId: ProfileId;
  readonly displayName: string;
  /** Stored already normalized, no leading '@' (src/domain/social/handle.ts). The row draws the '@'. */
  readonly handle: string;
}

export interface SendFriend extends SendFriendIdentity {
  readonly status: SendRowStatus;
}

export interface SendRowModel {
  readonly key: ProfileId;
  /** One character on the `surfaceSunken` disc — §4.1's monogram. */
  readonly monogram: string;
  readonly displayName: string;
  /** `@sanne`. */
  readonly handleLabel: string;
  readonly actionLabel: string;
  readonly actionable: boolean;
  /** Draws the accent stroke under the name. True only after the write landed. */
  readonly committed: boolean;
  /** Rendered in `danger` under the row after a failed write; null otherwise. */
  readonly errorNote: string | null;
  readonly accessibilityLabel: string;
}

const MONOGRAM_FALLBACK = '?';

/**
 * The first code point, not the first UTF-16 unit: a display name starting
 * with an emoji or an astral letter would otherwise render half a
 * surrogate pair, which draws as a replacement box.
 */
function pickMonogram(friend: SendFriendIdentity): string {
  const displayName = friend.displayName.trim();
  const source = displayName.length > 0 ? displayName : friend.handle.trim();
  const first = [...source][0];
  return first === undefined ? MONOGRAM_FALLBACK : first.toLocaleUpperCase('nl-NL');
}

/**
 * `noteIsOverLimit` disables every row rather than letting the write fail
 * per friend. The note belongs to the sheet, not to a row, so a rejection
 * that only surfaced after tapping Sanne would blame Sanne's row for
 * something the field above it did.
 */
export function describeSendRow(friend: SendFriend, noteIsOverLimit: boolean): SendRowModel {
  const handleLabel = `@${friend.handle}`;
  const who = `${friend.displayName}, ${handleLabel}`;
  const base = {
    key: friend.profileId,
    monogram: pickMonogram(friend),
    displayName: friend.displayName,
    handleLabel,
  };

  switch (friend.status) {
    case 'sending':
      return {
        ...base,
        actionLabel: SEND_ROW_SENDING_LABEL,
        actionable: false,
        committed: false,
        errorNote: null,
        // Spoken without the ellipsis the label carries: a screen reader
        // reads "dot dot dot" and learns nothing from it.
        accessibilityLabel: `Versturen naar ${who}`,
      };
    case 'sent':
      return {
        ...base,
        actionLabel: SEND_ROW_SENT_LABEL,
        actionable: false,
        committed: true,
        errorNote: null,
        accessibilityLabel: `${SEND_ROW_SENT_LABEL} naar ${who}`,
      };
    case 'failed':
      return {
        ...base,
        actionLabel: SEND_ROW_RETRY_LABEL,
        actionable: !noteIsOverLimit,
        committed: false,
        errorNote: SEND_ROW_FAILED_NOTE,
        accessibilityLabel: `${SEND_ROW_RETRY_LABEL} sturen naar ${who}. ${SEND_ROW_FAILED_NOTE}`,
      };
    case 'idle':
      return {
        ...base,
        actionLabel: SEND_ROW_ACTION_LABEL,
        actionable: !noteIsOverLimit,
        committed: false,
        errorNote: null,
        accessibilityLabel: `${SEND_ROW_ACTION_LABEL} naar ${who}`,
      };
    default: {
      const exhaustiveCheck: never = friend.status;
      throw new Error(`Unhandled SendRowStatus: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * §4.1's ordering, minus its first clause — see the module header on why
 * no send tally exists to sort by. Alphabetical on the display name, with
 * the handle as the tiebreak so two people called "Sanne" have a stable
 * order rather than whichever one the friendship read happened to return
 * first. Collated as Dutch, so "anna" sorts before "Joris" and "Zoë" lands
 * where a reader expects it.
 */
export function orderSendFriends(friends: readonly SendFriendIdentity[]): readonly SendFriendIdentity[] {
  return [...friends].sort((left, right) => {
    const byName = left.displayName.localeCompare(right.displayName, 'nl');
    return byName !== 0 ? byName : left.handle.localeCompare(right.handle, 'nl');
  });
}

// ---------------------------------------------------------------------------
// The state the sheet is a function of
// ---------------------------------------------------------------------------

/**
 * `unavailable` is a real phase and never an empty list, for the reason
 * the exclusion row keeps one: an empty `ready` list asserts "you have no
 * friends", which is a different and far more insulting claim than "we
 * could not read your friends".
 */
export type SendSheetPhase = 'loading' | 'ready' | 'unavailable';

export interface SendSheetState {
  readonly phase: SendSheetPhase;
  /** Ordered on the way in, so no screen can render them unsorted. Empty unless `ready`. */
  readonly friends: readonly SendFriend[];
}

export const INITIAL_SEND_SHEET: SendSheetState = { phase: 'loading', friends: [] };

export type SendSheetEvent =
  | { readonly type: 'load-started' }
  | { readonly type: 'load-succeeded'; readonly friends: readonly SendFriendIdentity[] }
  | { readonly type: 'load-failed' }
  | { readonly type: 'send-started'; readonly recipientProfileId: ProfileId }
  | { readonly type: 'send-succeeded'; readonly recipientProfileId: ProfileId }
  | { readonly type: 'send-failed'; readonly recipientProfileId: ProfileId };

/**
 * Moves one row, and only if it is where the caller thinks it is.
 * Otherwise the SAME object comes back — the discipline
 * `reduceCookProofExclusion` keeps, and for the same two reasons: an
 * ignored transition must not re-render anything, and a write result
 * belonging to a dish the user has already closed must not land on the
 * dish they just opened.
 */
function withRowStatus(
  state: SendSheetState,
  recipientProfileId: ProfileId,
  from: readonly SendRowStatus[],
  to: SendRowStatus,
): SendSheetState {
  const current = state.friends.find((friend) => friend.profileId === recipientProfileId);
  if (current === undefined || !from.includes(current.status)) {
    return state;
  }
  return {
    phase: state.phase,
    friends: state.friends.map((friend) =>
      friend.profileId === recipientProfileId ? { ...friend, status: to } : friend,
    ),
  };
}

export function reduceSendSheet(state: SendSheetState, event: SendSheetEvent): SendSheetState {
  switch (event.type) {
    case 'load-started':
      // Every committed row is wiped, deliberately. A reopened sheet still
      // reading "Verstuurd" would be a record of what you sent whom, kept
      // on the device and shown back to you — a sender-side history §3.5
      // has not asked for and this surface must not invent.
      return INITIAL_SEND_SHEET;
    case 'load-succeeded':
      return {
        phase: 'ready',
        friends: orderSendFriends(event.friends).map((friend) => ({ ...friend, status: 'idle' as const })),
      };
    case 'load-failed':
      return { phase: 'unavailable', friends: [] };
    case 'send-started':
      // From `failed` too: the row IS the retry, exactly as the exclusion
      // row is its own retry while `unavailable`.
      return withRowStatus(state, event.recipientProfileId, ['idle', 'failed'], 'sending');
    case 'send-succeeded':
      return withRowStatus(state, event.recipientProfileId, ['sending'], 'sent');
    case 'send-failed':
      return withRowStatus(state, event.recipientProfileId, ['sending'], 'failed');
    default: {
      const exhaustiveCheck: never = event;
      throw new Error(`Unhandled SendSheetEvent: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

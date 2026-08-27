/**
 * The Sturen sheet's copy, its note rule and its per-friend state machine
 * (src/components/sendRecipeSheetCopy.ts) — DESIGN-SOCIAL.md §3.1 / §4.1,
 * PD-015 and PD-016.
 *
 * WHY THIS FILE ASSERTS SENTENCES AND NOT JUST STATE. Four of the five
 * things the send tier promises are promises about what is NEVER said:
 *
 *   1. NO READ RECEIPT (§8, and `RecipeShare`'s own header: "there is no
 *      `seen` field here, and that is the read-receipt refusal expressed as
 *      a type"). The sender must never learn whether a send was opened, so
 *      no sentence on this surface may hint at it.
 *   2. NO COOK GATE (PD-016). Anything in the library may be sent, so no
 *      sentence may make a cook sound like a precondition — a row that
 *      merely *reads* "eerst koken" reintroduces the reversed rule in the
 *      one place users actually look.
 *   3. NO RE-SEND CELEBRATION. `sendRecipe` upserts on (meal, recipient)
 *      and deliberately does not move `sentAt` or reset `seen`, so a
 *      re-send is an amendment, not an event. A second "verstuurd!" would
 *      advertise a bell the sender cannot actually ring.
 *   4. NO RECENCY, NO COUNTS (§3.2, §4.2, PD-015's "no timestamps travel").
 *
 * The vocabulary scans below sweep every exported string, so a fifth
 * constant added later is covered without anyone remembering to add a test.
 *
 * The fifth promise is arithmetic rather than wording: the counter counts
 * CODE POINTS, because `char_length` in 0009's CHECK does. That one is
 * asserted against `normalizeSendNote` itself rather than against a
 * hand-copied number, so the client and the database provably refuse
 * exactly the same notes.
 */

import { describe, expect, test } from 'vitest';
import * as sendCopy from '@/components/sendRecipeSheetCopy';
import {
  INITIAL_SEND_SHEET,
  OUTCOME_SEND_ACCESSIBILITY_LABEL,
  OUTCOME_SEND_LABEL,
  SEND_FRIENDS_UNAVAILABLE_LABEL,
  SEND_NOTE_PLACEHOLDER,
  SEND_NO_FRIENDS_BODY,
  SEND_NO_FRIENDS_TITLE,
  SEND_ROW_ACTION_LABEL,
  SEND_ROW_FAILED_NOTE,
  SEND_ROW_RETRY_LABEL,
  SEND_ROW_SENDING_LABEL,
  SEND_ROW_SENT_LABEL,
  describeSendAnnouncement,
  describeSendNote,
  describeSendRow,
  orderSendFriends,
  reduceSendSheet,
  type SendFriend,
  type SendFriendIdentity,
  type SendSheetState,
} from '@/components/sendRecipeSheetCopy';
import { SEND_NOTE_MAX_LENGTH, normalizeSendNote } from '@/lib/repository/social/types';

const SANNE: SendFriendIdentity = { profileId: 'p-sanne', displayName: 'Sanne', handle: 'sanne' };
const JORIS: SendFriendIdentity = { profileId: 'p-joris', displayName: 'Joris', handle: 'joris' };

function loaded(...friends: readonly SendFriendIdentity[]): SendSheetState {
  return reduceSendSheet(INITIAL_SEND_SHEET, { type: 'load-succeeded', friends });
}

function rowFor(state: SendSheetState, profileId: string): SendFriend {
  const friend = state.friends.find((candidate) => candidate.profileId === profileId);
  if (friend === undefined) {
    throw new Error(`No row for ${profileId}`);
  }
  return friend;
}

/**
 * Every exported string constant, so a scan cannot be outgrown by a new
 * one. Widened to `unknown` first: `Object.values` over a module namespace
 * gives a union of literal types and functions, which a `value is string`
 * predicate cannot narrow from.
 */
function everyExportedSentence(): readonly string[] {
  const exported: readonly unknown[] = Object.values(sendCopy);
  return exported.filter((value): value is string => typeof value === 'string');
}

function assertNoneContain(banned: readonly string[]): void {
  for (const sentence of everyExportedSentence()) {
    for (const word of banned) {
      expect(sentence.toLowerCase()).not.toContain(word);
    }
  }
}

// ---------------------------------------------------------------------------
// The note: code points, and rejection rather than truncation
// ---------------------------------------------------------------------------

describe('the note is counted in code points, exactly as the database counts it', () => {
  /**
   * The whole reason this test exists. A note of 140 emoji measures 280 to
   * JavaScript's `.length` and 140 to Postgres's `char_length`. A counter
   * built on `.length` would refuse a note the database would have
   * accepted, and the person retyping would have no way to learn which of
   * the two rules they had broken.
   */
  test('140 astral characters is a legal note, though .length calls it 280', () => {
    const note = '\u{1F373}'.repeat(SEND_NOTE_MAX_LENGTH);

    expect(note.length).toBe(SEND_NOTE_MAX_LENGTH * 2);
    expect(describeSendNote(note).characterCount).toBe(SEND_NOTE_MAX_LENGTH);
    expect(describeSendNote(note).isOverLimit).toBe(false);
    // The proof that the counter and the CHECK agree: the repository's own
    // normalizer accepts precisely what the counter called legal.
    expect(() => normalizeSendNote(note)).not.toThrow();
  });

  test('one code point past the cap is over the limit, and the repository agrees', () => {
    const note = '\u{1F373}'.repeat(SEND_NOTE_MAX_LENGTH + 1);
    const state = describeSendNote(note);

    expect(state.characterCount).toBe(SEND_NOTE_MAX_LENGTH + 1);
    expect(state.isOverLimit).toBe(true);
    expect(state.overBy).toBe(1);
    expect(() => normalizeSendNote(note)).toThrow();
  });

  test('the counter reads as a fraction of the cap', () => {
    expect(describeSendNote('hoi').counterLabel).toBe(`3/${SEND_NOTE_MAX_LENGTH}`);
    expect(describeSendNote('').counterLabel).toBe(`0/${SEND_NOTE_MAX_LENGTH}`);
  });

  test('the over-limit note says we refuse rather than shorten', () => {
    const state = describeSendNote('a'.repeat(SEND_NOTE_MAX_LENGTH + 7));

    expect(state.errorNote).not.toBeNull();
    expect(state.errorNote).toContain('7 tekens');
    // PD-015 / `normalizeSendNote`: "rejected, never truncated" — the
    // sentence has to say so, because a bare counter reads like a budget
    // the app might spend on your behalf.
    expect(state.errorNote?.toLowerCase()).toContain('korten niets in');
  });

  test('a single character over is singular, not "1 tekens"', () => {
    expect(describeSendNote('a'.repeat(SEND_NOTE_MAX_LENGTH + 1)).errorNote).toContain('1 teken te lang');
  });

  test('an under-limit note carries no error note at all', () => {
    expect(describeSendNote('kort briefje').errorNote).toBeNull();
    expect(describeSendNote('kort briefje').overBy).toBe(0);
  });
});

describe('an empty note is no note, and whitespace does not spend the budget', () => {
  test('whitespace-only counts as nothing, matching normalizeSendNote returning null', () => {
    expect(describeSendNote('   \n ').characterCount).toBe(0);
    expect(describeSendNote('   \n ').hasNote).toBe(false);
    expect(normalizeSendNote('   \n ')).toBeNull();
  });

  test('trailing spaces after a full-length note do not push it over', () => {
    const note = `${'a'.repeat(SEND_NOTE_MAX_LENGTH)}   `;

    // `normalizeSendNote` trims before it measures, so a counter measuring
    // the raw string would block a note the write path accepts happily.
    expect(describeSendNote(note).isOverLimit).toBe(false);
    expect(() => normalizeSendNote(note)).not.toThrow();
  });

  test('a real note is a real note', () => {
    expect(describeSendNote('dit moet je proberen').hasNote).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The friend list
// ---------------------------------------------------------------------------

describe('the friend list', () => {
  test('starts loading, and loading is neither "no friends" nor a failure', () => {
    expect(INITIAL_SEND_SHEET.phase).toBe('loading');
    expect(INITIAL_SEND_SHEET.friends).toEqual([]);
  });

  test('a failed read is its own phase, never an empty list', () => {
    const state = reduceSendSheet(INITIAL_SEND_SHEET, { type: 'load-failed' });

    expect(state.phase).toBe('unavailable');
    expect(SEND_FRIENDS_UNAVAILABLE_LABEL.length).toBeGreaterThan(0);
  });

  test('an empty list after a successful read is a real, ready state', () => {
    const state = loaded();

    expect(state.phase).toBe('ready');
    expect(state.friends).toEqual([]);
  });

  /**
   * §4.1 asks for most-sent-to first, ties alphabetical. There is no
   * sender-side read in `RemySocialRepository` (its own header says the
   * counterpart is deliberately absent), so the tie-break is the whole
   * rule today — see the module header on why no local send tally was
   * invented to fake the first half.
   */
  test('friends are ordered alphabetically by display name', () => {
    const ordered = orderSendFriends([
      { profileId: 'p-3', displayName: 'Zoë', handle: 'zoe' },
      SANNE,
      JORIS,
      { profileId: 'p-4', displayName: 'anna', handle: 'anna' },
    ]);

    expect(ordered.map((friend) => friend.displayName)).toEqual(['anna', 'Joris', 'Sanne', 'Zoë']);
  });

  test('two friends sharing a display name are still ordered deterministically', () => {
    const a: SendFriendIdentity = { profileId: 'p-a', displayName: 'Sanne', handle: 'sanne' };
    const b: SendFriendIdentity = { profileId: 'p-b', displayName: 'Sanne', handle: 'sannek' };

    expect(orderSendFriends([b, a]).map((friend) => friend.handle)).toEqual(['sanne', 'sannek']);
    expect(orderSendFriends([a, b]).map((friend) => friend.handle)).toEqual(['sanne', 'sannek']);
  });

  test('a loaded list arrives ordered, so a screen cannot forget to sort it', () => {
    expect(loaded(SANNE, JORIS).friends.map((friend) => friend.displayName)).toEqual(['Joris', 'Sanne']);
  });

  test('every freshly loaded friend starts idle', () => {
    expect(loaded(SANNE, JORIS).friends.every((friend) => friend.status === 'idle')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// One send, per row
// ---------------------------------------------------------------------------

describe('a send commits per row', () => {
  test('a tap moves exactly one row into flight', () => {
    const state = reduceSendSheet(loaded(SANNE, JORIS), { type: 'send-started', recipientProfileId: 'p-sanne' });

    expect(rowFor(state, 'p-sanne').status).toBe('sending');
    expect(rowFor(state, 'p-joris').status).toBe('idle');
  });

  test('a successful write commits that row and leaves the rest alone', () => {
    const sending = reduceSendSheet(loaded(SANNE, JORIS), { type: 'send-started', recipientProfileId: 'p-sanne' });
    const state = reduceSendSheet(sending, { type: 'send-succeeded', recipientProfileId: 'p-sanne' });

    expect(rowFor(state, 'p-sanne').status).toBe('sent');
    expect(rowFor(state, 'p-joris').status).toBe('idle');
  });

  test('a failed write says so on the row rather than pretending it landed', () => {
    const sending = reduceSendSheet(loaded(SANNE), { type: 'send-started', recipientProfileId: 'p-sanne' });
    const state = reduceSendSheet(sending, { type: 'send-failed', recipientProfileId: 'p-sanne' });

    expect(rowFor(state, 'p-sanne').status).toBe('failed');
    expect(describeSendRow(rowFor(state, 'p-sanne'), false).errorNote).toBe(SEND_ROW_FAILED_NOTE);
    expect(describeSendRow(rowFor(state, 'p-sanne'), false).actionLabel).toBe(SEND_ROW_RETRY_LABEL);
  });

  test('a failed row can be retried', () => {
    const failed = reduceSendSheet(
      reduceSendSheet(loaded(SANNE), { type: 'send-started', recipientProfileId: 'p-sanne' }),
      { type: 'send-failed', recipientProfileId: 'p-sanne' },
    );
    const state = reduceSendSheet(failed, { type: 'send-started', recipientProfileId: 'p-sanne' });

    expect(rowFor(state, 'p-sanne').status).toBe('sending');
  });

  /**
   * The same discipline `reduceCookProofExclusion` keeps: an out-of-order
   * event returns the SAME object, so an ignored transition cannot
   * re-render anything and cannot be mistaken for a real one in a test.
   */
  test('an event for a row that is not in flight is ignored, identically', () => {
    const ready = loaded(SANNE);

    expect(reduceSendSheet(ready, { type: 'send-succeeded', recipientProfileId: 'p-sanne' })).toBe(ready);
    expect(reduceSendSheet(ready, { type: 'send-failed', recipientProfileId: 'p-sanne' })).toBe(ready);
  });

  test('an event for a friend who is not on the list is ignored, identically', () => {
    const ready = loaded(SANNE);

    expect(reduceSendSheet(ready, { type: 'send-started', recipientProfileId: 'p-nobody' })).toBe(ready);
  });

  test('a second tap while a write is in flight changes nothing', () => {
    const sending = reduceSendSheet(loaded(SANNE), { type: 'send-started', recipientProfileId: 'p-sanne' });

    expect(reduceSendSheet(sending, { type: 'send-started', recipientProfileId: 'p-sanne' })).toBe(sending);
  });

  test('a fresh read wipes every committed row, so a reopened sheet is not a receipt', () => {
    const sent = reduceSendSheet(
      reduceSendSheet(loaded(SANNE), { type: 'send-started', recipientProfileId: 'p-sanne' }),
      { type: 'send-succeeded', recipientProfileId: 'p-sanne' },
    );

    expect(reduceSendSheet(sent, { type: 'load-started' })).toEqual(INITIAL_SEND_SHEET);
  });
});

// ---------------------------------------------------------------------------
// The row, as rendered
// ---------------------------------------------------------------------------

describe('the row model', () => {
  test('an idle row offers the send and draws no stroke', () => {
    const row = describeSendRow({ ...SANNE, status: 'idle' }, false);

    expect(row.actionLabel).toBe(SEND_ROW_ACTION_LABEL);
    expect(row.actionable).toBe(true);
    expect(row.committed).toBe(false);
    expect(row.handleLabel).toBe('@sanne');
    expect(row.monogram).toBe('S');
  });

  test('a row in flight is not tappable and still draws no stroke', () => {
    const row = describeSendRow({ ...SANNE, status: 'sending' }, false);

    expect(row.actionLabel).toBe(SEND_ROW_SENDING_LABEL);
    expect(row.actionable).toBe(false);
    expect(row.committed).toBe(false);
  });

  /** §3.1: the accent stroke IS the confirmation — there is no toast anywhere. */
  test('a committed row is the confirmation: the label swaps and the stroke draws', () => {
    const row = describeSendRow({ ...SANNE, status: 'sent' }, false);

    expect(row.actionLabel).toBe(SEND_ROW_SENT_LABEL);
    expect(row.committed).toBe(true);
    expect(row.actionable).toBe(false);
  });

  test('an over-long note disables every row rather than failing at the write', () => {
    expect(describeSendRow({ ...SANNE, status: 'idle' }, true).actionable).toBe(false);
    expect(describeSendRow({ ...SANNE, status: 'failed' }, true).actionable).toBe(false);
  });

  test('the monogram falls back to the handle, and then to a placeholder', () => {
    expect(describeSendRow({ profileId: 'p', displayName: '  ', handle: 'joris', status: 'idle' }, false).monogram).toBe(
      'J',
    );
    expect(describeSendRow({ profileId: 'p', displayName: '', handle: '', status: 'idle' }, false).monogram).toBe('?');
  });

  test('a screen reader hears the action and the person', () => {
    expect(describeSendRow({ ...SANNE, status: 'idle' }, false).accessibilityLabel).toBe('Stuur naar Sanne, @sanne');
    expect(describeSendRow({ ...SANNE, status: 'sent' }, false).accessibilityLabel).toBe('Verstuurd naar Sanne, @sanne');
    expect(describeSendRow({ ...SANNE, status: 'failed' }, false).accessibilityLabel).toContain(SEND_ROW_FAILED_NOTE);
  });

  test('the commit is announced, because the sheet stays open and nothing else says it', () => {
    expect(describeSendAnnouncement('Sanne')).toBe('Verstuurd naar Sanne.');
  });
});

// ---------------------------------------------------------------------------
// The four refusals
// ---------------------------------------------------------------------------

describe('no read receipt, anywhere', () => {
  test('no sentence on this surface mentions seeing, opening or reading', () => {
    assertNoneContain(['gezien', 'geopend', 'gelezen', 'bekeken', 'ontvangen']);
  });

  /**
   * The structural half of the same promise: a committed row is described
   * from the SENDER's own state machine and takes no reader input at all,
   * so there is nowhere for a receipt to enter even by accident.
   */
  test('the committed row says only that it was sent, never what happened next', () => {
    expect(describeSendRow({ ...SANNE, status: 'sent' }, false).actionLabel).toBe('Verstuurd');
  });
});

describe('no re-send celebration (PD-016 / sendRecipe upserts)', () => {
  /**
   * A re-send amends the one existing offer: `sentAt` does not move and
   * the recipient's `seen` is not reset. Nothing the sender sees may
   * suggest a second delivery happened.
   */
  test('a second successful send to the same friend reads exactly like the first', () => {
    const first = reduceSendSheet(
      reduceSendSheet(loaded(SANNE), { type: 'send-started', recipientProfileId: 'p-sanne' }),
      { type: 'send-succeeded', recipientProfileId: 'p-sanne' },
    );
    const firstLabel = describeSendRow(rowFor(first, 'p-sanne'), false).actionLabel;

    // Re-opening the sheet is the only route to a re-send; the row it
    // lands on must be indistinguishable from the first one.
    const reopened = reduceSendSheet(first, { type: 'load-succeeded', friends: [SANNE] });
    const second = reduceSendSheet(
      reduceSendSheet(reopened, { type: 'send-started', recipientProfileId: 'p-sanne' }),
      { type: 'send-succeeded', recipientProfileId: 'p-sanne' },
    );

    expect(describeSendRow(rowFor(second, 'p-sanne'), false).actionLabel).toBe(firstLabel);
    expect(describeSendAnnouncement('Sanne')).toBe('Verstuurd naar Sanne.');
  });

  test('no sentence claims a repeat delivery', () => {
    assertNoneContain(['opnieuw verstuurd', 'weer verstuurd', 'nogmaals', 'nog een keer']);
  });
});

describe('no cook gate (PD-016)', () => {
  /**
   * The gate was decided, built and then overruled. The most likely place
   * for it to come back is a sentence — a row explaining that you have to
   * cook something first restores the rule in the one place users read.
   */
  test('no sentence makes a cook sound like a precondition', () => {
    assertNoneContain(['gekookt', 'gemaakt', 'eerst koken']);
  });

  test('an idle row is sendable with no cook input in the model at all', () => {
    expect(describeSendRow({ ...SANNE, status: 'idle' }, false).actionable).toBe(true);
  });
});

describe('no recency and no counts', () => {
  test('no sentence dates a send or tallies one', () => {
    assertNoneContain(['gisteren', 'vandaag', 'zojuist', 'keer', 'laatst']);
  });
});

// ---------------------------------------------------------------------------
// The empty state must be true — and what "true" is has changed
// ---------------------------------------------------------------------------

describe('the empty friend list', () => {
  test('says §4.1 sentence, verbatim', () => {
    expect(SEND_NO_FRIENDS_TITLE).toBe('Nog geen vrienden om naar te sturen.');
  });

  /**
   * THIS TEST USED TO ASSERT THE OPPOSITE, and the flip is the point.
   * §4.1 pairs the title above with a secondary `Vriend toevoegen` button
   * pointing at §4.4. That screen did not exist, so the body stated the
   * limitation ("kan nog niet") and the button was not rendered — sending
   * someone to a route that does not exist is worse than saying nothing.
   *
   * `/friends/add` exists now, and the sheet renders the button, so the old
   * sentence had become false. What this pair of assertions protects is the
   * property that survived the change: the body describes the door that is
   * actually there. It must not promise a future one, and it must not go
   * back to denying a present one.
   */
  test('no longer denies a door that now exists', () => {
    expect(SEND_NO_FRIENDS_BODY.toLowerCase()).not.toContain('kan nog niet');
    expect(SEND_NO_FRIENDS_BODY.toLowerCase()).not.toContain('zodra dat kan');
  });

  /**
   * It names the mechanism rather than the control. §4.4's whole shape is
   * "you know someone's handle because they told you" — no search, no
   * contact upload, no suggestions — so the one sentence that introduces
   * the flow has to say a gebruikersnaam is what it takes.
   */
  test('says how a friend is actually added', () => {
    expect(SEND_NO_FRIENDS_BODY.toLowerCase()).toContain('gebruikersnaam');
  });
});

describe('the sheet chrome', () => {
  test('the note placeholder is §4.1 verbatim', () => {
    expect(SEND_NOTE_PLACEHOLDER).toBe('Schrijf er iets bij (mag)');
  });

  /**
   * §3.1's first entry point. It lives in this module rather than beside
   * the rating copy so the four vocabulary scans above cover it too —
   * "Stuur door, want je hebt het gemaakt" is exactly the sentence PD-016
   * would come back through.
   */
  test('OutcomeCard offers the send in §3.1 wording', () => {
    expect(OUTCOME_SEND_LABEL).toBe('Stuur door');
    expect(OUTCOME_SEND_ACCESSIBILITY_LABEL).toContain('vriend');
  });
});

/**
 * "Vriend toevoegen" — the handle exchange's copy and its two pure rules
 * (src/components/addFriendCopy.ts), DESIGN-SOCIAL.md §4.4 and §5.
 *
 * WHY THIS FILE EXISTS AT ALL, given the screen is a route module. It is a
 * route module, and that is exactly the problem: nothing under src/app can
 * be imported by vitest (expo-router drags react-native's package internals
 * through the SSR graph and the import dies with a SyntaxError). So every
 * sentence and every decision the screen makes lives in a module beside it
 * and is asserted here — the same split friendProof.ts and the `*Copy.ts`
 * modules already use.
 *
 * WHAT IS ACTUALLY AT STAKE IN EACH BLOCK BELOW:
 *
 *   1. §4.4's REFUSALS. "No search-by-name, no contact-book upload, no
 *      suggestions." Those are absences, and an absence is only enforceable
 *      if something sweeps the strings — otherwise the first person asked
 *      to "make it easier to find friends" adds a sentence and no test
 *      notices. The vocabulary scans below run over every exported string
 *      AND every rendered outcome, so a constant added later is covered
 *      without anyone extending a list.
 *   2. §4.4's "no red badges; an open request is a fact, not an alarm."
 *      Same shape of promise, same kind of scan.
 *   3. THE TRANSITION TABLE IS NOT RE-DERIVED. `planFriendRequest` asks
 *      `applyFriendshipAction` rather than reimplementing "may I ask this
 *      person?", and the test proves the two agree on every state — because
 *      a second copy of that table is precisely what src/domain/social/
 *      friendship.ts's header exists to prevent.
 *   4. §5's "asked once, not campaigned". `shouldAskCookSharing` is the one
 *      predicate standing between a one-time consent question and a
 *      recurring one, and it is pinned from both sides: it says yes exactly
 *      once, and both of its two guards independently say no.
 *   5. A BLOCK NAMES NO REASON. Telling someone they have been blocked is a
 *      disclosure the blocker never agreed to, so the refusal copy has to
 *      be indistinguishable from an ordinary "this cannot be sent".
 */

import { describe, expect, test } from 'vitest';
import * as addFriendCopy from '@/components/addFriendCopy';
import {
  ACCEPT_REQUEST_LABEL,
  ADD_FRIEND_ENTRY_LABEL,
  ADD_FRIEND_ROUTE,
  COOK_SHARING_ASK_FAILED,
  DECLINE_REQUEST_LABEL,
  HANDLE_INPUT_PLACEHOLDER,
  OUTGOING_REQUEST_STATUS,
  OWN_HANDLE_EXPLAINER,
  PARTY_NAME_UNAVAILABLE,
  SEND_REQUEST_LABEL,
  describeAcceptedFriend,
  describeAddFriendOutcome,
  describeIncomingRequest,
  describeOutgoingRequest,
  describeParty,
  formatHandle,
  partitionFriendships,
  planFriendRequest,
  shouldAskCookSharing,
  type AddFriendOutcome,
} from '@/components/addFriendCopy';
import { applyFriendshipAction, resolveActorRole } from '@/domain/social/friendship';
import type { Friendship, FriendshipStatus } from '@/domain/social/types';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeFriendship, makeProfile } from './social/fixtures';

/** The reader, throughout. Every rule here is stated from one side of the pair. */
const ME = PROFILE_A;

function pairWith(other: string, status: FriendshipStatus, iAmRequester: boolean): Friendship {
  return makeFriendship({
    id: `friendship-${other}-${status}`,
    requesterId: iAmRequester ? ME : other,
    addresseeId: iAmRequester ? other : ME,
    status,
    respondedAt: status === 'pending' ? null : '2026-01-02T00:00:00.000Z',
    blockedBy: status === 'blocked' ? other : null,
  });
}

/**
 * Every exported string constant, so a scan cannot be outgrown by a new
 * one. Widened to `unknown` first: `Object.values` over a module namespace
 * gives a union of literal types and functions, which a `value is string`
 * predicate cannot narrow from.
 */
function everyExportedSentence(): readonly string[] {
  const exported: readonly unknown[] = Object.values(addFriendCopy);
  return exported.filter((value): value is string => typeof value === 'string');
}

const EVERY_OUTCOME: readonly AddFriendOutcome[] = [
  'invalid-handle',
  'not-found',
  'self',
  'sent',
  'awaiting-them',
  'awaiting-you',
  'already-friends',
  'blocked',
  'failed',
];

/** Every sentence the module can produce: constants and rendered messages alike. */
function everySentence(): readonly string[] {
  return [
    ...everyExportedSentence(),
    ...EVERY_OUTCOME.map((outcome) => describeAddFriendOutcome(outcome, 'pieter').text),
  ];
}

function assertNoneContain(banned: readonly string[]): void {
  for (const sentence of everySentence()) {
    for (const word of banned) {
      expect(sentence.toLowerCase()).not.toContain(word);
    }
  }
}

// ---------------------------------------------------------------------------
// The route, which is the one string two other surfaces depend on
// ---------------------------------------------------------------------------

describe('the route', () => {
  /**
   * Pinned because TWO entry points navigate to it — the Vrienden tab
   * header and the Sturen sheet's empty state — and a screen reachable
   * from one of them only is the bug this constant exists to make
   * impossible. It lives beside the copy rather than in either caller for
   * exactly that reason.
   */
  test('is one constant both entry points can import', () => {
    expect(ADD_FRIEND_ROUTE).toBe('/friends/add');
  });

  test('the entry-point label is §4.1 and §4.2 verbatim', () => {
    expect(ADD_FRIEND_ENTRY_LABEL).toBe('Vriend toevoegen');
  });
});

// ---------------------------------------------------------------------------
// §4.4's chrome
// ---------------------------------------------------------------------------

describe('the screen states your own handle before it asks for anyone else’s', () => {
  test('the explainer is §4.4 verbatim', () => {
    expect(OWN_HANDLE_EXPLAINER).toBe('Zo vinden vrienden jou.');
  });

  test('the input placeholder and primary are §4.4 verbatim', () => {
    expect(HANDLE_INPUT_PLACEHOLDER).toBe('@handle van een vriend');
    expect(SEND_REQUEST_LABEL).toBe('Verstuur verzoek');
  });

  test('the two answers to an incoming request are §4.4 verbatim', () => {
    expect(ACCEPT_REQUEST_LABEL).toBe('Accepteren');
    expect(DECLINE_REQUEST_LABEL).toBe('Weigeren');
  });

  /** §4.4: outgoing is "a mono `wacht` state" — a fact, never a button. */
  test('an outgoing request is a state word, not an action', () => {
    expect(OUTGOING_REQUEST_STATUS).toBe('wacht');
  });

  test('a handle is drawn with its @, from whatever was typed', () => {
    expect(formatHandle('sanne')).toBe('@sanne');
    expect(formatHandle('  @Sanne ')).toBe('@sanne');
  });
});

// ---------------------------------------------------------------------------
// Who may be asked, and by whom — the transition table, not a second copy
// ---------------------------------------------------------------------------

describe('planning a request never re-derives the transition table', () => {
  test('no row yet: the request is sent', () => {
    expect(planFriendRequest(null, ME)).toEqual({ action: 'request' });
  });

  /**
   * Decision 2 in friendship.ts: `declined` is not terminal, because the
   * unique pair means a declined row IS the pair and a tombstone would make
   * one "no" permanent for both people forever.
   */
  test('a declined pair may be re-opened from either side', () => {
    expect(planFriendRequest(pairWith(PROFILE_B, 'declined', true), ME)).toEqual({ action: 'request' });
    expect(planFriendRequest(pairWith(PROFILE_B, 'declined', false), ME)).toEqual({ action: 'request' });
  });

  test('my own open request says it is already open, not that something failed', () => {
    expect(planFriendRequest(pairWith(PROFILE_B, 'pending', true), ME)).toEqual({
      action: 'none',
      outcome: 'awaiting-them',
    });
  });

  /**
   * The asymmetry that matters most on this screen: the same
   * `already_pending` rejection means two completely different things, and
   * only one of them has a button waiting for it further down the page.
   */
  test('their open request points me at the accept below, rather than refusing me', () => {
    expect(planFriendRequest(pairWith(PROFILE_B, 'pending', false), ME)).toEqual({
      action: 'none',
      outcome: 'awaiting-you',
    });
    expect(describeAddFriendOutcome('awaiting-you', 'pieter').text.toLowerCase()).toContain('accepteren');
  });

  test('an accepted pair says so', () => {
    expect(planFriendRequest(pairWith(PROFILE_B, 'accepted', true), ME)).toEqual({
      action: 'none',
      outcome: 'already-friends',
    });
  });

  test('a blocked pair is refused whichever side blocked', () => {
    expect(planFriendRequest(pairWith(PROFILE_B, 'blocked', true), ME)).toEqual({ action: 'none', outcome: 'blocked' });
    expect(planFriendRequest(pairWith(PROFILE_B, 'blocked', false), ME)).toEqual({ action: 'none', outcome: 'blocked' });
  });

  /**
   * The property that makes this a plan and not a second rule book: for
   * every state and both roles, "the plan sends a request" is exactly
   * "`applyFriendshipAction` says the request is legal". If the two ever
   * disagree, the screen would either offer a move the repository rejects
   * or withhold one it would have accepted.
   */
  test('the plan agrees with applyFriendshipAction on every state and both roles', () => {
    const states: readonly FriendshipStatus[] = ['pending', 'accepted', 'declined', 'blocked'];
    for (const status of states) {
      for (const iAmRequester of [true, false]) {
        const existing = pairWith(PROFILE_B, status, iAmRequester);
        const legal = applyFriendshipAction({
          from: status,
          action: 'request',
          actor: resolveActorRole(existing, ME),
        }).ok;

        expect(planFriendRequest(existing, ME).action === 'request').toBe(legal);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// What each outcome says out loud
// ---------------------------------------------------------------------------

describe('every outcome is a sentence a person can act on', () => {
  test('a sent request names who it went to, in the stored spelling', () => {
    const message = describeAddFriendOutcome('sent', '@Pieter');

    expect(message.text).toBe('Verzoek verstuurd naar @pieter.');
    expect(message.tone).toBe('ok');
  });

  test('an unknown handle says nobody was found, and does not blame the typist', () => {
    const message = describeAddFriendOutcome('not-found', 'pieter');

    expect(message.text).toContain('@pieter');
    expect(message.tone).toBe('notice');
  });

  test('an unstorable handle repeats the rule rather than the failure', () => {
    const message = describeAddFriendOutcome('invalid-handle', 'PIE');

    expect(message.text).toContain('3');
    expect(message.text).toContain('30');
    expect(message.tone).toBe('notice');
  });

  test('your own handle is answered plainly', () => {
    expect(describeAddFriendOutcome('self', 'joost').text).toBe('Dat ben je zelf.');
  });

  test('a failed write says nothing was sent', () => {
    const message = describeAddFriendOutcome('failed', 'pieter');

    expect(message.tone).toBe('error');
    expect(message.text.toLowerCase()).toContain('niets verstuurd');
  });

  /**
   * A block is not disclosed, in either direction. Telling the blocked
   * person they were blocked hands them a fact the blocker never agreed to
   * share; telling the blocker their own block is in the way is harmless
   * but indistinguishable, so both get the same quiet sentence.
   */
  test('a block names no reason and no party', () => {
    const message = describeAddFriendOutcome('blocked', 'pieter');

    expect(message.text.toLowerCase()).not.toContain('blok');
    expect(message.text.toLowerCase()).not.toContain('geweigerd');
    expect(message.tone).toBe('notice');
  });

  test('every outcome produces a non-empty sentence', () => {
    for (const outcome of EVERY_OUTCOME) {
      expect(describeAddFriendOutcome(outcome, 'pieter').text.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// The three lists
// ---------------------------------------------------------------------------

describe('friendships split into the three lists §4.4 renders', () => {
  const incoming = pairWith(PROFILE_B, 'pending', false);
  const outgoing = pairWith(PROFILE_C, 'pending', true);
  const accepted = pairWith(PROFILE_B, 'accepted', true);
  const acceptedOther = pairWith(PROFILE_C, 'accepted', false);

  test('an unanswered request addressed to me is incoming', () => {
    const lists = partitionFriendships([incoming, outgoing], ME);

    expect(lists.incoming.map((row) => row.profileId)).toEqual([PROFILE_B]);
  });

  test('an unanswered request I opened is outgoing', () => {
    const lists = partitionFriendships([incoming, outgoing], ME);

    expect(lists.outgoing.map((row) => row.profileId)).toEqual([PROFILE_C]);
  });

  test('accepted counts from both sides of the row', () => {
    const lists = partitionFriendships([accepted, acceptedOther], ME);

    expect(lists.accepted.map((row) => row.profileId)).toEqual([PROFILE_B, PROFILE_C]);
  });

  /**
   * Declined and blocked rows exist and are read back by
   * `listFriendships`, and neither belongs on a screen: a declined pair is
   * re-requestable and so is indistinguishable from no row at all, and a
   * blocked one must never be listed anywhere the blocked person could
   * infer it.
   */
  test('declined and blocked rows appear in none of the three lists', () => {
    const lists = partitionFriendships(
      [pairWith(PROFILE_B, 'declined', true), pairWith(PROFILE_C, 'blocked', false)],
      ME,
    );

    expect(lists.incoming).toEqual([]);
    expect(lists.outgoing).toEqual([]);
    expect(lists.accepted).toEqual([]);
  });

  /**
   * `collectAcceptedFriendIds` documents the same guard and the same
   * reason: 0007_social.sql's CHECK refuses a self-pair, but if one ever
   * existed the reader would appear in their own friend list and be
   * offered to themselves.
   */
  test('a self-pair is dropped rather than listing the reader as their own friend', () => {
    const lists = partitionFriendships([makeFriendship({ requesterId: ME, addresseeId: ME })], ME);

    expect(lists.accepted).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// One row
// ---------------------------------------------------------------------------

describe('a row names the person, or says it could not', () => {
  const sanne = makeProfile({ id: PROFILE_B, handle: 'sanne', displayName: 'Sanne' });

  test('a resolved profile becomes a name and a handle', () => {
    expect(describeParty(PROFILE_B, sanne)).toEqual({
      profileId: PROFILE_B,
      displayName: 'Sanne',
      handleLabel: '@sanne',
    });
  });

  /**
   * `profiles_select` grants every authenticated reader every row, so a
   * null here is a deleted account racing the read rather than a
   * permission. The row still renders and stays actionable: an incoming
   * request you can never answer is worse than one whose name did not load.
   */
  test('an unreadable profile still yields a row that can be answered', () => {
    const party = describeParty(PROFILE_B, null);

    expect(party.displayName).toBe(PARTY_NAME_UNAVAILABLE);
    expect(party.handleLabel).toBe('');
    expect(describeIncomingRequest(PROFILE_B, null).acceptAccessibilityLabel).toContain(PARTY_NAME_UNAVAILABLE);
  });

  test('an incoming row speaks both answers separately', () => {
    const row = describeIncomingRequest(PROFILE_B, sanne);

    expect(row.accessibilityLabel).toContain('Sanne');
    expect(row.acceptAccessibilityLabel).toBe('Accepteren: Sanne, @sanne');
    expect(row.declineAccessibilityLabel).toBe('Weigeren: Sanne, @sanne');
  });

  test('an outgoing row is spoken as a state, with no action in the label', () => {
    const row = describeOutgoingRequest(
      PROFILE_C,
      makeProfile({ id: PROFILE_C, handle: 'pieter', displayName: 'Pieter' }),
    );

    expect(row.statusLabel).toBe('wacht');
    expect(row.accessibilityLabel).toBe('Verzoek aan Pieter, @pieter: wacht op antwoord.');
  });

  test('an accepted row is just the person', () => {
    expect(describeAcceptedFriend(PROFILE_B, sanne).accessibilityLabel).toBe('Sanne, @sanne');
  });
});

// ---------------------------------------------------------------------------
// §5's one-time ask
// ---------------------------------------------------------------------------

describe('the cook-proof question is asked once, not campaigned', () => {
  /** §5: "offered once, contextually, when the household's first friendship is accepted". */
  test('the first accepted friendship, never asked before, raises it', () => {
    expect(shouldAskCookSharing({ acceptedFriendCount: 1, alreadyAsked: false })).toBe(true);
  });

  test('having been asked already settles it, whatever the count', () => {
    expect(shouldAskCookSharing({ acceptedFriendCount: 1, alreadyAsked: true })).toBe(false);
  });

  /**
   * The second guard, and the one that holds inside a single session before
   * `markHouseholdCookSharingAsked` has had a chance to land: the second
   * accept is not the first friendship, so it cannot re-raise the sheet
   * even if the flag write failed.
   */
  test('a second friendship is not a first one', () => {
    expect(shouldAskCookSharing({ acceptedFriendCount: 2, alreadyAsked: false })).toBe(false);
  });

  test('no accepted friendship asks nothing', () => {
    expect(shouldAskCookSharing({ acceptedFriendCount: 0, alreadyAsked: false })).toBe(false);
  });

  /**
   * The sheet asks once and does not come back, so a consent whose write
   * failed has no second sheet to land on. The only honest repair is to say
   * so and name the other way in — a household that believes it is sharing
   * and is not is the worst outcome this flow can produce.
   */
  test('a failed opt-in write names Instellingen as the way in', () => {
    expect(COOK_SHARING_ASK_FAILED).toContain('Instellingen');
    expect(COOK_SHARING_ASK_FAILED.toLowerCase()).toContain('lukte niet');
  });
});

// ---------------------------------------------------------------------------
// §4.4's recorded refusals, swept over every sentence
// ---------------------------------------------------------------------------

describe('the graph is built by handle exchange and by nothing else', () => {
  /**
   * §4.4: "No search-by-name, no contact-book upload, no suggestions." §7
   * repeats the contact-book half as a standing refusal rather than a
   * backlog item. These are absences, so this scan is what enforces them:
   * the first sentence promising to find people for you is the first brick
   * of the surface this screen refuses to be.
   */
  test('no sentence offers contacts, suggestions or a name search', () => {
    assertNoneContain([
      'contact',
      'adresboek',
      'telefoonboek',
      'suggest',
      'aanbevel',
      'misschien ken je',
      'mensen die je kent',
      'zoek op naam',
      'importeer',
    ]);
  });

  /** §4.4: "No red badges; an open request is a fact, not an alarm." */
  test('no sentence raises an alarm about an open request', () => {
    assertNoneContain(['let op', 'waarschuwing', 'dringend', 'actie vereist', '!']);
  });

  /**
   * The rule this whole product keeps: nothing on a social surface is
   * ordered by, or dated with, recency. A request that says "gisteren" is
   * a request that ages, and an ageing request is a reason to come back.
   */
  test('no sentence dates a request', () => {
    assertNoneContain(['gisteren', 'vandaag', 'zojuist', 'laatst', 'dagen geleden']);
  });
});

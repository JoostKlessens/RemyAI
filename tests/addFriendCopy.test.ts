/**
 * "Vriend toevoegen" — the handle exchange's copy and its two pure rules
 * (src/components/addFriendCopy.ts), DESIGN-SOCIAL.md §4.4 and §5, after
 * PD-024 made the graph directed.
 *
 * WHY THIS FILE EXISTS AT ALL, given the screen is a route module. It is a
 * route module, and that is exactly the problem: nothing under src/app can
 * be imported by vitest (expo-router drags react-native's package internals
 * through the SSR graph and the import dies with a SyntaxError). So every
 * sentence and every decision the screen makes lives in a module beside it
 * and is asserted here — the same split friendProof.ts and the `*Copy.ts`
 * modules already use. Its composition sibling is covered by
 * tests/addFriendLists.test.ts.
 *
 * WHAT IS ACTUALLY AT STAKE IN EACH BLOCK BELOW:
 *
 *   1. §4.4's REFUSALS. "No search-by-name, no contact-book upload, no
 *      suggestions." Those are absences, and an absence is only enforceable
 *      if something sweeps the strings — otherwise the first person asked
 *      to "make it easier to find friends" adds a sentence and no test
 *      notices. The vocabulary scans below run over every exported string
 *      AND every rendered sentence, so a constant added later is covered
 *      without anyone extending a list. ⚠ PD-024 DOES NOT RELAX THIS: a
 *      directed graph makes a people-search more tempting, not less, and
 *      whether one ever lands is O-4 and fase 6.
 *   2. §4.4's "no red badges; an open request is a fact, not an alarm."
 *      Same shape of promise, same kind of scan.
 *   3. ⚠ NO SENTENCE PROMISES A FRIENDSHIP FOR A ONE-WAY GRANT. This is the
 *      block PD-024 added, and it is the one with real consequences. An
 *      accepted follow does not make two people friends; it lets one person
 *      see what the other cooks. Copy that still said "vriendschapsverzoek"
 *      would take a consent for something the reader was never asked about,
 *      so the outcome sentences are swept for the word and the explainer is
 *      pinned to say both halves of what `Accepteren` does.
 *   4. THE TRANSITION TABLE IS NOT RE-DERIVED. `planFollowRequest` asks
 *      `applyFollowAction` rather than reimplementing "may I ask this
 *      person?", and the test proves the two agree on every state and with
 *      a block standing either way — because a second copy of that table is
 *      precisely what src/domain/social/follow.ts's header exists to
 *      prevent.
 *   5. §5's "asked once, not campaigned". `shouldAskCookSharing` is the one
 *      predicate standing between a one-time consent question and a
 *      recurring one, and it is pinned from both sides: it says yes exactly
 *      once, and both of its two guards independently say no.
 *   6. A BLOCK NAMES NO REASON. Telling someone they have been blocked is a
 *      disclosure the blocker never agreed to, so the refusal copy has to
 *      be indistinguishable from an ordinary "this cannot be sent" — and
 *      after PD-024 that has to hold for the BLOCKER and the BLOCKED alike,
 *      which is asserted by comparing the two outputs rather than by
 *      reading them.
 */

import { describe, expect, test } from 'vitest';
import * as addFriendCopy from '@/components/addFriendCopy';
import {
  ACCEPT_REQUEST_LABEL,
  ADD_FRIEND_ENTRY_LABEL,
  ADD_FRIEND_ROUTE,
  COOK_SHARING_ASK_FAILED,
  DECLINE_REQUEST_LABEL,
  FOLLOWERS_SECTION_LABEL,
  FOLLOWING_SECTION_LABEL,
  HANDLE_INPUT_PLACEHOLDER,
  OUTGOING_REQUEST_STATUS,
  OWN_HANDLE_EXPLAINER,
  PARTY_NAME_UNAVAILABLE,
  REQUESTS_EXPLAINER,
  REQUESTS_SECTION_LABEL,
  SEND_REQUEST_LABEL,
  describeAddFriendOutcome,
  describeFollowParty,
  describeIncomingRequest,
  describeOutgoingRequest,
  describeParty,
  formatHandle,
  planFollowRequest,
  shouldAskCookSharing,
  type AddFriendOutcome,
} from '@/components/addFriendCopy';
import { applyFollowAction, resolveFollowActorRole } from '@/domain/social/follow';
import type { Block, Follow, FollowStatus, ProfileId } from '@/domain/social/types';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeProfile } from './social/fixtures';

/** The reader, throughout. Every rule here is stated from one side of the pair. */
const ME = PROFILE_A;
const THEM = PROFILE_B;

const T0 = '2026-01-01T00:00:00.000Z';
const T1 = '2026-01-02T00:00:00.000Z';

/**
 * Built here rather than in tests/social/fixtures.ts because that file is
 * shared by the whole social suite, and a `makeFollow` belongs beside the
 * other directed-graph builders in tests/social/follow.test.ts rather than
 * in a copy test. Two small literals cost less than a shared builder two
 * files would then want to pull in different directions.
 */
function followFromMe(status: FollowStatus): Follow {
  return {
    id: `follow-${status}`,
    followerId: ME,
    followeeId: THEM,
    status,
    createdAt: T0,
    // A pending row is an unanswered question and carries no answer date —
    // the invariant `followSurvivesBlocks` compares against a block.
    respondedAt: status === 'pending' ? null : T1,
  };
}

function standingBlock(blockerId: ProfileId, blockedId: ProfileId): Block {
  return { id: `block-${blockerId}`, blockerId, blockedId, blockedAt: T1, liftedAt: null };
}

const NO_BLOCKS: readonly Block[] = [];

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
  'already-following',
  'blocked',
  'failed',
];

/** Every sentence an attempted request can produce. */
function everyOutcomeSentence(): readonly string[] {
  return EVERY_OUTCOME.map((outcome) => describeAddFriendOutcome(outcome, 'pieter').text);
}

/**
 * Every sentence the module can produce: constants, rendered outcomes, and
 * — new with PD-024 — every row's spoken label, because the four buckets
 * are where a promise about "vrienden" would now most plausibly reappear.
 */
function everySentence(): readonly string[] {
  const sanne = makeProfile({ id: THEM, handle: 'sanne', displayName: 'Sanne' });

  return [
    ...everyExportedSentence(),
    ...everyOutcomeSentence(),
    describeIncomingRequest(THEM, sanne).accessibilityLabel,
    describeOutgoingRequest(THEM, sanne).accessibilityLabel,
    describeFollowParty(THEM, sanne, 'follower').accessibilityLabel,
    describeFollowParty(THEM, sanne, 'followee').accessibilityLabel,
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
   * Pinned because SEVERAL entry points navigate to it, none of which can
   * import each other, and a screen reachable from only some of them is
   * the bug this constant exists to make impossible.
   */
  test('is one constant every entry point can import', () => {
    expect(ADD_FRIEND_ROUTE).toBe('/friends/add');
  });

  /**
   * §4.1's label, and §4.2's until the header control was removed. It is
   * still the word on the Sturen sheet and on the Vrienden empty state.
   *
   * ⚠ IT KEEPS THE WORD "VRIEND" AFTER PD-024, AND THAT IS A DECISION
   * RATHER THAN AN OVERSIGHT. addFriendCopy.ts's header states the rule: a
   * string naming the ACT changed, a string naming the DESTINATION did not.
   * The Sturen sheet pushes this screen because a send needs a MUTUAL pair,
   * so "Vriend toevoegen" is exactly what that reader came to do.
   */
  test('the entry-point label is §4.1 verbatim, and still says vriend on purpose', () => {
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

  test('the input placeholder is §4.4 verbatim', () => {
    expect(HANDLE_INPUT_PLACEHOLDER).toBe('@handle van een vriend');
  });

  /**
   * ⚠ ~~`Verstuur verzoek`~~, WHICH WAS §4.4 VERBATIM AND IS PINNED HERE AS
   * CHANGED. This is the control that performs the act, so it is the one
   * string on the screen that must name the act exactly — and after PD-024
   * "verzoek" covers two shapes the reader cannot otherwise tell apart: the
   * one-way grant this button sends, and the mutual relationship they may
   * believe they are asking for. The word matches `formatPendingRequests`
   * in friendSuggestionCopy.ts deliberately: two surfaces naming one act
   * differently is how a reader concludes they are two acts.
   */
  test('the primary names the act it performs, which is a follow request', () => {
    expect(SEND_REQUEST_LABEL).toBe('Verstuur volgverzoek');
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

  /**
   * The three section headings, pinned because they are the only thing on
   * screen that says which of the two accepted lists a row is in — and
   * because losing one of them would be the silent way back to a single
   * "VRIENDEN" list that hides the asymmetry.
   */
  test('the three sections are named for what they hold', () => {
    expect(REQUESTS_SECTION_LABEL).toBe('VOLGVERZOEKEN');
    expect(FOLLOWING_SECTION_LABEL).toBe('JIJ VOLGT');
    expect(FOLLOWERS_SECTION_LABEL).toBe('VOLGEN JOU');
  });
});

// ---------------------------------------------------------------------------
// ⚠ The consent the reader is actually giving
// ---------------------------------------------------------------------------

describe('accepting a request says what it hands over, and what it does not', () => {
  /**
   * The single most consequential sentence on the screen. `Accepteren` now
   * grants one named person sight of this household's cooking and creates
   * nothing in the other direction, and neither half is guessable from the
   * button. Both halves are asserted, because dropping either turns an
   * informed consent back into a guess: without the first the reader does
   * not know what they gave, and without the second they may decline
   * requests they would have accepted, believing they are being signed up
   * to follow back.
   */
  test('the explainer states both the grant and the freedom', () => {
    expect(REQUESTS_EXPLAINER.toLowerCase()).toContain('ziet wat jij kookt');
    expect(REQUESTS_EXPLAINER.toLowerCase()).toContain('terugvolgt');
  });

  /**
   * ⚠ THE OVER-PROMISE SWEEP. Every sentence produced by attempting a
   * request is checked for the word "vriend" in any form. None of them may
   * use it: the outcome of a follow request is a follow, and a sentence
   * calling it a friendship would describe a second row this code never
   * read. The exported constants are deliberately NOT swept this way —
   * `ADD_FRIEND_ENTRY_LABEL` and `ADD_FRIEND_TITLE` keep the word on
   * purpose (see the route block above) — which is exactly why this scan is
   * aimed at the outcomes rather than at everything.
   */
  test('no outcome of a request calls the result a friendship', () => {
    for (const sentence of everyOutcomeSentence()) {
      expect(sentence.toLowerCase()).not.toContain('vriend');
    }
  });

  /** And nowhere at all is the old name for the act allowed back. */
  test('nothing anywhere says vriendschapsverzoek', () => {
    assertNoneContain(['vriendschap']);
  });
});

// ---------------------------------------------------------------------------
// Who may be asked — the transition table, not a second copy
// ---------------------------------------------------------------------------

describe('planning a follow request never re-derives the transition table', () => {
  test('no row yet: the request is sent', () => {
    expect(planFollowRequest(null, NO_BLOCKS, ME, THEM)).toEqual({ action: 'request' });
  });

  /**
   * follow.ts's decision 2, and ⚠ ITS REASON IS NOT friendship.ts's REASON.
   * The follower owns their own row and may drop it, so a terminal
   * 'declined' would cost a statement and prevent nothing: they could
   * delete and re-insert to reach an indistinguishable state.
   */
  test('a declined row may be re-opened by the follower', () => {
    expect(planFollowRequest(followFromMe('declined'), NO_BLOCKS, ME, THEM)).toEqual({ action: 'request' });
  });

  test('my own open request says it is already open, not that something failed', () => {
    expect(planFollowRequest(followFromMe('pending'), NO_BLOCKS, ME, THEM)).toEqual({
      action: 'none',
      outcome: 'awaiting-them',
    });
  });

  /**
   * ⚠ THE ASYMMETRY THAT USED TO LIVE HERE IS GONE, AND ITS ABSENCE IS THE
   * POINT. Under `friendships`, `already_pending` meant either "your
   * request is open" or "they asked YOU", because one row served both. A
   * directed row cannot mean the second: `getFollowBetween(me, them)`
   * returns only the row pointing from me, and a request they sent is a
   * different row this plan never sees. So `already_pending` has exactly
   * one meaning now, and the old `'awaiting-you'` outcome is not merely
   * unused — it would refuse a move the domain permits, which is precisely
   * the "en als je wil terugvolgen" the owner asked for.
   */
  test('their request is a different row, so mine is still sendable', () => {
    const theirRequest: Follow = { ...followFromMe('pending'), id: 'theirs', followerId: THEM, followeeId: ME };

    // The row above is the one `getFollowBetween(me, them)` would NOT
    // return; the plan is asked the question the screen actually asks — my
    // own direction, where there is no row — and answers "send it".
    expect(theirRequest.followerId).toBe(THEM);
    expect(planFollowRequest(null, NO_BLOCKS, ME, THEM)).toEqual({ action: 'request' });
  });

  test('a row I already follow on says so, without claiming they follow back', () => {
    expect(planFollowRequest(followFromMe('accepted'), NO_BLOCKS, ME, THEM)).toEqual({
      action: 'none',
      outcome: 'already-following',
    });
    expect(describeAddFriendOutcome('already-following', 'pieter').text).toBe('Je volgt @pieter al.');
  });

  /**
   * ⚠ THE INDISTINGUISHABILITY PROOF, and it is written as a COMPARISON
   * rather than as two readings, because the property is that the two are
   * the SAME rather than that each looks innocuous on its own. A block
   * refuses the move whichever side made it — `isBlockStanding` is
   * direction-insensitive — so the plan and the sentence come out
   * identical, and the blocked person learns nothing by comparing notes
   * with the blocker.
   */
  test('a block refuses identically whichever side blocked, with no row at all', () => {
    const iBlockedThem = planFollowRequest(null, [standingBlock(ME, THEM)], ME, THEM);
    const theyBlockedMe = planFollowRequest(null, [standingBlock(THEM, ME)], ME, THEM);

    expect(iBlockedThem).toEqual({ action: 'none', outcome: 'blocked' });
    expect(theyBlockedMe).toEqual(iBlockedThem);
  });

  /** A block also refuses over a row that already exists, in both directions. */
  test('a block outranks whatever row was there', () => {
    for (const status of ['pending', 'accepted', 'declined'] as const) {
      expect(planFollowRequest(followFromMe(status), [standingBlock(THEM, ME)], ME, THEM)).toEqual({
        action: 'none',
        outcome: 'blocked',
      });
    }
  });

  /** A block that has been lifted restores the ability to ask, and only that. */
  test('a lifted block no longer refuses a fresh request', () => {
    const lifted: Block = { ...standingBlock(THEM, ME), liftedAt: '2026-02-01T00:00:00.000Z' };

    expect(planFollowRequest(null, [lifted], ME, THEM)).toEqual({ action: 'request' });
  });

  /** A block between two OTHER people is not this pair's business. */
  test('somebody else’s block does not refuse this pair', () => {
    expect(planFollowRequest(null, [standingBlock(PROFILE_C, THEM)], ME, THEM)).toEqual({ action: 'request' });
  });

  /**
   * The property that makes this a plan and not a second rule book: for
   * every state, and with a block standing or not, "the plan sends a
   * request" is exactly "`applyFollowAction` says the request is legal". If
   * the two ever disagree, the screen would either offer a move the
   * repository rejects or withhold one it would have accepted.
   */
  test('the plan agrees with applyFollowAction on every state, blocked and not', () => {
    const states: readonly (FollowStatus | null)[] = [null, 'pending', 'accepted', 'declined'];
    for (const status of states) {
      for (const blocks of [NO_BLOCKS, [standingBlock(THEM, ME)]]) {
        const existing = status === null ? null : followFromMe(status);
        const legal = applyFollowAction({
          from: status,
          action: 'request',
          actor: resolveFollowActorRole(existing, ME),
          isBlocked: blocks.length > 0,
        }).ok;

        expect(planFollowRequest(existing, blocks, ME, THEM).action === 'request').toBe(legal);
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

    expect(message.text).toBe('Volgverzoek verstuurd naar @pieter.');
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
   * but indistinguishable, so both get the same quiet sentence — and it has
   * to read as an ordinary "not now" rather than as a refusal with a cause.
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

  /**
   * The row says WHICH KIND of request it is, because a listener hears the
   * row on its own with the section header long behind them.
   */
  test('an incoming row names the kind of request and speaks both answers separately', () => {
    const row = describeIncomingRequest(PROFILE_B, sanne);

    expect(row.accessibilityLabel).toBe('Volgverzoek van Sanne, @sanne.');
    expect(row.acceptAccessibilityLabel).toBe('Accepteren: Sanne, @sanne');
    expect(row.declineAccessibilityLabel).toBe('Weigeren: Sanne, @sanne');
  });

  test('an outgoing row is spoken as a state, with no action in the label', () => {
    const row = describeOutgoingRequest(
      PROFILE_C,
      makeProfile({ id: PROFILE_C, handle: 'pieter', displayName: 'Pieter' }),
    );

    expect(row.statusLabel).toBe('wacht');
    expect(row.accessibilityLabel).toBe('Volgverzoek aan Pieter, @pieter: wacht op antwoord.');
  });

  /**
   * ⚠ BOTH DIRECTIONS, PINNED BY SENTENCE. The reader's role is the only
   * thing that differs between the two accepted lists, and getting it
   * backwards would tell every reader the opposite of the truth about who
   * can see their cooking — in both lists at once, with nothing failing.
   */
  test('an accepted row says which way the follow points', () => {
    expect(describeFollowParty(PROFILE_B, sanne, 'follower').accessibilityLabel).toBe('Jij volgt Sanne, @sanne.');
    expect(describeFollowParty(PROFILE_B, sanne, 'followee').accessibilityLabel).toBe('Sanne, @sanne volgt jou.');
  });

  /**
   * A row says who somebody is and nothing about what following them
   * unlocks. Repeating the grant down a list would turn a list into a
   * warning, which is §4.4's "a fact, not an alarm" broken from the other
   * end.
   */
  test('an accepted row carries no claim about cooking or sending', () => {
    const spoken = describeFollowParty(PROFILE_B, sanne, 'followee').accessibilityLabel.toLowerCase();

    expect(spoken).not.toContain('kookt');
    expect(spoken).not.toContain('sturen');
  });
});

// ---------------------------------------------------------------------------
// §5's one-time ask
// ---------------------------------------------------------------------------

describe('the cook-proof question is asked once, not campaigned', () => {
  /**
   * ⚠ THE COUNT IS FOLLOWERS, NOT FOLLOWS. §5 discloses what this household
   * cooks, and the people it discloses to are the ones who follow. Counting
   * the other side would raise a consent sheet about an audience that does
   * not exist.
   */
  test('the first follower, never asked before, raises it', () => {
    expect(shouldAskCookSharing({ followerCount: 1, alreadyAsked: false })).toBe(true);
  });

  test('having been asked already settles it, whatever the count', () => {
    expect(shouldAskCookSharing({ followerCount: 1, alreadyAsked: true })).toBe(false);
  });

  /**
   * BROADENED FROM `=== 1` WHEN SHARING BECAME THE DEFAULT (0015), and
   * this test is that reversal written down.
   *
   * The old form could never ask a household that already had two or more
   * accepted grants — their first was in the past, and nothing raises this
   * sheet twice — so the households most likely to want the state the
   * product now calls standard were the only ones never offered it. "Asked
   * once, not campaigned" is enforced by `alreadyAsked`, which is unchanged
   * and is pinned from both sides here.
   */
  test('a household that already has followers is still asked, once', () => {
    expect(shouldAskCookSharing({ followerCount: 2, alreadyAsked: false })).toBe(true);
    expect(shouldAskCookSharing({ followerCount: 9, alreadyAsked: false })).toBe(true);
  });

  test('and having been asked shuts it for every count, which is what makes it once', () => {
    for (const followerCount of [0, 1, 2, 9]) {
      expect(shouldAskCookSharing({ followerCount, alreadyAsked: true })).toBe(false);
    }
  });

  test('no follower asks nothing', () => {
    expect(shouldAskCookSharing({ followerCount: 0, alreadyAsked: false })).toBe(false);
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
   *
   * ⚠ PD-024 MAKES THIS SWEEP MORE IMPORTANT, NOT LESS. A directed graph is
   * the shape people expect a search box beside; whether one ever lands is
   * O-4, it belongs to fase 6, and `findProfileByHandle` still does `.eq`.
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

  /**
   * ⚠ NO FOLLOWER COUNT, which is the refusal a directed graph makes
   * tempting for the first time. PD-024 and §8's "no trophy shelf" agree: a
   * follow is a gate, never a score on a person. `partitionFollows` refuses
   * it in the domain, addFriendLists.ts refuses it in the composition, and
   * this is the sweep that refuses it in the words.
   */
  test('no sentence counts followers at anybody', () => {
    assertNoneContain(['volgers:', 'aantal volgers', 'populair', 'meeste volgers']);
  });
});

/**
 * "Misschien ken je" — the ranking rules (src/domain/social/friendSuggestions.ts)
 * and the sentences that caption them (src/components/friendSuggestionCopy.ts).
 *
 * WHY THIS FILE EXISTS, given that 0019 does the actual sorting. Because
 * four of the things that can go wrong here are invisible to SQL:
 *
 *   1. THE CAPTION AGREEING WITH THE SORT. The function orders by mutual
 *      friends first; if `describeSuggestionReason` ever preferred the vote
 *      count, the list would be sorted by one number and captioned with
 *      another, and would read as shuffled. Nothing in the database can
 *      catch that.
 *   2. A SENTENCE CLAIMING A NUMBER THAT DOES NOT EXIST. The owner asked
 *      for "wie er veel recepten plaatst op de app", and no such count is
 *      derivable — see 0019's header and the copy module's. The activity
 *      line therefore has to say "beoordeelde", and the scan below is what
 *      keeps it saying that when somebody later "improves" the wording.
 *   3. THE MUTUAL COUNT NEVER BECOMING A LIST OF NAMES. 0007 refuses to
 *      let a reader enumerate anyone else's graph, and 0019 honours that by
 *      returning a count. The moment a sentence here says WHO, that refusal
 *      is gone — from the copy side, silently, with the migration
 *      unchanged.
 *   4. THE CAP. Three, because this is a footnote under a feed and not a
 *      people-you-may-know surface.
 */

import { describe, expect, test } from 'vitest';
import * as friendSuggestionCopy from '@/components/friendSuggestionCopy';
import {
  describeSuggestionAddAccessibilityLabel,
  describeSuggestionReasonText,
  formatPendingRequests,
} from '@/components/friendSuggestionCopy';
import {
  MAX_VISIBLE_SUGGESTIONS,
  describeSuggestionReason,
  selectFriendSuggestions,
  type SuggestedFriendRow,
} from '@/domain/social/friendSuggestions';

function row(overrides: Partial<SuggestedFriendRow> & { readonly profileId: string }): SuggestedFriendRow {
  return {
    handle: `handle_${overrides.profileId}`,
    displayName: `Naam ${overrides.profileId}`,
    mutualFriends: 0,
    publicVotes: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Which reason a row is shown for
// ---------------------------------------------------------------------------

describe('the reason a suggestion carries', () => {
  test('mutual friends win over activity, so the caption agrees with 0019 order', () => {
    // Arrange — one mutual friend against two hundred votes, the widest
    // margin the vote branch could ever claim.
    const candidate = row({ profileId: 'a', mutualFriends: 1, publicVotes: 200 });

    // Act
    const reason = describeSuggestionReason(candidate);

    // Assert
    expect(reason).toEqual({ kind: 'mutual-friends', count: 1 });
  });

  test('activity is the reason when there are no mutual friends', () => {
    expect(describeSuggestionReason(row({ profileId: 'a', publicVotes: 7 }))).toEqual({ kind: 'active', votes: 7 });
  });

  test('a row with neither has no reason and is not shown', () => {
    expect(describeSuggestionReason(row({ profileId: 'a' }))).toBeNull();
  });

  /**
   * These numbers arrive as JSON over a wire. `Number.NaN > 0` is false, so
   * a NaN mutual count falls through — and a NaN vote count would otherwise
   * render "Beoordeelde NaN recepten" beside somebody's real name.
   */
  test('a non-finite count is not a reason', () => {
    expect(describeSuggestionReason(row({ profileId: 'a', mutualFriends: Number.NaN }))).toBeNull();
    expect(describeSuggestionReason(row({ profileId: 'a', publicVotes: Number.NaN }))).toBeNull();
  });

  test('a negative count is not a reason either', () => {
    expect(describeSuggestionReason(row({ profileId: 'a', mutualFriends: -3, publicVotes: -1 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Selection: drop, dedupe, cap — and never re-sort
// ---------------------------------------------------------------------------

describe('choosing which suggestions to draw', () => {
  test('keeps the order it was given rather than re-deriving 0019 ranking', () => {
    // Arrange — deliberately "wrong" order for a client-side sort to fix:
    // the least-connected candidate is first.
    const rows = [
      row({ profileId: 'a', mutualFriends: 1 }),
      row({ profileId: 'b', mutualFriends: 9 }),
      row({ profileId: 'c', publicVotes: 4 }),
    ];

    // Act
    const chosen = selectFriendSuggestions(rows);

    // Assert — a second ranking here would be a second definition of one
    // order, and the two would agree until somebody changed one of them.
    expect(chosen.map((suggestion) => suggestion.profileId)).toEqual(['a', 'b', 'c']);
  });

  test('drops a candidate that cannot say why it is a suggestion', () => {
    const chosen = selectFriendSuggestions([row({ profileId: 'a' }), row({ profileId: 'b', publicVotes: 2 })]);

    expect(chosen.map((suggestion) => suggestion.profileId)).toEqual(['b']);
  });

  test('never offers the same person twice', () => {
    const chosen = selectFriendSuggestions([
      row({ profileId: 'a', mutualFriends: 2 }),
      row({ profileId: 'a', mutualFriends: 2 }),
    ]);

    expect(chosen).toHaveLength(1);
  });

  test('caps at three, because this is a footnote and not a funnel', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => row({ profileId: id, mutualFriends: 1 }));

    expect(selectFriendSuggestions(rows)).toHaveLength(MAX_VISIBLE_SUGGESTIONS);
    expect(MAX_VISIBLE_SUGGESTIONS).toBe(3);
  });

  /**
   * The moment after a tap: the request is written, the list has not been
   * re-read, and the person just asked must not still be sitting there
   * under a live `Toevoegen`.
   */
  test('hides anyone whose request has already gone out this visit', () => {
    const rows = [row({ profileId: 'a', mutualFriends: 2 }), row({ profileId: 'b', mutualFriends: 1 })];

    const chosen = selectFriendSuggestions(rows, new Set(['a']));

    expect(chosen.map((suggestion) => suggestion.profileId)).toEqual(['b']);
  });

  test('a hidden candidate frees its slot rather than leaving a gap', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id) => row({ profileId: id, mutualFriends: 1 }));

    const chosen = selectFriendSuggestions(rows, new Set(['a']));

    expect(chosen.map((suggestion) => suggestion.profileId)).toEqual(['b', 'c', 'd']);
  });

  test('builds the handle label once, so every row shows one the same way', () => {
    const [chosen] = selectFriendSuggestions([row({ profileId: 'a', handle: 'sanne', mutualFriends: 1 })]);

    expect(chosen?.handleLabel).toBe('@sanne');
  });

  test('an unreadable handle draws no handle line rather than a bare @', () => {
    const [chosen] = selectFriendSuggestions([row({ profileId: 'a', handle: '', mutualFriends: 1 })]);

    expect(chosen?.handleLabel).toBe('');
  });
});

// ---------------------------------------------------------------------------
// The sentences
// ---------------------------------------------------------------------------

describe('what a suggestion row says', () => {
  test('counts mutual friends in singular and plural', () => {
    expect(describeSuggestionReasonText({ kind: 'mutual-friends', count: 1 })).toBe('1 gemeenschappelijke vriend');
    expect(describeSuggestionReasonText({ kind: 'mutual-friends', count: 2 })).toBe('2 gemeenschappelijke vrienden');
  });

  /**
   * (!) THE LOAD-BEARING ASSERTION IN THIS FILE. The number counts
   * `recipe_ratings` rows — votes — and there is no column anywhere in the
   * schema from which "recipes posted" could be counted (0019's header
   * carries the full argument). A sentence claiming otherwise would be a
   * fabricated number printed next to a real person's name.
   */
  test('the activity line counts what it actually counted', () => {
    expect(describeSuggestionReasonText({ kind: 'active', votes: 1 })).toBe('Beoordeelde 1 recept');
    expect(describeSuggestionReasonText({ kind: 'active', votes: 7 })).toBe('Beoordeelde 7 recepten');
  });

  test('the add label names the person, so a screen reader can tell three rows apart', () => {
    expect(describeSuggestionAddAccessibilityLabel('Sanne')).toContain('Sanne');
  });
});

describe('the waiting-requests line', () => {
  test('says nothing when nothing is waiting', () => {
    expect(formatPendingRequests(0)).toBeNull();
  });

  test('counts in singular and plural', () => {
    expect(formatPendingRequests(1)).toBe('1 volgverzoek wacht op je');
    expect(formatPendingRequests(3)).toBe('3 volgverzoeken wachten op je');
  });

  test('a nonsense count draws no line rather than a nonsense one', () => {
    expect(formatPendingRequests(Number.NaN)).toBeNull();
    expect(formatPendingRequests(-2)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The refusals this block inherits, swept over every sentence it can produce
// ---------------------------------------------------------------------------

/**
 * Every string this module can put on screen: the constants, plus both
 * rendered reasons and both request lines. Widened to `unknown` first for
 * the reason addFriendCopy.test.ts gives — a module namespace's values are
 * a union of literals and functions, which a `value is string` predicate
 * cannot narrow from.
 */
function everySentence(): readonly string[] {
  const exported: readonly unknown[] = Object.values(friendSuggestionCopy);
  return [
    ...exported.filter((value): value is string => typeof value === 'string'),
    describeSuggestionReasonText({ kind: 'mutual-friends', count: 1 }),
    describeSuggestionReasonText({ kind: 'mutual-friends', count: 4 }),
    describeSuggestionReasonText({ kind: 'active', votes: 1 }),
    describeSuggestionReasonText({ kind: 'active', votes: 9 }),
    describeSuggestionAddAccessibilityLabel('Sanne'),
    formatPendingRequests(1) ?? '',
    formatPendingRequests(5) ?? '',
  ];
}

function assertNoneContain(banned: readonly string[]): void {
  for (const sentence of everySentence()) {
    for (const word of banned) {
      expect(sentence.toLowerCase()).not.toContain(word);
    }
  }
}

describe('a suggestion says why, and never who', () => {
  /**
   * 0019 returns a COUNT of mutual friends and deliberately not their
   * identities: naming which of your friends knows a stranger is a fact
   * about your friend's graph, told to a third party, and 0007's
   * `friendships_select` refused that disclosure on purpose. This scan is
   * what keeps the copy side of that promise — the migration could stay
   * unchanged while a helpful sentence gave the game away.
   */
  test('no sentence names a mutual friend', () => {
    assertNoneContain(['kent deze', 'kennen deze', 'is bevriend met', 'zijn bevriend met', 'ook vrienden met']);
  });

  /**
   * The count is real; a count of recipes posted is not (see the activity
   * test above). This sweeps for the tempting wording rather than trusting
   * one assertion on one function.
   */
  test('no sentence claims a number of recipes posted', () => {
    assertNoneContain(['plaatst', 'plaatste', 'geplaatst', 'uploadde', 'deelde recepten']);
  });

  /**
   * The product rule this whole surface keeps, and the one a suggestion
   * block is most likely to break: nothing here is ordered by, or dated
   * with, recency. "Onlangs actief" is the first brick of a reason to come
   * back and check.
   */
  test('no sentence dates a person or their activity', () => {
    assertNoneContain(['gisteren', 'vandaag', 'onlangs', 'zojuist', 'deze week', 'dagen geleden', 'nieuw op remy']);
  });

  /** §4.4's "no red badges": an open request is a fact, not an alarm. */
  test('no sentence raises an alarm', () => {
    assertNoneContain(['let op', 'waarschuwing', 'dringend', 'actie vereist', '!']);
  });

  /**
   * The suggestion block is not a growth funnel. No sentence may urge,
   * count down, or promise that the product gets better with more friends
   * — PD-004's refusal, applied to the one place on this screen that could
   * plausibly argue otherwise.
   */
  test('no sentence campaigns for more friends', () => {
    assertNoneContain(['nodig uit', 'uitnodigen', 'nog leuker', 'mis niets', 'iedereen', 'begin nu']);
  });
});

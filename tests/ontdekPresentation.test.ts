/**
 * Ontdek's decisions: the surface switch, the waiting-post line, and the one
 * `__DEV__` row that moves both surfaces.
 *
 * THE BOUNDARY BETWEEN THE TWO SURFACES IS TESTED NEXT DOOR, in
 * tests/ontdekBoundary.test.ts, because it is a different KIND of assertion:
 * that file pins a product rule PD-024 asked for by name, and this one pins
 * the behaviour of the screen around it. Splitting them keeps the boundary
 * file short enough to read in one sitting, which is the point of a test
 * that exists to be read by whoever is about to break the rule.
 *
 * No React Native import anywhere, so this runs under vitest's `node`
 * environment against the real modules. That is the whole reason these
 * decisions live in a `.ts` module rather than in the route: a ternary
 * inside `(tabs)/ranglijst.tsx` is one no test in this repo can reach.
 */

import { describe, expect, test } from 'vitest';
import {
  DEFAULT_ONTDEK_SURFACE,
  NO_WAITING_POST,
  ONTDEK_SCENARIOS,
  ONTDEK_SURFACES,
  countWaitingPost,
  resolveBoardScenario,
  resolveFeedScenario,
  resolvePageForSurface,
  resolveSurfaceForPage,
  resolveWaitingPostDestination,
} from '@/components/ontdekPresentation';
import {
  ONTDEK_SURFACE_LABEL,
  ONTDEK_SURFACE_SUBTITLE,
  describeSurfaceSwitchOption,
  formatWaitingPost,
} from '@/components/ontdekCopy';

// ---------------------------------------------------------------------------
// The two surfaces, and the pager they are bound to
// ---------------------------------------------------------------------------

describe('the surface switch', () => {
  test('has exactly two surfaces, feed first', () => {
    expect(ONTDEK_SURFACES).toEqual(['vrienden', 'ontdekken']);
  });

  /**
   * O-1's tripwire, pinned: PD-024 records that the day the feed carries
   * something that must be ANSWERED, one tab becomes two. That day this
   * array grows a third entry or splits — either way this test is where
   * somebody notices the shape changed.
   */
  test('a visit starts on the feed, which is a reversal of where Trending started', () => {
    expect(DEFAULT_ONTDEK_SURFACE).toBe('vrienden');
    expect(resolvePageForSurface(DEFAULT_ONTDEK_SURFACE)).toBe(0);
  });

  test('maps each surface to its page and back', () => {
    for (const surface of ONTDEK_SURFACES) {
      expect(resolveSurfaceForPage(resolvePageForSurface(surface))).toBe(surface);
    }
  });

  /**
   * A pager mid-bounce reports offsets past either end. Falling back beats
   * throwing: a crash caused by a rubber-band is a crash caused by a gesture
   * that changed nothing.
   */
  test('an out-of-range page falls back rather than throwing', () => {
    expect(resolveSurfaceForPage(-1)).toBe(DEFAULT_ONTDEK_SURFACE);
    expect(resolveSurfaceForPage(2)).toBe(DEFAULT_ONTDEK_SURFACE);
    expect(resolveSurfaceForPage(99)).toBe(DEFAULT_ONTDEK_SURFACE);
  });

  /**
   * O-2c, in the words the owner chose on 11 September 2026. `Iedereen |
   * Vrienden` named two SCOPES; these name two SURFACES.
   */
  test('carries the owner-chosen words', () => {
    expect(ONTDEK_SURFACE_LABEL.vrienden).toBe('Vrienden');
    expect(ONTDEK_SURFACE_LABEL.ontdekken).toBe('Ontdekken');
  });

  /**
   * ⚠ THE SENTENCE WS3 CALLED THE MOST CHARACTERISTIC IN THE APP, kept
   * verbatim on the explore side because explore is byte-for-byte the list
   * PD-014 protects. It hung on Trending's `Iedereen` scope and did not need
   * to change when the scope became a surface.
   */
  test('keeps the explore sentence exactly as it was on Trending', () => {
    expect(ONTDEK_SURFACE_SUBTITLE.ontdekken).toBe('Wat over alle keukens heen het hoogst scoort.');
  });

  /**
   * ⚠ AND THE FEED SENTENCE SAYS "VOLGT", WHERE THE LABEL SAYS "VRIENDEN".
   * After fase 1 the graph is directed and migration 0022 moves
   * `shared_cooks` from `is_friend_of` to `i_follow`, so what you see is
   * what the people you FOLLOW cooked — they need not follow you back. The
   * label keeps the familiar word; the sentence tells the truth about the
   * set.
   */
  test('the feed sentence describes following rather than friendship', () => {
    expect(ONTDEK_SURFACE_SUBTITLE.vrienden).toContain('volgt');
    expect(ONTDEK_SURFACE_SUBTITLE.vrienden).not.toContain('vrienden');
  });

  test('the spoken form is the word plus what the surface is', () => {
    expect(describeSurfaceSwitchOption('ontdekken')).toBe('Ontdekken, Wat over alle keukens heen het hoogst scoort.');
  });
});

// ---------------------------------------------------------------------------
// O-1b: one line, one count, over every kind of post
// ---------------------------------------------------------------------------

describe('the waiting-post line', () => {
  test('says nothing when nothing is waiting, which is almost every visit', () => {
    expect(countWaitingPost(NO_WAITING_POST)).toBe(0);
    expect(formatWaitingPost(NO_WAITING_POST)).toBeNull();
  });

  test('counts every kind of post as one number', () => {
    expect(countWaitingPost({ followRequests: 2, unseenSends: 3 })).toBe(5);
  });

  /**
   * The one-kind case IS `formatPendingRequests`' sentence, delegated rather
   * than restated — a second wording for it is how the two would drift.
   */
  test('a follow request alone reads as it always did', () => {
    expect(formatWaitingPost({ followRequests: 1, unseenSends: 0 })).toBe('1 volgverzoek wacht op je');
    expect(formatWaitingPost({ followRequests: 4, unseenSends: 0 })).toBe('4 volgverzoeken wachten op je');
  });

  /** Sends reach this line for the first time in fase 2 — see O-1b. */
  test('sends alone name themselves, with Dutch agreement', () => {
    expect(formatWaitingPost({ followRequests: 0, unseenSends: 1 })).toBe('1 recept wacht op je');
    expect(formatWaitingPost({ followRequests: 0, unseenSends: 2 })).toBe('2 recepten wachten op je');
  });

  /**
   * ⚠ ONE LINE AND NEVER THREE. Two kinds of post do not add up to a noun,
   * so the sentence stops naming them and names the count — which is also
   * what keeps a third kind (O-5's co-diner invitation, fase 5) from turning
   * this into a list with commas in it.
   */
  test('two kinds of post become one sentence about a number, not two sentences', () => {
    const line = formatWaitingPost({ followRequests: 2, unseenSends: 3 });

    expect(line).toBe('5 dingen wachten op je');
    expect(line).not.toContain('volgverzoek');
    expect(line).not.toContain('recept');
  });

  test('a non-finite or negative count reads as nothing rather than as NaN', () => {
    expect(formatWaitingPost({ followRequests: Number.NaN, unseenSends: 0 })).toBeNull();
    expect(formatWaitingPost({ followRequests: -3, unseenSends: 0 })).toBeNull();
    expect(countWaitingPost({ followRequests: Number.POSITIVE_INFINITY, unseenSends: -1 })).toBe(0);
  });

  /**
   * ⚠ THE NULL DESTINATION IS THE INTERESTING HALF. A follow request can
   * only be answered somewhere else, so the line is a door. Unseen sends are
   * NOT somewhere else — they are the band immediately beneath it, already
   * on screen — so a line counting only sends renders as a statement rather
   * than as a control. Still one line and one count; what changes is whether
   * it is tappable.
   */
  test('is tappable exactly when there is somewhere to go', () => {
    expect(resolveWaitingPostDestination({ followRequests: 1, unseenSends: 0 })).toBe('follow-requests');
    expect(resolveWaitingPostDestination({ followRequests: 1, unseenSends: 5 })).toBe('follow-requests');
    expect(resolveWaitingPostDestination({ followRequests: 0, unseenSends: 5 })).toBeNull();
    expect(resolveWaitingPostDestination(NO_WAITING_POST)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// One dev row, both surfaces
// ---------------------------------------------------------------------------

describe('the __DEV__ scenarios', () => {
  test('live means live on both surfaces, and the caller must branch on null', () => {
    expect(resolveFeedScenario('live')).toBeNull();
    expect(resolveBoardScenario('live')).toBeNull();
  });

  test('every scenario resolves a fixture for both surfaces at once', () => {
    for (const scenario of ONTDEK_SCENARIOS) {
      if (scenario === 'live') {
        continue;
      }
      expect(resolveFeedScenario(scenario)).not.toBeNull();
      expect(resolveBoardScenario(scenario)).not.toBeNull();
    }
  });

  /**
   * `net-te-weinig` is the state a reader is most likely to mistake for a
   * bug, and the one worth being able to look at: ratings exist but nothing
   * clears the global floor, so explore shows its empty state while the feed
   * stays full. Both are correct at the same time.
   */
  test('net-te-weinig pairs a full feed with a board that cannot fill', () => {
    expect(resolveFeedScenario('net-te-weinig')).toBe('gedeeld');
    expect(resolveBoardScenario('net-te-weinig')).toBe('net-te-weinig');
  });

  /**
   * `zonder_allergie` makes PD-006's point physically visible: the recipes
   * are identical to `gedeeld` and only the "bevat noten" label appears and
   * disappears, so the label describes the household and never the dish.
   */
  test('zonder_allergie keeps the board full so only the label changes', () => {
    expect(resolveFeedScenario('zonder_allergie')).toBe('zonder_allergie');
    expect(resolveBoardScenario('zonder_allergie')).toBe('gevuld');
  });

  test('leeg empties both surfaces together', () => {
    expect(resolveFeedScenario('leeg')).toBe('leeg');
    expect(resolveBoardScenario('leeg')).toBe('leeg');
  });
});

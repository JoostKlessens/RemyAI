/**
 * HOW OFTEN REMY MAY ASK TIKTOK TO RE-SIGN A THUMBNAIL — the half of the
 * refresh feature that keeps it on rung 1 of `research/13-legal-tos.md`'s
 * ladder instead of sliding toward the thing that ladder actually warns
 * about.
 *
 * §13's mitigation for reading oEmbed is one sentence and it is the whole
 * brief for this file: *"Blijf zichtbaar binnen 'tonen/attribueren',
 * vermijd elke suggestie van bulk-verzamelen."* One call for a post the
 * user is looking at right now is showing. Two hundred calls when the app
 * wakes up is collecting, whatever the intent behind it was. Nothing about
 * the two is distinguishable from TikTok's side except THE SHAPE OF THE
 * TRAFFIC, so the shape is what this module fixes.
 *
 * ===========================================================================
 * THE FOUR RULES, AND THE ARGUMENT FOR EACH
 * ===========================================================================
 *
 * 1. LAZY, NEVER EAGER — enforced at the call site, recorded here because
 *    it is the premise the rest rests on. A refresh is triggered by
 *    `<Image onError>` actually firing (`useThumbnailFallback.ts`), which
 *    means the URL was rendered, requested, and refused. There is no sweep
 *    on launch, no staleness timer, no prefetch. A library whose thumbnails
 *    still work costs exactly zero calls.
 *
 *    ⚠ A NULL `thumbnailUrl` DELIBERATELY DOES NOT TRIGGER ONE. A null is
 *    already an answer — oEmbed was asked at import and carried no still
 *    (Instagram without credentials, a 404, a manual entry) — so asking
 *    again is asking a question that was answered. It also happens to be
 *    the reading that keeps rule 1 honest: a library of manual entries has
 *    every tile null, and "refresh the nulls" would fire on every one of
 *    them at once, which is the sweep by another name. The one case this
 *    gives up is a meal that predates migration 0003 and could now gain a
 *    thumbnail. That cohort is fixed, it shrinks, and it is not worth
 *    building the sweep for.
 *
 * 2. ONE ASK PER POST PER SESSION (`asked`). A second failure of the same
 *    post is not new information. This is also what makes a `FlatList`
 *    safe: rows recycle, a tile scrolls off and back, and without this a
 *    single expired post could fire a call every time it re-enters the
 *    viewport. Keyed on the normalized request URL rather than a meal id,
 *    so the SAME POST reached from two surfaces — the household's library
 *    tile and a friend's card for the same video — costs one call between
 *    them, not two.
 *
 * 3. A SESSION CEILING (`THUMBNAIL_REFRESH_SESSION_CEILING`). See that
 *    constant for the arithmetic behind the number.
 *
 * 4. A 429 HALTS EVERYTHING (`standingDown`). `resolveOembed` already
 *    models `rate_limited`, and a 429 is an answer about the CLIENT, not
 *    about the post. Letting each remaining tile discover the same 429 for
 *    itself would spend the rest of the ceiling learning one fact twenty
 *    times over — and would look, from the outside, exactly like a client
 *    that has been asked to stop and has not. Nothing lifts a stand-down
 *    but a new session; there is no backoff timer, because a render path is
 *    the wrong place to hold a retry schedule and the next launch is a
 *    perfectly good one.
 *
 * ===========================================================================
 * WHY THE STATE IS A VALUE AND NOT A SINGLETON
 * ===========================================================================
 *
 * Every function here takes a budget and returns a new one; nothing is
 * mutated and nothing is stored at module scope. That is what makes the
 * rules above provable in a node-only test instead of trusted to a fetch
 * loop — the house's standing rule that the DECISION goes in a pure module.
 * The one long-lived instance the app actually threads through lives in
 * src/lib/thumbnailRefresh.ts, which is also where the serialization (one
 * call in flight at a time) lives, because a queue is inherently temporal
 * and cannot be expressed as a value transition.
 */

import type { ThumbnailRefreshFollowUp } from './thumbnailRefreshPolicy';

/**
 * The most thumbnails one session will ever re-sign.
 *
 * THE ARITHMETIC, so the number is a measurement and not a mood.
 * Bibliotheek's grid is `LIBRARY_GRID_COLUMNS = 3` wide at a 4:5 ratio
 * (libraryGridMetrics.ts), and LIB-09 measured the chrome above it at 3.05
 * visible tile rows on a 393×852 screen. Three columns × three rows is
 * NINE TILES PER SCREENFUL. Twenty-four is a shade under three screenfuls.
 *
 * WHY THAT IS THE RIGHT PLACE TO STOP. Up to about three screenfuls the
 * person is looking at their library, and every call is attached to a tile
 * they can see — "tonen", which is the licensed use. Past it they are
 * scrolling THROUGH a library, and a 200-recipe library would otherwise
 * quietly generate 200 calls in a couple of minutes. There is no line in
 * the licence at 24; there is a line between showing and collecting, and 24
 * is where this app draws it with the measurement written down beside it.
 *
 * WHAT THE CEILING COSTS, stated plainly rather than discovered later: a
 * person who scrolls a large, old library sees real thumbnails near the top
 * and monograms further down, and no message explains why. That is accepted
 * because WS4 §4.4 already settles the priority — the refresh is *"a bonus
 * path, and the design must not depend on it"*. The monogram is the design;
 * this only makes it rarer.
 */
export const THUMBNAIL_REFRESH_SESSION_CEILING = 24;

/**
 * One session's spending record. Immutable — see the file header on why
 * this is a value rather than a module singleton.
 */
export interface ThumbnailRefreshBudget {
  /** Calls ADMITTED, counted at admission rather than at settlement — see `admitThumbnailRefresh`. */
  readonly spent: number;
  /** Normalized request URLs already asked about this session, successful or not. */
  readonly asked: ReadonlySet<string>;
  /** Set by a 429 and never cleared: this session asks nothing further. */
  readonly standingDown: boolean;
}

/** Why a refresh was not admitted. Each maps to one of the file header's rules. */
export type ThumbnailRefreshDenial = 'already_asked' | 'ceiling_reached' | 'standing_down';

export type ThumbnailRefreshAdmission =
  | { readonly kind: 'admitted'; readonly budget: ThumbnailRefreshBudget }
  | { readonly kind: 'denied'; readonly reason: ThumbnailRefreshDenial; readonly budget: ThumbnailRefreshBudget };

export function createThumbnailRefreshBudget(): ThumbnailRefreshBudget {
  return { spent: 0, asked: new Set<string>(), standingDown: false };
}

/**
 * Decides whether one more oEmbed call may be made, and returns the budget
 * that decision leaves behind.
 *
 * THE SPEND IS TAKEN AT ADMISSION, NOT AT SETTLEMENT, and that ordering is
 * the point rather than an implementation detail. A grid of expired tiles
 * fires its `onError` handlers within a frame or two of each other, so if
 * the counter only moved when a call CAME BACK, every one of those tiles
 * would be admitted against a budget that still read zero — the ceiling
 * would bound nothing at exactly the moment it is supposed to bite.
 * Counting on the way in means a call in flight already occupies its slot.
 *
 * The denial order is deliberate too: `standing_down` outranks the ceiling,
 * and the ceiling outranks `already_asked`. A caller reading the reason
 * should learn the most general fact that is true, since that is the one
 * that also explains the tiles around it.
 */
export function admitThumbnailRefresh(budget: ThumbnailRefreshBudget, requestUrl: string): ThumbnailRefreshAdmission {
  if (budget.standingDown) {
    return { kind: 'denied', reason: 'standing_down', budget };
  }
  if (budget.spent >= THUMBNAIL_REFRESH_SESSION_CEILING) {
    return { kind: 'denied', reason: 'ceiling_reached', budget };
  }
  if (budget.asked.has(requestUrl)) {
    return { kind: 'denied', reason: 'already_asked', budget };
  }

  // A new Set rather than `.add` on the incoming one: the caller may still
  // be holding the old budget, and a spending record that changes under
  // whoever is reading it is the bug this whole shape exists to make
  // impossible.
  const asked = new Set(budget.asked);
  asked.add(requestUrl);
  return { kind: 'admitted', budget: { spent: budget.spent + 1, asked, standingDown: budget.standingDown } };
}

/**
 * Folds one oEmbed answer back into the budget.
 *
 * ONLY `stand_down` CHANGES ANYTHING, and the four members that do not are
 * as deliberate as the one that does. A `gone`, an `unavailable` or a
 * `nothing_to_show` has already cost its slot at admission and already
 * closed its post via `asked`; charging it a second time here would make
 * the ceiling mean "24 attempts, or fewer, depending on how many failed",
 * which is a number nobody could reason about. And a `replace` must not be
 * refunded — a successful call is exactly as visible to TikTok as a failed
 * one, so rewarding success with a free slot would let a healthy library
 * refresh without limit.
 */
export function settleThumbnailRefresh(
  budget: ThumbnailRefreshBudget,
  followUp: ThumbnailRefreshFollowUp,
): ThumbnailRefreshBudget {
  if (followUp.kind !== 'stand_down') {
    return budget;
  }
  return { spent: budget.spent, asked: budget.asked, standingDown: true };
}

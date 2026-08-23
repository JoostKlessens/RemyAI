/**
 * Feed item eligibility (PD-007) — the application-layer mirror of the
 * database guarantee in supabase/migrations/0002_creator_feed.sql's
 * `servable_feed_items` view and `feed_items_select` RLS policy.
 *
 * Why duplicate a DB-enforced rule here: defence in depth, the same
 * reasoning src/domain/exclusions.ts gives for re-checking `archivedAt`
 * even though `DecisionRequest.candidateMeals` is contractually
 * pre-filtered. RLS protects a direct Supabase query; it does nothing for
 * a payload that already made it into application memory (a stale cache, a
 * batch export, a test fixture, a future caller that reads `feed_items`
 * instead of `servable_feed_items`). This module is what a caller runs
 * against feed items it already has in hand, so "the database would have
 * blocked this" is never the only thing standing between a non-consenting
 * creator and the screen.
 *
 * Pure, no I/O — matches the discipline of decide.ts / exclusions.ts.
 */

import type { Creator, CreatorId, FeedItem } from './types';

/**
 * A creator is currently consented if, and only if, opt-in has been
 * recorded and no later opt-out has withdrawn it. Mirrors
 * `idx_creators_active_opt_in` and the `creators_select` RLS policy
 * predicate in 0002_creator_feed.sql exactly.
 */
export function isCreatorConsented(creator: Creator): boolean {
  return creator.optedInAt !== null && creator.optedOutAt === null;
}

/**
 * A feed item is servable when its own post hasn't been taken down AND its
 * creator is currently consented. `creator` must be the creator this item
 * actually belongs to — if the ids don't match, this fails closed (returns
 * false) rather than trusting a caller-supplied mismatch, the same
 * "never fail open" stance exclusions.ts takes on a stray restriction row
 * referencing an unknown member id.
 */
export function isFeedItemServable(item: FeedItem, creator: Creator): boolean {
  if (item.creatorId !== creator.id) {
    return false;
  }
  return item.removedAt === null && isCreatorConsented(creator);
}

/**
 * Filters a list of feed items down to the servable subset, given a lookup
 * of creators keyed by id. An item whose creator isn't present in
 * `creatorsById` at all is treated the same as an unconsented creator —
 * fails closed, never silently assumed eligible for lack of data.
 */
export function filterServableFeedItems(
  items: readonly FeedItem[],
  creatorsById: ReadonlyMap<CreatorId, Creator>,
): readonly FeedItem[] {
  return items.filter((item) => {
    const creator = creatorsById.get(item.creatorId);
    return creator !== undefined && isFeedItemServable(item, creator);
  });
}

/**
 * What a Feed save actually writes (coordinator resolution, mirroring
 * PD-006's title-only-meal pattern for a save of an unparsed post).
 *
 * `FeedItem.mealId` is nullable — a post the content pipeline hasn't
 * parsed into a structured recipe yet — but `Save.mealId`
 * (src/domain/types.ts) is non-null. `resolveMealForFeedItemSave` is the
 * single place that gap is resolved:
 *   - `item.mealId` set  -> reuse it directly (`existing_meal`).
 *   - `item.mealId` null -> build a title-only Meal stub to insert first
 *                           (`new_meal_stub`), exactly like a Rotation
 *                           Seeding meal (PD-006).
 *
 * The one rule that must never break: a stub built here is always
 * `allergenTagStatus: 'unknown'`, never `'verified'`. An unparsed video we
 * know nothing about must never enter a household's rotation looking like
 * something a human checked — PD-006's guarantee has to hold end to end,
 * and this is exactly the seam where it would otherwise leak. The literal
 * `'unknown'` type on `MealStubInsert.allergenTagStatus` (types.ts) makes
 * that a compile-time guarantee here, not just a runtime default.
 *
 * Pure, no I/O: this module never performs the actual INSERT. The real
 * two-step write (insert the meal stub, read back its generated id, then
 * insert a Save row referencing it) crosses a database round trip a pure
 * domain function cannot make deterministic, so that orchestration
 * belongs to whichever repository/glue layer actually talks to Supabase —
 * out of scope here, matching decide.ts's own "no I/O" discipline.
 */

import type { HouseholdId, MealId } from '../types';
import type { Creator, CreatorPlatform, FeedItem, MealStubInsert } from './types';

/**
 * `meals.source_platform` (0001_init.sql) predates this feature's
 * creators/feed_items vocabulary and uses `'reels'` where this module
 * says `'instagram'` — Instagram Reels being the actual short-video
 * surface an Instagram post URL targets. Bridged here rather than by
 * editing either the frozen 0001 migration or src/domain/types.ts.
 */
function toMealSourcePlatform(platform: CreatorPlatform): 'tiktok' | 'reels' {
  return platform === 'tiktok' ? 'tiktok' : 'reels';
}

/** Platform-only fallback name, used when even the creator's handle is blank — never empty. */
function platformDisplayName(platform: CreatorPlatform): string {
  return platform === 'tiktok' ? 'TikTok' : 'Instagram';
}

/** "@handle · TikTok" style fallback — attribution, not prose, so it stays language-neutral. */
function fallbackStubTitle(creator: Creator): string {
  const platformLabel = platformDisplayName(creator.platform);
  const handle = creator.handle.trim();
  return handle.length > 0 ? `@${handle} · ${platformLabel}` : platformLabel;
}

/** Never returns an empty string: falls back to creator attribution per the coordinator's brief. */
function resolveStubTitle(item: FeedItem, creator: Creator): string {
  if (item.title !== null && item.title.trim().length > 0) {
    return item.title.trim();
  }
  return fallbackStubTitle(creator);
}

/**
 * Builds the insertable column values for a title-only Meal stub
 * representing an unparsed feed item save. Intended to be reached only via
 * `resolveMealForFeedItemSave` below (the single entry point), but
 * exported directly too so it's independently testable.
 */
export function buildUnparsedFeedItemMealStub(
  item: FeedItem,
  creator: Creator,
  householdId: HouseholdId,
): MealStubInsert {
  return {
    householdId,
    title: resolveStubTitle(item, creator),
    source: 'saved',
    ingredientTags: [],
    allergenTagStatus: 'unknown',
    sourceUrl: item.sourceUrl,
    sourcePlatform: toMealSourcePlatform(item.sourcePlatform),
  };
}

export type SaveMealResolution =
  | { readonly kind: 'existing_meal'; readonly mealId: MealId }
  | { readonly kind: 'new_meal_stub'; readonly stub: MealStubInsert };

/**
 * The single entry point for "what does saving this feed item write to
 * `meals`": reuse the already-parsed meal when one exists, otherwise build
 * a stub. A caller should never inline the `item.mealId !== null` check
 * itself — routing through here is what keeps the 'unknown' guarantee
 * above from depending on every future call site getting it right
 * independently.
 */
export function resolveMealForFeedItemSave(
  item: FeedItem,
  creator: Creator,
  householdId: HouseholdId,
): SaveMealResolution {
  if (item.mealId !== null) {
    return { kind: 'existing_meal', mealId: item.mealId };
  }
  return { kind: 'new_meal_stub', stub: buildUnparsedFeedItemMealStub(item, creator, householdId) };
}

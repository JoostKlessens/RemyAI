/**
 * Pure presentation helpers shared by the Feed card and its creator
 * attribution row. No React Native imports here on purpose — this file
 * (unlike FeedVideoCard.tsx/CreatorAttribution.tsx, which pull in RN's
 * JSX primitives) can be unit-tested directly under vitest's `node`
 * environment. See tests/feedLinking.test.ts.
 */

import type { CreatorPlatform } from '@/domain/feed/types';

const PLATFORM_DISPLAY_NAMES: Readonly<Record<CreatorPlatform, string>> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

/** Human-facing platform name for attribution copy — never render the raw union value. */
export function getPlatformDisplayName(platform: CreatorPlatform): string {
  return PLATFORM_DISPLAY_NAMES[platform];
}

/**
 * A `FeedItem.title` is nullable (src/domain/feed/types.ts) — oEmbed may
 * not have returned one, or the item hasn't been resolved yet. Prefer a
 * parsed meal's title when one exists (it's the more curated, trustworthy
 * name); otherwise fall back to honest, non-claiming Dutch copy instead of
 * ever showing a blank heading.
 */
export function resolveFeedItemDisplayTitle(itemTitle: string | null, parsedMealTitle: string | null): string {
  if (parsedMealTitle !== null) {
    return parsedMealTitle;
  }
  if (itemTitle !== null) {
    return itemTitle;
  }
  return 'Video zonder titel';
}

/** Accessible label for the primary "tap to watch" affordance — same copy whether or not a thumbnail is showing. */
export function buildWatchAccessibilityLabel(displayTitle: string, platformName: string, hasFailedToOpen: boolean): string {
  if (hasFailedToOpen) {
    return `Kon "${displayTitle}" niet openen op ${platformName}. Tik om opnieuw te proberen.`;
  }
  return `Bekijk "${displayTitle}" op ${platformName}. Opent buiten Remy.`;
}

/** Accessible label for the creator attribution link. */
export function buildProfileAccessibilityLabel(handle: string, platformName: string, hasFailedToOpen: boolean): string {
  if (hasFailedToOpen) {
    return `Kon profiel van ${handle} op ${platformName} niet openen. Tik om opnieuw te proberen.`;
  }
  return `Bekijk profiel van ${handle} op ${platformName}`;
}

/**
 * PD-007a: a purely factual "contains X" tag, never a safety verdict —
 * identical exclusion-framing to the rest of the app ("sluit uit wat je
 * hebt getagd", never "veilig voor"). `collidingTags` is expected to come
 * straight from src/domain/feed/ranking.ts's `RankedFeedItem.collidingTags`
 * — the same computation that already ranked this item down, so what the
 * label says can never drift from what actually happened to its rank.
 * Returns null when there is nothing to say, which the caller must render
 * as NO label — an absent label must never be readable as "checked and
 * clean" (PD-006's whole point), only as "nothing collided with what we
 * know."
 */
export function buildCollisionLabel(collidingTags: readonly string[]): string | null {
  if (collidingTags.length === 0) {
    return null;
  }
  return `Bevat ${collidingTags.join(', ')}`;
}

/**
 * Pure presentation helpers for crediting a content creator. Originally
 * part of feedPresentation.ts (Feed card + creator attribution row); kept
 * — trimmed to only what `CreatorAttribution` still uses — after the Feed
 * was removed, because an imported recipe still belongs to a creator and
 * still needs to credit them (see CreatorAttribution.tsx). No React Native
 * imports here on purpose, so this can be unit-tested directly under
 * vitest's `node` environment. See tests/creatorPresentation.test.ts.
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

/** Accessible label for the creator attribution link. */
export function buildProfileAccessibilityLabel(handle: string, platformName: string, hasFailedToOpen: boolean): string {
  if (hasFailedToOpen) {
    return `Kon profiel van ${handle} op ${platformName} niet openen. Tik om opnieuw te proberen.`;
  }
  return `Bekijk profiel van ${handle} op ${platformName}`;
}

/**
 * The spoken form of a credit row that is NOT a link — a canonical recipe
 * whose source reported no `author_url`, so there is no profile to open
 * (see CreatorAttribution.tsx on why such a row must not pretend).
 *
 * It states the credit rather than an action, because there is no action:
 * "Bekijk profiel van …" on a row that opens nothing is the false promise
 * the no-link branch exists to avoid. The two visible lines are read as
 * one sentence, which is what a sighted reader gets from them together.
 */
export function buildCreatorCreditAccessibilityLabel(displayName: string, platformName: string): string {
  return `Recept van ${displayName} op ${platformName}`;
}

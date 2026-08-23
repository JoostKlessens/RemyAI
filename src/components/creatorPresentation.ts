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

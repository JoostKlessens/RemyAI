/**
 * Builds a display-only `Creator`-shaped object (src/domain/feed/types.ts)
 * from an oEmbed author name, so `CreatorAttribution` can credit an
 * imported recipe's creator on the confirmation screen
 * (src/app/import/confirm.tsx).
 *
 * Why this exists: `ImportResult` (src/domain/import/types.ts) carries no
 * creator/attribution field — the edge function reads oEmbed's
 * `authorName` only to build the extraction prompt, it never returns it in
 * the HTTP response. `CreatorAttribution`'s prop type is still `Creator`
 * (unchanged, so it stays a drop-in reuse rather than a rewrite) — this
 * module is the bridge.
 *
 * `optedInAt`/`optedOutAt` are always null here on purpose: those fields
 * model Feed opt-in consent (PD-007), a different concept from "this
 * creator made the video I personally imported." `CreatorAttribution`
 * never reads either field, so this is safe and non-misleading — it does
 * not assert real Feed opt-in.
 */

import type { Creator } from '@/domain/feed/types';
import type { ImportPlatform } from '@/domain/import/types';

function buildProfileUrl(platform: ImportPlatform, authorName: string): string {
  return platform === 'tiktok'
    ? `https://www.tiktok.com/@${authorName}`
    : `https://www.instagram.com/${authorName}`;
}

/**
 * `authorName` should already be a non-empty, trimmed string — callers
 * (confirm.tsx) only invoke this when one is present, matching
 * CreatorAttribution's own precedent of omitting attribution entirely
 * rather than rendering a placeholder for data that isn't there.
 */
export function buildImportCreator(authorName: string, platform: ImportPlatform): Creator {
  return {
    id: `import-creator-${platform}-${authorName}`,
    handle: authorName,
    displayName: authorName,
    platform,
    profileUrl: buildProfileUrl(platform, authorName),
    optedInAt: null,
    optedOutAt: null,
  };
}

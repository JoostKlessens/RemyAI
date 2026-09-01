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

import type { Creator, CreatorPlatform } from '@/domain/feed/types';
import type { ImportPlatform } from '@/domain/import/types';

/**
 * WHY THIS NARROWING EXISTS, AND WHY IT IS NOT A WIDENING.
 *
 * `ImportPlatform` gained `'youtube'` when YouTube URLs became importable.
 * `CreatorPlatform` did NOT, and must not be widened to match: it is the
 * social layer's vocabulary, not the importer's. Adding a member there
 * ripples into `creatorPresentation.ts`'s exhaustive display-name map,
 * `buildCreatorLine`, `buildOriginalPostLinkLabel`, every
 * `creatorPlatform` field on the kring/proof/leaderboard presenters, and —
 * the part that makes it a migration rather than a refactor —
 * `mealStub.ts`'s `toMealSourcePlatform`, which maps onto a database enum
 * whose only values are `'tiktok'` and `'reels'`.
 *
 * So a YouTube import has no `Creator` to build, and this returns null
 * rather than inventing one. That is currently unreachable in practice:
 * the edge function has no YouTube fetch path, so no YouTube import can
 * arrive at confirm.tsx. Before it can, YouTube needs its own attribution
 * route — PD-007 makes crediting the creator an obligation, not a nicety,
 * so shipping YouTube extraction while this still returns null would be a
 * regression, not a gap.
 */
function toCreatorPlatform(platform: ImportPlatform): CreatorPlatform | null {
  switch (platform) {
    case 'tiktok':
      return 'tiktok';
    case 'instagram':
      return 'instagram';
    case 'youtube':
      return null;
  }
}

/**
 * A `switch` rather than the ternary this replaced. That ternary read
 * `platform === 'tiktok' ? tiktok : instagram`, which was correct only
 * while the union had exactly two members — the moment `'youtube'` joined
 * it, it would have minted an instagram.com profile URL for a YouTube
 * channel and credited the wrong platform entirely. An exhaustive switch
 * turns the next platform addition into a compiler error instead of a
 * silent mislabel.
 */
function buildProfileUrl(platform: CreatorPlatform, authorName: string): string {
  switch (platform) {
    case 'tiktok':
      return `https://www.tiktok.com/@${authorName}`;
    case 'instagram':
      return `https://www.instagram.com/${authorName}`;
  }
}

/**
 * `authorName` should already be a non-empty, trimmed string — callers
 * (confirm.tsx) only invoke this when one is present, matching
 * CreatorAttribution's own precedent of omitting attribution entirely
 * rather than rendering a placeholder for data that isn't there.
 *
 * Returns null for a platform the social layer has no `Creator` shape for
 * — see `toCreatorPlatform` above. confirm.tsx already renders nothing
 * when its `creator` is null, so this is the same omission it performs for
 * a missing author name, not a new failure path.
 */
export function buildImportCreator(authorName: string, platform: ImportPlatform): Creator | null {
  const creatorPlatform = toCreatorPlatform(platform);
  if (creatorPlatform === null) {
    return null;
  }
  return {
    id: `import-creator-${creatorPlatform}-${authorName}`,
    handle: authorName,
    displayName: authorName,
    platform: creatorPlatform,
    profileUrl: buildProfileUrl(creatorPlatform, authorName),
    optedInAt: null,
    optedOutAt: null,
  };
}

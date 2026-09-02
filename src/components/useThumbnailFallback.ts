/**
 * Decides whether a hotlinked thumbnail is still worth rendering.
 *
 * The bug this exists for: all four `<Image>` call sites in the app
 * (`RecipeTile`, `FriendRecipeCard`, `FriendProofCard`, `KringRow`)
 * chose between the image and the monogram by asking
 * `thumbnailUrl !== null`, and not one of them passed `onError`. But a
 * thumbnail that has *expired* is not null — it is a perfectly
 * well-formed URL that answers 403. So the monogram branch never ran,
 * and the tile rendered as a bare `surfaceSunken` rectangle.
 *
 * That matters more here than it would elsewhere, because these URLs are
 * pre-signed and short-lived by design — the repo's own fixtures say
 * `p16-sign.tiktokcdn.com`. The share of tiles with no usable image is
 * therefore not a property of how the recipes were imported, it is a
 * function of how long ago, and it climbs toward all of them. A library
 * that looks right for a fortnight and then empties out is worse than
 * one that never showed an image in the first place.
 *
 * Caching or re-hosting is not the fix and is not available:
 * `research/13-legal-tos.md` documents that reading oEmbed is permitted
 * and downloading is not. The fallback *is* the design, so it has to
 * actually fire.
 *
 * Tracked by URL rather than as a bare boolean, so a recycled row that
 * scrolls onto a different meal gets a fresh attempt without an effect
 * to reset it — a card must never inherit the previous one's failure.
 */

import { useCallback, useState } from 'react';

export interface UseThumbnailFallbackResult {
  /** False when there is no URL at all, or when this exact URL has already failed to load. */
  readonly showsImage: boolean;
  /** Pass straight to `<Image onError>`. */
  readonly onError: () => void;
}

export function useThumbnailFallback(thumbnailUrl: string | null): UseThumbnailFallbackResult {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const onError = useCallback(() => {
    setFailedUrl(thumbnailUrl);
  }, [thumbnailUrl]);

  return {
    showsImage: thumbnailUrl !== null && failedUrl !== thumbnailUrl,
    onError,
  };
}

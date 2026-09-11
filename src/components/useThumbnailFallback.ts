/**
 * Decides whether a hotlinked thumbnail is still worth rendering — and,
 * when it is not, asks the platform once for a working address before
 * giving up on it.
 *
 * The bug this exists for: the four `<Image>` call sites that existed when
 * it was written (`RecipeTile`, `FriendRecipeCard`, `FriendProofCard`,
 * `KringRow`) chose between the image and the monogram by asking
 * `thumbnailUrl !== null`, and not one of them passed `onError`. But a
 * thumbnail that has *expired* is not null — it is a perfectly
 * well-formed URL that answers 403. So the monogram branch never ran,
 * and the tile rendered as a bare `surfaceSunken` rectangle.
 *
 * ⚠ THAT SENTENCE SAID "ALL FOUR `<Image>` CALL SITES IN THE APP" UNTIL
 * 10 SEPTEMBER 2026, AND IT HAD QUIETLY STOPPED BEING TRUE. Grepping the
 * importers turns up SEVEN: the original four plus `DecisionCard`,
 * `SourceVideoPlayer` and `TrendingCard`, each added later and each
 * correctly routed through here. The claim about the ORIGINAL BUG is
 * unchanged and still true; what was wrong was the present-tense census
 * riding along inside it — the kind of line that reads like evidence
 * somebody counted. Anyone adding an eighth should update this paragraph
 * rather than the number alone.
 *
 * That matters more here than it would elsewhere, because these URLs are
 * pre-signed and short-lived by design — the repo's own fixtures say
 * `p16-sign.tiktokcdn.com`. The share of tiles with no usable image is
 * therefore not a property of how the recipes were imported, it is a
 * function of how long ago, and it climbs toward all of them. A library
 * that looks right for a fortnight and then empties out is worse than
 * one that never showed an image in the first place.
 *
 * ===========================================================================
 * ⚠ THE PARAGRAPH THAT USED TO STAND HERE WAS FALSE, AND IS RECORDED
 * RATHER THAN QUIETLY SWAPPED OUT
 * ===========================================================================
 *
 * It read, in full:
 *
 *   "Caching or re-hosting is not the fix and is not available:
 *    `research/13-legal-tos.md` documents that reading oEmbed is permitted
 *    and downloading is not. The fallback *is* the design, so it has to
 *    actually fire."
 *
 * Every clause of that is true and the conclusion does not follow, because
 * it answers a question nobody asked. The owner asked a different one:
 * *"oke maar waarom laden we het dan niet opnieuw? dat lijkt me beter?"*
 *
 * RE-FETCHING IS NOT CACHING. §13's ladder puts *reading oEmbed* on rung 1
 * (the documented, permitted call) and *storing a copy* on rung 4 (the
 * forbidden one). Asking oEmbed again for a post whose URL we already hold
 * is rung 1 repeated: it returns a fresh signature and writes nothing down.
 * The old paragraph mistook a prohibition on KEEPING the image for a
 * prohibition on ASKING for it, and so quietly turned a defect into a
 * settled design.
 *
 * What survives from it, and is still true: the fallback IS the design and
 * still has to fire. The refresh is a bonus path on top, exactly as WS4
 * §4.4 frames it — it never blocks the tile, and a tile that never gets its
 * picture back is the ordinary case, not the failure case.
 *
 * ===========================================================================
 * WHAT REFRESHING DOES AND DOES NOT DO HERE
 * ===========================================================================
 *
 * The judgement is entirely elsewhere and entirely tested:
 * `src/domain/thumbnail/thumbnailRefreshPolicy.ts` (which posts may be
 * asked about — TikTok yes, Instagram/YouTube/web no, each for its own
 * reason) and `src/domain/thumbnail/thumbnailRefreshBudget.ts` (how often,
 * and why 24). `src/lib/thumbnailRefresh.ts` performs the call and holds
 * the fresh URL in memory for the session — never in the database, for the
 * reasons written down in that file's header.
 *
 * THIS HOOK CONTRIBUTES EXACTLY THREE RULES, AND THEY ARE THE ONES THAT
 * KEEP THE CALL RARE:
 *
 *  1. Only a REAL LOAD FAILURE asks. Not a render, not a mount, not a null
 *     URL. `onError` firing means the address was rendered, requested and
 *     refused — the cheapest possible evidence that a refresh is warranted.
 *  2. Only the STORED URL's failure asks. If a refreshed address fails too,
 *     that is the end of the line: the monogram stands and no second call
 *     is made. Without this, a fresh URL that 404s would loop forever
 *     between `onError` and a memo that keeps handing back the same string.
 *  3. A CALL SITE WITH NO SOURCE ASKS NOTHING. `sourceUrl` is optional and
 *     absent is the honest default — see below.
 *
 * ===========================================================================
 * WHICH OF THE SEVEN SURFACES PASSES A SOURCE, AND WHICH ASKS NOTHING
 * ===========================================================================
 *
 * FOUR PASS ONE. `RecipeTile` (`meal.sourceUrl`), `DecisionCard`
 * (`meal.sourceUrl`, threaded from Kiezen), `FriendRecipeCard`
 * (`model.sourceUrl`) and `SourceVideoPlayer`'s embed fallback (its own
 * `sourceUrl` prop). What they have in common is not that the field was
 * handy — it is that each is ONE PERSON LOOKING AT ONE POST: a dish in
 * their own library, tonight's suggestion, a recipe a friend deliberately
 * sent them, the still standing in for a video they tried to play. That is
 * "tonen/attribueren" in §13's own words.
 *
 * THREE PASS NOTHING: `FriendProofCard`, `KringRow` and `TrendingCard`.
 * That is a decision rather than an omission, with two independent reasons,
 * either of which would be enough on its own:
 *
 *  - THEY DO NOT HAVE ONE. All three are built from
 *    `CanonicalRecipeSummary`, and the address (`recipes.normalized_url`)
 *    is deliberately NOT in that shape: `CanonicalRecipeDetailRow`'s own
 *    comment argues it belongs to a separate shape "so the list read cannot
 *    half-fill this one and have the difference land as `undefined` on a
 *    screen". Giving them one means widening a projection, a row type, a
 *    summary type, three presentation models and their fixtures — a spread
 *    across files this round does not own.
 *  - AND THEY SHOULD NOT. All three are BOARD-SHAPED: a ranked kring, a
 *    leaderboard capped at 25 rows, a proof feed assembled per read. None
 *    is populated by anything this household did. Re-signing thumbnails
 *    there means the device asking TikTok about posts nobody here ever
 *    imported, driven by a ranking rather than by a person looking at a
 *    dish — much closer to the "suggestie van bulk-verzamelen" §13 warns
 *    against than to "tonen".
 *
 * So the monogram remains the whole answer on those three surfaces, exactly
 * as it is today, and this hook behaves identically for them.
 *
 * ===========================================================================
 *
 * Failure is tracked BY URL rather than as a bare boolean, so a recycled
 * row that scrolls onto a different meal gets a fresh attempt without an
 * effect to reset it — a card must never inherit the previous one's
 * failure. The refreshed URL is tracked the same way, against the stored
 * URL it replaced, so it cannot leak onto the next meal a recycled row
 * lands on either.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { refreshThumbnail } from '@/lib/thumbnailRefresh';

export interface UseThumbnailFallbackResult {
  /**
   * The address to render — the refreshed one when there is one, otherwise
   * the stored one, and `null` when there is neither.
   *
   * CALL SITES MUST RENDER THIS AND NOT THE URL THEY PASSED IN. Reading
   * `meal.thumbnailUrl` straight into `<Image source>` was correct before
   * this hook could hand back a better address, and is silently wrong now:
   * the tile would flip from monogram to monogram and the refresh would buy
   * nothing at all.
   */
  readonly imageUrl: string | null;
  /** False when there is no URL at all, or when the URL currently on offer has already failed to load. */
  readonly showsImage: boolean;
  /** Pass straight to `<Image onError>`. */
  readonly onError: () => void;
}

interface RefreshedThumbnail {
  /** The stored URL this replaced. A recycled row landing on another meal discards it on sight. */
  readonly replaced: string;
  readonly url: string;
}

/**
 * @param thumbnailUrl The stored address, or null when the row has none.
 * @param sourceUrl The post this thumbnail came from, so a dead address can
 *   be re-signed. Omit it — or pass null — to keep today's exact behaviour:
 *   fall back to the monogram and ask nobody anything.
 */
export function useThumbnailFallback(
  thumbnailUrl: string | null,
  sourceUrl: string | null = null,
): UseThumbnailFallbackResult {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [refreshed, setRefreshed] = useState<RefreshedThumbnail | null>(null);

  // A refresh outlives the tile that asked for it — a fast scroll unmounts
  // rows while their calls are still queued. Writing state into an unmounted
  // component is a no-op rather than an error in React 18, but a guard says
  // what is meant instead of relying on that.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const refreshedUrl = refreshed !== null && refreshed.replaced === thumbnailUrl ? refreshed.url : null;
  const imageUrl = refreshedUrl ?? thumbnailUrl;

  const onError = useCallback(() => {
    setFailedUrl(imageUrl);

    // Rule 2 from the header: only the STORED address earns a call. A
    // refreshed one that also fails ends here, which is what makes the
    // error -> refresh -> render loop provably terminate.
    if (thumbnailUrl === null || imageUrl !== thumbnailUrl || sourceUrl === null) {
      return;
    }

    void refreshThumbnail(sourceUrl).then((url) => {
      // An address identical to the one that just failed is not an
      // improvement, and adopting it would render the same broken image
      // again.
      if (url === null || url === thumbnailUrl || !isMounted.current) {
        return;
      }
      setRefreshed({ replaced: thumbnailUrl, url });
    });
  }, [imageUrl, thumbnailUrl, sourceUrl]);

  return {
    imageUrl,
    showsImage: imageUrl !== null && failedUrl !== imageUrl,
    onError,
  };
}

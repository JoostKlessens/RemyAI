/**
 * THE YOUTUBE ROUTE of the recipe import function: read a video's own
 * description through the Data API, then hand it to the same caption tail
 * every TikTok import already runs. index.ts fans out to
 * `resolveYouTubeImport` below and does nothing else about a `'youtube'` URL.
 *
 * WHY IT IS A FILE AND NOT A BRANCH: THIS ROUTE IS A DOOR, NOT A PIPELINE.
 * Everything YouTube-specific about it happens before
 * `extractRecipeFromCaption` — resolve a video id, ask one licensed
 * endpoint, hand over a caption and an attribution — and everything after
 * that call is shared with TikTok and with a pasted text. Giving the door
 * its own module is what makes that shortness visible, and makes it plain
 * that a change to how a description is OBTAINED has nowhere to leak into
 * how it is READ.
 *
 * WHICH IS ALSO THE EDIT THIS FILE EXISTS TO DISCOURAGE. The most damaging
 * change available here is a local improvement to the model call for
 * YouTube specifically — a different prompt, an extra retry, a caption
 * pre-clean before handing it over. The entire value of
 * `extractRecipeFromCaption` being shared is that TikTok's and YouTube's
 * anti-hallucination behaviour cannot drift apart unless somebody decides
 * on purpose that they should differ; the blank-caption short-circuit lives
 * in that tail for the same reason. This file's job ends at handing four
 * values over, and a second tail branching from here would be a regression
 * however well it read.
 *
 * THE SEAM IS SAFE FOR THE SAME REASON THE WEB ROUTE'S IS.
 * `resolveImport` in index.ts returns this route before the display-only
 * check, before the canonical-cache lookup and before oEmbed — which is the
 * early return that leaves everything after it narrowed to
 * `OembedPlatform`. Nothing shared sits between this route and the front
 * door, so moving it reorders nothing.
 *
 * The cache lookup below is here and the write is not, and neither is this
 * file's choice. 0006_canonical_recipes.sql's CHECK rejects a `'youtube'`
 * parent row, so `canStoreCanonicalRecipe` refuses the write inside
 * canonicalRecipeStore.ts and short-circuits the lookup to null there
 * without a round trip. It is called anyway, from the position it would need
 * to occupy the day that CHECK is widened. index.ts's DEDUPLICATION section
 * carries that argument in full, including what `recipeId: null` costs the
 * social half of the product.
 *
 * The section below is index.ts's own, moved here intact because it argues
 * about this function. Its single edit is a pointer: the shared tail is
 * named by its module rather than called "below".
 *
 * ---
 *
 * THE YOUTUBE ROUTE (SRC-02/SRC-03): A DIFFERENT DOOR, THE SAME PIPELINE.
 *
 * A YouTube video's description is read through the YouTube Data API's
 * `videos.list?part=snippet` endpoint (`fetchYouTubeVideoSnippet`,
 * fetchSourceText.ts) — never through YouTube's oEmbed endpoint, which
 * carries the same embedding-only restriction Meta's does and would make
 * reading a description the exact prohibited use PD-011 rules out for
 * Instagram. displayOnlyPolicy.ts's header carries that comparison in
 * full; the short version is that YouTube is not display-only because a
 * DIFFERENT, licensed endpoint answers the question, not because nobody
 * checked.
 *
 * What comes back is a caption and an attribution — precisely what oEmbed
 * hands the TikTok path — so from there it runs the SAME code:
 * `extractRecipeFromCaption` (finishImport.ts) is the single tail both
 * platforms share, including the "caption is blank, so the model is never called"
 * short-circuit. Forking it would let one platform's anti-hallucination
 * behaviour drift from the other's without anything noticing.
 *
 * `YOUTUBE_API_KEY` is optional at boot and its absence is a typed,
 * user-visible `source_fetch_failed` / `missing_credentials` — never a
 * silent skip, and never a reason for TikTok import to stop working. See
 * env.ts's header for why that credential is read differently from
 * `GEMINI_API_KEY`.
 */

// Deno needs fully-specified relative import specifiers, so every one of
// these spells out `.ts` — including the two domain modules, which the rest
// of this repo imports without an extension. index.ts's closing header
// section argues that in full; the short version is that dropping an
// extension anywhere in this chain fails nothing locally and fails the
// deploy.
import type { ImportResult } from '../../../src/domain/import/types.ts';
import { readYouTubeVideoId } from '../../../src/domain/import/urlParsing.ts';
import { findStoredRecipe } from './canonicalRecipeStore.ts';
import { fetchYouTubeVideoSnippet } from './fetchSourceText.ts';
import { extractRecipeFromCaption } from './finishImport.ts';
import type { ImportSpendRecorder } from './importBudget.ts';

/**
 * THE YOUTUBE ROUTE (SRC-02/SRC-03). The Data API's `videos.list` snippet
 * — never YouTube's oEmbed endpoint, see the header — and then the shared
 * caption pipeline every TikTok import already runs.
 */
export async function resolveYouTubeImport(
  normalizedUrl: string,
  spend: ImportSpendRecorder,
): Promise<ImportResult> {
  const cached = await findStoredRecipe(normalizedUrl, 'youtube');
  if (cached !== null) {
    return cached;
  }

  const videoId = readYouTubeVideoId(normalizedUrl);
  if (videoId === null) {
    // Unreachable in theory and loud on purpose: THIS FUNCTION PRODUCED
    // that URL, via `normalizeRecipeUrl`, which only emits the canonical
    // `watch?v=<id>` form. A null here means the writer and the reader of
    // that form have stopped agreeing — a bug in our own code, not a
    // problem with the user's link — and it would otherwise look to a user
    // exactly like a dead video.
    console.error(`parse-recipe: normalized YouTube URL carried no readable video id. url=${normalizedUrl}`);
    return { kind: 'source_fetch_failed', reason: 'refused', platform: 'youtube' };
  }

  const snippet = await fetchYouTubeVideoSnippet(videoId);
  if (snippet.kind === 'failed') {
    // Includes `missing_credentials` when YOUTUBE_API_KEY is unset — the
    // same honest, actionable failure Instagram gives without its oEmbed
    // token, and never a silent skip. Naming `'youtube'` keeps that reason
    // readable: this variant is shared with the web route, where an unset
    // key cannot happen, so the one failure with a named fix would
    // otherwise be counted as ambiguous.
    return { kind: 'source_fetch_failed', reason: snippet.reason, platform: 'youtube' };
  }

  return extractRecipeFromCaption({
    sourceUrl: normalizedUrl,
    platform: 'youtube',
    caption: snippet.value.caption,
    attribution: snippet.value.attribution,
    spend,
    // A model's reading of prose a creator published beside their own video.
    // Stated here rather than defaulted inside the shared tail, because this
    // route is the only code that knows how these particular words were
    // obtained — see the PROVENANCE section in index.ts's header.
    provenance: 'model_from_caption',
  });
}

/**
 * Which platforms the import pipeline is allowed to extract from, and what
 * it returns for the ones it isn't.
 *
 * TWO DIFFERENT USES OF ONE ENDPOINT. An oEmbed endpoint answers a single
 * URL you already hold with a thumbnail, a title, an author name and a link
 * back to the post. Rendering that — showing the post, credited, and
 * sending the viewer to the original — is what the endpoint exists for.
 * Reading the same response's title as a caption and deriving a stored
 * recipe from it is a different act that merely happens to reuse the same
 * bytes.
 *
 * Instagram licenses only the first. Meta's documentation states the
 * endpoint is "only meant to be used for embedding Instagram content in
 * websites and apps. Any other use of metadata or content is prohibited",
 * and the endpoint itself refuses unapproved apps outright: "(#10) To use
 * 'Meta oEmbed Read', your use of this endpoint must be reviewed and
 * approved by Facebook." Extraction is the prohibited use, so Instagram
 * resolves the post and stops there — see docs/PRODUCT-DECISIONS.md PD-011.
 *
 * TikTok is untouched by any of this: its oEmbed is publicly documented
 * with no equivalent restriction, and full caption extraction continues
 * exactly as before.
 *
 * YOUTUBE (SRC-02/SRC-03) IS THE THIRD PLATFORM, AND IT IS NOT DISPLAY-ONLY
 * EITHER — but for a different reason than TikTok's "no restriction exists
 * at all." YouTube's oEmbed endpoint (`youtube.com/oembed`) carries the
 * same embedding-only restriction Instagram's does, and extracting from
 * ITS response would be exactly the prohibited use PD-011 rules out for
 * Instagram. The reason YouTube still gets full extraction is that this
 * pipeline is not meant to read YouTube via oEmbed at all: the YouTube
 * Data API's `videos.list` endpoint (`part=snippet`), a SEPARATE,
 * documented API, is explicitly licensed for reading a video's title and
 * description for purposes beyond embedding — the same class of use
 * Meta's oEmbed endpoint forbids. So "does this platform license
 * extraction" still resolves per-platform, exactly as it does for
 * Instagram; YouTube's answer is just "yes, through a different endpoint
 * than the one that says no." `isDisplayOnlyPlatform` below is written
 * against that conclusion, not against "every platform besides Instagram
 * defaults to yes" — see its own doc comment.
 *
 * NOTHING IN THIS FILE CALLS THE YOUTUBE DATA API, and that is now a
 * statement about layering rather than about something missing. The call
 * exists: supabase/functions/parse-recipe/index.ts resolves a YouTube
 * video through `videos.list` beside its oEmbed client, and the typed
 * failures of that call come back as `source_fetch_failed` (types.ts).
 * This module still makes no request of any kind, because "may we extract
 * from this platform" is a licensing question answerable from data already
 * in hand — which is precisely why it belongs in a pure, tested module and
 * the fetch does not.
 *
 * `'web'` IS THE FOURTH PLATFORM, AND IT IS NOT DISPLAY-ONLY EITHER — the
 * explicit decision `isDisplayOnlyPlatform`'s own note below demands
 * instead of an inherited one. An ordinary page's schema.org/Recipe
 * JSON-LD is published BY THE SITE, expressly so that machines will read
 * it: that is what the vocabulary is FOR, and Google's rich results are
 * the reason nearly every recipe site emits it. There is no counterpart to
 * Meta's embedding-only clause because there is no metadata endpoint and
 * no terms of use standing between us and the page — the publisher put a
 * machine-readable recipe in the document they served. So `'web'` gets
 * full extraction, and unlike the other three it needs no model to do it.
 *
 * What that does NOT license is republishing the page's prose or its
 * photographs, and the pipeline stores neither: a recipe's ingredients and
 * steps come out of the structured object, and attribution stays an
 * obligation for a web import exactly as it is for a video (PD-007,
 * buildAttribution.ts).
 *
 * This module is the single place where the per-platform extraction
 * decision is made, so "which platforms may we extract from" is one
 * function to read rather than a condition scattered across the pipeline.
 *
 * WHY THIS IS A DOMAIN MODULE RATHER THAN AN `if` IN THE EDGE FUNCTION.
 * supabase/functions/parse-recipe/index.ts is Deno code, deliberately
 * excluded from both `tsc --noEmit` and ESLint (see its file header), so
 * anything that lives there is neither type-checked nor unit-tested by this
 * repo. "Never send an Instagram caption to the model" is precisely the
 * kind of rule that has to be provable in a test rather than trusted to an
 * unreachable branch — the same reasoning that already put response
 * narrowing in canonicalRecipe.ts instead of in the function.
 */

import { buildAttribution } from './buildAttribution.ts';
import type { OembedPayload } from '../../lib/oembed';
import type { ImportPlatform, ImportResult } from './types';

/** The one `ImportResult` member this module ever produces — see its doc comment in types.ts. */
export type DisplayOnlyImportResult = Extract<ImportResult, { readonly kind: 'display_only' }>;

/**
 * A plain comparison, not a configurable set: there are five platforms,
 * and the answer for each follows from a specific published policy rather
 * than from a preference someone might want to tune. A config flag would
 * invite switching Instagram extraction back on without the approval
 * PD-011 describes — the one change this must not make easy.
 *
 * Written as `platform === 'instagram'` rather than `platform !==
 * 'tiktok'` on purpose. The latter reads as "display-only is the default,
 * and TikTok is the one carve-out" — which happens to give YouTube the
 * right answer (`false`, full extraction) but for the wrong reason: it
 * would do so by accident, because YouTube isn't TikTok, not because
 * anyone confirmed the Data API licenses it. A platform added here should
 * have to be looked at and explicitly decided, not silently inherit "not
 * display-only" by failing to match a growing exclusion list.
 *
 * THAT DECISION HAS NOW BEEN MADE THREE TIMES, and every answer is
 * recorded rather than left implied by this expression: YouTube is not
 * display-only because the Data API licenses reading a video's snippet,
 * `'web'` is not display-only because a page's schema.org JSON-LD is
 * published for machines to read in the first place, and `'text'`
 * (SRC-08) is not display-only because there is no third party's post
 * involved at all — the user pasted the recipe themselves, so there is no
 * licence to respect, no post to render and no creator to credit
 * (`NO_CREATOR_TO_CREDIT`, buildAttribution.ts). That last one is the
 * clearest case yet of why this must not become "everything except
 * TikTok": a route with nothing to license would have inherited a
 * licensing restriction by failing to match a name. None of the three
 * conclusions follows from `platform === 'instagram'` — the expression is
 * just where they end up agreeing, and the header is where they were
 * argued.
 */
export function isDisplayOnlyPlatform(platform: ImportPlatform): boolean {
  return platform === 'instagram';
}

export interface DisplayOnlyInput {
  /** The oEmbed-resolved, normalized post URL. */
  readonly sourceUrl: string;
  readonly platform: ImportPlatform;
  /** The payload oEmbed already returned. Only its attribution fields are read — see below. */
  readonly payload: OembedPayload;
}

/**
 * Builds the display-only result for an already-resolved post.
 *
 * THE GUARANTEE THIS FUNCTION EXISTS TO MAKE. `payload.title` — the
 * caption — is never read here, and `DisplayOnlyImportResult` has nowhere
 * to put it. `buildAttribution` reads `authorName`, `authorUrl` and
 * `thumbnailUrl` and nothing else, so every field that survives into the
 * response is one the platform publishes precisely so it can be displayed.
 * That turns "the caption never leaves the server" into a property of one
 * small pure function with a test asserting it
 * (tests/import/displayOnlyPolicy.test.ts), instead of a rule spread across
 * a pipeline where a single added field would quietly break it.
 *
 * It takes the whole `OembedPayload` rather than a pre-built
 * `ImportAttribution` on purpose: this is then the ONE place where a
 * resolved payload becomes a display-only response, which is exactly what
 * makes the guarantee above checkable in one sitting.
 */
export function buildDisplayOnlyResult(input: DisplayOnlyInput): DisplayOnlyImportResult {
  return {
    kind: 'display_only',
    platform: input.platform,
    sourceUrl: input.sourceUrl,
    attribution: buildAttribution(input.payload),
  };
}

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
 * exactly as before. This module is the single place where that difference
 * is decided, so "which platforms may we extract from" is one function to
 * read rather than a condition scattered across the pipeline.
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
 * A plain comparison, not a configurable set: there are exactly two
 * platforms, and the answer for each follows from a specific published
 * policy rather than from a preference someone might want to tune. A config
 * flag would invite switching Instagram extraction back on without the
 * approval PD-011 describes — the one change this must not make easy.
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

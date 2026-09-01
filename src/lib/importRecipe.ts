/**
 * The client half of recipe import: one POST to the `parse-recipe` Edge
 * Function, narrowed into the same `ImportResult` the screens already
 * switch on.
 *
 * This module is the impure shell and nothing else. Every judgement it
 * makes about the response body lives in the pure, tested
 * `parseImportResult` (src/domain/import/parseImportResult.ts) — this file
 * only performs the call and maps the ways a call can fail outright.
 *
 * WHY TRANSPORT FAILURES BECOME `llm_request_failed`. The edge function
 * answers 200 for every outcome it actually anticipates, including all of
 * its failures, so a non-2xx or a thrown fetch means the request never
 * completed a round trip we can reason about. `llm_request_failed` is the
 * variant whose own doc comment already covers exactly that ("could not
 * be reached, or returned a transport-level failure (network error,
 * non-2xx, rate limit)"), and whose copy — "Even niet gelukt … probeer
 * het opnieuw" — is the honest thing to show. It is deliberately NOT
 * mapped to `parse_failed`, which tells the user their video probably has
 * no written recipe: that would blame the video for our outage.
 *
 * A response body we cannot narrow lands in the same place, for the same
 * reason: an unrecognized shape means we did not get a usable answer, and
 * retrying is the right advice.
 *
 * ATTRIBUTION ACROSS FAILURE PATHS (IMP-02). `authorName`, `authorUrl` and
 * `thumbnailUrl` are read off `attribution`, which the function returns on
 * three variants: `parsed`, `display_only` (PD-011, where crediting the
 * creator is the entire point) and `no_recipe_in_caption` (IMP-02 —
 * required there too, since the function only ever constructs that variant
 * after the source has already resolved; see its doc comment in types.ts).
 * A user who falls back to manual entry after `no_recipe_in_caption`
 * reaches the confirm screen with the same creator the function already
 * had in hand to build its extraction prompt.
 *
 * `authorUrl` joined the other two when `'web'` joined `ImportPlatform`.
 * It was previously dropped here and rebuilt downstream from the platform
 * plus the display name — which works only for TikTok and Instagram, whose
 * profile URLs are a handle in a fixed path. A YouTube channel URL is keyed
 * on an id `snippet.channelTitle` does not contain, and a recipe site's
 * author page follows no pattern at all, so for both of the new platforms
 * the link is either carried from the source or it does not exist. See
 * `ImportAttempt.authorUrl`.
 *
 * WHICH VARIANTS STILL CARRY NO CREATOR, AND WHY THEY DIFFER.
 * `llm_request_failed` and `parse_failed` are returned AFTER the source
 * text was fetched, so the function does have an attribution in hand for
 * them and does not send it — a real, structurally identical gap to the
 * one IMP-02 closed, still open because IMP-02 asked only for
 * `no_recipe_in_caption`. The other four are different in kind and are not
 * gaps at all: `unsupported_url` never fetches anything;
 * `oembed_failed` and `source_fetch_failed` are defined by the fetch
 * itself having failed; and `no_recipe_on_page` fetched a page
 * successfully but found no structured object, which is precisely the only
 * thing on a web page we are willing to treat as a source (types.ts). None
 * of the four has a payload to build an attribution from, even in
 * principle.
 */

import { parseImportResult } from '@/domain/import/parseImportResult';
import type { ImportResult } from '@/domain/import/types';
import { supabase } from './supabase';

const PARSE_RECIPE_FUNCTION = 'parse-recipe';

export interface ImportAttempt {
  readonly result: ImportResult;
  /** From the `parsed`, `display_only`, or `no_recipe_in_caption` variant's attribution (IMP-02) — see the file header's "WHAT IS STILL LEFT" note for the variants that still carry none. */
  readonly authorName: string | null;
  /**
   * The creator's own profile/channel/author page, straight off the same
   * attribution, and the reason it is carried rather than reconstructed
   * downstream: IT CANNOT BE RECONSTRUCTED. `buildAttribution.ts` makes
   * this argument for TikTok and Instagram (a display name is not reliably
   * a URL-safe handle, so guessing produces plausible links to the wrong
   * account) and the two newer platforms make it unanswerable rather than
   * merely risky — a YouTube channel URL is keyed on a channel id that
   * `snippet.channelTitle` does not contain, and a web page's author has
   * no URL pattern at all. Without this field the confirmation screen can
   * name a creator and cannot link to one, which for PD-007 attribution is
   * the difference between a credit and a mention.
   */
  readonly authorUrl: string | null;
  readonly thumbnailUrl: string | null;
}

const TRANSPORT_FAILURE: ImportAttempt = {
  result: { kind: 'llm_request_failed' },
  authorName: null,
  authorUrl: null,
  thumbnailUrl: null,
};

function toAttempt(result: ImportResult): ImportAttempt {
  // One branch for all three attribution-carrying variants, where `parsed`
  // used to need its own optional-chained copy. That asymmetry is gone
  // because `ImportResult.parsed.attribution` is now REQUIRED (types.ts):
  // every producer states it, and `parseImportResult` materialises an
  // all-null one for a response older than the field, so there is no
  // longer a version of `parsed` whose creator is `undefined` rather than
  // null. The remaining variants — `unsupported_url`, `oembed_failed`,
  // `no_recipe_on_page`, `source_fetch_failed`, and the two LLM failures
  // named in the header — genuinely have no attribution to read.
  if (result.kind === 'parsed' || result.kind === 'display_only' || result.kind === 'no_recipe_in_caption') {
    return {
      result,
      authorName: result.attribution.authorName,
      authorUrl: result.attribution.authorUrl,
      thumbnailUrl: result.attribution.thumbnailUrl,
    };
  }
  return { result, authorName: null, authorUrl: null, thumbnailUrl: null };
}

/**
 * Only ever called with a URL that already passed the caller's own
 * `normalizeRecipeUrl` check, mirroring the edge function's pipeline
 * order — an obviously unsupported link never costs a round trip.
 *
 * Never throws: every failure it can reach is returned as a typed
 * `ImportResult`, so callers have no error path to forget.
 */
export async function requestImport(normalizedUrl: string): Promise<ImportAttempt> {
  try {
    const { data, error } = await supabase.functions.invoke<unknown>(PARSE_RECIPE_FUNCTION, {
      body: { url: normalizedUrl },
    });
    if (error) {
      return TRANSPORT_FAILURE;
    }
    const result = parseImportResult(data);
    return result === null ? TRANSPORT_FAILURE : toAttempt(result);
  } catch {
    return TRANSPORT_FAILURE;
  }
}

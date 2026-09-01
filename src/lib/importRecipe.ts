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
 * ATTRIBUTION ACROSS FAILURE PATHS (IMP-02). `authorName` and
 * `thumbnailUrl` are read off `attribution`, which the function now
 * returns on three variants: `parsed`, `display_only` (PD-011, where
 * crediting the creator is the entire point and the attribution is
 * mandatory rather than optional) and, as of IMP-02, `no_recipe_in_caption`
 * — required there too, since the function only ever constructs that
 * variant after oEmbed has already resolved (see its own doc comment in
 * types.ts). A user who falls back to manual entry after
 * `no_recipe_in_caption` now reaches the confirm screen with the same
 * creator the function already had in hand to build its extraction prompt.
 *
 * WHAT IS STILL LEFT, DELIBERATELY OUT OF THIS CHANGE'S SCOPE.
 * `llm_request_failed` and `parse_failed` are both returned AFTER oEmbed
 * has resolved too (`callExtractionModel`/`parseExtractionResponse` run on
 * an already-fetched caption), so the function technically has an
 * attribution in hand there as well — but IMP-02 only asked for
 * `no_recipe_in_caption`, and widening those two was not part of it. This
 * is a real, structurally identical gap on those two variants, not a
 * stale note; `unsupported_url` and `oembed_failed` are different in
 * kind — the first never reaches oEmbed at all, and the second is defined
 * by oEmbed itself having failed, so neither has a payload to build an
 * attribution from even in principle.
 */

import { parseImportResult } from '@/domain/import/parseImportResult';
import type { ImportResult } from '@/domain/import/types';
import { supabase } from './supabase';

const PARSE_RECIPE_FUNCTION = 'parse-recipe';

export interface ImportAttempt {
  readonly result: ImportResult;
  /** From the `parsed`, `display_only`, or `no_recipe_in_caption` variant's attribution (IMP-02) — see the file header's "WHAT IS STILL LEFT" note for the variants that still carry none. */
  readonly authorName: string | null;
  readonly thumbnailUrl: string | null;
}

const TRANSPORT_FAILURE: ImportAttempt = {
  result: { kind: 'llm_request_failed' },
  authorName: null,
  thumbnailUrl: null,
};

function toAttempt(result: ImportResult): ImportAttempt {
  if (result.kind === 'parsed') {
    return {
      result,
      authorName: result.attribution?.authorName ?? null,
      thumbnailUrl: result.attribution?.thumbnailUrl ?? null,
    };
  }
  if (result.kind === 'display_only' || result.kind === 'no_recipe_in_caption') {
    // Not optional-chained, unlike `parsed` above: on both of these
    // variants attribution is required by the type — on `display_only`
    // because showing a post we may not extract from is only defensible
    // with its creator attached (PD-011), and on `no_recipe_in_caption`
    // because the function never constructs it before oEmbed has already
    // resolved (IMP-02, types.ts). Reading it directly is the point on
    // both, not an oversight.
    return {
      result,
      authorName: result.attribution.authorName,
      thumbnailUrl: result.attribution.thumbnailUrl,
    };
  }
  return { result, authorName: null, thumbnailUrl: null };
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

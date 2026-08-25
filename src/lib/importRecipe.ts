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
 * KNOWN GAP — creator attribution on failure paths. `authorName` and
 * `thumbnailUrl` are read off the `parsed` variant's `attribution`, which
 * is the only place the function returns them. Its failure variants carry
 * no attribution, so a user who falls back to manual entry after
 * `no_recipe_in_caption` reaches the confirm screen with no creator
 * attached, even though the function resolved one via oEmbed to build the
 * prompt. src/app/import/_fixtures.ts fakes a creator on those paths, so
 * this is a real behavioural difference from the fixture flow rather than
 * a regression in the screens. Closing it means returning attribution on
 * `no_recipe_in_caption` too — a change to the function and to
 * `ImportResult`, deliberately not smuggled in here.
 */

import { parseImportResult } from '@/domain/import/parseImportResult';
import type { ImportResult } from '@/domain/import/types';
import { supabase } from './supabase';

const PARSE_RECIPE_FUNCTION = 'parse-recipe';

export interface ImportAttempt {
  readonly result: ImportResult;
  /** From the `parsed` variant's attribution only — see the file header's KNOWN GAP note. */
  readonly authorName: string | null;
  readonly thumbnailUrl: string | null;
}

const TRANSPORT_FAILURE: ImportAttempt = {
  result: { kind: 'llm_request_failed' },
  authorName: null,
  thumbnailUrl: null,
};

function toAttempt(result: ImportResult): ImportAttempt {
  if (result.kind !== 'parsed') {
    return { result, authorName: null, thumbnailUrl: null };
  }
  return {
    result,
    authorName: result.attribution?.authorName ?? null,
    thumbnailUrl: result.attribution?.thumbnailUrl ?? null,
  };
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

/**
 * ---------------------------------------------------------------------------
 * THE MODEL CALL, AND THE KEY THAT PAYS FOR IT
 * ---------------------------------------------------------------------------
 *
 * One outbound request and one credential. This module exists for the reason
 * canonicalRecipeStore.ts and fetchSourceText.ts already exist: a secret whose
 * blast radius is ONE IMPORTABLE FILE is a secret a reviewer can bound in a
 * sitting. `SUPABASE_SERVICE_ROLE_KEY` lives in the only module that writes
 * the canonical tables; `YOUTUBE_API_KEY` lives in the only module that talks
 * to a host a user chose; `GEMINI_API_KEY` now lives in the only module that
 * talks to the model. "Where can this key be read from?" should be answerable
 * with a filename, not with a search.
 *
 * It is deliberately NOT part of fetchSourceText.ts, whose header draws its
 * boundary at requests to a host A USER CHOSE. This endpoint is one this repo
 * picked, it is fixed, and it carries our own credential — the same
 * distinction that keeps src/lib/oembed.ts separate. Merging them would put
 * the SSRF argument and the token-cost argument in one file, and they are not
 * the same argument.
 *
 * ---
 *
 * THE KEY IS NEVER IN A URL, NEVER IN A RESPONSE, AND NEVER IN A LOG. It
 * travels as an `x-goog-api-key` header (query strings end up in proxy logs,
 * referrer headers and crash reports; headers do not), it is not echoed into
 * this function's own JSON body, and the only thing logged from a rejection
 * is Gemini's own truncated response — which cannot contain it, because the
 * request never put it anywhere Gemini would echo back. See index.ts's
 * SECURITY section for the reason extraction happens server-side at all: a
 * key shipped inside a mobile bundle is just a string in a downloadable file.
 *
 * ---
 *
 * WHY EVERY FAILURE HERE COLLAPSES TO ONE `{ kind: 'error' }`. A rejected
 * schema, a bad model id, an exhausted quota and a TLS timeout are four
 * different operational facts and exactly one product fact: this import could
 * not be extracted. The caller maps all of them to `llm_request_failed`, so a
 * richer return type would buy the pipeline nothing it could act on. The
 * operational detail is not lost, it is sent where it is usable — the
 * `console.error` calls below, which an operator reads and a user never sees.
 * That split is the same one `mapHttpStatusToReason` makes in
 * fetchSourceText.ts, for the same reason.
 *
 * THE `.ts` EXTENSIONS BELOW ARE LOAD-BEARING — Deno's resolution rule, see
 * index.ts's header. Nothing local catches a missing one; the deploy does.
 */

import { buildExtractionEndpoint, buildExtractionRequest } from '../../../src/domain/import/buildExtractionRequest.ts';
import { readOptionalEnvVar, readRequiredEnvVar } from './env.ts';

// Fails loudly at module load — mirrors src/lib/supabase.ts's
// readRequiredEnvVar pattern. A function that silently no-ops (or, worse,
// silently skips extraction) without a configured key is a much harder
// failure to notice than one that refuses to boot at all. This module is
// imported by index.ts at load, so "boot" still means the deploy rather than
// the first caption to arrive.
const GEMINI_API_KEY = readRequiredEnvVar('GEMINI_API_KEY');

// Structured extraction behind a forced function call — no deep reasoning
// needed, so Flash-Lite is the deliberate choice, not a placeholder. It is
// roughly a third the cost of the Flash tier for this workload.
//
// THE RISK THIS TRADES FOR COST: the anti-hallucination design in
// buildExtractionRequest.ts depends on the model honestly calling
// report_no_recipe for a caption with no real recipe, and honest refusal is
// the first thing a smaller model gets worse at. If invented recipes start
// appearing, raise this to a Flash tier before touching the prompt.
//
// This is a floating alias; pin an exact dated snapshot via the GEMINI_MODEL
// secret before relying on this in production, so a silent model upgrade
// cannot silently change extraction behavior.
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

// `readOptionalEnvVar` rather than a raw `Deno.env.get`, so this module needs
// no ambient `Deno` declaration of its own — and so a GEMINI_MODEL set to
// whitespace falls back to the default instead of building an endpoint URL
// with a blank model id in it. Blank is not configured; env.ts's header
// argues that at length.
const GEMINI_MODEL = readOptionalEnvVar('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL;

/**
 * Matches the truncation fetchSourceText.ts and canonicalRecipeStore.ts
 * already use when logging a third party's error body.
 */
const MAX_LOGGED_BODY_CHARS = 600;

/**
 * Raw JSON on success, one undifferentiated error otherwise — see the file
 * header for why there is no third case. The `json` is `unknown` on purpose:
 * deciding what Gemini's answer MEANS belongs to `parseExtractionResponse` in
 * the pure domain layer, where it is unit-tested, and this module must not
 * pre-judge it on the way past.
 */
export type LlmCallResult = { readonly kind: 'ok'; readonly json: unknown } | { readonly kind: 'error' };

export async function callExtractionModel(caption: string, authorName: string | null): Promise<LlmCallResult> {
  const requestBody = buildExtractionRequest({ caption, authorName });
  try {
    const response = await fetch(buildExtractionEndpoint(GEMINI_MODEL), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Header rather than a "?key=" query parameter, and never
        // included in this function's own response — see this file's and
        // index.ts's SECURITY notes, and buildExtractionEndpoint().
        'x-goog-api-key': GEMINI_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      // Gemini distinguishes a bad model id, a rejected schema and a bad
      // key by status + message, and swallowing them here makes an
      // extraction outage undebuggable from the outside: every one of
      // them surfaces to the user as the same "Even niet gelukt". The
      // request body carries no user secrets and the API key travels in a
      // header, so neither can appear in what is logged.
      const detail = await response.text().catch(() => '<unreadable body>');
      console.error(
        `parse-recipe: Gemini rejected the request. status=${response.status} ` +
          `model=${GEMINI_MODEL} body=${detail.slice(0, MAX_LOGGED_BODY_CHARS)}`,
      );
      return { kind: 'error' };
    }
    const json: unknown = await response.json();
    return { kind: 'ok', json };
  } catch (error) {
    // Transport-level failure (DNS, TLS, timeout) — distinct from a
    // non-2xx above, and worth telling apart in the logs.
    console.error(`parse-recipe: Gemini call threw before a response. ${String(error)}`);
    return { kind: 'error' };
  }
}

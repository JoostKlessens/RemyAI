/**
 * ---------------------------------------------------------------------------
 * EVERYTHING THIS FUNCTION SAYS OUT LOUD
 * ---------------------------------------------------------------------------
 *
 * Two audiences, one small file: the client that receives a JSON response,
 * and the operator who greps a log months later. They are here together
 * because the second has to be a CONSEQUENCE of the first.
 *
 * IMP-07 is a question nobody on this project can currently answer — "how
 * often does extraction actually fail, and at which step?" — and the reason
 * they cannot is that no import has ever left a countable trace. The obvious
 * fix is a log line somewhere in the handler. The reason it is here instead
 * is that a count which is a separate act from answering the client is a
 * count somebody eventually forgets to perform for the one new branch they
 * added, and a denominator with a hole in it is worse than no denominator:
 * it still reads as a measurement. So `respondWithImportResult` does both,
 * and it is the only way an `ImportResult` reaches a client at all.
 *
 * WHAT THAT BUYS STRUCTURALLY RATHER THAN BY DISCIPLINE:
 *
 *  - EXACTLY ONCE per import. One call site, and it is the one that builds
 *    the response. A line cannot be emitted twice for a single request — two
 *    would silently double a denominator — nor skipped for the outcomes
 *    somebody assumed were uninteresting. The successes are counted too, and
 *    that is not thoroughness: a failure RATE needs both halves of its
 *    fraction, and a log containing only failures can only ever report that
 *    failures happened.
 *  - NEVER for a non-outcome. The CORS preflight and the malformed-request
 *    400/405 replies are built by `corsPreflightResponse` and `jsonResponse`,
 *    which know nothing about telemetry. A preflight is not an import; a POST
 *    with no `url` in its body never became one, so it has no outcome to
 *    report. Counting either would inflate the denominator with traffic that
 *    never reached the pipeline. The unexpected-error 500 is excluded for the
 *    same reason plus one more: it has no `ImportResult` to describe, being
 *    precisely the case this function failed to model, and `console.error`
 *    already carries it with a stack.
 *
 * ---
 *
 * IT COUNTS, AND IT DOES NOTHING ELSE. No duration, no user id, no household
 * id, no URL, no caption, no recipe title, no ingredient, no error body.
 *
 * THE ENFORCEMENT IS THE TYPE, NOT THIS PARAGRAPH. `ImportTelemetryEvent`
 * (src/domain/import/importTelemetry.ts) has nowhere to put any of those, and
 * `formatImportTelemetryLine` can only render what the event holds. Nothing
 * is redacted here, because nothing sensitive is ever assembled. This repo
 * already makes that argument twice, and it is the same argument both times:
 * the `display_only` variant has no caption field, so no code path can leak
 * one (PD-011), and `shared_cooks` records that a friend cooked a dish
 * without a column for anything about the friend. A guard that has to
 * REMEMBER to redact is a guard that eventually forgets.
 *
 * SO DO NOT ADD A FIELD, and least of all "just for debugging". A URL is the
 * link a person pasted; a title or an ingredient is the recipe itself; a
 * household id re-identifies every other line in the same log. And PD-005
 * puts a floor under this that is not a preference: dietary and allergen data
 * is GDPR Article 9 SPECIAL-CATEGORY health data, held to explicit unbundled
 * consent and to hard deletion. Nothing on the import path carries any today
 * — a `ParsedRecipe` has ingredients, not restrictions — and the reason to
 * write that down rather than rely on it is that a log line is exactly where
 * such a value arrives by accident, in a change whose author was thinking
 * about something else entirely. A special-category value in an aggregated
 * log is not hard-deletable on request, which makes this the one place the
 * mistake cannot be taken back.
 *
 * ---
 *
 * `console.log`, NOT `console.error`, INCLUDING FOR THE FAILURES. Every
 * `ImportResult` is a modeled, expected answer; "this caption has no recipe"
 * is the outcome the whole feature was designed around, not a fault. On the
 * error stream it would sit beside a rejected Gemini request and a thrown
 * YouTube call, and whoever is looking would have to sort real breakage from
 * somebody pasting a link to a cat video. The genuine `console.error` calls
 * elsewhere in this function stay exactly where they are; this is
 * deliberately not one of them.
 *
 * WHY A LOG LINE AND NOT A TABLE, chosen rather than discovered. This ships
 * with no migration, so it answers "what share of imports failed, and which
 * kind" from whatever window the platform retains — and nothing outside that
 * window, nothing joined to another table, and no trend older than the log
 * itself. If those questions turn out to matter, that is a schema decision
 * for the owner to take deliberately, not something to smuggle in as one
 * more field here.
 *
 * THE `.ts` EXTENSIONS BELOW ARE LOAD-BEARING — Deno's resolution rule, see
 * index.ts's header. Nothing local catches a missing one; the deploy does.
 */

import {
  buildImportTelemetryEvent,
  formatImportTelemetryLine,
} from '../../../src/domain/import/importTelemetry.ts';
import type { ImportResult } from '../../../src/domain/import/types.ts';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Every REACHABLE import outcome is a 200 with a typed body, failures
 * included — see index.ts's header for why non-2xx is reserved for a
 * malformed request or an unexpected throw. Named so the one line that
 * depends on it says which rule it is obeying.
 */
const IMPORT_RESULT_STATUS = 200;

/** The CORS preflight: headers, no body, and emphatically not an import outcome. */
export function corsPreflightResponse(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * A JSON response that counts nothing — the right tool for the two replies
 * that are about the REQUEST rather than about an import (a malformed body, a
 * wrong method) and for the unexpected-error 500. `status` is required rather
 * than defaulted: after the split below, every caller of this function is a
 * non-200 by definition, so a default of 200 would only ever be wrong.
 */
export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * The single door an `ImportResult` leaves through: count it, then answer
 * with it. Both halves, always, in that order — see the file header for why
 * they are one function rather than two adjacent statements at the call site.
 *
 * The event is built from the result and from nothing else. There is no
 * second argument, and adding one is the change this file exists to argue
 * against.
 */
export function respondWithImportResult(result: ImportResult): Response {
  console.log(formatImportTelemetryLine(buildImportTelemetryEvent(result)));
  return jsonResponse(result, IMPORT_RESULT_STATUS);
}

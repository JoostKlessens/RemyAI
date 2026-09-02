/**
 * ---------------------------------------------------------------------------
 * WHAT A CLIENT IS ALLOWED TO SEND
 * ---------------------------------------------------------------------------
 *
 * One question, asked once, before an import exists: is this body something
 * the pipeline can even start on? It is a module of its own for the same
 * reason importResponse.ts is one — a boundary is where a guarantee is
 * actually made, and a guarantee living in the opening lines of a handler is
 * a guarantee somebody edits past while thinking about something else.
 *
 * THE BODY IS A CHOICE NOW, WHICH IS WHY GUESSING IS BANNED IN THIS FILE.
 * `{ url }` is a link the user pasted; `{ text }` is a recipe the user pasted
 * — out of a message, an email, or typed off a photo. They are different
 * sources, they take different routes, and NOTHING DOWNSTREAM CAN TELL THEM
 * APART, because by then each is only a string. So all three ways a body can
 * be unusable are refused here, while the distinction still exists:
 *
 *  - NEITHER FIELD — there is nothing to import. (The only case the old
 *    `readUrlFromRequest` had to cover.)
 *  - BOTH FIELDS, which is the case this module exists for. A body carrying a
 *    URL and a text is not a request with a sensible default; it is a caller
 *    that does not know what it is asking for. Picking one — "url wins", say
 *    — would import the wrong thing SILENTLY, and keep doing it for as long
 *    as the bug lived: a client that failed to clear a stale `url` when its
 *    user switched to pasting text would import last week's link, hand back a
 *    perfectly valid recipe, and leave that user no way to discover that the
 *    text they pasted was never read. There is no answer available here that
 *    is right more often than refusing is. Refusing is also what keeps the
 *    paste screen honest: that screen offers ONE input at a time
 *    (src/app/import/paste.tsx), so "both" is unrepresentable in the UI and
 *    refused at the boundary, and the two agree by construction rather than
 *    by luck.
 *  - BLANK — a `text` of spaces and newlines is not a recipe, and a request
 *    that spends a model call proving that is a request we paid for twice.
 *
 * ---
 *
 * THE LENGTH CAP IS A BILL DEFENCE, AND IT IS NOT THIS FILE'S DECISION.
 * `MAX_PASTED_RECIPE_TEXT_CHARS` and the `readPastedText` classification are
 * imported from src/domain/import/pastedTextLimits.ts, which argues the
 * number, the unit and the trimming in full — and which the paste screen
 * calls too, so the two ends of the wire cannot hold different opinions
 * about what is too long. What this file decides is only what a REQUEST that
 * fails that check gets back.
 *
 * WHAT THE CAP DOES NOT BOUND, said out loud rather than discovered later:
 * the request body itself. By the time it is consulted, `request.json()` has
 * already read and parsed whatever was posted — the platform's own
 * request-size limit stands in front of that, identically for the `{ url }`
 * route. The cap narrows what we will PAY A MODEL TO READ, which is the cost
 * that scales with a caller's choices.
 *
 * AN OVER-LONG PASTE IS A 400 RATHER THAN A TYPED `ImportResult`, WHICH CUTS
 * ACROSS THIS FUNCTION'S USUAL GRAIN, so here is the argument.
 *
 * The rule everywhere else is that an ANTICIPATED OUTCOME is a 200 with a
 * typed body — the client switches on `kind`, never on HTTP status. An
 * over-long paste is not an outcome. Nothing was fetched, no model was asked,
 * no import ever began: it is a body that breaks this endpoint's stated
 * contract, in exactly the way `{ url: 42 }` does, decided by the same
 * function in the same three lines. Calling it an outcome would also drop a
 * request that never reached the pipeline into IMP-07's denominator, which is
 * the one thing importResponse.ts's header says must never happen.
 *
 * THE HALF OF THAT ARGUMENT THAT MAKES IT SAFE LIVES ON THE CLIENT.
 * src/app/import/paste.tsx refuses to submit a paste over the same cap and
 * says so in Dutch, on the screen, before any request is made — so a real
 * user of this app meets this limit as copy and never as a status code. What
 * arrives here over-length is therefore a caller that is not our screen, and
 * "your request was malformed" is the honest thing to tell a caller ignoring
 * a documented limit.
 *
 * WHAT DOING IT THE OTHER WAY WOULD HAVE COST, recorded rather than shrugged
 * off: a NEW `ImportResult` variant. There is no existing one that means
 * "your text is too long" — `parse_failed` blames the recipe and
 * `llm_request_failed` blames an outage that did not happen, and both advise
 * a retry that is guaranteed to fail again, which is worse than saying
 * nothing. So it would mean a member in src/domain/import/types.ts plus its
 * Dutch copy in src/components/importFailureCopy.ts. That is a reasonable
 * thing to want, and it is a deliberate decision of its own rather than a
 * detail to smuggle in here.
 *
 * ---
 *
 * THE `message` STRINGS BELOW ARE FOR WHOEVER IS WRITING A CLIENT, NOT FOR A
 * USER. They are English, they name the field at fault, and the app never
 * renders one: src/lib/importRecipe.ts maps any non-2xx to a typed transport
 * failure and shows its own Dutch copy instead. Every Dutch sentence a user
 * can read on this feature lives in src/components/importFailureCopy.ts or on
 * the paste screen, and none of it is ever assembled server-side.
 *
 * THE `.ts` EXTENSION RULE APPLIES HERE TOO — Deno's resolution rule, see
 * index.ts's header. The single import below is a relative VALUE import into
 * src/domain/, so it spells the extension out; dropping it fails at deploy
 * time and nowhere earlier, because this directory is outside `tsc --noEmit`,
 * ESLint and vitest alike.
 */

import {
  MAX_PASTED_RECIPE_TEXT_CHARS,
  readPastedText,
} from '../../../src/domain/import/pastedTextLimits.ts';

/**
 * A request that got far enough to be one of the two routes, or a refusal
 * with its reason attached.
 *
 * `malformed` carries its own message so that the handler stays a switch
 * rather than a second, weaker copy of the checks below: every reason a body
 * is refused is decided AND phrased in the same function, and index.ts only
 * chooses the status code that goes with it.
 */
export type ImportRequest =
  | { readonly kind: 'url'; readonly url: string }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'malformed'; readonly message: string };

const MESSAGE_NOT_JSON = 'Request body must be a JSON object';
const MESSAGE_NO_SOURCE = 'Request body must be { "url": string } or { "text": string }';
const MESSAGE_AMBIGUOUS = 'Request body must carry exactly one of "url" or "text", never both';
const MESSAGE_BAD_URL = 'Request field "url" must be a non-empty string';
const MESSAGE_BAD_TEXT = 'Request field "text" must be a non-empty string';
const MESSAGE_TEXT_TOO_LONG = `Request field "text" must be at most ${MAX_PASTED_RECIPE_TEXT_CHARS} characters`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function malformed(message: string): ImportRequest {
  return { kind: 'malformed', message };
}

/**
 * PRESENCE IS TESTED BEFORE TYPE, and the order is deliberate. A caller that
 * sent `{ url: null, text: '…' }` meant the text route and got one field
 * wrong; a caller that sent both as strings meant two things at once. Only
 * the second is genuinely ambiguous, so only the second is refused as such —
 * and `undefined` is the one value that reads as "this field was not sent",
 * because an absent key and an explicitly-undefined one produce it alike.
 *
 * THE URL COMES BACK UNTRIMMED AND THE TEXT COMES BACK TRIMMED, which looks
 * inconsistent and is not. `normalizeRecipeUrl` owns every question about the
 * shape of a URL, its surrounding whitespace included, and this function must
 * not start answering half of them behind its back. The pasted text has no
 * such owner downstream — it goes to the model as it stands — so the string
 * that was measured against the cap has to be the string that is sent, and
 * `readPastedText` returns exactly that one string rather than leaving this
 * function to trim a second time and hope the two agree.
 */
export async function readImportRequest(request: Request): Promise<ImportRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return malformed(MESSAGE_NOT_JSON);
  }
  if (!isRecord(body)) {
    return malformed(MESSAGE_NOT_JSON);
  }

  const hasUrlField = body.url !== undefined;
  const hasTextField = body.text !== undefined;
  if (hasUrlField && hasTextField) {
    return malformed(MESSAGE_AMBIGUOUS);
  }
  if (!hasUrlField && !hasTextField) {
    return malformed(MESSAGE_NO_SOURCE);
  }

  if (hasUrlField) {
    if (typeof body.url !== 'string' || body.url.trim().length === 0) {
      return malformed(MESSAGE_BAD_URL);
    }
    return { kind: 'url', url: body.url };
  }

  if (typeof body.text !== 'string') {
    return malformed(MESSAGE_BAD_TEXT);
  }
  const submission = readPastedText(body.text);
  if (submission.readiness === 'empty') {
    return malformed(MESSAGE_BAD_TEXT);
  }
  if (submission.readiness === 'too_long') {
    return malformed(MESSAGE_TEXT_TOO_LONG);
  }
  return { kind: 'text', text: submission.text };
}

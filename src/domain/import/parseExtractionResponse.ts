/**
 * Narrows the Gemini `generateContent` raw `unknown` HTTP response body
 * into one of three outcomes, without ever trusting its declared shape.
 * Pure: no fetch, no Deno, just JSON-shaped data in, a typed result out —
 * exactly the same "trust nothing from the network" posture
 * src/lib/oembed.ts takes with its own provider's response body.
 *
 * Deliberately requires EXACTLY one `functionCall` part. Gemini has no
 * request-side equivalent of "disable parallel tool use" (see
 * buildExtractionRequest.ts), so unlike the Anthropic shape this replaced,
 * this module is the ONLY thing standing between a multi-call response and
 * the code silently picking one to trust. Zero or several calls are both
 * `malformed` rather than a guess.
 *
 * A response is likewise required to carry exactly one candidate. The
 * request never sets `candidateCount`, so the API's default of 1 is the
 * only correct answer here; several candidates would mean choosing which
 * of two extractions to believe, which is the same guess in a different
 * costume. `finishReason` is deliberately not inspected — a truncated or
 * filtered response simply won't yield its one well-formed function call,
 * and falls out as `malformed` through the same door as everything else.
 */

export type ExtractionResponseResult =
  | { readonly kind: 'recipe_found'; readonly rawRecipe: unknown }
  | { readonly kind: 'no_recipe' }
  | { readonly kind: 'malformed' };

interface FunctionCall {
  readonly name: string;
  readonly args: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * A part is only a function call if it actually carries a named
 * `functionCall` object. A text part sitting alongside one is ignored
 * rather than treated as a competing signal — the model narrating before
 * it calls is harmless, the same allowance the Anthropic shape made for a
 * leading text block.
 */
function readFunctionCall(part: unknown): FunctionCall | null {
  if (!isRecord(part) || !isRecord(part.functionCall)) {
    return null;
  }
  const call = part.functionCall;
  if (typeof call.name !== 'string') {
    return null;
  }
  return { name: call.name, args: call.args };
}

function findSoleFunctionCall(parts: readonly unknown[]): FunctionCall | null {
  const calls = parts.map(readFunctionCall).filter((call): call is FunctionCall => call !== null);
  return calls.length === 1 ? calls[0] ?? null : null;
}

/** Unwraps `candidates[0].content.parts`, failing on anything that isn't exactly that shape. */
function readSoleCandidateParts(raw: unknown): readonly unknown[] | null {
  if (!isRecord(raw) || !Array.isArray(raw.candidates) || raw.candidates.length !== 1) {
    return null;
  }
  const candidate: unknown = raw.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content) || !Array.isArray(candidate.content.parts)) {
    return null;
  }
  return candidate.content.parts;
}

/** The single entry point: takes the parsed JSON body of a Gemini generateContent response and narrows it to what the caller actually needs. */
export function parseExtractionResponse(raw: unknown): ExtractionResponseResult {
  const parts = readSoleCandidateParts(raw);
  if (parts === null) {
    return { kind: 'malformed' };
  }

  const call = findSoleFunctionCall(parts);
  if (call === null) {
    return { kind: 'malformed' };
  }

  if (call.name === 'report_no_recipe') {
    return { kind: 'no_recipe' };
  }
  if (call.name === 'report_recipe') {
    return { kind: 'recipe_found', rawRecipe: call.args };
  }
  return { kind: 'malformed' };
}

/**
 * Narrows the Anthropic Messages API's raw `unknown` HTTP response body
 * into one of three outcomes, without ever trusting its declared shape.
 * Pure: no fetch, no Deno, just JSON-shaped data in, a typed result out —
 * exactly the same "trust nothing from the network" posture
 * src/lib/oembed.ts takes with its own provider's response body.
 *
 * Deliberately requires EXACTLY one `tool_use` content block. Requesting
 * `disable_parallel_tool_use: true` (buildExtractionRequest.ts) should
 * already guarantee this from a well-behaved API, but this module doesn't
 * assume the request-side guard actually held — zero or multiple tool
 * calls are both treated as `malformed` rather than the code guessing
 * which one (if any) to trust.
 */

export type ExtractionResponseResult =
  | { readonly kind: 'recipe_found'; readonly rawRecipe: unknown }
  | { readonly kind: 'no_recipe' }
  | { readonly kind: 'malformed' };

interface ToolUseBlock {
  readonly type: 'tool_use';
  readonly name: string;
  readonly input: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isToolUseBlock(value: unknown): value is ToolUseBlock {
  return isRecord(value) && value.type === 'tool_use' && typeof value.name === 'string';
}

function findSoleToolUseBlock(content: readonly unknown[]): ToolUseBlock | null {
  const toolUseBlocks = content.filter(isToolUseBlock);
  return toolUseBlocks.length === 1 ? toolUseBlocks[0] ?? null : null;
}

/** The single entry point: takes the parsed JSON body of an Anthropic Messages API response and narrows it to what the caller actually needs. */
export function parseExtractionResponse(raw: unknown): ExtractionResponseResult {
  if (!isRecord(raw) || !Array.isArray(raw.content)) {
    return { kind: 'malformed' };
  }

  const toolUse = findSoleToolUseBlock(raw.content);
  if (toolUse === null) {
    return { kind: 'malformed' };
  }

  if (toolUse.name === 'report_no_recipe') {
    return { kind: 'no_recipe' };
  }
  if (toolUse.name === 'report_recipe') {
    return { kind: 'recipe_found', rawRecipe: toolUse.input };
  }
  return { kind: 'malformed' };
}

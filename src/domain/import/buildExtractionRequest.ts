/**
 * Builds the Anthropic Messages API request body for recipe extraction.
 * Pure: given a caption, always produces the same request — no fetch, no
 * API key (the edge function attaches that as a header, never in the
 * body this module builds).
 *
 * The anti-hallucination mechanism lives here, not in prose alone:
 *
 * 1. Two tools, not one. `report_recipe` and `report_no_recipe` are
 *    mutually exclusive, explicit signals. The model isn't asked to fill
 *    in an "isRecipe: boolean" field on a single always-present schema
 *    (which invites a `true` plus a thin, half-invented recipe to satisfy
 *    the rest of the shape) — it must pick ONE of two distinct actions.
 * 2. `tool_choice: { type: 'any', disable_parallel_tool_use: true }`
 *    forces exactly one of those two tools to be called — the model
 *    cannot instead reply with prose ("Here's a recipe I think this
 *    might be..."), and cannot hedge by calling both.
 * 3. The system prompt below states outright, more than once, that the
 *    caption is the ONLY source of information (no audio, no video, no
 *    outside knowledge of "what this dish usually contains") and that
 *    calling `report_no_recipe` is the correct, expected answer for a
 *    caption that doesn't spell out ingredients/steps — not a fallback to
 *    be avoided.
 *
 * None of this guarantees a model can't still hallucinate — no prompt
 * does — but it removes the two easiest failure modes: freeform text
 * that has to be regex-scraped, and a schema that has no honest way to
 * say "I don't know."
 */

export interface ExtractionInput {
  readonly caption: string;
  readonly authorName: string | null;
}

interface AnthropicToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

interface AnthropicMessage {
  readonly role: 'user';
  readonly content: string;
}

export interface AnthropicRequestBody {
  readonly model: string;
  readonly max_tokens: number;
  readonly system: string;
  readonly tool_choice: { readonly type: 'any'; readonly disable_parallel_tool_use: true };
  readonly tools: readonly AnthropicToolDefinition[];
  readonly messages: readonly AnthropicMessage[];
}

const SYSTEM_PROMPT = `You extract recipes from short-form video captions (TikTok/Instagram Reels).

Your ONLY source of information is the caption text you are given below. You have NOT watched the video, you have NOT heard any audio, and you have NOT seen any on-screen text overlays. You must not use outside knowledge of what a dish "usually" contains, and you must not guess at ingredients, quantities, or steps that are not explicitly written in the caption.

If the caption states an ingredient or a step, extract it using report_recipe. Copy quantities and units exactly as written; use null for a quantity or unit the caption doesn't state — never invent a plausible-looking number.

If the caption does NOT contain the actual ingredients and steps needed to cook something — for example, it only shows off a finished dish, is a caption about something unrelated to cooking, or is vague ("the best pasta you'll ever have") without concrete ingredients or instructions — you MUST call report_no_recipe instead. This is the correct, expected answer for most captions, not a failure. Do not call report_recipe with an invented, guessed, or "typical for this dish" recipe just because the video is probably about food: a wrong recipe someone actually cooks from is worse than honestly finding nothing.

Preserve the caption's own language in the output (do not translate). Only set estimatedMinutes or servings when the caption explicitly states them — never estimate.`;

const REPORT_RECIPE_TOOL: AnthropicToolDefinition = {
  name: 'report_recipe',
  description:
    'Report a recipe extracted from the caption. Only call this when the caption itself states concrete ingredients AND concrete steps for cooking something.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: "Short recipe name/title, in the caption's own language." },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: ['string', 'null'], description: 'Copied verbatim from the caption, or null if not stated.' },
            unit: { type: ['string', 'null'], description: 'Copied verbatim from the caption, or null if not stated.' },
          },
          required: ['name'],
        },
      },
      steps: { type: 'array', items: { type: 'string' } },
      estimatedMinutes: { type: ['integer', 'null'], description: 'Only if explicitly stated in the caption.' },
      servings: { type: ['integer', 'null'], description: 'Only if explicitly stated in the caption.' },
    },
    required: ['title', 'ingredients', 'steps'],
  },
};

const REPORT_NO_RECIPE_TOOL: AnthropicToolDefinition = {
  name: 'report_no_recipe',
  description:
    'Call this INSTEAD of report_recipe when the caption does not contain a usable recipe. Do not guess or invent a plausible recipe just because the video is probably food-related.',
  input_schema: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'One short sentence: why no recipe could be extracted from this caption.' },
    },
    required: [],
  },
};

function buildUserMessage(input: ExtractionInput): string {
  const author = input.authorName !== null && input.authorName.trim().length > 0 ? input.authorName.trim() : null;
  const captionBlock = `Caption:\n${input.caption}`;
  return author === null ? captionBlock : `Creator: ${author}\n\n${captionBlock}`;
}

/**
 * `model` is passed in rather than hardcoded so the edge function can read
 * it from an env var (with a default) without this module reaching into
 * `Deno.env` itself — keeps this file runnable/testable under plain
 * Node/Vitest with zero Deno dependency.
 */
export function buildExtractionRequest(input: ExtractionInput, model: string): AnthropicRequestBody {
  return {
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tool_choice: { type: 'any', disable_parallel_tool_use: true },
    tools: [REPORT_RECIPE_TOOL, REPORT_NO_RECIPE_TOOL],
    messages: [{ role: 'user', content: buildUserMessage(input) }],
  };
}

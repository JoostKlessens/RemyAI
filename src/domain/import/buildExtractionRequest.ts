/**
 * Builds the Gemini `generateContent` request body for recipe extraction.
 * Pure: given a caption, always produces the same request — no fetch, no
 * API key (the edge function attaches that as a header, never in the body
 * this module builds, and never in the URL — see `buildExtractionEndpoint`
 * below).
 *
 * The anti-hallucination mechanism lives here, not in prose alone:
 *
 * 1. Two functions, not one. `report_recipe` and `report_no_recipe` are
 *    mutually exclusive, explicit signals. The model isn't asked to fill
 *    in an "isRecipe: boolean" field on a single always-present schema
 *    (which invites a `true` plus a thin, half-invented recipe to satisfy
 *    the rest of the shape) — it must pick ONE of two distinct actions.
 * 2. `functionCallingConfig.mode: 'ANY'`, with both names listed in
 *    `allowedFunctionNames`, forces a call to one of those two functions —
 *    the model cannot instead reply with prose ("Here's a recipe I think
 *    this might be...").
 * 3. The system prompt below states outright, more than once, that the
 *    caption is the ONLY source of information (no audio, no video, no
 *    outside knowledge of "what this dish usually contains") and that
 *    calling `report_no_recipe` is the correct, expected answer for a
 *    caption that doesn't spell out ingredients/steps — not a fallback to
 *    be avoided.
 *
 * None of this guarantees a model can't still hallucinate — no prompt
 * does — but it removes the two easiest failure modes: freeform text that
 * has to be regex-scraped, and a schema that has no honest way to say
 * "I don't know."
 *
 * NOTE ON THE SCHEMA DIALECT. Gemini's `parameters` is an OpenAPI 3.0
 * Schema subset, not JSON Schema. Two differences bite here, and they are
 * why this file cannot be a copy of a JSON-Schema tool definition: a
 * nullable field is `{ type: 'STRING', nullable: true }` and NOT
 * `{ type: ['string', 'null'] }` (a type array is rejected outright), and
 * `type` takes the canonical uppercase `Type` enum values.
 *
 * Gemini also has no equivalent of a "disable parallel tool use" flag, so
 * the exactly-one-call guarantee is enforced on the response side instead:
 * parseExtractionResponse.ts requires exactly one function call and treats
 * zero or several as malformed.
 *
 * NOTE ON THE `dishTags` IMPORT. This is the first RUNTIME (non-type)
 * import this module has ever had, and that matters beyond style: the
 * Supabase Edge Function that calls this file (supabase/functions/
 * parse-recipe/index.ts) runs on Deno, which needs fully-specified
 * relative specifiers, and its header documents that it gets away with
 * extensionless downstream imports precisely because every cross-file
 * reference under src/domain/import/ used to be `import type` — erased
 * before Deno's loader resolves anything. `../dishTags` is a value import
 * and is NOT erased. It is still written extensionless here because
 * tsconfig.json's `moduleResolution: "node"` rejects a `.ts` specifier
 * outright, so the alternative would fail `npm run typecheck` for every
 * developer in order to satisfy one runtime. Reconciling the two is the
 * edge function's own concern (an import map, a bundling step, or
 * `allowImportingTsExtensions`), not a reason to inline a second copy of
 * the vocabulary here: a duplicated enum that silently drifts from
 * dishTags.ts would let the model be offered categories the validator
 * then drops on the floor, which is invisible in every test and in
 * production alike.
 */

import { DISH_TAGS } from '../dishTags.ts';

export interface ExtractionInput {
  readonly caption: string;
  readonly authorName: string | null;
}

interface GeminiFunctionDeclaration {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

interface GeminiTextPart {
  readonly text: string;
}

interface GeminiContent {
  readonly role: 'user';
  readonly parts: readonly GeminiTextPart[];
}

export interface GeminiRequestBody {
  readonly systemInstruction: { readonly parts: readonly GeminiTextPart[] };
  readonly contents: readonly GeminiContent[];
  readonly tools: readonly [{ readonly functionDeclarations: readonly GeminiFunctionDeclaration[] }];
  readonly toolConfig: {
    readonly functionCallingConfig: {
      readonly mode: 'ANY';
      readonly allowedFunctionNames: readonly string[];
    };
  };
  readonly generationConfig: { readonly maxOutputTokens: number };
}

/**
 * Gemini 3.x models reason before answering, and those thinking tokens are
 * drawn from the SAME budget as the reply. A caption listing two dozen
 * ingredients needs well over a thousand tokens for the function call
 * alone, so the 1024 this was originally ported with (from an Anthropic
 * `max_tokens`, where no thinking competes for the allowance) left the
 * call truncated mid-object — which reaches the user as `parse_failed`,
 * or worse, as a recipe missing most of its steps.
 *
 * Set generously: this is a ceiling, not a reservation, and is only ever
 * spent on a genuinely long recipe.
 *
 * Deliberately NOT paired with a `thinkingConfig.thinkingBudget: 0`, even
 * though extraction is transcription rather than reasoning and thinking
 * buys little here. That field is a Gemini 2.x control; sending it to a
 * 3.x model is rejected outright with a 400, which reaches the user as a
 * blanket "Even niet gelukt" — a strictly worse failure than paying for
 * some thinking. A generous ceiling solves the truncation on its own.
 */
const MAX_OUTPUT_TOKENS = 8192;

/**
 * The closed vocabulary, flattened for the schema. Derived from DISH_TAGS
 * rather than written out, so adding a category is a one-line edit in
 * dishTags.ts and the model is offered it on the next request — no second
 * list to remember. `tag` (not `label`) is what goes on the wire: the tag
 * is the already-normalized stored form, and offering the human label
 * ("Vis") would invite exactly the unnormalized answer isDishTag rejects.
 */
const DISH_TAG_ENUM: readonly string[] = DISH_TAGS.map((entry) => entry.tag);

const SYSTEM_PROMPT = `You extract recipes from short-form video captions (TikTok/Instagram Reels).

Your ONLY source of information is the caption text you are given below. You have NOT watched the video, you have NOT heard any audio, and you have NOT seen any on-screen text overlays. You must not use outside knowledge of what a dish "usually" contains, and you must not guess at ingredients, quantities, or steps that are not explicitly written in the caption.

If the caption states an ingredient or a step, extract it using report_recipe. Copy quantities and units exactly as written; use null for a quantity or unit the caption doesn't state — never invent a plausible-looking number.

If the caption does NOT contain the actual ingredients and steps needed to cook something — for example, it only shows off a finished dish, is a caption about something unrelated to cooking, or is vague ("the best pasta you'll ever have") without concrete ingredients or instructions — you MUST call report_no_recipe instead. This is the correct, expected answer for most captions, not a failure. Do not call report_recipe with an invented, guessed, or "typical for this dish" recipe just because the video is probably about food: a wrong recipe someone actually cooks from is worse than honestly finding nothing.

Preserve the caption's own language in the output (do not translate). Only set estimatedMinutes or servings when the caption explicitly states them — never estimate.

When you call report_recipe, also fill in dishTags: pick every category from the fixed list in that field's schema that plainly applies to the dish, and leave it empty when none clearly does. You may only use values from that list — never invent a category, never reword or translate one, and never add one the caption gives you no basis for. dishTags describes what kind of dish this is; it is not a claim about what is safe for anyone to eat.`;

const REPORT_RECIPE_FUNCTION: GeminiFunctionDeclaration = {
  name: 'report_recipe',
  description:
    'Report a recipe extracted from the caption. Only call this when the caption itself states concrete ingredients AND concrete steps for cooking something.',
  parameters: {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING', description: "Short recipe name/title, in the caption's own language." },
      ingredients: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            quantity: {
              type: 'STRING',
              nullable: true,
              description: 'Copied verbatim from the caption, or null if not stated.',
            },
            unit: {
              type: 'STRING',
              nullable: true,
              description: 'Copied verbatim from the caption, or null if not stated.',
            },
          },
          required: ['name'],
        },
      },
      steps: { type: 'ARRAY', items: { type: 'STRING' } },
      /**
       * The vocabulary is enforced as a schema-level `enum`, not merely
       * asked for in the system prompt. Prose is advisory — a model that
       * ignores it still returns a structurally valid call, and the
       * invented category only dies later, silently, in
       * sanitizeDishTags. Putting the constraint in the shape the model is
       * filling in makes the honest answer the easy one. Deliberately
       * absent from `required` below: most captions make no category
       * obvious, and forcing the field would pressure the model into
       * picking the least-wrong tag rather than none.
       */
      dishTags: {
        type: 'ARRAY',
        items: { type: 'STRING', enum: DISH_TAG_ENUM },
        description:
          'Categories describing what kind of dish this is. Only values from the listed set; empty when none clearly applies.',
      },
      estimatedMinutes: { type: 'INTEGER', nullable: true, description: 'Only if explicitly stated in the caption.' },
      servings: { type: 'INTEGER', nullable: true, description: 'Only if explicitly stated in the caption.' },
    },
    required: ['title', 'ingredients', 'steps'],
  },
};

const REPORT_NO_RECIPE_FUNCTION: GeminiFunctionDeclaration = {
  name: 'report_no_recipe',
  description:
    'Call this INSTEAD of report_recipe when the caption does not contain a usable recipe. Do not guess or invent a plausible recipe just because the video is probably food-related.',
  parameters: {
    type: 'OBJECT',
    properties: {
      reason: { type: 'STRING', description: 'One short sentence: why no recipe could be extracted from this caption.' },
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
 * Gemini takes the model id in the URL path rather than in the request
 * body, which is why `buildExtractionRequest` no longer receives one.
 * This stays a pure function (rather than string concatenation at the
 * call site) for the same reason the model used to be a parameter: the
 * edge function can read the id from an env var without this module
 * reaching into `Deno.env` itself, and the URL shape stays under test.
 *
 * The API key is deliberately NOT passed as a `?key=` query parameter,
 * even though Gemini accepts one: URLs end up in proxy logs, error traces
 * and crash reports in a way request headers do not. The caller sends it
 * as an `x-goog-api-key` header.
 */
export function buildExtractionEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

export function buildExtractionRequest(input: ExtractionInput): GeminiRequestBody {
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserMessage(input) }] }],
    tools: [{ functionDeclarations: [REPORT_RECIPE_FUNCTION, REPORT_NO_RECIPE_FUNCTION] }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [REPORT_RECIPE_FUNCTION.name, REPORT_NO_RECIPE_FUNCTION.name],
      },
    },
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
}

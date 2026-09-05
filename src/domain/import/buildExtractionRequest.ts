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

/**
 * SRC-07. What the photo route hands the model instead of a caption: the
 * image itself, as base64, plus the content type that tells Gemini how to
 * decode it.
 *
 * NO `authorName`, AND THE ABSENCE IS A FACT RATHER THAN A FIELD SOMEBODY
 * FORGOT. A caption has a creator whose name is real context for reading it
 * ("Creator: …" above the text says whose recipe this is). A photograph of
 * the user's own cookbook page has nobody to name — `NO_CREATOR_TO_CREDIT`
 * (buildAttribution.ts) is this pipeline's word for exactly that — so a
 * creator line here would be a blank where the model expects a person.
 *
 * NEITHER FIELD IS RE-VALIDATED HERE. `readImportPhoto`
 * (photoImportLimits.ts) has already refused an empty payload, an unaccepted
 * content type and an over-cap image at BOTH ends of the wire before this
 * function is reachable, so a check here would be a second opinion on a
 * settled question — and a pure builder has nothing useful to do with a
 * disagreement anyway.
 */
export interface PhotoExtractionInput {
  /** One of `ACCEPTED_IMPORT_PHOTO_MIME_TYPES`, already checked at the boundary and never re-derived here. */
  readonly mimeType: string;
  /** Standard base64, no `data:` prefix. Passed through verbatim — this module neither decodes nor re-encodes it. */
  readonly base64: string;
}

interface GeminiFunctionDeclaration {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

interface GeminiTextPart {
  readonly text: string;
}

/**
 * SRC-07. An image sent in the request body itself rather than referenced by
 * a URI.
 *
 * `inlineData` AND NOT `fileData`, WHICH IS THE OTHER THING GEMINI ACCEPTS.
 * `fileData` points at a URI the model fetches for itself — the Files API, or
 * a bucket — and using it would mean the image had to EXIST somewhere
 * addressable for the length of the call. That is a store, with a lifetime
 * and a deletion story, and photoImportLimits.ts's retention decision is that
 * there is no store. Inline data travels in the one request and is gone with
 * it, which is the shape that makes "we keep nothing" true rather than
 * aspirational.
 *
 * The field names are Gemini's own (`inline_data` in the REST docs, camelCase
 * in the JSON dialect this file already speaks — see the schema-dialect note
 * in the header).
 */
interface GeminiInlineDataPart {
  readonly inlineData: {
    readonly mimeType: string;
    readonly data: string;
  };
}

/**
 * A part is text or an image. Written as a union rather than as two optional
 * fields on one object, for the reason `ImportResult` is a union rather than
 * a bag of nullables: a part carrying both, or neither, is a request Gemini
 * rejects, and the type should not be able to express it.
 */
type GeminiPart = GeminiTextPart | GeminiInlineDataPart;

interface GeminiContent {
  readonly role: 'user';
  readonly parts: readonly GeminiPart[];
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

/**
 * SRC-07. THE PHOTO ROUTE'S OWN SYSTEM PROMPT, and the reason it is a second
 * prompt rather than the one above with the word "caption" swapped out.
 *
 * The caption prompt's central instruction is "your ONLY source is the
 * caption text you are given; you have not watched the video". That sentence
 * is doing two jobs at once — it fences off outside knowledge, and it fences
 * off a MEDIUM we deliberately do not read. Reused here it would be false in
 * the second half and dangerous in the first: this model IS looking at
 * pixels, and telling it that it has not seen anything while handing it an
 * image is the kind of contradiction that degrades a small model's
 * instruction-following exactly where honesty matters most.
 *
 * WHAT THIS PROMPT HAS TO ADD THAT THE CAPTION ONE DOES NOT.
 *
 * 1. TRANSCRIBE, DO NOT COMPLETE. The caption route's risk is that a model
 *    fills in what a dish "usually" contains. This route's risk includes
 *    that, and adds one the caption route cannot have: filling in what a
 *    SMUDGE probably said. A creased 5, a fold through the middle of a
 *    quantity, a line that runs into the gutter of a book. The instruction is
 *    to leave the quantity null rather than guess the digit, which is the
 *    same anti-invention rule the whole feature turns on, applied to the one
 *    failure mode only this route has.
 *
 * 2. ONE RECIPE, THIS ONE. A photograph of an open book contains two pages,
 *    and the facing page is very often a different recipe. Reading ingredients
 *    off one page into the other's method is the most likely wrong-but-
 *    plausible answer available here, and it is invisible to every validator
 *    downstream, because the result is perfectly well-formed.
 *
 * 3. WHAT IS NOT A RECIPE. The caption prompt says "a video showing off a
 *    finished dish". The photographic equivalents are different and worth
 *    naming: a plated meal, a menu, a shopping list, a page of prose about
 *    food. The point of naming them is the same — calling report_no_recipe is
 *    the CORRECT answer, not a fallback to be avoided.
 *
 * 4. UNREADABLE IS ALSO "NO RECIPE". A photograph too blurred, too dark or
 *    too angled to read is not a failure of this pipeline and must not be
 *    reported as a half-read recipe. It is the one case in this whole feature
 *    that the USER can fix by acting, which is why `no_recipe_in_photo`
 *    offers a retry where its siblings do not (importResult.ts) — and that
 *    offer is only honest if the model says "no" instead of guessing.
 *
 * WHAT IT KEEPS WORD FOR WORD: the two-function mechanism, the ban on
 * inventing quantities, the ban on translating, the closed dishTags
 * vocabulary, and "never estimate". Those are the anti-hallucination design
 * this feature is built on (see the file header), they are not per-medium,
 * and rewording them per route is how two prompts quietly stop agreeing.
 */
const PHOTO_SYSTEM_PROMPT = `You extract recipes from a photograph of a recipe: a cookbook page, a handwritten card, a magazine clipping, a screenshot.

Your ONLY source of information is the image you are given. Read what is actually written on it. You must not use outside knowledge of what a dish "usually" contains, and you must not guess at ingredients, quantities, or steps that are not legible in the image.

Transcribe, do not complete. If a quantity or a unit is smudged, cut off, folded, or otherwise unreadable, use null for it rather than guessing the most likely number — a wrong quantity someone actually cooks from is worse than a missing one. Never round, convert, or tidy up a number: copy what is written.

If the photo shows more than one recipe — an open book usually shows two pages — extract only the one recipe the photo is plainly centred on, and never mix ingredients from one page into the steps of another. If it is genuinely unclear which recipe the photo is of, call report_no_recipe.

If the image does NOT contain the actual ingredients and steps needed to cook something — for example a photo of a finished dish, a menu, a shopping list, a page of prose about food, or a page of a recipe that does not include its ingredients or its method — you MUST call report_no_recipe instead. This is the correct, expected answer, not a failure.

Call report_no_recipe as well when the image is too blurred, too dark, too small, or too skewed for you to read the text reliably. Reporting that you could not read it is correct and useful; a half-read recipe with invented amounts is not.

Preserve the language written in the image (do not translate). Only set estimatedMinutes or servings when the image explicitly states them — never estimate.

When you call report_recipe, also fill in dishTags: pick every category from the fixed list in that field's schema that plainly applies to the dish, and leave it empty when none clearly does. You may only use values from that list — never invent a category, never reword or translate one, and never add one the image gives you no basis for. dishTags describes what kind of dish this is; it is not a claim about what is safe for anyone to eat.`;

/**
 * WHAT THE MODEL IS BEING ASKED TO READ, as one word, threaded through the
 * two tool declarations below.
 *
 * SRC-07 IS WHY THIS IS A PARAMETER RATHER THAN THE LITERAL "caption" IT WAS.
 * The declarations tell the model, three times over, to copy quantities
 * "verbatim from the caption" and to refuse when "the caption" holds no
 * recipe. Handed to the photo route unchanged, every one of those sentences
 * names a thing that is not in front of the model — and a schema that
 * describes the wrong source is the anti-hallucination mechanism arguing with
 * itself, on the one route where the model is most likely to fill a gap.
 *
 * THE ALTERNATIVE WAS A SECOND COPY OF THE SCHEMA, AND IT IS THE WRONG TRADE
 * FOR THE REASON THE `dishTags` NOTE IN THIS FILE'S HEADER ALREADY GIVES:
 * a duplicated declaration that silently drifts would let one route's model
 * be offered a shape the other route's validator does not accept, which is
 * invisible in every test and in production alike. The SHAPE is the contract
 * and there is exactly one of it; only the noun differs.
 */
type ExtractionSourceNoun = 'caption' | 'image';

function buildReportRecipeFunction(source: ExtractionSourceNoun): GeminiFunctionDeclaration {
  return {
  name: 'report_recipe',
  description: `Report a recipe extracted from the ${source}. Only call this when the ${source} itself states concrete ingredients AND concrete steps for cooking something.`,
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
              description: `Copied verbatim from the ${source}, or null if not stated.`,
            },
            unit: {
              type: 'STRING',
              nullable: true,
              description: `Copied verbatim from the ${source}, or null if not stated.`,
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
      estimatedMinutes: {
        type: 'INTEGER',
        nullable: true,
        description: `Only if explicitly stated in the ${source}.`,
      },
      servings: { type: 'INTEGER', nullable: true, description: `Only if explicitly stated in the ${source}.` },
    },
    required: ['title', 'ingredients', 'steps'],
  },
  };
}

/**
 * The honest-refusal half of the two-function mechanism, in the same
 * source-parameterised shape as its sibling above and for the same reason.
 *
 * ITS SECOND SENTENCE IS THE ONE THAT HAD TO WIDEN. "just because the video
 * is probably food-related" is the caption route's version of the pressure
 * this instruction pushes back on. A photograph of a plated dinner exerts the
 * identical pressure with no video anywhere in sight, so the noun becomes the
 * source itself — true of a caption, a description and an image alike, and
 * one fewer medium named in a place that would date.
 */
function buildReportNoRecipeFunction(source: ExtractionSourceNoun): GeminiFunctionDeclaration {
  return {
    name: 'report_no_recipe',
    description: `Call this INSTEAD of report_recipe when the ${source} does not contain a usable recipe. Do not guess or invent a plausible recipe just because the ${source} is probably food-related.`,
    parameters: {
      type: 'OBJECT',
      properties: {
        reason: {
          type: 'STRING',
          description: `One short sentence: why no recipe could be extracted from this ${source}.`,
        },
      },
      required: [],
    },
  };
}

/**
 * Built once per source at module load rather than per request. The
 * declarations depend on nothing but the noun, and rebuilding two objects
 * (one of which embeds the whole dish-tag enum) on every import would be
 * allocation for its own sake.
 */
const CAPTION_FUNCTIONS: readonly GeminiFunctionDeclaration[] = [
  buildReportRecipeFunction('caption'),
  buildReportNoRecipeFunction('caption'),
];
const PHOTO_FUNCTIONS: readonly GeminiFunctionDeclaration[] = [
  buildReportRecipeFunction('image'),
  buildReportNoRecipeFunction('image'),
];

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
    tools: [{ functionDeclarations: CAPTION_FUNCTIONS }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: CAPTION_FUNCTIONS.map((declaration) => declaration.name),
      },
    },
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
}

/**
 * SRC-07. The same request, with pixels where the text goes.
 *
 * WHAT IS SHARED WITH `buildExtractionRequest` ABOVE, AND WHY SHARING IT IS
 * THE POINT RATHER THAN THE SAVING. Both forced tool calls, both function
 * SHAPES, the same closed `dishTags` enum, the same output ceiling, the same
 * `mode: 'ANY'`. Those five are the anti-hallucination design this whole
 * feature rests on (see the file header), and a photo route that quietly had
 * four of them would fail in exactly the way nothing catches: a structurally
 * valid answer that nobody constrained.
 *
 * WHAT DIFFERS, AND ALL OF IT IS "WHAT THE MODEL IS LOOKING AT". A different
 * system prompt (`PHOTO_SYSTEM_PROMPT`, which argues for itself at length), a
 * different noun in the tool descriptions, and an `inlineData` part instead of
 * a text one.
 *
 * ONE PART, NOT TWO — no text part accompanies the image. The temptation is
 * to add "Here is a photo of a recipe:" beside it, and it is worth naming why
 * that is refused: the system instruction already says what the image is, and
 * a user-role text part that the USER did not write is this pipeline putting
 * words in their mouth on the one route where the model's job is to read only
 * what is actually there. The image is the entire message, which is also
 * exactly what the request is.
 */
export function buildPhotoExtractionRequest(input: PhotoExtractionInput): GeminiRequestBody {
  return {
    systemInstruction: { parts: [{ text: PHOTO_SYSTEM_PROMPT }] },
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: input.mimeType, data: input.base64 } }],
      },
    ],
    tools: [{ functionDeclarations: PHOTO_FUNCTIONS }],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: PHOTO_FUNCTIONS.map((declaration) => declaration.name),
      },
    },
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
  };
}

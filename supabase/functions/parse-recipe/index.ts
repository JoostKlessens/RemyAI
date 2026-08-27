/**
 * Supabase Edge Function: recipe import from a pasted TikTok/Instagram URL.
 *
 * POST { url: string } -> 200 application/json, body is an `ImportResult`
 * (src/domain/import/types.ts) for every REACHABLE outcome, including
 * failures — see that file's header for why every failure is a distinct,
 * typed `kind` rather than a shared error bucket. Non-2xx status codes are
 * reserved for the request itself being malformed (missing/blank `url`,
 * wrong HTTP method) or a genuinely unexpected server error; the client
 * should switch on `body.kind`, not on HTTP status, for every case this
 * feature actually anticipates.
 *
 * ---
 *
 * SECURITY: the LLM API key must never reach the client. A key shipped
 * inside a mobile app bundle is trivially extractable (it's just a string
 * in a downloadable binary/JS bundle), so extraction has to happen
 * server-side, here, where the key lives only in this function's
 * environment and is attached to the outbound Gemini request as a
 * header — never included in this function's own JSON response body, and
 * never logged. This is a security requirement, not a style preference.
 *
 * This function also must NOT be deployed with `--no-verify-jwt`: Supabase
 * verifies the caller's JWT by default before the handler below ever
 * runs, which is the only thing stopping an anonymous, unauthenticated
 * caller from running up this project's LLM bill by hammering this
 * endpoint. No auth check is hand-rolled in this file — that would just
 * be a weaker, easier-to-get-wrong reimplementation of what the platform
 * already does in front of it.
 *
 * ---
 *
 * DEDUPLICATION (Fase 1b): before any third-party call, this function
 * checks whether the resolved URL already has a canonical `recipes` row
 * (supabase/migrations/0006_canonical_recipes.sql) and returns it
 * unchanged if so — no oEmbed call, no LLM call, no cost. A miss runs the
 * full pipeline and then writes that row for everyone after. Both halves
 * live in canonicalRecipeStore.ts beside this file — see its header for
 * where exactly the lookup sits and why that position is the feature
 * rather than a detail, and src/domain/import/canonicalRecipe.ts for the
 * pure mapping and the PD-006 reason a shared recipe can never carry
 * allergen state.
 *
 * ---
 *
 * DISPLAY-ONLY PLATFORMS (PD-011): Instagram resolves oEmbed and then
 * stops. Meta licenses that endpoint for embedding a post — thumbnail,
 * title, author, link back — and prohibits "any other use of metadata or
 * content", which is what deriving and storing a recipe from the caption
 * would be. So for Instagram this function never calls Gemini, never
 * writes a canonical row, and never returns the caption to the client: it
 * answers with the `display_only` variant, which carries attribution and a
 * source URL and has nowhere to put caption text. The decision and the
 * result shape both live in src/domain/import/displayOnlyPolicy.ts, where
 * they are type-checked and unit-tested; this file only wires them in.
 * TikTok is entirely unaffected and keeps full extraction.
 *
 * ---
 *
 * SCOPE: oEmbed (src/lib/oembed.ts) is the only source of text this
 * function ever has — a caption/title and an author name, nothing else.
 * Downloading the video itself to run audio transcription or on-screen-
 * text (OCR) extraction would surface real ingredients/steps far more
 * often, but is a deliberately different and much larger legal exposure
 * (redistributing/processing a third party's copyrighted video content,
 * not just reading metadata a documented oEmbed endpoint already offers)
 * and is OUT OF SCOPE for this function. See src/domain/import/types.ts's
 * file header and docs/PRODUCT-DECISIONS.md.
 *
 * ---
 *
 * WHY THIS FILE IMPORTS THE DOMAIN LAYER WITH EXPLICIT `.ts` EXTENSIONS:
 * Deno (this function's runtime) requires fully-specified relative import
 * specifiers, unlike this repo's Node/Metro tooling (tsconfig.json's
 * `moduleResolution: "node"`, inherited from expo/tsconfig.base, resolves
 * extensionless imports — which is why every other file in this repo
 * omits the extension). `supabase/functions/**` is excluded from both
 * tsconfig.json's `include` and lint/eslint.flat.config.mjs's scope
 * specifically because it is Deno code, not Node/Metro code, so using
 * Deno's own import convention here doesn't conflict with `npx tsc
 * --noEmit` or `npm run lint`. This works transitively without every
 * downstream file also needing an extension: every cross-file reference
 * inside src/domain/import/*.ts is `import type`-only (erased entirely
 * before Deno's loader ever resolves a module graph), and src/lib/
 * oembed.ts / src/domain/types.ts have zero imports of their own to chase.
 * It does NOT extend to this function's own two sibling modules
 * (canonicalRecipeStore.ts, env.ts): those are real runtime imports Deno
 * resolves for itself, so they spell out `.ts` too. Dropping an extension
 * there fails nothing locally — neither `tsc --noEmit` nor `npm run lint`
 * looks at this directory — it fails the deploy.
 */

// Minimal ambient declaration for the two Deno globals this file uses —
// not a full `deno.d.ts`, just enough for this file to read on its own in
// an editor without a Deno LSP configured. Irrelevant to `tsc --noEmit`
// (this file is outside its `include`) and to the Supabase Edge Function
// runtime itself (which provides the real `Deno` global).
declare const Deno: {
  readonly env: { readonly get: (name: string) => string | undefined };
  readonly serve: (handler: (request: Request) => Promise<Response> | Response) => void;
};

import { normalizeRecipeUrl } from '../../../src/domain/import/urlParsing.ts';
import { validateParsedRecipe } from '../../../src/domain/import/validateParsed.ts';
import { buildExtractionEndpoint, buildExtractionRequest } from '../../../src/domain/import/buildExtractionRequest.ts';
import { parseExtractionResponse } from '../../../src/domain/import/parseExtractionResponse.ts';
import { buildAttribution } from '../../../src/domain/import/buildAttribution.ts';
import { buildDisplayOnlyResult, isDisplayOnlyPlatform } from '../../../src/domain/import/displayOnlyPolicy.ts';
import { resolveOembed } from '../../../src/lib/oembed.ts';
import type { ImportPlatform, ImportResult } from '../../../src/domain/import/types.ts';
// The two sibling modules of this function. `canonicalRecipeStore.ts` owns
// every read and write of the canonical tables — and the service role key
// that performs them — behind exactly the two calls imported here; `env.ts`
// owns the boot-time credential check both files need. Their `.ts`
// extensions are required for the same Deno reason as the imports above.
import { findStoredRecipe, storeCanonicalRecipe } from './canonicalRecipeStore.ts';
import { readRequiredEnvVar } from './env.ts';

// Fails loudly at module load — mirrors src/lib/supabase.ts's
// readRequiredEnvVar pattern. A function that silently no-ops (or, worse,
// silently skips extraction) without a configured key is a much harder
// failure to notice than one that refuses to boot at all.
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
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash';
// Optional: see src/lib/oembed.ts's `instagramAccessToken` — undefined
// here means every Instagram resolution fails with the typed
// `missing_credentials` reason, never a silent empty result.
//
// Still needed after PD-011. Instagram being display-only removes the LLM
// call, not the oEmbed call: resolving the post is precisely the use Meta's
// policy DOES license, and it is what produces the thumbnail and the
// creator credit the user is shown. Without a token, an Instagram paste
// degrades to the honest `oembed_failed` / `missing_credentials` copy
// exactly as it did before.
const INSTAGRAM_OEMBED_ACCESS_TOKEN = Deno.env.get('INSTAGRAM_OEMBED_ACCESS_TOKEN');

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * TikTok's native share sheet copies a `vm.tiktok.com`/`vt.tiktok.com`
 * short link, not the canonical `www.tiktok.com/@user/video/...` form
 * oEmbed requires (see urlParsing.ts's file header). Resolving that needs
 * a real network round trip, so it lives here, not in the pure domain
 * layer. HEAD-only, body never read: this resolves the redirect target,
 * it does not fetch the video or any page content — no video is
 * downloaded anywhere in this function, matching the file header's scope
 * note. Best-effort: any failure here just falls through to calling
 * oEmbed with the original short link, which fails honestly with its own
 * typed `invalid_url` reason (mapped to `oembed_failed` below) rather
 * than this function throwing.
 */
async function expandShortLink(shortUrl: string): Promise<string | null> {
  try {
    const response = await fetch(shortUrl, { method: 'HEAD', redirect: 'follow' });
    return response.url !== shortUrl ? response.url : null;
  } catch {
    return null;
  }
}

async function resolveEffectiveUrl(
  normalizedUrl: string,
  platform: ImportPlatform,
  isShortLink: boolean,
): Promise<{ readonly normalizedUrl: string; readonly platform: ImportPlatform }> {
  if (!isShortLink) {
    return { normalizedUrl, platform };
  }
  const expanded = await expandShortLink(normalizedUrl);
  if (expanded === null) {
    return { normalizedUrl, platform };
  }
  const reNormalized = normalizeRecipeUrl(expanded);
  if (reNormalized.kind !== 'ok') {
    return { normalizedUrl, platform };
  }
  return { normalizedUrl: reNormalized.normalizedUrl, platform: reNormalized.platform };
}

/** One place that knows how this function calls oEmbed, so its two call sites cannot drift apart. */
function resolveOembedFor(normalizedUrl: string, platform: ImportPlatform) {
  return resolveOembed(normalizedUrl, platform, {
    fetchFn: fetch,
    instagramAccessToken: INSTAGRAM_OEMBED_ACCESS_TOKEN,
  });
}

/**
 * ---------------------------------------------------------------------------
 * DISPLAY-ONLY PLATFORMS (PD-011)
 * ---------------------------------------------------------------------------
 *
 * The entire pipeline for a display-only platform: resolve the post, credit
 * its creator, return. No model call, no stored row, and no caption in the
 * response — see this file's header and displayOnlyPolicy.ts.
 *
 * THE CAPTION IS NEVER READ ON THIS PATH, structurally rather than by
 * convention. `oembedResult.payload.title` is not referenced anywhere in
 * this function, and the only thing the payload is handed to is
 * `buildDisplayOnlyResult`, which reads the attribution fields and nothing
 * else. There is no local variable holding a caption to accidentally log,
 * pass on, or return.
 *
 * WHY THE CALLER PUTS THIS BEFORE THE FASE 1b CACHE, NOT AFTER. Neither
 * half of the canonical-recipe cache should run for a display-only import:
 *
 *  - No WRITE, because there is no extracted recipe to store. That cache
 *    exists to stop us paying for repeat EXTRACTION, and there is no
 *    extraction here to repeat. (A parent row with no ingredients or steps
 *    would be rejected by `parseStoredRecipe` on the way back out anyway.)
 *  - No READ either, and that half is deliberate rather than incidental.
 *    Once nothing writes Instagram rows the lookup is a guaranteed miss, so
 *    skipping it saves a pointless round trip — but the load-bearing reason
 *    is that a row written by an EARLIER deployment must not be served now.
 *    Handing back a stored, caption-derived Instagram recipe would be the
 *    exact use PD-011 rules out; that it came from our own cache rather
 *    than from a fresh model call does not change what it is.
 */
async function resolveDisplayOnlyImport(normalizedUrl: string, platform: ImportPlatform): Promise<ImportResult> {
  const oembedResult = await resolveOembedFor(normalizedUrl, platform);
  if (oembedResult.kind === 'error') {
    // The same honest, typed failure as every other path: a deleted post or
    // a missing Instagram token still has to say so, rather than pretend to
    // have resolved something it did not.
    return { kind: 'oembed_failed', reason: oembedResult.reason };
  }
  return buildDisplayOnlyResult({ sourceUrl: normalizedUrl, platform, payload: oembedResult.payload });
}

type LlmCallResult = { readonly kind: 'ok'; readonly json: unknown } | { readonly kind: 'error' };

async function callExtractionModel(caption: string, authorName: string | null): Promise<LlmCallResult> {
  const requestBody = buildExtractionRequest({ caption, authorName });
  try {
    const response = await fetch(buildExtractionEndpoint(GEMINI_MODEL), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Header rather than a "?key=" query parameter, and never
        // included in this function's own response — see the file
        // header's SECURITY note and buildExtractionEndpoint().
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
        `parse-recipe: Gemini rejected the request. status=${response.status} model=${GEMINI_MODEL} body=${detail.slice(0, 600)}`,
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

/**
 * The full pipeline for one pasted URL: validate -> resolve the short link
 * -> STOP HERE IF THE PLATFORM IS DISPLAY-ONLY -> look for an existing
 * canonical recipe -> resolve oEmbed -> (maybe) ask the model -> validate
 * its answer -> store the canonical recipe -> a typed `ImportResult`. Every
 * `return` below is a deliberate, named outcome — there is no unhandled
 * path that falls through to an implicit success.
 *
 * The cache stage is the only one that can skip everything after it, and
 * its exact position between short-link resolution and oEmbed is
 * load-bearing — see the CANONICAL RECIPE DEDUPLICATION section above for
 * why neither one step earlier nor one step later is correct.
 */
async function resolveImport(rawUrl: string): Promise<ImportResult> {
  const normalized = normalizeRecipeUrl(rawUrl);
  if (normalized.kind === 'unsupported_url') {
    return { kind: 'unsupported_url' };
  }

  const effective = await resolveEffectiveUrl(normalized.normalizedUrl, normalized.platform, normalized.isShortLink);

  // PD-011. Everything below this line — the cache, the model, the write —
  // is skipped for a display-only platform. It sits after short-link
  // resolution (so the platform is final) and before the cache lookup (so
  // no stored, caption-derived row can be served either); see
  // resolveDisplayOnlyImport for why both halves matter.
  if (isDisplayOnlyPlatform(effective.platform)) {
    return resolveDisplayOnlyImport(effective.normalizedUrl, effective.platform);
  }

  // A hit returns here, having called neither oEmbed nor the model: no
  // third-party round trip, no tokens, no cost. This is the entire point of
  // Fase 1b — the twentieth household to import a link pays one indexed
  // lookup instead of the whole pipeline.
  const storedRecipe = await findStoredRecipe(effective.normalizedUrl);
  if (storedRecipe !== null) {
    return storedRecipe;
  }

  const oembedResult = await resolveOembedFor(effective.normalizedUrl, effective.platform);
  if (oembedResult.kind === 'error') {
    return { kind: 'oembed_failed', reason: oembedResult.reason };
  }

  const caption = oembedResult.payload.title;
  if (caption === null || caption.trim().length === 0) {
    // Nothing to send the model: no LLM call, no cost, and just as honest
    // an outcome as the model reading a caption and finding no recipe.
    return { kind: 'no_recipe_in_caption', caption: null };
  }

  const llmResult = await callExtractionModel(caption, oembedResult.payload.authorName);
  if (llmResult.kind === 'error') {
    return { kind: 'llm_request_failed' };
  }

  const extraction = parseExtractionResponse(llmResult.json);
  if (extraction.kind === 'malformed') {
    return { kind: 'parse_failed' };
  }
  if (extraction.kind === 'no_recipe') {
    return { kind: 'no_recipe_in_caption', caption };
  }

  const recipe = validateParsedRecipe(extraction.rawRecipe);
  if (recipe === null) {
    return { kind: 'parse_failed' };
  }

  // Reuses the OembedPayload already fetched above to read the caption
  // -- no second oEmbed round trip. See buildAttribution.ts: this is
  // attribution, not PD-007 Feed opt-in consent.
  const attribution = buildAttribution(oembedResult.payload);

  // Only a fully validated recipe is ever stored — the failure branches
  // above all returned already, so nothing half-parsed can become the
  // canonical answer every later importer receives.
  //
  // AWAITED, not fire-and-forget. Letting this run detached would shave a
  // few hundred milliseconds off the response, but an edge runtime is free
  // to tear down the isolate once the response is returned, which would
  // silently drop the write — turning deduplication into an expensive
  // no-op that still looks like it is working. Correct-and-slightly-slower
  // wins here, and only on the miss path, which was already paying for an
  // LLM call.
  // Already awaited for the reason above; W-01b adds a second one. The id
  // it returns is the only way this response can tell the client which
  // canonical row its meal is a copy of, and there is nowhere else to get
  // it from afterwards.
  const recipeId = await storeCanonicalRecipe(recipe, effective.normalizedUrl, effective.platform, attribution);

  return {
    kind: 'parsed',
    recipe,
    sourceUrl: effective.normalizedUrl,
    platform: effective.platform,
    attribution,
    // Straight through, null included. A failed canonical write means this
    // import really is a copy of nothing, and saying so is the only honest
    // answer — `sourceUrl` above is a deduplication key, never a stand-in
    // for this id. The cache-hit path returns the same field from the
    // stored row's `id` (`parseStoredRecipe`), so the two paths agree.
    recipeId,
  };
}

async function readUrlFromRequest(request: Request): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!isRecord(body) || typeof body.url !== 'string' || body.url.trim().length === 0) {
    return null;
  }
  return body.url;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = await readUrlFromRequest(request);
  if (url === null) {
    return jsonResponse({ error: 'Request body must be { "url": string }' }, 400);
  }

  try {
    const result = await resolveImport(url);
    return jsonResponse(result, 200);
  } catch (error) {
    // A genuinely unexpected exception (not one of the modeled failure
    // paths above, all of which return normally) — logged server-side
    // only, never echoed into the response body.
    console.error('parse-recipe: unexpected failure', error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});

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
 * environment and is attached to the outbound Anthropic request as a
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
import { buildExtractionRequest } from '../../../src/domain/import/buildExtractionRequest.ts';
import { parseExtractionResponse } from '../../../src/domain/import/parseExtractionResponse.ts';
import { buildAttribution } from '../../../src/domain/import/buildAttribution.ts';
import { resolveOembed } from '../../../src/lib/oembed.ts';
import type { ImportPlatform, ImportResult } from '../../../src/domain/import/types.ts';

function readRequiredEnvVar(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `parse-recipe cannot start: missing required environment variable "${name}". ` +
        'Set it with `supabase secrets set` before deploying this function.',
    );
  }
  return value;
}

// Fails loudly at module load — mirrors src/lib/supabase.ts's
// readRequiredEnvVar pattern. A function that silently no-ops (or, worse,
// silently skips extraction) without a configured key is a much harder
// failure to notice than one that refuses to boot at all.
const ANTHROPIC_API_KEY = readRequiredEnvVar('ANTHROPIC_API_KEY');
// Cost-sensitive extraction task, no deep reasoning needed — Haiku is the
// deliberate choice, not a placeholder. `-latest` is an alias; pin an
// exact dated snapshot here before relying on this in production, so a
// silent model upgrade can't silently change extraction behavior.
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-latest';
// Optional: see src/lib/oembed.ts's `instagramAccessToken` — undefined
// here means every Instagram resolution fails with the typed
// `missing_credentials` reason, never a silent empty result.
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

type LlmCallResult = { readonly kind: 'ok'; readonly json: unknown } | { readonly kind: 'error' };

async function callExtractionModel(caption: string, authorName: string | null): Promise<LlmCallResult> {
  const requestBody = buildExtractionRequest({ caption, authorName }, ANTHROPIC_MODEL);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Never included in this function's own response — see the file
        // header's SECURITY note.
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      return { kind: 'error' };
    }
    const json: unknown = await response.json();
    return { kind: 'ok', json };
  } catch {
    return { kind: 'error' };
  }
}

/**
 * The full pipeline for one pasted URL: validate -> resolve oEmbed ->
 * (maybe) ask the model -> validate its answer -> a typed `ImportResult`.
 * Every `return` below is a deliberate, named outcome — there is no
 * unhandled path that falls through to an implicit success.
 */
async function resolveImport(rawUrl: string): Promise<ImportResult> {
  const normalized = normalizeRecipeUrl(rawUrl);
  if (normalized.kind === 'unsupported_url') {
    return { kind: 'unsupported_url' };
  }

  const effective = await resolveEffectiveUrl(normalized.normalizedUrl, normalized.platform, normalized.isShortLink);

  const oembedResult = await resolveOembed(effective.normalizedUrl, effective.platform, {
    fetchFn: fetch,
    instagramAccessToken: INSTAGRAM_OEMBED_ACCESS_TOKEN,
  });
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

  return {
    kind: 'parsed',
    recipe,
    sourceUrl: effective.normalizedUrl,
    platform: effective.platform,
    // Reuses the OembedPayload already fetched above to read the caption
    // -- no second oEmbed round trip. See buildAttribution.ts: this is
    // attribution, not PD-007 Feed opt-in consent.
    attribution: buildAttribution(oembedResult.payload),
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

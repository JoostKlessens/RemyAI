/**
 * Supabase Edge Function: recipe import from a pasted URL — a TikTok or
 * Instagram post, a YouTube video, or an ordinary recipe page.
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
 * server-side, in this function, where the key lives only in the
 * deployment's environment and is attached to the outbound Gemini request as
 * a header — never included in this function's own JSON response body, and
 * never logged. This is a security requirement, not a style preference. The
 * key is read in exactly one file, callExtractionModel.ts, which is also the
 * only file that sends it anywhere; see its header for why a credential's
 * blast radius being one module is the point rather than tidiness.
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
 * TWO OF THE FOUR PLATFORMS CANNOT USE IT AT ALL, AND THAT IS A SCHEMA
 * FACT RATHER THAN A PREFERENCE. 0006_canonical_recipes.sql declares
 * `platform text not null check (platform in ('tiktok', 'instagram'))`, so
 * a `'web'` or `'youtube'` parent row is rejected by the database itself.
 * Both halves of the cache are therefore gated on `canStoreCanonicalRecipe`
 * (src/domain/import/canonicalRecipe.ts, pure and unit-tested) — INSIDE
 * canonicalRecipeStore.ts rather than at the call sites here, so a route
 * added later cannot forget to ask. The lookup is skipped because it is a
 * guaranteed miss, and the write because it is a guaranteed constraint
 * violation — one that would otherwise cost a wasted round trip AND a logged
 * error on every single web and YouTube import, which is how you train
 * whoever reads those logs to stop reading them.
 *
 * WHAT THAT COSTS, SAID OUT LOUD RATHER THAN DISCOVERED LATER. A web or
 * YouTube import deduplicates against nothing — the twentieth household to
 * paste the same recipe page pays the whole fetch again — and, far more
 * important, every one of those imports returns `recipeId: null`, so the
 * meal it produces is a copy of nothing and the social half of the product
 * (`shared_cooks` in 0009, `FRIEND_PROOF_BOOST` in src/domain/scoring.ts)
 * can never fire for it. That is a real product hole, not a rounding error,
 * and it stays open until a migration widens that CHECK. `null` is
 * nonetheless the only honest answer available today: `ImportResult`'s own
 * doc comment defines it as a permanent "this import genuinely has no
 * canonical row", and explicitly forbids substituting `sourceUrl`, which is
 * that row's deduplication key and not its identity.
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
 * THE WEB ROUTE (SRC-01): THE ONE PATH THAT CANNOT HALLUCINATE.
 *
 * A `'web'` URL is any http(s) page that is not one of the three known
 * platforms (urlParsing.ts). It is fetched — hardened, capped, redirect
 * chain followed by us — by `fetchRecipePageHtml` in fetchSourceText.ts,
 * and its schema.org/Recipe JSON-LD is read by `extractRecipeFromHtml` in
 * the pure domain layer. That route skips BOTH of the things every other
 * route does, and each omission is a decision rather than an absence:
 *
 *  - NO OEMBED, because there is no oEmbed endpoint for an arbitrary page.
 *    There is nothing to ask and nobody to ask it of.
 *  - NO MODEL CALL, AND THAT IS THE ENTIRE POINT OF THIS ROUTE. The
 *    JSON-LD block IS the structured answer: named keys a publisher wrote
 *    on purpose, for Google, in a documented vocabulary. Handing it to a
 *    model to be re-read would add a token bill and — much worse — the
 *    ABILITY TO HALLUCINATE to the only path in this function that
 *    currently does not have it. Every field on a web-route recipe can be
 *    traced to a key the publisher typed; a page with no such block fails
 *    as `no_recipe_on_page` rather than being guessed at. That is why this
 *    is the highest-value route in the backlog, and it is only true for as
 *    long as nobody "improves" it by putting a model in the middle.
 *
 * Pinterest arrives here too, and so does any other share-sheet short link
 * (`pin.it` and friends) — not because `resolveEffectiveUrl` expands them,
 * but because the page fetcher follows redirects itself, bounded and
 * validated. See `resolveEffectiveUrl` below and urlParsing.ts's header.
 *
 * ---
 *
 * THE YOUTUBE ROUTE (SRC-02/SRC-03): A DIFFERENT DOOR, THE SAME PIPELINE.
 *
 * A YouTube video's description is read through the YouTube Data API's
 * `videos.list?part=snippet` endpoint (`fetchYouTubeVideoSnippet`,
 * fetchSourceText.ts) — never through YouTube's oEmbed endpoint, which
 * carries the same embedding-only restriction Meta's does and would make
 * reading a description the exact prohibited use PD-011 rules out for
 * Instagram. displayOnlyPolicy.ts's header carries that comparison in
 * full; the short version is that YouTube is not display-only because a
 * DIFFERENT, licensed endpoint answers the question, not because nobody
 * checked.
 *
 * What comes back is a caption and an attribution — precisely what oEmbed
 * hands the TikTok path — so from there it runs the SAME code:
 * `extractRecipeFromCaption` below is the single tail both platforms
 * share, including the "caption is blank, so the model is never called"
 * short-circuit. Forking it would let one platform's anti-hallucination
 * behaviour drift from the other's without anything noticing.
 *
 * `YOUTUBE_API_KEY` is optional at boot and its absence is a typed,
 * user-visible `source_fetch_failed` / `missing_credentials` — never a
 * silent skip, and never a reason for TikTok import to stop working. See
 * env.ts's header for why that credential is read differently from
 * `GEMINI_API_KEY`.
 *
 * ---
 *
 * WHICH ROUTE TALKS TO WHICH ENDPOINT, in one place so it stays true:
 *
 *   tiktok     -> oEmbed            -> Gemini    -> canonical row
 *   instagram  -> oEmbed            -> (stops, PD-011)
 *   youtube    -> Data API snippet  -> Gemini    -> no row (CHECK, above)
 *   web        -> page GET + JSON-LD -> (no model) -> no row (CHECK, above)
 *
 * `resolveOembedFor` is consequently reachable by TikTok and Instagram
 * ONLY, and `resolveImport` is arranged so that this is structural rather
 * than conventional: the web and YouTube branches return before it, which
 * leaves `effective.platform` narrowed to `'tiktok' | 'instagram'` — which
 * is exactly `OembedPlatform` — everywhere below them. (A type-checker
 * would enforce that; this directory is excluded from `tsc --noEmit`, so
 * what it actually buys here is that the claim is verifiable by reading one
 * screen instead of trusting a comment.)
 *
 * ---
 *
 * PROVENANCE (RCP-06): WHERE A RECIPE'S WORDS ACTUALLY CAME FROM.
 *
 * Every `parsed` result states one of two things about itself, and the
 * distinction is the difference between a fact and a reading of one:
 *
 *   publisher_structured_data — the publisher wrote these fields, in named
 *     keys, in a documented vocabulary, and nothing interpreted them. That is
 *     the web/JSON-LD route, and it is why that route is the only one here
 *     which cannot hallucinate (see THE WEB ROUTE above).
 *   model_from_caption — a model's reading of prose that was written for
 *     humans. Honest, useful, and categorically less certain. TikTok's oEmbed
 *     title and YouTube's Data API description both land here, because they
 *     run the same shared tail.
 *
 * IT IS SET WHERE EACH RESULT IS BUILT AND NEVER INFERRED FROM `platform`
 * AFTERWARDS. Platform is a fact about WHO served the URL; provenance is a
 * fact about HOW the words were obtained. The two line up today only because
 * each of today's routes happens to use exactly one method — and the moment a
 * platform serves both (a recipe site that publishes JSON-LD on some pages
 * and prose on the rest; a video platform that starts emitting structured
 * metadata) a lookup table keyed on platform would begin stating the wrong
 * thing with total confidence. Neither may become the other's proxy. Stated
 * at the one line that knows is the only version that can be right.
 *
 * The cache-hit path states its own rather than borrowing this one:
 * `parseStoredRecipe` (src/domain/import/canonicalRecipe.ts) reads it off the
 * stored row, so a served row is never silently re-labelled by whichever
 * route happened to serve it.
 *
 * ---
 *
 * COUNTING IMPORTS (IMP-07). Every reachable outcome of this function —
 * successes included, because a failure rate needs both halves of its
 * fraction — is counted by exactly one structured `console.log` line, at the
 * single point an `ImportResult` becomes a response.
 *
 * EVERY ONE OF THOSE LINES NOW NAMES ITS PLATFORM, except the one that
 * cannot — a property of THIS file, not of the telemetry module, which can
 * only report what the result carries. Every `return` below states the
 * platform its branch was handed; only `unsupported_url` states none,
 * because it returns before a platform exists. `no_recipe_in_caption` is
 * the point of the exercise: "a caption yielded no recipe" is not one
 * number until TikTok's and YouTube's are separable, and that split is the
 * evidence SRC-09 turns on. That point is
 * `respondWithImportResult` in importResponse.ts, and that is the whole
 * reason the module exists: the CORS preflight and the malformed-request
 * 400/405 replies build their responses with `corsPreflightResponse` and
 * `jsonResponse` instead, so they are structurally incapable of emitting a
 * line rather than merely not doing so today. WHAT the line may contain —
 * counts, and nothing that could identify a person, a household, a URL or a
 * dish — is argued in that file's header, including why PD-005 makes that a
 * hard boundary and not a default.
 *
 * ---
 *
 * SCOPE: every source of text this function has is metadata a publisher
 * already offers for reading — an oEmbed caption/title and author name, a
 * Data API `snippet`, or a page's own JSON-LD. NO VIDEO, AUDIO OR IMAGE
 * BINARY IS EVER DOWNLOADED, ANYWHERE IN THIS FUNCTION. Transcribing a
 * video's audio or OCR'ing its on-screen text would surface real
 * ingredients and steps far more often, and is deliberately a different and
 * much larger legal exposure (redistributing and processing a third party's
 * copyrighted video content, rather than reading metadata a documented
 * endpoint already offers). It is OUT OF SCOPE. See
 * src/domain/import/types.ts's file header, fetchSourceText.ts's SRC-09
 * note, and docs/PRODUCT-DECISIONS.md.
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
 * downstream file needing to think about it on this repo's behalf: most
 * cross-file references inside src/domain/import/*.ts are `import
 * type`-only (erased entirely before Deno's loader ever resolves a module
 * graph, so no extension is needed for them), and src/lib/oembed.ts has
 * zero imports of its own to chase. Where a domain file DOES make a real,
 * non-type-only import of a sibling — displayOnlyPolicy.ts importing
 * `buildAttribution` from buildAttribution.ts, or
 * resolveShortLinkTarget.ts importing `normalizeRecipeUrl` from
 * urlParsing.ts — that file already spells out its own `.ts` extension for
 * exactly this reason, so the chain stays resolvable one hop further
 * without index.ts needing to know or care that the hop exists.
 * `allowImportingTsExtensions` (tsconfig.json) is what keeps that legal
 * under `tsc --noEmit` too, since those two files ARE included in the
 * Node/Metro build. It does NOT extend to this function's own five sibling
 * modules (callExtractionModel.ts, canonicalRecipeStore.ts, env.ts,
 * fetchSourceText.ts, importResponse.ts): those are real runtime imports
 * Deno resolves for itself, so they spell out `.ts` too — and so does every
 * import THEY make, one hop further out. Dropping an extension anywhere in
 * that chain fails nothing locally — neither `tsc --noEmit` nor `npm run
 * lint` looks at this directory — it fails the deploy.
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

import { normalizeRecipeUrl, readYouTubeVideoId } from '../../../src/domain/import/urlParsing.ts';
import { validateShortLinkTarget } from '../../../src/domain/import/resolveShortLinkTarget.ts';
import { validateParsedRecipe } from '../../../src/domain/import/validateParsed.ts';
import { parseExtractionResponse } from '../../../src/domain/import/parseExtractionResponse.ts';
import { buildAttribution } from '../../../src/domain/import/buildAttribution.ts';
import { buildDisplayOnlyResult, isDisplayOnlyPlatform } from '../../../src/domain/import/displayOnlyPolicy.ts';
// The JSON-LD reader is the whole web route: it is what makes that path
// modelless, and therefore the one path that cannot invent an ingredient.
import { extractRecipeFromHtml } from '../../../src/domain/import/htmlJsonLd.ts';
import { resolveOembed } from '../../../src/lib/oembed.ts';
import type { OembedPlatform } from '../../../src/lib/oembed.ts';
import type {
  ImportAttribution,
  ImportPlatform,
  ImportResult,
  ParsedRecipe,
  RecipeProvenance,
} from '../../../src/domain/import/types.ts';
// The five sibling modules of this function, each owning one thing this file
// therefore no longer does. `canonicalRecipeStore.ts` owns every read and
// write of the canonical tables, and the service role key that performs them;
// `fetchSourceText.ts` owns every outbound request to a host A USER CHOSE —
// the page GET, the YouTube Data API call and the TikTok short-link chain —
// plus the YouTube credential one of them needs; `callExtractionModel.ts`
// owns the one outbound request to a host THIS REPO chose, and the Gemini key
// that pays for it; `importResponse.ts` owns everything this function says to
// a client or to a log, which is what makes counting an import outcome
// inseparable from answering one (IMP-07); `env.ts` owns the credential
// readers the others share. Three of the five exist so that a secret's blast
// radius is one importable file rather than this one. Their `.ts` extensions
// are required for the same Deno reason as the imports above.
import { findStoredRecipe, storeCanonicalRecipe } from './canonicalRecipeStore.ts';
import { callExtractionModel } from './callExtractionModel.ts';
import { expandShortLink, fetchRecipePageHtml, fetchYouTubeVideoSnippet } from './fetchSourceText.ts';
import { corsPreflightResponse, jsonResponse, respondWithImportResult } from './importResponse.ts';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Expands a short link, or hands its input straight back.
 *
 * THIS IS A TIKTOK-ONLY EXPANSION, AND STAYS ONE. `isShortLink` is set by
 * `normalizeRecipeUrl` for `vm.tiktok.com`/`vt.tiktok.com` and nothing else
 * (urlParsing.ts), so a `'web'`, `'youtube'` or `'instagram'` URL takes the
 * first branch and passes through untouched — no HEAD request, no hop
 * budget spent.
 *
 * THAT IS NOT THE SAME AS "OTHER SHORT LINKS DO NOT WORK", and the
 * difference is worth stating because the two are easy to confuse. A
 * `pin.it` or other share-sheet short link is a `'web'` URL that resolves
 * perfectly well — not because this function expands it, but because
 * `fetchRecipePageHtml` (fetchSourceText.ts) follows redirects itself,
 * under the same bounded, validated rules used here. TikTok's short links
 * need this earlier step for a specific reason those do not: their target
 * must be known BEFORE the platform's oEmbed endpoint is called, since
 * oEmbed will not accept an opaque `vm.` code. A page fetcher has no such
 * constraint — it simply follows the chain and reads whatever it lands on.
 *
 * One consequence, recorded rather than papered over: a `'web'` import's
 * canonical URL stays the PRE-redirect one the user pasted, because that is
 * what the pipeline carries forward. Nothing is at stake there today —
 * `canStoreCanonicalRecipe('web')` is false, so no row is keyed on it (see
 * the header) — but if that CHECK is ever widened, `pin.it/abc` and the
 * page it lands on would key two different rows for one recipe, and this is
 * the line where that would need fixing.
 */
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
  const validated = validateShortLinkTarget(expanded);
  return validated ?? { normalizedUrl, platform };
}

/**
 * One place that knows how this function calls oEmbed, so its two call
 * sites cannot drift apart.
 *
 * TYPED `OembedPlatform`, NOT `ImportPlatform`, AND THAT IS THE POINT. Two
 * of the four platforms this function now handles have no business here at
 * all: a `'web'` page has no oEmbed endpoint, and YouTube's exists but is
 * licensed for embedding only — reading a description from it would be the
 * exact use PD-011 forbids for Instagram (displayOnlyPolicy.ts). Naming
 * oEmbed's own two-member union here says that in the signature instead of
 * in a comment somebody has to find, and `resolveImport` returns the web
 * and YouTube routes before this line is reachable, so the narrowing is
 * real rather than aspirational.
 */
function resolveOembedFor(normalizedUrl: string, platform: OembedPlatform) {
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
async function resolveDisplayOnlyImport(normalizedUrl: string, platform: OembedPlatform): Promise<ImportResult> {
  const oembedResult = await resolveOembedFor(normalizedUrl, platform);
  if (oembedResult.kind === 'error') {
    // The same honest, typed failure as every other path: a deleted post or
    // a missing Instagram token still has to say so, rather than pretend to
    // have resolved something it did not. The platform is this function's
    // own argument, so the result says WHOSE endpoint refused us —
    // `missing_credentials` is an unset Instagram token and nothing else.
    return { kind: 'oembed_failed', reason: oembedResult.reason, platform };
  }
  return buildDisplayOnlyResult({ sourceUrl: normalizedUrl, platform, payload: oembedResult.payload });
}

interface ParsedRecipeCompletion {
  readonly recipe: ParsedRecipe;
  readonly normalizedUrl: string;
  readonly platform: ImportPlatform;
  readonly attribution: ImportAttribution;
  /**
   * RCP-06, and REQUIRED here rather than defaulted, which is the point: the
   * caller has to say how it got these words, because it is the only code
   * that knows. A default would let a route added later inherit somebody
   * else's answer silently. It sits beside `platform` and must never be
   * derived from it — see the PROVENANCE section in the file header.
   */
  readonly provenance: RecipeProvenance;
}

/**
 * The single place a fully validated recipe becomes a `parsed` result —
 * shared by the caption routes and the JSON-LD one, so all three store and
 * report the canonical id identically.
 *
 * The write is AWAITED, not fire-and-forget. Letting it run detached would
 * shave a few hundred milliseconds off the response, but an edge runtime is
 * free to tear down the isolate once the response is returned, which would
 * silently drop the write — turning deduplication into an expensive no-op
 * that still looks like it is working. Correct-and-slightly-slower wins
 * here, and only on the miss path, which was already paying for a fetch.
 * There is a second reason since W-01b: the id this returns is the only way
 * the response can tell the client which canonical row its meal is a copy
 * of, and there is nowhere else to get it from afterwards.
 */
async function finishParsedRecipe(input: ParsedRecipeCompletion): Promise<ImportResult> {
  // Returns null without a round trip for a platform `recipes`' CHECK
  // refuses — the guard lives in the store, where it cannot be skipped by a
  // route that forgets to ask. See canonicalRecipeStore.ts's header.
  const recipeId = await storeCanonicalRecipe(
    input.recipe,
    input.normalizedUrl,
    input.platform,
    input.attribution,
  );
  return {
    kind: 'parsed',
    recipe: input.recipe,
    sourceUrl: input.normalizedUrl,
    platform: input.platform,
    attribution: input.attribution,
    // Passed straight through from the route that produced the recipe. This
    // function deliberately has no opinion about it: it does not know whether
    // it was handed JSON-LD a publisher wrote or a model's reading of a
    // caption, and inventing an answer from `input.platform` here is exactly
    // the shortcut the header rules out.
    provenance: input.provenance,
    // Straight through, null included. No canonical row — because the write
    // failed, or because the schema refuses this platform — means this
    // import really is a copy of nothing, and saying so is the only honest
    // answer. `sourceUrl` above is a deduplication key, never a stand-in for
    // this id. The cache-hit path returns the same field from the stored
    // row's `id` (`parseStoredRecipe`), so the two paths agree.
    recipeId,
  };
}

interface CaptionExtraction {
  readonly normalizedUrl: string;
  readonly platform: ImportPlatform;
  /** Null or blank means the model is never called at all — see below. */
  readonly caption: string | null;
  readonly attribution: ImportAttribution;
}

/**
 * Caption text in, `ImportResult` out: ask the model, validate its answer,
 * store the recipe. TikTok reaches this with an oEmbed title; YouTube
 * reaches it with a Data API description. THEY RUN THE SAME CODE, and that
 * is a correctness property rather than tidiness — the anti-hallucination
 * behaviour this function encodes (the model's explicit `report_no_recipe`
 * becoming an honest `no_recipe_in_caption`, a malformed answer becoming
 * `parse_failed` instead of a half-populated recipe) must not be able to
 * hold for one platform and quietly rot for the other. A forked copy is how
 * that happens.
 *
 * The blank-caption short-circuit is part of the shared contract, not an
 * optimization bolted onto one caller: a video with no description costs no
 * tokens and still returns the creator's attribution, exactly as IMP-02
 * requires.
 */
async function extractRecipeFromCaption(input: CaptionExtraction): Promise<ImportResult> {
  const { attribution, caption, normalizedUrl, platform } = input;

  if (caption === null || caption.trim().length === 0) {
    // Nothing to send the model: no LLM call, no cost, and just as honest
    // an outcome as the model reading a caption and finding no recipe.
    //
    // IMP-07. The platform travels with it here and on the branch below,
    // because these two returns are most of the SRC-09 number and neither
    // is worth counting until it can be read per platform: a YouTube
    // description is rarely blank where a TikTok caption often is.
    return { kind: 'no_recipe_in_caption', caption: null, attribution, platform };
  }

  const llmResult = await callExtractionModel(caption, attribution.authorName);
  if (llmResult.kind === 'error') {
    return { kind: 'llm_request_failed', platform };
  }

  const extraction = parseExtractionResponse(llmResult.json);
  if (extraction.kind === 'malformed') {
    return { kind: 'parse_failed', platform };
  }
  if (extraction.kind === 'no_recipe') {
    return { kind: 'no_recipe_in_caption', caption, attribution, platform };
  }

  const recipe = validateParsedRecipe(extraction.rawRecipe);
  if (recipe === null) {
    return { kind: 'parse_failed', platform };
  }

  // Only a fully validated recipe is ever stored — every failure branch
  // above returned already, so nothing half-parsed can become the canonical
  // answer a later importer receives.
  //
  // `model_from_caption` for BOTH platforms that reach here, and it is a
  // statement about this function rather than about TikTok or YouTube: what
  // was read is prose written for humans, and a model did the reading.
  return finishParsedRecipe({ recipe, normalizedUrl, platform, attribution, provenance: 'model_from_caption' });
}

/**
 * THE WEB ROUTE (SRC-01). Fetch the page, read its JSON-LD, done — no
 * oEmbed (there is no endpoint to ask) and NO MODEL CALL (the JSON-LD is
 * already the structured answer, so a model could only add cost and the
 * ability to invent). See the header section of the same name; that second
 * omission is the entire value of this route and must survive future edits.
 *
 * Everything hard about this path is elsewhere and on purpose: the hardened
 * fetch is fetchSourceText.ts's (host guard, bounded redirect chain, per-
 * request timeout, streamed byte cap), and every judgement about what the
 * markup MEANS is htmlJsonLd.ts's, where it is pure and unit-tested. This
 * function is only the join between them, which is why almost every line of
 * it is a named failure rather than any work of its own.
 */
async function resolveWebImport(normalizedUrl: string): Promise<ImportResult> {
  const cached = await findStoredRecipe(normalizedUrl, 'web');
  if (cached !== null) {
    return cached;
  }

  const page = await fetchRecipePageHtml(normalizedUrl);
  if (page.kind === 'failed') {
    // A literal, not a parameter: `resolveImport` only enters this route
    // for a `'web'` URL, so it is a fact about which function you are in.
    return { kind: 'source_fetch_failed', reason: page.reason, platform: 'web' };
  }

  const extraction = extractRecipeFromHtml(page.value);
  if (extraction === null) {
    // The page loaded and simply publishes no schema.org/Recipe object.
    // A real, permanent answer about a real page — distinct from every
    // `source_fetch_failed` reason, which are all answers about the fetch —
    // and emphatically not a cue to go and guess at the visible markup.
    return { kind: 'no_recipe_on_page', platform: 'web' };
  }

  return finishParsedRecipe({
    recipe: extraction.recipe,
    normalizedUrl,
    platform: 'web',
    attribution: extraction.attribution,
    // The publisher stated these fields themselves, in named JSON-LD keys, and
    // no model touched them. This is the only route that can say that, and
    // saying it here — not deriving it from `platform: 'web'` later — is what
    // keeps the claim true if a `'web'` page ever needs a different reader.
    provenance: 'publisher_structured_data',
  });
}

/**
 * THE YOUTUBE ROUTE (SRC-02/SRC-03). The Data API's `videos.list` snippet
 * — never YouTube's oEmbed endpoint, see the header — and then the shared
 * caption pipeline every TikTok import already runs.
 */
async function resolveYouTubeImport(normalizedUrl: string): Promise<ImportResult> {
  const cached = await findStoredRecipe(normalizedUrl, 'youtube');
  if (cached !== null) {
    return cached;
  }

  const videoId = readYouTubeVideoId(normalizedUrl);
  if (videoId === null) {
    // Unreachable in theory and loud on purpose: THIS FUNCTION PRODUCED
    // that URL, via `normalizeRecipeUrl`, which only emits the canonical
    // `watch?v=<id>` form. A null here means the writer and the reader of
    // that form have stopped agreeing — a bug in our own code, not a
    // problem with the user's link — and it would otherwise look to a user
    // exactly like a dead video.
    console.error(`parse-recipe: normalized YouTube URL carried no readable video id. url=${normalizedUrl}`);
    return { kind: 'source_fetch_failed', reason: 'refused', platform: 'youtube' };
  }

  const snippet = await fetchYouTubeVideoSnippet(videoId);
  if (snippet.kind === 'failed') {
    // Includes `missing_credentials` when YOUTUBE_API_KEY is unset — the
    // same honest, actionable failure Instagram gives without its oEmbed
    // token, and never a silent skip. Naming `'youtube'` keeps that reason
    // readable: this variant is shared with the web route, where an unset
    // key cannot happen, so the one failure with a named fix would
    // otherwise be counted as ambiguous.
    return { kind: 'source_fetch_failed', reason: snippet.reason, platform: 'youtube' };
  }

  return extractRecipeFromCaption({
    normalizedUrl,
    platform: 'youtube',
    caption: snippet.value.caption,
    attribution: snippet.value.attribution,
  });
}

/**
 * The full pipeline for one pasted URL: validate -> resolve the short link
 * -> FAN OUT BY PLATFORM -> a typed `ImportResult`. Every `return` below is
 * a deliberate, named outcome; there is no unhandled path that falls
 * through to an implicit success.
 *
 * The fan-out is the shape of this function now, and its ORDER carries
 * meaning. It sits after short-link resolution, so the platform is final
 * before anything branches on it, and each of the three early returns takes
 * a whole route out of the code below it:
 *
 *  - `'web'` and `'youtube'` leave first, which is what makes everything
 *    after them TikTok-or-Instagram — that is, `OembedPlatform` — by
 *    narrowing rather than by comment. oEmbed is unreachable from the other
 *    two routes as a matter of control flow.
 *  - display-only (PD-011) leaves next, before the cache lookup rather than
 *    after it, so that not even a caption-derived row written by an earlier
 *    deployment can be served; see `resolveDisplayOnlyImport`.
 *
 * What remains below is TikTok's alone: the cache, oEmbed, the model, the
 * canonical write. The cache stage is the only one that can skip everything
 * after it, and its exact position between short-link resolution and oEmbed
 * is load-bearing — see the DEDUPLICATION section in the header for why
 * neither one step earlier nor one step later is correct.
 */
async function resolveImport(rawUrl: string): Promise<ImportResult> {
  const normalized = normalizeRecipeUrl(rawUrl);
  if (normalized.kind === 'unsupported_url') {
    // THE ONE RETURN IN THIS FILE THAT NAMES NO PLATFORM, and the line
    // above is why: establishing the platform is exactly what failed.
    // Everything past here has `normalized.platform` in hand, which is what
    // lets types.ts require the field everywhere else. No default here —
    // see that file's `unsupported_url` comment.
    return { kind: 'unsupported_url' };
  }

  const effective = await resolveEffectiveUrl(normalized.normalizedUrl, normalized.platform, normalized.isShortLink);

  // SRC-01. An arbitrary page: fetched and read from its own JSON-LD, with
  // no oEmbed call and no model call at all.
  if (effective.platform === 'web') {
    return resolveWebImport(effective.normalizedUrl);
  }

  // SRC-02/SRC-03. The YouTube Data API, then the shared caption pipeline.
  if (effective.platform === 'youtube') {
    return resolveYouTubeImport(effective.normalizedUrl);
  }

  // Past this line only `'tiktok'` and `'instagram'` remain — the platforms
  // oEmbed serves and the ones `recipes`' CHECK accepts — as a consequence
  // of the two returns above rather than as an assumption.

  // PD-011. Everything below — the cache, the model, the write — is skipped
  // for a display-only platform, and this sits BEFORE the cache lookup so
  // that no stored, caption-derived row can be served either; see
  // resolveDisplayOnlyImport for why both halves matter.
  if (isDisplayOnlyPlatform(effective.platform)) {
    return resolveDisplayOnlyImport(effective.normalizedUrl, effective.platform);
  }

  // A hit returns here, having called neither oEmbed nor the model: no
  // third-party round trip, no tokens, no cost. This is the entire point of
  // Fase 1b — the twentieth household to import a link pays one indexed
  // lookup instead of the whole pipeline.
  const storedRecipe = await findStoredRecipe(effective.normalizedUrl, effective.platform);
  if (storedRecipe !== null) {
    return storedRecipe;
  }

  const oembedResult = await resolveOembedFor(effective.normalizedUrl, effective.platform);
  if (oembedResult.kind === 'error') {
    // `effective.platform`, never the pre-expansion one: a short link has
    // already resolved, so this names the endpoint that actually refused us.
    return { kind: 'oembed_failed', reason: oembedResult.reason, platform: effective.platform };
  }

  // Built once, right after oEmbed resolves, and carried into every outcome
  // the shared tail can produce — including both `no_recipe_in_caption`
  // branches (IMP-02). See buildAttribution.ts: this is attribution, not
  // PD-007 Feed opt-in consent. An `OembedPayload` is unconditionally in
  // hand by this line, which is what leaves no later `return` any excuse to
  // omit the creator this function already resolved.
  const attribution = buildAttribution(oembedResult.payload);

  // From here TikTok runs the shared tail — the same function YouTube's
  // Data API description is handed to, so neither platform can drift away
  // from the other's anti-hallucination behaviour. `payload.title` is the
  // caption; `extractRecipeFromCaption` owns every decision after it.
  return extractRecipeFromCaption({
    normalizedUrl: effective.normalizedUrl,
    platform: effective.platform,
    caption: oembedResult.payload.title,
    attribution,
  });
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
  // Neither of the next two replies is an import outcome, and neither is
  // counted (IMP-07): a preflight asks whether it may POST, and a wrong
  // method never reached the pipeline. Both use the response builders that
  // have no telemetry in them — see importResponse.ts.
  if (request.method === 'OPTIONS') {
    return corsPreflightResponse();
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = await readUrlFromRequest(request);
  if (url === null) {
    // Also not counted: a body with no usable `url` never became an import,
    // so it has no outcome. Counting it would inflate the denominator the
    // whole telemetry line exists to make trustworthy.
    return jsonResponse({ error: 'Request body must be { "url": string }' }, 400);
  }

  try {
    const result = await resolveImport(url);
    // The one place an `ImportResult` becomes a response, which is therefore
    // the one place an import is counted — successes and modeled failures
    // alike, exactly once each.
    return respondWithImportResult(result);
  } catch (error) {
    // A genuinely unexpected exception (not one of the modeled failure
    // paths above, all of which return normally) — logged server-side
    // only, never echoed into the response body.
    console.error('parse-recipe: unexpected failure', error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});

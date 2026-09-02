/**
 * Supabase Edge Function: recipe import. From a pasted URL — a TikTok or
 * Instagram post, a YouTube video, or an ordinary recipe page — or from
 * recipe text the user pasted with no URL behind it at all.
 *
 * POST { url: string } OR { text: string }, exactly one of the two -> 200
 * application/json, body is an `ImportResult` (src/domain/import/types.ts)
 * for every REACHABLE outcome, including failures — see that file's header
 * for why every failure is a distinct, typed `kind` rather than a shared
 * error bucket. Non-2xx status codes are reserved for the request itself
 * being malformed (neither field, both fields, a blank or over-long `text`,
 * wrong HTTP method) or a genuinely unexpected server error; the client
 * should switch on `body.kind`, not on HTTP status, for every case this
 * feature actually anticipates. WHICH bodies are refused, and why an
 * over-long paste is one of them, is argued in importRequest.ts.
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
 * READ THAT NARROWLY (IMP-06 / IMP-10): it stops a caller with NO token,
 * and nothing else. It does not stop a signed-in user calling this endpoint
 * in a loop, nor this project's own anon key — a validly-signed JWT with no
 * `sub` that ships inside the app bundle, which a live test on 2 September
 * 2026 confirmed reaches this handler. BOTH ARE NOW STOPPED, by the gate in
 * `Deno.serve` below: a signed-in caller is metered against two windows,
 * and a caller with no `sub` is refused outright. The three pieces are
 * importBudget.ts (the argument), supabaseImportBudgetStore.ts (the durable
 * counter, over `import_attempts` from migration 0012) and
 * src/domain/import/importBudgetPolicy.ts (the pure, tested decision).
 *
 * THE FUNCTION NO LONGER BOOTS WITHOUT `IMPORT_FINGERPRINT_SALT`. It is
 * what pseudonymises an unidentified caller's address; 0012's header argues
 * why a missing salt must be a refusal to start rather than a default.
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
 * THREE OF THE FIVE SOURCES CANNOT USE IT AT ALL, FOR TWO DIFFERENT
 * REASONS, AND THE DIFFERENCE IS THE INTERESTING PART. For `'web'` and
 * `'youtube'` it is a SCHEMA fact: 0006_canonical_recipes.sql declares
 * `platform text not null check (platform in ('tiktok', 'instagram'))`, so
 * either parent row is rejected by the database itself — a CHECK a migration
 * could widen. For `'text'` (SRC-08) it is not a constraint at all but the
 * absence of a KEY: that table is keyed on `normalized_url` and a pasted text
 * has no URL to be keyed under, so neither half of the cache has anything to
 * ask about, however that CHECK is widened later. See
 * `resolveCanonicalRecipeId` in finishImport.ts.
 * Both halves of the cache are therefore gated on `canStoreCanonicalRecipe`
 * (src/domain/import/canonicalRecipe.ts, pure and unit-tested) — INSIDE
 * canonicalRecipeStore.ts rather than at the call sites here, so a route
 * added later cannot forget to ask. The lookup is skipped because it is a
 * guaranteed miss, and the write because it is a guaranteed constraint
 * violation — one that would otherwise cost a wasted round trip AND a logged
 * error on every single web and YouTube import, which is how you train
 * whoever reads those logs to stop reading them.
 *
 * WHAT THAT COSTS, SAID OUT LOUD RATHER THAN DISCOVERED LATER. A web,
 * YouTube or pasted-text import deduplicates against nothing — the twentieth
 * household to paste the same page pays the whole fetch again, and the
 * twentieth to paste the same TEXT the whole extraction — and, far more
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
 * THE WEB ROUTE (SRC-01) and THE YOUTUBE ROUTE (SRC-02/SRC-03) ARGUE FOR
 * THEMSELVES ELSEWHERE NOW: resolveWebImport.ts and
 * resolveYouTubeImport.ts, beside their own code. Both were sections of
 * this header until each route became a module, and both moved intact —
 * a route that is a whole pipeline rather than a branch takes its
 * reasoning with it, or the reasoning rots where the code no longer is.
 * Nothing about either route changed in the move.
 *
 * WHAT STAYS HERE IS WHAT IS TRUE OF THE FAN-OUT RATHER THAN OF ONE ROUTE:
 * the table below that has to name all five sources to be true at all, the
 * PROVENANCE and DEDUPLICATION arguments that span them, and
 * `resolveImport` itself, where the ORDER of the early returns is the
 * load-bearing part — the web and YouTube branches return first, which is
 * what narrows everything after them to `OembedPlatform`.
 *
 * ---
 *
 * THE PASTED-TEXT ROUTE (SRC-08): A SOURCE WITH NO URL AT ALL.
 *
 * A `{ text }` body is a recipe the user already had — forwarded in a
 * message, sitting in an email, read off a photo of a cookbook page and
 * typed out. There is nothing to fetch, nobody to ask and no address to
 * normalise, which removes every step the other four routes are made of: NO
 * `normalizeRecipeUrl`, NO short-link expansion, NO oEmbed, NO page GET, and
 * neither half of the Fase 1b cache. What is left is the model call, which is
 * why `resolveTextImport` below is six lines long: it hands the user's own
 * words to the SAME `extractRecipeFromCaption` TikTok and YouTube run.
 *
 * THE CACHE IS SKIPPED FOR WANT OF A KEY, NOT BECAUSE A GUARD REFUSED.
 * `canStoreCanonicalRecipe('text')` is false and would refuse the write on
 * its own, but that is the second reason and the weaker one. `recipes` is
 * keyed on `normalized_url` (0006) and this route has no URL, so there is
 * nothing to look a stored row up BY and nothing to write a new one UNDER —
 * and that stays true however the CHECK is widened later. Two households
 * pasting identical text are two unrelated imports, each paying for its own
 * extraction; the only thing that could change that is a hash of the text as
 * a second deduplication key, which is a different question with a schema
 * decision attached and is the owner's to take.
 *
 * NOBODY IS CREDITED, AND THAT IS CORRECT RATHER THAN DEGRADED. Every other
 * route treats an unnamed creator as a failure — `display_only` refuses
 * outright without one (PD-011), a malformed attribution fails the whole
 * import — so an all-null attribution turning up anywhere else is a symptom.
 * Here there is no creator being lost: nothing of a third party's was
 * fetched, nothing is shown back to anybody but the person who supplied it,
 * and their own private library is not a surface on which somebody's work is
 * being republished. It is the posture manual entry has always had, and
 * pasting rather than typing does not change who is looking at what. So this
 * route says it with the NAMED constant `NO_CREATOR_TO_CREDIT`
 * (buildAttribution.ts) instead of three nulls written inline, precisely so
 * that the deliberate case and the symptom cannot be confused by grep.
 *
 * WHAT THE ROUTE CANNOT KNOW, AND DOES NOT PRETEND TO. The text may well
 * have been copied out of a blog whose author would want crediting; this
 * function has no way to tell, and inventing a source would be the exact
 * fabrication the rest of this file exists to prevent. So `sourceUrl` is
 * null, and the provenance is `model_from_pasted_text` rather than a reuse
 * of `model_from_caption` — a caption was published beside a video by the
 * person who made it, and a paste has no publisher this function can see.
 * The confirmation screen tells the user which of the three they hold.
 *
 * ---
 *
 * WHICH ROUTE TALKS TO WHICH ENDPOINT, in one place so it stays true:
 *
 *   tiktok     -> oEmbed            -> Gemini    -> canonical row
 *   instagram  -> oEmbed            -> (stops, PD-011)
 *   youtube    -> Data API snippet  -> Gemini    -> no row (CHECK, above)
 *   web        -> page GET + JSON-LD -> (no model) -> no row (CHECK, above)
 *   text       -> (nothing fetched) -> Gemini    -> no row (NO KEY, above)
 *
 * `resolveOembedFor` is consequently reachable by TikTok and Instagram
 * ONLY, and `resolveImport` is arranged so that this is structural rather
 * than conventional: the web and YouTube branches return before it, which
 * leaves `effective.platform` narrowed to `'tiktok' | 'instagram'` — which
 * is exactly `OembedPlatform` — everywhere below them. (A type-checker
 * enforces that as of `npm run check:functions`; this parenthesis used to
 * say no type-checker saw this directory at all, which stopped being true
 * the day that script landed. What the ordering additionally buys is that
 * the claim is verifiable by reading one screen instead of trusting a
 * comment.)
 *
 * ---
 *
 * PROVENANCE (RCP-06): WHERE A RECIPE'S WORDS ACTUALLY CAME FROM.
 *
 * Every `parsed` result states one of three things about itself, and the
 * distinctions are the difference between a fact, a reading of somebody's
 * published prose, and a reading of prose with no publisher behind it:
 *
 *   publisher_structured_data — the publisher wrote these fields, in named
 *     keys, in a documented vocabulary, and nothing interpreted them. That is
 *     the web/JSON-LD route, and it is why that route is the only one here
   *     which cannot hallucinate (see resolveWebImport.ts's header).
 *   model_from_caption — a model's reading of prose that was written for
 *     humans. Honest, useful, and categorically less certain. TikTok's oEmbed
 *     title and YouTube's Data API description both land here, because they
 *     run the same shared tail.
 *   model_from_pasted_text — the same model, reading prose the USER supplied
 *     (SRC-08). No publisher stands behind it and there is no source we could
 *     go back and check. A third member rather than a reuse of the one above,
 *     because "a creator wrote this caption under their own video" and
 *     "somebody pasted this from somewhere" are different claims about where
 *     the words came from — which is why the shared tail takes provenance as
 *     an argument rather than hardcoding it.
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
 * single point an `ImportResult` becomes a response. The pasted-text route
 * needed NO NEW FIELD to be counted, which is the test a shared telemetry
 * line should pass: it returns the same variants carrying `platform: 'text'`,
 * so it lands in the same four-key line and the same denominator.
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
 * SCOPE: every source of text this function has is either metadata a
 * publisher already offers for reading — an oEmbed caption/title and author
 * name, a Data API `snippet`, or a page's own JSON-LD — or text the user
 * handed us themselves (SRC-08), fetched from nobody. NO VIDEO, AUDIO OR
 * IMAGE BINARY IS EVER DOWNLOADED, ANYWHERE IN THIS FUNCTION. The text route
 * does not widen that an inch: a paste is characters a person typed or
 * copied. Transcribing a
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
 * Node/Metro build. It does NOT extend to this function's own nine sibling
 * modules (callExtractionModel.ts, canonicalRecipeStore.ts, env.ts,
 * fetchSourceText.ts, finishImport.ts, importRequest.ts, importResponse.ts,
 * resolveWebImport.ts, resolveYouTubeImport.ts):
 * those are real runtime imports Deno resolves for itself, so they spell out
 * `.ts` too — and so does every
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

import { normalizeRecipeUrl } from '../../../src/domain/import/urlParsing.ts';
import { validateShortLinkTarget } from '../../../src/domain/import/resolveShortLinkTarget.ts';
// `NO_CREATOR_TO_CREDIT` out of the same module as `buildAttribution`, and
// that adjacency is the argument: one builds an attribution from a source
// that named a creator, the other IS the answer for the one route that
// consulted no source at all.
import { buildAttribution, NO_CREATOR_TO_CREDIT } from '../../../src/domain/import/buildAttribution.ts';
import { buildDisplayOnlyResult, isDisplayOnlyPlatform } from '../../../src/domain/import/displayOnlyPolicy.ts';
import { resolveOembed } from '../../../src/lib/oembed.ts';
import type { OembedPlatform } from '../../../src/lib/oembed.ts';
// Down to two, because the recipe-shaped types moved with the tail that
// handles them (finishImport.ts). This file routes and answers; it no longer
// touches a `ParsedRecipe` on the way past.
import type { ImportPlatform, ImportResult } from '../../../src/domain/import/types.ts';
// The ELEVEN sibling modules of this function, each owning one thing this file
// therefore no longer does. `importRequest.ts` owns what a client is allowed
// to send, so the boundary is a place with a header rather than the opening
// lines of a handler; `canonicalRecipeStore.ts` owns every read and write of
// the canonical tables, and the service role key that performs them;
// `fetchSourceText.ts` owns every outbound request to a host A USER CHOSE —
// the page GET, the YouTube Data API call and the TikTok short-link chain —
// plus the YouTube credential one of them needs; `callExtractionModel.ts`
// owns the one outbound request to a host THIS REPO chose, and the Gemini key
// that pays for it; `finishImport.ts` owns the tail every recipe-producing
// route ends in, which is what makes "TikTok, YouTube and a paste run the
// same model path" a fact about the call graph rather than a claim in a
// comment; `importResponse.ts` owns everything this function says to a client
// or to a log, which is what makes counting an import outcome inseparable
// from answering one (IMP-07); `resolveWebImport.ts` and
// `resolveYouTubeImport.ts` each own one route's whole pipeline, which is
// what keeps this file a fan-out rather than a fan-out plus two of the five
// things it fans out to; `env.ts` owns the credential readers the
// others share; and `importBudget.ts` and `supabaseImportBudgetStore.ts`
// own the throttle's two halves, the pure decision and the impure counter,
// split so that only one of them ever touches PostgREST.
//
// THIS COUNT SAID NINE UNTIL 2 SEPTEMBER 2026, AND THE TWO IT OMITTED WERE
// THE TWO ABOVE — the same IMP-06/IMP-10 work that left `import_throttled`
// undocumented in importResult.ts. A count in prose is a claim that decays
// the moment a sibling is added and nothing in the toolchain checks it,
// which is the argument for naming the modules rather than counting them;
// the count survives here only because the list beside it is what makes it
// falsifiable. Three of the eleven exist so that a secret's blast radius is
// one importable file rather than this one, and two are now further away
// still: the Gemini key is not imported here at all and the canonical WRITE
// no longer is either — both are reached through `finishImport.ts`, leaving
// this file only the cache lookup. Their `.ts` extensions are required for
// the same Deno reason as the imports above.
import { findStoredRecipe } from './canonicalRecipeStore.ts';
import { expandShortLink } from './fetchSourceText.ts';
import { extractRecipeFromCaption } from './finishImport.ts';
import {
  createImportSpendRecorder,
  readCallerId,
  type ImportSpendRecorder,
} from './importBudget.ts';
import { readImportRequest } from './importRequest.ts';
// IMP-06 / IMP-10. The counter and the decision, in that order: the store is
// the impure half (PostgREST, a fingerprint, a household lookup) and lives
// beside this file; the policy is pure, unit-tested, and lives in
// src/domain/**, which is the only half anything in this repo type-checks.
import {
  buildCallerFingerprint,
  ImportBudgetUnavailableError,
  readCallerBudget,
  readClientAddress,
  recordAttempt,
  type CallerBudgetContext,
} from './supabaseImportBudgetStore.ts';
import { classifyImportCost, decideImportBudget } from '../../../src/domain/import/importBudgetPolicy.ts';
import type { ImportBudgetDecision } from '../../../src/domain/import/importBudgetPolicy.ts';
import { corsPreflightResponse, jsonResponse, respondWithImportResult } from './importResponse.ts';
// The two routes that are whole pipelines rather than branches, each now
// arguing for itself beside its own code. This file reaches them from the
// fan-out in `resolveImport` and knows nothing else about either.
import { resolveWebImport } from './resolveWebImport.ts';
import { resolveYouTubeImport } from './resolveYouTubeImport.ts';

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
  platform: Exclude<ImportPlatform, 'text'>,
  isShortLink: boolean,
): Promise<{ readonly normalizedUrl: string; readonly platform: Exclude<ImportPlatform, 'text'> }> {
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
 * TYPED `OembedPlatform`, NOT `ImportPlatform`, AND THAT IS THE POINT.
 * Three of the five sources this function now handles have no business here
 * at all: a `'web'` page has no oEmbed endpoint; YouTube's exists but is
 * licensed for embedding only — reading a description from it would be the
 * exact use PD-011 forbids for Instagram (displayOnlyPolicy.ts); and a
 * `'text'` import has no URL to hand an oEmbed endpoint even in principle.
 * Naming oEmbed's own two-member union here says that in the signature
 * instead of in a comment somebody has to find, and the narrowing is real
 * rather than aspirational: `resolveImport` returns the web and YouTube
 * routes before this line is reachable, and the text route never enters
 * `resolveImport` at all.
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

/**
 * THE PASTED-TEXT ROUTE (SRC-08). Six lines, and the interesting thing about
 * every one of them is what this route does NOT do — see the header section
 * of the same name. There is no URL to normalise, no host to fetch, no oEmbed
 * endpoint to ask, and no canonical row to look up or write, so what remains
 * is the shared model tail with four values stated out loud.
 *
 * It returns the tail's promise rather than awaiting it: the whole route IS
 * the shared tail, and a wrapper `await` would only obscure that.
 */
function resolveTextImport(text: string, spend: ImportSpendRecorder): Promise<ImportResult> {
  return extractRecipeFromCaption({
    spend,
    // No URL EXISTS, as distinct from one we failed to resolve — the
    // difference `ImportResult.parsed.sourceUrl` was widened to hold.
    sourceUrl: null,
    platform: 'text',
    // Already trimmed, non-blank and inside the length cap
    // (importRequest.ts), so the tail's blank short-circuit is unreachable
    // from here; it stays there for the two routes that can still hit it.
    caption: text,
    // The named constant, never three nulls written inline: this is the one
    // route where crediting nobody is correct rather than a creator we failed
    // to resolve, and the name is what keeps that case greppable apart from
    // the symptom. See buildAttribution.ts and the header section above.
    attribution: NO_CREATOR_TO_CREDIT,
    // A third provenance, not a reuse of `model_from_caption`: a caption was
    // published beside a video by whoever made it; a paste has no publisher.
    provenance: 'model_from_pasted_text',
  });
}

/**
 * The full pipeline for one pasted URL: validate -> resolve the short link
 * -> FAN OUT BY PLATFORM -> a typed `ImportResult`. Every `return` below is
 * a deliberate, named outcome; there is no unhandled path that falls
 * through to an implicit success.
 *
 * A `{ text }` body never reaches this function at all: it has no URL to
 * validate and no short link to resolve, so `resolveTextImport` above is its
 * entire route. There is no `'text'` branch below saying so any more:
 * `NormalizedUrlResult.platform` excludes it (urlParsing.ts), so the
 * impossibility is the type's rather than a guard's, and the claim in
 * importResult.ts — that every `return` here is either the one naming no
 * platform or one inside a branch already handed a platform — is true with no
 * exception left to explain.
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
async function resolveImport(rawUrl: string, spend: ImportSpendRecorder): Promise<ImportResult> {
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
    return resolveYouTubeImport(effective.normalizedUrl, spend);
  }

  // Past this line only `'tiktok'` and `'instagram'` remain — the platforms
  // oEmbed serves and the ones `recipes`' CHECK accepts — as a consequence
  // of the `'web'` and `'youtube'` returns above rather than as an
  // assumption.
  //
  // NAMED RATHER THAN COUNTED, deliberately, and GAP-07 is why. This read
  // "the three returns above", meaning the three that narrow
  // `effective.platform` — web, youtube, and a `'text'` guard that used to
  // sit just below this comment. Narrowing `NormalizedUrlResult.platform`
  // to `Exclude<ImportPlatform, 'text'>` deleted that guard and left two,
  // and the sentence survived saying three. Worse, it then read as
  // accidentally true: three `return` statements do still appear above,
  // they are simply not the three it meant. A count is a claim about the
  // file, and it decays silently every time the file moves; the platform
  // names are a claim about the union, which is what the narrowing
  // actually rests on. Add a platform and the compiler drags someone back
  // to this block — a number never would have.

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
    spend,
    sourceUrl: effective.normalizedUrl,
    platform: effective.platform,
    caption: oembedResult.payload.title,
    attribution,
    // The same statement YouTube's route makes one function up, for the same
    // reason: prose written for humans, read by a model.
    provenance: 'model_from_caption',
  });
}

/**
 * How long a caller is told to wait when the COUNTER ITSELF is unreachable.
 *
 * Sixty seconds, and deliberately short: this is not a limit being enforced,
 * it is an outage being survived, so the number should express "try again
 * shortly" rather than any real window. Long enough that a retry storm does
 * not arrive while the database is still down; short enough that a working
 * deployment recovers on its own without anyone being told to wait out a
 * limit they never hit.
 */
const BUDGET_UNAVAILABLE_RETRY_SECONDS = 60;

/**
 * The policy's three refusals as the one `ImportResult` the client knows.
 *
 * `unidentified_caller` COLLAPSES INTO THE CALLER SCOPE, and that is the
 * decision that actually closes the anon-key hole. Two facts make it safe:
 * src/app/_layout.tsx redirects a signed-out person to `/sign-in` before any
 * tab renders, so no real user of this app can produce it; and "we cannot
 * tell who you are" is not a sentence anybody can act on, so giving it its
 * own copy would be writing Dutch for a caller that is not a person. What it
 * IS, in practice, is something holding the anon key out of the app bundle —
 * and the honest answer to that is a refusal, not an explanation.
 *
 * The wait it is given is the caller window, which is the truth for the one
 * case that reaches it from a real device: an app whose session expired
 * mid-import. Signing in again resolves it long before the wait elapses.
 */
function toThrottledResult(decision: Exclude<ImportBudgetDecision, { kind: 'allowed' }>): ImportResult {
  if (decision.kind === 'household_ceiling_exceeded') {
    return { kind: 'import_throttled', scope: 'household', retryAfterSeconds: decision.retryAfterSeconds };
  }
  if (decision.kind === 'caller_rate_exceeded') {
    return { kind: 'import_throttled', scope: 'caller', retryAfterSeconds: decision.retryAfterSeconds };
  }
  return { kind: 'import_throttled', scope: 'caller', retryAfterSeconds: UNIDENTIFIED_CALLER_RETRY_SECONDS };
}

/** The caller burst window, in whole seconds — see `toThrottledResult`. */
const UNIDENTIFIED_CALLER_RETRY_SECONDS = 10 * 60;

/**
 * The route to record an attempt under.
 *
 * `unsupported_url` has no platform (it is refused before one is
 * established) and `import_throttled` never reaches here at all — the gate
 * returns before the pipeline runs. Both fall to `'text'`, which is the
 * honest floor: a string we declined to open took no route, and the row
 * exists because a caller hammering this endpoint with junk is exactly the
 * traffic the counter is for. It costs zero either way.
 */
function recordablePlatform(result: ImportResult): ImportPlatform {
  return result.kind === 'unsupported_url' || result.kind === 'import_throttled' ? 'text' : result.platform;
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

  const importRequest = await readImportRequest(request);
  if (importRequest.kind === 'malformed') {
    // Also not counted, for the reason the two replies above are not: a body
    // with no usable source — neither field, both fields, a blank or
    // over-long `text` — never became an import, so it has no outcome, and
    // counting it would inflate the denominator the telemetry line exists to
    // make trustworthy. The sentence is importRequest.ts's, phrased where the
    // refusal was decided; this line only picks the status code. See that
    // module for why an over-long paste is refused here rather than answered
    // as a typed 200.
    return jsonResponse({ error: importRequest.message }, 400);
  }

  // IMP-06 / IMP-10 — THE GATE. It is the single point at which a request
  // becomes an import: past the boundary checks, before the `{ url }` /
  // `{ text }` fork, and therefore before every third-party call, before the
  // canonical-cache lookup and before Gemini. One door in, mirroring
  // `respondWithImportResult` as the one door out, so no branch added later
  // can skip it. NOT inside `resolveImport`: a `{ text }` body never enters
  // that function, and a gate placed there would leave the one route with no
  // cache, nothing to fetch and a guaranteed model call as the only
  // unthrottled one. importBudget.ts beside this file carries what each piece
  // became; `decideImportBudget` is pure and tested in
  // src/domain/import/importBudgetPolicy.ts, and the counter it reads is
  // supabaseImportBudgetStore.ts.
  const callerId = readCallerId(request);
  const spend = createImportSpendRecorder();
  let budget: CallerBudgetContext;
  try {
    budget = await readCallerBudget(callerId, await buildCallerFingerprint(callerId, readClientAddress(request)));
  } catch (error) {
    // FAILING CLOSED, and the reasoning is in supabaseImportBudgetStore.ts's
    // header: a limiter that degrades to "allow" is an absent one, absent in
    // the direction of the bill. The user is told to wait — which is true,
    // and is the only advice that helps them — while the real cause is logged
    // under its own grep token for whoever is on call.
    if (!(error instanceof ImportBudgetUnavailableError)) {
      throw error;
    }
    return respondWithImportResult({
      kind: 'import_throttled',
      scope: 'caller',
      retryAfterSeconds: BUDGET_UNAVAILABLE_RETRY_SECONDS,
    });
  }

  const decision = decideImportBudget({
    now: Date.now(),
    callerAttempts: budget.callerAttempts,
    householdAttempts: budget.householdAttempts,
  });
  if (decision.kind !== 'allowed') {
    // A REFUSAL IS NOT RECORDED AS AN ATTEMPT. It cost nothing — no fetch, no
    // model — and writing a row for it would let a caller who is already over
    // the limit keep pushing their own window forward, so a loop would extend
    // its own ban indefinitely and never recover. The refusal is counted by
    // IMP-07's telemetry instead, which is where refusals belong.
    return respondWithImportResult(toThrottledResult(decision));
  }

  try {
    // The two routes, and the only place either is entered. They converge
    // again one line down, which is what keeps both countable by one call.
    const result =
      importRequest.kind === 'url'
        ? await resolveImport(importRequest.url, spend)
        : await resolveTextImport(importRequest.text, spend);
    // Recorded BEFORE the response is built, and deliberately not awaited
    // into the user's critical path any later than this: the money is spent
    // by now, and a row written after the response would be a row that a
    // cancelled request never writes. `classifyImportCost` decides the cost
    // class — never this file, and never the branch that happens to be here.
    await recordAttempt({
      fingerprint: budget.fingerprint,
      householdId: budget.householdId,
      platform: recordablePlatform(result),
      cost: classifyImportCost({
        // `null` where the result genuinely has no platform, which
        // `classifyImportCost` answers with `'free'` — a route that was never
        // entered cannot have called a model. Not `recordablePlatform`'s
        // `'text'` floor: that is a filing decision for the row, and feeding
        // it to the cost classifier would claim a billable route was taken.
        platform: result.kind === 'unsupported_url' || result.kind === 'import_throttled' ? null : result.platform,
        calledExtractionModel: spend.calledExtractionModel,
      }),
    });
    // The one place an `ImportResult` becomes a response, which is therefore
    // the one place an import is counted — successes and modeled failures
    // alike, exactly once each, on both routes.
    return respondWithImportResult(result);
  } catch (error) {
    // A genuinely unexpected exception (not one of the modeled failure
    // paths above, all of which return normally) — logged server-side
    // only, never echoed into the response body.
    console.error('parse-recipe: unexpected failure', error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});

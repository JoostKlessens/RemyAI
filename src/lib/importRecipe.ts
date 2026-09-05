/**
 * The client half of recipe import: one POST to the `parse-recipe` Edge
 * Function, narrowed into the same `ImportResult` the screens already
 * switch on.
 *
 * THREE CALLS, ONE ENDPOINT, AND ONE OF EACH IS THE WHOLE DESIGN.
 * `requestImport` sends `{ url }` — a link the user pasted;
 * `requestTextImport` sends `{ text }` — a recipe the user pasted with no
 * link behind it (SRC-08); and `requestPhotoImport` sends `{ photo }` — a
 * photograph of a recipe, so that last one no longer has to be typed at all
 * (SRC-07). The edge function refuses a body carrying MORE THAN ONE, on the
 * grounds that it cannot know which the caller meant
 * (supabase/functions/parse-recipe/importRequest.ts), so this module makes
 * that unrepresentable rather than merely avoided: there is no single
 * function with three optional arguments a caller could fill in twice.
 * They differ in exactly two lines each — the body they post and the
 * platform their transport failure reports — and share everything after,
 * which is what keeps the response handling from forking.
 *
 * THE THIRD ONE CARRIES AN IMAGE AND STILL SHARES `toAttempt`, which is
 * worth a line because it is the test a shared response path should pass: the
 * function answers with the same `ImportResult` union whichever body it was
 * handed, so a photograph changes what is SENT and nothing whatsoever about
 * what is READ.
 *
 * This module is the impure shell and nothing else. Every judgement it
 * makes about the response body lives in the pure, tested
 * `parseImportResult` (src/domain/import/parseImportResult.ts) — this file
 * only performs the call and maps the ways a call can fail outright. That
 * is why the text route needed no new narrowing here: the function answers
 * with the same `ImportResult` union whichever body it was handed, so
 * `toAttempt` below already covers it.
 *
 * WHY TRANSPORT FAILURES BECOME `llm_request_failed`. The edge function
 * answers 200 for every outcome it actually anticipates, including all of
 * its failures, so a non-2xx or a thrown fetch means the request never
 * completed a round trip we can reason about. `llm_request_failed` is the
 * variant whose own doc comment already covers exactly that ("could not
 * be reached, or returned a transport-level failure (network error,
 * non-2xx, rate limit)"), and whose copy — "Even niet gelukt … probeer
 * het opnieuw" — is the honest thing to show. It is deliberately NOT
 * mapped to `parse_failed`, which tells the user their video probably has
 * no written recipe: that would blame the video for our outage.
 *
 * THE ONE 400 THAT WOULD GIVE BAD ADVICE, NAMED RATHER THAN LEFT TO BE
 * FOUND. An over-long `{ text }` body is refused with a 400, and it lands
 * here as `llm_request_failed` — "probeer het opnieuw" — which is wrong,
 * because retrying an over-long paste fails identically forever. It is
 * tolerable only because the paste screen enforces the same cap before it
 * ever calls `requestTextImport`, so this mapping is reachable only by a
 * caller that is not that screen. If a typed "your text is too long"
 * outcome is ever added to `ImportResult`, this is the paragraph that
 * should stop being true.
 *
 * A response body we cannot narrow lands in the same place, for the same
 * reason: an unrecognized shape means we did not get a usable answer, and
 * retrying is the right advice.
 *
 * ATTRIBUTION ACROSS FAILURE PATHS (IMP-02). `authorName`, `authorUrl` and
 * `thumbnailUrl` are read off `attribution`, which the function returns on
 * three variants: `parsed`, `display_only` (PD-011, where crediting the
 * creator is the entire point) and `no_recipe_in_caption` (IMP-02 —
 * required there too, since the function only ever constructs that variant
 * after the source has already resolved; see its doc comment in types.ts).
 * A user who falls back to manual entry after `no_recipe_in_caption`
 * reaches the confirm screen with the same creator the function already
 * had in hand to build its extraction prompt.
 *
 * `authorUrl` joined the other two when `'web'` joined `ImportPlatform`.
 * It was previously dropped here and rebuilt downstream from the platform
 * plus the display name — which works only for TikTok and Instagram, whose
 * profile URLs are a handle in a fixed path. A YouTube channel URL is keyed
 * on an id `snippet.channelTitle` does not contain, and a recipe site's
 * author page follows no pattern at all, so for both of the new platforms
 * the link is either carried from the source or it does not exist. See
 * `ImportAttempt.authorUrl`.
 *
 * WHICH VARIANTS STILL CARRY NO CREATOR, AND WHY THEY DIFFER.
 * `llm_request_failed` and `parse_failed` are returned AFTER the source
 * text was fetched, so the function does have an attribution in hand for
 * them and does not send it — a real, structurally identical gap to the
 * one IMP-02 closed, still open because IMP-02 asked only for
 * `no_recipe_in_caption`. The other four are different in kind and are not
 * gaps at all: `unsupported_url` never fetches anything;
 * `oembed_failed` and `source_fetch_failed` are defined by the fetch
 * itself having failed; and `no_recipe_on_page` fetched a page
 * successfully but found no structured object, which is precisely the only
 * thing on a web page we are willing to treat as a source (types.ts). None
 * of the four has a payload to build an attribution from, even in
 * principle.
 */

import { parseImportResult } from '@/domain/import/parseImportResult';
import type { ImportPlatform, ImportResult, RecipeProvenance } from '@/domain/import/types';
import { supabase } from './supabase';

const PARSE_RECIPE_FUNCTION = 'parse-recipe';

export interface ImportAttempt {
  readonly result: ImportResult;
  /** From the `parsed`, `display_only`, or `no_recipe_in_caption` variant's attribution (IMP-02) — see the file header's "WHAT IS STILL LEFT" note for the variants that still carry none. */
  readonly authorName: string | null;
  /**
   * The creator's own profile/channel/author page, straight off the same
   * attribution, and the reason it is carried rather than reconstructed
   * downstream: IT CANNOT BE RECONSTRUCTED. `buildAttribution.ts` makes
   * this argument for TikTok and Instagram (a display name is not reliably
   * a URL-safe handle, so guessing produces plausible links to the wrong
   * account) and the two newer platforms make it unanswerable rather than
   * merely risky — a YouTube channel URL is keyed on a channel id that
   * `snippet.channelTitle` does not contain, and a web page's author has
   * no URL pattern at all. Without this field the confirmation screen can
   * name a creator and cannot link to one, which for PD-007 attribution is
   * the difference between a credit and a mention.
   */
  readonly authorUrl: string | null;
  readonly thumbnailUrl: string | null;
  /**
   * RCP-06. HOW the recipe on this attempt was arrived at: read out of the
   * publisher's own machine-readable object, or worked out of a caption by
   * a model. Lifted to the attempt for the same reason `authorUrl` was —
   * the confirmation screen is where it matters and the confirmation
   * screen cannot recover it. `sourceUrl` and `platform` both sit right
   * there and both look like they would do: a `'web'` import is structured
   * data TODAY, and a screen that concluded that from the platform would
   * be asserting a pipeline decision it does not own. Provenance is a fact
   * about how one particular import actually resolved, so it is reported
   * by the thing that resolved it or it is not known.
   *
   * `null` FOR EVERY NON-`parsed` OUTCOME, and that is a statement rather
   * than a gap. The other variants carry no recipe at all, so there is
   * nothing whose origin could be described: a display-only post, a
   * caption with no recipe in it, a page that never opened. A user who
   * types the recipe themselves from any of those reaches the confirm
   * screen with `null`, which is exactly right — it is their recipe, and
   * claiming a provenance for it would be inventing the one fact this
   * field exists to carry.
   */
  readonly provenance: RecipeProvenance | null;
}

/**
 * WHY THIS IS A FUNCTION AND NOT THE MODULE-LEVEL CONSTANT IT WAS.
 * `llm_request_failed` now carries a platform (types.ts requires one on
 * every outcome but `unsupported_url`), and a constant built at module load
 * has no URL and therefore nothing to state.
 *
 * THE VALUE IS REPORTED, NOT INVENTED, which is the only reason this is
 * allowed to exist. The caller has already run `normalizeRecipeUrl` over
 * the pasted text — `requestImport`'s own doc comment has always said so,
 * and the paste screen would not have reached this call otherwise — so the
 * platform passed in is the same function's answer about the same URL that
 * the edge function would have computed for itself. What this attempt
 * cannot report is anything the SERVER concluded, and it does not try to:
 * a transport failure means no response arrived, so there is no
 * attribution, no provenance and no canonical id, and all three stay null.
 *
 * ONE HONEST LIMIT, WORTH KNOWING BEFORE TRUSTING THIS NUMBER. If the
 * pasted link were a short link whose target belonged to a different
 * platform, the edge function's `resolveEffectiveUrl` would have corrected
 * the classification and this client never learns that it did. TikTok's
 * `vm.`/`vt.` codes are the only short links that path expands and they
 * resolve to TikTok, so today the two answers cannot differ — and if that
 * ever changes, what this reports is still the truth available on this side
 * of a request that never completed. Note also that these client-side
 * attempts reach no log: IMP-07 counts inside the edge function
 * (importResponse.ts), so nothing here can move that denominator.
 */
function transportFailure(platform: ImportPlatform): ImportAttempt {
  return {
    result: { kind: 'llm_request_failed', platform },
    authorName: null,
    authorUrl: null,
    thumbnailUrl: null,
    provenance: null,
  };
}

function toAttempt(result: ImportResult): ImportAttempt {
  // One branch for all three attribution-carrying variants, where `parsed`
  // used to need its own optional-chained copy. That asymmetry is gone
  // because `ImportResult.parsed.attribution` is now REQUIRED (types.ts):
  // every producer states it, and `parseImportResult` materialises an
  // all-null one for a response older than the field, so there is no
  // longer a version of `parsed` whose creator is `undefined` rather than
  // null. The remaining variants — `unsupported_url`, `oembed_failed`,
  // `no_recipe_on_page`, `source_fetch_failed`, and the two LLM failures
  // named in the header — genuinely have no attribution to read.
  if (result.kind === 'parsed' || result.kind === 'display_only' || result.kind === 'no_recipe_in_caption') {
    return {
      result,
      authorName: result.attribution.authorName,
      authorUrl: result.attribution.authorUrl,
      thumbnailUrl: result.attribution.thumbnailUrl,
      // Narrower than the branch it sits in, on purpose. Attribution is
      // shared by all three of these variants; provenance describes a
      // recipe, and only `parsed` has one. Reading it off the union member
      // rather than off the platform is what keeps this honest — see
      // `ImportAttempt.provenance`.
      provenance: result.kind === 'parsed' ? result.provenance : null,
    };
  }
  return { result, authorName: null, authorUrl: null, thumbnailUrl: null, provenance: null };
}

/**
 * Only ever called with a URL that already passed the caller's own
 * `normalizeRecipeUrl` check, mirroring the edge function's pipeline
 * order — an obviously unsupported link never costs a round trip.
 *
 * `platform` IS THE SECOND HALF OF THAT SAME CHECK, and it is a parameter
 * rather than something recomputed here for a reason: the caller already
 * holds it (it comes out of the same `normalizeRecipeUrl` call that
 * produced `normalizedUrl`), and re-deriving it would create a second place
 * that could answer differently from the first. It is used only to build
 * the transport-failure attempt — every response that actually arrives
 * states its own platform, and the function's answer wins over the
 * client's guess without exception.
 *
 * Never throws: every failure it can reach is returned as a typed
 * `ImportResult`, so callers have no error path to forget.
 */
export async function requestImport(normalizedUrl: string, platform: ImportPlatform): Promise<ImportAttempt> {
  try {
    const { data, error } = await supabase.functions.invoke<unknown>(PARSE_RECIPE_FUNCTION, {
      body: { url: normalizedUrl },
    });
    if (error) {
      return transportFailure(platform);
    }
    const result = parseImportResult(data);
    return result === null ? transportFailure(platform) : toAttempt(result);
  } catch {
    return transportFailure(platform);
  }
}

/**
 * SRC-08. The same endpoint, the same narrowing, a different body: recipe
 * text the user pasted, with no URL anywhere in the transaction.
 *
 * IT TAKES NO `platform` ARGUMENT, AND THAT ABSENCE IS THE INTERESTING PART.
 * `requestImport` needs one because a URL's platform is a CONCLUSION —
 * `normalizeRecipeUrl`'s reading of a string the user pasted — and its own
 * doc comment above spends a paragraph on the one way that conclusion could
 * disagree with the server's. Here there is nothing to conclude: `'text'` is
 * a fact about which body was posted, decided by the line below and by
 * nothing else, so client and server cannot differ about it even in
 * principle. Passing it in would invite a caller to pass something else.
 *
 * Only ever called with text the caller has already trimmed, found non-blank
 * and found within the length cap — the same order `requestImport` mirrors
 * for URLs, and for the same reason: a body the function will refuse should
 * not cost a round trip. See the header on what happens when it does anyway.
 *
 * Never throws, exactly as its sibling does not.
 */
export async function requestTextImport(text: string): Promise<ImportAttempt> {
  try {
    const { data, error } = await supabase.functions.invoke<unknown>(PARSE_RECIPE_FUNCTION, {
      // `text` alone. Sending a `url: null` alongside it would be refused as
      // ambiguous by the function's own boundary, which is the behaviour that
      // makes this one-key body a requirement rather than a style choice.
      body: { text },
    });
    if (error) {
      return transportFailure('text');
    }
    const result = parseImportResult(data);
    return result === null ? transportFailure('text') : toAttempt(result);
  } catch {
    return transportFailure('text');
  }
}

/**
 * SRC-07. The same endpoint and the same narrowing once more, with a
 * photograph of a recipe: a cookbook page, a handwritten card, a screenshot.
 *
 * IT TAKES NO `platform` ARGUMENT, for `requestTextImport`'s reason exactly.
 * `'photo'` is a fact about which body was posted, decided by the line below
 * and by nothing else, so client and server cannot differ about it even in
 * principle. Passing it in would invite a caller to pass something else.
 *
 * ONLY EVER CALLED WITH A PHOTOGRAPH THE CALLER HAS ALREADY PUT THROUGH
 * `readImportPhoto` (src/domain/import/photoImportLimits.ts) — the same
 * function the edge function's own boundary calls, so the two ends cannot
 * disagree about the same image. A body the function would refuse should not
 * cost a round trip, and on this route it would be an expensive one to waste:
 * the upload is megabytes where the other two are bytes.
 *
 * THE IMAGE GOES NO FURTHER THAN THIS CALL. It is not cached here, not
 * written to storage, and not attached to the `ImportAttempt` that comes back
 * — `ImportResult` has no field it would fit in. The paste screen holds it in
 * component state alone, so that "Opnieuw proberen" can re-send the same
 * photograph, and drops it with the screen. See photoImportLimits.ts for the
 * retention decision in full.
 *
 * Never throws, exactly as its two siblings do not.
 */
export async function requestPhotoImport(mimeType: string, base64: string): Promise<ImportAttempt> {
  try {
    const { data, error } = await supabase.functions.invoke<unknown>(PARSE_RECIPE_FUNCTION, {
      // `photo` alone, and NESTED rather than flattened into two top-level
      // keys. The boundary counts how many SOURCE FIELDS a body carries and
      // refuses more than one; a photo arriving as `mimeType` + `base64`
      // beside a stale `url` would be indistinguishable from a caller asking
      // for two things at once. One key, one source.
      body: { photo: { mimeType, base64 } },
    });
    if (error) {
      return transportFailure('photo');
    }
    const result = parseImportResult(data);
    return result === null ? transportFailure('photo') : toAttempt(result);
  } catch {
    return transportFailure('photo');
  }
}

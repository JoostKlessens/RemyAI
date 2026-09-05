/**
 * ---------------------------------------------------------------------------
 * THE TAIL EVERY ROUTE THAT PRODUCES A RECIPE ENDS IN
 * ---------------------------------------------------------------------------
 *
 * Five routes reach this file — a TikTok caption, a YouTube description, a
 * pasted text, a photograph (SRC-07), and (for the last step only) a page's
 * JSON-LD — and the point of the file is that they reach the SAME code rather
 * than five copies of it.
 * It moved out of index.ts when the text route arrived, for the reason a
 * shared tail exists at all: three callers of one function is a contract, and
 * three near-identical blocks in one file is a contract that decays the first
 * time somebody fixes a bug in two of them.
 *
 * WHAT IS ACTUALLY AT STAKE IN THE SHARING, since "don't repeat yourself" is
 * the weakest version of the argument. The anti-hallucination behaviour of
 * this whole feature lives in the four branches of `extractRecipeFromCaption`
 * below: the model's explicit `report_no_recipe` becoming an honest
 * `no_recipe_in_caption`; a malformed answer becoming `parse_failed` rather
 * than a half-populated recipe; `validateParsedRecipe` throwing away anything
 * that does not survive inspection; and a blank source text never reaching
 * the model at all. Those are the guarantees a user is actually relying on,
 * and a forked copy is how one platform's version of them quietly stops
 * matching another's. With one function there is nothing to drift.
 *
 * ---
 *
 * SRC-07 IS THE ONE ROUTE THAT COULD NOT JOIN THAT FUNCTION, AND THE SPLIT
 * NEEDS ARGUING BECAUSE IT LOOKS LIKE THE THING THIS FILE EXISTS TO PREVENT.
 *
 * `extractRecipeFromCaption` takes a `caption: string | null` and its first
 * act is to short-circuit a blank one. A photograph has no caption at all —
 * not an empty one, not a missing one — so every way of forcing it through is
 * bad: pass `''` and hit the blank short-circuit, which returns
 * `no_recipe_in_caption` for an image nobody looked at; pass a sentinel and
 * hand every branch below a string that is not text; or widen the parameter
 * to a union and branch on it inside, which is `callExtractionModel`'s
 * rejected "one function, two optional arguments" shape reappearing one layer
 * up.
 *
 * SO THE SPLIT IS AT THE ONE PLACE THE TWO GENUINELY DIFFER — WHAT IS SENT —
 * AND NOWHERE ELSE. `extractRecipeFromPhoto` below does not re-implement a
 * single guarantee: it reaches the identical `parseExtractionResponse`, the
 * identical `validateParsedRecipe` and the identical `finishParsedRecipe`.
 * The handful of lines it does not share are the handful that are actually
 * about images. Read the two functions side by side and everything after the
 * model call is the same sequence — because it is the same code.
 *
 * WHAT IS DELIBERATELY NOT SHARED, AND WHY THAT IS NOT A GAP: the
 * blank-source short-circuit. The photo route has no blank case.
 * `readImportPhoto` (photoImportLimits.ts) refuses an empty payload at the
 * boundary, and "an image with nothing on it" is not something this pipeline
 * can detect without asking the model — which is exactly what it does. The
 * model answering `report_no_recipe` for a blank photograph IS the correct
 * handling, not a missed optimisation.
 *
 * THE BLANK-SOURCE SHORT-CIRCUIT IS PART OF THAT SHARED CONTRACT, not an
 * optimisation bolted onto one caller: a video with no description costs no
 * tokens and still returns the creator's attribution, exactly as IMP-02
 * requires. It is unreachable from the pasted-text route, which refuses a
 * blank body at the boundary (importRequest.ts) — that is a fact about that
 * route, not a reason for this function to stop checking.
 *
 * ---
 *
 * WHY THE FUNCTION IS STILL CALLED "…FromCaption" WHEN ONE OF ITS CALLERS
 * PASTES TEXT OUT OF A MESSAGE. Because the OUTCOME is called
 * `no_recipe_in_caption` (src/domain/import/types.ts), and that variant is
 * what all three model routes return. Renaming the function without renaming
 * the result would leave two words for one thing and force every reader to
 * work out whether they mean the same; renaming the result is a change to a
 * type this function does not own, with copy and a decoder hanging off it.
 * One name, kept, is the smaller lie — and it is written down here so nobody
 * has to guess whether it was considered.
 *
 * ---
 *
 * PROVENANCE IS A PARAMETER, NOT A CONSTANT, AND THAT IS THE ONE THING THAT
 * CHANGED WHEN TEXT ARRIVED. This function used to hardcode
 * `model_from_caption`, which was true while both of its callers were reading
 * a caption a creator published beside their video. A pasted text has no
 * publisher at all: it came off somebody's clipboard, and this pipeline
 * cannot see where it was before that. So the caller states it, exactly as
 * `ParsedRecipeCompletion.provenance` has always required — see index.ts's
 * PROVENANCE section for why an inference from `platform` would be a lookup
 * table that starts stating the wrong thing with total confidence the moment
 * one platform serves two kinds of source.
 *
 * THE `.ts` EXTENSIONS BELOW ARE LOAD-BEARING — Deno's resolution rule, see
 * index.ts's header. Nothing local catches a missing one; the deploy does.
 */

import { validateParsedRecipe } from '../../../src/domain/import/validateParsed.ts';
import { parseExtractionResponse } from '../../../src/domain/import/parseExtractionResponse.ts';
// SRC-07's "there is nobody to credit", by name. Imported rather than written
// as three nulls, for the reason index.ts gives at its own use of it: the
// deliberate case and the symptom must not look alike to a grep.
import { NO_CREATOR_TO_CREDIT } from '../../../src/domain/import/buildAttribution.ts';
import type {
  ImportAttribution,
  ImportPlatform,
  ImportResult,
  ParsedRecipe,
  RecipeProvenance,
} from '../../../src/domain/import/types.ts';
import { storeCanonicalRecipe } from './canonicalRecipeStore.ts';
import { callExtractionModel, callPhotoExtractionModel } from './callExtractionModel.ts';
import type { ImportSpendRecorder } from './importBudget.ts';

export interface ParsedRecipeCompletion {
  readonly recipe: ParsedRecipe;
  /**
   * The normalized URL this recipe was read from, or NULL when there is no
   * such thing — which is the pasted-text route and only that route
   * (`platform: 'text'`). It becomes `ImportResult.parsed.sourceUrl`, and it
   * is the key the canonical cache would be written under, so its absence
   * decides both; see `resolveCanonicalRecipeId`.
   */
  readonly sourceUrl: string | null;
  readonly platform: ImportPlatform;
  readonly attribution: ImportAttribution;
  /**
   * RCP-06, and REQUIRED here rather than defaulted, which is the point: the
   * caller has to say how it got these words, because it is the only code
   * that knows. A default would let a route added later inherit somebody
   * else's answer silently. It sits beside `platform` and must never be
   * derived from it — see the PROVENANCE section in index.ts's header.
   */
  readonly provenance: RecipeProvenance;
}

/**
 * THE CANONICAL WRITE, AND THE ONE ROUTE THAT HAS NOTHING TO WRITE IT UNDER.
 *
 * `recipes` (0006) is keyed on `normalized_url`. A pasted text has no URL —
 * not an unsupported one, not one we failed to resolve: there is no URL,
 * because nobody fetched anything. So THE CACHE IS SKIPPED HERE FOR WANT OF A
 * KEY, which is a stronger and more permanent reason than the one every other
 * unstorable route has. YouTube and web imports skip the write because
 * `canStoreCanonicalRecipe` refuses their platform — a CHECK constraint a
 * migration could widen tomorrow. This route would still have nothing to key
 * on the morning after that migration landed. `canStoreCanonicalRecipe` also
 * returns false for `'text'`, and the store would refuse the write on its
 * own; this branch is not a duplicate of that guard, it is the reason the
 * guard's answer can never change here.
 *
 * The same fact rules out the READ half one step earlier, in index.ts: the
 * text route never calls `findStoredRecipe`, because a lookup needs the same
 * key a write does. Two households pasting an identical recipe text are
 * therefore two unrelated imports, both paying for their own extraction. That
 * is a real cost and it is the honest one: the only thing that could
 * deduplicate them is a hash of the text itself, which is a DIFFERENT
 * deduplication key with different questions hanging off it (what counts as
 * the same text? does a retyped ingredient list match?) and a schema decision
 * for the owner to take deliberately.
 *
 * The write is AWAITED, not fire-and-forget. Letting it run detached would
 * shave a few hundred milliseconds off the response, but an edge runtime is
 * free to tear down the isolate once the response is returned, which would
 * silently drop the write — turning deduplication into an expensive no-op
 * that still looks like it is working. Correct-and-slightly-slower wins here,
 * and only on the miss path, which was already paying for a fetch. There is a
 * second reason since W-01b: the id this returns is the only way the response
 * can tell the client which canonical row its meal is a copy of, and there is
 * nowhere else to get it from afterwards.
 */
async function resolveCanonicalRecipeId(input: ParsedRecipeCompletion): Promise<string | null> {
  if (input.sourceUrl === null) {
    return null;
  }
  // Returns null without a round trip for a platform `recipes`' CHECK
  // refuses — the guard lives in the store, where it cannot be skipped by a
  // route that forgets to ask. See canonicalRecipeStore.ts's header.
  return storeCanonicalRecipe(input.recipe, input.sourceUrl, input.platform, input.attribution);
}

/**
 * The single place a fully validated recipe becomes a `parsed` result —
 * shared by the three model routes and the JSON-LD one, so all four store and
 * report the canonical id identically.
 */
export async function finishParsedRecipe(input: ParsedRecipeCompletion): Promise<ImportResult> {
  const recipeId = await resolveCanonicalRecipeId(input);
  return {
    kind: 'parsed',
    recipe: input.recipe,
    // Straight through, null included. Null means "this recipe came from no
    // URL at all", which is the pasted-text route stating something true
    // about itself rather than admitting a lookup that failed.
    sourceUrl: input.sourceUrl,
    platform: input.platform,
    attribution: input.attribution,
    // Passed straight through from the route that produced the recipe. This
    // function deliberately has no opinion about it: it does not know whether
    // it was handed JSON-LD a publisher wrote, a model's reading of a
    // caption, or a model's reading of something a user pasted, and inventing
    // an answer from `input.platform` here is exactly the shortcut index.ts's
    // header rules out.
    provenance: input.provenance,
    // Straight through, null included. No canonical row — because the write
    // failed, because the schema refuses this platform, or because there was
    // no key to write one under — means this import really is a copy of
    // nothing, and saying so is the only honest answer. `sourceUrl` above is
    // a deduplication key, never a stand-in for this id. The cache-hit path
    // returns the same field from the stored row's `id`
    // (`parseStoredRecipe`), so the two paths agree.
    recipeId,
  };
}

export interface CaptionExtraction {
  /** Null for the pasted-text route and nothing else — see `ParsedRecipeCompletion.sourceUrl`. */
  readonly sourceUrl: string | null;
  readonly platform: ImportPlatform;
  /** Null or blank means the model is never called at all — see below. */
  readonly caption: string | null;
  readonly attribution: ImportAttribution;
  /** Stated by the caller, never assumed here — see the file header. */
  readonly provenance: RecipeProvenance;
  /**
   * IMP-06 / IMP-10. Marked immediately before the model request goes out,
   * so the budget can tell a fresh extraction from a cache hit — which the
   * `ImportResult` deliberately cannot (see `parseStoredRecipe`). REQUIRED
   * rather than optional, on this union's own rule: an optional field is a
   * field a caller can forget while still compiling, and forgetting this one
   * means a route that spends money and records that it did not.
   */
  readonly spend: ImportSpendRecorder;
}

/**
 * Source text in, `ImportResult` out: ask the model, validate its answer,
 * store the recipe if there is anywhere to store it. TikTok arrives with an
 * oEmbed title, YouTube with a Data API description, and the paste screen
 * with whatever a user had on their clipboard. THEY RUN THE SAME CODE, and
 * that is a correctness property rather than tidiness — see the file header
 * for exactly which guarantees are the ones that must not fork.
 */
/**
 * SRC-07. What the photo route hands the tail: the image, and the one fact
 * needed to decode it.
 *
 * NO `caption`, NO `attribution` AND NO `sourceUrl`, and all three absences
 * are facts rather than fields somebody left out. There is no text — the
 * model reads pixels. There is no creator — nothing was fetched from anybody,
 * which is the same position the paste route holds. And there is no address —
 * the recipe was on a page in the user's own kitchen.
 *
 * NO `provenance` EITHER, WHICH BREAKS THIS FILE'S OWN RULE AND IS THE ONE
 * PLACE IT SHOULD. `CaptionExtraction` requires its caller to state one,
 * because three different routes reach that function and each knows something
 * this file does not. Exactly one route reaches THIS function, and it is this
 * function — so a parameter would not be a caller stating a fact it alone
 * knows, it would be a chance for the only caller to state the wrong one.
 * `model_from_photo` is written once, below, where nothing else can be
 * passed.
 */
export interface PhotoExtraction {
  /** One of `ACCEPTED_IMPORT_PHOTO_MIME_TYPES`, already checked at the boundary (importRequest.ts). */
  readonly mimeType: string;
  /** The image. Handed to the model and then dropped — see photoImportLimits.ts's retention decision. */
  readonly base64: string;
  /** IMP-06 / IMP-10, required for exactly the reason `CaptionExtraction.spend` is. */
  readonly spend: ImportSpendRecorder;
}

/**
 * An image in, an `ImportResult` out. The photo route's whole pipeline — and
 * everything after the model call is the caption tail's code rather than a
 * copy of it. See the file header for why the split falls where it does.
 *
 * IT RETURNS `no_recipe_in_photo` WHERE ITS SIBLING RETURNS
 * `no_recipe_in_caption`, which is the one branch differing in more than its
 * input. That variant carries no image and no transcript by design
 * (importResult.ts): the photograph is gone by the time this returns, so
 * there is nothing to hand back — and the user is holding the original.
 *
 * THERE IS NO CANONICAL WRITE AND NO CACHE LOOKUP, for the reason
 * `resolveCanonicalRecipeId` gives about pasted text, which applies here
 * unchanged: `recipes` is keyed on `normalized_url` and this route has no
 * URL. `finishParsedRecipe` still builds the result — handed `sourceUrl:
 * null` it returns `recipeId: null` without a round trip — so a photo import
 * gets the same shape as every other, stating a permanent "no canonical row"
 * rather than a lookup that failed.
 */
export async function extractRecipeFromPhoto(input: PhotoExtraction): Promise<ImportResult> {
  const platform: ImportPlatform = 'photo';

  // BEFORE the call and not after it, exactly as the caption tail does it: a
  // request that times out or is refused still cost the round trip, and a
  // limiter that only counts successes is one an abuser walks straight past
  // by sending garbage. It costs more here than on any other route — a
  // multimodal call is several times a text one — which is argued at
  // `ROUTE_CAN_CALL_EXTRACTION_MODEL` in importBudgetPolicy.ts, along with
  // why the cost class is still a binary.
  input.spend.markModelCalled();
  const llmResult = await callPhotoExtractionModel(input.mimeType, input.base64);
  if (llmResult.kind === 'error') {
    return { kind: 'llm_request_failed', platform };
  }

  // THE SAME PARSER, THE SAME VALIDATOR, THE SAME OUTCOMES — not "the photo
  // equivalent of" any of them, but literally the functions the caption routes
  // call. That is what makes "a photo import cannot hallucinate more freely
  // than a caption import" a property of the call graph rather than a claim
  // in a comment.
  const extraction = parseExtractionResponse(llmResult.json);
  if (extraction.kind === 'malformed') {
    return { kind: 'parse_failed', platform };
  }
  if (extraction.kind === 'no_recipe') {
    return { kind: 'no_recipe_in_photo', platform };
  }

  const recipe = validateParsedRecipe(extraction.rawRecipe);
  if (recipe === null) {
    return { kind: 'parse_failed', platform };
  }

  return finishParsedRecipe({
    recipe,
    // No URL EXISTS, as distinct from one we failed to resolve — the same
    // distinction the pasted-text route states one route over.
    sourceUrl: null,
    platform,
    // The named constant, never three nulls written inline: this is the second
    // route where crediting nobody is correct rather than a creator we failed
    // to resolve, and the name is what keeps the deliberate case greppable
    // apart from the symptom. See buildAttribution.ts.
    attribution: NO_CREATOR_TO_CREDIT,
    // Written here and nowhere else — see `PhotoExtraction` on why this is not
    // a parameter.
    provenance: 'model_from_photo',
  });
}

export async function extractRecipeFromCaption(input: CaptionExtraction): Promise<ImportResult> {
  const { attribution, caption, platform, provenance, sourceUrl } = input;

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

  // BEFORE the call and not after it: a request that times out or is refused
  // still cost the round trip, and a limiter that only counts successes is
  // one an abuser can walk straight past by sending garbage.
  input.spend.markModelCalled();
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
  return finishParsedRecipe({ recipe, sourceUrl, platform, attribution, provenance });
}

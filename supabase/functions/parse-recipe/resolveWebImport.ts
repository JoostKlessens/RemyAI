/**
 * THE WEB ROUTE of the recipe import function, in one file: fetch the page
 * the user pasted, read the schema.org/Recipe object its publisher already
 * wrote into it, and finish. index.ts fans out to `resolveWebImport` below
 * and does nothing else about a `'web'` URL.
 *
 * WHY THIS IS A MODULE AND NOT A BRANCH. index.ts is the front door: the
 * HTTP entry point, the request boundary, and the fan-out that decides
 * which of the five sources a paste belongs to. A route is none of those
 * things — it is one source's entire pipeline — and this is the route with
 * the least in common with the other four. It calls no oEmbed endpoint and
 * no model, so it shares no credential, no client and no conditional with
 * anything else in this directory. The only things it touches are the
 * hardened fetch (fetchSourceText.ts), the pure JSON-LD reader
 * (htmlJsonLd.ts) and the shared finish (finishImport.ts), each reached by
 * name. Extracting it changed which file those three imports are written
 * in, and nothing else.
 *
 * THAT ISOLATION IS ALSO WHAT MAKES THE SEAM TRUSTWORTHY rather than merely
 * tidy. `resolveImport` in index.ts returns this route BEFORE the
 * display-only check, before the canonical-cache lookup and before oEmbed —
 * the same early return that narrows everything after it to
 * `OembedPlatform`. A route that returns before any shared stage has no
 * state behind it to strand, so moving it cannot quietly reorder anything:
 * there was never anything between it and the front door.
 *
 * The cache lookup below is here and the cache write is not, and that is not
 * a choice this file made. 0006_canonical_recipes.sql's CHECK rejects a
 * `'web'` parent row, so `canStoreCanonicalRecipe` refuses the write inside
 * canonicalRecipeStore.ts, and the lookup short-circuits to a null there
 * without a round trip. It is called anyway, from the position it would need
 * to occupy the day that CHECK is widened. index.ts's DEDUPLICATION section
 * carries the full argument, including what returning `recipeId: null` costs
 * the social half of the product.
 *
 * The section below is index.ts's own, moved here intact because it argues
 * about this function. Its single edit is a pointer: `resolveEffectiveUrl`
 * stayed in index.ts and is now named rather than called "below".
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
 * validated. See `resolveEffectiveUrl` in index.ts and urlParsing.ts's header.
 */

// Deno needs fully-specified relative import specifiers, so every one of
// these spells out `.ts` — including the two domain modules, which the rest
// of this repo imports without an extension. index.ts's closing header
// section argues that in full; the short version is that dropping an
// extension anywhere in this chain fails nothing locally and fails the
// deploy.

// The JSON-LD reader is the whole web route: it is what makes that path
// modelless, and therefore the one path that cannot invent an ingredient.
import { extractRecipeFromHtml } from '../../../src/domain/import/htmlJsonLd.ts';
import type { ImportResult } from '../../../src/domain/import/types.ts';
import { findStoredRecipe } from './canonicalRecipeStore.ts';
import { fetchRecipePageHtml } from './fetchSourceText.ts';
import { finishParsedRecipe } from './finishImport.ts';

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
export async function resolveWebImport(normalizedUrl: string): Promise<ImportResult> {
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
    sourceUrl: normalizedUrl,
    platform: 'web',
    attribution: extraction.attribution,
    // The publisher stated these fields themselves, in named JSON-LD keys, and
    // no model touched them. This is the only route that can say that, and
    // saying it here — not deriving it from `platform: 'web'` later — is what
    // keeps the claim true if a `'web'` page ever needs a different reader.
    provenance: 'publisher_structured_data',
  });
}

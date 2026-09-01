/**
 * Recipe Import domain types.
 *
 * The Feed (PD-007) is being removed; this is its replacement: a user
 * pastes a URL — a TikTok or Instagram Reel, a YouTube video, or an
 * ordinary recipe page — and we try to turn it into a structured recipe.
 * See docs/PRODUCT-DECISIONS.md, especially PD-004 (a
 * saved/imported meal is measured on cook conversion, never dwell time —
 * still true here, we're just skipping the browsing step entirely) and
 * PD-006 (allergen tags are tri-state; see toMealDraft.ts for how that
 * guarantee is enforced for an AI-derived meal).
 *
 * ---
 *
 * The hard constraint every type below is designed around:
 *
 * FOR A VIDEO, ALL WE EVER GET IS TEXT SOMEONE TYPED. oEmbed
 * (src/lib/oembed.ts) returns a caption/title and an author name; the
 * YouTube Data API returns a title and a description. Nothing else — no
 * audio transcript, no on-screen text (OCR), no video file. Downloading
 * the video to extract audio or on-screen text would be a fundamentally
 * different, much larger legal exposure (redistributing a third party's
 * video content, not just reading metadata already offered via a
 * documented endpoint) and is deliberately OUT OF SCOPE here.
 *
 * research/12-prior-art.md identifies caption-only parsing
 * as the single most complained-about failure across this entire product
 * category (ReciMe, Flavorish, Pestle all fail the same way when a
 * creator speaks the recipe instead of typing it) — we inherit that
 * limitation, and this file's whole job is to make sure the failure is
 * always an honest, typed outcome rather than an empty or invented
 * recipe. See `ImportResult`'s `no_recipe_in_caption` variant below and
 * the extraction prompt in `buildExtractionRequest.ts`.
 *
 * THE `'web'` ROUTE IS THE ONE THAT ESCAPES THAT CONSTRAINT, and it is
 * worth being precise about why rather than treating it as "one more
 * platform". An ordinary recipe page publishes a schema.org/Recipe object
 * as JSON-LD because Google's rich results require it — a machine-readable
 * ingredient list and method, written by the publisher, keyed by name. No
 * model is asked to read prose and no model can invent a quantity, because
 * no model is involved. Its honest failure is therefore a different one:
 * `no_recipe_on_page`, "the page said nothing structured", rather than
 * `no_recipe_in_caption`, "the text we were given did not contain a
 * recipe".
 */

import type { OembedErrorReason } from '../../lib/oembed';

/**
 * Deliberately NOT imported from src/domain/feed/types.ts's
 * `CreatorPlatform` (same literal union) — the Feed is being removed, and
 * this module should not depend on feed/types.ts's lifetime. One-line
 * duplication is cheaper than a cross-feature coupling to code that may
 * not exist much longer.
 *
 * FOUR MEMBERS, THREE DIFFERENT REASONS FOR EXISTING.
 *
 *  - `'tiktok'` and `'instagram'` are the original pair: a social post,
 *    read through that platform's oEmbed endpoint, whose caption is the
 *    only text there is. They differ only in what the licence permits —
 *    TikTok's oEmbed is public, Instagram's is embedding-only (PD-011), so
 *    Instagram resolves and stops. See displayOnlyPolicy.ts.
 *  - `'youtube'` (SRC-02/SRC-03) is a social post too, but reached through
 *    a different door: the YouTube Data API's `videos.list` endpoint
 *    (`part=snippet`) is documented and intended for reading a video's
 *    title and description for uses beyond embedding, which is exactly
 *    what Meta's oEmbed terms forbid. Same question asked per platform, a
 *    different answer because a different endpoint answers it.
 *  - `'web'` is not a social platform at all. It is an ordinary web page
 *    that publishes a schema.org/Recipe object as JSON-LD — the markup a
 *    recipe site already emits so Google can render a rich result. That
 *    makes it the odd one out in the way that matters most here: it needs
 *    no model call, so it CANNOT HALLUCINATE. Every field comes from a
 *    named key the publisher wrote, and a page that publishes no such
 *    object fails as `no_recipe_on_page` rather than being guessed at.
 *    Pinterest arrives through this member too — see urlParsing.ts.
 *
 * The note that used to stand here ("this union is widened ONLY; nobody
 * fetches YouTube yet") is discharged: the edge function now has a
 * YouTube Data API resolver and a generic page fetcher beside its oEmbed
 * client, and `source_fetch_failed` below is the typed outcome both of
 * them produce when the fetch itself does not happen.
 */
export type ImportPlatform = 'tiktok' | 'instagram' | 'youtube' | 'web';

export interface ParsedIngredient {
  readonly name: string;
  /** Copied verbatim from the caption when stated (e.g. "2", "1/2"); null when the caption doesn't give an amount. Never invented. */
  readonly quantity: string | null;
  /** e.g. "el" (eetlepel), "g", "blikjes" — whatever unit the caption itself used, or null. */
  readonly unit: string | null;
}

export interface ParsedRecipe {
  readonly title: string;
  /** At least one entry — see validateParsed.ts: an empty ingredient list is treated as a malformed shape, not a valid (if sparse) recipe. */
  readonly ingredients: readonly ParsedIngredient[];
  /** At least one entry — same reasoning as `ingredients`. */
  readonly steps: readonly string[];
  /** Only set when the caption states a time; never estimated/guessed by the model. */
  readonly estimatedMinutes: number | null;
  /** Only set when the caption states a serving count; never guessed. */
  readonly servings: number | null;
  /**
   * Dish categories the model picked from the closed vocabulary in
   * src/domain/dishTags.ts — never free text. The extraction schema
   * constrains the model to that list (buildExtractionRequest.ts) and
   * validateParsed.ts drops anything outside it on the way in, so by the
   * time a value reaches this field it is guaranteed to be a known,
   * already-normalized tag. Empty is a normal, expected answer: most
   * captions do not make a category obvious, and guessing one would be the
   * same sin as guessing an ingredient.
   *
   * This is the ONLY tagging this pipeline ever accepts from the model. It
   * is emphatically not allergen data and must never reach
   * `Meal.ingredientTags` — see toMealDraft.ts's header for how that
   * separation is made a compile error rather than a convention.
   *
   * STILL OPTIONAL, AND THE ONE FIELD ON THIS PAGE THAT IS. Its two
   * siblings on `ImportResult.parsed` (`attribution`, `recipeId`) were
   * made required when src/app/import/_fixtures.ts was given real values
   * for them. This one could not follow, because `_fixtures.ts` is not its
   * only pre-dating literal: `buildEditedRecipe` in
   * src/app/import/confirm.tsx rebuilds a `ParsedRecipe` from the
   * confirmation screen's own edited fields and does not carry dish tags
   * through at all — so requiring this field is a change to that screen
   * (and a real question about whether editing a recipe should silently
   * drop its categories), not a change to this type.
   *
   * `validateParsedRecipe` — the only way a real model response becomes a
   * `ParsedRecipe` — always populates it, so `undefined` never reaches the
   * import pipeline from the server. Treat it as `[]` wherever it can
   * appear (`toMealDraft` does), never as "categories unknown": there is
   * no fail-safe reading to preserve, because a dish tag gates nothing.
   */
  readonly dishTags?: readonly string[];
}

/**
 * Every outcome a paste of a URL can produce. Modeled as a closed
 * discriminated union — not a nullable `ParsedRecipe` plus an error
 * string — because the UI needs to show different copy and a different
 * recovery action for each (per the brief): "that's not a TikTok/Instagram
 * link" reads and resolves completely differently from "we found the
 * video but there's no recipe in the caption," which again differs from
 * "something went wrong talking to the video platform, try again."
 * Collapsing any of these into a shared "failed" bucket would be exactly
 * the kind of silent-failure UX this feature exists to avoid — the
 * caption-only limitation in the file header must surface as a clear,
 * distinguishable outcome, not a vague error toast.
 */
/**
 * A recipe's creator attribution — see buildAttribution.ts's file header
 * for the full rationale. Every field is explicitly `string | null`, never
 * optional-undefined: oEmbed genuinely may omit any of them, and a caller
 * needs to render "creator unknown" (a real `null`) differently from a
 * field that was simply never fetched. This is ATTRIBUTION, not consent —
 * see buildAttribution.ts; do not confuse this with `Creator`/PD-007 Feed
 * opt-in.
 */
export interface ImportAttribution {
  readonly authorName: string | null;
  /**
   * The creator's profile URL, taken from oEmbed's own `author_url` — never
   * synthesised from `authorName`, since a display name is not reliably a
   * URL-safe handle and guessing produces plausible links to the wrong
   * account. Null when the platform omits it, so the UI must handle a
   * creator it can name but cannot link to.
   */
  readonly authorUrl: string | null;
  readonly thumbnailUrl: string | null;
}

/**
 * Why the text we wanted to read never arrived. Every member names a
 * DIFFERENT decision someone has to make about it, which is the whole
 * reason this isn't one opaque "fetch error":
 *
 *  - `refused` — the server answered, and said no (401/403, a bot wall).
 *    Nothing is broken on our side and nothing is missing on theirs.
 *  - `not_found` — 404/410. The page or video is gone, or was never there.
 *  - `server_error` — a 5xx. Their outage, not ours, and usually brief.
 *  - `too_large` — the response exceeded the byte ceiling we read up to
 *    (`MAX_RECIPE_PAGE_BYTES`, htmlJsonLd.ts). This is a DEFENCE, not an
 *    accident: the URL is user-supplied, so an unbounded read is a
 *    denial-of-service on our own edge function — one pasted link to a
 *    multi-gigabyte file would hold a worker open until it died. We stop
 *    and say so.
 *  - `not_html` — the response was not an HTML document (a PDF, an image,
 *    a video stream). Same defence, one step earlier: there is no point
 *    reading bytes we cannot parse, and reading them anyway is the same
 *    unbounded read wearing a different content type.
 *  - `network_error` — DNS, TLS, connection reset, timeout. No response at
 *    all.
 *  - `missing_credentials` — the YouTube Data API key is not configured in
 *    this environment. A named, honest outcome rather than a silent one:
 *    the user is told YouTube cannot be fetched right now, instead of
 *    being shown a generic failure for a deployment problem that no retry
 *    of theirs will ever fix. It mirrors oEmbed's own reason of the same
 *    name (src/lib/oembed.ts) deliberately — same fact, same word.
 */
export type SourceFetchFailureReason =
  | 'refused'
  | 'not_found'
  | 'server_error'
  | 'too_large'
  | 'not_html'
  | 'network_error'
  | 'missing_credentials';

export type ImportResult =
  | {
      readonly kind: 'parsed';
      readonly recipe: ParsedRecipe;
      /** The oEmbed-resolved, normalized URL actually used — carried forward so a caller can pass it straight into `toMealDraft`. */
      readonly sourceUrl: string;
      readonly platform: ImportPlatform;
      /**
       * Who made this recipe: from the same oEmbed call already made to
       * read the caption, the same Data API `snippet` already read for a
       * YouTube video, or the page's own JSON-LD `author` — never a
       * second round trip, and never synthesised from a display name.
       *
       * REQUIRED, as of the `'web'` widening. It used to be optional for
       * one reason only — object literals in src/app/import/_fixtures.ts
       * predated the field — and its own comment asked whoever came to own
       * that file to give them a real value and let this become required.
       * That happened here. Every producer now states it: the edge
       * function builds one before it ever returns `parsed`,
       * `parseStoredRecipe` reads one off the stored row, and
       * `parseImportResult` materialises an all-null one for a response
       * from a function older than this field — which is not a fabrication
       * but the exact reading the old comment already mandated
       * ("treat `undefined` as equivalent to a populated but all-null
       * `ImportAttribution`"). One spelling of "we cannot name the
       * creator" is enough; nobody should have to check both `undefined`
       * and three nulls to learn the same fact.
       */
      readonly attribution: ImportAttribution;
      /**
       * The canonical `recipes` row (0006) this import resolved to — the
       * shared object every household's private copy of this dish points
       * at (`meals.recipe_id`), and therefore the ONLY thing a friend's
       * cook can be joined to (`shared_cooks` in 0009, `FRIEND_PROOF_BOOST`
       * in src/domain/scoring.ts). Without it a live import writes a meal
       * that is a copy of nothing, and the social half of the product can
       * never fire for it — which is exactly what happened between 0006
       * and W-01b, invisibly, because nothing type-checked the absence.
       *
       * NEVER DERIVED, ONLY REPORTED. Both producers read it off a real
       * row: the fresh path takes it from the `recipes` insert's own
       * RETURNING (or, when it lost the upsert race, from a lookup of the
       * winning row), and the cache path takes it from the stored row's
       * `id` column (`parseStoredRecipe`). `sourceUrl` sits right beside
       * this field and looks like it would do just as well — it must
       * never be used that way. The normalized URL is that row's
       * deduplication KEY, unique and stable, but it is not its identity;
       * a meal pointed at a URL-shaped id points at no row at all.
       *
       * Both paths therefore report the SAME id for the same URL, which is
       * the entire point: the twentieth household to import a link joins
       * the same canonical recipe as the first, so their cooks are proof
       * to each other rather than twenty unrelated dinners.
       *
       * `null` is a real, permanent answer, not "pending": it means this
       * import genuinely has no canonical row, and a caller must write it
       * through unchanged rather than substituting something plausible.
       * There are now two distinct ways to arrive at that answer, and they
       * are worth telling apart when reading a bug report: the canonical
       * write FAILED (a `'tiktok'`/`'instagram'` import whose insert lost
       * or errored), or the write was never ATTEMPTED because the
       * `recipes` table refuses this platform outright — see
       * `canStoreCanonicalRecipe` in canonicalRecipe.ts, which is where
       * every `'youtube'` and `'web'` import gets its permanent null.
       *
       * REQUIRED, for the same reason and by the same change as
       * `attribution` above: the fixtures that made it optional are this
       * change's own responsibility now, and every real producer states
       * it. `parseImportResult` reads an absent key as `null` — the same
       * "no canonical row known" the old optionality meant — so a response
       * from a function older than W-01b still decodes, without leaving a
       * third state for a reader to wonder about.
       */
      readonly recipeId: string | null;
    }
  /**
   * The post resolved, and we deliberately never asked the model to read
   * it. There are two different things a platform's oEmbed endpoint can be
   * used for: rendering the post (thumbnail, title, author, a link back)
   * and mining its metadata for something else. Instagram's licenses only
   * the first — Meta's documentation states the endpoint is "only meant to
   * be used for embedding Instagram content in websites and apps. Any other
   * use of metadata or content is prohibited." Deriving and storing a
   * recipe from the caption is that other use. So Instagram resolves and
   * stops. See docs/PRODUCT-DECISIONS.md PD-011. TikTok's oEmbed is public
   * and unaffected; nothing about extraction there changes.
   *
   * THIS IS NOT A FAILURE. Nothing broke, nothing is missing, and nothing
   * is retryable — the same link resolves the same way every time, because
   * the limit is a licence rather than an outage. The UI treats it as a
   * working path with a different shape: show the post and its creator,
   * and let the user type the recipe themselves (see
   * src/components/importFailureCopy.ts and src/app/import/paste.tsx).
   *
   * IT CARRIES NO CAPTION, AND THAT ABSENCE IS THE POINT.
   * `no_recipe_in_caption` deliberately carries its caption so the user can
   * judge what we read; this variant must not, because handing caption text
   * to a client to be typed up and stored is precisely the prohibited use —
   * doing it in the app rather than in the model would not make it a
   * different act. `buildDisplayOnlyResult` (displayOnlyPolicy.ts) is the
   * only constructor of this shape and never touches `OembedPayload.title`,
   * so there is no code path that could regress this by forgetting.
   *
   * `attribution` is REQUIRED here, unlike on `parsed`: crediting the
   * creator is the entire justification for showing this post at all, so a
   * version of this result without one is not worth rendering.
   */
  | {
      readonly kind: 'display_only';
      readonly platform: ImportPlatform;
      /** The oEmbed-resolved, normalized URL — carried through so manual entry keeps the link back to the original post. */
      readonly sourceUrl: string;
      readonly attribution: ImportAttribution;
    }
  /**
   * The honest failure this whole feature is built around (see file
   * header): oEmbed resolved successfully, but the caption contains no
   * usable ingredients/steps, and the model said so explicitly rather
   * than inventing something. `caption` is carried through (null only
   * when there was no caption/title text at all, in which case the LLM
   * was never even called — see the edge function) so the UI can, if it
   * chooses, show the user what we actually read.
   *
   * IMP-02. `attribution` is REQUIRED here, unlike `parsed`'s optional
   * field. `parsed`'s optionality exists purely as fixture backward-
   * compatibility (see its own doc comment) — the real edge function
   * always populates it. This variant has no equivalent excuse: index.ts
   * only ever constructs it AFTER `resolveOembedFor` has already resolved
   * successfully (both the "caption was empty, the model was never
   * called" short-circuit and the model's own explicit "no recipe here"
   * answer happen strictly after that call), so an `OembedPayload` — and
   * therefore an attribution built from it — is always genuinely in hand
   * by the time either `return` in the pipeline reaches this variant.
   * Making the field required says that plainly, rather than leaving a
   * caller to wonder whether an absent attribution here would mean "not
   * available" or "not populated yet."
   *
   * This closes the gap src/lib/importRecipe.ts's file header used to
   * document: a user who fell back to manual entry from this variant used
   * to reach the confirmation screen with no creator attached, even
   * though the function had already resolved one via oEmbed to build its
   * extraction prompt.
   */
  | { readonly kind: 'no_recipe_in_caption'; readonly caption: string | null; readonly attribution: ImportAttribution }
  /**
   * THE WEB ROUTE'S HONEST SIBLING OF `no_recipe_in_caption`. The page was
   * fetched without incident and simply publishes no machine-readable
   * recipe: no schema.org/Recipe JSON-LD, or one too incomplete to be a
   * recipe at all (see htmlJsonLd.ts). Nothing broke. The site just never
   * wrote down, in a form a machine can read, the thing a reader can see.
   *
   * IT CARRIES NO CAPTION AND NO ATTRIBUTION, AND THAT IS NOT AN
   * OVERSIGHT. `no_recipe_in_caption` carries both because oEmbed handed
   * us both — a caption we read and a creator we can credit — before the
   * model ever said "no recipe here". This variant has neither in hand:
   * the ONLY thing we ever look for on a web page is the structured
   * object, and there wasn't one. Anything we attached instead — a page
   * title scraped from `<title>`, an author guessed from a byline — would
   * be us inventing the source of a recipe we did not find. So the result
   * says exactly what happened and no more.
   *
   * Deliberately not folded into `no_recipe_in_caption`: that variant's
   * copy explains that some creators speak a recipe instead of typing it,
   * which is a true and useful thing to tell someone about a video and a
   * meaningless thing to tell someone about a food blog.
   */
  | { readonly kind: 'no_recipe_on_page' }
  /**
   * We never got the source text at all — see `SourceFetchFailureReason`
   * above for what each reason means and which of them a retry can help.
   *
   * TWO PRODUCERS, ONE VARIANT, ON PURPOSE. The generic web page GET
   * (`'web'`) and the YouTube Data API call (`'youtube'`) fail in exactly
   * the same shape and mean exactly the same thing to the person who
   * pasted the link: Remy could not open what you gave it. Splitting them
   * per platform would buy two sets of copy that say the same sentence.
   *
   * WHY `oembed_failed` WAS NOT REUSED, even though its reason vocabulary
   * overlaps this one almost word for word. Neither of these producers
   * calls oEmbed. `oembed_failed`'s reason is documented as coming
   * "verbatim from src/lib/oembed.ts's own typed failure vocabulary", and
   * a reader who saw it on a YouTube or web import would go read that
   * module looking for the code that produced it — and find nothing,
   * because there is nothing there to find. A result that sends a reader
   * to the wrong file is worse than one more union member.
   */
  | { readonly kind: 'source_fetch_failed'; readonly reason: SourceFetchFailureReason }
  /**
   * The pasted text is not a link this app will open at all — see
   * urlParsing.ts. Rejected before any network call.
   *
   * Since `'web'` joined `ImportPlatform` this is a much narrower set than
   * it used to be: an ordinary recipe page is now accepted, so what
   * remains here is text that is not a web address, an address in a scheme
   * we do not fetch (`javascript:`, `mailto:`, an app deep link), a bare
   * host that names no page, or a host pointing back at our own machine or
   * private network (`isBlockedRedirectHost`). The copy in
   * src/components/importFailureCopy.ts is written against exactly that
   * list and must be reread whenever this one changes.
   */
  | { readonly kind: 'unsupported_url' }
  /** oEmbed itself failed (404, rate limited, missing Instagram credentials, ...) — reason carried through verbatim from src/lib/oembed.ts's own typed failure vocabulary, so the UI can reuse its copy/recovery mapping. */
  | { readonly kind: 'oembed_failed'; readonly reason: OembedErrorReason }
  /** The extraction model itself could not be reached, or returned a transport-level failure (network error, non-2xx, rate limit) — distinct from `parse_failed` below because this one is usually worth a simple "try again," not a "this video probably has no written recipe." */
  | { readonly kind: 'llm_request_failed' }
  /** The model responded, but not in the required shape (bad tool call, fields that don't validate against `ParsedRecipe`) — see validateParsed.ts and parseExtractionResponse.ts. Never surfaced as a half-populated recipe. */
  | { readonly kind: 'parse_failed' };

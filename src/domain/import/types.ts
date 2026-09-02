/**
 * Recipe Import domain types.
 *
 * The Feed (PD-007) is being removed; this is its replacement: a user
 * pastes a URL — a TikTok or Instagram Reel, a YouTube video, or an
 * ordinary recipe page — or pastes the recipe text itself, and we try to
 * turn it into a structured recipe.
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
 * THE PASTED-TEXT ROUTE (`'text'`) SIDESTEPS THAT CONSTRAINT FROM THE
 * OTHER END, and it is the newest thing in this file. It does not read
 * more of somebody's video; it reads exactly what the user handed over —
 * a recipe out of a WhatsApp message, an email, a cookbook copied out by
 * hand, a screenshot retyped. No oEmbed hop, no page GET, no URL at all.
 * That makes it the only route where the legal question above does not
 * arise: nothing of a third party's is fetched, and nothing is shown back
 * to anyone but the person who supplied it. It is also the only route
 * with NO CREATOR TO CREDIT — deliberately, and named as such rather than
 * left to fall out of whichever branch happened to skip attribution. See
 * `NO_CREATOR_TO_CREDIT` in buildAttribution.ts.
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
 *
 * THAT DIFFERENCE IS NOW SOMETHING THE USER CAN SEE, not just something
 * this header explains to whoever reads it. `RecipeProvenance` below is
 * the same distinction made into a field on the result: a recipe the
 * publisher wrote down for machines, or a recipe a model read out of prose
 * written for people. It is deliberately one bit and not a confidence
 * number — see its own doc comment for why turning it into a score would
 * undo the honesty it exists to provide.
 */

import type { OembedErrorReason } from '../../lib/oembed';

/**
 * Deliberately NOT imported from src/domain/feed/types.ts's
 * `CreatorPlatform` (same literal union) — the Feed is being removed, and
 * this module should not depend on feed/types.ts's lifetime. One-line
 * duplication is cheaper than a cross-feature coupling to code that may
 * not exist much longer.
 *
 * FIVE MEMBERS, FOUR DIFFERENT REASONS FOR EXISTING.
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
 *  - `'text'` is not a place at all. No host, no endpoint, no fetch, and
 *    no URL: the user pasted the recipe itself and Remy reads exactly the
 *    characters they handed it. It is the caption route with its whole
 *    front end removed — no oEmbed hop, no page GET, straight into the
 *    model — and it is the one member that reaches this pipeline without
 *    anything being retrieved from anybody. Which is also why it is the
 *    one member with no creator: not a creator we failed to resolve, a
 *    creator that does not exist, exactly as for the manual-entry path
 *    that has always credited nobody. `NO_CREATOR_TO_CREDIT`
 *    (buildAttribution.ts) is where that is written down as a fact rather
 *    than left to be inferred from a missing field.
 *
 * THIS UNION IS NOW MISNAMED, AND THE NAME IS DELIBERATELY LEFT ALONE.
 * "Platform" stopped being accurate when `'web'` joined — an ordinary
 * recipe blog is not a platform — and `'text'` finishes the job, because
 * a clipboard is not a platform in any sense at all. What the union
 * actually enumerates is WHICH ROUTE THE PIPELINE TOOK TO OBTAIN THE TEXT
 * IT READ, and therefore what may be done with what came back: oEmbed on
 * two platforms under two different licences, a documented Data API, an
 * ordinary GET for JSON-LD, and no fetch whatsoever. Read every
 * `platform` field in this file as "route" and the code is exact; read it
 * as "social network" and three of the five members are false.
 *
 * `ImportRoute` would be the honest name, and renaming it is NOT this
 * change's business. Five modules keep their own deliberate copy of this
 * vocabulary (parseImportResult.ts, canonicalRecipe.ts, routeParams.ts,
 * importCreatorCopy.ts, importFailureCopy.ts), and `recipes.platform`
 * (0006) and `meals.source_platform` (0001) are COLUMNS whose names would
 * then disagree with the code that writes them. So this is recorded as a
 * judgement rather than performed as a drive-by: whoever renames the type
 * should rename the columns in the same commit, or leave both alone.
 *
 * The note that used to stand here ("this union is widened ONLY; nobody
 * fetches YouTube yet") is discharged: the edge function now has a
 * YouTube Data API resolver and a generic page fetcher beside its oEmbed
 * client, and `source_fetch_failed` below is the typed outcome both of
 * them produce when the fetch itself does not happen.
 */
export type ImportPlatform = 'tiktok' | 'instagram' | 'youtube' | 'web' | 'text';

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
   * REQUIRED, AND THE BUG THAT MADE IT REQUIRED IS WORTH KNOWING,
   * because it is the cleanest example in this codebase of what an
   * optional field costs.
   *
   * It was optional. `validateParsedRecipe` — the only way a real model
   * response becomes a `ParsedRecipe` — always populated it, so the field
   * was in practice never absent on any value the server produced. It was
   * absent on exactly one path: `buildEditedRecipe` in
   * src/app/import/confirm.tsx, which does not narrow anything but
   * REBUILDS a `ParsedRecipe` from scratch out of the confirmation
   * screen's edited fields. Because the field was optional, that literal
   * compiled while simply not mentioning it. So a user who imported a
   * recipe and then corrected one ingredient before saving got a meal with
   * NO dish tags, while a user who saved the identical import untouched
   * got the model's categories — and the library's dishTag filter
   * (recipeSearch.ts) then under-reported what the household owned, with
   * nothing anywhere reporting a problem. Editing a recipe silently
   * deleted its categories, and the type said that was fine.
   *
   * That is the whole argument for requiring it: the danger was never a
   * validator letting a bad value in, it was a hand-written literal
   * omitting a good one, and only the type can catch that. `[]` still says
   * what it always said — no obvious category — but it and "the writer
   * forgot" are now different things to say, and only one of them
   * compiles. Never read an empty list as "categories unknown": there is
   * no fail-safe reading to preserve, because a dish tag gates nothing.
   */
  readonly dishTags: readonly string[];
}

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
 * RCP-06. HOW THIS IMPORT GOT ITS RECIPE — the one fact a user needs to
 * judge what they are looking at, and the one this pipeline has spent its
 * whole existence keeping true.
 *
 *  - `publisher_structured_data` — the publisher wrote it down, in
 *    machine-readable form, on purpose. A schema.org/Recipe object in a
 *    page's JSON-LD (jsonLdRecipe.ts): every ingredient came out of a
 *    named key the site itself filled in, so nothing was interpreted and
 *    nothing COULD be hallucinated, because no model was involved at all.
 *  - `model_from_caption` — a language model read prose that was written
 *    for humans and produced a structured recipe from it. The caption
 *    pipeline: a TikTok caption, a YouTube description. The model is
 *    instructed and schema-constrained never to invent a quantity
 *    (buildExtractionRequest.ts) and `validateParsedRecipe` throws away
 *    anything malformed — but it is still a READING, and a reading can be
 *    wrong in ways no validator can see, because the text it misread was
 *    perfectly well-formed.
 *  - `model_from_pasted_text` — a language model read text THE USER
 *    SUPPLIED and produced a structured recipe from it. Same model, same
 *    schema, same refusal to invent a quantity; a different source, and
 *    the difference is not cosmetic. A caption is a creator's own prose
 *    about their own video: it was published, it has an author, and the
 *    original is one tap away if a quantity looks wrong. Pasted text is
 *    whatever the user had — a message from a friend, an email, a
 *    cookbook page they typed out, a screenshot they retyped and possibly
 *    mistyped. Nobody wrote it for this purpose and there is no original
 *    to go back to; the user IS holding the original. So the confirm
 *    screen has to say something different about it (see
 *    src/components/recipeProvenanceCopy.ts, whose caption note points at
 *    "het origineel" — advice that means nothing here), and the SRC-09
 *    denominator has to count it apart: "captions often fail" is evidence
 *    about video, and a pasted screenshot's OCR mistakes folded into that
 *    number would corrupt exactly the measurement importTelemetry.ts
 *    exists to keep honest.
 *
 * THIS IS A PROVENANCE FACT, NOT A SCORE, AND IT MUST NEVER BECOME ONE.
 * Do not add a confidence number, a percentage, a star rating, or an enum
 * with degrees between these two. They are not two points on a scale —
 * they are two different KINDS of thing. One is a publisher's own
 * statement about their own recipe; the other is our software's
 * interpretation of somebody's prose. A user is entitled to know which of
 * those they are holding, and that question has an exact answer, whereas
 * "how sure are we" does not: nothing in this pipeline measures its own
 * accuracy, so any number attached here would be a decoration invented at
 * the point of display. PD-019 states the rule this follows — precision
 * follows the instrument, not the screen — and the instrument here yields
 * one bit, honestly. A "87% zeker" badge would be exactly the false
 * precision the rest of this codebase refuses: it would read as measured
 * and be guessed, and it would let a genuinely wrong extraction wear a
 * high number.
 *
 * THE THIRD MEMBER IS WHAT THE RULE LOOKS LIKE WHEN IT IS OBEYED. The
 * note that stood here said there was no third member and that a new
 * extraction route would have to EARN one, argued the way the first two
 * were — never a fallback to whichever existing member is closest. SRC-08
 * added such a route and paid that price rather than reusing
 * `model_from_caption`, which would have compiled perfectly and told
 * every pasted-text importer that Remy had read a caption they never
 * pasted. Two things are still true and still bind the next member: a
 * route earns one only when the screen genuinely has something different
 * to say to the user, and these remain KINDS and never DEGREES. There is
 * no ordering among the three, and none may be introduced.
 */
export type RecipeProvenance = 'publisher_structured_data' | 'model_from_caption' | 'model_from_pasted_text';

/**
 * Why the text we wanted to read never arrived. Every member names a
 * DIFFERENT decision someone has to make about it, which is the whole
 * reason this isn't one opaque "fetch error":
 *
 *  - `refused` — WE said no, before any bytes were exchanged. Our own SSRF
 *    guard rejected the host or a hop in its redirect chain: a link back
 *    at our own machine, a private-network address, a scheme we do not
 *    open (`isBlockedRedirectHost`, resolveShortLinkTarget.ts). The
 *    publisher never heard from us and has no opinion about us.
 *  - `forbidden` — THEY said no, to US. The server answered, with 403 (and
 *    401/451 alongside it): a bot wall, a login gate, a legal block. The
 *    request was made, reached them, and was turned away.
 *
 *    THESE TWO ARE ONE WORD APART AND MEAN OPPOSITE THINGS, which is
 *    exactly why they are two members instead of one. `refused` is our
 *    decision; `forbidden` is theirs. Map a 403 onto `refused` and the
 *    copy tells a user their perfectly ordinary recipe blog is somehow
 *    dangerous; map our SSRF block onto `forbidden` and it tells them a
 *    site they can open in a browser is blocking them, sending them to
 *    complain to a publisher who did nothing. The word for a 403 is
 *    `forbidden`. Nothing else in this union is `forbidden`.
 *  - `rate_limited` — HTTP 429. They will talk to us, just not this
 *    often. The only member here whose answer changes purely by waiting,
 *    which is why the copy says "over een minuutje" rather than offering
 *    an instant retry (importFailureCopy.ts).
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
  | 'forbidden'
  | 'rate_limited'
  | 'not_found'
  | 'server_error'
  | 'too_large'
  | 'not_html'
  | 'network_error'
  | 'missing_credentials';

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
 *
 * ---
 *
 * EVERY VARIANT BELOW CARRIES A `platform` EXCEPT `unsupported_url`. One
 * sentence, one exception, and the exception is the reason the rule is
 * stated as a rule rather than granted variant by variant.
 *
 * THE FACT THAT MAKES IT AFFORDABLE: the platform is known the instant
 * `normalizeRecipeUrl` succeeds (urlParsing.ts), which is the FIRST thing
 * the pipeline does and strictly before any network call. Every outcome
 * except one is therefore constructed downstream of a value already sitting
 * in scope — nothing has to be looked up, re-derived, or guessed to state
 * it. Read the edge function's `resolveImport` top to bottom and the shape
 * is plain: `unsupported_url` returns on the line above, and every other
 * `return` in the file is inside a branch that has just been handed a
 * platform.
 *
 * `'text'` MAKES THAT ARGUMENT STRONGER RATHER THAN WEAKER, which is worth
 * saying because it is the first member that reaches this pipeline without
 * a URL at all. It is known EARLIER than the other four, not later: the
 * user picked the paste-text route before typing a character, so there is
 * no parse to succeed and nothing to establish. A text import therefore
 * carries its platform for free at every producer, exactly like the rest.
 *
 * THE FACT THAT MAKES IT NECESSARY: an outcome that cannot say which
 * platform it came from is an outcome nobody can act on. `no_recipe_in_caption`
 * is the case that decides a real question rather than a hypothetical one.
 * SRC-09 — reading a video's audio or on-screen text — is out of scope on
 * copyright grounds (see the file header), and the only evidence that could
 * ever justify reopening it is the rate at which caption-only extraction
 * fails. But "a caption yielded no recipe" is not one number: a TikTok
 * caption and a YouTube description are different lengths, written by
 * different people, under different conventions, and there is no reason
 * whatsoever for them to fail alike. Counting them together produces an
 * average of two populations and answers for neither. IMP-07's telemetry
 * (importTelemetry.ts) can only report what the variant carries, so the
 * variant has to carry it.
 *
 * `unsupported_url` IS THE ONE HONEST ABSENCE, and its absence is a fact
 * rather than a gap. That variant is returned when `normalizeRecipeUrl`
 * itself refuses the text — it is not a link, not a scheme we open, or a
 * host pointing back at our own network — which is to say it is returned
 * precisely because we never established what the URL points at. There is
 * no platform to omit. Giving it a nullable field, or a `'web'` default,
 * would be the app inventing a fact about a string it declined to open, and
 * a fabricated platform is strictly worse than a missing one: it does not
 * merely fail to answer the SRC-09 question, it corrupts the denominator
 * that question is asked against.
 *
 * SO THE RULE IS A RULE AND NOT A COLLECTION OF CASES. "Everything but
 * `unsupported_url`" is one sentence a reader can hold and a reviewer can
 * check; "whichever variants somebody got round to widening" is a state
 * nobody can verify without reading all nine. The next variant added
 * inherits the rule by default and has to argue its way out of it, which is
 * the direction the burden of proof belongs in.
 */
export type ImportResult =
  | {
      readonly kind: 'parsed';
      readonly recipe: ParsedRecipe;
      /**
       * The resolved, normalized URL actually used — carried forward so a
       * caller can pass it straight into `toMealDraft`.
       *
       * NULLABLE AS OF SRC-08, FOR EXACTLY ONE ROUTE. A `'text'` import
       * has no URL: the user pasted the recipe, not a link to it, so
       * there is no address to carry and never was one. Every other
       * platform still always states one — `parseImportResult` enforces
       * that pairing rather than merely typing it, so this nullability
       * cannot become a hole the other four slip through.
       *
       * WHY NULL AND NOT A SENTINEL. An empty string, a `'pasted:'`
       * scheme or an `about:blank` would keep the field a `string` and
       * spare every reader a null check, which is precisely the problem:
       * a sentinel is a value every downstream reader must know to
       * UN-read, and the ones that forget do not fail, they write it
       * down. It would land in `meals.source_url` as a stored, queryable
       * falsehood about where a household's recipe came from, and it
       * would collide in any lookup keyed on a normalized URL, making two
       * unrelated pasted recipes look like the same dish. `null` cannot
       * be mistaken for an address by anything, and the compiler makes
       * every reader say what it does about the absence.
       */
      readonly sourceUrl: string | null;
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
      /**
       * RCP-06. Whether this recipe is what the publisher themselves
       * stated in machine-readable form, or a model's reading of prose —
       * see `RecipeProvenance` above for the two members and for why this
       * is a fact rather than a score.
       *
       * WHY IT LIVES HERE AND NOT ON `ParsedRecipe`. `ParsedRecipe` is
       * CONTENT: it is the dish — a title, ingredients, steps, the things
       * that would be equally true if the same recipe had arrived some
       * other way. Provenance is a fact about one ACT OF IMPORTING, not
       * about the dish. Put it on the content and it travels: `toMealDraft`
       * would carry it into a household's meal and `buildRecipeRowInsert`
       * into the canonical row, where it would stop meaning "this is how
       * Remy obtained this, once" and start meaning "this recipe IS
       * model-derived" — a claim about the dish itself that outlives the
       * import, gets copied between households, and is wrong the moment
       * the same recipe is later imported from a page that publishes it
       * properly. The narrow field is the honest one.
       *
       * REQUIRED, for exactly the reason `attribution` and `recipeId`
       * above became required in the wave before this one: an optional
       * field is a field a producer can forget, and a provenance that is
       * sometimes absent forces the UI to render a third, "onbekend"
       * state that no producer ever actually means. Every producer knows
       * the answer for free — the web route knows it read JSON-LD, the
       * caption route knows it called a model, and `parseStoredRecipe`
       * derives it from what the storability guard permits (see
       * canonicalRecipe.ts, and the warning there about what happens if
       * that guard widens). None of them has to look anything up, so none
       * of them has an excuse to omit it.
       */
      readonly provenance: RecipeProvenance;
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
   * `attribution` is REQUIRED here — as it now is on `parsed` too, though
   * this variant got there first and for a stronger reason: crediting the
   * creator is the entire justification for showing this post at all, so a
   * version of this result without one is not worth rendering.
   */
  | {
      readonly kind: 'display_only';
      readonly platform: ImportPlatform;
      /**
       * The oEmbed-resolved, normalized URL — carried through so manual
       * entry keeps the link back to the original post. Deliberately NOT
       * widened to `string | null` when `parsed`'s was (SRC-08): this
       * variant is reached through oEmbed alone, so it always has a URL,
       * and the post it links back to is the entire justification for
       * showing it at all (PD-011). A nullable field here would let a
       * display-only result exist with nothing to link to, which is the
       * one shape this variant must never take.
       */
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
   * THIS VARIANT IS NOW THE PASTED-TEXT ROUTE'S HONEST FAILURE TOO, and
   * its name has stopped keeping up. A `'text'` import whose text holds
   * no recipe is the same event in every way that decides the shape of
   * the result: a model was given prose, said plainly that there was no
   * recipe in it, nothing broke, nothing is retryable, and the way
   * forward is to type it. `caption` then holds the user's OWN pasted
   * text, which is theirs to be shown back to them — none of PD-011's
   * reasoning is engaged, because nothing of a third party's is being
   * handed anywhere.
   *
   * A SIXTH VARIANT WAS THE ALTERNATIVE AND IS THE WRONG TRADE. It would
   * buy an accurate name and cost a tenth outcome for every exhaustive
   * switch in the codebase to grow an arm for, plus a second telemetry
   * outcome that splits one measurement in two — while the `platform`
   * field already tells the two apart exactly where that matters
   * (importTelemetry.ts). The COPY does differ and is branched on
   * platform where it is written, in src/components/importFailureCopy.ts:
   * the sentence about makers who speak their recipe aloud is true of a
   * video and false of a message somebody pasted. So the variant is
   * misnamed in the same way `ImportPlatform` is, and is left alone for
   * the same reason: a rename is a wide mechanical change across the edge
   * function, the copy layer and the telemetry vocabulary, not a
   * side-effect of adding a route.
   *
   * IMP-02. `attribution` is REQUIRED here. It was required here first,
   * while `parsed`'s was still optional for fixture backward-
   * compatibility; that gap has since closed and both are required now,
   * but the arguments are not the same one twice. This variant never had
   * even the fixture excuse: index.ts
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
  | {
      readonly kind: 'no_recipe_in_caption';
      readonly caption: string | null;
      readonly attribution: ImportAttribution;
      /**
       * THE ONE THIS UNION WAS WIDENED FOR. `'tiktok'`, `'youtube'` or —
       * since SRC-08 — `'text'`: the three routes that reach the shared
       * model tail. Telling the first two apart is most of the SRC-09
       * question, not a nicety, and telling `'text'` from either is what
       * keeps that question answerable at all: a pasted screenshot's
       * mistyped amounts are not evidence about captions, and counted as
       * if they were they would inflate the only number SRC-09 turns on.
       * See the union's own doc comment above.
       *
       * Free at every construction site, which is why it is required
       * rather than optional: the blank-text short-circuit and the model's
       * explicit "no recipe here" both live inside the shared extraction
       * tail, whose input already names the route its caller took.
       */
      readonly platform: ImportPlatform;
    }
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
  | {
      readonly kind: 'no_recipe_on_page';
      /**
       * `'web'` today, and stated rather than assumed. The JSON-LD reader
       * is the only thing that produces this outcome and only the web route
       * runs it, so a reader could work the value out — and that is exactly
       * the inference this field exists to make unnecessary. A count keyed
       * on "which route found nothing" must not depend on a coincidence
       * that holds until the day some other route learns to read structured
       * data.
       */
      readonly platform: ImportPlatform;
    }
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
  | {
      readonly kind: 'source_fetch_failed';
      readonly reason: SourceFetchFailureReason;
      /**
       * THE FIELD THAT MAKES "TWO PRODUCERS, ONE VARIANT" READABLE AGAIN.
       * The paragraph above argues that a web GET and a Data API call fail
       * in the same shape and mean the same thing TO THE USER — which is
       * true, and is why the copy is shared. It was never true of the
       * operator: `missing_credentials` means an unset `YOUTUBE_API_KEY` on
       * the YouTube route and cannot arise on the web one, and a wall of
       * `forbidden` is a bot wall on somebody's blog rather than anything
       * Google did. One outcome for the reader, two for whoever has to fix
       * it, and this field is what keeps the second reading available.
       */
      readonly platform: ImportPlatform;
    }
  /**
   * The pasted text is not a link this app will open at all — see
   * urlParsing.ts. Rejected before any network call.
   *
   * READ THAT SENTENCE AGAIN NOW THAT PASTING TEXT IS A ROUTE. "Not a
   * link" is no longer the same statement as "no use to Remy": a
   * WhatsApp message full of ingredients is not a link either, and it is
   * a perfectly good import. This variant is what `normalizeRecipeUrl`
   * returns for text submitted AS A URL, and nothing else. Text
   * submitted as text never reaches it — it goes straight to the model
   * and fails, if it fails, as `no_recipe_in_caption` with
   * `platform: 'text'`. The two must not be conflated, in code or in
   * copy: telling someone who pasted a recipe that their link is wrong
   * names a mistake they did not make and hides the one they did. See
   * the note on this variant's copy in src/components/importFailureCopy.ts.
   *
   * Since `'web'` joined `ImportPlatform` this is a much narrower set than
   * it used to be: an ordinary recipe page is now accepted, so what
   * remains here is text that is not a web address, an address in a scheme
   * we do not fetch (`javascript:`, `mailto:`, an app deep link), a bare
   * host that names no page, or a host pointing back at our own machine or
   * private network (`isBlockedRedirectHost`). The copy in
   * src/components/importFailureCopy.ts is written against exactly that
   * list and must be reread whenever this one changes.
   *
   * THE ONE VARIANT WITH NO `platform`, AND THE ONLY ONE THAT COULD NOT
   * HONESTLY HAVE ONE. Every sibling states its platform (see the union's
   * doc comment for the rule and why it exists); this one is returned by
   * the branch that runs BEFORE a platform is established, because
   * establishing it is exactly what failed. Every list above describes text
   * we declined to identify: `javascript:hello` belongs to no platform, a
   * bare host names no page on one, and a link at our own private network
   * is refused before anyone asks what serves it.
   *
   * DO NOT GIVE IT A NULLABLE FIELD TO "COMPLETE THE SET". A
   * `platform: ImportPlatform | null` here would put a null back into the
   * eight variants that no longer need one, so every reader would be back
   * to handling an absence that only one outcome can produce — and IMP-07's
   * telemetry already renders a missing platform as `-` at the log line,
   * which is the one place the absence needs a spelling. And do not default
   * it to `'web'` on the grounds that most rejected text looks like a URL:
   * that would file every unopened string under the route whose failure
   * rate matters, inventing exactly the data importTelemetry.ts exists to
   * measure honestly.
   */
  | { readonly kind: 'unsupported_url' }
  /** oEmbed itself failed (404, rate limited, missing Instagram credentials, ...) — reason carried through verbatim from src/lib/oembed.ts's own typed failure vocabulary, so the UI can reuse its copy/recovery mapping. */
  | {
      readonly kind: 'oembed_failed';
      readonly reason: OembedErrorReason;
      /**
       * `'tiktok'` or `'instagram'` in practice — oEmbed is reachable from
       * those two alone, structurally, because the web and YouTube routes
       * return before it (see the edge function's `resolveImport`). Typed
       * as the full `ImportPlatform` anyway rather than as `OembedPlatform`:
       * this is the shape a CLIENT narrows off the wire, and a client that
       * hard-refused an `oembed_failed` naming a third platform would be
       * asserting a fact about a server it cannot see the version of.
       * `missing_credentials` reads completely differently on the two —
       * an unset Instagram token versus a TikTok endpoint that should need
       * none — so merging their counts hides the only actionable half.
       */
      readonly platform: ImportPlatform;
    }
  /** The extraction model itself could not be reached, or returned a transport-level failure (network error, non-2xx, rate limit) — distinct from `parse_failed` below because this one is usually worth a simple "try again," not a "this video probably has no written recipe." */
  | {
      readonly kind: 'llm_request_failed';
      /**
       * In hand at both producers, and they are not the same producer.
       * Inside the edge function this is the caption route's platform, held
       * since before the model was called. On the client,
       * src/lib/importRecipe.ts synthesises this variant when the round
       * trip itself failed — no response to read, so nothing of the
       * server's to report — and states the platform `normalizeRecipeUrl`
       * gave the paste screen before the request was sent. That is the same
       * function, on the same URL, that the function would have used; it is
       * a reading rather than a guess, and without it the transport-failure
       * path would be the one import outcome with no platform at all.
       */
      readonly platform: ImportPlatform;
    }
  /** The model responded, but not in the required shape (bad tool call, fields that don't validate against `ParsedRecipe`) — see validateParsed.ts and parseExtractionResponse.ts. Never surfaced as a half-populated recipe. */
  | {
      readonly kind: 'parse_failed';
      /**
       * `'tiktok'` or `'youtube'`: only the caption routes call a model, so
       * only they can be answered badly by one. Worth counting apart for
       * the same reason `no_recipe_in_caption` is — a model that mangles
       * one platform's prose and not the other's is a prompt problem, and
       * a single merged number cannot show that.
       */
      readonly platform: ImportPlatform;
    };

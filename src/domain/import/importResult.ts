/**
 * THE ANSWER: every outcome the import pipeline is allowed to produce, as
 * one closed discriminated union, plus the longest sustained argument in
 * this domain for why each member had to be its own.
 *
 * This module is most of what types.ts used to be, and it is the half that
 * earns the length. The vocabularies (importVocabulary.ts) enumerate words;
 * the content shapes (parsedRecipe.ts) describe a dish; attribution
 * (importAttribution.ts) names a creator. `ImportResult` is where all three
 * meet a decision a user can see: ten variants, each owed different copy
 * and a different way forward, because the failure this whole feature was
 * built around — a caption that simply contains no recipe — must never be
 * indistinguishable from a network blip in a grey toast.
 *
 * THE RULES THIS UNION ENFORCES ARE STATED ONCE AND INHERITED BY WHATEVER
 * COMES NEXT, which is the only reason ten variants stay reviewable. Every
 * variant carries a `platform` except `unsupported_url`, whose absence is a
 * fact rather than a gap. Every field a producer knows for free is REQUIRED
 * rather than optional, because an optional field is a field a hand-written
 * literal can forget while still compiling — and this codebase has already
 * paid for that once, in a confirm screen that silently dropped a recipe's
 * categories. Provenance is a fact about ONE ACT OF IMPORTING, which is why
 * it lives on this union and not on the recipe it describes. The doc
 * comments below are where each of those was argued, and where the next
 * person has to argue their way back out.
 *
 * WHY IT IS NOT SPLIT FURTHER — per variant, or into success and failure
 * families. The union is only exhaustive if a reader can see all of it at
 * once. "Everything but `unsupported_url` carries a platform" is one
 * sentence a reviewer can check against nine adjacent members, and becomes a
 * claim nobody can verify the moment those members live in five files; the
 * same goes for "no member may be a degree of another". The size of this
 * file is the price of keeping those checks cheap, and it is worth paying up
 * to the point where the file stops fitting under the ceiling — which is
 * exactly why the vocabularies and the content shapes left, and no variant
 * did.
 *
 * Types only — no runtime value is declared, so nothing imports this module
 * at run time and it cannot pull I/O into src/domain.
 */

// The `.ts` on every relative specifier here is LOAD-BEARING, and is spelled
// even on type-only imports, which are erased and would never be resolved at
// all. Five modules under supabase/functions/parse-recipe/ import this
// file's public entry point (types.ts), Deno resolves relative specifiers
// literally, and the day one of these imports stops being type-only is the
// day an extensionless specifier breaks the DEPLOY and nothing else — not
// `tsc --noEmit`, not ESLint, not vitest, all of which exclude that
// directory. Spelling it now costs three characters and removes the
// question. See parseImportResult.ts for the longer version of this note,
// and `allowImportingTsExtensions` (tsconfig.json) for what keeps it legal
// on the Node/Metro side that does check this file.
import type { OembedErrorReason } from '../../lib/oembed.ts';
import type { ImportAttribution } from './importAttribution.ts';
import type { ImportPlatform, RecipeProvenance, SourceFetchFailureReason } from './importVocabulary.ts';
import type { ParsedRecipe } from './parsedRecipe.ts';

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
 * caption-only limitation in types.ts's file header must surface as a
 * clear, distinguishable outcome, not a vague error toast.
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
 * copyright grounds (see types.ts's file header), and the only evidence
 * that could ever justify reopening it is the rate at which caption-only
 * extraction fails. But "a caption yielded no recipe" is not one number: a
 * TikTok caption and a YouTube description are different lengths, written
 * by different people, under different conventions, and there is no reason
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
 * nobody can verify without reading all ten. The next variant added
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
       * see `RecipeProvenance` (importVocabulary.ts) for the two members
       * and for why this is a fact rather than a score.
       *
       * WHY IT LIVES HERE AND NOT ON `ParsedRecipe` (parsedRecipe.ts —
       * a separate module for exactly this reason). `ParsedRecipe` is
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
   * The honest failure this whole feature is built around (see types.ts's
   * file header): oEmbed resolved successfully, but the caption contains
   * no usable ingredients/steps, and the model said so explicitly rather
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
   * (importVocabulary.ts) for what each reason means and which of them a
   * retry can help.
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
       * `'tiktok'`, `'youtube'` or — since SRC-08 — `'text'`: the three
       * routes that call a model, so the three that can be answered badly
       * by one. Worth counting apart for the same reason
       * `no_recipe_in_caption` is — a model that mangles one platform's
       * prose and not another's is a prompt problem, and a single merged
       * number cannot show that.
       *
       * THIS SAID "`'tiktok'` or `'youtube'`" UNTIL GAP-07, AND HAD BEEN
       * WRONG SINCE THE DAY SRC-08 SHIPPED. The pasted-text route runs the
       * same model tail as the caption routes — index.ts hands it to
       * `finishImport`, which calls `callExtractionModel` and returns
       * `{ kind: 'parse_failed', platform }` with whatever platform it was
       * handed — so `parse_failed` with `platform: 'text'` was reachable
       * all along. The sibling variant above WAS updated for SRC-08 and
       * this one was not, which is the tell: half an edit, not a decision.
       * Recorded rather than quietly corrected because of how it hid — the
       * comment was stale precisely BY NOT SAYING `'text'`, so the grep
       * that audited every other `'text'` claim could never have found it.
       * A search for the word a stale comment omits is a search that
       * cannot succeed, and that is the lesson worth keeping.
       */
      readonly platform: ImportPlatform;
    }
  /**
   * IMP-06 / IMP-10. Refused before the pipeline was entered, because this
   * caller — or their household — has spent its budget for the window.
   *
   * WHY IT IS A VARIANT AND NOT A 429. index.ts reserves non-2xx for a
   * request that is MALFORMED, and a throttle is the opposite of that: the
   * request was perfectly well-formed and we chose not to serve it. That is
   * an anticipated outcome, which is exactly what this union is for. A bare
   * 429 would also strand the client with an HTTP status to translate into
   * Dutch at the fetch layer, which is the one place in this app that does
   * no copy.
   *
   * WHY IT IS ONE VARIANT WITH A `scope` RATHER THAN TWO. The three
   * refusals `decideImportBudget` can produce differ in what a person
   * should DO, and that difference is exactly two-valued: wait, or wait
   * until tomorrow. `unidentified_caller` collapses into the first — see
   * `scope` — because "we cannot tell who you are" is not a sentence any
   * user of this app can act on, and is never true for one of them.
   *
   * NO COUNTS, NO CEILING, NO REMAINING BUDGET. The client is told to wait
   * and how long; it is never told how close it was. A number a caller can
   * read is a number a caller can sit just underneath, which is the whole
   * argument for 0012's zero-policy RLS, applied to the response body.
   */
  | {
      readonly kind: 'import_throttled';
      /**
       * Which limit closed, and therefore which sentence the UI shows.
       *
       * `'caller'` is the ten-minute burst window: a human who really did
       * import twenty things in ten minutes, or a loop. Either way the
       * advice is the same and the wait is short.
       *
       * `'household'` is the daily model ceiling, shared by everyone in the
       * house — so the copy has to avoid blaming the person holding the
       * phone for spending someone else did.
       */
      readonly scope: 'caller' | 'household';
      /**
       * Whole seconds until the count drops back below the limit, from
       * `decideImportBudget` and never computed at the edge.
       *
       * ALWAYS A REAL WAIT. The policy clamps it to at least one second and
       * at most its own window, so this can never advise an instant retry
       * that is guaranteed to fail, nor a wait longer than the limit that
       * produced it — the case a clock skew between Postgres and the
       * function would otherwise create.
       */
      readonly retryAfterSeconds: number;
    };

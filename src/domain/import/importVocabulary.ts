/**
 * The import pipeline's CLOSED VOCABULARIES: the three unions whose entire
 * job is to enumerate, exhaustively, a set of answers this pipeline is
 * willing to give. Which route the text came in by (`ImportPlatform`), what
 * KIND of reading produced the recipe (`RecipeProvenance`), and why the text
 * never arrived at all (`SourceFetchFailureReason`).
 *
 * WHY THESE THREE SIT TOGETHER, AND APART FROM EVERYTHING ELSE IN THE
 * FAMILY. They are words, not shapes. Nothing here has a field, nothing here
 * is constructed, and nothing here can be widened as a local edit: two of
 * them are stored verbatim in the database (`recipes.platform` in migration
 * 0006 and `meals.source_platform` in 0001 hold `ImportPlatform` members),
 * and all three are mirrored by a copy layer that owes one sentence per
 * member — importFailureCopy.ts for the fetch failures,
 * recipeProvenanceCopy.ts for the provenance, importCreatorCopy.ts and
 * importPasteCopy.ts for the routes. Adding a member therefore costs a
 * migration's worth of thought plus a handful of files, and gathering the
 * three in one small module is what makes that price visible in one place
 * rather than buried between the interfaces that happen to carry them.
 *
 * THE ARGUMENTS ARE THE MODULE. Each of these unions is a single line of
 * code under a page of reasoning, and the reasoning is the part that has to
 * survive: why `refused` and `forbidden` are one word apart and mean
 * opposite things, why `RecipeProvenance` is a fact and must never be
 * allowed to become a score, why `ImportPlatform` is misnamed on purpose and
 * what renaming it would cost. Strip the comments and what is left is
 * seventeen string literals that any future reader would feel free to
 * reorganise into something dishonest. The length here is not a smell; it is
 * the record of decisions that were expensive to make once and would be
 * expensive to make again.
 *
 * Types only — no runtime value is declared, so nothing imports this module
 * at run time and it cannot pull I/O into src/domain.
 */

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
 * client, and `source_fetch_failed` (importResult.ts) is the typed
 * outcome both of them produce when the fetch itself does not happen.
 */
export type ImportPlatform = 'tiktok' | 'instagram' | 'youtube' | 'web' | 'text';

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

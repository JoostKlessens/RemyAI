/**
 * Finds the schema.org/Recipe JSON-LD inside a page's raw HTML and turns it
 * into a `ParsedRecipe` plus the `ImportAttribution` that belongs to it.
 * This is the half of SRC-01 that was missing: `jsonLdRecipe.ts` has been
 * complete and fully tested since the day it was written and was called by
 * NOTHING, because the step in front of it — find the right
 * `<script type="application/ld+json">` block among the several a real page
 * carries, and `JSON.parse` it — did not exist anywhere. It exists here, and
 * it is pure, so the only thing left for the edge function is the fetch.
 *
 * NO HTML PARSER, ON PURPOSE. This module has to run in Deno inside a
 * Supabase edge function where there is no DOM, and pulling in cheerio /
 * jsdom / htmlparser2 would mean shipping a full HTML5 tokenizer to answer
 * one question: "which script tags say ld+json, and what is between them?"
 * `jsonLdRecipe.ts`'s text-cleanup section already settled this argument for
 * its own tag stripping — narrow, conservative, individually argued regexes
 * over a general parser — and the same answer holds a level up. The regexes
 * below are not a general HTML parser and are never asked to be one; where
 * they are approximate (see `SCRIPT_BLOCK`), the cost of being wrong is one
 * extra candidate that fails `JSON.parse` or yields no Recipe node, which is
 * the same door every rejected candidate already leaves by.
 *
 * ONE BLOCK PRODUCES THE WHOLE ANSWER, OR NO BLOCK DOES. Candidates are
 * tried in document order and the FIRST one that yields a recipe wins,
 * whole. Nothing is merged: a title from block 1, an author from block 3 and
 * an image from block 5 would be a recipe that exists on no page anywhere,
 * assembled by us — precisely the invented data this directory exists to
 * refuse. `jsonLdRecipe.ts` fails a whole recipe over one unrecognised
 * container for the same reason; this file applies that rule one level out,
 * to whole blocks instead of whole fields.
 *
 * THE ONE PLACE LENIENCY IS RIGHT is a candidate that will not `JSON.parse`.
 * That failure is unambiguous in a way no shape decision ever is — it says
 * "these bytes are not JSON", full stop, with no reading of the content
 * involved — so skipping that block and trying the next one is not a guess
 * about a recipe. It is the exact same distinction `jsonLdRecipe.ts` draws
 * when it drops a blank `<li>` but fails the recipe over an ingredient entry
 * that isn't a string. One publisher shipping a broken `Organization` block
 * must not sink a page whose next block is a perfectly good Recipe.
 *
 * ATTRIBUTION COMES OFF THE RECIPE NODE ITSELF, never off a neighbouring
 * block, and never off the page. A `WebSite` node's author is the site, an
 * `Article` node's author is whoever wrote the intro, and neither is
 * necessarily whose recipe this is. `readAttribution` below therefore reads
 * `author`/`image` from the SAME node `parseJsonLdRecipe` read the recipe
 * from — obtained through that module's own exported `findRecipeNode`, not a
 * second local copy of its `@graph`/array/nesting walk. A second copy is how
 * two functions quietly disagree about which node is "the recipe" and start
 * crediting the wrong person.
 */

import type { ImportAttribution, ParsedRecipe } from './types';
import { findRecipeNode, parseJsonLdRecipe } from './jsonLdRecipe.ts';

// ---------------------------------------------------------------------------
// The two limits the edge function enforces on its side of the fetch. Both
// live here rather than in supabase/functions/**, for the reason
// displayOnlyPolicy.ts's header already gives: that directory is excluded
// from `tsc --noEmit` and from ESLint, so a number written there is neither
// checked nor testable, and a cap nobody can test is a cap nobody can trust.
// ---------------------------------------------------------------------------

const BYTES_PER_MEBIBYTE = 1024 * 1024;

/**
 * The hard cap on how much of a response body is worth reading before
 * giving up on it.
 *
 * THIS IS A DENIAL-OF-SERVICE DEFENCE, not a performance tweak. The URL
 * being fetched came from a text field a user pasted into, which means an
 * attacker picks it: an endpoint that streams gigabytes, or never ends at
 * all, turns one free request into unbounded memory and wall-clock in our
 * own function. A byte budget the reader enforces as it streams is the only
 * thing that bounds that, and it has to be a byte count rather than a
 * character count because bytes are what a reader can count before it has
 * decoded anything.
 *
 * 2 MiB, because a fat recipe blog — inlined critical CSS, a hundred
 * lazy-loaded image tags, three analytics snippets and the recipe itself —
 * lands in the low hundreds of kilobytes of HTML. This leaves roughly an
 * order of magnitude of headroom over the worst page we expect to meet,
 * which is the right shape for a limit whose false positives cost a real
 * user a real import: generous enough that nobody legitimate hits it,
 * finite enough that nobody hostile gets to choose the number.
 */
export const MAX_RECIPE_PAGE_BYTES = 2 * BYTES_PER_MEBIBYTE;

/**
 * The media types worth reading a body for at all. Deliberately a closed
 * set of the two types that can carry a `<script type="application/ld+json">`
 * block: `text/html`, and the XHTML type some older CMSes still serve.
 * Everything else — a PDF, an MP4, an image, `application/json` — has no
 * chance of containing one, so streaming its body would be spending
 * `MAX_RECIPE_PAGE_BYTES` to learn nothing.
 */
const HTML_CONTENT_TYPES: ReadonlySet<string> = new Set(['text/html', 'application/xhtml+xml']);

/**
 * A cap on how many ld+json candidates are tried, so a page that carries
 * thousands of tiny blocks cannot turn one request into thousands of
 * `JSON.parse` calls. Thirty-two is far beyond anything real: a heavily
 * marked-up page carries a handful (Organization, WebSite, BreadcrumbList,
 * Article, Recipe, VideoObject, and a couple a plugin added), and a page
 * whose Recipe is the thirty-third block is a page whose Recipe we are
 * content to miss rather than pay for.
 */
const MAX_JSON_LD_BLOCKS = 32;

/**
 * Every `<script>` element with its attribute text and its body captured
 * separately. Attributes are captured rather than matched inline because
 * `type` may sit anywhere among `charset`, `id`, `nonce`, `data-*` and
 * whatever else a CMS emits, in any order — matching the attribute chunk in
 * a second pass is what makes order irrelevant instead of demanding an
 * alternation per permutation.
 *
 * The body is lazy up to the first `</script`, which is not a shortcut but
 * the actual HTML rule: `script` is a raw-text element, and a `</script`
 * sequence ends it even in the middle of what the author thought was a
 * string. A browser reading this page would truncate the block in exactly
 * the same place, so a block "broken" this way is one that is broken for
 * Google too; publishers who need the sequence inside a JSON string escape
 * the slash, which this leaves untouched. See `parseBlock` for where a
 * truncated block lands.
 *
 * KNOWN APPROXIMATION: `[^>]*` for the attribute chunk stops at the first
 * `>`, so an attribute value that itself contains one (`data-x="a>b"`) ends
 * the tag early, and a `<script …>` written inside an HTML comment or inside
 * another script's source is matched as if it were real. Both are rare, and
 * both cost at most one extra candidate that fails to produce a Recipe —
 * they cannot produce a WRONG recipe, which is the only failure mode this
 * file is actually defending against.
 */
const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

/**
 * The `type` attribute naming JSON-LD, in every spelling a real page uses:
 * double-quoted, single-quoted, or bare, with arbitrary whitespace around
 * the `=` and inside the quotes, in any case (`Type="APPLICATION/LD+JSON"`
 * is legal HTML and does appear). `+` is escaped because this is a regex,
 * not a media-type string.
 *
 * Anchored on a preceding space rather than a `\b`, because a word boundary
 * would also fire inside `data-type="application/ld+json"` — an attribute
 * that says something about a script rather than being its type. An
 * attribute chunk always begins with the whitespace that separated it from
 * `<script`, so requiring that space is both exact and free.
 */
const LD_JSON_TYPE_ATTRIBUTE =
  /(?:^|\s)type\s*=\s*(?:"\s*application\/ld\+json\s*"|'\s*application\/ld\+json\s*'|application\/ld\+json\b)/i;

/**
 * The XML CDATA wrapper some XHTML-era templates still put around a script
 * body, with or without the `//` that hides the markers from a JavaScript
 * parser. Stripping it is unambiguous in the same sense a `JSON.parse`
 * failure is: these are markers addressed to the XML parser, never content,
 * and they are only removed when they bracket the ENTIRE body — a `]]>`
 * sitting inside a JSON string cannot trigger this.
 */
const CDATA_WRAPPER = /^(?:\/\/\s*)?<!\[CDATA\[([\s\S]*?)(?:\/\/\s*)?\]\]>$/;

/**
 * An absolute http(s) URL, which is the only kind of URL this module will
 * report. A relative `/images/hero.jpg` is a perfectly valid thing for a
 * page to write and a useless thing for us to store: resolving it needs the
 * page's own URL, which this pure function deliberately does not receive,
 * and storing it unresolved produces a `thumbnailUrl` that renders as a
 * broken image on every surface that trusts it. Reporting null instead is
 * the honest reading of "we cannot use this", and it is why this check does
 * NOT contradict `buildAttribution.ts` passing oEmbed's URLs through
 * untouched — that data comes from one platform's documented API, this comes
 * from markup written by hundreds of publishers with no shared QA.
 */
const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readAbsoluteUrl(value: unknown): string | null {
  const text = readNonEmptyString(value);
  return text !== null && ABSOLUTE_HTTP_URL.test(text) ? text : null;
}

// ---------------------------------------------------------------------------
// Collecting and parsing the candidate blocks.
// ---------------------------------------------------------------------------

function unwrapCdata(body: string): string {
  const match = CDATA_WRAPPER.exec(body);
  return match === null ? body : (match[1] ?? '').trim();
}

/** Every ld+json block's body, in document order, capped at `MAX_JSON_LD_BLOCKS`. Non-JSON-LD scripts (analytics, `application/json` config blobs, plain JavaScript) are skipped by the attribute test, not by their content. */
function collectJsonLdBlocks(html: string): readonly string[] {
  const blocks: string[] = [];
  // `matchAll` builds its own regex from this one rather than advancing the
  // module-level literal's `lastIndex`, so the /g flag here is safe to share
  // across calls — nothing in this module ever `exec`s it directly.
  for (const match of html.matchAll(SCRIPT_BLOCK)) {
    if (blocks.length >= MAX_JSON_LD_BLOCKS) {
      break;
    }
    if (!LD_JSON_TYPE_ATTRIBUTE.test(match[1] ?? '')) {
      continue;
    }
    const body = unwrapCdata((match[2] ?? '').trim());
    if (body.length > 0) {
      blocks.push(body);
    }
  }
  return blocks;
}

/**
 * `undefined` means "this block is not JSON" and nothing else — an
 * unambiguous sentinel, because `JSON.parse` can return `null`, a number or
 * a string but never `undefined`. See the file header on why a parse failure
 * is the one thing this module skips past rather than fails over.
 *
 * A body that is HTML-escaped (the JSON syntax itself run through an HTML
 * encoder, so every quote arrives as `&quot;`) lands here and is skipped,
 * deliberately un-decoded. `script` is a raw-text element: an HTML parser
 * does NOT resolve character references inside it, so those really are six
 * literal characters and a browser would fail on this block exactly as we
 * do. Decoding it first would mean parsing a document the publisher did not
 * serve, and inventing a recipe out of one is worse than missing one.
 * (Entities INSIDE a JSON string value — `"name": "Kip &amp; prei"` — are
 * valid JSON, arrive here intact, and are decoded further down the line by
 * `jsonLdRecipe.ts`'s own text cleanup, which is where they belong.)
 */
function parseBlock(block: string): unknown {
  try {
    return JSON.parse(block) as unknown;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Attribution, read off the Recipe node itself. Every field is `string |
// null` and a missing one stays null — see `ImportAttribution` in types.ts,
// and buildAttribution.ts for why that nullability is load-bearing rather
// than laziness.
// ---------------------------------------------------------------------------

/** A name and, only when the SAME node offered one, that person's URL. Kept together as one value so the two can never be read from different authors. */
interface AuthorCredit {
  readonly name: string;
  readonly url: string | null;
}

/**
 * schema.org lets `author` be a bare string, or a `Person`/`Organization`
 * object with `name` and optionally `url`. A string author has no URL and
 * gets none: `authorUrl` is NEVER synthesised from `authorName`, for exactly
 * the reason buildAttribution.ts states for the oEmbed path — a display name
 * is not reliably a URL-safe handle, so guessing produces a plausible link
 * to the wrong person's page, which is worse than no link at all.
 */
function readAuthorEntry(entry: unknown): AuthorCredit | null {
  if (typeof entry === 'string') {
    const name = readNonEmptyString(entry);
    return name === null ? null : { name, url: null };
  }
  if (!isRecord(entry)) {
    return null;
  }
  const name = readNonEmptyString(entry.name);
  return name === null ? null : { name, url: readAbsoluteUrl(entry.url) };
}

/**
 * `author` is also allowed to be an ARRAY of either shape, which co-authored
 * posts really do use. The first entry that yields a name wins, and its URL
 * comes from that same entry — mixing entry 1's name with entry 2's URL
 * would credit one person with a link to another, which is a wrong
 * attribution rather than a missing one.
 *
 * An entry carrying a URL but no name is skipped rather than reported as a
 * nameless link: `ImportAttribution` supports a creator we can name but
 * cannot link to (the UI handles it), and does not usefully support the
 * reverse — an unlabelled link credits nobody.
 */
function readAuthorCredit(raw: unknown): AuthorCredit | null {
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const credit = readAuthorEntry(entry);
      if (credit !== null) {
        return credit;
      }
    }
    return null;
  }
  return readAuthorEntry(raw);
}

/** One `image` entry: a bare URL string, or an `ImageObject` whose `url` is a string or (on pages that list several renditions of one image) an array of strings. */
function readImageEntry(entry: unknown): string | null {
  if (typeof entry === 'string') {
    return readAbsoluteUrl(entry);
  }
  if (!isRecord(entry)) {
    return null;
  }
  if (Array.isArray(entry.url)) {
    for (const nested of entry.url) {
      const url = readAbsoluteUrl(nested);
      if (url !== null) {
        return url;
      }
    }
    return null;
  }
  return readAbsoluteUrl(entry.url);
}

/**
 * `image` is the field Google's own Recipe guidance tells publishers to
 * supply in several aspect ratios, so an array of any of the shapes above is
 * the common case rather than the exotic one. First usable entry wins: we
 * need one thumbnail, the publisher listed them in their own order, and
 * picking "the biggest" would mean parsing dimensions this module has no
 * reason to care about.
 */
function readImageUrl(raw: unknown): string | null {
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const url = readImageEntry(entry);
      if (url !== null) {
        return url;
      }
    }
    return null;
  }
  return readImageEntry(raw);
}

function readAttribution(node: Record<string, unknown>): ImportAttribution {
  const author = readAuthorCredit(node.author);
  return {
    authorName: author?.name ?? null,
    authorUrl: author?.url ?? null,
    thumbnailUrl: readImageUrl(node.image),
  };
}

// ---------------------------------------------------------------------------
// The entry points.
// ---------------------------------------------------------------------------

/** A recipe and the credit that belongs to it, from ONE block of ONE page — never assembled across blocks. See the file header. */
export interface HtmlRecipeExtraction {
  readonly recipe: ParsedRecipe;
  readonly attribution: ImportAttribution;
}

/**
 * Whether a response's `Content-Type` is worth reading a body for. This
 * exists so the edge function can refuse a PDF, a video or an image
 * BEFORE spending `MAX_RECIPE_PAGE_BYTES` streaming something that cannot
 * possibly contain a recipe.
 *
 * Parameters are tolerated and ignored: `text/html; charset=utf-8` is the
 * overwhelmingly common real value, and the charset has no bearing on
 * whether the body might carry a script tag.
 *
 * A NULL OR ABSENT HEADER IS `false`. A response that declines to say what
 * it is has not earned an unbounded read of its body, and this function's
 * whole purpose is to be the gate that runs before the read. The two
 * mistakes are not symmetrical: refusing a misconfigured-but-real recipe
 * site costs one import the user can retry elsewhere, while accepting an
 * unlabelled body means streaming arbitrary bytes from a URL an attacker
 * chose. The cheap failure is the one to default to.
 */
export function isHtmlContentType(contentTypeHeader: string | null): boolean {
  if (contentTypeHeader === null) {
    return false;
  }
  const mediaType = (contentTypeHeader.split(';')[0] ?? '').trim().toLowerCase();
  return HTML_CONTENT_TYPES.has(mediaType);
}

/**
 * The single entry point: raw page HTML in, a recipe and its attribution
 * out, or `null` when no block on the page yields one.
 *
 * `findRecipeNode` is called here for the attribution and the whole parsed
 * candidate is handed to `parseJsonLdRecipe` for the recipe, rather than
 * passing the node straight in. That keeps `parseJsonLdRecipe` the one
 * entry point to the parse — the shape every existing test exercises —
 * while still guaranteeing the attribution belongs to the same node the
 * recipe came from: both walks are the same pure function over the same
 * value, so they cannot disagree about which node is the Recipe. That
 * guarantee is the entire reason `findRecipeNode` was exported rather than
 * re-implemented in this file.
 *
 * The size of `html` is not re-checked against `MAX_RECIPE_PAGE_BYTES`
 * here. By the time a caller holds a string, the memory the cap exists to
 * protect has already been spent — the cap only means anything to the code
 * doing the reading, which is why it is exported for the edge function
 * rather than enforced at this door.
 */
export function extractRecipeFromHtml(html: string): HtmlRecipeExtraction | null {
  for (const block of collectJsonLdBlocks(html)) {
    const candidate = parseBlock(block);
    if (candidate === undefined) {
      continue;
    }
    const node = findRecipeNode(candidate);
    if (node === null) {
      continue;
    }
    const recipe = parseJsonLdRecipe(candidate);
    if (recipe === null) {
      continue;
    }
    return { recipe, attribution: readAttribution(node) };
  }
  return null;
}

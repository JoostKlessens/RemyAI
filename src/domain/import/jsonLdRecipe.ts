/**
 * Extracts a `ParsedRecipe` from a page's schema.org/Recipe JSON-LD block
 * (SRC-01 on the backlog) — the highest-value import route this product
 * has, because it needs none of the machinery the caption pipeline in this
 * same directory does. AH Allerhande, 24Kitchen, Leukerecepten, NYT
 * Cooking and most food blogs already publish this data FOR GOOGLE, in a
 * structured, machine-authored shape. Reading it back costs nothing, calls
 * no model, and cannot hallucinate an ingredient a page never stated — it
 * can only fail to find one.
 *
 * PURE, and deliberately narrow in what it is responsible for. This module
 * takes the JSON that was ALREADY extracted from a page's
 * `<script type="application/ld+json">` tag and already run through
 * `JSON.parse` — it does not fetch a URL, does not touch the DOM, and does
 * not know HTML exists beyond the stray tags/entities that leak into text
 * fields (handled below). Finding the right `<script>` tag among the
 * several a page carries, and `JSON.parse`ing each candidate, is
 * `htmlJsonLd.ts`'s job, one file over — pure for the same reasons this
 * one is, and the module that also reads the creator attribution off the
 * node this one parses (through `findRecipeNode`, exported below precisely
 * so the two can never disagree about which node is "the recipe"). That
 * leaves exactly one impure step, the fetch itself, in the edge function
 * where it belongs — the same division `validateParsed.ts` keeps by not
 * fetching Gemini's response itself.
 *
 * THE STANCE, borrowed deliberately from `validateParsed.ts`. That module
 * guards a controlled, schema-forced LLM tool call; this one guards
 * markup written by hundreds of unrelated publishers with no shared QA. The
 * chaos is real (see every shape below), but the failure mode this feature
 * can least afford is the same one that module exists to prevent: a
 * half-understood page becoming a half-populated recipe. So the same rule
 * applies — any container/type this module does not recognize (a
 * non-array `recipeIngredient`, an ingredient entry that isn't a string, an
 * instruction step shaped like nothing schema.org actually publishes) fails
 * the WHOLE parse, not just that one field. The one place this module is
 * deliberately lenient is blank noise — an empty `<li></li>` a WordPress
 * plugin left behind, or a trailing blank line in a newline-joined
 * instructions string — because a blank entry has an unambiguous meaning
 * ("nothing here") and dropping it isn't a guess about content, unlike
 * every other shape decision in this file.
 *
 * THE LAST STEP IS NOT A SEPARATE VALIDATOR. Rather than re-implement
 * "non-empty title", "ingredients array is non-empty", "every step is a
 * non-blank string", "estimatedMinutes/servings are a positive integer or
 * null" a second time, this module's whole job is to translate JSON-LD's
 * chaos into the exact same plain-object shape `validateParsedRecipe`
 * already accepts, and then hand it to that function as the final gate.
 * That is not a shortcut: it is the only way to guarantee this route can
 * never drift from the one enforcing "never invented, never estimated" for
 * the caption route, and it is why "ingredients are empty"/"steps are
 * empty" below are never checked directly in this file — they are checked
 * once, in one place, by the function both import routes share.
 *
 * WHAT IS DELIBERATELY OUT OF SCOPE. `recipeCategory`/`recipeCuisine`
 * could plausibly feed `ParsedRecipe.dishTags`, but that mapping isn't
 * part of SRC-01's brief and doing it without a spec would mean inventing
 * one — exactly what this file exists to avoid doing to a recipe's actual
 * content. `dishTags` is left unset here (`validateParsedRecipe` treats
 * that as `[]`, same as a caption where the model found no obvious
 * category) until a real mapping is asked for.
 */

import type { ParsedIngredient, ParsedRecipe } from './types';
import { validateParsedRecipe } from './validateParsed.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Text cleanup: JSON-LD string fields routinely carry raw HTML (a stray
// <b>, an <br> a CMS forgot to strip) and named/numeric entities, because
// most publishers generate this block from the same template as the
// visible page rather than authoring it separately. No DOM parser is used
// (this module must stay usable outside a browser/Deno DOM), so tag
// stripping and entity decoding are both done with narrow, conservative
// regexes — good enough for markup, not a general HTML sanitizer, and
// never asked to be one.
// ---------------------------------------------------------------------------

/**
 * A deliberately small table: just the entities that actually show up in
 * recipe markup (structural HTML escapes, typographic punctuation, the
 * degree symbol and vulgar fractions for oven temps/quantities, and the
 * accented Latin letters common to Dutch source text). An entity outside
 * this table is left exactly as written rather than guessed at — the same
 * "don't invent it" rule as everything else in this file, applied to a
 * single character instead of a whole field.
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  times: '×',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  agrave: 'à',
  acirc: 'â',
  auml: 'ä',
  igrave: 'ì',
  iuml: 'ï',
  ograve: 'ò',
  ouml: 'ö',
  ucirc: 'û',
  uuml: 'ü',
  ccedil: 'ç',
};

/** Named + numeric (decimal and hex) HTML entities. An entity this table doesn't know is left untouched, never guessed. */
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const isHex = body[1]?.toLowerCase() === 'x';
      const codePoint = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    const replacement = NAMED_ENTITIES[body.toLowerCase()];
    return replacement ?? match;
  });
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** For a value that is always ONE field (a title, one ingredient line, one step): tags become spaces, entities decode, whitespace collapses. Never splits — a stray internal newline stays a space, not a new item. */
function cleanText(raw: string): string {
  return collapseWhitespace(decodeHtmlEntities(raw.replace(/<[^>]+>/g, ' ')));
}

/** Block-level boundaries a CMS commonly emits inside a single `recipeInstructions` string — turned into real line breaks BEFORE the remaining tags are stripped, so "<p>Step one</p><p>Step two</p>" still splits into two steps instead of merging into one blob. */
const BLOCK_BREAK_TAGS = /<\s*\/?\s*(?:p|br|li|div|tr)\b[^>]*>/gi;

/** The "plain string with newlines" shape of `recipeInstructions`: turn block tags into breaks, strip what's left, decode entities, then split on the breaks. Blank lines (a trailing `<br>`, doubled newlines) are dropped — see the file header on why that's cleanup, not salvage. */
function splitInstructionString(raw: string): readonly string[] {
  const decoded = decodeHtmlEntities(raw.replace(BLOCK_BREAK_TAGS, '\n').replace(/<[^>]+>/g, ' '));
  return decoded
    .split('\n')
    .map((line) => collapseWhitespace(line))
    .filter((line) => line.length > 0);
}

// ---------------------------------------------------------------------------
// Finding the Recipe node. A JSON-LD block's root can be the Recipe
// itself, an array of top-level nodes, or a `@graph` wrapper (Google's own
// recommended shape for a page describing several things at once — an
// Article ABOUT a Recipe, plus the Recipe, plus a BreadcrumbList, all
// siblings under one `@graph`). Rather than special-case each known
// wrapper key, this walks the whole parsed structure once and returns the
// first node whose `@type` says Recipe, which handles every wrapper shape
// above (and `mainEntity`, and anything else a publisher nests it under)
// with one piece of logic instead of a list of container names to keep in
// sync with what publishers actually do.
// ---------------------------------------------------------------------------

/** JSON has no cycles, so this terminates on any real document; the cap only protects against a pathologically deep/huge payload spending unbounded call-stack depth on a page that was never going to contain a usable Recipe anyway. */
const MAX_SEARCH_DEPTH = 12;

/** `@type` shows up as `"Recipe"`, `["Recipe", "Thing"]`, or occasionally a full IRI (`"https://schema.org/Recipe"`) or a prefixed form (`"schema:Recipe"`) — normalized by keeping only the segment after the last `/`, `#` or `:`. */
function normalizeTypeToken(value: string): string {
  const segments = value.split(/[/#:]/);
  return (segments[segments.length - 1] ?? value).trim().toLowerCase();
}

function isRecipeTypeValue(value: unknown): boolean {
  return typeof value === 'string' && normalizeTypeToken(value) === 'recipe';
}

function hasRecipeType(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  return isRecipeTypeValue(type) || (Array.isArray(type) && type.some(isRecipeTypeValue));
}

/**
 * EXPORTED, unlike everything else above it, because one other module
 * genuinely needs the NODE and not just the recipe: `htmlJsonLd.ts` reads a
 * page's creator attribution (`author`, `image`) off the same node this
 * file reads the ingredients off, and a recipe credited to a different
 * node's author is a wrong attribution rather than a missing one — see
 * `ImportAttribution` in types.ts on why that distinction is not cosmetic.
 *
 * The alternative was for that module to keep its own copy of the
 * `@graph`/array/`mainEntity` walk above. That is the one shape of
 * duplication this pair cannot afford: two walks that agree today would
 * drift the first time either grows a case, and the symptom would not be a
 * crash or a failed parse but a correct-looking recipe carrying somebody
 * else's name. Exporting the single walk makes "the attribution belongs to
 * the recipe" true by construction — same pure function, same input, same
 * node — instead of true by two files happening to match.
 *
 * It stays an implementation detail in every other sense: no caller should
 * reach for this to bypass `parseJsonLdRecipe` and read fields off a Recipe
 * node directly, since every "never invented, never estimated" guarantee in
 * this file lives in the code BETWEEN this function and that one.
 */
export function findRecipeNode(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > MAX_SEARCH_DEPTH) {
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRecipeNode(item, depth + 1);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  if (hasRecipeType(value)) {
    return value;
  }
  for (const nested of Object.values(value)) {
    const found = findRecipeNode(nested, depth + 1);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ingredients. `recipeIngredient` is the correct schema.org field;
// `ingredients` (no `recipe` prefix) is a common older-page mistake, still
// accepted here. Splitting a free-text line into quantity/unit/name is
// done with a closed vocabulary and a leading-token match ONLY — see the
// file header's "never invented, never estimated" stance. A wrong
// quantity silently attached to the wrong ingredient is worse than every
// ingredient landing whole in `name`, so any line this can't confidently
// parse keeps its full text as `name` with both other fields left null.
// ---------------------------------------------------------------------------

/** Units actually seen on Dutch and English recipe sites, lower-cased. Deliberately closed: a token not in this set is treated as part of the ingredient name (e.g. "ui" — onion — never matches, so "1/2 ui" keeps "ui" in the name), never as a plausible-looking unit. */
const UNIT_VOCAB: ReadonlySet<string> = new Set([
  // Dutch
  'g',
  'gr',
  'gram',
  'grammen',
  'kg',
  'kilo',
  'kilogram',
  'ml',
  'cl',
  'dl',
  'l',
  'liter',
  'el',
  'eetlepel',
  'eetlepels',
  'tl',
  'theelepel',
  'theelepels',
  'snufje',
  'snufjes',
  'mespuntje',
  'teentje',
  'teentjes',
  'teen',
  'tenen',
  'stuk',
  'stuks',
  'stukje',
  'stukjes',
  'blikje',
  'blikjes',
  'blik',
  'blikken',
  'pak',
  'pakje',
  'pakjes',
  'zakje',
  'zakjes',
  'plak',
  'plakje',
  'plakjes',
  'plakken',
  'bosje',
  'bosjes',
  'takje',
  'takjes',
  'druppel',
  'druppels',
  'kopje',
  'kopjes',
  'handje',
  'handjes',
  // English
  'gram',
  'grams',
  'kilogram',
  'kilograms',
  'milliliter',
  'milliliters',
  'millilitre',
  'millilitres',
  'liter',
  'liters',
  'litre',
  'litres',
  'cup',
  'cups',
  'tbsp',
  'tablespoon',
  'tablespoons',
  'tsp',
  'teaspoon',
  'teaspoons',
  'oz',
  'ounce',
  'ounces',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'pinch',
  'pinches',
  'clove',
  'cloves',
  'slice',
  'slices',
  'can',
  'cans',
  'package',
  'packages',
  'pack',
  'packs',
  'bunch',
  'bunches',
  'sprig',
  'sprigs',
  'drop',
  'drops',
  'stick',
  'sticks',
  'quart',
  'quarts',
  'pint',
  'pints',
  'gallon',
  'gallons',
]);

/**
 * The leading quantity token, tried most-specific first (a regex
 * alternation picks the FIRST branch that matches at the anchored start,
 * not the longest, so order encodes priority): a mixed number ("1 1/2")
 * before a bare fraction ("1/2") before a decimal ("2,5"/"2.5") before a
 * hyphenated range ("2-3") before a plain integer, plus the Unicode vulgar
 * fraction glyphs recipe sites paste directly ("½ ui"). A range is kept
 * verbatim as the quantity STRING rather than resolved to one number —
 * `ParsedIngredient.quantity` is "copied verbatim when stated", and
 * picking either end of "2-3" would be exactly the invented number this
 * file refuses to produce.
 */
const QUANTITY_TOKEN = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d+[.,]\d+|\d+\s*[-–]\s*\d+|\d+|[¼½¾⅓⅔⅛⅜⅝⅞])/;

interface QuantitySplit {
  readonly quantity: string | null;
  readonly rest: string;
}

function splitQuantityAndRest(text: string): QuantitySplit {
  const match = QUANTITY_TOKEN.exec(text);
  if (match === null) {
    return { quantity: null, rest: text };
  }
  return { quantity: match[1] ?? match[0], rest: text.slice(match[0].length).trim() };
}

interface UnitSplit {
  readonly unit: string | null;
  readonly name: string;
}

/** The first whitespace-delimited token after the quantity, checked verbatim (after stripping trailing punctuation like the "." in "el.") against `UNIT_VOCAB` — not a prefix or fuzzy match, so "elite" never matches "el" and a real ingredient name is never chewed into. */
function splitUnitAndName(rest: string): UnitSplit {
  const match = /^(\S+)\s*/.exec(rest);
  if (match === null) {
    return { unit: null, name: rest };
  }
  const token = match[1] ?? '';
  const normalized = token.toLowerCase().replace(/[.,;:]+$/, '');
  if (!UNIT_VOCAB.has(normalized)) {
    return { unit: null, name: rest };
  }
  return { unit: normalized, name: rest.slice(match[0].length).trim() };
}

/** `line` is already cleaned (tags stripped, entities decoded, whitespace collapsed) by the caller. */
function parseIngredientLine(line: string): ParsedIngredient {
  const { quantity, rest } = splitQuantityAndRest(line);
  if (quantity === null || rest.length === 0) {
    return { name: line, quantity: null, unit: null };
  }
  const { unit, name } = splitUnitAndName(rest);
  // Nothing left over after removing the quantity (and unit, if any) means
  // this "quantity" match wasn't actually a leading amount on an
  // ingredient line — fall back to the untouched original rather than
  // hand `validateParsedRecipe` an ingredient with an empty name.
  if (name.length === 0) {
    return { name: line, quantity: null, unit: null };
  }
  return { name, quantity, unit };
}

/** `recipeIngredient` (correct field) with `ingredients` (older-page mistake) as fallback — checked in that order, not merged, since a page stating both would otherwise double every line. */
function pickField(node: Record<string, unknown>, primaryKey: string, fallbackKey: string): unknown {
  const primary = node[primaryKey];
  return primary !== undefined && primary !== null ? primary : node[fallbackKey];
}

/**
 * `null` means "not an array of strings" — a structural shape this file
 * doesn't recognize, which fails the whole recipe per the file header.
 * A present-but-blank entry (an empty `<li>`, a trailing comma) is
 * filtered rather than treated as doubt: it has one unambiguous reading,
 * "nothing here". The resulting (possibly empty) list is left for
 * `validateParsedRecipe` to reject as empty — see the file header on why
 * that check lives there and nowhere else.
 */
function extractIngredientLines(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const lines: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      return null;
    }
    const cleaned = cleanText(entry);
    if (cleaned.length > 0) {
      lines.push(cleaned);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Instructions. `recipeInstructions` is the one field schema.org lets a
// publisher shape four genuinely different ways (Google's own Recipe
// rich-result docs enumerate all four), so this is the messiest part of
// the module. `extractStepItem`/`extractStepList` recurse into each other
// to flatten a `HowToSection`'s nested `itemListElement` — bounded by the
// same depth cap as `findRecipeNode`, for the same reason.
// ---------------------------------------------------------------------------

function extractStepItem(item: unknown, depth: number): readonly string[] | null {
  if (depth > MAX_SEARCH_DEPTH) {
    return null;
  }
  if (typeof item === 'string') {
    const cleaned = cleanText(item);
    return cleaned.length > 0 ? [cleaned] : [];
  }
  if (!isRecord(item)) {
    // A number, boolean, null, or array where a single step was expected —
    // not a shape this file has ever seen a real page use, so it counts as
    // structural doubt rather than something to skip past.
    return null;
  }
  // HowToSection: the section itself carries no step text, only a nested
  // list of steps (often HowToStep objects) under `itemListElement`.
  if (Array.isArray(item.itemListElement)) {
    return extractStepList(item.itemListElement, depth + 1);
  }
  // HowToStep: `text` is the field schema.org defines; a small number of
  // real pages put the step's prose in `name` instead and never set
  // `text` at all, so it is accepted as a fallback — still a field this
  // file recognizes, not a guess at unstructured content.
  const text = typeof item.text === 'string' ? item.text : typeof item.name === 'string' ? item.name : null;
  if (text === null) {
    return null;
  }
  const cleaned = cleanText(text);
  return cleaned.length > 0 ? [cleaned] : [];
}

function extractStepList(items: readonly unknown[], depth: number): readonly string[] | null {
  const steps: string[] = [];
  for (const item of items) {
    const extracted = extractStepItem(item, depth);
    if (extracted === null) {
      return null;
    }
    steps.push(...extracted);
  }
  return steps;
}

/**
 * The four shapes `recipeInstructions` arrives in: absent (treated as no
 * steps stated, not doubt — most non-Recipe JSON-LD nodes simply lack the
 * field); a single string, possibly with embedded HTML and newlines,
 * split into one step per line; an array (of plain strings, `HowToStep`
 * objects, or `HowToSection` objects — `extractStepList` handles all
 * three per entry, in any mixture, since real pages do mix them); or,
 * rarely, a single `HowToSection`/`HowToStep` object with no wrapping
 * array, handled by lifting it into a one-element array. Anything else
 * (a bare number, a boolean) is a shape this file has no confident
 * reading for, so it fails the whole recipe.
 */
function extractInstructionTexts(raw: unknown): readonly string[] | null {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (typeof raw === 'string') {
    return splitInstructionString(raw);
  }
  if (Array.isArray(raw)) {
    return extractStepList(raw, 0);
  }
  if (isRecord(raw)) {
    return extractStepList([raw], 0);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Time and servings. Both are only ever reported when the page states
// them; a page with none of prepTime/cookTime/totalTime, or a recipeYield
// that reads as a range rather than one count, contributes `null` — never
// an estimate.
// ---------------------------------------------------------------------------

/**
 * A full ISO 8601 duration parse (`PnYnMnDTnHnMnS`), even though a recipe
 * realistically only ever uses the `D`/`H`/`M` fields (occasionally `S`;
 * never sensibly `Y`, though a fermentation/rise time in whole days is
 * genuinely common — "P1D"). Years/months are converted using calendar
 * approximations (365/30 days) purely for completeness of the spec, not
 * because a recipe is ever expected to hit them; if a page's markup really
 * does state "P1Y", faithfully reporting that absurd-but-stated value is
 * still the right call — "never estimate" means never substituting our own
 * number, not silently discarding theirs because it looks wrong.
 */
const DURATION_PATTERN =
  /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

function parseIsoDurationMinutes(raw: unknown): number | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  // The pattern above matches "P" and "PT" too (every group is optional) —
  // both are a malformed/empty duration, not a genuine zero-length one.
  if (trimmed.length === 0 || trimmed === 'P' || trimmed === 'PT') {
    return null;
  }
  const match = DURATION_PATTERN.exec(trimmed);
  if (match === null) {
    return null;
  }
  const [, years, months, days, hours, minutes, seconds] = match;
  const totalMinutes =
    (years ? parseFloat(years) * 365 * 24 * 60 : 0) +
    (months ? parseFloat(months) * 30 * 24 * 60 : 0) +
    (days ? parseFloat(days) * 24 * 60 : 0) +
    (hours ? parseFloat(hours) * 60 : 0) +
    (minutes ? parseFloat(minutes) : 0) +
    (seconds ? parseFloat(seconds) / 60 : 0);
  const rounded = Math.round(totalMinutes);
  return rounded > 0 ? rounded : null;
}

/** Prefer `totalTime`; when absent, sum whatever of `prepTime`/`cookTime` IS stated (treating a genuinely missing one as 0 — this is addition, not estimation, since every term that goes in was itself stated). `null` only when none of the three durations parse. */
function readEstimatedMinutes(node: Record<string, unknown>): number | null {
  const total = parseIsoDurationMinutes(node.totalTime);
  if (total !== null) {
    return total;
  }
  const prep = parseIsoDurationMinutes(node.prepTime);
  const cook = parseIsoDurationMinutes(node.cookTime);
  return prep === null && cook === null ? null : (prep ?? 0) + (cook ?? 0);
}

/** A lone digit run in the text, with nothing suggesting it's one end of a range/approximation rather than a genuinely stated count. */
const RANGE_INDICATOR = /[-–—~±]|\bto\b/i;

function parseServingsFromText(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || RANGE_INDICATOR.test(trimmed)) {
    return null;
  }
  const numbers = trimmed.match(/\d+/g);
  // More than one number ("Serves 4, makes 12 pieces") means it's no
  // longer obvious which figure is the serving count — safer to report
  // nothing than to guess the first one is the right one.
  if (numbers === null || numbers.length !== 1) {
    return null;
  }
  const value = parseInt(numbers[0] as string, 10);
  return value > 0 ? value : null;
}

/**
 * `recipeYield` may be a bare number, a string ("4 servings", "4-6"), an
 * array of either (tried in order, first confident read wins — real pages
 * often repeat the same count as both a plain string and a phrase), or,
 * on pages that follow schema.org's `QuantitativeValue` guidance more
 * strictly (AH Allerhande among them), an object carrying the number
 * under `value`. A range ("4-6") is exactly the case this must NOT
 * resolve to either end — see `RANGE_INDICATOR` above.
 */
function readServings(raw: unknown): number | null {
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const value = readServings(entry);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string') {
    return parseServingsFromText(raw);
  }
  if (isRecord(raw) && 'value' in raw) {
    return readServings(raw.value);
  }
  return null;
}

function readTitle(node: Record<string, unknown>): string | null {
  if (typeof node.name !== 'string') {
    return null;
  }
  const cleaned = cleanText(node.name);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * The single entry point. Takes the already-`JSON.parse`d contents of one
 * `<script type="application/ld+json">` block and returns a `ParsedRecipe`,
 * or `null` when no Recipe node can be found in it, or when what's found
 * cannot be confidently translated into one — see the file header.
 */
export function parseJsonLdRecipe(raw: unknown): ParsedRecipe | null {
  const node = findRecipeNode(raw);
  if (node === null) {
    return null;
  }

  const title = readTitle(node);
  if (title === null) {
    return null;
  }

  const ingredientLines = extractIngredientLines(pickField(node, 'recipeIngredient', 'ingredients'));
  if (ingredientLines === null) {
    return null;
  }

  const steps = extractInstructionTexts(node.recipeInstructions);
  if (steps === null) {
    return null;
  }

  // Deliberately NOT typed `unknown` — every field below is already a
  // concrete, well-formed value, and `validateParsedRecipe` accepting
  // `unknown` is what lets it also guard the untrusted LLM tool call in
  // validateParsed.ts's own caller. This is the same shape, offered
  // through the same door.
  return validateParsedRecipe({
    title,
    ingredients: ingredientLines.map(parseIngredientLine),
    steps,
    estimatedMinutes: readEstimatedMinutes(node),
    servings: readServings(node.recipeYield),
  });
}

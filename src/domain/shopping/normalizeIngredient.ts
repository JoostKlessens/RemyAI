/**
 * BSK-02: turn one free-text `RawIngredientLine` into a comparable
 * `NormalizedIngredient`.
 *
 * Three independent normalizations happen here, and they fail independently
 * — a garbled unit never blocks a good name, an unparsed quantity never
 * blocks either of the other two:
 *
 * 1. NAME — lowercase, trim, strip a trailing prep note ("ui, fijngesneden"
 *    -> "ui"), collapse whitespace, strip diacritics. Reuses `normalizeTag`
 *    (../normalizeTag.ts) for the lowercase/trim/diacritic-stripping core,
 *    the same normalization PD-006 already relies on for allergen and dish
 *    tags — this file adds only what ingredient names need on top (comma
 *    stripping, internal whitespace collapse), rather than inventing a
 *    second normalization routine that could drift from the first.
 *
 * 2. UNIT — map the many Dutch spellings of one unit ("el", "eetlepel",
 *    "eetlepels") onto one canonical code, via the frozen `UNIT_ALIASES`
 *    table below. A unit this table doesn't recognize is kept verbatim
 *    (`{ kind: 'unrecognized', raw }`), never dropped and never guessed —
 *    see `IngredientUnit`'s doc comment in types.ts for why silently
 *    treating an unknown unit as "no unit" would be a correctness bug, not
 *    a shortcut.
 *
 * 3. QUANTITY — parse a quantity string into a number ONLY where it is
 *    genuinely numeric: plain integers/decimals, Dutch decimal commas
 *    ("1,5"), ASCII fractions ("1/2", "1 1/2"), and Unicode vulgar
 *    fractions ("½", "1½"). Everything else ("een scheut", "naar smaak")
 *    stays exactly as written, as an `unparsed` label — see
 *    `NormalizedQuantity`'s doc comment in types.ts. THIS IS THE WHOLE
 *    POINT OF THIS FILE: src/domain/import/types.ts's `ParsedIngredient`
 *    goes out of its way to never invent a quantity that wasn't stated in
 *    the source caption, and this module is the second half of that
 *    promise — the parser downstream of the import must be exactly as
 *    honest as the parser that produced the string in the first place.
 *    Coercing "een scheut" to `1` would quietly break that chain the
 *    moment the string reaches this file, even though nothing upstream
 *    did anything wrong.
 *
 * PURE: no I/O, no randomness, no throwing. `normalizeIngredient` returns
 * `null` for a line whose name normalizes to nothing usable (e.g. a blank
 * or comma-only name) rather than throwing or fabricating a placeholder —
 * see the "failures are typed return values or nulls, never exceptions"
 * convention this whole domain layer follows.
 */

import type { CanonicalUnit, IngredientUnit, NormalizedIngredient, NormalizedQuantity, RawIngredientLine } from './types';
import { normalizeTag } from '../normalizeTag';

// ---------------------------------------------------------------------------
// Unit table
// ---------------------------------------------------------------------------

/**
 * Every spelling this codebase currently recognizes for each canonical unit,
 * already lowercase with no diacritics (the same shape `normalizeTag`
 * produces), so a lookup is a single object-key hit with no further
 * transformation. Deliberately a flat map rather than a
 * `Record<CanonicalUnit, string[]>` — a flat map is what an `O(1)` lookup by
 * raw spelling actually wants; the "many spellings, one canonical unit"
 * relationship is expressed by multiple keys pointing at the same value,
 * which reads at a glance and needs no inversion step.
 *
 * Closed set, matching `CanonicalUnit` in types.ts. Extend by adding a key
 * here, never by relaxing the lookup — an unmapped spelling is meant to
 * surface as `{ kind: 'unrecognized' }` (see `normalizeIngredientUnit`
 * below), not silently guess its way into an existing bucket.
 */
export const UNIT_ALIASES: Readonly<Record<string, CanonicalUnit>> = Object.freeze({
  // el — eetlepel(s), tablespoon
  el: 'el',
  eetl: 'el',
  eetlepel: 'el',
  eetlepels: 'el',
  // tl — theelepel(s), teaspoon
  tl: 'tl',
  theel: 'tl',
  theelepel: 'tl',
  theelepels: 'tl',
  // g — gram
  g: 'g',
  gr: 'g',
  gram: 'g',
  grams: 'g',
  grammen: 'g',
  // kg — kilogram
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilogrammen: 'kg',
  // ml — milliliter
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  // l — liter
  l: 'l',
  ltr: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  // snufje — pinch
  snufje: 'snufje',
  snufjes: 'snufje',
  // teen — clove (garlic)
  teen: 'teen',
  teentje: 'teen',
  teentjes: 'teen',
  tenen: 'teen',
  // blikje — tin/can
  blik: 'blikje',
  blikje: 'blikje',
  blikjes: 'blikje',
  blikken: 'blikje',
  // stuk — piece/item
  stuk: 'stuk',
  stuks: 'stuk',
  stukje: 'stuk',
  stukjes: 'stuk',
  // bosje — bunch
  bos: 'bosje',
  bosje: 'bosje',
  bosjes: 'bosje',
  // scheut — splash/glug
  scheut: 'scheut',
  scheutje: 'scheut',
  scheutjes: 'scheut',
});

/**
 * A trailing "." ("el.") is the one bit of punctuation worth stripping
 * before the table lookup — captions abbreviate units with a period often
 * enough that dropping it here beats adding a dotted duplicate of every key
 * above. Nothing else is stripped: a genuinely unrecognized unit should
 * still surface as `unrecognized`, not get quietly reshaped until it
 * happens to match something.
 */
function stripTrailingPeriod(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}

/**
 * See `IngredientUnit` in types.ts for the three-way split this returns and
 * why `unrecognized` exists as its own case rather than collapsing into
 * `none`.
 */
export function normalizeIngredientUnit(rawUnit: string | null): IngredientUnit {
  if (rawUnit === null) {
    return { kind: 'none' };
  }
  const normalized = stripTrailingPeriod(normalizeTag(rawUnit));
  if (normalized.length === 0) {
    return { kind: 'none' };
  }
  const canonical = UNIT_ALIASES[normalized];
  if (canonical !== undefined) {
    return { kind: 'known', canonical };
  }
  return { kind: 'unrecognized', raw: normalized };
}

// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------

/**
 * Everything from the first comma onward is treated as a preparation note,
 * not part of the ingredient's identity — "ui, fijngesneden" and "ui, in
 * ringen" must both normalize to "ui" so they can be summed together. Only
 * the FIRST comma matters: a name with a second comma ("ui, fijngesneden,
 * apart gehouden") still just drops everything after the first one, since
 * the ingredient's identity was already settled by then.
 */
function stripPreparationNote(rawName: string): string {
  const firstCommaIndex = rawName.indexOf(',');
  return firstCommaIndex === -1 ? rawName : rawName.slice(0, firstCommaIndex);
}

/**
 * Builds on `normalizeTag` (lowercase, trim, NFD diacritic strip) rather
 * than reimplementing it — see this file's header. The two things an
 * ingredient name needs beyond a tag: the prep-note strip above, and
 * collapsing runs of internal whitespace left behind by that strip (e.g. a
 * name like "ui  , fijngesneden" leaves a trailing double space once the
 * note is gone).
 */
export function normalizeIngredientName(rawName: string): string {
  const withoutNote = stripPreparationNote(rawName);
  return normalizeTag(withoutNote).replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Quantity
// ---------------------------------------------------------------------------

/**
 * Unicode "vulgar fraction" characters a caption might use directly ("½
 * ui") instead of spelling out "1/2". Values are exact enough for a
 * shopping list (this is not a precision-critical domain) without pulling
 * in a fractions library for a handful of glyphs.
 */
const VULGAR_FRACTIONS: Readonly<Record<string, number>> = Object.freeze({
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
});

// Matches an optional leading whole number followed by one vulgar-fraction
// glyph: "½", "1½", "1 ½". The character class is built FROM
// `VULGAR_FRACTIONS`'s own keys (see below) so the regex can never drift out
// of sync with the table it looks values up in.
const VULGAR_FRACTION_CHARS = Object.keys(VULGAR_FRACTIONS).join('');
const MIXED_VULGAR_FRACTION_PATTERN = new RegExp(`^(\\d+)?\\s*([${VULGAR_FRACTION_CHARS}])$`);

// "1 1/2" or "1-1/2" — a whole number plus an ASCII fraction.
const MIXED_ASCII_FRACTION_PATTERN = /^(\d+)[\s-]+(\d+)\/(\d+)$/;
// "1/2" on its own.
const ASCII_FRACTION_PATTERN = /^(\d+)\/(\d+)$/;
// "2", "2.5", "1,5" (Dutch decimal comma) — but NOT "2." or ",5", which are
// ambiguous fragments rather than a stated quantity.
const DECIMAL_NUMBER_PATTERN = /^\d+([.,]\d+)?$/;

/** `null` on a zero denominator ("1/0") rather than `Infinity` — that is not a quantity, and this module never invents one. */
function evaluateFraction(whole: number, numerator: number, denominator: number): number | null {
  if (denominator === 0) {
    return null;
  }
  return whole + numerator / denominator;
}

/**
 * Tries every numeric shape this module understands, in order, and returns
 * the first match. Returns `null` — never `NaN`, never a guess — when the
 * text isn't a number in any of these shapes; the caller (`parseIngredientQuantity`)
 * is what turns that `null` into an honest `unparsed` label.
 */
function tryParseNumericQuantity(text: string): number | null {
  const mixedVulgar = MIXED_VULGAR_FRACTION_PATTERN.exec(text);
  if (mixedVulgar !== null) {
    const fractionChar = mixedVulgar[2];
    if (fractionChar === undefined) {
      return null;
    }
    const fraction = VULGAR_FRACTIONS[fractionChar];
    if (fraction === undefined) {
      return null;
    }
    const wholePart = mixedVulgar[1] === undefined ? 0 : Number.parseInt(mixedVulgar[1], 10);
    return wholePart + fraction;
  }

  const mixedAscii = MIXED_ASCII_FRACTION_PATTERN.exec(text);
  if (mixedAscii !== null) {
    const [, wholeText, numeratorText, denominatorText] = mixedAscii;
    if (wholeText === undefined || numeratorText === undefined || denominatorText === undefined) {
      return null;
    }
    return evaluateFraction(
      Number.parseInt(wholeText, 10),
      Number.parseInt(numeratorText, 10),
      Number.parseInt(denominatorText, 10),
    );
  }

  const asciiFraction = ASCII_FRACTION_PATTERN.exec(text);
  if (asciiFraction !== null) {
    const [, numeratorText, denominatorText] = asciiFraction;
    if (numeratorText === undefined || denominatorText === undefined) {
      return null;
    }
    return evaluateFraction(0, Number.parseInt(numeratorText, 10), Number.parseInt(denominatorText, 10));
  }

  if (DECIMAL_NUMBER_PATTERN.test(text)) {
    return Number.parseFloat(text.replace(',', '.'));
  }

  return null;
}

/**
 * See `NormalizedQuantity` in types.ts for the three cases this returns.
 * `rawQuantity === null` (no amount stated in the source at all) maps to
 * `unspecified`; anything else is tried against `tryParseNumericQuantity`
 * and falls back to `unparsed` — carrying the trimmed-but-otherwise-verbatim
 * original text — when that returns `null`.
 */
export function parseIngredientQuantity(rawQuantity: string | null): NormalizedQuantity {
  if (rawQuantity === null) {
    return { kind: 'unspecified' };
  }
  const trimmed = rawQuantity.trim();
  if (trimmed.length === 0) {
    // An empty-string quantity should not occur per ParsedIngredient's
    // contract (it would be `null` instead), but treating it the same as
    // "no amount stated" rather than as an empty `unparsed` label is the
    // fail-safe reading if a caller's data is looser than the contract.
    return { kind: 'unspecified' };
  }
  const numericValue = tryParseNumericQuantity(trimmed);
  if (numericValue !== null) {
    return { kind: 'numeric', value: numericValue };
  }
  return { kind: 'unparsed', label: trimmed };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Normalizes one ingredient line. Returns `null` when the name normalizes to
 * an empty string (a blank or comma-only name carries no usable identity to
 * shop for) — the one case this module treats as unusable input rather than
 * a degraded-but-real ingredient, matching the "typed nulls, never
 * exceptions" convention. Everything else about a line — an unrecognized
 * unit, an unparsed quantity, no quantity at all — is still a REAL
 * ingredient and comes back as one, never as `null`.
 */
export function normalizeIngredient(raw: RawIngredientLine): NormalizedIngredient | null {
  const name = normalizeIngredientName(raw.name);
  if (name.length === 0) {
    return null;
  }
  return {
    name,
    unit: normalizeIngredientUnit(raw.unit),
    quantity: parseIngredientQuantity(raw.quantity),
  };
}

/**
 * RCP-01: portion scaling. A recipe carries `servings` (see `Meal.servings`
 * in types.ts) and, until now, nothing in this codebase ever read it. A
 * household's own settings already know how many people eat here — this
 * module is the pure arithmetic that turns "this recipe feeds 2" plus "this
 * household is 4" into a scaled ingredient list, without a screen ever
 * asking the household to type a number they already told Remy once.
 *
 * ---
 *
 * WHY THIS REUSES `parseIngredientQuantity` RATHER THAN PARSING AGAIN.
 * src/domain/shopping/normalizeIngredient.ts already turns a raw quantity
 * string into exactly the three-way distinction this module needs —
 * `numeric` / `unparsed` / `unspecified`, see `NormalizedQuantity` in
 * shopping/types.ts. Writing a second parser here would be pure risk: two
 * implementations of "is '1 1/2' a number" WILL drift, and the day they
 * disagree, a shopping list and a scaled recipe would show two different
 * quantities for the same ingredient line with no way for a user to know
 * which one is right. There is exactly one function in this codebase that
 * is allowed to decide whether a quantity string is a number, and it is not
 * in this file.
 *
 * WHY AN `unparsed` QUANTITY IS NEVER MULTIPLIED — THIS IS THE WHOLE POINT
 * OF THE TASK. "een scheut" (a splash) is not a number, and scaling it by
 * 2 does not produce "twee scheuten" — it produces a fabrication, a number
 * this codebase has no evidence for. src/domain/import/types.ts's
 * `ParsedIngredient.quantity` goes to real lengths to never invent an
 * amount that wasn't stated in the source; multiplying an unparsed label
 * because a ratio happened to be available would undo that promise one
 * layer downstream, in a place that looks like "just doing arithmetic."
 * So `scaleQuantity` below passes an `unparsed` (and an `unspecified`)
 * quantity through UNCHANGED, tagged as exactly what it is, so a caller can
 * never render it as though it were a scaled number. See `ScaledQuantity`.
 *
 * WHY `servings: null` PRODUCES A TYPED FAILURE INSTEAD OF A GUESSED
 * BASELINE. Some recipes (most obviously anything imported from a caption
 * that never states a serving count — see `ParsedRecipe.servings`'s own
 * doc comment) have no known serving count at all. Defaulting to "2" or
 * "4" would be inventing the one number this whole computation is built
 * on top of — every other ingredient's scaled amount would inherit an
 * error nobody could see. `scaleRecipe` refuses instead: see
 * `ScaleRecipeResult`'s `cannot_scale` variant.
 *
 * WHY SCALING TO THE SAME SERVING COUNT MUST BE EXACT. If `fromServings`
 * equals `toServings`, the ratio is exactly `1`, and this module never
 * multiplies by it — the source's numeric value is returned bit-for-bit
 * unchanged (see `scaleNumericQuantity` below). Rounding an unchanged
 * quantity "for readability" would mean asking to scale a recipe to its
 * own serving count silently rewrites its ingredient list, which is a
 * correctness bug even if the rewritten number looks nicer.
 *
 * WHY A SCALED NUMBER IS ROUNDED, AND HOW. Multiplying a parsed quantity
 * by a ratio routinely produces a floating-point tail like
 * `0.6666666666666666` (1 serving's worth of something, scaled from 3
 * servings to 2). That tail is not a more precise answer than "2/3" — it
 * is float noise nobody asked for, and showing it verbatim would look
 * like a bug even though the arithmetic is correct. Two things happen to
 * every non-identity scaled value:
 *   1. `value` is rounded to `DISPLAY_DECIMAL_PLACES` (hundredths) — finer
 *      than any home cook measures by, coarse enough to kill the noise.
 *   2. Separately, `findKitchenFraction` checks whether the EXACT scaled
 *      value lands close enough to a fraction a real measuring cup or
 *      spoon set actually marks (halves, thirds, quarters, eighths — see
 *      `KITCHEN_FRACTION_DENOMINATORS`) to be worth showing as one. When
 *      it does, `fraction` is populated alongside `value` so a caller can
 *      prefer "⅔" over "0.67"; when it doesn't, `fraction` is `null` and
 *      the rounded decimal is the whole story. The tolerance
 *      (`KITCHEN_FRACTION_TOLERANCE`) is deliberately tight: this only
 *      ever SNAPS a value that is already essentially that fraction (a
 *      float artifact of the multiplication), never rounds a genuinely
 *      different amount to the nearest tidy-looking one. `fraction` is
 *      pure enrichment on top of an already-honest `value` — never a
 *      replacement for it, so a caller that ignores `fraction` entirely
 *      still renders a correct, readable number.
 *
 * WHY THE ARITHMETIC IS GUARDED. `fromServings` or `toServings` at zero,
 * negative, or non-finite is corrupt input, not a real request, and
 * dividing by it would produce `Infinity`/`NaN`/negative quantities rather
 * than an honest failure. Separately, a ratio outside
 * `[1 / MAX_SCALE_RATIO, MAX_SCALE_RATIO]` (scaling more than 20x in
 * either direction) is treated as bad input rather than computed — a
 * household of 2 asking to scale to 100 servings is far more likely a
 * fat-fingered number than a genuine ask, and producing a recipe with
 * "60 kg ui" serves nobody. Both cases return a typed `cannot_scale`
 * reason (see `ScaleRecipeFailureReason`) rather than clamping the input
 * or throwing.
 *
 * WHY THE RETURN TYPE MAKES IT HARD TO RENDER A HALF-SCALED RECIPE BY
 * ACCIDENT. There is no single flag like `ok: boolean` a caller could
 * check once and then blindly read every ingredient's `value`. Each
 * ingredient's `quantity` is its own `ScaledQuantity` union — `numeric` is
 * the only variant with a `value` field at all, so a caller reading
 * `ingredient.quantity.value` without first narrowing on `kind` is a type
 * error, not a runtime fabrication. `unparsedCount` and `unspecifiedCount`
 * on the successful result are read-only tallies for a caller that wants
 * to show "3 ingredients couldn't be scaled automatically" — mirroring
 * `ShoppingListMeasure`'s `unparsedLabels` / `unspecifiedCount` split in
 * shopping/types.ts — but they are informational, never a substitute for
 * handling each ingredient by its own `kind`.
 *
 * PURE, deterministic, immutable: no I/O, no `Date.now()`, no randomness,
 * never throws. Every input array is read but never mutated; every
 * returned array/object is newly built.
 */

import { parseIngredientQuantity } from './shopping/normalizeIngredient';
import type { NormalizedQuantity, RawIngredientLine } from './shopping/types';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

/** Hundredths — see this file's header for why a scaled value is rounded here rather than shown with its full floating-point tail. */
const DISPLAY_DECIMAL_PLACES = 2;

/**
 * Denominators a standard kitchen measuring cup/spoon set actually marks:
 * halves, thirds, quarters, eighths. Deliberately NOT every denominator up
 * to some bound — a "5ths" or "7ths" reading is not something anyone could
 * measure out even if the arithmetic landed there, so offering one would be
 * spurious precision dressed up as a friendly fraction. Checked smallest
 * first so the simplest true fraction wins (a value that matches both
 * `1/2` and `2/4` is reported as `1/2`).
 */
const KITCHEN_FRACTION_DENOMINATORS: readonly number[] = [2, 3, 4, 8];

/**
 * How close an exact scaled value must land to a kitchen fraction before
 * that fraction is offered. Deliberately small — 1/50 of a unit — so this
 * only ever snaps a value that IS essentially that fraction (float noise
 * from the multiplication), never rounds a genuinely different amount to
 * the nearest tidy-looking one. A fraction offered outside this tolerance
 * would be exactly the kind of invented number this domain layer exists to
 * avoid.
 */
const KITCHEN_FRACTION_TOLERANCE = 0.02;

/**
 * A requested scale beyond this factor, in either direction, is rejected as
 * `ratio_out_of_range` rather than computed — see this file's header.
 */
const MAX_SCALE_RATIO = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A kitchen-friendly fraction for the leftover part of a scaled value —
 * e.g. `1.5` becomes `{ whole: 1, numerator: 1, denominator: 2 }`. Always
 * already reduced to its simplest form (see `findKitchenFraction`'s
 * smallest-denominator-first search) and always `0 < numerator <
 * denominator`; a value with no meaningful fractional remainder (already a
 * whole number, or one that doesn't land near a kitchen fraction) has no
 * `ScaledFraction` at all — see `ScaledQuantity`'s `numeric` variant, whose
 * `fraction` field is `ScaledFraction | null`, never a fraction of `0/1`.
 */
export interface ScaledFraction {
  readonly whole: number;
  readonly numerator: number;
  readonly denominator: number;
}

/**
 * The result of scaling one ingredient's quantity. THREE cases, mirroring
 * `NormalizedQuantity` in shopping/types.ts on purpose — this is the same
 * three-way distinction the source quantity already carried, so a
 * `numeric` source becomes a scaled `numeric` result, and an `unparsed` or
 * `unspecified` source stays exactly that, untouched by the ratio. See
 * this file's header for why `unparsed` in particular must never be
 * multiplied.
 *
 * `numeric` carries BOTH a rounded decimal (`value`, always safe to
 * render on its own) AND an optional kitchen fraction (`fraction`, a
 * strictly nicer rendering of the same number when one honestly applies).
 * Neither is derived from the other at render time — both are computed
 * once, here, so a caller never re-implements the rounding or the
 * fraction-snapping rule.
 */
export type ScaledQuantity =
  | { readonly kind: 'numeric'; readonly value: number; readonly fraction: ScaledFraction | null }
  | { readonly kind: 'unparsed'; readonly label: string }
  | { readonly kind: 'unspecified' };

/**
 * One ingredient line after scaling. `name` and `unit` are carried through
 * completely unchanged — scaling only ever touches an amount, never what
 * the amount is measured in or what it's an amount of. This is
 * deliberately NOT run through `normalizeIngredientName` /
 * `normalizeIngredientUnit` (shopping/normalizeIngredient.ts): those exist
 * to build a de-duplication key for a shopping list, which is a lossy
 * transform (lowercased, prep notes stripped) that is wrong for a
 * recipe's own display — "Ui, fijngesneden" should still read as "Ui,
 * fijngesneden" in the scaled recipe, not as the shopping list's "ui".
 */
export interface ScaledIngredient {
  readonly name: string;
  readonly unit: string | null;
  readonly quantity: ScaledQuantity;
}

/**
 * Why `scaleRecipe` refused to scale at all. See this file's header for the
 * reasoning behind each case; kept as distinct members (rather than one
 * generic "invalid" case) because they call for different UI responses —
 * `no_baseline_servings` means "we don't know what this recipe already
 * serves, ask the household to state it"; the other two mean "the numbers
 * given don't make sense," which is a different, much rarer conversation.
 */
export type ScaleRecipeFailureReason =
  /** `fromServings` was `null` — the recipe states no baseline serving count, so there is nothing to scale from. Never defaulted to a guess. */
  | 'no_baseline_servings'
  /** `fromServings` or `toServings` was zero, negative, or not a finite number — corrupt input, not a real request. */
  | 'invalid_servings'
  /** The requested ratio exceeds `MAX_SCALE_RATIO` in either direction. */
  | 'ratio_out_of_range';

/**
 * A discriminated union, not a nullable ingredient list — matching
 * `DecisionResult` and `ImportResult` elsewhere in this domain layer. A
 * caller must handle `cannot_scale` as a real, typed outcome rather than
 * receiving an empty or unscaled list it might render without noticing
 * anything went wrong.
 */
export type ScaleRecipeResult =
  | {
      readonly kind: 'scaled';
      readonly fromServings: number;
      readonly toServings: number;
      readonly ingredients: readonly ScaledIngredient[];
      /** Count of ingredients whose stated quantity was text this codebase can't parse as a number (e.g. "een scheut") and therefore could not be scaled. See this file's header. */
      readonly unparsedCount: number;
      /** Count of ingredients that stated no quantity at all — distinct from `unparsedCount` for the same reason `NormalizedQuantity` keeps `unparsed` and `unspecified` apart: "we don't know" and "we know it's not a number" are different facts. */
      readonly unspecifiedCount: number;
    }
  | {
      readonly kind: 'cannot_scale';
      readonly reason: ScaleRecipeFailureReason;
    };

// ---------------------------------------------------------------------------
// Rounding / fraction detection
// ---------------------------------------------------------------------------

function roundToDecimalPlaces(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/**
 * Looks for a kitchen fraction that the EXACT (unrounded) scaled value is
 * already essentially equal to — see `KITCHEN_FRACTION_TOLERANCE` above for
 * why this only ever snaps, never rounds-to-nearest. Returns `null` for a
 * value with no meaningful remainder (already whole, within tolerance of
 * the next whole number, or simply not close to any denominator this
 * module recognizes) — `null` here means "just show the rounded decimal,"
 * not "this value has no fraction," so callers must treat it as a genuine
 * absence rather than an error.
 *
 * Assumes `exactValue >= 0`, which both call sites guarantee: a source
 * quantity's numeric value is never negative (see `tryParseNumericQuantity`
 * in normalizeIngredient.ts, which has no sign handling at all — nothing
 * this codebase parses can produce a negative amount), and `ratio` is
 * always positive by the time `scaleRecipe` reaches this code (both
 * servings counts are validated positive first). A defensive negative-input
 * branch would therefore be dead code no test could honestly exercise —
 * see this file's "never a substitute for handling each ingredient" stance
 * on not building unreachable guards.
 */
function findKitchenFraction(exactValue: number): ScaledFraction | null {
  const whole = Math.floor(exactValue);
  const remainder = exactValue - whole;
  if (remainder < KITCHEN_FRACTION_TOLERANCE || remainder > 1 - KITCHEN_FRACTION_TOLERANCE) {
    // Essentially a whole number already (or essentially the next one) —
    // no fraction is honest to offer.
    return null;
  }
  for (const denominator of KITCHEN_FRACTION_DENOMINATORS) {
    const numerator = Math.round(remainder * denominator);
    if (numerator <= 0 || numerator >= denominator) {
      // Rounds to a whole number of this denominator's units — not a
      // fraction strictly between 0 and 1, so this denominator doesn't
      // apply; a smaller/larger one might still match.
      continue;
    }
    const candidateValue = numerator / denominator;
    if (Math.abs(candidateValue - remainder) <= KITCHEN_FRACTION_TOLERANCE) {
      return { whole, numerator, denominator };
    }
  }
  return null;
}

/**
 * Scales one numeric quantity by `ratio`. `ratio === 1` (scaling to the
 * same serving count) is special-cased to hand back `sourceValue`
 * completely untouched — see this file's header for why that identity
 * must be exact, not merely close after rounding.
 */
function scaleNumericQuantity(
  sourceValue: number,
  ratio: number,
): { readonly value: number; readonly fraction: ScaledFraction | null } {
  if (ratio === 1) {
    return { value: sourceValue, fraction: findKitchenFraction(sourceValue) };
  }
  const exactScaled = sourceValue * ratio;
  return {
    value: roundToDecimalPlaces(exactScaled, DISPLAY_DECIMAL_PLACES),
    fraction: findKitchenFraction(exactScaled),
  };
}

function scaleQuantity(source: NormalizedQuantity, ratio: number): ScaledQuantity {
  if (source.kind === 'unparsed') {
    return { kind: 'unparsed', label: source.label };
  }
  if (source.kind === 'unspecified') {
    return { kind: 'unspecified' };
  }
  const { value, fraction } = scaleNumericQuantity(source.value, ratio);
  return { kind: 'numeric', value, fraction };
}

// ---------------------------------------------------------------------------
// Servings validation
// ---------------------------------------------------------------------------

function isUsableServingsCount(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Scales a recipe's ingredients from `fromServings` to `toServings`. See
 * this file's header for the full reasoning; in short:
 *
 * - `fromServings === null` (recipe states no baseline) -> `cannot_scale`,
 *   `reason: 'no_baseline_servings'`. Never defaulted.
 * - Either serving count zero, negative, or non-finite -> `cannot_scale`,
 *   `reason: 'invalid_servings'`.
 * - A ratio beyond `MAX_SCALE_RATIO` in either direction -> `cannot_scale`,
 *   `reason: 'ratio_out_of_range'`.
 * - Otherwise, every ingredient is scaled independently: a `numeric`
 *   quantity is multiplied and rounded; an `unparsed` or `unspecified`
 *   quantity is carried through untouched (never multiplied, never
 *   dropped) — see `scaleQuantity`.
 */
export function scaleRecipe(
  ingredients: readonly RawIngredientLine[],
  fromServings: number | null,
  toServings: number,
): ScaleRecipeResult {
  if (fromServings === null) {
    return { kind: 'cannot_scale', reason: 'no_baseline_servings' };
  }
  if (!isUsableServingsCount(fromServings) || !isUsableServingsCount(toServings)) {
    return { kind: 'cannot_scale', reason: 'invalid_servings' };
  }

  const ratio = toServings / fromServings;
  if (ratio > MAX_SCALE_RATIO || ratio < 1 / MAX_SCALE_RATIO) {
    return { kind: 'cannot_scale', reason: 'ratio_out_of_range' };
  }

  let unparsedCount = 0;
  let unspecifiedCount = 0;
  const scaledIngredients = ingredients.map((ingredient): ScaledIngredient => {
    const quantity = scaleQuantity(parseIngredientQuantity(ingredient.quantity), ratio);
    if (quantity.kind === 'unparsed') {
      unparsedCount += 1;
    } else if (quantity.kind === 'unspecified') {
      unspecifiedCount += 1;
    }
    return { name: ingredient.name, unit: ingredient.unit, quantity };
  });

  return {
    kind: 'scaled',
    fromServings,
    toServings,
    ingredients: scaledIngredients,
    unparsedCount,
    unspecifiedCount,
  };
}

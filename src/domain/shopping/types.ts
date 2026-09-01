/**
 * Shopping-list domain types (BSK-01 / BSK-02).
 *
 * The competitive frame: SlimMandje turns a recipe into a priced supermarket
 * basket. Whether Remy ever talks to a supermarket API is a product/legal
 * decision that is explicitly NOT made here — see the module headers in
 * src/domain/import/types.ts for how seriously this codebase takes "we
 * decided not to build X yet" as a real, typed boundary rather than an
 * unstated gap. What IS in scope, and is the whole of this file and its two
 * siblings (normalizeIngredient.ts, buildShoppingList.ts), is the layer
 * underneath a basket: turn a week's worth of recipe ingredient lines into
 * one clean, de-duplicated list. That is most of the user value (no more
 * counting how many recipes call for garlic) with none of the maintenance
 * burden of scraping a supermarket's catalogue and prices.
 *
 * Everything here is a type — no logic, no I/O, matching src/domain/types.ts's
 * own convention. `readonly` throughout; nothing in this module family ever
 * mutates an input or a previously-returned value.
 */

// ---------------------------------------------------------------------------
// Ingredient input
// ---------------------------------------------------------------------------

/**
 * The minimal shape this whole module family needs from one recipe
 * ingredient line: a free-text name, plus a quantity/unit pair that were
 * copied verbatim from wherever the recipe came from and may be null.
 *
 * Deliberately NOT `import type { ParsedIngredient } from '../import/types'`
 * and NOT `import type { MealIngredient } from '../types'`, even though both
 * already have exactly this shape. Importing either would make this module
 * depend on a file owned by a different agent (import/types.ts) or couple a
 * pure, standalone domain layer to the full `Meal`/`MealIngredient` contract
 * for three fields it actually uses. Structural typing means both of those
 * real shapes already satisfy `RawIngredientLine` with zero adapter code —
 * a caller holding a `ParsedIngredient[]` or a `MealIngredient[]` can pass
 * either straight through. If the shapes ever diverge, this interface is the
 * one place that has to notice.
 */
export interface RawIngredientLine {
  readonly name: string;
  /** Copied verbatim from the source ("2", "1/2", "een scheut"); null when no amount was stated. Never invented — see normalizeIngredient.ts. */
  readonly quantity: string | null;
  /** Whatever unit word the source used ("el", "gram", "blikjes"), or null. */
  readonly unit: string | null;
}

// ---------------------------------------------------------------------------
// Canonical units
// ---------------------------------------------------------------------------

/**
 * The closed set of Dutch measurement units this codebase normalizes to.
 * Deliberately small and deliberately NOT extended with every unit a recipe
 * might ever use (cups, ounces, "handje") — see normalizeIngredient.ts's
 * `UNIT_ALIASES` header for what happens to a unit outside this set: it is
 * preserved, not dropped, just not folded into this closed vocabulary.
 */
export type CanonicalUnit =
  | 'el' // eetlepel(s) — tablespoon
  | 'tl' // theelepel(s) — teaspoon
  | 'g' // gram
  | 'kg' // kilogram
  | 'ml' // milliliter
  | 'l' // liter
  | 'snufje' // pinch
  | 'teen' // clove (garlic)
  | 'blikje' // tin/can
  | 'stuk' // piece/item
  | 'bosje' // bunch
  | 'scheut'; // splash/glug

/**
 * A unit, normalized. THREE cases, not two — this is the difference between
 * "no unit stated" (`none`, e.g. "2 ui") and "a unit was stated but it isn't
 * one this codebase's closed vocabulary recognizes" (`unrecognized`, e.g. an
 * import that produced "cup" or a typo). Collapsing `unrecognized` into
 * `none` would be silently wrong in two directions at once: it would treat
 * "2 cup bloem" as unitless (losing real information a shopper needs), and
 * it would make two DIFFERENT unrecognized units compare equal to each other
 * and to a genuinely unitless line, merging quantities that must not be
 * merged (see buildShoppingList.ts's whole reason for existing). Keeping the
 * raw text for `unrecognized` means nothing is ever thrown away — it is not
 * yet canonical, but it is preserved verbatim, same spirit as
 * `ParsedIngredient.quantity` never being invented.
 */
export type IngredientUnit =
  | { readonly kind: 'known'; readonly canonical: CanonicalUnit }
  | { readonly kind: 'unrecognized'; readonly raw: string }
  | { readonly kind: 'none' };

// ---------------------------------------------------------------------------
// Quantity
// ---------------------------------------------------------------------------

/**
 * A quantity, normalized. THREE cases, not a nullable number — mirrors
 * `IngredientUnit` above for the same reason: collapsing any two of these
 * into one state loses a real distinction a shopper cares about.
 *
 * - `numeric`: the source string was genuinely a number (integer, decimal
 *   with a Dutch comma, or a fraction) and can be summed with another
 *   `numeric` entry of the same ingredient/unit.
 * - `unparsed`: the source stated an amount, but it wasn't a number this
 *   codebase can parse ("een scheut", "naar smaak"). The ORIGINAL TEXT is
 *   kept, never coerced to a number (not even to `1`) — see
 *   src/domain/import/types.ts's `ParsedIngredient.quantity` doc comment for
 *   why this codebase treats "inventing a number nobody stated" as a
 *   correctness bug, not a convenience.
 * - `unspecified`: the source stated no amount at all (`quantity: null`).
 *   Distinct from `unparsed` on purpose — "we don't know" and "we know it's
 *   not a number" are different facts, and a shopping-list UI may one day
 *   want to say "amount unclear" for the latter and nothing at all for the
 *   former.
 */
export type NormalizedQuantity =
  | { readonly kind: 'numeric'; readonly value: number }
  | { readonly kind: 'unparsed'; readonly label: string }
  | { readonly kind: 'unspecified' };

// ---------------------------------------------------------------------------
// Normalized ingredient — output of normalizeIngredient.ts
// ---------------------------------------------------------------------------

export interface NormalizedIngredient {
  /** Lowercased, trimmed, diacritics stripped, prep notes after a comma dropped, whitespace collapsed. See normalizeIngredient.ts. */
  readonly name: string;
  readonly unit: IngredientUnit;
  readonly quantity: NormalizedQuantity;
}

// ---------------------------------------------------------------------------
// Shopping list — output of buildShoppingList.ts
// ---------------------------------------------------------------------------

/**
 * One meal's worth of ingredient lines, as buildShoppingList.ts needs them.
 * Not the full `Meal` type from src/domain/types.ts — this module has no use
 * for a meal's title, skill level, or any of its other ~15 fields, and
 * requiring them would force every caller (and every test) to construct a
 * complete `Meal` just to hand over a shopping list. A caller with real
 * `Meal`/`MealIngredient` rows narrows to `{ ingredients }` in one line.
 */
export interface ShoppingListMealInput {
  readonly ingredients: readonly RawIngredientLine[];
}

/**
 * One (ingredient, unit) bucket's aggregated amount within a
 * `ShoppingListItem`. See buildShoppingList.ts's header for why `unit` sits
 * on the measure rather than the item, and why there is no single
 * `total: number` field anywhere in this file.
 */
export interface ShoppingListMeasure {
  readonly unit: IngredientUnit;
  /**
   * Sum of every genuinely `numeric` quantity in this bucket. `null` when
   * the bucket contains no numeric entry at all (e.g. only `unparsed` or
   * `unspecified` lines) — NOT the same as `0`, which would claim "we need
   * zero of this," a fact nobody stated.
   */
  readonly numericTotal: number | null;
  /**
   * Verbatim text of every `unparsed` quantity in this bucket ("een
   * scheut"), in the order they were encountered. NEVER folded into
   * `numericTotal` — that is the entire point of keeping this field
   * separate; see buildShoppingList.ts.
   */
  readonly unparsedLabels: readonly string[];
  /** How many lines in this bucket stated no quantity at all. */
  readonly unspecifiedCount: number;
}

/**
 * One ingredient's entry in the finished shopping list, carrying one or more
 * `measures` — more than one exactly when the same ingredient was measured
 * in incompatible units across the week's recipes (e.g. "tomaat" in both
 * grams and pieces). `measures` is never empty.
 */
export interface ShoppingListItem {
  readonly name: string;
  readonly measures: readonly ShoppingListMeasure[];
}

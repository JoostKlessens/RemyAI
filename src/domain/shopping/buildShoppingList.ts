/**
 * BSK-01: fold a week's worth of meals' ingredient lines into one
 * de-duplicated shopping list.
 *
 * ---
 *
 * WHY INCOMPATIBLE UNITS BECOME MULTIPLE MEASURES ON ONE ITEM, NOT A SILENT
 * SUM AND NOT TWO SEPARATE TOP-LEVEL ITEMS.
 *
 * "200 g tomaat" and "2 stuks tomaat" describe the same ingredient measured
 * two different ways. Summing them (202 "tomaat") would be a fabricated
 * number with no unit and no meaning — exactly the kind of invented fact
 * this domain layer exists to avoid (see normalizeIngredient.ts's header).
 * Splitting them into two unrelated top-level list entries ("tomaat" and a
 * second, differently-keyed "tomaat") would hide from the shopper that
 * these are the same ingredient — she'd see it twice in an alphabetized
 * list with no indication they're related, and could easily buy grams
 * AND pieces without realizing one might have covered the other.
 *
 * So one `ShoppingListItem` per ingredient name, carrying a `measures`
 * array — one `ShoppingListMeasure` per distinct unit bucket. "tomaat"
 * becomes one line the shopper reads once, showing both "200 g" and
 * "2 stuks" as two honest, unmerged amounts, rather than one wrong number
 * or two disconnected lines.
 *
 * WHAT MAKES A WRONG TOTAL IMPOSSIBLE TO READ BY ACCIDENT: there is no
 * `total: number` field anywhere on `ShoppingListItem` or on the list as a
 * whole — see types.ts. A caller CANNOT sum across a multi-measure item by
 * reaching for "the" total, because no such field exists to reach for; the
 * type forces iterating `measures` and handling each unit explicitly. The
 * unsafe shortcut was never built, rather than built and merely
 * discouraged in a comment.
 *
 * ---
 *
 * WHY NO UNIT CONVERSION HAPPENS HERE (NO g -> kg, NO ml -> l). A
 * shopping list is read standing in a supermarket aisle, not in a lab: "3
 * el" is what a shopper can act on, "45 ml" is a translation she'd have to
 * translate back. Converting also means picking a rounding rule (nearest
 * gram? nearest 10? nearest package size?) for a value nobody asked to
 * have rounded, and the failure mode of "we rounded your total" is worse
 * than "we didn't convert your total" for a domain where correctness (see
 * normalizeIngredient.ts) is the entire point of this rewrite over ad hoc
 * scribbled lists.
 *
 * ---
 *
 * WHY AN `unparsed` QUANTITY ("een scheut olijfolie") DOES NOT CORRUPT A
 * NUMERIC TOTAL FOR THE SAME BUCKET. `ShoppingListMeasure.numericTotal` is
 * the sum of ONLY the `numeric`-kind quantities that landed in its bucket;
 * `unparsedLabels` is a separate array the unparsed ones are appended to,
 * never coerced into a number and never mixed into the sum. Two recipes
 * calling for "3 el olijfolie" and "een scheut olijfolie" produce
 * `numericTotal: 3` and `unparsedLabels: ['een scheut']` on the SAME
 * measure (same name, same unit-shaped bucket, in this case both keyed
 * `known:el` if the "scheut" line happened to carry unit "el", or on two
 * separate measures if it didn't) — never `numericTotal: 4` and never a
 * dropped "een scheut".
 *
 * ---
 *
 * PURE, deterministic, immutable: no I/O, no `Date.now()`, no randomness,
 * never throws, and every input array/object is read but never mutated —
 * every returned array/object is newly built. `buildShoppingList` sorts its
 * output explicitly (see `compareStrings`/`compareMeasures` below) rather
 * than relying on `Map`/object insertion order, so the same set of meals
 * (in any input order) always produces byte-identical output order.
 */

import type { IngredientUnit, NormalizedQuantity, ShoppingListItem, ShoppingListMealInput, ShoppingListMeasure } from './types';
import { normalizeIngredient } from './normalizeIngredient';

/**
 * A stable, collision-free string key for grouping by unit. ` `-joined
 * with the ingredient name below (never a plain `+`/`-` join) because a
 * separator that could itself appear inside a name or a raw unit string
 * would let two genuinely different (name, unit) pairs collide into one
 * bucket — e.g. name "a" + unit "b-c" colliding with name "a-b" + unit "c"
 * under a `-`-joined key. ` ` cannot appear in either, since both are
 * already whitespace-collapsed and single-word-per-token by the time they
 * reach here (see normalizeIngredient.ts).
 */
function unitKey(unit: IngredientUnit): string {
  if (unit.kind === 'known') {
    return `known:${unit.canonical}`;
  }
  if (unit.kind === 'unrecognized') {
    return `unrecognized:${unit.raw}`;
  }
  return 'none';
}

function bucketKey(name: string, unit: IngredientUnit): string {
  return `${name} ${unitKey(unit)}`;
}

/**
 * The accumulator for one (name, unit) bucket while folding over every
 * ingredient line. Immutable by construction — `mergeQuantity` below always
 * returns a NEW bucket rather than mutating the one it was given, matching
 * this codebase's "no mutation of inputs" convention even for an internal,
 * never-exposed accumulator, so the merge logic reads the same way the rest
 * of this domain layer does.
 */
interface QuantityBucket {
  readonly name: string;
  readonly unit: IngredientUnit;
  readonly numericTotal: number | null;
  readonly unparsedLabels: readonly string[];
  readonly unspecifiedCount: number;
}

function emptyBucket(name: string, unit: IngredientUnit): QuantityBucket {
  return { name, unit, numericTotal: null, unparsedLabels: [], unspecifiedCount: 0 };
}

/** Folds one more ingredient line's quantity into a bucket — see the three `NormalizedQuantity` cases in types.ts. */
function mergeQuantity(bucket: QuantityBucket, quantity: NormalizedQuantity): QuantityBucket {
  if (quantity.kind === 'numeric') {
    return { ...bucket, numericTotal: (bucket.numericTotal ?? 0) + quantity.value };
  }
  if (quantity.kind === 'unparsed') {
    return { ...bucket, unparsedLabels: [...bucket.unparsedLabels, quantity.label] };
  }
  return { ...bucket, unspecifiedCount: bucket.unspecifiedCount + 1 };
}

/** Codepoint comparison only — deliberately NOT `String.prototype.localeCompare`, whose result can depend on the runtime's available locale/ICU data and would make "deterministic output ordering" a promise this function couldn't actually keep across environments. */
function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/** `none` sorts first, `known` second, `unrecognized` last — an arbitrary but FIXED order, which is all "deterministic" requires. */
function unitSortRank(unit: IngredientUnit): 0 | 1 | 2 {
  if (unit.kind === 'none') {
    return 0;
  }
  if (unit.kind === 'known') {
    return 1;
  }
  return 2;
}

function compareMeasures(a: ShoppingListMeasure, b: ShoppingListMeasure): number {
  const rankDiff = unitSortRank(a.unit) - unitSortRank(b.unit);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  if (a.unit.kind === 'known' && b.unit.kind === 'known') {
    return compareStrings(a.unit.canonical, b.unit.canonical);
  }
  if (a.unit.kind === 'unrecognized' && b.unit.kind === 'unrecognized') {
    return compareStrings(a.unit.raw, b.unit.raw);
  }
  return 0;
}

function toMeasure(bucket: QuantityBucket): ShoppingListMeasure {
  return {
    unit: bucket.unit,
    numericTotal: bucket.numericTotal,
    unparsedLabels: bucket.unparsedLabels,
    unspecifiedCount: bucket.unspecifiedCount,
  };
}

/**
 * Combines every ingredient line across every given meal into a
 * deterministically-ordered, de-duplicated shopping list. See this file's
 * header for the design rationale behind multi-measure items, the absence
 * of unit conversion, and how an unparsed quantity is kept from corrupting
 * a numeric total.
 *
 * A line that fails to normalize (see `normalizeIngredient` — an empty or
 * comma-only name) is silently dropped from the list rather than
 * represented as a broken entry; there is nothing a shopper could act on
 * for an ingredient with no name.
 */
export function buildShoppingList(meals: readonly ShoppingListMealInput[]): readonly ShoppingListItem[] {
  const buckets = new Map<string, QuantityBucket>();

  for (const meal of meals) {
    for (const rawLine of meal.ingredients) {
      const normalized = normalizeIngredient(rawLine);
      if (normalized === null) {
        continue;
      }
      const key = bucketKey(normalized.name, normalized.unit);
      const existing = buckets.get(key) ?? emptyBucket(normalized.name, normalized.unit);
      buckets.set(key, mergeQuantity(existing, normalized.quantity));
    }
  }

  const measuresByName = new Map<string, ShoppingListMeasure[]>();
  for (const bucket of buckets.values()) {
    const measures = measuresByName.get(bucket.name) ?? [];
    measuresByName.set(bucket.name, [...measures, toMeasure(bucket)]);
  }

  const items: ShoppingListItem[] = [...measuresByName.entries()].map(([name, measures]) => ({
    name,
    measures: [...measures].sort(compareMeasures),
  }));

  return items.sort((a, b) => compareStrings(a.name, b.name));
}

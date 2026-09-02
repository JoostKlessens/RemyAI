/**
 * Dutch copy for the shopping-list screen (BSK-01 UI), sitting entirely on
 * top of the already-built, already-tested domain layer in
 * src/domain/shopping/**. This module owns every sentence that branches on
 * data — never src/app/boodschappen.tsx or ShoppingListRow.tsx directly,
 * matching this repo's own convention (see importFailureCopy.ts,
 * librarySearchCopy.ts): vitest's `node` environment stubs react-native, so
 * a sentence written inside a `.tsx` component is a sentence nothing can
 * assert.
 *
 * THE HARD PART OF THIS SCREEN LIVES HERE, NOT IN THE SCREEN.
 * buildShoppingList (src/domain/shopping/buildShoppingList.ts) is
 * deliberately honest about what it does not know: one
 * `ShoppingListMeasure` can carry a `numericTotal`, a list of
 * `unparsedLabels`, an `unspecifiedCount`, any two of the three at once, or
 * — split across `ShoppingListItem.measures` — more than one incompatible
 * unit for the same ingredient. Every one of those combinations has to read
 * as a plain Dutch phrase a shopper can act on standing in an aisle, and
 * none of them may quietly invent a number, drop a caption's "een scheut"
 * on the floor, or imply two measures are one. `describeMeasureQuantity`
 * below is the one function that has to get every combination right; see
 * its own comment for the branch-by-branch reasoning. This module does the
 * text work so ShoppingListRow.tsx can stay pure layout, matching this
 * repo's "domain logic is pure and already done, the screen calls it and
 * renders" rule — text assembly is a rendering decision, not a unit
 * calculation, but it is exactly precise enough about which case it is in
 * that no caller could accidentally re-derive a total from it.
 *
 * TWO EMPTY STATES, NEVER COLLAPSED INTO ONE, for the same reason
 * recipes.tsx's first-run empty state and librarySearchCopy.ts's
 * zero-results state must stay apart: "nothing was ever planned this week"
 * and "everything planned this week is already in the cart" both look like
 * "no rows left to check off," and they are not the same fact. Telling a
 * shopper who just finished their trip "plan a meal to get started" would
 * be actively wrong, and telling a household that saved nothing "well
 * done, you got it all" is worse.
 */

import type { CanonicalUnit, IngredientUnit, ShoppingListItem, ShoppingListMeasure } from '@/domain/shopping/types';

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

/**
 * Dutch decimal comma, rounded to at most two decimals and trimmed of
 * trailing zeros. Rounding is deliberate, not a precision loss this module
 * apologizes for: `normalizeIngredient.ts`'s own header already states that
 * a vulgar-fraction quantity ("⅓ tl") is "exact enough for a shopping list,"
 * so a raw `0.3333333333333333` reaching this far is a floating-point
 * artifact of that arithmetic, not a fact worth reproducing digit for digit.
 */
function formatQuantityNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded).replace('.', ',');
  }
  const trimmed = rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return trimmed.replace('.', ',');
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

/**
 * Display words for the closed `CanonicalUnit` vocabulary
 * (src/domain/shopping/types.ts). A `Record<CanonicalUnit, ...>` rather than
 * a partial map or a switch, so a `CanonicalUnit` this codebase adds later
 * fails to COMPILE here rather than falling through to an undefined label —
 * the same guarantee `UNIT_ALIASES` in normalizeIngredient.ts gives itself
 * for the reverse direction. `el`/`tl`/`g`/`kg`/`ml`/`l` are already the
 * abbreviations a Dutch shopping list uses and do not pluralize; the six
 * spelled-out units do, and picking the right one needs the amount, which
 * is why this table is consulted through `describeKnownUnitLabel` below
 * rather than read directly.
 */
const UNIT_LABELS: Readonly<Record<CanonicalUnit, { readonly singular: string; readonly plural: string }>> =
  Object.freeze({
    el: { singular: 'el', plural: 'el' },
    tl: { singular: 'tl', plural: 'tl' },
    g: { singular: 'g', plural: 'g' },
    kg: { singular: 'kg', plural: 'kg' },
    ml: { singular: 'ml', plural: 'ml' },
    l: { singular: 'l', plural: 'l' },
    snufje: { singular: 'snufje', plural: 'snufjes' },
    teen: { singular: 'teentje', plural: 'teentjes' },
    blikje: { singular: 'blikje', plural: 'blikjes' },
    stuk: { singular: 'stuk', plural: 'stuks' },
    bosje: { singular: 'bosje', plural: 'bosjes' },
    scheut: { singular: 'scheut', plural: 'scheutjes' },
  });

function describeKnownUnitLabel(canonical: CanonicalUnit, amount: number): string {
  const labels = UNIT_LABELS[canonical];
  return amount === 1 ? labels.singular : labels.plural;
}

/**
 * One numeric amount, paired with whatever `IngredientUnit` it was measured
 * in. THREE cases, matching `IngredientUnit`'s own three-way split
 * (types.ts) — collapsing any two would either invent a unit nobody stated
 * or discard one somebody did:
 *
 * - `known`: the ordinary case, "200 g" / "3 stuks".
 * - `unrecognized`: the raw text is shown verbatim rather than translated or
 *   dropped — "2 cup" stays "2 cup" so a shopper still sees exactly what the
 *   recipe said, even though this codebase doesn't know what a "cup" is.
 * - `none`: no unit word was ever in the source ("2 ui"). Never invented as
 *   "stuks" — that would be a guess this module has no basis for — so it
 *   renders as the shopping-list shorthand "2x" instead, read naturally
 *   beside the ingredient's own name on the row.
 */
function describeUnitAmount(unit: IngredientUnit, amount: number): string {
  const formattedAmount = formatQuantityNumber(amount);
  switch (unit.kind) {
    case 'known':
      return `${formattedAmount} ${describeKnownUnitLabel(unit.canonical, amount)}`;
    case 'unrecognized':
      return `${formattedAmount} ${unit.raw}`;
    case 'none':
      return `${formattedAmount}x`;
    default: {
      const exhaustiveCheck: never = unit;
      throw new Error(`Unhandled IngredientUnit kind: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Measures — the branch-by-branch heart of this module
// ---------------------------------------------------------------------------

/** What this module says when a bucket carries no number and no free text at all — see `describeMeasureQuantity`'s last branch. */
const UNSPECIFIED_AMOUNT_LABEL = 'hoeveelheid niet genoemd';

/**
 * One `ShoppingListMeasure` (one ingredient, one unit bucket) rendered as a
 * single Dutch phrase. `ShoppingListMeasure` can independently carry a
 * `numericTotal`, `unparsedLabels`, and an `unspecifiedCount`
 * (buildShoppingList.ts's header explains why a numeric total and an
 * unparsed label from two different recipes coexist in one bucket rather
 * than corrupting each other), so this function has FOUR real cases, not
 * two:
 *
 * 1. Numeric only ("3 tomaat, 2 tomaat" -> "200 g") — the common case.
 * 2. Unparsed only ("een scheut olijfolie", nothing else stated for this
 *    unit bucket) — the verbatim text IS the amount; nothing here tries to
 *    coerce it into a number, which is `normalizeIngredient.ts`'s whole
 *    reason for keeping `unparsed` a separate case in the first place.
 * 3. BOTH numeric and unparsed ("3 el olijfolie" from one recipe, "een
 *    scheut olijfolie" from another, both landing in the `el` bucket) —
 *    joined with " + " so the number stays a real, addable number and the
 *    free text stays free text; never summed, never dropped.
 * 4. Neither — every line in this bucket stated no amount at all
 *    (`unspecified`). Rendered as an explicit, honest
 *    `UNSPECIFIED_AMOUNT_LABEL` rather than left blank: a name with nothing
 *    beside it reads as a rendering bug, not as "we don't know how much."
 */
export function describeMeasureQuantity(measure: ShoppingListMeasure): string {
  const numericPart = measure.numericTotal === null ? null : describeUnitAmount(measure.unit, measure.numericTotal);
  // " en " (Dutch "and"), not ", " — this join only fires when TWO DIFFERENT
  // recipes each left an unparsed quantity in the same unit bucket, and the
  // top-level item join (describeShoppingListItemQuantity) already uses ", "
  // to separate incompatible measures. Different separators at the two
  // levels keep a multi-measure, multi-unparsed row from reading as one
  // flat, ambiguous comma list.
  const unparsedPart = measure.unparsedLabels.length === 0 ? null : measure.unparsedLabels.join(' en ');

  if (numericPart !== null && unparsedPart !== null) {
    return `${numericPart} + ${unparsedPart}`;
  }
  if (numericPart !== null) {
    return numericPart;
  }
  if (unparsedPart !== null) {
    return unparsedPart;
  }
  return UNSPECIFIED_AMOUNT_LABEL;
}

/**
 * A full `ShoppingListItem`, across every one of its `measures`. More than
 * one measure means the same ingredient was measured in genuinely
 * incompatible units across the week's recipes (buildShoppingList.ts's
 * header: "tomaat" in both grams and pieces) — never summed into one
 * fabricated figure, always shown side by side: "200 g, 2 stuks". `measures`
 * arrives pre-sorted and deterministic (buildShoppingList's own
 * `compareMeasures`), so this join needs no ordering logic of its own.
 */
export function describeShoppingListItemQuantity(item: ShoppingListItem): string {
  return item.measures.map(describeMeasureQuantity).join(', ');
}

// ---------------------------------------------------------------------------
// Item name + row accessibility
// ---------------------------------------------------------------------------

/**
 * `ShoppingListItem.name` arrives fully lowercased (normalizeIngredient.ts
 * normalizes for comparison, not for display). Capitalizing the first
 * letter only — never title-casing every word — keeps a multi-word
 * ingredient like "rode ui" reading as the one phrase it is, rather than as
 * "Rode Ui".
 */
export function describeShoppingListItemName(name: string): string {
  if (name.length === 0) {
    return name;
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The row's spoken label. Deliberately does NOT restate checked/unchecked —
 * ShoppingListRow renders the row with `accessibilityRole="checkbox"` and a
 * live `accessibilityState.checked`, which is what makes a screen reader
 * announce the state; folding "afgevinkt" into the label text as well would
 * say it twice in two different voices. This function's only job is
 * "which ingredient, how much" — everything a shopper needs to decide
 * whether to tap.
 */
export function describeShoppingListRowAccessibilityLabel(item: ShoppingListItem): string {
  return `${describeShoppingListItemName(item.name)}, ${describeShoppingListItemQuantity(item)}`;
}

// ---------------------------------------------------------------------------
// Header subtitle
// ---------------------------------------------------------------------------

/** Singular/plural branch for the header's "based on N recipes" line. */
export function describeShoppingListMealCount(mealCount: number): string {
  if (mealCount === 1) {
    return 'Op basis van 1 recept dat deze week op het menu staat.';
  }
  return `Op basis van ${mealCount} recepten die deze week op het menu staan.`;
}

// ---------------------------------------------------------------------------
// Empty states — two, deliberately never merged; see this file's header.
// ---------------------------------------------------------------------------

export interface ShoppingListStateCopy {
  readonly title: string;
  readonly body: string;
}

const NOTHING_PLANNED_COPY: ShoppingListStateCopy = {
  title: 'Nog niets gepland voor deze week',
  // The same correction weekPlanCopy.ts's empty body carries, and for the
  // same reason: until the long-press sheet gained a "Deze week" row, this
  // sentence described a path that did not exist.
  body: 'Houd een recept in Mijn recepten ingedrukt en kies “Deze week”, dan verschijnt het hier als boodschappenlijst.',
};

/** No meal has an active "deze week" save yet — there is nothing to have bought, so there is nothing to check off. */
export function describeShoppingListNothingPlanned(): ShoppingListStateCopy {
  return NOTHING_PLANNED_COPY;
}

const ALL_CHECKED_TITLE = 'Alles binnen';

/**
 * Every item on a non-empty list is checked off. `itemCount` branches the
 * body between one item and several, matching this repo's singular/plural
 * convention elsewhere (see `describeShoppingListMealCount` above).
 * Deliberately still framed around what's on the list (never "goed gedaan"
 * praise-copy) — this screen reads a fact, it doesn't cheer.
 */
export function describeShoppingListAllChecked(itemCount: number): ShoppingListStateCopy {
  return {
    title: ALL_CHECKED_TITLE,
    body:
      itemCount === 1
        ? 'Het enige item op je lijst is afgevinkt.'
        : `Alle ${itemCount} items op je lijst zijn afgevinkt.`,
  };
}

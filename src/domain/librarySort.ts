/**
 * NO CALLER SINCE 2026-09-05, AND KEPT ANYWAY. The sort ROW was taken out
 * of `LibrarySearchBar` on that date at the owner's request ("sorteren kan
 * voor nu weg"), and with it went the `sort` state, the `sortLibraryRows`
 * memo, and the `cookEvents` state that existed on the screen only to feed
 * this module (src/app/(tabs)/recipes.tsx). Nothing in the app calls
 * anything below today.
 *
 * It stays for the same reason `SaveIntent`'s `'none'` variant stays in its
 * union while being unreachable from the UI (src/domain/types.ts, PD-004a):
 * the code is correct, independently tested (tests/librarySort.test.ts),
 * and the expensive part was never the sixty lines below — it was deciding
 * what "nog nooit gekookt" should MEAN, and why "deze week eerst" may not
 * survive an explicit sort. Deleting the file deletes that argument with
 * it, and the next person asked for library sorting would have to rederive
 * it from nothing, most likely differently. What the owner removed is a row
 * of chips on a screen he wants shorter; he did not overturn a decision
 * about ordering, and nothing here should pretend he did.
 *
 * Read the rest of this header as a design that is waiting, not as a
 * description of what the app currently does. Reinstating the row needs a
 * caller for `sortLibraryRows`, the `cookEvents` fetch back in the screen's
 * state, and — the part worth settling before writing any of it — a fresh
 * answer to whether a browse screen should offer ordering at all.
 */

/**
 * Pure sort resolver for "Mijn recepten" (src/app/(tabs)/recipes.tsx) —
 * LIB-04. Search and filter (LIB-01/LIB-03, recipeSearch.ts) answer "which
 * of these do I want to see"; this module answers a different question,
 * "in what order do I want to see them", and the two are kept apart rather
 * than folded into one `LibrarySearchState` for the same reason
 * recipeSearch.ts itself stays apart from `sortMealsByScheduling`
 * (components/recipeScheduling.ts): each is a single, independently
 * testable transform with its own state shape and its own lifecycle.
 * `LibrarySearchState` accumulates (a household can have a query AND tags
 * AND a time cap all at once); a sort is exclusive — the grid is ordered
 * one way at a time — so giving it its own single-value state keeps that
 * difference visible in the types rather than hidden inside one bag every
 * caller has to know only certain fields combine.
 *
 * A SIBLING MODULE, NOT AN EXTENSION OF recipeSearch.ts. That file's own
 * header scopes it explicitly to filtering ("This module is that reader,
 * plus the free-text title search"); folding reordering into it would mean
 * a file whose name and header both promise "narrows the pool" quietly
 * growing a second, unrelated job. Keeping them separate also keeps each
 * file short — recipeSearch.ts is already substantial on its own filtering
 * story.
 *
 * WHY "DEZE WEEK" FIRST DOES NOT SURVIVE AN EXPLICIT SORT, and this is the
 * deliberate, documented exception the task brief asked for.
 * `sortMealsByScheduling` orders `rows` "deze week" first BEFORE this module
 * ever sees them, and `filterLibraryRows` (recipeSearch.ts) preserves that
 * order because filtering only removes rows, never reorders survivors. A
 * sort is a different kind of operation on purpose: `DEFAULT_LIBRARY_SORT`
 * is a no-op that leaves the scheduling order exactly as it arrives, so a
 * household that never touches the sort control sees today's behaviour
 * unchanged. The moment a household explicitly reaches for
 * `recent_toegevoegd` or `nog_nooit_gekookt`, though, they are no longer
 * asking "what happens this week" — they are asking a different question
 * ("what did I just add", "what have I been sitting on") — and gluing
 * "deze week" to the top of THAT answer would defeat the reason they asked
 * for it. `recent_toegevoegd` needs to find a dish added an hour ago
 * wherever it landed in the scheduling groups; `nog_nooit_gekookt` needs to
 * cut across those groups by definition (see below). Both are therefore
 * full reorderings, opted into by name, never applied silently.
 *
 * `NOG_NOOIT_GEKOOKT` AND PD-004a. "Als ik iets in mijn lijst zet moet het
 * altijd een keer voorbij kunnen komen" — everything saved must eventually
 * be suggested, never quietly bookmarked forever (docs/PRODUCT-DECISIONS.md
 * PD-004a). A flat, unordered grid cannot enforce that on its own; this
 * sort is the closest thing a browse screen has to a corrective lens for
 * it — it puts every meal with no cook event EVER at the top, oldest
 * `createdAt` first, so the dish that has been sitting in the library
 * longest without ever being cooked is the very first tile a household
 * sees. That is "what is this household hoarding", stated as an ordering
 * rather than a metric. Already-cooked meals fall to the bottom, ordered by
 * title for a stable, scannable tail — nothing about "which of these have I
 * cooked" needs to distinguish itself further, this sort exists for the
 * other bucket.
 *
 * TAKES `cookEvents` DIRECTLY RATHER THAN A PRE-COMPUTED "never cooked"
 * FLAG, for the same domain/component boundary recipeSearch.ts's own header
 * argues at length: `RecipeSchedulingInfo`/`RecipeSchedulingState` are
 * defined in src/components/recipeScheduling.ts, not src/domain, so a
 * generic row bound wide enough to read `row.scheduling.state` would import
 * a components-layer type into src/domain — an edge that exists nowhere
 * else in this codebase. Recomputing "has this meal ever been cooked" from
 * raw `cookEvents` costs one small, independently-tested helper below and
 * keeps every comparison decision, including what counts as "never cooked",
 * inside this pure, unit-tested module rather than leaking into the screen.
 */

import type { CookEvent, Meal, MealId } from './types';

export type LibrarySortOption = 'default' | 'recent_toegevoegd' | 'nog_nooit_gekookt';

/** The no-sort identity — `sortLibraryRows(rows, DEFAULT_LIBRARY_SORT, cookEvents)` returns `rows` unchanged, same reference. */
export const DEFAULT_LIBRARY_SORT: LibrarySortOption = 'default';

/** Whether any cook event exists for this meal, ever — the one fact `nog_nooit_gekookt` sorts on. */
function hasEverBeenCooked(mealId: MealId, cookEvents: readonly CookEvent[]): boolean {
  return cookEvents.some((event) => event.mealId === mealId);
}

/** Most recently added first. Ties (same millisecond `createdAt`, seed data mostly) break on title for a deterministic order. */
function sortByRecentlyAdded<TRow extends { readonly meal: Meal }>(rows: readonly TRow[]): readonly TRow[] {
  return [...rows].sort((a, b) => {
    const createdDiff = b.meal.createdAt.localeCompare(a.meal.createdAt);
    return createdDiff !== 0 ? createdDiff : a.meal.title.localeCompare(b.meal.title, 'nl');
  });
}

/**
 * Never-cooked first (oldest `createdAt` first within that group — the
 * longest-hoarded surfaces first, see this file's header), already-cooked
 * after (by title). Two buckets, not a continuous scale: "how hoarded" is
 * answered by the ordering within the first bucket, "hoarded at all" is
 * answered by which bucket a row is in.
 */
function sortByNeverCooked<TRow extends { readonly meal: Meal }>(
  rows: readonly TRow[],
  cookEvents: readonly CookEvent[],
): readonly TRow[] {
  return [...rows].sort((a, b) => {
    const aCooked = hasEverBeenCooked(a.meal.id, cookEvents);
    const bCooked = hasEverBeenCooked(b.meal.id, cookEvents);
    if (aCooked !== bCooked) {
      // false (never cooked) sorts before true (cooked): Number(false) = 0.
      return Number(aCooked) - Number(bCooked);
    }
    if (!aCooked) {
      return a.meal.createdAt.localeCompare(b.meal.createdAt);
    }
    return a.meal.title.localeCompare(b.meal.title, 'nl');
  });
}

/**
 * The entry point the screen calls, generic over any row shape carrying a
 * `meal` — see this file's header for why, and for why `default` returns
 * the identical `rows` reference rather than an equal copy: a caller
 * memoizing on this function's output should see no change when the
 * household hasn't asked for one, matching `filterLibraryRows`'s own
 * short-circuit in recipeSearch.ts.
 *
 * Always copies before sorting when a sort is active — `Array.prototype.sort`
 * mutates in place, and `rows` here is the screen's already-filtered state.
 */
export function sortLibraryRows<TRow extends { readonly meal: Meal }>(
  rows: readonly TRow[],
  sort: LibrarySortOption,
  cookEvents: readonly CookEvent[],
): readonly TRow[] {
  switch (sort) {
    case 'default':
      return rows;
    case 'recent_toegevoegd':
      return sortByRecentlyAdded(rows);
    case 'nog_nooit_gekookt':
      return sortByNeverCooked(rows, cookEvents);
    default: {
      const exhaustiveCheck: never = sort;
      throw new Error(`Unhandled LibrarySortOption: ${String(exhaustiveCheck)}`);
    }
  }
}

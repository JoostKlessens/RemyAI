/**
 * Pure search/filter resolver for "Mijn recepten" (src/app/(tabs)/recipes.tsx)
 * — LIB-01/LIB-03. Once a household has forty-plus saved recipes, a plain
 * scrolling grid stops working as a way to find one dish again, and two
 * columns have sat on `Meal` since migrations 0004 and 0010 (`dishTags`,
 * `dishMoods`) without a single reader anywhere in the library. This module
 * is that reader, plus the free-text title search neither column can answer
 * ("I know it's called something with paprika").
 *
 * WHY THIS REUSES `filterByDecisionFilters` (exclusions.ts) RATHER THAN
 * REIMPLEMENTING IT. That function already carries the exact semantics this
 * screen needs and no others: `requiredDishTags` is AND (a composition —
 * "pasta én vegetarisch" describes one dish, see `DecisionFilters` in
 * types.ts), `anyDishMoods` is OR (a craving — "zomers of licht" is either),
 * and an explicit time cap treats an unknown `estimatedMinutes` as excluded
 * rather than passed (exclusions.ts's own comment on `isWithinMaxMinutes`
 * explains why that asymmetry with the household's standing time budget is
 * deliberate). `DecisionFilters` is already the exact shape that carries
 * all three. Reimplementing "AND for tags, OR for moods" here would be
 * precisely the drift exclusions.ts's own header warns against: two
 * predicates that are supposed to agree, maintained by two people who don't
 * know about each other, one of whom (this file) has no PD-009 history to
 * remember why the asymmetry exists. What this module adds on top is the
 * one thing the decision engine has no use for — a free-text title search —
 * and the library-specific question of what counts as "any filter active",
 * which decides which of the two empty states the screen shows.
 *
 * DELIBERATELY DOES NOT IMPORT ANYTHING FROM src/components. Nothing in
 * src/domain does — dishMoods.ts's own header explains why a route module
 * can't be reached from a test that imports this layer, and the same
 * boundary holds for `ScheduledMealRow` (components/recipeScheduling.ts):
 * rather than import that type and create a domain -> component edge that
 * exists nowhere else in this codebase, `filterLibraryRows` below is
 * generic over any `{ readonly meal: Meal }` shape. The screen hands it its
 * already-sorted rows and gets the same rows back, filtered. That ordering
 * choice is itself the correctness argument for "deze week" staying first:
 * filtering a sorted array never reorders what survives it, so this module
 * never needs to know sortMealsByScheduling's ordering rule exists in order
 * to preserve it.
 *
 * NO ALLERGEN OR RESTRICTION DATA HERE, ON PURPOSE. `filterByDecisionFilters`
 * takes none, and neither does anything below. Mijn recepten already shows
 * a household everything IT owns regardless of any member's allergens or
 * dislikes — that gate belongs to the decision engine's candidate pool
 * (exclusions.ts's `filterByRestrictionsAndTimeBudget`), not to browsing a
 * personal library — and folding it in here would make a search box quietly
 * hide a dish the household deliberately saved.
 *
 * Title search is case-insensitive and diacritic-tolerant via the same
 * `normalizeTag` every tag comparison in this codebase already goes through
 * (NFD-decompose, strip combining marks, lowercase): "puree" finds
 * "Aardappelpuree" and "puree" also finds "Purée". That is not a
 * coincidence of reuse — a dish title typed into a search box is free text
 * exactly the way a hand-typed dislike tag is, and both need the same
 * answer to "did the user mean the same word, accent or not".
 */

import { filterByDecisionFilters } from './exclusions';
import { normalizeTag } from './normalizeTag';
import type { Meal } from './types';

/**
 * Tonight's-filters shape (`DecisionFilters`) reused would have forced this
 * screen to state a `maxMinutes` number it doesn't have — the library asks
 * one coarse yes/no ("snel or not"), not "how many minutes exactly", so
 * `quickOnly` is the state this screen actually holds and `filterLibraryMeals`
 * is where it becomes the `maxMinutes` number `filterByDecisionFilters`
 * expects.
 */
export interface LibrarySearchState {
  readonly query: string;
  readonly requiredDishTags: readonly string[];
  readonly anyDishMoods: readonly string[];
  readonly quickOnly: boolean;
}

/** The no-search identity — `filterLibraryMeals(meals, NO_LIBRARY_SEARCH)` returns every meal, in its input order. */
export const NO_LIBRARY_SEARCH: LibrarySearchState = {
  query: '',
  requiredDishTags: [],
  anyDishMoods: [],
  quickOnly: false,
};

/**
 * The library's one time-budget filter, "Snel". 20 minutes rather than a
 * segmented choice of several caps (the way the Kiezen decision surface
 * offers 20/30/45, see DecisionFilterBar.tsx): a library search narrows a
 * browse list, it does not commit to one dish the way the nightly decision
 * does, so one coarse cutoff is enough and costs less chip-row height than
 * a control built for a different screen's precision. 20 is the same
 * number DecisionFilterBar's own comment names as "the request this whole
 * feature exists for" — reused here as the same product vocabulary for
 * "snel", not re-derived from scratch.
 */
export const LIBRARY_QUICK_MAX_MINUTES = 20;

/**
 * Whether `search` would narrow anything at all. Used both to decide
 * whether a "Wissen" reset control has anything to reset, and — the reason
 * it lives beside the filter itself rather than only in a UI component —
 * to tell the screen's two empty states apart: a library with zero rows is
 * always the first-run state, but a library with zero VISIBLE rows is only
 * the search-empty state when a search was actually active.
 */
export function isLibrarySearchActive(search: LibrarySearchState): boolean {
  return (
    search.query.trim().length > 0 ||
    search.requiredDishTags.length > 0 ||
    search.anyDishMoods.length > 0 ||
    search.quickOnly
  );
}

/**
 * Case-insensitive, diacritic-tolerant substring match. An empty (or
 * whitespace-only) query matches everything — the "no query typed" case is
 * not a query for the empty string, it is the absence of one.
 */
export function matchesTitleQuery(title: string, query: string): boolean {
  const normalizedQuery = normalizeTag(query);
  if (normalizedQuery.length === 0) {
    return true;
  }
  return normalizeTag(title).includes(normalizedQuery);
}

/**
 * The whole filter, composed: title first (this module's own predicate),
 * then dishTags/dishMoods/time handed straight to `filterByDecisionFilters`
 * — see this file's header for why that reuse, rather than a second
 * implementation, is the point. Order between the two steps has no effect
 * on the result (both are simple `Array#filter`s over independent
 * predicates) but title-first is cheaper on the common case: a typed
 * search string usually narrows harder than an unset chip row.
 */
export function filterLibraryMeals(meals: readonly Meal[], search: LibrarySearchState): readonly Meal[] {
  const titleMatched = meals.filter((meal) => matchesTitleQuery(meal.title, search.query));
  return filterByDecisionFilters(titleMatched, {
    maxMinutes: search.quickOnly ? LIBRARY_QUICK_MAX_MINUTES : null,
    requiredDishTags: search.requiredDishTags,
    anyDishMoods: search.anyDishMoods,
  });
}

/**
 * The entry point the screen actually calls. Generic over any row shape
 * that carries a `meal`, rather than importing `ScheduledMealRow` — see
 * this file's header for why that boundary is deliberate. Filtering never
 * reorders `rows`, so a caller that hands in an already-sorted array (the
 * screen's `sortMealsByScheduling` output, "deze week" first) gets that
 * same order back with only the non-matching rows removed.
 *
 * Short-circuits to the identical `rows` reference when no search is
 * active, rather than rebuilding an equal array — cheap to state, and it
 * means a caller memoizing on this function's output sees no change when
 * the household hasn't asked for one.
 */
export function filterLibraryRows<TRow extends { readonly meal: Meal }>(
  rows: readonly TRow[],
  search: LibrarySearchState,
): readonly TRow[] {
  if (!isLibrarySearchActive(search)) {
    return rows;
  }
  const matchingIds = new Set(filterLibraryMeals(rows.map((row) => row.meal), search).map((meal) => meal.id));
  return rows.filter((row) => matchingIds.has(row.meal.id));
}

/**
 * The dishTags present on at least one meal in the library — what a filter
 * bar may offer as chips, mirroring `collectAvailableDishMoods` in
 * dishMoods.ts exactly (same reasoning: rendering the whole closed
 * vocabulary unconditionally turns a filter into a catalogue, and a chip
 * for a category nothing in this household's library carries is a control
 * guaranteed to return zero rows). No equivalent already existed in
 * dishTags.ts, so it lives here rather than being added to a module this
 * change does not otherwise own.
 */
export function collectAvailableDishTags(meals: readonly Meal[]): readonly string[] {
  const tags = new Set<string>();
  for (const meal of meals) {
    for (const tag of meal.dishTags) {
      tags.add(tag);
    }
  }
  return [...tags];
}

/**
 * Everything "Mijn recepten" draws, derived from the household's rows and
 * the one `LibrarySearchState` the screen holds: which tiles survive, and
 * which chips the filter bar may still offer.
 *
 * ===========================================================================
 * WHY THIS EXISTS AT ALL, AND WHY IT IS NOT IN src/domain
 * ===========================================================================
 *
 * `src/domain/recipeSearch.ts` owns the filtering. It is deliberately
 * generic over `{ readonly meal: Meal }` and imports nothing from
 * src/components — its header argues that boundary at length, and it is the
 * reason the domain layer stays testable without a route module anywhere
 * near it.
 *
 * The SCHEDULING STATE does not fit through that boundary. It is not a
 * column on `Meal`; it is derived per row from saves and cook events by
 * `resolveRecipeSchedulingState` in recipeScheduling.ts, one directory up
 * from nothing the domain may see. So the library gained a filter axis whose
 * value lives in the domain's state object and whose application cannot.
 *
 * This module is that seam, and it is the ONLY place both halves are known.
 * It is a plain `.ts` beside a `.tsx` for the reason every `*Copy.ts` module
 * in this directory gives — vitest runs with react-native stubbed, so logic
 * written inside a component is logic nothing can assert — and unlike those,
 * what it protects is not a sentence but an ordering of four filters whose
 * composition is easy to get subtly wrong.
 *
 * ===========================================================================
 * THE AXIS THAT COST NOTHING AND WAS MISSING ANYWAY
 * ===========================================================================
 *
 * Every tile in this grid has drawn its scheduling state as a badge since
 * the grid existed (`RecipeTile`), the screen already loads the saves and
 * cook events it is computed from (`loadRows`), and nothing could filter on
 * it. A household could see all four states and narrow by none of them —
 * on the one axis whose data is 100% populated, unlike `dishTags` (written
 * only at import), `dishMoods` (written only after cooking) and
 * `dishCourse` (written only since migration 0017).
 *
 * It needed no repository call, no column and no migration. What it needed
 * was somebody to notice that the missing filter was a boundary rather than
 * a decision.
 *
 * ===========================================================================
 * ORDER OF COMPOSITION, WHICH IS THE ONLY THING HERE THAT CAN BE WRONG
 * ===========================================================================
 *
 * The grid is the intersection of both halves, so the order the two filters
 * run in cannot change what survives. The CHIPS are a different matter, and
 * this is the whole reason the facet collectors take rows as a parameter:
 *
 *   - the dish-tag / mood / course chips must be computed against rows the
 *     scheduling filter has ALREADY thinned, or they would offer categories
 *     that vanished when "Al gekookt" was tapped;
 *   - the scheduling chips must be computed against rows the MEAL filters
 *     have already thinned, and with the scheduling selection itself
 *     dropped, because that axis is ORed.
 *
 * Both are one line here and neither is expressible inside a single filter
 * pass, which is why `filterLibraryGrid` returns a view rather than a list.
 */

import {
  collectSelectableDishCourses,
  collectSelectableDishMoods,
  collectSelectableDishTags,
  filterLibraryRows,
  isLibrarySearchActive,
  type LibrarySearchState,
} from '@/domain/recipeSearch';
import type { RecipeSchedulingState, ScheduledMealRow } from './recipeScheduling';

/**
 * The four states, in the order `sortMealsByScheduling`'s own
 * `STATE_SORT_ORDER` already puts them — planned first, cooked last.
 *
 * The chip row therefore reads in the same sequence as the grid beneath it,
 * which is the cheapest kind of consistency: a household that has learned
 * "deze week staat bovenaan" does not have to learn a second ordering to use
 * the filter for it. Written out rather than derived from that private map,
 * because `STATE_SORT_ORDER` is a sort key and not a display order, and a
 * future re-sort of the grid should not silently rearrange the controls —
 * tests/libraryGridFilter.test.ts pins this list so the two can only diverge
 * on purpose.
 */
export const LIBRARY_SCHEDULING_STATES: readonly RecipeSchedulingState[] = [
  'deze_week',
  'ooit',
  'geen_planning',
  'al_gekookt',
];

/** Just the scheduling half, so a caller can narrow before asking the domain layer what chips are left. */
export type SchedulableRow = { readonly scheduling: { readonly state: RecipeSchedulingState } };

/**
 * What the screen renders after a search, in one object.
 *
 * The four chip lists are what the bar MAY offer, not what it draws: the bar
 * still intersects each with its own closed vocabulary (`DISH_TAGS`,
 * `DISH_MOODS`, `DISH_COURSES`, `LIBRARY_SCHEDULING_STATES`) so the chips
 * never rearrange as a library grows — the same restraint `DecisionFilterBar`
 * applies to its own rows.
 */
export interface LibraryGridView {
  readonly rows: readonly ScheduledMealRow[];
  readonly selectableDishTags: readonly string[];
  readonly selectableDishMoods: readonly string[];
  readonly selectableDishCourses: readonly string[];
  readonly selectableSchedulingStates: readonly RecipeSchedulingState[];
}

/**
 * OR across states, and it could not be anything else: a row resolves to
 * exactly one state, so ANDing two would be empty by construction — the same
 * argument `dishCourses.ts` makes for the course axis one layer down.
 *
 * Short-circuits to the identical array when nothing is selected, matching
 * `filterLibraryRows`, so a caller memoizing on this output sees no change
 * when the household has not asked for one.
 *
 * `geen_planning` IS A SELECTABLE STATE and not the absence of a selection.
 * "Laat me zien wat ik nog nergens voor ingepland heb" is a real question,
 * and it is the one this grid could never answer.
 */
export function filterRowsBySchedulingStates<TRow extends SchedulableRow>(
  rows: readonly TRow[],
  states: readonly string[],
): readonly TRow[] {
  if (states.length === 0) {
    return rows;
  }
  const selected = new Set(states);
  return rows.filter((row) => selected.has(row.scheduling.state));
}

/**
 * The scheduling chips worth offering: the states present on the rows that
 * survive every OTHER axis, plus whatever is already selected.
 *
 * The union with the selection is not defensive tidiness — it is the chip
 * that undoes an empty grid. Filter to "Al gekookt", then type a query that
 * matches nothing cooked, and without the union the control you would reach
 * for to get back is the one that just disappeared.
 *
 * Returned in `LIBRARY_SCHEDULING_STATES` order rather than discovery order,
 * so the row does not rearrange itself as a household cooks.
 */
export function collectSelectableSchedulingStates(
  rows: readonly ScheduledMealRow[],
  search: LibrarySearchState,
): readonly RecipeSchedulingState[] {
  const available = new Set<string>(filterLibraryRows(rows, search).map((row) => row.scheduling.state));
  for (const state of search.anySchedulingStates) {
    available.add(state);
  }
  return LIBRARY_SCHEDULING_STATES.filter((state) => available.has(state));
}

/**
 * The one call the screen makes. See the header for why the two narrowings
 * below are not interchangeable.
 *
 * `isLibrarySearchActive` is asked once here purely to hand back the input
 * array unchanged in the common case — the same short-circuit
 * `filterLibraryRows` performs, hoisted so the scheduling pass in front of it
 * cannot break the identity by rebuilding an equal array.
 */
export function filterLibraryGrid(rows: readonly ScheduledMealRow[], search: LibrarySearchState): LibraryGridView {
  // The chip axes the domain owns are asked against rows the scheduling
  // filter has already removed, so a category that only exists on hidden
  // rows is not offered.
  const schedulingNarrowed = filterRowsBySchedulingStates(rows, search.anySchedulingStates);

  return {
    rows: isLibrarySearchActive(search) ? filterLibraryRows(schedulingNarrowed, search) : rows,
    selectableDishTags: collectSelectableDishTags(schedulingNarrowed, search),
    selectableDishMoods: collectSelectableDishMoods(schedulingNarrowed, search),
    selectableDishCourses: collectSelectableDishCourses(schedulingNarrowed, search),
    // THE MIRROR IMAGE, AND IT TAKES `rows` RATHER THAN `schedulingNarrowed`.
    // That is the whole asymmetry, and getting it wrong is silent: handing it
    // the narrowed rows would compute the scheduling facet from rows the
    // scheduling filter had already removed, so choosing "Deze week" would
    // leave "Deze week" as the only chip on the row and the other three would
    // vanish — on an ORed axis, where each of them would have ADDED rows.
    // `collectSelectableSchedulingStates` applies the meal-level filters
    // itself (`filterLibraryRows` cannot see this axis) and deliberately
    // ignores this axis's own selection, which is exactly what it needs.
    selectableSchedulingStates: collectSelectableSchedulingStates(rows, search),
  };
}

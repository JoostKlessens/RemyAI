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
 * FIVE AXES NOW, AND TWO OF THEM ARRIVED WITH THE 3-ACROSS GRID. The three
 * this module shipped with — title, dishTags, dishMoods, plus the time cap —
 * are joined by the COURSE (`Meal.dishCourse`, migration 0017) and the
 * SCHEDULING STATE. They are not symmetrical, and the asymmetry is the
 * interesting part:
 *
 *   - The course is a column on `Meal`, so it is filtered here, beside the
 *     title, by a predicate this module owns (`matchesDishCourses`).
 *   - The scheduling state is NOT a column. It is derived per row from saves
 *     and cook events, in the component layer, and reaching for it would open
 *     the domain -> component edge the paragraph below refuses. So its VALUE
 *     is held in `LibrarySearchState` and its APPLICATION lives in
 *     src/components/libraryGridFilter.ts. That split is stated on the field
 *     itself, because it is the one thing about this module a reader can get
 *     wrong by assuming consistency.
 *
 * `filterLibraryRows` therefore does not filter on everything in the state it
 * is handed, and never claimed to: it is the meal-level half. Screens call
 * `filterLibraryGrid`.
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

import { readMealDishCourse } from './dishCourses';
import { collectAvailableDishMoods } from './dishMoods';
import { filterByDecisionFilters } from './exclusions';
import { normalizeTag } from './normalizeTag';
import type { Meal } from './types';

/**
 * Tonight's-filters shape (`DecisionFilters`) is not reused wholesale — the
 * library has a free-text `query` the decision surface has no use for, and
 * that surface has no use for a title search — but `maxMinutes` is
 * deliberately the SAME field, with the same type and the same meaning, so
 * `filterLibraryMeals` hands it straight to `filterByDecisionFilters`
 * without translating anything on the way.
 *
 * IT USED TO BE A BOOLEAN CALLED `quickOnly`, AND THE ARGUMENT FOR THAT WAS
 * WRONG IN A WAY WORTH RECORDING. It said the library "asks one coarse
 * yes/no ('snel or not'), not 'how many minutes exactly'", so a boolean was
 * the state the screen actually held, and `filterLibraryMeals` was where it
 * became a number. Both halves were true and the conclusion still did not
 * follow: what the boolean DID was pick twenty minutes on the household's
 * behalf and then refuse to discuss it. Someone with half an hour could not
 * say so — their only move was to switch the filter off entirely and scroll
 * — and nothing on screen ever admitted that "Snel" was a specific number
 * rather than a judgement. The owner asked for the cap itself ("hoe lang
 * het recept maximaal mag duren"), which is the value this field was always
 * one translation away from holding directly.
 */
export interface LibrarySearchState {
  readonly query: string;
  readonly requiredDishTags: readonly string[];
  readonly anyDishMoods: readonly string[];
  /** `null` is "no cap stated", not "a cap of zero" — see `LIBRARY_TIME_CAP_OPTIONS` and `isWithinMaxMinutes` in exclusions.ts. */
  readonly maxMinutes: number | null;
  /**
   * Which courses to keep (`Meal.dishCourse`, migration 0017). OR, not AND,
   * and that asymmetry with `requiredDishTags` is forced rather than chosen:
   * dishCourses.ts fixes the cardinality at exactly one per dish, so "een
   * voorgerecht én een toetje" is empty by construction and ANDing it would
   * ship a control whose second tap always returns nothing.
   *
   * THE FILTER MUST NOT MAKE UNTAGGED MEALS VANISH, which is the whole
   * reason this axis reads through `readMealDishCourse` rather than off
   * `meal.dishCourse`. Every row written before 0017 has no value at all,
   * and the owner already ruled on what those are — "standaard is iets een
   * hoofdgerecht". Reading the raw field would make `hoofdgerecht`, the
   * value a household reaches for first, the one that empties the library.
   *
   * `readonly string[]` and not `readonly DishCourse[]`, matching the two
   * axes above: what a chip row hands back is untrusted until it is
   * compared, and `readMealDishCourse` has already narrowed the other side.
   */
  readonly anyDishCourses: readonly string[];
  /**
   * Which scheduling states to keep — `'deze_week' | 'ooit' | 'al_gekookt' |
   * 'geen_planning'`, the states every library tile has drawn as a badge
   * since the grid existed and that nothing could filter on.
   *
   * IT IS THE ONE AXIS THIS MODULE CANNOT APPLY, and that is deliberate
   * rather than an omission waiting to be fixed. The state is not a column
   * on `Meal`: it is derived per row from saves and cook events by
   * `resolveRecipeSchedulingState` (src/components/recipeScheduling.ts), and
   * this module refuses the domain -> component edge that reaching for it
   * would open (see this file's header). So the value is HELD here — because
   * "Wissen", `isLibrarySearchActive` and the choice between the library's
   * two empty states all have to see the whole search in one object — and
   * APPLIED by `filterLibraryGrid` (src/components/libraryGridFilter.ts),
   * which is the one caller allowed to know both halves.
   *
   * Strings rather than `RecipeSchedulingState` for the same reason: naming
   * that union here would import it.
   */
  readonly anySchedulingStates: readonly string[];
}

/** The no-search identity — `filterLibraryMeals(meals, NO_LIBRARY_SEARCH)` returns every meal, in its input order. */
export const NO_LIBRARY_SEARCH: LibrarySearchState = {
  query: '',
  requiredDishTags: [],
  anyDishMoods: [],
  maxMinutes: null,
  anyDishCourses: [],
  anySchedulingStates: [],
};

/**
 * The caps the library offers, in the order a filter row should read them:
 * widest first, narrowest last. `null` leads because it is not a fourth cap
 * but the ABSENCE of one — `NO_LIBRARY_SEARCH.maxMinutes`, the state the row
 * starts in — and putting it anywhere else would suggest "no maximum" is a
 * choice on the same ladder as "20 minutes".
 *
 * 20/30/45 ARE `DecisionFilterBar`'s STEPS, REUSED RATHER THAN RE-DERIVED.
 * That file's own comment already did the work: they are not Household
 * setup's 15/30/45+ because "45+" is an open-ended *budget* ("long cooking
 * is fine"), which is meaningless as a hard upper bound, and 20 earns its
 * slot because "ik heb twintig minuten" is the request the whole filtering
 * feature exists for. This module's previous single threshold already cited
 * that comment as its source for the number 20; taking all three is the same
 * borrowing, finished. Inventing a different ladder here (15/25/40, say)
 * would mean two screens teaching one household two vocabularies for one
 * question, and the household would be right to read the difference as
 * meaningful.
 *
 * WHY A LIST AND NOT A `min`/`max`/`step` RULE — REVERSED BY THE OWNER ON
 * 2026-09-06, AND THE ARGUMENT IS LEFT STANDING RATHER THAN DELETED, because
 * half of it survived the reversal and decided the shape of what replaced it.
 *
 * What this comment used to conclude, and what the code did: "The library's
 * job is to offer the few caps people actually say out loud, not every cap
 * expressible in minutes; a slider or a stepper would let someone ask for 37
 * minutes, which nobody has ever wanted, at the cost of a control that is
 * harder to hit than a chip and impossible to read at a glance."
 *
 * The owner then asked for exactly the rejected control, in these words:
 * "Ik zou ook willen dat je bovenin geen blokjes hebt voor hoe lang het mag
 * duren maar een icoontje met een klokje en dan 5min interval scrollen van
 * hoe lang het recept maximaal mag duren." A second instruction on
 * 2026-09-06 asked for the same clock on this screen: "Ook hier weer
 * hetzelfde klokje als filter voor hoe lang het gerecht mag duren."
 *
 * BOTH HALVES OF THE OBJECTION WERE ANSWERED RATHER THAN OVERRULED, and
 * `src/domain/timeCap.ts` is where that answer lives. Nobody wants
 * thirty-seven minutes — so the ladder steps in fives and thirty-seven is not
 * on it. A control has to be hittable — so what sits over the ladder is a
 * 44 pt track a tap lands anywhere on, not a 28 pt thumb you have to find,
 * and it draws its current value as a number beside a clock, which is the
 * "readable at a glance" the chips were defended for. What did NOT survive is
 * the premise that four caps are all a household ever wants to say: the
 * owner asked for the caps between them.
 *
 * THIS CONSTANT HAS NO RENDERER SINCE THAT REVERSAL. `LibrarySearchBar` now
 * mounts `TimeCapPicker`, and `DecisionFilterBar`'s own chip row is the
 * other half of the same replacement. It survives uncalled on purpose, the
 * way src/domain/librarySort.ts does: `libraryFilterCopy.ts`'s
 * `describeTimeCapOption` — the words BOTH screens still speak, through
 * `timeCapCopy.ts` — was argued against exactly these four values, and
 * tests/recipeSearch.test.ts pins them so the ladder cannot quietly drift
 * away from the vocabulary two screens taught their households. Delete it
 * only together with that argument, not before.
 */
export const LIBRARY_TIME_CAP_OPTIONS: readonly (number | null)[] = [null, 20, 30, 45];

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
    search.maxMinutes !== null ||
    search.anyDishCourses.length > 0 ||
    // Counted here even though `filterLibraryMeals` cannot apply it — see
    // `LibrarySearchState.anySchedulingStates`. If it were left out, a
    // household filtering on "Al gekookt" alone would get the first-run
    // "plak een link" state instead of "niets gevonden", and "Wissen" would
    // not appear to undo the one filter that was on.
    search.anySchedulingStates.length > 0
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
  const courseMatched = titleMatched.filter((meal) => matchesDishCourses(meal, search.anyDishCourses));
  return filterByDecisionFilters(courseMatched, {
    maxMinutes: search.maxMinutes,
    requiredDishTags: search.requiredDishTags,
    anyDishMoods: search.anyDishMoods,
  });
}

/**
 * The course predicate, and the reason it is here rather than inside
 * `filterByDecisionFilters` with the other three: `DecisionFilters` is the
 * decision engine's shape, owned by exclusions.ts, and Kiezen has not asked
 * for a course axis. Adding a field there would put a filter on the decision
 * surface that no screen sets and no PD has ruled on. This module already
 * owns one predicate the engine has no use for (the title search); the
 * course is the second, and it composes the same way.
 *
 * An empty selection matches everything — the absence of a statement, not a
 * statement about the empty set, exactly as an empty `query` behaves above.
 */
function matchesDishCourses(meal: Meal, anyCourses: readonly string[]): boolean {
  if (anyCourses.length === 0) {
    return true;
  }
  const course = readMealDishCourse(meal);
  return anyCourses.some((candidate) => normalizeTag(candidate) === course);
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
 * The dishTags present on at least one row in a pool — what a filter bar may
 * offer as chips, mirroring `collectAvailableDishMoods` in dishMoods.ts
 * exactly (same reasoning: rendering the whole closed vocabulary
 * unconditionally turns a filter into a catalogue, and a chip for a category
 * nothing in this pool carries is a control guaranteed to return zero rows).
 * No equivalent already existed in dishTags.ts, so it lives here rather than
 * being added to a module this change does not otherwise own.
 *
 * IT TOOK `readonly Meal[]` UNTIL 8 SEPTEMBER 2026, AND WIDENING IT IS THE
 * WHOLE REASON IT DID NOT HAVE TO BE COPIED. Trending's `Iedereen` scope
 * needed the identical collector over `BoardRowModel` — a canonical recipe
 * has no `Meal` row anywhere, so nothing on that surface can be narrowed by
 * a `Meal`-typed function — and this body never touched a single field
 * except `dishTags`. The constraint now says exactly that and nothing more.
 * No existing caller changes: `Meal` satisfies it structurally, and the
 * narrowed `readonly Meal[]` that `collectSelectableDishTags` hands in below
 * still infers `Meal` for `TRow`.
 *
 * ⚠ THIS IS THE FUNCTION docs/LONGLIST.md GAP-33 IS ABOUT, AND A THIRD COPY
 * IS THE ONE THAT WOULD HAVE HURT. Kiezen still keeps a private duplicate of
 * this body (`src/app/(tabs)/index.tsx:283`); that is GAP-33's open half and
 * it is not this package's file to fix. A third copy, written for Trending
 * because the parameter type was one word too narrow, would have turned a
 * two-copy defect into a three-copy one — which is exactly what GAP-33 warns
 * the next author about.
 *
 * WHAT IT STILL DOES NOT DO is narrow against the current selection; that is
 * `collectSelectableDishTags` below, whose Trending equivalent is
 * `collectSelectableBoardDishTags` (src/components/trendingFilter.ts). That
 * one could NOT be widened the same way, and the reason is measured rather
 * than assumed: it is generic over `{ readonly meal: Meal }` and it takes a
 * `LibrarySearchState`, and neither exists on a board of canonical recipes.
 * Only the PRINCIPLE crossed over, not the function.
 */
export function collectAvailableDishTags<TRow extends { readonly dishTags: readonly string[] }>(
  rows: readonly TRow[],
): readonly string[] {
  const tags = new Set<string>();
  for (const row of rows) {
    for (const tag of row.dishTags) {
      tags.add(tag);
    }
  }
  return [...tags];
}

/**
 * The courses present in a pool, read through `readMealDishCourse` — so a
 * library of rows written before migration 0017 offers `hoofdgerecht` and
 * nothing else, which is the truth about it rather than an empty row.
 *
 * The one pool that yields nothing is the genuinely empty one, and that is
 * correct: a chip row gated on this then renders nothing at all, matching
 * `collectAvailableDishTags`/`collectAvailableDishMoods`'s own restraint.
 */
export function collectAvailableDishCourses(meals: readonly Meal[]): readonly string[] {
  const courses = new Set<string>();
  for (const meal of meals) {
    courses.add(readMealDishCourse(meal));
  }
  return [...courses];
}

// ---------------------------------------------------------------------------
// WHICH CHIPS A FILTER BAR MAY OFFER, GIVEN WHAT IS ALREADY SELECTED.
//
// THE DEFECT THESE CLOSE. Until now the bar was handed the tags present in
// the FULL library and re-offered all of them after every tap. Because
// `requiredDishTags` is ANDed (`hasEveryRequiredDishTag`, exclusions.ts),
// choosing "pasta" leaves every non-co-occurring chip on screen — "soep",
// "stamppot", "vis" — each of them a control that is guaranteed to return
// zero rows. A household cannot tell those apart from the chips that would
// work, so the only way to find out is to tap one, watch the grid empty, and
// tap it back. On a library of forty recipes most of the row is in that
// state after one tap.
//
// The comment that produced it was not wrong about its own worry — "a chip a
// household has already selected must never disappear out from under them" —
// it was wrong that computing availability off the full pool is what protects
// that. Narrowing plus a union with the current selection protects it exactly,
// and that is what the three functions below do.
//
// WHAT "THE OTHER ACTIVE FILTERS" MEANS DEPENDS ON THE AXIS, and getting that
// wrong is the way this fix breaks a row instead of repairing it:
//
//   AND axis (dishTags) — narrow with the selection INCLUDED. Adding a tag
//   intersects, so the tags worth offering are exactly the ones carried by a
//   row that already survives; anything else is the dead end above.
//
//   OR axes (dishMoods, dishCourses) — narrow with the axis's own selection
//   REMOVED. Adding a mood widens, so a mood absent from the currently
//   visible rows may still bring rows back, and hiding it would remove the
//   household's way to widen.
//
// EVERY ONE OF THEM UNIONS THE SELECTION BACK IN, unconditionally. A chip a
// finger has already pressed is the chip that undoes the state the household
// is in, and a search narrowed to nothing is precisely when they need it.
//
// THE ROWS HANDED IN MUST ALREADY BE NARROWED BY ANY AXIS THIS MODULE CANNOT
// SEE — today that is `anySchedulingStates` alone (see its field comment).
// `filterLibraryGrid` (src/components/libraryGridFilter.ts) is what does that
// and is the only intended caller; taking the rows as a parameter rather than
// re-deriving them is what keeps this module free of the component edge.
// ---------------------------------------------------------------------------

/** The rows surviving `search`, with `override` applied on top — the one primitive all three collectors share. */
function narrowedMeals<TRow extends { readonly meal: Meal }>(
  rows: readonly TRow[],
  search: LibrarySearchState,
  override: Partial<LibrarySearchState>,
): readonly Meal[] {
  return filterLibraryMeals(
    rows.map((row) => row.meal),
    { ...search, ...override },
  );
}

/** Selection first, then what the narrowed pool adds — order is irrelevant to a `Set`, and stating it this way keeps "a selected chip is always offered" impossible to lose in a refactor. */
function unionWithSelection(selected: readonly string[], available: readonly string[]): readonly string[] {
  return [...new Set([...selected.map(normalizeTag), ...available])];
}

/** The dish tags a household could add to `search` and still see a row — see the block comment above for why the AND axis narrows with its own selection included. */
export function collectSelectableDishTags<TRow extends { readonly meal: Meal }>(
  rows: readonly TRow[],
  search: LibrarySearchState,
): readonly string[] {
  return unionWithSelection(search.requiredDishTags, collectAvailableDishTags(narrowedMeals(rows, search, {})));
}

/** The dish moods worth offering. The mood selection is dropped before narrowing, because OR widens rather than intersects. */
export function collectSelectableDishMoods<TRow extends { readonly meal: Meal }>(
  rows: readonly TRow[],
  search: LibrarySearchState,
): readonly string[] {
  return unionWithSelection(
    search.anyDishMoods,
    collectAvailableDishMoods(narrowedMeals(rows, search, { anyDishMoods: [] })),
  );
}

/** The courses worth offering, on the mood row's rule — the axis is ORed, so it narrows with its own selection dropped. */
export function collectSelectableDishCourses<TRow extends { readonly meal: Meal }>(
  rows: readonly TRow[],
  search: LibrarySearchState,
): readonly string[] {
  return unionWithSelection(
    search.anyDishCourses,
    collectAvailableDishCourses(narrowedMeals(rows, search, { anyDishCourses: [] })),
  );
}

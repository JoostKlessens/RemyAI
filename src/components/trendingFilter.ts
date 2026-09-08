/**
 * Trending's filter — the reader-set narrowing the owner asked for on
 * 8 September 2026, and every Dutch word the control says.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Ook hier wil ik dat je een filter kan
 * aanzetten." — the last sentence of the message that also turned this
 * surface from a ranking into a scroll feed. PD-014's amendment of the same
 * date carries the whole argument; this file carries the half of it that is
 * code.
 *
 * ===========================================================================
 * WHY A FILTER IS NOT THE PERSONALISATION PD-014 CONDITION 6 FORBIDS
 * ===========================================================================
 *
 * That condition reads "No personalisation, ever. One board, identical for
 * every reader." This module narrows what one reader is looking at, and the
 * distinction is not a lawyer's one — it is the entire difference between the
 * board and the surface DESIGN.md refused:
 *
 * - **The ORDER never moves.** `filterBoardRows` is an `Array#filter`, so
 *   what survives it is in exactly the order `rankRecipes` put it in. Two
 *   readers with the same chips set see the same cards in the same order, and
 *   a reader with no chips set sees precisely the board every other reader
 *   sees. Nothing here can promote a row.
 * - **The reader states it, out loud, and can see that it is on.** A shut
 *   drawer carries a count in the accent colour with "Wissen" beside it. A
 *   model tuning this board to a taste profile would be doing the same
 *   arithmetic silently and would answer to nobody.
 * - **It survives nothing.** The screen resets it on every mount, exactly as
 *   Kiezen resets `DecisionFilters` ((tabs)/index.tsx). A narrowing that
 *   followed a household into tomorrow would be a profile with extra steps.
 *
 * ===========================================================================
 * TWO AXES, AND WHY NOT THE OTHER TWO THIS APP ALREADY HAS
 * ===========================================================================
 *
 * Gerechttags and time. Not moods and not the course, and that is a fact
 * about the database rather than a judgement about the axes: `recipes` (0006)
 * carries `dish_tags` and `estimated_minutes` and carries neither
 * `dish_moods` nor `dish_course`. Migrations 0010 and 0017 added those two to
 * `meals` alone, and 0017 sets out at length why a `recipes.course` was
 * deliberately refused. A mood chip here would filter on a column that does
 * not exist, which is not a missing feature but an impossible one.
 *
 * AND FOR TAGS, `<=` FOR TIME, BOTH TAKEN FROM `filterByDecisionFilters`
 * (src/domain/exclusions.ts) RATHER THAN INVENTED. Choosing "pasta" and
 * "vegetarisch" is one request for a vegetarian pasta, not an invitation to
 * serve either; and an explicit cap drops a recipe whose duration nobody
 * recorded, because "ik heb 30 minuten" cannot honestly be answered with
 * "possibly". That second rule is the deliberate asymmetry with
 * `isWithinTimeBudget` that exclusions.ts spends a page on, and it is
 * REPEATED here rather than re-decided: `TimeCapPicker` is the same control
 * on three screens now, and a household that learns what the clock means on
 * Kiezen must not find it meaning something else on Trending.
 *
 * ⚠ WHY THIS IS NOT A CALL TO `filterByDecisionFilters` ITSELF, which would
 * be the obvious reuse. That function and both of its predicates are typed on
 * `Meal`, and a canonical recipe has no `Meal` row anywhere in this app —
 * that is the whole reason Trending exists as a separate read. Widening them
 * is possible and is deliberately NOT done here: `src/domain/exclusions.ts`
 * also carries PD-006's allergen gate, and its own header argues that the
 * safety predicate and the narrowing predicate must stay one responsibility
 * each precisely so that an edit to "kies iets met pasta" is never also an
 * edit to the code path deciding what a nut-allergic household is shown.
 * Reaching into that file to widen two types, from a package about a list
 * screen, is the edit that header asks nobody to make casually. So the two
 * predicates are restated, in eight lines, with their source named — and
 * tests/trendingFilter.test.ts pins the same asymmetry the library's tests
 * pin, so the two cannot drift without a red test.
 *
 * WHAT WAS GENUINELY REUSED IS `collectAvailableDishTags`
 * (src/domain/recipeSearch.ts), widened from `readonly Meal[]` to any row
 * carrying `dishTags` in the same change. docs/LONGLIST.md GAP-33 is about
 * the second copy of that function; a third one, written because the
 * parameter type was one word too narrow, is the outcome it warns about.
 *
 * ===========================================================================
 * THE NARROWING RULE, WHICH IS LIB-07's AND IS WHY THE FILTER IS SAFE HERE
 * ===========================================================================
 *
 * `collectSelectableBoardDishTags` re-computes the offered chips against the
 * current selection and unions the selection back in unconditionally. That is
 * LIB-07's rule for an AND axis, arrived at on Mijn recepten: narrow WITH the
 * selection included, because adding a tag intersects, so the only tags worth
 * offering are the ones carried by a card that already survives.
 *
 * ⚠ `collectSelectableDishTags` ITSELF IS NOT REUSABLE HERE, and that is
 * measured rather than assumed: it is generic over `{ readonly meal: Meal }`
 * and takes a `LibrarySearchState`, and Trending has neither. Only the
 * principle crossed over.
 *
 * THE RULE DOES MORE WORK HERE THAN IN THE LIBRARY, and it is what pays for
 * filtering AFTER the top-25 cut rather than before it (the arithmetic for
 * that choice is in src/lib/trendingSource.ts's header). Because the chips
 * are collected from the cards actually on the board, a tag no top-25 recipe
 * carries is never offered at all — so a reader cannot tap their way to "geen
 * curry" and read it as a verdict about curries. **No single chip can empty
 * this feed**, and no pair of chips can either: every tag offered is carried
 * by a surviving card, and the row re-narrows after each tap.
 *
 * ⚠ THE TIME AXIS IS THE EXCEPTION, AND IT IS MEASURED RATHER THAN
 * THEORETICAL. `TimeCapPicker` is a continuous five-minute ladder rather than
 * a row of chips, so there is no set of offerable values to intersect — the
 * honest equivalent would be clamping the track, which moves a control under
 * a finger already on it. **So the cap ALONE can empty the feed**, and on the
 * demo seed it takes one drag: the three recipes that clear the vote floor
 * take 45, 25 and 30 minutes, so any cap of 20 leaves nothing. An earlier
 * draft of this header claimed only a COMBINATION could empty the feed; that
 * was wrong, and it is corrected here rather than quietly deleted, because it
 * is the kind of claim that reads as reassuring and would have made the empty
 * state look like a bug to the next reader.
 *
 * WHAT THAT COSTS IS BOUNDED BY THE COPY AND BY "WISSEN". The empty state
 * names the filter and the list rather than the world, and the shut drawer
 * carries a count and an undo. A reader who dragged the clock to five minutes
 * is one tap from the whole list.
 */

import { collectAvailableDishTags } from '@/domain/recipeSearch';
import { normalizeTag } from '@/domain/normalizeTag';
import type { TimeCap } from '@/domain/timeCap';

/**
 * The two fields a card must carry to be filterable, and nothing else.
 *
 * Structural rather than a named import of `BoardRowModel`, for the reason
 * `filterLibraryRows` gives about `ScheduledMealRow`: this module has no use
 * for a title, a score or a creator, and a filter that could see them is a
 * filter somebody could later make read them. Both `BoardRowModel` and
 * `BoardRecipe` satisfy it, which is what lets a test filter either.
 */
export interface FilterableBoardRow {
  readonly dishTags: readonly string[];
  readonly estimatedMinutes: number | null;
}

/**
 * What the reader has narrowed to.
 *
 * `maxMinutes` IS `TimeCap`, THE SAME TYPE THE OTHER TWO SCREENS HOLD, so
 * `TimeCapPicker` needs no translation on the way in or out — the identity
 * src/domain/timeCap.ts argues for. `null` is "no cap stated" and never "a
 * cap of zero".
 *
 * NO `query` FIELD, AND THERE MUST NOT BE ONE. A free-text search over a
 * global list of strangers' recipes is a different product decision than a
 * chip row — it is the "Ontdekken" surface's search box — and PD-014
 * authorises a bounded board, not a way to look things up in one.
 */
export interface TrendingFilterState {
  /** AND. See this file's header; the semantics are `filterByDecisionFilters`'s, restated. */
  readonly requiredDishTags: readonly string[];
  /** An explicit cap drops a recipe with no recorded duration — the deliberate asymmetry, restated. */
  readonly maxMinutes: TimeCap;
}

/** The "nothing stated" identity — `filterBoardRows(rows, NO_TRENDING_FILTER)` returns every row, in its input order. */
export const NO_TRENDING_FILTER: TrendingFilterState = {
  requiredDishTags: [],
  maxMinutes: null,
};

/**
 * How many narrowings are on. Every axis counts, because every axis is behind
 * the fold — the same rule `describeDecisionFilters` states for Kiezen, which
 * resolves to "everything" there for the same reason.
 */
export function countTrendingFilters(filter: TrendingFilterState): number {
  return (filter.maxMinutes === null ? 0 : 1) + filter.requiredDishTags.length;
}

/** Whether anything is narrowed at all — what tells the board's two empty states apart, and whether "Wissen" has anything to undo. */
export function isTrendingFilterActive(filter: TrendingFilterState): boolean {
  return countTrendingFilters(filter) > 0;
}

/**
 * Add or remove one tag, immutably.
 *
 * It lives here rather than in the bar for the reason every `*Copy.ts` module
 * in this directory gives: vitest runs `node` with react-native stubbed, so a
 * toggle written inside a `.tsx` is a rule no test can reach. It is also the
 * one place a chip gesture could accidentally mutate the object the screen is
 * still rendering.
 */
export function toggleTrendingDishTag(filter: TrendingFilterState, tag: string): TrendingFilterState {
  const normalized = normalizeTag(tag);
  const isSelected = filter.requiredDishTags.some((value) => normalizeTag(value) === normalized);
  return {
    ...filter,
    requiredDishTags: isSelected
      ? filter.requiredDishTags.filter((value) => normalizeTag(value) !== normalized)
      : [...filter.requiredDishTags, tag],
  };
}

/** AND, with both sides normalized — a stray un-normalized value from a column nothing sanitizes must still compare rather than silently matching nothing. */
function hasEveryRequiredDishTag(row: FilterableBoardRow, requiredTags: readonly string[]): boolean {
  if (requiredTags.length === 0) {
    return true;
  }
  const rowTags = new Set(row.dishTags.map(normalizeTag));
  return requiredTags.every((tag) => rowTags.has(tag));
}

/** An unknown duration loses under an explicit cap. `exclusions.ts`'s `isWithinMaxMinutes`, restated — see this file's header for why restated rather than imported. */
function isWithinMaxMinutes(row: FilterableBoardRow, maxMinutes: TimeCap): boolean {
  if (maxMinutes === null) {
    return true;
  }
  if (row.estimatedMinutes === null) {
    return false;
  }
  return row.estimatedMinutes <= maxMinutes;
}

/**
 * The board, narrowed to what the reader asked for.
 *
 * Filtering never reorders, so the cards that survive are in the order
 * `rankRecipes` put them in — which is the whole reason a reader-set filter
 * does not touch PD-014's sixth condition. Short-circuits to the identical
 * `rows` reference when nothing is set, matching `filterLibraryRows`: cheap
 * to state, and a caller memoizing on this output sees no change when the
 * reader has not asked for one.
 */
export function filterBoardRows<TRow extends FilterableBoardRow>(
  rows: readonly TRow[],
  filter: TrendingFilterState,
): readonly TRow[] {
  if (!isTrendingFilterActive(filter)) {
    return rows;
  }
  const requiredTags = filter.requiredDishTags.map(normalizeTag);
  return rows.filter((row) => isWithinMaxMinutes(row, filter.maxMinutes) && hasEveryRequiredDishTag(row, requiredTags));
}

/**
 * The dish tags a reader could add and still see a card, plus the ones they
 * have already chosen.
 *
 * THE SELECTION IS UNIONED BACK IN UNCONDITIONALLY. A chip a finger has
 * already pressed is the chip that undoes the state the reader is in, and a
 * feed narrowed to nothing is exactly when they need it. LIB-07's rule, word
 * for word, applied to a board instead of a library.
 *
 * BOTH SIDES ARE NORMALIZED HERE where the library's `unionWithSelection`
 * normalizes only the selection, and the difference is the source of the data
 * rather than a preference: a library tag went through `sanitizeDishTags` on
 * its way into `meals`, and `recipes.dish_tags` was written by an extraction
 * model with nothing in between. Returning two spellings of one tag would
 * draw the same chip twice.
 */
export function collectSelectableBoardDishTags<TRow extends FilterableBoardRow>(
  rows: readonly TRow[],
  filter: TrendingFilterState,
): readonly string[] {
  const available = collectAvailableDishTags(filterBoardRows(rows, filter));
  return [...new Set([...filter.requiredDishTags.map(normalizeTag), ...available.map(normalizeTag)])];
}

// ---------------------------------------------------------------------------
// THE WORDS. Everything below renders; nothing below decides anything.
// ---------------------------------------------------------------------------

/**
 * "Filters" — the owner's own word for this control on Kiezen, reused here
 * for the reason `DECISION_FILTER_TOGGLE_LABEL` gives against "Geavanceerd":
 * this fold holds every control the bar has, so nothing inside it is beyond
 * the ordinary ones. Duplicated rather than imported for the reason
 * decisionFilterCopy.ts sets out at length — a constant named
 * `DECISION_FILTER_*` rendered on Trending would tell the next reader the
 * word is on loan from Kiezen, which is false; either screen could change
 * without the other, and the test asserts the two are EQUAL, which is the
 * claim that is actually true.
 */
export const TRENDING_FILTER_TOGGLE_LABEL = 'Filters';

/** The tag row's heading. The word the other two filtering screens settled on, over chips drawn from the same seventeen `DISH_TAGS`. */
export const TRENDING_FILTER_TAGS_EYEBROW = 'Ingrediënten';

/**
 * Declared, and deliberately never drawn — exactly as on the other two
 * screens. `TimeCapPicker` draws a clock and a numeral, so a heading reading
 * "Hoeveel tijd?" over it is the same sentence twice. It survives for one
 * job: the spoken label on the shut control, because a screen-reader user is
 * the one person who cannot open the drawer, glance, and shut it again to
 * find out what is inside.
 */
export const TRENDING_FILTER_TIME_EYEBROW = 'Hoeveel tijd?';

/** "Wissen" — the same word for the same gesture as the other two screens, so a household that learns it once has learned it. */
export const TRENDING_FILTER_RESET_LABEL = 'Wissen';

/**
 * The reset's spoken label, and the one place this screen should NOT match
 * the other two. Kiezen's says "voor vanavond" because its filters live for
 * one evening; the library's names the typed query it also clears. This list
 * has no query and is not about tonight, so it says what it is.
 */
export const TRENDING_FILTER_RESET_A11Y_LABEL = 'Wis alle filters op deze lijst';

/**
 * AND semantics, spoken rather than left to be inferred from a result set a
 * screen-reader user cannot see. Word for word `describeDecisionDishTagChip`,
 * over the identical vocabulary, and pinned equal by the test for the same
 * reason the badge below is.
 */
export function describeTrendingDishTagChip(label: string): string {
  return `${label}. Filtert op gerechten met alles wat je kiest.`;
}

/**
 * The state where the filter has emptied the feed, and THE ONE PIECE OF COPY
 * ON THIS SCREEN THAT COULD TELL A LIE.
 *
 * It must never say there is no curry. There may well be an excellent curry;
 * what is true is that none of it is on THIS LIST, which holds at most
 * LEADERBOARD_MAX_ROWS recipes and only those that cleared
 * LEADERBOARD_MIN_VOTES. src/lib/trendingSource.ts's header carries why the
 * list is cut before it is filtered rather than after. So the title names the
 * filter and the body names the list; neither says anything about the world.
 *
 * HOW A READER GETS HERE, measured: never by a chip, and easily by the clock.
 * The chip row never offers a tag that would empty the feed on its own, but
 * the time ladder cannot narrow itself — on the demo seed the three recipes
 * that clear the vote floor take 45, 25 and 30 minutes, so a cap of 20 empties
 * it in one drag. That is why the body's advice is to switch one filter off
 * rather than to clear everything: whatever got the reader here, they are one
 * gesture from the whole list.
 */
export const TRENDING_FILTER_EMPTY_TITLE = 'Niets binnen dit filter';
export const TRENDING_FILTER_EMPTY_BODY =
  'Er staat niets in deze lijst dat aan alle filters voldoet. Zet er een uit om de rest weer te zien.';

export interface TrendingFilterToggleCopy {
  /** The visible word on the control. */
  readonly label: string;
  /** The visible count, or `null` when nothing is set — the absence of the badge and the absence of the spoken sentence are one statement, made once. */
  readonly activeBadge: string | null;
  /** What a screen reader says: what is inside, then what is on. */
  readonly accessibilityLabel: string;
}

/**
 * THE COUNT IS THE PRICE OF THE FOLD, and this screen pays a version of it
 * Kiezen does not.
 *
 * On Kiezen a forgotten filter narrows one dish name. Here it narrows a list
 * whose whole claim is completeness — "Dat is de hele lijst." sits at the
 * bottom of it — and a reader with a forgotten "vegetarisch" behind a shut
 * drawer would read that sentence as a statement about the app rather than
 * about their own narrowing. The badge is what stops the end note from lying,
 * and it is why the count is drawn in the accent colour: a number in
 * `textMuted` beside a muted label reads as more label.
 *
 * IN WORDS AND NOT AS A BARE NUMERAL, singular and plural both written out,
 * for the reason libraryFilterCopy.ts and decisionFilterCopy.ts both give:
 * Dutch does not forgive "1 filters" and this app has no pluralization
 * library. That shared plural is the one thing here a human can get wrong
 * without noticing, so the test asserts this badge equals
 * `describeDecisionFilters`' across a range including 0, 1 and a negative.
 *
 * THE SPOKEN LABEL IS COMPOSED FROM THE EYEBROWS rather than written as
 * prose, so a third axis moved behind this fold cannot leave a hand-written
 * sentence confidently listing two.
 */
export function describeTrendingFilters(activeFilterCount: number): TrendingFilterToggleCopy {
  const inside = `${TRENDING_FILTER_TOGGLE_LABEL}: ${TRENDING_FILTER_TIME_EYEBROW} ${TRENDING_FILTER_TAGS_EYEBROW}`;
  if (activeFilterCount <= 0) {
    return { label: TRENDING_FILTER_TOGGLE_LABEL, activeBadge: null, accessibilityLabel: inside };
  }
  const counted = activeFilterCount === 1 ? '1 filter actief' : `${activeFilterCount} filters actief`;
  return {
    label: TRENDING_FILTER_TOGGLE_LABEL,
    activeBadge: counted,
    accessibilityLabel: `${inside} ${counted}.`,
  };
}

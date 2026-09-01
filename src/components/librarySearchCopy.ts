/**
 * Copy for "Mijn recepten"'s SECOND empty state — the one search adds — and
 * why it must never read like the first (recipes.tsx's own header: "Empty
 * is the honest first-run state"). A household with zero saved recipes and
 * a household with forty saved recipes whose search matched none are both
 * "nothing to show", and they are not the same sentence: the first-run
 * copy says "plak een link", which would be actively wrong advice to
 * someone who already has forty recipes and mistyped a search term. That
 * first-run copy stays exactly where it already lives, hardcoded inline in
 * recipes.tsx — it existed before search did, and nothing about shipping
 * search should have to touch it. This module owns only the state search
 * introduces: a non-empty library, a search that was actually run, zero
 * rows left standing.
 *
 * WHY THE BODY NAMES WHAT WAS TYPED. "Niets gevonden" alone leaves someone
 * staring at a dead end wondering whether the screen is broken; quoting the
 * search back ("Geen recepten gevonden voor "paella"") is the same courtesy
 * a browser's own not-found page gives, and it is proof the app actually
 * read what was typed rather than silently dropping it. A chip-only search
 * (no typed text, just dishTags/dishMoods/"snel") gets its own sentence
 * rather than an empty pair of quotation marks, because "voor """ reads as
 * a bug, not as an honest description of nothing.
 *
 * Tested directly rather than left inside a `.tsx`, for the reason every
 * sibling `*Copy.ts` module in this directory gives (see
 * libraryTileActionCopy.ts): vitest's `node` environment has react-native
 * stubbed, so a sentence written inside a component is a sentence nothing
 * can assert.
 */

import type { LibrarySearchState } from '@/domain/recipeSearch';

export interface LibrarySearchEmptyCopy {
  readonly title: string;
  readonly body: string;
  /** The one recovery this state ever offers: clear everything and look again. */
  readonly actionLabel: string;
}

const LIBRARY_SEARCH_EMPTY_TITLE = 'Niets gevonden';
const LIBRARY_SEARCH_EMPTY_ACTION_LABEL = 'Wis zoekopdracht';

function hasChipFilters(search: LibrarySearchState): boolean {
  return search.requiredDishTags.length > 0 || search.anyDishMoods.length > 0 || search.quickOnly;
}

/**
 * Callers decide WHETHER this state applies (a non-empty library, a search
 * that returned zero rows) by comparing row counts before calling this —
 * nothing here re-derives that, so this function says nothing about
 * whether the library itself is empty. Pass any `search` for which
 * `isLibrarySearchActive` is true; the copy is undefined for
 * `NO_LIBRARY_SEARCH` because that state cannot legitimately produce zero
 * rows from a non-empty library.
 */
export function describeLibrarySearchEmpty(search: LibrarySearchState): LibrarySearchEmptyCopy {
  const query = search.query.trim();
  const hasQuery = query.length > 0;

  return {
    title: LIBRARY_SEARCH_EMPTY_TITLE,
    body: describeEmptyBody(query, hasQuery, hasChipFilters(search)),
    actionLabel: LIBRARY_SEARCH_EMPTY_ACTION_LABEL,
  };
}

function describeEmptyBody(query: string, hasQuery: boolean, hasFilters: boolean): string {
  if (hasQuery && hasFilters) {
    return `Geen recepten met “${query}” die aan je filters voldoen.`;
  }
  if (hasQuery) {
    return `Geen recepten gevonden voor “${query}”.`;
  }
  // Neither branch above matched, so this is a chip-only search — the
  // caller's contract (see this function's own comment) guarantees at
  // least one of the three was true.
  return 'Geen recepten voldoen aan deze filters.';
}

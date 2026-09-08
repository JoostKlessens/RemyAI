/**
 * Trending's filter — the reader-set narrowing added on 8 September 2026
 * (PD-014's amendment, src/components/trendingFilter.ts).
 *
 * The same split every `*Copy.ts` and `*Presentation.ts` module in this repo
 * uses, for the same reason: vitest runs `node` with react-native stubbed, so
 * a rule written inside `TrendingFilterBar.tsx` is a rule nothing can assert.
 * Everything this suite touches lives in a `.ts` module beside the component
 * precisely so it can be held here.
 *
 * THREE THINGS ARE PINNED THAT WOULD OTHERWISE REGRESS SILENTLY:
 *
 * 1. THE TIME ASYMMETRY. An explicit cap DROPS a recipe with no recorded
 *    duration. That rule is `exclusions.ts`'s, restated in this module rather
 *    than imported (its header says why), which means the only thing keeping
 *    the two in step is a test that states it out loud.
 * 2. THE NARROWING RULE. A selected chip must come back even when it has
 *    narrowed the feed to nothing, or a reader can strand themselves.
 * 3. THE DUTCH PLURAL, asserted EQUAL to Kiezen's rather than shared by
 *    import — decisionFilterCopy.ts argues at length for that posture, and
 *    "1 filters" is the one thing here a human can get wrong unnoticed.
 */

import { describe, expect, test } from 'vitest';
import {
  NO_TRENDING_FILTER,
  TRENDING_FILTER_EMPTY_BODY,
  TRENDING_FILTER_EMPTY_TITLE,
  TRENDING_FILTER_TOGGLE_LABEL,
  collectSelectableBoardDishTags,
  countTrendingFilters,
  describeTrendingDishTagChip,
  describeTrendingFilters,
  filterBoardRows,
  isTrendingFilterActive,
  toggleTrendingDishTag,
  type FilterableBoardRow,
  type TrendingFilterState,
} from '@/components/trendingFilter';
import {
  DECISION_FILTER_TOGGLE_LABEL,
  describeDecisionDishTagChip,
  describeDecisionFilters,
} from '@/components/decisionFilterCopy';

interface TestRow extends FilterableBoardRow {
  readonly recipeId: string;
}

function row(recipeId: string, dishTags: readonly string[], estimatedMinutes: number | null): TestRow {
  return { recipeId, dishTags, estimatedMinutes };
}

/**
 * The demo seed's own top three, in the order the board actually produces
 * them — measured against the local database on 8 September 2026 rather than
 * invented: population mean 7,861111 over 18 votes with a prior of 5, giving
 * Kip 8,04 (3 votes), Romige pasta 7,98 (4 votes), Rode linzensoep 7,66 (3
 * votes). Using the real shape means a test that passes here is a test about
 * the screen the owner is looking at.
 */
const SEEDED_BOARD: readonly TestRow[] = [
  row('recipe-kip', ['kip', 'ovenschotel'], 45),
  row('recipe-pasta', ['pasta', 'vegetarisch'], 25),
  row('recipe-linzen', ['soep', 'veganistisch'], 30),
];

function filter(overrides: Partial<TrendingFilterState> = {}): TrendingFilterState {
  return { ...NO_TRENDING_FILTER, ...overrides };
}

describe('filterBoardRows', () => {
  test('the no-filter identity returns the very same array', () => {
    expect(filterBoardRows(SEEDED_BOARD, NO_TRENDING_FILTER)).toBe(SEEDED_BOARD);
  });

  test('keeps only the cards carrying the chosen tag', () => {
    const kept = filterBoardRows(SEEDED_BOARD, filter({ requiredDishTags: ['soep'] }));
    expect(kept.map((entry) => entry.recipeId)).toEqual(['recipe-linzen']);
  });

  /**
   * AND, not OR — `filterByDecisionFilters`'s semantics, restated. Two chips
   * describe one dish; ORing them would make every extra tap widen the feed.
   */
  test('several tags mean all of them, never any of them', () => {
    const rows = [row('a', ['pasta', 'vegetarisch'], 25), row('b', ['pasta'], 25), row('c', ['vegetarisch'], 25)];
    const kept = filterBoardRows(rows, filter({ requiredDishTags: ['pasta', 'vegetarisch'] }));
    expect(kept.map((entry) => entry.recipeId)).toEqual(['a']);
  });

  /** `recipes.dish_tags` is written by an extraction model with no sanitizer in between, so a stray spelling must still compare. */
  test('normalizes both sides, so casing and diacritics still match', () => {
    const rows = [row('a', ['Púree'], 25)];
    expect(filterBoardRows(rows, filter({ requiredDishTags: ['puree'] }))).toHaveLength(1);
  });

  test('a cap keeps a recipe sitting exactly on the cap', () => {
    const kept = filterBoardRows(SEEDED_BOARD, filter({ maxMinutes: 30 }));
    expect(kept.map((entry) => entry.recipeId)).toEqual(['recipe-pasta', 'recipe-linzen']);
  });

  /**
   * THE DELIBERATE ASYMMETRY, and one of the reasons this suite exists. "Ik
   * heb 30 minuten" cannot honestly be answered with "possibly", so a recipe
   * whose duration nobody recorded loses under an explicit cap. exclusions.ts
   * spends a page on this; the rule is restated in trendingFilter.ts and this
   * is what keeps the two from drifting.
   */
  test('an explicit cap drops a recipe with no recorded duration', () => {
    const rows = [row('untimed', ['pasta'], null)];
    expect(filterBoardRows(rows, filter({ maxMinutes: 60 }))).toEqual([]);
  });

  test('no cap keeps that same recipe', () => {
    const rows = [row('untimed', ['pasta'], null)];
    expect(filterBoardRows(rows, filter({ requiredDishTags: ['pasta'] }))).toHaveLength(1);
  });

  /**
   * The property that keeps a reader-set filter clear of PD-014's sixth
   * condition: filtering narrows, it never promotes. Two readers with the
   * same chips set see the same cards in the same order.
   */
  test('never reorders what survives it', () => {
    const kept = filterBoardRows(SEEDED_BOARD, filter({ maxMinutes: 45 }));
    expect(kept.map((entry) => entry.recipeId)).toEqual(SEEDED_BOARD.map((entry) => entry.recipeId));
  });
});

describe('collectSelectableBoardDishTags', () => {
  test('offers every tag on the board when nothing is chosen', () => {
    expect([...collectSelectableBoardDishTags(SEEDED_BOARD, NO_TRENDING_FILTER)].sort()).toEqual([
      'kip',
      'ovenschotel',
      'pasta',
      'soep',
      'veganistisch',
      'vegetarisch',
    ]);
  });

  /**
   * LIB-07's rule for an AND axis: narrow WITH the selection included, so the
   * only tags offered are the ones a surviving card actually carries. Before
   * that rule existed, choosing "soep" left "pasta" and "kip" on screen — two
   * controls guaranteed to return nothing, indistinguishable from the ones
   * that work.
   */
  test('narrows to what the surviving cards carry', () => {
    const offered = collectSelectableBoardDishTags(SEEDED_BOARD, filter({ requiredDishTags: ['soep'] }));
    expect([...offered].sort()).toEqual(['soep', 'veganistisch']);
    expect(offered).not.toContain('pasta');
  });

  /**
   * THE GUARD THAT STOPS A READER STRANDING THEMSELVES. A state that empties
   * the feed must still show the chip that undoes it — otherwise the only way
   * back is "Wissen", and on a screen whose drawer can be shut that is a worse
   * gesture than un-tapping the thing you tapped.
   */
  test('offers a selected tag back even when it has emptied the feed', () => {
    const emptied = filter({ requiredDishTags: ['soep'], maxMinutes: 20 });
    expect(filterBoardRows(SEEDED_BOARD, emptied)).toEqual([]);
    expect(collectSelectableBoardDishTags(SEEDED_BOARD, emptied)).toContain('soep');
  });

  /**
   * NO CHIP CAN EMPTY THE FEED ON ITS OWN, which is what pays for filtering
   * after the top-25 cut rather than before it: a reader cannot tap their way
   * to an empty screen and read it as "geen soep in de app". Asserted over
   * every tag the row would offer, rather than over one, because the property
   * is about the row and not about a chip somebody happened to pick.
   */
  test('no single offered chip can empty the feed', () => {
    for (const tag of collectSelectableBoardDishTags(SEEDED_BOARD, NO_TRENDING_FILTER)) {
      expect(filterBoardRows(SEEDED_BOARD, filter({ requiredDishTags: [tag] })).length).toBeGreaterThan(0);
    }
  });

  /**
   * ⚠ THE TIME LADDER IS THE EXCEPTION, AND IT IS PINNED SO NOBODY WRITES THE
   * REASSURING VERSION AGAIN. An earlier draft of trendingFilter.ts's header
   * claimed only a COMBINATION could empty this feed; that was false.
   * `TimeCapPicker` is a continuous ladder with nothing to intersect, so a cap
   * alone empties it — measured on the demo seed, whose three over-floor
   * recipes take 45, 25 and 30 minutes.
   */
  test('the time cap alone can empty the feed, where no chip can', () => {
    expect(filterBoardRows(SEEDED_BOARD, filter({ maxMinutes: 20 }))).toEqual([]);
  });

  /** A card with no tags at all is the ordinary case, and it must contribute no chip rather than an empty one. */
  test('an untagged card adds nothing to the row', () => {
    const rows = [row('untagged', [], 25), row('pasta', ['pasta'], 25)];
    expect(collectSelectableBoardDishTags(rows, NO_TRENDING_FILTER)).toEqual(['pasta']);
  });
});

describe('toggleTrendingDishTag', () => {
  test('adds a tag without mutating the filter it was handed', () => {
    const before = NO_TRENDING_FILTER;
    const after = toggleTrendingDishTag(before, 'soep');
    expect(after.requiredDishTags).toEqual(['soep']);
    expect(before.requiredDishTags).toEqual([]);
  });

  test('removes a tag that is already chosen', () => {
    const after = toggleTrendingDishTag(filter({ requiredDishTags: ['soep', 'pasta'] }), 'soep');
    expect(after.requiredDishTags).toEqual(['pasta']);
  });

  test('removes a tag that was stored with a different spelling', () => {
    const after = toggleTrendingDishTag(filter({ requiredDishTags: ['Púree'] }), 'puree');
    expect(after.requiredDishTags).toEqual([]);
  });

  test('leaves the time cap alone', () => {
    expect(toggleTrendingDishTag(filter({ maxMinutes: 30 }), 'soep').maxMinutes).toBe(30);
  });
});

describe('countTrendingFilters', () => {
  test('counts nothing when nothing is set', () => {
    expect(countTrendingFilters(NO_TRENDING_FILTER)).toBe(0);
    expect(isTrendingFilterActive(NO_TRENDING_FILTER)).toBe(false);
  });

  test('counts the cap as one and every tag as one', () => {
    expect(countTrendingFilters(filter({ maxMinutes: 30, requiredDishTags: ['soep', 'pasta'] }))).toBe(3);
  });

  /** `null` is "no cap stated", never "a cap of zero" — a zero here would count a filter nobody set. */
  test('a null cap is not a filter', () => {
    expect(countTrendingFilters(filter({ maxMinutes: null }))).toBe(0);
  });

  test('a cap of zero minutes still counts, because somebody set it', () => {
    expect(countTrendingFilters(filter({ maxMinutes: 0 }))).toBe(1);
  });
});

describe('the filter copy', () => {
  test('no badge when nothing is set, so the absence says it once', () => {
    expect(describeTrendingFilters(0).activeBadge).toBeNull();
    expect(describeTrendingFilters(0).accessibilityLabel).not.toContain('actief');
  });

  test('names what is inside the fold, so a shut drawer can still be read aloud', () => {
    const spoken = describeTrendingFilters(0).accessibilityLabel;
    expect(spoken).toContain('Hoeveel tijd?');
    expect(spoken).toContain('Ingrediënten');
  });

  /**
   * ⚠ IT MUST NOT ANNOUNCE A MOOD ROW. That is the one axis this screen
   * cannot have — `recipes` has no `dish_moods` column, 0010 added it to
   * `meals` alone — and the sentence is composed from the eyebrows precisely
   * so an axis that does not exist cannot appear in it.
   */
  test('never announces an axis this surface does not have', () => {
    expect(describeTrendingFilters(2).accessibilityLabel).not.toContain('zin in');
  });

  /**
   * The duplicate that is deliberate AND pinned. Sharing the constants was
   * rejected (see trendingFilter.ts and decisionFilterCopy.ts); asserting the
   * two are EQUAL is the claim that is actually true, and it fails loudly the
   * day one screen learns a plural the other did not.
   */
  test('counts filters in exactly the words Kiezen uses', () => {
    for (const count of [-1, 0, 1, 2, 5, 17]) {
      expect(describeTrendingFilters(count).activeBadge).toBe(describeDecisionFilters(count).activeBadge);
    }
  });

  test('uses the same word on the control as Kiezen does', () => {
    expect(TRENDING_FILTER_TOGGLE_LABEL).toBe(DECISION_FILTER_TOGGLE_LABEL);
  });

  test('speaks the AND semantics in the same sentence Kiezen speaks', () => {
    expect(describeTrendingDishTagChip('Soep')).toBe(describeDecisionDishTagChip('Soep'));
  });

  /**
   * THE ONE PIECE OF COPY ON THIS SCREEN THAT COULD TELL A LIE. The list is
   * cut to the top LEADERBOARD_MAX_ROWS before it is filtered, so an empty
   * result means "not on this list" and never "not in the app". The words
   * must therefore name the filter and the list and nothing else.
   */
  test('the filtered-out state names the filter and the list, never the world', () => {
    expect(TRENDING_FILTER_EMPTY_TITLE).toBe('Niets binnen dit filter');
    expect(TRENDING_FILTER_EMPTY_BODY).toContain('in deze lijst');
    expect(TRENDING_FILTER_EMPTY_BODY).not.toContain('bestaat');
  });

  /** It also has to say what undoes it, because the state is only reachable by a combination. */
  test('the filtered-out state points at the one tap that undoes it', () => {
    expect(TRENDING_FILTER_EMPTY_BODY).toContain('Zet er een uit');
  });
});

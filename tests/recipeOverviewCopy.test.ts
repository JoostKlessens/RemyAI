/**
 * The recipe overview screen's Dutch and its four assemblies
 * (src/components/recipeOverviewCopy.ts).
 *
 * WHY THESE ARE HELD TO ANYTHING. Two of the builders below decide what the
 * screen SAYS ABOUT PROVENANCE, and that is the part a route module must not
 * be trusted with. `Meal.sourcePlatform` is a two-word column
 * (`'tiktok' | 'reels' | null`) that a five-member `ImportPlatform` union
 * feeds — `toMealDraft.ts` maps YouTube, web, pasted text and photographed
 * recipes all onto `null`, and states in its own header that this null means
 * "this column's vocabulary has no honest answer", NOT "unknown source". A
 * screen that read that null as "unknown" and printed a platform name anyway
 * would be inventing a fact about where a household's recipe came from,
 * which is exactly the defect that header describes replacing.
 *
 * The third and fourth builders keep the tag and mood rows inside their
 * closed vocabularies, so a stored value that never came through
 * `sanitizeDishTags` cannot reach the screen as a raw token.
 */

import { describe, expect, test } from 'vitest';
import {
  RECIPE_OVERVIEW_NO_INGREDIENTS,
  RECIPE_OVERVIEW_NO_STEPS,
  RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_ANNOUNCEMENT,
  RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_NOTE,
  RECIPE_OVERVIEW_STRINGS,
  buildRecipeOverviewMetaLine,
  describeRecipeOverviewSourceLink,
  readRecipeOverviewDishMoods,
  readRecipeOverviewDishTags,
} from '@/components/recipeOverviewCopy';

describe('buildRecipeOverviewMetaLine', () => {
  test('states both facts when both are known', () => {
    const line = buildRecipeOverviewMetaLine(25, 4);

    expect(line).toContain('25 min');
    expect(line).toContain('4 porties');
  });

  test('drops the half nobody stated rather than guessing it', () => {
    expect(buildRecipeOverviewMetaLine(25, null)).toBe('25 min');
    expect(buildRecipeOverviewMetaLine(null, 4)).toBe('4 porties');
  });

  test('is null when neither is known, so the row disappears instead of rendering empty', () => {
    expect(buildRecipeOverviewMetaLine(null, null)).toBeNull();
  });

  test('says "1 portie" for a single serving', () => {
    expect(buildRecipeOverviewMetaLine(null, 1)).toBe('1 portie');
  });
});

describe('describeRecipeOverviewSourceLink', () => {
  test('names TikTok, so the reader knows where the tap goes before it goes there', () => {
    const link = describeRecipeOverviewSourceLink('tiktok', 'https://www.tiktok.com/@kok/video/1');

    expect(link?.label).toContain('TikTok');
  });

  /**
   * `meals.source_platform` stores Instagram as `'reels'` — a column word
   * from 0001, not a brand. The reader is told the brand.
   */
  test("says Instagram where the column says 'reels'", () => {
    const link = describeRecipeOverviewSourceLink('reels', 'https://www.instagram.com/reel/abc');

    expect(link?.label).toContain('Instagram');
    expect(link?.label).not.toContain('reels');
  });

  /**
   * THE CASE THIS BUILDER EXISTS FOR. A YouTube or web import stores
   * `sourcePlatform: null` beside a perfectly real `sourceUrl`
   * (toMealDraft.ts's `toMealSourcePlatform`). The link must still be
   * offered — the recipe genuinely has an origin — and it must not name a
   * platform nobody stored.
   */
  test('still offers the link when the column had no word for the platform', () => {
    const link = describeRecipeOverviewSourceLink(null, 'https://example.com/recept');

    expect(link).not.toBeNull();
    expect(link?.label).not.toContain('TikTok');
    expect(link?.label).not.toContain('Instagram');
  });

  test('is null when there is no address at all', () => {
    // Manual entry, a pasted-text import (SRC-08) and a photographed recipe
    // (SRC-07) all land here. There is nothing to open, so there is no row.
    expect(describeRecipeOverviewSourceLink(null, null)).toBeNull();
    expect(describeRecipeOverviewSourceLink('tiktok', null)).toBeNull();
  });

  test('the spoken label says it leaves the app', () => {
    const link = describeRecipeOverviewSourceLink('tiktok', 'https://www.tiktok.com/@kok/video/1');

    expect(link?.accessibilityLabel).toContain('Opent');
  });
});

describe('readRecipeOverviewDishTags', () => {
  test('turns stored tags into the labels the library already shows', () => {
    expect(readRecipeOverviewDishTags(['pasta', 'vegetarisch']).map((entry) => entry.label)).toEqual([
      'Pasta',
      'Vegetarisch',
    ]);
  });

  /**
   * `DISH_TAGS` order, not the stored array's. Two dishes carrying the same
   * two categories must show them the same way round, or the rows look like
   * they mean different things. Same device `LibrarySearchBar` uses.
   */
  test('reads in the vocabulary order, not the order the row happened to store', () => {
    expect(readRecipeOverviewDishTags(['vegetarisch', 'pasta']).map((entry) => entry.tag)).toEqual([
      'pasta',
      'vegetarisch',
    ]);
  });

  test('drops a value the closed vocabulary does not contain', () => {
    // `sanitizeDishTags` is what writes this column, so anything outside the
    // vocabulary never came through a supported path. Rendering the raw
    // token beside two product labels would read as a bug, not as data.
    expect(readRecipeOverviewDishTags(['pasta', 'lasagne-achtig'])).toHaveLength(1);
  });

  test('is empty for a dish nobody categorised', () => {
    expect(readRecipeOverviewDishTags([])).toEqual([]);
  });
});

describe('readRecipeOverviewDishMoods', () => {
  test('turns stored moods into their labels, in vocabulary order', () => {
    expect(readRecipeOverviewDishMoods(['soul-food', 'winters']).map((entry) => entry.label)).toEqual([
      'Winters',
      'Soul food',
    ]);
  });

  test('drops a value outside the closed vocabulary', () => {
    expect(readRecipeOverviewDishMoods(['winters', 'gezellig'])).toHaveLength(1);
  });
});

describe('the source link failure sentences', () => {
  /**
   * The link's LABEL names a platform, because the reader is about to leave
   * for it. Its FAILURE does not, because a failure to open is about this
   * device — no browser, no app, a malformed stored URL — and naming TikTok
   * would blame a service that was never reached.
   */
  test('neither blames the platform the link points at', () => {
    for (const sentence of [
      RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_ANNOUNCEMENT,
      RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_NOTE,
    ]) {
      expect(sentence).not.toContain('TikTok');
      expect(sentence).not.toContain('Instagram');
    }
  });

  test('the visible note offers the retry the row actually is', () => {
    expect(RECIPE_OVERVIEW_SOURCE_OPEN_FAILED_NOTE).toContain('opnieuw');
  });
});

describe('the empty-section sentences', () => {
  /**
   * They differ from the friend screen's on purpose. There, an absent
   * ingredient list is somebody else's recipe and the only honest advice is
   * "watch the video". Here it is the household's OWN copy, and the fix is a
   * screen they can reach from this one — so the sentence names it.
   */
  test('both point at the repair rather than at a video', () => {
    expect(RECIPE_OVERVIEW_NO_INGREDIENTS).toContain('Aanpassen');
    expect(RECIPE_OVERVIEW_NO_STEPS).toContain('Aanpassen');
  });

  test('neither blames the extraction or the creator', () => {
    for (const sentence of [RECIPE_OVERVIEW_NO_INGREDIENTS, RECIPE_OVERVIEW_NO_STEPS]) {
      expect(sentence.toLowerCase()).not.toContain('mislukt');
      expect(sentence.toLowerCase()).not.toContain('maker');
    }
  });
});

/**
 * PD-006 / PD-007a, applied to a surface that shows an ingredient list. This
 * screen carries no allergen verdict at all — the tri-state lives on the
 * meal and is spent where somebody is choosing, not where they are reading
 * their own recipe — so the one thing it must never do is imply one.
 */
describe('nothing on this screen claims a dish is safe', () => {
  test('no string uses the reassuring framing PD-006 forbids', () => {
    for (const value of RECIPE_OVERVIEW_STRINGS) {
      expect(value.toLowerCase()).not.toContain('veilig');
      expect(value.toLowerCase()).not.toContain('gecontroleerd');
    }
  });
});

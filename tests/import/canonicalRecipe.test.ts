import { describe, expect, test } from 'vitest';
import {
  buildRecipeIngredientRows,
  buildRecipeRowInsert,
  buildRecipeStepRows,
  canStoreCanonicalRecipe,
  parseStoredRecipe,
} from '@/domain/import/canonicalRecipe';
import type { ImportAttribution } from '@/domain/import/types';
import { makeParsedIngredient, makeParsedRecipe } from './fixtures';

const ATTRIBUTION: ImportAttribution = {
  authorName: 'Chef Remy',
  authorUrl: 'https://www.tiktok.com/@chefremy',
  thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
};

const CONTEXT = {
  normalizedUrl: 'https://www.tiktok.com/@chefremy/video/123',
  platform: 'tiktok' as const,
  attribution: ATTRIBUTION,
};

const RECIPE_ID = '11111111-2222-3333-4444-555555555555';

/**
 * A well-formed `recipes` row as PostgREST returns it, with its two child
 * tables embedded. Built locally rather than in tests/import/fixtures.ts:
 * this is a database row shape, not a domain type, and only this suite
 * has any business knowing it.
 */
function makeStoredRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RECIPE_ID,
    normalized_url: 'https://www.tiktok.com/@chefremy/video/123',
    platform: 'tiktok',
    title: 'Traybake met kip en citroen',
    thumbnail_url: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
    estimated_minutes: 25,
    servings: 4,
    author_name: 'Chef Remy',
    author_url: 'https://www.tiktok.com/@chefremy',
    dish_tags: ['kip'],
    recipe_ingredients: [{ name: 'Kipfilet', quantity: '300', unit: 'g', sort_order: 0 }],
    recipe_steps: [
      { step_number: 1, instruction: 'Oven voorverwarmen op 200 graden.' },
      { step_number: 2, instruction: 'Kip en groenten 25 minuten roosteren.' },
    ],
    ...overrides,
  };
}

describe('buildRecipeRowInsert — PD-006 guarantee', () => {
  test('produces no allergen column of any kind', () => {
    const row = buildRecipeRowInsert(makeParsedRecipe(), CONTEXT);
    const allergenKeys = Object.keys(row).filter((key) => key.includes('allergen'));
    expect(allergenKeys).toEqual([]);
  });

  test('produces exactly the nine canonical columns and nothing more', () => {
    const row = buildRecipeRowInsert(makeParsedRecipe(), CONTEXT);
    expect(Object.keys(row).sort()).toEqual([
      'author_name',
      'author_url',
      'dish_tags',
      'estimated_minutes',
      'normalized_url',
      'platform',
      'servings',
      'thumbnail_url',
      'title',
    ]);
  });

  test('carries dish_tags — the one model-derived tagging that is not allergen data', () => {
    const row = buildRecipeRowInsert(makeParsedRecipe({ dishTags: ['pasta', 'vegetarisch'] }), CONTEXT);
    expect(row.dish_tags).toEqual(['pasta', 'vegetarisch']);
  });

  /**
   * This replaces a test that passed `dishTags: undefined` to stand in for
   * "a recipe literal written before the field existed". That state is
   * gone: `ParsedRecipe.dishTags` is required now, so the row builder no
   * longer coalesces and there is no `undefined` left to defend against.
   * What still matters is that a recipe with genuinely no categories
   * writes `[]` and not something invented — the column is
   * `not null default '{}'` (0004_dish_tags.sql), and an empty array is
   * the honest value for it.
   */
  test('writes an empty dish_tags array for a recipe with no categories, never a guessed one', () => {
    const row = buildRecipeRowInsert(makeParsedRecipe({ title: 'Restjespasta', dishTags: [] }), CONTEXT);
    expect(row.dish_tags).toEqual([]);
  });
});

describe('buildRecipeRowInsert — field mapping', () => {
  test('takes normalized_url and platform from the context, never from the recipe', () => {
    const row = buildRecipeRowInsert(makeParsedRecipe(), {
      ...CONTEXT,
      normalizedUrl: 'https://www.instagram.com/reel/abc',
      platform: 'instagram',
    });
    expect(row.normalized_url).toBe('https://www.instagram.com/reel/abc');
    expect(row.platform).toBe('instagram');
  });

  test('takes title, estimated_minutes and servings from the recipe', () => {
    const row = buildRecipeRowInsert(
      makeParsedRecipe({ title: 'Pasta pesto', estimatedMinutes: 15, servings: 2 }),
      CONTEXT,
    );
    expect(row.title).toBe('Pasta pesto');
    expect(row.estimated_minutes).toBe(15);
    expect(row.servings).toBe(2);
  });

  test('takes thumbnail_url, author_name and author_url from the attribution', () => {
    const row = buildRecipeRowInsert(makeParsedRecipe(), CONTEXT);
    expect(row.thumbnail_url).toBe('https://p16-sign.tiktokcdn.com/thumb.jpg');
    expect(row.author_name).toBe('Chef Remy');
    expect(row.author_url).toBe('https://www.tiktok.com/@chefremy');
  });

  test('carries every nullable field through as null rather than dropping the key', () => {
    const row = buildRecipeRowInsert(makeParsedRecipe({ estimatedMinutes: null, servings: null }), {
      ...CONTEXT,
      attribution: { authorName: null, authorUrl: null, thumbnailUrl: null },
    });
    expect(row.estimated_minutes).toBeNull();
    expect(row.servings).toBeNull();
    expect(row.author_name).toBeNull();
    expect(row.author_url).toBeNull();
    expect(row.thumbnail_url).toBeNull();
  });
});

describe('buildRecipeIngredientRows', () => {
  test('emits one row per ingredient with 0-based sort_order in caption order', () => {
    const rows = buildRecipeIngredientRows(
      RECIPE_ID,
      makeParsedRecipe({
        ingredients: [
          makeParsedIngredient({ name: 'Kipfilet' }),
          makeParsedIngredient({ name: 'Citroen' }),
          makeParsedIngredient({ name: 'Olijfolie' }),
        ],
      }),
    );
    expect(rows.map((row) => row.name)).toEqual(['Kipfilet', 'Citroen', 'Olijfolie']);
    expect(rows.map((row) => row.sort_order)).toEqual([0, 1, 2]);
  });

  test('attaches the given recipe_id to every row', () => {
    const rows = buildRecipeIngredientRows(
      RECIPE_ID,
      makeParsedRecipe({ ingredients: [makeParsedIngredient(), makeParsedIngredient({ name: 'Citroen' })] }),
    );
    expect(rows.every((row) => row.recipe_id === RECIPE_ID)).toBe(true);
  });

  test('carries a null quantity and unit through unchanged', () => {
    const rows = buildRecipeIngredientRows(
      RECIPE_ID,
      makeParsedRecipe({ ingredients: [makeParsedIngredient({ quantity: null, unit: null })] }),
    );
    expect(rows[0]?.quantity).toBeNull();
    expect(rows[0]?.unit).toBeNull();
  });

  test('emits no allergen column — allergen tagging is never derived here', () => {
    const rows = buildRecipeIngredientRows(RECIPE_ID, makeParsedRecipe());
    expect(Object.keys(rows[0] ?? {}).filter((key) => key.includes('allergen'))).toEqual([]);
  });
});

describe('buildRecipeStepRows', () => {
  test('numbers steps from 1, in caption order', () => {
    const rows = buildRecipeStepRows(RECIPE_ID, makeParsedRecipe({ steps: ['Eerst', 'Dan', 'Tot slot'] }));
    expect(rows.map((row) => row.step_number)).toEqual([1, 2, 3]);
    expect(rows.map((row) => row.instruction)).toEqual(['Eerst', 'Dan', 'Tot slot']);
  });

  test('attaches the given recipe_id to every row', () => {
    const rows = buildRecipeStepRows(RECIPE_ID, makeParsedRecipe({ steps: ['Eerst', 'Dan'] }));
    expect(rows.every((row) => row.recipe_id === RECIPE_ID)).toBe(true);
  });
});

describe('parseStoredRecipe — a cache hit is indistinguishable from a fresh import', () => {
  test('reconstructs a full "parsed" result from a well-formed row', () => {
    const result = parseStoredRecipe(makeStoredRow());
    expect(result).toEqual({
      kind: 'parsed',
      recipe: {
        title: 'Traybake met kip en citroen',
        ingredients: [{ name: 'Kipfilet', quantity: '300', unit: 'g' }],
        steps: ['Oven voorverwarmen op 200 graden.', 'Kip en groenten 25 minuten roosteren.'],
        estimatedMinutes: 25,
        servings: 4,
        dishTags: ['kip'],
      },
      recipeId: RECIPE_ID,
      sourceUrl: 'https://www.tiktok.com/@chefremy/video/123',
      platform: 'tiktok',
      attribution: {
        authorName: 'Chef Remy',
        authorUrl: 'https://www.tiktok.com/@chefremy',
        thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
      },
      provenance: 'model_from_caption',
    });
  });

  /**
   * W-01b, and the whole reason the cache exists at all for the social
   * half of the product: the twentieth household to import a link must
   * end up pointing at the SAME `recipes` row as the first, because that
   * shared row is the only object a friend's cook can be joined to
   * (`shared_cooks`, 0009). A hit that returned the recipe but not its id
   * would silently produce a meal that is a copy of nothing.
   */
  test('carries the stored row own id home as recipeId', () => {
    const result = parseStoredRecipe(makeStoredRow());
    expect(result?.kind === 'parsed' && result.recipeId).toBe(RECIPE_ID);
  });

  test('takes recipeId from the id column, never from the normalized_url that keys the row', () => {
    const result = parseStoredRecipe(makeStoredRow({ id: 'a-different-row', normalized_url: 'https://x.test/1' }));
    expect(result?.kind === 'parsed' && result.recipeId).toBe('a-different-row');
  });

  test('gives two separate reads of one row the same canonical id', () => {
    const first = parseStoredRecipe(makeStoredRow());
    const second = parseStoredRecipe(makeStoredRow());
    expect(first?.kind === 'parsed' && first.recipeId).toBe(second?.kind === 'parsed' ? second.recipeId : null);
  });

  test('takes sourceUrl from normalized_url — the deduplication key itself', () => {
    const result = parseStoredRecipe(
      makeStoredRow({ normalized_url: 'https://www.instagram.com/reel/xyz', platform: 'instagram' }),
    );
    expect(result).not.toBeNull();
    expect(result?.kind === 'parsed' && result.sourceUrl).toBe('https://www.instagram.com/reel/xyz');
    expect(result?.kind === 'parsed' && result.platform).toBe('instagram');
  });

  test('always returns a populated attribution object, even when every author column is null', () => {
    const result = parseStoredRecipe(makeStoredRow({ author_name: null, author_url: null, thumbnail_url: null }));
    expect(result?.kind === 'parsed' && result.attribution).toEqual({
      authorName: null,
      authorUrl: null,
      thumbnailUrl: null,
    });
  });

  test('reads a whitespace-only author column as a real null, not as a name made of spaces', () => {
    const result = parseStoredRecipe(makeStoredRow({ author_name: '   ' }));
    expect(result?.kind === 'parsed' && result.attribution?.authorName).toBeNull();
  });

  test('carries a null estimated_minutes and servings through as null', () => {
    const result = parseStoredRecipe(makeStoredRow({ estimated_minutes: null, servings: null }));
    expect(result?.kind === 'parsed' && result.recipe.estimatedMinutes).toBeNull();
    expect(result?.kind === 'parsed' && result.recipe.servings).toBeNull();
  });

  test('carries a stored recipe with no allergen data whatsoever — there is none to inherit', () => {
    const result = parseStoredRecipe(makeStoredRow());
    expect(JSON.stringify(result)).not.toContain('allergen');
  });

  test('reads dish_tags back onto the recipe, so a hit is not a less-tagged import than a miss', () => {
    const result = parseStoredRecipe(makeStoredRow({ dish_tags: ['pasta', 'vegetarisch'] }));
    expect(result?.kind === 'parsed' && result.recipe.dishTags).toEqual(['pasta', 'vegetarisch']);
  });

  test('treats a missing or empty dish_tags column as an empty list, not a failure', () => {
    expect(parseStoredRecipe(makeStoredRow({ dish_tags: [] }))?.kind === 'parsed').toBe(true);
    expect(parseStoredRecipe(makeStoredRow({ dish_tags: undefined }))?.kind === 'parsed').toBe(true);
  });

  test('drops a stored dish tag that has since left the vocabulary, keeping the recipe', () => {
    const result = parseStoredRecipe(makeStoredRow({ dish_tags: ['kip', 'italiaans'] }));
    expect(result?.kind === 'parsed' && result.recipe.dishTags).toEqual(['kip']);
  });
});

/**
 * RCP-06 on the cache path. A stored row records no provenance and this
 * change adds no column for one, so the answer is DEDUCED from what
 * `canStoreCanonicalRecipe` permits: only TikTok can actually put a row in
 * this table (Instagram being display-only, PD-011), and the TikTok route
 * is the caption route. See `STORED_ROW_PROVENANCE` in canonicalRecipe.ts
 * for the full chain and for what breaks it.
 */
describe('parseStoredRecipe — provenance is deduced from the storability guard, never stored', () => {
  test('reports a cache hit as a model reading of a caption', () => {
    const result = parseStoredRecipe(makeStoredRow());
    expect(result?.kind === 'parsed' && result.provenance).toBe('model_from_caption');
  });

  /**
   * The deduction rests on the guard, not on the row, so a row cannot talk
   * this function out of it — and equally cannot talk it INTO a different
   * answer. A `provenance` column smuggled onto the row (by a future
   * schema, or by a hand-written test) is not read: the day such a column
   * exists is the day this line is meant to change deliberately, in the
   * same commit as the migration, not the day it starts silently
   * believing whatever the database says.
   */
  test('ignores a provenance-shaped column a row tries to supply', () => {
    const result = parseStoredRecipe(makeStoredRow({ provenance: 'publisher_structured_data' }));
    expect(result?.kind === 'parsed' && result.provenance).toBe('model_from_caption');
  });

  /**
   * THE TRIPWIRE. This asserts the premise the deduction rests on rather
   * than the deduction itself: `'model_from_caption'` is honest only while
   * `canStoreCanonicalRecipe` refuses `'web'`, because a stored web row
   * would have come from a publisher's JSON-LD. If the pending
   * `recipes.platform` migration ever widens that CHECK, this test fails
   * first and points at the line that has to change with it.
   */
  test('still refuses to store the one platform whose provenance would differ', () => {
    expect(canStoreCanonicalRecipe('web')).toBe(false);
    expect(canStoreCanonicalRecipe('tiktok')).toBe(true);
  });
});

describe('parseStoredRecipe — ordering is never trusted to the database', () => {
  test('sorts ingredients by sort_order regardless of the array order received', () => {
    const result = parseStoredRecipe(
      makeStoredRow({
        recipe_ingredients: [
          { name: 'Olijfolie', quantity: null, unit: null, sort_order: 2 },
          { name: 'Kipfilet', quantity: '300', unit: 'g', sort_order: 0 },
          { name: 'Citroen', quantity: '1', unit: null, sort_order: 1 },
        ],
      }),
    );
    expect(result?.kind === 'parsed' && result.recipe.ingredients.map((i) => i.name)).toEqual([
      'Kipfilet',
      'Citroen',
      'Olijfolie',
    ]);
  });

  test('sorts steps by step_number regardless of the array order received', () => {
    const result = parseStoredRecipe(
      makeStoredRow({
        recipe_steps: [
          { step_number: 3, instruction: 'Tot slot' },
          { step_number: 1, instruction: 'Eerst' },
          { step_number: 2, instruction: 'Dan' },
        ],
      }),
    );
    expect(result?.kind === 'parsed' && result.recipe.steps).toEqual(['Eerst', 'Dan', 'Tot slot']);
  });
});

describe('parseStoredRecipe — any structural doubt degrades to a cache miss', () => {
  test('returns null for a non-record input', () => {
    expect(parseStoredRecipe(null)).toBeNull();
    expect(parseStoredRecipe('a row')).toBeNull();
    expect(parseStoredRecipe(undefined)).toBeNull();
  });

  /**
   * A `recipes` row always has an id — it is the primary key — so a row
   * arriving without one means the SELECT forgot to ask for it. Rejecting
   * the row makes that a loud, self-correcting cache miss; carrying a null
   * recipeId instead would hand every importer of that URL a meal linked
   * to nothing, forever, with nothing to notice.
   */
  test('returns null when the id column is missing, blank, or not a string', () => {
    expect(parseStoredRecipe(makeStoredRow({ id: undefined }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ id: '   ' }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ id: null }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ id: 42 }))).toBeNull();
  });

  test('returns null when normalized_url is missing or blank', () => {
    expect(parseStoredRecipe(makeStoredRow({ normalized_url: undefined }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ normalized_url: '   ' }))).toBeNull();
  });

  test('returns null for a platform outside the import vocabulary', () => {
    // 'reels' is the social layer's meal_source_platform vocabulary, not the
    // importer's — a stored row carrying it is a row written by the wrong
    // writer, which is exactly what this guard exists to catch.
    expect(parseStoredRecipe(makeStoredRow({ platform: 'reels' }))).toBeNull();
    // Deliberately NOT 'youtube', which this test used to assert against:
    // youtube joined ImportPlatform when YouTube URLs became importable, so
    // it now belongs in the accepted case below. These two are the platforms
    // a stored row could plausibly name that we still do not import.
    expect(parseStoredRecipe(makeStoredRow({ platform: 'pinterest' }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ platform: 'facebook' }))).toBeNull();
  });

  test('accepts youtube, now that it is part of the import vocabulary', () => {
    const result = parseStoredRecipe(makeStoredRow({ platform: 'youtube' }));
    expect(result?.kind === 'parsed' && result.platform).toBe('youtube');
  });

  /**
   * READING a `'web'` row is correct even though WRITING one is currently
   * impossible: `recipes.platform`'s CHECK constraint refuses it today
   * (see `canStoreCanonicalRecipe`), so such a row can only exist in a
   * future where that migration was written — and a reader that rejected
   * it would turn the first day of that future into a silent cache miss on
   * every web import. The vocabulary guard and the write gate are separate
   * questions and must not be collapsed into one list.
   */
  test('accepts web, so a row written after the constraint is widened still reads back', () => {
    const result = parseStoredRecipe(makeStoredRow({ platform: 'web' }));
    expect(result?.kind === 'parsed' && result.platform).toBe('web');
  });

  test('returns null when the title is missing or blank', () => {
    expect(parseStoredRecipe(makeStoredRow({ title: undefined }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ title: '  ' }))).toBeNull();
  });

  test('returns null when the embedded child collections are missing or not arrays', () => {
    expect(parseStoredRecipe(makeStoredRow({ recipe_ingredients: undefined }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ recipe_steps: 'Eerst' }))).toBeNull();
  });

  test('returns null for a stored recipe with zero ingredients or zero steps', () => {
    expect(parseStoredRecipe(makeStoredRow({ recipe_ingredients: [] }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ recipe_steps: [] }))).toBeNull();
  });

  test('returns null when a child row carries no usable sort key', () => {
    expect(
      parseStoredRecipe(makeStoredRow({ recipe_ingredients: [{ name: 'Kipfilet', quantity: null, unit: null }] })),
    ).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ recipe_steps: [{ instruction: 'Eerst' }] }))).toBeNull();
  });

  test('returns null when a child row is not a record at all', () => {
    expect(parseStoredRecipe(makeStoredRow({ recipe_ingredients: ['Kipfilet'] }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ recipe_steps: [null] }))).toBeNull();
  });

  test('returns null when an author column holds something that is not a string', () => {
    expect(parseStoredRecipe(makeStoredRow({ author_name: 42 }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ author_url: { href: 'x' } }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ thumbnail_url: true }))).toBeNull();
  });

  test('returns null for a stored numeric field that no longer satisfies the domain rules', () => {
    expect(parseStoredRecipe(makeStoredRow({ estimated_minutes: 0 }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ servings: -2 }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ estimated_minutes: 12.5 }))).toBeNull();
  });

  test('returns null when dish_tags is a malformed container rather than a wrong word', () => {
    expect(parseStoredRecipe(makeStoredRow({ dish_tags: 'kip' }))).toBeNull();
    expect(parseStoredRecipe(makeStoredRow({ dish_tags: [7] }))).toBeNull();
  });

  test('returns null when an ingredient has no name', () => {
    expect(
      parseStoredRecipe(makeStoredRow({ recipe_ingredients: [{ quantity: '300', unit: 'g', sort_order: 0 }] })),
    ).toBeNull();
  });
});

describe('canonicalRecipe — the write and read halves agree', () => {
  test('a recipe written by the build functions reads back identically', () => {
    const recipe = makeParsedRecipe({
      title: 'Pasta pesto',
      ingredients: [
        makeParsedIngredient({ name: 'Pasta', quantity: '500', unit: 'g' }),
        makeParsedIngredient({ name: 'Pesto', quantity: null, unit: null }),
      ],
      steps: ['Pasta koken.', 'Pesto erdoor.'],
      estimatedMinutes: 15,
      servings: 2,
    });

    const parent = buildRecipeRowInsert(recipe, CONTEXT);
    const ingredients = buildRecipeIngredientRows(RECIPE_ID, recipe);
    const steps = buildRecipeStepRows(RECIPE_ID, recipe);

    const roundTripped = parseStoredRecipe({
      // `id` is database-generated, so it is absent from `parent` by
      // design and supplied here the way PostgREST supplies it on the way
      // back out. The children above were written against that same id —
      // which is precisely the claim this round trip is making: the id a
      // fresh import inserted under is the id a later cache hit hands the
      // next household.
      id: RECIPE_ID,
      ...parent,
      recipe_ingredients: ingredients.map(({ recipe_id: _recipeId, ...rest }) => rest),
      recipe_steps: steps.map(({ recipe_id: _recipeId, ...rest }) => rest),
    });

    expect(roundTripped?.kind === 'parsed' && roundTripped.recipe).toEqual(recipe);
    expect(roundTripped?.kind === 'parsed' && roundTripped.sourceUrl).toBe(CONTEXT.normalizedUrl);
    expect(roundTripped?.kind === 'parsed' && roundTripped.attribution).toEqual(ATTRIBUTION);
    expect(roundTripped?.kind === 'parsed' && roundTripped.recipeId).toBe(RECIPE_ID);
  });
});

/**
 * The `recipes` table's own ceiling, asserted at the boundary where it is
 * decided rather than left to whoever next writes an INSERT. The
 * constraint this mirrors is a schema fact, not a preference:
 *
 *   platform text not null check (platform in ('tiktok', 'instagram'))
 *      — supabase/migrations/0006_canonical_recipes.sql
 */
describe('canStoreCanonicalRecipe — the 0006 CHECK constraint, mirrored', () => {
  test('accepts exactly the two platforms the CHECK constraint names', () => {
    expect(canStoreCanonicalRecipe('tiktok')).toBe(true);
    expect(canStoreCanonicalRecipe('instagram')).toBe(true);
  });

  /**
   * Not "we would rather not cache these" — the column is NOT NULL and the
   * CHECK rejects both values, so the INSERT fails. The consequence is
   * real and permanent until someone widens the constraint: a YouTube or
   * web import reports `recipeId: null`, deduplicates against nothing, and
   * can never carry `shared_cooks` / FRIEND_PROOF_BOOST.
   */
  test('permits youtube since 0011, and still refuses web, which the column would reject outright', () => {
    // Arrange / Act / Assert
    // 0011 widened the CHECK to `'youtube'` and deliberately stopped there:
    // a video description is frozen, a web page is edited under a row we
    // cached. Asserting BOTH halves is the point — a change that widened
    // this to `'web'` without answering the staleness question, or that
    // failed to widen it to `'youtube'` at all, fails here.
    expect(canStoreCanonicalRecipe('youtube')).toBe(true);
    expect(canStoreCanonicalRecipe('web')).toBe(false);
  });

  /**
   * Pinned as a whole rather than platform by platform: this is the one
   * predicate in the import pipeline that must NOT track `ImportPlatform`
   * as it grows. A new platform is storable only once a migration says so,
   * so the safe default for a member nobody has considered is `false`, and
   * a change that widened this by accident would start writing rows the
   * database rejects.
   */
  test('is a three-member answer across the whole platform vocabulary, not a growing one', () => {
    const storable = (['tiktok', 'instagram', 'youtube', 'web'] as const).filter(canStoreCanonicalRecipe);
    expect(storable).toEqual(['tiktok', 'instagram', 'youtube']);
  });
});

/**
 * SRC-08. `'text'` is refused by this table for a reason no migration can
 * lift: a canonical recipe is keyed on a normalized URL and a pasted-text
 * import has none, so there is nothing to store it under and nothing for a
 * later import to match against. That makes it categorically different
 * from `'web'`, which is refused by a CHECK constraint somebody could widen
 * tomorrow — and from `'youtube'`, which somebody already did (0011).
 */
describe('canonicalRecipe — the pasted-text route has nothing to deduplicate against', () => {
  test('refuses to store a text import, permanently and not pending a migration', () => {
    expect(canStoreCanonicalRecipe('text')).toBe(false);
  });

  /**
   * The pinned list grows with the union deliberately: this predicate must
   * NOT track `ImportPlatform` as it gains members, so every new member
   * added to this array should still leave the answer at exactly two.
   */
  test('stays out of the answer even as the answer grows', () => {
    const storable = (['tiktok', 'instagram', 'youtube', 'web', 'text'] as const).filter(canStoreCanonicalRecipe);
    // 0011 grew this set by one member and `'text'` was not it, which is the
    // whole assertion: the set is opt-in, so a widening has to name what it
    // is admitting rather than sweeping in whatever else was in the union.
    expect(storable).toEqual(['tiktok', 'instagram', 'youtube']);
    expect(storable).not.toContain('text');
  });

  /**
   * The write gate and the read guard answer different questions for every
   * other platform — a `'web'` row is unwritable today but readable back
   * tomorrow. `'text'` is the one member where both answers are no, because
   * a row claiming it would have a `normalized_url` that the route it
   * names cannot have. A corrupt row is a cache MISS here, which is this
   * module's standing answer for one.
   */
  test('reads a stored row naming the text route as a cache miss rather than serving an incoherent result', () => {
    expect(parseStoredRecipe(makeStoredRow({ platform: 'text' }))).toBeNull();
  });

  /**
   * The deduction that every stored row came from the caption pipeline is
   * unaffected by the widening: the routes that could break it are still
   * the two the CHECK constraint refuses, and `'text'` cannot reach the
   * table at all.
   */
  test('leaves the stored-row provenance deduction intact for the rows that can exist', () => {
    const stored = parseStoredRecipe(makeStoredRow({ platform: 'tiktok' }));
    expect(stored?.kind === 'parsed' && stored.provenance).toBe('model_from_caption');
  });
});

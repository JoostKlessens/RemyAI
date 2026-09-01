import { describe, expect, test } from 'vitest';
import { toMealDraft } from '@/domain/import/toMealDraft';
import { makeParsedIngredient, makeParsedRecipe } from './fixtures';
import { EU_ALLERGEN_TAGS } from '@/domain/allergens';

const TIKTOK_CONTEXT = {
  householdId: 'household-1',
  sourceUrl: 'https://www.tiktok.com/@chefremy/video/123',
  platform: 'tiktok' as const,
  thumbnailUrl: 'https://p16-sign.tiktokcdn.com/thumb.jpg',
};

describe('toMealDraft — PD-006 guarantee', () => {
  test('always sets allergenTagStatus to the literal "unknown"', () => {
    const draft = toMealDraft(makeParsedRecipe(), TIKTOK_CONTEXT);
    expect(draft.allergenTagStatus).toBe('unknown');
  });

  test('always sets ingredientTags to an empty array, regardless of ingredient count', () => {
    const draft = toMealDraft(
      makeParsedRecipe({ ingredients: [makeParsedIngredient({ name: 'Pinda' }), makeParsedIngredient({ name: 'Noten' })] }),
      TIKTOK_CONTEXT,
    );
    expect(draft.ingredientTags).toEqual([]);
  });

  test('never sets skillLevel — left null for a human to set', () => {
    const draft = toMealDraft(makeParsedRecipe(), TIKTOK_CONTEXT);
    expect(draft.skillLevel).toBeNull();
  });

  /**
   * The one AI-derived tag field that DOES flow through this function, and
   * the reason the two must never be plumbed together: a dish category can
   * only ever narrow a search the user asked for, so an occasional wrong
   * one costs a missed result. `ingredientTags` drives the PD-006 exclusion
   * gate, where a wrong value costs someone a reaction. Same shape, wholly
   * different blast radius — hence one is populated from the model and the
   * other is hardcoded empty three lines away.
   */
  test('populating dishTags never leaks into ingredientTags, however many categories the model returned', () => {
    const draft = toMealDraft(makeParsedRecipe({ dishTags: ['pasta', 'vegetarisch', 'ovenschotel'] }), TIKTOK_CONTEXT);
    expect(draft.dishTags).toEqual(['pasta', 'vegetarisch', 'ovenschotel']);
    expect(draft.ingredientTags).toEqual([]);
    expect(draft.allergenTagStatus).toBe('unknown');
  });

  test('no dish tag it carries is ever an allergen literal', () => {
    const draft = toMealDraft(makeParsedRecipe({ dishTags: ['visgerecht', 'rijst'] }), TIKTOK_CONTEXT);
    for (const tag of draft.dishTags) {
      expect(EU_ALLERGEN_TAGS.has(tag)).toBe(false);
    }
  });
});

describe('toMealDraft — field mapping', () => {
  test('maps title, estimatedMinutes and servings straight through', () => {
    const recipe = makeParsedRecipe({ title: 'Pasta pesto', estimatedMinutes: 15, servings: 2 });
    const draft = toMealDraft(recipe, TIKTOK_CONTEXT);
    expect(draft.title).toBe('Pasta pesto');
    expect(draft.estimatedMinutes).toBe(15);
    expect(draft.servings).toBe(2);
  });

  test('sets source to "saved"', () => {
    expect(toMealDraft(makeParsedRecipe(), TIKTOK_CONTEXT).source).toBe('saved');
  });

  test('carries dishTags straight through from the validated recipe, never re-derived from the title', () => {
    const draft = toMealDraft(makeParsedRecipe({ title: 'Pasta pesto', dishTags: ['soep'] }), TIKTOK_CONTEXT);
    expect(draft.dishTags).toEqual(['soep']);
  });

  test('carries an empty dishTags list through as empty — no fallback category is guessed', () => {
    expect(toMealDraft(makeParsedRecipe({ dishTags: [] }), TIKTOK_CONTEXT).dishTags).toEqual([]);
  });

  /**
   * THIS TEST REPLACES ONE THAT CAN NO LONGER BE WRITTEN, and the reason
   * it cannot is the fix. It used to strip `dishTags` off a recipe
   * literal and assert the draft came out with `[]`, because
   * `ParsedRecipe.dishTags` was optional and `buildEditedRecipe` in
   * src/app/import/confirm.tsx really did rebuild a recipe without it —
   * silently deleting a user's categories the moment they edited an
   * imported recipe. The field is required now, so a recipe with no
   * `dishTags` key is not a case to be handled, it is a compile error,
   * and `toMealDraft` no longer coalesces.
   *
   * What is left to assert is that the draft never invents categories of
   * its own for a recipe that honestly has none — the half of the old
   * test that was about this module rather than about that bug.
   */
  test('carries a genuinely empty category list into the draft, never a guessed one', () => {
    const draft = toMealDraft(makeParsedRecipe({ title: 'Pasta pesto', dishTags: [] }), TIKTOK_CONTEXT);
    expect(draft.dishTags).toEqual([]);
    expect(draft.ingredientTags).toEqual([]);
  });

  test('passes householdId and sourceUrl through from context, independent of the recipe', () => {
    const draft = toMealDraft(makeParsedRecipe(), {
      householdId: 'household-xyz',
      sourceUrl: 'https://www.tiktok.com/@someone/video/999',
      platform: 'tiktok',
      thumbnailUrl: null,
    });
    expect(draft.householdId).toBe('household-xyz');
    expect(draft.sourceUrl).toBe('https://www.tiktok.com/@someone/video/999');
  });

  test('passes thumbnailUrl straight through from context, never re-derived', () => {
    const withThumbnail = toMealDraft(makeParsedRecipe(), {
      ...TIKTOK_CONTEXT,
      thumbnailUrl: 'https://p16-sign.tiktokcdn.com/other-thumb.jpg',
    });
    expect(withThumbnail.thumbnailUrl).toBe('https://p16-sign.tiktokcdn.com/other-thumb.jpg');

    const withoutThumbnail = toMealDraft(makeParsedRecipe(), { ...TIKTOK_CONTEXT, thumbnailUrl: null });
    expect(withoutThumbnail.thumbnailUrl).toBeNull();
  });

  test('maps ingredients with sortOrder assigned by array position, starting at 0', () => {
    const recipe = makeParsedRecipe({
      ingredients: [
        makeParsedIngredient({ name: 'Kip', quantity: '300', unit: 'g' }),
        makeParsedIngredient({ name: 'Citroen', quantity: '1', unit: null }),
      ],
    });
    const draft = toMealDraft(recipe, TIKTOK_CONTEXT);
    expect(draft.ingredients).toEqual([
      { name: 'Kip', quantity: '300', unit: 'g', sortOrder: 0 },
      { name: 'Citroen', quantity: '1', unit: null, sortOrder: 1 },
    ]);
  });

  test('maps steps with stepNumber assigned by array position, starting at 1', () => {
    const recipe = makeParsedRecipe({ steps: ['Snijd de kip.', 'Bak de kip.', 'Serveer.'] });
    const draft = toMealDraft(recipe, TIKTOK_CONTEXT);
    expect(draft.steps).toEqual([
      { stepNumber: 1, instruction: 'Snijd de kip.' },
      { stepNumber: 2, instruction: 'Bak de kip.' },
      { stepNumber: 3, instruction: 'Serveer.' },
    ]);
  });
});

/**
 * The link that makes cook proof possible at all (`meals.recipe_id`,
 * 0006): without it a friend's cook of a recipe and this household's copy
 * of it are two unrelated rows, `shared_cooks` has nothing to join on, and
 * scoring.ts's FRIEND_PROOF_BOOST can never fire. Asserted at the draft
 * boundary — where the id enters the write path — rather than on a `Meal`
 * literal, since a hand-built `Meal` proves only that the type has a
 * field, which was true for two migrations while nothing ever wrote it.
 */
describe('toMealDraft — canonical recipe link (meals.recipe_id, 0006)', () => {
  test('carries the canonical recipeId from context straight through', () => {
    const draft = toMealDraft(makeParsedRecipe(), { ...TIKTOK_CONTEXT, recipeId: 'recipe-abc' });
    expect(draft.recipeId).toBe('recipe-abc');
  });

  test('never derives the recipe id from anything in the recipe or the URL', () => {
    const draft = toMealDraft(makeParsedRecipe({ title: 'Traybake' }), {
      ...TIKTOK_CONTEXT,
      sourceUrl: 'https://www.tiktok.com/@chefremy/video/123',
      recipeId: 'recipe-abc',
    });
    expect(draft.recipeId).toBe('recipe-abc');
    expect(draft.sourceUrl).toBe('https://www.tiktok.com/@chefremy/video/123');
  });

  /**
   * An import that knows no canonical recipe must draft an explicit
   * `null`: the same "this meal is nobody's copy of anything" a seeded or
   * hand-entered meal stores. An `undefined` travelling on would be a
   * third state nothing downstream distinguishes.
   *
   * The note that used to stand here said no import ever knows one,
   * because the function stored the row without returning its id. W-01b
   * closed that: `ImportResult.recipeId` carries it home and confirm.tsx
   * hands it to this function. What DOES still always draft null is a
   * YouTube or web import — `recipes.platform`'s CHECK constraint refuses
   * both, so no row is ever attempted (`canStoreCanonicalRecipe`).
   */
  test('drafts an explicit null — never undefined — when no canonical recipe is known', () => {
    const omitted = toMealDraft(makeParsedRecipe(), TIKTOK_CONTEXT);
    expect(omitted.recipeId).toBeNull();
    expect('recipeId' in omitted).toBe(true);

    const explicitlyNull = toMealDraft(makeParsedRecipe(), { ...TIKTOK_CONTEXT, recipeId: null });
    expect(explicitlyNull.recipeId).toBeNull();
  });
});

describe('toMealDraft — sourcePlatform bridging (0001_init.sql vocabulary)', () => {
  test('maps a tiktok platform to the "tiktok" meals.source_platform value', () => {
    const draft = toMealDraft(makeParsedRecipe(), { ...TIKTOK_CONTEXT, platform: 'tiktok' });
    expect(draft.sourcePlatform).toBe('tiktok');
  });

  test('maps an instagram platform to the "reels" meals.source_platform value', () => {
    const draft = toMealDraft(makeParsedRecipe(), {
      householdId: 'household-1',
      sourceUrl: 'https://www.instagram.com/reel/abc123/',
      platform: 'instagram',
      thumbnailUrl: null,
    });
    expect(draft.sourcePlatform).toBe('reels');
  });
});

/**
 * The two platforms the 0001 vocabulary has no word for. Before this,
 * `toMealSourcePlatform` was a two-branch ternary that answered `'reels'`
 * for anything that was not TikTok — so a YouTube video and a food blog
 * both stored "this came from Instagram", a wrong fact in a database
 * column rather than a wrong pixel on a screen.
 */
describe('toMealDraft — sourcePlatform for platforms the 0001 vocabulary predates', () => {
  test('drafts null for a youtube import rather than claiming it came from Instagram', () => {
    const draft = toMealDraft(makeParsedRecipe(), {
      householdId: 'household-1',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      platform: 'youtube',
      thumbnailUrl: null,
    });
    expect(draft.sourcePlatform).toBeNull();
  });

  test('drafts null for a web import rather than claiming it came from Instagram', () => {
    const draft = toMealDraft(makeParsedRecipe(), {
      householdId: 'household-1',
      sourceUrl: 'https://www.leukerecepten.nl/recepten/traybake-kip/',
      platform: 'web',
      thumbnailUrl: null,
    });
    expect(draft.sourcePlatform).toBeNull();
  });

  /**
   * `null` means "this column has no honest word for this platform", never
   * "we do not know where this came from" — the source is known exactly,
   * and `sourceUrl` right beside it says which page. A draft that dropped
   * the URL along with the platform would be the second reading, and it is
   * the wrong one.
   */
  test('keeps the source URL even when the platform has no storable value', () => {
    const draft = toMealDraft(makeParsedRecipe(), {
      householdId: 'household-1',
      sourceUrl: 'https://www.leukerecepten.nl/recepten/traybake-kip/',
      platform: 'web',
      thumbnailUrl: null,
    });
    expect(draft.sourcePlatform).toBeNull();
    expect(draft.sourceUrl).toBe('https://www.leukerecepten.nl/recepten/traybake-kip/');
  });

  test('states sourcePlatform explicitly as null rather than omitting the key', () => {
    const draft = toMealDraft(makeParsedRecipe(), {
      householdId: 'household-1',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      platform: 'youtube',
      thumbnailUrl: null,
    });
    expect('sourcePlatform' in draft).toBe(true);
  });
});

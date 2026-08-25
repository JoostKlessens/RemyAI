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
   * `ParsedRecipe.dishTags` is optional purely for literals that predate it
   * (src/app/import/_fixtures.ts, confirm.tsx). Those still have to produce
   * a storable draft, and the stored field is required — so the missing key
   * must become `[]` here rather than travelling on as `undefined`.
   */
  test('treats a recipe literal with no dishTags key at all as having no categories', () => {
    const { dishTags: _dishTags, ...withoutDishTags } = makeParsedRecipe();
    expect(toMealDraft(withoutDishTags, TIKTOK_CONTEXT).dishTags).toEqual([]);
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

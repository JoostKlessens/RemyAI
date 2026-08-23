import { describe, expect, test } from 'vitest';
import { toMealDraft } from '@/domain/import/toMealDraft';
import { makeParsedIngredient, makeParsedRecipe } from './fixtures';

const TIKTOK_CONTEXT = {
  householdId: 'household-1',
  sourceUrl: 'https://www.tiktok.com/@chefremy/video/123',
  platform: 'tiktok' as const,
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

  test('passes householdId and sourceUrl through from context, independent of the recipe', () => {
    const draft = toMealDraft(makeParsedRecipe(), {
      householdId: 'household-xyz',
      sourceUrl: 'https://www.tiktok.com/@someone/video/999',
      platform: 'tiktok',
    });
    expect(draft.householdId).toBe('household-xyz');
    expect(draft.sourceUrl).toBe('https://www.tiktok.com/@someone/video/999');
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
    });
    expect(draft.sourcePlatform).toBe('reels');
  });
});

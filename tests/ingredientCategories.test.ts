import { describe, expect, test } from 'vitest';
import {
  CATEGORIZED_PHRASES,
  CATEGORIZED_WORDS,
  INGREDIENT_CATEGORIES,
  categorizeIngredient,
  type IngredientCategory,
} from '@/domain/ingredientCategories';
import { iconForIngredientCategory } from '@/components/ingredientCategoryIcons';
import { ICON_NAMES, isIconAvailable } from '@/components/iconFont';

describe('the vocabulary', () => {
  test('is the closed twelve this mapping was sized for', () => {
    expect(INGREDIENT_CATEGORIES).toHaveLength(12);
    expect(new Set(INGREDIENT_CATEGORIES).size).toBe(INGREDIENT_CATEGORIES.length);
  });

  /**
   * The failure a hand-maintained word table actually suffers. A word listed
   * under two categories is not a compile error and not a visible one
   * either: whichever key wins is whichever was written last, and the icon
   * silently becomes a coin flip.
   */
  test('claims no word twice', () => {
    expect(new Set(CATEGORIZED_WORDS).size).toBe(CATEGORIZED_WORDS.length);
    expect(new Set(CATEGORIZED_PHRASES).size).toBe(CATEGORIZED_PHRASES.length);
  });

  test('every word it knows normalizes to itself, so no entry is unreachable', () => {
    for (const word of CATEGORIZED_WORDS) {
      expect(categorizeIngredient(word)).not.toBeNull();
    }
    for (const phrase of CATEGORIZED_PHRASES) {
      expect(categorizeIngredient(phrase)).not.toBeNull();
    }
  });
});

describe('categorizeIngredient — the owner’s ask', () => {
  test('gives one generic drawing to every fruit rather than one per fruit', () => {
    const fruits = ['appel', 'banaan', 'peer', 'mango', 'aardbeien', 'citroen'];
    for (const fruit of fruits) {
      expect(categorizeIngredient(fruit)).toBe<IngredientCategory>('fruit');
    }
  });

  test('does the same for groente, zuivel and kaas', () => {
    expect(categorizeIngredient('wortel')).toBe<IngredientCategory>('groente');
    expect(categorizeIngredient('broccoli')).toBe<IngredientCategory>('groente');
    expect(categorizeIngredient('aubergine')).toBe<IngredientCategory>('groente');
    expect(categorizeIngredient('melk')).toBe<IngredientCategory>('zuivel');
    expect(categorizeIngredient('yoghurt')).toBe<IngredientCategory>('zuivel');
    expect(categorizeIngredient('mozzarella')).toBe<IngredientCategory>('kaas');
    expect(categorizeIngredient('geitenkaas')).toBe<IngredientCategory>('kaas');
  });
});

describe('the matching rule', () => {
  /**
   * The whole reason words are looked up whole. mainIngredients.ts paid for
   * this lesson first: "boter" is inside "boterhamworst", "water" inside
   * "waterkers". A substring rule draws milk on a sausage.
   */
  test('never matches a word hiding inside a longer one', () => {
    expect(categorizeIngredient('boterhamworst')).toBe<IngredientCategory>('vlees');
    expect(categorizeIngredient('waterkers')).toBe<IngredientCategory>('groente');
  });

  test('reads through a quantity and a unit without needing to parse them', () => {
    expect(categorizeIngredient('200 g cherrytomaatjes')).toBe<IngredientCategory>('groente');
    expect(categorizeIngredient('2 el olijfolie')).toBeNull();
  });

  /**
   * `normalizeIngredientName` strips everything from the first comma, so the
   * preparation note never has to be a word this table knows about.
   */
  test('ignores a preparation note after the comma', () => {
    expect(categorizeIngredient('ui, fijngesneden')).toBe<IngredientCategory>('groente');
    expect(categorizeIngredient('kipfilet, in reepjes')).toBe<IngredientCategory>('vlees');
  });

  test('prefers a multi-word entry over either of its words', () => {
    expect(categorizeIngredient('zoete aardappel')).toBe<IngredientCategory>('groente');
    expect(categorizeIngredient('witte bonen')).toBe<IngredientCategory>('peulvruchten');
    // `kaas` alone would already answer, but the phrase must not depend on that.
    expect(categorizeIngredient('geraspte kaas')).toBe<IngredientCategory>('kaas');
  });

  test('is case- and diacritic-insensitive, like every other tag in this app', () => {
    expect(categorizeIngredient('Kipfilet')).toBe<IngredientCategory>('vlees');
    expect(categorizeIngredient('CRÈME FRAICHE')).toBe<IngredientCategory>('zuivel');
  });
});

describe('what it does with a word it has never met', () => {
  /**
   * The load-bearing property of this whole module: ignorance costs an icon,
   * never a wrong one. These lines render exactly as they did before the
   * module existed.
   */
  test('returns null rather than guessing a category', () => {
    expect(categorizeIngredient('sumak')).toBeNull();
    expect(categorizeIngredient('gochujang')).toBeNull();
    expect(categorizeIngredient('')).toBeNull();
    expect(categorizeIngredient('   ')).toBeNull();
  });
});

describe('ingredientCategoryIcons', () => {
  test('every category has an icon the registry knows about', () => {
    for (const category of INGREDIENT_CATEGORIES) {
      expect(ICON_NAMES).toContain(iconForIngredientCategory(category));
    }
  });

  test('no two categories share a drawing, which would make two lines look alike', () => {
    const icons = INGREDIENT_CATEGORIES.map((category) => iconForIngredientCategory(category));
    expect(new Set(icons).size).toBe(icons.length);
  });

  /**
   * All twelve draw since 7 September 2026, and the last two took a
   * different route than the other ten. No milk, yoghurt, butter, bean or
   * lentil glyph exists in any of the fifteen families `@expo/vector-icons`
   * ships — measured across all fifteen glyphmaps, not assumed from one,
   * which is the mistake GAP-19 was made of. So `zuivel` and `peulvruchten`
   * are drawn by this app itself (src/components/remyGlyphs.ts), and the
   * seam hands them to a caller exactly like a font glyph.
   *
   * Written as "none are undrawable" with the list printed on failure, so a
   * regression names the category rather than just failing a count.
   */
  test('every category can be drawn, including the two no font had', () => {
    const undrawable = INGREDIENT_CATEGORIES.filter(
      (category) => !isIconAvailable(iconForIngredientCategory(category)),
    );
    expect(undrawable).toEqual([]);
  });

  test('reuses the dish tag fish rather than minting a second one', () => {
    expect(iconForIngredientCategory('vis')).toBe('fish');
  });
});

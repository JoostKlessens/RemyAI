import { describe, expect, test } from 'vitest';
import { ALL_DISH_TAG_VALUES, DISH_TAGS_WITH_ICONS, iconForDishTag } from '@/components/dishTagIcons';
import { ICON_NAMES, isIconAvailable } from '@/components/iconFont';
import { DISH_TAGS } from '@/domain/dishTags';

describe('dishTagIcons — the invariant a hand-maintained table actually needs', () => {
  test('every tag in the vocabulary has a glyph', () => {
    const missing = ALL_DISH_TAG_VALUES.filter((tag) => iconForDishTag(tag) === null);
    expect(missing).toEqual([]);
  });

  test('no entry names a tag the vocabulary does not have — the other half of the same failure', () => {
    const orphans = DISH_TAGS_WITH_ICONS.filter((tag) => !ALL_DISH_TAG_VALUES.includes(tag));
    expect(orphans).toEqual([]);
  });

  test('the vocabulary is still the closed seventeen this mapping was sized for', () => {
    expect(DISH_TAGS).toHaveLength(17);
    expect(DISH_TAGS[0]).toEqual({ tag: 'pasta', label: 'Pasta' });
  });

  test('every glyph it names is a real IconName the registry knows about', () => {
    for (const tag of ALL_DISH_TAG_VALUES) {
      const icon = iconForDishTag(tag);
      expect(icon).not.toBeNull();
      expect(ICON_NAMES).toContain(icon);
    }
  });
});

describe('iconForDishTag', () => {
  test('gives the owner his example: pasta gets the pasta drawing', () => {
    expect(iconForDishTag('pasta')).toBe('pasta');
  });

  test('names the DRAWING, not the tag, where Dutch product vocabulary and English glyphs diverge', () => {
    // `visgerecht` rather than `vis` is dishTags.ts's deliberate avoidance of
    // the EU-allergen literal; the drawing is still just a fish.
    expect(iconForDishTag('visgerecht')).toBe('fish');
    expect(iconForDishTag('soep')).toBe('bowl-steam');
    expect(iconForDishTag('stamppot')).toBe('cooking-pot');
  });

  test('returns null for a value outside the vocabulary rather than throwing', () => {
    expect(iconForDishTag('italiaans')).toBeNull();
    expect(iconForDishTag('')).toBeNull();
    // Unnormalized input is not silently coerced, matching `isDishTag`.
    expect(iconForDishTag('Pasta')).toBeNull();
  });
});

describe('what ships today', () => {
  test('NOT ONE dish glyph is drawable yet, so every chip stays text-only until GAP-19 lands', () => {
    const drawable = ALL_DISH_TAG_VALUES.filter((tag) => {
      const icon = iconForDishTag(tag);
      return icon !== null && isIconAvailable(icon);
    });
    expect(drawable).toEqual([]);
  });
});

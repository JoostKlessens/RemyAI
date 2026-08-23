import { describe, expect, test } from 'vitest';
import { EU_ALLERGEN_TAGS, EU_ALLERGENS } from '@/domain/allergens';
import { normalizeTag } from '@/domain/normalizeTag';

describe('EU_ALLERGENS', () => {
  test('lists exactly the 14 EU-designated allergens', () => {
    expect(EU_ALLERGENS).toHaveLength(14);
  });

  test('every tag is already normalizeTag()-clean', () => {
    for (const entry of EU_ALLERGENS) {
      expect(normalizeTag(entry.tag)).toBe(entry.tag);
    }
  });

  test('every tag is unique', () => {
    const tags = EU_ALLERGENS.map((entry) => entry.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  test('every label is non-empty', () => {
    for (const entry of EU_ALLERGENS) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  test('EU_ALLERGEN_TAGS mirrors EU_ALLERGENS exactly', () => {
    expect(EU_ALLERGEN_TAGS.size).toBe(EU_ALLERGENS.length);
    for (const entry of EU_ALLERGENS) {
      expect(EU_ALLERGEN_TAGS.has(entry.tag)).toBe(true);
    }
  });
});

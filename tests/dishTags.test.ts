import { describe, expect, test } from 'vitest';
import { DISH_TAG_VALUES, DISH_TAGS, isDishTag, sanitizeDishTags } from '@/domain/dishTags';
import { EU_ALLERGEN_TAGS } from '@/domain/allergens';
import { normalizeTag } from '@/domain/normalizeTag';

describe('DISH_TAGS — closed vocabulary', () => {
  test('every tag is already normalizeTag()-clean', () => {
    for (const entry of DISH_TAGS) {
      expect(normalizeTag(entry.tag)).toBe(entry.tag);
    }
  });

  test('every tag is unique', () => {
    const tags = DISH_TAGS.map((entry) => entry.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  test('every label is non-empty', () => {
    for (const entry of DISH_TAGS) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  test('DISH_TAG_VALUES mirrors DISH_TAGS exactly', () => {
    expect(DISH_TAG_VALUES.size).toBe(DISH_TAGS.length);
    for (const entry of DISH_TAGS) {
      expect(DISH_TAG_VALUES.has(entry.tag)).toBe(true);
    }
  });

  /**
   * PD-006 boundary. `ingredientTags` carries allergens and drives the
   * exclusion gate in exclusions.ts; `dishTags` is a descriptive category
   * ("pasta", "soep") used only for positive filtering. If a value ever
   * appeared in both vocabularies, a category filter and an allergen
   * exclusion would silently operate on the same string — exactly the
   * conflation PD-006 forbids.
   */
  test('shares no value with the allergen vocabulary', () => {
    for (const entry of DISH_TAGS) {
      expect(EU_ALLERGEN_TAGS.has(entry.tag)).toBe(false);
    }
  });
});

describe('isDishTag', () => {
  test('accepts every tag in the vocabulary', () => {
    for (const entry of DISH_TAGS) {
      expect(isDishTag(entry.tag)).toBe(true);
    }
  });

  test('rejects a value outside the vocabulary', () => {
    expect(isDishTag('gluten')).toBe(false);
    expect(isDishTag('iets-verzonnens')).toBe(false);
    expect(isDishTag('')).toBe(false);
  });

  /**
   * The LLM extraction path (buildExtractionRequest.ts) is the main caller:
   * a model returning "Pasta" or " pasta " must not slip an unnormalized
   * value into storage, because the filter compares normalized strings.
   */
  test('rejects an unnormalized variant rather than silently accepting it', () => {
    expect(isDishTag('Pasta')).toBe(false);
    expect(isDishTag(' pasta ')).toBe(false);
  });
});

describe('sanitizeDishTags — narrowing untrusted input', () => {
  test('keeps a tag that is already in the vocabulary', () => {
    expect(sanitizeDishTags(['pasta'], normalizeTag)).toEqual(['pasta']);
  });

  test('normalizes before matching, so a capitalized model answer survives', () => {
    expect(sanitizeDishTags(['Pasta', ' SOEP '], normalizeTag)).toEqual(['pasta', 'soep']);
  });

  /**
   * The whole point of a closed vocabulary: a model that invents a
   * plausible-sounding category loses that tag rather than writing an
   * unfilterable value to storage.
   */
  test('drops a value the vocabulary does not know', () => {
    expect(sanitizeDishTags(['italiaans', 'pasta'], normalizeTag)).toEqual(['pasta']);
  });

  test('de-duplicates values that normalize to the same tag', () => {
    expect(sanitizeDishTags(['pasta', 'Pasta', ' pasta'], normalizeTag)).toEqual(['pasta']);
  });

  test('returns an empty array for input that is entirely unknown', () => {
    expect(sanitizeDishTags(['iets', 'anders'], normalizeTag)).toEqual([]);
  });

  test('returns an empty array for empty input', () => {
    expect(sanitizeDishTags([], normalizeTag)).toEqual([]);
  });

  /**
   * PD-006 boundary, restated as behaviour: an allergen value must never
   * survive sanitization into dishTags, or the two vocabularies would
   * start to overlap through the import path rather than in the constant.
   */
  test('drops an allergen value rather than accepting it as a category', () => {
    expect(sanitizeDishTags(['noten', 'gluten'], normalizeTag)).toEqual([]);
  });
});

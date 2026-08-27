import { describe, expect, test } from 'vitest';
import { ALLERGEN_TAGGING_HEADING, buildAllergenConfirmedSummary } from '@/components/allergenTaggingCopy';

describe('ALLERGEN_TAGGING_HEADING', () => {
  test('is exclusion-framed, never a safety claim', () => {
    expect(ALLERGEN_TAGGING_HEADING).toBe('Bevat dit gerecht een van deze?');
    expect(ALLERGEN_TAGGING_HEADING.toLowerCase()).not.toContain('veilig');
  });
});

describe('buildAllergenConfirmedSummary', () => {
  test('confirms zero tags as a real, honest outcome, not phrased as unresolved', () => {
    expect(buildAllergenConfirmedSummary([])).toBe('Gecontroleerd. Geen van de 14 allergenen getagd.');
  });

  test('lists a single confirmed tag by its display label', () => {
    expect(buildAllergenConfirmedSummary(['noten'])).toBe('Gecontroleerd. Sluit uit: noten.');
  });

  test('lists multiple confirmed tags, comma-separated', () => {
    expect(buildAllergenConfirmedSummary(['noten', 'gluten'])).toBe('Gecontroleerd. Sluit uit: noten, gluten.');
  });

  test('falls back to the raw tag when it is outside the known vocabulary', () => {
    expect(buildAllergenConfirmedSummary(['onbekend'])).toBe('Gecontroleerd. Sluit uit: onbekend.');
  });
});

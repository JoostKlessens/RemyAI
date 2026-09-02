import { describe, expect, test } from 'vitest';
import {
  ALLERGEN_TAGGING_HEADING,
  buildAllergenConfirmedSummary,
  buildAllergenSkipAccessibilityLabel,
  buildAllergenSkipConsequence,
} from '@/components/allergenTaggingCopy';

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


/**
 * PRF-02. The tagging step now says what SKIPPING costs, not merely what
 * state it leaves behind — and the whole feature is two sentences, so every
 * property worth having is a property of a string.
 *
 * THE ASYMMETRY IS THE FEATURE AND IS ASSERTED IN BOTH DIRECTIONS. PD-006
 * point 2: "a household with NO allergen restriction is unaffected. No extra
 * friction, no prompts." A regression that showed the stronger sentence to
 * everybody would be friction on the majority, and one that never showed it
 * would leave the households it was written for exactly as uninformed as
 * before. Neither is visible in a type.
 *
 * AND NOTHING HERE MAY NAME AN ALLERGEN. Which allergy, and whose, is
 * special-category health data (PD-005), and this screen is shown to
 * whoever is holding the phone — not necessarily the person the restriction
 * belongs to.
 */
describe('buildAllergenSkipConsequence', () => {
  test('names the consequence, not just the state, when there is an allergy to be caught', () => {
    // Arrange / Act
    const sentence = buildAllergenSkipConsequence(true);

    // Assert
    // "niet-gecontroleerd gemarkeerd" alone names a database state and
    // leaves its consequence for the reader to infer. Nobody infers it.
    expect(sentence).toContain('allergie');
    expect(sentence.toLowerCase()).toContain('houdt remy het niet tegen');
  });

  test('says nothing about filtering to a household with no allergen restriction', () => {
    // Arrange / Act
    const sentence = buildAllergenSkipConsequence(false);

    // Assert
    // For them `unknown` excludes nothing and never will, so this would be a
    // caution about a consequence that cannot occur — PD-006 point 2's "no
    // extra friction, no prompts", which is most households.
    expect(sentence).not.toContain('allergie');
    expect(sentence).toContain('Optioneel');
  });

  test('the two are different sentences', () => {
    expect(buildAllergenSkipConsequence(true)).not.toBe(buildAllergenSkipConsequence(false));
  });

  test('neither sentence names an allergen or a member (PD-005)', () => {
    // Arrange
    const sentences = [buildAllergenSkipConsequence(true), buildAllergenSkipConsequence(false)];
    const forbidden = ['pinda', 'noten', 'gluten', 'lactose', 'schaaldieren', 'soja', 'ei', 'vis'];

    // Act / Assert
    for (const sentence of sentences) {
      const words = sentence.toLowerCase().split(/[^a-zà-ÿ]+/u);
      for (const term of forbidden) {
        expect(words).not.toContain(term);
      }
    }
  });

  test('suggests nothing and claims nothing is safe', () => {
    // Arrange
    const sentences = [buildAllergenSkipConsequence(true), buildAllergenSkipConsequence(false)];

    // Act / Assert
    // The AI-prefill design was built and scrapped (see the module header):
    // the dangerous failure is a MISSED tag on a rubber-stamped list. This
    // copy is about the user's own choice and must never drift into
    // suggesting, nor into the safety claim ALLERGEN_TAGGING_HEADING already
    // refuses.
    for (const sentence of sentences) {
      expect(sentence.toLowerCase()).not.toContain('veilig');
      expect(sentence.toLowerCase()).not.toContain('waarschijnlijk');
    }
  });
});

describe('buildAllergenSkipAccessibilityLabel', () => {
  test('carries the consequence on the control too, when there is one', () => {
    // Arrange / Act
    const label = buildAllergenSkipAccessibilityLabel(true);

    // Assert
    // Somebody who hears only the button never reads the helper above it.
    expect(label).toContain('allergie');
    expect(label).toContain('niet-gecontroleerd');
  });

  test('stays the plain label when the household has no allergen restriction', () => {
    // Arrange / Act
    const label = buildAllergenSkipAccessibilityLabel(false);

    // Assert
    expect(label).toBe('Allergenen overslaan, dit gerecht blijft niet-gecontroleerd');
  });
});

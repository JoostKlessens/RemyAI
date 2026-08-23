/**
 * Pure copy helpers for the import confirmation screen's allergen-tagging
 * section (src/components/AllergenTaggingSection.tsx). No React Native
 * imports here on purpose, so this is unit-testable directly under
 * vitest's `node` environment — see tests/allergenTaggingCopy.test.ts.
 *
 * IMPORTANT — this module deliberately does NOT suggest tags. An earlier
 * version of this feature had the AI pre-fill likely allergen tags for the
 * user to rubber-stamp; that was scrapped by product direction because the
 * dangerous failure mode isn't the AI adding a wrong tag, it's the AI
 * MISSING one — a tidy pre-filled list gets rubber-stamped, the meal
 * becomes `verified`, and `exclusions.ts` trusts `verified` completely.
 * That is exactly the failure PD-006 exists to prevent, reintroduced
 * through a friendlier door. Instead, the confirmation screen shows the
 * parsed ingredient list as evidence and the human tags allergens
 * themselves from the closed EU-14 vocabulary — see confirm.tsx.
 */

import { EU_ALLERGENS } from '@/domain/allergens';

/** Exclusion-framed, never a safety claim — see the three rules in docs/PRODUCT-DECISIONS.md. */
export const ALLERGEN_TAGGING_HEADING = 'Bevat dit gerecht een van deze?';

function allergenLabel(tag: string): string {
  return EU_ALLERGENS.find((entry) => entry.tag === tag)?.label.toLowerCase() ?? tag;
}

/** Summary shown once the user has confirmed (status: 'verified') — never worded as a safety guarantee. */
export function buildAllergenConfirmedSummary(confirmedTags: readonly string[]): string {
  if (confirmedTags.length === 0) {
    return 'Gecontroleerd — geen van de 14 allergenen getagd.';
  }
  const labels = confirmedTags.map(allergenLabel);
  return `Gecontroleerd — sluit uit: ${labels.join(', ')}.`;
}

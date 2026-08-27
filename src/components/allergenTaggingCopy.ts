/**
 * Pure copy helpers for the import confirmation screen's allergen-tagging
 * section (src/components/AllergenTaggingSection.tsx). No React Native
 * imports here on purpose, so this is unit-testable directly under
 * vitest's `node` environment — see tests/allergenTaggingCopy.test.ts.
 *
 * `describeAllergenTag` below started as this module's private
 * `allergenLabel` helper and is now exported, because the friend feed's
 * PD-007a collision label (`friendFeedPresentation.ts`) needs the exact
 * same tag -> Dutch-label mapping, and a second copy of it would be one
 * vocabulary update away from the two surfaces disagreeing about what
 * `pinda` is called. The alternative considered was moving it down beside
 * `EU_ALLERGENS` in src/domain/allergens.ts; rejected because a display
 * label is presentation, and that module is deliberately pure vocabulary
 * that the PD-006 exclusion gate depends on.
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
import { normalizeTag } from '@/domain/normalizeTag';

/** Exclusion-framed, never a safety claim — see the three rules in docs/PRODUCT-DECISIONS.md. */
export const ALLERGEN_TAGGING_HEADING = 'Bevat dit gerecht een van deze?';

/**
 * A stored tag rendered as the lowercase Dutch word a sentence can be
 * built around ("pinda" -> "pinda's", so "sluit uit: pinda's" and "bevat
 * pinda's" both read as Dutch rather than as a database value).
 *
 * Normalizes before looking up, for the same reason `collectExcludedTags`
 * does (exclusions.ts): legacy rows and hand-entered values reach this
 * with stray casing or diacritics, and a failed lookup would silently
 * degrade a known allergen into raw-tag output. Anything genuinely
 * outside the EU-14 vocabulary — a dislike like "champignons" — falls
 * back to the caller's own text, lowercased but otherwise untouched, so
 * its diacritics survive.
 */
export function describeAllergenTag(tag: string): string {
  const normalized = normalizeTag(tag);
  const entry = EU_ALLERGENS.find((candidate) => candidate.tag === normalized);
  return entry?.label.toLowerCase() ?? tag.trim().toLowerCase();
}

/** Summary shown once the user has confirmed (status: 'verified') — never worded as a safety guarantee. */
export function buildAllergenConfirmedSummary(confirmedTags: readonly string[]): string {
  if (confirmedTags.length === 0) {
    return 'Gecontroleerd. Geen van de 14 allergenen getagd.';
  }
  const labels = confirmedTags.map(describeAllergenTag);
  return `Gecontroleerd. Sluit uit: ${labels.join(', ')}.`;
}

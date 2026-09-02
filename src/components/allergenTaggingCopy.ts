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
 * What skipping this step actually costs, said out loud — PRF-02's whole
 * remaining substance.
 *
 * WHAT WAS WRONG WITH THE OLD SENTENCE. It said the meal "blijft als
 * niet-gecontroleerd gemarkeerd", which names a STATE and leaves its
 * CONSEQUENCE for the reader to infer. Nobody infers it: `exclusions.ts`
 * only ever excludes a `verified` meal, so a household with a peanut
 * allergy that skips this step has quietly opted a satay recipe out of the
 * one gate that would have caught it — and the screen that let them do it
 * said nothing about that. Naming a database state is not informed consent.
 *
 * TWO SENTENCES, AND THE SPLIT IS PD-006 POINT 2 RATHER THAN A FLOURISH.
 * "A household with NO allergen restriction is unaffected. No extra
 * friction, no prompts." For them `unknown` excludes nothing and never
 * will, so a warning about filtering would be a caution about a
 * consequence that cannot occur — friction bought with nothing, on the
 * majority of households. They keep the sentence they already had.
 *
 * IT STILL SUGGESTS NOTHING, which is the line this module opens by
 * drawing. This is copy about what the USER's own choice costs; no
 * ingredient is read, no tag is derived, nothing is pre-filled, and the
 * only path to `verified` is still a human tapping "Bevestigen". The
 * scrapped AI-prefill design stays scrapped.
 *
 * IT NAMES NO ALLERGEN AND NO MEMBER. Which allergy, and whose, is
 * special-category health data (PD-005) — and this screen is shown to
 * whoever is holding the phone, who is not necessarily the person the
 * restriction belongs to. "de allergie die in dit huishouden staat" says
 * enough to act on and discloses nothing.
 */
export function buildAllergenSkipConsequence(householdHasAllergenRestriction: boolean): string {
  if (!householdHasAllergenRestriction) {
    return (
      'Bekijk de ingrediënten hierboven en tag wat van toepassing is. Optioneel — sla over als je het niet zeker ' +
      'weet, dan blijft dit gerecht als niet-gecontroleerd gemarkeerd.'
    );
  }
  return (
    'Bekijk de ingrediënten hierboven en tag wat van toepassing is. Sla je dit over, dan blijft het gerecht ' +
    'niet-gecontroleerd — en dan houdt Remy het niet tegen bij de allergie die in dit huishouden staat.'
  );
}

/**
 * The skip control's own label, for the same reason and with the same
 * split. A screen-reader user who hears only the button never reads the
 * helper above it, so the consequence has to travel on the control too.
 */
export function buildAllergenSkipAccessibilityLabel(householdHasAllergenRestriction: boolean): string {
  if (!householdHasAllergenRestriction) {
    return 'Allergenen overslaan, dit gerecht blijft niet-gecontroleerd';
  }
  return 'Allergenen overslaan, dit gerecht blijft niet-gecontroleerd en wordt niet tegengehouden bij de allergie in dit huishouden';
}

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

/**
 * PD-006: single shared normalization for every restriction/allergen tag
 * entering the system, used by BOTH restriction entry
 * (RestrictionTagInput) and meal tagging, so `Set.has()` comparisons in
 * exclusions.ts are reliable regardless of how a tag was capitalized,
 * spaced, or accented at the point of entry. "Noten" and "noten" — and
 * "Crème" and "creme" — must always normalize to the same string.
 *
 * Diacritic stripping via Unicode NFD decomposition: NFD splits a
 * precomposed character like "é" into "e" plus a combining acute accent
 * (U+0301), then the regex strips every combining mark in the U+0300–U+036F
 * range, leaving the bare base letter.
 */
export function normalizeTag(rawTag: string): string {
  return rawTag
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

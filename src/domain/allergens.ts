/**
 * PD-006: allergen tags come from a closed vocabulary — the 14 EU-
 * designated allergens (Regulation (EU) No 1169/2011, Annex II) — never
 * free text. A model may *suggest* one of these tags for a human to
 * confirm; it may never mark a meal `verified` on its own (see
 * docs/PRODUCT-DECISIONS.md).
 *
 * Every `tag` value below is already normalizeTag()-clean (lowercase, no
 * diacritics) — enforced by an invariant test in tests/allergens.test.ts —
 * so callers can store or compare it directly without re-normalizing.
 */

export interface AllergenVocabularyEntry {
  readonly tag: string;
  readonly label: string;
}

export const EU_ALLERGENS: readonly AllergenVocabularyEntry[] = [
  { tag: 'gluten', label: 'Gluten' },
  { tag: 'schaaldieren', label: 'Schaaldieren' },
  { tag: 'eieren', label: 'Eieren' },
  { tag: 'vis', label: 'Vis' },
  { tag: 'pinda', label: "Pinda's" },
  { tag: 'soja', label: 'Soja' },
  { tag: 'melk', label: 'Melk' },
  { tag: 'noten', label: 'Noten' },
  { tag: 'selderij', label: 'Selderij' },
  { tag: 'mosterd', label: 'Mosterd' },
  { tag: 'sesamzaad', label: 'Sesamzaad' },
  { tag: 'sulfiet', label: 'Sulfiet' },
  { tag: 'lupine', label: 'Lupine' },
  { tag: 'weekdieren', label: 'Weekdieren' },
];

export const EU_ALLERGEN_TAGS: ReadonlySet<string> = new Set(EU_ALLERGENS.map((entry) => entry.tag));

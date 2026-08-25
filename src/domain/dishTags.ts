/**
 * Dish categories — the vocabulary behind "kies iets met pasta" filtering
 * on the decision surface.
 *
 * DELIBERATELY SEPARATE FROM `Meal.ingredientTags`. That field is a
 * denormalized union of *allergen* tags and it drives the PD-006
 * exclusion gate in exclusions.ts: a value there can remove a meal from
 * someone's rotation on safety grounds. A dish category is descriptive,
 * never a safety claim, and only ever narrows a search the user asked
 * for. Mixing the two would mean a category filter and an allergen
 * exclusion silently operating on the same string — exactly the
 * conflation PD-006 forbids. tests/dishTags.test.ts asserts the two
 * vocabularies share no value, so this stays true as both grow.
 *
 * Note `visgerecht` rather than `vis`: `vis` is one of the 14 EU
 * allergens in allergens.ts, and reusing that literal would breach the
 * separation above the moment either list was iterated generically.
 *
 * Closed vocabulary, same posture as EU_ALLERGENS: a model may only pick
 * from this list (see buildExtractionRequest.ts), never invent a value.
 * Every `tag` is already normalizeTag()-clean — enforced by an invariant
 * test — so callers can store and compare directly without re-normalizing.
 */

export interface DishTagEntry {
  readonly tag: string;
  readonly label: string;
}

export const DISH_TAGS: readonly DishTagEntry[] = [
  // Base / carbohydrate
  { tag: 'pasta', label: 'Pasta' },
  { tag: 'rijst', label: 'Rijst' },
  { tag: 'aardappel', label: 'Aardappel' },
  { tag: 'noedels', label: 'Noedels' },
  { tag: 'brood', label: 'Brood' },
  // Form of the dish
  { tag: 'soep', label: 'Soep' },
  { tag: 'salade', label: 'Salade' },
  { tag: 'ovenschotel', label: 'Ovenschotel' },
  { tag: 'wok', label: 'Wok' },
  { tag: 'curry', label: 'Curry' },
  { tag: 'stamppot', label: 'Stamppot' },
  // Main protein
  { tag: 'kip', label: 'Kip' },
  { tag: 'rundvlees', label: 'Rundvlees' },
  { tag: 'varkensvlees', label: 'Varkensvlees' },
  { tag: 'visgerecht', label: 'Vis' },
  // Diet
  { tag: 'vegetarisch', label: 'Vegetarisch' },
  { tag: 'veganistisch', label: 'Veganistisch' },
];

export const DISH_TAG_VALUES: ReadonlySet<string> = new Set(DISH_TAGS.map((entry) => entry.tag));

/**
 * Exact membership check — deliberately does NOT normalize its argument.
 * A caller holding untrusted input (the LLM extraction path, a route
 * param) must normalize first and then ask, so an unnormalized value
 * fails loudly here instead of being quietly coerced into a match. The
 * stored form is always the normalized one; accepting "Pasta" here would
 * let two spellings of one category diverge in storage.
 */
export function isDishTag(value: string): boolean {
  return DISH_TAG_VALUES.has(value);
}

/**
 * Narrows untrusted input (an LLM tool call, a route param) to the tags
 * this vocabulary actually knows: normalizes each entry, drops anything
 * outside the vocabulary, and de-duplicates. Never throws and never
 * passes an unknown value through — a model that invents "italiaans"
 * loses that tag rather than writing it to storage.
 */
export function sanitizeDishTags(raw: readonly string[], normalize: (value: string) => string): readonly string[] {
  const accepted = new Set<string>();
  for (const value of raw) {
    const normalized = normalize(value);
    if (isDishTag(normalized)) {
      accepted.add(normalized);
    }
  }
  return [...accepted];
}

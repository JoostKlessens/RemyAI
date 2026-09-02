/**
 * THE CONTENT: what a recipe IS, once the import pipeline has finished
 * arguing about where it came from.
 *
 * `ParsedIngredient` and `ParsedRecipe` are the only shapes in this family
 * that describe the DISH rather than the act of importing it, and that is
 * the seam they are split along. It is the same seam `ImportResult`'s
 * `provenance` field is argued from (importResult.ts): a title, an
 * ingredient list and a method would be equally true if the identical recipe
 * had arrived by some other route, whereas "a model read this out of a
 * caption" is a fact about one import and about nothing else. Keeping the
 * content shapes in their own module makes that boundary visible before a
 * reader has read a word of either — and it is the boundary that stops
 * import-time facts from being copied into a household's meal and a shared
 * canonical row, where they would outlive the import that made them true.
 *
 * EVERY FIELD HERE IS A PROMISE ABOUT WHAT WE DID NOT INVENT, which is why
 * the doc comments spend their length on the one thing a type cannot state
 * by itself: what an ABSENCE means. `quantity` is verbatim or null;
 * `estimatedMinutes` and `servings` are stated or null; `dishTags` are drawn
 * from a closed vocabulary the model was schema-constrained to. A null is
 * always "the source did not say", never a guess we declined to make aloud.
 * That is the whole reason this is a designed shape rather than a bag of
 * optional strings — an optional string cannot tell those two apart, and a
 * recipe with quantities nobody stated is worse than no recipe at all.
 *
 * `dishTags` carries the longest argument in the module and it is not really
 * about recipes: it is about what an optional field costs, told through the
 * bug that made it required. Read it before making anything here optional.
 *
 * Types only — no runtime value is declared, so nothing imports this module
 * at run time and it cannot pull I/O into src/domain.
 */

export interface ParsedIngredient {
  readonly name: string;
  /** Copied verbatim from the caption when stated (e.g. "2", "1/2"); null when the caption doesn't give an amount. Never invented. */
  readonly quantity: string | null;
  /** e.g. "el" (eetlepel), "g", "blikjes" — whatever unit the caption itself used, or null. */
  readonly unit: string | null;
}

export interface ParsedRecipe {
  readonly title: string;
  /** At least one entry — see validateParsed.ts: an empty ingredient list is treated as a malformed shape, not a valid (if sparse) recipe. */
  readonly ingredients: readonly ParsedIngredient[];
  /** At least one entry — same reasoning as `ingredients`. */
  readonly steps: readonly string[];
  /** Only set when the caption states a time; never estimated/guessed by the model. */
  readonly estimatedMinutes: number | null;
  /** Only set when the caption states a serving count; never guessed. */
  readonly servings: number | null;
  /**
   * Dish categories the model picked from the closed vocabulary in
   * src/domain/dishTags.ts — never free text. The extraction schema
   * constrains the model to that list (buildExtractionRequest.ts) and
   * validateParsed.ts drops anything outside it on the way in, so by the
   * time a value reaches this field it is guaranteed to be a known,
   * already-normalized tag. Empty is a normal, expected answer: most
   * captions do not make a category obvious, and guessing one would be the
   * same sin as guessing an ingredient.
   *
   * This is the ONLY tagging this pipeline ever accepts from the model. It
   * is emphatically not allergen data and must never reach
   * `Meal.ingredientTags` — see toMealDraft.ts's header for how that
   * separation is made a compile error rather than a convention.
   *
   * REQUIRED, AND THE BUG THAT MADE IT REQUIRED IS WORTH KNOWING,
   * because it is the cleanest example in this codebase of what an
   * optional field costs.
   *
   * It was optional. `validateParsedRecipe` — the only way a real model
   * response becomes a `ParsedRecipe` — always populated it, so the field
   * was in practice never absent on any value the server produced. It was
   * absent on exactly one path: `buildEditedRecipe` in
   * src/app/import/confirm.tsx, which does not narrow anything but
   * REBUILDS a `ParsedRecipe` from scratch out of the confirmation
   * screen's edited fields. Because the field was optional, that literal
   * compiled while simply not mentioning it. So a user who imported a
   * recipe and then corrected one ingredient before saving got a meal with
   * NO dish tags, while a user who saved the identical import untouched
   * got the model's categories — and the library's dishTag filter
   * (recipeSearch.ts) then under-reported what the household owned, with
   * nothing anywhere reporting a problem. Editing a recipe silently
   * deleted its categories, and the type said that was fine.
   *
   * That is the whole argument for requiring it: the danger was never a
   * validator letting a bad value in, it was a hand-written literal
   * omitting a good one, and only the type can catch that. `[]` still says
   * what it always said — no obvious category — but it and "the writer
   * forgot" are now different things to say, and only one of them
   * compiles. Never read an empty list as "categories unknown": there is
   * no fail-safe reading to preserve, because a dish tag gates nothing.
   */
  readonly dishTags: readonly string[];
}

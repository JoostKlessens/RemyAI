/**
 * Narrows the LLM tool-call's `unknown` input into a `ParsedRecipe`, or
 * `null` if it doesn't validate. This is the last line of defense against
 * a plausible-looking but malformed model response becoming a
 * half-populated recipe: every field is checked for both presence and
 * shape, nothing is coerced silently, and any structural doubt fails the
 * whole recipe rather than salvaging part of it. The caller (the edge
 * function) maps `null` to `ImportResult`'s `parse_failed` — never to an
 * empty/default `ParsedRecipe`.
 *
 * A recipe with zero ingredients or zero steps is rejected here too, even
 * though nothing above forbids an empty array structurally — the model
 * has an explicit, dedicated way to say "no recipe" (the `report_no_recipe`
 * tool; see buildExtractionRequest.ts / parseExtractionResponse.ts), so a
 * `report_recipe` call that comes back structurally recipe-shaped but
 * substantively empty is itself a malformed response, not a valid sparse
 * recipe.
 *
 * `dishTags` is the one field that bends the "any doubt fails the whole
 * recipe" rule, and only in one direction — see `readDishTags` below for
 * why a wrong WORD is dropped while a wrong SHAPE still fails the recipe.
 *
 * WHAT BENDING THAT RULE DOES NOT MEAN, now that `ParsedRecipe.dishTags`
 * is a REQUIRED field (types.ts). "Absent in the answer we were handed"
 * and "absent on the value this function returns" are two different
 * questions, and only the first has ever had a lenient answer here.
 * `readDishTags` accepts a missing key and reports `[]`; `ParsedRecipe`
 * then requires that `[]` to be STATED. This function has always
 * populated the field on every path — there is exactly one `return` that
 * produces a recipe, and it names `dishTags` — but until now that was a
 * property of the code, true only as long as nobody added a second
 * `return`. It is now a property of the type: drop the field from the
 * object literal below, or add an early success path that omits it, and
 * this file stops compiling. The optionality that guarantee used to lean
 * on is gone, along with the bug it enabled elsewhere — a hand-written
 * recipe literal that silently dropped the field, see
 * `ParsedRecipe.dishTags`'s own comment.
 *
 * Like buildExtractionRequest.ts, this module now carries runtime imports
 * (`sanitizeDishTags`, `normalizeTag`) where it previously had only
 * `import type`. See that file's "NOTE ON THE `dishTags` IMPORT" header
 * section: the Deno edge function that calls this one relies on downstream
 * references being erasable, and reconciling that is the edge function's
 * concern, not a reason to grow a second normalization path here.
 */

import type { ParsedIngredient, ParsedRecipe } from './types';
import { sanitizeDishTags } from '../dishTags.ts';
import { normalizeTag } from '../normalizeTag.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

type OptionalStringResult = { readonly ok: true; readonly value: string | null } | { readonly ok: false };

/** A missing/undefined/null key is a valid "not stated"; anything present that isn't a string is a malformed shape. */
function readOptionalString(value: unknown): OptionalStringResult {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'string') {
    return { ok: false };
  }
  const trimmed = value.trim();
  return { ok: true, value: trimmed.length > 0 ? trimmed : null };
}

type OptionalPositiveIntResult = { readonly ok: true; readonly value: number | null } | { readonly ok: false };

function readOptionalPositiveInt(value: unknown): OptionalPositiveIntResult {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return { ok: false };
  }
  return { ok: true, value };
}

/**
 * `section` IS READ WITH THE SAME `readOptionalString` AS `quantity` AND
 * `unit`, AND FAILS THE SAME WAY, which is the whole reason it is not read
 * with a lenient reader of its own.
 *
 * A missing key, an explicit null and a blank string all mean "this
 * ingredient belongs to no sub-recipe", which is the ordinary answer: most
 * recipes print no headings at all. A value present but not a string is a
 * malformed shape and fails the ingredient, and therefore the recipe —
 * exactly what a non-string `quantity` does one line up.
 *
 * THAT IS DELIBERATELY THE STRICT TREATMENT AND NOT `dishTags`' LENIENT ONE.
 * `readDishTags` below drops a word it does not recognise and lets the recipe
 * through, because the vocabulary is closed and a wrong WORD there is
 * cosmetic. There is no vocabulary here — a heading is free text in the
 * source's own language — so there is no such thing as a value this function
 * could recognise as wrong-but-harmless. The only thing left to check is the
 * shape, and a model that answers with a number where the schema says
 * `{ type: 'STRING', nullable: true }` has not made a typo in a category, it
 * has returned something this pipeline does not understand.
 *
 * The trimming matters downstream and is not tidiness: `groupIngredientsBySection`
 * keys its groups on the label, so a heading arriving once as "Beslag" and
 * once as "Beslag " would otherwise be two headings if that function trusted
 * this one. It does not — it trims again, for rows written by builds that
 * predate this validator — but the two agreeing here is what keeps a fresh
 * import correct on the first read.
 */
function validateIngredient(raw: unknown): ParsedIngredient | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.name)) {
    return null;
  }
  const quantity = readOptionalString(raw.quantity);
  const unit = readOptionalString(raw.unit);
  const section = readOptionalString(raw.section);
  if (!quantity.ok || !unit.ok || !section.ok) {
    return null;
  }
  // `section` is STATED on every ingredient this function produces, never
  // omitted, even though the field is optional on `ParsedIngredient`. The
  // optionality exists for two hand-written literals in screens outside this
  // module (see that field's own comment); nothing the server produces should
  // rely on it, because "the model said no heading" and "this code forgot to
  // mention headings" must not be the same object.
  return { name: raw.name.trim(), quantity: quantity.value, unit: unit.value, section: section.value };
}

function validateIngredients(raw: unknown): readonly ParsedIngredient[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const ingredients: ParsedIngredient[] = [];
  for (const item of raw) {
    const ingredient = validateIngredient(item);
    if (ingredient === null) {
      return null;
    }
    ingredients.push(ingredient);
  }
  return ingredients;
}

function validateSteps(raw: unknown): readonly string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }
  const steps: string[] = [];
  for (const item of raw) {
    if (!isNonEmptyString(item)) {
      return null;
    }
    steps.push(item.trim());
  }
  return steps;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

type DishTagsResult = { readonly ok: true; readonly value: readonly string[] } | { readonly ok: false };

/**
 * Two failures, treated deliberately differently.
 *
 * A value the closed vocabulary does not know is DROPPED and the recipe
 * survives. That is what a closed vocabulary is for: a model answering
 * "italiaans" has picked a wrong word for a purely descriptive field, and
 * failing an otherwise perfect recipe over it would turn a cosmetic miss
 * into a user-facing `parse_failed` — a strictly worse outcome for the
 * person who pasted the link. A dish tag gates nothing, so losing one
 * costs a narrower search result and nothing else.
 *
 * A malformed CONTAINER — `dishTags` as a bare string, or an array holding
 * a number — still fails the whole recipe, exactly like every other field
 * in this file. That is not the model choosing a wrong word; it is the
 * model not honouring the schema at all, and a response that ignores the
 * shape in one place has earned no trust in the others.
 *
 * Missing or null is a plain empty list, not an error: most captions make
 * no category obvious, and `report_recipe` deliberately does not mark
 * `dishTags` as required (see buildExtractionRequest.ts). That leniency is
 * about the model's ANSWER, and does not survive into the result — the
 * `[]` produced here is then stated explicitly on a required field, so
 * "no category" is something this pipeline says out loud rather than
 * something a reader infers from a missing key.
 *
 * Normalization is `sanitizeDishTags` + the shared `normalizeTag` and
 * nothing else — the SAME function restriction entry and meal tagging use.
 * A second, local normalization path is what would let "Pasta" and "pasta"
 * both end up in storage and stop comparing equal.
 */
function readDishTags(raw: unknown): DishTagsResult {
  if (raw === undefined || raw === null) {
    return { ok: true, value: [] };
  }
  if (!isStringArray(raw)) {
    return { ok: false };
  }
  return { ok: true, value: sanitizeDishTags(raw, normalizeTag) };
}

/**
 * The single entry point: everything above exists only to be composed
 * here. Every branch fails the whole recipe (returns `null`) rather than
 * defaulting a bad field — see the file header.
 */
export function validateParsedRecipe(raw: unknown): ParsedRecipe | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.title)) {
    return null;
  }

  const ingredients = validateIngredients(raw.ingredients);
  if (ingredients === null) {
    return null;
  }

  const steps = validateSteps(raw.steps);
  if (steps === null) {
    return null;
  }

  const estimatedMinutes = readOptionalPositiveInt(raw.estimatedMinutes);
  const servings = readOptionalPositiveInt(raw.servings);
  if (!estimatedMinutes.ok || !servings.ok) {
    return null;
  }

  const dishTags = readDishTags(raw.dishTags);
  if (!dishTags.ok) {
    return null;
  }

  return {
    title: raw.title.trim(),
    ingredients,
    steps,
    estimatedMinutes: estimatedMinutes.value,
    servings: servings.value,
    dishTags: dishTags.value,
  };
}

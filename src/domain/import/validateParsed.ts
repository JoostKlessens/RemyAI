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
 */

import type { ParsedIngredient, ParsedRecipe } from './types';

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

function validateIngredient(raw: unknown): ParsedIngredient | null {
  if (!isRecord(raw) || !isNonEmptyString(raw.name)) {
    return null;
  }
  const quantity = readOptionalString(raw.quantity);
  const unit = readOptionalString(raw.unit);
  if (!quantity.ok || !unit.ok) {
    return null;
  }
  return { name: raw.name.trim(), quantity: quantity.value, unit: unit.value };
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

  return {
    title: raw.title.trim(),
    ingredients,
    steps,
    estimatedMinutes: estimatedMinutes.value,
    servings: servings.value,
  };
}

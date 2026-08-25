/**
 * Meal (+ ingredients, + steps) reads/writes.
 *
 * Per-ingredient `allergenTags` (supabase/migrations/0001_init.sql's
 * `meal_ingredients.allergen_tags`) always seed empty here: this app's UI
 * only ever tags allergens at the whole-meal level (confirm.tsx's
 * AllergenTaggingSection -> Meal.ingredientTags), matching
 * src/domain/import/toMealDraft.ts's own MealIngredientDraft, which
 * carries no allergenTags field either — Meal.ingredientTags is the
 * source of truth exclusions.ts filters on, not a per-ingredient rollup.
 *
 * `dishTags` (supabase/migrations/0004_dish_tags.sql) travels alongside
 * `ingredientTags` on the same row and is never mixed with it: descriptive
 * categories versus the allergen list that drives the PD-006 exclusion
 * gate. See `Meal.dishTags`'s comment in src/domain/types.ts. Every read
 * path here goes through `toMealRow` so that meal rows written before that
 * column existed come back with `dishTags: []` rather than `undefined` —
 * see its own comment.
 */

import type { CreateMealInput, MealIngredientInput, MealStepInput } from '../types';
import type { Meal, MealId, MealIngredient, MealStep } from '@/domain/types';
import { generateLocalId } from '../id';
import { nowIso } from '../clock';
import type { RepositoryTables } from './tables';

/**
 * `Meal.dishTags` is a required, non-nullable array, but rows written by a
 * build that predates it are already sitting in real installs' storage
 * without the key — table.ts deliberately does not validate row shapes, so
 * they come back exactly as they were written. Handing those to a caller
 * would mean an `undefined` where the type promises an array: not a
 * missing filter, but a crash on the first `.some()`. Backfilling on read
 * (rather than migrating storage on launch) keeps this a pure, cheap
 * function and matches table.ts's stance that persisted data is untrusted
 * input like any other. `Array.isArray` rather than an `undefined` check
 * for the same reason: it also catches a row whose value is corrupt in
 * some other way, and the recovery is identical either way. Returns a new
 * object only when there is something to fix, so an up-to-date row is
 * passed through untouched.
 */
function toMealRow(meal: Meal): Meal {
  return Array.isArray(meal.dishTags) ? meal : { ...meal, dishTags: [] };
}

/** Household's own (unarchived) + curated meals — mirrors 0001_init.sql's candidate-meal query comment on the `meals` table. */
export async function listHouseholdMeals(tables: RepositoryTables, householdId: string): Promise<readonly Meal[]> {
  const meals = await tables.meals.list();
  return meals
    .filter((meal) => (meal.householdId === householdId || meal.householdId === null) && meal.archivedAt === null)
    .map(toMealRow);
}

export async function getMeal(tables: RepositoryTables, mealId: MealId): Promise<Meal | null> {
  const meals = await tables.meals.list();
  const meal = meals.find((entry) => entry.id === mealId);
  return meal === undefined ? null : toMealRow(meal);
}

export async function getMealIngredients(
  tables: RepositoryTables,
  mealId: MealId,
): Promise<readonly MealIngredient[]> {
  const ingredients = await tables.mealIngredients.list();
  return ingredients.filter((ingredient) => ingredient.mealId === mealId).sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getMealSteps(tables: RepositoryTables, mealId: MealId): Promise<readonly MealStep[]> {
  const steps = await tables.mealSteps.list();
  return steps.filter((step) => step.mealId === mealId).sort((a, b) => a.stepNumber - b.stepNumber);
}

function buildIngredientRows(mealId: MealId, ingredients: readonly MealIngredientInput[]): readonly MealIngredient[] {
  return ingredients.map((ingredient) => ({
    id: generateLocalId('meal-ingredient'),
    mealId,
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    allergenTags: [],
    sortOrder: ingredient.sortOrder,
  }));
}

function buildStepRows(mealId: MealId, steps: readonly MealStepInput[]): readonly MealStep[] {
  return steps.map((step) => ({
    id: generateLocalId('meal-step'),
    mealId,
    stepNumber: step.stepNumber,
    instruction: step.instruction,
    durationMinutes: step.durationMinutes,
  }));
}

function buildMealRow(input: CreateMealInput): Meal {
  return {
    id: generateLocalId('meal'),
    householdId: input.householdId,
    title: input.title,
    source: input.source,
    estimatedMinutes: input.estimatedMinutes,
    skillLevel: input.skillLevel,
    servings: input.servings,
    ingredientTags: input.ingredientTags,
    allergenTagStatus: input.allergenTagStatus,
    // `CreateMealInput.dishTags` is optional (a caller with no categories
    // to offer may omit it); the stored row's is not. `[]` is the honest
    // translation of "none" — never `undefined`, which is what every read
    // path downstream is entitled to assume it will never see.
    dishTags: input.dishTags ?? [],
    sourceUrl: input.sourceUrl,
    sourcePlatform: input.sourcePlatform,
    thumbnailUrl: input.thumbnailUrl,
    archivedAt: null,
    createdAt: nowIso(),
  };
}

export async function createMeal(tables: RepositoryTables, input: CreateMealInput): Promise<Meal> {
  const meal = buildMealRow(input);
  const newIngredients = buildIngredientRows(meal.id, input.ingredients);
  const newSteps = buildStepRows(meal.id, input.steps);

  const [existingMeals, existingIngredients, existingSteps] = await Promise.all([
    tables.meals.list(),
    tables.mealIngredients.list(),
    tables.mealSteps.list(),
  ]);

  await Promise.all([
    tables.meals.replaceAll([...existingMeals, meal]),
    tables.mealIngredients.replaceAll([...existingIngredients, ...newIngredients]),
    tables.mealSteps.replaceAll([...existingSteps, ...newSteps]),
  ]);

  return meal;
}

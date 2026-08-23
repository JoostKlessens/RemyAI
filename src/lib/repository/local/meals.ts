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
 */

import type { CreateMealInput, MealIngredientInput, MealStepInput } from '../types';
import type { Meal, MealId, MealIngredient, MealStep } from '@/domain/types';
import { generateLocalId } from '../id';
import { nowIso } from '../clock';
import type { RepositoryTables } from './tables';

/** Household's own (unarchived) + curated meals — mirrors 0001_init.sql's candidate-meal query comment on the `meals` table. */
export async function listHouseholdMeals(tables: RepositoryTables, householdId: string): Promise<readonly Meal[]> {
  const meals = await tables.meals.list();
  return meals.filter(
    (meal) => (meal.householdId === householdId || meal.householdId === null) && meal.archivedAt === null,
  );
}

export async function getMeal(tables: RepositoryTables, mealId: MealId): Promise<Meal | null> {
  const meals = await tables.meals.list();
  return meals.find((meal) => meal.id === mealId) ?? null;
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
    sourceUrl: input.sourceUrl,
    sourcePlatform: input.sourcePlatform,
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

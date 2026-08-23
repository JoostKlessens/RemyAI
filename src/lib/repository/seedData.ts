/**
 * Converts src/app/_fixtures.ts's hardcoded demo data into the row sets
 * localRepository.ts's `seedIfEmpty()` writes on a fresh install ONLY.
 * This is the one place `_fixtures.ts` is still imported outside a test —
 * per the task brief, every screen now reads through the repository, and
 * fixtures exist solely to give a first-time install the same demo state
 * the app has always shown, not as a live data source.
 *
 * `meal_ingredients` seeds empty for every fixture meal: `_fixtures.ts`
 * never defined per-ingredient rows, only each Meal's denormalized
 * `ingredientTags` — which is the same "title-only, no structured
 * ingredient data" shape a real seeded meal has per PD-006.
 */

import {
  fixtureCookEvents,
  fixtureHousehold,
  fixtureMealSteps,
  fixtureMeals,
  fixtureMembers,
  fixturePendingOutcomeDecision,
  fixtureRestrictions,
  fixtureSaves,
} from '@/app/_fixtures';
import type { CookEvent, Decision, Household, Meal, MealStep, Member, Restriction, Save } from '@/domain/types';

export interface SeedRows {
  readonly households: readonly Household[];
  readonly members: readonly Member[];
  readonly restrictions: readonly Restriction[];
  readonly meals: readonly Meal[];
  readonly mealSteps: readonly MealStep[];
  readonly saves: readonly Save[];
  readonly cookEvents: readonly CookEvent[];
  readonly decisions: readonly Decision[];
}

function flattenMealSteps(): readonly MealStep[] {
  return Object.values(fixtureMealSteps).flat();
}

export function buildSeedRows(): SeedRows {
  return {
    households: [fixtureHousehold],
    members: fixtureMembers,
    restrictions: fixtureRestrictions,
    meals: fixtureMeals,
    mealSteps: flattenMealSteps(),
    saves: fixtureSaves,
    cookEvents: fixtureCookEvents,
    decisions: fixturePendingOutcomeDecision !== null ? [fixturePendingOutcomeDecision] : [],
  };
}

/**
 * Builds every TableAccessor the local repository needs from one
 * KeyValueStore. One key per "table", mirroring supabase/migrations/
 * 0001_init.sql's table names (prefixed `remy:` to namespace this app's
 * keys within a shared store like AsyncStorage).
 */

import type {
  CookEvent,
  Decision,
  Household,
  Meal,
  MealIngredient,
  MealStep,
  Member,
  Restriction,
  Save,
} from '@/domain/types';
import type { KeyValueStore } from '../keyValueStore';
import { createTableAccessor, type TableAccessor } from '../table';

export interface RepositoryTables {
  readonly households: TableAccessor<Household>;
  readonly members: TableAccessor<Member>;
  readonly restrictions: TableAccessor<Restriction>;
  readonly meals: TableAccessor<Meal>;
  readonly mealIngredients: TableAccessor<MealIngredient>;
  readonly mealSteps: TableAccessor<MealStep>;
  readonly saves: TableAccessor<Save>;
  readonly cookEvents: TableAccessor<CookEvent>;
  readonly decisions: TableAccessor<Decision>;
}

export function createRepositoryTables(store: KeyValueStore): RepositoryTables {
  return {
    households: createTableAccessor<Household>(store, 'remy:households'),
    members: createTableAccessor<Member>(store, 'remy:household_members'),
    restrictions: createTableAccessor<Restriction>(store, 'remy:member_restrictions'),
    meals: createTableAccessor<Meal>(store, 'remy:meals'),
    mealIngredients: createTableAccessor<MealIngredient>(store, 'remy:meal_ingredients'),
    mealSteps: createTableAccessor<MealStep>(store, 'remy:meal_steps'),
    saves: createTableAccessor<Save>(store, 'remy:saves'),
    cookEvents: createTableAccessor<CookEvent>(store, 'remy:cook_events'),
    decisions: createTableAccessor<Decision>(store, 'remy:decisions'),
  };
}

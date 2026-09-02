/**
 * Public surface of the repository layer. Screens import from here (`@/lib/
 * repository`), never from an individual file inside this directory — this
 * barrel IS the seam described in types.ts's module header.
 */

export { ensureSeeded, getAppRepository } from './createRepository';
export { daysAgoIso, nowIso, todayIso } from './clock';
export type {
  CreateCookEventInput,
  CreateDecisionInput,
  CreateMealInput,
  CreateMemberInput,
  CreateRestrictionInput,
  CreateSaveInput,
  MealIngredientInput,
  MealStepInput,
  RemyRepository,
  RespondToDecisionInput,
  UpdateHouseholdSettingsInput,
  UpdateMealRecipeInput,
} from './types';

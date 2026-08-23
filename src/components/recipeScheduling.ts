/**
 * Pure "what will actually happen with this recipe" resolver for "Mijn
 * recepten" (src/app/(tabs)/recipes.tsx) — the task brief's requirement
 * that the list be "live", not an archive: every row shows its real
 * scheduling state instead of a flat pile of saved titles. No React
 * Native imports here on purpose, so this is unit-testable directly under
 * vitest's `node` environment — see tests/recipeScheduling.test.ts.
 */

import type { CookEvent, Meal, Save } from '@/domain/types';

export type RecipeSchedulingState = 'deze_week' | 'ooit' | 'al_gekookt' | 'geen_planning';

export interface RecipeSchedulingInfo {
  readonly state: RecipeSchedulingState;
  /** IsoDateString, set only for `al_gekookt`. */
  readonly lastCookedOn: string | null;
}

function findLatestCookEvent(mealId: string, cookEvents: readonly CookEvent[]): CookEvent | null {
  const matching = cookEvents.filter((event) => event.mealId === mealId);
  if (matching.length === 0) {
    return null;
  }
  return matching.reduce((latest, event) => (event.cookedOn > latest.cookedOn ? event : latest));
}

/** Only an active save counts — `intent: 'none'` is a bare bookmark, not a schedule. */
function findMostRecentActiveSave(mealId: string, saves: readonly Save[]): Save | null {
  const active = saves.filter((save) => save.mealId === mealId && save.intent !== 'none');
  if (active.length === 0) {
    return null;
  }
  return active.reduce((latest, save) => (save.savedAt > latest.savedAt ? save : latest));
}

/**
 * Precedence: cooked beats an active save (once it's been made, "when will
 * I make it" is moot), "this_week" beats "someday". A meal with neither is
 * `geen_planning` — present in the rotation but nothing has scheduled it.
 * This should be rare for anything that went through the import flow
 * (confirm.tsx makes the PD-004 "when?" prompt mandatory before saving),
 * but real for older/seeded meals that predate it.
 */
export function resolveRecipeSchedulingState(
  mealId: string,
  saves: readonly Save[],
  cookEvents: readonly CookEvent[],
): RecipeSchedulingInfo {
  const latestCookEvent = findLatestCookEvent(mealId, cookEvents);
  if (latestCookEvent !== null) {
    return { state: 'al_gekookt', lastCookedOn: latestCookEvent.cookedOn };
  }

  const activeSave = findMostRecentActiveSave(mealId, saves);
  if (activeSave?.intent === 'this_week') {
    return { state: 'deze_week', lastCookedOn: null };
  }
  if (activeSave?.intent === 'someday') {
    return { state: 'ooit', lastCookedOn: null };
  }
  return { state: 'geen_planning', lastCookedOn: null };
}

const STATE_SORT_ORDER: Readonly<Record<RecipeSchedulingState, number>> = {
  deze_week: 0,
  ooit: 1,
  geen_planning: 2,
  al_gekookt: 3,
};

export interface ScheduledMealRow {
  readonly meal: Meal;
  readonly scheduling: RecipeSchedulingInfo;
}

/** "Deze week" first (task requirement), then the rest by state, alphabetically within a group for a stable, scannable order. */
export function sortMealsByScheduling(
  meals: readonly Meal[],
  saves: readonly Save[],
  cookEvents: readonly CookEvent[],
): readonly ScheduledMealRow[] {
  return meals
    .map((meal) => ({ meal, scheduling: resolveRecipeSchedulingState(meal.id, saves, cookEvents) }))
    .sort((a, b) => {
      const orderDiff = STATE_SORT_ORDER[a.scheduling.state] - STATE_SORT_ORDER[b.scheduling.state];
      return orderDiff !== 0 ? orderDiff : a.meal.title.localeCompare(b.meal.title, 'nl');
    });
}

export function buildSchedulingLabel(state: RecipeSchedulingState): string {
  switch (state) {
    case 'deze_week':
      return 'Deze week';
    case 'ooit':
      return 'Ooit';
    case 'al_gekookt':
      return 'Al gekookt';
    case 'geen_planning':
      return 'Nog geen planning';
    default: {
      const exhaustiveCheck: never = state;
      throw new Error(`Unhandled RecipeSchedulingState: ${String(exhaustiveCheck)}`);
    }
  }
}

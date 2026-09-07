/**
 * Pure "what will actually happen with this recipe" resolver for "Mijn
 * recepten" (src/app/(tabs)/recipes.tsx) — the task brief's requirement
 * that the list be "live", not an archive: every row shows its real
 * scheduling state instead of a flat pile of saved titles. No React
 * Native imports here on purpose, so this is unit-testable directly under
 * vitest's `node` environment — see tests/recipeScheduling.test.ts.
 */

import { averageCookRating } from '@/domain/cookRating';
import type { CookEvent, Meal, MealId, Save } from '@/domain/types';

export type RecipeSchedulingState = 'deze_week' | 'ooit' | 'al_gekookt' | 'geen_planning';

export interface RecipeSchedulingInfo {
  readonly state: RecipeSchedulingState;
  /** IsoDateString, set only for `al_gekookt`. */
  readonly lastCookedOn: string | null;
  /**
   * The grade the cook gave the most recent cook event, or null when there is
   * none to show: the meal was never cooked, the question was skipped, or the
   * stored number is off the scale rating.ts currently defines.
   *
   * WHY THE TILE NEEDED THIS. THE OWNER, VERBATIM: "Om duidelijk te maken dat
   * je het recept nog niet hebt gemaakt is het misschien beter om het cijfer
   * dat je het recept gaf weer te geven, als het niet zo is kan je een
   * chefsmuts laten zien ... maar dan met witte achtergrond in plaats van
   * groen." libraryTileBadge.ts turns that into a badge; this field is the
   * one fact it was missing.
   *
   * IT IS LIFTED HERE RATHER THAN FETCHED THERE because this resolver already
   * holds the whole `CookEvent` — `findLatestCookEvent` below returns it — and
   * the library screen holds only the resolved row. The alternative, a new
   * prop threaded from src/app/(tabs)/recipes.tsx into RecipeTile, would mean
   * two definitions of "the latest cook event", one of which could disagree
   * with the badge sitting on top of it. That is the same argument
   * librarySchedulingCopy.ts already makes for reading nothing of its own.
   *
   * OPTIONAL, NOT REQUIRED, AND THAT IS A DELIBERATE COST. Fixtures build
   * `RecipeSchedulingInfo` literals by hand (tests/libraryGridFilter.test.ts)
   * and predate this field, so requiring it would edit files this change does
   * not own. It is the same accommodation `CookEvent.rating?` and
   * `Meal.allergenTagStatus?` already make in src/domain/types.ts, for
   * exactly this reason. The failure mode is bounded: a row built without it
   * draws the chef's hat, which is TRUE of any cooked meal — the badge loses
   * information, it never gains a falsehood.
   *
   * ⚠ IT IS A MEAN OVER EVERY COOK, NOT THE LATEST ONE — the owner asked for
   * that on 8 September 2026 ("Als je opnieuw het recept kookt, kan je vanaf
   * dan het gemiddelde cijfer laten zien"). A meal cooked once averages to
   * its single grade, so nothing changed for the common case and there is no
   * `count > 1` branch anywhere: one rule, not two that can disagree.
   * src/domain/cookRating.ts owns the arithmetic and the reason an ungraded
   * cook is absent from the mean rather than counted as a zero.
   *
   * ⚠ READ THIS ONLY TO SHOW THE NUMBER. src/domain/types.ts forbids reading
   * `CookEvent.rating` to decide whether a household LIKED a meal, and that
   * still stands: `resolveRepeatSignal` answers that question. Showing what
   * the cook wrote is a different question, and `resolveRepeatSignal` would
   * answer it wrongly — it projects onto a boolean and returns null across
   * rating.ts's whole middle band, so a 6,0 somebody actually gave would
   * vanish from the tile.
   */
  readonly averageRating?: number | null;
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
    // ⚠ THE DATE AND THE NUMBER NO LONGER DESCRIBE THE SAME EVENING, and
    // that is deliberate rather than an oversight. `lastCookedOn` is the most
    // recent cook; `averageRating` is every cook. This block used to take
    // both off the one event so a tile's number and its date matched, and the
    // owner's request replaced that: he wants the recipe's standing grade,
    // not the last night's. The two answer different questions and only one
    // of them is ever drawn on the tile.
    return {
      state: 'al_gekookt',
      lastCookedOn: latestCookEvent.cookedOn,
      averageRating: averageCookRating(cookEvents, mealId as MealId),
    };
  }

  const activeSave = findMostRecentActiveSave(mealId, saves);
  if (activeSave?.intent === 'this_week') {
    return { state: 'deze_week', lastCookedOn: null, averageRating: null };
  }
  if (activeSave?.intent === 'someday') {
    return { state: 'ooit', lastCookedOn: null, averageRating: null };
  }
  return { state: 'geen_planning', lastCookedOn: null, averageRating: null };
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

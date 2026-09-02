/**
 * LIB-06: the week a household actually planned, as an ordered list of
 * dishes.
 *
 * ---
 *
 * THIS MODULE DOES NOT DEFINE "DEZE WEEK", AND THAT IS THE WHOLE POINT OF
 * ITS SIGNATURE. `src/app/boodschappen.tsx` states the definition once, in
 * as many words: "PLANNED THIS WEEK MEANS `listPendingSaves(householdId,
 * 'this_week')`". The shopping list is built from exactly that query, and
 * the week screen is built from exactly that query, because a plan and the
 * list it fills are two readings of ONE fact — the moment they are two
 * queries they start disagreeing, and the household is left holding
 * ingredients for a dinner its own plan no longer shows.
 *
 * So `buildWeekPlan` takes the saves it is given and narrows NOTHING. It
 * does not re-check `intent`, it does not re-derive "pending", it does not
 * drop a meal it thinks looks wrong. Every one of those would be a second,
 * quieter definition of the week living inside a function whose caller
 * believes it is only sorting — and the second definition always wins,
 * because it is the one that ran last. The only correct input is the same
 * `listPendingSaves(householdId, 'this_week')` result the shopping list
 * folds into ingredients; tests/weekPlan.test.ts pins that by handing it a
 * `'someday'` save and asserting it comes straight back out.
 *
 * ---
 *
 * NO DISH IS GIVEN A DAY. A `Save` carries `savedAt` — when the household
 * decided on the dish — and nothing anywhere carries when they intend to
 * COOK it. Those are different facts, and a weekday printed beside a dish
 * on a screen headed "Deze week" would be read as the second one every
 * time. So `plannedAt` is a sort key and never a rendered date: this list
 * has an order, not a calendar. If a household ever gets to say
 * "donderdag", that is a new column, a new migration and a new decision —
 * not a formatting choice made quietly inside a sort comparator.
 *
 * OLDEST FIRST, for stability rather than recency. Newest-first would move
 * every existing row down the screen each time somebody plans something,
 * so the row a household looks at most — the first one — changes for a
 * reason that has nothing to do with dinner. Built in the order it was
 * built, a new plan appends to the end and nothing above it moves.
 *
 * ---
 *
 * ONE ROW PER DISH, DATED BY THE FIRST SAVE. Two people saving the same
 * dish for the same week planned it once between them; the second save
 * restated an existing plan rather than adding a dinner, so the dish keeps
 * the moment it entered the week. This is the same de-duplication
 * boodschappen.tsx's `uniqueMealIds` performs before fetching a single
 * ingredient, and `plannedMealCount` below is deliberately the same number
 * that screen counts — see its own comment.
 *
 * A SAVE WHOSE MEAL COULD NOT BE READ IS REPORTED, NOT INVENTED AND NOT
 * SWALLOWED. `RemyRepository.getMeal` answers `null` for an id that
 * resolves to nothing, and there is no honest row to draw from that: a
 * placeholder title would be a fact nobody stated. Dropping it silently is
 * worse in a different way — the shopping list still buys that meal's
 * ingredients, so a dropped row makes the two screens disagree about how
 * many dinners this week holds. `unresolvedMealIds` keeps it visible and
 * `plannedMealCount` keeps counting it.
 *
 * AN ARCHIVED DISH STAYS, FLAGGED. A household that removed a dish from
 * Mijn recepten (`archiveMeal`) still has its `this_week` save standing —
 * `listPendingSaves` never looks at `meals.archived_at` — so its
 * ingredients are still on the shopping list. Hiding it here would make
 * this screen lie about that list; `isArchived` lets the screen say the
 * true and slightly awkward thing instead.
 *
 * ---
 *
 * PURE, deterministic, immutable, and it never throws: no I/O, no
 * `Date.now()`, no randomness, no input array sorted in place, and no
 * input object mutated. Ordering is fully specified down to the meal id,
 * so the same saves and meals in any input order produce the identical
 * list — see `compareEntries`.
 */

import type { IsoDateTimeString, Meal, MealId, Save } from './types';

/** One planned dish. `meal` is the row as the repository returned it — this module adds nothing to it. */
export interface WeekPlanEntry {
  readonly meal: Meal;
  /**
   * The moment this dish entered the week: the EARLIEST `savedAt` among
   * its saves. A sort key, not a date to render — see this file's header
   * on why nothing here becomes a weekday.
   */
  readonly plannedAt: IsoDateTimeString;
  /** `meal.archivedAt !== null`, normalised once so no screen re-derives it. See the header. */
  readonly isArchived: boolean;
}

export interface WeekPlan {
  readonly entries: readonly WeekPlanEntry[];
  /** Meal ids that were planned but could not be read back. Never rendered as rows; see the header. */
  readonly unresolvedMealIds: readonly MealId[];
  /**
   * Distinct dishes planned this week — `entries.length` PLUS
   * `unresolvedMealIds.length`, never just the rows that happened to
   * render. This is precisely the number src/app/boodschappen.tsx puts in
   * its own subtitle ("Op basis van N recepten…"), computed from the same
   * saves, and tests/weekPlan.test.ts asserts the two expressions agree.
   * Counting only the drawable rows would let the two screens quote
   * different sizes for one week.
   */
  readonly plannedMealCount: number;
}

/**
 * Earliest `savedAt` per meal id. A plain `<` on two `IsoDateTimeString`s
 * is a real chronological comparison — they are fixed-width UTC ISO-8601,
 * so lexical and chronological order coincide — which keeps this free of
 * `Date` parsing and therefore free of the host timezone.
 */
function collectEarliestSaveTimes(saves: readonly Save[]): ReadonlyMap<MealId, IsoDateTimeString> {
  const earliest = new Map<MealId, IsoDateTimeString>();
  for (const save of saves) {
    const known = earliest.get(save.mealId);
    if (known === undefined || save.savedAt < known) {
      earliest.set(save.mealId, save.savedAt);
    }
  }
  return earliest;
}

function indexMealsById(meals: readonly Meal[]): ReadonlyMap<MealId, Meal> {
  return new Map(meals.map((meal) => [meal.id, meal]));
}

/** Codepoint comparison, for ids and timestamps — machine strings, where a locale would add nothing and could vary by runtime. */
function compareMachineStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

/**
 * Order: when it entered the week, then the dish title, then the meal id.
 *
 * The title tie-break uses Dutch collation rather than the codepoint rule
 * `buildShoppingList.ts` argues for, and the difference is not an
 * oversight. That function orders machine-normalised ingredient keys,
 * where locale data buys nothing and risks a runtime-dependent result;
 * these are human dish titles a reader is looking at, so they have to fall
 * where a Dutch reader expects — the same call `src/domain/social/kring.ts`
 * and `librarySort.ts` already make for exactly this reason. The final
 * `id` step is what keeps the comparator total: two dishes with the same
 * title on the same instant still land in a fixed order rather than
 * whichever the input happened to carry first.
 */
function compareEntries(left: WeekPlanEntry, right: WeekPlanEntry): number {
  const byPlannedAt = compareMachineStrings(left.plannedAt, right.plannedAt);
  if (byPlannedAt !== 0) {
    return byPlannedAt;
  }
  const byTitle = left.meal.title.localeCompare(right.meal.title, 'nl');
  if (byTitle !== 0) {
    return byTitle;
  }
  return compareMachineStrings(left.meal.id, right.meal.id);
}

/**
 * Folds this week's pending saves and the meals they point at into one
 * ordered plan. See this file's header for why it narrows nothing, why
 * nothing here becomes a date, and what happens to a save whose meal could
 * not be read.
 *
 * `saves` must be `RemyRepository.listPendingSaves(householdId,
 * 'this_week')`. `meals` are those saves' meals as
 * `RemyRepository.getMeal` returned them, with the nulls dropped —
 * deliberately NOT `listHouseholdMeals`, which filters out archived meals
 * and would silently shrink a week the shopping list is still shopping
 * for.
 *
 * Both output arrays are freshly built here, so sorting them is not a
 * mutation of anything the caller can see.
 */
export function buildWeekPlan(saves: readonly Save[], meals: readonly Meal[]): WeekPlan {
  const plannedAtByMealId = collectEarliestSaveTimes(saves);
  const mealsById = indexMealsById(meals);

  const entries: WeekPlanEntry[] = [];
  const unresolvedMealIds: MealId[] = [];

  for (const [mealId, plannedAt] of plannedAtByMealId) {
    const meal = mealsById.get(mealId);
    if (meal === undefined) {
      unresolvedMealIds.push(mealId);
      continue;
    }
    entries.push({ meal, plannedAt, isArchived: meal.archivedAt !== null });
  }

  return {
    entries: entries.sort(compareEntries),
    unresolvedMealIds: unresolvedMealIds.sort(compareMachineStrings),
    plannedMealCount: entries.length + unresolvedMealIds.length,
  };
}

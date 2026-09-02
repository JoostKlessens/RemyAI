/**
 * Save reads/writes.
 *
 * `listPendingSaves` is what feeds DecisionRequest.pendingThisWeekSaves /
 * pendingSomedaySaves (PD-004a) — see decisions.ts for the DecisionRequest
 * assembly — and it is also, through src/app/boodschappen.tsx and
 * src/app/deze-week.tsx, the single definition of "deze week" both of those
 * screens read. Three consumers, one query, on purpose: the moment a screen
 * narrows this result further it owns a second, quieter definition of the
 * week, and the second one always wins because it is the one that ran last.
 *
 * ---
 *
 * A SAVE IS PENDING WHEN TWO THINGS ARE TRUE, AND BOTH ARE CHECKED HERE
 * RATHER THAN BY A CALLER.
 *
 * 1. THE MEAL HAS NOT BEEN COOKED SINCE THE SAVE. Once cooked, the
 *    household got what it saved the meal for, so continuing to boost its
 *    score — or to keep buying its ingredients — would be wrong. This is a
 *    deliberately simple rule: supabase/migrations/0001_init.sql has no
 *    `resolved_at`/`served_at` column on `saves`, so "resolved" is derived
 *    from cook history rather than stored.
 *
 * 2. THE MEAL IS NOT ARCHIVED. `archiveMeal` (LIB-04's "Verwijderen")
 *    stamps `meals.archived_at` and does not touch the dish's saves —
 *    correctly, since a save is not history to preserve. Until this filter
 *    existed the consequence was a live, user-visible bug: a dish the
 *    household had removed from Mijn recepten kept its `this_week` save
 *    forever, kept standing on the week screen, and — the part that costs
 *    money — kept contributing its ingredients to the shopping list. There
 *    was no act available to any household that could stop it, because
 *    cooking a dish you have removed is not something anybody does.
 *
 * WHY THE ARCHIVED CHECK IS HERE AND NOT IN THE TWO SCREENS THAT NEEDED
 * IT. Fixing it in boodschappen.tsx alone would have left the week screen
 * showing a dish nothing shops for; fixing it in both would have been two
 * copies of one rule, and boodschappen.tsx's own header states in as many
 * words that "planned this week" IS this method's result. A filter a
 * caller applies is a filter the next caller forgets.
 *
 * AND WHY THE DECISION ENGINE GETS IT TOO, WHICH IS THE LESS OBVIOUS HALF.
 * `pendingThisWeekSaves`/`pendingSomedaySaves` are scoring boosts
 * (scoring.ts's SAVED_THIS_WEEK_BOOST and the SOMEDAY_SAVE_* aging boost),
 * and today they cannot reach an archived dish anyway: `candidateMeals` is
 * `listHouseholdMeals`, which has filtered `archivedAt === null` since
 * before anything wrote it. So this changes no suggestion today — and it
 * is still right, for two reasons. `archiveMeal`'s own contract
 * (src/lib/repository/types.ts) is that archiving is the household's
 * explicit decision to take ONE dish out of rotation; handing the engine a
 * boost for a dish it is forbidden to offer is handing it a fact that can
 * only ever be wrong. And it removes a landmine: the day anything widens
 * the candidate set, an archived dish would arrive pre-boosted by 100.
 *
 * ---
 *
 * `listSaves` DELIBERATELY DOES NOT FILTER, AND THE ASYMMETRY IS THE
 * POINT. It is the raw table read — "every save for this household,
 * regardless of intent or whether it is still pending" — and its one
 * caller, (tabs)/recipes.tsx, joins it against `listHouseholdMeals`, which
 * already drops archived meals, so nothing archived can surface through it.
 * Narrowing it as well would buy no behaviour and cost the only honest way
 * to observe the stored row: tests/repository/localRepository.test.ts has
 * to be able to tell "hidden from a view" apart from "actually deleted",
 * and a `listSaves` that filtered could not answer that question.
 */

import type { HouseholdId, MealId, Save, SaveIntent } from '@/domain/types';
import type { CreateSaveInput } from '../types';
import { generateLocalId } from '../id';
import { nowIso } from '../clock';
import type { RepositoryTables } from './tables';

export async function listSaves(tables: RepositoryTables, householdId: HouseholdId): Promise<readonly Save[]> {
  const saves = await tables.saves.list();
  return saves.filter((save) => save.householdId === householdId);
}

async function hasBeenCookedSince(tables: RepositoryTables, mealId: MealId, savedAt: string): Promise<boolean> {
  const cookEvents = await tables.cookEvents.list();
  return cookEvents.some((event) => event.mealId === mealId && event.cookedOn >= savedAt.slice(0, 10));
}

/**
 * The ids of every meal the household has removed from Mijn recepten.
 *
 * A `Set` rather than a per-save lookup because the caller tests every
 * candidate against it, and because it makes the absence of a meal row
 * MEAN something specific: an id that is not in here is either a live dish
 * or a dish whose row could not be read at all. The second case stays
 * pending on purpose — src/domain/weekPlan.ts reports it as
 * `unresolvedMealIds` rather than dropping it, because the shopping list
 * still counts it and two screens disagreeing about the size of one week
 * is worse than one awkward line.
 */
async function collectArchivedMealIds(tables: RepositoryTables): Promise<ReadonlySet<MealId>> {
  const meals = await tables.meals.list();
  return new Set(meals.filter((meal) => meal.archivedAt !== null).map((meal) => meal.id));
}

export async function listPendingSaves(
  tables: RepositoryTables,
  householdId: HouseholdId,
  intent: SaveIntent,
): Promise<readonly Save[]> {
  const [saves, archivedMealIds] = await Promise.all([
    listSaves(tables, householdId),
    collectArchivedMealIds(tables),
  ]);
  const candidates = saves.filter((save) => save.intent === intent && !archivedMealIds.has(save.mealId));
  const pendingFlags = await Promise.all(
    candidates.map((save) => hasBeenCookedSince(tables, save.mealId, save.savedAt)),
  );
  return candidates.filter((_save, index) => !pendingFlags[index]);
}

export async function createSave(tables: RepositoryTables, input: CreateSaveInput): Promise<Save> {
  const save: Save = {
    id: generateLocalId('save'),
    householdId: input.householdId,
    memberId: input.memberId,
    mealId: input.mealId,
    intent: input.intent,
    sourceUrl: input.sourceUrl,
    savedAt: nowIso(),
  };

  const existing = await tables.saves.list();
  await tables.saves.replaceAll([...existing, save]);
  return save;
}

/**
 * Un-plans one dish at one commitment level — see `removeSaves`'s comment
 * on `RemyRepository` (src/lib/repository/types.ts) for why this is a real
 * delete, why it is keyed by dish rather than by save id, and how that
 * squares with PD-004a.
 *
 * ONE READ, ONE WRITE, WHATEVER THE ROW COUNT, and that is the reason for
 * the signature rather than a micro-optimisation. Two people can save the
 * same dish for the same week (src/domain/weekPlan.ts folds them into one
 * row deliberately), so "take this off the week" is N deletes; N calls to
 * a `removeSave(saveId)` would each read-modify-write the same table key
 * and the last one would clobber the others, while awaiting them in turn
 * would make a half-finished removal a state the screen cannot describe.
 * Scoped by `householdId` as well as `mealId` for the same reason
 * `listSaves` is: this table holds every household's rows in one key.
 */
export async function removeSaves(
  tables: RepositoryTables,
  householdId: HouseholdId,
  mealId: MealId,
  intent: SaveIntent,
): Promise<void> {
  const saves = await tables.saves.list();
  await tables.saves.replaceAll(
    saves.filter(
      (save) => !(save.householdId === householdId && save.mealId === mealId && save.intent === intent),
    ),
  );
}

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
 *
 * `recipeId` (supabase/migrations/0006_canonical_recipes.sql's
 * `meals.recipe_id`) rides on that same row and is written by
 * `buildMealRow` below. It had to be: the column and `Meal.recipeId` both
 * existed from 0006 onward while no write path anywhere populated either,
 * so `shared_cooks` (0009) had nothing to join a friend's cook to
 * and the whole cook-proof feature was unreachable on real data — a bug
 * every test missed because they all built their `Meal` by hand instead of
 * going through `createMeal`.
 *
 * Unlike `dishTags` it is deliberately NOT backfilled on read. The two
 * look like the same problem and are not: `Meal.dishTags` is a required
 * array, so an old row's missing key is an `undefined` that crashes the
 * first `.some()` downstream — a repair, not a default. `Meal.recipeId` is
 * optional AND nullable, so a missing key is already one of its legal
 * values and every reader treats it as such (`meal.recipeId ?? null` in
 * src/domain/scoring.ts). Backfilling it would mean allocating a fresh
 * object for every legacy row on every read to restate what the type
 * already says. Rows written from here on always carry the key explicitly,
 * so the ambiguity does not grow.
 *
 * `excludedFromCookProof` (0009's `meals.excluded_from_cook_proof`) rides
 * on the same row again — "Deel deze niet", DESIGN-SOCIAL.md §3.5. It
 * follows `recipeId`'s posture, not `dishTags`': optional and not
 * backfilled on read, because a missing key is already one of its legal
 * values. What it does NOT share with either is where the two setters
 * below normalise it — see `getMealCookProofExclusion` for why an optional
 * privacy flag whose absent reading is fail-open gets a dedicated reader
 * rather than a `?? false` scattered across call sites.
 *
 * `dishMoods` (supabase/migrations/0010_dish_moods.sql's
 * `meals.dish_moods`) is the second descriptive axis and rides the same
 * row again — but it is the only one of these four written AFTER the meal
 * exists, by a person, in the outcome moment. `addMealDishMood` below is
 * its whole write path; nothing sets it at create time and no import
 * screen may. It takes `recipeId`'s optional-and-not-backfilled posture
 * rather than `dishTags`' repaired-on-read one, because a missing key is
 * already one of its legal values — the normalisation that would be a
 * repair for `dishTags` is just a read for this, and it lives in
 * `readMealDishMoods` (src/domain/dishMoods.ts) so that the domain's
 * filter and this file's setter agree by construction.
 */

import type { CreateMealInput, MealIngredientInput, MealStepInput } from '../types';
import { isDishMood, readMealDishMoods } from '@/domain/dishMoods';
import { normalizeTag } from '@/domain/normalizeTag';
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
    // Same reading of an omitted optional as `dishTags` above, resting on
    // the same stored/absent equivalence: a caller with no canonical
    // recipe to point at is saying this meal is a copy of nothing, which
    // is precisely what `null` means here (0006's `meals.recipe_id` is
    // nullable for exactly that majority — seeded, curated, hand-entered).
    // Written explicitly rather than left off the row so that every meal
    // this app creates states its provenance one way or the other.
    recipeId: input.recipeId ?? null,
    sourceUrl: input.sourceUrl,
    sourcePlatform: input.sourcePlatform,
    // A meal is never born with a mood, and `CreateMealInput` deliberately
    // has no counterpart field. Axis 2 is what a PERSON says after cooking
    // the dish (see `Meal.dishMoods`); an import screen guessing at it
    // would put a stranger's word in a household's mouth, and the LLM
    // extraction path has no basis for the guess — nobody has eaten
    // anything yet. Written explicitly for the same reason `recipeId` and
    // `excludedFromCookProof` are: every row this app creates states its
    // own answer rather than leaving a reader to infer one from silence.
    dishMoods: [],
    thumbnailUrl: input.thumbnailUrl,
    // Hard-coded rather than taken from the input, and `CreateMealInput`
    // deliberately has no counterpart field: a meal is never born
    // excluded. "Deel deze niet" (DESIGN-SOCIAL.md §3.5) is a later,
    // deliberate act on a dish already in the library, taken because THIS
    // dish says too much — a judgement nobody can have made at the moment
    // they saved a video. Offering it as a create-time option would invite
    // an import screen to guess, and a guessed exclusion is either a
    // silence nobody asked for or, worse, a `false` that reads as consent.
    // Written explicitly for the same reason `recipeId` above is: every
    // row this app creates should state its own answer.
    excludedFromCookProof: false,
    archivedAt: null,
    createdAt: nowIso(),
  };
}

/**
 * DESIGN-SOCIAL.md §3.5 — is this meal withheld from cook proof?
 *
 * `?? false` here is the mirror of `getHouseholdCookSharing`'s, with the
 * asymmetry worth naming: on the household side a missing key fails
 * CLOSED (never asked, so shares nothing), while here it fails OPEN
 * (nobody has ever asked for this dish to be withheld, so it is not
 * withheld). Both readings are the honest one — 0009 defaults both
 * columns to `false` and they mean opposite things — but only one of them
 * is forgiving of a mistake, which is exactly why this normalisation lives
 * at the seam instead of at each call site.
 *
 * An unknown meal id throws rather than answering `false`, because `false`
 * is the sharing answer: a lookup failure must not be able to grant
 * permission to share a dish nobody could even find.
 */
export async function getMealCookProofExclusion(tables: RepositoryTables, mealId: MealId): Promise<boolean> {
  const meal = await getMeal(tables, mealId);
  if (meal === null) {
    throw new Error(`No meal found with id "${mealId}".`);
  }
  return meal.excludedFromCookProof ?? false;
}

/**
 * DESIGN-SOCIAL.md §3.5 — sets or lifts "Deel deze niet" for one meal.
 *
 * Touches this meal row and nothing else. That is what makes 0009's
 * promise true rather than merely intended: the exclusion never reads or
 * writes `households.share_cooks_with_friends`, so it is independent of
 * the global opt-in and survives it being toggled off and on, and a
 * household that has not opted in at all can still mark a dish in advance.
 * It also never touches `recipe_shares` or `recipe_ratings` — an excluded
 * meal can still be SENT (a send is its own explicit act, aimed at one
 * named person, withdrawn per-act with `Stop delen`), and a public vote is
 * withdrawn only by deleting the vote.
 *
 * Setting `true` silences this meal's cook proof including THE PAST. That
 * needs no work here and no history to rewrite: proof is assembled per
 * read from `shared_cooks`, and nothing is stored on the friend's side, so
 * the exclusion simply removes the meal from the next assembly and the
 * back catalogue goes with it at their next open.
 */
export async function setMealCookProofExclusion(
  tables: RepositoryTables,
  mealId: MealId,
  excludedFromCookProof: boolean,
): Promise<Meal> {
  return updateMeal(tables, mealId, (meal) => ({ ...meal, excludedFromCookProof }));
}

/**
 * LIB-04's "Verwijderen" — see `archiveMeal`'s comment on `RemyRepository`
 * (src/lib/repository/types.ts) for the full argument on why this is a
 * soft delete rather than a real one. One line, on purpose: it is the same
 * read-modify-write every other single-field setter in this file already
 * uses, writing a column (`archived_at`) `buildMealRow` has stamped `null`
 * on every meal since before anything set it to anything else.
 */
export async function archiveMeal(tables: RepositoryTables, mealId: MealId): Promise<Meal> {
  return updateMeal(tables, mealId, (meal) => ({ ...meal, archivedAt: nowIso() }));
}

/**
 * The outcome moment's public half — one person's mood for one dish, from
 * dishMoods.ts's closed vocabulary.
 *
 * WHAT IT DOES NOT TOUCH, AND THAT IS THE POINT (PD-019). This writes one
 * `meals` row. It never reads, copies or derives anything from
 * `cook_events.rating` — the private grade given in the same breath — so
 * there is no path by which the household's engine input becomes visible
 * to anybody. The two answers travel to two tables through two calls, and
 * this one is the only one that was ever meant to be public. Publishing it
 * is safe because a mood carries no number and no mood outranks another:
 * there is nothing here to inflate, which is the exact pressure PD-019
 * protects the grade from.
 *
 * ADDITIVE AND IDEMPOTENT, never a replace. A dish is cooked more than
 * once and by more than one person, and one mood per rating is the
 * owner's own shape ("één van deze categorien"). Overwriting would let
 * tonight's cook silently delete last month's honest description, and a
 * stamppot genuinely is both `winters` and `soul-food`. Two cooks
 * agreeing is still one description, so the union de-duplicates rather
 * than counting — a count would be the first brick of a popularity number
 * on a vocabulary that must never have one.
 *
 * VALIDATED HERE, AT THE SEAM, rather than trusted from the caller. The
 * vocabulary is closed because a value outside it is unfilterable, and
 * storing an unfilterable value is storing something nobody can ever ask
 * for again. Normalizing first and rejecting second mirrors
 * `setCookEventRating`'s posture on an off-scale grade: fail at the
 * boundary rather than write a row that can never be pushed to Postgres
 * (0010's `meals_dish_moods_closed_vocabulary` CHECK would refuse it).
 * The mood is normalized before comparison, so a padded or capitalized
 * value from a route param still lands as the one canonical spelling.
 *
 * An unknown meal id throws, via `updateMeal` — the same contract every
 * setter in this file keeps.
 */
export async function addMealDishMood(
  tables: RepositoryTables,
  mealId: MealId,
  mood: string,
): Promise<Meal> {
  const normalized = normalizeTag(mood);
  if (!isDishMood(normalized)) {
    throw new Error(`Dish mood "${mood}" is not part of the closed vocabulary in src/domain/dishMoods.ts.`);
  }
  return updateMeal(tables, mealId, (meal) => {
    const existing = readMealDishMoods(meal);
    return existing.includes(normalized) ? meal : { ...meal, dishMoods: [...existing, normalized] };
  });
}

/**
 * Read-modify-write for exactly one meal — the same shape as
 * local/cookEvents.ts's `updateCookEvent` and local/household.ts's
 * `updateHousehold`, so the "not found" contract and the immutable replace
 * are stated once per table rather than once per setter. `change` must
 * return a new object; nothing here mutates the row it is handed, and the
 * surrounding array is rebuilt by `map` rather than spliced in place.
 *
 * The row is passed through `toMealRow` on the way in, so a setter can
 * never write back a legacy row's missing `dishTags` as an explicit
 * `undefined` — repairing on read and then spreading the unrepaired
 * original would persist the very shape `toMealRow` exists to absorb.
 */
async function updateMeal(
  tables: RepositoryTables,
  mealId: MealId,
  change: (meal: Meal) => Meal,
): Promise<Meal> {
  const meals = await tables.meals.list();
  let updated: Meal | undefined;
  const next = meals.map((meal) => {
    if (meal.id !== mealId) {
      return meal;
    }
    updated = change(toMealRow(meal));
    return updated;
  });
  if (updated === undefined) {
    throw new Error(`No meal found with id "${mealId}".`);
  }
  await tables.meals.replaceAll(next);
  return updated;
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

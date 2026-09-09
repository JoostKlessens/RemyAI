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
 *
 * `dishCourse` (supabase/migrations/0017_dish_course.sql's
 * `meals.dish_course`) is the third and last of these, and it is the only
 * one that is NOT a list. It takes a posture none of the other four
 * share, because it is the only field on this row with a DEFAULT that
 * means something: `buildMealRow` writes `DEFAULT_DISH_COURSE` when the
 * caller says nothing, and `readMealDishCourse`
 * (src/domain/dishCourses.ts) reads an absent OR an unrecognised value as
 * that same default. Both halves are needed and neither is redundant —
 * the write keeps new rows self-describing, the read covers every row
 * written before the field existed, which is all of them. `dishTags`'
 * repaired-on-read posture is the closest precedent; the difference is
 * that a repaired `dishTags` is `[]` ("nobody has said"), while a
 * defaulted course is a positive claim the owner authorised: "standaard
 * is iets een hoofdgerecht".
 *
 * BOTH DESCRIPTIVE TAXONOMIES ARE NOW WRITTEN TWICE: once at create, and
 * once by `updateMealRecipe`, which is the editor. That is new for
 * `dishTags`, and it closed a real defect rather than adding a feature —
 * until the owner asked ("Kan je de tags niet aanpassen handmatig?") the
 * column's only writer was the extraction model, so a mis-tagged import
 * and every hand-typed recipe were permanently invisible to the library's
 * dish-category filter. Both are narrowed at that seam by the domain's own
 * `sanitize…` functions; see `updateMealRecipe` for why one drops what it
 * cannot place and the other falls back.
 */

import type { CreateMealInput, MealIngredientInput, MealStepInput, UpdateMealRecipeInput } from '../types';
import { DEFAULT_DISH_COURSE, sanitizeDishCourse } from '@/domain/dishCourses';
import { isDishMood, readMealDishMoods } from '@/domain/dishMoods';
import { sanitizeDishTags } from '@/domain/dishTags';
import { haveIngredientsChanged, resolveAllergenStateAfterEdit } from '@/domain/mealAllergenReverification';
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

/**
 * GAP-34 — every ingredient row of the meals `listHouseholdMeals` returns,
 * in one read. Scoped THROUGH that function rather than by a household
 * test of its own, so "the household's meals" has one definition here and
 * the dislike gate can never see a row that function would not have
 * listed — an archived meal's, another household's.
 */
export async function listHouseholdMealIngredients(
  tables: RepositoryTables,
  householdId: string,
): Promise<readonly MealIngredient[]> {
  const [meals, ingredients] = await Promise.all([
    listHouseholdMeals(tables, householdId),
    tables.mealIngredients.list(),
  ]);
  const mealIds = new Set(meals.map((meal) => meal.id));
  return ingredients.filter((ingredient) => mealIds.has(ingredient.mealId));
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

/**
 * `preservedSections` IS FOR ONE CALLER AND ITS DEFAULT IS THE HONEST ONE.
 *
 * `createMeal` passes nothing: an import states every heading it has
 * (`MealIngredientDraft.section` is required so it cannot be forgotten), and
 * a manual entry has none, so there is nothing to fall back to. Only
 * `updateMealRecipe` supplies a list, and only when it has established that
 * the stored headings still describe the list being written — see its own
 * comment for why that is a narrow condition rather than a merge.
 *
 * `undefined` AND `null` ARE READ DIFFERENTLY HERE, which is the one place in
 * this file that distinction earns its keep. A caller that STATES
 * `section: null` is saying "this ingredient belongs to no sub-recipe" and is
 * obeyed; a caller that omits the field is saying nothing, and gets whatever
 * was preserved for that position. Collapsing the two with `??` would let a
 * deliberate "no heading" be silently overruled by a stale stored one.
 */
function buildIngredientRows(
  mealId: MealId,
  ingredients: readonly MealIngredientInput[],
  preservedSections: readonly (string | null)[] = [],
): readonly MealIngredient[] {
  return ingredients.map((ingredient, index) => ({
    id: generateLocalId('meal-ingredient'),
    mealId,
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    allergenTags: [],
    sortOrder: ingredient.sortOrder,
    section: ingredient.section !== undefined ? ingredient.section : (preservedSections[index] ?? null),
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
    // "standaard is iets een hoofdgerecht" — the owner's answer, applied
    // at the one seam that creates rows so no screen has to remember it.
    //
    // WRITTEN EXPLICITLY EVEN THOUGH ABSENCE ALREADY READS AS THE DEFAULT
    // (`readMealDishCourse`), for `recipeId`'s and `excludedFromCookProof`'s
    // reason: every row this app creates states its own answer rather than
    // leaving a reader to infer one from silence. The reader still exists
    // and still has work to do — every row written before this field did
    // has no such key — but nothing this app writes from here on adds to
    // that pile.
    dishCourse: input.dishCourse ?? DEFAULT_DISH_COURSE,
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
 * One of the outcome moment's public writes — one person's mood for one
 * dish, from dishMoods.ts's closed vocabulary.
 *
 * WHAT IT DOES NOT TOUCH, AND THAT IS THE POINT (PD-019). This writes one
 * `meals` row. It never reads, copies or derives anything from
 * `cook_events.rating` — the private grade given in the same breath — so
 * there is no path by which the household's engine input becomes visible
 * to anybody. Publishing a mood is safe because it carries no number and
 * no mood outranks another: there is nothing here to inflate, which is
 * the exact pressure PD-019 protects the grade from.
 *
 * IT IS NOT "THE ONLY ONE THAT WAS EVER MEANT TO BE PUBLIC", WHICH IS
 * WHAT THIS COMMENT USED TO SAY. That was true of the code as it stood,
 * and stopped being true when the outcome card began casting a
 * `recipe_ratings` vote from the grade as well (src/domain/social/
 * publicVote.ts — "the rating should also be represented in the global
 * ranking of a recipe"). The claim above survives that untouched and is
 * the one worth keeping: this function still writes nothing but a `meals`
 * row, and the public vote is written through an entirely different
 * repository from a value the caller hands to both, never derived here
 * from anything.
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

/**
 * RCP-03 — "Aanpassen". The only write path in this file that touches a
 * meal's children after it exists. See `updateMealRecipe`'s comment on
 * `RemyRepository` (src/lib/repository/types.ts) for what it may and may not
 * change, and `UpdateMealRecipeInput`'s for why the children are replaced
 * wholesale.
 *
 * THE ORDER IS PARENT-LAST, DELIBERATELY. `updateMeal` throws on an unknown
 * meal id, so doing it first would leave the two child tables rewritten for
 * a meal that does not exist — orphan ingredient rows nothing can ever read
 * or clean up. Reading the meal first and writing it last means a bad id
 * costs zero writes, and the child rewrite only happens for a row we have
 * already proved is there.
 *
 * THE THREE WRITES ARE NOT ATOMIC, AND NOTHING HERE PRETENDS THEY ARE. This
 * is a KeyValueStore, not a transaction; a process killed between the
 * ingredient write and the step write leaves the new ingredients beside the
 * old steps. That failure is accepted rather than papered over, for the same
 * reason mirrorWrites.ts accepts its own: the alternative is a
 * write-ahead-log inside AsyncStorage, which is a storage engine and not a
 * meal editor. What IS defended is the direction of the damage — the parent
 * row's title and allergen state land last, so a half-applied edit reads as
 * the OLD recipe with some new lines rather than as a NEW title vouching for
 * an old ingredient list.
 *
 * PD-006 IS APPLIED BEFORE THE PARENT IS WRITTEN, from the stored row and
 * the stored ingredient list — never from anything the caller asserted about
 * them. That matters: reading `storedIngredients` here rather than trusting
 * a "did it change?" boolean from the screen is what makes the demotion
 * impossible to skip from the outside. A screen that forgets to compare, or
 * compares wrongly, still gets the fail-closed answer.
 */
export async function updateMealRecipe(
  tables: RepositoryTables,
  mealId: MealId,
  input: UpdateMealRecipeInput,
): Promise<Meal> {
  const stored = await getMeal(tables, mealId);
  if (stored === null) {
    throw new Error(`No meal found with id "${mealId}".`);
  }

  const storedIngredients = await getMealIngredients(tables, mealId);

  const allergens = resolveAllergenStateAfterEdit({
    stored: {
      ingredientTags: stored.ingredientTags,
      // The same `?? 'unknown'` fail-safe reading exclusions.ts gives a row
      // that predates the column. Resolved at this seam so the pure ruling
      // never has to invent one.
      allergenTagStatus: stored.allergenTagStatus ?? 'unknown',
    },
    storedIngredients,
    editedIngredients: input.ingredients,
    check: input.allergenCheck,
  });

  // SUB-RECIPE HEADINGS SURVIVE AN EDIT THAT DID NOT TOUCH THE INGREDIENTS,
  // AND ONLY THAT EDIT (`meal_ingredients.section`, migration 0018).
  //
  // WHY THIS IS NEEDED AT ALL. `UpdateMealRecipeInput` carries no section,
  // because src/app/recipe-edit/[mealId].tsx edits an ingredient as ONE
  // free-text line and has no control for a heading. Without this, the
  // replace below would write every row back with no section, so opening the
  // editor and pressing save — to fix a typo in the TITLE — would delete
  // every heading in the recipe. That is precisely the failure
  // editedIngredients.ts exists to end, one field over: "opening the screen
  // and pressing Doorgaan was enough to destroy amounts the source had
  // actually given us".
  //
  // WHY THE CONDITION IS `haveIngredientsChanged` AND NOT A COMPARISON OF ITS
  // OWN. That predicate already decides whether a stored allergen check still
  // stands, three lines up, and it asks exactly the question that matters
  // here too: is this still the list that was stored? A second definition of
  // "unchanged" in this function would be a second answer to one question,
  // and the two would drift the first time either was tightened.
  //
  // WHY ALL-OR-NOTHING, AND NOT PER LINE. Keeping the heading for the lines
  // that did not change would mean deciding that "position 2 of the edited
  // list is position 2 of the stored list" — the row identity
  // src/lib/repository/types.ts refuses to invent for quantity and unit,
  // and it is not more available here. A user who deletes the first
  // ingredient would shift every remaining line one heading up, silently, in
  // stored data. Dropping the headings when the list moves is visible on the
  // very next read, and it is honest: nobody restated them, and this layer
  // does not invent food.
  const preservedSections = haveIngredientsChanged(storedIngredients, input.ingredients)
    ? []
    : storedIngredients.map((ingredient) => ingredient.section ?? null);

  await replaceMealChildren(tables, mealId, input.ingredients, input.steps, preservedSections);

  return updateMeal(tables, mealId, (meal) => ({
    ...meal,
    title: input.title,
    estimatedMinutes: input.estimatedMinutes,
    servings: input.servings,
    ingredientTags: allergens.ingredientTags,
    allergenTagStatus: allergens.allergenTagStatus,
    // THE TWO DESCRIPTIVE TAXONOMIES, NARROWED HERE RATHER THAN TRUSTED
    // FROM THE SCREEN — and narrowed differently, on purpose.
    //
    // `sanitizeDishTags` DROPS what it does not recognise. That is safe
    // and right for a list: dropping leaves a shorter list, and a shorter
    // list is a legal state ("this recipe has no recognised category").
    // It is also the whole point of opening this field to a person. The
    // vocabulary is closed because a value outside it is UNFILTERABLE, and
    // this write path exists precisely to repair the filter — storing
    // "italiaans" here would break the thing the change was made to fix.
    dishTags: sanitizeDishTags(input.dishTags, normalizeTag),
    // `sanitizeDishCourse` FALLS BACK to the default instead. There is no
    // shorter list to fall back to for a single value, and the fallback is
    // not this layer's invention — "standaard is iets een hoofdgerecht" is
    // the owner's own reading of a dish nobody has classified.
    //
    // NEITHER OF THESE THROWS, WHERE `addMealDishMood` DOES, and the
    // difference is what a refusal would cost. That function writes ONE
    // field, so refusing loses nothing but the bad value. This call
    // carries a title, a time, servings, an ingredient list and a set of
    // steps somebody just typed; failing all of it because a cast
    // produced an odd LABEL would lose real work to protect something
    // with no blast radius. The database still has the last word either
    // way — 0004's and 0017's CHECKs would refuse what got past here, and
    // nothing can now get past here.
    dishCourse: sanitizeDishCourse(input.dishCourse, normalizeTag),
  }));
}

/**
 * Drops this meal's ingredient and step rows and writes the new ones — the
 * "replace" half of the edit, shared by nothing else because nothing else
 * rewrites children.
 *
 * Both tables are filtered on `mealId` and rebuilt with `map`/spread rather
 * than spliced, so no other meal's rows are read, reordered or written, and
 * neither stored array is mutated. Fresh ids come from `buildIngredientRows`
 * and `buildStepRows`, the same builders `createMeal` uses — which is what
 * makes an edit indistinguishable from a create to everything downstream,
 * the mirror's prune-by-id included.
 */
async function replaceMealChildren(
  tables: RepositoryTables,
  mealId: MealId,
  ingredients: readonly MealIngredientInput[],
  steps: readonly MealStepInput[],
  /** Positional fallback headings from the rows being replaced — see `updateMealRecipe`, this function's only caller. */
  preservedSections: readonly (string | null)[],
): Promise<void> {
  const [existingIngredients, existingSteps] = await Promise.all([
    tables.mealIngredients.list(),
    tables.mealSteps.list(),
  ]);

  await Promise.all([
    tables.mealIngredients.replaceAll([
      ...existingIngredients.filter((ingredient) => ingredient.mealId !== mealId),
      ...buildIngredientRows(mealId, ingredients, preservedSections),
    ]),
    tables.mealSteps.replaceAll([
      ...existingSteps.filter((step) => step.mealId !== mealId),
      ...buildStepRows(mealId, steps),
    ]),
  ]);
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

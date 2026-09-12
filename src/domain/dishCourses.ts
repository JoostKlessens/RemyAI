/**
 * The course a dish takes in a meal — voorgerecht, hoofdgerecht,
 * bijgerecht, toetje. The THIRD taxonomy on a `Meal`, and the first one
 * that is not a set.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Ook wil ik ergens kunnen toevoegen
 * dat een recept bijvoorbeeld een voorgerecht, bijgerecht of toetje is,
 * standaard is iets een hoofdgerecht."
 *
 * ===========================================================================
 * THREE TAXONOMIES, AND HOW TO TELL THEM APART
 * ===========================================================================
 *
 * Before adding anything here, read `dishTags.ts` and `dishMoods.ts`. Those
 * two already draw the line this file has to stay on the right side of, and
 * a fourth vocabulary that cannot answer the questions below does not
 * belong in this codebase.
 *
 *   dishTags    WHAT IT IS MADE OF, AND WHAT FORM IT TAKES. pasta, soep,
 *               kip, vegetarisch. A SET (a dish is pasta AND vegetarisch).
 *               Written once at IMPORT time by the extraction path.
 *               Filtered with AND. Empty means "no recognised category".
 *
 *   dishMoods   WHAT IT FEELS LIKE, AND WHEN IT BELONGS. zomers,
 *               soul-food, high-protein. A SET, accumulated as a union
 *               across cooks. Written by a PERSON after cooking, one per
 *               rating. Filtered with OR. Empty means "nobody has
 *               described this yet".
 *
 *   dishCourse  WHERE IT SITS IN A MEAL. Exactly ONE value, never a set:
 *               a dish that is both a starter and a dessert is not a
 *               dish, it is two. It has a DEFAULT, which neither of the
 *               others has and could not have — there is no "default dish
 *               tag" and no "default mood", because for those two the
 *               absence of a value is a real and common state ("nobody
 *               has said"). Here the absence of a value is not a state at
 *               all: a recipe nobody has classified IS a hoofdgerecht,
 *               which is what the owner said.
 *
 * THAT IS THE WHOLE TEST, and it is why this is not a fourth block of
 * entries in `DISH_TAGS`. Cardinality (one vs many) and the existence of a
 * default are structural, not stylistic: put `toetje` in `DISH_TAGS` and a
 * meal could carry `['toetje', 'voorgerecht']` with nothing to stop it, the
 * AND filter would offer a household the guaranteed-empty request "iets dat
 * een voorgerecht én een toetje is", and every existing recipe would read
 * as having no course rather than as being a main.
 *
 * The three are additionally asserted to share no value with each other or
 * with the EU allergen vocabulary (tests/dishCourses.test.ts), which is
 * `dishTags.ts`'s PD-006 boundary extended one vocabulary further: four
 * lists, four blast radii, no string in two of them.
 *
 * ===========================================================================
 * WHY THIS FOLLOWS dishTags.ts RATHER THAN dishMoods.ts
 * ===========================================================================
 *
 * The two precedents differ in one respect that matters here: WHEN the
 * value is written. A mood is an outcome act — it exists because somebody
 * cooked the dish and had an opinion afterwards — and `addMealDishMood` is
 * deliberately additive and idempotent so tonight's cook cannot delete last
 * month's honest description.
 *
 * A course is a fact about the recipe, knowable the moment you read it and
 * true before anybody cooks anything. That is `dishTags`' posture, so this
 * file takes `dishTags`' shape: a closed vocabulary of `{ value, label }`
 * entries, an exact `is…` check that refuses to normalize its argument, and
 * a `sanitize…` that narrows untrusted input at the boundary. The write path
 * is a REPLACE (`setMealDishCourse`), not an append, because a dish has one
 * course and correcting it must be able to say so.
 *
 * ===========================================================================
 * A LITERAL UNION, WHERE THE OTHER TWO USE `string`
 * ===========================================================================
 *
 * `Meal.dishTags` and `Meal.dishMoods` are `readonly string[]`, and their
 * own comments give the reason: the vocabulary lives in a data table, an
 * array is narrowed at the boundary by `sanitize…`, and a union would have
 * to be kept in step with a list the compiler cannot see into.
 *
 * A single-valued field with four members and a default is a different
 * proposition. The union costs nothing to keep in step (it is four words
 * next to each other), and it buys the one thing this field needs and those
 * two do not: exhaustiveness. A `Record<DishCourse, …>` — a label map, an
 * icon map, an ordering — fails to compile the day a fifth course is added,
 * which is exactly the check `docs/archief/HANDOVER.md` records the photo-import
 * agent tripping over on `ImportPlatform` and `RecipeProvenance`. Being
 * forced to visit every map that reasons over the vocabulary is the feature,
 * not the cost, for a vocabulary that is genuinely closed at four.
 *
 * Pure: no I/O, no React, no imports beyond the `Meal` type, so
 * tests/dishCourses.test.ts can hold the whole contract.
 */

import type { DishCourse, Meal } from './types';

/**
 * The four courses, re-exported so a caller needs one import rather than
 * two — the same courtesy `ratingScaleCopy.ts` extends to `formatGrade`.
 *
 * THE UNION ITSELF IS DECLARED IN types.ts, beside `MealSource` and
 * `SkillLevel`, and it has to be: this module imports `Meal` in order to
 * read the field, and types.ts imports nothing at all (see dishMoods.ts's
 * header on why that matters). Declaring it here and consuming it there
 * would close a cycle for no gain. Everything else about the vocabulary —
 * the default, the labels, the order, the checks — lives here.
 *
 * `toetje` and not `nagerecht` or `dessert`: it is the owner's own word,
 * it is what people here actually say, and this codebase does not correct
 * the owner's vocabulary (see `high-protein` in dishMoods.ts, kept in his
 * English spelling for the same reason).
 */
export type { DishCourse };

export interface DishCourseEntry {
  readonly course: DishCourse;
  readonly label: string;
}

/**
 * THE DEFAULT, AND IT IS LOAD-BEARING RATHER THAN A CONVENIENCE. Every
 * recipe this app has ever stored predates this vocabulary, and the owner
 * has already ruled on what they are: "standaard is iets een
 * hoofdgerecht". So there is no backfill, no migration of rows, and no
 * screen that must ask before a library reads correctly — absence IS the
 * answer, and `readMealDishCourse` is where that reading lives.
 */
export const DEFAULT_DISH_COURSE: DishCourse = 'hoofdgerecht';

/**
 * In the order a meal is eaten, which is the order a person picking from
 * the list already has in their head. `bijgerecht` sits beside the
 * `hoofdgerecht` it accompanies rather than after the `toetje`, which is
 * the one position in the list that is a judgement rather than a
 * convention — a side dish has no fixed place in the sequence because it
 * arrives with the main.
 *
 * The order is asserted in tests/dishCourses.test.ts, so a control that
 * renders `DISH_COURSES` in array order cannot be reordered by accident
 * from here.
 */
export const DISH_COURSES: readonly DishCourseEntry[] = [
  { course: 'voorgerecht', label: 'Voorgerecht' },
  { course: 'hoofdgerecht', label: 'Hoofdgerecht' },
  { course: 'bijgerecht', label: 'Bijgerecht' },
  { course: 'toetje', label: 'Toetje' },
];

export const DISH_COURSE_VALUES: ReadonlySet<string> = new Set(DISH_COURSES.map((entry) => entry.course));

/**
 * Exact membership check — deliberately does NOT normalize its argument,
 * for the reason `isDishTag` and `isDishMood` both give: a caller holding
 * untrusted input (a route param, a persisted row, a model's answer) must
 * normalize first and then ask, so an unnormalized value fails loudly here
 * instead of being quietly coerced into a match. The stored form is always
 * the normalized one; accepting "Toetje" here would let two spellings of
 * one course diverge in storage.
 */
export function isDishCourse(value: string): value is DishCourse {
  return DISH_COURSE_VALUES.has(value);
}

/**
 * Narrows untrusted input to a course this vocabulary knows, falling back
 * to the default.
 *
 * FALLS BACK RATHER THAN RETURNING NULL, which is where this differs from
 * `sanitizeDishTags`/`sanitizeDishMoods` — those drop what they do not
 * recognise, because dropping a tag leaves a shorter list and a shorter
 * list is a legal state. There is no such thing as a meal with no course,
 * so there is nothing to drop TO except the answer the owner already gave.
 *
 * Takes `normalize` as a parameter rather than importing `normalizeTag`,
 * exactly as the other two sanitizers do — one fewer edge in the domain
 * graph, and it keeps this module honest about the fact that normalization
 * is a policy it applies rather than one it owns.
 */
export function sanitizeDishCourse(raw: string, normalize: (value: string) => string): DishCourse {
  const normalized = normalize(raw);
  return isDishCourse(normalized) ? normalized : DEFAULT_DISH_COURSE;
}

/**
 * `Meal.dishCourse` read safely, and the one place its optionality is
 * absorbed — the same service `readMealDishMoods` performs for axis 2, and
 * the same instruction applies: read the field through here, never
 * directly.
 *
 * A MISSING KEY IS NOT MISSING DATA. It means "nobody has said otherwise",
 * and the owner has already said what that is. Normalising on read rather
 * than migrating storage keeps this a pure, cheap function and matches
 * table.ts's stance that persisted data is untrusted input like any other.
 *
 * A STORED VALUE OUTSIDE THE VOCABULARY ALSO READS AS THE DEFAULT. That is
 * `toMealRow`'s `Array.isArray` repair applied to a different shape: a row
 * hand-edited in storage, or written by a build that knew a value this one
 * does not, would otherwise hand a caller a `DishCourse` the type promises
 * cannot exist. The recovery is identical either way, so it is done once,
 * here.
 */
export function readMealDishCourse(meal: Meal): DishCourse {
  const stored = meal.dishCourse;
  return stored !== undefined && isDishCourse(stored) ? stored : DEFAULT_DISH_COURSE;
}

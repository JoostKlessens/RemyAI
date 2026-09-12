/**
 * WHAT A WRITE TAKES — every `Create*Input` / `Update*Input` shape the
 * repository accepts, split out of `./types` where the `RemyRepository`
 * interface itself still lives.
 *
 * WHY IT IS ITS OWN FILE. `types.ts` crossed 800 lines when
 * `CreateSaveInput` gained PD-024's required `origin`, and the ceiling is
 * 800 with seven files in `src/` already over it — adding an eighth is not
 * something to do quietly. Splitting on a line count would be arbitrary;
 * this is a real seam, and it is the one the file was already organised
 * around: everything here describes the ARGUMENT a write takes, and
 * everything left behind describes the METHOD that takes it.
 *
 * NOTHING MOVED IN MEANING, ONLY IN ADDRESS. Every interface below is
 * byte-for-byte what it was, comments included, and `./types` re-exports
 * all of them — so every existing `import { CreateMealInput } from
 * '@/lib/repository/types'` keeps working and no call site was touched to
 * make this split. A rename would have been a second change riding on a
 * file move, which is how a mechanical edit turns into a review nobody can
 * read.
 */

import type { MealAllergenCheck } from '@/domain/mealAllergenReverification';
import type {
  AllergenTagStatus,
  DecisionId,
  DishCourse,
  HouseholdId,
  IsoDateString,
  MealId,
  MealSource,
  MemberId,
  ReasonCode,
  RestrictionType,
  SaveIntent,
  SaveOrigin,
  SkillLevel,
} from '@/domain/types';

export interface MealIngredientInput {
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly sortOrder: number;
  /**
   * `meal_ingredients.section` (0018) — the heading the source printed this
   * ingredient under. Optional for the recipe editor's sake rather than
   * because omitting is honest; `updateMealRecipe` (local/meals.ts) resolves
   * an omission, and `MealIngredient.section` carries the whole argument.
   */
  readonly section?: string | null;
}

export interface MealStepInput {
  readonly stepNumber: number;
  readonly instruction: string;
  readonly durationMinutes: number | null;
}

export interface CreateMealInput {
  readonly householdId: HouseholdId;
  readonly title: string;
  readonly source: MealSource;
  readonly estimatedMinutes: number | null;
  readonly skillLevel: SkillLevel | null;
  readonly servings: number | null;
  /** Denormalized allergen tags — see meals.ingredient_tags's comment in 0001_init.sql. */
  readonly ingredientTags: readonly string[];
  readonly allergenTagStatus: AllergenTagStatus;
  /**
   * Dish categories from the closed vocabulary (src/domain/dishTags.ts) —
   * NEVER allergens, and never merged with `ingredientTags` above; see
   * `Meal.dishTags`'s own comment in src/domain/types.ts for why the two
   * stay apart.
   *
   * Optional here while `Meal.dishTags` is required, and the asymmetry is
   * deliberate: every caller of this input is a screen that may or may not
   * have categories to offer yet, and there is no fail-safe reading to
   * lose — a caller that omits it is saying "no categories", which is
   * exactly what the stored `[]` means. Omitting is therefore honest
   * rather than lossy, and it keeps adding this field from forcing an edit
   * to every call site that has nothing to say. `createMeal` substitutes
   * `[]`, never `undefined` (see local/meals.ts).
   */
  readonly dishTags?: readonly string[];
  /**
   * Where this dish sits in a meal (src/domain/dishCourses.ts) —
   * voorgerecht, hoofdgerecht, bijgerecht, toetje. A single value, never a
   * set, and NEVER merged with `dishTags` above: that is a list of
   * descriptive categories filtered with AND, and a course put in it could
   * be stored alongside its own opposite.
   *
   * Optional here for a reason the two fields around it do NOT share, and
   * it is worth stating precisely because it looks like the same
   * optionality. `dishTags` and `recipeId` are optional because their
   * absent state and their stored state coincide — a caller who omits them
   * is saying "no categories" and "a copy of nothing", which is exactly
   * what `[]` and `null` mean. There is no such thing as a meal with no
   * course. This is optional because the ANSWER TO OMITTING IT IS ALREADY
   * DECIDED: the owner said "standaard is iets een hoofdgerecht", so a
   * caller who says nothing is not leaving a field blank, it is accepting
   * a default that was chosen for it. `createMeal` substitutes
   * `DEFAULT_DISH_COURSE`, never `undefined` (see local/meals.ts).
   *
   * Unlike a mood, this CAN be known at create time — a course is legible
   * from the recipe itself, where a mood requires somebody to have eaten
   * the food. That is why axis 2 has no counterpart field here and this
   * one does.
   */
  readonly dishCourse?: DishCourse;
  /**
   * The canonical `recipes` row this meal is this household's private copy
   * of (`meals.recipe_id`, 0006). It is what makes cook proof possible at
   * all: a friend's cook and this copy are two unrelated rows without it,
   * so `shared_cooks` (0009) has nothing to join on and scoring.ts's
   * FRIEND_PROOF_BOOST can never fire. Set it whenever the caller actually
   * knows the id — see src/domain/import/toMealDraft.ts, which carries one
   * through from the import context.
   *
   * Optional here for the same reason `dishTags` above is, and it earns it
   * the same way: the absent state and the stored state genuinely coincide.
   * A caller that omits this is saying "this meal is a copy of nothing" —
   * seeded, curated, or typed in by hand — which is exactly what the stored
   * `null` means, so omitting is honest rather than lossy, and there is no
   * fail-safe reading to lose (a missing link costs a social boost, never
   * anyone's safety). `createMeal` substitutes `null`, never `undefined`
   * (see local/meals.ts).
   *
   * Deliberately NOT modeled on `allergenTagStatus` above, which is
   * required precisely because ITS absent state is dangerous — and note
   * the one thing this field must never become: a channel for inheriting a
   * canonical recipe's allergen state. There is none to inherit (0006's
   * `recipes` deliberately has no allergen column), and the database
   * resets any meal carrying a recipe_id to 'unknown' on insert whatever
   * the caller passed (`meals_recipe_copy_starts_unverified`). Passing a
   * recipeId is a statement about provenance and nothing else.
   */
  readonly recipeId?: string | null;
  readonly sourceUrl: string | null;
  readonly sourcePlatform: 'tiktok' | 'reels' | null;
  /** oEmbed's thumbnail, carried through import — see Meal.thumbnailUrl's own comment in src/domain/types.ts. Null for manual entries. */
  readonly thumbnailUrl: string | null;
  readonly ingredients: readonly MealIngredientInput[];
  readonly steps: readonly MealStepInput[];
}

/**
 * RCP-03 — correcting a recipe AFTER it is saved.
 *
 * WHY THIS INPUT IS NOT `Partial<CreateMealInput>`, WHICH IS THE OBVIOUS
 * SHAPE AND THE WRONG ONE. A partial says "any field, or none", and the set
 * of fields a person may correct about a dish they already own is much
 * smaller than the set a create path had to state. `source`, `sourceUrl`,
 * `sourcePlatform`, `thumbnailUrl` and `recipeId` are facts about WHERE THE
 * RECIPE CAME FROM — an edit does not change where it came from, and a
 * writable `recipeId` in particular would let a screen re-point a
 * household's copy at a different canonical recipe, silently rewriting whose
 * cook proof it can ever be joined to (`shared_cooks`, 0009). `archivedAt`
 * has its own verb (`archiveMeal`) and its own argument;
 * `excludedFromCookProof` and `dishMoods` are consent and outcome acts with
 * their own methods, kept apart for exactly the reason
 * `setHouseholdCookSharing` is kept out of `updateHouseholdSettings`: a
 * field reachable from a bulk save is a field a stale spread can flip.
 * THE `dishTags` SENTENCE THAT USED TO STAND HERE IS RECORDED RATHER THAN
 * QUIETLY SWAPPED, because this file's own prediction came true. It read:
 * "`dishTags` are the extraction path's categories and no screen edits them
 * today; adding them here is that screen's job, not a field left open in
 * advance." Both halves were right, and the invitation was accepted — the
 * owner asked for it ("Kan je de tags niet aanpassen handmatig?"), the
 * screen exists (src/app/recipe-edit/[mealId].tsx), and `dishTags` and
 * `dishCourse` are named fields below. What that sentence was protecting
 * against was a field left open with no writer, which is this codebase's
 * own recorded failure mode (`recipe_ratings`: four readers, zero writers,
 * empty for months). Both fields arrive WITH their control.
 *
 * So this input names the seven things a person may correct — title, time,
 * servings, ingredients, steps, categories, course — and NOTHING ELSE IS
 * TOUCHED by the write. That is a guarantee tests hold, not a convention.
 *
 * THE CHILD LISTS ARE A REPLACE, NOT A DIFF, AND THE REASON IS THAT THERE IS
 * NO IDENTITY TO DIFF ON. The edit screen edits an ingredient as ONE
 * free-text line (see src/domain/import/editedIngredients.ts on why), so
 * what comes back from it is an ordered list of lines with no row ids
 * anywhere — matching a line to the `meal_ingredients` row it came from
 * would mean inventing an identity the screen never had, which is the same
 * guessing that module refuses on quantity/unit. `MealIngredientInput` and
 * `MealStepInput` above are therefore reused verbatim: the shapes a create
 * already uses, carrying no id, because an edit genuinely knows no more
 * about row identity than a create does.
 *
 * WHAT THE REPLACE COSTS, STATED RATHER THAN GLOSSED. Row ids churn: every
 * save mints fresh `meal_ingredients`/`meal_steps` ids and the old ones are
 * gone. Nothing joins to them — no migration in supabase/migrations/**
 * declares a foreign key onto either table's `id`, no domain type stores
 * one, and both screens that read them (boodschappen.tsx via
 * `RawIngredientLine`, cook/[mealId].tsx via `MealStep`) use the ids as
 * render keys and nothing more. `meal_ingredients.allergen_tags` is reset to
 * `[]`, which costs nothing because this app has never written anything else
 * to it (see local/meals.ts's header: whole-meal `Meal.ingredientTags` is
 * the source of truth exclusions.ts filters on). And the mirror was DESIGNED
 * for this: mirrorWrites.ts's `meal_steps` note already asks a meal-edit
 * path to "rewrite steps with fresh ids", because that reduces every edit to
 * "delete all the old, insert all the new" and removes the one 23505 a
 * renumber among retained ids would otherwise earn against
 * `unique (meal_id, step_number)`.
 *
 * NO MIGRATION AND NO NEW TABLE. `meals`, `meal_ingredients` and `meal_steps`
 * (0001_init.sql) already carry every column this writes, and 0001 already
 * declares `meals_update`, `meal_ingredients_update`/`_delete`/`_insert` and
 * `meal_steps_update`/`_delete`/`_insert` policies gated on
 * `is_household_member`. Editing a saved recipe needed no schema change and
 * did not get one.
 */
export interface UpdateMealRecipeInput {
  readonly title: string;
  readonly estimatedMinutes: number | null;
  readonly servings: number | null;
  readonly ingredients: readonly MealIngredientInput[];
  readonly steps: readonly MealStepInput[];
  /**
   * Dish categories from the closed vocabulary (src/domain/dishTags.ts).
   * The owner's "Kan je de tags niet aanpassen handmatig?".
   *
   * WHAT THIS FIXED, because the absence was not a gap but a defect.
   * `dish_tags` had exactly one writer — the extraction model reading a
   * caption at import — and manual entry wrote `[]`
   * (src/app/import/confirm.tsx). So a recipe the model tagged wrongly,
   * and every recipe anybody typed in by hand, was permanently invisible
   * to the library's dish-category filter, with no way for any person to fix
   * it. The most-used filter in the app was wrong about part of every
   * library, and only a writer could repair it.
   *
   * REQUIRED, NOT OPTIONAL, and that is deliberate for the reason this
   * input's own header gives about not being a `Partial<>`. An optional
   * "leave it alone" field sitting in a save that replaces everything else
   * is a different rule for one field, and a screen that forgets it wipes
   * a value nobody was shown. Required forces the one caller to state its
   * answer out loud — the same argument `DecisionRequest.filters` makes.
   *
   * NARROWED AT THE WRITE SEAM, never trusted. `updateMealRecipe` runs
   * `sanitizeDishTags`, so a value outside the vocabulary is dropped
   * rather than stored: the vocabulary is closed because an unknown value
   * is unfilterable, and storing an unfilterable tag on the write path
   * that exists to REPAIR the filter would be the joke of the change.
   */
  readonly dishTags: readonly string[];
  /**
   * Where this dish sits in a meal (src/domain/dishCourses.ts) — the
   * owner's "ergens kunnen toevoegen dat een recept bijvoorbeeld een
   * voorgerecht, bijgerecht of toetje is".
   *
   * IT SHARES THIS INPUT WITH `dishTags` AND NOT A CONTROL WITH IT. Both
   * are descriptive taxonomy a person corrects in one sitting on one
   * screen, so they travel in one write; they are two fields because they
   * answer two questions with two cardinalities (many, ANDed, versus
   * exactly one with a default), and a single control offering both would
   * make `['toetje', 'pasta']` expressible — the conflation migration 0017
   * exists to prevent.
   *
   * WHY THESE TWO ARE HERE AND `excludedFromCookProof` / `dishMoods` ARE
   * NOT, since this input's header rules those out with a rule that sounds
   * like it should catch these too ("a field reachable from a bulk save is
   * a field a stale spread can flip"). That rule is about BLAST RADIUS. A
   * stale spread flipping the cook-proof exclusion starts showing somebody's
   * dinner to their friends; a stale spread flipping a mood publishes a
   * sentence in a voice that is not the speaker's. A stale spread flipping
   * a course files a recipe under the wrong heading in the household's own
   * library. The first two need their own verb; the third needs an editor.
   *
   * REQUIRED for `dishTags`' reason, and given the default by the caller
   * rather than by omission: the screen loads the meal, so it always knows
   * the current answer, and `DEFAULT_DISH_COURSE` is what a meal that never
   * said anything reads as.
   *
   * A value outside the vocabulary falls back to the default rather than
   * failing the save — see `updateMealRecipe` in local/meals.ts for why
   * this write forgives what `addMealDishMood` refuses.
   */
  readonly dishCourse: DishCourse;
  /**
   * PD-006. REQUIRED, and required for the same reason
   * `CreateMealInput.allergenTagStatus` is: its absent state is the
   * dangerous one. But note it is NOT that field — it is
   * `MealAllergenCheck`, a statement about whether a human tagged the
   * ingredient list IN THIS EDIT, and it cannot be produced by spreading
   * `meal.allergenTagStatus` off a row.
   *
   * That distinction is the whole point. The natural, diligent-looking way
   * to write this call is to carry the meal's current status forward — and
   * that line would have the app assert that somebody confirmed an
   * ingredient list they never saw, which is PD-006.4's forbidden state
   * reached through a door PD-006 did not enumerate. A caller with nothing
   * to say passes `NOT_RECHECKED` and gets the fail-closed answer: the
   * status drops to 'unknown' if and only if the ingredient list actually
   * moved, and the existing `ingredientTags` are KEPT either way, because a
   * tag is an exclusion and dropping one is the direction that can hurt
   * somebody. The full argument is
   * src/domain/mealAllergenReverification.ts's module header; this method
   * only applies it.
   *
   * Deliberately NOT `ingredientTags` + `allergenTagStatus` as two fields.
   * Two fields is how one gets updated without the other, and a tag list
   * nobody vouched for is not a smaller answer, it is a wrong one.
   */
  readonly allergenCheck: MealAllergenCheck;
}

export interface CreateSaveInput {
  readonly householdId: HouseholdId;
  readonly memberId: MemberId | null;
  readonly mealId: MealId;
  readonly intent: SaveIntent;
  /**
   * Which surface produced this save (PD-024, `src/domain/saveOrigin.ts`).
   *
   * REQUIRED, NOT OPTIONAL, and that is the whole enforcement. `Save.origin`
   * is nullable because rows written before this field existed genuinely
   * have no answer; a NEW save always does, and the only thing standing
   * between "always" and "usually" is this question mark not being here.
   * The `?` on `CreateMealInput.dishTags` is the cautionary case, recorded
   * as GAP-08 in archief/OPEN-BESLISSINGEN.md: every literal that ever omitted it
   * was a bug, and only the type could have caught them.
   */
  readonly origin: SaveOrigin;
  readonly sourceUrl: string | null;
}

export interface CreateCookEventInput {
  readonly householdId: HouseholdId;
  readonly mealId: MealId;
  readonly decisionId: DecisionId | null;
  readonly cookedOn: IsoDateString;
}

export interface CreateDecisionInput {
  readonly householdId: HouseholdId;
  readonly decisionDate: IsoDateString;
  readonly mealId: MealId;
  readonly initialMealId: MealId;
  readonly reasonCode: ReasonCode;
  readonly reasonText: string;
}

export interface RespondToDecisionInput {
  /**
   * Only the two terminal user-driven statuses — 'pending' is the row's
   * own creation-time default, never a response.
   *
   * 'skipped' has had NO CALLER since "Niet koken" left Kiezen; today
   * every response through this seam is 'accepted'. Narrowing the type to
   * `'accepted'` was the rejected alternative: it would delete the only
   * place the repository still knows how to record a refusal, and that
   * is exactly what has to come back the day plan §8's acceptance rate
   * needs to tell "offered and refused" apart from "never seen" again.
   * See DecisionStatus in @/domain/types for the full cost.
   */
  readonly status: 'accepted' | 'skipped';
}

/**
 * Household settings screen (src/app/settings.tsx) — the only writable
 * household-level fields that screen exposes. `decisionPushTime`/
 * `skillLevel` have no UI yet, so they're deliberately not part of this
 * input; add them here (not as a separate method) when they get one.
 */
export interface UpdateHouseholdSettingsInput {
  readonly weeknightTimeBudgetMinutes: number;
}

export interface CreateMemberInput {
  readonly householdId: HouseholdId;
  readonly displayName: string;
}

export interface CreateRestrictionInput {
  readonly memberId: MemberId;
  readonly type: RestrictionType;
  readonly excludesTag: string;
  readonly notes: string | null;
}

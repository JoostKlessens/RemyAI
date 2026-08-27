/**
 * The domain/Postgres boundary for the mirror: the exact column list per
 * table, and the one function that decides what a PostgREST error means.
 *
 * EVERY COLUMN BELOW WAS READ OUT OF supabase/migrations/**, NOT OUT OF
 * src/domain/types.ts. The two have drifted before and the drift is
 * invisible: a domain field with no column is silently dropped by
 * PostgREST's schema cache, and a column with no domain field is silently
 * left at its default. `meals.recipe_id` is the standing example — the
 * column existed from 0006 and `Meal.recipeId` existed alongside it while
 * no write path populated either, which is exactly why `shared_cooks`
 * (0009) had nothing to join on and cook proof was unreachable on real
 * data for three migrations. Sources, in order: 0001 (meals,
 * meal_ingredients, meal_steps, cook_events), 0003 (thumbnail_url), 0004
 * (dish_tags), 0005 + 0008 (rating), 0006 (recipe_id), 0009
 * (excluded_from_cook_proof), 0010 (dish_moods).
 *
 * TWO COLUMNS ARE OMITTED ON PURPOSE, AND THE OMISSION IS THE FEATURE.
 *
 *   `meals.visibility` (0007). `not null default 'private'`, and 0007 says
 *   why in one line: "Sharing has to be something a person does." Nothing
 *   local carries this field, so there is nothing to mirror — but the
 *   important half is that leaving the key out of the payload means
 *   PostgREST omits the column from its INSERT entirely, so a new row
 *   takes the default and an existing row is not touched by the ON
 *   CONFLICT UPDATE. A mirrored meal is private on arrival and stays
 *   however the household last left it. That is also the load-bearing half
 *   of the partial-mirror answer in mirrorWrites.ts: the broadcast door
 *   (`is_meal_shared_with_me`) requires `visibility = 'friends'`, and this
 *   module can never write that value.
 *
 *   `meals.metadata` (0001). A jsonb bag reserved for the Phase 2 fridge
 *   scan; 0001 says "Nothing reads or writes it yet." Mirroring `'{}'`
 *   over it would be writing to a column this app has no opinion about.
 *
 * AND ONE IS OMITTED BECAUSE POSTGRES OWNS IT: `meals.updated_at`, set by
 * the `meals_set_updated_at` trigger. Sending our own value would make the
 * column mean "when the device last wrote" on some rows and "when Postgres
 * last saw a write" on others.
 *
 * `cook_events.decision_id` IS ALWAYS NULL, and that is not laziness.
 * `decisions` is deliberately not mirrored — it stays local — so a local
 * decision id here is a foreign key to a row Postgres does not have, and
 * 0001 declares it `references decisions (id)`. Sending it earns a 23503
 * on every single cook event a household ever records, which is to say
 * cook proof would never work at all. The column is nullable precisely
 * because 0001 anticipated a cook event with no decision behind it ("this
 * leaves room for a future 'log a cook manually' path"), so null here is a
 * legal, honest value rather than a hole.
 *
 * `cook_events.rating` IS THE PRIVATE HALF (PD-008, PD-019) AND MIRRORING
 * IT CANNOT PUBLISH IT. It is mirrored because the decision engine reads
 * cook history and `resolveRepeatSignal` needs it; it stays private
 * because `shared_cooks` (0009) selects `hm.auth_user_id` and
 * `m.recipe_id` and nothing else, and 0009's own comment says a third
 * column "is a privacy decision and not a convenience". No other view,
 * policy or function exposes a cook_events column across a household
 * boundary — `cook_events_select` is `is_household_member(household_id)`
 * and there is no additional policy on that table anywhere in 0007 or
 * 0009.
 *
 * NUMERICS. `cook_events.rating` is numeric(4,2) since 0008 and PostgREST
 * is entitled to serialise a numeric as JSON text — so a rating that came
 * back from a read at some point in its life can be a string that survives
 * every type check in this repo (`'7.5' + 2` is `'7.52'`). It is coerced
 * with Number() and then put through `isValidRating`, the same gate the
 * local store uses. An off-scale value is REFUSED rather than clamped,
 * matching setCookEventRating's own refusal: 0008's CHECK would reject it
 * anyway, and earning a 23514 that the outbox then has to park is a worse
 * way to find out.
 */

import { isValidRating } from '@/domain/rating';
import { readMealDishMoods } from '@/domain/dishMoods';
import type { CookEvent, Meal, MealIngredient, MealStep } from '@/domain/types';
import type { MirrorFailure, MirrorHouseholdSettingsJob } from './types';

/**
 * The `households` PATCH: one column, and the type says so.
 *
 * Not a `MirrorHouseholdRow`, and the missing word is the point. There is
 * no `name` field here — `households.name` is NOT NULL (0001) — so this
 * object cannot satisfy an INSERT even if a future edit handed it to one.
 * Existence belongs to src/lib/ensureRemoteHousehold.ts, which is
 * insert-only for the mirror-image reason; content belongs here, which is
 * update-only. Neither can perform the other's verb.
 */
export interface MirrorHouseholdSettingsPatch {
  readonly share_cooks_with_friends: boolean;
}

/** `meals`, exactly as 0001 + 0003 + 0004 + 0006 + 0009 + 0010 declare the mirrored subset. */
export interface MirrorMealRow {
  readonly id: string;
  readonly household_id: string;
  readonly title: string;
  readonly source: string;
  readonly estimated_minutes: number | null;
  readonly skill_level: string | null;
  readonly servings: number | null;
  readonly ingredient_tags: readonly string[];
  readonly allergen_tag_status: string;
  readonly dish_tags: readonly string[];
  readonly dish_moods: readonly string[];
  readonly recipe_id: string | null;
  readonly source_url: string | null;
  readonly source_platform: string | null;
  readonly thumbnail_url: string | null;
  readonly excluded_from_cook_proof: boolean;
  readonly archived_at: string | null;
  readonly created_at: string;
}

/** `meal_ingredients` (0001). No timestamps and no visibility analogue — the row is the whole ingredient. */
export interface MirrorMealIngredientRow {
  readonly id: string;
  readonly meal_id: string;
  readonly name: string;
  readonly quantity: string | null;
  readonly unit: string | null;
  readonly allergen_tags: readonly string[];
  readonly sort_order: number;
}

/** `meal_steps` (0001). `unique (meal_id, step_number)` is why mirrorWrites.ts deletes before it upserts here. */
export interface MirrorMealStepRow {
  readonly id: string;
  readonly meal_id: string;
  readonly step_number: number;
  readonly instruction: string;
  readonly duration_minutes: number | null;
}

/** `cook_events` (0001 + 0005/0008). See the header on decision_id and on rating. */
export interface MirrorCookEventRow {
  readonly id: string;
  readonly household_id: string;
  readonly meal_id: string;
  readonly decision_id: null;
  readonly cooked_on: string;
  readonly would_repeat: boolean | null;
  readonly rating: number | null;
  readonly created_at: string;
}

/**
 * Something this module refused to send, expressed as a `rejected`
 * failure so it travels the same path as a Postgres constraint violation.
 * Both mean "this payload will never be accepted"; both must be parked
 * rather than retried; neither may be silently dropped.
 */
export function refuse(operation: string, message: string): MirrorFailure {
  return { kind: 'rejected', operation, code: null, message };
}

/**
 * Whether an id can appear inside a PostgREST `in` list without changing
 * what the filter means.
 *
 * The `in` operator's list syntax is `(a,b,c)` — a bare, unquoted,
 * comma-separated string — so an id containing a comma, a parenthesis or a
 * quote silently becomes a different filter. This repo has already been
 * bitten by the mirror image of that bug (a filter value that WAS quoted
 * and therefore matched the quotes literally, which silently broke every
 * cache read), so the guard is a refusal at the boundary rather than an
 * escaping scheme nobody can verify by eye. Every id shape this app mints
 * passes: `generateLocalId` now produces an RFC 4122 uuid (see id.ts),
 * which is hex and hyphens.
 */
export function isFilterSafeId(id: string): boolean {
  return id.length > 0 && /^[A-Za-z0-9_-]+$/.test(id);
}

export function toMealRow(meal: Meal): MirrorMealRow | MirrorFailure {
  if (meal.householdId === null) {
    // 0001's meals_insert policy is `household_id is not null and
    // is_household_member(household_id)`: a curated row belongs to the
    // content pipeline and the service role, never to a household's
    // client. Refused here with a sentence rather than by Postgres with a
    // 42501 that would look like a permissions bug in our own rows.
    return refuse(
      'Mirroring a meal',
      `Meal ${meal.id} has no household — a curated meal is not a household's row to mirror.`,
    );
  }
  if (!isFilterSafeId(meal.id)) {
    return refuse('Mirroring a meal', `Meal id ${JSON.stringify(meal.id)} cannot be used in a PostgREST filter.`);
  }

  return {
    id: meal.id,
    household_id: meal.householdId,
    title: meal.title,
    source: meal.source,
    estimated_minutes: meal.estimatedMinutes,
    skill_level: meal.skillLevel,
    servings: meal.servings,
    ingredient_tags: meal.ingredientTags,
    // 0001's own default, and PD-006's fail-safe reading: an untagged meal
    // is UNKNOWN, never clean. Note the trigger interaction, which is safe
    // in the only direction that matters — 0006's
    // `meals_recipe_copy_starts_unverified` forces 'unknown' on INSERT of
    // any meal carrying a recipe_id, whatever we send, so a first mirror
    // of a locally-verified imported meal lands MORE cautious than local,
    // never less. A later mirror reaches Postgres through the ON CONFLICT
    // UPDATE path, which 0006 deliberately leaves open for exactly this:
    // "the normal path to 'verified' still works". What can never happen
    // is the dangerous direction, because the value is always this
    // household's own answer and is never inherited from anywhere.
    allergen_tag_status: meal.allergenTagStatus ?? 'unknown',
    dish_tags: meal.dishTags,
    // Read through the domain so this and the filter agree by construction.
    // 0010's closed vocabulary is enforced by a CHECK, so an unknown mood
    // would arrive as a 23514 — a `rejected` failure, which is the right
    // answer for a value nobody could ever filter on again.
    dish_moods: readMealDishMoods(meal),
    // The link cook proof is entirely made of. See the module header.
    recipe_id: meal.recipeId ?? null,
    source_url: meal.sourceUrl,
    source_platform: meal.sourcePlatform,
    thumbnail_url: meal.thumbnailUrl,
    // 0009's column default, and the same fail-open normalisation
    // getMealCookProofExclusion performs: absent means "not excluded".
    excluded_from_cook_proof: meal.excludedFromCookProof ?? false,
    archived_at: meal.archivedAt,
    created_at: meal.createdAt,
  };
}

export function toMealIngredientRows(
  mealId: string,
  ingredients: readonly MealIngredient[],
): readonly MirrorMealIngredientRow[] | MirrorFailure {
  const unsafe = ingredients.find((ingredient) => !isFilterSafeId(ingredient.id));
  if (unsafe !== undefined) {
    return refuse(
      "Mirroring a meal's ingredients",
      `Ingredient id ${JSON.stringify(unsafe.id)} cannot be used in a PostgREST filter.`,
    );
  }

  return ingredients.map((ingredient) => ({
    id: ingredient.id,
    // Taken from the job's meal rather than from the child's own `mealId`,
    // so a child that somehow carries a stale parent id cannot write a row
    // into a different meal's ingredient list.
    meal_id: mealId,
    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    allergen_tags: ingredient.allergenTags,
    sort_order: ingredient.sortOrder,
  }));
}

export function toMealStepRows(
  mealId: string,
  steps: readonly MealStep[],
): readonly MirrorMealStepRow[] | MirrorFailure {
  const unsafe = steps.find((step) => !isFilterSafeId(step.id));
  if (unsafe !== undefined) {
    return refuse(
      "Mirroring a meal's steps",
      `Step id ${JSON.stringify(unsafe.id)} cannot be used in a PostgREST filter.`,
    );
  }

  return steps.map((step) => ({
    id: step.id,
    meal_id: mealId,
    step_number: step.stepNumber,
    instruction: step.instruction,
    duration_minutes: step.durationMinutes,
  }));
}

export function toCookEventRow(event: CookEvent): MirrorCookEventRow | MirrorFailure {
  if (!isFilterSafeId(event.id) || !isFilterSafeId(event.mealId)) {
    return refuse(
      'Mirroring a cook event',
      `Cook event ${JSON.stringify(event.id)} carries an id no filter can express.`,
    );
  }

  // Coerced before it is validated: see the header on numerics. `null` and
  // `undefined` both mean "the question was skipped", which 0005 calls a
  // first-class answer — never a midpoint to be invented.
  const rating = event.rating === null || event.rating === undefined ? null : Number(event.rating);
  if (rating !== null && !isValidRating(rating)) {
    return refuse(
      'Mirroring a cook event',
      `Cook event ${event.id} carries a rating outside the scale (${String(event.rating)}) — see src/domain/rating.ts.`,
    );
  }

  return {
    id: event.id,
    household_id: event.householdId,
    meal_id: event.mealId,
    // Always null. See the module header.
    decision_id: null,
    cooked_on: event.cookedOn,
    would_repeat: event.wouldRepeat,
    rating,
    created_at: event.createdAt,
  };
}

export function toHouseholdSettingsPatch(
  job: MirrorHouseholdSettingsJob,
): MirrorHouseholdSettingsPatch | MirrorFailure {
  if (!isFilterSafeId(job.householdId)) {
    return refuse(
      "Mirroring a household's cook sharing",
      `Household id ${JSON.stringify(job.householdId)} cannot be used in a PostgREST filter.`,
    );
  }
  // Coerced to a real boolean rather than passed through. This is consent:
  // a truthy string from persisted JSON that predates the column would
  // otherwise mirror as `true` and turn "not answered" into "yes".
  return { share_cooks_with_friends: job.shareCooksWithFriends === true };
}

/** True when a row builder handed back a failure instead of a row. */
export function isMirrorFailure(value: unknown): value is MirrorFailure {
  return typeof value === 'object' && value !== null && 'kind' in value && 'operation' in value;
}

/** PostgREST's own auth-shaped codes: the token is missing, expired, or belongs to nobody. */
const REFUSAL_CODES: ReadonlySet<string> = new Set(['42501', 'PGRST301', 'PGRST302']);

/** SQLSTATE 57P03 is `cannot_connect_now` — the server is up but not taking work yet. */
const UNREACHABLE_CODES: ReadonlySet<string> = new Set(['57P03']);

/** SQLSTATE class 08 is literally "connection exception". */
const CONNECTION_CLASS = '08';

/**
 * Turns a PostgREST error into a failure with a KIND, which is the whole
 * point: `refused`, `unreachable` and `rejected` have three different
 * remedies, and this repo has already shipped the bug where two of them
 * arrived as the same indistinguishable null.
 *
 * The classification is by code and nothing else. Matching on message text
 * was the rejected alternative — Postgres and PostgREST both reword their
 * messages between versions, and a retry policy that depends on English
 * prose is a retry policy that changes on an upgrade nobody connected to
 * it.
 */
export function classifyMirrorError(
  operation: string,
  error: { message?: string; code?: string } | null,
): MirrorFailure {
  const code = error?.code === undefined || error.code === '' ? null : error.code;
  const message = error?.message ?? 'unknown error';

  if (code === null) {
    // supabase-js surfaces a dead fetch as an error object with a message
    // and no code at all. No code means nothing on the server ever formed
    // an opinion about this payload.
    return { kind: 'unreachable', operation, code, message };
  }
  if (REFUSAL_CODES.has(code)) {
    return { kind: 'refused', operation, code, message };
  }
  // The server said it, so we reached something — but the remedy is still
  // "wait and try again", which is what `unreachable` means here.
  if (UNREACHABLE_CODES.has(code) || code.startsWith(CONNECTION_CLASS)) {
    return { kind: 'unreachable', operation, code, message };
  }
  // Everything else that carries a code is the server having read the
  // payload and refused it on its merits: a constraint, a missing
  // reference, a schema-cache miss. Retrying does not change a payload.
  return { kind: 'rejected', operation, code, message };
}

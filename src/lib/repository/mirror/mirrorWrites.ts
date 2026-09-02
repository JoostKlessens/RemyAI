/**
 * The mirror's I/O. Nothing else — every judgement about what a column
 * means lives in rows.ts, and every judgement about when to try again
 * lives in index.ts.
 *
 * ============================================================================
 * THE PARTIAL-MIRROR PROBLEM, WHICH IS THE HARD ONE
 * ============================================================================
 *
 * A meal is four requests, not one: the parent row, then the ingredients,
 * then the steps. PostgREST has no transaction spanning them, so there is
 * necessarily a moment when the parent exists and the children do not. If
 * a friend could read the meal in that moment they would see a recipe with
 * no ingredients — not a smaller recipe, a WRONG one, and one that looks
 * like the household published something half-finished.
 *
 * FOUR THINGS WERE CONSIDERED. Three were rejected:
 *
 *   Children first, parent last. Impossible: `meal_ingredients.meal_id`
 *   and `meal_steps.meal_id` are foreign keys to `meals.id` (0001), so the
 *   parent has to exist before either child can be written at all.
 *
 *   A Postgres function wrapping all three in one transaction. This is the
 *   textbook answer and it is genuinely better — but it is a migration,
 *   and migrations are not this module's to write. Recorded here as the
 *   upgrade path rather than dismissed: an `rpc('mirror_meal', ...)` would
 *   collapse everything below into one atomic call and delete the entire
 *   ordering argument.
 *
 *   Borrowing an existing column as a "not ready yet" marker —
 *   `excluded_from_cook_proof` or `archived_at`. Rejected outright, and it
 *   is worth being clear why: both are a HOUSEHOLD'S OWN acts. "Deel deze
 *   niet" (0009 §3.5) and archiving are deliberate choices a person made,
 *   and a mirror that set them as scaffolding would clear somebody's real
 *   privacy decision the moment it finished. A technical flag must never
 *   be spelled with a consent column.
 *
 * WHAT IS ACTUALLY DONE, IN THREE PARTS.
 *
 *   1. NO DOOR IS OPEN DURING THE WINDOW. There are exactly three ways a
 *      meal's ingredients become readable outside its household:
 *      `meals_select_shared_with_friends` (0007) needs
 *      `visibility = 'friends'`; `meal_ingredients_select_sent_to_me`
 *      (0009) needs a live `recipe_shares` row; `shared_cooks` (0009)
 *      exposes no ingredient at all, only (profile_id, recipe_id). This
 *      module never writes `visibility` (rows.ts omits the key, so the
 *      column keeps 0007's `default 'private'`) and never writes
 *      `recipe_shares` (that is the social repository's, and a send is an
 *      explicit human act). A meal this module has just created is
 *      therefore unreadable by anyone outside the household for the whole
 *      duration of the window, by construction rather than by timing.
 *
 *   2. THE ORDER STILL MINIMISES THE WINDOW FOR AN ALREADY-SHARED MEAL.
 *      A meal that was sent earlier IS readable while being re-mirrored,
 *      so the child strategies are chosen to fail toward "complete but
 *      stale" instead of "empty" — see the per-table notes below.
 *
 *   3. THE OUTBOX IS THE COMPLETENESS MARKER. A meal with an unfinished
 *      job is knowable (`hasPendingMealMirror`), durably, across restarts.
 *      That is what gates the one door this module does open — a
 *      `cook_events` row, which is an FK to `meals.id` besides and would
 *      earn a 23503 — and it is what any future surface that opens a door
 *      onto a meal must consult before it does. It is a marker the mirror
 *      owns outright, so nothing about a person's intent is overloaded to
 *      carry it.
 *
 * ============================================================================
 * IDEMPOTENCY, PER TABLE, AND WHAT AN EDIT DOES
 * ============================================================================
 *
 * `meals` — UPSERT on the primary key. A meal is mutable (its title, its
 * archived_at, its accumulated dish_moods, its cook-proof exclusion), so
 * an INSERT fails with 23505 on the second write and an
 * insert-on-conflict-do-nothing freezes the very first version forever —
 * which is how you get a column that exists, has a writer, and is still
 * wrong on real data. The household is the only writer of its own meal
 * row, so "last write wins" is not a conflict rule; there is nobody to
 * conflict with.
 *
 * `meal_ingredients` — UPSERT the new set, THEN delete the remainder
 * (`meal_id = X and id not in (new ids)`). Ordering matters and this is
 * the safe direction: at every instant the remote set is the new rows plus
 * possibly some departing ones, so a concurrent reader sees a superset —
 * never an empty ingredient list. Delete-then-insert would be simpler and
 * is exactly the version that renders a sent recipe as having no
 * ingredients if the second request fails. There is no secondary unique
 * constraint on this table, so nothing can collide during the upsert.
 *
 * `meal_steps` — DELETE the remainder FIRST, then upsert. The opposite
 * order, forced by a constraint rather than chosen: 0001 declares
 * `unique (meal_id, step_number)`, so a step moving into a number another
 * row still holds collides inside the upsert statement, and Postgres
 * checks that constraint immediately rather than at commit. Freeing the
 * departing numbers first is the only ordering under which a rewritten
 * step list can land at all. The residual case this cannot express is a
 * pure renumber among RETAINED ids (steps 1 and 2 swapping): that arrives
 * as a 23505, is classified `rejected`, and parks — with the PREVIOUS,
 * COMPLETE step list still standing in Postgres, which is the failure
 * direction to want. THE MEAL-EDIT PATH HAS SINCE LANDED AND TOOK THE
 * ADVICE THIS NOTE USED TO GIVE: `updateMealRecipe`
 * (src/lib/repository/local/meals.ts) replaces both child sets outright and
 * mints fresh ids for every row, so an edit reaches here as "delete all the
 * old, insert all the new" and no id is ever retained across a renumber.
 * The residual case is therefore unreachable from this app's own write
 * paths; it is documented rather than deleted because the ordering above is
 * what makes that true, and a future caller that reused ids would bring it
 * straight back.
 *
 * `cook_events` — UPSERT on the primary key, for the same reason `meals`
 * is: `would_repeat` and `rating` are both answered AFTER the row exists
 * (0005's "Nog een keer?" and 0008's grade), so an insert-only strategy
 * would pin every cook event at rating null for eternity.
 *
 * `households` — UPDATE. Never upsert, never insert; see the header of
 * `mirrorHouseholdSettings` below.
 *
 * ============================================================================
 * NO `.select()` ON THE ROW WRITES, AND ONE ON THE PATCH
 * ============================================================================
 *
 * The four row writes do not ask for the row back: the mirror has no use
 * for it, a returned body costs bandwidth on a phone, and not reading a
 * response is the cleanest way to stay clear of PostgREST's right to
 * serialise `cook_events.rating` (numeric since 0008) as JSON text. The
 * household PATCH is the exception and has to be, because a PATCH matching
 * zero rows succeeds silently — see that function.
 */

import {
  classifyMirrorError,
  isMirrorFailure,
  toCookEventRow,
  toHouseholdSettingsPatch,
  toMealIngredientRows,
  toMealRow,
  toMealStepRows,
} from './rows';
import type {
  MirrorClient,
  MirrorCookEventJob,
  MirrorFailure,
  MirrorHouseholdSettingsJob,
  MirrorJob,
  MirrorMealJob,
  MirrorOutcome,
} from './types';

const OK: MirrorOutcome = { ok: true };

function failed(failure: MirrorFailure): MirrorOutcome {
  return { ok: false, failure };
}

/**
 * PostgREST's `in` list is a bare `(a,b,c)`. Every id reaching this has
 * already passed `isFilterSafeId`, which is what makes concatenation safe
 * — and note what is deliberately NOT done: the values are not quoted.
 * Quoting them would make PostgREST match the quote characters literally,
 * the exact bug that silently broke every cache read in this project once.
 */
function inList(ids: readonly string[]): string {
  return `(${ids.join(',')})`;
}

/**
 * Every row write goes through here, so a client that throws (a dead
 * fetch, a runtime with no global fetch at all) becomes an `unreachable`
 * failure rather than an exception escaping into a caller that has already
 * committed its local write.
 */
async function attempt(operation: string, run: () => PromiseLike<{ error: unknown }>): Promise<MirrorFailure | null> {
  try {
    const { error } = await run();
    if (error === null || error === undefined) {
      return null;
    }
    return classifyMirrorError(operation, error as { message?: string; code?: string });
  } catch (thrown: unknown) {
    return classifyMirrorError(operation, { message: thrown instanceof Error ? thrown.message : String(thrown) });
  }
}

/**
 * A meal, its ingredients and its steps — one job, one all-or-nothing
 * outcome. The first failure returns immediately rather than pressing on:
 * a later request would only widen the inconsistency, and the outbox
 * replays the whole job from the top anyway (every step here is
 * idempotent, which is what makes that replay free).
 */
export async function mirrorMeal(client: MirrorClient, job: MirrorMealJob): Promise<MirrorOutcome> {
  // Everything is built and validated BEFORE the first request, so a job
  // this module was never going to be able to finish costs zero round
  // trips and leaves nothing half-written.
  const mealRow = toMealRow(job.meal);
  if (isMirrorFailure(mealRow)) {
    return failed(mealRow);
  }
  const ingredientRows = toMealIngredientRows(job.meal.id, job.ingredients);
  if (isMirrorFailure(ingredientRows)) {
    return failed(ingredientRows);
  }
  const stepRows = toMealStepRows(job.meal.id, job.steps);
  if (isMirrorFailure(stepRows)) {
    return failed(stepRows);
  }

  const parent = await attempt('Mirroring a meal', () => client.from('meals').upsert(mealRow, { onConflict: 'id' }));
  if (parent !== null) {
    return failed(parent);
  }

  const ingredients = await replaceIngredients(client, job.meal.id, ingredientRows);
  if (ingredients !== null) {
    return failed(ingredients);
  }

  const steps = await replaceSteps(client, job.meal.id, stepRows);
  return steps === null ? OK : failed(steps);
}

/** Upsert first, delete the remainder second — a concurrent reader only ever sees a superset. */
async function replaceIngredients(
  client: MirrorClient,
  mealId: string,
  rows: readonly { readonly id: string }[],
): Promise<MirrorFailure | null> {
  const operation = "Mirroring a meal's ingredients";

  if (rows.length > 0) {
    const written = await attempt(operation, () => client.from('meal_ingredients').upsert(rows, { onConflict: 'id' }));
    if (written !== null) {
      return written;
    }
  }

  return pruneChildren(client, 'meal_ingredients', operation, mealId, rows);
}

/** Delete the remainder first — `unique (meal_id, step_number)` leaves no other order. */
async function replaceSteps(
  client: MirrorClient,
  mealId: string,
  rows: readonly { readonly id: string }[],
): Promise<MirrorFailure | null> {
  const operation = "Mirroring a meal's steps";

  const pruned = await pruneChildren(client, 'meal_steps', operation, mealId, rows);
  if (pruned !== null) {
    return pruned;
  }
  if (rows.length === 0) {
    return null;
  }
  return attempt(operation, () => client.from('meal_steps').upsert(rows, { onConflict: 'id' }));
}

/**
 * Deletes this meal's child rows that are no longer in the local set —
 * which is what makes the mirror a MIRROR rather than an append-only copy.
 * An upsert alone can add and change but never remove, so an ingredient a
 * household deleted would live on in Postgres and go on being read by
 * anyone the meal was sent to.
 *
 * An empty local set means "delete them all", and it is written as a plain
 * `eq` with no `not(...)` because PostgREST rejects an empty `in` list —
 * `not.in.()` is a parse error, not a filter that matches everything.
 */
async function pruneChildren(
  client: MirrorClient,
  table: 'meal_ingredients' | 'meal_steps',
  operation: string,
  mealId: string,
  rows: readonly { readonly id: string }[],
): Promise<MirrorFailure | null> {
  return attempt(operation, () => {
    const scoped = client.from(table).delete().eq('meal_id', mealId);
    return rows.length === 0 ? scoped : scoped.not('id', 'in', inList(rows.map((row) => row.id)));
  });
}

export async function mirrorCookEvent(client: MirrorClient, job: MirrorCookEventJob): Promise<MirrorOutcome> {
  const row = toCookEventRow(job.event);
  if (isMirrorFailure(row)) {
    return failed(row);
  }

  const failure = await attempt('Mirroring a cook event', () =>
    client.from('cook_events').upsert(row, { onConflict: 'id' }),
  );
  return failure === null ? OK : failed(failure);
}

/**
 * The household's cook-proof consent, and only that column.
 *
 * UPDATE, NEVER UPSERT, AND THE VERB IS THE GUARANTEE. A PostgREST PATCH
 * cannot create a row — there is no ON CONFLICT path and no INSERT
 * underneath it — so this function is structurally incapable of doing
 * ensureRemoteHousehold.ts's job. Three things enforce that rather than
 * one: this is the only `households` call in the module; the payload type
 * (`MirrorHouseholdSettingsPatch`) has no `name`, which is NOT NULL, so it
 * could not satisfy an insert if somebody handed it to one; and the job
 * type carries an id and a boolean rather than a `Household`, so there is
 * no row here to insert. The complementary half is that bootstrap module's
 * own refusal to upsert, and between them neither writer can revert the
 * other.
 *
 * A PATCH THAT MATCHES NOTHING IS NOT A SUCCESS. PostgREST answers a
 * zero-row UPDATE with 204 and no error, because RLS FILTERS an update
 * (0001's `households_update` is `using (is_household_member(id))`) rather
 * than raising on it. For ordinary data that silence is merely unhelpful;
 * for consent it is a lie — the household would be told sharing changed
 * when the column never moved. So the affected rows are asked for with
 * `.select('id')` and an empty answer is reported as `refused`: retryable,
 * because the membership row `is_household_member` wants may still be on
 * its way from the bootstrap, and because the alternative — reporting
 * success — is the failure mode this whole module exists to end.
 *
 * ENABLE AND REVOKE ARE THE SAME CODE PATH. Same verb, same request, same
 * classification, same outbox key, same retry. A revoke is not treated
 * more urgently than an enable inside this function, because a branch on
 * the value is a branch that can be got wrong; consent is treated more
 * urgently exactly once, in `flushMirrorOutbox`, where it is flushed ahead
 * of meals as a category, so neither direction waits behind a library.
 */
export async function mirrorHouseholdSettings(
  client: MirrorClient,
  job: MirrorHouseholdSettingsJob,
): Promise<MirrorOutcome> {
  const operation = "Mirroring a household's cook sharing";
  const patch = toHouseholdSettingsPatch(job);
  if (isMirrorFailure(patch)) {
    return failed(patch);
  }

  try {
    const { data, error } = await client.from('households').update(patch).eq('id', job.householdId).select('id');

    if (error !== null && error !== undefined) {
      return failed(classifyMirrorError(operation, error as { message?: string; code?: string }));
    }
    if (!Array.isArray(data) || data.length === 0) {
      return failed({
        kind: 'refused',
        operation,
        code: null,
        message:
          `Household ${job.householdId} matched no row this account may update — ` +
          'either it has not been bootstrapped yet (see src/lib/ensureRemoteHousehold.ts) or ' +
          'is_household_member() is still false for this session.',
      });
    }
    return OK;
  } catch (thrown: unknown) {
    return failed(
      classifyMirrorError(operation, { message: thrown instanceof Error ? thrown.message : String(thrown) }),
    );
  }
}

/** Dispatches a job to its writer. Exhaustive by construction — a new job kind is a compile error here. */
export async function runMirrorJob(client: MirrorClient, job: MirrorJob): Promise<MirrorOutcome> {
  switch (job.kind) {
    case 'meal':
      return mirrorMeal(client, job);
    case 'cook_event':
      return mirrorCookEvent(client, job);
    case 'household_settings':
      return mirrorHouseholdSettings(client, job);
  }
}

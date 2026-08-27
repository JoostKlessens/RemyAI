/**
 * The one-time pass that hands the rows written BEFORE the mirror existed
 * to the mirror, by putting them in the outbox the normal flush already
 * drains.
 *
 * WHY THIS EXISTS, AND WHY IT IS A CORRECTNESS FIX RATHER THAN A TIDY-UP.
 * W-16 wired every local write to a `MirrorJobSink`
 * (createRepository.ts), so every meal, cook event and consent answer
 * written FROM NOW ON is enqueued durably and reaches Postgres. The rows
 * already sitting in AsyncStorage on the owner's phone have no entry and
 * nothing in the app will ever create one. Two consequences, and the
 * second is the serious one:
 *
 *   1. They never reach Postgres at all, which is precisely the data the
 *      mirror was built for — a household whose real library is invisible
 *      to `shared_cooks` (0009), to a friend's send card, and to every
 *      social surface that joins across households.
 *
 *   2. `hasPendingMealMirror(outbox, mealId)` answers `false` for them.
 *      Its own header is explicit that `false` covers BOTH "the mirror
 *      landed" and "nothing was ever enqueued", and it is safe to conflate
 *      the two only while "never enqueued" implies "never written". This
 *      module's absence is what made that implication false.
 *      src/lib/sendRecipe.ts uses that answer as the gate before opening a
 *      door onto a meal for a friend, so a pre-existing meal PASSES the
 *      gate while having no rows in Postgres, and the friend receives a
 *      recipe with no ingredients and no steps.
 *
 * So the fix is not "also send the old rows". It is "make the outbox tell
 * the truth about the old rows", and sending them is what follows.
 *
 * SHAPED LIKE migrateIdsToUuid.ts, AND DELIBERATELY SO: a pass over the
 * raw store, run once from `ensureSeeded`, errors propagating, nothing
 * logged, no repository interface involved. It reads through
 * `createRepositoryTables` rather than through `RemyRepository` because
 * `listHouseholdMeals` filters by household and archive state, and this
 * needs each table exactly as it is on disk.
 *
 * ── SCOPE: EXACTLY WHAT THE MIRROR MIRRORS ─────────────────────────────
 *
 * Every `meals` row (its ingredients and steps ride inside the meal job,
 * because a meal missing its ingredients is not a smaller recipe but a
 * wrong one), every `cook_events` row, and each household's
 * `share_cooks_with_friends` as a `household_settings` job.
 *
 * NOT saves, decisions, members or restrictions. mirror/types.ts says why
 * the mirror does not carry them, and `member_restrictions` in particular
 * is GDPR Article 9 health data — a backfill that quietly widened the set
 * of tables leaving the device would be a privacy change wearing a
 * migration's clothes. The list here must never grow past the list there.
 *
 * ── WHY IT MUST RUN AFTER migrateIdsToUuid, AND WHAT ENFORCES IT ───────
 *
 * A legacy id (`meal-lz8k2p-3-a9f2c1`) cannot be written to a Postgres
 * `uuid` column: Postgres refuses it at parse time with 22P02, which
 * mirror/rows.ts classifies as `rejected` and mirror/index.ts PARKS
 * FOREVER. Enqueuing one would therefore not be a retryable mistake, it
 * would be a permanent entry — and for a meal, a permanent entry means
 * `hasPendingMealMirror` answers `true` for that meal for the rest of the
 * install's life, blocking every send of it. Worse than the bug above.
 *
 * createRepository.ts runs the migration first, and that order is asserted
 * in tests/repository/mirrorBackfill.test.ts. But an ordering that lives
 * only in one call site is an ordering one edit can silently invert, so it
 * is ALSO enforced here, structurally: a row whose ids are not yet uuids
 * is not enqueued, and — see the next section — a pass that skipped one
 * does not record itself as done. Run this module before the migration and
 * it does nothing and leaves the work for the next launch, instead of
 * poisoning the backlog.
 *
 * ── IDEMPOTENCE, AND WHY IT NEEDS A MARKER WHEN THE MIGRATION DID NOT ──
 *
 * migrateIdsToUuid.ts refuses to gate on its own `remy:schema_version`
 * stamp, and it is right to: it can DERIVE whether a row still needs work
 * from the shape of the value in front of it (`isUuid`), so the data
 * answers the question and a stamp could only lie about it.
 *
 * That derivation is not available here, and the reason is worth stating
 * exactly. A successful mirror SETTLES its entry — mirror/index.ts removes
 * it from the outbox — and nothing on the local row records that it ever
 * happened. So a meal that was mirrored last week and a meal that was
 * never enqueued at all are byte-for-byte identical on this device. There
 * is no shape to read. "Enqueue everything on every launch" would
 * therefore re-queue rows that are already safely in Postgres, on every
 * single launch, which means the outbox is never empty, which means
 * `hasPendingMealMirror` answers `true` for every meal at every launch,
 * which blocks every send — a permanent version of the bug this module
 * exists to fix.
 *
 * So there is a durable marker, `remy:mirror_backfill_version`. What makes
 * it trustworthy is not that it is written carefully; it is that its two
 * failure directions are wildly unequal and it can only fail in the safe
 * one:
 *
 *   MARKER PRESENT, WORK NOT DONE — the dangerous direction, because it
 *   silently restores the original bug. It cannot happen: the marker is
 *   written LAST, strictly after every `enqueue` above it has been awaited
 *   (and each of those has awaited its own `setItem`), and only by a pass
 *   with nothing left to do. A pass that throws — a full disk, a store
 *   that refuses — propagates and writes nothing, exactly as the migration
 *   does. There is no window in which the marker is written before the
 *   entries it attests to, which is the specific failure that made a stamp
 *   untrustworthy as a GATE in migrateIdsToUuid.ts.
 *
 *   MARKER ABSENT, WORK DONE — harmless. The next launch re-enqueues; the
 *   outbox coalesces on row identity so nothing duplicates; every write in
 *   mirrorWrites.ts is idempotent so a redundant send changes nothing; and
 *   the flush drains the lot. It costs requests, not correctness.
 *
 * A garbage or unreadable marker value therefore reads as "never run"
 * (`readMirrorBackfillVersion` below), because re-running is the cheap
 * mistake and skipping is the expensive one.
 *
 * It is VERSIONED rather than boolean for the reason the schema stamp is:
 * if a later phase adds a fifth table to the mirror, that phase bumps
 * `MIRROR_BACKFILL_VERSION` and every device does exactly one more pass.
 * A boolean would have to be deleted from every install by hand.
 *
 * ── WHY "DEFERRED" AND "EXCLUDED" ARE NOT THE SAME WORD ────────────────
 *
 * A row can fail to be enqueued for two completely different reasons, and
 * collapsing them is how a marker starts lying:
 *
 *   DEFERRED — its ids are still legacy strings. A later run, after the
 *   migration, WILL be able to enqueue it. So the pass is unfinished and
 *   the marker is withheld. This is the whole structural enforcement of
 *   the ordering rule above.
 *
 *   EXCLUDED — the mirror can never accept it, whatever runs later. A
 *   curated meal (`householdId === null`) is the real case: 0001's
 *   `meals_insert` policy is `household_id is not null and
 *   is_household_member(...)`, and `toMealRow` refuses it in so many
 *   words. Enqueuing one would park an entry permanently and — because
 *   `hasPendingMealMirror` does not care whether an entry is parked —
 *   block that meal's send forever. So it is left out, and it does NOT
 *   withhold the marker: withholding over something no run can fix would
 *   mean re-running on every launch forever, which is the trap again. An
 *   id that is not a string at all lands here for the same reason —
 *   nothing downstream will repair it, so it must not hold the pass open.
 *
 * ── TWO SMALLER CHOICES, WRITTEN DOWN SO THEY ARE NOT RE-LITIGATED ─────
 *
 * ENQUEUES ARE SEQUENTIAL, NOT `Promise.all`. `enqueue` is a
 * read-modify-write of one storage key, so two in flight at once would
 * each write a list that does not contain the other's entry. The reads at
 * the top ARE concurrent, because they are reads. The cost is that N jobs
 * means N rewrites of a growing array; a library large enough for that to
 * be felt at launch is the signal to add a batch `enqueueAll` to
 * mirror/outbox.ts, which is that module's call to make, not this one's.
 *
 * CHILDREN ARE GROUPED ONCE, NOT FETCHED PER MEAL. local/meals.ts's
 * `getMealIngredients` lists the whole table and filters it, which is
 * right for one meal and quadratic for a library — a two-hundred-meal
 * store would parse the ingredients table four hundred times. The two
 * child tables are read once here and grouped, sorted by the same keys
 * (`sortOrder`, `stepNumber`) so a backfilled job is indistinguishable
 * from one a live write produced.
 */

import { isUuid } from './id';
import type { KeyValueStore } from './keyValueStore';
import { createRepositoryTables } from './local/tables';
import { createMirrorOutbox } from './mirror';
import type { MirrorJob } from './mirror/types';
import type { CookEvent, Household, Meal, MealIngredient, MealStep } from '@/domain/types';

/** `remy:`-prefixed like every other key in this store (local/tables.ts). */
export const MIRROR_BACKFILL_KEY = 'remy:mirror_backfill_version';

/** Bumped only by a LATER phase that widens what the mirror carries. */
export const MIRROR_BACKFILL_VERSION = 1;

/** What an unmarked — or unreadable — store reports. See the header on which mistake is the cheap one. */
const NEVER_RUN = 0;

export interface MirrorBackfillResult {
  /** Meal jobs enqueued, each carrying its own ingredients and steps. */
  readonly meals: number;
  readonly cookEvents: number;
  readonly householdSettings: number;
  /** Rows the mirror can never accept, so no later run could enqueue them either. */
  readonly excluded: number;
  /** Rows still carrying a legacy id. Non-zero means the migration has not been over this store — and withholds the marker. */
  readonly deferred: number;
  /** Whether this pass recorded itself as the last one. False means the next launch runs again. */
  readonly completed: boolean;
}

/** A store that has already been through it: nothing read, nothing written, nothing left to do. */
const ALREADY_BACKFILLED: MirrorBackfillResult = {
  meals: 0,
  cookEvents: 0,
  householdSettings: 0,
  excluded: 0,
  deferred: 0,
  completed: true,
};

// ---------------------------------------------------------------------------
// Deciding what a row is
// ---------------------------------------------------------------------------

/**
 * `ready` — a uuid Postgres can parse.
 * `legacy` — a string `migrateIdsToUuid` will renumber on a later run.
 * `unusable` — not a string at all: a curated meal's null household, or a
 *   value nothing downstream can repair.
 *
 * See the header on why the last two are different words.
 */
type IdState = 'ready' | 'legacy' | 'unusable';

function idState(value: unknown): IdState {
  if (isUuid(value)) {
    return 'ready';
  }
  return typeof value === 'string' ? 'legacy' : 'unusable';
}

/** A row's state is its worst id's: one unmirrorable field makes the whole job unmirrorable. */
function combine(states: readonly IdState[]): IdState {
  if (states.includes('unusable')) {
    return 'unusable';
  }
  return states.includes('legacy') ? 'legacy' : 'ready';
}

// ---------------------------------------------------------------------------
// Planning the pass
// ---------------------------------------------------------------------------

interface StoredRows {
  readonly households: readonly Household[];
  readonly meals: readonly Meal[];
  readonly ingredients: readonly MealIngredient[];
  readonly steps: readonly MealStep[];
  readonly cookEvents: readonly CookEvent[];
}

interface BackfillPlan {
  readonly jobs: readonly MirrorJob[];
  readonly excluded: number;
  readonly deferred: number;
}

const EMPTY_PLAN: BackfillPlan = { jobs: [], excluded: 0, deferred: 0 };

/**
 * Adds one classified candidate to a plan. Immutable: a new plan every
 * time, never a counter incremented in place. The job is built lazily so a
 * row that is not going to be enqueued costs nothing to classify.
 */
function extend(plan: BackfillPlan, state: IdState, buildJob: () => MirrorJob): BackfillPlan {
  if (state === 'unusable') {
    return { ...plan, excluded: plan.excluded + 1 };
  }
  if (state === 'legacy') {
    return { ...plan, deferred: plan.deferred + 1 };
  }
  return { ...plan, jobs: [...plan.jobs, buildJob()] };
}

function groupByMealId<T extends { readonly mealId: string }>(rows: readonly T[]): ReadonlyMap<string, readonly T[]> {
  return rows.reduce<Map<string, readonly T[]>>(
    (grouped, row) => grouped.set(row.mealId, [...(grouped.get(row.mealId) ?? []), row]),
    new Map<string, readonly T[]>(),
  );
}

/**
 * The whole decision, as a pure function of the stored rows.
 *
 * ORDER WITHIN THE PLAN MATCHES THE FLUSH'S OWN PRIORITY — consent, then
 * meals, then cook events. `flushMirrorOutbox` sorts by kind anyway, so
 * this changes nothing about what is sent first; what it changes is what
 * an INTERRUPTED pass leaves behind. A pass killed half way has at least
 * queued the consent answer, which is the one job whose delay is a broken
 * promise to the user rather than a slow upload.
 */
function planBackfill(rows: StoredRows): BackfillPlan {
  const ingredientsByMeal = groupByMealId(rows.ingredients);
  const stepsByMeal = groupByMealId(rows.steps);

  const withHouseholds = rows.households.reduce(
    (plan, household) =>
      extend(plan, idState(household.id), () => ({
        kind: 'household_settings',
        householdId: household.id,
        // `=== true` rather than `?? false`: this is consent, and the two
        // agree on every legal value while only this one refuses to turn a
        // stray truthy value from older persisted JSON into a yes. It is
        // also exactly what `toHouseholdSettingsPatch` does with the same
        // field, so the job and the row it becomes cannot disagree.
        shareCooksWithFriends: household.shareCooksWithFriends === true,
      })),
    EMPTY_PLAN,
  );

  const withMeals = rows.meals.reduce((plan, meal) => {
    // Copied before sorting. The grouped arrays are this function's own,
    // and `[...x].sort()` keeps that true regardless of what
    // `groupByMealId` is later changed to hand back.
    const ingredients = [...(ingredientsByMeal.get(meal.id) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const steps = [...(stepsByMeal.get(meal.id) ?? [])].sort((a, b) => a.stepNumber - b.stepNumber);
    const state = combine([
      idState(meal.id),
      // Null here is a curated meal, which `toMealRow` refuses outright.
      idState(meal.householdId),
      ...ingredients.map((ingredient) => idState(ingredient.id)),
      ...steps.map((step) => idState(step.id)),
    ]);
    return extend(plan, state, () => ({ kind: 'meal', meal, ingredients, steps }));
  }, withHouseholds);

  return rows.cookEvents.reduce((plan, event) => {
    const state = combine([idState(event.id), idState(event.householdId), idState(event.mealId)]);
    return extend(plan, state, () => ({ kind: 'cook_event', event }));
  }, withMeals);
}

function countKind(jobs: readonly MirrorJob[], kind: MirrorJob['kind']): number {
  return jobs.filter((job) => job.kind === kind).length;
}

// ---------------------------------------------------------------------------
// Running it
// ---------------------------------------------------------------------------

export async function readMirrorBackfillVersion(store: KeyValueStore): Promise<number> {
  const raw = await store.getItem(MIRROR_BACKFILL_KEY);
  if (raw === null) {
    return NEVER_RUN;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : NEVER_RUN;
}

/**
 * Enqueues every already-stored row the mirror is responsible for, so the
 * ordinary flush drains them like any other backlog.
 *
 * Safe to call on every launch: a store already marked at this version is
 * read once and left alone, which is what keeps the outbox from being
 * permanently non-empty (see the header on the trap).
 *
 * Errors propagate, exactly as `migrateIdsToUuid`'s do. A store that
 * cannot be written is not something to carry on past — carrying on would
 * mean recording a pass as complete that is not — and because nothing is
 * recorded until everything is enqueued, the next launch simply performs
 * the whole pass again.
 */
export async function backfillMirrorOutbox(store: KeyValueStore): Promise<MirrorBackfillResult> {
  if ((await readMirrorBackfillVersion(store)) >= MIRROR_BACKFILL_VERSION) {
    return ALREADY_BACKFILLED;
  }

  const tables = createRepositoryTables(store);
  const [households, meals, ingredients, steps, cookEvents] = await Promise.all([
    tables.households.list(),
    tables.meals.list(),
    tables.mealIngredients.list(),
    tables.mealSteps.list(),
    tables.cookEvents.list(),
  ]);

  const plan = planBackfill({ households, meals, ingredients, steps, cookEvents });

  const outbox = createMirrorOutbox(store);
  for (const job of plan.jobs) {
    // Sequential on purpose — see the header. `enqueue` coalesces on row
    // identity, so a row a live write already queued is replaced rather
    // than duplicated, and that is what makes a repeated pass safe.
    await outbox.enqueue(job);
  }

  // LAST, and only for a pass with nothing left to do. The early return
  // above is what keeps this monotonic: a store already at or beyond this
  // version never reaches here, so a future build's marker survives a
  // downgrade rather than being written backwards.
  const completed = plan.deferred === 0;
  if (completed) {
    await store.setItem(MIRROR_BACKFILL_KEY, String(MIRROR_BACKFILL_VERSION));
  }

  return {
    meals: countKind(plan.jobs, 'meal'),
    cookEvents: countKind(plan.jobs, 'cook_event'),
    householdSettings: countKind(plan.jobs, 'household_settings'),
    excluded: plan.excluded,
    deferred: plan.deferred,
    completed,
  };
}

/**
 * The write-through mirror's public seam: the three functions the rest of
 * the app is meant to call, and the retry policy that reads a failure's
 * kind.
 *
 * WHERE EACH CALL BELONGS. The wiring itself is a later phase; this is the
 * map, written here so it does not have to be re-derived:
 *
 *   `mirrorWriteThrough` — called, NEVER AWAITED, immediately after the
 *   local write returns, from the delegating methods in
 *   src/lib/repository/localRepository.ts:
 *     * `createMeal`            -> a `meal` job (the meal it returned plus
 *                                  the ingredients and steps it wrote)
 *     * `setMealCookProofExclusion`, `addMealDishMood`
 *                               -> a `meal` job for the updated meal
 *     * `updateMealRecipe`      -> a `meal` job for the edited meal, whose
 *                                  ingredients and steps are re-read AFTER
 *                                  the local replace, so the job carries the
 *                                  new child rows and their new ids. This is
 *                                  the only meal write whose children move,
 *                                  and it is what `pruneChildren` in
 *                                  mirrorWrites.ts exists for.
 *     * `createCookEvent`, `setCookEventRepeat`, `setCookEventRating`
 *                               -> a `cook_event` job
 *     * `setHouseholdCookSharing`
 *                               -> a `household_settings` job
 *   Note which method is NOT on that list: `updateHouseholdSettings`.
 *   `setHouseholdCookSharing` was deliberately kept out of it (see
 *   RemyRepository's comment on that method) so a stale settings spread
 *   cannot flip consent as a side effect, and the mirror must preserve
 *   that separation rather than quietly reunite the two behind one job.
 *
 *   `flushMirrorOutbox` — on app start, after `ensureRemoteHousehold`
 *   reports ready (`isHouseholdReady`), and again when connectivity
 *   returns. Not awaited on a render path. The store to build the outbox
 *   on is createRepository.ts's `getAppStore` singleton, so the backlog
 *   shares the KeyValueStore every other table already lives in.
 *
 *   `hasPendingMealMirror` — consulted by any surface about to open a door
 *   onto a meal for somebody outside the household. Today that is the
 *   directed send (src/lib/sendRecipe.ts's caller): sending a meal whose
 *   ingredients have not reached Postgres shows the recipient an empty
 *   recipe, because `meal_ingredients_select_sent_to_me` (0009) grants
 *   them the read the moment the send row exists.
 *
 * WHY THE MIRROR IS NEVER AWAITED BY A WRITE PATH. The local write is the
 * one that must succeed, and it already has by the time this is called. A
 * caller that awaited the mirror would make every save as slow as the
 * network and would fail a save because a phone is in a lift.
 * `void mirrorWriteThrough(...)` is the intended shape, which is why
 * nothing below can throw: an unhandled rejection from a voided promise is
 * a crash caused by being offline.
 *
 * THE RETRY POLICY, WHICH IS THE ONE PLACE FAILURE KINDS ARE READ.
 *   `unreachable` -> retried on every flush, forever. A phone in a
 *      basement is not an error state.
 *   `refused` -> retried on every flush too. 42501 today can be a success
 *      tomorrow, because the household bootstrap and the auth session that
 *      `is_household_member` needs may simply not have landed yet. It is a
 *      DIFFERENT KIND from `unreachable` even though the policy agrees,
 *      because a developer reading a backlog of forty refusals needs to
 *      see "not allowed", not "offline" — and if the two were one kind
 *      nobody would ever discover that RLS was the problem.
 *   `rejected` -> PARKED. Retained, counted, its message intact, and never
 *      attempted again. No number of retries changes a payload, and a
 *      constraint violation on a timer is a hot loop with an outbox's
 *      manners. Re-enqueuing the row — which any later local write to it
 *      does — clears the park, because `enqueue` resets the entry. So a
 *      corrected row heals itself and a broken one stays visible.
 *
 * NOTHING HERE LOGS. A library that writes to the console has decided for
 * its caller what is worth saying. Every function returns what happened;
 * the wiring phase chooses what to do with it.
 */

import { runMirrorJob } from './mirrorWrites';
import { MEAL_JOB_KEY_PREFIX, mirrorJobKey } from './outbox';
import type { MirrorOutbox, MirrorOutboxEntry } from './outbox';
import type { MirrorClient, MirrorFailure, MirrorJob, MirrorOutcome } from './types';

export { MEAL_JOB_KEY_PREFIX, MIRROR_OUTBOX_KEY, createMirrorOutbox, mirrorJobKey } from './outbox';
export type { MirrorOutbox, MirrorOutboxEntry } from './outbox';
export { mirrorCookEvent, mirrorHouseholdSettings, mirrorMeal, runMirrorJob } from './mirrorWrites';
export { classifyMirrorError } from './rows';
export type {
  MirrorClient,
  MirrorCookEventJob,
  MirrorFailure,
  MirrorFailureKind,
  MirrorHouseholdSettingsJob,
  MirrorJob,
  MirrorMealJob,
  MirrorOutcome,
  MirrorTable,
} from './types';

/**
 * What one pass over the backlog did. Counts plus the failures
 * themselves — a count with no kind attached is precisely the shape this
 * module exists to stop producing.
 */
export interface MirrorFlushSummary {
  /** Landed and removed from the backlog. */
  readonly mirrored: number;
  /** Attempted this pass and failed. Still queued. */
  readonly failed: number;
  /** Held back this pass without being attempted, because the meal they depend on has not landed. */
  readonly deferred: number;
  /** Held back permanently: a `rejected` payload no retry can fix. */
  readonly parked: number;
  readonly failures: readonly MirrorFailure[];
}

const EMPTY_SUMMARY: MirrorFlushSummary = { mirrored: 0, failed: 0, deferred: 0, parked: 0, failures: [] };

/**
 * Mirror one local write. Durable first, attempted second, and never
 * throws.
 *
 * The enqueue happens even on the happy path, and that is the point rather
 * than an inefficiency: between a request being sent and its answer
 * arriving there is a window in which the process can die, and only a
 * durable entry survives it. A replay of a request that actually succeeded
 * is free, because every write in mirrorWrites.ts is idempotent.
 */
export async function mirrorWriteThrough(
  client: MirrorClient,
  outbox: MirrorOutbox,
  job: MirrorJob,
): Promise<MirrorOutcome> {
  const key = mirrorJobKey(job);

  try {
    await outbox.enqueue(job);
  } catch (thrown: unknown) {
    // The local write already succeeded, so the data is safe; what is lost
    // is the promise to retry. Reported rather than thrown, and reported
    // as `unreachable` because a storage failure is transient in the same
    // way a network one is — the next write to this row re-queues it.
    return {
      ok: false,
      failure: {
        kind: 'unreachable',
        operation: 'Queuing a mirror',
        code: null,
        message: thrown instanceof Error ? thrown.message : String(thrown),
      },
    };
  }

  return settleOutcome(outbox, key, await runMirrorJob(client, job));
}

/** Removes the entry on success, counts the attempt on failure. Shared by the write-through and the flush so the two cannot disagree. */
async function settleOutcome(outbox: MirrorOutbox, key: string, outcome: MirrorOutcome): Promise<MirrorOutcome> {
  try {
    if (outcome.ok) {
      await outbox.settle(key);
    } else {
      await outbox.recordFailure(key, outcome.failure);
    }
  } catch {
    // Bookkeeping that could not be written does not change what actually
    // happened to the row, and the caller is told the truth about the
    // mirror either way. Worst case the entry is retried once more, which
    // is safe by construction.
  }
  return outcome;
}

/**
 * Retry everything in the backlog that is worth retrying, once.
 *
 * ORDER IS LOAD-BEARING, IN TWO PLACES.
 *
 *   Consent goes FIRST. `households.share_cooks_with_friends` decides what
 *   other people can see, and a revoke is a promise already made to the
 *   user — "sharing has stopped". Neither direction may wait behind a
 *   library's worth of queued meals, so consent jobs are flushed as a
 *   category before anything else. Note this is the ONLY place that
 *   urgency lives: mirrorHouseholdSettings itself does not branch on
 *   whether the value is true or false, because a branch on consent is a
 *   branch that can be got wrong.
 *
 *   Meals go before cook events. A cook event is the one row this module
 *   writes that becomes visible to somebody else (`shared_cooks`, 0009),
 *   and `cook_events.meal_id` is a foreign key to `meals.id`, so proof
 *   written ahead of its meal is both a privacy problem and a guaranteed
 *   23503. A cook event whose meal is still in the backlog is DEFERRED —
 *   not attempted and not failed — and becomes eligible as soon as that
 *   meal lands, including within this same pass.
 *
 * Sequential rather than concurrent, on purpose. The dependency above
 * needs one job to finish before another starts, and a phone flushing a
 * backlog over a weak connection is better served by one request at a time
 * than by twenty competing for the same radio.
 */
export async function flushMirrorOutbox(client: MirrorClient, outbox: MirrorOutbox): Promise<MirrorFlushSummary> {
  const entries = await outbox.list();
  if (entries.length === 0) {
    return EMPTY_SUMMARY;
  }

  const parked = entries.filter(isParked);
  const runnable = entries.filter((entry) => !isParked(entry));

  // The meals that will still be unfinished when the cook events run. It
  // starts as every queued meal — including the parked ones, which is why
  // this is computed from `entries` and not from `runnable` — and shrinks
  // as meals land below.
  const pendingMeals = new Set(entries.filter((entry) => entry.job.kind === 'meal').map((entry) => entry.key));

  const failures: MirrorFailure[] = [];
  let mirrored = 0;
  let deferred = 0;

  for (const entry of order(runnable)) {
    if (entry.job.kind === 'cook_event' && pendingMeals.has(`${MEAL_JOB_KEY_PREFIX}${entry.job.event.mealId}`)) {
      deferred += 1;
      continue;
    }

    const outcome = await settleOutcome(outbox, entry.key, await runMirrorJob(client, entry.job));
    if (outcome.ok) {
      mirrored += 1;
      pendingMeals.delete(entry.key);
    } else {
      failures.push(outcome.failure);
    }
  }

  return { mirrored, failed: failures.length, deferred, parked: parked.length, failures };
}

/** Consent, then meals, then cook events. See `flushMirrorOutbox`'s header. */
const KIND_ORDER: Record<MirrorJob['kind'], number> = { household_settings: 0, meal: 1, cook_event: 2 };

function order(entries: readonly MirrorOutboxEntry[]): readonly MirrorOutboxEntry[] {
  // A copy, because `list()` hands back the stored array and sorting in
  // place would reorder it under whoever else is reading.
  return [...entries].sort((a, b) => KIND_ORDER[a.job.kind] - KIND_ORDER[b.job.kind]);
}

/** A payload no retry can fix. Kept and counted; never attempted again until a fresh local write replaces the entry. */
function isParked(entry: MirrorOutboxEntry): boolean {
  return entry.lastFailure?.kind === 'rejected';
}

/**
 * Whether this meal has a mirror that has not finished — the module's
 * completeness marker, and the gate the cook-event flush above uses.
 *
 * WHAT IT HONESTLY ANSWERS, AND WHAT IT DOES NOT. It answers "is there an
 * unfinished job for this meal", which is the question with a real answer:
 * the outbox knows about incompleteness because it created it. It does NOT
 * prove a meal ever reached Postgres — a meal that was never enqueued at
 * all also answers `false`. That is acceptable precisely because the
 * wiring above enqueues on every meal write, so "never enqueued" means
 * "never written locally either"; it is stated here so nobody later reads
 * `false` as "confirmed present in Postgres" and builds something on it.
 */
export async function hasPendingMealMirror(outbox: MirrorOutbox, mealId: string): Promise<boolean> {
  const key = `${MEAL_JOB_KEY_PREFIX}${mealId}`;
  return (await outbox.list()).some((entry) => entry.key === key);
}

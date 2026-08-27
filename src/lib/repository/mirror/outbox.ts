/**
 * The durable backlog of mirrors that have not landed yet.
 *
 * WHAT MAKES THIS AN OUTBOX AND NOT A SYNC ENGINE. The distinction is not
 * a matter of degree, so it is worth stating as four properties this file
 * has and a sync engine does not:
 *
 *   ONE DIRECTION. Nothing here reads Postgres, and nothing here writes
 *   local state. An entry is a local row waiting to be sent, full stop.
 *
 *   NO MERGE. Entries are keyed on ROW IDENTITY (`meal:<id>`), so
 *   re-mirroring a row REPLACES its entry with the newer snapshot. That is
 *   not a conflict resolution — nothing is combined, no field is chosen
 *   over another field, and no remote value is consulted. It is simply
 *   that an older snapshot of a row nobody else writes has no reader left.
 *
 *   NO CLOCK COMPARISON. `queuedAt` is written for a human reading a
 *   backlog and is never compared to anything, here or in index.ts. There
 *   is no last-write-wins rule because there is only one writer.
 *
 *   BOUNDED BY THE DATA, NOT BY HISTORY. Because of the keying, the
 *   backlog can never be longer than the number of distinct rows with an
 *   unfinished mirror. An append-only log of every write a household ever
 *   made would be a journal, and a journal is the first half of the thing
 *   this is not.
 *
 * If a future requirement needs any of those four to change — a second
 * device, a server that edits a household's own rows, a real conflict —
 * that is a design decision to take deliberately, not an edit to make
 * here.
 *
 * ENQUEUE FIRST, SEND SECOND, AND THAT ORDER IS THE WHOLE DURABILITY
 * STORY. index.ts writes the entry before it attempts the request, so a
 * process killed mid-flight leaves the job behind rather than losing it in
 * an awaited promise nobody kept. The cost is that a request which
 * SUCCEEDED but whose acknowledgement never arrived gets replayed — which
 * is exactly why every write in mirrorWrites.ts is idempotent, and why
 * that property is asserted rather than assumed.
 *
 * BUILT ON `createTableAccessor`, NOT ON A NEW STORAGE PRIMITIVE. That
 * helper already carries the defensive-parsing posture this needs (a
 * corrupt or hand-edited value degrades to an empty table rather than
 * taking the app down), and the outbox lives in the same KeyValueStore as
 * every other table under the same `remy:` namespace. A second storage
 * mechanism for one array would be a second thing to migrate.
 *
 * THE ENTRY IS THE DOMAIN JOB, NOT THE POSTGRES ROWS. Storing built rows
 * would make an entry self-contained but would freeze the column list at
 * the moment it was queued — so a backlog written before a fix landed
 * would keep sending the old shape afterwards. Storing the job means the
 * rows are rebuilt by the current rows.ts on every attempt.
 */

import { nowIso } from '../clock';
import type { KeyValueStore } from '../keyValueStore';
import { createTableAccessor } from '../table';
import type { MirrorFailure, MirrorJob } from './types';
import type { IsoDateTimeString } from '@/domain/types';

/** Namespaced like every other table in local/tables.ts, so one store holds them all. */
export const MIRROR_OUTBOX_KEY = 'remy:mirror_outbox';

export interface MirrorOutboxEntry {
  /** `<job kind>:<row id>` — see `mirrorJobKey`. Identity, which is what makes coalescing possible. */
  readonly key: string;
  readonly job: MirrorJob;
  /** When this row was first queued. Diagnostic only; nothing compares it — see the header. */
  readonly queuedAt: IsoDateTimeString;
  /** How many times it has been attempted and failed. Read by a human, never by a backoff rule. */
  readonly attempts: number;
  /** Why the last attempt failed, with its kind intact. Null before the first attempt. */
  readonly lastFailure: MirrorFailure | null;
}

export interface MirrorOutbox {
  list(): Promise<readonly MirrorOutboxEntry[]>;
  /** Adds the job, or replaces the entry already standing for the same row. */
  enqueue(job: MirrorJob): Promise<void>;
  /** The job landed. Removes it. */
  settle(key: string): Promise<void>;
  /** The job did not land. Keeps it, counts the attempt, and remembers the failure with its kind. */
  recordFailure(key: string, failure: MirrorFailure): Promise<void>;
}

/**
 * The identity of the ROW a job is about — not of the attempt, and not of
 * the moment. Two jobs for one row must collide here, because that
 * collision is what keeps the backlog bounded and what makes "the latest
 * consent answer is the one that gets mirrored" true without any rule
 * being written down.
 */
export function mirrorJobKey(job: MirrorJob): string {
  switch (job.kind) {
    case 'meal':
      return `${MEAL_JOB_KEY_PREFIX}${job.meal.id}`;
    case 'cook_event':
      return `cook_event:${job.event.id}`;
    case 'household_settings':
      return `household_settings:${job.householdId}`;
  }
}

/** The prefix `hasPendingMealMirror` matches on. One definition, so the two cannot drift. */
export const MEAL_JOB_KEY_PREFIX = 'meal:';

export function createMirrorOutbox(store: KeyValueStore): MirrorOutbox {
  const table = createTableAccessor<MirrorOutboxEntry>(store, MIRROR_OUTBOX_KEY);

  return {
    list(): Promise<readonly MirrorOutboxEntry[]> {
      return table.list();
    },

    async enqueue(job: MirrorJob): Promise<void> {
      const key = mirrorJobKey(job);
      const existing = await table.list();
      const entry: MirrorOutboxEntry = {
        key,
        job,
        // The ORIGINAL queuing time survives a replacement: what a human
        // wants from a backlog is how long this row has been stuck, not
        // when it was last edited.
        queuedAt: existing.find((candidate) => candidate.key === key)?.queuedAt ?? nowIso(),
        // Reset, deliberately. The attempts belonged to the previous
        // snapshot; a new snapshot has earned none of them, and carrying
        // them over would let a payload that has since been corrected
        // inherit a parked predecessor's history and stay parked.
        attempts: 0,
        lastFailure: null,
      };
      await table.replaceAll([...existing.filter((candidate) => candidate.key !== key), entry]);
    },

    async settle(key: string): Promise<void> {
      const existing = await table.list();
      await table.replaceAll(existing.filter((candidate) => candidate.key !== key));
    },

    async recordFailure(key: string, failure: MirrorFailure): Promise<void> {
      const existing = await table.list();
      // Immutable: a new array of new entries, never a field assigned in
      // place on a row somebody else may be holding.
      await table.replaceAll(
        existing.map((candidate) =>
          candidate.key === key ? { ...candidate, attempts: candidate.attempts + 1, lastFailure: failure } : candidate,
        ),
      );
    },
  };
}

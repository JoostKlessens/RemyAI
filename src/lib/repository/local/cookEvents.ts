/**
 * Cook event reads/writes — the outcome loop (PD-003): "Gemaakt?" creates
 * the row, and the rating that follows fills in both `rating` and its
 * projection onto `wouldRepeat`.
 *
 * TWO COLUMNS FOR ONE ANSWER, on purpose. `rating` is what the cook
 * actually said; `wouldRepeat` is the boolean scoring.ts was built around
 * and still reads through `resolveRepeatSignal`. Keeping the projection
 * here — at the single write seam — rather than deriving it on every read
 * means the tuned HOUSEHOLD_FAVOURITE_BOOST / WOULD_NOT_REPEAT_PENALTY
 * values keep working untouched, and any future Supabase view or analytics
 * query reading `would_repeat` directly sees the same answer the app does.
 * The mapping itself is never spelled out in this file: it is one call to
 * `toRepeatSignal`, so the thresholds live only in src/domain/rating.ts.
 */

import { isValidRating, toRepeatSignal } from '@/domain/rating';
import type { CookEvent, CookEventId, HouseholdId } from '@/domain/types';
import type { CreateCookEventInput } from '../types';
import { generateLocalId } from '../id';
import { nowIso } from '../clock';
import type { RepositoryTables } from './tables';

export async function listCookEvents(
  tables: RepositoryTables,
  householdId: HouseholdId,
): Promise<readonly CookEvent[]> {
  const cookEvents = await tables.cookEvents.list();
  return cookEvents.filter((event) => event.householdId === householdId);
}

export async function createCookEvent(
  tables: RepositoryTables,
  input: CreateCookEventInput,
): Promise<CookEvent> {
  const cookEvent: CookEvent = {
    id: generateLocalId('cook-event'),
    householdId: input.householdId,
    mealId: input.mealId,
    decisionId: input.decisionId,
    cookedOn: input.cookedOn,
    wouldRepeat: null,
    // Written explicitly rather than left off the literal, even though
    // `CookEvent.rating` is optional: an absent key and an explicit null
    // both read as "no score", but only one of them is unambiguously true
    // of a row this app just wrote, and the stored null says so to anyone
    // reading the JSON — or the Postgres column — later.
    rating: null,
    createdAt: nowIso(),
  };

  const existing = await tables.cookEvents.list();
  await tables.cookEvents.replaceAll([...existing, cookEvent]);
  return cookEvent;
}

/**
 * The pre-rating write path. Still exported and still the honest way to
 * record a bare "Nog een keer?" answer: 0001_init.sql's `decision_id`
 * comment already leaves room for a future "log a cook manually" flow with
 * no score to offer, and `resolveRepeatSignal` reads wouldRepeat-only
 * events forever. `setCookEventRating` is the path the outcome card takes
 * today.
 */
export async function setCookEventRepeat(
  tables: RepositoryTables,
  cookEventId: CookEventId,
  wouldRepeat: boolean,
): Promise<CookEvent> {
  return updateCookEvent(tables, cookEventId, (event) => ({ ...event, wouldRepeat }));
}

/**
 * Records the cook's score and re-derives `wouldRepeat` from it.
 *
 * `wouldRepeat` is overwritten, never merged: a score landing in the
 * neutral middle band sets it back to null even if an earlier
 * `setCookEventRepeat` had written `true` there. Leaving the older value
 * standing would be invisible in the app — `resolveRepeatSignal` prefers
 * the score — while quietly contradicting it in every query that reads the
 * column directly.
 *
 * An off-scale score is rejected outright rather than clamped or stored.
 * Clamping would invent an opinion nobody expressed (a 7 from an older
 * 1-10 scale is not a 5), and storing it would violate the
 * `check (rating between …)` constraint the moment the row reaches
 * Postgres — better to fail here, at the boundary, than to write a row
 * that can never be pushed.
 */
export async function setCookEventRating(
  tables: RepositoryTables,
  cookEventId: CookEventId,
  rating: number,
): Promise<CookEvent> {
  if (!isValidRating(rating)) {
    throw new Error(`Rating "${rating}" is not a whole number on the rating scale.`);
  }
  return updateCookEvent(tables, cookEventId, (event) => ({
    ...event,
    rating,
    wouldRepeat: toRepeatSignal(rating),
  }));
}

/**
 * Read-modify-write for exactly one cook event, shared by both setters so
 * the "not found" contract and the immutable replace are stated once.
 * `change` must return a new object — nothing here mutates the row it is
 * handed, and the surrounding array is rebuilt by `map` rather than
 * spliced in place.
 */
async function updateCookEvent(
  tables: RepositoryTables,
  cookEventId: CookEventId,
  change: (event: CookEvent) => CookEvent,
): Promise<CookEvent> {
  const existing = await tables.cookEvents.list();
  let updated: CookEvent | undefined;
  const next = existing.map((event) => {
    if (event.id !== cookEventId) {
      return event;
    }
    updated = change(event);
    return updated;
  });
  if (updated === undefined) {
    throw new Error(`No cook event found with id "${cookEventId}".`);
  }
  await tables.cookEvents.replaceAll(next);
  return updated;
}

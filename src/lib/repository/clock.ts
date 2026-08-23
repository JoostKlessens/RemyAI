/**
 * The one place this app reads the real wall clock for persistence
 * timestamps. Deliberately separate from src/domain/date.ts, which is pure
 * calendar math over strings already present in a request and explicitly
 * forbids `Date.now()` for determinism (see that file's header) — nothing
 * in src/domain may import this file. src/lib and src/app are I/O-adjacent
 * by nature and are exactly where "what time is it right now" belongs.
 */

import type { IsoDateString, IsoDateTimeString } from '@/domain/types';

/** Full ISO 8601 timestamp, e.g. "2026-08-22T14:03:00.000Z". */
export function nowIso(): IsoDateTimeString {
  return new Date().toISOString();
}

/** Calendar date only, "YYYY-MM-DD", derived from the real clock. */
export function todayIso(): IsoDateString {
  return nowIso().slice(0, 10);
}

/** "YYYY-MM-DD" for `days` days before today — used to bound "recent" lookback windows (e.g. DecisionRequest.recentDecisions). */
export function daysAgoIso(days: number): IsoDateString {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

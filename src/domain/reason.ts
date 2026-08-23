/**
 * Step 4 of the decision engine: turning a `ReasonCode` into the short,
 * natural Dutch copy shown on the Vanavond screen.
 *
 * Kept deliberately separate from selection logic (scoring.ts,
 * novelty.ts) per the brief: copy should be free to change — a different
 * sentence, a different tone, eventually i18n — without anyone touching
 * *why* a meal was picked. `decide.ts` only ever calls `buildReasonText`
 * with the code it already chose.
 *
 * PD (three rules that override everything) #2: every suggestion carries
 * a stated reason. Every branch below is deliberately concrete ("Klaar in
 * 20 minuten") rather than generic ("Aanbevolen voor jou"), matching
 * docs/DESIGN.md's explicit instruction for this screen.
 *
 * Weekday names come from `dutchWeekdayName` (date.ts), which derives the
 * day purely from a date string in the request — never from
 * `Date.now()` or the host runtime's clock/timezone.
 */

import { dutchWeekdayName } from './date';
import type { IsoDateString, IsoDateTimeString, ReasonCode } from './types';

export interface ReasonContext {
  readonly targetDate: IsoDateString;
  /** Set only when reasonCode is 'saved_this_week' — the save this reason refers to. */
  readonly savedAt: IsoDateTimeString | null;
  /** Set when known — powers the "Klaar in N minuten" copy for 'fits_time'. */
  readonly estimatedMinutes: number | null;
}

function savedThisWeekText(context: ReasonContext): string {
  // Prefer the actual save date so "dit dinsdag" refers to when the
  // household saved the dish, not to today. Falls back to targetDate only
  // if a 'saved_this_week' reason is ever produced without a save context
  // (defensive — decide.ts always supplies one when it picks this code).
  const referenceDate = context.savedAt ?? context.targetDate;
  return `Je bewaarde dit ${dutchWeekdayName(referenceDate)}`;
}

function fitsTimeText(context: ReasonContext): string {
  if (context.estimatedMinutes === null) {
    return 'Snel klaar';
  }
  return `Klaar in ${context.estimatedMinutes} minuten`;
}

/**
 * Every `ReasonCode` gets copy, even codes `decide.ts`'s current scoring
 * model never emits (`requested_repeat`, `fallback`) — `ReasonCode` is a
 * shared, closed contract other producers may use later (e.g. a manual
 * "make this again" flow), and this module's job is to cover the whole
 * vocabulary, not just today's callers.
 */
export function buildReasonText(reasonCode: ReasonCode, context: ReasonContext): string {
  switch (reasonCode) {
    case 'saved_this_week':
      return savedThisWeekText(context);
    case 'not_recent':
      return 'Alweer even geleden';
    case 'fits_time':
      return fitsTimeText(context);
    case 'household_favourite':
      return 'Een favoriet in huis';
    case 'variety':
      return 'Nog niet eerder geprobeerd';
    case 'requested_repeat':
      return 'Je wilde dit nog een keer maken';
    case 'fallback':
      return 'Een optie voor vanavond';
    default: {
      // Exhaustiveness guard: if ReasonCode ever gains a member, this is a
      // compile error at the `default` branch's assignment, not a silent
      // runtime fallback with wrong copy.
      const exhaustiveCheck: never = reasonCode;
      throw new Error(`Unhandled reasonCode: ${String(exhaustiveCheck)}`);
    }
  }
}

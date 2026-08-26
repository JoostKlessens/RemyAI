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

import { joinDutchList } from './dutchText';
import { formatGrade } from './rating';

export interface ReasonContext {
  readonly targetDate: IsoDateString;
  /** Set only when reasonCode is 'saved_this_week' — the save this reason refers to. */
  readonly savedAt: IsoDateTimeString | null;
  /** Set when known — powers the "Klaar in N minuten" copy for 'fits_time'. */
  readonly estimatedMinutes: number | null;
  /** Set only when reasonCode is 'friend_proof' — who cooked it, and what the circle publicly gave it. */
  readonly friendProof: FriendProofContext | null;
}

/**
 * The friends behind a `friend_proof` reason.
 *
 * `grade` IS A PUBLIC VOTE AND NEVER A PRIVATE ONE. It comes from
 * `recipe_ratings`, the vote a person casts knowing it is public, and
 * never from `cook_events.rating`, which is the decision engine's own
 * input and never crosses a household boundary. That split is what makes
 * printing a friend's number safe at all: a grade the proud friend can
 * see is a grade that gets inflated, and an inflated grade feeding the
 * engine would quietly corrupt every later suggestion. Null when the
 * friends cooked it but nobody voted publicly — which is the common case,
 * and reads perfectly well without a number.
 */
export interface FriendProofContext {
  /** Display names, in the order they should be read. */
  readonly friendNames: readonly string[];
  /** The circle's public average, or null when nobody voted. Never `cook_events.rating`. */
  readonly grade: number | null;
}

/**
 * How many friends are named before the rest become "en 2 anderen".
 *
 * Two, because the reason line is two rendered lines at most and a list of
 * five names pushes the dish off the screen it is meant to be selling. The
 * overflow still carries names alongside the count — DESIGN-SOCIAL.md §2.1
 * bans a count *without* a name ("2 vrienden maakten dit"), because an
 * anonymous count is a stranger-aggregate wearing a friendly tone. The
 * persuasive thing is the name.
 */
const FRIEND_PROOF_NAME_LIMIT = 2;

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
 * "Sanne heeft dit ook gemaakt en gaf het een 8,5."
 *
 * THE ONLY REASON THAT IS A FULL SENTENCE, and it takes a full stop where
 * the others take none. That is not an inconsistency: every other reason
 * is a fragment ("Alweer even geleden", "Een favoriet in huis") and a
 * fragment does not take a period, while this one has a subject and a
 * verb. DESIGN-SOCIAL.md §2.1 quotes it with the period for that reason.
 *
 * Dutch agreement is done properly rather than approximated: one friend
 * "heeft ... en gaf", two or more "hebben ... en gaven". A plural average
 * says "gemiddeld" out loud, because it is one — quietly presenting the
 * mean of four opinions as though it were a single verdict is the kind of
 * small dishonesty that makes a number untrustworthy.
 *
 * The no-names branch is defensive only. `scoring.ts` emits this code
 * exclusively when friends cooked the dish, so an empty list means a
 * caller assembled the context wrongly; the copy stays true anyway rather
 * than inventing a name or falling back to a bare count.
 */
function friendProofText(context: ReasonContext): string {
  const proof = context.friendProof;
  if (proof === null || proof.friendNames.length === 0) {
    return 'Iemand uit je kring heeft dit ook gemaakt.';
  }

  const named = proof.friendNames.slice(0, FRIEND_PROOF_NAME_LIMIT);
  const remaining = proof.friendNames.length - named.length;
  const who = joinDutchList(
    remaining === 0 ? named : [...named, remaining === 1 ? 'nog iemand' : `${remaining} anderen`],
  );

  const plural = proof.friendNames.length > 1;
  const cooked = `${who} ${plural ? 'hebben' : 'heeft'} dit ook gemaakt`;
  if (proof.grade === null) {
    return `${cooked}.`;
  }
  const gave = plural ? 'gaven het gemiddeld' : 'gaf het';
  return `${cooked} en ${gave} een ${formatGrade(proof.grade)}.`;
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
    case 'friend_proof':
      return friendProofText(context);
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

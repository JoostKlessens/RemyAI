/**
 * The time cap — "hoe lang mag het recept maximaal duren", as a ladder of
 * five-minute stops instead of three chips.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Ik zou ook willen dat je bovenin geen
 * blokjes hebt voor hoe lang het mag duren maar een icoontje met een klokje
 * en dan 5min interval scrollen van hoe lang het recept maximaal mag duren."
 *
 * WHAT THIS REPLACES, AND THE ARGUMENT IT OVERTURNS. Two surfaces ask this
 * question today and both answer it with a three-chip row:
 * `DecisionFilterBar`'s `TIME_OPTIONS` (Alles / 20 / 30 / 45) and the
 * library's `LIBRARY_TIME_CAP_OPTIONS` (src/domain/recipeSearch.ts). That
 * module's header explicitly rejects what this file builds — "a slider or a
 * stepper would let someone ask for 37 minutes, which nobody has ever
 * wanted, at the cost of a control that is harder to hit than a chip" — and
 * the owner has now asked for exactly that. Two halves of the rejection
 * survive and are honoured here rather than argued with: nobody wants 37
 * minutes, so the ladder is in fives and 37 is not on it; and a control has
 * to be hittable, so the component over this ladder is a 44 pt track a tap
 * lands anywhere on, not a 28 pt thumb you have to find.
 *
 * THE VALUE THIS PRODUCES IS THE FIELD THAT ALREADY EXISTS. A cap is
 * `DecisionFilters.maxMinutes` / `LibrarySearchState.maxMinutes`: a whole
 * number of minutes, or `null` for "no cap stated". Nothing here invents a
 * second vocabulary for a question the codebase already has one for — the
 * ladder is a new way to PICK the value, not a new value. That is why
 * `filterByDecisionFilters` needs no change at all, and why the strictness
 * `isWithinMaxMinutes` applies to an untimed meal (unknown duration loses
 * against an explicit cap) carries over untouched.
 *
 * ---
 *
 * WHERE THE BOUNDS COME FROM. Every one of them is either the owner's
 * number or a number this app already writes; none is invented here.
 *
 * THE STEP IS FIVE because the owner said five. It also happens to be the
 * greatest common divisor of every time value in the product — Household
 * setup writes 15/30/45 (src/app/settings.tsx, `weeknight_time_budget_minutes`
 * since 0001), both filter rows write 20/30/45 — so every cap a household
 * can already hold is on this ladder and the control can show it. That is
 * asserted in tests/timeCap.test.ts rather than assumed: a ladder that
 * could not represent a stored value would silently move it the first time
 * somebody opened the screen.
 *
 * THE FLOOR IS ONE STEP. Five minutes is the narrowest cap the ladder can
 * express, and picking anything else (ten, fifteen) would be a second
 * arbitrary number to defend. A five-minute cap will return almost nothing
 * on a real library, which is a legible, one-drag-recoverable answer and
 * not a reason to forbid asking the question.
 *
 * THE CEILING IS TWO HOURS, AND IT IS THE ONE NUMBER WITH A REAL CHOICE
 * BEHIND IT. It has to be above 45, or the new control expresses nothing
 * the chips could not and the owner's request buys nothing. Two hours is
 * where "hoe lang mag het duren" stops being a weeknight question at all;
 * past it the honest answer is not a bigger number but "geen limiet", which
 * is the very next stop. It also keeps the ladder short enough to swipe:
 * 24 numeric stops plus the open end is 24 increments end to end, against
 * the eighteen `RatingScale` accepted for the same reason (see
 * RATING_ACCESSIBILITY_STEP — ninety swipes is "not an accessible control,
 * it is a technically-conformant one").
 *
 * ---
 *
 * "GEEN LIMIET" IS `null`, AND IT SITS AT THE WIDE END OF THE LADDER.
 *
 * The value is `null` because that is what the two `maxMinutes` fields
 * already mean by it, and because `null` and "a very large cap" are
 * genuinely different questions in this codebase: a null cap leaves meals
 * of unknown duration in the pool, an explicit one removes them
 * (exclusions.ts's `isWithinMaxMinutes`). Representing "no limit" as a big
 * number would silently drop every untimed recipe from a household that
 * asked for no filtering at all.
 *
 * ITS POSITION IS A DELIBERATE DISAGREEMENT WITH recipeSearch.ts, which
 * puts `null` FIRST in its chip list and argues that it "is not a fourth cap
 * but the ABSENCE of one — putting it anywhere else would suggest 'no
 * maximum' is a choice on the same ladder as '20 minutes'". That reasoning
 * is right about a row read left to right, widest first. It inverts on a
 * ladder: here the axis IS width, so the absence of a maximum is the widest
 * thing on it and belongs at the far end, exactly where Household setup
 * already puts its own open-ended bucket ("45+ min", src/app/settings.tsx).
 * The semantic point survives in how it is DRAWN and SPOKEN — the last stop
 * reads as words, never as a number — which is where it always belonged.
 * The rejected alternative was a separate "Alles" button beside the track:
 * it makes the open end unreachable by the gesture and, worse, unreachable
 * by a screen reader's increment, which is the one user for whom stepping
 * off the end of the ladder is the only way there.
 *
 * ---
 *
 * PURE, no I/O, no Dutch. The words live in src/components/timeCapCopy.ts
 * for the reason every `*Copy.ts` module in that directory gives, and the
 * gesture lives in src/components/TimeCapPicker.tsx.
 */

/** A stated maximum in whole minutes, or `null` for "geen limiet" — the same value `DecisionFilters.maxMinutes` holds. */
export type TimeCap = number | null;

/** The owner's interval. Every numeric stop is a multiple of this. */
export const TIME_CAP_STEP_MINUTES = 5;

/** The narrowest cap the ladder expresses — one step, so the floor is not a second number to defend. */
export const TIME_CAP_MIN_MINUTES = 5;

/** The widest numeric cap. Past this the ladder offers `NO_TIME_CAP` rather than a bigger number — see the header. */
export const TIME_CAP_MAX_MINUTES = 120;

/**
 * "Geen limiet", named rather than written as a bare `null` at call sites —
 * the same service `NO_DECISION_FILTERS` and `NO_LIBRARY_SEARCH` perform for
 * their own neutral values, and for the same reason: a reader should not
 * have to remember which of `null` and `0` means "no cap".
 */
export const NO_TIME_CAP: TimeCap = null;

function buildStops(): readonly TimeCap[] {
  const stops: TimeCap[] = [];
  for (let minutes = TIME_CAP_MIN_MINUTES; minutes <= TIME_CAP_MAX_MINUTES; minutes += TIME_CAP_STEP_MINUTES) {
    stops.push(minutes);
  }
  stops.push(NO_TIME_CAP);
  return Object.freeze(stops);
}

/**
 * Every position on the ladder, narrowest first, with "geen limiet" last.
 *
 * Built from the three constants above rather than written out, so a change
 * to the step or either bound cannot leave a hand-maintained list behind —
 * the same posture `ratingScaleCopy.ts` takes toward `src/domain/rating.ts`
 * ("the scale is never written down here").
 */
export const TIME_CAP_STOPS: readonly TimeCap[] = buildStops();

/** The index of the last stop, which is always the "geen limiet" one. */
const LAST_STOP_INDEX = TIME_CAP_STOPS.length - 1;

/**
 * Any number of minutes, put on the nearest stop and pinned inside the
 * ladder.
 *
 * Rounds rather than truncates, and a half-step rounds UP: a finger dragged
 * forward that has covered half a step has visibly asked for the next one,
 * and truncation is how a control comes to feel like it is resisting you.
 *
 * No `toFixed` round-trip, unlike `snapRatingToStep`, and the difference is
 * worth stating so nobody "restores" it: that function accumulates a 0,1
 * step in binary floating point, where 0.1 * 3 is 0.30000000000000004 and a
 * vote can be lost to arithmetic nobody can see. Every value here is a whole
 * multiple of five, which every double represents exactly, so there is
 * nothing to settle in decimal.
 */
export function snapMinutesToTimeCapStep(minutes: number): number {
  const clamped = Math.min(TIME_CAP_MAX_MINUTES, Math.max(TIME_CAP_MIN_MINUTES, minutes));
  const steps = Math.round((clamped - TIME_CAP_MIN_MINUTES) / TIME_CAP_STEP_MINUTES);
  return TIME_CAP_MIN_MINUTES + steps * TIME_CAP_STEP_MINUTES;
}

/**
 * Which stop a cap sits on. Total: every `TimeCap` has an answer, including
 * ones this ladder was not built to hold.
 *
 * A CAP WIDER THAN THE LADDER READS AS "GEEN LIMIET", NEVER AS THE MAXIMUM.
 * `DecisionFilterBar` already ruled on this for the value its chip row
 * cannot represent — "falls back to 'Alles' rather than inventing a selected
 * segment... the control just stops claiming to describe a state it does not
 * own" — and the same answer is the right one here for a stronger reason: a
 * control that showed a stored 180-minute cap as "120 min" would be telling
 * a household it had asked for something narrower than it did, and one drag
 * away from making that false claim true.
 */
export function timeCapStopIndex(cap: TimeCap): number {
  if (cap === null || cap > TIME_CAP_MAX_MINUTES) {
    return LAST_STOP_INDEX;
  }
  return (snapMinutesToTimeCapStep(cap) - TIME_CAP_MIN_MINUTES) / TIME_CAP_STEP_MINUTES;
}

/**
 * The cap at a position on the ladder. Computed rather than read out of
 * `TIME_CAP_STOPS`, so there is no index that can come back `undefined` and
 * no caller that has to handle one.
 *
 * Clamps rather than wrapping or throwing: an index off either end comes
 * from a finger past the end of the track or an increment at the last stop,
 * and both are ordinary gestures that should pin the way every slider a
 * person has ever used does.
 */
export function timeCapAtStopIndex(index: number): TimeCap {
  const clamped = Math.min(LAST_STOP_INDEX, Math.max(0, Math.round(index)));
  if (clamped === LAST_STOP_INDEX) {
    return NO_TIME_CAP;
  }
  return TIME_CAP_MIN_MINUTES + clamped * TIME_CAP_STEP_MINUTES;
}

/** Where along the track a cap sits: 0 at the narrowest, 1 at "geen limiet". */
export function timeCapToTrackFraction(cap: TimeCap): number {
  return timeCapStopIndex(cap) / LAST_STOP_INDEX;
}

/** The cap at a fraction along the track. Out-of-range fractions pin to an end rather than throwing — see `timeCapAtStopIndex`. */
export function trackFractionToTimeCap(fraction: number): TimeCap {
  const clamped = Math.min(1, Math.max(0, fraction));
  return timeCapAtStopIndex(clamped * LAST_STOP_INDEX);
}

/**
 * One assistive-technology increment, up or down.
 *
 * ONE STOP, NOT A COARSER JUMP, which is the opposite of what
 * `RATING_ACCESSIBILITY_STEP` decided for the rating slider — and the
 * difference is the ladder's length rather than a change of mind. That
 * control has ninety steps and swiping them one at a time is a fault; this
 * one has twenty-four, and the step IS the unit the owner asked for. A
 * coarser increment here would mean a screen-reader user could not reach
 * half the values the ladder exists to offer.
 */
export function nudgeTimeCap(cap: TimeCap, direction: 1 | -1): TimeCap {
  return timeCapAtStopIndex(timeCapStopIndex(cap) + direction);
}

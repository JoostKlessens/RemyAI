/**
 * What a household's own cook history says about a recipe, and when the app
 * is allowed to ask for the missing half.
 *
 * TWO OWNER INSTRUCTIONS OF 8 SEPTEMBER 2026, verbatim: "Als je opnieuw het
 * recept kookt, kan je vanaf dan het gemiddelde cijfer laten zien dat wordt
 * gegeven aan het recept?" and "Daarnaast wil ik dat je pas een cijfer kan
 * geven de eerste keer dat je de app opent na 12 uur sinds het afronden van
 * het recept. Anders heb je het waarschijnlijk nog helemaal niet gegeten."
 *
 * PRIVATE HISTORY ONLY. Everything here reads `cook_events.rating` — the
 * household's own score, PD-008's private column. It is deliberately NOT the
 * public `recipe_ratings` vote that Ranglijst ranks on: a household asking
 * "how did WE like this" must not be answered with what strangers thought,
 * and the two scales being identical (both `numeric(4,2)` since 0008) makes
 * that confusion cheap to fall into. `castPublicVote` remains the only writer
 * on the other side and is untouched by this module.
 */
import { isValidRating } from './rating';
import type { CookEvent, MealId } from './types';

/**
 * Twelve hours between finishing a dish and being asked to grade it.
 *
 * THE OWNER'S REASON IS THE WHOLE SPECIFICATION: "anders heb je het
 * waarschijnlijk nog helemaal niet gegeten". Cooking finishes before eating
 * does, and the old flow asked on the "Gemaakt!" card — at the exact moment
 * the pan came off the heat. A grade given then is a grade for the cooking,
 * not for the meal.
 *
 * TWELVE AND NOT TWENTY-FOUR, and the difference matters in one direction
 * only: an evening meal finished at 19:00 becomes askable at 07:00, so the
 * next morning's first open catches it. Twenty-four would push it to the
 * following evening and let a second cook happen first, which is how a
 * backlog starts.
 */
export const RATING_DELAY_HOURS = 12;

const MILLISECONDS_PER_HOUR = 3_600_000;

/**
 * The grade to show for a meal: the mean of every VALID grade its cooks
 * carry, or null when none do.
 *
 * ONE COOK AVERAGES TO ITSELF, which is why this replaces the previous
 * "grade of the latest cook" outright instead of sitting beside it. The owner
 * asked for the average "vanaf dan" — from the second cook on — and a
 * conditional (`count > 1 ? mean : latest`) would be two rules where one does
 * the job identically, plus a seam for them to disagree at.
 *
 * AN UNGRADED COOK IS NOT A ZERO. Skipping the question is a real and
 * supported outcome (`rating` is nullable for exactly that), so an unrated
 * cook is absent from the mean rather than counted as the worst thing anyone
 * ever said about the dish. That is the difference between "we did not say"
 * and "we said it was terrible", and only one of them is true.
 *
 * OFF-SCALE STORED GRADES ARE DROPPED, NOT CLAMPED — rating.ts's own stance,
 * for its own reason: "stored data can be older than the current scale, and
 * silently clamping it would invent an opinion nobody expressed." Averaging
 * makes that worse than it is on a single value, because one clamped outlier
 * quietly moves a number that looks like a measurement.
 */
export function averageCookRating(
  cookEvents: readonly CookEvent[],
  mealId: MealId,
): number | null {
  const grades = cookEvents
    .filter((event) => event.mealId === mealId)
    .map((event) => event.rating)
    .filter((rating): rating is number => typeof rating === 'number' && isValidRating(rating));

  if (grades.length === 0) {
    return null;
  }
  return grades.reduce((total, grade) => total + grade, 0) / grades.length;
}

/**
 * Whether this cook may be asked about yet.
 *
 * THE CLOCK IS `createdAt` AND NOT `cookedOn`, and that is the one measurement
 * this feature rests on. `cookedOn` is a `date` — no time of day — so twelve
 * hours cannot be derived from it at all. `cook_events.created_at` is a
 * `timestamptz` that has existed since 0001, and the row is written by
 * `handleCooked(true)`, the "Gemaakt!" confirmation. It is therefore the
 * moment the cook FINISHED, which is exactly what the owner's sentence names.
 * No migration was needed for any of this; the column was already there and
 * nothing read it.
 *
 * INCLUSIVE AT THE BOUNDARY: a cook that finished exactly twelve hours ago is
 * due. An exclusive comparison would make the first askable instant depend on
 * how a clock tick lands, which is not a distinction anybody can act on.
 *
 * FAILS CLOSED ON AN UNREADABLE TIMESTAMP. A row whose `createdAt` does not
 * parse is never due, so the app declines to ask rather than asking about a
 * cook it cannot date. The opposite default would put a sheet in front of
 * somebody on the strength of a value it could not read.
 */
export function isRatingDue(event: CookEvent, nowMs: number): boolean {
  if (typeof event.rating === 'number') {
    return false;
  }
  const finishedMs = Date.parse(event.createdAt);
  if (Number.isNaN(finishedMs)) {
    return false;
  }
  return nowMs - finishedMs >= RATING_DELAY_HOURS * MILLISECONDS_PER_HOUR;
}

/**
 * The one cook to ask about now, or null.
 *
 * THE OLDEST DUE ONE, so a backlog drains in the order it happened rather
 * than newest-first. Somebody who has not opened the app for a week should be
 * asked about Monday before Thursday: the meals are remembered in that order,
 * and a sheet that jumps around the week is a sheet people dismiss.
 *
 * ONE AT A TIME, and that is a product decision rather than a loop that ran
 * out. The sheet asks about a single dish because the alternative — a queue
 * presented at launch — turns opening the app into a chore, which is the
 * failure mode this whole delay exists to avoid. The rest stay due and the
 * next open takes the next one.
 */
export function selectPendingRating(
  cookEvents: readonly CookEvent[],
  nowMs: number,
): CookEvent | null {
  const due = cookEvents.filter((event) => isRatingDue(event, nowMs));
  if (due.length === 0) {
    return null;
  }
  return due.reduce((oldest, event) =>
    Date.parse(event.createdAt) < Date.parse(oldest.createdAt) ? event : oldest,
  );
}

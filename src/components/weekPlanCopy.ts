/**
 * Dutch copy for the week screen (src/app/deze-week.tsx), sitting on top of
 * the pure plan builder in src/domain/weekPlan.ts. Every sentence that
 * branches on data lives here rather than in the screen, for the reason
 * shoppingListCopy.ts's header already gives: vitest runs in a `node`
 * environment with react-native stubbed, so a sentence written inside a
 * `.tsx` route is a sentence nothing can assert.
 *
 * ---
 *
 * THE EMPTY STATE IS THE ONE THIS SCREEN IS DESIGNED AROUND. A household
 * with nothing planned is the ordinary early state, not a failure to
 * apologise for, so this follows PD-018's posture for the kring exactly:
 * never a zero, never a placeholder row, never a skeleton implying more is
 * coming, and the list ends with its own end line rather than trailing off.
 *
 * ITS TITLE IS DELIBERATELY THE SHOPPING LIST'S TITLE, WORD FOR WORD.
 * `WEEK_PLAN_EMPTY_TITLE` and `shoppingListCopy.ts`'s
 * `NOTHING_PLANNED_COPY.title` describe ONE fact — nothing has an active
 * "deze week" save — because both screens read one query
 * (`listPendingSaves(householdId, 'this_week')`). Two different sentences
 * for one fact is how a household starts believing the two screens know
 * different things; tests/weekPlanCopy.test.ts imports the shopping list's
 * copy and asserts the titles match, so rewording either forces rewording
 * both.
 *
 * THE BODIES DIVERGE, AND THAT IS NOT AN INCONSISTENCY. The shopping
 * list's body promises "…het verschijnt hier vanzelf als
 * boodschappenlijst"; this one promises the dish will stand in the plan.
 * Both point at Mijn recepten, where saving actually happens — neither
 * points at the other screen, because sending an empty plan to an empty
 * list (or back) is a corridor, not an answer.
 *
 * ---
 *
 * NO SENTENCE HERE OFFERS TO REMOVE A DISH FROM THE WEEK, AND THAT IS A
 * FINDING RATHER THAN A STYLE CHOICE. `RemyRepository`
 * (src/lib/repository/types.ts) exposes `createSave` and no way to
 * withdraw, retract or re-intend one; `archiveMeal` removes the dish from
 * the library entirely and does not touch its save. So the only honest
 * exit from this week is cooking the dish — `listPendingSaves` drops a
 * save once its meal has a cook event on or after the save's own date —
 * which is exactly what `WEEK_PLAN_COOKED_NOTE` says, in the indicative
 * ("wat je kookt, verdwijnt") rather than the imperative. A button
 * promising removal would be a lie the persistence layer cannot keep.
 *
 * ---
 *
 * COUNTS ARE ALLOWED HERE, IN SENTENCES, AND ONLY IN SENTENCES. PD-018
 * bans a bare count where a name is the message; these counts are the
 * message — how many dinners are planned, how many rows could not be read
 * — and they are set in full sentences beside the thing they count, never
 * as a numeral hanging in a badge. `describeWeekPlanMealCount` deliberately
 * echoes `describeShoppingListMealCount`'s phrasing family ("…deze week op
 * het menu…") so the same number, read on two screens, reads as the same
 * claim.
 */

import type { WeekPlanEntry } from '@/domain/weekPlan';

// ---------------------------------------------------------------------------
// Fixed lines — the two that make the loop visible, the end line, and the
// note a removed-but-still-planned dish carries.
// ---------------------------------------------------------------------------

/**
 * What this screen is for, in one sentence: the plan is the thing that
 * fills the list. Deliberately states the relationship rather than
 * labelling a button "Boodschappen" and hoping the connection is obvious —
 * the two screens are one loop and only one of them can say so first.
 */
export const WEEK_PLAN_SHOPPING_LINE = 'Wat hier staat, staat op je boodschappenlijst.';

/**
 * The other half of the loop, and the honest answer to "how do I get this
 * off the list". Indicative, never imperative: it describes what already
 * happens (see this file's header on the missing repository capability),
 * so it can be true without a button existing to make it true.
 */
export const WEEK_PLAN_COOKED_NOTE = 'Wat je kookt, verdwijnt vanzelf uit allebei.';

/** PD-018's shape: the list ends, and says so, rather than fading into whitespace. */
export const WEEK_PLAN_END_COPY = 'Dat is alles voor deze week.';

/**
 * A dish the household removed from Mijn recepten whose "deze week" save
 * still stands. `listPendingSaves` never reads `meals.archived_at`, so its
 * ingredients are still being shopped for — see src/domain/weekPlan.ts's
 * header. Saying the awkward thing out loud is the only alternative to
 * this screen quietly disagreeing with the shopping list.
 */
export const WEEK_PLAN_ARCHIVED_NOTE = 'Verwijderd uit Mijn recepten, maar staat nog op je boodschappenlijst.';

// ---------------------------------------------------------------------------
// Empty state — see this file's header for why the title is shared with
// the shopping list and the body is not.
// ---------------------------------------------------------------------------

export const WEEK_PLAN_EMPTY_TITLE = 'Nog niets gepland voor deze week';
export const WEEK_PLAN_EMPTY_BODY = 'Bewaar een recept met “Deze week” in Mijn recepten, dan staat het hier.';

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

/** Singular/plural branch for the header line. Phrased to match `describeShoppingListMealCount`; see the header. */
export function describeWeekPlanMealCount(mealCount: number): string {
  if (mealCount === 1) {
    return '1 recept staat deze week op het menu.';
  }
  return `${mealCount} recepten staan deze week op het menu.`;
}

/**
 * `WeekPlan.unresolvedMealIds` in a sentence: dishes that are planned but
 * whose meal row could not be read back. It states the second half —
 * "telt nog mee op je boodschappenlijst" — because that is precisely why
 * the number in the header can exceed the rows on screen, and a count that
 * does not add up is worse than the awkward fact behind it.
 */
export function describeWeekPlanUnresolvedNote(unresolvedCount: number): string {
  if (unresolvedCount === 1) {
    return '1 gepland recept is niet meer te openen, maar telt nog mee op je boodschappenlijst.';
  }
  return `${unresolvedCount} geplande recepten zijn niet meer te openen, maar tellen nog mee op je boodschappenlijst.`;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/**
 * The row's meta line, or null when there is nothing to say.
 *
 * `Meal.estimatedMinutes` is genuinely nullable — a hand-entered dish, or
 * an import whose caption never stated a time, has none — and null renders
 * as NOTHING, never as "onbekend" and never as a guessed number. Same
 * short "25 min" form `buildFriendRecipeMetaLine` and
 * `buildFriendProofMetaLine` already use, so one dish reads identically
 * wherever it appears.
 *
 * WHAT IS DELIBERATELY ABSENT: a day. `WeekPlanEntry.plannedAt` is right
 * there and it would format cleanly into "dinsdag" — and it would be read
 * as the day the household intends to COOK this, which nothing in the data
 * says. src/domain/weekPlan.ts's header carries the full argument; this is
 * the place it would actually have been violated.
 */
export function describeWeekPlanRowMeta(entry: WeekPlanEntry): string | null {
  const { estimatedMinutes } = entry.meal;
  return estimatedMinutes === null ? null : `${estimatedMinutes} min`;
}

/**
 * The row's spoken label. Says "minuten" where the visible meta says
 * "min", matching `friendFeedPresentation.ts`'s
 * `describeMetaForScreenReader` — an abbreviation a screen reader has to
 * guess at is not the same information the eye gets. No singular branch on
 * the number, for the same reason that module has none: a one-minute
 * recipe is not a case this app has.
 *
 * The archived note is appended rather than left to the visible line,
 * because a fact rendered only in small muted text is a fact a screen
 * reader user does not receive.
 */
export function describeWeekPlanRowAccessibilityLabel(entry: WeekPlanEntry): string {
  const { title, estimatedMinutes } = entry.meal;
  const spoken = estimatedMinutes === null ? title : `${title}, ${estimatedMinutes} minuten`;
  return entry.isArchived ? `${spoken}. ${WEEK_PLAN_ARCHIVED_NOTE}` : spoken;
}

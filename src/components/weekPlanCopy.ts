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
 * THERE IS NOW A WAY OFF THIS WEEK THAT IS NOT COOKING, AND THE COPY HAD TO
 * CHANGE TO SAY SO. This file used to carry a paragraph arguing that no
 * sentence here may offer to remove a dish, because `RemyRepository` had
 * `createSave` and nothing that withdrew one — so a button promising
 * removal would have been a lie the persistence layer could not keep. The
 * seam exists now (`removeSaves`, src/lib/repository/types.ts), so the
 * argument is spent and the sentences below are the ones it was holding
 * back. Leaving the old paragraph in place would have been worse than
 * leaving it out: a stale argument reads as a live constraint.
 *
 * WHAT THE REMOVAL SENTENCES MAY AND MAY NOT PROMISE. `removeSaves` deletes
 * this household's "deze week" saves for one dish. It does NOT archive the
 * meal, so `WEEK_PLAN_REMOVE_EXPLAINER` says the dish stays in Mijn
 * recepten — the single most likely thing to be feared and the single
 * easiest to state. It does NOT demote the save to "ooit" either, so no
 * sentence here may imply the dish will come back around on its own; and
 * because nothing in the app can currently write a save outside the import
 * flow, the confirm step says plainly that this cannot be undone from
 * here. That is the awkward true thing, which is the only kind this file
 * is allowed to say.
 *
 * `WEEK_PLAN_COOKED_NOTE` SURVIVES UNCHANGED, and it is no longer the only
 * exit — it is the one that needs no button. It stays in the indicative
 * ("wat je kookt, verdwijnt") because it still describes something that
 * happens by itself rather than something to do.
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
 *
 * ---
 *
 * NOTHING HERE MENTIONS ARCHIVING ANY MORE. `WEEK_PLAN_ARCHIVED_NOTE` said
 * "Verwijderd uit Mijn recepten, maar staat nog op je boodschappenlijst."
 * — an honest line about a real bug, which `listPendingSaves` now fixes at
 * the repository by dropping an archived dish's saves outright. The
 * sentence is therefore unreachable, and an unreachable apology for a
 * fixed bug is a sentence that will one day be re-enabled by somebody who
 * assumes it is still true.
 */

import type { WeekPlanEntry } from '@/domain/weekPlan';

// ---------------------------------------------------------------------------
// Fixed lines — the two that make the loop visible, and the end line.
// ---------------------------------------------------------------------------

/**
 * What this screen is for, in one sentence: the plan is the thing that
 * fills the list. Deliberately states the relationship rather than
 * labelling a button "Boodschappen" and hoping the connection is obvious —
 * the two screens are one loop and only one of them can say so first.
 */
export const WEEK_PLAN_SHOPPING_LINE = 'Wat hier staat, staat op je boodschappenlijst.';

/**
 * The exit that needs no button. Indicative, never imperative: it describes
 * what already happens when a dish gets cooked, which is why it can sit
 * beside `WEEK_PLAN_REMOVE_LABEL` without the two competing — one is a
 * thing you do, the other is a thing that happens.
 */
export const WEEK_PLAN_COOKED_NOTE = 'Wat je kookt, verdwijnt vanzelf uit allebei.';

/** PD-018's shape: the list ends, and says so, rather than fading into whitespace. */
export const WEEK_PLAN_END_COPY = 'Dat is alles voor deze week.';

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
 * It describes the dish and NOTHING about the removal control beside it.
 * That control is its own button with its own label
 * (`describeWeekPlanRemovalRow`), so folding its state in here would make
 * a screen reader announce the same act twice — once as a property of the
 * dish and once as a button.
 */
export function describeWeekPlanRowAccessibilityLabel(entry: WeekPlanEntry): string {
  const { title, estimatedMinutes } = entry.meal;
  return estimatedMinutes === null ? title : `${title}, ${estimatedMinutes} minuten`;
}

// ---------------------------------------------------------------------------
// "Van deze week af" — the row's second action.
//
// SHAPED AFTER libraryRemovalCopy.ts ON PURPOSE, down to the phase names.
// That module is LIB-04's "Verwijderen" and it settled two questions this
// row asks identically: a destructive-feeling act gets a two-button
// in-place confirm rather than a stacked modal (nothing announces "the row
// is now armed" to a screen reader, and a fast double tap is one clumsy
// gesture away from an accidental commit), and a failed write leaves the
// control itself as the retry. Duplicated rather than shared because the
// two say different things about different acts and that file belongs to
// another surface; the shapes matching is what keeps them comparable.
//
// WHERE IT DIVERGES: there is no `removed` phase here either, but for a
// different reason. LIB-04's sheet closes on success; this row simply
// stops existing, because the dish leaves the plan the moment the write
// lands.
// ---------------------------------------------------------------------------

/** The action, offered while the dish is still standing in the week. */
export const WEEK_PLAN_REMOVE_LABEL = 'Van deze week af';

/**
 * STATES BOTH CONSEQUENCES AND THEN THE RELIEF, in that order. The two
 * consequences are the whole point of this screen's loop (the plan and the
 * list are one fact), and the third sentence answers the fear the label
 * creates: "verwijderen" elsewhere in this app means removing a dish from
 * Mijn recepten, and this is emphatically not that.
 */
export const WEEK_PLAN_REMOVE_EXPLAINER =
  'Dit gerecht verdwijnt uit je week en van je boodschappenlijst. Het blijft in Mijn recepten staan.';

/** The confirming control's own label — the act, restated as the thing the next tap will actually do. */
export const WEEK_PLAN_REMOVE_CONFIRM_LABEL = 'Ja, van deze week af';

/**
 * The one genuinely awkward sentence on this screen, and it is here
 * because it is true: the only code path in the app that creates a save is
 * the import confirmation screen, so a dish taken off this week cannot be
 * put back on it from anywhere. Softening that to "je kunt het later weer
 * plannen" would be a promise no screen can keep today.
 */
export const WEEK_PLAN_REMOVE_CONFIRM_EXPLAINER =
  'Weet je het zeker? Je kunt dit gerecht daarna niet terugzetten op deze week.';

/** The way back, always offered beside the confirm — never a timeout, never a tap elsewhere. */
export const WEEK_PLAN_REMOVE_CANCEL_LABEL = 'Annuleren';

/**
 * Rendered in `danger` beneath the control after a failed write. Word for
 * word `LIBRARY_REMOVE_FAILED_NOTE`, and it is true here for a stronger
 * reason: `removeSaves` is one read and one write, so a failure leaves
 * every save exactly where it was — there is no partial removal to warn
 * about.
 */
export const WEEK_PLAN_REMOVE_FAILED_NOTE = 'Niet gelukt. Er is niets veranderd. Probeer het nog eens.';

/** Spoken once the row is already gone, so it names the dish the list no longer shows. */
export function describeWeekPlanRemovedAnnouncement(dishTitle: string): string {
  return `${dishTitle} staat niet meer op deze week.`;
}

export const WEEK_PLAN_REMOVE_FAILED_ANNOUNCEMENT = 'Niet gelukt. Er is niets veranderd.';

export type WeekPlanRemovalPhase = 'idle' | 'confirming' | 'pending' | 'failed';

export interface WeekPlanRemovalState {
  readonly phase: WeekPlanRemovalPhase;
}

export type WeekPlanRemovalEvent =
  | { readonly type: 'reset' }
  | { readonly type: 'request-removal' }
  | { readonly type: 'cancel-removal' }
  | { readonly type: 'confirm-removal' }
  | { readonly type: 'removal-failed' };

export const INITIAL_WEEK_PLAN_REMOVAL: WeekPlanRemovalState = { phase: 'idle' };

/**
 * Every out-of-order event returns the SAME state object rather than a new
 * equal one, matching `reduceLibraryRemoval`: a second "confirm" while a
 * write is already in flight must not fire `removeSaves` twice, and a
 * "cancel" once the write landed has nothing left to cancel — the row is
 * gone by then.
 */
export function reduceWeekPlanRemoval(
  state: WeekPlanRemovalState,
  event: WeekPlanRemovalEvent,
): WeekPlanRemovalState {
  switch (event.type) {
    case 'reset':
      // Unconditional: arming one row and then reaching for a different one
      // must never leave the first mid-confirm behind you.
      return INITIAL_WEEK_PLAN_REMOVAL;
    case 'request-removal':
      return state.phase === 'idle' || state.phase === 'failed' ? { phase: 'confirming' } : state;
    case 'cancel-removal':
      return state.phase === 'confirming' || state.phase === 'failed' ? { phase: 'idle' } : state;
    case 'confirm-removal':
      return state.phase === 'confirming' ? { phase: 'pending' } : state;
    case 'removal-failed':
      return state.phase === 'pending' ? { phase: 'failed' } : state;
    default: {
      const exhaustiveCheck: never = event;
      throw new Error(`Unhandled WeekPlanRemovalEvent: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

export interface WeekPlanRemovalRowCopy {
  readonly label: string;
  readonly explainer: string;
  readonly accessibilityLabel: string;
  /**
   * Whether `explainer` is drawn on screen as well as spoken.
   *
   * FALSE WHILE IDLE, AND THAT IS NOT THE SAME AS HIDING IT. The
   * accessibility label always carries the consequence, because a screen
   * reader user has to hear it BEFORE the tap; the eye gets it at the
   * moment it becomes a question, when the control turns into "Ja, van deze
   * week af". Painting the full consequence under every row of a six-dinner
   * week would bury the dinners under the warnings — which is the same
   * reason PD-018 bans a placeholder row: the screen is for the plan.
   */
  readonly showExplainer: boolean;
  readonly disabled: boolean;
  readonly errorNote: string | null;
  /**
   * Present only while `phase === 'confirming'`: the control's own action
   * becomes the confirm, and this is the second action beside it. Null in
   * every other phase, which is what lets the row draw a single Pressable
   * the rest of the time.
   */
  readonly cancelLabel: string | null;
  readonly cancelAccessibilityLabel: string | null;
}

/**
 * The dish title is woven into every accessibility label because this
 * control repeats down a list. "Van deze week af" spoken on its own, on
 * row four of six, names no dish — and the one thing a person must not be
 * unsure about before confirming is WHICH dinner they are cancelling.
 */
function withDish(label: string, dishTitle: string, explainer: string): string {
  return `${label}: ${dishTitle}. ${explainer}`;
}

export function describeWeekPlanRemovalRow(
  state: WeekPlanRemovalState,
  dishTitle: string,
): WeekPlanRemovalRowCopy {
  if (state.phase === 'confirming' || state.phase === 'pending') {
    return {
      label: WEEK_PLAN_REMOVE_CONFIRM_LABEL,
      explainer: WEEK_PLAN_REMOVE_CONFIRM_EXPLAINER,
      accessibilityLabel: withDish(WEEK_PLAN_REMOVE_CONFIRM_LABEL, dishTitle, WEEK_PLAN_REMOVE_CONFIRM_EXPLAINER),
      showExplainer: true,
      disabled: state.phase === 'pending',
      errorNote: null,
      cancelLabel: state.phase === 'confirming' ? WEEK_PLAN_REMOVE_CANCEL_LABEL : null,
      cancelAccessibilityLabel:
        state.phase === 'confirming' ? `${WEEK_PLAN_REMOVE_CANCEL_LABEL}, ${dishTitle} blijft op deze week` : null,
    };
  }

  return {
    label: WEEK_PLAN_REMOVE_LABEL,
    explainer: WEEK_PLAN_REMOVE_EXPLAINER,
    accessibilityLabel: withDish(WEEK_PLAN_REMOVE_LABEL, dishTitle, WEEK_PLAN_REMOVE_EXPLAINER),
    showExplainer: false,
    disabled: false,
    errorNote: state.phase === 'failed' ? WEEK_PLAN_REMOVE_FAILED_NOTE : null,
    cancelLabel: null,
    cancelAccessibilityLabel: null,
  };
}

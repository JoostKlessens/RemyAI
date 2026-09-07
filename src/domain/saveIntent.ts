/**
 * WHAT AN IMPORT COMMITS A DISH TO, now that nobody is asked.
 *
 * ============================================================================
 * WHY THIS MODULE EXISTS
 * ============================================================================
 *
 * Until 2026-09-06 the answer to "wanneer wil je dit koken?" came from a
 * bottom sheet (`src/components/SaveIntentSheet.tsx`) that every import had
 * to pass through, and `src/app/import/confirm.tsx` simply forwarded
 * whichever row the household tapped. The owner asked for that question to
 * go, and the moment it went, the answer stopped being a person's and became
 * the product's — which is exactly the kind of answer that must live
 * somewhere a test can read it.
 *
 * A constant written inline in `confirm.tsx` would not have been. Route
 * modules under `src/app` cannot be imported by the test suite at all (they
 * pull `react-native-safe-area-context`, whose published source is
 * Flow-typed and dies in Vite's parser), which is the same wall
 * `libraryTileActionRows.ts` and every `*Copy.ts` module in `src/components`
 * were extracted to get around. A default that decides what a household is
 * offered for dinner is not a line to leave on the wrong side of it.
 *
 * ============================================================================
 * WHY `'someday'` AND NOT `'this_week'`
 * ============================================================================
 *
 * PD-004a is the binding decision and it says two things. The one everybody
 * quotes is that there is no bookmark-only option; the one that decides THIS
 * value is the sentence underneath it — *"if I put something in my list, it
 * must be able to come around at some point"*. Both surviving intents keep
 * that promise, so the choice between them is not about PD-004a's floor but
 * about which claim is HONEST at the moment of import.
 *
 * `'this_week'` is a claim about tonight. It carries
 * `SAVED_THIS_WEEK_BOOST` (100, scoring.ts) — by a wide margin the largest
 * number in the engine, more than every organic factor combined — and it
 * puts the dish on `deze-week.tsx` and its ingredients on the shopping list.
 * Writing that for every import would mean the twentieth TikTok somebody
 * saved on a Sunday afternoon arrives claiming to be Tuesday's dinner, and
 * the week screen becomes a list of everything recently pasted. That is the
 * junk drawer PD-004 exists to prevent, wearing a schedule.
 *
 * `'someday'` claims only what is true: the household liked this enough to
 * keep it, and it will come around. `scoring.ts`'s `SOMEDAY_SAVE_*` aging
 * boost is what makes "will" load-bearing rather than hopeful — 5 points on
 * the day it is saved, +10 per full week waited, capped at 45, which
 * `scoring.ts` proves exceeds the highest score an ordinary never-cooked
 * competitor can reach. So an imported dish is guaranteed to win its novelty
 * tier within a bounded time, and never outranks something the household
 * explicitly asked for this week.
 *
 * WHAT IS ACTUALLY LOST, stated plainly rather than glossed: a household
 * that imports a recipe INTENDING to cook it tonight can no longer say so
 * during the import. They say it afterwards, in Mijn recepten — LIB-04 put a
 * "Deze week" row on the tile's long-press sheet, and the recipe screen
 * (`src/app/recipe/[mealId].tsx`) carries the same control as a button. One
 * extra act, on a surface that exists, in exchange for never lying about the
 * other nineteen saves.
 *
 * ============================================================================
 * WHAT THIS MODULE IS NOT
 * ============================================================================
 *
 * It is not a place to put "what does the UI offer". Nothing offers a choice
 * any more; there is one value and one predicate about the union. If a
 * second surface ever needs a different default (a friend's shared recipe
 * saved into your own library, say), it gets its own named constant beside
 * this one rather than a parameter on this one — a default with an argument
 * is a question again, and the question is what the owner removed.
 */

import type { SaveIntent } from './types';

/**
 * Every value of `SaveIntent`, as a runtime array.
 *
 * A literal list rather than a derivation, for the reason `ICON_NAMES` and
 * `DISH_TAGS` give for theirs: a union cannot be iterated at runtime, and an
 * invariant test that walks every member is the only thing that can catch
 * "somebody added an intent and forgot to decide whether it keeps PD-004a's
 * promise". The compiler holds the other half — the `satisfies` below fails
 * if this list ever names something the union does not.
 */
export const SAVE_INTENTS = ['this_week', 'someday', 'none'] as const satisfies readonly SaveIntent[];

/**
 * The intent `src/app/import/confirm.tsx` writes for every recipe that
 * finishes the import flow. See this file's header for why it is `'someday'`
 * and what that costs.
 *
 * Typed as `SaveIntent` rather than left as the literal `'someday'` on
 * purpose: the type is the contract the repository and the engine share, and
 * a caller should not be able to narrow on this constant's exact value and
 * quietly acquire a dependency on which of the two schedulable intents it
 * happens to be today.
 */
export const IMPORT_DEFAULT_SAVE_INTENT: SaveIntent = 'someday';

/**
 * Whether the decision engine is GUARANTEED to eventually offer a dish saved
 * with this intent — PD-004a's promise, expressed as a predicate rather than
 * as a sentence in a document.
 *
 * `'this_week'` and `'someday'` both qualify, by two different mechanisms:
 * the first through `SAVED_THIS_WEEK_BOOST`, the second through the
 * `SOMEDAY_SAVE_*` aging boost whose cap is proven in `scoring.ts` to clear
 * every organic competitor. `'none'` does not, and cannot: nothing in
 * `scoring.ts` reads it, `DecisionRequest` has no bucket for it, and
 * `recipeScheduling.ts` renders it as `geen_planning`. It is the graveyard
 * PD-004a named, kept in the union only because `saves.intent`'s CHECK
 * constraint still accepts legacy rows that carry it.
 *
 * IT EXISTS TO BE ASSERTED AGAINST `IMPORT_DEFAULT_SAVE_INTENT`, which is
 * the one call that makes it more than a lookup table: the day somebody
 * changes that default, the test that walks this predicate is what says
 * whether PD-004a still holds. A screen may also read it, but none does
 * today and none needs to — every surface that writes a save writes a
 * literal intent it already knows is schedulable.
 */
export function guaranteesEventualSuggestion(intent: SaveIntent): boolean {
  switch (intent) {
    case 'this_week':
    case 'someday':
      return true;
    case 'none':
      return false;
  }
}

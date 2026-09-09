/**
 * The words and the states around `Bewaren` on the shared recipe screen
 * (`/friends/[feedItemId]`) — DESIGN-SOCIAL.md §3.3 and §4.3.
 *
 * These live in a `.ts` under `src/components` rather than inline in the
 * route module for this directory's standing reason, stated at length in
 * `importSaveCopy.ts` and `libraryTileActionCopy.ts`: a route module cannot
 * be imported by the test suite, so a sentence written in one is a sentence
 * nothing can assert on, and a state machine written in one is a machine
 * nothing can drive. `sendRecipeSheetCopy.ts` carries `reduceSendSheet`
 * beside its strings for the same reason; this module carries
 * `reduceSharedRecipeSave` beside these.
 *
 * WHAT §3.3 FIXES AND THIS MODULE KEEPS. The primary reads `Bewaren`; after
 * the sheet resolves and the write lands it reads `Bewaard`, drawn as
 * `positiveMuted` fill with `positive` text — a completed action, the same
 * pair `RecipeTile`'s badge and `FriendProofCard`'s chip use. There is no
 * third option and no lighter reaction.
 *
 * WHAT IS NOT IN §3.3 AND WHY IT IS HERE ANYWAY. Two states the design did
 * not draw because the design assumed the write lands: a canonical recipe
 * that is gone by the time somebody taps (withdrawn, or deleted under the
 * share — `meals.recipe_id` is `on delete set null`), and a write that
 * fails. Each gets one line under the button, in the same register
 * `useOpenExternalLink`'s "Openen lukte niet" uses. A third line covers a
 * dish that never had a canonical recipe at all — a friend's hand-typed
 * meal — which cannot be copied by this path and is told so rather than
 * offered a button that cannot land.
 */

import type { RecipeCopyOutcome } from '@/lib/saveRecipeCopy';

// ---------------------------------------------------------------------------
// The control
// ---------------------------------------------------------------------------

/** §3.3's primary. "Bewaren", never "Opslaan" — `importSaveCopy.ts` carries the argument. */
export const SHARED_RECIPE_SAVE_LABEL = 'Bewaren';

/** Names the destination, because the button alone does not — same shape as `IMPORT_SAVE_ACCESSIBILITY_LABEL`. */
export const SHARED_RECIPE_SAVE_ACCESSIBILITY_LABEL = 'Bewaar dit recept in Mijn recepten';

/** §3.3's completed state, verbatim. */
export const SHARED_RECIPE_SAVED_LABEL = 'Bewaard';

export const SHARED_RECIPE_SAVED_ACCESSIBILITY_LABEL = 'Bewaard in Mijn recepten';

// ---------------------------------------------------------------------------
// The three lines under it
// ---------------------------------------------------------------------------

/**
 * The button stays live and is its own retry, so the line says so. Same
 * two sentences `useOpenExternalLink` prints for the original-post link on
 * the same screen, so a failure reads the same wherever it lands.
 */
export const SHARED_RECIPE_SAVE_FAILED_NOTE = 'Bewaren lukte niet. Probeer het opnieuw.';

/**
 * Names the recipe as gone and blames nobody — not the reader, not the
 * friend who sent it. A retry would find the same absence, so the button
 * is disabled beside this rather than left inviting one.
 */
export const SHARED_RECIPE_SAVE_NOT_FOUND_NOTE = 'Dit recept is niet meer te vinden, dus bewaren lukte niet.';

/**
 * "Nog niet", deliberately: nothing failed. A friend's hand-entered dish
 * has no canonical row for this path to copy, and the path that would copy
 * their own version is a separate change. The sentence must stay true when
 * that change lands — it says what is missing today, not that it cannot be.
 */
export const SHARED_RECIPE_SAVE_UNAVAILABLE_NOTE =
  'Dit gerecht heeft geen bronrecept in Remy en kan nog niet bewaard worden.';

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

/**
 * Six states, one per thing the thumb zone can show. `choosing` is the
 * sheet being up; `saving` is the write in flight, which the button shows
 * as its spinner rather than as a seventh word.
 */
export type SharedRecipeSaveState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'choosing' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'failed' };

export type SharedRecipeSaveEvent =
  | { readonly type: 'save-pressed' }
  | { readonly type: 'sheet-dismissed' }
  | { readonly type: 'intent-chosen' }
  | { readonly type: 'write-settled'; readonly outcome: RecipeCopyOutcome };

export const IDLE_SHARED_RECIPE_SAVE: SharedRecipeSaveState = { kind: 'idle' };

/**
 * Pure. An event that does not belong to the current state leaves it
 * unchanged rather than being applied — a late `write-settled` after the
 * screen was reset, or a tap on a control that is no longer a button, must
 * not move anything. `saved` and `not_found` are terminal for a tap;
 * `failed` is not, because the button is its own retry.
 */
export function reduceSharedRecipeSave(
  state: SharedRecipeSaveState,
  event: SharedRecipeSaveEvent,
): SharedRecipeSaveState {
  switch (event.type) {
    case 'save-pressed':
      return state.kind === 'idle' || state.kind === 'failed' ? { kind: 'choosing' } : state;
    case 'sheet-dismissed':
      return state.kind === 'choosing' ? { kind: 'idle' } : state;
    case 'intent-chosen':
      return state.kind === 'choosing' ? { kind: 'saving' } : state;
    case 'write-settled':
      return state.kind === 'saving' ? settle(event.outcome) : state;
  }
}

function settle(outcome: RecipeCopyOutcome): SharedRecipeSaveState {
  switch (outcome.kind) {
    case 'saved':
      return { kind: 'saved' };
    case 'not_found':
      return { kind: 'not_found' };
    case 'failed':
      return { kind: 'failed' };
  }
}

// ---------------------------------------------------------------------------
// What the thumb zone draws
// ---------------------------------------------------------------------------

export type SharedRecipeSaveControl =
  | {
      readonly kind: 'button';
      readonly label: string;
      readonly disabled: boolean;
      readonly loading: boolean;
      /** The line under the button, or null for nothing at all — never an empty placeholder. */
      readonly note: string | null;
    }
  | { readonly kind: 'completed'; readonly label: string };

type SharedRecipeSaveButton = Extract<SharedRecipeSaveControl, { readonly kind: 'button' }>;

const LIVE_BUTTON: SharedRecipeSaveButton = {
  kind: 'button',
  label: SHARED_RECIPE_SAVE_LABEL,
  disabled: false,
  loading: false,
  note: null,
};

/**
 * One state to one drawing. `hasCanonicalRecipe` is the fact the screen
 * holds before any tap — a card whose sender's dish has no
 * `canonicalRecipeId` — and it wins over the state, because a state
 * machine that was never allowed to start has nothing truer to say.
 */
export function describeSharedRecipeSaveControl(
  state: SharedRecipeSaveState,
  hasCanonicalRecipe: boolean,
): SharedRecipeSaveControl {
  if (!hasCanonicalRecipe) {
    return { ...LIVE_BUTTON, disabled: true, note: SHARED_RECIPE_SAVE_UNAVAILABLE_NOTE };
  }
  switch (state.kind) {
    case 'idle':
    case 'choosing':
      return LIVE_BUTTON;
    case 'saving':
      return { ...LIVE_BUTTON, loading: true };
    case 'saved':
      return { kind: 'completed', label: SHARED_RECIPE_SAVED_LABEL };
    case 'not_found':
      return { ...LIVE_BUTTON, disabled: true, note: SHARED_RECIPE_SAVE_NOT_FOUND_NOTE };
    case 'failed':
      return { ...LIVE_BUTTON, note: SHARED_RECIPE_SAVE_FAILED_NOTE };
  }
}

/**
 * The spoken half of a settled write. `SaveIntentSheet` already announces
 * the chosen row the instant it is tapped — before the write — so this is
 * what corrects that sentence when the write does not land, and confirms
 * it when it does. Same words the screen prints, never a second phrasing.
 */
export function describeSharedRecipeSaveAnnouncement(outcome: RecipeCopyOutcome): string {
  switch (outcome.kind) {
    case 'saved':
      return SHARED_RECIPE_SAVED_ACCESSIBILITY_LABEL;
    case 'not_found':
      return SHARED_RECIPE_SAVE_NOT_FOUND_NOTE;
    case 'failed':
      return SHARED_RECIPE_SAVE_FAILED_NOTE;
  }
}

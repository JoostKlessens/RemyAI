/**
 * Copy and state for "Verwijderen" — LIB-04's third row on the Bibliotheek
 * tile's long-press sheet (src/components/LibraryTileActionSheet.tsx),
 * alongside "Sturen" (libraryTileActionCopy.ts) and "Deel deze niet"
 * (also libraryTileActionCopy.ts). A module of its own for the same reason
 * sendRecipeSheetCopy.ts sits apart from libraryTileActionCopy.ts even
 * though both are launched from the same sheet: this row's state machine —
 * idle, confirming, pending, failed — is a self-contained contract nothing
 * else on the sheet shares, and folding a third state machine into a file
 * already carrying one keeps neither short nor legible. It also keeps
 * `tests/libraryTileActionCopy.test.ts` (the cook-proof exclusion's own
 * contract tests, held to 0009's column comment) untouched by a change with
 * nothing to do with cook proof.
 *
 * WHY THE ACTION LIVES INSIDE THE EXISTING SHEET, NOT A SECOND MODAL. The
 * codebase already has exactly one destructive-adjacent confirm pattern
 * worth copying: the exclusion row itself morphs in place between
 * "Deel deze niet" and "Uitgezonderd van delen · Weer delen" rather than
 * opening anything — LibraryTileActionSheet.tsx's own header calls that "a
 * control you can put back has to show you it moved". This row does the
 * same thing for a stronger reason: `openSendSheet`'s comment in
 * (tabs)/recipes.tsx already rejects stacking a second sheet on this one
 * ("Two stacked modals over one dish means two scrims and a back gesture
 * whose meaning depends on which one is on top"). A remove confirmation is
 * the same shape of problem, so it gets the same answer — the row itself
 * becomes the question, in place, with an explicit way back.
 *
 * WHY "ARE YOU SURE" IS TWO BUTTONS, NOT A SECOND TAP ON THE SAME ROW. A
 * tap-again-to-confirm pattern (the row silently becomes armed, a second
 * tap fires) was considered and rejected: nothing on screen would announce
 * that the row's meaning just changed to a screen reader user beyond the
 * label itself, and a fast double-tap — exactly the gesture RecipeTile
 * already listens for as a long-press's sibling elsewhere in this app —
 * makes an accidental delete one clumsy tap away. Two named actions
 * ("Ja, verwijderen" / "Annuleren"), each with its own accessible label,
 * is the pattern PD-005's consent surfaces already use for an irreversible-
 * feeling choice: state the consequence, then offer two ways to answer it,
 * neither of which is silence.
 *
 * NO LOADING PHASE, UNLIKE `CookProofExclusionState`. That state machine
 * starts in `loading` because it has to READ a value before it can show
 * one (`getMealCookProofExclusion`). This one has nothing to read: the
 * meal is already on screen, unarchived by construction (an archived meal
 * cannot appear in `rows` at all — `listHouseholdMeals` filters
 * `archivedAt === null`), so "Verwijderen" starts at `idle` the instant the
 * sheet opens, every time.
 *
 * WHAT SUCCESS DOES NOT NEED A PHASE FOR. There is no `removed` phase
 * below, on purpose: a successful archive closes the whole action sheet
 * (see (tabs)/recipes.tsx) rather than leaving this row to display a
 * "verwijderd" state nobody would see — the sheet is gone by the time any
 * such state could render.
 */

// ---------------------------------------------------------------------------
// The row's sentences
// ---------------------------------------------------------------------------

/** The action, offered while the dish is still in the library. */
export const LIBRARY_REMOVE_LABEL = 'Verwijderen';

/**
 * STATES WHAT HAPPENS AND WHAT SURVIVES, in that order — the same "consequence
 * in full sentences before the act" PD-005's consent copy already commits
 * to. The second sentence is the one this row must never omit: archiving
 * (see `archiveMeal` on `RemyRepository`, src/lib/repository/types.ts) never
 * touches cook history, and a household deciding to stop seeing a dish
 * should not have to wonder whether that also erases what they already
 * cooked from it.
 */
export const LIBRARY_REMOVE_EXPLAINER =
  'Dit gerecht verdwijnt uit Mijn recepten. Wat je ermee kookte, blijft gewoon meetellen.';

/** The confirming row's own label — the act, restated as the thing a second tap will actually do. */
export const LIBRARY_REMOVE_CONFIRM_LABEL = 'Ja, verwijderen';

export const LIBRARY_REMOVE_CONFIRM_EXPLAINER = 'Weet je het zeker? Dit gerecht verdwijnt uit je lijst.';

/** The way back, always offered beside the confirm — never a timeout, never a tap elsewhere. */
export const LIBRARY_REMOVE_CANCEL_LABEL = 'Annuleren';

/** Rendered in `danger` beneath the row after a failed write — states the rollback, matching COOK_PROOF_WRITE_FAILED_NOTE's shape. */
export const LIBRARY_REMOVE_FAILED_NOTE = 'Niet gelukt. Er is niets veranderd. Probeer het nog eens.';

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

/** Spoken once the sheet has already closed, so it names the dish the closed sheet no longer shows. */
export function describeLibraryRemovedAnnouncement(dishTitle: string): string {
  return `${dishTitle} is verwijderd uit Mijn recepten.`;
}

export const LIBRARY_REMOVE_FAILED_ANNOUNCEMENT = 'Niet gelukt. Er is niets veranderd.';

// ---------------------------------------------------------------------------
// The state the copy is a function of
// ---------------------------------------------------------------------------

export type LibraryRemovalPhase = 'idle' | 'confirming' | 'pending' | 'failed';

export interface LibraryRemovalState {
  readonly phase: LibraryRemovalPhase;
}

export type LibraryRemovalEvent =
  | { readonly type: 'reset' }
  | { readonly type: 'request-removal' }
  | { readonly type: 'cancel-removal' }
  | { readonly type: 'confirm-removal' }
  | { readonly type: 'removal-failed' };

export const INITIAL_LIBRARY_REMOVAL: LibraryRemovalState = { phase: 'idle' };

/**
 * Every out-of-order event returns the SAME state object rather than a new
 * equal one, matching `reduceCookProofExclusion`'s own posture: a second
 * "confirm" while a write is already in flight must not fire the repository
 * call twice, and a "cancel" once the write already landed has nothing left
 * to cancel — the sheet has closed by then regardless (see this file's
 * header on why there is no `removed` phase to guard).
 */
export function reduceLibraryRemoval(state: LibraryRemovalState, event: LibraryRemovalEvent): LibraryRemovalState {
  switch (event.type) {
    case 'reset':
      // Unconditional, the same posture as `reduceCookProofExclusion`'s
      // 'load-started': a freshly opened sheet — this dish or the next one
      // long-pressed after it — always starts from "Verwijderen" idle,
      // never mid-confirm on a dish the user is no longer looking at.
      return INITIAL_LIBRARY_REMOVAL;
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
      throw new Error(`Unhandled LibraryRemovalEvent: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// State -> row
// ---------------------------------------------------------------------------

export interface LibraryRemovalRowCopy {
  readonly label: string;
  readonly explainer: string;
  readonly accessibilityLabel: string;
  readonly disabled: boolean;
  readonly errorNote: string | null;
  /**
   * Present only while `phase === 'confirming'`: the row's own action
   * becomes the confirm ("Ja, verwijderen"), and this is the second,
   * separate action beside it. Null in every other phase, which is what
   * lets the sheet render a single Pressable for this row the rest of the
   * time — see LibraryTileActionSheet.tsx's `ActionRow`.
   */
  readonly cancelLabel: string | null;
  readonly cancelAccessibilityLabel: string | null;
}

function withExplainer(label: string, explainer: string): string {
  return `${label}: ${explainer}`;
}

export function describeLibraryRemovalRow(state: LibraryRemovalState): LibraryRemovalRowCopy {
  if (state.phase === 'confirming') {
    return {
      label: LIBRARY_REMOVE_CONFIRM_LABEL,
      explainer: LIBRARY_REMOVE_CONFIRM_EXPLAINER,
      accessibilityLabel: withExplainer(LIBRARY_REMOVE_CONFIRM_LABEL, LIBRARY_REMOVE_CONFIRM_EXPLAINER),
      disabled: false,
      errorNote: null,
      cancelLabel: LIBRARY_REMOVE_CANCEL_LABEL,
      cancelAccessibilityLabel: `${LIBRARY_REMOVE_CANCEL_LABEL}, verwijderen niet doorzetten`,
    };
  }

  if (state.phase === 'pending') {
    return {
      label: LIBRARY_REMOVE_CONFIRM_LABEL,
      explainer: LIBRARY_REMOVE_CONFIRM_EXPLAINER,
      accessibilityLabel: withExplainer(LIBRARY_REMOVE_CONFIRM_LABEL, LIBRARY_REMOVE_CONFIRM_EXPLAINER),
      disabled: true,
      errorNote: null,
      cancelLabel: null,
      cancelAccessibilityLabel: null,
    };
  }

  const errorNote = state.phase === 'failed' ? LIBRARY_REMOVE_FAILED_NOTE : null;
  return {
    label: LIBRARY_REMOVE_LABEL,
    explainer: LIBRARY_REMOVE_EXPLAINER,
    accessibilityLabel: withExplainer(LIBRARY_REMOVE_LABEL, LIBRARY_REMOVE_EXPLAINER),
    disabled: false,
    errorNote,
    cancelLabel: null,
    cancelAccessibilityLabel: null,
  };
}

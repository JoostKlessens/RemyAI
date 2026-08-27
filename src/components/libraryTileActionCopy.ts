/**
 * Copy and state for the Bibliotheek tile's action sheet
 * (src/components/LibraryTileActionSheet.tsx). Today it holds exactly one
 * row — "Deel deze niet", DESIGN-SOCIAL.md §3.5 / PD-015, backed by
 * `meals.excluded_from_cook_proof` from
 * supabase/migrations/0009_cook_proof_and_sends.sql.
 *
 * WHY A MODULE OF ITS OWN, the allergenTaggingCopy.ts argument again:
 * tests run in vitest's `node` environment with react-native stubbed
 * (tests/stubs/react-native.ts), so a sentence written inside a `.tsx` is
 * a sentence nothing can assert. That matters more here than anywhere
 * else in the app, because this copy is held to a contract stored in a
 * file no UI reviewer opens — 0009's column comment. It commits to three
 * things, and each one is carried by a specific string below:
 *
 *   1. The exclusion silences all cook proof for this meal, PAST INCLUDED,
 *      at the next read → `..._EXPLAINER`'s "ook niet de keren die al
 *      geweest zijn". Someone reaching for this control is usually
 *      reaching for a cook that has already happened; a row promising only
 *      future silence would be answering a different question.
 *   2. It is INDEPENDENT of `households.share_cooks_with_friends` and
 *      unaffected by toggling it → `COOK_PROOF_SCOPE_NOTE`, first clause.
 *   3. It does NOT block a directed send (`recipe_shares`), a separate
 *      explicit act → `COOK_PROOF_SCOPE_NOTE`, second clause. This is the
 *      one the wording most wants to get wrong: "deel deze niet" sounds
 *      like it should cover sending, and it does not.
 *
 * WHAT IS DELIBERATELY NOT SAID HERE. 0009's comment carries a fourth
 * clause — the exclusion does not touch `recipe_ratings` votes. It is
 * absent from this sheet on purpose: there is no vote control anywhere on
 * a Bibliotheek tile, so a sentence about votes would answer a question
 * this surface never let the user ask, and would push the two sentences
 * that DO matter further down the sheet. It belongs beside the vote, when
 * a vote is on screen. Nothing here may contradict it, which is what the
 * "no wording overclaims" tests enforce — no blanket "privé"/"niemand".
 *
 * WHY §5's SWITCH NAME IS QUOTED RATHER THAN IMPORTED from the sibling
 * `cookSharingCopy.ts`: that module's `COOK_SHARING_TOGGLE_LABEL` is a
 * standalone sentence and ends in a full stop, so composing it into the
 * middle of this one would mean stripping punctuation off another
 * surface's label — a formatting dependency between two screens that share
 * no logic. Both are anchored to the same source, DESIGN-SOCIAL.md §5,
 * which gives the switch its name verbatim.
 *
 * WHY THE STATE MACHINE LIVES BESIDE THE COPY rather than in its own
 * reducer file: every string below is a function OF that state — the row
 * label is the state, spelled in Dutch. Splitting them puts the two halves
 * of one contract in two files, where "loading" can grow a fourth phase
 * that no sentence covers and nothing fails. The rejected alternative was
 * a `useCookProofExclusion` hook holding both; rejected because a hook
 * imports React and lands right back in the untestable-in-node bucket this
 * module exists to escape, and because the screen — not a component —
 * owns repository access everywhere else in this app (see
 * (tabs)/recipes.tsx, (tabs)/friends.tsx).
 */

// ---------------------------------------------------------------------------
// The sheet's own chrome
// ---------------------------------------------------------------------------

/**
 * The sheet is titled by what it acts on, not by what it offers, because
 * what it offers is about to grow: W-10 adds a `Sturen` row here. "Deel
 * deze niet" as a heading would have to be rewritten the moment a second
 * row lands; "Dit gerecht" already covers both.
 */
export const LIBRARY_TILE_SHEET_TITLE = 'Dit gerecht';

/** Scrim tap target, matching SaveIntentSheet's "Sluit het bewaarmenu". */
export const LIBRARY_TILE_SHEET_DISMISS_LABEL = 'Sluit de opties voor dit gerecht';

// ---------------------------------------------------------------------------
// The tile affordance — see RecipeTile.tsx
// ---------------------------------------------------------------------------

/**
 * The label of the tile's `accessibilityActions` entry. A long-press is
 * invisible to a screen reader and impossible for anyone who cannot hold a
 * press, so the same action is published as an accessibility action; this
 * is what the rotor (iOS) or the actions menu (Android) reads out.
 */
export const LIBRARY_TILE_ACTIONS_ACCESSIBILITY_LABEL = 'Meer opties voor dit gerecht';

/**
 * The tile's hint once it carries a long-press. It keeps the tile's
 * primary promise first — tapping still opens Cook Mode, unchanged — and
 * appends the gesture, because a gesture nobody is told about is a gesture
 * only the developer has.
 */
export const LIBRARY_TILE_ACTIONS_HINT = 'Open kookmodus voor dit gerecht. Houd ingedrukt voor meer opties.';

// ---------------------------------------------------------------------------
// "Sturen" — the row that opens the send sheet (W-10, §3.1)
// ---------------------------------------------------------------------------

/**
 * §3.1 names this row and puts it FIRST: "A long-press on any tile in
 * Bibliotheek opens a small action sheet: `Sturen`, plus the sharing rows
 * of §3.5." Sending is the reason someone long-presses a tile; withholding
 * is the rare case.
 *
 * ONE WORD, AND IT IS A VERB. The row does not describe a state the way
 * "Deel deze niet" does — it opens src/components/SendRecipeSheet.tsx,
 * where the actual choosing happens. Every sentence about the send itself
 * (the friend rows, the note, its counter, the failures) lives in
 * src/components/sendRecipeSheetCopy.ts, so this module holds exactly
 * three strings and no state machine.
 */
export const LIBRARY_TILE_SEND_LABEL = 'Sturen';

/**
 * WHAT THIS SENTENCE MUST NOT SAY, and why each absence is deliberate:
 *
 *   - Nothing about having cooked the dish. PD-016 reversed the cook gate
 *     after it had been built; anything in the library may be sent. A row
 *     reading "een gerecht dat je gekookt hebt" would restore the rule in
 *     the one place users read, with no code change to catch in review.
 *   - Nothing about the recipient seeing it. §8 refuses read receipts
 *     outright, and a promise of delivery is the first half of one.
 *   - Nothing about how often you have sent this before. §3.2 and §4.2
 *     keep counts and timestamps off every send surface.
 *
 * What is left is the act and its one option: a named friend, and a note
 * you may or may not write.
 */
export const LIBRARY_TILE_SEND_EXPLAINER = 'Naar één vriend, met een briefje erbij als je dat wilt.';

export const LIBRARY_TILE_SEND_ACCESSIBILITY_LABEL = `${LIBRARY_TILE_SEND_LABEL}: ${LIBRARY_TILE_SEND_EXPLAINER}`;

// ---------------------------------------------------------------------------
// "Deel deze niet" — the row's sentences
// ---------------------------------------------------------------------------

/** The action, offered while this meal still feeds cook proof. §3.5's wording. */
export const COOK_PROOF_EXCLUDE_LABEL = 'Deel deze niet';

export const COOK_PROOF_EXCLUDE_EXPLAINER =
  'Vrienden zien dan niet dat je dit kookt. Ook niet de keren die al geweest zijn.';

/**
 * State and the way back on one line, verbatim from DESIGN-SOCIAL.md §3.5
 * ("Excluded, the row reads `Uitgezonderd van delen · Weer delen`"). The
 * middot is a visual separator only; `describeCookProofExclusionRow`
 * hands a screen reader two sentences instead.
 */
export const COOK_PROOF_EXCLUDED_LABEL = 'Uitgezonderd van delen · Weer delen';

export const COOK_PROOF_EXCLUDED_EXPLAINER =
  'Vrienden zien niet dat je dit kookt. Ook niet de keren die al geweest zijn.';

/**
 * The two boundaries of this control, stated where the control is rather
 * than in a help screen — PD-005's "consequence in full sentences before
 * the act", applied to a consequence that is mostly about what does NOT
 * happen.
 */
export const COOK_PROOF_SCOPE_NOTE =
  'Dit staat los van de instelling ‘Deel wat ik kook met vrienden’. Die aan- of uitzetten verandert dit niet. ' +
  'Zelf naar iemand sturen kan nog steeds.';

/** Read in flight. Neither "shared" nor "withheld" — see the unavailable copy for why that matters. */
export const COOK_PROOF_LOADING_LABEL = 'Delen wordt opgehaald…';

/**
 * `getMealCookProofExclusion` refuses an unknown meal id rather than
 * answering `false` (src/lib/repository/types.ts: "answering `false` there
 * would turn a lookup failure into permission to share a dish nobody could
 * even find"). This sheet honours that refusal instead of quietly
 * re-inventing the fail-open answer: the row says it does not know, and
 * offers the read again.
 */
export const COOK_PROOF_UNAVAILABLE_LABEL = 'Delen kan nu niet · Opnieuw proberen';

export const COOK_PROOF_UNAVAILABLE_EXPLAINER =
  'We konden niet ophalen of dit gerecht is uitgezonderd. Er is niets veranderd.';

/** Shown under the row after a rolled-back write — states the rollback, not just the failure. */
export const COOK_PROOF_WRITE_FAILED_NOTE = 'Niet gelukt. Er is niets veranderd. Probeer het nog eens.';

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export const COOK_PROOF_EXCLUDED_ANNOUNCEMENT = 'Dit gerecht is uitgezonderd van delen.';

/**
 * Deliberately NOT "dit gerecht wordt weer gedeeld". Lifting the exclusion
 * removes a block; it does not turn sharing on. Whether anything is
 * actually shared still depends on the household switch, which this
 * control knows nothing about (fact 2 above) — so the honest sentence
 * describes the block, not the sharing.
 */
export const COOK_PROOF_SHARED_ANNOUNCEMENT = 'De uitzondering is opgeheven.';

export const COOK_PROOF_WRITE_FAILED_ANNOUNCEMENT = 'Niet gelukt. Er is niets veranderd.';

export function describeCookProofExclusionAnnouncement(excluded: boolean): string {
  return excluded ? COOK_PROOF_EXCLUDED_ANNOUNCEMENT : COOK_PROOF_SHARED_ANNOUNCEMENT;
}

// ---------------------------------------------------------------------------
// The state the copy is a function of
// ---------------------------------------------------------------------------

/**
 * `unavailable` is a real phase and not an error flag on `ready`, because
 * the difference is exactly the one the repository refused to blur: a
 * `ready` row asserts a value, an `unavailable` row asserts nothing.
 */
export type CookProofExclusionPhase = 'loading' | 'ready' | 'unavailable';

export interface CookProofExclusionState {
  readonly phase: CookProofExclusionPhase;
  /** Only meaningful while `phase` is `ready`. Optimistic while `pending`. */
  readonly excluded: boolean;
  /** A write is in flight and `excluded` is the guess it will confirm or roll back. */
  readonly pending: boolean;
  /** The last write failed and was rolled back. Cleared by the next attempt or re-read. */
  readonly writeFailed: boolean;
}

export type CookProofExclusionEvent =
  | { readonly type: 'load-started' }
  | { readonly type: 'load-succeeded'; readonly excluded: boolean }
  | { readonly type: 'load-failed' }
  | { readonly type: 'write-started' }
  /** `excluded` is the value re-read through the repository, never the guess. */
  | { readonly type: 'write-succeeded'; readonly excluded: boolean }
  | { readonly type: 'write-failed' };

export const INITIAL_COOK_PROOF_EXCLUSION: CookProofExclusionState = {
  phase: 'loading',
  excluded: false,
  pending: false,
  writeFailed: false,
};

/**
 * Every out-of-order event returns the SAME object rather than a new equal
 * one, so an ignored transition cannot re-render anything and cannot be
 * mistaken for a real one in a test. The ignored cases are not defensive
 * padding: a second tap while a write is in flight would otherwise flip
 * the row twice against one write, and a write result belonging to a dish
 * the user has already closed would overwrite the next dish's answer.
 */
export function reduceCookProofExclusion(
  state: CookProofExclusionState,
  event: CookProofExclusionEvent,
): CookProofExclusionState {
  switch (event.type) {
    case 'load-started':
      return INITIAL_COOK_PROOF_EXCLUSION;
    case 'load-succeeded':
      return { phase: 'ready', excluded: event.excluded, pending: false, writeFailed: false };
    case 'load-failed':
      return { phase: 'unavailable', excluded: false, pending: false, writeFailed: false };
    case 'write-started':
      if (state.phase !== 'ready' || state.pending) {
        return state;
      }
      // The optimistic flip. The row shows the new state immediately
      // because the alternative — a spinner on a boolean — makes a
      // one-tap withholding feel like a transaction.
      return { phase: 'ready', excluded: !state.excluded, pending: true, writeFailed: false };
    case 'write-succeeded':
      if (!state.pending) {
        return state;
      }
      return { phase: 'ready', excluded: event.excluded, pending: false, writeFailed: false };
    case 'write-failed':
      if (!state.pending) {
        return state;
      }
      // Rollback is the inverse of the flip above, which is why the flip
      // is the only place `excluded` is ever guessed: one place to invert.
      return { phase: 'ready', excluded: !state.excluded, pending: false, writeFailed: true };
    default: {
      const exhaustiveCheck: never = event;
      throw new Error(`Unhandled CookProofExclusionEvent: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// State -> row
// ---------------------------------------------------------------------------

export interface CookProofExclusionRowCopy {
  readonly label: string;
  readonly explainer: string | null;
  readonly accessibilityLabel: string;
  /** False while the answer is unknown or a write is in flight. */
  readonly actionable: boolean;
  /** Rendered in `danger` beneath the row after a rolled-back write; null otherwise. */
  readonly errorNote: string | null;
}

/**
 * The spoken form of a label that uses a middot to fit two ideas on one
 * line. A screen reader reading "middot" adds nothing; two sentences carry
 * the same state-then-action reading the eye gets for free.
 */
function speak(label: string): string {
  return label.replace(' · ', '. ');
}

function withExplainer(label: string, explainer: string): string {
  return `${speak(label)}: ${explainer}`;
}

export function describeCookProofExclusionRow(state: CookProofExclusionState): CookProofExclusionRowCopy {
  const errorNote = state.writeFailed ? COOK_PROOF_WRITE_FAILED_NOTE : null;

  if (state.phase === 'loading') {
    return {
      label: COOK_PROOF_LOADING_LABEL,
      explainer: null,
      accessibilityLabel: COOK_PROOF_LOADING_LABEL,
      actionable: false,
      errorNote,
    };
  }

  if (state.phase === 'unavailable') {
    return {
      label: COOK_PROOF_UNAVAILABLE_LABEL,
      explainer: COOK_PROOF_UNAVAILABLE_EXPLAINER,
      accessibilityLabel: withExplainer(COOK_PROOF_UNAVAILABLE_LABEL, COOK_PROOF_UNAVAILABLE_EXPLAINER),
      actionable: true,
      errorNote,
    };
  }

  const label = state.excluded ? COOK_PROOF_EXCLUDED_LABEL : COOK_PROOF_EXCLUDE_LABEL;
  const explainer = state.excluded ? COOK_PROOF_EXCLUDED_EXPLAINER : COOK_PROOF_EXCLUDE_EXPLAINER;

  return {
    label,
    explainer,
    accessibilityLabel: withExplainer(label, explainer),
    actionable: !state.pending,
    errorNote,
  };
}

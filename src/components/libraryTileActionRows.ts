/**
 * The rows of `LibraryTileActionSheet`, and their order — the sheet's only
 * decision, extracted so a test can hold it to account.
 *
 * WHY IT IS NOT IN LibraryTileActionSheet.tsx, WHERE IT LIVED. §3.1 orders
 * `Sturen` FIRST — sending is the reason someone long-presses, withholding
 * is the rare case — and until now the only thing enforcing that was a
 * sentence in a file header. A comment cannot fail. The sheet file cannot
 * be imported by a test at all: it pulls `react-native-safe-area-context`,
 * whose published source is Flow-typed and dies in Vite's parser (the same
 * wall route modules under src/app hit). So a helper that stays in the
 * `.tsx` is a helper nothing can assert on, and the ordering rule stays
 * exactly as unprotected as it was. Everything here is pure data assembly,
 * with no React and no react-native import, which is the whole reason it
 * can be reached.
 *
 * This is the same split the rest of src/components already makes —
 * libraryTileActionCopy.ts, friendFeedPresentation.ts,
 * gekooktPresentation.ts: the `.ts` sibling holds what is decidable and
 * therefore testable, the `.tsx` holds what has to be looked at.
 *
 * REJECTED: extending tests/stubs/react-native.ts and aliasing
 * react-native-safe-area-context so the sheet itself could be imported.
 * That grows shared test infrastructure — `Animated`, `Modal`, `Pressable`,
 * `StyleSheet`, `useColorScheme`, `useSafeAreaInsets` — for every future
 * test to trip over, in order to assert one array's order. The stub's own
 * header asks for members to be added deliberately, one at a time, for a
 * genuine need; six at once to reach a pure function is not that.
 *
 * REJECTED: asserting the order in libraryTileActionCopy.test.ts against
 * the copy constants. Copy is not order — the sheet could render the two
 * rows the other way round without a single constant changing.
 */

import { describeLibraryRemovalRow, type LibraryRemovalState } from './libraryRemovalCopy';
import {
  RECIPE_EDIT_ROW_ACCESSIBILITY_LABEL,
  RECIPE_EDIT_ROW_EXPLAINER,
  RECIPE_EDIT_ROW_LABEL,
} from './recipeEditCopy';
import {
  COOK_PROOF_SCOPE_NOTE,
  LIBRARY_TILE_SEND_ACCESSIBILITY_LABEL,
  LIBRARY_TILE_SEND_EXPLAINER,
  LIBRARY_TILE_SEND_LABEL,
  describeCookProofExclusionRow,
  type CookProofExclusionState,
} from './libraryTileActionCopy';

/**
 * One row of the sheet. W-10's `Sturen` row is another value of this type
 * — nothing about the shape is specific to the sharing row.
 *
 * `footnote` sits with its own row rather than at the foot of the sheet on
 * purpose: `COOK_PROOF_SCOPE_NOTE` is about the exclusion and nothing
 * else, and a note under the last row of a two-row sheet reads as being
 * about both.
 */
export interface LibraryTileActionRow {
  readonly key: string;
  readonly label: string;
  readonly explainer: string | null;
  readonly accessibilityLabel: string;
  readonly disabled: boolean;
  /** Rendered in `danger` under the row — a failure the user must see, never a toast. */
  readonly errorNote: string | null;
  /** Rendered in `caption`/`textMuted` under the row: the scope this row does NOT cover. */
  readonly footnote: string | null;
  readonly onPress: () => void;
  /**
   * Text colour for the row's own label. `'danger'` is LIB-04's
   * "Verwijderen"/"Ja, verwijderen" alone — theme/tokens.ts's `danger` is a
   * deliberately different hue family from `accent` so a destructive action
   * never reads as the app's ordinary decision colour. Every other row
   * keeps `'default'`.
   */
  readonly tone: 'default' | 'danger';
  /**
   * Present only while this row is asking to be confirmed — a second,
   * separate action rendered beside the row's own (which becomes the
   * confirm). Null for every row that is not mid-confirmation, which is
   * what lets the sheet render a single Pressable the rest of the time —
   * see LibraryTileActionSheet.tsx's `ActionRow`.
   */
  readonly cancelAction: { readonly label: string; readonly accessibilityLabel: string; readonly onPress: () => void } | null;
}

/**
 * Everything the rows are built from — the sheet's props minus its chrome
 * (visibility, dish title, motion, dismissal), which no row reads.
 *
 * `LibraryTileActionSheetProps` extends this rather than restating it, so
 * the sheet keeps one prop list and this file cannot drift from it.
 */
export interface LibraryTileActionRowInput {
  /** Read and written by the screen through `RemyRepository`; the sheet only renders it. */
  readonly cookProofExclusion: CookProofExclusionState;
  /**
   * One handler for one row, not a toggle plus a retry: what a press means
   * depends on the state, and the state lives with the screen that owns
   * the repository calls. Splitting it would put half that decision here.
   */
  readonly onPressCookProofRow: () => void;
  /**
   * Opens the Sturen sheet for this dish (§3.1 / §4.1). Optional, and its
   * absence removes the row rather than disabling it: a call site with no
   * handler is one that cannot send at all — the sheet mounted somewhere
   * the send flow does not reach — and a greyed-out `Sturen` there would
   * advertise a capability that surface does not have. There is
   * deliberately NO cook condition anywhere near this prop; PD-016
   * removed the gate on purpose.
   */
  readonly onSturen?: () => void;
  /**
   * RCP-03 — "Aanpassen". Opens the recipe-edit screen for this dish.
   *
   * OPTIONAL, AND ITS ABSENCE REMOVES THE ROW rather than disabling it —
   * `onSturen`'s posture above, adopted deliberately rather than by
   * imitation. A call site with no handler is one mounted somewhere the
   * edit route is not reachable, and a greyed-out `Aanpassen` there would
   * advertise a capability that surface does not have. It also keeps every
   * existing caller and every existing assertion in
   * tests/libraryTileActionRows.test.ts valid unchanged: a sheet built
   * without this prop returns exactly the rows it always did.
   *
   * NO STATE, UNLIKE THE TWO ROWS BESIDE IT. The exclusion row and the
   * removal row each carry a phase because their repository call happens
   * inside the sheet; this one only navigates, and everything that can go
   * wrong belongs to the screen it opens, where there is room to explain
   * it. A row that merely opens a door needs no error note.
   */
  readonly onAanpassen?: () => void;
  /**
   * LIB-04 — "Verwijderen". Owned by the screen, exactly like
   * `cookProofExclusion` above: the state lives with the repository call
   * (`RemyRepository.archiveMeal`), this row only renders it. Unlike
   * `onSturen` it is never optional — every dish in this library can be
   * removed, so there is no call site that mounts this sheet without it.
   */
  readonly removal: LibraryRemovalState;
  /** Idle/failed -> confirming. */
  readonly onRequestRemoval: () => void;
  /** Confirming -> idle, the way back. */
  readonly onCancelRemoval: () => void;
  /** Confirming -> pending -> the repository call. */
  readonly onConfirmRemoval: () => void;
}

/**
 * Rows are data, not JSX: the sheet renders this array through one
 * `ActionRow`, and every per-row concern — separator, disabled state, error
 * note, footnote — is driven off `LibraryTileActionRow`. That is still true
 * for the third row, LIB-04's "Verwijderen": its copy lives in
 * libraryRemovalCopy.ts and its confirm state travels through
 * `input.removal`, and no JSX below changed to add it.
 *
 * WHERE IT STOPPED BEING PURELY DATA-SHAPED, AND WHY THAT IS STILL THE
 * SMALLEST CHANGE. A confirm needs two actions where every other row needed
 * one, so `LibraryTileActionRow` gained `cancelAction` (null outside
 * `confirming`) and `tone` (this row's only `'danger'`). Both are generic,
 * not name-specific to removal — a future row needing the same two-step
 * confirm, or the same colour, reuses them rather than inventing a fourth
 * shape — which is what keeps this still "data drives the sheet" rather
 * than a row the sheet has to special-case by key.
 *
 * ALWAYS PRESENT, UNLIKE `Sturen`. `onSturen` is optional because some call
 * sites cannot send at all (see its own comment above); every meal in this
 * library can be archived, so `removal` and its three handlers are
 * required, and `removalRow` is never conditionally omitted.
 *
 * THE ORDER IS THE POINT. §3.1 puts `Sturen` at the head, before the
 * sharing rows; `Verwijderen` goes LAST, after both, for the same logic one
 * more step out — sending is why you long-press, withholding is rarer,
 * removing rarer still. RCP-03's `Aanpassen` slots in second on that same
 * scale: correcting a wrong ingredient is the next most likely reason to be
 * here after sending, and it is nowhere near as rare as withholding a dish
 * or taking one out of rotation. This is also why the sheet's separator
 * keys off `index < rows.length - 1` rather than naming a row: with the
 * order owned here, any count of rows renders correctly — which is what
 * lets a fourth row land without a line of JSX changing.
 */
export function buildLibraryTileActionRows(input: LibraryTileActionRowInput): readonly LibraryTileActionRow[] {
  const cookProof = describeCookProofExclusionRow(input.cookProofExclusion);
  const { onAanpassen, onSturen } = input;

  /**
   * Spread rather than `unshift`, for the house's immutability rule; the
   * position is what §3.1's instruction was about, and this is that
   * position.
   */
  const sturenRow: readonly LibraryTileActionRow[] =
    onSturen === undefined
      ? []
      : [
          {
            key: 'sturen',
            label: LIBRARY_TILE_SEND_LABEL,
            explainer: LIBRARY_TILE_SEND_EXPLAINER,
            accessibilityLabel: LIBRARY_TILE_SEND_ACCESSIBILITY_LABEL,
            // Never disabled. Everything that could stop a send — no
            // friends, an over-long note, a refused write — belongs to the
            // sheet this row opens, where it can be explained. A disabled
            // row here would state a refusal without its reason.
            disabled: false,
            errorNote: null,
            footnote: null,
            onPress: onSturen,
            tone: 'default',
            cancelAction: null,
          },
        ];

  /**
   * RCP-03, after `Sturen` and before the two withholding rows. The order
   * argument in this file's header extends one step: sending is why you
   * long-press, correcting a wrong ingredient is the next most likely
   * reason to be here, and both withholding and removing are rarer than
   * either. Spread rather than pushed, for the same immutability rule the
   * `Sturen` row above follows.
   */
  const aanpassenRow: readonly LibraryTileActionRow[] =
    onAanpassen === undefined
      ? []
      : [
          {
            key: 'aanpassen',
            label: RECIPE_EDIT_ROW_LABEL,
            explainer: RECIPE_EDIT_ROW_EXPLAINER,
            accessibilityLabel: RECIPE_EDIT_ROW_ACCESSIBILITY_LABEL,
            // Never disabled and never an error: this row opens a screen,
            // and every failure that matters — a recipe that will not load,
            // a save that will not land — happens there, where it can be
            // said in a sentence and retried.
            disabled: false,
            errorNote: null,
            footnote: null,
            onPress: onAanpassen,
            tone: 'default',
            cancelAction: null,
          },
        ];

  const removal = describeLibraryRemovalRow(input.removal);
  /**
   * LIB-04's third row, LAST — rarer than withholding, which §3.1 already
   * put after sending. `onPress` reads the row's own event out of
   * `input.removal.phase`: while idle or failed it REQUESTS the confirm
   * (the same tap that turns this row into a question), while confirming it
   * IS the confirm. One row, one Pressable, in every phase but one — the
   * second Pressable only `cancelAction` below adds while confirming.
   */
  const removalRow: LibraryTileActionRow = {
    key: 'remove',
    label: removal.label,
    explainer: removal.explainer,
    accessibilityLabel: removal.accessibilityLabel,
    disabled: removal.disabled,
    errorNote: removal.errorNote,
    footnote: null,
    onPress: input.removal.phase === 'confirming' ? input.onConfirmRemoval : input.onRequestRemoval,
    tone: 'danger',
    cancelAction:
      removal.cancelLabel === null
        ? null
        : {
            label: removal.cancelLabel,
            accessibilityLabel: removal.cancelAccessibilityLabel ?? removal.cancelLabel,
            onPress: input.onCancelRemoval,
          },
  };

  return [
    ...sturenRow,
    ...aanpassenRow,
    {
      key: 'cook-proof-exclusion',
      label: cookProof.label,
      explainer: cookProof.explainer,
      accessibilityLabel: cookProof.accessibilityLabel,
      disabled: !cookProof.actionable,
      errorNote: cookProof.errorNote,
      footnote: COOK_PROOF_SCOPE_NOTE,
      onPress: input.onPressCookProofRow,
      tone: 'default',
      cancelAction: null,
    },
    removalRow,
  ];
}

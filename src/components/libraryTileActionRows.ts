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
}

/**
 * Rows are data, not JSX: the sheet renders this array through one
 * `ActionRow`, and every per-row concern — separator, disabled state, error
 * note, footnote — is driven off `LibraryTileActionRow`. A third row costs
 * one optional prop, one entry here, and its copy in
 * libraryTileActionCopy.ts; no JSX changed for `Sturen`, and none should
 * for the next one either.
 *
 * THE ORDER IS THE POINT. §3.1 puts `Sturen` at the head, before the
 * sharing rows — which is also why the sheet's separator keys off
 * `index < rows.length - 1` rather than naming a row: with the order owned
 * here, one row or two both render correctly, and a third would too.
 */
export function buildLibraryTileActionRows(input: LibraryTileActionRowInput): readonly LibraryTileActionRow[] {
  const cookProof = describeCookProofExclusionRow(input.cookProofExclusion);
  const { onSturen } = input;

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
          },
        ];

  return [
    ...sturenRow,
    {
      key: 'cook-proof-exclusion',
      label: cookProof.label,
      explainer: cookProof.explainer,
      accessibilityLabel: cookProof.accessibilityLabel,
      disabled: !cookProof.actionable,
      errorNote: cookProof.errorNote,
      footnote: COOK_PROOF_SCOPE_NOTE,
      onPress: input.onPressCookProofRow,
    },
  ];
}

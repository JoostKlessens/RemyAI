/**
 * The action sheet behind a long-press on a Bibliotheek tile
 * (DESIGN-SOCIAL.md §3.1: "A long-press on any tile in Bibliotheek opens a
 * small action sheet"). It is the first long-press affordance in the app —
 * before this, `RecipeTile` rendered bare, with tap-to-cook and nothing
 * else.
 *
 * NAMED FOR THE TILE, NOT FOR THE ROW. Today it carries exactly one row,
 * "Deel deze niet" (§3.5), and calling it `CookProofSheet` would have been
 * accurate for about a week: §3.1 puts `Sturen` in this same sheet, and a
 * component renamed under a following task is a component every call site
 * and test has to be dragged through. The name describes the surface,
 * which is stable; the rows are the variable part.
 *
 * HOW THE SECOND ROW LANDED (W-10's `Sturen`), and how a third would.
 * Rows are data, not JSX: the sheet renders `buildLibraryTileActionRows()`'s
 * array through one `ActionRow`, and every per-row concern — separator,
 * disabled state, error note, footnote — is driven off
 * `LibraryTileActionRow`. `Sturen` cost exactly three things: one optional
 * `onSturen` prop, one entry at the head of that array, and its copy in
 * libraryTileActionCopy.ts. No JSX below changed, and none should for the
 * next row either. §3.1's own ordering puts `Sturen` FIRST — sending is
 * the reason someone long-presses, withholding is the rare case — which is
 * why the separator logic below keys off `index < rows.length - 1` rather
 * than naming a row.
 *
 * HOW THE THIRD ROW LANDED (LIB-04's `Verwijderen`), and where it stopped
 * being pure data. Its label, explainer, and disabled/error states follow
 * the exact same `LibraryTileActionRow` contract as the first two rows —
 * nothing here needed to change to render them. What it added to that
 * contract, generically rather than by row name, is `tone` (this row's
 * label renders in `colors.danger` instead of `textPrimary`, so a
 * destructive action never reads as the app's ordinary decision colour —
 * theme/tokens.ts's own reasoning for keeping `danger` a different hue
 * family from `accent`) and `cancelAction` (a second `Pressable`, rendered
 * only while the row is asking to be confirmed). Both are read below in
 * `ActionRow`, and neither is specific to removal — any future row needing
 * the same colour or the same two-step confirm reuses them rather than the
 * sheet growing a `row.key === 'remove'` special case.
 *
 * THE ROWS THEMSELVES LIVE IN libraryTileActionRows.ts, not here, and are
 * re-exported below so this file stays the one address for the sheet's
 * contract. That move is not tidying: this `.tsx` cannot be imported by a
 * test — react-native-safe-area-context's Flow-typed source kills Vite's
 * parser — so while the ordering rule lived here, the paragraph above was
 * the only thing enforcing it. See that file's header.
 *
 * THE SEND ITSELF IS NOT HERE. `onSturen` opens
 * src/components/SendRecipeSheet.tsx, which owns the friend list, the note
 * and the commit; this row only names the act. Two reasons: this sheet
 * would otherwise need a second, unrelated data dependency (see
 * PRESENTATIONAL ONLY, below), and §4.1 specifies the send as its own
 * sheet with its own chrome rather than an expanding row.
 *
 * FOLLOWS SaveIntentSheet, DELIBERATELY. Same `Modal` + scrim + translated
 * panel, the same `durationNormal`/`easingDecelerate` entry, the same
 * `reduceMotionEnabled` contract read once by the screen and passed down,
 * the same `surfaceRaised`/`radiusLg`/drag-handle chrome. A second sheet
 * idiom in an app this size is how two sheets end up animating at
 * different speeds for no reason anybody can reconstruct later.
 *
 * WHERE IT DIVERGES, and why: SaveIntentSheet auto-dismisses on selection
 * because there the choice IS the confirm. This sheet must not — §3.5
 * specifies the row morphs in place ("Excluded, the row reads
 * `Uitgezonderd van delen · Weer delen`"), and a control you can put back
 * has to show you it moved. That in-place label change also replaces
 * SaveIntentSheet's `positiveMuted` commit flash: the row saying something
 * different is stronger confirmation than a colour that fades, and a flash
 * on top of it would read as a second, separate event. The scrim IS
 * dismissable here, unlike CookSharingAskSheet's — nothing in this sheet
 * is a question whose "no" is final, and every row is reversible in place.
 *
 * PRESENTATIONAL ONLY. Every repository call lives in
 * src/app/(tabs)/recipes.tsx, matching how every other screen in this app
 * is arranged. The alternative — the sheet fetching its own exclusion —
 * was rejected because W-10's send row needs the friend list and a write
 * of its own, and a sheet that owns two unrelated data dependencies is a
 * screen wearing a sheet's clothes.
 */

import type { JSX } from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LIBRARY_TILE_SHEET_DISMISS_LABEL, LIBRARY_TILE_SHEET_TITLE } from './libraryTileActionCopy';
import {
  buildLibraryTileActionRows,
  type LibraryTileActionRow,
  type LibraryTileActionRowInput,
} from './libraryTileActionRows';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

/**
 * Re-exported so the sheet remains the single address for its own contract
 * — a caller should not have to know the rows were split out to be tested.
 */
export { buildLibraryTileActionRows };
export type { LibraryTileActionRow };

/**
 * The sheet's chrome on top of everything the rows are built from — see
 * `LibraryTileActionRowInput` for the row half, which is documented where
 * it is used and where it is tested.
 */
export interface LibraryTileActionSheetProps extends LibraryTileActionRowInput {
  readonly visible: boolean;
  readonly dishTitle: string;
  readonly onDismiss: () => void;
  readonly reduceMotionEnabled: boolean;
}

/** Matches SaveIntentSheet's off-screen start offset. */
const SHEET_ENTRY_OFFSET = 400;

export function LibraryTileActionSheet(props: LibraryTileActionSheetProps): JSX.Element {
  const { visible, dishTitle, onDismiss, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const insets = useSafeAreaInsets();
  const rows = buildLibraryTileActionRows(props);

  const translateY = useRef(new Animated.Value(SHEET_ENTRY_OFFSET)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    const duration = resolveDuration(motion.durationNormal, reduceMotionEnabled);
    translateY.setValue(reduceMotionEnabled ? 0 : SHEET_ENTRY_OFFSET);
    scrimOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        easing: Easing.bezier(...motion.easingDecelerate),
        useNativeDriver: true,
      }),
      Animated.timing(scrimOpacity, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();
  }, [visible, translateY, scrimOpacity, reduceMotionEnabled]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay, opacity: scrimOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={LIBRARY_TILE_SHEET_DISMISS_LABEL}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.surfaceRaised,
            paddingBottom: spacing.space8 + insets.bottom,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />
        <Text style={[typeScale.title3, styles.title, { color: colors.textPrimary }]}>{LIBRARY_TILE_SHEET_TITLE}</Text>
        {/* No numberOfLines cap, for RecipeTile's reason: a truncated dish
            title is the clipping docs/DESIGN.md asks screens to avoid. */}
        <Text style={[typeScale.bodySmall, styles.dish, { color: colors.textMuted }]}>{dishTitle}</Text>
        {rows.map((row, index) => (
          <View
            key={row.key}
            style={[
              styles.rowBlock,
              index < rows.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: 1 } : null,
            ]}
          >
            <ActionRow row={row} />
          </View>
        ))}
      </Animated.View>
    </Modal>
  );
}

interface ActionRowProps {
  readonly row: LibraryTileActionRow;
}

/**
 * The error note and the footnote sit OUTSIDE the `Pressable`. Inside, a
 * screen reader would fold three sentences into one button label, and the
 * touch target would grow to swallow a paragraph the user cannot act on.
 */
function ActionRow(props: ActionRowProps): JSX.Element {
  const { row } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  // `disabled` still wins over `tone` — a greyed-out row must read as
  // inactive first, matching every other row's existing rule, and a
  // disabled destructive row (mid-write, LIB-04's `pending` phase) should
  // not glow red while it cannot be pressed.
  const labelColor = row.disabled ? colors.textMuted : row.tone === 'danger' ? colors.danger : colors.textPrimary;

  return (
    <View>
      <Pressable
        onPress={row.onPress}
        disabled={row.disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: row.disabled }}
        accessibilityLabel={row.accessibilityLabel}
        style={styles.pressableRow}
      >
        <Text style={[typeScale.body, { color: labelColor }]}>{row.label}</Text>
        {row.explainer !== null ? (
          <Text style={[typeScale.bodySmall, styles.explainer, { color: colors.textMuted }]}>{row.explainer}</Text>
        ) : null}
      </Pressable>
      {/* LIB-04's confirm step: a second, separate tap target beside the
          row's own, only while `cancelAction` is present — see
          libraryTileActionRows.ts's header for why a confirm needs two
          named actions rather than a second tap on the same row. */}
      {row.cancelAction !== null ? (
        <Pressable
          onPress={row.cancelAction.onPress}
          accessibilityRole="button"
          accessibilityLabel={row.cancelAction.accessibilityLabel}
          style={styles.cancelRow}
        >
          <Text style={[typeScale.body, { color: colors.textSecondary }]}>{row.cancelAction.label}</Text>
        </Pressable>
      ) : null}
      {row.errorNote !== null ? (
        <Text style={[typeScale.bodySmall, styles.note, { color: colors.danger }]}>{row.errorNote}</Text>
      ) : null}
      {row.footnote !== null ? (
        <Text style={[typeScale.caption, styles.note, { color: colors.textMuted }]}>{row.footnote}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radii.radiusLg,
    borderTopRightRadius: radii.radiusLg,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space8,
  },
  dragHandle: {
    alignSelf: 'center',
    width: spacing.space8,
    height: spacing.space1,
    borderRadius: radii.radiusFull,
    marginBottom: spacing.space4,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.space1,
  },
  dish: {
    textAlign: 'center',
    marginBottom: spacing.space4,
  },
  rowBlock: {
    paddingBottom: spacing.space3,
  },
  pressableRow: {
    minHeight: spacing.touchTargetMin + spacing.space1,
    justifyContent: 'center',
    paddingVertical: spacing.space3,
  },
  /** LIB-04's "Annuleren" — a separate, lighter-weight tap target under the confirm row, never styled to compete with it. */
  cancelRow: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    paddingBottom: spacing.space2,
  },
  explainer: {
    marginTop: spacing.space1,
  },
  note: {
    marginTop: spacing.space2,
  },
});

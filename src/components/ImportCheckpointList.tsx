/**
 * THE LOADING STATE OF RECIPE IMPORT (docs/DESIGN.md §3): a short list of
 * named steps, each an unfilled-`border` circle that fills solid `accent`
 * once that step is done. It exists instead of a spinner because a spinner
 * says only "wait", and this is the one genuinely long wait in the app —
 * long enough that a user needs to be told what is being waited FOR.
 *
 * THE RULE THIS COMPONENT ENFORCES, AND THE REASON IT IS A COMPONENT AT
 * ALL: THE LAST ROW IS NEVER FILLED. It is the step actually in flight, and
 * the only thing that may complete it is the real result arriving — at
 * which point this list is gone and the screen has navigated or shown a
 * failure. `filledCount` therefore cannot light it, whatever it is handed.
 *
 * That rule used to live in the caller, as an `&&` inside a `.map()`, and
 * it is exactly the sort of clause a later edit simplifies away without
 * noticing what it was for. Encoded here, a timer can never claim a step
 * finished while it is still running — which is the same "no spinner that
 * resolves into nothing" promise the rest of this flow makes, in its most
 * literal form.
 *
 * IT HOLDS NO TIMER AND NO STATE. WHICH rows to show is the copy module's
 * answer (`buildImportCheckpointLabels`, importPasteCopy.ts — four pipeline
 * shapes, four honest narrations, so that somebody who pasted a text is
 * never told a video was found), and WHEN the leading rows advance is the
 * screen's. This file renders what it is told, minus the one thing it will
 * not render however hard it is asked.
 */

import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface ImportCheckpointListProps {
  /** The narration for this pipeline shape. The last entry is the step in flight — see the file header. */
  readonly labels: readonly string[];
  /** How many LEADING rows the screen's timers have lit. The final row is excluded from this count by construction. */
  readonly filledCount: number;
}

export function ImportCheckpointList(props: ImportCheckpointListProps): JSX.Element {
  const { labels, filledCount } = props;
  /** The step genuinely in flight: never filled, whatever `filledCount` says. */
  const inFlightIndex = labels.length - 1;

  return (
    <View style={styles.block}>
      {labels.map((label, index) => (
        <CheckpointRow key={label} label={label} filled={index < inFlightIndex && filledCount > index} />
      ))}
    </View>
  );
}

interface CheckpointRowProps {
  readonly label: string;
  readonly filled: boolean;
}

const TRANSPARENT_FILL = 'transparent';

/** One row: an unfilled `border` circle that fills solid `accent` once this step is done, and a label that brightens with it. */
function CheckpointRow(props: CheckpointRowProps): JSX.Element {
  const { label, filled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const circleColor = filled ? colors.accent : colors.border;
  const circleFill = filled ? colors.accent : TRANSPARENT_FILL;

  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}${filled ? ', klaar' : ''}`}>
      <View style={[styles.circle, { borderColor: circleColor, backgroundColor: circleFill }]} />
      <Text style={[typeScale.caption, { color: filled ? colors.textPrimary : colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: spacing.space5,
    gap: spacing.space2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    paddingVertical: spacing.space1,
  },
  circle: {
    // A small status dot, not a spacing-scale size — mirrors
    // TimerDisplay.tsx's own local CIRCLE_SIZE constant precedent.
    width: 10,
    height: 10,
    borderRadius: radii.radiusFull,
    borderWidth: 1.5,
  },
});

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

import { useEffect, useRef, type JSX } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { CHECKPOINT_FILL_SCALE_FROM, resolveCheckpointFilled } from './importCheckpointPresentation';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface ImportCheckpointListProps {
  /** The narration for this pipeline shape. The last entry is the step in flight — see the file header. */
  readonly labels: readonly string[];
  /** How many LEADING rows the screen's timers have lit. The final row is excluded from this count by construction. */
  readonly filledCount: number;
  /** Read once by the screen and passed down, per docs/DESIGN.md's global rule. */
  readonly reduceMotionEnabled: boolean;
}

export function ImportCheckpointList(props: ImportCheckpointListProps): JSX.Element {
  const { labels, filledCount, reduceMotionEnabled } = props;

  return (
    <View style={styles.block}>
      {labels.map((label, index) => (
        <CheckpointRow
          key={label}
          label={label}
          filled={resolveCheckpointFilled(index, labels.length, filledCount)}
          reduceMotionEnabled={reduceMotionEnabled}
        />
      ))}
    </View>
  );
}

interface CheckpointRowProps {
  readonly label: string;
  readonly filled: boolean;
  readonly reduceMotionEnabled: boolean;
}

/**
 * One row: an unfilled `border` circle that fills solid `accent` once this
 * step is done, and a label that brightens with it.
 *
 * THE FILL IS A SEPARATE OVERLAY RATHER THAN THIS CIRCLE'S OWN
 * `backgroundColor`, AND THAT IS THE WHOLE REASON THE MARK CAN MOVE.
 * `backgroundColor` cannot run on the native driver, so animating it would
 * put a per-frame colour interpolation on the JS thread during the one
 * moment in this flow when that thread is already busy with a network call
 * settling. An absolutely-positioned disc whose `opacity` and `scale`
 * animate is the same picture, entirely on the compositor.
 *
 * ⚠ THE VALUE IS SEEDED FROM `filled`, NEVER FROM 0. The `.map()` above is
 * keyed on `label`, and a different pipeline shape hands this list a
 * different label array (`buildImportCheckpointLabels`), so rows can
 * remount mid-flight. A row that remounts already filled must appear
 * filled, not light up again as though its step had only just finished.
 *
 * ⚠ AND IT ANIMATES ONLY ON THE false→true EDGE, guarded by `prevFilled`.
 * Running on every render would let an unrelated parent update replay the
 * mark, which says "this step just completed" about a step that completed a
 * second ago.
 */
function CheckpointRow(props: CheckpointRowProps): JSX.Element {
  const { label, filled, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const circleColor = filled ? colors.accent : colors.border;

  const fill = useRef(new Animated.Value(filled ? 1 : 0)).current;
  const prevFilled = useRef(filled);

  useEffect(() => {
    if (prevFilled.current === filled) {
      return;
    }
    prevFilled.current = filled;
    // Reduced motion means instantly, not faster: no timing is constructed
    // at all, so not one intermediate frame is ever rendered. Un-filling is
    // never a user-visible event here either — a row only returns to empty
    // when a new attempt resets the whole list — so that too is a straight
    // set rather than an exit.
    if (!filled || reduceMotionEnabled) {
      fill.setValue(filled ? 1 : 0);
      return;
    }
    Animated.timing(fill, {
      toValue: 1,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  }, [filled, fill, reduceMotionEnabled]);

  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}${filled ? ', klaar' : ''}`}>
      <View style={[styles.circle, { borderColor: circleColor }]}>
        <Animated.View
          style={[
            styles.circleFill,
            {
              backgroundColor: colors.accent,
              opacity: fill,
              transform: [
                { scale: fill.interpolate({ inputRange: [0, 1], outputRange: [CHECKPOINT_FILL_SCALE_FROM, 1] }) },
              ],
            },
          ]}
        />
      </View>
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
  // Written out rather than `StyleSheet.absoluteFill`, because this needs a
  // `borderRadius` of its own: a square disc inside a 10 pt ring reads as a
  // glitch at the one moment it is meant to read as a mark landing.
  circleFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.radiusFull,
  },
});

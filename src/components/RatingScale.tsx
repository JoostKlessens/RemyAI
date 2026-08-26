/**
 * "Hoe was het?" — the outcome rating control, rendered by OutcomeCard.
 *
 * WHY THIS IS A SLIDER AND NOT PD-008'S CHIP ROW. PD-008 specified
 * "numbered mono chips, not stars", and on the old five-point scale that
 * was right. The scale is now the Dutch report card, 1,0-10,0 to one
 * decimal: 91 expressible grades, and even a whole-numbers-only row of ten
 * chips needs about 440pt at the 44pt touch minimum, which is wider than a
 * phone. The chip row could not survive the change in any form.
 *
 * WHAT THE SLIDER KEPT. PD-008's real objection was to borrowed
 * rating-site idiom, not to chips as such — docs/DESIGN.md bans emoji as
 * status indicators and keeps icons sparse, so a star row is still out on
 * both counts. Nothing here renders a glyph. The grade is set large in
 * mono (`timerDisplay`, the same treatment Kookmodus gives its timer),
 * which is how anything measured reads in this product: a number burned
 * into the frame.
 *
 * ONE GESTURE, AND THE COST STAYS ONE. PD-008 requires that skipping cost
 * exactly as much as answering. Committing on release rather than on a
 * separate confirm keeps that true: drag and let go is one gesture, and
 * "Klaar" beside it is one tap. A confirm step would have made rating cost
 * double what walking away costs, which is the nag PD-003 forbids.
 *
 * IT DOES NOT OPEN PRE-FILLED. The thumb rests mid-track with an en dash
 * above it until the first touch. A slider sitting on 5,5 showing "5,5"
 * has already put an opinion in the cook's mouth that they would have to
 * correct, and PD-008 is explicit that a rating which nags is a rating
 * that gets lied to.
 *
 * NO SLIDER LIBRARY. The app carries no gesture library at all — no
 * reanimated, no gesture-handler — and adding a native module for one
 * control would be the largest dependency decision in the project taken
 * for the smallest reason. `PanResponder` is in React Native core, works
 * under react-native-web (this app ships a web export), and the arithmetic
 * it needs lives in ratingScaleCopy.ts where vitest can reach it.
 */

import { useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { RATING_MAX, RATING_MIN } from '@/domain/rating';
import {
  RATING_ANCHOR_HIGH,
  RATING_ANCHOR_LOW,
  RATING_GROUP_ACCESSIBILITY_LABEL,
  RATING_UNSET_LABEL,
  RATING_UNSET_TRACK_FRACTION,
  formatGrade,
  nudgeRating,
  ratingToTrackFraction,
  trackFractionToRating,
} from './ratingScaleCopy';

export interface RatingScaleProps {
  /** The score picked so far, or null while the question is unanswered — which is a complete, permitted end state, not a validation failure. */
  readonly selected: number | null;
  readonly onSelect: (rating: number) => void;
  readonly reduceMotionEnabled: boolean;
  /** Set once a score is committed, so a second gesture during the dismiss beat cannot quietly record a different one. */
  readonly disabled?: boolean;
}

/** The thumb grows by this much while a finger is on it — the press feedback `Chip` gives, in the one form a slider can. */
const THUMB_ACTIVE_SCALE = 1.15;

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 28;

export function RatingScale(props: RatingScaleProps): JSX.Element {
  const { selected, onSelect, reduceMotionEnabled, disabled = false } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const [trackWidth, setTrackWidth] = useState(0);
  /** The grade under the finger right now. Null until first touch, which is what the en dash reports. */
  const [draft, setDraft] = useState<number | null>(null);
  const thumbScale = useRef(new Animated.Value(1)).current;

  // Read through refs inside the PanResponder: it is created once, on the
  // first render, so a closure over `trackWidth` would capture 0 forever.
  const trackWidthRef = useRef(0);
  trackWidthRef.current = trackWidth;
  const startFractionRef = useRef(RATING_UNSET_TRACK_FRACTION);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const draftRef = useRef<number | null>(null);
  draftRef.current = draft;

  const value = draft ?? selected;
  const fraction = value === null ? RATING_UNSET_TRACK_FRACTION : ratingToTrackFraction(value);

  const animateThumb = (to: number): void => {
    Animated.timing(thumbScale, {
      toValue: to,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (event) => {
        if (disabledRef.current || trackWidthRef.current === 0) {
          return;
        }
        // A tap anywhere on the track jumps there, so the finger never has
        // to find a 28pt thumb first.
        const start = event.nativeEvent.locationX / trackWidthRef.current;
        startFractionRef.current = Math.min(1, Math.max(0, start));
        setDraft(trackFractionToRating(startFractionRef.current));
        animateThumb(THUMB_ACTIVE_SCALE);
      },
      onPanResponderMove: (_event, gesture) => {
        if (disabledRef.current || trackWidthRef.current === 0) {
          return;
        }
        // Offset from where the gesture began rather than the raw touch
        // position: `locationX` during a move is reported against whichever
        // view captured the responder and is not consistent across
        // platforms, while `dx` is the same everywhere.
        setDraft(trackFractionToRating(startFractionRef.current + gesture.dx / trackWidthRef.current));
      },
      onPanResponderRelease: () => {
        animateThumb(1);
        const committed = draftRef.current;
        if (!disabledRef.current && committed !== null) {
          onSelect(committed);
        }
      },
      onPanResponderTerminate: () => {
        animateThumb(1);
      },
    }),
  ).current;

  /**
   * VoiceOver and TalkBack drive this, not the finger. The increment is
   * deliberately half a grade rather than the 0,1 step — see
   * RATING_ACCESSIBILITY_STEP for why ninety swipes is not accessibility.
   * An untouched control starts from the middle, so the first swipe lands
   * somewhere meaningful instead of at an end.
   */
  const handleAccessibilityAction = (action: 'increment' | 'decrement'): void => {
    if (disabled) {
      return;
    }
    const from = value ?? trackFractionToRating(RATING_UNSET_TRACK_FRACTION);
    const next = nudgeRating(from, action === 'increment' ? 1 : -1);
    setDraft(next);
    onSelect(next);
  };

  return (
    <View style={styles.container}>
      {/* Hidden from assistive tech: the slider below already reports the
          same grade through accessibilityValue, and announcing it twice is
          how a screen reader turns one number into two. */}
      <Text
        style={[typeScale.timerDisplay, styles.grade, { color: value === null ? colors.textMuted : colors.textPrimary }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {value === null ? RATING_UNSET_LABEL : formatGrade(value)}
      </Text>

      <View
        style={styles.touchArea}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={RATING_GROUP_ACCESSIBILITY_LABEL}
        accessibilityState={{ disabled }}
        accessibilityValue={{
          min: RATING_MIN,
          max: RATING_MAX,
          now: value ?? undefined,
          text: value === null ? RATING_UNSET_LABEL : `${formatGrade(value)} van ${RATING_MAX}`,
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const name = event.nativeEvent.actionName;
          if (name === 'increment' || name === 'decrement') {
            handleAccessibilityAction(name);
          }
        }}
        {...panResponder.panHandlers}
      >
        <View
          style={[styles.track, { backgroundColor: colors.surfaceSunken }]}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        >
          <View
            style={[
              styles.trackFilled,
              { backgroundColor: value === null ? colors.border : colors.accent, width: `${fraction * 100}%` },
            ]}
          />
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: value === null ? colors.border : colors.accent,
                borderColor: colors.surface,
                left: `${fraction * 100}%`,
                transform: [{ translateX: -THUMB_SIZE / 2 }, { scale: thumbScale }],
              },
            ]}
          />
        </View>
      </View>

      <AnchorRow />
    </View>
  );
}

/**
 * The two ends, in consequence terms rather than taste terms. Hidden from
 * assistive tech on purpose: the anchor words are already carried in the
 * slider's own label and value, and exposing the row as well would read
 * the scale's meaning out twice.
 */
function AnchorRow(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.anchorRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>{RATING_ANCHOR_LOW}</Text>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>{RATING_ANCHOR_HIGH}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  grade: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  // The track itself is 4pt tall; the touch area around it clears the 44pt
  // minimum on its own, so the thumb never has to be the target.
  touchArea: {
    justifyContent: 'center',
    minHeight: spacing.touchTargetMin,
    paddingHorizontal: THUMB_SIZE / 2,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radii.radiusFull,
    justifyContent: 'center',
  },
  trackFilled: {
    height: TRACK_HEIGHT,
    borderRadius: radii.radiusFull,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: radii.radiusFull,
    borderWidth: 2,
  },
  anchorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.space2,
    paddingHorizontal: THUMB_SIZE / 2,
  },
});

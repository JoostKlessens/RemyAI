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
 * ONE TAP, AND THE COST STAYS ONE — BUT NOT THE WAY IT USED TO BE.
 * PD-008 requires that skipping cost exactly as much as answering. This
 * file used to satisfy that by committing on release: drag and let go was
 * one gesture, "Klaar" beside it was one tap, and a separate confirm was
 * rejected for making rating cost double what walking away costs.
 *
 * That reasoning was sound and the implementation was still wrong, which
 * is worth recording rather than quietly correcting. Committing on release
 * means the control cannot be EXPLORED: every mis-touch on a 44pt strip
 * wrote a permanent grade and closed the card that would have let you fix
 * it. A scale you cannot try is a scale you answer wrongly, and this
 * file's own header says a rating which nags is a rating that gets lied
 * to — an accidental grade is that lie, arrived at from the other side.
 *
 * The fix keeps the arithmetic PD-008 asked for and moves where the tap
 * lands: the finger only ever moves a DRAFT, and the single "Klaar" button
 * records it if there is one and closes with nothing if there is not. One
 * tap either way, on the same control, and now it is a decision instead of
 * a consequence of letting go. `OutcomeCard` owns that button and
 * therefore owns the draft; this file reports it and records nothing.
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

import { useRef, useState, type JSX } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { hapticValueMoved } from '@/lib/haptics';
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
  /**
   * Reports the grade under the finger. **This is not a commit**, and the
   * distinction is the whole of the second bug fixed here.
   *
   * The control used to call an `onSelect` from `onPanResponderRelease`,
   * which wrote the grade and started the card's exit beat the instant a
   * finger lifted. So a mis-touch anywhere on a 44pt-tall strip recorded a
   * permanent number and closed the surface that would have let you
   * correct it — the owner reported exactly that: "als ik hem loslaat
   * zonder op klaar te klikken, dan geeft hij het al een cijfer."
   *
   * Now the finger only ever moves a draft, and `Klaar` is what records
   * it. PD-008's rule that skipping must cost exactly what answering costs
   * survives intact, because it is still one tap either way: the same
   * single button commits a draft when there is one and closes with
   * nothing when there is not.
   */
  readonly onDraftChange: (rating: number | null) => void;
  readonly reduceMotionEnabled: boolean;
  /** Set once a score is committed, so a second gesture during the dismiss beat cannot quietly record a different one. */
  readonly disabled?: boolean;
}

/** The thumb grows by this much while a finger is on it — the press feedback `Chip` gives, in the one form a slider can. */
const THUMB_ACTIVE_SCALE = 1.15;

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 28;

export function RatingScale(props: RatingScaleProps): JSX.Element {
  const { selected, onDraftChange, reduceMotionEnabled, disabled = false } = props;
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
  /**
   * The track's LEFT EDGE IN WINDOW COORDINATES, and the reason this
   * component now measures at all.
   *
   * THE BUG THIS KILLS. The grant handler used to divide
   * `event.nativeEvent.locationX` by the track width. `locationX` is
   * measured against **whichever view the finger actually landed on**, and
   * three different views sit under this gesture: the 28pt thumb, the
   * filled track, and the padded touch area. Land on the thumb — which
   * rests dead centre until the first touch, and is therefore the single
   * most likely thing a finger hits — and `locationX` is a number between
   * 0 and 28, divided by a track of about 317. That is 0,04: the grade
   * jumps to the far left of the scale the moment you touch the middle of
   * it. The owner reported it as "de slider die je in het midden
   * vasthoudt, start helemaal aan de linkerkant."
   *
   * `gestureState.x0` is in window coordinates and is the same number
   * whatever was touched, so one subtraction against a measured left edge
   * replaces three ambiguous coordinate spaces with one.
   *
   * Measured with `measureInWindow` rather than read off `onLayout`'s
   * `nativeEvent.layout.x`: that value is relative to the PARENT, which
   * here is the padded touch area sitting inside a card inside a screen,
   * and it would be wrong by exactly the offsets this fix exists to stop
   * guessing at.
   */
  const trackPageXRef = useRef(0);
  const trackRef = useRef<View>(null);
  const startFractionRef = useRef(RATING_UNSET_TRACK_FRACTION);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  /**
   * The PanResponder below is created once, on the first render, so a
   * closure over `onDraftChange` would call whatever the prop was then —
   * for the rest of the component's life. Same reason `trackWidth` and
   * `disabled` are read through refs three lines up.
   */
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  /**
   * WS5 §3.4's detent. The whole grade under the finger the last time a
   * tick fired, so a drag can tell "crossed into the sevens" from "moved
   * a tenth".
   *
   * BOUND TO THE WHOLE GRADE AND NEVER TO `RATING_STEP`, and the numbers
   * are why: dragging 1,0 to 10,0 crosses 9 whole grades and 90 steps. At
   * one tick per step this control would buzz ninety times in a single
   * gesture, which is not feedback, it is a fault. One tick per report-card
   * number is also how Dutch people say a grade out loud — "een zeven" —
   * so the detent the hand feels is the unit the mouth already uses.
   */
  const lastWholeRef = useRef<number | null>(null);

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
      onPanResponderGrant: (_event, gesture) => {
        if (disabledRef.current || trackWidthRef.current === 0) {
          return;
        }
        // A tap anywhere on the track jumps there, so the finger never has
        // to find a 28pt thumb first. `x0` is in window coordinates — see
        // `trackPageXRef` for why the old `locationX` reading could not be.
        const start = (gesture.x0 - trackPageXRef.current) / trackWidthRef.current;
        startFractionRef.current = Math.min(1, Math.max(0, start));
        const grantValue = trackFractionToRating(startFractionRef.current);
        setDraft(grantValue);
        // Seeded SILENTLY. The touch landing is not its own haptic event:
        // a tap on the track is one user action, and WS5 §3.1 rule 3
        // budgets one haptic for it — which is the `Medium` on release,
        // the moment the grade actually commits. Firing here as well would
        // make the cheapest possible tap buzz twice.
        lastWholeRef.current = Math.floor(grantValue);
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
        const next = trackFractionToRating(startFractionRef.current + gesture.dx / trackWidthRef.current);
        setDraft(next);
        onDraftChangeRef.current(next);
        const whole = Math.floor(next);
        if (whole !== lastWholeRef.current) {
          lastWholeRef.current = whole;
          hapticValueMoved();
        }
      },
      onPanResponderRelease: () => {
        animateThumb(1);
        // NOTHING IS RECORDED HERE, and that is the fix. Lifting a finger
        // leaves the draft standing on screen for as long as the cook
        // wants to look at it; `Klaar` is what writes it down. The commit
        // haptic moved with the commit — a buzz here would report a
        // decision that has not been taken.
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
    // Drafts, exactly like the finger does, and this path gained the most
    // from the change: an adjustable control is swiped repeatedly to reach
    // a value, so a commit on every increment recorded — and closed the
    // card on — the first number a screen-reader user swiped past. One
    // tick per step, and `Klaar` records.
    hapticValueMoved();
    onDraftChange(next);
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
          ref={trackRef}
          style={[styles.track, { backgroundColor: colors.surfaceSunken }]}
          // Both numbers come from the same measurement so they can never
          // describe different rectangles: the width the fraction is
          // divided by, and the left edge it is measured from. `onLayout`
          // fires on mount and on every resize (rotation, Dynamic Type,
          // a sheet re-laying out under it), which is exactly when a
          // cached page position would otherwise go stale.
          onLayout={() => {
            trackRef.current?.measureInWindow((x, _y, width) => {
              trackPageXRef.current = x;
              trackWidthRef.current = width;
              setTrackWidth(width);
            });
          }}
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

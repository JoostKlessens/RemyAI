/**
 * "Hoe lang mag het maximaal duren?" — a clock, a number, and a ladder of
 * five-minute stops you drag through.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Ik zou ook willen dat je bovenin geen
 * blokjes hebt voor hoe lang het mag duren maar een icoontje met een klokje
 * en dan 5min interval scrollen van hoe lang het recept maximaal mag
 * duren."
 *
 * ONE CONTROL, TWO SCREENS, AND NO VARIANT PROP. It replaces the time chips
 * on Kiezen (`DecisionFilterBar`'s `TIME_OPTIONS`) and the time chips on
 * Mijn recepten (`LibrarySearchBar`'s `LIBRARY_TIME_CAP_OPTIONS`), and it
 * takes exactly two props: the value and a way to report a new one. There
 * is deliberately no `variant`, no `compact`, no `labelOverride` and no
 * `accessibilityLabel` — a prop that lets one screen ship a different
 * control is how two screens quietly stop sharing one. The screens keep
 * their own eyebrow above it, which is where their difference belongs.
 *
 * ===========================================================================
 * WHY A DRAG-THROUGH-DETENTS AND NOT A SCROLL WHEEL
 * ===========================================================================
 *
 * The owner said "scrollen". What is rendered is a track with a thumb that
 * snaps to five-minute stops, which is the same gesture with a different
 * name — a finger moves left and right and the value moves with it, in the
 * interval he asked for.
 *
 * A REAL WHEEL WAS REJECTED, on two grounds and neither is taste. It needs a
 * scrolling container, and a `ScrollView` is not an `adjustable`: a screen
 * reader would find a list of 25 text nodes with no value, no increment and
 * no decrement, which is the "bare scroll view" this control exists not to
 * be. And this app carries no gesture or animation library at all — no
 * reanimated, no gesture-handler (see RatingScale.tsx's header) — so a
 * snapping wheel would be built out of `onMomentumScrollEnd` and offset
 * arithmetic, which is a lot of machinery to arrive somewhere less
 * accessible than a 44 pt track.
 *
 * ===========================================================================
 * THE TWO BUGS THE OWNER FOUND IN RatingScale, AND WHY NEITHER IS HERE
 * ===========================================================================
 *
 * 1. `locationX` MEASURED AGAINST THE WRONG ELEMENT. `locationX` is reported
 *    against whichever view the finger actually landed on, and three sit
 *    under this gesture: the thumb, the filled track and the padded touch
 *    area. Land on the 28 pt thumb and `locationX` is 0-28 divided by a
 *    track of ~317 — the value jumps to the far left when you grab the
 *    middle. So this control never reads `locationX`. It uses
 *    `gestureState.x0`, which is in window coordinates and is the same
 *    number whatever was touched, minus a left edge measured with
 *    `measureInWindow` (not `onLayout`'s `nativeEvent.layout.x`, which is
 *    relative to the parent and would be wrong by exactly the offsets this
 *    fix exists to stop guessing at).
 *
 * 2. COMMITTING ON RELEASE. RatingScale used to write a permanent grade the
 *    instant a finger lifted, so a mis-touch recorded a number and closed
 *    the card that would have let you fix it. The fix there was a draft plus
 *    a deliberate "Klaar".
 *
 *    THIS CONTROL REPORTS ON EVERY STOP IT CROSSES, AND NOTHING AT ALL ON
 *    RELEASE. That is not a softer version of the same bug, it is the other
 *    way out of it, and the difference is what the write costs. A grade is
 *    permanent, invisible afterwards, and its card leaves the screen; a cap
 *    is a filter — it is shown, it is reversible, and the control stays
 *    under your finger. A draft-then-confirm here would mean putting a
 *    "Klaar" button inside a filter bar, which is a second tap for every
 *    adjustment and an affordance no other filter on either screen has
 *    (`Chip` and `SegmentedControl` both apply on press). Releasing writes
 *    nothing because there is nothing left to write.
 *
 *    What is genuinely borrowed from that fix: it never reports a value the
 *    finger has not actually reached. `onChange` fires only when the SNAPPED
 *    cap changes, so a drag across the whole ladder emits 24 values, not one
 *    per frame.
 *
 * ===========================================================================
 * ACCESSIBILITY AND MOTION
 * ===========================================================================
 *
 * `accessibilityRole="adjustable"` with a spoken value, and increment /
 * decrement actions that move one five-minute stop — see `nudgeTimeCap` for
 * why one stop and not the coarser jump RatingScale needed. The spoken text
 * comes from timeCapCopy.ts, so a screen-reader user hears the same sentence
 * the chip row said, including the part the visible label has no room for
 * ("Gerechten zonder tijd vallen af").
 *
 * `accessibilityValue`'s min/max/now are MINUTES rather than stop indices,
 * so a platform that ignores `text` still reads a real quantity. The open
 * end of the ladder therefore has no `now` — it is not a number of minutes
 * — which is the same shape RatingScale uses for its untouched state, and
 * the reason `text` is always supplied.
 *
 * Reduced motion is read here rather than taken as a prop (`Chip` and
 * `Button` do the same), so neither screen can forget to pass it. The only
 * motion is the thumb's press scale, which collapses to 0 ms under
 * `resolveDuration` — the state still changes, it just stops animating.
 *
 * THE CLOCK ASKS `isIconAvailable` FIRST rather than rendering an `Icon` and
 * hoping. `Icon` returns null for a glyph no installed font can draw, so a
 * naive version would leave a wrapper with a gap around nothing. `clock` IS
 * available — iconFont.ts maps it onto Feather's own `clock` — so this row
 * was illustrated from day one, at a time when the dish-tag chips were not;
 * GAP-19 closed that gap on 7 September 2026 without touching this file. The
 * check is what keeps the row correct if a glyph ever moves fonts again.
 */

import { useRef, type JSX } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { hapticValueMoved } from '@/lib/haptics';
import {
  TIME_CAP_MAX_MINUTES,
  TIME_CAP_MIN_MINUTES,
  nudgeTimeCap,
  timeCapToTrackFraction,
  trackFractionToTimeCap,
  type TimeCap,
} from '@/domain/timeCap';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { Icon } from './Icon';
import { isIconAvailable } from './iconFont';
import { TIME_CAP_ACCESSIBILITY_LABEL, describeTimeCap, formatTimeCap } from './timeCapCopy';

export interface TimeCapPickerProps {
  /** The cap in force, or `null` for "geen limiet". Controlled: this component holds no value of its own. */
  readonly value: TimeCap;
  /** Called with each new stop the finger reaches — never once on release. See the header. */
  readonly onChange: (value: TimeCap) => void;
}

/** The thumb grows by this much while a finger is on it — the press feedback `Chip` gives, in the one form a track can. */
const THUMB_ACTIVE_SCALE = 1.15;

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 28;

/** 16 pt, the small end of WS4's 16-20 pt UI band — a mark introducing the value, not an illustration competing with it. */
const CLOCK_GLYPH_SIZE = 16;

/**
 * The whole gesture, kept out of the component so that function stays JSX
 * composition — the same split `useSettingsData` uses in settings.tsx.
 *
 * Everything the responder reads goes through a ref. The `PanResponder` is
 * created once, on the first render, so a closure over `value`, `onChange`
 * or the measured width would capture the first render's copy for the life
 * of the component — the mistake RatingScale.tsx documents at length.
 *
 * NO `trackWidth` STATE, unlike RatingScale, and the difference is worth a
 * line: the fill and the thumb are positioned in PERCENTAGES of the track,
 * so nothing that renders needs the measured width. Only the gesture does,
 * and a ref is enough for that. A re-render on layout would be a render
 * nobody reads.
 */
function useTimeCapGesture(value: TimeCap, onChange: (value: TimeCap) => void, reduceMotionEnabled: boolean) {
  const trackRef = useRef<View>(null);
  const trackWidthRef = useRef(0);
  const trackPageXRef = useRef(0);
  const startFractionRef = useRef(0);
  const thumbScale = useRef(new Animated.Value(1)).current;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /**
   * The last cap this control reported, which is what a new stop is
   * compared against — so one drag emits one value per stop crossed rather
   * than one per frame, and the detent buzzes once per five minutes.
   *
   * Re-seeded from the prop on every render, so a value the parent changes
   * or refuses is what the next movement is measured from.
   */
  const reportedCapRef = useRef<TimeCap>(value);
  reportedCapRef.current = value;
  /**
   * Through a ref for the same reason `onChange` is: the responder below is
   * created once, so a closure over this value would honour whatever the
   * setting was on the first render for the rest of the component's life.
   * Somebody who turns reduced motion ON while the app is open would keep
   * getting the animation, which is the one user for whom that matters.
   */
  const reduceMotionRef = useRef(reduceMotionEnabled);
  reduceMotionRef.current = reduceMotionEnabled;

  const animateThumb = (to: number): void => {
    Animated.timing(thumbScale, {
      toValue: to,
      duration: resolveDuration(motion.durationFast, reduceMotionRef.current),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  const report = (next: TimeCap): void => {
    if (next === reportedCapRef.current) {
      return;
    }
    reportedCapRef.current = next;
    // WS5 §3.4's detent, one per stop. Unlike RatingScale's — which fires
    // per whole grade because ninety per drag would be a fault — the stop
    // IS the unit here, and there are twenty-four of them end to end.
    hapticValueMoved();
    onChangeRef.current(next);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_event, gesture) => {
        if (trackWidthRef.current === 0) {
          return;
        }
        // A tap anywhere on the track jumps there, so the finger never has
        // to find a 28 pt thumb first. `x0` is in window coordinates — see
        // the header for why the old `locationX` reading could not be.
        const start = (gesture.x0 - trackPageXRef.current) / trackWidthRef.current;
        startFractionRef.current = Math.min(1, Math.max(0, start));
        report(trackFractionToTimeCap(startFractionRef.current));
        animateThumb(THUMB_ACTIVE_SCALE);
      },
      onPanResponderMove: (_event, gesture) => {
        if (trackWidthRef.current === 0) {
          return;
        }
        // Offset from where the gesture began rather than the raw touch
        // position: `locationX` during a move is reported against whichever
        // view captured the responder and is not consistent across
        // platforms, while `dx` is the same everywhere.
        report(trackFractionToTimeCap(startFractionRef.current + gesture.dx / trackWidthRef.current));
      },
      // NOTHING IS REPORTED ON RELEASE OR TERMINATION, and that is the
      // second of the two bugs this control refuses to reintroduce. Every
      // stop the finger reached was already reported as it was reached, so
      // there is nothing left for letting go to mean.
      onPanResponderRelease: () => animateThumb(1),
      onPanResponderTerminate: () => animateThumb(1),
    }),
  ).current;

  const onTrackLayout = (): void => {
    // Both numbers come from the same measurement so they can never
    // describe different rectangles: the width the fraction is divided by,
    // and the left edge it is measured from. `onLayout` fires on mount and
    // on every resize (rotation, Dynamic Type, a bar re-laying out), which
    // is exactly when a cached page position would otherwise go stale.
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackPageXRef.current = x;
      trackWidthRef.current = width;
    });
  };

  return { panHandlers: panResponder.panHandlers, trackRef, onTrackLayout, thumbScale };
}

export function TimeCapPicker(props: TimeCapPickerProps): JSX.Element {
  const { value, onChange } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();
  const gesture = useTimeCapGesture(value, onChange, reduceMotionEnabled);
  const fraction = timeCapToTrackFraction(value);

  const handleAccessibilityAction = (action: 'increment' | 'decrement'): void => {
    const next = nudgeTimeCap(value, action === 'increment' ? 1 : -1);
    if (next === value) {
      // Pinned at an end. A control that buzzes for a no-op teaches the
      // hand that the buzz means nothing — `SegmentedControl` guards its
      // own haptic the same way.
      return;
    }
    hapticValueMoved();
    onChange(next);
  };

  return (
    <View style={styles.container}>
      <TimeCapReadout value={value} colors={colors} />

      <View
        style={styles.touchArea}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={TIME_CAP_ACCESSIBILITY_LABEL}
        accessibilityValue={{
          min: TIME_CAP_MIN_MINUTES,
          max: TIME_CAP_MAX_MINUTES,
          // No `now` for the open end: it is not a number of minutes, and
          // inventing one would report a cap nobody set. `text` carries it.
          now: value ?? undefined,
          text: describeTimeCap(value),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          const name = event.nativeEvent.actionName;
          if (name === 'increment' || name === 'decrement') {
            handleAccessibilityAction(name);
          }
        }}
        {...gesture.panHandlers}
      >
        <View
          ref={gesture.trackRef}
          style={[styles.track, { backgroundColor: colors.surfaceSunken }]}
          onLayout={gesture.onTrackLayout}
        >
          <View style={[styles.trackFilled, { backgroundColor: colors.accent, width: `${fraction * 100}%` }]} />
          <Animated.View
            style={[
              styles.thumb,
              {
                backgroundColor: colors.accent,
                borderColor: colors.surface,
                left: `${fraction * 100}%`,
                transform: [{ translateX: -THUMB_SIZE / 2 }, { scale: gesture.thumbScale }],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * The clock and the number it introduces.
 *
 * Hidden from assistive tech in one piece: the track below already reports
 * the same value through `accessibilityValue`, and announcing it twice is
 * how a screen reader turns one cap into two. `Icon` marks every glyph as
 * not-an-accessibility-element on its own, but the number beside it would
 * otherwise be read.
 */
function TimeCapReadout(props: { readonly value: TimeCap; readonly colors: ReturnType<typeof getColors> }): JSX.Element {
  const { value, colors } = props;
  return (
    <View style={styles.readout} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {isIconAvailable('clock') ? <Icon name="clock" size={CLOCK_GLYPH_SIZE} color={colors.textSecondary} /> : null}
      <Text style={[typeScale.numeral, { color: colors.textPrimary }]}>{formatTimeCap(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    // No gap around nothing: with the clock absent this row holds one
    // child, and `gap` contributes only between children.
    gap: spacing.space2,
    marginBottom: spacing.space1,
  },
  // The track itself is 4 pt tall; the touch area around it clears the 44 pt
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
});

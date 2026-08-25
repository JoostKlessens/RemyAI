/**
 * The optional "Hoe was het?" score, shown inside `OutcomeCard`'s
 * follow-up phase once "Gemaakt?" has been answered with "Ja".
 *
 * WHY NOT REUSE `Chip`: the visual language is deliberately the same one
 * (`surfaceSunken` fill + outline when unselected, `accentMuted` +
 * `accent` 1.5px border + `accentOnMuted` text when selected, the same
 * 0.96 press scale and `focusRing` treatment), but `Chip` sets its label
 * in `typeScale.body` — Archivo, the family docs/DESIGN.md reserves for
 * things you *read*. A score is measured, not read, so it belongs in mono
 * with the timers and counts ("timecode burned into the frame"). These
 * chips are also equal-width cells rather than a content-width wrap row,
 * because a scale whose "1" is narrower than its "5" reads as a ranking of
 * importance instead of as evenly spaced steps. Parameterising `Chip` with
 * a type-scale prop was the alternative and was rejected: it pushes a
 * purely typographic decision into every one of its unrelated call sites.
 *
 * THE NUMBER OF CHIPS IS NOT DECIDED HERE. `buildRatingOptions()` derives
 * the whole row from src/domain/rating.ts's RATING_MIN/RATING_MAX, so a
 * move to a Dutch 1-10 scale re-renders correctly with no edit to this
 * file. Nothing below may ever count, cap, or special-case "five".
 *
 * ACCESSIBILITY: the row is a single-select `radiogroup` of `radio` chips,
 * never the checkbox default — the same A8 correction `DeclineReasonRow`
 * carries, for the same reason: a screen reader announcing "toggle any
 * number of these" is simply wrong for a one-at-a-time choice. The anchor
 * row ("Nooit meer" / "Graag weer") is hidden from assistive tech on
 * purpose; `buildRatingOptions` already folds those words into the two end
 * chips' own labels, so exposing the row as well would read the scale's
 * meaning out twice while leaving the middle chips bare.
 */

import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import {
  RATING_ANCHOR_HIGH,
  RATING_ANCHOR_LOW,
  RATING_GROUP_ACCESSIBILITY_LABEL,
  type RatingOption,
  buildRatingOptions,
} from './ratingScaleCopy';

export interface RatingScaleProps {
  /** The score picked so far, or null while the question is unanswered — which is a complete, permitted end state, not a validation failure. */
  readonly selected: number | null;
  readonly onSelect: (rating: number) => void;
  readonly reduceMotionEnabled: boolean;
  /** Set once a score is committed, so a second tap during the dismiss beat cannot quietly record a different one. */
  readonly disabled?: boolean;
}

/** Matches `Chip`'s press feedback exactly — the two sit in the same product moment. */
const PRESS_SCALE = 0.96;

export function RatingScale(props: RatingScaleProps): JSX.Element {
  const { selected, onSelect, reduceMotionEnabled, disabled = false } = props;
  const options = buildRatingOptions();

  return (
    <View style={styles.container}>
      {/* ChipGroup's A9 pattern: React Native only exposes an
          `accessibilityLabel` on a container when it is paired with a real
          role, so both are set together here. `accessible` is deliberately
          left off — setting it would collapse every chip into one
          unreadable node. */}
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={RATING_GROUP_ACCESSIBILITY_LABEL}>
        {options.map((option) => (
          <RatingChip
            key={option.value}
            option={option}
            selected={selected === option.value}
            onPress={() => onSelect(option.value)}
            reduceMotionEnabled={reduceMotionEnabled}
            disabled={disabled}
          />
        ))}
      </View>
      <AnchorRow />
    </View>
  );
}

interface RatingChipProps {
  readonly option: RatingOption;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly reduceMotionEnabled: boolean;
  readonly disabled: boolean;
}

/**
 * One cell of the scale. Split into its own component rather than inlined
 * in the `.map()` above because each chip needs its own `Animated.Value`
 * for the press scale, and a hook cannot be called inside a loop (Rules of
 * Hooks). Same structure `Chip` uses, one level down.
 */
function RatingChip(props: RatingChipProps): JSX.Element {
  const { option, selected, onPress, reduceMotionEnabled, disabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const scale = useRef(new Animated.Value(1)).current;
  // Wires the focusRing token into keyboard / Switch Control focus, the
  // same way Chip and Button do.
  const [isFocused, setIsFocused] = useState(false);

  const animateTo = (toValue: number): void => {
    Animated.timing(scale, {
      toValue,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={[styles.cell, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(PRESS_SCALE)}
        onPressOut={() => animateTo(1)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, disabled }}
        accessibilityLabel={option.accessibilityLabel}
        style={[
          styles.chip,
          {
            backgroundColor: selected ? colors.accentMuted : colors.surfaceSunken,
            // borderStrong rather than Chip's `border`: this is an
            // interactive component boundary (WCAG 1.4.11, >=3:1), and
            // these chips sit on the card's `positiveMuted` wash, where
            // the decorative `border` token manages only 1.27:1 while
            // borderStrong clears 4.27:1. tests/contrast.test.ts guards
            // both of the pairs used here.
            borderColor: selected ? colors.accent : colors.borderStrong,
            borderWidth: selected ? 1.5 : 1,
          },
          isFocused ? { borderWidth: 2, borderColor: colors.focusRing } : null,
        ]}
      >
        {/* No numberOfLines cap and no maxFontSizeMultiplier: a numeral has
            nothing to truncate, and docs/DESIGN.md forbids capping Dynamic
            Type anywhere — the cell grows instead. A3: the selected label
            is accentOnMuted, never `accent`, which only clears 3:1 on
            accentMuted and so is fine for the border above but not for
            text. */}
        <Text style={[typeScale.numeral, { color: selected ? colors.accentOnMuted : colors.textPrimary }]}>
          {option.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * What the two ends of the scale mean, in consequence terms rather than
 * adjectives about the food. Hidden from assistive tech on both platforms
 * (iOS honours `accessibilityElementsHidden`, Android
 * `importantForAccessibility`) — see this file's header for why.
 */
function AnchorRow(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.anchors} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>{RATING_ANCHOR_LOW}</Text>
      <Text style={[typeScale.caption, { color: colors.textMuted }]}>{RATING_ANCHOR_HIGH}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.space2,
    width: '100%',
  },
  cell: {
    // Equal shares of the row, so the steps read as evenly spaced rather
    // than as a ranking — see this file's header.
    flex: 1,
  },
  chip: {
    borderRadius: radii.radiusSm,
    minHeight: spacing.touchTargetMin,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.space2,
  },
});

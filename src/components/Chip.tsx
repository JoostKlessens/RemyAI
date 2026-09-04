/**
 * The single chip primitive: quick-pick grid items in Rotation Seeding,
 * dislike/allergen tags in Household setup, and the optional decline-reason
 * row on Vanavond (afhalen / restjes / uit eten). Selected state is
 * conveyed by fill + border colour change only — deliberately no checkmark
 * icon, per docs/DESIGN.md ("the fill change alone must read as selected
 * from arm's length").
 */

import { useRef, useState, type JSX } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useColorScheme } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { hapticValueMoved } from '@/lib/haptics';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export interface ChipProps {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress: () => void;
  readonly accessibilityLabel?: string;
  readonly disabled?: boolean;
  readonly testID?: string;
  /**
   * A8: single-select chip groups (e.g. `DeclineReasonRow`) must announce
   * radio semantics, not checkbox — screen readers otherwise imply
   * "toggle any number of these," which is wrong for a `T | null` choice.
   * Defaults to 'checkbox', the correct role for every existing
   * multi-select usage (quick-pick grid, restriction tags).
   */
  readonly role?: 'checkbox' | 'radio';
}

const PRESS_SCALE = 0.96;

export function Chip(props: ChipProps): JSX.Element {
  const { label, selected = false, onPress, accessibilityLabel, disabled, testID, role = 'checkbox' } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  // A9: wires the previously-unused focusRing token into keyboard/Switch
  // Control focus, matching the same pattern added to Button.
  const [isFocused, setIsFocused] = useState(false);

  /**
   * WS5 §3.2: a chip selection is "a value moved, and it is reversible" —
   * `selectionAsync`, ON SELECT ONLY. Deselecting undoes a choice, it does
   * not make one, and buzzing for both halves of a toggle is how a chip
   * grid ends up vibrating twice for one change of mind.
   *
   * Read from `selected` rather than from what `onPress` is about to do:
   * this component does not own the value, so the state it is rendering is
   * the only thing it can honestly test against.
   */
  const handlePress = (): void => {
    if (!selected) {
      hapticValueMoved();
    }
    onPress();
  };

  const animateTo = (toValue: number): void => {
    Animated.timing(scale, {
      toValue,
      duration: resolveDuration(motion.durationFast, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => animateTo(PRESS_SCALE)}
        onPressOut={() => animateTo(1)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        accessibilityRole={role}
        accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
        style={[
          styles.base,
          {
            backgroundColor: selected ? colors.accentMuted : colors.surfaceSunken,
            borderColor: selected ? colors.accent : colors.border,
            borderWidth: selected ? 1.5 : 1,
          },
          disabled ? styles.disabled : null,
          isFocused ? { borderWidth: 2, borderColor: colors.focusRing } : null,
        ]}
      >
        {/* A6: no numberOfLines cap — docs/DESIGN.md prefers letting a row
            grow over capping it, and a truncated label ("Aardappelpuree
            met worst" -> "Aardappelpuree...") is unreadable at 200% type. */}
        {/* A3: selected text uses accentOnMuted, not accent — accent only
            clears 3:1 against accentMuted (fine for the border above, not
            for text), accentOnMuted clears 4.5:1. */}
        <Text style={[typeScale.body, { color: selected ? colors.accentOnMuted : colors.textPrimary }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space4,
    paddingVertical: spacing.space3,
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

/**
 * The single button primitive used everywhere in Remy. Four variants map
 * directly onto the token system's visual hierarchy — see docs/DESIGN.md:
 * `primary` (accent fill, e.g. Vanavond "Ja"), `secondary` (surface +
 * border, e.g. "Iets anders"), `tertiary` (text only, lowest visual
 * weight, e.g. "Niet koken"), `positive` (moss fill, reserved for
 * completion moments like Cook Mode's "Klaar" or the outcome card).
 *
 * Press feedback is a shared micro-interaction (durationInstant scale to
 * 0.98), honouring reduce-motion via `resolveDuration`.
 */

import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  type TextStyle,
  useColorScheme,
  type ViewStyle,
} from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { type ColorTokens, getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'positive';

export interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant: ButtonVariant;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly disabled?: boolean;
  /** Replaces the label with an inline spinner and implies `disabled`. */
  readonly loading?: boolean;
  readonly minHeight?: number;
  readonly testID?: string;
}

const PRESS_SCALE = 0.98;

export function Button(props: ButtonProps): JSX.Element {
  const { label, onPress, variant, accessibilityLabel, accessibilityHint, disabled, loading, minHeight, testID } =
    props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const reduceMotionEnabled = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;
  // A9: focusRing was defined in tokens.ts but never consumed anywhere.
  // onFocus/onBlur fire for keyboard nav and Switch Control focus (not
  // just touch), which Pressable's `pressed` render-prop doesn't cover.
  const [isFocused, setIsFocused] = useState(false);

  const animateTo = (toValue: number): void => {
    Animated.timing(scale, {
      toValue,
      duration: resolveDuration(motion.durationInstant, reduceMotionEnabled),
      easing: Easing.bezier(...motion.easingStandard),
      useNativeDriver: true,
    }).start();
  };

  const variantStyle = getVariantStyle(variant, colors);
  const isTertiary = variant === 'tertiary';

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(PRESS_SCALE)}
        onPressOut={() => animateTo(1)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
        testID={testID}
        style={({ pressed }) => [
          styles.base,
          variantStyle.container,
          { minHeight: minHeight ?? spacing.touchTargetMin + 8 },
          isDisabled ? styles.disabled : null,
          pressed && isTertiary ? styles.tertiaryPressed : null,
          isFocused ? { borderWidth: 2, borderColor: colors.focusRing } : null,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyle.text.color} />
        ) : (
          <Text style={[isTertiary ? typeScale.bodySmall : typeScale.button, variantStyle.text]} numberOfLines={2}>
            {label}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface VariantStyle {
  readonly container: ViewStyle;
  readonly text: TextStyle;
}

function getVariantStyle(variant: ButtonVariant, colors: ColorTokens): VariantStyle {
  switch (variant) {
    case 'primary':
      return {
        container: { backgroundColor: colors.accent, borderWidth: 0 },
        text: { color: colors.onAccent },
      };
    case 'secondary':
      return {
        // A9: borderColor uses borderStrong, not border — this outline IS
        // the affordance that identifies the button as an interactive
        // control, so it needs WCAG 1.4.11's 3:1 non-text contrast, which
        // only borderStrong clears (see tokens.ts).
        container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
        text: { color: colors.textPrimary },
      };
    case 'positive':
      return {
        container: { backgroundColor: colors.positive, borderWidth: 0 },
        text: { color: colors.onPositive },
      };
    case 'tertiary':
      return {
        container: { backgroundColor: 'transparent', borderWidth: 0 },
        text: { color: colors.textMuted },
      };
    default: {
      // Exhaustiveness guard, mirroring src/domain/reason.ts: if
      // ButtonVariant ever gains a member, this is a compile error here,
      // not a silent fallthrough to tertiary styling.
      const exhaustiveCheck: never = variant;
      throw new Error(`Unhandled ButtonVariant: ${String(exhaustiveCheck)}`);
    }
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space4,
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  tertiaryPressed: {
    opacity: 0.6,
  },
});

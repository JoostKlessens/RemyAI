/**
 * The single button primitive used everywhere in Remy. Four variants map
 * directly onto the token system's visual hierarchy — see docs/DESIGN.md:
 * `primary` (accent fill, e.g. Vanavond's "Dit koken" — that button
 * read "Ja" until 7 September 2026, see vanavondActionCopy.ts),
 * `secondary` (surface + border, e.g. "Iets anders"), `tertiary` (text
 * only, lowest visual weight, e.g. "Niet koken"), `positive` (moss fill,
 * reserved for completion moments like Cook Mode's "Klaar" or the
 * outcome card).
 *
 * Press feedback is a shared micro-interaction (durationInstant scale to
 * 0.98), honouring reduce-motion via `resolveDuration`.
 *
 * =========================================================================
 * THIS BUTTON IS NOT FLEX-ABLE, AND A ROW OF THEM NEEDS WRAPPERS
 * =========================================================================
 *
 * The `Animated.View` below carries no style but its press transform, and
 * the `Pressable` inside it sets `width: '100%'`. In a COLUMN that is
 * correct and invisible: Yoga's default `alignItems: 'stretch'` gives the
 * `Animated.View` the parent's full width, so `100%` resolves against a
 * real number. In a `flexDirection: 'row'` parent it silently does not —
 * a row child with no `flex` sizes to its own CONTENT, so `100%` resolves
 * against a box the label just defined, and two buttons come out at two
 * different widths rather than as two halves.
 *
 * `VanavondActionRow` is the only horizontal row of these in the app and
 * it wraps each button in its own `<View style={{ flex: 1 }}>` for exactly
 * this reason — that wrapper has a definite width, so the chain resolves.
 *
 * THE REJECTED ALTERNATIVE WAS A `style` OR `flex` PROP HERE. It is one
 * line and it is the wrong line: 27 files import this component across 66
 * call sites (both measured 7 September 2026), and a style escape hatch on
 * a primitive that widely used is how a design system stops being one —
 * the next caller passes a colour through it. The wrapper costs one `View`
 * at the single site that needs it and changes nothing for the other 65.
 */

import { useRef, useState, type JSX } from 'react';
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

/**
 * The one place opacity survived this component's disabled state, and it is
 * `tertiary`-only — `getDisabledStyle` below carries the argument for why the
 * other three variants stopped using it. Held a step under `tertiaryPressed`'s
 * 0.6 on purpose, so "unavailable" and "being pressed" never resolve to the
 * same value on the one variant that expresses both by fading.
 */
const DISABLED_TERTIARY_OPACITY = 0.5;

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

  // Disabled is a state of its own, not the active one at half strength —
  // see getDisabledStyle. Resolved here rather than layered on top of the
  // active style so the spinner below, which reads `variantStyle.text.color`,
  // gets the disabled ink too; `loading` implies `isDisabled`.
  const variantStyle = isDisabled ? getDisabledStyle(variant, colors) : getVariantStyle(variant, colors);
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

/**
 * =========================================================================
 * DISABLED IS ITS OWN STATE, NOT THE ACTIVE ONE AT HALF STRENGTH
 * =========================================================================
 *
 * Until 9 September 2026 this state was `opacity: 0.5` on the container and
 * nothing else, and the screenshots taken that day — "Importeren" on
 * /import/paste with an empty field, "Stuur me een code" on /sign-in with an
 * empty field — showed what that does to a SATURATED fill. Compositing
 * `accent` (#006D35) at half opacity over the light ground gives #72AB8D: a
 * mid sage green that keeps 61% of accent's chroma (0.075 against 0.123) and
 * sits 0.230 from `accent` in OKLab. For scale, the distance this palette
 * maintains between its two SEMANTIC greens — `accent` "being chosen" against
 * `positive` "done" — measures 0.138 in light and 0.165 in dark
 * (tests/contrast.test.ts, "green role separation"). So halving the opacity
 * did not dim the button; it moved it further from `accent` than the app's two
 * distinct green roles sit from each other. A third green, and a perfectly
 * plausible primary button: both screenshots read as enabled until you pressed
 * them and nothing happened. Dark was no better — #4B8157, chroma 0.087,
 * distance 0.284.
 *
 * SO A DISABLED CONTROL IS NOW A WELL RATHER THAN A BUTTON. Every variant that
 * has a fill collapses onto the same neutral pair, `textMuted` on
 * `surfaceSunken`: 4.76:1 in light and 8.27:1 in dark, clearing WCAG 1.4.3's
 * 4.5:1 in both schemes even though an inactive component is exempt from it.
 * That is not a number this file has to defend alone — `textMuted` against all
 * four neutral surfaces is already a row in tests/contrast.test.ts, so a
 * retune of either token fails the suite rather than this state. The fill
 * carries no hue left to misread (chroma 0.007 light, 0.011 dark) and it is
 * the one surface BELOW the page: dL* 5.33 under `background` and 12.13 under
 * `surface` in light, 8.07 and 15.49 in dark. Furniture pressed into the page,
 * not an action sitting on it.
 *
 * A STATE CHANGE MUST NOT ERASE A VARIANT'S IDENTITY, which is why this is a
 * switch rather than one shared style object. `secondary` keeps its 1 pt
 * `borderStrong` outline while disabled, because that outline is what makes it
 * the outlined variant. Softening it to the decorative `border` token was the
 * rejected alternative and it is worth naming: at 1.29:1 against
 * `surfaceSunken` in light that hairline effectively disappears, which turns
 * the outlined button into exactly the plain filled slab this state exists to
 * avoid. `borderStrong` measures 3.54:1 there in light and 6.22:1 in dark.
 * WCAG 1.4.11 requires neither number on an inactive component — the outline
 * is kept for identity, not for compliance.
 *
 * `tertiary` IS THE ONE VARIANT OPACITY STILL DOES THE WORK FOR, and it has to
 * be: it has no fill to neutralise and its enabled label is ALREADY
 * `textMuted`, so neither half of the treatment above has anything to say
 * about it. Giving it the `surfaceSunken` well for symmetry was tried and is
 * wrong — the lowest-weight variant in the system would grow a box at the
 * moment it stops working, heavier disabled than enabled. Fading is honest
 * here for the same reason it was dishonest above: a near-neutral ink on a
 * near-neutral ground (chroma 0.007 light, 0.016 dark) has nowhere else to
 * land, it just slides down the same grey ramp (#585C59 -> #9EA29F on
 * `background` in light), where `accent` acquired a second identity. Chip.tsx
 * keeps `opacity: 0.5` for precisely this reason — its enabled fill is
 * `surfaceSunken` already.
 *
 * `loading` inherits all of it, since `isDisabled` is `disabled || loading`,
 * and the spinner is tinted from `text.color` so it becomes `textMuted` on the
 * same well. Branching the two so a request in flight kept its `accent` fill
 * was considered and dropped: the spinner is already the "in flight" signal,
 * the fill's job in both cases is the identical "you cannot press this now",
 * and a third visual state for two props is how a primitive this widely used
 * starts collecting them.
 */
function getDisabledStyle(variant: ButtonVariant, colors: ColorTokens): VariantStyle {
  const label: TextStyle = { color: colors.textMuted };

  switch (variant) {
    case 'primary':
    case 'positive':
      return {
        container: { backgroundColor: colors.surfaceSunken, borderWidth: 0 },
        text: label,
      };
    case 'secondary':
      return {
        container: { backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.borderStrong },
        text: label,
      };
    case 'tertiary':
      return {
        container: { backgroundColor: 'transparent', borderWidth: 0, opacity: DISABLED_TERTIARY_OPACITY },
        text: label,
      };
    default: {
      // Same guard as getVariantStyle above, and it earns its keep twice over
      // here: a new ButtonVariant must be given a disabled treatment
      // deliberately, not inherit whichever branch happened to be last.
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
  tertiaryPressed: {
    opacity: 0.6,
  },
});

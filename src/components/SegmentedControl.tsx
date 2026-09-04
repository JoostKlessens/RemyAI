/**
 * Generic segmented control. Used for the Household setup weeknight time
 * budget (15 / 30 / 45+ min) — generic over the value union so it is not
 * tied to that one call site.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { hapticValueMoved } from '@/lib/haptics';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface SegmentedControlOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedControlProps<T extends string> {
  readonly options: readonly SegmentedControlOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly accessibilityLabel: string;
}

export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>): JSX.Element {
  const { options, value, onChange, accessibilityLabel } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View
      // A9: borderColor uses borderStrong (>=3:1 against every surface),
      // not border — this track outline is the interactive control's
      // visible boundary, which WCAG 1.4.11 requires at 3:1.
      style={[styles.track, { backgroundColor: colors.surfaceSunken, borderColor: colors.borderStrong }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            // WS5 §3.2: "a segmented control changes scope" is a value
            // moved — `selectionAsync`. Guarded on `selected` because
            // tapping the segment you are already on changes nothing, and
            // a control that buzzes for a no-op teaches the hand that the
            // buzz means nothing.
            onPress={() => {
              if (!selected) {
                hapticValueMoved();
              }
              onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            style={[styles.segment, selected ? { backgroundColor: colors.accentMuted } : null]}
          >
            {/* A3: accentOnMuted, not accent — accent only clears 3:1
                against accentMuted (a fill), this label is text and
                needs 4.5:1. */}
            <Text style={[typeScale.body, { color: selected ? colors.accentOnMuted : colors.textSecondary }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radii.radiusSm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.space3,
  },
});

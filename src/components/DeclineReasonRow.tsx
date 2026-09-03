/**
 * PD-002's optional, ignorable chip row shown after "Niet koken" is
 * confirmed. Never gates on a choice — the confirmed state above this row
 * is already complete without it. Selecting a chip flashes `positiveMuted`
 * briefly (a completed action, not a decision-in-progress) rather than
 * using `accent`, matching the Feed save-sheet treatment in
 * docs/DESIGN.md.
 */

import { useEffect, useRef, type JSX } from 'react';
import { Animated, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { DeclineReason } from '@/domain/types';
import { getColors, motion, radii, resolveDuration, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';

export interface DeclineReasonRowProps {
  readonly selectedReason: DeclineReason | null;
  readonly onSelectReason: (reason: DeclineReason) => void;
  readonly reduceMotionEnabled: boolean;
}

interface DeclineOption {
  readonly value: DeclineReason;
  readonly label: string;
}

const OPTIONS: readonly DeclineOption[] = [
  { value: 'afhalen', label: 'Afhalen' },
  { value: 'restjes', label: 'Restjes' },
  { value: 'uit_eten', label: 'Uit eten' },
];

export function DeclineReasonRow(props: DeclineReasonRowProps): JSX.Element {
  const { selectedReason, onSelectReason, reduceMotionEnabled } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selectedReason === null) {
      return;
    }
    flashOpacity.setValue(1);
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: resolveDuration(motion.durationNormal, reduceMotionEnabled),
      useNativeDriver: true,
    }).start();
  }, [selectedReason, flashOpacity, reduceMotionEnabled]);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.bodySmall, styles.helper, { color: colors.textMuted }]}>
        Wil je delen waarom? Helemaal niet verplicht.
      </Text>
      <View style={styles.chipWrap}>
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { backgroundColor: colors.positiveMuted, opacity: flashOpacity }]}
        />
        {/* A8: single-select (DeclineReason | null), so this is a
            radiogroup of radio chips, not the checkbox default —
            otherwise a screen reader announces "toggle any of these,"
            which is wrong for a one-at-a-time choice. */}
        <ChipGroup accessibilityLabel="Reden voor niet koken, optioneel" accessibilityRole="radiogroup">
          {OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={selectedReason === option.value}
              onPress={() => onSelectReason(option.value)}
              accessibilityLabel={`${option.label}, optionele reden`}
              role="radio"
            />
          ))}
        </ChipGroup>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  helper: {
    marginBottom: spacing.space3,
    textAlign: 'center',
  },
  chipWrap: {
    position: 'relative',
  },
  flash: {
    position: 'absolute',
    top: -spacing.space2,
    left: -spacing.space2,
    right: -spacing.space2,
    bottom: -spacing.space2,
    borderRadius: radii.radiusMd,
  },
});

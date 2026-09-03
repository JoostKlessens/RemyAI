/**
 * The single 2px progress line used by both Rotation Seeding/Household
 * setup ("(index+1)/total") and Cook Mode ("Stap 3/7"). Fills left-to-right
 * with `accent`.
 */

import type { JSX } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import { getColors } from '@/theme/tokens';

export interface ProgressRuleProps {
  /** 0..1 */
  readonly progress: number;
  readonly accessibilityLabel?: string;
}

export function ProgressRule(props: ProgressRuleProps): JSX.Element {
  const { progress, accessibilityLabel } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? 'Voortgang'}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View style={[styles.fill, { backgroundColor: colors.accent, width: `${clamped * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 2,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

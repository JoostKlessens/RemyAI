/**
 * Wrap-layout container for `Chip` rows/grids (quick-pick grid, tag lists,
 * the decline-reason row). No visual styling of its own beyond the gap
 * grid — purely a layout primitive.
 */

import type { ReactNode, JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/theme/tokens';

export interface ChipGroupProps {
  readonly children: ReactNode;
  readonly accessibilityLabel?: string;
  /**
   * A9: previously `accessibilityLabel` was set on a plain `View` with no
   * `accessibilityRole` and no `accessible` — React Native never exposes
   * that combination to assistive tech, so the label was inert dead code.
   * Only pass `accessibilityRole="radiogroup"` (together with
   * `accessibilityLabel`) for a genuinely single-select group — matching
   * the working pattern in `SegmentedControl`. Setting `accessible={true}`
   * instead would collapse every child `Chip` into one unreadable node,
   * so that's deliberately not done here. Leave both unset for
   * multi-select grids (quick-pick, tag lists) — each `Chip`'s own
   * checkbox semantics are already sufficient there.
   */
  readonly accessibilityRole?: 'radiogroup';
}

export function ChipGroup(props: ChipGroupProps): JSX.Element {
  const { children, accessibilityLabel, accessibilityRole } = props;

  return (
    <View
      style={styles.wrap}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityRole ? accessibilityLabel : undefined}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.space2,
  },
});

/**
 * The one consent control in this product: a tappable row with a checkbox
 * and the sentence the household is agreeing to.
 *
 * WHY IT IS A COMPONENT rather than three copies of the same JSX. It now
 * has three call sites — the per-member allergen consent (PD-005,
 * MemberPreferencesSection.tsx), the household cook-proof opt-in (PD-015 /
 * DESIGN-SOCIAL.md §5, CookSharingSection.tsx) and that opt-in's one-time
 * contextual ask (CookSharingAskSheet.tsx) — and every one of them is a
 * place where a rendering mistake is a privacy mistake. Two of the details
 * below are easy to get wrong independently and expensive to get wrong at
 * all: the glyph must be `accentOnMuted` rather than `accent`, because
 * plain `accent` on an `accentMuted` fill does not clear 4.5:1 (WCAG AA);
 * and the row must carry `accessibilityRole="checkbox"` with a live
 * `accessibilityState.checked`, or a screen-reader user is told a button
 * exists but never told whether consent is currently given.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it renders no explanation of its own.
 * The consequence belongs above the control in full sentences (PD-005's
 * unbundled-consent discipline, restated by §5 for cook proof), and a
 * component that accepted a `helperText` prop would make it possible to
 * ship a bare control with a tooltip — exactly the shape both decisions
 * rule out. Callers lay out their own prose and then mount this.
 *
 * REJECTED: React Native's `Switch`. It looks like the "switch" the design
 * doc names, but its on/off track colours are platform-themed and would
 * either bypass the token system or need per-platform overrides, and its
 * label has to be rendered beside it anyway — so the touch target ends up
 * hand-built regardless. A checkbox row is also the established precedent
 * in settings.tsx, and consent that looks the same everywhere is easier to
 * recognise than consent that changes shape per section.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface ConsentCheckboxRowProps {
  readonly checked: boolean;
  /** The sentence being agreed to, rendered beside the box. */
  readonly label: string;
  /** Spoken label — should restate the consequence, since a screen reader may land here directly. */
  readonly accessibilityLabel: string;
  readonly onToggle: () => void;
  readonly testID?: string;
}

export function ConsentCheckboxRow(props: ConsentCheckboxRowProps): JSX.Element {
  const { checked, label, accessibilityLabel, onToggle, testID } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={styles.row}
      testID={testID}
    >
      <View
        style={[
          styles.box,
          { borderColor: colors.border, backgroundColor: checked ? colors.accentMuted : colors.surface },
        ]}
      >
        {/* accentOnMuted, not accent: this glyph sits on an accentMuted
            fill, where plain accent doesn't clear 4.5:1 (WCAG AA). */}
        {checked ? <Text style={{ color: colors.accentOnMuted }}>✓</Text> : null}
      </View>
      <Text style={[typeScale.bodySmall, styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space3,
    minHeight: spacing.touchTargetMin,
  },
  box: {
    width: spacing.space6,
    height: spacing.space6,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
});

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
 * all: the checked fill and its glyph have to clear their contrast floors
 * as a PAIR — see the body, where the current pair is stated with its
 * measurements — and the row must carry `accessibilityRole="checkbox"` with
 * a live `accessibilityState.checked`, or a screen-reader user is told a
 * button exists but never told whether consent is currently given.
 *
 * ⚠ AMENDED 9 SEPTEMBER 2026. This paragraph used to name the pair here, in
 * the header: "the glyph must be `accentOnMuted` rather than `accent`,
 * because plain `accent` on an `accentMuted` fill does not clear 4.5:1". The
 * reasoning was sound and the tokens are no longer the ones in use, which is
 * exactly how a header starts lying about its own file. The rule kept its
 * teeth and moved to the two lines it governs; what survives up here is the
 * requirement, not one particular answer to it.
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
          { borderColor: colors.border, backgroundColor: checked ? colors.accent : colors.surface },
        ]}
      >
        {/*
          A CHECKED BOX IS FILLED DARK, NOT PALE — 9 September 2026, and the
          old pair here was `accentMuted` with an `accentOnMuted` tick.

          WHAT WAS WRONG WITH IT, MEASURED. `accentMuted` is CIE L* 93.33 in
          light, against a `background` of 91.62 and a `surface` of 98.42 —
          so a checked box sat between its own unchecked state and the page,
          separated from neither by more than 5 L*, and the ONLY thing making
          it visible was OKLab chroma 0.110 on a ramp that runs 0.003-0.009.
          A pale bright fill reads as "available", not as "on"; this is the
          same finding SegmentedControl.tsx records for its selected segment,
          and it matters more here, because on this control the difference
          between on and off is a privacy decision.

          WHAT IT IS NOW. `accent` fills the box and the tick is drawn in
          `surfaceRaised`. The checked state is now the DARKEST thing in the
          row rather than the brightest: 51.72 L* below the page in light,
          70.90 above it in dark. Contrast against the page is 5.24:1 light
          and 10.42:1 dark, both clearing 1.4.11's 3:1 for a non-text control,
          which the old fill did NOT (1.05:1 against `background`) — it
          depended on its 1 pt `border` alone to be a shape at all. The tick
          measures 6.48:1 on the fill in light and 6.87:1 in dark, so the
          4.5:1 floor the previous comment defended is kept, not traded.
        */}
        {checked ? <Text style={{ color: colors.surfaceRaised }}>✓</Text> : null}
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

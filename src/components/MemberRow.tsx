/**
 * A single household member row in Household setup: avatar-initial chip +
 * name, hairline-separated (no boxed card per field, per docs/DESIGN.md).
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface MemberRowProps {
  readonly displayName: string;
  readonly onRemove?: () => void;
}

export function MemberRow(props: MemberRowProps): JSX.Element {
  const { displayName, onRemove } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
        {/*
          A RAISED DISC WITH A GREEN LETTER, NOT A GREEN DISC — 9 September
          2026. What stood here filled the circle with `accentMuted` and drew
          the initial in `accentOnMuted`. Measured against the page this row
          actually sits on (settings.tsx renders on `background`, no card),
          that fill was doing the opposite of its job in the light scheme:
          `accentMuted` is CIE L* 93.33 against the ground's 91.62, so the
          disc stood 1.70 L* / 1.05:1 from the page and was barely a shape at
          all — while carrying OKLab chroma 0.110 against a neutral ramp that
          runs 0.003-0.009. It was invisible as a form and the loudest thing
          on the screen as a colour, which is why it started to stand out
          once the neutrals were desaturated on 9 September.

          `surfaceRaised` gives the disc 8.38 L* of separation in light and
          14.12 in dark — more than the palette's own load-bearing
          background -> surface step (6.80) — at chroma 0.000. The green is
          not lost, it moves: from a 40 pt filled disc to one letter, where
          it identifies instead of shouting. `accent` on `surfaceRaised`
          measures 6.48:1 light and 6.87:1 dark, both clearing 1.4.3's 4.5:1
          for text, which is the floor the old comment here was right to
          insist on.
        */}
        <Text style={[typeScale.title3, { color: colors.accent }]}>{initial}</Text>
      </View>
      <Text style={[typeScale.body, styles.name, { color: colors.textPrimary }]}>{displayName}</Text>
      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`${displayName} verwijderen`}
          style={styles.removeButton}
          hitSlop={8}
        >
          <Text style={[typeScale.bodySmall, { color: colors.textMuted }]}>Verwijderen</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.space3,
    borderBottomWidth: 1,
    gap: spacing.space3,
  },
  avatar: {
    width: spacing.space10,
    height: spacing.space10,
    borderRadius: radii.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
  },
  removeButton: {
    minHeight: spacing.touchTargetMin,
    minWidth: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

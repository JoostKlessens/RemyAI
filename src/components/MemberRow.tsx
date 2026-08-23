/**
 * A single household member row in Household setup: avatar-initial chip +
 * name, hairline-separated (no boxed card per field, per docs/DESIGN.md).
 */

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
      <View style={[styles.avatar, { backgroundColor: colors.accentMuted }]}>
        {/* A3: accentOnMuted, not accent — accent only clears 3:1 against
            accentMuted (a fill), these initials are text and need 4.5:1. */}
        <Text style={[typeScale.title3, { color: colors.accentOnMuted }]}>{initial}</Text>
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

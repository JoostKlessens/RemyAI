/**
 * Creator attribution row (docs/PRODUCT-DECISIONS.md PD-007.2): names the
 * creator's handle, source platform, and links to their profile.
 * Deliberately built to read as a credit line — an avatar-initial chip
 * plus a name, styled like MemberRow's household-member rows — rather than
 * small print bolted on as a footer.
 *
 * Originally rendered inside the Feed's video scrim (hence a now-removed
 * on-scrim colour treatment). After the Feed was removed this survives as
 * the import confirmation screen's "this recipe still belongs to a
 * creator" credit line (src/app/import/confirm.tsx) — a normal surface,
 * not a video overlay — so it now uses the scheme-dependent token set like
 * every other row in the app, the same pattern MemberRow already uses for
 * its avatar-initial chip.
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { Creator } from '@/domain/feed/types';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { buildProfileAccessibilityLabel, getPlatformDisplayName } from './creatorPresentation';
import { useOpenExternalLink } from './useOpenExternalLink';

export interface CreatorAttributionProps {
  readonly creator: Creator;
}

export function CreatorAttribution(props: CreatorAttributionProps): JSX.Element {
  const { creator } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const platformName = getPlatformDisplayName(creator.platform);
  const initial = creator.displayName.trim().charAt(0).toUpperCase() || '?';
  const { status, open } = useOpenExternalLink(`Kon het profiel van ${creator.handle} niet openen`);
  const hasFailed = status === 'failed';

  return (
    // A11y: this genuinely navigates away from Remy to an external
    // profile, so `link` (not `button`) is the accurate role, matching
    // the web semantics a screen reader user would expect from a byline.
    <Pressable
      onPress={() => open(creator.profileUrl)}
      accessibilityRole="link"
      accessibilityLabel={buildProfileAccessibilityLabel(creator.handle, platformName, hasFailed)}
      style={styles.row}
      hitSlop={4}
    >
      {/* A3: accentOnMuted, not accent — accent only clears 3:1 against
          accentMuted (a fill), these initials are text and need 4.5:1,
          matching MemberRow's identical avatar-initial chip. */}
      <View style={[styles.avatar, { backgroundColor: colors.accentMuted }]}>
        <Text style={[typeScale.bodySmall, { color: colors.accentOnMuted }]}>{initial}</Text>
      </View>
      <View style={styles.identity}>
        <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{creator.displayName}</Text>
        <Text style={[typeScale.caption, styles.handleRow, { color: colors.textMuted }]}>
          {hasFailed ? `@${creator.handle} · opnieuw proberen` : `@${creator.handle} · ${platformName}`}
        </Text>
      </View>
      <Feather name="external-link" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: spacing.touchTargetMin,
    gap: spacing.space3,
  },
  avatar: {
    width: spacing.space10,
    height: spacing.space10,
    borderRadius: radii.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
  },
  handleRow: {
    marginTop: 1,
  },
});

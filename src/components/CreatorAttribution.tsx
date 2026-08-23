/**
 * Feed card creator attribution (docs/PRODUCT-DECISIONS.md PD-007.2):
 * every card names the creator's handle, source platform, and links to
 * their profile. Deliberately built to read as a credit line — an
 * avatar-initial chip plus a name, styled like MemberRow's household-
 * member rows — rather than small print bolted on as a footer. Lives
 * inside FeedVideoCard's video scrim, so every colour here comes from
 * `onScrimColors`, not the scheme-dependent token set.
 */

import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Creator } from '@/domain/feed/types';
import { radii, spacing, typeScale } from '@/theme/tokens';
import { buildProfileAccessibilityLabel, getPlatformDisplayName } from './feedPresentation';
import { onScrimColors } from './onScrimColors';
import { useOpenFeedLink } from './useOpenFeedLink';

export interface CreatorAttributionProps {
  readonly creator: Creator;
}

export function CreatorAttribution(props: CreatorAttributionProps): JSX.Element {
  const { creator } = props;
  const platformName = getPlatformDisplayName(creator.platform);
  const initial = creator.displayName.trim().charAt(0).toUpperCase() || '?';
  const { status, open } = useOpenFeedLink(`Kon het profiel van ${creator.handle} niet openen`);
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
      <View style={[styles.avatar, { backgroundColor: onScrimColors.accentChip }]}>
        <Text style={[typeScale.bodySmall, { color: onScrimColors.accentChipText }]}>{initial}</Text>
      </View>
      <View style={styles.identity}>
        <Text style={[typeScale.title3, { color: onScrimColors.text }]}>{creator.displayName}</Text>
        <Text style={[typeScale.caption, styles.handleRow, { color: onScrimColors.text }]}>
          {hasFailed ? `@${creator.handle} · opnieuw proberen` : `@${creator.handle} · ${platformName}`}
        </Text>
      </View>
      <Feather name="external-link" size={16} color={onScrimColors.text} />
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

/**
 * The credit row on the import confirmation screen (src/app/import/
 * confirm.tsx): whose recipe this is, where it came from, and — when the
 * source gave us one — a way back to them.
 *
 * A SIBLING OF `CreatorAttribution`, NOT A REPLACEMENT FOR IT. That
 * component takes a `Creator` (src/domain/feed/types.ts) and is still used
 * by src/app/friends/[feedItemId].tsx, so its props belong to the social
 * layer and changing them would ripple straight into it. An import has no
 * `Creator` and cannot be given one without widening `CreatorPlatform` —
 * a database-enum migration, for a type that models Feed opt-in consent
 * this flow neither has nor needs (see buildAttribution.ts). So the two
 * rows are deliberately separate implementations of the same visual idea,
 * and this one is built from the same tokens, the same avatar-initial chip
 * and the same `useOpenExternalLink` hook so they still read as one thing.
 *
 * WHY THIS COMPONENT DECIDES NOTHING. Every string it renders — the source
 * line, the accessibility label, the avatar glyph, and the judgement of
 * whether there is anything to credit at all — comes from
 * importCreatorCopy.ts. That is not tidiness: vitest runs with react-native
 * stubbed, so a Dutch sentence written here is a sentence no test can
 * reach, and this credit line is a PD-007.2 obligation rather than
 * decoration. What is left here is layout.
 *
 * WITHOUT A LINK THIS IS NOT A PRESSABLE. `authorUrl` is genuinely absent
 * for plenty of real imports, and it is never synthesised from the name
 * (buildAttribution.ts: a display name is not a URL-safe handle, and a
 * guess produces a plausible link to the wrong account). A row that looks
 * tappable and opens nothing is worse than a row that never offered — and
 * `accessibilityRole="link"` on it would be an outright false promise to a
 * screen reader. So the no-link case renders as static text, grouped into
 * a single accessible node, with no chevron.
 */

import type { JSX } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { ImportPlatform } from '@/domain/import/types';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { buildImportCreatorCredit, buildImportCreatorLinkFailureAnnouncement } from './importCreatorCopy';
import { useOpenExternalLink } from './useOpenExternalLink';

export interface ImportCreatorCreditProps {
  readonly authorName: string;
  /** From the source's own `author_url`/`author.url`. Null is a normal, expected state — see the file header. */
  readonly authorUrl: string | null;
  readonly platform: ImportPlatform;
  /** The imported post/page URL. Read only to name a `'web'` import's publisher. */
  readonly sourceUrl: string | null;
}

export function ImportCreatorCredit(props: ImportCreatorCreditProps): JSX.Element | null {
  const { authorName, authorUrl, platform, sourceUrl } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  // Built before the credit copy, and by a separate function, because the
  // hook needs this announcement in hand BEFORE the failure it describes —
  // the credit copy below branches on the very status this call produces.
  const { status, open } = useOpenExternalLink(buildImportCreatorLinkFailureAnnouncement(authorName, platform));
  const credit = buildImportCreatorCredit({ authorName, authorUrl, platform, sourceUrl }, status === 'failed');

  if (credit === null) {
    return null;
  }

  const identity = (
    <>
      {/* A3: accentOnMuted, not accent — accent only clears 3:1 against
          accentMuted (a fill), these initials are text and need 4.5:1,
          matching MemberRow's and CreatorAttribution's identical chip. */}
      <View style={[styles.avatar, { backgroundColor: colors.accentMuted }]}>
        <Text style={[typeScale.bodySmall, { color: colors.accentOnMuted }]}>{credit.initial}</Text>
      </View>
      <View style={styles.identity}>
        <Text style={[typeScale.title3, { color: colors.textPrimary }]} numberOfLines={1}>
          {credit.name}
        </Text>
        <Text style={[typeScale.caption, styles.sourceRow, { color: colors.textMuted }]} numberOfLines={1}>
          {credit.sourceLine}
        </Text>
      </View>
    </>
  );

  const linkUrl = credit.linkUrl;
  if (linkUrl === null) {
    // Grouped into one accessible node so a screen reader reads a credit
    // ("Recept van X op Y") rather than two orphaned fragments — the same
    // sentence a sighted reader gets from the two lines together.
    return (
      <View style={styles.row} accessible accessibilityLabel={credit.accessibilityLabel}>
        {identity}
      </View>
    );
  }

  return (
    // A11y: this genuinely navigates away from Remy to an external page, so
    // `link` (not `button`) is the accurate role — the same call
    // CreatorAttribution makes, for the same reason.
    <Pressable
      onPress={() => open(linkUrl)}
      accessibilityRole="link"
      accessibilityLabel={credit.accessibilityLabel}
      style={styles.row}
      hitSlop={4}
    >
      {identity}
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
  sourceRow: {
    marginTop: 1,
  },
});

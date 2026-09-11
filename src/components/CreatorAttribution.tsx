/**
 * Creator attribution row (docs/PRODUCT-DECISIONS.md PD-007.2): names the
 * creator's handle, source platform, and links to their profile.
 * Deliberately built to read as a credit line — an avatar-initial chip
 * plus a name, styled like MemberRow's household-member rows — rather than
 * small print bolted on as a footer.
 *
 * Originally rendered inside the Feed's video scrim (hence a now-removed
 * on-scrim colour treatment). After the Feed was removed this survives as
 * a normal-surface credit line, not a video overlay, so it uses the
 * scheme-dependent token set like every other row in the app — the same
 * pattern MemberRow already uses for its avatar-initial chip.
 *
 * ⚠ THIS HEADER SAID THE IMPORT CONFIRMATION SCREEN RENDERS IT. It does
 * not, and has not since `ImportCreatorCredit` shipped:
 * `grep -n "CreatorAttribution" src/app/import/confirm.tsx` returns
 * nothing, measured 10 September 2026. The two rows are separate
 * implementations of the same visual idea because their vocabularies
 * differ — `ImportPlatform` has six members and `CreatorPlatform` two, and
 * an import has no consent record to model. Corrected rather than deleted,
 * because the claim was load-bearing for anyone deciding which of the two
 * rows to change.
 *
 * WHERE IT IS USED NOW: both shared recipe screens, through
 * `SharedRecipeArticle` — `/friends/[feedItemId]` (a friend's own meal)
 * and `/friends/recipe/[recipeId]` (the canonical `recipes` row).
 *
 * IT NO LONGER TAKES A `Creator`, AND THAT IS PD-007 RATHER THAN
 * CONVENIENCE. A `Creator` is a CONSENT record — `optedInAt`/`optedOutAt`
 * decide whether anything may be served at all. A canonical `recipes` row
 * has no such record behind it; it has ATTRIBUTION, which 0006 is explicit
 * is a different thing. Fabricating a `Creator` out of `author_name` to
 * satisfy this prop is exactly the conflation that schema comment warns
 * against, so the prop is `RecipeAttribution` — the four facts this
 * row actually renders. A real `Creator` still satisfies it structurally,
 * so the send screen's path is unchanged.
 *
 * WITHOUT A LINK THIS IS NOT A PRESSABLE. `profileUrl` is genuinely null
 * for a canonical recipe whose source reported no `author_url`, and it is
 * never synthesised from the name — `buildAttribution.ts`: a display name
 * is not a URL-safe handle, and a guess produces a plausible link to the
 * WRONG account. A row that looks tappable and opens nothing is worse than
 * a row that never offered, and `accessibilityRole="link"` on it would be
 * an outright false promise to a screen reader. So the no-link case
 * renders as static text, grouped into one accessible node, with no
 * chevron. `ImportCreatorCredit` reached this conclusion first; this is
 * the same answer rather than a second one.
 */

import type { JSX } from 'react';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import {
  buildCreatorCreditAccessibilityLabel,
  buildProfileAccessibilityLabel,
  getPlatformDisplayName,
} from './creatorPresentation';
import { buildCreatorCreditLine } from './friendCardVocabulary';
import type { RecipeAttribution } from './recipeAttribution';
import { useOpenExternalLink } from './useOpenExternalLink';

export interface CreatorAttributionProps {
  readonly creator: RecipeAttribution;
}

export function CreatorAttribution(props: CreatorAttributionProps): JSX.Element {
  const { creator } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const platformName = getPlatformDisplayName(creator.platform);
  const initial = creator.displayName.trim().charAt(0).toUpperCase() || '?';
  const { status, open } = useOpenExternalLink(`Kon het profiel van ${creator.handle} niet openen`);
  const hasFailed = status === 'failed';

  const identity = (
    <>
      {/* A raised disc with a green letter, not a green disc — 9 September
          2026, and changed here BECAUSE this chip is required to be identical
          to MemberRow's. That file carries the measurement: `accentMuted`
          stood 1.70 L* from the light page while carrying chroma 0.110
          against a 0.003-0.009 neutral ramp, so it read as a colour rather
          than as a shape. `accent` on `surfaceRaised` is 6.48:1 light /
          6.87:1 dark, still clearing 1.4.3's 4.5:1 for these initials. */}
      <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised }]}>
        <Text style={[typeScale.bodySmall, { color: colors.accent }]}>{initial}</Text>
      </View>
      <View style={styles.identity}>
        <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{creator.displayName}</Text>
        <Text style={[typeScale.caption, styles.handleRow, { color: colors.textMuted }]}>
          {buildCreatorCreditLine(creator.handle, creator.platform, hasFailed)}
        </Text>
      </View>
    </>
  );

  const profileUrl = creator.profileUrl;
  if (profileUrl === null) {
    // Grouped into one accessible node so a screen reader hears a credit
    // rather than two orphaned fragments — the same sentence a sighted
    // reader gets from the two lines together. No role, no hint, no
    // chevron: see this file's header on why a row with nothing to open
    // must not announce itself as a link.
    return (
      <View style={styles.row} accessible accessibilityLabel={buildCreatorCreditAccessibilityLabel(creator.displayName, platformName)}>
        {identity}
      </View>
    );
  }

  return (
    // A11y: this genuinely navigates away from Remy to an external
    // profile, so `link` (not `button`) is the accurate role, matching
    // the web semantics a screen reader user would expect from a byline.
    <Pressable
      onPress={() => open(profileUrl)}
      accessibilityRole="link"
      accessibilityLabel={buildProfileAccessibilityLabel(creator.handle, platformName, hasFailed)}
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
  handleRow: {
    marginTop: 1,
  },
});

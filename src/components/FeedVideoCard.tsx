/**
 * One Feed item (docs/PRODUCT-DECISIONS.md PD-007): an oEmbed thumbnail —
 * never an inline video player, see `useOpenFeedLink`/`feedLinking.ts` for
 * why — creator attribution baked into the caption (PD-007.2), and a
 * right-edge like/save/share action rail.
 *
 * Two visual states share this one component rather than being split into
 * a separate "degraded" component, because they ARE the same card, just
 * missing one input: the degraded placeholder renders when the item
 * genuinely has no thumbnail (`thumbnailUrl === null` — e.g. Instagram
 * oEmbed without approved Facebook App credentials) OR the thumbnail
 * failed to load at runtime (a 404, a region lock). Either way this
 * renders a named "no preview" placeholder — never a blank card, never a
 * stock image standing in for content that isn't there — while title,
 * attribution and save stay fully usable, and tapping still deep-links to
 * the source post.
 */

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { Creator, FeedItem } from '@/domain/feed/types';
import type { Meal } from '@/domain/types';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { CreatorAttribution } from './CreatorAttribution';
import {
  buildCollisionLabel,
  buildWatchAccessibilityLabel,
  getPlatformDisplayName,
  resolveFeedItemDisplayTitle,
} from './feedPresentation';
import { onScrimColors } from './onScrimColors';
import { useOpenFeedLink } from './useOpenFeedLink';

export interface FeedVideoCardProps {
  readonly item: FeedItem;
  readonly creator: Creator;
  /** Resolved from `item.mealId` by the caller (mirrors `_fixtures.ts`'s `getMealById`) — null is a normal, expected state, not every post is parsed yet. */
  readonly parsedMeal: Meal | null;
  /**
   * docs/PRODUCT-DECISIONS.md PD-007a: which of `parsedMeal`'s ingredient
   * tags collide with the household's restrictions, resolved by the
   * caller (mirrors `parsedMeal` — this component never reaches into
   * household/member/restriction data itself). Empty when there's no
   * parsed meal, no ingredient tags, or no collision — all three render
   * identically (no label), which is deliberate: see `buildCollisionLabel`.
   */
  readonly collidingTags: readonly string[];
  readonly isLiked: boolean;
  readonly onToggleLike: () => void;
  readonly onSave: () => void;
  readonly onShare: () => void;
}

export function FeedVideoCard(props: FeedVideoCardProps): JSX.Element {
  const { item, creator, parsedMeal, collidingTags, isLiked, onToggleLike, onSave, onShare } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [thumbnailLoadFailed, setThumbnailLoadFailed] = useState(false);

  const { thumbnailUrl } = item;
  const displayTitle = resolveFeedItemDisplayTitle(item.title, parsedMeal?.title ?? null);
  const platformName = getPlatformDisplayName(item.sourcePlatform);
  const metaParts = buildMetaParts(parsedMeal);
  const collisionLabel = buildCollisionLabel(collidingTags);

  const { status, open } = useOpenFeedLink(`Kon ${platformName} niet openen`);
  const hasFailedToOpen = status === 'failed';

  return (
    <View style={[styles.container, { backgroundColor: colors.textPrimary }]}>
      {/* A11y: `link`, not `button` — this genuinely navigates away from
          Remy to the source platform (PD-007.3), so the more accurate
          role is used, same reasoning as CreatorAttribution's profile
          link. One Pressable covers the whole preview area rather than a
          smaller "play" button plus a separate CTA, so there is exactly
          one accessible stop here, not two overlapping ones. */}
      <Pressable
        onPress={() => open(item.sourceUrl)}
        accessibilityRole="link"
        accessibilityLabel={buildWatchAccessibilityLabel(displayTitle, platformName, hasFailedToOpen)}
        accessibilityHint="Opent buiten Remy"
        style={styles.thumbnailArea}
      >
        {/* Narrowing `thumbnailUrl === null` directly in this condition
            (rather than reading a separately-computed boolean) lets
            TypeScript narrow `thumbnailUrl` to `string` in the `<Image>`
            branch below on its own — no type assertion needed. */}
        {thumbnailUrl === null || thumbnailLoadFailed ? (
          <View style={[styles.degraded, { backgroundColor: colors.surfaceSunken }]}>
            <Feather name="image" size={32} color={colors.textMuted} />
            <Text style={[typeScale.bodySmall, styles.degradedText, { color: colors.textMuted }]}>
              Geen voorbeeld beschikbaar
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnailImage}
            resizeMode="cover"
            onError={() => setThumbnailLoadFailed(true)}
          />
        )}

        <View
          style={[
            styles.centerAffordance,
            hasFailedToOpen
              ? { backgroundColor: colors.surfaceRaised, borderRadius: radii.radiusLg, paddingHorizontal: spacing.space4 }
              : { backgroundColor: colors.overlay, borderRadius: radii.radiusFull, padding: spacing.space4 },
          ]}
        >
          <Feather
            name={hasFailedToOpen ? 'alert-circle' : 'play'}
            size={28}
            color={hasFailedToOpen ? colors.danger : onScrimColors.text}
          />
          {hasFailedToOpen ? (
            <Text style={[typeScale.caption, styles.centerAffordanceText, { color: colors.danger }]}>
              Kon {platformName} niet openen
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View style={[styles.scrim, { backgroundColor: colors.videoScrim }]} pointerEvents="box-none">
        <CreatorAttribution creator={creator} />
        {/* A6: no numberOfLines cap — docs/DESIGN.md prefers letting a row
            grow over capping it, and truncating the one thing identifying
            what this post is about would hide the one thing the caption
            exists to show. */}
        <Text style={[typeScale.title2, styles.dishTitle, { color: onScrimColors.text }]}>{displayTitle}</Text>
        {/* PD-007a: rank down AND label, never hide. Opaque `surfaceRaised`
            fill (not a translucent on-scrim treatment) so this reads
            clearly against any thumbnail. Deliberately NOT `warning`/
            `danger` — this is a fact about the dish's tags, not an alert
            about the user, and those tokens read as alarm. `accessible`
            + an explicit label group icon+text into one screen-reader
            stop instead of two, and there is no numberOfLines cap so a
            multi-tag "Bevat noten, paddenstoelen" list survives 200%
            Dynamic Type by wrapping rather than truncating. */}
        {collisionLabel !== null ? (
          <View
            style={[styles.collisionLabel, { backgroundColor: colors.surfaceRaised }]}
            accessible
            accessibilityRole="text"
            accessibilityLabel={collisionLabel}
          >
            <Feather name="info" size={14} color={colors.textSecondary} />
            <Text style={[typeScale.caption, styles.collisionText, { color: colors.textSecondary }]}>
              {collisionLabel}
            </Text>
          </View>
        ) : null}
        {metaParts.length > 0 ? (
          <Text style={[typeScale.numeral, styles.metaRow, { color: onScrimColors.text }]}>
            {metaParts.join('  ·  ')}
          </Text>
        ) : null}
      </View>

      <View style={styles.actionRail}>
        <Pressable
          onPress={onToggleLike}
          accessibilityRole="button"
          accessibilityLabel={isLiked ? `${displayTitle} niet meer leuk vinden` : `${displayTitle} leuk vinden`}
          accessibilityState={{ selected: isLiked }}
          style={styles.actionButton}
          hitSlop={4}
        >
          {/* A9: a semi-opaque circular backing behind each icon — arbitrary
              creator video content behind it means the scrim alone cannot
              guarantee contrast for an icon-only control. */}
          <View style={[styles.actionButtonBacking, { backgroundColor: colors.overlay }]}>
            <Feather name="heart" size={24} color={isLiked ? colors.accent : onScrimColors.text} />
          </View>
        </Pressable>
        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel={`${displayTitle} bewaren`}
          style={styles.actionButton}
          hitSlop={4}
        >
          <View style={[styles.actionButtonBacking, { backgroundColor: colors.overlay }]}>
            <Feather name="bookmark" size={24} color={onScrimColors.text} />
          </View>
        </Pressable>
        <Pressable
          onPress={onShare}
          accessibilityRole="button"
          accessibilityLabel={`${displayTitle} delen`}
          style={styles.actionButton}
          hitSlop={4}
        >
          <View style={[styles.actionButtonBacking, { backgroundColor: colors.overlay }]}>
            <Feather name="share-2" size={24} color={onScrimColors.text} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function buildMetaParts(meal: Meal | null): readonly string[] {
  if (meal === null) {
    return [];
  }
  const parts: string[] = [];
  if (meal.estimatedMinutes !== null) {
    parts.push(`${meal.estimatedMinutes} min`);
  }
  if (meal.servings !== null) {
    parts.push(`voor ${meal.servings}`);
  }
  return parts;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  thumbnailArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    ...StyleSheet.absoluteFillObject,
  },
  degraded: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.space2,
  },
  degradedText: {
    textAlign: 'center',
  },
  centerAffordance: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.space1,
  },
  centerAffordanceText: {
    textAlign: 'center',
  },
  scrim: {
    paddingTop: spacing.space16,
    paddingBottom: spacing.space10,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    gap: spacing.space3,
  },
  dishTitle: {
    marginTop: spacing.space1,
  },
  collisionLabel: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: spacing.space1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    paddingVertical: spacing.space2,
  },
  collisionText: {
    flexShrink: 1,
  },
  metaRow: {
    marginTop: spacing.space1,
  },
  actionRail: {
    position: 'absolute',
    right: spacing.space3,
    bottom: spacing.space24,
    alignItems: 'center',
    gap: spacing.space4,
  },
  actionButton: {
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonBacking: {
    width: spacing.space10,
    height: spacing.space10,
    borderRadius: radii.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

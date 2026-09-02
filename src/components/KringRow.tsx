/**
 * One row of de Kring (DESIGN-SOCIAL.md §2.2, §4.2): rank, still, dish, the
 * grade with its voters named, and the collision chip when there is one.
 *
 * MOVED OUT OF src/app/(tabs)/friends.tsx, VERBATIM, and for that file's own
 * recurring reason: it had reached the 800-line ceiling. `_gekooktSource.ts`
 * was the first carve and took the reads; this is the second and takes the
 * one thing on that screen that was a component sitting inline. Nothing
 * about the rendering changed in the move.
 *
 * WHY HERE RATHER THAN ANYWHERE ELSE. Its two siblings already live in this
 * directory — `FriendProofCard.tsx` and `FriendRecipeCard.tsx`, the two
 * Gekookt card kinds — and its MODEL has lived here all along, in
 * `kringPresentation.ts` (`KringRowModel`, `buildKringRowAccessibilityLabel`,
 * `assembleKring`). A row whose model, siblings and accessibility label were
 * all in src/components/ while the row itself sat in a route module was the
 * odd one out, not a considered exception.
 *
 * THE RANK IS `numeral` RATHER THAN `caption` FOR ONE SPECIFIC REASON —
 * `numeral` carries tabular figures, so the column does not shift
 * horizontally between 9 and 10 and make the whole list look broken. The
 * meta row is `numeral` for the same reason: "8,5" and "10,0" line up.
 *
 * THE CREATOR LINE IS NOT DECORATION. These rows are extractions of
 * somebody's public post, and PD-007's attribution obligation applies here
 * exactly as it does in the feed and on the board.
 *
 * THE ROW IS NOT PRESSABLE, deliberately. Opening a canonical recipe from
 * here needs a screen that reads canonical recipes, and no such screen
 * exists: `/friends/[feedItemId]` resolves a feed item and would answer a
 * recipe id with "Dit recept staat er niet meer", which is a lie about a
 * recipe that exists. An action that silently does nothing is worse than no
 * action, so there is no `onPress` prop to pass — the absence is the
 * contract rather than a gap a caller could fill in.
 *
 * IT DOES NOT ANIMATE, AND MUST NOT. PD-020.1's entrance is the
 * announcement that a directed send arrived; a kring row is an aggregate of
 * public votes addressed to nobody, and giving it the same motion would say
 * a tally was meant for you.
 */

import { Image, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { fontFamily, getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { buildKringRowAccessibilityLabel, type KringRowModel } from './kringPresentation';
import { useThumbnailFallback } from './useThumbnailFallback';

export interface KringRowProps {
  readonly row: KringRowModel;
}

export function KringRow(props: KringRowProps): JSX.Element {
  const { row } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const monogram = row.title.trim().charAt(0).toUpperCase() || '?';
  const thumbnail = useThumbnailFallback(row.thumbnailUrl);

  return (
    <View
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={buildKringRowAccessibilityLabel(row)}
    >
      <Text style={[typeScale.numeral, styles.rank, { color: colors.textMuted }]}>{row.rank}</Text>

      <View style={[styles.thumbnailFrame, { backgroundColor: colors.surfaceSunken }]}>
        {thumbnail.showsImage ? (
          <Image
            source={{ uri: row.thumbnailUrl ?? undefined }}
            style={styles.thumbnail}
            resizeMode="cover"
            onError={thumbnail.onError}
            accessibilityIgnoresInvertColors
          />
        ) : (
          // The same monogram fallback the friend card and Bibliotheek's
          // tile use — never a broken image, never a stock placeholder.
          <Text
            style={[typeScale.title3, styles.monogram, { fontFamily: fontFamily.monoSemiBold, color: colors.textMuted }]}
          >
            {monogram}
          </Text>
        )}
      </View>

      <View style={styles.rowText}>
        <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{row.title}</Text>
        <Text style={[typeScale.numeral, styles.rowMeta, { color: colors.textSecondary }]}>{row.metaLine}</Text>
        <Text style={[typeScale.caption, styles.rowCreator, { color: colors.textMuted }]}>{row.creatorLine}</Text>

        {row.collisionLabel === null ? null : (
          <View style={[styles.chip, { backgroundColor: colors.warningMuted }]}>
            <Text style={[typeScale.caption, { color: colors.warning }]}>{row.collisionLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** 9:16, the same portrait ratio the friend card and Bibliotheek's grid use — a video still, not a crop. */
const THUMBNAIL_ASPECT_RATIO = 9 / 16;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.radiusSm,
    padding: spacing.space3,
    gap: spacing.space3,
  },
  rank: {
    minWidth: spacing.space6,
    textAlign: 'right',
  },
  thumbnailFrame: {
    width: spacing.space16,
    aspectRatio: THUMBNAIL_ASPECT_RATIO,
    borderRadius: radii.radiusSm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  monogram: {
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowMeta: {
    marginTop: spacing.space1,
  },
  rowCreator: {
    marginTop: spacing.space1,
  },
  chip: {
    alignSelf: 'flex-start',
    marginTop: spacing.space2,
    paddingHorizontal: spacing.space2,
    paddingVertical: spacing.space1,
    borderRadius: radii.radiusSm,
  },
});

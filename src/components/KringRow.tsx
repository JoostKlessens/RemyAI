/**
 * One row of de Kring (DESIGN-SOCIAL.md §2.2, §4.2): rank, still, dish, the
 * grade with its voters named, and the collision chip when there is one.
 *
 * ⚠ ZERO PRODUCTION CALLERS SINCE 8 SEPTEMBER 2026. Its only consumer was
 * Trending's `Vrienden` scope, and that scope now draws `TrendingCard` like
 * the `Iedereen` scope beside it — the owner asked for the two to look the
 * same. `grep -rn "KringRow\b" src/ tests/` finds this file and prose in
 * eight others; no JSX anywhere renders it.
 *
 * KEPT RATHER THAN DELETED, on the same footing this repo already grants
 * `mainIngredients.ts` and `ingredientCategoryIcons.ts`, and the footing is a
 * REASON and not sentiment: this is the only compact list row in the app that
 * pairs a rank with a named-voter meta line, and the day a surface wants a
 * dense scannable ranking again — the thing PD-014a explicitly gave up when
 * the board became a card feed — this is that component, already written and
 * already tested. Deleting it would make that day a day for re-deriving a
 * layout that is written down.
 *
 * ⚠ DO NOT READ ITS PRESENCE AS EVIDENCE THAT SOMETHING USES IT. If a third
 * consumer never appears, the honest move is to delete it and let git
 * remember — not to leave it here accruing another year of maintenance.
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
 * ⚠ THE ROW IS STILL NOT PRESSABLE, AND IT IS NO LONGER A CONTRACT. THE
 * OWNER REVERSED THAT ON 8 SEPTEMBER 2026, VERBATIM: "Als ik naar de
 * trending tab ga, kan ik niet op de recepten klikken die ik daar zie."
 *
 * The paragraph this replaces read, in full: "THE ROW IS NOT PRESSABLE,
 * deliberately. Opening a canonical recipe from here needs a screen that
 * reads canonical recipes, and no such screen exists: `/friends/[feedItemId]`
 * resolves a feed item and would answer a recipe id with 'Dit recept staat er
 * niet meer', which is a lie about a recipe that exists. An action that
 * silently does nothing is worse than no action, so there is no `onPress`
 * prop to pass — the absence is the contract rather than a gap a caller could
 * fill in."
 *
 * ITS PREMISE IS STILL TRUE AND ITS LAST SENTENCE IS NOT. There is still no
 * screen that shows a canonical recipe, `/friends/[feedItemId]` would still
 * answer a recipe id with a lie, and an action that silently does nothing is
 * still worse than no action. What changed is the status of the absence: it
 * was a considered position and it is now a debt. Leaving it described as a
 * contract would be this file telling the next reader that a question has
 * been settled when it has been reopened.
 *
 * WHAT IS ACTUALLY IN THE WAY, measured on 8 September 2026 rather than
 * assumed. The honest destination is a canonical recipe screen whose action
 * is "bewaren", and it is a package rather than a prop: no route shows a
 * canonical recipe; `listCanonicalRecipes` returns a SUMMARY with no
 * ingredients and no steps, so there is nothing to read one from; and no
 * write anywhere in this codebase copies a `recipes` row into `meals` —
 * `/friends/[feedItemId]` has no "Opslaan" for exactly that reason and says
 * so in its own header. The cheaper destination, a link to the source post,
 * is blocked on something else: `recipes.normalized_url` is not projected
 * onto `CanonicalRecipeSummary`, and it is not a route to cooking either
 * (PD-014's fourth condition), so it would be the worse answer even
 * unblocked.
 *
 * So there is still no `onPress` prop, for the surviving half of the old
 * reason — a prop nobody can fill in honestly is an invitation to fill it in
 * dishonestly. `TrendingCard`, the `Iedereen` scope's new card, reached the
 * same place by the same route and carries the three destinations in full.
 *
 * ⚠ THE TWO SCOPES OF TRENDING NOW DRAW DIFFERENT SHAPES. `Iedereen` became a
 * card feed on 8 September 2026 (PD-014's amendment); this row did not. That
 * is a recorded inconsistency rather than an oversight: converting it needs
 * `dishTags` and `estimatedMinutes` on `KringRecipe`, whose only producer
 * outside that package is `src/fixtures/friendFeedFixtures.ts`, a file the
 * package did not own — and 7 September's lesson was about exactly the kind
 * of edit that reaches across a package boundary to finish something.
 * (tabs)/ranglijst.tsx's header carries the same note and names it as the
 * follow-up.
 *
 * IT DOES NOT ANIMATE, AND MUST NOT. PD-020.1's entrance is the
 * announcement that a directed send arrived; a kring row is an aggregate of
 * public votes addressed to nobody, and giving it the same motion would say
 * a tally was meant for you.
 */

import type { JSX } from 'react';
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
    ...StyleSheet.absoluteFill,
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

/**
 * Trending's filter drawer — the control the owner asked for on 8 September
 * 2026: "Ook hier wil ik dat je een filter kan aanzetten."
 *
 * "OOK HIER" IS THE INSTRUCTION AND IT IS ALSO THE DESIGN. He had just been
 * given a drawer on Kiezen ("Kan je hiervan een uitklap menu maken?") and one
 * on Mijn recepten, and he asked for the same thing on the third screen. So
 * this is `DecisionFilterBar`'s shape, deliberately: one 44pt row until
 * somebody asks for more, the opening on the left with its count, "Wissen"
 * opposite it, and the controls unmounted rather than hidden while the drawer
 * is shut. A household that has learned this control twice must not have to
 * learn it a third time.
 *
 * ===========================================================================
 * WHY THIS IS NOT `DecisionFilterBar` WITH A PROP
 * ===========================================================================
 *
 * Sharing the component was the first thing considered, and it fails on the
 * data rather than on the styling:
 *
 * 1. IT TAKES A `DecisionFilters`, whose three axes include `anyDishMoods`.
 *    `recipes` has no `dish_moods` column — 0010 added moods to `meals` alone
 *    — so a shared bar would carry an axis this surface can never fill, and
 *    "hide it with a flag" is the parameter that reintroduces the difference
 *    it was meant to remove.
 * 2. ITS SPOKEN LABEL NAMES THREE AXES. `describeDecisionFilters` composes
 *    "Filters: Hoeveel tijd? Ingrediënten Waar heb je zin in?" from the
 *    eyebrows themselves — good design there, and a sentence that would
 *    announce a mood row this screen does not have.
 * 3. ITS CHIPS ARE NOT NARROWED AGAINST THE SELECTION. That is
 *    docs/LONGLIST.md GAP-33's open half, and this bar does narrow (see
 *    `selectableDishTags` below). A shared component would have to do both,
 *    on two different state shapes, which is the second parameter.
 *
 * What IS shared is everything below the axis level: `Chip`, `IconChip`,
 * `ChipGroup`, `TimeCapPicker`, `Icon`, `iconForDishTag`, the rotated
 * `chevron-right`, and the count-in-words rule — which is asserted EQUAL to
 * Kiezen's by tests/trendingFilter.test.ts rather than shared by import, the
 * posture decisionFilterCopy.ts argues for at length.
 *
 * ===========================================================================
 * THE THREE THINGS THAT STOP A FILTER FROM RUNNING WHERE NOBODY CAN SEE IT
 * ===========================================================================
 *
 * Kiezen names four; this screen has three, and the missing one matters less
 * here than it would there.
 *
 * ONE, THE COUNT ON THE SHUT CONTROL, in words ("2 filters actief") and in
 * the accent colour so it reads as state rather than as more label. It counts
 * every axis, because every axis is behind this fold.
 *
 * TWO, "WISSEN" ON THE ALWAYS-VISIBLE ROW, opposite the opening, appearing
 * the moment anything is set. A reader who cannot see their filters is
 * exactly the reader who needs the undo.
 *
 * THREE, THE EMPTY STATE NAMES THE FILTER RATHER THAN THE WORLD.
 * `TRENDING_FILTER_EMPTY_TITLE` is "Niets binnen dit filter", never "geen
 * curry" — see its own docblock for why that distinction is the one piece of
 * copy on this screen that could tell a lie.
 *
 * WHAT KIEZEN HAS AND THIS DOES NOT is `NoCandidateState`'s primary "Filters
 * wissen" button on `filtered_out`. What replaces it is guard two, always on
 * screen, plus the fact that no CHIP can produce the state: the row is
 * collected from the cards actually on the board, so every tag offered leaves
 * at least one card standing.
 *
 * ⚠ THE TIME LADDER CAN PRODUCE IT ON ITS OWN, and that is measured rather
 * than theoretical: on the demo seed the three recipes that clear the vote
 * floor take 45, 25 and 30 minutes, so any cap of 20 empties the feed in one
 * drag. A continuous ladder cannot narrow itself the way a chip row can —
 * clamping the track would move a control under a finger already on it — so
 * the honest answer is guard three's copy plus a "Wissen" that never leaves
 * the screen.
 *
 * ⚠ IT STARTS SHUT AND STAYS WHERE THE READER PUT IT, and it deliberately
 * does NOT copy `LibrarySearchBar`'s seed-from-the-count initializer. That
 * guard exists there because that bar unmounts when the library drops to zero
 * rows while its search lives on in the screen. Neither half is true here:
 * this bar is mounted for the whole `Iedereen` scope INCLUDING its empty
 * states, precisely so a filter that emptied the feed can be undone from the
 * screen it emptied.
 *
 * EVERY DUTCH WORD COMES FROM trendingFilter.ts, for the reason every
 * `*Copy.ts` module in this directory gives: vitest runs `node` with
 * react-native stubbed, so a sentence written in a `.tsx` is a sentence
 * nothing can hold.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DISH_TAGS } from '@/domain/dishTags';
import { normalizeTag } from '@/domain/normalizeTag';
import type { TimeCap } from '@/domain/timeCap';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';
import { IconChip } from './IconChip';
import { TimeCapPicker } from './TimeCapPicker';
import { iconForDishTag } from './dishTagIcons';
import { isIconAvailable, type IconName } from './iconFont';
import {
  NO_TRENDING_FILTER,
  TRENDING_FILTER_RESET_A11Y_LABEL,
  TRENDING_FILTER_RESET_LABEL,
  TRENDING_FILTER_TAGS_EYEBROW,
  countTrendingFilters,
  describeTrendingDishTagChip,
  describeTrendingFilters,
  toggleTrendingDishTag,
  type TrendingFilterState,
} from './trendingFilter';

export interface TrendingFilterBarProps {
  readonly filter: TrendingFilterState;
  /**
   * The tags worth offering, from `collectSelectableBoardDishTags` — narrowed
   * against the current selection, with the selection unioned back in.
   *
   * THE CALLER COLLECTS THEM RATHER THAN THIS BAR, the same split
   * `DecisionFilterBar` uses for `availableDishTags`: the pool this narrows
   * is the assembled board, which the screen holds and this component has no
   * business fetching. Order is ignored — the row always renders in
   * `DISH_TAGS` order, so the chips do not rearrange themselves under a thumb
   * as the board changes.
   */
  readonly selectableDishTags: readonly string[];
  readonly onChange: (filter: TrendingFilterState) => void;
}

/**
 * The chevron on the opening. Feather has no `chevron-down`, so the open state
 * is this glyph turned a quarter turn — exactly what `DecisionFilterBar` and
 * `LibrarySearchBar` do, and a second glyph name is rejected here for their
 * reason: it would also have to be added to iconFont.ts's exhaustive
 * `Record<IconName, InstalledGlyph>` to be the same drawing, rotated.
 */
const DISCLOSURE_GLYPH: IconName = 'chevron-right';

/** 16pt — `Chip`'s size for a glyph beside a label, and the size the other two disclosures draw this one at. */
const DISCLOSURE_GLYPH_SIZE = 16;

export function TrendingFilterBar(props: TrendingFilterBarProps): JSX.Element {
  const { filter, selectableDishTags, onChange } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  // The drawer's own state, local for the reason `DecisionFilterBar` gives:
  // whether a control is unfolded is this component's business, nothing
  // outside it can act on the answer, and keeping it here is what lets the
  // screen mount this bar with three props and no opinion about its shape.
  const [isExpanded, setIsExpanded] = useState(false);

  // Rendered in `DISH_TAGS` order and intersected with what the board can
  // actually offer.
  //
  // ⚠ THE INTERSECTION SILENTLY DROPS AN OFF-VOCABULARY TAG, and that is a
  // measured consequence rather than a worry: nothing constrains what the
  // extraction model writes into `recipes.dish_tags`, and the demo seed
  // already contains one — `Shakshuka met feta` carries `eieren`, which is
  // not among the seventeen values in dishTags.ts. The alternative is a chip
  // with no Dutch label and no glyph to draw, which is worse than a filter
  // that quietly offers one axis less. `BoardRecipe.dishTags` carries the
  // same note.
  const selectable = new Set(selectableDishTags.map(normalizeTag));
  const visibleTags = DISH_TAGS.filter((entry) => selectable.has(entry.tag));
  const selectedTags = new Set(filter.requiredDishTags.map(normalizeTag));
  const activeFilterCount = countTrendingFilters(filter);

  // `TimeCap` and `TrendingFilterState.maxMinutes` are the same value — whole
  // minutes or `null` for no cap — so nothing is translated here, exactly as
  // on Kiezen.
  const handleChangeTimeCap = (cap: TimeCap): void => {
    onChange({ ...filter, maxMinutes: cap });
  };

  return (
    <View style={[styles.bar, { borderBottomColor: colors.border }]}>
      {/* The only row that is always drawn, and the whole shut height: one
          44pt touch target, the opening on the left and "Wissen" opposite it.
          "Wissen" stays out here rather than inside the drawer because a
          reader who cannot see their filters is exactly the reader who needs
          the undo — guard two, see the header. */}
      <View style={styles.headerRow}>
        <FilterDisclosure
          isExpanded={isExpanded}
          activeFilterCount={activeFilterCount}
          onToggle={() => setIsExpanded((wasExpanded) => !wasExpanded)}
        />
        {activeFilterCount > 0 ? (
          <Pressable
            onPress={() => onChange(NO_TRENDING_FILTER)}
            style={styles.reset}
            accessibilityRole="button"
            accessibilityLabel={TRENDING_FILTER_RESET_A11Y_LABEL}
          >
            <Text style={[typeScale.label, styles.eyebrow, { color: colors.accent }]}>
              {TRENDING_FILTER_RESET_LABEL}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* UNMOUNTED rather than hidden with a style, matching both other
          drawers: a shut drawer must cost no height at all and must give a
          screen reader nothing to walk past. */}
      {isExpanded ? (
        <>
          {/* No eyebrow above it, matching the other two screens: the picker
              draws its own clock and numeral, so a heading reading "Hoeveel
              tijd?" over it is the same sentence twice. The word is still
              spoken by the opening's label. */}
          <TimeCapPicker value={filter.maxMinutes} onChange={handleChangeTimeCap} />

          {visibleTags.length > 0 ? (
            <>
              <Text style={[typeScale.label, styles.eyebrow, styles.tagEyebrow, { color: colors.textMuted }]}>
                {TRENDING_FILTER_TAGS_EYEBROW}
              </Text>
              {/* Multi-select, so `Chip`'s default checkbox role is right and
                  `ChipGroup` stays unlabelled. Choosing several means AND, so
                  each chip says that out loud rather than leaving a
                  screen-reader user to infer it from a result they cannot see.
                  `IconChip` and not a bare `Chip` because the same seventeen
                  tags are drawn with a glyph each on the other two screens,
                  and one vocabulary in two dresses inside one app is the thing
                  that reads as an oversight. */}
              <ChipGroup>
                {visibleTags.map((entry) => (
                  <IconChip
                    key={entry.tag}
                    icon={iconForDishTag(entry.tag)}
                    label={entry.label}
                    selected={selectedTags.has(entry.tag)}
                    onPress={() => onChange(toggleTrendingDishTag(filter, entry.tag))}
                    role="checkbox"
                    accessibilityLabel={describeTrendingDishTagChip(entry.label)}
                  />
                ))}
              </ChipGroup>
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/**
 * The "Filters" opening — the only thing on this bar until somebody taps.
 *
 * IT IS A `button`, NOT A `checkbox`. It holds no part of the filter and
 * narrows nothing; it decides whether two controls are on screen, and a
 * checkbox role would file a control that changes no result beside the ones
 * that do.
 *
 * `accessibilityState={{ expanded }}` RATHER THAN A LABEL SAYING "OPEN" OR
 * "DICHT", the choice every other disclosure in this app made: the platform
 * announces expanded/collapsed in the user's own language, and a hand-written
 * Dutch equivalent is a second translation free to drift from the visible
 * chevron.
 *
 * `isIconAvailable` IS ASKED BEFORE THE CHEVRON IS DRAWN, per Icon.tsx's
 * contract: `Icon` renders nothing for a name no installed font can draw, so
 * a caller that wants no dangling gap in a `gap`-spaced row has to ask first.
 * The word and the count carry the control without it.
 */
function FilterDisclosure(props: {
  readonly isExpanded: boolean;
  readonly activeFilterCount: number;
  readonly onToggle: () => void;
}): JSX.Element {
  const { isExpanded, activeFilterCount, onToggle } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const copy = describeTrendingFilters(activeFilterCount);

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityLabel={copy.accessibilityLabel}
      style={styles.disclosure}
    >
      {isIconAvailable(DISCLOSURE_GLYPH) ? (
        <View style={isExpanded ? styles.disclosureGlyphExpanded : null}>
          <Icon name={DISCLOSURE_GLYPH} size={DISCLOSURE_GLYPH_SIZE} color={colors.textMuted} />
        </View>
      ) : null}
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>{copy.label}</Text>
      {/* The accent colour is the point: a count in `textMuted` beside a muted
          label reads as more label, and this is the one thing on a shut drawer
          that says the list below it has been narrowed. */}
      {copy.activeBadge !== null ? (
        <Text style={[typeScale.label, styles.eyebrow, { color: colors.accent }]}>{copy.activeBadge}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    // Kiezen's bar, to the token: 12 + 16 of padding, a 1pt rule, 8pt between
    // children and a 44pt header row — 73pt shut. Copied rather than
    // re-derived so two drawers cannot drift into two different heights for
    // one gesture.
    borderBottomWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space3,
    paddingBottom: spacing.space4,
    gap: spacing.space2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.touchTargetMin,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
    // Stretches the header row's full 44pt so the opening is a real target
    // rather than a 15pt band of text, and takes the otherwise dead space
    // between the word and "Wissen".
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'flex-start',
  },
  disclosureGlyphExpanded: {
    // A quarter turn clockwise: `chevron-right` becomes the chevron-down every
    // open disclosure draws. Compositor-only, so nothing reflows.
    transform: [{ rotate: '90deg' }],
  },
  eyebrow: {
    textTransform: 'uppercase',
  },
  tagEyebrow: {
    marginTop: spacing.space2,
  },
  reset: {
    // The header row is already touchTargetMin tall, so stretching the
    // pressable across it gives "Wissen" a full 44pt target without padding
    // that would visually detach it from the opening opposite.
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingLeft: spacing.space4,
  },
});

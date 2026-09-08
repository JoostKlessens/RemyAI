/**
 * Trending's filter drawer — the control the owner asked for on 8 September
 * 2026: "Ook hier wil ik dat je een filter kan aanzetten."
 *
 * ⚠ THIS COMPONENT IS THE DRAWER AND NOT THE CONTROL, SINCE 8 SEPTEMBER 2026,
 * AND THAT INVERTS WHAT THE PARAGRAPH BELOW SAYS. It shipped as
 * `DecisionFilterBar`'s shape — a 44pt row carrying a `Filters` word, a
 * chevron and a count, with the controls folded behind it — and the screen
 * then grew a funnel glyph in its header for the same job. The owner saw both
 * at once: "Het icoontje is de filterknop, je hoeft dan niet ook nog 'filter'
 * neer te zetten en een dropdown menu te maken."
 *
 * He is right, and the redundancy was mine: two openings for one drawer, one
 * of them announcing itself with a word directly under a glyph that had
 * already said it. So the opening is gone from this file entirely — no
 * `FilterDisclosure`, no local `isExpanded`, no chevron — and
 * `(tabs)/ranglijst.tsx` mounts this component only when its funnel is on.
 * What is left is the controls themselves.
 *
 * THE PARAGRAPH BELOW IS KEPT AS THE REASON THE SHAPE WAS COPIED, and it is
 * still true about the CONTROLS: the picker, the chips and the count-in-words
 * are Kiezen's, so a household that has learned this control twice does not
 * learn it a third time. Only the fold moved.
 *
 * "OOK HIER" IS THE INSTRUCTION AND IT IS ALSO THE DESIGN. He had just been
 * given a drawer on Kiezen ("Kan je hiervan een uitklap menu maken?") and one
 * on Mijn recepten, and he asked for the same thing on the third screen. So
 * this is `DecisionFilterBar`'s shape, deliberately: ~~one 44pt row until
 * somebody asks for more, the opening on the left with its count,~~ "Wissen"
 * with the controls, and everything unmounted rather than hidden while the
 * drawer is shut.
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
 * every axis, because every axis is behind this fold. It now sits on the
 * SCREEN's funnel rather than on a row of this component's own — same
 * sentence, from the same `describeTrendingFilters`, one fold further out.
 *
 * TWO, "WISSEN", appearing the moment anything is set. It used to sit on the
 * always-visible row so it was reachable with the drawer shut; with the
 * opening gone it lives with the controls, one tap deeper. The funnel's count
 * is what keeps guard one's promise in the meantime: a reader who filtered
 * the feed empty can still SEE that they did, and the glyph that tells them
 * is the glyph that undoes it.
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
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DISH_TAGS } from '@/domain/dishTags';
import { normalizeTag } from '@/domain/normalizeTag';
import type { TimeCap } from '@/domain/timeCap';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { ChipGroup } from './ChipGroup';
import { IconChip } from './IconChip';
import { TimeCapPicker } from './TimeCapPicker';
import { iconForDishTag } from './dishTagIcons';
import {
  NO_TRENDING_FILTER,
  TRENDING_FILTER_RESET_A11Y_LABEL,
  TRENDING_FILTER_RESET_LABEL,
  TRENDING_FILTER_TAGS_EYEBROW,
  countTrendingFilters,
  describeTrendingDishTagChip,
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

export function TrendingFilterBar(props: TrendingFilterBarProps): JSX.Element {
  const { filter, selectableDishTags, onChange } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  // The drawer's own state, local for the reason `DecisionFilterBar` gives:
  // whether a control is unfolded is this component's business, nothing
  // outside it can act on the answer, and keeping it here is what lets the
  // screen mount this bar with three props and no opinion about its shape.

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
    <View style={styles.bar}>
      {/* No eyebrow above the picker, matching the other two screens: it
          draws its own clock and numeral, so a heading reading "Hoeveel
          tijd?" over it is the same sentence twice. */}
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

      {/* `Wissen` LAST, AND STILL HERE. It used to sit on the opening row so
          it was reachable while the drawer was shut; the funnel carries the
          active count now, so the reader who filtered the feed empty can see
          that they did and taps the same glyph to get here. Undo one tap
          deeper is the price of a header that is one line. */}
      {activeFilterCount > 0 ? (
        <Pressable
          onPress={() => onChange(NO_TRENDING_FILTER)}
          style={styles.reset}
          accessibilityRole="button"
          accessibilityLabel={TRENDING_FILTER_RESET_A11Y_LABEL}
        >
          <Text style={[typeScale.label, styles.eyebrow, { color: colors.accent }]}>{TRENDING_FILTER_RESET_LABEL}</Text>
        </Pressable>
      ) : null}
    </View>
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

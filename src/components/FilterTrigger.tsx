/**
 * The funnel that opens a filter drawer — one glyph, shared by Trending and
 * Kiezen.
 *
 * ===========================================================================
 * WHY THIS EXISTS AT ALL
 * ===========================================================================
 *
 * The owner, 8 September 2026, on the version that shipped an hour earlier:
 * "Het icoontje is de filterknop, je hoeft dan niet ook nog 'filter' neer te
 * zetten en een dropdown menu te maken." And then, having seen it work on one
 * screen: "ik wil dat we het filter icoontje net zo toepassen op de kiezen
 * pagina als we bij trending hebben gedaan."
 *
 * Both filter bars used to carry their own opening: a 44pt row with the word
 * `Filters`, a chevron and a count, with the controls folded behind it. That
 * row cost a band of height on every visit to say something only some visits
 * act on. The glyph costs none, and it is the whole control — no label beside
 * it and no chevron under it, because the drawer it opens is the controls
 * themselves.
 *
 * ===========================================================================
 * WHAT IT DELIBERATELY DOES NOT OWN
 * ===========================================================================
 *
 * THE SENTENCE. `accessibilityLabel` is a prop, not something built here, and
 * that is the seam that matters: Kiezen's filters have three axes and
 * Trending's have two, so `describeDecisionFilters` and
 * `describeTrendingFilters` compose different sentences out of their own
 * eyebrows. A shared component that built the label would have to know which
 * screen it was on — the parameter that reintroduces the difference it was
 * meant to remove. Each caller passes its own module's answer, and both of
 * those modules are `.ts` so vitest can hold the words.
 *
 * THE OPEN STATE. `isExpanded` is a prop and never local, because the SCREEN
 * mounts the drawer and this glyph only reports the toggle. Local state here
 * would put "is the drawer open" in two places, and the two would disagree
 * the first time a screen wanted to shut the drawer for its own reason.
 *
 * ===========================================================================
 * THE COUNT IS THE ONE THING IT SAYS OUT LOUD
 * ===========================================================================
 *
 * A funnel that looks identical whether or not it is filtering is how
 * somebody ends up staring at three cards wondering where the rest went, with
 * the drawer that would tell them shut. So an active filter tints the glyph
 * `accent` and puts the number beside it.
 *
 * BESIDE IT, NEVER ON IT. A number in a dot on a glyph is a badge, and badges
 * are what PD-004 refuses on these surfaces: badge chrome reports something
 * that happened to you while you were away, and this count is a state the
 * reader set themselves.
 *
 * ⚠ THIS IS NOW THE ONLY PLACE THE COUNT IS VISIBLE WITH THE DRAWER SHUT, so
 * it is load-bearing rather than decorative. Both bars used to keep "Wissen"
 * on their always-visible row precisely so a filter that emptied a feed could
 * be undone without opening anything; that word now lives inside the drawer,
 * one tap deeper. The tint is what keeps that promise — the glyph that tells
 * you the list is narrowed is the glyph that takes you to the undo.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Icon } from './Icon';

/** 20pt: one step above the 16pt a `Chip` draws a glyph at, because this one stands alone. */
const GLYPH_SIZE = 20;

export interface FilterTriggerProps {
  /** Every axis the reader has set. Zero draws a muted glyph and no number. */
  readonly activeFilterCount: number;
  readonly isExpanded: boolean;
  readonly onToggle: () => void;
  /** The screen's own sentence, from its own copy module — see the header on why this is not composed here. */
  readonly accessibilityLabel: string;
}

export function FilterTrigger(props: FilterTriggerProps): JSX.Element {
  const { activeFilterCount, isExpanded, onToggle, accessibilityLabel } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const isFiltering = activeFilterCount > 0;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onToggle}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={accessibilityLabel}
      >
        {/*
          `active` IS WHAT ACTUALLY DRAWS THE STATE HERE, and `color` is the
          fallback's copy of the same fact. GAP-58 measured that `Icon` throws
          `color` away for every name with artwork, which is every name — so
          until 9 September 2026 this funnel looked identical filtering or not,
          and only the small count beside it gave the state away. The
          conditional `color` stays because the font branch below `Icon`'s
          artwork check is the one place it would still arrive, and a glyph
          that fell back to Feather should not lose the distinction with it.
        */}
        <Icon
          name="filter"
          size={GLYPH_SIZE}
          color={isFiltering ? colors.accent : colors.textMuted}
          active={isFiltering}
        />
        {isFiltering ? (
          <Text style={[typeScale.caption, styles.count, { color: colors.accent }]}>{activeFilterCount}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    // Right-aligned, so the glyph sits where a header action sits on every
    // other tab and the eye does not have to find a new corner per screen.
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    // The 44pt floor on both axes. A bare 20pt glyph is exactly the tap
    // target this app has already lost a control to once this week.
    minHeight: spacing.touchTargetMin,
    minWidth: spacing.touchTargetMin,
    justifyContent: 'flex-end',
  },
  count: {
    marginLeft: spacing.space1,
  },
});

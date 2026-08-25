/**
 * PD-009 — the one control on Kiezen that the user drives before Remy
 * speaks: "hoeveel tijd heb ik" and "waar heb ik zin in", expressed as a
 * `DecisionFilters` the caller hands straight to `decide()`.
 *
 * Why this does not violate rule 1 of docs/PRODUCT-DECISIONS.md ("never
 * render a scrollable list of recipes on the decision surface"): that rule
 * forbids putting the *choosing* back on the user, which is exactly what a
 * list of dishes does. This is the opposite move — a fixed, closed set of
 * narrowings after which Remy still names exactly one dish. Nothing here
 * scrolls, nothing here is a recipe, and no path through it ends in the
 * user browsing. It shrinks the question Remy answers; it never hands the
 * question back.
 *
 * Two deliberate restraints keep it that way:
 *
 * 1. **Only categories the household actually has.** `availableDishTags`
 *    comes from the real candidate pool, so the chip row is short for a
 *    small library and never offers a filter guaranteed to return nothing.
 *    Rendering all seventeen `DISH_TAGS` unconditionally would turn a
 *    control into a catalogue — several rows of chips above the dish name,
 *    squeezing the one thing this screen exists to show. The rejected
 *    alternative was hiding the whole row behind a disclosure or a bottom
 *    sheet: cleaner on paper, but it costs a tap before the user can even
 *    see that filtering is possible, and an affordance nobody discovers is
 *    the same as no affordance.
 * 2. **No "meer filters" escape hatch.** The vocabulary is closed on
 *    purpose (dishTags.ts); a growing filter surface is how a decision
 *    screen turns into a search screen.
 *
 * Visual language follows docs/DESIGN.md: mono `label` eyebrows in
 * `textMuted` ("timecode burned into the frame"), the same
 * `SegmentedControl` the household time budget uses, `Chip` in its default
 * multi-select checkbox role, and a hairline `border` rule separating the
 * bar from the hero below it. Every colour pairing used here is asserted
 * in tests/contrast.test.ts.
 */

import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DISH_TAGS } from '@/domain/dishTags';
import { NO_DECISION_FILTERS } from '@/domain/exclusions';
import { normalizeTag } from '@/domain/normalizeTag';
import type { DecisionFilters } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { SegmentedControl, type SegmentedControlOption } from './SegmentedControl';

export interface DecisionFilterBarProps {
  readonly filters: DecisionFilters;
  /**
   * Dish tags present on at least one meal in the household's candidate
   * pool. Order is ignored — the row always renders in `DISH_TAGS` order so
   * the chips don't rearrange themselves as the library grows.
   */
  readonly availableDishTags: readonly string[];
  readonly onChange: (filters: DecisionFilters) => void;
}

/**
 * The segmented control needs string values; the minute counts they stand
 * for live in one table right beside them so a label and its meaning
 * cannot drift apart.
 *
 * The steps are 20/30/45 rather than mirroring Household setup's 15/30/45+:
 * "45+" is an open-ended *budget* ("long cooking is fine"), which is
 * meaningless as tonight's hard upper bound. 20 earns its slot because "ik
 * heb twintig minuten" is the request this whole feature exists for.
 */
type TimeChoice = 'alles' | 'kort' | 'gemiddeld' | 'ruim';

const TIME_OPTIONS: readonly SegmentedControlOption<TimeChoice>[] = [
  { value: 'alles', label: 'Alles' },
  { value: 'kort', label: '20 min' },
  { value: 'gemiddeld', label: '30 min' },
  { value: 'ruim', label: '45 min' },
];

const TIME_CHOICE_MINUTES: Readonly<Record<TimeChoice, number | null>> = {
  alles: null,
  kort: 20,
  gemiddeld: 30,
  ruim: 45,
};

/**
 * Any `maxMinutes` this row cannot represent falls back to "Alles" rather
 * than inventing a selected segment. The value is still honoured by
 * `decide()` — the control just stops claiming to describe a state it does
 * not own, which is the honest rendering of it.
 */
function toTimeChoice(maxMinutes: number | null): TimeChoice {
  const match = TIME_OPTIONS.find((option) => TIME_CHOICE_MINUTES[option.value] === maxMinutes);
  return match?.value ?? 'alles';
}

function hasAnyFilter(filters: DecisionFilters): boolean {
  return filters.maxMinutes !== null || filters.requiredDishTags.length > 0;
}

export function DecisionFilterBar(props: DecisionFilterBarProps): JSX.Element {
  const { filters, availableDishTags, onChange } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const available = new Set(availableDishTags.map(normalizeTag));
  const visibleTags = DISH_TAGS.filter((entry) => available.has(entry.tag));
  const selectedTags = new Set(filters.requiredDishTags.map(normalizeTag));
  const isActive = hasAnyFilter(filters);

  const handleTimeChange = (choice: TimeChoice): void => {
    onChange({ ...filters, maxMinutes: TIME_CHOICE_MINUTES[choice] });
  };

  const handleToggleTag = (tag: string): void => {
    // Immutable both ways — the caller holds this object in state and may
    // still be rendering the previous one.
    const nextTags = selectedTags.has(tag)
      ? filters.requiredDishTags.filter((value) => normalizeTag(value) !== tag)
      : [...filters.requiredDishTags, tag];
    onChange({ ...filters, requiredDishTags: nextTags });
  };

  return (
    <View style={[styles.bar, { borderBottomColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>HOEVEEL TIJD?</Text>
        {isActive ? (
          <Pressable
            onPress={() => onChange(NO_DECISION_FILTERS)}
            style={styles.reset}
            accessibilityRole="button"
            accessibilityLabel="Wis alle filters voor vanavond"
          >
            <Text style={[typeScale.label, styles.eyebrow, { color: colors.accent }]}>WISSEN</Text>
          </Pressable>
        ) : null}
      </View>

      <SegmentedControl
        options={TIME_OPTIONS}
        value={toTimeChoice(filters.maxMinutes)}
        onChange={handleTimeChange}
        accessibilityLabel="Maximale kooktijd voor vanavond"
      />

      {visibleTags.length > 0 ? (
        <>
          <Text style={[typeScale.label, styles.eyebrow, styles.tagEyebrow, { color: colors.textMuted }]}>
            WAARMEE?
          </Text>
          {/* Multi-select, so `Chip`'s default checkbox role is right here
              and `ChipGroup` stays unlabelled — see ChipGroup's own note on
              why a bare accessibilityLabel there is inert. Choosing several
              means AND, not OR (see DecisionFilters.requiredDishTags), so
              each chip's label says that out loud instead of leaving a
              screen-reader user to infer it from a result they can't see. */}
          <ChipGroup>
            {visibleTags.map((entry) => {
              const selected = selectedTags.has(entry.tag);
              return (
                <Chip
                  key={entry.tag}
                  label={entry.label}
                  selected={selected}
                  onPress={() => handleToggleTag(entry.tag)}
                  role="checkbox"
                  accessibilityLabel={`${entry.label}. Filtert op gerechten met alles wat je kiest.`}
                />
              );
            })}
          </ChipGroup>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
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
  eyebrow: {
    textTransform: 'uppercase',
  },
  tagEyebrow: {
    marginTop: spacing.space2,
  },
  reset: {
    // The eyebrow row is already touchTargetMin tall, so stretching the
    // pressable across it gives "Wissen" a full 44pt target without padding
    // that would visually detach it from the label opposite.
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingLeft: spacing.space4,
  },
});

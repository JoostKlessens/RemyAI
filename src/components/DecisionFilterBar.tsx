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
 * 3. **Two axes, and only two.** The mood row (dishMoods.ts) is what
 *    finally makes this file's own first sentence true: it has always
 *    claimed to answer "hoeveel tijd heb ik" and "waar heb ik zin in",
 *    and until it existed the second question was answered with a list of
 *    ingredients. "Waarmee?" is a question about the pan; "waar heb je
 *    zin in?" is a question about the person, and no amount of adding to
 *    dishTags.ts could have turned one into the other. A THIRD axis
 *    should have to argue against restraint 2 above, not merely be
 *    useful — three rows of chips over the dish name is the catalogue
 *    that restraint exists to prevent.
 *
 * WHAT THIS COSTS IN HEIGHT, STATED RATHER THAN DISCOVERED. Both chip
 * rows wrap, and on a narrow phone at large Dynamic Type each can take
 * two or three lines. That is why both are gated on the candidate pool
 * actually carrying the values (restraint 1) rather than rendering their
 * whole vocabulary: for a real library the tag row is short and the mood
 * row is usually shorter, and a brand-new library shows neither. The
 * worst case — a big, thoroughly described library on a small screen —
 * pushes the hero down, and the honest fix if that lands badly on a real
 * device is a shorter vocabulary, not a disclosure control (see
 * restraint 1's rejected alternative).
 *
 * Visual language follows docs/DESIGN.md: mono `label` eyebrows in
 * `textMuted` ("timecode burned into the frame"), the same
 * `SegmentedControl` the household time budget uses, `Chip` in its default
 * multi-select checkbox role, and a hairline `border` rule separating the
 * bar from the hero below it. Every colour pairing used here is asserted
 * in tests/contrast.test.ts.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DISH_MOODS } from '@/domain/dishMoods';
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
  /**
   * The second axis (src/domain/dishMoods.ts): moods at least one meal in
   * the candidate pool has actually been described with, from
   * `collectAvailableDishMoods`. Same narrowing rule as
   * `availableDishTags` above, and it matters more here, because this axis
   * starts EMPTY for every existing library — nobody has described
   * anything yet — so an unconditional row of six chips would be six taps
   * that could only ever produce `filtered_out`. An empty array hides the
   * row entirely, which is the honest rendering of "there is nothing to
   * filter on yet", and the row appears on its own once people start
   * answering the outcome card.
   */
  readonly availableDishMoods: readonly string[];
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
  return filters.maxMinutes !== null || filters.requiredDishTags.length > 0 || filters.anyDishMoods.length > 0;
}

export function DecisionFilterBar(props: DecisionFilterBarProps): JSX.Element {
  const { filters, availableDishTags, availableDishMoods, onChange } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const available = new Set(availableDishTags.map(normalizeTag));
  const visibleTags = DISH_TAGS.filter((entry) => available.has(entry.tag));
  const selectedTags = new Set(filters.requiredDishTags.map(normalizeTag));
  const availableMoods = new Set(availableDishMoods.map(normalizeTag));
  const visibleMoods = DISH_MOODS.filter((entry) => availableMoods.has(entry.mood));
  const selectedMoods = new Set(filters.anyDishMoods.map(normalizeTag));
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

  /**
   * Multi-select like the tag row above it, and immutable the same way —
   * but what several selections MEAN is the opposite (OR, not AND; see
   * `DecisionFilters.anyDishMoods`). Nothing in the toggle itself encodes
   * that; the difference lives entirely in `filterByDecisionFilters`, and
   * is spoken out loud in each chip's accessibility label below.
   */
  const handleToggleMood = (mood: string): void => {
    const nextMoods = selectedMoods.has(mood)
      ? filters.anyDishMoods.filter((value) => normalizeTag(value) !== mood)
      : [...filters.anyDishMoods, mood];
    onChange({ ...filters, anyDishMoods: nextMoods });
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

      {visibleMoods.length > 0 ? (
        <>
          {/* The second axis, and the row that finally makes this bar's
              own header true: it has always claimed to answer "hoeveel
              tijd heb ik" and "waar heb ik zin in", and until now the
              second question was answered with a list of ingredients.
              "Waarmee?" is a question about the pan; this one is about
              the person.

              Rendered UNDER the tag row rather than above it, even though
              it is arguably the more human question, because the time
              control and the tag row are what people already know how to
              use — a new row appearing above two familiar ones moves both
              of them down the screen the first time somebody describes a
              dish. It is also the row most likely to be absent (see
              `availableDishMoods`), and an absent row at the bottom
              changes nothing above it.

              Multi-select, so `Chip`'s default checkbox role is right —
              but choosing several means OR here, where the row above
              means AND, so the label says which. A screen-reader user
              cannot see a result set change and must not be left to infer
              the difference from one. */}
          <Text style={[typeScale.label, styles.eyebrow, styles.tagEyebrow, { color: colors.textMuted }]}>
            WAAR HEB JE ZIN IN?
          </Text>
          <ChipGroup>
            {visibleMoods.map((entry) => (
              <Chip
                key={entry.mood}
                label={entry.label}
                selected={selectedMoods.has(entry.mood)}
                onPress={() => handleToggleMood(entry.mood)}
                role="checkbox"
                accessibilityLabel={`${entry.label}. Filtert op gerechten met een van de dingen die je hier kiest.`}
              />
            ))}
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

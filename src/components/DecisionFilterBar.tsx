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
 * 1. **Only categories the household can actually be OFFERED.**
 *    `availableDishTags` and `availableDishMoods` are collected from the
 *    pool that survives `decide()`'s own first two passes — unarchived,
 *    then restrictions and the household time budget — so the chip row is
 *    short for a small library and never offers a narrowing that was
 *    already empty before it was tapped.
 *
 *    THIS RESTRAINT USED TO CLAIM MORE THAN IT DELIVERED, and the claim is
 *    recorded rather than quietly swapped out. It said the chips "come from
 *    the real candidate pool" and that the row "never offers a filter
 *    guaranteed to return nothing". `candidateMeals` is `listHouseholdMeals`
 *    — the household's whole library — and `decide()` removes meals for
 *    restrictions, for `weeknightTimeBudgetMinutes`, and, for a household
 *    with any allergen restriction, every meal whose `allergenTagStatus` is
 *    not `'verified'`, which is most of them because PD-006 fails safe to
 *    `'unknown'`. `offerableMeals` in (tabs)/index.tsx now runs those passes
 *    before the tags are collected; it carries the measurement.
 *
 *    WHAT IT STILL DOES NOT PROMISE, said plainly this time: a COMBINATION
 *    can return nothing where no single part does — "pasta" AND
 *    "vegetarisch", or any tag under a five-minute cap. Guaranteeing that
 *    away would mean re-deriving every chip against every other chip and
 *    against the cap on every tap, and `filtered_out` already names the
 *    state while `Wissen` undoes it in one tap.
 *
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
 * two or three lines. That is why both are gated on the offerable pool
 * actually carrying the values (restraint 1) rather than rendering their
 * whole vocabulary: for a real library the tag row is short and the mood
 * row is usually shorter, and a brand-new library shows neither. The
 * worst case — a big, thoroughly described library on a small screen —
 * pushes the hero down, and the honest fix if that lands badly on a real
 * device is a shorter vocabulary, not a disclosure control (see
 * restraint 1's rejected alternative).
 *
 * Visual language follows docs/DESIGN.md: mono `label` eyebrows in
 * `textMuted` ("timecode burned into the frame"), `TimeCapPicker` — the
 * clock and five-minute ladder Mijn recepten uses for the same question —
 * `Chip` in its default multi-select checkbox role, and a hairline `border`
 * rule separating the bar from the hero below it. Every colour pairing used
 * here is asserted in tests/contrast.test.ts.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DISH_MOODS } from '@/domain/dishMoods';
import { DISH_TAGS } from '@/domain/dishTags';
import { NO_DECISION_FILTERS } from '@/domain/exclusions';
import { normalizeTag } from '@/domain/normalizeTag';
import type { TimeCap } from '@/domain/timeCap';
import type { DecisionFilters } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { TimeCapPicker } from './TimeCapPicker';

export interface DecisionFilterBarProps {
  readonly filters: DecisionFilters;
  /**
   * Dish tags present on at least one meal in the OFFERABLE pool —
   * `selectOfferableMeals` (src/domain/offerablePool.ts), not the raw
   * library; see restraint 1 above for the claim that correction repairs.
   * Order is ignored — the row always renders in `DISH_TAGS` order so the
   * chips don't rearrange themselves as the library grows.
   */
  readonly availableDishTags: readonly string[];
  /**
   * The second axis (src/domain/dishMoods.ts): moods at least one meal in
   * the offerable pool has actually been described with, from
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
 * THE TIME CONTROL IS `TimeCapPicker`, AND WHAT IT REPLACED ARGUED FROM A
 * FALSE PREMISE.
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Ik zou ook willen dat je bovenin geen
 * blokjes hebt voor hoe lang het mag duren maar een icoontje met een klokje
 * en dan 5min interval scrollen van hoe lang het recept maximaal mag duren."
 *
 * What stood here was a four-segment `SegmentedControl` (Alles / 20 / 30 /
 * 45), a table mapping each label to its minutes, and a `toTimeChoice` that
 * fell back to "Alles" for any stored cap the row could not draw. Its own
 * comment defended the steps: "The steps are 20/30/45 rather than mirroring
 * Household setup's 15/30/45+: '45+' is an open-ended *budget* ('long
 * cooking is fine'), which is meaningless as tonight's hard upper bound."
 *
 * THE PREMISE WAS WRONG, and it is written down rather than deleted with the
 * code it justified. Nothing in this product has an open-ended time branch:
 * `isWithinTimeBudget` (src/domain/exclusions.ts) is
 * `meal.estimatedMinutes <= household.weeknightTimeBudgetMinutes`, so
 * Household setup's "45+ min" is a hard 45-minute cap that drops a
 * fifty-minute recipe. The LABEL is open-ended; the rule is not. The
 * conclusion — that the two controls should not share a vocabulary —
 * happened to be right, for a reason the comment did not give.
 *
 * It needs no repair here, because the ladder resolves it: `TimeCapPicker`
 * ends in a "geen limiet" stop that is `null`, and `null` is the one value
 * in this codebase that genuinely means no upper bound
 * (`DecisionFilters.maxMinutes` — a null cap also keeps untimed meals in the
 * pool, where any explicit cap drops them). The open end is a value now
 * instead of a label. Household setup's own "45+" is not this file's to fix.
 *
 * NO VARIANT PROP, deliberately. `TimeCapPicker`'s author records that a
 * prop restoring Kiezen's old wording is precisely what would turn one
 * control into two, so the picker takes a value and a callback and nothing
 * else. This screen keeps its own "HOEVEEL TIJD?" eyebrow above it, which is
 * where the difference between two screens belongs.
 */
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

  // `TimeCap` and `DecisionFilters.maxMinutes` are the same value — whole
  // minutes or `null` for no cap — so nothing is translated here. That
  // identity is the whole reason `filterByDecisionFilters` needed no change
  // when the chips became a ladder (see src/domain/timeCap.ts's header).
  const handleChangeTimeCap = (cap: TimeCap): void => {
    onChange({ ...filters, maxMinutes: cap });
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

      <TimeCapPicker value={filters.maxMinutes} onChange={handleChangeTimeCap} />

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

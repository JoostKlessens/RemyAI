/**
 * PD-009 — the one control on Kiezen that the user drives before Remy
 * speaks: "hoeveel tijd heb ik" and "waar heb ik zin in", expressed as a
 * `DecisionFilters` the caller hands straight to `decide()`.
 *
 * SINCE 2026-09-07 THE CONTROLS ARE BEHIND A "FILTERS" OPENING. The bar draws
 * one 44pt row until somebody asks for more; see "THE OPENING" below for the
 * instruction, the measurement and the four things that stop a filter from
 * running unseen.
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
 *    ⚠ THE PARAGRAPH BELOW WAS OVERRULED BY THE OWNER ON 2026-09-07, AND IT
 *    IS LEFT STANDING RATHER THAN DELETED. It is the argument he overruled;
 *    erasing it would erase the evidence of what the decision cost. Its
 *    second sentence is the one that lost — the drawer's discoverability
 *    cost is real and is now PAID FOR rather than avoided, in four ways set
 *    out under "THE OPENING". Its FIRST sentence still stands unchallenged
 *    and is in fact the reason the opening works: seventeen chips
 *    unconditionally really would be a catalogue, which is why folding them
 *    away buys as much as it does. The instruction is quoted in full below.
 *
 *    THE ARGUMENT AS IT STOOD: Rendering all seventeen `DISH_TAGS`
 *    unconditionally would turn a control into a catalogue — several rows of
 *    chips above the dish name, squeezing the one thing this screen exists to
 *    show. The rejected alternative was hiding the whole row behind a
 *    disclosure or a bottom sheet: cleaner on paper, but it costs a tap
 *    before the user can even see that filtering is possible, and an
 *    affordance nobody discovers is the same as no affordance.
 * 2. **No "meer filters" escape hatch.** The vocabulary is closed on
 *    purpose (dishTags.ts); a growing filter surface is how a decision
 *    screen turns into a search screen.
 *
 *    ⚠ THE OPENING DID NOT REPEAL THIS RESTRAINT, and the two must not be
 *    filed together. This restraint is about the VOCABULARY — how many
 *    different questions this bar is allowed to ask. The drawer changed how
 *    many of them are on screen at once and added no question at all: the
 *    same time cap, the same seventeen tags, the same six moods. A fourth
 *    axis still has to argue against this sentence, and "there is room
 *    behind the fold now" is not an argument, it is the excuse this
 *    restraint was written to refuse.
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
 * ⚠ WHAT THIS COSTS IN HEIGHT — THE PARAGRAPH THAT PREDICTED THIS CHANGE AND
 * TALKED ITSELF OUT OF IT. Kept whole, because it is the measurement that
 * turned out to matter and it named the wrong remedy.
 *
 * IT SAID: Both chip rows wrap, and on a narrow phone at large Dynamic Type
 * each can take two or three lines. That is why both are gated on the
 * offerable pool actually carrying the values (restraint 1) rather than
 * rendering their whole vocabulary: for a real library the tag row is short
 * and the mood row is usually shorter, and a brand-new library shows neither.
 * The worst case — a big, thoroughly described library on a small screen —
 * pushes the hero down, and the honest fix if that lands badly on a real
 * device is a shorter vocabulary, not a disclosure control (see restraint 1's
 * rejected alternative).
 *
 * IT LANDED BADLY ON A REAL DEVICE. The owner read it there and asked for the
 * disclosure control by name. "A shorter vocabulary" was never going to be
 * offered to him as the alternative, because the vocabulary is closed for
 * reasons of its own (restraint 2) and cutting it would remove filters people
 * use rather than move them.
 *
 * ===========================================================================
 * THE OPENING
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTIONS, VERBATIM, ALL THREE, because this file executes
 * two of them and the third is another component's:
 *
 *   1. "bij kiezen staat er nog wel 'waarmee' ipv Ingredienten."
 *   2. "Verwijder de teksten 'hoeveel tijd' en kiezen."
 *   3. "De bovenstaande aanpassingen moeten eigenlijk pas zichtbaar zijn als
 *      er op een knopje bovenaan geklikt wordt met 'filters' zodat de
 *      'kiezen' pagina ook minder druk is. Kan je hiervan een uitklap menu
 *      maken?"
 *
 * WHAT "HIERVAN" MEANS, SETTLED RATHER THAN GUESSED. It is the FILTER
 * CONTROLS that go behind the button, not the copy edits of 1 and 2. Three
 * grounds: "hiervan" needs a collection of controls as its antecedent and
 * there is exactly one on this screen; "minder druk" cannot describe
 * deletions, which already make the screen less busy; and "bovenaan" is,
 * today, only this bar. Of instruction 2, the "hoeveel tijd" half is this
 * file's — the eyebrow above the clock is gone. The "kiezen" half is the
 * KIEZEN eyebrow inside `DecisionCard` and is not this file's to touch.
 *
 * THE HEIGHT, MEASURED FROM THE STYLESHEETS RATHER THAN GUESSED. The bar is
 * `paddingTop` 12 + `paddingBottom` 16 + a 1pt rule = 29pt of chrome, plus 8pt
 * between children. Its children are the header row (44pt, `touchTargetMin`),
 * `TimeCapPicker` (68pt: a 20pt readout, its 4pt margin and a 44pt touch
 * area), each eyebrow (15pt of `typeScale.label` over an 8pt margin = 23pt)
 * and each chip line (47pt: `typeScale.body` at 16/23 inside `Chip`'s two 12pt
 * paddings).
 *
 *   SHUT                                                            73pt
 *   open, ordinary library (6 tags, no moods)                       235pt
 *   open, worst case (17 tags, 6 moods, wrapping)                   462pt
 *
 * So the default costs 162pt less than today's bar for a real library, and
 * 389pt less in the case that pushed the hero off the screen. THE PROPERTY
 * THAT MATTERS MORE THAN EITHER NUMBER: shut, the height no longer depends on
 * how big the library is. That is the same property LIB-06 spent a day buying
 * for Mijn recepten, and it is why the worst case stops being a case at all
 * until somebody deliberately opens the drawer.
 *
 * FOUR THINGS STOP A FILTER FROM RUNNING WHERE NOBODY CAN SEE IT — the one
 * real cost of any fold, and the thing the overruled paragraph above was
 * right to worry about:
 *
 * ONE, THE COUNT ON THE SHUT CONTROL, in words ("2 filters actief") and in
 * the accent colour so it reads as state rather than as more label. It counts
 * every axis, because every axis is behind this fold — see
 * `describeDecisionFilters` for why the library's version counts only two of
 * its four and why that is the same rule, not a different one.
 *
 * ⚠ TWO, "WISSEN" — WITHDRAWN 9 SEPTEMBER 2026, on the owner's instruction
 * ("remove the 'wissen' button"). It used to sit opposite the opening and
 * appear the moment anything was set. Guard three below turns out to be the
 * one that carries the risk this guard was written for, and it is a primary
 * button rather than a quiet word. What is lost is clearing several chips at
 * once while results still exist — one tap per chip now. See the body where
 * the control stood.
 *
 * THREE, `NoCandidateState` ALREADY DRAWS ITS OWN "FILTERS WISSEN" — a
 * primary button, on `filtered_out`, at NoCandidateState.tsx:122-129. A
 * hidden filter that empties the pond announces itself with the one tap that
 * undoes it, without this component doing anything. Kiezen has this guard and
 * Mijn recepten does not.
 *
 * FOUR, THE FILTERS DO NOT SURVIVE THE SCREEN. `(tabs)/index.tsx:400` sets
 * `NO_DECISION_FILTERS` on every load, so tonight's narrowing cannot follow a
 * household into tomorrow the way a saved library search would.
 *
 * ⚠ WHAT THIS BAR DELIBERATELY DOES **NOT** COPY FROM `LibrarySearchBar`: its
 * drawer seeds itself OPEN from the active count (`isAdvancedExpanded`, a
 * lazy `useState` initializer). That guard is INERT HERE and would be dead
 * code arguing from a false premise. It exists there because that bar
 * unmounts when the library drops to zero rows while its `search` lives on in
 * recipes.tsx. Neither half of that is true on this screen: `load()` resets
 * the filters on every mount (index.tsx:400), and setting a filter cannot
 * unmount this bar. `showFilterBar` is `effectivePhase === 'ready' &&
 * !isEmptyRotation` (index.tsx:437-438): no chip touches the load phase, and
 * `decide()` returns `empty_rotation` from `unarchived.length === 0` BEFORE it
 * has looked at the filters at all (decide.ts:127-130). Filtering produces
 * `filtered_out`, which keeps the bar on screen. So this drawer starts shut,
 * always, and stays where the household last put it.
 *
 * Visual language follows docs/DESIGN.md: mono `label` eyebrows in
 * `textMuted` ("timecode burned into the frame"), `TimeCapPicker` — the
 * clock and five-minute ladder Mijn recepten uses for the same question —
 * `Chip` in its default multi-select checkbox role, and a hairline `border`
 * rule separating the bar from the hero below it. Every colour pairing used
 * here is asserted in tests/contrast.test.ts.
 *
 * EVERY DUTCH WORD COMES FROM decisionFilterCopy.ts, and that file is new
 * because this one could not be tested: vitest runs `node` with react-native
 * stubbed, so a sentence written in a `.tsx` is a sentence nothing can hold.
 * This bar had zero coverage on its copy before that module existed.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { DISH_MOODS } from '@/domain/dishMoods';
import { DISH_TAGS } from '@/domain/dishTags';
import { normalizeTag } from '@/domain/normalizeTag';
import type { TimeCap } from '@/domain/timeCap';
import type { DecisionFilters } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { IconChip } from './IconChip';
import { TimeCapPicker } from './TimeCapPicker';
import {
  DECISION_FILTER_MOODS_EYEBROW,
  DECISION_FILTER_TAGS_EYEBROW,
  describeDecisionDishMoodChip,
  describeDecisionDishTagChip,
} from './decisionFilterCopy';
import { iconForDishTag } from './dishTagIcons';

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
 * else.
 *
 * ⚠ THE LAST SENTENCE OF THIS NOTE IS NO LONGER TRUE AND IS REPLACED RATHER
 * THAN DELETED. It read: "This screen keeps its own 'HOEVEEL TIJD?' eyebrow
 * above it, which is where the difference between two screens belongs." The
 * owner asked for that text to go ("Verwijder de teksten 'hoeveel tijd' en
 * kiezen"), so the two screens now draw the identical control with no heading
 * on either — which is what libraryFilterCopy.ts argued for on its own screen
 * first, on the ground that a heading reading "Hoeveel tijd?" over a clock
 * showing a numeral is the same sentence twice. The word survives as
 * `DECISION_FILTER_TIME_EYEBROW`, spoken only by the opening's accessibility
 * label, because a screen reader cannot glance into a shut drawer.
 */
/*
 * ⚠ A PRIVATE `countActiveFilters` STOOD HERE AND IS GONE (9 september 2026).
 * It existed for one reason — deciding whether to draw `Wissen` — and it was
 * a SECOND implementation of a sum `decisionFilterCopy.ts` already exports as
 * `countDecisionFilters`, which is what `(tabs)/index.tsx` feeds the trigger.
 * Two functions computing the same number is precisely the drift this
 * codebase keeps paying for; with the control gone there is one again.
 */

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


  // The drawer's state lives HERE and not in (tabs)/index.tsx, mirroring
  // `isAdvancedExpanded` in LibrarySearchBar: whether a control is unfolded is
  // this component's own business, nothing outside it can act on the answer,
  // and keeping it local is what let this change land without touching the
  // screen that mounts the bar or any of its four props.
  //
  // STARTS SHUT, ALWAYS — see this file's header for why the library's
  // seed-from-the-count initializer is inert on this screen rather than
  // merely unnecessary.

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
    <View style={styles.bar}>
      {/* ⚠ THIS COMPONENT IS THE DRAWER AND NOT THE CONTROL, SINCE 8 SEPTEMBER
          2026. It used to open with its own 44pt row — the word `Filters`, a
          chevron and a count — with everything below folded behind it. The
          owner asked for Trending's treatment here: "ik wil dat we het filter
          icoontje net zo toepassen op de kiezen pagina als we bij trending
          hebben gedaan", having already said of that glyph: "Het icoontje is
          de filterknop, je hoeft dan niet ook nog 'filter' neer te zetten en
          een dropdown menu te maken."

          So the opening lives in `(tabs)/index.tsx` as a `FilterTrigger`, and
          this file renders only what the opening opens. Nothing about the
          controls changed: same picker, same vocabularies, same order, same
          AND/OR semantics, same spoken labels. */}
      <>
          {/* No eyebrow above it any more — instruction 2. The picker draws
              its own clock and numeral, so a heading was the same sentence
              twice; the word is still spoken by the opening's label. */}
          <TimeCapPicker value={filters.maxMinutes} onChange={handleChangeTimeCap} />

          {visibleTags.length > 0 ? (
            <>
              <Text style={[typeScale.label, styles.eyebrow, styles.tagEyebrow, { color: colors.textMuted }]}>
                {DECISION_FILTER_TAGS_EYEBROW}
              </Text>
              {/* Multi-select, so `Chip`'s default checkbox role is right here
                  and `ChipGroup` stays unlabelled — see ChipGroup's own note on
                  why a bare accessibilityLabel there is inert. Choosing several
                  means AND, not OR (see DecisionFilters.requiredDishTags), so
                  each chip's label says that out loud instead of leaving a
                  screen-reader user to infer it from a result they can't see.

                  `IconChip` AND NOT A BARE `Chip`, SINCE 2026-09-07, AND THE
                  OWNER DID NOT ASK FOR THIS ONE. Mijn recepten draws these
                  same seventeen chips with a glyph each (his "een
                  pasta-icoontje, en dan het woord pasta ernaast"); this row
                  drew them bare, so the moment the drawer opens the same
                  vocabulary appears twice in one app in two different
                  dresses. `iconForDishTag` was already exported and already
                  drawable — GAP-19 landed the glyphs the same day — so the
                  cost was one import in a file being rewritten anyway. It
                  costs no height either: `Chip` floors at 44pt and its label's
                  line box is 23pt, so a 16pt glyph is bounded by both. The
                  glyph is decorative and silent; the spoken label is
                  unchanged. To undo it, swap `IconChip` back for `Chip` and
                  drop the `icon` prop. */}
              <ChipGroup>
                {visibleTags.map((entry) => (
                  <IconChip
                    key={entry.tag}
                    icon={iconForDishTag(entry.tag)}
                    label={entry.label}
                    selected={selectedTags.has(entry.tag)}
                    onPress={() => handleToggleTag(entry.tag)}
                    role="checkbox"
                    accessibilityLabel={describeDecisionDishTagChip(entry.label)}
                  />
                ))}
              </ChipGroup>
            </>
          ) : null}

          {visibleMoods.length > 0 ? (
            <>
              {/* The second axis, and the row that finally makes this bar's
                  own header true: it has always claimed to answer "hoeveel
                  tijd heb ik" and "waar heb ik zin in", and until now the
                  second question was answered with a list of ingredients.
                  "Waarmee?" was a question about the pan; this one is about
                  the person. (The row above no longer says "Waarmee?" — see
                  DECISION_FILTER_TAGS_EYEBROW — but the distinction that
                  justified adding this axis is unchanged by renaming that
                  one.)

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
                  the difference from one.

                  NO ICONS, deliberately, and this is not an oversight left
                  behind by the row above: a mood ("zomers", "soul food") is a
                  feeling, and drawing one is a far harder claim than drawing a
                  pan. Mijn recepten's identical row is bare for the same
                  reason. */}
              <Text style={[typeScale.label, styles.eyebrow, styles.tagEyebrow, { color: colors.textMuted }]}>
                {DECISION_FILTER_MOODS_EYEBROW}
              </Text>
              <ChipGroup>
                {visibleMoods.map((entry) => (
                  <Chip
                    key={entry.mood}
                    label={entry.label}
                    selected={selectedMoods.has(entry.mood)}
                    onPress={() => handleToggleMood(entry.mood)}
                    role="checkbox"
                    accessibilityLabel={describeDecisionDishMoodChip(entry.label)}
                  />
                ))}
              </ChipGroup>
            </>
          ) : null}

        {/* ⚠ `Wissen` STOOD HERE AND IS GONE — 9 september 2026, op verzoek
            van de eigenaar: "it also says 'wissen' below it which I do not
            want, remove the 'wissen' button."

            WHAT CARRIED IT WAS GUARD TWO IN THIS FILE'S HEADER, and that
            guard turns out not to be the load-bearing one. It existed for a
            filter that is SET but cannot be SEEN, and the case it actually
            protects — a narrowing that empties the rotation — is answered one
            screen down without this control: `NoCandidateState.tsx:122-129`
            draws its own "Filters wissen" as a PRIMARY button on
            `filtered_out`. That is guard three, it is louder than this was,
            and it fires exactly when it matters.

            WHAT IS GENUINELY LOST, named rather than glossed: clearing
            several chips at once while results still exist. That is one tap
            per chip now. The count on the trigger still says how many are on
            (guard one), and guard four still holds — `(tabs)/index.tsx`
            resets to `NO_DECISION_FILTERS` on every load, so no narrowing
            survives the screen. */}
      </>
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
  eyebrow: {
    textTransform: 'uppercase',
  },
  tagEyebrow: {
    marginTop: spacing.space2,
  },
  // `reset` styled "Wissen" and went with it (9 september 2026).
  // react-native/no-unused-styles is what caught the leftover.
});

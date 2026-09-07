/**
 * Search + filter bar for "Mijn recepten" (LIB-01/LIB-03) — sits between
 * `LibraryHeader` and the grid in recipes.tsx once the household has at
 * least one saved recipe (see that screen's file header for why it never
 * renders over the first-run empty state).
 *
 * Purely presentational and purely controlled, matching every other filter
 * surface in this app (`DecisionFilterBar`, `RestrictionTagInput`): it
 * holds no `LibrarySearchState` of its own, only local `isFocused` for the
 * text input's visible focus ring. Every tap composes a new
 * `LibrarySearchState` immutably and hands it to `onChange` — the caller
 * (recipes.tsx) owns the state and decides what happens next. Every Dutch
 * word it says comes from libraryFilterCopy.ts, for the reason every
 * `*Copy.ts` module in this directory gives: vitest cannot import a `.tsx`,
 * so a sentence written here is a sentence no test can hold.
 *
 * ===========================================================================
 * THE BAR DID NOT SHRINK, AND THAT WAS THE DEFECT
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Bij mijn recepten zijn de filters, te
 * groot en wil ik dat je 3 recepten breed hebt onderin het scherm om door je
 * recepten heen te scrollen. De mijn recepten pagina is nu te rommelig,
 * verzin hier een logischere layout voor en hoe je dit zou willen doen met
 * duidelijke, overzichtelijke icoontjes. Ook hier weer hetzelfde klokje als
 * filter voor hoe lang het gerecht mag duren."
 *
 * Measured from the stylesheets, on a 393x852 phone with 714pt of usable
 * height between the safe-area inset and the tab bar:
 *
 *   library state                header + bar     tile rows on screen
 *   brand new                        311pt              1.28
 *   6 dish tags (ordinary)           452pt              0.83
 *   17 tags + 6 moods                813pt              0     (grid off-screen)
 *
 * Six dish tags is a household after roughly fifteen saves. And the reason
 * the grid was PUSHED OFF rather than squeezed is worth stating exactly,
 * because it is not obvious: Yoga defaults `flexShrink` to 0 and this
 * component set none, so the bar takes its full intrinsic height and the
 * `FlatList` beneath it gets whatever is left, including nothing.
 *
 * WS-2 §3.1 wrote the fix and nobody applied it: "The filter bar's chip rows
 * never wrap. One row each, fixed 47pt, horizontally scrolling. Wrapping is
 * what turns a 47pt control into a 322pt catalogue." That is what this file
 * now does. `ChipGroup` — whose entire job is `flexWrap: 'wrap'` — is gone
 * from this bar for that reason and no other; it is still right for the
 * surfaces that can afford to grow (Household setup's tag list, the outcome
 * card's moods), and this one cannot.
 *
 * THE BAR'S HEIGHT STILL DOES NOT DEPEND ON THE LIBRARY. SINCE 2026-09-07 IT
 * DEPENDS ON ONE THING THE HOUSEHOLD CONTROLS, AND ONLY WHILE THEY USE IT:
 *
 *   shut  68 (search + clock: `TimeCapPicker`'s 20pt readout, its 4pt margin
 *            and its 44pt touch area) + 8 + 47 (the two chip rows) + 8 + 44
 *            (the "Geavanceerd" opening, one touch target) + 16 = 191pt
 *   open  + 8 + 47 (wanneer and welke gang)                     = 246pt
 *
 * against 194pt before, when those last two axes were on screen whether or not
 * anybody wanted them. A library with seventeen tags and six moods still costs
 * what one with two costs — the 813pt case stays gone.
 *
 * WHAT THAT BUYS THE GRID, at 393x852 with 714pt of usable height and a 68pt
 * header: 455pt of viewport shut, 400pt open. On the 149.1pt tile pitch
 * measured above, that is 3.05 rows shut and 2.68 open, against 3.03 before
 * this change — so opening the drawer costs about a third of a tile row, for
 * as long as it is open and no longer.
 *
 * ===========================================================================
 * WS-2 §3.1's OTHER TWO REDLINES, AND WHERE THIS DEPARTS FROM ONE
 * ===========================================================================
 *
 * Redline 3 asked for "WISSEN" to move "into the filter bar's own right
 * edge". It is on the bar's right edge — but PINNED OUTSIDE the first chip
 * row's scroll view rather than placed at its end, and the difference is
 * forced by redline 1: a horizontally scrolling row has no visible right
 * edge. A "Wissen" at the end of the chips would be reachable only by
 * swiping past every chip, which is the opposite of what a reset is for. It
 * takes no space at all when there is nothing to reset.
 *
 * Redline 4 ("at fontScale >= 1.6 the bar renders as a single row, the time
 * control only") is NOT implemented here and is deliberately left as work.
 * The wrapping defect it was written to contain is gone — the bar no longer
 * grows with the library at any type size — so what remains at 200% type is
 * the ordinary cost of large chips, which this screen can afford now that it
 * scrolls in one direction and the grid drops to one column (WS-2 §5.4).
 *
 * ===========================================================================
 * THE CLOCK IS NOW THE PICKER, AND THAT REVERSES A RECORDED REJECTION
 * ===========================================================================
 *
 * Four chips (Alles / 20 / 30 / 45) are gone; `TimeCapPicker` is mounted in
 * their place, the same control Kiezen takes, consumed with its two props
 * and no `variant` — that component's header explains why a prop that lets
 * one screen ship a different control is how two screens stop sharing one.
 *
 * `src/domain/recipeSearch.ts` rejected exactly this ("a slider or a stepper
 * would let someone ask for 37 minutes, which nobody has ever wanted"), the
 * owner asked for it twice, and the reversal is recorded on
 * `LIBRARY_TIME_CAP_OPTIONS` itself rather than deleted — that constant still
 * owns the four numbers `describeTimeCapOption` was argued against, and the
 * picker still speaks through those words, including the part the visible
 * label has no room for ("Gerechten zonder tijd vallen af").
 *
 * IT SITS ON THE SEARCH ROW, sharing the width with the input. That is what
 * "search and clock on ONE row" costs: the track is about 145pt at 393pt,
 * roughly 6pt per five-minute stop. A drag is therefore coarse and the
 * numeral above it is always exact, which is the trade a filter can make and
 * a rating could not. Worth putting back in front of the owner if he would
 * rather spend 44pt more on a full-width track.
 *
 * ===========================================================================
 * TWO AXES IN THE BAR, TWO BEHIND AN OPENING, AND THE MEASUREMENT THAT SAID
 * WHICH
 * ===========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "in the recipe, my recipes, it says
 * when. It says sometime or cooked already, and I want to remove that part,
 * and then it says which course. Also, remove that part doesn't make sense. I
 * think maybe it's wise to have, like, an advanced filters here, where you
 * can just select the ingredients and advanced filters will give you the
 * option if you've cooked it before, which dish it is, so, like, which
 * course. So, like, dessert or main dish, something like that."
 *
 * HE ASKED FOR THE PLAN AXIS TO GO AND, THREE SENTENCES LATER, ASKED FOR IT
 * BACK — AND IT IS ONE AXIS, NOT TWO. Measured before building anything:
 * "sometime or cooked already" is `buildSchedulingLabel`'s "Ooit" and "Al
 * gekookt" (src/components/recipeScheduling.ts:91-106), and "the option if
 * you've cooked it before" is that same `al_gekookt` value on that same
 * four-value union (`RecipeSchedulingState`, recipeScheduling.ts:12). There
 * was no cooked-before filter to ADD; the one he asked for is the one he was
 * looking at. So the axis MOVES. A second cooked/not-cooked control beside it
 * would have been two chips answering one question — and since
 * `filterRowsBySchedulingStates` (libraryGridFilter.ts) ORs this axis, they
 * would not even have cancelled into silence; they would have quietly widened
 * each other.
 *
 * WHAT STAYS IN THE ORDINARY BAR: the title field, the clock, "INGREDIËNTEN"
 * (the dish tags, in his own word since 2026-09-07) and "WAAR HEB JE ZIN IN?".
 * WHAT MOVES BEHIND "GEAVANCEERD": "WANNEER?" and "WELKE GANG?", the two he
 * named. Row order is reading order: search, the axes that are always on
 * screen, the opening, then — only while it is open — the two behind it.
 *
 * THE MOODS ROW IS A JUDGEMENT CALL AND HE DID NOT MAKE IT. He named what
 * stays (the ingredients) and what moves (the plan, the course), and said
 * nothing about "Waar heb je zin in?". It stays in the ordinary bar because
 * it is the only axis left that asks about TONIGHT rather than describing the
 * recipe — Kiezen's own mood row asks the same thing — so it belongs beside
 * the clock rather than behind a fold holding two properties of a dish. The
 * rejected alternative was moving it too, because one chip row is tidier than
 * two; that is a designer's reason to overrule an owner who was being
 * specific. IT IS A SMALL CHANGE IF HE WANTS IT: move the mood block into the
 * advanced row and add `anyDishMoods.length` to `advancedFilterCount`, so the
 * count keeps telling the truth.
 *
 * THE PLAN AXIS STILL HAS THE BEST DATA ON THIS SCREEN AND IS NOW THE HARDEST
 * TO REACH. It is the only axis whose data is 100% populated — unlike
 * dishTags (written at import), dishMoods (written after cooking) and
 * dishCourse (written since migration 0017), see libraryGridFilter.ts. The
 * owner looked at it on a device and said it did not make sense THERE, which
 * is a statement about the top of a filter bar and not about the column under
 * it. If "Al gekookt" turns out to be what households reach for most, this
 * paragraph is where to start reading.
 *
 * EYEBROWS LEAD THEIR ROWS INSTEAD OF SITTING ABOVE THEM. "INGREDIËNTEN" is
 * the first thing inside the tag row's scroll rather than a 23pt line over it:
 * the heading costs width, which a scrolling row has, instead of height,
 * which this screen does not — and it stays visible and in reading order. The
 * two eyebrows behind the opening lead their row in exactly the same way, so
 * the drawer opens onto a row that reads like the one above it.
 *
 * ===========================================================================
 * THE ICONS, AND WHAT IS HONESTLY DRAWABLE TODAY
 * ===========================================================================
 *
 * THE "INGREDIËNTEN" ROW DRAWS AN ICON BESIDE EACH NAME — the owner's "een
 * pasta-icoontje, en dan het woord pasta ernaast" — through `IconChip` and
 * dishTagIcons.ts. IT ACTUALLY DRAWS THEM SINCE 7 SEPTEMBER 2026. Until
 * that day the row looked exactly as it did before the mapping existed:
 * Feather has no kitchen glyphs at all, so `isIconAvailable` was false for
 * all seventeen and `IconChip` rendered the plain `Chip` it wraps. GAP-19
 * landed in one step, with no change here — nothing in this file ever
 * pretended the glyphs existed, which is the whole contract of
 * Icon.tsx/iconFont.ts and the reason the row could be finished a font
 * ahead of itself.
 *
 * The other three axes get no icons and are not waiting for any. A mood is a
 * feeling and drawing one is a far harder claim than drawing a pan; a course
 * and a plan are words with no picture anybody would read faster than the
 * word. Where an icon genuinely pays on this screen it is already drawn: the
 * header's three controls, the clock on the picker, the chevron on the
 * "Geavanceerd" opening — a disclosure is the one control here whose entire
 * meaning IS a direction, which is the case a word cannot make more cheaply —
 * and the tile badge (libraryTileBadge.ts), which is the one place a glyph
 * buys back space a word could not fit into.
 *
 * ⚠ THE HEADING SAYS "INGREDIËNTEN"; THIS PARAGRAPH SAID THE OPPOSITE — "THE
 * HEADING STAYS 'WAARMEE?' ... it is his word to overrule" — and is quoted
 * rather than deleted, as every overruled argument is here. He overruled it on
 * 2026-09-07; the sweep that followed (5f0c762) crossed ten files and missed
 * this one, which draws the row. libraryFilterCopy.ts holds the count and the
 * condition for putting the word back; Kiezen says it too (decisionFilterCopy).
 *
 * ===========================================================================
 * WHAT IS OFFERED, AND WHAT USED TO BE
 * ===========================================================================
 *
 * The four chip lists arrive already narrowed (`filterLibraryGrid`), so a
 * chip is on screen only if adding it would leave at least one recipe
 * standing — plus whatever is already selected, so the chip that undoes an
 * empty grid never disappears. This component no longer intersects anything
 * against a full-library pool; it only orders what it is handed, against each
 * closed vocabulary, so chips never rearrange as a library grows.
 *
 * THAT NARROWING (LIB-07) IS EXACTLY WHY THE OPENING HAS TO CARRY A COUNT.
 * The four axes are computed against each other, so a plan chip that is ON —
 * and, since this change, possibly out of sight — thins the tag and mood rows
 * that are still visible. Until now every cause of that thinning was on
 * screen. Fold one away and a household watches its chips disappear with
 * nothing to point at, which is a worse control than the crowded bar the
 * owner asked to simplify. THREE THINGS STOP IT:
 *
 * ONE, THE COUNT ON THE CLOSED CONTROL. `describeAdvancedFilters` puts the
 * number of selected folded filters on the opening in words ("2 filters
 * actief"), in the accent colour so it reads as state rather than as a label,
 * and repeats it in the spoken label after naming the two axes inside.
 *
 * TWO, THE DRAWER SEEDS ITSELF OPEN from that count — see `isAdvancedExpanded`
 * below for why a mount is the one moment that needs it.
 *
 * THREE, "WISSEN" IS FREE EVIDENCE: it is pinned to the row that is always
 * rendered and appears whenever ANY filter is set, folded ones included. A
 * bar whose visible chips look untouched but whose right edge says WISSEN is
 * already admitting something before anybody reads the count.
 *
 * THE REJECTED ALTERNATIVE WAS REFUSING TO CLOSE while something inside is
 * selected: it makes "active but hidden" impossible by breaking the control's
 * only promise, that tapping it puts those rows away — telling a household
 * that filtered on "Al gekookt" on purpose that it may not have its screen
 * back.
 *
 * A row with nothing to offer is still not rendered: a chip for a category
 * nothing in this household's library carries is a control guaranteed to
 * return zero rows, and for a brand-new library the tag and mood rows are
 * legitimately absent. The time control is NOT gated that way — a cap stays
 * meaningful even for a library with no timed meals, which is itself the
 * signal — mirroring `DecisionFilterBar`.
 *
 * THE "SORTEREN" ROW WAS REMOVED ON 2026-09-05 at the owner's request
 * ("sorteren kan voor nu weg"). `src/domain/librarySort.ts` and its tests
 * survive uncalled on purpose — that file's own header says why, and why
 * removing a row of chips is not the same as overturning a decision about
 * ordering.
 */

import type { JSX, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { DISH_COURSES } from '@/domain/dishCourses';
import { DISH_MOODS } from '@/domain/dishMoods';
import { DISH_TAGS } from '@/domain/dishTags';
import { normalizeTag } from '@/domain/normalizeTag';
import { NO_LIBRARY_SEARCH, isLibrarySearchActive, type LibrarySearchState } from '@/domain/recipeSearch';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { IconChip } from './IconChip';
import { TimeCapPicker } from './TimeCapPicker';
import { iconForDishTag } from './dishTagIcons';
import { isIconAvailable, type IconName } from './iconFont';
import { LIBRARY_SCHEDULING_STATES } from './libraryGridFilter';
import { buildSchedulingLabel, type RecipeSchedulingState } from './recipeScheduling';
import {
  LIBRARY_FILTER_COURSES_EYEBROW,
  LIBRARY_FILTER_MOODS_EYEBROW,
  LIBRARY_FILTER_PLAN_EYEBROW,
  LIBRARY_FILTER_RESET_A11Y_LABEL,
  LIBRARY_FILTER_RESET_LABEL,
  LIBRARY_FILTER_TAGS_EYEBROW,
  LIBRARY_SEARCH_CLEAR_QUERY_LABEL,
  LIBRARY_SEARCH_INPUT_LABEL,
  LIBRARY_SEARCH_PLACEHOLDER,
  describeAdvancedFilters,
  describeDishCourseChip,
  describeDishMoodChip,
  describeDishTagChip,
  describeSchedulingChip,
} from './libraryFilterCopy';

export interface LibrarySearchBarProps {
  readonly search: LibrarySearchState;
  /**
   * The four axes, already narrowed against the current selection by
   * `filterLibraryGrid` — see that module for why availability is computed
   * there and not here, and what the old "offer everything in the library"
   * behaviour cost.
   */
  readonly selectableDishTags: readonly string[];
  readonly selectableDishMoods: readonly string[];
  readonly selectableDishCourses: readonly string[];
  readonly selectableSchedulingStates: readonly RecipeSchedulingState[];
  readonly onChange: (next: LibrarySearchState) => void;
}

/**
 * Sized against `typeScale.title3` (17 pt), which is what the literal "×"
 * this replaced was rendered at. Feather's `x` is one of the seven
 * literal-character sites GAP-19 lists; it is also one of the few whose
 * glyph the installed font can already draw, so it is fixed here rather
 * than left waiting on a font it does not need.
 */
const CLEAR_GLYPH_SIZE = 18;

/**
 * One chip row, fixed forever. `Chip` is `typeScale.body` (16/23) inside
 * `paddingVertical: space3` twice, so 23 + 24 = 47 — the number WS-2 §3.1
 * measured and asked this bar to hold to. Declaring it rather than letting
 * the content decide is what keeps a row that happens to be empty from
 * collapsing and shifting the grid up under the household's thumb.
 */
const FILTER_ROW_HEIGHT = 47;

/**
 * The chevron on the "Geavanceerd" opening. Feather has no `chevron-down`, so
 * the open state is this glyph turned a quarter turn
 * (`advancedGlyphExpanded`); the rejected alternative was a second name in
 * iconFont.ts whose only job would be to be the same drawing, rotated.
 *
 * Asked through `isIconAvailable` before it is drawn, exactly as `IconChip`
 * does and for the reason its header gives: `Icon` renders NOTHING for a name
 * no installed font can draw, so a caller that wants no dangling gap has to
 * ask first. The label and the count carry the control without it.
 */
const DISCLOSURE_GLYPH: IconName = 'chevron-right';

/**
 * 16pt — the small end of WS4's 16-20pt UI band, and `IconChip`'s size for a
 * glyph beside a label. Larger reads as an illustration competing with the
 * word rather than as a mark introducing it.
 */
const DISCLOSURE_GLYPH_SIZE = 16;

export function LibrarySearchBar(props: LibrarySearchBarProps): JSX.Element {
  const {
    search,
    selectableDishTags,
    selectableDishMoods,
    selectableDishCourses,
    selectableSchedulingStates,
    onChange,
  } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [isFocused, setIsFocused] = useState(false);

  // Each row is the closed vocabulary filtered down to what is on offer, so
  // the ORDER is the vocabulary's and never the library's — chips do not
  // rearrange themselves as a household saves.
  const offeredTags = new Set(selectableDishTags.map(normalizeTag));
  const visibleTags = DISH_TAGS.filter((entry) => offeredTags.has(entry.tag));
  const selectedTags = new Set(search.requiredDishTags.map(normalizeTag));

  const offeredMoods = new Set(selectableDishMoods.map(normalizeTag));
  const visibleMoods = DISH_MOODS.filter((entry) => offeredMoods.has(entry.mood));
  const selectedMoods = new Set(search.anyDishMoods.map(normalizeTag));

  const offeredCourses = new Set(selectableDishCourses.map(normalizeTag));
  const visibleCourses = DISH_COURSES.filter((entry) => offeredCourses.has(entry.course));
  const selectedCourses = new Set(search.anyDishCourses.map(normalizeTag));

  const offeredStates = new Set<string>(selectableSchedulingStates);
  const visibleStates = LIBRARY_SCHEDULING_STATES.filter((state) => offeredStates.has(state));
  const selectedStates = new Set(search.anySchedulingStates);

  const isActive = isLibrarySearchActive(search);
  const hasCategoryRow = visibleTags.length > 0 || visibleMoods.length > 0;
  // Nothing behind the fold means no fold: an opening onto an empty row is a
  // control that answers a finger with nothing. In practice this closes only
  // for a library with no rows at all — the plan axis is always populated —
  // and that is a screen this component is never rendered on.
  const hasAdvancedRow = visibleStates.length > 0 || visibleCourses.length > 0;

  // How many of the FOLDED axes are switched on — the number the opening
  // shows. Deliberately not `isLibrarySearchActive`, which also counts the
  // query, the tag chips and the time cap: those are all on screen, and a
  // count that included them would claim something is hidden when nothing is.
  const advancedFilterCount = search.anySchedulingStates.length + search.anyDishCourses.length;

  // Seeded from the count, not started shut — guard two of the three the
  // header lists against a filter that is set and cannot be seen. It matters
  // at MOUNT only: within one mount the drawer must already be open for these
  // chips to be tapped at all, but this component unmounts whenever the
  // library drops to zero rows while `search` lives on in recipes.tsx, and
  // that search would otherwise come back invisible. A lazy initializer and
  // NOT a derived value: after mount the drawer is the household's own
  // decision, and recomputing would re-open one they just shut on purpose.
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState(() => advancedFilterCount > 0);

  // Immutable both ways, matching DecisionFilterBar's own toggle — the
  // caller holds this object in state and may still be mid-render with the
  // previous one.
  const handleToggleTag = (tag: string): void => {
    const nextTags = selectedTags.has(tag)
      ? search.requiredDishTags.filter((value) => normalizeTag(value) !== tag)
      : [...search.requiredDishTags, tag];
    onChange({ ...search, requiredDishTags: nextTags });
  };

  const handleToggleMood = (mood: string): void => {
    const nextMoods = selectedMoods.has(mood)
      ? search.anyDishMoods.filter((value) => normalizeTag(value) !== mood)
      : [...search.anyDishMoods, mood];
    onChange({ ...search, anyDishMoods: nextMoods });
  };

  const handleToggleCourse = (course: string): void => {
    const nextCourses = selectedCourses.has(course)
      ? search.anyDishCourses.filter((value) => normalizeTag(value) !== course)
      : [...search.anyDishCourses, course];
    onChange({ ...search, anyDishCourses: nextCourses });
  };

  const handleToggleState = (state: RecipeSchedulingState): void => {
    const nextStates = selectedStates.has(state)
      ? search.anySchedulingStates.filter((value) => value !== state)
      : [...search.anySchedulingStates, state];
    onChange({ ...search, anySchedulingStates: nextStates });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <TextInput
            value={search.query}
            onChangeText={(query) => onChange({ ...search, query })}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={LIBRARY_SEARCH_PLACEHOLDER}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel={LIBRARY_SEARCH_INPUT_LABEL}
            style={[
              typeScale.body,
              styles.input,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderColor: isFocused ? colors.focusRing : colors.borderStrong,
                borderWidth: isFocused ? 2 : 1,
              },
            ]}
          />
          {search.query.length > 0 ? (
            <Pressable
              onPress={() => onChange({ ...search, query: '' })}
              accessibilityRole="button"
              accessibilityLabel={LIBRARY_SEARCH_CLEAR_QUERY_LABEL}
              style={styles.clearButton}
            >
              <Icon name="close" size={CLEAR_GLYPH_SIZE} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {/* The owner's clock, on the search row because he approved a layout
            with both on one line. `TimeCapPicker` draws its own clock and
            numeral, so this bar adds no eyebrow above it — see
            libraryFilterCopy.ts on the one eyebrow that is no longer drawn. */}
        <View style={styles.timeCapWrap}>
          <TimeCapPicker value={search.maxMinutes} onChange={(maxMinutes) => onChange({ ...search, maxMinutes })} />
        </View>
      </View>

      {/* THE ROW THAT CARRIES "WISSEN" IS THE ROW THAT IS ALWAYS THERE, and
          since the plan and course axes moved behind the opening, that is this
          one. `|| isActive` is not tidiness: a query that matches nothing
          narrows every chip list to nothing too, so gating on chips alone
          would take "Wissen" off the screen at the exact moment it is the only
          control that helps. It does a second job now — a filter selected
          behind the fold makes `isActive` true, so this row says WISSEN even
          when every visible chip looks untouched (guard three, see the
          header). The zero-results state below the bar carries its own clear
          button: a second answer to the same problem, not a reason to drop the
          first. */}
      {hasCategoryRow || isActive ? (
        <FilterRow
          reset={
            isActive ? (
              <Pressable
                onPress={() => onChange(NO_LIBRARY_SEARCH)}
                style={styles.reset}
                accessibilityRole="button"
                accessibilityLabel={LIBRARY_FILTER_RESET_A11Y_LABEL}
              >
                <Text style={[typeScale.label, styles.eyebrow, { color: colors.accent }]}>
                  {LIBRARY_FILTER_RESET_LABEL}
                </Text>
              </Pressable>
            ) : null
          }
        >
          {visibleTags.length > 0 ? <RowEyebrow text={LIBRARY_FILTER_TAGS_EYEBROW} /> : null}
          {/* AND semantics — see DecisionFilterBar's identical row for the
              full argument. Spoken out loud in each chip's own
              accessibility label rather than left for a screen-reader user
              to infer from a result they cannot see. The icon adds nothing
              a screen reader should read twice, so it stays silent. */}
          {visibleTags.map((entry) => (
            <IconChip
              key={entry.tag}
              icon={iconForDishTag(entry.tag)}
              label={entry.label}
              selected={selectedTags.has(entry.tag)}
              onPress={() => handleToggleTag(entry.tag)}
              role="checkbox"
              accessibilityLabel={describeDishTagChip(entry.label)}
            />
          ))}
          {visibleMoods.length > 0 ? <RowEyebrow text={LIBRARY_FILTER_MOODS_EYEBROW} /> : null}
          {/* OR semantics, the deliberate asymmetry with the row above —
              see DecisionFilters.anyDishMoods in types.ts. No icons here: a
              mood ("zomers", "soul food") is a feeling, and drawing one is
              a far harder claim than drawing a pan. */}
          {visibleMoods.map((entry) => (
            <Chip
              key={entry.mood}
              label={entry.label}
              selected={selectedMoods.has(entry.mood)}
              onPress={() => handleToggleMood(entry.mood)}
              role="checkbox"
              accessibilityLabel={describeDishMoodChip(entry.label)}
            />
          ))}
        </FilterRow>
      ) : null}

      {hasAdvancedRow ? (
        <AdvancedDisclosure
          isExpanded={isAdvancedExpanded}
          activeFilterCount={advancedFilterCount}
          onToggle={() => setIsAdvancedExpanded((wasExpanded) => !wasExpanded)}
        />
      ) : null}

      {/* The two axes the owner asked to take out of the ordinary bar.
          UNMOUNTED rather than hidden with a style, so a shut drawer costs no
          height and gives a screen reader nothing to walk past. Nothing about
          the chips themselves changed: same vocabularies, same order, same OR
          semantics, same spoken labels. */}
      {hasAdvancedRow && isAdvancedExpanded ? (
        <FilterRow>
          {visibleStates.length > 0 ? <RowEyebrow text={LIBRARY_FILTER_PLAN_EYEBROW} /> : null}
          {/* OR semantics, spoken in each chip's own label. A recipe
              resolves to exactly one state, so AND would be empty by
              construction — libraryGridFilter.ts carries that argument. */}
          {visibleStates.map((state) => (
            <Chip
              key={state}
              label={buildSchedulingLabel(state)}
              selected={selectedStates.has(state)}
              onPress={() => handleToggleState(state)}
              role="checkbox"
              accessibilityLabel={describeSchedulingChip(buildSchedulingLabel(state))}
            />
          ))}
          {visibleCourses.length > 0 ? <RowEyebrow text={LIBRARY_FILTER_COURSES_EYEBROW} /> : null}
          {/* Also OR, and for the same structural reason: dishCourses.ts
              fixes the cardinality at one course per dish. An untagged
              recipe IS a hoofdgerecht, so that chip keeps every row written
              before migration 0017 — see `matchesDishCourses`. */}
          {visibleCourses.map((entry) => (
            <Chip
              key={entry.course}
              label={entry.label}
              selected={selectedCourses.has(entry.course)}
              onPress={() => handleToggleCourse(entry.course)}
              role="checkbox"
              accessibilityLabel={describeDishCourseChip(entry.label)}
            />
          ))}
        </FilterRow>
      ) : null}
    </View>
  );
}

/**
 * The "Geavanceerd" opening: one row, one control, the only thing on this bar
 * that is neither a chip nor a field. IT IS A `button`, NOT A `checkbox` — it
 * holds no part of `LibrarySearchState` and narrows nothing, it decides
 * whether two chip rows are on screen, and a checkbox role would file a
 * control that changes no result with the twenty-odd beside it that do.
 *
 * `accessibilityState={{ expanded }}` RATHER THAN A LABEL SAYING "OPEN" OR
 * "DICHT" — the choice `SourceTextPanel` made, for its reason: the platform
 * announces expanded/collapsed in the user's own language, and a hand-written
 * Dutch equivalent is a second translation of a sentence the OS already says,
 * free to drift from the visible chevron the day somebody edits one of them.
 *
 * THE SPOKEN LABEL NAMES WHAT IS INSIDE AND WHAT IS ON. "Geavanceerde
 * filters: Wanneer? Welke gang? 2 filters actief." A sighted household reads
 * those facts off the row when it opens; somebody who cannot see the chips
 * gets them from the control that hides them. libraryFilterCopy.ts owns both
 * sentences and composes the axis names from the eyebrows themselves, so a
 * third axis moved behind this fold cannot leave the label listing two.
 */
function AdvancedDisclosure(props: {
  readonly isExpanded: boolean;
  readonly activeFilterCount: number;
  readonly onToggle: () => void;
}): JSX.Element {
  const { isExpanded, activeFilterCount, onToggle } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const copy = describeAdvancedFilters(activeFilterCount);

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityLabel={copy.accessibilityLabel}
      style={styles.advancedToggle}
    >
      {isIconAvailable(DISCLOSURE_GLYPH) ? (
        <View style={isExpanded ? styles.advancedGlyphExpanded : null}>
          <Icon name={DISCLOSURE_GLYPH} size={DISCLOSURE_GLYPH_SIZE} color={colors.textMuted} />
        </View>
      ) : null}
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>{copy.label}</Text>
      {/* The accent colour is the point: a count in `textMuted` beside a muted
          label reads as more label, and this is the one thing on a shut drawer
          that says a filter is running. */}
      {copy.activeBadge !== null ? (
        <Text style={[typeScale.label, styles.eyebrow, { color: colors.accent }]}>{copy.activeBadge}</Text>
      ) : null}
    </Pressable>
  );
}

/**
 * One 47pt chip row that scrolls sideways and never wraps — WS-2 §3.1's
 * redline, and the whole reason this bar has a fixed height.
 *
 * `ChipGroup` is deliberately not used: its only job is `flexWrap: 'wrap'`,
 * which is exactly the property that turns a 47pt control into a 322pt
 * catalogue. It remains correct for surfaces that can afford to grow.
 *
 * `alignItems: 'center'` on the content rather than the default stretch, so
 * the inline eyebrow sits on the chips' optical centre line instead of being
 * pulled to their full height — the one thing that would make a row-leading
 * label read as a disabled chip.
 *
 * `keyboardShouldPersistTaps="handled"` because the search field is one row
 * up: without it the first tap on a chip only dismisses the keyboard, and the
 * household has to tap twice for every filter they set while typing.
 *
 * `reset` is rendered OUTSIDE the scroll view, on the right. A horizontally
 * scrolling row has no visible right edge, so a "Wissen" at the end of the
 * chips would be reachable only by swiping past all of them.
 */
function FilterRow(props: { readonly children: ReactNode; readonly reset?: ReactNode }): JSX.Element {
  const { children, reset } = props;
  return (
    <View style={styles.filterRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // `flex: 1` and not the default: Yoga gives a row child no flex and
        // no shrink, so a ScrollView here would size to its own CONTENT and
        // push the reset control off the right edge — the one control that
        // must never scroll away.
        style={styles.filterRowScroll}
        contentContainerStyle={styles.filterRowContent}
      >
        {children}
      </ScrollView>
      {reset}
    </View>
  );
}

/**
 * A row-leading heading, inline with the chips it names.
 *
 * It is not a control and does not answer a finger; it is the eyebrow that
 * used to sit above the row, laid on the axis this bar has room on. Left in
 * the reading order rather than hidden from assistive tech, because that
 * ordering is the only grouping a screen reader gets now that the rows are
 * not stacked.
 */
function RowEyebrow(props: { readonly text: string }): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  return (
    <Text style={[typeScale.label, styles.eyebrow, styles.rowEyebrow, { color: colors.textMuted }]}>{props.text}</Text>
  );
}

const styles = StyleSheet.create({
  container: {
    // No horizontal padding on the container: the chip rows must be able to
    // scroll out to both screen edges, or the last chip looks like the last
    // one there is. Every child that is NOT a scrolling row pays its own
    // inset instead.
    paddingBottom: spacing.space4,
    gap: spacing.space2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
  clearButton: {
    // Overlays the input's trailing edge rather than sitting beside it: at
    // half the screen width there is no room for a 44pt column that exists
    // only while something is typed, and a field that narrows as you type is
    // worse than one whose last characters sit under a button.
    position: 'absolute',
    right: 0,
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCapWrap: {
    // Half the row. `TimeCapPicker` stretches to it, giving a ~145pt track at
    // 393pt — see this file's header on what that costs and what it buys.
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // A chip is 47pt (body 16/23 inside `Chip`'s 12pt vertical padding), and
    // stating it here is what makes the bar a FIXED height: an empty row —
    // one carrying only "Wissen" — occupies exactly as much as a full one, so
    // the grid beneath does not jump as chips come and go.
    minHeight: FILTER_ROW_HEIGHT,
    paddingRight: spacing.screenPaddingHorizontal,
  },
  filterRowScroll: {
    flex: 1,
  },
  filterRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
    // The row starts at the screen's text margin and is allowed to run past
    // the opposite one, which is what tells a reader that it continues.
    paddingLeft: spacing.screenPaddingHorizontal,
    paddingRight: spacing.space2,
  },
  eyebrow: {
    textTransform: 'uppercase',
  },
  rowEyebrow: {
    // Breathing room on the leading side, which matters for the second
    // eyebrow in a row: it follows a chip rather than the content inset.
    marginLeft: spacing.space1,
  },
  reset: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingLeft: spacing.space3,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
    // A touch target, stated rather than inherited from a 15pt line of text:
    // this row's content is `typeScale.label` at 12/15, so without it the
    // control is a 15pt band nobody can hit. It stretches the full width for
    // the same reason — the rejected `alignSelf: 'flex-start'` looks tidier in
    // a screenshot and asks for aim from somebody holding a pan.
    minHeight: spacing.touchTargetMin,
    // NOT a scrolling row, so it pays its own screen inset — the rule the
    // container's comment states for every child that does not scroll.
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  advancedGlyphExpanded: {
    // A quarter turn clockwise: `chevron-right` becomes the chevron-down every
    // open disclosure draws. See `DISCLOSURE_GLYPH` for why a rotation and not
    // a second glyph name; it is also compositor-only, so nothing reflows.
    transform: [{ rotate: '90deg' }],
  },
});

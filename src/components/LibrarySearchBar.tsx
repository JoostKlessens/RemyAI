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
 * VISUAL LANGUAGE DELIBERATELY MIRRORS `DecisionFilterBar`: the same mono
 * `label` eyebrows in `textMuted`, the same `Chip`/`ChipGroup` rows, the
 * same "Wissen" reset pattern, and now the same 20/30/45 time steps. Two
 * different screens asking two different questions ("wat ga ik vanavond
 * koken" vs. "welk gerecht zoek ik") reuse one visual grammar for "narrow
 * this pool," so a household that has learned one control already knows the
 * other. The rows are NOT the same component, though: `DecisionFilterBar`
 * is owned by the decision surface and typed against `DecisionFilters`,
 * which has no free-text query; this bar is typed against
 * `LibrarySearchState`, which does. Sharing one component across two
 * independently-owned screens would mean either screen's next change risks
 * the other's behaviour.
 *
 * THE TIME CONTROL IS A CAP NOW, NOT A BOOLEAN, and that is the owner's
 * request: "een klokje waarmee je kan instellen hoe lang het recept
 * maximaal mag duren". It used to be one "Snel" toggle hardcoded at twenty
 * minutes — see recipeSearch.ts's `LibrarySearchState` for why that was the
 * wrong shape and what it cost a household with half an hour. Four chips
 * (Alles / 20 / 30 / 45) rather than a stepper or a slider, because a chip
 * row is what every other filter on this screen already is and because
 * nobody has ever wanted to ask for thirty-seven minutes.
 *
 * WHERE THE CLOCK SITS, AND WHY IT IS NOT ITSELF A BUTTON. The owner
 * described "een klokje waar je op kan tikken"; what is rendered is a clock
 * marking the eyebrow, with the four caps tappable directly beneath it. An
 * icon-only button that opened a menu of caps would be a second interaction
 * pattern this app does not have anywhere else, it would hide the current
 * cap behind a tap, and it would spend a 44 pt target on a control whose
 * options already fit on one line. The clock earns its place by making the
 * row readable at a glance instead. Worth putting back in front of the
 * owner if a menu is what he pictured.
 *
 * THE "WAARMEE?" ROW DRAWS AN ICON BESIDE EACH NAME — the owner's "een
 * pasta-icoontje, en dan het woord pasta ernaast" — through `IconChip` and
 * dishTagIcons.ts. TODAY THAT ROW LOOKS EXACTLY AS IT DID BEFORE: Feather
 * has no kitchen glyphs at all, so `isIconAvailable` is false for all
 * seventeen and `IconChip` renders the plain `Chip` it wraps. The row
 * becomes illustrated in one step when GAP-19's Phosphor subset lands, with
 * no change here. Nothing pretends the glyphs exist in the meantime; that
 * is the whole contract of Icon.tsx/iconFont.ts.
 *
 * THE HEADING STAYS "WAARMEE?" AND THE OWNER ASKED FOR "INGREDIËNTEN".
 * libraryFilterCopy.ts carries the argument in full — eight of the
 * seventeen values are not ingredients, so the heading would lie about half
 * its own chips — and it is his word to overrule.
 *
 * The dishTags/dishMoods rows are gated on `availableDishTags` /
 * `availableDishMoods` actually being non-empty, exactly like
 * `DecisionFilterBar`'s own restraint: a chip for a category nothing in
 * this household's library carries is a control guaranteed to return zero
 * rows, and for a brand-new library BOTH rows are legitimately absent. The
 * time row is NOT gated the same way — a time cap stays meaningful even for
 * a library with no timed meals at all (that is itself the signal, not a
 * reason to hide the control), mirroring `DecisionFilterBar`'s own time
 * control, which is never gated on availability either.
 *
 * THE "SORTEREN" ROW WAS REMOVED ON 2026-09-05 at the owner's request
 * ("sorteren kan voor nu weg"). `src/domain/librarySort.ts` and its tests
 * survive uncalled on purpose — that file's own header says why, and why
 * removing a row of chips is not the same as overturning a decision about
 * ordering. This component no longer takes `sort`/`onChangeSort`, and
 * "Wissen" means exactly what it always meant: clear the search, which is
 * now the only state this bar reads or writes.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { DISH_MOODS } from '@/domain/dishMoods';
import { DISH_TAGS } from '@/domain/dishTags';
import { normalizeTag } from '@/domain/normalizeTag';
import {
  LIBRARY_TIME_CAP_OPTIONS,
  NO_LIBRARY_SEARCH,
  isLibrarySearchActive,
  type LibrarySearchState,
} from '@/domain/recipeSearch';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';
import { Icon } from './Icon';
import { IconChip } from './IconChip';
import { iconForDishTag } from './dishTagIcons';
import {
  LIBRARY_FILTER_MOODS_EYEBROW,
  LIBRARY_FILTER_RESET_A11Y_LABEL,
  LIBRARY_FILTER_RESET_LABEL,
  LIBRARY_FILTER_TAGS_EYEBROW,
  LIBRARY_FILTER_TIME_EYEBROW,
  LIBRARY_FILTER_TIME_GROUP_LABEL,
  LIBRARY_SEARCH_CLEAR_QUERY_LABEL,
  LIBRARY_SEARCH_INPUT_LABEL,
  LIBRARY_SEARCH_PLACEHOLDER,
  describeDishMoodChip,
  describeDishTagChip,
  describeTimeCapOption,
} from './libraryFilterCopy';

export interface LibrarySearchBarProps {
  readonly search: LibrarySearchState;
  /** Dish tags present on at least one meal in the library — see this file's header for why the row is gated on this. */
  readonly availableDishTags: readonly string[];
  /** Dish moods present on at least one meal in the library, same gating reason. */
  readonly availableDishMoods: readonly string[];
  readonly onChange: (next: LibrarySearchState) => void;
}

/**
 * 14 pt, deliberately UNDER WS4's 16-20 pt band for UI glyphs, and the
 * reason is what the glyph sits next to. That band was measured against
 * body text; an eyebrow is `typeScale.label` at 12 pt, and a 16 pt clock
 * beside 12 pt mono capitals reads as an illustration that has wandered
 * into a caption. 14 pt is the largest size that still reads as part of the
 * label rather than as a thing beside it.
 */
const EYEBROW_GLYPH_SIZE = 14;

/**
 * Sized against `typeScale.title3` (17 pt), which is what the literal "×"
 * this replaced was rendered at. Feather's `x` is one of the seven
 * literal-character sites GAP-19 lists; it is also one of the few whose
 * glyph the installed font can already draw, so it is fixed here rather
 * than left waiting on a font it does not need.
 */
const CLEAR_GLYPH_SIZE = 18;

export function LibrarySearchBar(props: LibrarySearchBarProps): JSX.Element {
  const { search, availableDishTags, availableDishMoods, onChange } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [isFocused, setIsFocused] = useState(false);

  const available = new Set(availableDishTags.map(normalizeTag));
  const visibleTags = DISH_TAGS.filter((entry) => available.has(entry.tag));
  const selectedTags = new Set(search.requiredDishTags.map(normalizeTag));

  const availableMoods = new Set(availableDishMoods.map(normalizeTag));
  const visibleMoods = DISH_MOODS.filter((entry) => availableMoods.has(entry.mood));
  const selectedMoods = new Set(search.anyDishMoods.map(normalizeTag));

  const isActive = isLibrarySearchActive(search);

  const handleToggleTag = (tag: string): void => {
    // Immutable both ways, matching DecisionFilterBar's own toggle — the
    // caller holds this object in state and may still be mid-render with
    // the previous one.
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

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
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

      <View style={styles.headerRow}>
        {/* The clock the owner asked for. Decorative: `Icon` marks every
            glyph as not-an-accessibility-element and the eyebrow beside it
            is already read out, so announcing "klok" here would be a second
            reading of one heading. */}
        <View style={styles.eyebrowRow}>
          <Icon name="clock" size={EYEBROW_GLYPH_SIZE} color={colors.textMuted} />
          <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>
            {LIBRARY_FILTER_TIME_EYEBROW}
          </Text>
        </View>
        {isActive ? (
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
        ) : null}
      </View>
      {/* Single-select over `number | null`, so `Chip`'s radio role (A8) and
          a REAL radiogroup on the group — the one case ChipGroup's own
          header permits an accessibilityLabel, since a label on a role-less
          View is inert. The rows below stay multi-select and unlabelled. */}
      <ChipGroup accessibilityRole="radiogroup" accessibilityLabel={LIBRARY_FILTER_TIME_GROUP_LABEL}>
        {LIBRARY_TIME_CAP_OPTIONS.map((cap) => {
          const copy = describeTimeCapOption(cap);
          return (
            <Chip
              key={copy.label}
              label={copy.label}
              selected={search.maxMinutes === cap}
              onPress={() => onChange({ ...search, maxMinutes: cap })}
              role="radio"
              accessibilityLabel={copy.accessibilityLabel}
            />
          );
        })}
      </ChipGroup>

      {visibleTags.length > 0 ? (
        <>
          <Text style={[typeScale.label, styles.eyebrow, styles.rowSpacing, { color: colors.textMuted }]}>
            {LIBRARY_FILTER_TAGS_EYEBROW}
          </Text>
          {/* AND semantics — see DecisionFilterBar's identical row for the
              full argument. Spoken out loud in each chip's own
              accessibility label rather than left for a screen-reader user
              to infer from a result they cannot see. The icon adds nothing
              a screen reader should read twice, so it stays silent. */}
          <ChipGroup>
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
          </ChipGroup>
        </>
      ) : null}

      {visibleMoods.length > 0 ? (
        <>
          <Text style={[typeScale.label, styles.eyebrow, styles.rowSpacing, { color: colors.textMuted }]}>
            {LIBRARY_FILTER_MOODS_EYEBROW}
          </Text>
          {/* OR semantics, the deliberate asymmetry with the row above —
              see DecisionFilters.anyDishMoods in types.ts. No icons here: a
              mood ("zomers", "soul food") is a feeling, and drawing one is
              a far harder claim than drawing a pan. */}
          <ChipGroup>
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
          </ChipGroup>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingBottom: spacing.space4,
    gap: spacing.space2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
  },
  input: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
  clearButton: {
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing.touchTargetMin,
    marginTop: spacing.space2,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
  },
  eyebrow: {
    textTransform: 'uppercase',
  },
  rowSpacing: {
    marginTop: spacing.space2,
  },
  reset: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingLeft: spacing.space4,
  },
});

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
 * (recipes.tsx) owns the state and decides what happens next.
 *
 * VISUAL LANGUAGE DELIBERATELY MIRRORS `DecisionFilterBar`: the same mono
 * `label` eyebrows in `textMuted`, the same `Chip`/`ChipGroup` multi-select
 * rows for dishTags (AND) and dishMoods (OR), the same "WISSEN" reset
 * pattern. Two different screens asking two different questions ("wat ga
 * ik vanavond koken" vs. "welk gerecht zoek ik") reuse one visual grammar
 * for "narrow this pool," so a household that has learned one control
 * already knows the other. The rows are NOT the same component, though:
 * `DecisionFilterBar` is owned by the decision surface and typed against
 * `DecisionFilters` (a `maxMinutes` number, no free-text query); this bar
 * is typed against `LibrarySearchState` (a `quickOnly` boolean, plus the
 * title field neither the decision surface nor `DecisionFilters` has any
 * use for). Sharing one component across two independently-owned screens
 * with two different state shapes would mean either screen's next change
 * risks the other's behaviour.
 *
 * The dishTags/dishMoods rows are gated on `availableDishTags` /
 * `availableDishMoods` actually being non-empty, exactly like
 * `DecisionFilterBar`'s own restraint: a chip for a category nothing in
 * this household's library carries is a control guaranteed to return zero
 * rows, and for a brand-new library BOTH rows are legitimately absent. The
 * "Snel" toggle is NOT gated the same way — a time cutoff stays meaningful
 * even for a library with no timed meals at all (that is itself the
 * signal, not a reason to hide the control), mirroring
 * `DecisionFilterBar`'s own time control, which is never gated on
 * availability either.
 *
 * LIB-04's "SORTEREN" ROW, ADDED LAST, IS NOT A FIFTH FILTER. It reads and
 * writes `LibrarySortOption` (src/domain/librarySort.ts) through its own
 * `sort`/`onChangeSort` pair, deliberately never folded into
 * `LibrarySearchState` — see that module's header for the full argument.
 * Visually it borrows the same eyebrow + `ChipGroup` grammar as every row
 * above for the reason this file's header already gives (one control
 * grammar, two screens), but semantically it answers "in what order",
 * never "which of these" — "Wissen" above clears the search only, on
 * purpose, and never resets this row.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { DISH_MOODS } from '@/domain/dishMoods';
import { DISH_TAGS } from '@/domain/dishTags';
import { DEFAULT_LIBRARY_SORT, type LibrarySortOption } from '@/domain/librarySort';
import { normalizeTag } from '@/domain/normalizeTag';
import {
  LIBRARY_QUICK_MAX_MINUTES,
  NO_LIBRARY_SEARCH,
  isLibrarySearchActive,
  type LibrarySearchState,
} from '@/domain/recipeSearch';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';

export interface LibrarySearchBarProps {
  readonly search: LibrarySearchState;
  /** Dish tags present on at least one meal in the library — see this file's header for why the row is gated on this. */
  readonly availableDishTags: readonly string[];
  /** Dish moods present on at least one meal in the library, same gating reason. */
  readonly availableDishMoods: readonly string[];
  readonly onChange: (next: LibrarySearchState) => void;
  /**
   * LIB-04. Deliberately a SEPARATE prop from `search`/`onChange` rather
   * than a fifth `LibrarySearchState` field — see librarySort.ts's header
   * for the full argument: a search accumulates (query AND tags AND a time
   * cap), a sort is exclusive (the grid is ordered one way at a time), and
   * "Wissen" above resets only the accumulating half. Sorting by a chosen
   * criterion is a standing choice a household keeps making, independent of
   * whatever they are currently searching for.
   */
  readonly sort: LibrarySortOption;
  readonly onChangeSort: (next: LibrarySortOption) => void;
}

/** Single-select, so `Chip`'s `role="radio"` — A8's rule (Chip.tsx) for a `T | null`-shaped choice, not a multi-select toggle. */
const SORT_OPTIONS: readonly { readonly value: LibrarySortOption; readonly label: string; readonly accessibilityLabel: string }[] = [
  {
    value: DEFAULT_LIBRARY_SORT,
    label: 'Aanbevolen',
    accessibilityLabel: 'Aanbevolen volgorde. Deze week eerst, net als in de standaardweergave.',
  },
  {
    value: 'recent_toegevoegd',
    label: 'Recent toegevoegd',
    accessibilityLabel: 'Recent toegevoegd. Nieuwste recepten eerst.',
  },
  {
    value: 'nog_nooit_gekookt',
    label: 'Nog nooit gekookt',
    accessibilityLabel: 'Nog nooit gekookt. Wat je nog nooit maakte staat bovenaan.',
  },
];

export function LibrarySearchBar(props: LibrarySearchBarProps): JSX.Element {
  const { search, availableDishTags, availableDishMoods, onChange, sort, onChangeSort } = props;
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
          placeholder="Zoek op titel"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Zoek in Mijn recepten, op titel"
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
            accessibilityLabel="Wis zoekopdracht"
            style={styles.clearButton}
          >
            <Text style={[typeScale.title3, { color: colors.textMuted }]}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.headerRow}>
        <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>HOEVEEL TIJD?</Text>
        {isActive ? (
          <Pressable
            onPress={() => onChange(NO_LIBRARY_SEARCH)}
            style={styles.reset}
            accessibilityRole="button"
            accessibilityLabel="Wis de zoekopdracht en alle filters"
          >
            <Text style={[typeScale.label, styles.eyebrow, { color: colors.accent }]}>WISSEN</Text>
          </Pressable>
        ) : null}
      </View>
      <ChipGroup>
        <Chip
          label={`Snel (max. ${LIBRARY_QUICK_MAX_MINUTES} min)`}
          selected={search.quickOnly}
          onPress={() => onChange({ ...search, quickOnly: !search.quickOnly })}
          role="checkbox"
          accessibilityLabel={`Snel. Toont alleen gerechten die binnen ${LIBRARY_QUICK_MAX_MINUTES} minuten klaar zijn.`}
        />
      </ChipGroup>

      {visibleTags.length > 0 ? (
        <>
          <Text style={[typeScale.label, styles.eyebrow, styles.rowSpacing, { color: colors.textMuted }]}>
            WAARMEE?
          </Text>
          {/* AND semantics — see DecisionFilterBar's identical row for the
              full argument. Spoken out loud in each chip's own
              accessibility label rather than left for a screen-reader user
              to infer from a result they cannot see. */}
          <ChipGroup>
            {visibleTags.map((entry) => (
              <Chip
                key={entry.tag}
                label={entry.label}
                selected={selectedTags.has(entry.tag)}
                onPress={() => handleToggleTag(entry.tag)}
                role="checkbox"
                accessibilityLabel={`${entry.label}. Filtert op gerechten met alles wat je kiest.`}
              />
            ))}
          </ChipGroup>
        </>
      ) : null}

      {visibleMoods.length > 0 ? (
        <>
          <Text style={[typeScale.label, styles.eyebrow, styles.rowSpacing, { color: colors.textMuted }]}>
            WAAR HEB JE ZIN IN?
          </Text>
          {/* OR semantics, the deliberate asymmetry with the row above —
              see DecisionFilters.anyDishMoods in types.ts. */}
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

      {/* LIB-04. NOT gated on availability the way the two rows above are —
          a sort stays meaningful for any library size, the same reasoning
          "Snel" above already carries for a library with no timed meals.
          Always the last row: narrow the pool first, then decide its
          order. */}
      <Text style={[typeScale.label, styles.eyebrow, styles.rowSpacing, { color: colors.textMuted }]}>SORTEREN</Text>
      <ChipGroup>
        {SORT_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={sort === option.value}
            onPress={() => onChangeSort(option.value)}
            role="radio"
            accessibilityLabel={option.accessibilityLabel}
          />
        ))}
      </ChipGroup>
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

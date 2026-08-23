/**
 * Rotation Seeding Step A: a wrap-grid of common-meal chips plus a
 * finite running counter and a free-text "add anything missing" row.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';

export interface QuickPickGridProps {
  readonly options: readonly string[];
  readonly selected: readonly string[];
  readonly onToggle: (mealName: string) => void;
  readonly onAddCustom: (mealName: string) => void;
  readonly minRequired: number;
  readonly maxSuggested: number;
}

export function QuickPickGrid(props: QuickPickGridProps): JSX.Element {
  const { options, selected, onToggle, onAddCustom, minRequired, maxSuggested } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  const commitCustom = (): void => {
    const trimmed = customDraft.trim();
    if (trimmed.length === 0) {
      setIsAddingCustom(false);
      return;
    }
    onAddCustom(trimmed);
    setCustomDraft('');
    setIsAddingCustom(false);
  };

  return (
    <View>
      <Text style={[typeScale.caption, styles.counter, { color: colors.textMuted }]}>
        {selected.length} van de {minRequired}–{maxSuggested}
      </Text>
      <ChipGroup accessibilityLabel="Gerechten die je al vaak kookt">
        {options.map((option) => (
          <Chip key={option} label={option} selected={selected.includes(option)} onPress={() => onToggle(option)} />
        ))}
      </ChipGroup>
      {isAddingCustom ? (
        <View style={styles.customRow}>
          <TextInput
            value={customDraft}
            onChangeText={setCustomDraft}
            onSubmitEditing={commitCustom}
            onBlur={commitCustom}
            autoFocus
            placeholder="Naam van het gerecht"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            style={[
              typeScale.body,
              styles.customInput,
              { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityLabel="Naam van het gerecht invoeren"
          />
        </View>
      ) : (
        <Pressable
          onPress={() => setIsAddingCustom(true)}
          accessibilityRole="button"
          accessibilityLabel="Iets anders toevoegen aan je rotatie"
          style={styles.addRow}
        >
          <Text style={[typeScale.body, { color: colors.textMuted }]}>+ Iets anders toevoegen</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    marginBottom: spacing.space3,
  },
  addRow: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    marginTop: spacing.space3,
  },
  customRow: {
    marginTop: spacing.space3,
  },
  customInput: {
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
});

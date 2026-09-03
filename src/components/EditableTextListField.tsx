/**
 * Generic editable list of free-text lines: one row per item (a remove
 * button plus a growing `TextInput`), an "add" row at the bottom. Used by
 * the import confirmation screen (src/app/import/confirm.tsx) for both the
 * ingredients list (`multiline={false}`) and the steps list
 * (`multiline`, `numbered`) — AI extraction from a caption is unreliable
 * and the user is the only one who can tell, so every line here is a real
 * `TextInput`, never read-only text (see confirm.tsx's file header).
 *
 * No `numberOfLines` cap and no fixed `height` anywhere: rows grow with
 * their content so a long ingredient or step line survives 200% Dynamic
 * Type instead of being clipped, matching docs/DESIGN.md's "prefer letting
 * a row grow over capping it."
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface EditableTextListItem {
  readonly id: string;
  readonly text: string;
}

export interface EditableTextListFieldProps {
  readonly label: string;
  readonly helperText?: string;
  readonly items: readonly EditableTextListItem[];
  readonly onChangeItemText: (id: string, text: string) => void;
  readonly onRemoveItem: (id: string) => void;
  readonly onAddItem: () => void;
  readonly addLabel: string;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly numbered?: boolean;
}

export function EditableTextListField(props: EditableTextListFieldProps): JSX.Element {
  const {
    label,
    helperText,
    items,
    onChangeItemText,
    onRemoveItem,
    onAddItem,
    addLabel,
    placeholder,
    multiline = false,
    numbered = false,
  } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{label}</Text>
      {helperText ? (
        <Text style={[typeScale.bodySmall, styles.helper, { color: colors.textMuted }]}>{helperText}</Text>
      ) : null}
      <View style={styles.rows}>
        {items.map((item, index) => (
          <View key={item.id} style={styles.row}>
            {numbered ? (
              <Text style={[typeScale.numeral, styles.rowIndex, { color: colors.textMuted }]}>{index + 1}.</Text>
            ) : null}
            <TextInput
              value={item.text}
              onChangeText={(text) => onChangeItemText(item.id, text)}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              multiline={multiline}
              style={[
                typeScale.body,
                styles.input,
                multiline ? styles.inputMultiline : null,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              accessibilityLabel={`${label} ${index + 1}`}
            />
            <Pressable
              onPress={() => onRemoveItem(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${index + 1} verwijderen`}
              style={styles.removeButton}
              hitSlop={4}
            >
              <Text style={[typeScale.title3, { color: colors.textMuted }]}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable
        onPress={onAddItem}
        accessibilityRole="button"
        accessibilityLabel={addLabel}
        style={styles.addRow}
      >
        <Text style={[typeScale.body, { color: colors.textMuted }]}>{addLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.space6,
  },
  helper: {
    marginTop: spacing.space1,
  },
  rows: {
    marginTop: spacing.space3,
    gap: spacing.space2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.space2,
  },
  rowIndex: {
    minWidth: spacing.space5,
    paddingTop: spacing.space3,
  },
  input: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
    paddingVertical: spacing.space3,
  },
  inputMultiline: {
    minHeight: spacing.touchTargetMin + spacing.space6,
    textAlignVertical: 'top',
  },
  removeButton: {
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
    marginTop: spacing.space3,
  },
});

/**
 * Tag input for a member's dislikes or allergens in Household setup.
 * Purely a presentation/collection primitive — it does not decide copy;
 * the allergen exclusion-only framing ("sluit uit wat je hebt getagd",
 * never "veilig voor") is supplied by the caller via `helperText`.
 *
 * Two entry modes:
 * - Free text (default): open vocabulary, used for dislikes — a missed
 *   dislike is a disappointment, not a hazard (PD-006). Text is run
 *   through `normalizeTag` before being committed so later `Set.has()`
 *   comparisons in exclusions.ts are reliable regardless of how the user
 *   capitalized or accented it.
 * - Closed vocabulary (`vocabulary` prop set): PD-006 requires allergen
 *   tags to come from the 14 EU-designated allergens, never free text, so
 *   a mistyped allergen can never silently fail to exclude a meal. Renders
 *   a chip-select over the vocabulary instead of a text field.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import type { AllergenVocabularyEntry } from '@/domain/allergens';
import { normalizeTag } from '@/domain/normalizeTag';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Chip } from './Chip';
import { ChipGroup } from './ChipGroup';

export interface RestrictionTagInputProps {
  readonly label: string;
  readonly helperText?: string;
  readonly tags: readonly string[];
  readonly onAddTag: (tag: string) => void;
  readonly onRemoveTag: (tag: string) => void;
  readonly placeholder?: string;
  /**
   * PD-006: pass EU_ALLERGENS here for allergen entry — renders a
   * chip-select from this fixed list instead of a text field. Omit for
   * open-vocabulary use cases like dislikes.
   */
  readonly vocabulary?: readonly AllergenVocabularyEntry[];
}

export function RestrictionTagInput(props: RestrictionTagInputProps): JSX.Element {
  const { label, helperText, tags, onAddTag, onRemoveTag, placeholder, vocabulary } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.title3, { color: colors.textPrimary }]}>{label}</Text>
      {helperText ? (
        <Text style={[typeScale.bodySmall, styles.helper, { color: colors.textMuted }]}>{helperText}</Text>
      ) : null}
      {vocabulary ? (
        <VocabularyChipSelect label={label} vocabulary={vocabulary} tags={tags} onAddTag={onAddTag} onRemoveTag={onRemoveTag} />
      ) : (
        <FreeTextTagRow label={label} placeholder={placeholder} tags={tags} onAddTag={onAddTag} />
      )}
      {tags.length > 0 ? (
        <View style={styles.tagWrap}>
          <ChipGroup accessibilityLabel={`${label}, huidige items`}>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tagDisplayLabel(tag, vocabulary)}
                selected
                onPress={() => onRemoveTag(tag)}
                accessibilityLabel={`${tagDisplayLabel(tag, vocabulary)} verwijderen`}
              />
            ))}
          </ChipGroup>
        </View>
      ) : null}
    </View>
  );
}

function tagDisplayLabel(tag: string, vocabulary?: readonly AllergenVocabularyEntry[]): string {
  return vocabulary?.find((entry) => entry.tag === tag)?.label ?? tag;
}

interface VocabularyChipSelectProps {
  readonly label: string;
  readonly vocabulary: readonly AllergenVocabularyEntry[];
  readonly tags: readonly string[];
  readonly onAddTag: (tag: string) => void;
  readonly onRemoveTag: (tag: string) => void;
}

function VocabularyChipSelect(props: VocabularyChipSelectProps): JSX.Element {
  const { label, vocabulary, tags, onAddTag, onRemoveTag } = props;

  const toggle = (tag: string): void => {
    if (tags.includes(tag)) {
      onRemoveTag(tag);
    } else {
      onAddTag(tag);
    }
  };

  return (
    <View style={styles.vocabularyRow}>
      <ChipGroup accessibilityLabel={`${label}, kies uit de lijst`}>
        {vocabulary.map((entry) => (
          <Chip
            key={entry.tag}
            label={entry.label}
            selected={tags.includes(entry.tag)}
            onPress={() => toggle(entry.tag)}
          />
        ))}
      </ChipGroup>
    </View>
  );
}

interface FreeTextTagRowProps {
  readonly label: string;
  readonly placeholder?: string;
  readonly tags: readonly string[];
  readonly onAddTag: (tag: string) => void;
}

function FreeTextTagRow(props: FreeTextTagRowProps): JSX.Element {
  const { label, placeholder, tags, onAddTag } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const [draft, setDraft] = useState('');

  const commitDraft = (): void => {
    const normalized = normalizeTag(draft);
    if (normalized.length === 0 || tags.includes(normalized)) {
      setDraft('');
      return;
    }
    onAddTag(normalized);
    setDraft('');
  };

  return (
    <View style={styles.inputRow}>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={commitDraft}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        style={[
          typeScale.body,
          styles.input,
          { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        accessibilityLabel={`${label}, nieuw item invoeren`}
      />
      <Pressable
        onPress={commitDraft}
        accessibilityRole="button"
        accessibilityLabel={`${label} toevoegen`}
        style={[styles.addButton, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
      >
        <Text style={[typeScale.body, { color: colors.textPrimary }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.space5,
  },
  helper: {
    marginTop: spacing.space1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.space2,
    marginTop: spacing.space3,
  },
  input: {
    flex: 1,
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    paddingHorizontal: spacing.space3,
  },
  addButton: {
    minWidth: spacing.touchTargetMin,
    minHeight: spacing.touchTargetMin,
    borderWidth: 1,
    borderRadius: radii.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vocabularyRow: {
    marginTop: spacing.space3,
  },
  tagWrap: {
    marginTop: spacing.space3,
  },
});

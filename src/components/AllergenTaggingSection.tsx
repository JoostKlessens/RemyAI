/**
 * PD-006's earned `verified` moment on the import confirmation screen
 * (src/app/import/confirm.tsx). No AI-suggested tags are pre-filled — see
 * allergenTaggingCopy.ts's file header for why that was scrapped. The user
 * tags allergens themselves, informed by the parsed ingredient list shown
 * elsewhere on the same screen, from the closed EU-14 vocabulary via
 * `RestrictionTagInput`'s existing vocabulary mode (reused, not
 * reimplemented — the same component `src/app/settings.tsx` uses for this
 * exact chip-select pattern, at the household-restriction level).
 *
 * Confirming — even confirming zero tags — is the human act that earns
 * `verified`, mirroring the same "even 'none of these' promotes to
 * verified" rule PD-006 applies elsewhere. Skipping (or simply never tapping
 * confirm) leaves the meal `unknown`, exactly like an untouched seeded
 * meal. `onSkip` also reopens the confirmed summary for editing — any tag
 * change is handled by the parent reverting `status` to `unknown` first
 * (see confirm.tsx), so re-confirming after an edit is always a fresh,
 * explicit act.
 */

import { AccessibilityInfo, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { EU_ALLERGENS } from '@/domain/allergens';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { ALLERGEN_TAGGING_HEADING, buildAllergenConfirmedSummary } from './allergenTaggingCopy';
import { Button } from './Button';
import { RestrictionTagInput } from './RestrictionTagInput';

export interface AllergenTaggingSectionProps {
  readonly confirmedTags: readonly string[];
  readonly status: 'unknown' | 'verified';
  readonly onAddTag: (tag: string) => void;
  readonly onRemoveTag: (tag: string) => void;
  readonly onConfirm: () => void;
  readonly onReopen: () => void;
}

export function AllergenTaggingSection(props: AllergenTaggingSectionProps): JSX.Element {
  const { confirmedTags, status, onAddTag, onRemoveTag, onConfirm, onReopen } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  const handleConfirm = (): void => {
    onConfirm();
    // A1: this section morphs in place (no navigation, no new screen a
    // screen-reader user would naturally notice) — matches the
    // announceForAccessibility pattern established by
    // SaveIntentSheet/DecisionCard for otherwise-silent state changes.
    AccessibilityInfo.announceForAccessibility('Allergenen bevestigd');
  };

  if (status === 'verified') {
    return (
      <View style={styles.container}>
        <View style={[styles.confirmedRow, { backgroundColor: colors.positiveMuted }]}>
          <Text style={[typeScale.bodySmall, { color: colors.textPrimary }]}>
            {buildAllergenConfirmedSummary(confirmedTags)}
          </Text>
        </View>
        <Button label="Wijzigen" variant="tertiary" onPress={onReopen} accessibilityLabel="Allergenen aanpassen" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[typeScale.title3, styles.heading, { color: colors.textPrimary }]}>
        {ALLERGEN_TAGGING_HEADING}
      </Text>
      <Text style={[typeScale.bodySmall, styles.helper, { color: colors.textMuted }]}>
        Bekijk de ingrediënten hierboven en tag wat van toepassing is. Optioneel — sla over als je het niet zeker
        weet, dan blijft dit gerecht als niet-gecontroleerd gemarkeerd.
      </Text>
      <RestrictionTagInput
        label="Allergenen"
        tags={confirmedTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        vocabulary={EU_ALLERGENS}
      />
      <View style={styles.actions}>
        <View style={styles.actionItem}>
          <Button
            label="Bevestigen"
            variant="positive"
            onPress={handleConfirm}
            accessibilityLabel="Allergenen bevestigen"
          />
        </View>
        <View style={styles.actionItem}>
          <Button
            label="Sla over"
            variant="tertiary"
            onPress={onReopen}
            accessibilityLabel="Allergenen overslaan, dit gerecht blijft niet-gecontroleerd"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.space6,
  },
  heading: {
    marginBottom: spacing.space1,
  },
  helper: {
    marginBottom: spacing.space3,
  },
  confirmedRow: {
    borderRadius: radii.radiusMd,
    padding: spacing.space4,
    marginBottom: spacing.space3,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.space3,
    marginTop: spacing.space3,
  },
  actionItem: {
    flex: 1,
  },
});

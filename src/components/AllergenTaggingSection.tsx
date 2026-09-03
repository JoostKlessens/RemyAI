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

import type { JSX } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { EU_ALLERGENS } from '@/domain/allergens';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import {
  ALLERGEN_TAGGING_HEADING,
  buildAllergenConfirmedSummary,
  buildAllergenSkipAccessibilityLabel,
  buildAllergenSkipConsequence,
} from './allergenTaggingCopy';
import { Button } from './Button';
import { RestrictionTagInput } from './RestrictionTagInput';

export interface AllergenTaggingSectionProps {
  readonly confirmedTags: readonly string[];
  readonly status: 'unknown' | 'verified';
  readonly onAddTag: (tag: string) => void;
  readonly onRemoveTag: (tag: string) => void;
  readonly onConfirm: () => void;
  readonly onReopen: () => void;
  /**
   * PRF-02. Whether skipping this step costs this household anything —
   * `hasAllergenRestriction` (src/domain/exclusions.ts), read by the screen
   * and passed down rather than asked for here.
   *
   * REQUIRED, NOT OPTIONAL. An optional flag defaulting to `false` is a flag
   * a caller can forget while still compiling, and forgetting THIS one shows
   * a household with an allergy the sentence written for a household without
   * one. The direction the mistake would run in is the reason it may not be
   * defaultable.
   */
  readonly householdHasAllergenRestriction: boolean;
}

export function AllergenTaggingSection(props: AllergenTaggingSectionProps): JSX.Element {
  const { confirmedTags, status, onAddTag, onRemoveTag, onConfirm, onReopen, householdHasAllergenRestriction } = props;
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
      {/*
        PRF-02: names what SKIPPING costs, not merely what state it leaves
        behind. `exclusions.ts` excludes only `verified` meals, so a
        household with an allergy that skips here has opted this dish out of
        the one gate that would have caught it — and until now the screen
        that let them do it said nothing about that. The sentence is only
        the stronger one when there is an allergy to be caught, per PD-006's
        "no extra friction, no prompts" for everybody else.
      */}
      <Text style={[typeScale.bodySmall, styles.helper, { color: colors.textMuted }]}>
        {buildAllergenSkipConsequence(householdHasAllergenRestriction)}
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
            accessibilityLabel={buildAllergenSkipAccessibilityLabel(householdHasAllergenRestriction)}
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

/**
 * The thumb zone under a shared recipe (DESIGN-SOCIAL.md §3.3: "full
 * width, inside `spacing.thumbZoneMinHeight`").
 *
 * IT SITS OUTSIDE THE SCROLL, and that is PD-010.2 rather than layout
 * taste: the original-post link stays directly under the last step in
 * document order, and a control pinned below the scroll can never push it
 * below the fold. Same shape as `/recipe/[mealId]`'s `Koken` footer. Both
 * shared recipe routes render `SharedRecipeArticle` and then this, in that
 * order, as siblings — which is what keeps that promise structural.
 *
 * A COMPLETED SAVE IS A STATE, NOT AN ACTION, so it is drawn as the
 * `positiveMuted` / `positive` pair `RecipeTile`'s badge and
 * `FriendProofCard`'s chip use, rather than as a disabled button
 * pretending to be one — at the button's own height, so the zone does not
 * jump when the write lands.
 *
 * IT DECIDES NOTHING. Which of the six states this is, what it is called,
 * and what line sits under it are all `describeSharedRecipeSaveControl`'s
 * answers (sharedRecipeSaveCopy.ts, tested). Lifted out of
 * `/friends/[feedItemId]` unchanged when the canonical recipe screen
 * arrived and needed the identical zone.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Button } from './Button';
import {
  SHARED_RECIPE_SAVED_ACCESSIBILITY_LABEL,
  SHARED_RECIPE_SAVE_ACCESSIBILITY_LABEL,
  type SharedRecipeSaveControl,
} from './sharedRecipeSaveCopy';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';

export interface SharedRecipeSaveZoneProps {
  readonly control: SharedRecipeSaveControl;
  /** Colours the note red for a failure and muted for the two ordinary absences — the state itself stays the copy module's. */
  readonly isFailure: boolean;
  readonly onPress: () => void;
}

export function SharedRecipeSaveZone(props: SharedRecipeSaveZoneProps): JSX.Element {
  const { control, isFailure, onPress } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={[styles.saveZone, { borderTopColor: colors.border }]}>
      {control.kind === 'completed' ? (
        <View
          style={[styles.savedState, { backgroundColor: colors.positiveMuted }]}
          accessibilityRole="text"
          accessibilityLabel={SHARED_RECIPE_SAVED_ACCESSIBILITY_LABEL}
        >
          <Text style={[typeScale.button, { color: colors.positive }]}>{control.label}</Text>
        </View>
      ) : (
        <>
          <Button
            label={control.label}
            variant="primary"
            onPress={onPress}
            disabled={control.disabled}
            loading={control.loading}
            accessibilityLabel={SHARED_RECIPE_SAVE_ACCESSIBILITY_LABEL}
          />
          {control.note !== null ? (
            <Text
              style={[typeScale.bodySmall, styles.saveNote, { color: isFailure ? colors.danger : colors.textMuted }]}
            >
              {control.note}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  saveZone: {
    minHeight: spacing.thumbZoneMinHeight,
    justifyContent: 'center',
    borderTopWidth: 1,
    paddingHorizontal: spacing.screenPaddingHorizontal,
    paddingTop: spacing.space4,
    paddingBottom: spacing.space4,
  },
  savedState: {
    // The button's own minimum, so `Bewaren` and `Bewaard` occupy the same
    // box and the zone does not jump when the write lands.
    minHeight: spacing.touchTargetMin + 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.space4,
    borderRadius: radii.radiusMd,
  },
  saveNote: {
    marginTop: spacing.space2,
    textAlign: 'center',
  },
});

/**
 * What a shared recipe screen draws when there is no recipe on it: still
 * loading, gone, or the read failed.
 *
 * NO SPINNER, on any of the three. docs/DESIGN.md §3 warns against "a
 * spinner that resolves into nothing", and that is exactly the risk here —
 * a canonical recipe can genuinely be withdrawn between the tap and the
 * answer (PD-007: withdrawal is honoured immediately). Three words that
 * turn into a sentence say more and promise less. Same shape the Vrienden
 * tab's own notice uses, so a wait looks the same on both surfaces.
 *
 * THE COPY IS NOT HERE. `describeSharedRecipeNotice`
 * (sharedRecipePresentation.ts) owns all three pairs of sentences, for
 * this directory's standing reason: a Dutch sentence in a `.tsx` is a
 * sentence vitest cannot reach. This file is layout and one button.
 *
 * IT ALWAYS OFFERS A WAY BACK, INCLUDING WHILE LOADING. The screen behind
 * it is a stack push, so the gesture exists anyway; a visible control is
 * what makes that true for somebody who cannot perform the gesture.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { Button } from './Button';
import {
  SHARED_RECIPE_BACK_BUTTON_LABEL,
  SHARED_RECIPE_BACK_LABEL,
  type SharedRecipeNotice,
} from './sharedRecipePresentation';
import { getColors, spacing, typeScale } from '@/theme/tokens';

export interface SharedRecipeNoticeStateProps {
  readonly notice: SharedRecipeNotice;
  readonly onBack: () => void;
}

export function SharedRecipeNoticeState(props: SharedRecipeNoticeStateProps): JSX.Element {
  const { notice, onBack } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.notice}>
      <Text style={[typeScale.title2, styles.centeredTitle, { color: colors.textPrimary }]}>{notice.title}</Text>
      {notice.body !== null ? (
        <Text style={[typeScale.bodySmall, styles.centeredBody, { color: colors.textMuted }]}>{notice.body}</Text>
      ) : null}
      <Button
        label={SHARED_RECIPE_BACK_BUTTON_LABEL}
        variant="secondary"
        onPress={onBack}
        accessibilityLabel={SHARED_RECIPE_BACK_LABEL}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  centeredTitle: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  centeredBody: {
    textAlign: 'center',
    marginBottom: spacing.space6,
  },
});

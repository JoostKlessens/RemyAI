/**
 * The Kiezen action row. PD-001: "Iets anders" is capped at two swaps,
 * driven off `alternativesRemaining` from `DecisionResult`. At 0, the
 * affordance is replaced by "Ik kies zelf" — styled identically to the
 * secondary slot it replaces (never accent-filled, never the primary
 * path) so it reads as a clearly secondary escape hatch.
 *
 * TWO buttons, never three. A tertiary "Niet koken" used to sit under
 * these and it is gone on purpose: an evening you are not cooking is an
 * evening you close the app, so the button's whole effect was to replace
 * the dish with a sentence saying the refusal had been noted. The
 * rejected alternative was keeping the button and dropping only PD-002's
 * optional reason chips behind it — that keeps the confirmation screen
 * nobody asked for AND a third tap target competing with the two that
 * actually go somewhere. If it ever comes back it needs a destination,
 * not a slot; see this screen's route module for what removing it cost
 * the `skipped` decision status.
 */

import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/theme/tokens';
import { Button } from './Button';

export interface VanavondActionRowProps {
  readonly alternativesRemaining: 0 | 1 | 2;
  readonly onAccept: () => void;
  readonly onRequestAlternative: () => void;
  readonly onChooseSelf: () => void;
}

export function VanavondActionRow(props: VanavondActionRowProps): JSX.Element {
  const { alternativesRemaining, onAccept, onRequestAlternative, onChooseSelf } = props;
  const hasAlternativesLeft = alternativesRemaining > 0;

  return (
    <View style={styles.container}>
      <Button label="Ja" variant="primary" onPress={onAccept} accessibilityLabel="Ja, dit kook ik vanavond" />
      {hasAlternativesLeft ? (
        <Button
          label="Iets anders"
          variant="secondary"
          onPress={onRequestAlternative}
          accessibilityLabel="Toon een ander gerecht"
          accessibilityHint={`Nog ${alternativesRemaining} keer beschikbaar vandaag`}
        />
      ) : (
        <Button
          label="Ik kies zelf"
          variant="secondary"
          onPress={onChooseSelf}
          accessibilityLabel="Ik kies zelf, open Mijn recepten"
          accessibilityHint="Geen wissels meer beschikbaar vandaag"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.space3,
  },
});

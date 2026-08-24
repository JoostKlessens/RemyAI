/**
 * The Kiezen action row. PD-001: "Iets anders" is capped at two swaps,
 * driven off `alternativesRemaining` from `DecisionResult`. At 0, the
 * affordance is replaced by "Ik kies zelf" — styled identically to the
 * secondary slot it replaces (never accent-filled, never the primary
 * path) so it reads as a clearly secondary escape hatch. "Niet koken" is
 * always present and always tertiary weight — a legitimate answer, not a
 * cancel action.
 */

import { StyleSheet, View } from 'react-native';
import { spacing } from '@/theme/tokens';
import { Button } from './Button';

export interface VanavondActionRowProps {
  readonly alternativesRemaining: 0 | 1 | 2;
  readonly onAccept: () => void;
  readonly onRequestAlternative: () => void;
  readonly onChooseSelf: () => void;
  readonly onDecline: () => void;
}

export function VanavondActionRow(props: VanavondActionRowProps): JSX.Element {
  const { alternativesRemaining, onAccept, onRequestAlternative, onChooseSelf, onDecline } = props;
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
          accessibilityLabel="Ik kies zelf, open Bibliotheek"
          accessibilityHint="Geen wissels meer beschikbaar vandaag"
        />
      )}
      <Button label="Niet koken" variant="tertiary" onPress={onDecline} accessibilityLabel="Niet koken vanavond" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.space3,
  },
});

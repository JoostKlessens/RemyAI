/**
 * Renders Kiezen's `DecisionResult.kind === 'no_candidate'` branch. A blank
 * screen here would be a bug — every `NoCandidateReason` gets a deliberate,
 * differentiated state:
 *  - `empty_rotation`: the honest first-run state (docs/DESIGN.md §1) — no
 *    onboarding to route to any more, since the library only grows through
 *    Plakken (pasting a link). One primary action, "Recept plakken", and no
 *    "Niet koken" — there's nothing to decline yet when nothing has ever
 *    been offered.
 *  - `all_excluded`: restrictions filtered everything — explained with
 *    exclusion framing, never "safety" framing, and offers Bibliotheek as
 *    an alternative.
 *  - `swaps_exhausted`: the PD-001 two exits (`Niet koken` / `Ik kies
 *    zelf`), with no dish to show because none remain.
 */

import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { NoCandidateReason } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';

export interface NoCandidateStateProps {
  readonly reason: NoCandidateReason;
  /** empty_rotation only: "Recept plakken" -> the Plakken screen. */
  readonly onOpenImport: () => void;
  /** all_excluded / swaps_exhausted: "Kies zelf" / "Ik kies zelf" -> Bibliotheek. */
  readonly onOpenRecipes: () => void;
  /** Not rendered for empty_rotation — see the file header. */
  readonly onDecline: () => void;
}

interface ReasonCopy {
  readonly title: string;
  readonly body: string;
}

export function NoCandidateState(props: NoCandidateStateProps): JSX.Element {
  const { reason, onOpenImport, onOpenRecipes, onDecline } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const copy = getCopyForReason(reason);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.title1, styles.title, { color: colors.textPrimary }]}>{copy.title}</Text>
      <Text style={[typeScale.bodySmall, styles.body, { color: colors.textMuted }]}>{copy.body}</Text>
      <View style={styles.actions}>
        {reason === 'empty_rotation' ? (
          <Button
            label="Recept plakken"
            variant="primary"
            onPress={onOpenImport}
            accessibilityLabel="Recept plakken, plak een link naar een TikTok- of Instagram-video"
          />
        ) : (
          <>
            <Button
              label={reason === 'swaps_exhausted' ? 'Ik kies zelf' : 'Kies zelf'}
              variant="secondary"
              onPress={onOpenRecipes}
              accessibilityLabel="Open Bibliotheek om zelf te kiezen"
            />
            <Button label="Niet koken" variant="tertiary" onPress={onDecline} accessibilityLabel="Niet koken vanavond" />
          </>
        )}
      </View>
    </View>
  );
}

function getCopyForReason(reason: NoCandidateReason): ReasonCopy {
  switch (reason) {
    case 'empty_rotation':
      return {
        title: 'Nog niets om uit te kiezen',
        body: 'Plak een link en Remy kan morgen iets voorstellen.',
      };
    case 'all_excluded':
      return {
        title: 'Niks voor de hand liggends vanavond',
        body: 'Je instellingen sluiten alle gerechten in je bibliotheek uit voor vanavond.',
      };
    case 'swaps_exhausted':
      return {
        title: 'Geen alternatieven meer voor vanavond',
        body: 'Je hebt de wissels voor vandaag gebruikt.',
      };
    default: {
      // Exhaustiveness guard, mirroring src/domain/reason.ts: if
      // NoCandidateReason ever gains a member, this is a compile error at
      // the `default` branch's assignment, not a silent runtime fallback
      // rendering the wrong copy on the safety-critical Kiezen screen.
      const exhaustiveCheck: never = reason;
      throw new Error(`Unhandled NoCandidateReason: ${String(exhaustiveCheck)}`);
    }
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.screenPaddingHorizontal,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.space2,
  },
  body: {
    textAlign: 'center',
    marginBottom: spacing.space6,
  },
  actions: {
    width: '100%',
    gap: spacing.space3,
  },
});

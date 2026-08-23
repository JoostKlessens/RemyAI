/**
 * Renders Vanavond's `DecisionResult.kind === 'no_candidate'` branch. A
 * blank screen here would be a bug — every `NoCandidateReason` gets a
 * deliberate, differentiated state per the task brief:
 *  - `empty_rotation`: routes to Rotation Seeding onboarding, since
 *    browsing the Feed does not fix "you have not seeded a rotation yet."
 *    (docs/DESIGN.md's generic empty-state wireframe predates the
 *    3-reason `NoCandidateReason` union and only specifies one catch-all
 *    "Kies zelf → Feed" treatment; empty_rotation is the one reason that
 *    calls for a different destination, so this deliberately diverges
 *    from that wireframe. See the frontend report for the full rationale.)
 *  - `all_excluded`: restrictions filtered everything — explained with
 *    exclusion framing, never "safety" framing, and offers the Feed as an
 *    alternative.
 *  - `swaps_exhausted`: the PD-001 two exits (`Niet koken` / `Ik kies
 *    zelf`), with no dish to show because none remain.
 */

import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { NoCandidateReason } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';

export interface NoCandidateStateProps {
  readonly reason: NoCandidateReason;
  readonly onNavigateOnboarding: () => void;
  readonly onOpenFeed: () => void;
  readonly onDecline: () => void;
}

interface ReasonCopy {
  readonly title: string;
  readonly body: string;
}

export function NoCandidateState(props: NoCandidateStateProps): JSX.Element {
  const { reason, onNavigateOnboarding, onOpenFeed, onDecline } = props;
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
            label="Gerechten toevoegen"
            variant="secondary"
            onPress={onNavigateOnboarding}
            accessibilityLabel="Gerechten toevoegen aan je rotatie"
          />
        ) : (
          <Button
            label={reason === 'swaps_exhausted' ? 'Ik kies zelf' : 'Kies zelf'}
            variant="secondary"
            onPress={onOpenFeed}
            accessibilityLabel="Open de Feed om zelf te kiezen"
          />
        )}
        <Button label="Niet koken" variant="tertiary" onPress={onDecline} accessibilityLabel="Niet koken vanavond" />
      </View>
    </View>
  );
}

function getCopyForReason(reason: NoCandidateReason): ReasonCopy {
  switch (reason) {
    case 'empty_rotation':
      return {
        title: 'Nog geen gerechten in je rotatie',
        body: 'Voeg een paar gerechten toe die je al vaak kookt, dan kan Remy morgen iets voorstellen.',
      };
    case 'all_excluded':
      return {
        title: 'Niks voor de hand liggends vanavond',
        body: 'Je instellingen sluiten alle gerechten in je rotatie uit voor vanavond.',
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
      // rendering the wrong copy on the safety-critical Vanavond screen.
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

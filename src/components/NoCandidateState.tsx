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
 *    exclusion framing, never "safety" framing, and offers Mijn recepten
 *    as an alternative.
 *  - `filtered_out` (PD-009): the household's own filters for tonight
 *    emptied the pool. Deliberately worded and actioned differently from
 *    `all_excluded` above: that one is about standing settings the user
 *    must never be nudged to loosen (allergens), this one is about a
 *    choice made ten seconds ago that a single tap undoes. So it leads
 *    with a primary `Filters wissen` and says plainly that the filter, not
 *    the library, is what came up empty.
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
  /** all_excluded / filtered_out / swaps_exhausted: "Kies zelf" / "Ik kies zelf" -> Mijn recepten. */
  readonly onOpenRecipes: () => void;
  /**
   * filtered_out only (PD-009): clears tonight's `DecisionFilters` back to
   * `NO_DECISION_FILTERS`. Required rather than optional so a future screen
   * that renders this component has to decide what "relax the filter" means
   * for it, instead of silently shipping a dead-end state.
   */
  readonly onClearFilters: () => void;
  /** Not rendered for empty_rotation — see the file header. */
  readonly onDecline: () => void;
}

interface ReasonCopy {
  readonly title: string;
  readonly body: string;
}

export function NoCandidateState(props: NoCandidateStateProps): JSX.Element {
  const { reason, onOpenImport, onOpenRecipes, onClearFilters, onDecline } = props;
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
            {/* PD-009: the one tap that undoes this state, and the only
                reason on this screen that has one — so it takes the
                primary slot above "Kies zelf" rather than sitting beside
                it as an equal. Nothing comparable exists for
                `all_excluded`, whose fix is a settings change we must not
                push someone towards from here. */}
            {reason === 'filtered_out' ? (
              <Button
                label="Filters wissen"
                variant="primary"
                onPress={onClearFilters}
                accessibilityLabel="Wis de filters voor vanavond en zoek opnieuw"
              />
            ) : null}
            <Button
              label={reason === 'swaps_exhausted' ? 'Ik kies zelf' : 'Kies zelf'}
              variant="secondary"
              onPress={onOpenRecipes}
              accessibilityLabel="Open Mijn recepten om zelf te kiezen"
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
        body: 'Je instellingen sluiten alle gerechten in je recepten uit voor vanavond.',
      };
    case 'filtered_out':
      // Names the filter as the cause, not the library and certainly not
      // the household's restrictions — see the file header. "Te streng"
      // rather than "verkeerd": the user asked for something reasonable,
      // there just isn't a dish for it tonight.
      return {
        title: 'Niets binnen deze filters',
        body: 'Je filters voor vanavond zijn te streng. Wis ze en Remy kijkt weer in al je recepten.',
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

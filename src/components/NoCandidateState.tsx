/**
 * Renders Kiezen's `DecisionResult.kind === 'no_candidate'` branch. A blank
 * screen here would be a bug — every `NoCandidateReason` gets a deliberate,
 * differentiated state:
 *  - `empty_rotation`: the honest first-run state (docs/DESIGN.md §1) — no
 *    onboarding to route to any more, since the library only grows through
 *    Plakken (pasting a link). One primary action, "Recept plakken", and
 *    nothing beside it.
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
 *  - `swaps_exhausted`: one exit, `Ik kies zelf` to Mijn recepten, with
 *    no dish to show because none remain.
 *
 * A KNOWN DIVERGENCE FROM PD-001, recorded rather than papered over. That
 * decision asks for "exactly two exits" after swap exhaustion, `Niet
 * koken` and `Ik kies zelf`. "Niet koken" was removed from Kiezen
 * entirely and nothing replaced it, so `swaps_exhausted` and
 * `all_excluded` each render a single button now. Inventing a second
 * control to satisfy the count was the rejected alternative: a button
 * that exists to make a document true is worse than one honest exit.
 * Neither branch is a dead end — `Ik kies zelf` navigates to Mijn
 * recepten and the tab bar sits under all of it — so the thing that is
 * now out of date is PD-001's text, not this component.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { NoCandidateReason } from '@/domain/types';
import { getColors, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { describeEmptyLibrary } from './emptyLibraryCopy';

/**
 * ENT-05. The one reason in this component whose copy is NOT written here.
 *
 * `empty_rotation` is not really a fact about tonight's decision at all —
 * it is a fact about the library being empty, which the Mijn recepten tab
 * states in its own words a tab away. Two screens wording one fact
 * independently is the drift recipeProvenanceCopy.ts's header records
 * having shipped once already, and this pair had in fact already drifted:
 * the sentence below named no platform while the button's accessibility
 * label beneath it still enumerated two. Resolved once, in
 * emptyLibraryCopy.ts, where a test can hold both surfaces to the same
 * rule.
 *
 * THE OTHER THREE REASONS STAY INLINE, deliberately. `all_excluded`,
 * `filtered_out` and `swaps_exhausted` all describe a library that is full
 * and a filter, a restriction or a swap budget that emptied tonight — they
 * have nothing in common with an empty library and nothing to share with
 * another screen. Moving them out too would have bought a tidier-looking
 * file at the cost of weakening the `never` guard below, which is the thing
 * that makes a new `NoCandidateReason` a compile error here.
 *
 * Resolved at module load rather than per render for the reason the library
 * screen's own constant gives: this lookup depends on nothing.
 */
const EMPTY_ROTATION_COPY = describeEmptyLibrary('rotation');

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
}

interface ReasonCopy {
  readonly title: string;
  readonly body: string;
}

export function NoCandidateState(props: NoCandidateStateProps): JSX.Element {
  const { reason, onOpenImport, onOpenRecipes, onClearFilters } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);
  const copy = getCopyForReason(reason);

  return (
    <View style={styles.container}>
      <Text style={[typeScale.title1, styles.title, { color: colors.textPrimary }]}>{copy.title}</Text>
      <Text style={[typeScale.bodySmall, styles.body, { color: colors.textMuted }]}>{copy.body}</Text>
      <View style={styles.actions}>
        {reason === 'empty_rotation' ? (
          /* ENT-05. This button's `accessibilityLabel` read "Recept
             plakken, plak een link naar een TikTok- of Instagram-video" —
             the same platform enumeration the library's empty state had,
             hiding in the one channel where nobody reviews it and where a
             screen-reader user hears it INSTEAD of the honest sentence
             rendered two lines above. Both label and a11y label now come
             from emptyLibraryCopy.ts, which is also where the library
             state gets its words, so the two first-run surfaces cannot
             drift into describing one fact two different ways. */
          <Button
            label={EMPTY_ROTATION_COPY.actionLabel}
            variant="primary"
            onPress={onOpenImport}
            accessibilityLabel={EMPTY_ROTATION_COPY.actionAccessibilityLabel}
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
          </>
        )}
      </View>
    </View>
  );
}

function getCopyForReason(reason: NoCandidateReason): ReasonCopy {
  switch (reason) {
    // Delegated, not written here — see `EMPTY_ROTATION_COPY` above for the
    // whole argument. The body also stopped saying "Plak een link": that
    // sentence named no platform and was never part of the enumeration
    // defect, but it did name the link route as though it were the only
    // route, which SRC-08 made untrue. The promise about tomorrow, which is
    // the half of this state the library screen cannot make, is carried
    // over word for word.
    case 'empty_rotation':
      return {
        title: EMPTY_ROTATION_COPY.title,
        body: EMPTY_ROTATION_COPY.body,
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

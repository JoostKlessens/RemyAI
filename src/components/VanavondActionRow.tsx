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
 *
 * ==========================================================================
 * SIDE BY SIDE SINCE 7 SEPTEMBER 2026, AND WHY EVERY BUTTON HAS A WRAPPER
 * ==========================================================================
 *
 * THE OWNER'S INSTRUCTION, VERBATIM: "Bij kiezen wil ik een grotere thumbnail
 * van het gerecht, dit kunnen we denk ik al deels regelen door het volgende
 * te doen: 1. Verwijder de teksten 'hoeveel tijd' en kiezen. 2. Zorg dat 'Ja'
 * (dit mag je overigens veranderen in 'Dit koken') en 'iets anders' naast
 * elkaar komen te staan in plaats van boven elkaar. Zo kunnen we d thumbnail
 * een stuk groter maken dat ziet er beter uit."
 *
 * The row was a column of two full-width buttons. Stacked it stood 116 pt
 * tall (52 + 12 + 52); side by side it is 52, and the 64 pt that frees goes
 * straight to `DecisionCard`'s photo, which is the whole point of the change
 * — see that file's header for the height budget this pays into. The labels
 * moved with the layout: `Ja` became `Dit koken`, argued in
 * ./vanavondActionCopy.ts, which is also where every word this file says now
 * lives, so that a test can reach it.
 *
 * EACH BUTTON IS WRAPPED IN ITS OWN `<View style={{ flex: 1 }}>`, AND THAT IS
 * LOAD-BEARING RATHER THAN TIDINESS. `Button` renders an `Animated.View`
 * carrying only its press transform, around a `Pressable` that sets
 * `width: '100%'`. Dropped straight into a `flexDirection: 'row'` container,
 * that `Animated.View` is a row child with no `flex`, so Yoga sizes it to its
 * CONTENT — and `width: '100%'` then resolves against a box the label just
 * defined. The result is two buttons sized by their own text, which is
 * exactly what this change exists to stop. The wrapper has a definite width
 * (half the row), so the chain resolves and the halves are halves.
 *
 * THE REJECTED ALTERNATIVE WAS A `style` OR `flex` PROP ON `Button`. Fewer
 * elements, and the wrong trade: 27 files import that component across 66
 * call sites, and a style hole in a primitive that widely used is how a
 * design system stops being one. Button.tsx's header now carries the same
 * warning, so the next person writing a horizontal row meets it there.
 *
 * THE HEIGHTS ARE NOT GUARANTEED EQUAL, AND THIS IS THE HONEST VERSION.
 * `Button` caps its label at `numberOfLines={2}` and grows past its 52 pt
 * `minHeight` once two scaled lines exceed it. This row keeps flexbox's
 * default `alignItems: 'stretch'` — never `'center'` — so the two wrappers
 * are always equal height and the two buttons always share a TOP edge. But
 * stretch cannot reach through `Button`'s own `Animated.View`, which has no
 * `flex` of its own, so at a Dynamic Type size where one label wraps and the
 * other does not, the bottom edges can differ. What keeps that band narrow is
 * `VANAVOND_LABEL_LENGTH_TOLERANCE`: labels within three characters of each
 * other reach their wrap threshold at nearly the same scale, so in practice
 * both wrap or neither does. Accepted rather than solved, because the only
 * fixes are a prop on `Button` (rejected above) or a hard-coded height that
 * ignores Dynamic Type.
 */

import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@/theme/tokens';
import { Button } from './Button';
import {
  VANAVOND_ACCEPT_ACCESSIBILITY_LABEL,
  VANAVOND_ACCEPT_LABEL,
  VANAVOND_ALTERNATIVE_ACCESSIBILITY_LABEL,
  VANAVOND_ALTERNATIVE_LABEL,
  VANAVOND_CHOOSE_SELF_ACCESSIBILITY_LABEL,
  VANAVOND_CHOOSE_SELF_HINT,
  VANAVOND_CHOOSE_SELF_LABEL,
  describeAlternativesRemaining,
} from './vanavondActionCopy';

export interface VanavondActionRowProps {
  readonly alternativesRemaining: 0 | 1 | 2;
  readonly onAccept: () => void;
  readonly onRequestAlternative: () => void;
  readonly onChooseSelf: () => void;
}

export function VanavondActionRow(props: VanavondActionRowProps): JSX.Element {
  const { alternativesRemaining, onAccept, onRequestAlternative, onChooseSelf } = props;
  // `!== 0` and not `> 0`, which is what this used to be. TypeScript narrows
  // a numeric literal union on EQUALITY and not on comparison, so `> 0` left
  // `alternativesRemaining` as `0 | 1 | 2` inside the branch below and
  // `describeAlternativesRemaining` (typed `1 | 2` on purpose) would not
  // accept it. Written this way, the compiler is what keeps a countdown off
  // the button that exists precisely because the countdown ended.
  const hasAlternativesLeft = alternativesRemaining !== 0;

  return (
    <View style={styles.container}>
      <View style={styles.half}>
        <Button
          label={VANAVOND_ACCEPT_LABEL}
          variant="primary"
          onPress={onAccept}
          accessibilityLabel={VANAVOND_ACCEPT_ACCESSIBILITY_LABEL}
        />
      </View>
      <View style={styles.half}>
        {hasAlternativesLeft ? (
          <Button
            label={VANAVOND_ALTERNATIVE_LABEL}
            variant="secondary"
            onPress={onRequestAlternative}
            accessibilityLabel={VANAVOND_ALTERNATIVE_ACCESSIBILITY_LABEL}
            accessibilityHint={describeAlternativesRemaining(alternativesRemaining)}
          />
        ) : (
          <Button
            label={VANAVOND_CHOOSE_SELF_LABEL}
            variant="secondary"
            onPress={onChooseSelf}
            accessibilityLabel={VANAVOND_CHOOSE_SELF_ACCESSIBILITY_LABEL}
            accessibilityHint={VANAVOND_CHOOSE_SELF_HINT}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    // NO `alignItems`. Flexbox's default is already `stretch`, which is the
    // value this row wants — `'center'` would let the two halves float at
    // different heights the moment one label wraps and the other does not.
    // Written as an absence with a reason rather than as an explicit
    // `alignItems: 'stretch'`, because restating a default reads as a
    // decision something else depends on.
    gap: spacing.space3,
  },
  half: {
    // The whole reason this wrapper exists — see the header. `flex: 1` gives
    // it a definite width, which is what `Button`'s inner `width: '100%'`
    // needs in a row and does not get on its own.
    flex: 1,
  },
});

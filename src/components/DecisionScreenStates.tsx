/**
 * Kiezen's two non-answer states: the pause before a dish is named, and the
 * refusal when one could not be fetched. docs/DESIGN.md §1 specifies both.
 *
 * WHY TWO IN ONE FILE, AND WHY NOT THREE. These are the states where the
 * screen has NOTHING to say about dinner and the whole surface is one
 * sentence. `NoCandidateState` is the third such state and keeps its own
 * file, because it is not one sentence: it branches four ways
 * (`empty_rotation`, `all_excluded`, `filtered_out`, `swaps_exhausted`),
 * carries real product copy for each and offers real exits. Splitting these
 * two into a file each would put a fourteen-line component behind an import
 * and a header arguing for its own existence.
 *
 * WHY THEY MOVED OUT OF (tabs)/index.tsx. That file caps at 800 lines and
 * the owner's photo/ingredients work pushed it past. These went first
 * because they are the parts that hold no state, take no callback but one,
 * and cannot be affected by anything the screen does.
 *
 * THE SKELETON DOES NOT SHIMMER, and that is a rule rather than an omission
 * (DESIGN.md §1: "a calm `surfaceSunken` bar (~70% width, no shimmer)"). It
 * holds the dish name's exact line height so the reveal does not move the
 * eyebrow above it, and the eyebrow renders immediately because "KIEZEN" is
 * true before anything has been decided.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, radii, spacing, typeScale } from '@/theme/tokens';
import { Button } from './Button';

export function DecisionLoadingSkeleton(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.heroBlock}>
      <Text style={[typeScale.label, styles.eyebrow, { color: colors.textMuted }]}>KIEZEN</Text>
      <View style={[styles.skeletonBar, { backgroundColor: colors.surfaceSunken }]} />
    </View>
  );
}

export interface DecisionErrorStateProps {
  readonly onRetry: () => void;
}

export function DecisionErrorState(props: DecisionErrorStateProps): JSX.Element {
  const { onRetry } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.heroBlock}>
      <Text style={[typeScale.title2, styles.centeredTitle, { color: colors.textPrimary }]}>
        Kon geen suggestie ophalen
      </Text>
      <Text style={[typeScale.bodySmall, styles.centeredBody, { color: colors.textMuted }]}>
        Controleer je verbinding en probeer het opnieuw.
      </Text>
      <Button label="Opnieuw" variant="secondary" onPress={onRetry} accessibilityLabel="Probeer opnieuw een suggestie op te halen" />
    </View>
  );
}

const styles = StyleSheet.create({
  // The screen's own hero block, repeated here rather than passed in: both
  // states fill the same centred space the dish name would have taken, and a
  // `style` prop would let a caller put them somewhere else, which is the
  // one thing neither of them may be.
  heroBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  eyebrow: {
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: spacing.space3,
  },
  skeletonBar: {
    alignSelf: 'center',
    width: '70%',
    height: typeScale.display.lineHeight,
    borderRadius: radii.radiusSm,
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

/**
 * The `__DEV__`-only scenario picker above Kiezen: one tap puts the screen
 * into any of its states without needing a household seeded to produce it.
 *
 * WHY IT LIVES HERE RATHER THAN IN (tabs)/index.tsx, WHERE IT WAS BORN. It
 * is scaffolding, and it had grown to about a sixth of the most important
 * route file in the product — a file this project caps at 800 lines and
 * which the owner's photo/ingredients work pushed past. Nothing about the
 * row is the screen: it holds no product state, reads no repository, and
 * renders nothing a user ever sees.
 *
 * `DevScenario` IS EXPORTED FROM HERE, and that direction is deliberate
 * rather than convenient. The screen switches on the union exhaustively
 * (`resolveCurrentResult`), so it has to import it from somewhere, and the
 * only other arrangement is this component importing a type out of a route
 * module — which closes a cycle and makes a `src/components` file depend on
 * `src/app`. The union and the row that renders it are one vocabulary: a
 * seventh scenario means a seventh label, and both are in this file.
 *
 * IT IS DOUBLE-GATED AT THE CALL SITE, not here. `__DEV__` is always true in
 * Expo Go, which is why four scenario rows once rendered above the product
 * on every screen (4 September 2026), so the caller also asks
 * `DEV_SCENARIO_ROWS_VISIBLE` (src/lib/devFlags.ts). The gate is left with
 * the caller because a component that hides itself is a component nobody can
 * see is mounted.
 */

import type { JSX } from 'react';
import { Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, spacing, typeScale } from '@/theme/tokens';

/** Every state Kiezen can be put into by hand. `'normal'` is the only one that drives the real pipeline. */
export type DevScenario =
  | 'normal'
  | 'empty_rotation'
  | 'all_excluded'
  | 'filtered_out'
  | 'swaps_exhausted'
  | 'error';

export interface DevScenarioRowProps {
  readonly active: DevScenario;
  readonly onSelect: (scenario: DevScenario) => void;
}

const DEV_SCENARIOS: ReadonlyArray<{ value: DevScenario; label: string }> = [
  { value: 'normal', label: 'Normaal' },
  { value: 'empty_rotation', label: 'Lege rotatie' },
  { value: 'all_excluded', label: 'Alles uitgesloten' },
  { value: 'filtered_out', label: 'Weggefilterd' },
  { value: 'swaps_exhausted', label: 'Wissels op' },
  { value: 'error', label: 'Fout' },
];

export function DevScenarioRow(props: DevScenarioRowProps): JSX.Element {
  const { active, onSelect } = props;
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <View style={styles.devRow} accessibilityLabel="Ontwikkelaarsmodus: demoscenario kiezen">
      {DEV_SCENARIOS.map((scenario) => (
        <Pressable
          key={scenario.value}
          onPress={() => onSelect(scenario.value)}
          style={styles.devButton}
          accessibilityRole="button"
          accessibilityLabel={`Demoscenario: ${scenario.label}`}
        >
          <Text style={[typeScale.caption, { color: active === scenario.value ? colors.accent : colors.textMuted }]}>
            {scenario.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  devRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.space3,
    paddingTop: spacing.space2,
    gap: spacing.space3,
  },
  devButton: {
    minHeight: spacing.touchTargetMin,
    justifyContent: 'center',
  },
});

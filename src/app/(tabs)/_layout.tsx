/**
 * The two-tab navigator: Vanavond and Mijn recepten. Nested under `(tabs)`
 * — a route group, so it does not appear in the URL — specifically so Cook
 * Mode, onboarding, and the import flow (registered as sibling Stack
 * screens in the parent src/app/_layout.tsx) render full-screen, without
 * this tab bar leaking into them. See src/app/_layout.tsx for the
 * rationale.
 *
 * The Feed tab was removed (founder decision: "too difficult" — see the
 * git history for its prior implementation). "Mijn recepten" replaces it
 * as the destination for Vanavond's "Iets anders"-exhausted "Ik kies zelf"
 * escape hatch (PD-001) and empty-rotation "Kies zelf" state
 * (NoCandidateState) — the structural rule those states satisfy
 * ("browsing lives in a separate tab, never on the decision surface")
 * still holds with a plain recipe list in that tab instead of a video feed.
 *
 * No tab icons: the product's own visual direction (docs/DESIGN.md,
 * "Instrument, not magazine") is explicitly icon-averse, so text-only tab
 * labels stay consistent with that.
 */

import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { getColors, typeScale } from '@/theme/tokens';

export default function TabsLayout(): JSX.Element {
  const scheme = useColorScheme();
  const colors = getColors(scheme);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: typeScale.caption,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Vanavond',
          tabBarAccessibilityLabel: 'Vanavond, de suggestie voor vanavond',
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Mijn recepten',
          tabBarAccessibilityLabel: 'Mijn recepten, jouw opgeslagen en geïmporteerde gerechten',
        }}
      />
    </Tabs>
  );
}

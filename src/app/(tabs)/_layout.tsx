/**
 * The two-tab navigator: Kiezen and Bibliotheek. Nested under `(tabs)` — a
 * route group, so it does not appear in the URL — specifically so Cook
 * Mode, the import flow, and settings (registered as sibling Stack screens
 * in the parent src/app/_layout.tsx) render full-screen, without this tab
 * bar leaking into them. See src/app/_layout.tsx for the rationale.
 *
 * Two tasks, two tabs (docs/DESIGN.md): Kiezen is the one-dish decision
 * surface (PD-001/PD-002 govern it unchanged); Bibliotheek is where saved
 * recipes live and where a link gets pasted in. Settings (household size,
 * weeknight time budget, dislikes/allergens) has no tab of its own — it's
 * reachable from Bibliotheek's header instead, per the brief's "not a
 * gating wizard" instruction.
 *
 * No tab icons: the product's visual direction (docs/DESIGN.md, "the
 * contact sheet, not the magazine") is explicitly icon-averse, so
 * text-only tab labels — set in `typeScale.caption`, now monospace — stay
 * consistent with that.
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
          title: 'Kiezen',
          tabBarAccessibilityLabel: 'Kiezen, de suggestie voor vanavond',
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Bibliotheek',
          tabBarAccessibilityLabel: 'Bibliotheek, jouw opgeslagen en geïmporteerde recepten',
        }}
      />
    </Tabs>
  );
}

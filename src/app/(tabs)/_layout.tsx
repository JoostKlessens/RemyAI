/**
 * The three-tab navigator: Kiezen, Bibliotheek and Vrienden. Nested under
 * `(tabs)` — a route group, so it does not appear in the URL —
 * specifically so Cook Mode, the import flow, a friend's shared recipe and
 * settings (all registered as sibling Stack screens in the parent
 * src/app/_layout.tsx) render full-screen, without this tab bar leaking
 * into them. See src/app/_layout.tsx for the rationale.
 *
 * The tabs, in the order they appear (docs/DESIGN.md "Navigation"):
 * Kiezen is the one-dish decision surface (PD-001/PD-002 govern it
 * unchanged); Bibliotheek is where saved recipes live and where a link
 * gets pasted in; Vrienden, added in Fase 5b, is what people you know
 * have cooked and sent on (PD-010).
 *
 * Vrienden is deliberately last. Tab order is a claim about priority, and
 * the daily question this product exists to answer is still the first
 * one — a social surface placed ahead of it would be the app quietly
 * changing its mind about what it is for. Kiezen also stays the launch
 * tab (`index`), unchanged.
 *
 * Settings (household size, weeknight time budget, dislikes/allergens)
 * still has no tab of its own — it's reachable from Bibliotheek's header
 * instead, per the brief's "not a gating wizard" instruction.
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
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Vrienden',
          tabBarAccessibilityLabel: 'Vrienden, recepten die vrienden met je deelden',
        }}
      />
    </Tabs>
  );
}

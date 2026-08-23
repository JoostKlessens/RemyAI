/**
 * The two-tab navigator: Vanavond and Feed, exactly as the task brief
 * requires ("Two tabs only"). Nested under `(tabs)` — a route group, so
 * it does not appear in the URL — specifically so Cook Mode and
 * onboarding (registered as sibling Stack screens in the parent
 * src/app/_layout.tsx) render full-screen, without this tab bar leaking
 * into them. See src/app/_layout.tsx for the rationale.
 *
 * No tab icons: the product's own visual direction (docs/DESIGN.md,
 * "Instrument, not magazine") is explicitly icon-averse everywhere except
 * the Feed action rail, so text-only tab labels stay consistent with that.
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
        name="feed"
        options={{
          title: 'Feed',
          tabBarAccessibilityLabel: 'Feed, ontdek nieuwe gerechten',
        }}
      />
    </Tabs>
  );
}

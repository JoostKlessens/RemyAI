/**
 * Root layout. The two-tab navigator (Vanavond, Mijn recepten) lives one
 * level down, at `(tabs)/_layout.tsx`, wrapped here in a `Stack` alongside
 * Cook Mode, onboarding, and the recipe import flow as full-screen
 * siblings.
 *
 * Why: expo-router mounts every sibling route of a `<Tabs>` layout as an
 * additional tab unless explicitly hidden, and even hidden tab entries
 * still render inside the tab navigator's chrome. Cook Mode, onboarding,
 * and import all need to be completely free of the bottom tab bar (Cook
 * Mode's own spec calls for large, glanceable, single-purpose screens;
 * onboarding is "the only screen allowed to feel like a setup wizard";
 * import is a focused paste-then-confirm task, not a tab destination).
 * Nesting the real tab navigator inside a `(tabs)` route group — which
 * does not appear in the URL — keeps the public routes exactly as
 * specified (`/`, `/recipes`, `/cook/[mealId]`, `/onboarding/seed`,
 * `/onboarding/household`, `/import/paste`, `/import/confirm`) while
 * giving Cook Mode, onboarding, and import a clean, tab-free full-screen
 * presentation.
 */

import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout(): JSX.Element {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cook/[mealId]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="onboarding/seed" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="onboarding/household" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/paste" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/confirm" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

/**
 * Root layout. The task brief describes this file as "root layout with a
 * tab navigator: Vanavond and Feed" — that navigator lives one level down,
 * at `(tabs)/_layout.tsx`, wrapped here in a `Stack` alongside Cook Mode
 * and onboarding as full-screen siblings.
 *
 * Why: expo-router mounts every sibling route of a `<Tabs>` layout as an
 * additional tab unless explicitly hidden, and even hidden tab entries
 * still render inside the tab navigator's chrome. Cook Mode and
 * onboarding both need to be completely free of the bottom tab bar (Cook
 * Mode's own spec calls for large, glanceable, single-purpose screens;
 * onboarding is "the only screen allowed to feel like a setup wizard").
 * Nesting the real tab navigator inside a `(tabs)` route group — which
 * does not appear in the URL — keeps the public routes exactly as
 * specified (`/`, `/feed`, `/cook/[mealId]`, `/onboarding/seed`,
 * `/onboarding/household`) while giving Cook Mode and onboarding a clean,
 * tab-free full-screen presentation.
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
      </Stack>
    </SafeAreaProvider>
  );
}

/**
 * Root layout. The two-tab navigator (Kiezen, Bibliotheek) lives one level
 * down, at `(tabs)/_layout.tsx`, wrapped here in a `Stack` alongside Cook
 * Mode, the recipe import flow, and the settings screen as full-screen
 * siblings.
 *
 * Why: expo-router mounts every sibling route of a `<Tabs>` layout as an
 * additional tab unless explicitly hidden, and even hidden tab entries
 * still render inside the tab navigator's chrome. Cook Mode, import, and
 * settings all need to be completely free of the bottom tab bar (Cook
 * Mode's own spec calls for large, glanceable, single-purpose screens;
 * import is a focused paste-then-confirm task; settings is a plain form).
 * Nesting the real tab navigator inside a `(tabs)` route group — which
 * does not appear in the URL — keeps the public routes exactly as
 * specified (`/`, `/recipes`, `/cook/[mealId]`, `/import/paste`,
 * `/import/confirm`, `/settings`) while giving Cook Mode, import, and
 * settings a clean, tab-free full-screen presentation.
 *
 * Font loading: docs/DESIGN.md specifies Archivo (reading text) and IBM
 * Plex Mono (systemic text — labels, buttons, timers) via
 * `@expo-google-fonts/*`, neither bundled by Expo by default. `tokens.ts`'s
 * `fontFamily` constants name these exact exports and cannot themselves
 * gate on load state (it's a side-effect-free constant module) — so this
 * file is where that gate lives: the splash screen is held with
 * `SplashScreen.preventAutoHideAsync()` (called at module scope, before
 * anything mounts) until `useFonts()` resolves, and nothing renders before
 * then. Without this, every `typeScale` consumer silently falls back to
 * the OS system font and the "contact sheet" visual direction never
 * actually appears on screen.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Must run once, at module scope, before the first render — calling this
// inside the component body can race the initial paint on some platforms.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): JSX.Element | null {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  // A genuine font-load failure (corrupt asset, unsupported platform) must
  // still let the app through — falling back to the system font is a far
  // better failure mode than an app stuck behind its own splash screen
  // forever. `typeScale`'s family names simply won't resolve in that case,
  // and RN silently substitutes the platform default.
  const readyToRender = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (readyToRender) {
      void SplashScreen.hideAsync();
    }
  }, [readyToRender]);

  if (!readyToRender) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cook/[mealId]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/paste" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/confirm" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}

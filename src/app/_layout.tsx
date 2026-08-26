/**
 * Root layout. The tab navigator (Kiezen, Bibliotheek, Vrienden) lives one
 * level down, at `(tabs)/_layout.tsx`, wrapped here in a `Stack` alongside
 * Cook Mode, the recipe import flow, a friend's shared recipe, and the
 * settings screen as full-screen siblings.
 *
 * Why: expo-router mounts every sibling route of a `<Tabs>` layout as an
 * additional tab unless explicitly hidden, and even hidden tab entries
 * still render inside the tab navigator's chrome. Cook Mode, import, the
 * shared recipe and settings all need to be completely free of the bottom
 * tab bar (Cook Mode's own spec calls for large, glanceable,
 * single-purpose screens; import is a focused paste-then-confirm task;
 * settings is a plain form). Nesting the real tab navigator inside a
 * `(tabs)` route group — which does not appear in the URL — keeps the
 * public routes exactly as specified (`/`, `/recipes`, `/friends`,
 * `/cook/[mealId]`, `/import/paste`, `/import/confirm`,
 * `/friends/[feedItemId]`, `/settings`) while giving the full-screen
 * siblings a clean, tab-free presentation.
 *
 * Note the deliberate pairing of `/friends` (the tab, from the route
 * group) with `/friends/[feedItemId]` (the full-screen sibling): the tab
 * group contributes nothing to the URL, so these are two distinct paths
 * and not a collision — a friend's recipe reads as a child of the feed it
 * came from, which is exactly what it is.
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
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@/hooks/useSession';

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
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cook/[mealId]" options={{ presentation: 'fullScreenModal' }} />
        {/* Fase 5b. A friend's full recipe (PD-010) opens over the tabs
            rather than inside them: it is a read of somebody else's
            kitchen, not another view of your own library, and leaving the
            Vrienden tab lit underneath would suggest otherwise. Same
            full-screen treatment as Cook Mode and the import flow. */}
        <Stack.Screen name="friends/[feedItemId]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/paste" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/confirm" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="claim-handle" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

/**
 * Sends people to the one screen their session state allows, and nowhere
 * else. An account is required before the app renders (PD-012), so this is
 * the single place that rule is enforced — no screen carries its own copy.
 *
 * WHY A REDIRECT RATHER THAN CONDITIONAL SCREENS. expo-router mounts every
 * file in src/app as a route whether or not a <Stack.Screen> declares it,
 * so omitting one does not make it unreachable — a deep link or a stale
 * history entry still lands on it. Redirecting from a layout effect is the
 * only place that catches all of those.
 *
 * IT WAITS. While `isResolving` is true nothing is redirected, because a
 * session read from AsyncStorage settles a beat after mount and bouncing a
 * signed-in person to sign-in for that beat is both wrong and jarring.
 *
 * The dependency on `segments` is what makes this idempotent: once the
 * redirect lands, the guard re-runs, finds itself already on the right
 * screen, and does nothing.
 */
function AuthGate(): null {
  const session = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session.isResolving) {
      return;
    }

    const current = segments[0];
    const onSignIn = current === 'sign-in';
    const onClaimHandle = current === 'claim-handle';

    if (session.capability.needsSignIn && !onSignIn) {
      router.replace('/sign-in');
      return;
    }
    if (session.capability.needsHandle && !onClaimHandle) {
      router.replace('/claim-handle');
      return;
    }
    if (session.capability.canUseApp && (onSignIn || onClaimHandle)) {
      router.replace('/');
    }
  }, [session.isResolving, session.capability, segments, router]);

  return null;
}

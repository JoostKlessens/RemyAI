/**
 * Root layout. The tab navigator (Kiezen, Bibliotheek, Vrienden) lives one
 * level down, at `(tabs)/_layout.tsx`, wrapped here in a `Stack` alongside
 * Cook Mode, the recipe import flow, the recipe editor, a friend's shared
 * recipe, and the settings screen as full-screen siblings.
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
 * `/friends/[feedItemId]`, `/recipe-edit/[mealId]`, `/settings`) while giving the full-screen
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

import { useCallback, useEffect, useState, type JSX } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Archivo_400Regular, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import * as Linking from 'expo-linking';
import { AppState } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { completeSignInFromUrl } from '@/lib/auth';
import { useSession } from '@/hooks/useSession';
import { startHouseholdSync, subscribeToForeground } from '@/lib/householdSync';
import { scheduleDecisionNotification } from '@/lib/decisionNotification';
import { getAppRepository } from '@/lib/repository';
import { getAppHouseholdSyncEnvironment } from '@/lib/repository/createRepository';
import {
  recordPendingRating,
  resolvePendingRating,
  type PendingRatingPrompt,
} from '@/lib/pendingRating';
import { PendingRatingSheet } from '@/components/PendingRatingSheet';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import { supabase } from '@/lib/supabase';

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

  /**
   * The sign-in link's landing point.
   *
   * `Linking.useURL()` COVERS BOTH ARRIVALS, and that is why it is used
   * rather than an `addEventListener('url')`: tapping the mail can either
   * wake a running app or cold-start it, and those are two different APIs
   * (`addEventListener` and `getInitialURL`). A handler wired to only the
   * first works in every test and fails for every real person, because a
   * phone that has not opened Remy yet is the normal case for a first
   * sign-in.
   *
   * IT LIVES AT THE ROOT ON PURPOSE. The link can land while any screen is
   * showing — or none — so hanging this off the sign-in screen would mean a
   * link only worked if you had left that screen open, which is exactly the
   * mail-client round trip nobody does.
   *
   * NO NAVIGATION HERE. A successful exchange fires `onAuthStateChange`,
   * `useSession` is subscribed, and `AuthGate` below moves on by itself.
   * Pushing a route from here would race that gate for the same decision.
   *
   * The outcome is deliberately dropped rather than surfaced: this handler
   * sees every deep link the app receives, most of which are not sign-ins,
   * and a root-level effect has no business rendering an error over
   * whatever screen happens to be up. Reporting a rejected link where the
   * person can act on it belongs to the sign-in screen and is its own item.
   */
  const incomingUrl = Linking.useURL();
  useEffect(() => {
    if (incomingUrl === null) {
      return;
    }
    void completeSignInFromUrl(incomingUrl);
  }, [incomingUrl]);

  if (!readyToRender) {
    return null;
  }

  return (
    /* `initialMetrics` IS NOT DECORATION. Without it the provider hands its
       children `{0,0,0,0}` until a native measurement comes back, so the
       first frames of any screen render as though the device had no notch
       and no home indicator; `initialWindowMetrics` is that same
       measurement read synchronously at module scope, so the first frame is
       already right. On a `fullScreenModal` — which is what `friends/add`,
       `cook/[mealId]` and `import/paste` are — the visible consequence is
       that the back row sits at y=8 instead of y≈67 for a moment, which on
       an iPhone with a Dynamic Island puts it under hardware that eats the
       tap.

       THIS IS NOT A DIAGNOSIS OF THE OWNER'S REPORT (8 September: "als ik
       op die pagina zit en op terug probeer te klikken werkt dit niet").
       That cause has NOT been found — four candidates were measured and
       ruled out, see docs/archief/RONDE-8-SEPTEMBER-TRENDING.md taak B. This prop
       is here because it is a real gap on its own terms and the library
       documents it as the recommended setup; that it also happens to fit
       the word "soms" is a reason to look, not a finding. */
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthGate />
      <HouseholdBootstrapGate />
      <PendingRatingGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cook/[mealId]" options={{ presentation: 'fullScreenModal' }} />
        {/* Fase 5b. A friend's full recipe (PD-010) opens over the tabs
            rather than inside them: it is a read of somebody else's
            kitchen, not another view of your own library, and leaving the
            Vrienden tab lit underneath would suggest otherwise. Same
            full-screen treatment as Cook Mode and the import flow. */}
        {/* §4.4's handle exchange, "full-screen over the tabs" — the same
            treatment as the shared recipe below it, and for a related
            reason: it is somewhere you go to do one thing and come back
            from, not a fifth view of your own kitchen.

            IT IS DECLARED BEFORE THE DYNAMIC SIBLING, which is presentation
            rather than routing. expo-router resolves a static segment ahead
            of a dynamic one regardless of declaration order, so
            `/friends/add` reaches this screen and never `[feedItemId]` with
            the id "add"; the ordering here is so a reader meets the
            specific route before the catch-all, the way the file system
            lists them. */}
        {/* ⚠ THESE TWO STOPPED BEING `fullScreenModal` ON 9 SEPTEMBER 2026,
            AND SO DID `settings` BELOW. The owner asked to be able to swipe
            back, and on iOS that gesture is a property of the PRESENTATION
            rather than a flag you can add: a `fullScreenModal` maps to
            `UIModalPresentationFullScreen`, which has no interactive
            dismissal, so `gestureEnabled` has nothing to enable there. A card
            push carries the edge-swipe natively, with no dependency —
            `react-native-gesture-handler` is NOT installed and this change
            deliberately does not add it.

            THE EVIDENCE THAT THIS IS THE RIGHT SHAPE WAS ALREADY IN THIS
            FILE. `recipe/[mealId]` is not declared here at all, so it has
            been an ordinary card push all along — which is exactly why back
            already swiped there and nowhere else. `deze-week` and
            `boodschappen` below make the argument in words: "ordinary
            pushes: they are places in the app rather than interruptions of
            it". These three are the same kind of place. You go to them, and
            you come back.

            NOTHING ABOUT THE TAB BAR CHANGES, which is the thing to check
            before believing this is safe. Tab-free comes from these routes
            being SIBLINGS of the `(tabs)` group in this Stack — see this
            file's header — and not from `presentation`. A card push still
            covers the tabs completely; only the transition differs, from
            bottom-up to right-to-left.

            WHAT KEEPS ITS MODAL, because the rule is not "swipe everywhere":
            `cook/[mealId]` (a swipe out of a half-cooked recipe is a lost
            session, and that screen's own comment at line 674 names its
            presentation), `recipe-edit/[mealId]` and the two import screens
            (all three hold unsaved work), and `sign-in`/`claim-handle`, which
            additionally pin `gestureEnabled: false` because there is nowhere
            to go back TO.

            ⚠ NOT VERIFIED ON A DEVICE. This is reasoned from the navigator's
            presentation semantics, not measured — the one thing a web render
            cannot show. It is the first thing to check on the next phone
            pass, alongside whether the right-to-left transition suits these
            three. */}
        <Stack.Screen name="friends/add" />
        <Stack.Screen name="friends/[feedItemId]" />
        {/* The canonical recipe behind a PROOF card, added 10 September 2026.
            An ordinary push beside its sibling above, not a modal, and for the
            same reason: it holds no unsaved work, and the back swipe is the
            gesture somebody arriving from a feed will reach for first. The two
            are separate routes because they read different rows under different
            permissions — see either file's header. */}
        <Stack.Screen name="friends/recipe/[recipeId]" />
        {/* RCP-03. Full-screen over the tabs, the same treatment
            import/confirm gets below and for the same reason: it is one
            focused editing task you go into and come back from, and the
            Bibliotheek tab lit underneath would suggest you were still
            browsing. It is also the same editor confirm.tsx is, which makes
            matching its presentation the honest choice rather than a
            coincidence. */}
        {/*
         * Declared, though expo-router would mount them from the filesystem
         * regardless — both shipped undeclared and worked. The point is that
         * this list is read as "the screens this app has", and a list that
         * is silently a subset teaches whoever reads it next to distrust it.
         *
         * NOT `fullScreenModal`, unlike every neighbour here. These two are
         * ordinary pushes: they are places in the app rather than
         * interruptions of it, and each carries its own "Sluiten" back to
         * Mijn recepten. deze-week.tsx's header argues the navigation shape
         * between the pair.
         */}
        <Stack.Screen name="deze-week" />
        <Stack.Screen name="boodschappen" />
        <Stack.Screen name="recipe-edit/[mealId]" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/paste" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen name="import/confirm" options={{ presentation: 'fullScreenModal' }} />
        {/* The third of the three that gave up `fullScreenModal` for the back
            swipe — see the block above `friends/add` for the argument. This
            one is the least controversial of them: settings is a plain form
            you open from Mijn recepten and return to Mijn recepten from, it
            holds no half-finished work that a stray swipe could lose, and
            every field on it writes through on change rather than on a save
            button. */}
        <Stack.Screen name="settings" />
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

/**
 * Makes this household exist in Postgres, then sends anything the mirror
 * has been holding.
 *
 * NOTHING IS DECIDED HERE. The order, the preconditions, the choice of
 * member, the once-guard and the retry all live in
 * `@/lib/householdSync`, because this file is a route module and a route
 * module cannot be imported by a test in this repo at all — expo-router
 * and react-native internals fail to parse under Vite. That is the same
 * split `useOutcomeSend`/`sendRecipe` and `friendProof` already keep, and
 * it is why this component is nine lines.
 *
 * A SIBLING OF `AuthGate`, NOT A WRAPPER, AND NEVER A GATE ON ANYTHING.
 * The name says "bootstrap gate" because it gates POSTGRES, not the UI:
 * it renders null, blocks nothing, shows no spinner and holds no error
 * state. The app was local-first before any of this existed and is exactly
 * as usable with the whole network missing — a failed bootstrap is a
 * report nobody reads and a backlog that waits.
 *
 * WHY IT DOES NOT LIVE INSIDE `AuthGate`. That component decides which
 * screen a person is allowed on, which is a decision with a visible
 * consequence in the very next frame. This one has none, and folding a
 * fire-and-forget network effect into a redirect guard would make the
 * redirect's dependency list carry reasons that have nothing to do with
 * routing.
 *
 * THE FOREGROUND SUBSCRIPTION IS THIS APP'S "CONNECTIVITY RETURNED".
 * `AppState` is already installed with react-native; netinfo is a native
 * module and would oblige the whole team to rebuild the dev client. See
 * householdSync.ts's header for the full argument. The effect re-runs on
 * the three session values only — `capability.canUseApp` rather than the
 * `capability` object, which `describeSessionCapability` rebuilds on every
 * render — so the listener is not churned on unrelated repaints.
 */
/**
 * Arms the household's daily suggestion notification (GAP-30).
 *
 * IT READS THE LIBRARY BEFORE IT ARMS ANYTHING, and that is the whole
 * reason this helper does real work instead of forwarding two fields.
 * `planDecisionNotification` refuses to schedule for an empty library, and
 * an empty library is exactly the state a fresh install is in — so the
 * first thing a new user would otherwise experience is Remy interrupting
 * their evening to offer nothing.
 *
 * RE-RUN ON EVERY FOREGROUND, which is what makes that check self-healing
 * in both directions: the evening after a first import the notification
 * arms itself, and the evening after the last recipe is archived it
 * disarms. `scheduleDecisionNotification` cancels before it schedules, so
 * running this a hundred times leaves exactly one trigger.
 *
 * `listHouseholdMeals` is the same read Kiezen uses for its candidate
 * pool, so "is there anything to suggest" is answered by the query that
 * actually decides it rather than by a second definition that could
 * disagree.
 */
async function armDecisionNotification(canUseApp: boolean): Promise<void> {
  if (!canUseApp) {
    return;
  }
  try {
    const repository = getAppRepository();
    const householdId = await repository.getCurrentHouseholdId();
    const [household, meals] = await Promise.all([
      repository.getHousehold(householdId),
      repository.listHouseholdMeals(householdId),
    ]);
    if (household === null) {
      return;
    }
    await scheduleDecisionNotification({
      candidateMealCount: meals.length,
      decisionPushTime: household.decisionPushTime,
    });
  } catch {
    // Local storage. Same contract as the sync beside it: no notification
    // today is never no app today.
  }
}

/**
 * Asks for the grade the outcome card no longer asks for (GAP-46).
 *
 * A SIBLING OF `AuthGate`, NOT A WRAPPER, AND NOT A GATE ON ANYTHING — the
 * same shape and the same reasons as `HouseholdBootstrapGate` beside it.
 * The name says "gate" because it decides whether a QUESTION appears, never
 * whether the app does: it blocks no render, holds no error state and shows
 * no spinner, and a launch where every read fails is a launch with no sheet
 * and an app that works exactly as well.
 *
 * WHY IT LIVES AT THE ROOT. The owner chose "a sheet when you open the app"
 * over a card on Kiezen and a badge on a tile, and the root layout is the
 * one place that is true of every route — including the launch that lands
 * straight on Mijn recepten. Deciding it per screen would ask the same
 * question from four places, or from none.
 *
 * WHAT IS DELIBERATELY NOT HERE. No clock arithmetic, no repository
 * queries, no notion of what "due" means: `resolvePendingRating` owns all
 * of it one file down, where tests/pendingRating.test.ts can reach it,
 * because a route module cannot be imported by a test in this repo at all.
 * This component is the eleven lines React actually owns.
 *
 * IT RUNS ONCE PER MOUNT AND NOT ON EVERY FOREGROUND, which is the one
 * place it deviates from its neighbour. `HouseholdBootstrapGate` re-runs on
 * `AppState` because a flush that missed the network should retry when the
 * network returns. This must not: a sheet that reappears every time
 * somebody glances at another app and comes back is a nag, and the owner's
 * whole reason for the twelve-hour delay was to ask at a moment people are
 * ready for. His words are "de eerste keer dat je de app opent" — the first
 * time, not every time it comes forward.
 *
 * ONE QUESTION PER LAUNCH, and the backlog drains in order. Clearing the
 * prompt does not look for a next one, so somebody who has not opened the
 * app in a week is asked about Monday today and Tuesday tomorrow —
 * `selectPendingRating` returns the OLDEST due cook, so the order is the
 * order things happened. Turning the app's launch into a queue of dialogs
 * is precisely the chore this delay exists to avoid.
 */
function PendingRatingGate(): JSX.Element {
  const { isResolving, capability, userId } = useSession();
  const canUseApp = capability.canUseApp;
  const [prompt, setPrompt] = useState<PendingRatingPrompt | null>(null);

  useEffect(() => {
    // `isResolving` is not "signed out": asking before the session settles
    // would read a repository whose household is not yet decided. Same
    // predicate order `HouseholdBootstrapGate` uses, for the same reason.
    if (isResolving || !canUseApp) {
      return;
    }
    let cancelled = false;
    void resolvePendingRating(getAppRepository(), Date.now()).then((resolved) => {
      // The mount can lose the race with a sign-out or a fast unmount;
      // setting state then is a warning in the log and a sheet nobody asked
      // for. `resolvePendingRating` never rejects, so there is no catch.
      if (!cancelled) {
        setPrompt(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isResolving, canUseApp]);

  /**
   * The single answer path, and it clears the prompt on BOTH outcomes.
   *
   * That is `PendingRatingSheet`'s stated mounting contract: a sheet whose
   * caller forgets to clear in one branch is a sheet that reappears on the
   * next render, about the same dish, forever. Clearing FIRST also makes
   * the dismissal instant — the write is not something anybody should watch
   * a sheet wait for.
   *
   * A SKIP WRITES NOTHING AT ALL. `rating` null means the question was
   * postponed, so the cook stays due and the next launch asks again; that
   * is PD-008's "skipping must cost exactly what answering costs", and it
   * is why this is one handler with one branch rather than two callbacks.
   */
  const handleAnswer = useCallback(
    (rating: number | null): void => {
      const answered = prompt;
      setPrompt(null);
      if (answered === null || rating === null) {
        return;
      }
      void recordPendingRating(
        getAppRepository(),
        createSupabaseSocialRepository(supabase),
        answered,
        userId,
        rating,
      );
    },
    [prompt, userId],
  );

  return <PendingRatingSheet prompt={prompt} onAnswer={handleAnswer} />;
}

function HouseholdBootstrapGate(): null {
  const { isResolving, capability, userId } = useSession();
  const canUseApp = capability.canUseApp;

  useEffect(() => {
    const environment = getAppHouseholdSyncEnvironment();
    const session = { isResolving, canUseApp, userId };
    // Not awaited, and there is nothing here to await it with: `start`
    // returns void by design.
    startHouseholdSync(environment, session);
    void armDecisionNotification(canUseApp);
    return subscribeToForeground(AppState, () => {
      startHouseholdSync(environment, session);
      void armDecisionNotification(canUseApp);
    });
  }, [isResolving, canUseApp, userId]);

  return null;
}

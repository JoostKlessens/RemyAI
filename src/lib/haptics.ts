/**
 * THE HAPTIC VOCABULARY (WS5 §3). Four styles, and every call site in the
 * app goes through this file.
 *
 * WHY A MODULE AND NOT `import * as Haptics` AT EACH CALL SITE. Three
 * screens already did it the direct way, and each carried its own copy of
 * the same four-line ritual: call, `.catch(() => {})`, and a comment
 * explaining why the catch is not laziness. WS5 §3.2 specifies fifteen
 * events; fifteen copies of a rule is fifteen chances to drop it, and the
 * one that gets dropped is invisible until `npx expo export --platform
 * web` starts printing unhandled rejections. The rule is load-bearing, so
 * it lives once.
 *
 * WHY THE CATCH IS MANDATORY AND NOT DEFENSIVE PADDING. The web
 * implementation of `expo-haptics` is an empty default export
 * (node_modules/expo-haptics/build/ExpoHaptics.web.js), and each wrapper
 * is an `async` function that throws `UnavailabilityError` when the native
 * method is absent — so the throw arrives as a REJECTED PROMISE. This app
 * ships a web export. Without the catch, every haptic on web is an
 * unhandled rejection.
 *
 * WHY NOTHING HERE IS AWAITED, AND WHY EVERY FUNCTION RETURNS `void`. A
 * haptic is feedback about something that has ALREADY happened. There is
 * no state to advance when it lands and nothing to do when it fails, so a
 * caller that could `await` one is a caller that could accidentally
 * sequence real work behind a vibration motor.
 *
 * WHY THE NAMES DESCRIBE CONSEQUENCE AND NOT API SURFACE. WS5 §3.1 rule 2:
 * "style tracks the weight of the consequence, not the size of the UI
 * element." A call site reading `hapticRealCommit()` has to answer whether
 * this is a real commitment; one reading `impactAsync(Medium)` only has to
 * answer whether Medium feels nice, which is how a vocabulary of four
 * becomes a vocabulary of eight nobody can hear the difference between.
 * `Heavy`, `Soft`, `Rigid` and `Warning` are deliberately not exposed.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not check reduced motion. WS5
 * §3.1 rule 4 is explicit: a haptic is feedback, not motion, and survives
 * reduced motion — `resolveDuration()` must never gate a `Haptics.` call.
 * It also does not de-duplicate: "at most one per user action" (rule 3) is
 * a property of the call site, and the guard belongs with the effect that
 * could re-fire (see `SendRecipeSheet`'s `hasCommitted` ref for the
 * pattern).
 *
 * NOT COVERED BY TESTS, AND SAYING SO RATHER THAN IMPLYING OTHERWISE.
 * vitest runs node-only with react-native stubbed; there is no native
 * module to assert against. These land as reviewed code verified by hand
 * on a device.
 */

import * as Haptics from 'expo-haptics';

/** Everything below funnels through here, so the swallow exists exactly once. */
function fire(run: () => Promise<void>): void {
  run().catch(() => {
    // Unsupported on this device, this simulator, or on web — and every
    // haptic in this app has a visual partner (WS5 §3.1 rule 5), so the
    // moment still lands without it.
  });
}

/**
 * A value moved, and it is reversible. Grade crossings on the rating
 * slider, a cook step advancing, a chip being selected, a segmented
 * control changing scope.
 */
export function hapticValueMoved(): void {
  fire(Haptics.selectionAsync);
}

/**
 * A small commitment landed: a sheet settling, a save intent chosen, a
 * cook timer started. The tap registered and something is now different —
 * but nothing was decided.
 */
export function hapticSmallCommit(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/**
 * A real commitment landed: `Ja` on Kiezen, a grade committing, allergens
 * confirmed. The three moments in the app where the answer changes what
 * the product does next.
 */
export function hapticRealCommit(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/**
 * A thing completed that was being waited for: a timer reaching zero, an
 * import resolving, `Gemaakt!` landing. Never an arrival the user did not
 * ask for — WS5 §3.1 rule 1.
 */
export function hapticCompleted(): void {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/**
 * The app could not do the thing. Deliberately NOT for a display-only
 * import (PD-011), which is a working path with a different shape and must
 * not feel like a failure.
 */
export function hapticFailed(): void {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

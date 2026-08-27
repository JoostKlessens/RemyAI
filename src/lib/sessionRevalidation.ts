/**
 * "Look again." The one signal `useSession` cannot receive from Supabase,
 * and the thirty seconds its absence cost.
 *
 * WHAT WENT WRONG. `useSession` re-resolves on exactly one event:
 * `supabase.auth.onAuthStateChange`. Inserting the `profiles` row that
 * finishes onboarding is NOT an auth event — no token is issued, no user
 * changes, nothing in the auth store moves — so after a successful
 * `createProfile` nothing whatsoever told the session to look again. The
 * claim-handle screen deliberately does not navigate (the root layout is
 * the single authority on which screen is correct), so the app sat on
 * "Klaar" until Supabase happened to fire a scheduled token refresh. That
 * is the ~30 second wait the owner reported. `useSession` has exposed a
 * `refresh()` for precisely this since it was written and NOTHING EVER
 * CALLED IT: a consumer with no producer, the third of its kind here after
 * `Meal.recipeId` and `OutcomeCard.onSendRecipe`.
 *
 * WHY A MODULE-SCOPED CHANNEL RATHER THAN A `refresh()` ON ONE HOOK.
 * `useSession()` is a hook, so every caller holds its own state — the root
 * layout's `AuthGate` holds one, the tab bar another, Mijn recepten a
 * third. A `refresh()` obtained on the claim-handle screen would re-resolve
 * that screen's private copy and leave the one that decides which screen
 * you are on exactly where it was. The authority has to hear the news, and
 * it is not an ancestor of the screen that has it. One number and one
 * listener set, the same shape `useUnseenSendCount` uses next door for the
 * same reason: two siblings, no shared ancestor, and no store in this app.
 *
 * IT CARRIES NO DATA, AND MUST NOT. This is a request to look, not a
 * session: whoever hears it does its own reading. There is therefore no
 * snapshot here to go stale, and no second copy of the identity that could
 * disagree with the one `resolveSessionState` builds.
 *
 * THE TOKEN IS WHAT MAKES IT WORK IN REACT. A bare "something happened"
 * callback cannot re-run an effect; a changing number can. `useSession`
 * seeds its attempt counter from `getSessionRevalidationToken()` and keys
 * its resolve effect on it, so a request that lands between mount and
 * subscribe is still visible rather than lost.
 */

/** Monotonic. Never reset, including in tests — assert on movement, not on a value. */
let revalidationToken = 0;

const listeners = new Set<(token: number) => void>();

/** The value a re-resolving consumer keys its effect on. Changes on every request, never backwards. */
export function getSessionRevalidationToken(): number {
  return revalidationToken;
}

/**
 * Hear every future "look again". Returns its own unsubscribe, so a React
 * effect can return it directly.
 */
export function subscribeToSessionRevalidation(listener: (token: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Tell every open session to resolve itself again.
 *
 * Called after a write that changes what `resolveSessionState` would say
 * but that Supabase does not report — today that is exactly one thing, the
 * profile insert in `claimProfile`. It is deliberately not called on every
 * write to `profiles`: a display-name edit changes nothing the session
 * state is derived from, and a re-resolve that answers no question is two
 * network reads nobody asked for.
 */
export function requestSessionRevalidation(): void {
  revalidationToken += 1;
  for (const listener of listeners) {
    listener(revalidationToken);
  }
}

/**
 * The last step of onboarding, composed: write the profile, then tell the
 * app the answer to "who is this" has changed.
 *
 * WHY THIS IS A MODULE AND NOT TWO LINES IN THE SCREEN. Both halves already
 * existed and were correct on their own — `createProfile` inserted the row,
 * `useSession.refresh()` re-resolved the identity — and the app still hung
 * for about thirty seconds after a successful claim, because nothing joined
 * them. `refresh` had no call site anywhere. The join could not be tested
 * where it belonged either: src/app/claim-handle.tsx is a route module, and
 * a route module cannot be imported under Vite at all. So the join lives
 * here, exactly as `friendProof.ts` and `sendRecipe.ts` lifted their own
 * missing wiring out of screens for the same reason, and
 * tests/claimProfile.test.ts asserts on it.
 *
 * WHAT IT DOES NOT DO, and every one of these is deliberate:
 *
 * - **It does not navigate.** The root layout's `AuthGate` is the single
 *   authority on which screen is correct (PD-012); a push from the claim
 *   screen would be a second, racing authority. The re-resolve is what
 *   moves the app on, and it moves it on wherever the reader happens to be.
 * - **It does not validate.** `parseHandle` mirrors the database's CHECK
 *   constraint once already, and a second opinion here would be a second
 *   place for that mirror to drift.
 * - **It does not classify or reword a failure.** The result is returned
 *   exactly as `createProfile` produced it; the screen owns the Dutch and
 *   the announcement.
 * - **It does not re-read the profile it just wrote.** Whoever hears the
 *   revalidation does its own reading, which is the only way the root
 *   layout's copy of the session — a sibling of this screen, not an
 *   ancestor — ends up holding it.
 *
 * THE WRITER IS A PARAMETER RATHER THAN AN IMPORT, for the reason
 * `sendRecipe.ts` narrows its repository to a `Pick`: it keeps the module
 * importable in a test, and it keeps this file unable to do anything to
 * `profiles` beyond the one call it was handed.
 */

import type { ProfileCreationResult } from './auth';
import { requestSessionRevalidation } from './sessionRevalidation';

/** `createProfile` from ./auth, and in production nothing else. */
export type ProfileWriter = (handle: string, displayName: string) => Promise<ProfileCreationResult>;

/**
 * Claim the handle, and announce it if it lands.
 *
 * THE ORDER IS THE WHOLE FIX. The announcement is made only after the write
 * has resolved `created`, because a session that re-resolves before the row
 * exists reads `profiles`, finds nothing, and lands straight back on
 * `needs_profile` — reinstating the wait rather than removing it.
 *
 * A FAILURE ANNOUNCES NOTHING. A taken handle leaves the session precisely
 * where it was, so a re-resolve would spend two network reads to learn the
 * same thing and re-render the screen underneath the error somebody is
 * reading.
 */
export async function claimProfile(
  writeProfile: ProfileWriter,
  handle: string,
  displayName: string,
): Promise<ProfileCreationResult> {
  const result = await writeProfile(handle, displayName);
  if (result.kind === 'created') {
    // An insert into `profiles` is not an auth event, so
    // `onAuthStateChange` will never fire for it. This is the only thing
    // that tells the app to look again.
    requestSessionRevalidation();
  }
  return result;
}

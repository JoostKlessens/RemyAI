/**
 * Who the app currently is, and what that entitles them to.
 *
 * **An account is required before anything.** This reverses an earlier
 * anonymous-first decision, and the reversal is the point of this file, so
 * the reasoning is recorded here as well as in PD-012:
 *
 * - Local ids are not UUIDs (`src/lib/repository/id.ts` mints
 *   `meal-lz8k2p-3-a9f2c1`), so any recipe saved before an identity existed
 *   would need remapping the first time it synced. Requiring an account at
 *   launch means there is never local-only data to remap — every row is
 *   written under an identity from the first save.
 * - An anonymous account that is never upgraded is an orphan: the recipe
 *   library dies with the phone. The library is the valuable thing this
 *   product accumulates, so losing it silently is the worst available
 *   outcome.
 * - It deletes a whole category of states — half-upgraded users, a
 *   signed-out code path in every screen, an upgrade flow — that existed
 *   only to defer the question.
 *
 * The cost, accepted knowingly: the first launch is no longer frictionless.
 * A product whose thesis is answering one question fast now asks something
 * first. That is a real trade, not an oversight.
 *
 * WHY A PROFILE, NOT A VERIFIED EMAIL, IS THE FINISH LINE. Onboarding is
 * two steps — verify the email, then claim a handle — and a person can
 * close the app between them. `profiles` is the row every social RLS policy
 * in 0007_social.sql joins against, so a session without one is not
 * finished, however valid its token. Treating a verified email as "done"
 * would drop someone into an app whose social half silently returns
 * nothing.
 */

/**
 * Deliberately not Supabase's `Session`/`User`: this module is pure and
 * unit-tested, and must not drag a client type (or its transitive imports)
 * into the domain layer. The adapter at the edge maps one to the other.
 *
 * There is no `isAnonymous` flag any more — with accounts required there is
 * no anonymous user to distinguish.
 */
export interface SessionSnapshot {
  readonly userId: string;
}

/**
 * Only presence matters here, so this asks for the narrowest possible shape
 * rather than the full `Profile` — it keeps the rule readable and stops this
 * module from caring about fields it never reads.
 */
export interface ProfilePresence {
  readonly id: string;
}

/**
 * THE ANSWER TO "DOES THIS PERSON HAVE A PROFILE" HAS THREE VALUES, NOT TWO,
 * and collapsing it to two put a signed-in owner into an inescapable loop on
 * 6 September 2026.
 *
 * `readProfile` used to return `ProfilePresence | null`, and produced that
 * `null` from `if (error !== null || data === null)` — one branch for two
 * unrelated facts. "There is no row" is the ordinary state between verifying
 * an email and claiming a handle. "I could not find out" is a dropped
 * connection, an expired token, an RLS refusal, a PostgREST hiccup. Reported
 * as the same value, the second becomes the first, and the app sends
 * somebody who already has a profile to `claim-handle` — a full-screen modal
 * with `gestureEnabled: false`, so there is no way back out of it.
 *
 * Naming the third case is the fix. A caller that must branch on it can no
 * longer forget it exists, because there is no `null` left to fall into.
 */
export type ProfileLookup =
  | { readonly kind: 'present'; readonly profile: ProfilePresence }
  | { readonly kind: 'absent' }
  | { readonly kind: 'unreadable' };

export type SessionState = 'signed_out' | 'needs_profile' | 'profile_unreadable' | 'ready';

export interface SessionCapability {
  readonly canUseApp: boolean;
  readonly needsSignIn: boolean;
  readonly needsHandle: boolean;
  /**
   * The state whose honest move is to look again rather than to route. No
   * screen is correct for "I do not know who you are yet", so this is the
   * one flag that asks its caller to leave the navigation stack alone.
   */
  readonly needsRetry: boolean;
}

export type ProfileCreationFailure =
  | 'handle_taken'
  | 'invalid_handle'
  /**
   * NOT AN ERROR THE PERSON CAUSED, AND NOT ONE THEY CAN FIX BY RENAMING.
   * `profiles.id` is a primary key referencing `auth.users` (0007:127), so
   * one account gets one profile. A second insert by somebody who already
   * has one violates the PRIMARY KEY, not the handle's unique index — and
   * both raise Postgres 23505. Classified on the code alone, that made every
   * name this person tried report "die naam is al bezet", including names
   * nobody holds.
   *
   * It means onboarding is already finished, so the repair is to look at
   * `profiles` again rather than to show a message.
   */
  | 'profile_exists'
  | 'unknown_error';

/** Postgres unique violation. WHICH unique constraint decides the meaning — see `classifyProfileCreationFailure`. */
const UNIQUE_VIOLATION = '23505';
/** Postgres check violation — the handle failed `^[a-z0-9_]{3,30}$` server-side. */
const CHECK_VIOLATION = '23514';

export interface ResolveSessionStateInput {
  readonly session: SessionSnapshot | null;
  readonly profile: ProfileLookup;
}

/**
 * A cached profile never outranks a missing session: without a token there
 * is no `auth.uid()`, so every read would come back empty anyway. Reporting
 * `ready` there would promise a capability the database will refuse.
 *
 * AN UNREADABLE PROFILE IS NOT AN ABSENT ONE. It gets its own state so the
 * root layout can hold still instead of routing on a guess; `ProfileLookup`
 * records what that guess cost.
 */
export function resolveSessionState(input: ResolveSessionStateInput): SessionState {
  if (input.session === null) {
    return 'signed_out';
  }
  switch (input.profile.kind) {
    case 'present':
      return 'ready';
    case 'absent':
      return 'needs_profile';
    case 'unreadable':
      return 'profile_unreadable';
  }
}

/**
 * A read that failed must not demote a profile we have already seen.
 *
 * WHY THIS IS A RULE AND NOT AN `??`. `resolveSessionState` is pure and gets
 * one lookup at a time, so it cannot know that the previous answer was
 * better than this one. Without this, a single failed re-read — the app
 * coming back from the background onto a flaky connection is the ordinary
 * way to get one — moves a finished account from `ready` to
 * `profile_unreadable`, which unmounts whatever the person was doing.
 *
 * ONLY `present` SURVIVES, and the asymmetry is deliberate. A known profile
 * is a fact that does not stop being true because the network dropped. A
 * known ABSENCE is not: it is the state the person is actively trying to
 * leave by claiming a handle, so holding on to it would keep somebody on
 * the claim screen after the insert that took them off it. When we cannot
 * read, "I do not know" is the honest answer everywhere except over a
 * profile we have already held in our hands.
 *
 * The staleness this accepts, stated: a profile deleted server-side keeps
 * reading as `present` until some later read succeeds and says `absent`.
 * That is a rare administrative act, and its cost is one screen too many
 * for a moment — against a trap with no way out, which is what the
 * alternative shipped.
 */
export function preferReadableProfile<T extends ProfileLookup>(previous: T, next: T): T {
  if (next.kind === 'unreadable' && previous.kind === 'present') {
    return previous;
  }
  return next;
}

/**
 * Exactly one of the three flags is the "what happens next" for each state,
 * which is what lets the root layout choose a screen without re-deriving
 * the rule — and what makes a screen quietly reintroducing a signed-out
 * path a test failure rather than a discovery in production.
 */
export function describeSessionCapability(state: SessionState): SessionCapability {
  return {
    canUseApp: state === 'ready',
    needsSignIn: state === 'signed_out',
    needsHandle: state === 'needs_profile',
    needsRetry: state === 'profile_unreadable',
  };
}

function readErrorField(error: unknown, field: 'code' | 'message' | 'details'): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const value = (error as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : null;
}

function readErrorCode(error: unknown): string | null {
  return readErrorField(error, 'code');
}

/**
 * WHICH unique constraint a 23505 came from, read out of the two places
 * PostgREST puts it. Postgres writes the constraint name into `message`
 * ("duplicate key value violates unique constraint \"profiles_pkey\"") and
 * the offending column into `details` ("Key (handle)=(joost) already
 * exists."). Both are matched, because either one alone is a single point
 * of failure for a distinction that decides whether somebody is shown an
 * error or quietly let into the app.
 *
 * `profiles` has exactly two unique constraints and they mean opposite
 * things — the primary key on `id` means "you are already finished", the
 * unique index on `handle` means "pick another name" — so the two are
 * matched by name rather than inferred from each other.
 */
function classifyUniqueViolation(error: unknown): ProfileCreationFailure {
  const haystack = `${readErrorField(error, 'message') ?? ''} ${readErrorField(error, 'details') ?? ''}`;
  if (/profiles_pkey|key \(id\)=/i.test(haystack)) {
    return 'profile_exists';
  }
  if (/profiles_handle_key|key \(handle\)=/i.test(haystack)) {
    return 'handle_taken';
  }
  // DELIBERATELY NOT `handle_taken`, which is what this returned before and
  // is the more tempting default because it is the common case. An
  // unrecognised 23505 that is really a `profile_exists` becomes a trap: the
  // person renames themselves forever and every name fails, because nothing
  // they type can satisfy a primary key they already occupy. The same
  // mistake in the other direction is escapable — somebody told "probeer het
  // opnieuw" about a genuinely taken handle tries another name and gets in.
  // Between two wrong answers, take the one with a way out.
  return 'unknown_error';
}

/**
 * Claiming a handle races against every other user, so a collision is a
 * normal outcome deserving a specific, calm message — not a thrown error.
 * Anything we do not recognise stays `unknown_error` rather than being
 * guessed at: telling someone their handle is taken when the real problem
 * was a dropped connection sends them off renaming themselves for nothing.
 */
export function classifyProfileCreationFailure(error: unknown): ProfileCreationFailure {
  switch (readErrorCode(error)) {
    case UNIQUE_VIOLATION:
      return classifyUniqueViolation(error);
    case CHECK_VIOLATION:
      return 'invalid_handle';
    default:
      return 'unknown_error';
  }
}

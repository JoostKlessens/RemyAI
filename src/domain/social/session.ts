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

export type SessionState = 'signed_out' | 'needs_profile' | 'ready';

export interface SessionCapability {
  readonly canUseApp: boolean;
  readonly needsSignIn: boolean;
  readonly needsHandle: boolean;
}

export type ProfileCreationFailure = 'handle_taken' | 'invalid_handle' | 'unknown_error';

/** Postgres unique violation — someone already holds this handle. */
const UNIQUE_VIOLATION = '23505';
/** Postgres check violation — the handle failed `^[a-z0-9_]{3,30}$` server-side. */
const CHECK_VIOLATION = '23514';

export interface ResolveSessionStateInput {
  readonly session: SessionSnapshot | null;
  readonly profile: ProfilePresence | null;
}

/**
 * A cached profile never outranks a missing session: without a token there
 * is no `auth.uid()`, so every read would come back empty anyway. Reporting
 * `ready` there would promise a capability the database will refuse.
 */
export function resolveSessionState(input: ResolveSessionStateInput): SessionState {
  if (input.session === null) {
    return 'signed_out';
  }
  return input.profile === null ? 'needs_profile' : 'ready';
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
  };
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === 'string' ? code : null;
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
      return 'handle_taken';
    case CHECK_VIOLATION:
      return 'invalid_handle';
    default:
      return 'unknown_error';
  }
}

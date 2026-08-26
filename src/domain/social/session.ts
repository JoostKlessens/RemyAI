/**
 * Who the app currently is, and what that entitles them to.
 *
 * The owner's two product decisions drive every line here:
 *
 * 1. **Anonymous account, upgrade later.** A device signs in anonymously on
 *    first launch, which costs the user nothing and buys the app an
 *    `auth.uid()` — the thing every social RLS policy in 0007_social.sql is
 *    written against. An email is attached only when someone actually wants
 *    friends.
 * 2. **Identity gates friends and nothing else.** Kiezen, Bibliotheek,
 *    import and cook mode work with no account at all, exactly as they did
 *    before auth existed.
 *
 * The second decision is why `signed_out` is modelled as an ORDINARY,
 * PERMANENT state rather than an error. Anonymous sign-in can be switched
 * off at the project level, the device can be offline, and a token can fail
 * to refresh — in all three the honest answer is "no identity today", and
 * the app must carry on. Nothing in this module returns an error type for
 * that case, precisely so no caller is tempted to render one.
 *
 * WHY A PROFILE, NOT AN EMAIL, IS THE LINE. Upgrading is two steps — attach
 * an email, then claim a handle — and a person can close the app between
 * them. `profiles` is the row every social policy joins against, so a
 * session holding an email but no profile still cannot participate. Reading
 * the email would put the boundary in the wrong place and grant access to a
 * half-finished upgrade.
 */

/**
 * Deliberately not Supabase's `Session`/`User`: this module is pure and
 * unit-tested, and must not drag a client type (or its transitive imports)
 * into the domain layer. The adapter at the edge maps one to the other.
 */
export interface SessionSnapshot {
  readonly userId: string;
  readonly isAnonymous: boolean;
}

/**
 * Only presence matters here, so this asks for the narrowest possible shape
 * rather than the full `Profile` — it keeps the rule readable and stops this
 * module from caring about fields it never reads.
 */
export interface ProfilePresence {
  readonly id: string;
}

export type SessionState = 'signed_out' | 'anonymous' | 'identified';

export interface SessionCapability {
  /** Always true. Stated explicitly so the guarantee is testable rather than implied by the absence of a check. */
  readonly canUseCoreApp: boolean;
  readonly canUseFriends: boolean;
  readonly canUpgrade: boolean;
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
 * is no `auth.uid()`, so every social read would come back empty anyway.
 * Reporting `identified` there would promise a capability the database will
 * refuse.
 */
export function resolveSessionState(input: ResolveSessionStateInput): SessionState {
  if (input.session === null) {
    return 'signed_out';
  }
  return input.profile === null ? 'anonymous' : 'identified';
}

export function describeSessionCapability(state: SessionState): SessionCapability {
  return {
    canUseCoreApp: true,
    canUseFriends: state === 'identified',
    // Signed out means no session was ever obtained, so there is nothing to
    // attach an email to. The recovery there is signing in, not upgrading —
    // offering "upgrade" would send the user down a path that cannot start.
    canUpgrade: state === 'anonymous',
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

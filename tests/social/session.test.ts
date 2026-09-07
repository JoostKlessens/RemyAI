import { describe, expect, test } from 'vitest';
import {
  classifyProfileCreationFailure,
  describeSessionCapability,
  preferReadableProfile,
  resolveSessionState,
  type ProfileLookup,
} from '@/domain/social/session';

const ANY_SESSION = { userId: 'auth-user-1' } as const;
const PROFILE = { id: 'p-1', handle: 'joost', displayName: 'Joost', avatarUrl: null } as const;
// Annotated, and the assertions below name the type argument explicitly:
// TypeScript narrows an annotated `const` to the variant it was assigned,
// which would otherwise pin `preferReadableProfile`'s T to one member and
// make the cross-variant cases unwritable.
const PRESENT: ProfileLookup = { kind: 'present', profile: PROFILE };
const ABSENT: ProfileLookup = { kind: 'absent' };
const UNREADABLE: ProfileLookup = { kind: 'unreadable' };

describe('resolveSessionState', () => {
  test('no session is signed_out — the sign-in screen is the whole app until this changes', () => {
    expect(resolveSessionState({ session: null, profile: ABSENT })).toBe('signed_out');
  });

  /**
   * Onboarding is two steps and can be interrupted between them: the email
   * is verified, then a handle is claimed. profiles is the row every social
   * RLS policy joins against, so a session without one is not finished.
   */
  test('a session without a profile is needs_profile, not ready', () => {
    expect(resolveSessionState({ session: ANY_SESSION, profile: ABSENT })).toBe('needs_profile');
  });

  test('a session with a profile is ready', () => {
    expect(resolveSessionState({ session: ANY_SESSION, profile: PRESENT })).toBe('ready');
  });

  test('a cached profile never outranks a missing session', () => {
    expect(resolveSessionState({ session: null, profile: PRESENT })).toBe('signed_out');
  });

  /**
   * THE REGRESSION THIS FILE EXISTS FOR SINCE 6 SEPTEMBER 2026. readProfile
   * used to answer `null` for both "no row" and "the read failed", so a
   * dropped connection was indistinguishable from an unfinished account and
   * sent a signed-in owner to claim-handle — a full-screen modal with
   * gestureEnabled false, whose only exit is an insert that a primary key
   * makes impossible. An unreadable profile must never report needs_profile.
   */
  test('an unreadable profile is its own state, never needs_profile', () => {
    expect(resolveSessionState({ session: ANY_SESSION, profile: UNREADABLE })).toBe('profile_unreadable');
  });

  test('an unreadable profile still loses to a missing session', () => {
    expect(resolveSessionState({ session: null, profile: UNREADABLE })).toBe('signed_out');
  });
});

describe('preferReadableProfile', () => {
  test('a failed re-read keeps a profile we have already seen', () => {
    expect(preferReadableProfile<ProfileLookup>(PRESENT, UNREADABLE)).toBe(PRESENT);
  });

  /**
   * The asymmetry is the point. A known absence is the state somebody is
   * actively trying to leave by claiming a handle, so holding on to it would
   * keep them on the claim screen after the insert that should have freed
   * them. Only a profile we have actually held survives a failed read.
   */
  test('a failed re-read does NOT keep a known absence', () => {
    expect(preferReadableProfile<ProfileLookup>(ABSENT, UNREADABLE)).toBe(UNREADABLE);
  });

  test('a successful read always wins, in both directions', () => {
    expect(preferReadableProfile<ProfileLookup>(UNREADABLE, PRESENT)).toBe(PRESENT);
    expect(preferReadableProfile<ProfileLookup>(PRESENT, ABSENT)).toBe(ABSENT);
    expect(preferReadableProfile<ProfileLookup>(ABSENT, PRESENT)).toBe(PRESENT);
  });
});

describe('describeSessionCapability', () => {
  test('only a ready session may use the app or its friend surfaces', () => {
    expect(describeSessionCapability('ready').canUseApp).toBe(true);
    expect(describeSessionCapability('needs_profile').canUseApp).toBe(false);
    expect(describeSessionCapability('signed_out').canUseApp).toBe(false);
  });

  /**
   * The owner reversed the earlier anonymous-first decision: an account is
   * now required before anything. This is the test that would fail if some
   * screen quietly reintroduced a signed-out path.
   */
  test('nothing is usable signed out — an account is required at launch', () => {
    const capability = describeSessionCapability('signed_out');
    expect(capability.canUseApp).toBe(false);
    expect(capability.needsSignIn).toBe(true);
  });

  test('a handle is asked for exactly once, when there is a session but no profile', () => {
    expect(describeSessionCapability('needs_profile').needsHandle).toBe(true);
    expect(describeSessionCapability('ready').needsHandle).toBe(false);
    expect(describeSessionCapability('signed_out').needsHandle).toBe(false);
  });

  /**
   * No screen is correct for "I do not know who you are yet", so every
   * routing flag is false and the root layout is asked to hold still. This
   * is the test that fails if somebody makes an unreadable profile route
   * anywhere — which is the shape of the bug it replaced.
   */
  test('an unreadable profile routes nowhere and asks to be retried', () => {
    const capability = describeSessionCapability('profile_unreadable');
    expect(capability.needsRetry).toBe(true);
    expect(capability.canUseApp).toBe(false);
    expect(capability.needsSignIn).toBe(false);
    expect(capability.needsHandle).toBe(false);
  });

  test('no other state asks to be retried', () => {
    expect(describeSessionCapability('ready').needsRetry).toBe(false);
    expect(describeSessionCapability('needs_profile').needsRetry).toBe(false);
    expect(describeSessionCapability('signed_out').needsRetry).toBe(false);
  });
});

describe('classifyProfileCreationFailure', () => {
  /**
   * `profiles` HAS TWO UNIQUE CONSTRAINTS AND THEY MEAN OPPOSITE THINGS.
   * The unique index on `handle` means "pick another name"; the primary key
   * on `id` means "you are already finished". Both raise 23505, and this
   * function used to answer `handle_taken` for the code alone — which on
   * 6 September 2026 told the owner that every name he tried was taken,
   * including names nobody held, with no way off the screen.
   */
  test('a handle collision is handle_taken — named by constraint, not by code', () => {
    expect(
      classifyProfileCreationFailure({
        code: '23505',
        message: 'duplicate key value violates unique constraint "profiles_handle_key"',
        details: 'Key (handle)=(joost) already exists.',
      }),
    ).toBe('handle_taken');
  });

  test('a primary-key collision is profile_exists, never handle_taken', () => {
    expect(
      classifyProfileCreationFailure({
        code: '23505',
        message: 'duplicate key value violates unique constraint "profiles_pkey"',
        details: 'Key (id)=(00000000-0000-0000-0000-000000000000) already exists.',
      }),
    ).toBe('profile_exists');
  });

  /** Either field alone identifies the constraint, so neither is a single point of failure. */
  test('reads the constraint from message or from details', () => {
    expect(classifyProfileCreationFailure({ code: '23505', message: '... "profiles_pkey"' })).toBe('profile_exists');
    expect(classifyProfileCreationFailure({ code: '23505', details: 'Key (id)=(x) already exists.' })).toBe(
      'profile_exists',
    );
    expect(classifyProfileCreationFailure({ code: '23505', details: 'Key (handle)=(x) already exists.' })).toBe(
      'handle_taken',
    );
  });

  /**
   * Deliberately NOT handle_taken, which is the tempting default because it
   * is the common case. An unrecognised 23505 that is really profile_exists
   * is a trap with no exit: nothing the person types can satisfy a primary
   * key they already occupy. The same mistake the other way is escapable —
   * somebody told to try again about a genuinely taken handle picks another
   * name and gets in. Between two wrong answers, take the one with a door.
   */
  test('an unattributable unique violation is unknown_error, not a guess', () => {
    expect(classifyProfileCreationFailure({ code: '23505' })).toBe('unknown_error');
    expect(classifyProfileCreationFailure({ code: '23505', message: 'something else entirely' })).toBe('unknown_error');
  });

  test('maps a check violation to invalid_handle — the database is the last word on the format', () => {
    expect(classifyProfileCreationFailure({ code: '23514' })).toBe('invalid_handle');
  });

  test('anything unrecognized is unknown_error rather than a guess', () => {
    expect(classifyProfileCreationFailure({ code: '42501' })).toBe('unknown_error');
    expect(classifyProfileCreationFailure({ code: '08006' })).toBe('unknown_error');
    expect(classifyProfileCreationFailure({})).toBe('unknown_error');
    expect(classifyProfileCreationFailure(null)).toBe('unknown_error');
    expect(classifyProfileCreationFailure('boom')).toBe('unknown_error');
  });
});

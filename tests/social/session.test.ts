import { describe, expect, test } from 'vitest';
import {
  classifyProfileCreationFailure,
  describeSessionCapability,
  resolveSessionState,
} from '@/domain/social/session';

const ANY_SESSION = { userId: 'auth-user-1' } as const;
const PROFILE = { id: 'p-1', handle: 'joost', displayName: 'Joost', avatarUrl: null } as const;

describe('resolveSessionState', () => {
  test('no session is signed_out — the sign-in screen is the whole app until this changes', () => {
    expect(resolveSessionState({ session: null, profile: null })).toBe('signed_out');
  });

  /**
   * Onboarding is two steps and can be interrupted between them: the email
   * is verified, then a handle is claimed. profiles is the row every social
   * RLS policy joins against, so a session without one is not finished.
   */
  test('a session without a profile is needs_profile, not ready', () => {
    expect(resolveSessionState({ session: ANY_SESSION, profile: null })).toBe('needs_profile');
  });

  test('a session with a profile is ready', () => {
    expect(resolveSessionState({ session: ANY_SESSION, profile: PROFILE })).toBe('ready');
  });

  test('a cached profile never outranks a missing session', () => {
    expect(resolveSessionState({ session: null, profile: PROFILE })).toBe('signed_out');
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
});

describe('classifyProfileCreationFailure', () => {
  /** A taken handle is an ordinary outcome of a race for a scarce name, not a crash. */
  test('maps a unique violation to handle_taken', () => {
    expect(classifyProfileCreationFailure({ code: '23505' })).toBe('handle_taken');
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

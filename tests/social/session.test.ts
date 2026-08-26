import { describe, expect, test } from 'vitest';
import {
  classifyProfileCreationFailure,
  describeSessionCapability,
  resolveSessionState,
} from '@/domain/social/session';

const ANY_SESSION = { userId: 'auth-user-1', isAnonymous: true } as const;
const IDENTIFIED_SESSION = { userId: 'auth-user-1', isAnonymous: false } as const;
const PROFILE = { id: 'p-1', handle: 'joost', displayName: 'Joost', avatarUrl: null } as const;

describe('resolveSessionState', () => {
  test('no session at all is signed_out — the normal state when anonymous sign-in is disabled or the device is offline', () => {
    expect(resolveSessionState({ session: null, profile: null })).toBe('signed_out');
  });

  test('a session without a profile is anonymous — there is an auth.uid(), but nobody to be a friend of yet', () => {
    expect(resolveSessionState({ session: ANY_SESSION, profile: null })).toBe('anonymous');
  });

  test('a session with a profile is identified', () => {
    expect(resolveSessionState({ session: ANY_SESSION, profile: PROFILE })).toBe('identified');
  });

  /**
   * The upgrade is two steps — attach an email, then claim a handle — and it
   * can be interrupted between them. Having an email is NOT what unlocks
   * friends; having a profile is, because that is the row every social RLS
   * policy joins against.
   */
  test('an email-bearing session with no profile is still anonymous, not identified', () => {
    expect(resolveSessionState({ session: IDENTIFIED_SESSION, profile: null })).toBe('anonymous');
  });

  test('a profile without a session is signed_out — a stale cached profile never grants access', () => {
    expect(resolveSessionState({ session: null, profile: PROFILE })).toBe('signed_out');
  });
});

describe('describeSessionCapability', () => {
  test('only an identified session may use the friend surfaces', () => {
    expect(describeSessionCapability('identified').canUseFriends).toBe(true);
    expect(describeSessionCapability('anonymous').canUseFriends).toBe(false);
    expect(describeSessionCapability('signed_out').canUseFriends).toBe(false);
  });

  /**
   * Deciding, saving and cooking never depend on identity. This is the
   * owner's explicit product decision and the reason a failed sign-in is
   * survivable rather than fatal, so it is pinned here rather than left to
   * whichever screen remembers to check.
   */
  test('every state may still decide, browse and cook — identity never gates the daily path', () => {
    for (const state of ['signed_out', 'anonymous', 'identified'] as const) {
      expect(describeSessionCapability(state).canUseCoreApp).toBe(true);
    }
  });

  test('an upgrade is offered exactly when there is something to upgrade to', () => {
    expect(describeSessionCapability('anonymous').canUpgrade).toBe(true);
    expect(describeSessionCapability('identified').canUpgrade).toBe(false);
    // Signed out means we never got a session at all, so there is nothing to
    // attach an email to yet — the retry is sign-in, not upgrade.
    expect(describeSessionCapability('signed_out').canUpgrade).toBe(false);
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

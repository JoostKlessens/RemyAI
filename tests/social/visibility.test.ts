import { describe, expect, test } from 'vitest';
import {
  DEFAULT_MEAL_VISIBILITY,
  isMealSharedWithFriend,
  isSharedWithFriends,
  resolveMealVisibility,
} from '@/domain/social/visibility';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeFriendship, makeSharedMeal } from './fixtures';

const ACCEPTED = [makeFriendship({ requesterId: PROFILE_A, addresseeId: PROFILE_B, status: 'accepted' })];

describe('DEFAULT_MEAL_VISIBILITY', () => {
  /** PD-010 point 3: "Sharing is an act, never a default." Same value as the column default in 0007_social.sql. */
  test('is private', () => {
    expect(DEFAULT_MEAL_VISIBILITY).toBe('private');
  });
});

describe('resolveMealVisibility', () => {
  test('passes through the two values the column can hold', () => {
    expect(resolveMealVisibility('private')).toBe('private');
    expect(resolveMealVisibility('friends')).toBe('friends');
  });

  /** A row written before the column existed says nothing about consent to share, so it must read as private. */
  test('reads a missing value as private, never as shared', () => {
    expect(resolveMealVisibility(undefined)).toBe('private');
    expect(resolveMealVisibility(null)).toBe('private');
  });

  test('fails closed on anything unrecognised rather than trusting it', () => {
    expect(resolveMealVisibility('public')).toBe('private');
    expect(resolveMealVisibility('FRIENDS')).toBe('private');
    expect(resolveMealVisibility(1)).toBe('private');
    expect(resolveMealVisibility({ visibility: 'friends' })).toBe('private');
  });

  test('never widens to anything outside the stored vocabulary', () => {
    for (const raw of ['private', 'friends', 'anything else', 0, null]) {
      expect(['private', 'friends']).toContain(resolveMealVisibility(raw));
    }
  });
});

describe('isSharedWithFriends', () => {
  test('only "friends" counts as shared', () => {
    expect(isSharedWithFriends('friends')).toBe(true);
    expect(isSharedWithFriends('private')).toBe(false);
  });
});

describe('isMealSharedWithFriend — the in-memory mirror of is_meal_shared_with_me', () => {
  test('a friends-visible meal is readable by an accepted friend of one of its owners', () => {
    expect(isMealSharedWithFriend(makeSharedMeal(), PROFILE_B, ACCEPTED)).toBe(true);
  });

  test('a private meal is never readable, however close the friendship', () => {
    expect(isMealSharedWithFriend(makeSharedMeal({ visibility: 'private' }), PROFILE_B, ACCEPTED)).toBe(false);
  });

  test('a stranger cannot read a shared meal', () => {
    expect(isMealSharedWithFriend(makeSharedMeal(), PROFILE_C, ACCEPTED)).toBe(false);
  });

  test('a pending request is not yet a friendship', () => {
    const pending = [makeFriendship({ status: 'pending' })];
    expect(isMealSharedWithFriend(makeSharedMeal(), PROFILE_B, pending)).toBe(false);
  });

  test('a block removes access that an earlier acceptance had granted', () => {
    const blocked = [makeFriendship({ status: 'blocked', blockedBy: PROFILE_A })];
    expect(isMealSharedWithFriend(makeSharedMeal(), PROFILE_B, blocked)).toBe(false);
  });

  /** Mirrors `m.archived_at is null` in the SQL predicate: archiving a meal takes it off the friend surface too. */
  test('an archived meal is not shared, even while marked friends-visible', () => {
    const archived = makeSharedMeal({ archivedAt: '2026-03-01T00:00:00.000Z' });
    expect(isMealSharedWithFriend(archived, PROFILE_B, ACCEPTED)).toBe(false);
  });

  test('any one befriended owner is enough — a household can have several members with accounts', () => {
    const meal = makeSharedMeal({ ownerProfileIds: [PROFILE_C, PROFILE_A] });
    expect(isMealSharedWithFriend(meal, PROFILE_B, ACCEPTED)).toBe(true);
  });

  test('a meal whose household has no linked accounts is shared with nobody', () => {
    const meal = makeSharedMeal({ ownerProfileIds: [] });
    expect(isMealSharedWithFriend(meal, PROFILE_B, ACCEPTED)).toBe(false);
  });

  /**
   * This function answers the friend-surface question only. An owner sees
   * their own meal through household membership (is_household_member in
   * 0001_init.sql), which is a different policy and a different question.
   */
  test('an owner is not their own friend, so this says false for their own meal', () => {
    expect(isMealSharedWithFriend(makeSharedMeal(), PROFILE_A, ACCEPTED)).toBe(false);
  });

  test('no friendships at all means nothing is shared', () => {
    expect(isMealSharedWithFriend(makeSharedMeal(), PROFILE_B, [])).toBe(false);
  });
});

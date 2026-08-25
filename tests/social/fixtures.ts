/**
 * Test data builders for the social layer (Fase 5a).
 *
 * Same contract as tests/fixtures.ts: every `makeX` returns a fully
 * populated, valid `X` with boring defaults, overridable via a partial, so
 * a test only states the fields the behaviour under test actually depends
 * on. Nothing is shared mutable state — every call returns a fresh object.
 *
 * The profile ids below are deliberately written as canonical lowercase
 * uuids rather than the `profile-1` shorthand the rest of the suite uses
 * for local ids: ordered-pair normalisation (friendship.ts) is defined
 * against exactly that spelling, and a fixture that never looks like a
 * real id would hide an ordering bug instead of exposing one.
 */

import type { Friendship, Profile, RecipeRating, SharedMeal } from '@/domain/social/types';

const DEFAULT_CREATED_AT = '2026-01-01T00:00:00.000Z';

/** Deliberately NOT in ascending order relative to each other — see the header. */
export const PROFILE_A = '11111111-1111-4111-8111-111111111111';
export const PROFILE_B = '22222222-2222-4222-8222-222222222222';
export const PROFILE_C = '33333333-3333-4333-8333-333333333333';

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: PROFILE_A,
    handle: 'joost',
    displayName: 'Joost',
    avatarUrl: null,
    createdAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

export function makeFriendship(overrides: Partial<Friendship> = {}): Friendship {
  return {
    id: 'friendship-1',
    requesterId: PROFILE_A,
    addresseeId: PROFILE_B,
    status: 'accepted',
    blockedBy: null,
    createdAt: DEFAULT_CREATED_AT,
    respondedAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

export function makeRecipeRating(overrides: Partial<RecipeRating> = {}): RecipeRating {
  return {
    id: 'recipe-rating-1',
    recipeId: 'recipe-1',
    raterProfileId: PROFILE_A,
    rating: 4,
    ratedAt: DEFAULT_CREATED_AT,
    ...overrides,
  };
}

export function makeSharedMeal(overrides: Partial<SharedMeal> = {}): SharedMeal {
  return {
    mealId: 'meal-1',
    visibility: 'friends',
    ownerProfileIds: [PROFILE_A],
    archivedAt: null,
    ...overrides,
  };
}

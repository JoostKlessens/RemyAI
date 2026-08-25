import { beforeEach, describe, expect, test } from 'vitest';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalSocialRepository } from '@/lib/repository/social/localSocialRepository';
import type { RemySocialRepository } from '@/lib/repository/social/types';
import { PROFILE_A, PROFILE_B, PROFILE_C } from '../social/fixtures';

/**
 * The in-memory half of Fase 5a's social seam. These tests are about the
 * repository keeping the promises the SCHEMA makes — unique handles, one
 * friendship row per pair, one rating per person per recipe, and no
 * illegal state transition — because those are exactly the guarantees a
 * local store has no constraints to lean on and therefore has to
 * implement itself.
 */

let store: KeyValueStore;
let repository: RemySocialRepository;

beforeEach(() => {
  store = createInMemoryKeyValueStore();
  repository = createLocalSocialRepository(store);
});

async function seedProfiles(): Promise<void> {
  await repository.upsertProfile({ id: PROFILE_A, handle: 'joost', displayName: 'Joost', avatarUrl: null });
  await repository.upsertProfile({ id: PROFILE_B, handle: 'sanne', displayName: 'Sanne', avatarUrl: null });
}

describe('profiles', () => {
  test('stores a profile under its normalized handle', async () => {
    const profile = await repository.upsertProfile({
      id: PROFILE_A,
      handle: '  @Joost ',
      displayName: 'Joost',
      avatarUrl: null,
    });
    expect(profile.handle).toBe('joost');
    expect(await repository.getProfile(PROFILE_A)).toEqual(profile);
  });

  test('rejects a handle the database CHECK would reject, rather than repairing it', async () => {
    await expect(
      repository.upsertProfile({ id: PROFILE_A, handle: 'jo ost', displayName: 'Joost', avatarUrl: null }),
    ).rejects.toThrow(/handle/i);
  });

  test('refuses a handle another profile already holds — the unique index, enforced here too', async () => {
    await seedProfiles();
    await expect(
      repository.upsertProfile({ id: PROFILE_C, handle: 'JOOST', displayName: 'Imposter', avatarUrl: null }),
    ).rejects.toThrow(/taken/i);
  });

  test('re-upserting the same profile updates it in place and keeps its creation time', async () => {
    const first = await repository.upsertProfile({
      id: PROFILE_A,
      handle: 'joost',
      displayName: 'Joost',
      avatarUrl: null,
    });
    const second = await repository.upsertProfile({
      id: PROFILE_A,
      handle: 'joost',
      displayName: 'Joost K',
      avatarUrl: 'https://example.test/a.jpg',
    });
    expect(second.displayName).toBe('Joost K');
    expect(second.createdAt).toBe(first.createdAt);
  });

  test('finds a profile by handle however it was typed', async () => {
    await seedProfiles();
    const found = await repository.findProfileByHandle('  @SANNE ');
    expect(found?.id).toBe(PROFILE_B);
  });

  test('returns null for an unknown profile or handle rather than throwing', async () => {
    expect(await repository.getProfile(PROFILE_C)).toBeNull();
    expect(await repository.findProfileByHandle('nobody')).toBeNull();
  });
});

describe('friendships', () => {
  beforeEach(async () => {
    await seedProfiles();
  });

  test('a request opens one pending row with the actor as requester', async () => {
    const friendship = await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    expect(friendship.status).toBe('pending');
    expect(friendship.requesterId).toBe(PROFILE_A);
    expect(friendship.addresseeId).toBe(PROFILE_B);
    expect(friendship.respondedAt).toBeNull();
  });

  test('the pair is found whichever way round it is asked for', async () => {
    const created = await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    expect((await repository.getFriendshipBetween(PROFILE_B, PROFILE_A))?.id).toBe(created.id);
  });

  test('a second request never creates a second row for the same pair', async () => {
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    await expect(repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request')).rejects.toThrow(/already_pending/);
    expect(await repository.listFriendships(PROFILE_A)).toHaveLength(1);
  });

  test('the addressee accepts, and the answer is timestamped', async () => {
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    const accepted = await repository.actOnFriendship(PROFILE_B, PROFILE_A, 'accept');
    expect(accepted.status).toBe('accepted');
    expect(accepted.respondedAt).not.toBeNull();
  });

  test('the requester cannot accept their own request', async () => {
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    await expect(repository.actOnFriendship(PROFILE_A, PROFILE_B, 'accept')).rejects.toThrow(/not_addressee/);
  });

  test('a declined pair can be re-requested by the other side, which swaps who is asking', async () => {
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    await repository.actOnFriendship(PROFILE_B, PROFILE_A, 'decline');
    const reopened = await repository.actOnFriendship(PROFILE_B, PROFILE_A, 'request');
    expect(reopened.status).toBe('pending');
    expect(reopened.requesterId).toBe(PROFILE_B);
    expect(reopened.addresseeId).toBe(PROFILE_A);
    expect(await repository.listFriendships(PROFILE_A)).toHaveLength(1);
  });

  test('a block records who blocked, and nothing moves afterwards', async () => {
    const blocked = await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'block');
    expect(blocked.status).toBe('blocked');
    expect(blocked.blockedBy).toBe(PROFILE_A);
    await expect(repository.actOnFriendship(PROFILE_B, PROFILE_A, 'request')).rejects.toThrow(/blocked/);
  });

  test('refuses to act on a pair that is the same profile twice', async () => {
    await expect(repository.actOnFriendship(PROFILE_A, PROFILE_A, 'request')).rejects.toThrow(/same profile/i);
  });

  test('lists only the rows a profile is a party to', async () => {
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    expect(await repository.listFriendships(PROFILE_C)).toHaveLength(0);
    expect(await repository.listFriendships(PROFILE_B)).toHaveLength(1);
  });

  test('either party may remove an accepted friendship — unfriending is a delete', async () => {
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    await repository.actOnFriendship(PROFILE_B, PROFILE_A, 'accept');
    await repository.removeFriendship(PROFILE_B, PROFILE_A);
    expect(await repository.getFriendshipBetween(PROFILE_A, PROFILE_B)).toBeNull();
  });

  /** Without this the block is theatre: the blocked party would delete the row and ask again. */
  test('only the blocker may remove a block', async () => {
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'block');
    await expect(repository.removeFriendship(PROFILE_B, PROFILE_A)).rejects.toThrow(/blocked/i);
    await repository.removeFriendship(PROFILE_A, PROFILE_B);
    expect(await repository.getFriendshipBetween(PROFILE_A, PROFILE_B)).toBeNull();
  });

  test('removing a pair that has no row is a no-op, not an error', async () => {
    await expect(repository.removeFriendship(PROFILE_A, PROFILE_C)).resolves.toBeUndefined();
  });
});

describe('recipe ratings', () => {
  beforeEach(async () => {
    await seedProfiles();
  });

  test('records one vote per person per recipe', async () => {
    await repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 4 });
    await repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_B, rating: 2 });
    expect(await repository.listRecipeRatings('recipe-1')).toHaveLength(2);
  });

  test('re-rating replaces the earlier vote instead of adding a second one', async () => {
    const first = await repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 4 });
    const second = await repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 1 });
    const stored = await repository.listRecipeRatings('recipe-1');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.rating).toBe(1);
    expect(second.id).toBe(first.id);
  });

  test('the same person may rate different recipes', async () => {
    await repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 4 });
    await repository.rateRecipe({ recipeId: 'recipe-2', raterProfileId: PROFILE_A, rating: 5 });
    expect(await repository.listRecipeRatings('recipe-2')).toHaveLength(1);
  });

  test('rejects an off-scale score rather than clamping it into range', async () => {
    await expect(repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 0 })).rejects.toThrow(
      /rating/i,
    );
    await expect(
      repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 4.5 }),
    ).rejects.toThrow(/rating/i);
  });

  test('a rater can withdraw their own vote, leaving everyone else untouched', async () => {
    await repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 4 });
    await repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_B, rating: 2 });
    await repository.removeRecipeRating('recipe-1', PROFILE_A);
    const remaining = await repository.listRecipeRatings('recipe-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.raterProfileId).toBe(PROFILE_B);
  });

  test('an unrated recipe lists nothing rather than failing', async () => {
    expect(await repository.listRecipeRatings('recipe-nobody-rated')).toHaveLength(0);
  });
});

describe('persistence', () => {
  test('a second repository over the same store sees what the first wrote', async () => {
    await seedProfiles();
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    const reopened = createLocalSocialRepository(store);
    expect((await reopened.getFriendshipBetween(PROFILE_A, PROFILE_B))?.status).toBe('pending');
    expect((await reopened.getProfile(PROFILE_A))?.handle).toBe('joost');
  });
});

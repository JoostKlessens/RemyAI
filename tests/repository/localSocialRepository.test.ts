import { beforeEach, describe, expect, test } from 'vitest';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalSocialRepository } from '@/lib/repository/social/localSocialRepository';
import { SEND_NOTE_MAX_LENGTH, type RemySocialRepository } from '@/lib/repository/social/types';
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
      repository.rateRecipe({ recipeId: 'recipe-1', raterProfileId: PROFILE_A, rating: 4.55 }),
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

describe('directed sends', () => {
  /**
   * The second tier — het pannetje. These tests are about the promises a
   * local store has no constraints to lean on: `unique (meal_id,
   * recipient_profile_id)`, the note CHECK, `sender <> recipient`, and the
   * one clause of 0009's insert policy this store can actually establish
   * (the recipient is a friend — there is no auth.uid() here, and meals
   * live in the other repository entirely).
   */
  const MEAL = 'meal-traybake';
  const OTHER_MEAL = 'meal-ramen';

  beforeEach(async () => {
    await seedProfiles();
    await repository.upsertProfile({ id: PROFILE_C, handle: 'joris', displayName: 'Joris', avatarUrl: null });
    await repository.actOnFriendship(PROFILE_A, PROFILE_B, 'request');
    await repository.actOnFriendship(PROFILE_B, PROFILE_A, 'accept');
    await repository.actOnFriendship(PROFILE_A, PROFILE_C, 'request');
    await repository.actOnFriendship(PROFILE_C, PROFILE_A, 'accept');
  });

  test('a send round-trips to the person it was addressed to', async () => {
    const sent = await repository.sendRecipe({
      mealId: MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: 'Dit is echt jouw ding.',
    });

    expect(sent.mealId).toBe(MEAL);
    expect(sent.senderProfileId).toBe(PROFILE_A);
    expect(sent.recipientProfileId).toBe(PROFILE_B);
    expect(sent.note).toBe('Dit is echt jouw ding.');
    expect(await repository.listSendsToMe(PROFILE_B)).toEqual([{ ...sent, seen: false }]);
  });

  /** A send is addressed. Nobody standing next to it is a party to it. */
  test('a send reaches nobody but its recipient — the sender included', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });

    expect(await repository.listSendsToMe(PROFILE_C)).toEqual([]);
    expect(await repository.listSendsToMe(PROFILE_A)).toEqual([]);
  });

  test('the note is optional, and a blank one is stored as no note at all', async () => {
    const withoutNote = await repository.sendRecipe({
      mealId: MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: null,
    });
    const blank = await repository.sendRecipe({
      mealId: OTHER_MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: '   ',
    });

    expect(withoutNote.note).toBeNull();
    expect(blank.note).toBeNull();
  });

  /** Truncating would publish words the sender did not choose, under their name. */
  test('rejects a note past the cap rather than cutting it short', async () => {
    const send = (note: string) =>
      repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note });

    await expect(send('a'.repeat(SEND_NOTE_MAX_LENGTH + 1))).rejects.toThrow(/140/);
    await expect(send('a'.repeat(SEND_NOTE_MAX_LENGTH))).resolves.toBeDefined();
    expect(await repository.listSendsToMe(PROFILE_B)).toHaveLength(1);
  });

  /** `char_length` counts characters; JS `.length` counts UTF-16 units, and an emoji is two of those. */
  test('measures a note in characters, the way the database does', async () => {
    const sent = await repository.sendRecipe({
      mealId: MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: '\u{1F958}'.repeat(SEND_NOTE_MAX_LENGTH),
    });

    expect([...(sent.note ?? '')]).toHaveLength(SEND_NOTE_MAX_LENGTH);
  });

  test('refuses to send a dish to yourself', async () => {
    await expect(
      repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_A, note: null }),
    ).rejects.toThrow(/yourself/i);
  });

  /** 0009's insert policy: sending is not a channel to strangers. */
  test('refuses a recipient who is not an accepted friend', async () => {
    await repository.actOnFriendship(PROFILE_B, PROFILE_C, 'request');

    await expect(
      repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_B, recipientProfileId: PROFILE_C, note: null }),
    ).rejects.toThrow(/friend/i);
  });

  /** `unique (meal_id, recipient_profile_id)`: the same dish to the same person is one offer. */
  test('re-sending the same dish to the same person replaces the offer instead of adding a card', async () => {
    const first = await repository.sendRecipe({
      mealId: MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: 'Eerste poging',
    });
    const second = await repository.sendRecipe({
      mealId: MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: 'Nee, deze erbij',
    });

    const waiting = await repository.listSendsToMe(PROFILE_B);
    expect(waiting).toHaveLength(1);
    expect(second.id).toBe(first.id);
    expect(waiting[0]?.note).toBe('Nee, deze erbij');
    expect(waiting[0]?.sentAt).toBe(first.sentAt);
  });

  test('the same dish may go to two different friends', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_C, note: null });

    expect(await repository.listSendsToMe(PROFILE_B)).toHaveLength(1);
    expect(await repository.listSendsToMe(PROFILE_C)).toHaveLength(1);
  });

  test('a withdrawn send disappears from the recipient list', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });
    await repository.withdrawSend(PROFILE_A, MEAL, PROFILE_B);

    expect(await repository.listSendsToMe(PROFILE_B)).toEqual([]);
  });

  /** Kept, not deleted — observable, because the re-send lands on the same row. */
  test('withdrawal keeps the row, so a re-send revives it rather than minting a new card', async () => {
    const first = await repository.sendRecipe({
      mealId: MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: null,
    });
    await repository.withdrawSend(PROFILE_A, MEAL, PROFILE_B);
    const revived = await repository.sendRecipe({
      mealId: MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: 'Toch weer',
    });

    expect(revived.id).toBe(first.id);
    expect(await repository.listSendsToMe(PROFILE_B)).toHaveLength(1);
  });

  /** Otherwise a recipient silently un-sends somebody else's gesture. */
  test('a recipient cannot withdraw the send aimed at them', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });
    await repository.withdrawSend(PROFILE_B, MEAL, PROFILE_B);

    expect(await repository.listSendsToMe(PROFILE_B)).toHaveLength(1);
  });

  test('withdrawing twice, or withdrawing nothing, is a no-op rather than an error', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });
    await repository.withdrawSend(PROFILE_A, MEAL, PROFILE_B);

    await expect(repository.withdrawSend(PROFILE_A, MEAL, PROFILE_B)).resolves.toBeUndefined();
    await expect(repository.withdrawSend(PROFILE_A, 'meal-never-sent', PROFILE_B)).resolves.toBeUndefined();
  });

  test('opening the tab marks the waiting sends seen, and doing it again changes nothing', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });

    await repository.markSendsSeen(PROFILE_B);
    const afterFirst = await repository.listSendsToMe(PROFILE_B);
    await repository.markSendsSeen(PROFILE_B);
    const afterSecond = await repository.listSendsToMe(PROFILE_B);

    expect(afterFirst[0]?.seen).toBe(true);
    expect(afterSecond).toEqual(afterFirst);
  });

  test('opening my tab says nothing about anybody else', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_C, note: null });

    await repository.markSendsSeen(PROFILE_B);

    expect((await repository.listSendsToMe(PROFILE_C))[0]?.seen).toBe(false);
  });

  test('a send that arrives after the tab was opened is unseen', async () => {
    await repository.markSendsSeen(PROFILE_B);
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });

    expect((await repository.listSendsToMe(PROFILE_B))[0]?.seen).toBe(false);
  });

  /**
   * §3.2: unseen "clears permanently on viewing, so there is no loop to
   * run". If a re-send reset it, withdraw-and-resend would be a bell the
   * sender could ring at will.
   */
  test('a re-sent card stays seen', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });
    await repository.markSendsSeen(PROFILE_B);
    await repository.withdrawSend(PROFILE_A, MEAL, PROFILE_B);
    await repository.sendRecipe({
      mealId: MEAL,
      senderProfileId: PROFILE_A,
      recipientProfileId: PROFILE_B,
      note: 'Nog eens',
    });

    expect((await repository.listSendsToMe(PROFILE_B))[0]?.seen).toBe(true);
  });

  /** Recording "seen" against a card that was never shown is a false entry. */
  test('a withdrawn send is not marked seen while it is away', async () => {
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });
    await repository.withdrawSend(PROFILE_A, MEAL, PROFILE_B);
    await repository.markSendsSeen(PROFILE_B);
    await repository.sendRecipe({ mealId: MEAL, senderProfileId: PROFILE_A, recipientProfileId: PROFILE_B, note: null });

    expect((await repository.listSendsToMe(PROFILE_B))[0]?.seen).toBe(false);
  });

  test('nobody has any sends waiting by default', async () => {
    expect(await repository.listSendsToMe(PROFILE_B)).toEqual([]);
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

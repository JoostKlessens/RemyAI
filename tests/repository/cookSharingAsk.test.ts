/**
 * "Have we already asked this household about cook proof?" at the
 * repository seam — the durable half of DESIGN-SOCIAL.md §5's
 * "offered once, contextually, when the household's first friendship is
 * accepted... the question is asked once, not campaigned".
 *
 * Its own file rather than more cases in cookProofConsent.test.ts because
 * the property under test is not "the flag round trips" — that is two
 * assertions — but the INDEPENDENCE of the question from the answer.
 * `markHouseholdCookSharingAsked` and `setHouseholdCookSharing` write two
 * different facts and neither may imply the other:
 *
 *   - Asking must never turn sharing on. A household that declines has
 *     been asked and shares nothing, and a decline that wrote `true` would
 *     be consent nobody gave.
 *   - Asking must never turn sharing OFF either. The one-time ask writes
 *     the enable first and marks the question answered second, so a
 *     `markHouseholdCookSharingAsked` that reset the flag would erase the
 *     "yes" one line after it landed.
 *   - Turning sharing on from Instellingen must never mark the question
 *     asked. Settings is a different door; a household that found the
 *     switch itself has still never been asked, and silently recording
 *     otherwise would suppress the contextual ask for someone the product
 *     never spoke to.
 *
 * The getter is asserted to REFUSE an unknown id rather than answer
 * `false`, matching `getHouseholdCookSharing` and for the same reason: at
 * the call site "no such household" and "never asked" read identically,
 * and answering the first as the second would re-open a question §5 says
 * is asked exactly once.
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { createInMemoryKeyValueStore, type KeyValueStore } from '@/lib/repository/keyValueStore';
import { createLocalRepository } from '@/lib/repository/localRepository';
import type { RemyRepository } from '@/lib/repository/types';

describe('the one-time cook-sharing ask (households, local-only)', () => {
  let store: KeyValueStore;
  let repository: RemyRepository;

  beforeEach(() => {
    store = createInMemoryKeyValueStore();
    repository = createLocalRepository(store);
  });

  test('a freshly seeded household has never been asked', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    expect(await repository.getHouseholdCookSharingAsked(householdId)).toBe(false);
  });

  test('marking the question asked survives a re-read through a second repository over the same store', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    await repository.markHouseholdCookSharingAsked(householdId);

    // A second repository over the same store is the closest this test can
    // get to a relaunch: if the flag lived only in memory it would come
    // back false here, and the sheet would re-fire on every remount —
    // exactly the failure this field exists to prevent.
    const reopened = createLocalRepository(store);
    expect(await reopened.getHouseholdCookSharingAsked(householdId)).toBe(true);
  });

  test('marking twice is idempotent — the question stays asked once', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    await repository.markHouseholdCookSharingAsked(householdId);
    await repository.markHouseholdCookSharingAsked(householdId);

    expect(await repository.getHouseholdCookSharingAsked(householdId)).toBe(true);
  });

  test('a decline — asked, never enabled — leaves sharing off', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    await repository.markHouseholdCookSharingAsked(householdId);

    expect(await repository.getHouseholdCookSharingAsked(householdId)).toBe(true);
    expect(await repository.getHouseholdCookSharing(householdId)).toBe(false);
  });

  test('an accept — enable, then mark asked — keeps both facts', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    // The exact order the ask's single answer path uses.
    await repository.setHouseholdCookSharing(householdId, true);
    await repository.markHouseholdCookSharingAsked(householdId);

    expect(await repository.getHouseholdCookSharing(householdId)).toBe(true);
    expect(await repository.getHouseholdCookSharingAsked(householdId)).toBe(true);
  });

  test('turning the switch on from Instellingen does not mark the question asked', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    await repository.setHouseholdCookSharing(householdId, true);

    expect(await repository.getHouseholdCookSharingAsked(householdId)).toBe(false);
  });

  test('revoking sharing later does not un-ask the question', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    await repository.setHouseholdCookSharing(householdId, true);
    await repository.markHouseholdCookSharingAsked(householdId);
    await repository.setHouseholdCookSharing(householdId, false);

    expect(await repository.getHouseholdCookSharing(householdId)).toBe(false);
    expect(await repository.getHouseholdCookSharingAsked(householdId)).toBe(true);
  });

  test('updating the weeknight budget carries the asked flag through untouched', async () => {
    await repository.seedIfEmpty();
    const householdId = await repository.getCurrentHouseholdId();

    await repository.markHouseholdCookSharingAsked(householdId);
    // `updateHouseholdSettings` rebuilds the row from a spread. If it ever
    // stops doing that, an unrelated settings save would silently re-open
    // a question §5 asks exactly once.
    await repository.updateHouseholdSettings(householdId, { weeknightTimeBudgetMinutes: 25 });

    expect(await repository.getHouseholdCookSharingAsked(householdId)).toBe(true);
  });

  test('an unknown household id is refused, never answered "never asked"', async () => {
    await repository.seedIfEmpty();

    await expect(repository.getHouseholdCookSharingAsked('household-that-does-not-exist')).rejects.toThrow(
      /household-that-does-not-exist/,
    );
    await expect(repository.markHouseholdCookSharingAsked('household-that-does-not-exist')).rejects.toThrow(
      /household-that-does-not-exist/,
    );
  });
});

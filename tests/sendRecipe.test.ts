/**
 * The two repository calls behind DESIGN-SOCIAL.md §3.1's FIRST entry
 * point — the `Stuur door` on `OutcomeCard`, after a grade commits
 * (src/lib/sendRecipe.ts).
 *
 * WHY THIS SUITE EXISTS AT ALL, and it is tests/friendProof.test.ts's
 * lesson repeated on the next feature: `OutcomeCard` has carried an
 * `onSendRecipe` prop, a Dutch label, an accessibility label and a styled
 * tertiary button for a whole phase, and NO CALL SITE EVER PASSED THE
 * PROP — so the entry point rendered nothing while every copy test around
 * it stayed green. Those tests asked "does the button read well?"; none
 * asked "does anybody hand it a handler?". The wiring now lives in a
 * module that can be imported, and this file asks the second question.
 *
 * Both call sites are route modules (src/app/(tabs)/index.tsx and
 * src/app/cook/[mealId].tsx) and a route module cannot be imported in this
 * environment at all — expo-router and react-native internals fail to
 * parse — so anything asserted here had to be lifted out of them first.
 * That is the whole reason src/lib/sendRecipe.ts exists.
 *
 * The fakes are two methods and one method wide, which is exactly what
 * `SendAudienceSource` and `SendRecipeSink` narrow the repository to.
 * Reaching past them would not compile, which is the point of the `Pick`:
 * this module can no more read a cook event than friendProof.ts can write
 * a send.
 */

import { describe, expect, test, vi } from 'vitest';
import {
  SEND_FAILED_ANNOUNCEMENT,
  describeSendAnnouncement,
  type SendRowStatus,
} from '@/components/sendRecipeSheetCopy';
import type { Block, Follow, Profile, ProfileId } from '@/domain/social/types';
import { createInMemoryKeyValueStore } from '@/lib/repository/keyValueStore';
import { createMirrorOutbox, type MirrorOutbox } from '@/lib/repository/mirror';
import type { RecipeShare, SendRecipeInput } from '@/lib/repository/social/types';
import * as sendRecipeModule from '@/lib/sendRecipe';
import {
  describeSendOutcomeAnnouncement,
  isSendableRowStatus,
  loadSendAudience,
  sendRecipeToFriend,
  type SendAudienceSource,
  type SendRecipeSink,
} from '@/lib/sendRecipe';
import { PROFILE_A, PROFILE_B, PROFILE_C, makeProfile } from './social/fixtures';

const ME = PROFILE_A;
const SANNE = PROFILE_B;
const JORIS = PROFILE_C;

interface AudienceOptions {
  readonly follows?: readonly Follow[];
  readonly blocks?: readonly Block[];
  readonly profiles?: readonly Profile[];
  readonly failFollows?: boolean;
  readonly failProfiles?: boolean;
}

/**
 * One directed row. PD-024's graph holds two per pair, so a send audience
 * is built out of PAIRS of these — which is the whole point of `mutual`
 * below and the reason a one-way row is its own test.
 */
function makeFollow(overrides: Partial<Follow> = {}): Follow {
  return {
    id: 'follow-1',
    followerId: ME,
    followeeId: SANNE,
    status: 'accepted',
    createdAt: '2026-06-01T10:00:00.000Z',
    respondedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Both directions accepted — what `is_friend_of` means since migration 0021. */
function mutual(a: string, b: string): readonly Follow[] {
  return [
    makeFollow({ id: `${a}->${b}`, followerId: a, followeeId: b }),
    makeFollow({ id: `${b}->${a}`, followerId: b, followeeId: a }),
  ];
}

function makeAudienceSource(options: AudienceOptions = {}) {
  const profiles = new Map((options.profiles ?? []).map((profile) => [profile.id, profile]));
  return {
    listFollows: vi.fn(async (): Promise<readonly Follow[]> => {
      if (options.failFollows === true) {
        throw new Error('no session');
      }
      return options.follows ?? [];
    }),
    listBlocks: vi.fn(async (): Promise<readonly Block[]> => options.blocks ?? []),
    getProfile: vi.fn(async (profileId: ProfileId): Promise<Profile | null> => {
      if (options.failProfiles === true) {
        throw new Error('profile read refused');
      }
      return profiles.get(profileId) ?? null;
    }),
  } satisfies SendAudienceSource;
}

const sanne = makeProfile({ id: SANNE, handle: 'sanne', displayName: 'Sanne' });
const joris = makeProfile({ id: JORIS, handle: 'joris', displayName: 'Joris' });

// ---------------------------------------------------------------------------
// Who the card may offer to send to
// ---------------------------------------------------------------------------

describe('loadSendAudience — the read the outcome card gates its button on', () => {
  test('names everyone the sender is MUTUALLY connected to', async () => {
    const source = makeAudienceSource({ follows: mutual(ME, SANNE), profiles: [sanne] });

    const audience = await loadSendAudience(source, ME);

    expect(source.listFollows).toHaveBeenCalledWith(ME);
    expect(audience).toEqual([{ profileId: SANNE, displayName: 'Sanne', handle: 'sanne' }]);
  });

  test('⚠ A ONE-WAY FOLLOW IS NOT AN AUDIENCE, in either direction', async () => {
    // PD-024's sharpest line on this surface. The feed became asymmetric
    // and the send did not: a send is a message aimed at one named person,
    // so one-way would turn it into unsolicited post and §8's "no chat"
    // wall gets thin. `recipe_shares_insert` makes the same call server-
    // side through `is_friend_of`, which since 0021 means mutual.
    const iFollowThem = makeAudienceSource({
      follows: [makeFollow({ followerId: ME, followeeId: SANNE })],
      profiles: [sanne],
    });
    expect(await loadSendAudience(iFollowThem, ME)).toEqual([]);

    const theyFollowMe = makeAudienceSource({
      follows: [makeFollow({ followerId: SANNE, followeeId: ME })],
      profiles: [sanne],
    });
    expect(await loadSendAudience(theyFollowMe, ME)).toEqual([]);
  });

  test('only accepted rows count — a pending or declined half is not an audience', async () => {
    const source = makeAudienceSource({
      follows: [
        makeFollow({ id: 'f-1', followerId: ME, followeeId: SANNE, status: 'pending', respondedAt: null }),
        makeFollow({ id: 'f-2', followerId: SANNE, followeeId: ME, status: 'accepted' }),
        makeFollow({ id: 'f-3', followerId: ME, followeeId: JORIS, status: 'declined' }),
        makeFollow({ id: 'f-4', followerId: JORIS, followeeId: ME, status: 'accepted' }),
      ],
      profiles: [sanne, joris],
    });

    expect(await loadSendAudience(source, ME)).toEqual([]);
    expect(source.getProfile).not.toHaveBeenCalled();
  });

  test('a standing block empties the audience even when both directions are accepted', async () => {
    const source = makeAudienceSource({
      follows: mutual(ME, SANNE),
      blocks: [{ id: 'b-1', blockerId: SANNE, blockedId: ME, blockedAt: '2026-07-01T10:00:00.000Z', liftedAt: null }],
      profiles: [sanne],
    });

    expect(await loadSendAudience(source, ME)).toEqual([]);
  });

  test('a LIFTED block still empties it, because the acceptance predates the block', async () => {
    // The mechanism `blocks` keeps its row for: lifting restores the
    // ability to ask and never the answer somebody already gave.
    const source = makeAudienceSource({
      follows: mutual(ME, SANNE),
      blocks: [
        {
          id: 'b-1',
          blockerId: SANNE,
          blockedId: ME,
          blockedAt: '2026-07-01T10:00:00.000Z',
          liftedAt: '2026-08-01T10:00:00.000Z',
        },
      ],
      profiles: [sanne],
    });

    expect(await loadSendAudience(source, ME)).toEqual([]);
  });

  /**
   * The ids come back from Postgres and from a local store, and only one
   * of the two settles on a spelling. `friendshipRoleOf` is what
   * canonicalises them, which is why this function is built on it rather
   * than on a raw `===`.
   */
  test('matches the signed-in person however their uuid is cased', async () => {
    const source = makeAudienceSource({
      follows: mutual(ME.toUpperCase(), SANNE),
      profiles: [sanne],
    });

    expect((await loadSendAudience(source, ME)).map((friend) => friend.profileId)).toEqual([SANNE]);
  });

  test('never lists the sender themselves', async () => {
    const source = makeAudienceSource({
      follows: [makeFollow({ followerId: ME, followeeId: ME })],
      profiles: [makeProfile({ id: ME, handle: 'joost', displayName: 'Joost' })],
    });

    expect(await loadSendAudience(source, ME)).toEqual([]);
  });

  test('a friend whose profile will not resolve is dropped, never listed nameless', async () => {
    const source = makeAudienceSource({
      follows: [...mutual(ME, SANNE), ...mutual(ME, JORIS)],
      profiles: [sanne],
    });

    expect((await loadSendAudience(source, ME)).map((friend) => friend.displayName)).toEqual(['Sanne']);
  });

  test('one lookup per friend, however many rows name them', async () => {
    const source = makeAudienceSource({
      follows: [...mutual(ME, SANNE), ...mutual(ME, SANNE).map((f) => ({ ...f, id: `${f.id}-dup` }))],
      profiles: [sanne],
    });

    await loadSendAudience(source, ME);

    expect(source.getProfile).toHaveBeenCalledTimes(1);
  });

  test('no identity yet means no audience and no query at all', async () => {
    const source = makeAudienceSource({ profiles: [sanne] });

    expect(await loadSendAudience(source, null)).toEqual([]);
    expect(source.listFollows).not.toHaveBeenCalled();
  });

  test('a failed follow read is silence, not a crash on the outcome card', async () => {
    expect(await loadSendAudience(makeAudienceSource({ failFollows: true }), ME)).toEqual([]);
  });

  test('a failed profile read is silence too', async () => {
    const source = makeAudienceSource({
      follows: mutual(ME, SANNE),
      failProfiles: true,
    });

    expect(await loadSendAudience(source, ME)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The write
// ---------------------------------------------------------------------------

function makeSink(options: { readonly fail?: boolean } = {}) {
  return {
    sendRecipe: vi.fn(async (input: SendRecipeInput): Promise<RecipeShare> => {
      if (options.fail === true) {
        throw new Error('rls refused');
      }
      return {
        id: 'share-1',
        mealId: input.mealId,
        senderProfileId: input.senderProfileId,
        recipientProfileId: input.recipientProfileId,
        note: input.note,
        sentAt: '2026-01-01T00:00:00.000Z',
      };
    }),
  } satisfies SendRecipeSink;
}

const SEND: SendRecipeInput = {
  mealId: 'meal-traybake',
  senderProfileId: ME,
  recipientProfileId: SANNE,
  note: '  die citroen niet overslaan  ',
};

/** An outbox with nothing queued: every meal's mirror has landed. */
function makeSettledOutbox(): MirrorOutbox {
  return createMirrorOutbox(createInMemoryKeyValueStore());
}

/** An outbox still holding this meal — the window between the local write and Postgres. */
async function makePendingOutbox(mealId: string): Promise<MirrorOutbox> {
  const outbox = makeSettledOutbox();
  await outbox.enqueue({
    kind: 'meal',
    meal: { id: mealId } as never,
    ingredients: [],
    steps: [],
  });
  return outbox;
}

describe('sendRecipeToFriend — one row, one send', () => {
  test('reports the commit the row is about to draw', async () => {
    const sink = makeSink();

    expect(await sendRecipeToFriend(sink, makeSettledOutbox(), SEND)).toBe('sent');
    expect(sink.sendRecipe).toHaveBeenCalledTimes(1);
  });

  /**
   * `normalizeSendNote` trims, nulls a blank one and REJECTS an over-long
   * one rather than cutting it short — one implementation of that rule, at
   * the write. Anything trimmed or measured here would be a second.
   */
  test('hands the note over raw, trimming and measuring nothing', async () => {
    const sink = makeSink();

    await sendRecipeToFriend(sink, makeSettledOutbox(), SEND);

    expect(sink.sendRecipe).toHaveBeenCalledWith(SEND);
  });

  test('a refused write reports failure instead of throwing at the screen', async () => {
    await expect(sendRecipeToFriend(makeSink({ fail: true }), makeSettledOutbox(), SEND)).resolves.toBe('failed');
  });

  /**
   * There is no second question to ask: `sendRecipe` returns the row it
   * upserted. A re-read would also be the first step toward a sender-side
   * record of what you sent whom, which §3.5 has not asked for.
   */
  test('never reads back after writing', async () => {
    const sink = makeSink();

    await sendRecipeToFriend(sink, makeSettledOutbox(), SEND);
    await sendRecipeToFriend(sink, makeSettledOutbox(), SEND);

    expect(sink.sendRecipe).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// The door the send opens, and the one condition under which it stays shut
// ---------------------------------------------------------------------------

/**
 * A send is the ONLY thing in this app that grants somebody outside the
 * household a read of a meal's ingredients: `meal_ingredients_select_sent_to_me`
 * (0009) turns on the moment the `recipe_shares` row exists. The
 * write-through mirror needs four requests to put a meal in Postgres, and
 * between the local write and the last of them the recipe is there but
 * empty. Sending in that window does not show a friend a smaller recipe —
 * it shows them a WRONG one, and one that looks like this household
 * published something half-finished.
 *
 * `hasPendingMealMirror` is the completeness marker, and it is durable
 * across restarts because it is the outbox itself asking.
 */
describe('sendRecipeToFriend — a meal whose mirror has not landed', () => {
  test('is not sent at all, rather than sent empty', async () => {
    const sink = makeSink();

    const outcome = await sendRecipeToFriend(sink, await makePendingOutbox(SEND.mealId), SEND);

    expect(outcome).toBe('failed');
    expect(sink.sendRecipe).not.toHaveBeenCalled();
  });

  /**
   * `failed` and not a third status, because §4.1 makes the row its own
   * retry: the mirror lands seconds later and the same tap works. A new
   * status would mean new copy on a sheet whose vocabulary is swept.
   */
  test('another meal in the backlog does not hold this one back', async () => {
    const sink = makeSink();

    const outcome = await sendRecipeToFriend(sink, await makePendingOutbox('meal-curry'), SEND);

    expect(outcome).toBe('sent');
    expect(sink.sendRecipe).toHaveBeenCalledTimes(1);
  });

  /**
   * FAILS CLOSED. An outbox that cannot be read cannot say the mirror
   * landed, and the harm of the two errors is not symmetrical: a send that
   * does not happen is a tap the user repeats, and a send that happens too
   * early is a friend looking at an empty recipe with this household's
   * name on it.
   */
  test('an unreadable outbox keeps the door shut rather than guessing', async () => {
    const sink = makeSink();
    const broken: MirrorOutbox = {
      list: async () => {
        throw new Error('storage gone');
      },
      enqueue: async () => {},
      settle: async () => {},
      recordFailure: async () => {},
    };

    expect(await sendRecipeToFriend(sink, broken, SEND)).toBe('failed');
    expect(sink.sendRecipe).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// What is said out loud
// ---------------------------------------------------------------------------

describe('describeSendOutcomeAnnouncement', () => {
  test('a commit is spoken with the existing sentence, not a second one', () => {
    expect(describeSendOutcomeAnnouncement('sent', 'Sanne')).toBe(describeSendAnnouncement('Sanne'));
  });

  test('a failure states that nothing was sent', () => {
    expect(describeSendOutcomeAnnouncement('failed', 'Sanne')).toBe(SEND_FAILED_ANNOUNCEMENT);
  });

  /**
   * `sendRecipe` upserts on (meal, recipient): a re-send amends the single
   * offer, moves no `sentAt` and resets no seen state. This function takes
   * no count, no previous attempt and no timestamp, so there is nothing a
   * second, louder sentence could even be built from.
   */
  test('a re-send is announced exactly like a first send', () => {
    expect(describeSendOutcomeAnnouncement('sent', 'Sanne')).toBe(describeSendOutcomeAnnouncement('sent', 'Sanne'));
  });
});

describe('isSendableRowStatus', () => {
  test('idle and failed are the two states a tap may act on', () => {
    expect(isSendableRowStatus('idle')).toBe(true);
    expect(isSendableRowStatus('failed')).toBe(true);
  });

  test('a row in flight or already committed is not tapped again', () => {
    expect(isSendableRowStatus('sending')).toBe(false);
    expect(isSendableRowStatus('sent')).toBe(false);
  });

  test('covers every status the sheet can hold', () => {
    const every: readonly SendRowStatus[] = ['idle', 'sending', 'sent', 'failed'];

    expect(every.map(isSendableRowStatus)).toEqual([true, false, false, true]);
  });
});

// ---------------------------------------------------------------------------
// The refusals, swept over everything this module can produce
// ---------------------------------------------------------------------------

/**
 * The same sweep tests/sendRecipeSheetCopy.test.ts runs over the sheet's
 * copy, applied to the module that now speaks for the outcome card. A
 * string added here later is covered without anybody extending a list.
 */
function everySentence(): readonly string[] {
  // Widened to `unknown` first — the idiom tests/sendRecipeSheetCopy.test.ts
  // and tests/addFriendCopy.test.ts already use and explain: `Object.values`
  // over a module namespace gives a union of literal types and functions,
  // which a `value is string` predicate cannot narrow from. This module
  // exports only functions today (its copy is imported from the sheet, never
  // restated), so without the widening the sweep does not compile at all —
  // and it still covers a string added here later, which is its whole point.
  const exported: readonly unknown[] = Object.values(sendRecipeModule);
  return [
    describeSendOutcomeAnnouncement('sent', 'Sanne'),
    describeSendOutcomeAnnouncement('failed', 'Sanne'),
    ...exported.filter((value): value is string => typeof value === 'string'),
  ];
}

describe('what this module may never say', () => {
  test('no read receipt: nothing here reports seeing, opening or reading', () => {
    for (const sentence of everySentence()) {
      for (const forbidden of ['gezien', 'geopend', 'gelezen', 'bekeken', 'ontvangen']) {
        expect(sentence.toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  test('no re-send celebration: nothing here knows a send happened before', () => {
    for (const sentence of everySentence()) {
      for (const forbidden of ['opnieuw verstuurd', 'nogmaals', 'alweer', 'weer verstuurd']) {
        expect(sentence.toLowerCase()).not.toContain(forbidden);
      }
    }
  });

  test('no cook gate: nothing here makes cooking sound like a precondition', () => {
    for (const sentence of everySentence()) {
      for (const forbidden of ['eerst koken', 'gekookt hebt', 'nog niet gekookt']) {
        expect(sentence.toLowerCase()).not.toContain(forbidden);
      }
    }
  });
});

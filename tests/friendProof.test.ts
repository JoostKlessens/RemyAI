/**
 * The cook-proof call site (docs/DESIGN-SOCIAL.md §2.1) — the half of the
 * wiring `tests/decide.test.ts` cannot see.
 *
 * decide.test.ts proves the engine consumes a proof map. These prove
 * somebody actually builds one: that `listFriendCookedRecipes` is called
 * at all, that the profile names are resolved rather than assumed, and
 * that what comes back is the assembled map and not an empty default. That
 * distinction is the whole lesson of this change — `FRIEND_PROOF_BOOST`
 * had a green test suite for three migrations while no caller passed it
 * anything, because every test asked "does the weight work?" and none
 * asked "does anyone use it?".
 *
 * The fake is three functions, which is exactly what `FriendProofSource`
 * narrows the repository to. Anything reaching past those three would not
 * compile here, which is the point of the `Pick`.
 */

import { describe, expect, test, vi } from 'vitest';
import type { Profile, ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';
import { loadFriendProof, loadFriendProofForRecipes, type FriendProofSource } from '@/lib/friendProof';
import type { FriendCook } from '@/lib/repository/social/types';
import { makeMeal } from './fixtures';
import { PROFILE_A, PROFILE_B, makeProfile, makeRecipeRating } from './social/fixtures';

const RECIPE = 'recipe-traybake';
const OTHER_RECIPE = 'recipe-pasta';

interface FakeOptions {
  readonly cooks?: readonly FriendCook[];
  readonly profiles?: readonly Profile[];
  readonly ratings?: readonly RecipeRating[];
}

/**
 * Every method is a spy, so a test can assert not just on the returned map
 * but on whether the read happened at all — "was the lookup called" is a
 * question this suite exists to answer.
 */
function makeSource(options: FakeOptions = {}) {
  const profiles = new Map((options.profiles ?? []).map((profile) => [profile.id, profile]));
  return {
    listFriendCookedRecipes: vi.fn(async (): Promise<readonly FriendCook[]> => options.cooks ?? []),
    getProfile: vi.fn(
      async (profileId: ProfileId): Promise<Profile | null> => profiles.get(profileId) ?? null,
    ),
    listRecipeRatings: vi.fn(
      async (recipeId: RecipeId): Promise<readonly RecipeRating[]> =>
        (options.ratings ?? []).filter((rating) => rating.recipeId === recipeId),
    ),
  } satisfies FriendProofSource;
}

const sanne = makeProfile({ id: PROFILE_A, handle: 'sanne', displayName: 'Sanne' });
const joris = makeProfile({ id: PROFILE_B, handle: 'joris', displayName: 'Joris' });

describe('loadFriendProof — the lookup actually happens', () => {
  test('calls listFriendCookedRecipes and returns what it implies', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [sanne] });

    const proof = await loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]);

    expect(source.listFriendCookedRecipes).toHaveBeenCalledTimes(1);
    expect(proof.get(RECIPE)).toEqual({ friendNames: ['Sanne'], grade: null });
  });

  test('resolves the display name through getProfile rather than assuming one', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [sanne] });

    await loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]);

    expect(source.getProfile).toHaveBeenCalledWith(PROFILE_A);
  });

  test('carries the public vote through, so the sentence can print a grade', async () => {
    const source = makeSource({
      cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }],
      profiles: [sanne],
      ratings: [makeRecipeRating({ id: 'r-1', recipeId: RECIPE, raterProfileId: PROFILE_A, rating: 8.5 })],
    });

    const proof = await loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]);

    expect(proof.get(RECIPE)).toEqual({ friendNames: ['Sanne'], grade: 8.5 });
  });

  test('one friend who cooked several of your recipes is looked up once', async () => {
    const source = makeSource({
      cooks: [
        { profileId: PROFILE_A, recipeId: RECIPE },
        { profileId: PROFILE_A, recipeId: OTHER_RECIPE },
      ],
      profiles: [sanne],
    });

    await loadFriendProof(source, [
      makeMeal({ id: 'meal-1', recipeId: RECIPE }),
      makeMeal({ id: 'meal-2', recipeId: OTHER_RECIPE }),
    ]);

    expect(source.getProfile).toHaveBeenCalledTimes(1);
  });
});

describe('loadFriendProof — bounded by the library, not by how much the circle cooks', () => {
  test('a library with no canonical recipes costs no queries at all', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [sanne] });

    const proof = await loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: null })]);

    expect(proof.size).toBe(0);
    expect(source.listFriendCookedRecipes).not.toHaveBeenCalled();
  });

  test('a friend cooking something you do not own fetches neither their name nor its votes', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_B, recipeId: OTHER_RECIPE }], profiles: [joris] });

    const proof = await loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]);

    expect(proof.size).toBe(0);
    expect(source.getProfile).not.toHaveBeenCalled();
    expect(source.listRecipeRatings).not.toHaveBeenCalled();
  });

  test('only the recipes in the library are asked about', async () => {
    const source = makeSource({
      cooks: [
        { profileId: PROFILE_A, recipeId: RECIPE },
        { profileId: PROFILE_B, recipeId: OTHER_RECIPE },
      ],
      profiles: [sanne, joris],
    });

    await loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]);

    expect(source.listRecipeRatings).toHaveBeenCalledTimes(1);
    expect(source.listRecipeRatings).toHaveBeenCalledWith(RECIPE);
  });
});

describe('loadFriendProof — a name that does not resolve', () => {
  /**
   * §2.1 bans a count without a name, so a cook nobody can name is not
   * downgraded to a vaguer sentence — the recipe leaves the map entirely,
   * which also removes its scoring boost (decide.ts derives the boosted
   * set from these keys). Silence over an anonymous aggregate.
   */
  test('an unnameable cook produces no entry rather than a nameless one', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [] });

    const proof = await loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]);

    expect(source.getProfile).toHaveBeenCalledWith(PROFILE_A);
    expect(proof.size).toBe(0);
  });

  test('one missing name does not cost the friend beside it', async () => {
    const source = makeSource({
      cooks: [
        { profileId: PROFILE_A, recipeId: RECIPE },
        { profileId: PROFILE_B, recipeId: RECIPE },
      ],
      profiles: [joris],
    });

    const proof = await loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]);

    expect(proof.get(RECIPE)).toEqual({ friendNames: ['Joris'], grade: null });
  });
});

describe('loadFriendProof — failure is silence, never a blank hero', () => {
  /**
   * No session, no network, 0009 not yet applied: all real, none of them a
   * reason to tell somebody there is no dinner. An empty map degrades
   * Kiezen to exactly its pre-social behaviour, which is a true answer.
   */
  test('a failing proof read resolves to an empty map instead of rejecting', async () => {
    const source = {
      ...makeSource(),
      listFriendCookedRecipes: vi.fn(async (): Promise<readonly FriendCook[]> => {
        throw new Error('shared_cooks does not exist');
      }),
    } satisfies FriendProofSource;

    await expect(
      loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]),
    ).resolves.toEqual(new Map());
  });

  test('a failing profile read is survivable too', async () => {
    const source = {
      ...makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }] }),
      getProfile: vi.fn(async (): Promise<Profile | null> => {
        throw new Error('no session');
      }),
    } satisfies FriendProofSource;

    await expect(
      loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]),
    ).resolves.toEqual(new Map());
  });

  test('a failing rating read is survivable too', async () => {
    const source = {
      ...makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [sanne] }),
      listRecipeRatings: vi.fn(async (): Promise<readonly RecipeRating[]> => {
        throw new Error('rate limited');
      }),
    } satisfies FriendProofSource;

    await expect(
      loadFriendProof(source, [makeMeal({ id: 'meal-1', recipeId: RECIPE })]),
    ).resolves.toEqual(new Map());
  });
});

/**
 * The recipe-id-keyed entry point — Bevestigen's shape, and the one the
 * `Meal[]` wrapper above delegates to.
 *
 * These are not a second copy of the suite above. Every test above enters
 * through `loadFriendProof` and therefore also proves the wrapper narrows
 * correctly; these enter through `loadFriendProofForRecipes` directly,
 * which is what src/app/import/confirm.tsx calls, and assert the
 * properties that screen depends on: a set of exactly one recipe, silence
 * for an unnameable cook, silence for a failed read, and no query at all
 * for an import with no canonical id.
 */
describe('loadFriendProofForRecipes — the same read, keyed on canonical ids', () => {
  test('answers for a single recipe id, which is all Bevestigen has', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [sanne] });

    const proof = await loadFriendProofForRecipes(source, [RECIPE]);

    expect(proof.get(RECIPE)).toEqual({ friendNames: ['Sanne'], grade: null });
  });

  /**
   * An import whose canonical write failed has no id to look proof up by.
   * Asking anyway would be a `shared_cooks` round trip guaranteed to
   * return nothing usable.
   */
  test('an empty set of recipe ids costs no queries at all', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [sanne] });

    const proof = await loadFriendProofForRecipes(source, []);

    expect(proof.size).toBe(0);
    expect(source.listFriendCookedRecipes).not.toHaveBeenCalled();
  });

  test('only the named recipes are asked about, whatever else the circle cooked', async () => {
    const source = makeSource({
      cooks: [
        { profileId: PROFILE_A, recipeId: RECIPE },
        { profileId: PROFILE_B, recipeId: OTHER_RECIPE },
      ],
      profiles: [sanne, joris],
    });

    const proof = await loadFriendProofForRecipes(source, [RECIPE]);

    expect(proof.size).toBe(1);
    expect(source.listRecipeRatings).toHaveBeenCalledTimes(1);
    expect(source.listRecipeRatings).toHaveBeenCalledWith(RECIPE);
  });

  /** §2.3: an empty answer on Bevestigen must never read as a verdict on the recipe. */
  test('an unnameable cook produces no entry, so the screen prints no line', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [] });

    const proof = await loadFriendProofForRecipes(source, [RECIPE]);

    expect(proof.get(RECIPE)).toBeUndefined();
  });

  test('a failing read resolves to an empty map rather than rejecting into the import', async () => {
    const source = {
      ...makeSource(),
      listFriendCookedRecipes: vi.fn(async (): Promise<readonly FriendCook[]> => {
        throw new Error('no session');
      }),
    } satisfies FriendProofSource;

    await expect(loadFriendProofForRecipes(source, [RECIPE])).resolves.toEqual(new Map());
  });

  test('the same id twice is one lookup, not two', async () => {
    const source = makeSource({ cooks: [{ profileId: PROFILE_A, recipeId: RECIPE }], profiles: [sanne] });

    await loadFriendProofForRecipes(source, [RECIPE, RECIPE]);

    expect(source.listRecipeRatings).toHaveBeenCalledTimes(1);
  });
});

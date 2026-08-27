/**
 * Trending's data layer: the two lists behind the tab's two scopes.
 *
 * WHAT MOVED, AND WHY. Trending used to answer one question — "what is
 * highly rated, everywhere" — and a second list answering the same question
 * about your friends lived on Vrienden, behind a `Gekookt | Kring`
 * segmented control. That was the wrong seam. The owner said so plainly: he
 * wanted his friends' best-rated recipes on the ranking tab, not in a
 * separate list on a tab about what people cooked. So the friends ranking
 * moved here, beside the global one, and Vrienden went back to being one
 * list. Nothing about the ranking itself changed: `rankKring`,
 * `assembleKring`, `KringRow` and every string in `kringPresentation.ts`
 * are reused exactly as they were, and this module is the read that
 * followed them across.
 *
 * The friends read below is `_gekooktSource.ts`'s kring half, carried over
 * with its comments intact — the same kind of carve that produced
 * `_gekooktSource.ts` itself. What is genuinely new is only the sharing:
 * both scopes now come out of ONE `listAllRecipeRatings`.
 *
 * THAT SHARING IS THE POINT, NOT AN OPTIMISATION. A global board means
 * fetching every rating row in the database in order to rank them —
 * `_fixtures.ts`'s header flags that as the thing to fix before this scales
 * — and doing it a second time on the same screen, to narrow the same rows
 * to a handful of friends, would be indefensible. One whole-table read, two
 * independent rankings over it. The single `listCanonicalRecipes` call
 * below is there for the same reason: the two scopes name overlapping
 * dishes, and asking twice would be two round trips for one answer.
 *
 * THE TWO LISTS ARE NEVER MERGED, NEVER BACKFILLED, NEVER PADDED
 * (DESIGN-SOCIAL.md §2.2). They share a fetch and nothing else: two
 * assemblers, two orderings, two lists, and a thin friends ranking stays
 * visibly thin. Topping one up from the other would rebuild the refused
 * "Ontdekken" surface out of spare parts, and `assembleKring` has no
 * parameter to do it with — deliberately, and that stays true.
 *
 * THE FLOOR APPLIES TO ONE SCOPE ONLY, and that asymmetry is real rather
 * than an oversight. `rankRecipes` shrinks toward a population prior and
 * refuses anything under the minimum vote count, because its voters are
 * strangers; `rankKring` applies no floor and no shrinkage, because two
 * named friends are evidence where a stranger's single vote is noise. So
 * the global list can be empty while the friends list is full. That is not
 * a bug, and the `__DEV__` mapping at the bottom deliberately makes it easy
 * to look at.
 *
 * NOTHING HERE IS ORDERED BY RECENCY, and nothing here reads a timestamp
 * into a view model. `RecipeRating.ratedAt` passes through untouched. A
 * list that moves because something is new is a feed wearing a ranking's
 * clothes.
 */

import { getKringFixture, type FriendFeedScenario } from '@/app/friends/_fixtures';
import { getBoardFixture, type BoardScenario } from '@/app/ranglijst/_fixtures';
import { assembleKring, type KringRecipe, type KringRowModel } from '@/components/kringPresentation';
import {
  LEADERBOARD_MAX_ROWS,
  assembleLeaderboard,
  type BoardRecipe,
  type BoardRowModel,
} from '@/components/leaderboardPresentation';
import { collectAcceptedFriendIds } from '@/domain/social/friendship';
import { buildLeaderboard } from '@/domain/social/leaderboard';
import type { ProfileId, RecipeId, RecipeRating } from '@/domain/social/types';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import type { CanonicalRecipeSummary } from '@/lib/repository/social/types';
import { supabase } from '@/lib/supabase';

/** Both scopes, from whichever source produced them. Held together because one read fills both. */
export interface TrendingData {
  /** Everyone's ranking — `rankRecipes`, with its prior, its shrinkage and its floor. */
  readonly boardRows: readonly BoardRowModel[];
  /** Your friends' ranking — `rankKring`, plain averages with the voters named. */
  readonly friendRows: readonly KringRowModel[];
}

/**
 * The honest zero for both scopes. Exported because the screen's own
 * initial state is built from it — a second empty literal there would be
 * one more place to forget a field when this shape grows.
 */
export const NO_TRENDING_DATA: TrendingData = { boardRows: [], friendRows: [] };

/** The friends half of one read: the votes that count, and the names behind them. */
interface FriendVotes {
  readonly votes: readonly RecipeRating[];
  readonly voterNames: ReadonlyMap<ProfileId, string>;
}

const NO_FRIEND_VOTES: FriendVotes = { votes: [], voterNames: new Map() };

/**
 * A canonical recipe, dressed for a board row.
 *
 * `allergenTags` is empty and that is PD-006 rather than an omission: a
 * canonical `recipes` row carries no allergen tags, because tagging is
 * something a household does to its own copy on Bevestigen. So no collision
 * chip can appear on live data, and its absence says nothing whatsoever
 * about the dish. It must never be styled or read as reassurance.
 */
function toBoardRecipe(recipe: CanonicalRecipeSummary): BoardRecipe {
  return {
    recipeId: recipe.recipeId,
    title: recipe.title,
    creatorHandle: recipe.authorName ?? '',
    creatorPlatform: recipe.platform,
    thumbnailUrl: recipe.thumbnailUrl,
    allergenTags: [],
  };
}

/** `toBoardRecipe`'s sibling for the friends scope. The same PD-006 argument applies, unchanged. */
function toKringRecipe(recipe: CanonicalRecipeSummary): KringRecipe {
  return {
    recipeId: recipe.recipeId,
    title: recipe.title,
    creatorHandle: recipe.authorName ?? '',
    creatorPlatform: recipe.platform,
    thumbnailUrl: recipe.thumbnailUrl,
    allergenTags: [],
  };
}

/**
 * Who this reader's friends are, and which of the ratings already in hand
 * are theirs.
 *
 * NARROWING BEFORE RANKING IS NOT OPTIONAL. `rankKring`'s own header says
 * so in as many words: handing it every vote in the database would silently
 * produce a second global board with none of the board's protections. There
 * is no repository method that filters ratings by rater, so the narrowing
 * happens here, on the way in, and never after ranking. The set itself is
 * `src/domain/social/friendship.ts`'s.
 *
 * A null id is NOT a signed-out branch — PD-012 means the root layout
 * answers that before this tab ever renders. It only means the identity has
 * not resolved yet, and reading without one would ask the database a
 * question with no `auth.uid()` behind it. No accepted friends short-
 * circuits for the ordinary reason: there is nothing to narrow to.
 */
async function readFriendVotes(profileId: ProfileId | null, allRatings: readonly RecipeRating[]): Promise<FriendVotes> {
  if (profileId === null) {
    return NO_FRIEND_VOTES;
  }

  const repository = createSupabaseSocialRepository(supabase);
  const friendIds = collectAcceptedFriendIds(await repository.listFriendships(profileId), profileId);
  if (friendIds.size === 0) {
    return NO_FRIEND_VOTES;
  }

  const friendProfiles = await Promise.all([...friendIds].map((friendId) => repository.getProfile(friendId)));
  // A friend whose profile row failed to load keeps their vote and loses
  // their name: `buildKringMetaLine` falls back to a count rather than
  // shrinking the sample it claims.
  const voterNames = new Map(
    friendProfiles.flatMap((profile) => (profile === null ? [] : [[profile.id, profile.displayName] as const])),
  );
  return { votes: allRatings.filter((rating) => friendIds.has(rating.raterProfileId)), voterNames };
}

/**
 * Reads both scopes.
 *
 * ORDERED SO NOTHING UNNECESSARY IS FETCHED. Each ranking runs first, over
 * rows already in hand, and only the recipes that made one of the two cuts
 * are named — the alternative is pulling every canonical recipe in the
 * database to render at most LEADERBOARD_MAX_ROWS of them plus a handful of
 * friends' picks.
 *
 * `buildLeaderboard` runs twice — once here to learn which ids matter, once
 * inside `assembleLeaderboard`. That is deliberate and was true before this
 * change. It is a pure function of the same input, so the two runs cannot
 * disagree, and paying for it twice is cheaper than giving this module its
 * own copy of the ranking to keep in step with the domain's.
 */
export async function loadLiveTrending(profileId: ProfileId | null): Promise<TrendingData> {
  const repository = createSupabaseSocialRepository(supabase);
  const allRatings = await repository.listAllRecipeRatings();
  const { votes, voterNames } = await readFriendVotes(profileId, allRatings);

  const rankedBoardIds = buildLeaderboard(allRatings)
    .slice(0, LEADERBOARD_MAX_ROWS)
    .map((entry) => entry.recipeId);

  // One call for both scopes — see this file's header.
  const recipes = await repository.listCanonicalRecipes([
    ...new Set<RecipeId>([...rankedBoardIds, ...votes.map((vote) => vote.recipeId)]),
  ]);

  return {
    boardRows: assembleLeaderboard({
      ratings: allRatings,
      recipes: recipes.map(toBoardRecipe),
      excludedAllergenTags: [],
    }),
    friendRows:
      votes.length === 0
        ? []
        : assembleKring({ votes, recipes: recipes.map(toKringRecipe), voterNames, excludedAllergenTags: [] }),
  };
}

/**
 * Which friends-scope fixture stands beside each board fixture, so one
 * `__DEV__` switch moves both scopes at once.
 *
 * `net-te-weinig` is the one worth flipping to, and the mapping is chosen
 * for it: every recipe sits one vote under the board's floor, so the global
 * scope renders its empty state while the friends scope stays full. That is
 * the asymmetry this file's header describes — a floor on one ranking and
 * none on the other — and it is the state a reader is most likely to
 * mistake for a bug, so it should be easy to look at rather than reachable
 * only in production.
 *
 * `zonder_allergie` is deliberately not reached from here. It lives on
 * Vrienden's own dev row, where the appearing and disappearing "bevat
 * noten" label makes PD-006's point about the proof cards on that screen.
 */
const FRIEND_FIXTURE_BY_BOARD_SCENARIO: Readonly<Record<BoardScenario, FriendFeedScenario>> = {
  gevuld: 'gedeeld',
  'net-te-weinig': 'gedeeld',
  leeg: 'leeg',
};

/** Assembles both scopes from one `__DEV__` scenario, so a switch moves them together. */
export function loadFixtureTrending(scenario: BoardScenario): TrendingData {
  return {
    boardRows: assembleLeaderboard(getBoardFixture(scenario)),
    friendRows: assembleKring(getKringFixture(FRIEND_FIXTURE_BY_BOARD_SCENARIO[scenario])),
  };
}

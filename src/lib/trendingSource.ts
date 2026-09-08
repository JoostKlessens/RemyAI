/**
 * Trending's data layer: the two lists behind the tab's two scopes.
 *
 * WHERE IT LIVES, AND WHY THAT CHANGED. This was
 * src/app/ranglijst/_trendingSource.ts. The leading underscore was
 * believed to keep expo-router away from it and never did — the router's
 * `require.context` (expo-router/_ctx.js, SDK 57) excludes only `+api` and
 * `+html`, so this file was a route node with no default export and warned
 * on every launch. It is in src/lib now for the reason `gekooktSource.ts`
 * beside it spells out at length: this directory is the impure shell that
 * fetches, and a module under src/app cannot be imported by any test in
 * this repo. With its sibling `boardFixtures.ts` gone to `@/fixtures`, the
 * `src/app/ranglijst/` directory held nothing and was removed — the route
 * was always `(tabs)/ranglijst.tsx` and still is.
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
 * The friends read below is `gekooktSource.ts`'s kring half, carried over
 * with its comments intact — the same kind of carve that produced
 * `gekooktSource.ts` itself. What is genuinely new is only the sharing:
 * both scopes now come out of ONE `listAllRecipeRatings`.
 *
 * THAT SHARING IS THE POINT, NOT AN OPTIMISATION. A global board means
 * fetching every rating row in the database in order to rank them —
 * `boardFixtures.ts`'s header flags that as the thing to fix before this scales
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
 *
 * ===========================================================================
 * THE FILTER RUNS AFTER THIS MODULE, AND THAT DECIDED HOW MUCH IS FETCHED
 * ===========================================================================
 *
 * Trending grew a reader-set filter on 8 September 2026 (PD-014's amendment).
 * There were two places to put it, and this file is why it went where it did.
 *
 * FILTERING BEFORE THE CUT — narrow the whole ranked set, then take the top
 * LEADERBOARD_MAX_ROWS of what survives — is the more generous reading of
 * what a filter is. It gives "de top 25 curries" instead of "de curries in de
 * top 25", so a reader who picks a tag no top-25 recipe carries still gets
 * the best curries in the app rather than an empty screen.
 *
 * IT IS REFUSED HERE ON AN ARITHMETIC RATHER THAN A TASTE ARGUMENT, and the
 * arithmetic is the ceiling this codebase already accepted.
 * `assembleLeaderboard` cannot filter what it was never given a name for, so
 * filtering before the cut requires `listCanonicalRecipes` to be handed EVERY
 * over-floor recipe instead of twenty-five. `BOARD_RATING_ROW_CEILING` is
 * 50 000 rating rows and `LEADERBOARD_MIN_VOTES` is 3, so at the ceiling this
 * read already tolerates, that call can be asked for up to ~16 600 ids — a
 * PostgREST `in.(…)` of roughly 600 kB of URL, which does not fail slowly,
 * it fails. The design that survives its own stated ceiling is the one that
 * ships.
 *
 * MEASURED ON TODAY'S DATA THE TWO ARE INDISTINGUISHABLE, which is why the
 * ceiling had to decide it. The demo seed holds 8 recipes and 18 ratings, of
 * which exactly 3 recipes clear the floor — so the ranked set and the top 25
 * are the same three rows, and both designs fetch the same three recipes.
 * Nothing measurable today separates them.
 *
 * WHAT PAYS FOR THE REFUSAL IS THE CHIP ROW, not a compromise in here. The
 * chips Trending offers are collected from the cards that are actually on
 * screen (`collectSelectableBoardDishTags`), so a tag no top-25 recipe
 * carries is never offered — a reader cannot tap their way to the empty
 * result the "before" design was meant to avoid. The only way left to empty
 * the feed is a COMBINATION, and "Wissen" undoes that in one tap.
 *
 * ⚠ SO THIS FILE IS UNCHANGED BY THE FILTER, deliberately: same two reads,
 * same slice to LEADERBOARD_MAX_ROWS, same `assembleLeaderboard`. The filter
 * is pure and runs on the screen over rows already in hand, which is also
 * what keeps a chip tap from producing a spinner — the same property the
 * scope switch has and for the same reason.
 */

import { getKringFixture, type FriendFeedScenario } from '@/fixtures/friendFeedFixtures';
import { getBoardFixture, type BoardScenario } from '@/fixtures/boardFixtures';
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
 *
 * `dishTags` AND `estimatedMinutes` ARE REAL COLUMNS AND ARE CARRIED, which
 * is the exact opposite statement from the one above and is why the two sit
 * in one function. Both are on `recipes` since 0006 and both are written by
 * the extraction model at import; `allergenTags` is empty here because there
 * is nothing to carry, not because this mapper declined to carry it.
 * Trending's filter narrows on these two and on nothing else — see
 * `leaderboardPresentation.ts` for why a mood or a course axis would be a
 * filter over a column that does not exist.
 */
function toBoardRecipe(recipe: CanonicalRecipeSummary): BoardRecipe {
  return {
    recipeId: recipe.recipeId,
    title: recipe.title,
    creatorHandle: recipe.authorName ?? '',
    creatorPlatform: recipe.platform,
    thumbnailUrl: recipe.thumbnailUrl,
    allergenTags: [],
    dishTags: recipe.dishTags,
    estimatedMinutes: recipe.estimatedMinutes,
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
    // Carried since 8 September 2026, so this scope draws the same card as
    // the board. Both come off the canonical row this function is already
    // handed — see `toBoardRecipe` directly above, which does the identical
    // thing for the identical reason.
    dishTags: recipe.dishTags,
    estimatedMinutes: recipe.estimatedMinutes,
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
 *
 * IT READS ITS OWN VOTES, AND NOT THE BOARD'S. This used to be handed
 * `allRatings` — the whole of `recipe_ratings` — and filter it down. The
 * two scopes now need two different row sets, because de kring NAMES its
 * voters and the board does not: a household that unticked "vrienden mogen
 * zien dat ik dit heb gemaakt" on a cook keeps its grade in the board's
 * anonymous average and loses its name from the kring row. That difference
 * is `namable_recipe_votes` (0016), and it cannot be computed here — the
 * predicate reads another household's `meals`, which RLS refuses to every
 * reader, so a client attempt would see nothing excluded and fail open. It
 * is therefore a second whole-relation read rather than a second filter,
 * and the extra round trip is what buys a privacy filter that cannot be
 * got wrong from this side.
 */
async function readFriendVotes(profileId: ProfileId | null): Promise<FriendVotes> {
  if (profileId === null) {
    return NO_FRIEND_VOTES;
  }

  const repository = createSupabaseSocialRepository(supabase);
  const friendIds = collectAcceptedFriendIds(await repository.listFriendships(profileId), profileId);
  if (friendIds.size === 0) {
    return NO_FRIEND_VOTES;
  }
  // After the friend check, not before: no accepted friends means no kring
  // at all, and this is a whole-relation read worth not making.
  const namableVotes = await repository.listNamableRecipeVotes();

  const friendProfiles = await Promise.all([...friendIds].map((friendId) => repository.getProfile(friendId)));
  // A friend whose profile row failed to load keeps their vote and loses
  // their name: `buildKringMetaLine` falls back to a count rather than
  // shrinking the sample it claims.
  const voterNames = new Map(
    friendProfiles.flatMap((profile) => (profile === null ? [] : [[profile.id, profile.displayName] as const])),
  );
  return { votes: namableVotes.filter((rating) => friendIds.has(rating.raterProfileId)), voterNames };
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
  // Two reads, and they are not the same list: `allRatings` is every vote
  // and feeds the board's anonymous average, while `readFriendVotes` reads
  // `namable_recipe_votes` for the one surface that prints names. See that
  // function's header. In parallel because neither needs the other, and the
  // narrower one short-circuits on its own when there are no friends.
  const [allRatings, { votes, voterNames }] = await Promise.all([
    repository.listAllRecipeRatings(),
    readFriendVotes(profileId),
  ]);

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

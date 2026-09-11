/**
 * Explore's data layer: the global board, and nothing else.
 *
 * ⚠ IT FILLED TWO LISTS UNTIL 11 SEPTEMBER 2026 AND NOW FILLS ONE — the
 * second time that sentence has been true about this seam, and the
 * opposite move from the first. On 8 September de kring moved INTO this
 * file, out of Vrienden, because a friends-scoped ranking answered the
 * SAME question as the global one at a different scope, and that is what a
 * scope switch is for. PD-024 reverses the frame it rested on: the
 * question is no longer "what is highly rated, at which scope" but "whose
 * evidence am I looking at" — the people I follow, or everybody — and
 * those are two SURFACES rather than two scopes of one list.
 *
 * SO THE FRIEND EVIDENCE WENT BACK TO THE FEED, AND WHAT IT LOST ON THE
 * WAY IS THE ORDERING. ONTDEK-PLAN.md's valkuil 7 states the price
 * plainly: `rankKring` sorted the friends list by score, and on the feed
 * nothing sorts by score — a grade is decoration on a card whose subject
 * is a person. The average and the named voters survive; the ORDER does
 * not. What actually moved is the read: the consent-gated
 * `listNamableRecipeVotes` (migration 0016) now lives in
 * `src/lib/gekooktSource.ts`, narrowed by the same follow set, feeding the
 * grade on a proof card. That was always the load-bearing half.
 *
 * ⚠ `rankKring`, `assembleKring`, `KringRowModel` and
 * `kringPresentation.ts`'s list copy therefore have NO PRODUCTION CALLER
 * as of this change. They are not deleted, they are still tested, and
 * docs/LONGLIST.md ONT-07 records why: ONT-02's third card kind — the
 * friend who voted without cooking — is the case that revives them, and
 * throwing away a tested ranking in order to rewrite it later is the
 * expensive order to do this in.
 *
 * WHERE IT LIVES, AND WHY THAT CHANGED. This was
 * src/app/ranglijst/_trendingSource.ts. The leading underscore was
 * believed to keep expo-router away from it and never did — the router's
 * `require.context` (expo-router/_ctx.js, SDK 57) excludes only `+api` and
 * `+html`, so this file was a route node with no default export and warned
 * on every launch. It is in src/lib now for the reason `gekooktSource.ts`
 * beside it spells out at length: this directory is the impure shell that
 * fetches, and a module under src/app cannot be imported by any test in
 * this repo.
 *
 * ===========================================================================
 * THE HARD BOUNDARY OF FASE 2, AND THIS FILE IS ONE OF ITS TWO HALVES
 * ===========================================================================
 *
 * PD-024: "nothing from the feed may touch explore's ordering, and explore
 * may never backfill the feed. That is §8's 'no padding the kring',
 * inverted, and it earns a test — one that nails down that no row produced
 * by `rankRecipes` can land on the feed side."
 *
 * ⚠ `loadLiveTrending` TAKES NO ARGUMENTS, AND THAT IS THE ENFORCEMENT
 * RATHER THAN A TIDY-UP. It used to take a `ProfileId | null`, because the
 * friends scope needed one to narrow on. With that scope gone there is
 * nothing left on this surface that may know who is reading, so the
 * parameter is REMOVED rather than left unused: PD-014's sixth condition
 * is "no personalisation, ever", and a function that is never told the
 * reader's identity cannot personalise even by accident. Adding the
 * parameter back is the change a reviewer should refuse — there is no read
 * on this surface that needs it.
 *
 * The two surfaces now share NOTHING: not a read, not a type, not a
 * module. `src/components/ontdekPresentation.ts` holds the type-level half
 * of the same boundary, and tests/ontdekBoundary.test.ts is the test
 * PD-024 asked for.
 *
 * THE FLOOR IS THIS SURFACE'S ALONE, and the asymmetry that used to be
 * explained here has gone with the list it separated. `rankRecipes`
 * shrinks toward a population prior and refuses anything under
 * `LEADERBOARD_MIN_VOTES`, because its voters are strangers. There is no
 * second ranking here any more to contrast it with.
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
 * ⚠ SO THIS FILE IS UNCHANGED BY THE FILTER, deliberately: same read, same
 * slice to LEADERBOARD_MAX_ROWS, same `assembleLeaderboard`. The filter is
 * pure and runs on the screen over rows already in hand, which is also what
 * keeps a chip tap from producing a spinner — the same property the surface
 * switch has, and for the same reason.
 */

import { getBoardFixture, type BoardScenario } from '@/fixtures/boardFixtures';
import {
  LEADERBOARD_MAX_ROWS,
  assembleLeaderboard,
  type BoardRecipe,
  type BoardRowModel,
} from '@/components/leaderboardPresentation';
import { buildLeaderboard } from '@/domain/social/leaderboard';
import type { RecipeId } from '@/domain/social/types';
import { createSupabaseSocialRepository } from '@/lib/repository/social/supabaseSocialRepository';
import type { CanonicalRecipeSummary } from '@/lib/repository/social/types';
import { supabase } from '@/lib/supabase';

/**
 * The one list this surface has.
 *
 * IT IS STILL AN OBJECT AND NOT A BARE ARRAY, on purpose. Fase 3 adds a
 * search result beside the board (ONTDEK-PLAN.md), and that is a SECOND
 * list on this surface whose relationship to the board has to be declared
 * somewhere. A bare array would make that arrival a change to every call
 * site; an object with one field makes it a new field with its own doc.
 *
 * ⚠ WHAT IT MAY NEVER GROW IS A FIELD FED BY THE FEED. No proof cards, no
 * sends, no follow-scoped rows, under any name. See this file's header on
 * the boundary, and the test that holds it.
 */
export interface TrendingData {
  /** Everyone's ranking — `rankRecipes`, with its prior, its shrinkage and its floor. */
  readonly boardRows: readonly BoardRowModel[];
}

/**
 * The honest zero. Exported because the screen's own initial state is built
 * from it — a second empty literal there would be one more place to forget
 * a field when this shape grows.
 */
export const NO_TRENDING_DATA: TrendingData = { boardRows: [] };

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

/**
 * Reads the board.
 *
 * ⚠ IT TAKES NOTHING, AND THAT IS LOAD-BEARING — see this file's header.
 * There is no identity on this surface to narrow with, so there is no
 * parameter to narrow with either.
 *
 * ORDERED SO NOTHING UNNECESSARY IS FETCHED. The ranking runs first, over
 * rows already in hand, and only the recipes that made the cut are named —
 * the alternative is pulling every canonical recipe in the database in
 * order to render at most LEADERBOARD_MAX_ROWS of them.
 *
 * `buildLeaderboard` runs twice — once here to learn which ids matter, once
 * inside `assembleLeaderboard`. That is deliberate and predates this
 * change. It is a pure function of the same input, so the two runs cannot
 * disagree, and paying for it twice is cheaper than giving this module its
 * own copy of the ranking to keep in step with the domain's.
 */
export async function loadLiveTrending(): Promise<TrendingData> {
  const repository = createSupabaseSocialRepository(supabase);
  // Every vote in the database, feeding the board's anonymous average.
  // `boardFixtures.ts`'s header flags this whole-relation read as the thing
  // to fix before this scales, and `BOARD_RATING_ROW_CEILING` is the
  // standing brake on it.
  const allRatings = await repository.listAllRecipeRatings();

  const rankedBoardIds = buildLeaderboard(allRatings)
    .slice(0, LEADERBOARD_MAX_ROWS)
    .map((entry) => entry.recipeId);

  const recipes = await repository.listCanonicalRecipes([...new Set<RecipeId>(rankedBoardIds)]);

  return {
    boardRows: assembleLeaderboard({
      ratings: allRatings,
      recipes: recipes.map(toBoardRecipe),
      excludedAllergenTags: [],
    }),
  };
}

/** Assembles the board from one `__DEV__` scenario. */
export function loadFixtureTrending(scenario: BoardScenario): TrendingData {
  return { boardRows: assembleLeaderboard(getBoardFixture(scenario)) };
}

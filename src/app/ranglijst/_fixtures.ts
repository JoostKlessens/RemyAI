/**
 * Fixture data for Ranglijst (PD-014, docs/DESIGN.md §9).
 *
 * WHY THIS SURFACE SHIPS ON FIXTURES, AND WHAT IS ACTUALLY MISSING.
 * The board is the first surface in the app that needs data no client can
 * currently reach. Canonical recipes do exist in Postgres — the
 * `parse-recipe` edge function writes them with the service role — and
 * both `recipes` (0006) and `recipe_ratings` (0007) already grant SELECT
 * to any authenticated user, so RLS is not what stands in the way. What is
 * missing is the read path itself: `src/lib/repository/social/` contains
 * only `localSocialRepository.ts`, an on-device store whose own header
 * says it exists "not to ship a social feature", and nothing in `src/`
 * constructs a social repository at all. A global board is by definition
 * cross-household, so it cannot be served from a device-local store.
 *
 * This is the same staging Fase 5b used for Vrienden
 * (src/app/friends/_fixtures.ts) and it is deliberate: the screen, the
 * copy and the ranking are finished and provable now, and the day
 * `supabaseSocialRepository.ts` lands, this file is the only thing that
 * gets deleted. Nothing downstream of it knows the data was fake.
 *
 * ONE THING TO DECIDE BEFORE THAT REPOSITORY IS WRITTEN. The aggregate is
 * client-side on purpose (see src/domain/social/leaderboard.ts), which for
 * a single recipe means fetching a handful of rows. A *global* board means
 * fetching every rating row in the database in order to rank them. That is
 * fine at launch scale and is not fine indefinitely. The fix, when it is
 * needed, is a SQL aggregate returning per-recipe (count, avg) — which the
 * database's own `unique (recipe_id, rater_profile_id)` and its range and
 * step CHECKs (0008) make provably identical to what
 * `summarizeRecipeRatingsByRecipe` computes — with `rankRecipes` still
 * owning the prior, the shrinkage and the floor. Ranking stays in one
 * place either way. It needs a migration, so it needs the owner to push it.
 */

import type { BoardRecipe } from '@/components/leaderboardPresentation';
import { LEADERBOARD_MIN_VOTES } from '@/domain/social/leaderboard';
import type { RecipeRating } from '@/domain/social/types';

export type BoardScenario = 'gevuld' | 'net-te-weinig' | 'leeg';

export const DEFAULT_BOARD_SCENARIO: BoardScenario = 'gevuld';

export const BOARD_SCENARIOS: readonly BoardScenario[] = ['gevuld', 'net-te-weinig', 'leeg'];

const FIXTURE_RATED_AT = '2026-01-01T00:00:00.000Z';

/**
 * `count` votes for one recipe, each from a distinct rater — a repeated
 * rater collapses to one vote in `ratings.ts`, so reusing an id here would
 * quietly build a smaller sample than the fixture claims.
 *
 * Scores are dealt round-robin from `pattern` rather than repeated, so the
 * averages land on realistic decimals instead of a suspiciously flat
 * "8,00" that would never exercise the Dutch comma or the second decimal.
 *
 * The patterns are Dutch report-card grades, which cluster high: people
 * who bother to rate a recipe they chose to cook rate it well. That is
 * what makes the board's population prior sit near 8 rather than near the
 * midpoint, and it is the realistic shape to develop against — a fixture
 * spread evenly over 1-10 would make the shrinkage look far gentler than
 * it will be in practice.
 */
function votes(recipeId: string, pattern: readonly number[], count: number): readonly RecipeRating[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `${recipeId}-vote-${index}`,
    recipeId,
    raterProfileId: `fixture-rater-${index}`,
    rating: pattern[index % pattern.length] ?? 7,
    ratedAt: FIXTURE_RATED_AT,
  }));
}

const RECIPES: readonly BoardRecipe[] = [
  {
    recipeId: 'recipe-tiramisu',
    title: 'Pistache-tiramisu',
    creatorHandle: 'kokenmetkees',
    creatorPlatform: 'tiktok',
    thumbnailUrl: null,
    // The collision case: this really does contain nuts, and the board
    // must label it without moving it (PD-014 condition 6 vs PD-007a).
    allergenTags: ['noten'],
  },
  {
    recipeId: 'recipe-zalm',
    title: 'Zalm uit de oven met venkel',
    creatorHandle: 'sanne.kookt',
    creatorPlatform: 'tiktok',
    thumbnailUrl: null,
    allergenTags: ['vis'],
  },
  {
    recipeId: 'recipe-ramen',
    title: 'Ramen met gepocheerd ei',
    creatorHandle: 'noedelnoah',
    creatorPlatform: 'tiktok',
    thumbnailUrl: null,
    allergenTags: ['ei', 'soja', 'gluten'],
  },
  {
    recipeId: 'recipe-linzen',
    title: 'Linzensoep met citroen',
    creatorHandle: 'sanne.kookt',
    creatorPlatform: 'tiktok',
    thumbnailUrl: null,
    allergenTags: [],
  },
  {
    recipeId: 'recipe-pasta',
    title: 'Pasta met geroosterde paprika',
    creatorHandle: 'kokenmetkees',
    creatorPlatform: 'tiktok',
    thumbnailUrl: null,
    allergenTags: ['gluten'],
  },
];

const POPULATED_RATINGS: readonly RecipeRating[] = [
  // Deliberately close at the top: tiramisu has the wider sample, zalm the
  // slightly better grades. Whichever way the arithmetic lands, the two
  // exercise the case the board exists to get right — and if their scores
  // round to the same number, the vote count is what separates them.
  ...votes('recipe-tiramisu', [9, 8.5, 9, 8.5], 84),
  ...votes('recipe-zalm', [9, 8.5, 9, 9], 61),
  ...votes('recipe-ramen', [8.5, 8, 8, 8.5], 38),
  ...votes('recipe-linzen', [7.5, 7, 8, 7], 22),
  ...votes('recipe-pasta', [7, 6.5, 7, 7.5], 17),
];

/**
 * Every recipe sits one vote under the floor, so the board is empty while
 * ratings genuinely exist. The state that would otherwise only be found in
 * production: not "nothing has been rated" but "nothing has been rated
 * *enough*", which is exactly what BOARD_EMPTY_COPY claims.
 */
const NEARLY_ENOUGH_RATINGS: readonly RecipeRating[] = RECIPES.flatMap((recipe) =>
  votes(recipe.recipeId, [8, 7.5], Math.max(0, LEADERBOARD_MIN_VOTES - 1)),
);

export interface BoardFixture {
  readonly ratings: readonly RecipeRating[];
  readonly recipes: readonly BoardRecipe[];
  readonly excludedAllergenTags: readonly string[];
}

/**
 * The household in these fixtures excludes nuts, so the top recipe carries
 * a collision chip. That is the interesting case to look at by default:
 * a labelled row that has *not* been demoted is the one thing on this
 * screen a reader could mistake for a bug.
 */
export function getBoardFixture(scenario: BoardScenario): BoardFixture {
  switch (scenario) {
    case 'gevuld':
      return { ratings: POPULATED_RATINGS, recipes: RECIPES, excludedAllergenTags: ['noten'] };
    case 'net-te-weinig':
      return { ratings: NEARLY_ENOUGH_RATINGS, recipes: RECIPES, excludedAllergenTags: ['noten'] };
    case 'leeg':
      return { ratings: [], recipes: RECIPES, excludedAllergenTags: [] };
  }
}
